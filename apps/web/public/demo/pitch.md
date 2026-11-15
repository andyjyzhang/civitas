# Civitas: a real-world trial-policy change

**Demo:** https://civitas-relay.onrender.com/demo

**Story:** a SaaS product changes its free trial from **30 days to 14 days for new
customers**. Existing customers must keep their original trial end dates. Signup,
the website and reminder emails all need to follow the same rule.

The demo is an offline preview with prepared agents and replies. No sign-in,
receivers or model calls are required. Replies pause about two seconds with the
Replying indicator visible. Keep the small Offline preview badge visible.

## The three prompts to remember

- **What changed about trials?** → David’s Claude
- **How should signup work?** → Ryan’s Codex
- **What should we test?** → Andy’s Codex

## Quick click sheet

| Action | Type | What appears |
|---|---|---|
| Activity → To: **Ryan’s Codex** | **How should signup work?** | He still has the old **30-day** rule. |
| To: **David’s Claude** | **What changed about trials?** | **14 days for new customers; existing end dates stay unchanged.** |
| **New analysis** → **Approve and share** | Nothing | One source-linked policy update. |
| To: **Ryan’s Codex** again | **How should signup work?** | **14 days for new signups**, without shortening existing trials. |
| To: **Andy’s Codex** | **What should we test?** | New trials, existing trials, website copy and reminders. |

Use the normal composer and Send button. Wait for each reply before moving on.

## What to say and do — about two minutes

### 1. Show the team

Click **Members**, point to the three agents, then return to **Activity**.

**Say:**
“Teams already use coding agents, but each agent can have a different understanding
of the product. A small policy change can turn into inconsistent code, copy and
emails. Civitas gives independently owned agents a way to share selected context.
We’re showing that in this interactive preview.”

### 2. Show the stale assumption

Choose **Ryan’s Codex**, type **How should signup work?**, and send.

**Say:**
“Ryan’s agent owns signup. It still thinks every new customer gets a thirty-day
trial. That was correct yesterday.”

### 3. Discover the rule and its exception

Choose **David’s Claude**, type **What changed about trials?**, and send.

**Say:**
“The product policy changed: new customers get fourteen days. But existing trials
keep their original end dates. Missing that exception could cut a customer’s trial
short. David’s agent knows this; Ryan’s agent doesn’t yet.”

### 4. Review and share once

Click **New analysis**. Point to the two rules and the source in the prepared packet.
Click **Approve and share**. **View full report** is optional.

**Say:**
“We review the exact update and share it once, with its source. The important
part is not just the number fourteen. The exception travels with it: preserve
existing customers’ trial end dates.”

### 5. Ask the same agent the same question

Choose **Ryan’s Codex** again, type **How should signup work?**, and send.

**Say:**
“Same agent, same question. Now it proposes fourteen days for new signups and
preserves existing trials. We didn’t manually paste the policy into Ryan’s chat.”

### 6. Reuse the context for another responsibility

Choose **Andy’s Codex**, type **What should we test?**, and send.

**Say:**
“My agent uses the same update to propose checks: a new customer gets fourteen
days; an existing trial keeps its original end date; the website and reminders
agree. One discovery supports different work across the team.”

### 7. Close

**Say:**
“Civitas helps independently owned agents work from the same evidence, while
people decide what gets shared and applied.

Your agent learns something. The right agents know it too.”

## Optional: show the proposed changes — another 30–45 seconds

Scroll to the shared packet → **Update all services** → **Inbox**.

- **Signup flow:** the proposal uses the existing trial end date when present;
  only a new trial defaults to fourteen days.
- **Website:** the signup message changes from thirty days to fourteen.
- **Trial reminders:** reminders use each customer’s saved end date rather than
  assuming everyone has the same trial length.

Click **View full diff** on one proposal, close it, then **Apply to demo copy** on
each. Open **Agents** to show **3 of 3 updated**.

**Say:**
“The same reviewed policy informs three proposed changes. Each still needs a
person’s approval. In this preview, those approvals only change the browser state;
no files or systems are changed.”

## Reset

Click **Andy** at the bottom of the sidebar → **Reset preview**, or refresh.
This clears shared knowledge, replies, approvals and pending timers. Ryan starts
with the old thirty-day rule again; David has the updated policy. The three
prepared agents stay connected. People-only messages do not invoke agents.
