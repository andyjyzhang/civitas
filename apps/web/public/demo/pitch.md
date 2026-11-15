# Civitas: pitch and click-through demo

Three minutes, presenter-paced. Open `/demo` and click **Reset demo** before starting.
No sign-in, relay, model key or external service is required. The people, replies,
analysis and patches on this page are scripted examples. Keep that label visible.
Use one speaker for the pitch and one person for the clicks, or do both yourself.

## 0:00–0:30 — The problem and the promise

Screen: Team chat. Do not click yet.

“Every developer on a team can have a coding agent. But when one agent learns
something important, the others don’t automatically know it. People become the
message bus: copying discoveries between chats and hoping nothing gets lost.

Civitas gives people and their independently owned agents a shared workspace.
Your agent learns something. The right agents know it too.

We’ll show a scripted example of one API change affecting three services.”

## 0:30–0:55 — People and their agents

Click **Send sample question**. Point to the reply and open
**Context shared with this agent**.

“Here’s our maintenance team. Each person owns a service and connects their own
agent. Sam asks the triage agent what API version two changes.

The answer appears in the team conversation. It gets the selected question and
shared group knowledge. Sam’s private coding conversation stays private, and
chat replies cannot execute commands or edit files.”

## 0:55–1:20 — Understand once, preserve uncertainty

Click **Analyze sample API change**. Point to the plan and evidence.

“Now we turn that discovery into a reviewed update. The analyst compares both API
contracts and the changelog, checking the contract and its impact on consumers.

The old priority field becomes priority code. P1 means urgent. But the sources
don’t establish the meaning of P2 and P3. Civitas keeps that uncertainty visible
instead of letting three agents independently invent an answer.”

## 1:20–1:45 — A person approves what travels

Click **Review proposed update**. Pause on the packet. Then click
**Approve & share sample update**.

“This is the exact packet we’re about to share: the field change, its sources,
what is known, and what still needs review.

In the working backend, approval publishes an immutable version, and the relay
delivers it to authorized subscribers through MCP. We share selected context,
not entire conversations. This page simulates that approval locally.”

## 1:45–2:25 — Each service gets its own patch

The **Triage UI** tab is selected first. Point to the red and green lines.
Click **Approve Triage UI sample patch**. Select **SDK**, inspect and approve its
patch. Select **Dispatch**, inspect and approve its patch. Click **See the result**.

“All three adapters receive the same reviewed context, but each proposes a change
for its own code.

Here’s triage: P1 becomes urgent maintenance; other codes need review. The SDK
updates its response type. Dispatch routes P1 to the urgent queue and leaves
unknown codes for manual review.

We review each sample diff individually. These buttons only update the walkthrough.
In the actual agent demo, approved patches apply to separate demo copies.”

## 2:25–3:00 — Why it matters, what works, close

Screen: Result. Point to P1 and P2/P3. Optionally open
**What is real behind this demo?**

“The result is consistent meaning across services: urgent work stays urgent,
and uncertainty doesn’t disappear into a default.

Behind this illustration, we’ve implemented real MCP delivery, immutable context
versions, durable PostgreSQL storage, reviewed analyst and adapter workflows, and
native agent chat. This screen isn’t a fresh model run; it makes the product flow
reliable to present.

Civitas connects independently owned agents through selected, source-linked
context, with people deciding what gets shared and applied.

Independent agents. Shared context.”

## Rehearsal and recovery

- Walk the whole sequence once. Allow a few seconds for each patch review.
- **Show presenter notes** gives chapter-specific prompts beneath the workspace.
- Completed chapters remain available in the sidebar. Future chapters unlock as
  you advance; the result unlocks after all three sample patch approvals.
- **Reset demo** or a refresh clears the walkthrough. Nothing is saved or sent.
- The existing automatic tour is at `/demo/film`; the workflow replay and optional
  live-run controls are at `/demo/replay`. Live mode requires its existing setup
  and credentials. It is not needed for this pitch.

## Short answers for judges

**Why not just use a group chat?**
Chat gives people a place to talk. Civitas also gives agents scoped identities,
versioned context, source evidence, delivery and acknowledgement, plus review of
proposed changes.

**Are these agents sharing all their conversations?**
No. Only selected messages and shared published knowledge travel. The local chat
receiver does not receive the owner’s private coding conversation.

**Is this running models right now?**
No. `/demo` is deliberately hard-coded and labeled. The separate live workflow
uses the real services; it needs credentials and a configured model runner.

**What has been verified?**
The work plan records real PostgreSQL/Tiger persistence, MCP delivery, reviewed
analyst/adapter runs and native Codex replies. Those are separate verification
runs, not a recording of this screen. Hosted model execution, the real Claude
account receiver and a full multi-person rehearsal remain unverified.

**Can an agent silently change my project?**
The showcased workflow requires review before sharing the analyst packet and
before applying adapter patches. Those patches target demo copies. Native group
chat replies have tools disabled and cannot execute code.
