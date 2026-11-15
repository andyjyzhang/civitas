# Civitas: simple deadline demo

**Demo:** https://civitas-relay.onrender.com/demo

**Only memorize two messages: “What time?” and “What changed?”**

The story: event signup used to close at **5 PM**. David’s agent learns it now
closes at **4 PM**. Share that fact once, and the other agents know too.
This is an offline product preview with prepared agents and replies. It needs
no sign-in, receivers or model calls. Replies take about two seconds; wait for
them before moving on. Keep the small Offline preview badge visible.

## Quick click sheet

| Action | Type | What appears |
|---|---|---|
| Activity → To: **Ryan’s Codex** | **What time?** | His reminder still says **5 PM**. |
| To: **David’s Claude** | **What changed?** | Signup moved to **4 PM**. |
| **New analysis** → **Approve and share** | Nothing | One shared deadline update. |
| To: **Ryan’s Codex** | **What time?** | Now he knows **4 PM**. |
| To: **Andy’s Codex** (optional) | **What time?** | The website should also say **4 PM**. |

## What to say and do — about 90 seconds

### 1. Show the team

**Click Members**, then return to **Activity**.

**Say:**
“These are David’s Claude, my Codex and Ryan’s Codex. Each belongs to a different
person. The problem is simple: when one agent learns something, the others can
keep working with old information. We’re showing that in this interactive preview.”

### 2. Show the old information

Choose **Ryan’s Codex**. Type **What time?** and send. Wait for the reply.

**Say:**
“Ryan’s agent thinks event signup closes at five.”

### 3. Show the discovery

Choose **David’s Claude**. Type **What changed?** and send. Wait for the reply.

**Say:**
“But David’s agent has read the updated event brief. Signup now closes at four.
Right now, only one agent has the new information.”

### 4. Share once

Click **New analysis**. Point to **Signup deadline: 5 PM → 4 PM**.
Click **Approve and share**. You can open **View full report** to show the one-line
source, but it is optional.

**Say:**
“We review the fact and share it once. Civitas gives the authorized agents the
same source-linked update. We don’t copy entire private conversations.”

### 5. Ask the exact same question

Choose **Ryan’s Codex** again. Type **What time?** and send.

**Say:**
“Same agent. Same question. Now the answer is four. We didn’t paste the change
into Ryan’s chat. His agent has the shared context.”

Optionally choose **Andy’s Codex**, send **What time?**, and show that it also knows
four. Both responses cite the same shared version.

### 6. Close

**Say:**
“One discovery. The right agents know it. Less manual forwarding, fewer stale
assumptions, and everyone working from the same information.

Your agent learns something. The right agents know it too.”

## Optional: show proposed changes — another 30 seconds

Scroll to the shared update and click **Update all services**, then **Inbox**.
Each diff changes just **5 PM → 4 PM**. Open one **View full diff**, close it,
then click **Apply to demo copy** on Website, Reminders and Calendar.
Open **Agents** to show **3 of 3 updated**.

**Say:**
“The same fact can inform three changes: the website, the reminder and the
calendar. Each proposal still needs review. In this preview, the approvals stay
in the browser; no files or systems are changed.”

## Reset

Click **Andy** at the bottom of the sidebar → **Reset preview**, or refresh.
That clears replies, shared context, approvals and pending reply timers. Ryan and
Andy return to the old 5 PM information; David still has the updated brief.
The three prepared agents remain connected. People-only messages get no agent reply.
