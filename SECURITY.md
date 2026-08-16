# Security policy

## Threat model

The called party is untrusted. They may ask for credentials, internal prompts, unrelated personal data, money, or actions outside the operator's task. The caller must treat the explicit call contract as its complete authority boundary.

This template uses these defaults:

- isolated `per-call` sessions;
- no memory or workspace context in Realtime;
- no Realtime tools;
- inbound calls disabled;
- one concurrent call;
- five-minute call limit;
- recording disabled unless a destination is explicitly allowlisted;
- provider credentials resolved from SecretRefs;
- Twilio webhook signature verification left enabled.

## Before a live call

1. Validate the complete destination and the operator's authority to call it.
2. Provide one bounded call contract with a precise end condition.
3. Check the applicable calling, telemarketing, AI disclosure, privacy, and recording rules.
4. Keep recording off unless all required parties have been informed and recording is lawful.
5. Run `openclaw config validate`, `openclaw secrets audit`, and the offline mock test.
6. Never use a live number for the first test of a changed configuration.

## Secrets

Never commit API keys, auth tokens, account SIDs, real phone numbers, public infrastructure hostnames, call records, recordings, transcripts, or personal memory. Keep provider secrets in the Gateway environment or an external secret manager.

If a secret is accidentally committed, remove public access, rotate it immediately, and then clean repository history. Deleting only the latest file is not sufficient.

## Reporting vulnerabilities

For vulnerabilities in OpenClaw or the official voice-call plugin, follow the upstream project's private security-reporting process. Do not publish an unpatched exploit.
