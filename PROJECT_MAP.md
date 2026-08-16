# Project map

- `README.md` — public overview and setup path.
- `agent/AGENTS.md` — isolated task-only caller policy.
- `config/voice-call.mock.example.json` — offline, no-network configuration.
- `config/voice-call.twilio.example.json` — sanitized Twilio + OpenAI Realtime example.
- `examples/call-contracts.md` — reusable bounded-call patterns.
- `SECURITY.md` — threat model and live-call checklist.
- `scripts/validate.mjs` — structural validation and secret/PII scan.
- `addons/telegram-live-transcript/` — transport-injected live transcript
  publisher, offline tests, and the `@openclaw/voice-call` integration contract.

This directory is independent from the live OpenClaw runtime. Publishing it must never include files copied from the live state directory, call records, recordings, credentials, or personal memory.
