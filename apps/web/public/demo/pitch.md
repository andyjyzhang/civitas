# Civitas: presentation script and exact actions

Open **https://civitas-relay.onrender.com/demo**. No sign-in, API keys, local
receivers or model processes are needed. David’s Claude, Andy’s Codex and Ryan’s
Codex are preloaded. Responses, review decisions and rollout state are prepared
for this offline preview and stay in the browser. Keep the small Offline preview
badge visible. The signed-in product is at `/activity`.

Allow about three minutes. Use the ordinary composer: choose the recipient under
**To**, type the quoted message and press **Send** or Enter. Shift+Enter adds a line.
There are no on-screen chapters or preset-question buttons.

## 0:00–0:25 — Team and problem

**Click:** Members. Point to David, Andy and Ryan, then their three connected agents.

**Say:**
“Every developer on a team can have a powerful coding agent. But when one agent
learns something important, the others may keep working from an outdated assumption.
People become the message bus, copying discoveries between conversations.

Civitas connects people and their independently owned agents through shared context.
We’re showing an interactive product preview with David’s Claude, my Codex, and
Ryan’s Codex.”

**Click:** Activity. Choose **People** and send:

> Ryan and David, Maintenance API v2 affects our SDK, triage UI and dispatch. Let’s share one reviewed update so all our agents work from the same evidence.

**Point out:** the message enters the team feed. People-only messages do not produce
an agent reply.

## 0:25–0:55 — Ask David’s Claude

**Choose:** David’s Claude.

**Type and send:**

> What changed between Maintenance API v1 and v2? Which priority codes are documented, and what still needs review? Cite the sources.

**Point out:** the prepared reply appears under David’s Claude, with source references.
It identifies `priority` → `priority_code`, P1 as urgent, and P2/P3 as unresolved.

**Say:**
“An important discovery should become shared knowledge. The field changed, but
preserving what urgent means matters more than a rename. The source only defines
P1. We keep P2 and P3 uncertain instead of inventing a meaning.”

## 0:55–1:25 — Review what travels

**Click:** New analysis, at the top of Activity. The prepared packet appears.
Click **View full report**, show the evidence, then close the report drawer.
Click **Approve and share**.

**Say:**
“Here is the exact context packet: what changed, the source evidence and what is
still unresolved. The product’s Deep Agents workflow prepares this packet for
human review. In this preview, we’ve prepared the scenario ahead of time.

One approval makes the same versioned context available to the authorized
subscribers. We share selected knowledge, not entire private coding conversations.”

**Point out:** Version 1 and the three service rows under Rollout. No service is
marked updated yet.

## 1:25–1:55 — Reuse the context with Ryan and Andy

**Choose:** Ryan’s Codex.

**Type and send:**

> Using the shared Maintenance API update, what must change in triage, and which priority codes still need human review?

**Say:**
“Ryan’s agent can use the shared discovery for its own responsibility. P1 remains
urgent maintenance. Undocumented codes go to review.”

**Choose:** Andy’s Codex.

**Type and send:**

> Using the same shared update, what should the SDK change, and what must remain unresolved? Cite the sources and keep it brief.

**Say:**
“My agent uses the same context to reason about SDK types. One discovery informs
different agents without either person forwarding private chat history.”

**Point out:** the responses differ by responsibility but preserve the same facts.
The preview uses preset replies; it does not launch either owner’s CLI.

## 1:55–2:35 — Review proposed work

**Click:** Scroll up to the shared packet and click **Update all services**, then
**Inbox** in the sidebar.
The badge shows three pending reviews.

For **SDK**, click **View full diff**, show `priority_code`, close the drawer, then
click **Apply to demo copy**. Repeat for **Triage UI**, pointing out P1 → Urgent
maintenance and other codes → Needs review. Repeat for **Dispatch**, pointing out
P1 → urgent and other codes → manual-review.

**Say:**
“Shared context leads to service-specific proposals. The SDK updates its response
type, triage preserves the urgent label, and dispatch keeps unknown codes out of a
silent default. A person reviews each change.

These preview approvals only change the browser state. In the working workflow,
approval applies a reviewed patch to a separate demo copy.”

**Point out:** Inbox becomes “You’re all caught up” after all three approvals.

## 2:35–3:00 — Result and close

**Click:** Agents. Point to **3 of 3 updated** in Rollout and the three updated
service rows.

**Say:**
“The result is consistent context across the team: urgent stays urgent, and
uncertainty stays visible. The working backend provides scoped MCP messaging,
versioned context and durable PostgreSQL storage; this offline screen illustrates
that workflow without calling those systems.

Your agent learns something. The right agents know it too.”

## Reset and useful details

- Click **Andy** at the bottom of the sidebar → **Reset preview**, or refresh.
  Messages, approvals and pending replies clear; the three connected agents remain.
- **Reply to agent** under an answer selects that agent in the composer.
- **Agents** shows the prepared plan, evidence, service owners and review state.
- On a narrow screen, use the menu button to open the same sidebar.
- The preview accepts other messages, but answers are limited to the prepared
  Maintenance API scenario; this page is not a general-purpose chatbot.
