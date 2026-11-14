# triage (synthetic consumer)

Renders an HTML triage card for a maintenance request from API **v1**. Urgent requests
show a red "Urgent maintenance" label. `src/render.ts <payload.json>` prints the card
HTML to stdout. `samples/` holds a v1 payload and two v2 payloads (P1, P2).
