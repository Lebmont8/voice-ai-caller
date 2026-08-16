const DEFAULT_UPDATE_DELAY_MS = 900;
const DEFAULT_MAX_BLOCK_CHARS = 3400;

function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function appendDelta(current, delta) {
  const next = normalizeText(delta);
  if (!next) return current;
  if (!current) return next;
  if (current.endsWith(next)) return current;
  if (next.startsWith(current)) return next;
  return `${current}${/^[\p{P}\p{S}]/u.test(next) ? "" : " "}${next}`;
}

function isMessageNotModified(error) {
  return /message is not modified/iu.test(String(error?.message ?? error));
}

export function createFixedTargetResolver({ accountId, chatId, allowedAgentIds = [] }) {
  const agents = new Set(allowedAgentIds.map(String));
  const target = { accountId: String(accountId), chatId: String(chatId) };
  return (payload) => {
    const stored = payload?.liveTranscriptTarget;
    if (stored?.accountId === target.accountId && String(stored.chatId) === target.chatId) {
      return target;
    }
    if (payload?.agentId && agents.has(String(payload.agentId))) return target;
    return null;
  };
}

export class TelegramLiveTranscriptPublisher {
  constructor(options) {
    if (typeof options?.sendText !== "function" || typeof options?.editText !== "function") {
      throw new Error("sendText and editText adapters are required");
    }
    if (typeof options?.resolveTarget !== "function") {
      throw new Error("resolveTarget is required");
    }
    this.sendText = options.sendText;
    this.editText = options.editText;
    this.resolveTarget = options.resolveTarget;
    this.logger = options.logger ?? console;
    this.updateDelayMs = options.updateDelayMs ?? DEFAULT_UPDATE_DELAY_MS;
    this.maxBlockChars = options.maxBlockChars ?? DEFAULT_MAX_BLOCK_CHARS;
    this.labels = {
      active: "📞 Call active",
      ended: "✅ Call ended",
      error: "⚠️ Call ended with an error",
      connecting: "Connecting…",
      user: "👤 Other person",
      assistant: "🤖 AI",
      part: "part",
      ...(options.labels || {}),
    };
    this.states = new Map();
    this.writeQueue = Promise.resolve();
    this.stopped = false;
  }

  createPart(index) {
    return { index, entries: [], messageId: null, lastText: "", timer: null, sealed: false };
  }

  statusHeader(state, part) {
    const suffix = state.parts.length > 1 || part.index > 1
      ? ` · ${this.labels.part} ${part.index}`
      : "";
    return `${this.labels[state.status]}${suffix}`;
  }

  renderPart(state, part, includePartial = true) {
    const lines = [this.statusHeader(state, part)];
    for (const entry of part.entries) {
      const label = entry.role === "assistant" ? this.labels.assistant : this.labels.user;
      lines.push(`${label}: “${entry.text}”`);
    }
    if (includePartial && part === state.parts.at(-1)) {
      if (state.userPartial) lines.push(`${this.labels.user}: “${state.userPartial}…”`);
      if (state.assistantPartial) lines.push(`${this.labels.assistant}: “${state.assistantPartial}…”`);
    }
    if (lines.length === 1 && state.status === "active") lines.push(this.labels.connecting);
    return escapeHtml(lines.join("\n\n"));
  }

  handleTalkEvent(payload) {
    if (this.stopped || !payload?.callId || !payload?.event) return;
    let state = this.states.get(payload.callId);
    if (!state) {
      const target = this.resolveTarget(payload);
      if (!target) return;
      state = {
        callId: payload.callId,
        target,
        status: "active",
        userPartial: "",
        assistantPartial: "",
        parts: [this.createPart(1)],
      };
      this.states.set(payload.callId, state);
    }

    const event = payload.event;
    const text = normalizeText(event.payload?.text);
    switch (event.type) {
      case "session.started":
      case "session.ready":
        this.schedule(state, 0);
        break;
      case "transcript.delta":
        state.userPartial = appendDelta(state.userPartial, text);
        this.schedule(state);
        break;
      case "transcript.done":
        this.commitEntry(state, "user", text || state.userPartial);
        state.userPartial = "";
        this.schedule(state, 0);
        break;
      case "output.text.delta":
        state.assistantPartial = appendDelta(state.assistantPartial, text);
        this.schedule(state);
        break;
      case "output.text.done":
        this.commitEntry(state, "assistant", text || state.assistantPartial);
        state.assistantPartial = "";
        this.schedule(state, 0);
        break;
      case "session.error":
        state.status = "error";
        this.schedule(state, 0);
        break;
      case "session.closed":
        state.status = event.payload?.reason === "error" ? "error" : "ended";
        this.schedule(state, 0);
        break;
      default:
        break;
    }
  }

  commitEntry(state, role, rawText) {
    const text = normalizeText(rawText);
    if (!text) return;
    let part = state.parts.at(-1);
    const last = part.entries.at(-1);
    if (last?.role === role && last.text === text) return;
    const candidate = { role, text };
    part.entries.push(candidate);
    if (this.renderPart(state, part, false).length <= this.maxBlockChars || part.entries.length === 1) return;
    part.entries.pop();
    part.sealed = true;
    this.schedulePart(state, part, 0);
    part = this.createPart(part.index + 1);
    part.entries.push(candidate);
    state.parts.push(part);
  }

  schedule(state, delay = this.updateDelayMs) {
    this.schedulePart(state, state.parts.at(-1), delay);
  }

  schedulePart(state, part, delay) {
    if (!part) return;
    if (part.timer) clearTimeout(part.timer);
    part.timer = setTimeout(() => {
      part.timer = null;
      this.enqueueFlush(state, part);
    }, Math.max(0, delay));
    part.timer.unref?.();
  }

  enqueueFlush(state, part) {
    this.writeQueue = this.writeQueue.then(async () => {
      const text = this.renderPart(state, part, !part.sealed);
      if (!text || text === part.lastText) return;
      try {
        if (!part.messageId) {
          const result = await this.sendText({ target: state.target, text });
          part.messageId = String(result?.messageId ?? result?.message_id ?? "").trim() || null;
          if (!part.messageId) throw new Error("Telegram send result did not contain messageId");
        } else {
          await this.editText({ target: state.target, messageId: part.messageId, text });
        }
        part.lastText = text;
      } catch (error) {
        if (isMessageNotModified(error)) {
          part.lastText = text;
          return;
        }
        this.logger.warn?.(`Telegram live transcript delivery failed: ${String(error?.message ?? error)}`);
      }
    }).catch((error) => {
      this.logger.warn?.(`Telegram live transcript queue failed: ${String(error?.message ?? error)}`);
    });
  }

  async drain() {
    for (const state of this.states.values()) {
      for (const part of state.parts) {
        if (!part.timer) continue;
        clearTimeout(part.timer);
        part.timer = null;
        this.enqueueFlush(state, part);
      }
    }
    await this.writeQueue;
  }

  async stop() {
    this.stopped = true;
    await this.drain();
  }
}
