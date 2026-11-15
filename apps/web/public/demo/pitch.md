# Civitas: Andy and Ryan’s live product walkthrough

Use the real group at `/demo?space=YOUR_GROUP_ID` or `/activity?space=YOUR_GROUP_ID`.
Both show the same website. All directions below are presenter notes, not on-screen
chapters. Type the messages into the normal composer and use its Send button.

## Before presenting

- Andy and Ryan sign in to their own accounts and join the same private group.
- In Members, connect **Andy’s Codex** and **Ryan’s Codex** using each owner’s login.
  The name field uses the signed-in owner’s name; edit it when creating the link
  if needed. Existing connections keep their real saved names (for example José
  or ryry); select those if you keep them rather than creating new connections.
- Each owner runs the connection/receiver command on their own computer and leaves
  it open. Verify both show **Receiver on** and can answer a message before judging.
- The group owner must be enabled for hosted analysis. Run **Analyze API change**
  ahead of time and leave its actual packet waiting for review. Check that the
  evidence and proposed packet are correct before presenting. Allow several minutes
  for analysis and patch generation; prepare those runs before a short pitch.
- The Maintenance API contracts and changelog are the prepared project source.
  The SDK, Triage UI and Dispatch adapters are workspace agents; they are separate
  from Andy and Ryan’s personal chat agents. Approved patches target demo copies.
- Rehearse the complete flow once with both owners on the presentation service.

## Opening: show the team

Open **Members**. Point to Andy and Ryan, their agents and their access. Then return
to **Activity**.

“Every developer on a team can have a coding agent. But when one agent discovers
an important change, the others may keep working from an outdated assumption.
People end up copying discoveries between conversations.

Civitas gives people and their independently owned agents a shared workspace.
Andy and Ryan keep their existing coding tools and accounts. Their agents can
receive selected messages and shared, source-linked knowledge here.”

Choose **People**, type this, and press **Send**:

> Ryan, Maintenance API v2 affects the SDK, triage UI and dispatch. Let’s share one reviewed contract update so our agents work from the same evidence.

## Review the discovery once

Open the analyst’s actual pending review in Activity. If starting during the
presentation instead, click **Analyze API change**, then open **Agents** to show
its real plan, specialists and evidence while it works. Return to Activity when
the packet is ready.

“The analyst compares the two API contracts and the changelog. The old priority
field becomes priority code. P1 means urgent, but the sources do not establish
what P2 and P3 mean. We preserve that uncertainty instead of letting each agent
invent a different answer.”

Inspect the exact proposed packet and source references. Approve it only if it
correctly preserves P1 and flags unresolved meanings; otherwise reject it.

“We review what travels. Approval publishes a versioned update and delivers it to
the authorized subscribers. We share this selected knowledge, not private coding
conversations.”

## Ask Ryan’s agent

In the normal composer, choose **Ryan’s Codex** (or Ryan’s existing saved agent
name). Type this and press **Send**:

> Using the latest published Maintenance API update, what must change in triage, and which priority codes still need human review? Cite the shared source and don’t assume undocumented meanings.

Wait for the actual reply. Point to the named agent and its response.

“Ryan’s local receiver picked up the addressed message and replied through his
existing CLI account. Its answer can use the shared update without us copying
Andy’s private coding conversation. Text chat cannot run commands or edit files.”

If needed, ask the agent to clarify its source. If the receiver is offline,
Ryan starts it from Members and retries.

## Reuse the same context with Andy’s agent

Choose **Andy’s Codex** (or Andy’s existing saved agent name), type this and send:

> Using the same published Maintenance API update, what should the SDK change, and what must remain unresolved? Cite the shared source and keep the answer brief.

“One reviewed discovery can inform two independently owned agents. They can answer
different questions from the same evidence. That is the context network.”

Point to what each agent returned and how both used the same shared evidence.

## Show proposed work and approval

Under the published update, click **Update all services** if it is available.
Otherwise start each eligible service with its **Update** button. Wait for the
actual adapter patches. For a short pitch, these can be prepared during rehearsal
and shown as existing real runs; say they were prepared earlier.

Review the real SDK, Triage UI and Dispatch diffs. Point out actual P1 handling and
how unknown codes are treated. Approve each correct patch individually. Download
one diff if useful, then show the resulting run status.

“The service adapters use the same reviewed context to propose changes for their
own consumers. A person reviews each patch. These approved changes apply to the
workspace’s demo copies; the downloadable diff is available for review elsewhere.”

Show the actual delivery and acknowledgement states. Say how many services are
updated and which are still waiting.

## Close

“Civitas connects independently owned agents through selected, source-linked
context, with people deciding what gets shared and applied.

Your agent learns something. The right agents know it too.”

## If time or connectivity runs short

Stay on the actual existing packet, replies or completed run and explain when it
was created. The separate playback player is `/demo/replay`; use it as a disclosed recording or
illustration if needed. The pitch does not require every model call to finish
while you are speaking.
