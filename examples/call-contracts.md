# Call-contract examples

A complete contract prevents the model from turning one narrow task into an open-ended conversation.

## Template

```text
Language: <language for the entire call>.
Goal: <one concrete outcome>.
Known facts: <only verified facts the agent may use>.
Allowed: <questions and branches the agent may take>.
Forbidden: <commitments, topics, data, and actions outside scope>.
Unclear speech: Ask once for repetition, then end without guessing.
End condition: <precise point at which the call must end>.
```

## Availability check without booking

```text
Language: German.
Goal: Find out whether bicycle repairs are accepted this week and ask for the estimated turnaround time.
Known facts: The bicycle needs a general inspection.
Allowed: Ask which days intake is possible and how long an inspection usually takes.
Forbidden: Book an appointment, approve repairs, discuss payment, or provide an address.
Unclear speech: Ask once for repetition, then end without guessing.
End condition: Thank them and end after the available intake days and estimated duration are known.
```

## Reservation with a strict ceiling

```text
Language: Russian.
Goal: Ask whether a table for two is available on the requested evening.
Known facts: The operator supplied the date, time, and booking name in the private live contract.
Allowed: Move the time by at most 30 minutes if the exact time is unavailable.
Forbidden: Prepay, provide card details, accept a cancellation fee, or change the date.
Unclear speech: Ask once for repetition, then end without guessing.
End condition: Confirm the final date, time, name, party size, and cancellation terms, then end.
```

Never commit real names, phone numbers, addresses, or booking details as repository examples.
