# API-change demonstration

This directory reserves the deterministic hackathon example. Fixtures and consumer
applications are not implemented yet. Follow [the demo runbook](../../docs/demo.md).

Build synthetic property-maintenance v1/v2 source fixtures for the change from
`priority: "urgent"` to `priority_code: "P1"`, a real Deep Agents publisher, and
independent frontend triage UI, SDK, and integration-test consumers. Give
each consumer an isolated working copy with checks that expose the contract break.
Do not use real tenant data or credentials. Define the explicit P1-to-urgent mapping;
an unknown value must not silently default to normal priority. Include a distracting
unchanged source detail to test whether the analyst publishes only relevant facts.

Add a documented reset workflow limited to disposable demo data, a baseline seed,
and a way to collect event IDs, code diffs, and real test output. Keep recorded
rehearsal evidence clearly distinct from live activity. Demo tools must use the
same public protocol and authorization paths as real clients.
