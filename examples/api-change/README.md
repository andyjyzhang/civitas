# Synthetic maintenance consumers

These local examples adapt the supplied API revision from `priority: "urgent"`
to `priority_code: "P1"`. The only reviewed code mapping is P1 → urgent.
They are implementation examples, not customer repositories or evidence that a
model independently generated an adaptation.

From the repository root, after `npm install`:

```sh
npm exec tsx -- examples/api-change/demo.ts
```

Open <http://127.0.0.1:4100>. Select either source revision: the SDK decodes urgent,
the triage view displays **Urgent maintenance**, and the dispatch adapter returns
`immediate-dispatch`. Source JSON, the SDK response, and the dispatch decision are
linked from the page. `CIVITAS_CONSUMER_PORT` changes the local port.

The consumers are:

- `consumers/sdk.ts`: decode the revision-specific wire field; preserve raw value
  and source revision. Missing/malformed priority fails. Unknown codes produce
  `unknown`; no P2/P3 mapping is invented.
- `consumers/triage.ts`: display urgency and next action. Unknown priorities require
  source review instead of silently appearing normal.
- `consumers/dispatch.ts`: return an immediate-dispatch or manual-review decision.
  This never sends a message or dispatches an actual person.

## Receive a selected event through MCP

Build the bridge and run the relay as described in the root README. Use a different
admitted private agent env file for each recipient when demonstrating separate
identities. Reusing the demo receiver key creates separate bridge processes with
one shared identity; it does not demonstrate independently owned agents.

```sh
# Repeat with triage and dispatch and their corresponding private receiver files.
node --env-file=.local/receiver.env --import tsx examples/api-change/receive.ts sdk subscribe
# Subscribe each recipient before the reviewed publisher publishes.
node --env-file=.local/receiver.env --import tsx examples/api-change/receive.ts sdk list
node --env-file=.local/receiver.env --import tsx examples/api-change/receive.ts sdk receive evt_REPLACE_WITH_SELECTED_ID
```

`list` prints event IDs and source references. `receive` requires explicit selection
and accepts only the approved synthetic source path/revision/topic/space. Each
command starts a real MCP bridge process using only relay credentials; model keys
are not forwarded. Inbox paging is bounded to 100 pages of 100 deliveries.

A private receipt in ignored `.local/consumer-demo/<consumer>.json` stores the
selected event, source revision and actual local adapter result. Incoming text is
untrusted data: it is never evaluated, used as code, used to select host files, or
used to define priority mappings. Receipts do not acknowledge deliveries and do
not prove a coding model generated changes. The page runs the checked-in adapters;
it does not automatically modify itself when context arrives.

A real source → model analysis → human review → relay → independent coding-model
adaptation demonstration still requires the provider/model sessions and explicit
review. Keep that distinction when presenting this synthetic local flow.
