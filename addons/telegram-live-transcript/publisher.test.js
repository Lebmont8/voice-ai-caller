import assert from "node:assert/strict";
import test from "node:test";

import {
  TelegramLiveTranscriptPublisher,
  createFixedTargetResolver,
} from "./publisher.js";

const target = { accountId: "voice", chatId: "100000001" };

function event(type, text, extra = {}) {
  return {
    callId: "call-test",
    agentId: "caller",
    event: {
      type,
      payload: { ...extra, ...(text === undefined ? {} : { text }) },
    },
  };
}

function harness(options = {}) {
  const sends = [];
  const edits = [];
  const publisher = new TelegramLiveTranscriptPublisher({
    resolveTarget: createFixedTargetResolver({ ...target, allowedAgentIds: ["caller"] }),
    updateDelayMs: 0,
    sendText: async (input) => {
      sends.push(input);
      return { messageId: String(sends.length) };
    },
    editText: async (input) => {
      edits.push(input);
      return { messageId: input.messageId };
    },
    ...options,
  });
  return { publisher, sends, edits };
}

test("rejects events without a trusted target", async () => {
  const h = harness();
  h.publisher.handleTalkEvent({ ...event("session.started"), agentId: "main" });
  await h.publisher.drain();
  assert.equal(h.sends.length, 0);
});

test("user and assistant deltas update one Telegram message", async () => {
  const h = harness();
  h.publisher.handleTalkEvent(event("session.started"));
  h.publisher.handleTalkEvent(event("transcript.delta", "Guten"));
  h.publisher.handleTalkEvent(event("transcript.delta", "Tag"));
  h.publisher.handleTalkEvent(event("transcript.done", "Guten Tag"));
  h.publisher.handleTalkEvent(event("output.text.done", "Hello!"));
  await h.publisher.drain();
  assert.equal(h.sends.length, 1);
  assert.match(h.sends[0].text, /Guten Tag/u);
  assert.match(h.sends[0].text, /Hello!/u);
  assert.ok(h.edits.length <= 1);
});

test("escapes Telegram HTML", async () => {
  const h = harness();
  h.publisher.handleTalkEvent(event("transcript.done", "<script>&"));
  await h.publisher.drain();
  assert.match(h.sends[0].text, /&lt;script&gt;&amp;/u);
});

test("long transcripts roll over to another Telegram message", async () => {
  const h = harness({ maxBlockChars: 90 });
  h.publisher.handleTalkEvent(event("session.started"));
  h.publisher.handleTalkEvent(event("transcript.done", "A".repeat(55)));
  h.publisher.handleTalkEvent(event("output.text.done", "B".repeat(55)));
  h.publisher.handleTalkEvent(event("session.closed", undefined, { reason: "completed" }));
  await h.publisher.drain();
  assert.equal(h.sends.length, 2);
  assert.match(h.sends[1].text, /Call ended/u);
});

test("trusted stored target works without an agent id", async () => {
  const h = harness();
  h.publisher.handleTalkEvent({
    callId: "stored-target",
    liveTranscriptTarget: target,
    event: { type: "session.started", payload: {} },
  });
  await h.publisher.drain();
  assert.equal(h.sends.length, 1);
});
