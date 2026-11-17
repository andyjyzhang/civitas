#!/usr/bin/env bash
# One-command local agent workflow: build, start a relay if none is running, seed four
# agents, run the analyst (you approve the publish), run the three adapters (you
# approve each patch), then open the triage preview.
#
#   npm run example:agents            # run ID defaults to run-<time>
#   npm run example:agents -- my-run  # choose a run ID (each ID can be used once)
#
# Keys: export OPENAI_API_KEY (and optionally LANGSMITH_API_KEY), or put them in
# .local/model.env as KEY=value lines. Never commit them.
set -euo pipefail
cd "$(dirname "$0")/.."

RUN_ID="${1:-run-$(date +%H%M%S)}"
if [ -f .local/model.env ]; then set -a; . ./.local/model.env; set +a; fi
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY in your shell or in .local/model.env}"
if [ -n "${LANGSMITH_API_KEY:-}" ]; then export LANGSMITH_TRACING=true LANGSMITH_PROJECT="${LANGSMITH_PROJECT:-civitas-agents}"; fi
# Agent identities come only from the seeded env files.
unset CIVITAS_AGENT_TOKEN CIVITAS_RELAY_URL CIVITAS_DEMO_SPACE_ID

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

step "Install and build"
[ -d node_modules ] || npm install
[ -f .env ] || npm run -s setup:local
npm run -s build:relay >/dev/null
npm run -s build:bridge >/dev/null
npm run -s build -w @civitas/change-analyst >/dev/null
npm run -s build -w @civitas/adapter-agent >/dev/null

PORT="$(grep -E '^RELAY_PORT=' .env | tail -1 | cut -d= -f2)"; export RELAY_PORT="${PORT:-4000}"
RELAY="http://127.0.0.1:${RELAY_PORT}"
if curl -sf "$RELAY/readyz" >/dev/null; then
  step "Using the relay already running at $RELAY"
else
  step "Starting relay at $RELAY (log: .local/relay.log)"
  mkdir -p .local
  node apps/relay/dist/index.js > .local/relay.log 2>&1 &
  RELAY_PID=$!
  trap 'kill "$RELAY_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 30); do curl -sf "$RELAY/readyz" >/dev/null && break; sleep 0.5; done
  curl -sf "$RELAY/readyz" >/dev/null || { echo "Relay did not start; see .local/relay.log"; exit 1; }
fi

step "Seeding analyst + sdk/triage/dispatch agents"
npm run -s seed:agents

step "Analyst (run $RUN_ID): review the packet, then type: publish $RUN_ID"
analyze() { node --env-file=.local/agents/analyst.env apps/change-analyst/dist/index.js analyze "$1" ${CIVITAS_ANALYST_AUTO_APPROVE:+--approve}; }
# Model output sometimes fails the analyst's own quality checks; retry once under a new ID.
if ! analyze "$RUN_ID"; then
  step "Analyst run did not publish; retrying once as $RUN_ID-retry (type: publish $RUN_ID-retry)"
  analyze "$RUN_ID-retry"
fi

for role in triage sdk dispatch; do
  step "Adapter: $role — review the diff, then type: apply $role"
  node apps/adapter-agent/dist/index.js adapt "$role" "$RUN_ID" || echo "($role was not applied; continuing)"
done

step "Triage preview"
npm run -s preview -w @civitas/adapter-agent -- "$RUN_ID"
PREVIEW=".local/adapter/$RUN_ID/triage-preview.html"
(open "$PREVIEW" || xdg-open "$PREVIEW") >/dev/null 2>&1 || echo "Open $PREVIEW in your browser."
echo "Done. Patches and notes: .local/adapter/$RUN_ID/  Spend ledger: .local/model-spend.jsonl"
