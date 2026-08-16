# Integrating with `@openclaw/voice-call`

This folder is a reference add-on, not a replacement or repackaging of the
official plugin. The publisher is transport-injected and contains no OpenClaw
private imports.

An integration needs four narrow hooks in the voice-call runtime:

1. Create one `TelegramLiveTranscriptPublisher` during plugin registration.
2. Store a trusted `liveTranscriptTarget` with the outbound call metadata.
3. Forward normalized talk events to `publisher.handleTalkEvent(...)`.
4. Call `publisher.stop()` during plugin shutdown.

Expected event envelope:

```js
publisher.handleTalkEvent({
  callId,
  agentId,
  liveTranscriptTarget: { accountId, chatId },
  event: {
    type: "transcript.delta",
    payload: { text: "partial speech" }
  }
});
```

Supported event types:

- `session.started`, `session.ready`
- `transcript.delta`, `transcript.done`
- `output.text.delta`, `output.text.done`
- `session.error`, `session.closed`

The host integration supplies `sendText` and `editText` adapters. Both receive
escaped HTML. Never accept a Telegram target directly from model-generated
arguments; resolve it from trusted delivery context or a server-side allowlist.

Because internal voice-call and Telegram adapter surfaces can change between
OpenClaw releases, keep the adapter in the host plugin and test it against the
exact installed version. The publisher itself is covered by offline tests.
