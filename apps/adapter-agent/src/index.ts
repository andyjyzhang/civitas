#!/usr/bin/env node
// Runner: node dist/index.js adapt <sdk|triage|dispatch> [runId]
// Thin terminal wrapper around the same adapter graph the LangGraph agent server serves.
// The graph pauses on submit_patch (after automatic checks); approval here resumes it, and
// the submit_patch tool applies the patch to .local/adapter/<runId>/<role>/ and only then
// acknowledges the Civitas delivery. Credentials are never printed.
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { Command, MemorySaver } from '@langchain/langgraph';
import { isToolMessage, type BaseMessage } from '@langchain/core/messages';
import { buildAdapterAgent, createGuardedModel } from './agent.js';
import { fileText, safe } from './patch.js';
import { ROOT, callCivitas, credentialsFromFile, findConsumer, laneSpend } from './workspace.js';

export * from './budget.js';

const laneLimit = Number(process.env.CIVITAS_ADAPTER_LANE_LIMIT_USD || 3);

async function askApproval(role: string): Promise<boolean> {
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`Apply this patch to ${role}? Type "apply ${role}" to approve, anything else rejects: `);
    rl.close();
    return answer.trim() === `apply ${role}`;
  }
  if (process.env.CIVITAS_ADAPTER_AUTO_APPROVE === '1') {
    console.log('\n' + '!'.repeat(72));
    console.log(`!! CIVITAS_ADAPTER_AUTO_APPROVE=1: auto-approving the ${role} patch WITHOUT human review.`);
    console.log('!! Use only for local verification runs.');
    console.log('!'.repeat(72) + '\n');
    return true;
  }
  throw new Error('Approval needs an interactive terminal (or CIVITAS_ADAPTER_AUTO_APPROVE=1 for local verification). Nothing applied or acknowledged.');
}

type State = { messages: BaseMessage[]; files?: Record<string, unknown>; __interrupt__?: Array<{ value: { actionRequests: { name: string; args: { delivery_id: string; patch_path: string; summary: string } }[]; civitas?: { typecheck?: string; eventId?: string } } }> };

async function adapt(roleArg: string, runId: string) {
  const consumer = findConsumer(roleArg);
  const role = consumer.role;
  const spent = laneSpend();
  if (spent >= laneLimit) throw new Error(`adapter-agent lane spend $${spent.toFixed(3)} reached its $${laneLimit} cap; no model call made.`);
  const creds = credentialsFromFile(process.env.CIVITAS_ADAPTER_ENV_FILE || resolve(ROOT, `.local/agents/${role}.env`));
  const { model, guard } = createGuardedModel(`${role}:${runId}`);
  const runDir = resolve(ROOT, '.local/adapter', runId);
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
  const agent = buildAdapterAgent({ consumer, runId, runDir, model, checkpointer: new MemorySaver(), civitas: (name, args) => callCivitas(creds, name, args) });
  const config = { configurable: { thread_id: `${role}:${runId}` }, recursionLimit: 120 };
  const run = async (input: unknown) => (await agent.invoke(input as never, config as never)) as unknown as State;
  console.log(`[adapter:${role}] run ${runId} with ${process.env.CIVITAS_MODEL || 'gpt-4.1-mini'}; ${consumer.path}/ mounted read-only at /repo/.`);
  let state = await run({ messages: [{ role: 'user', content: `Adapt the ${role} consumer to the latest Civitas update on topic ${consumer.topic}.` }] });
  try {
    while (state.__interrupt__?.length) {
      const request = state.__interrupt__[0].value;
      const action = request.actionRequests.find(item => item.name === 'submit_patch');
      if (!action) throw new Error('Unexpected interrupt without submit_patch');
      const { delivery_id, patch_path, summary } = action.args;
      console.log(`\n===== submit_patch from ${role} agent (automatic checks passed) =====`);
      console.log(`delivery: ${safe(delivery_id)}  event: ${safe(String(request.civitas?.eventId))}  topic: ${safe(consumer.topic)}`);
      console.log(`summary: ${safe(summary)}`);
      console.log(`TypeScript check of the patched consumer: ${safe(String(request.civitas?.typecheck))}`);
      console.log(`----- ${safe(patch_path)} -----\n${safe(fileText(state.files?.[patch_path]) ?? '(missing)')}`);
      console.log(`----- /notes/${role}.md -----\n${safe(fileText(state.files?.[`/notes/${role}.md`]) ?? '(missing)')}\n=====`);
      const approved = await askApproval(role);
      state = await run(new Command({ resume: { decisions: [approved ? { type: 'approve' } : { type: 'reject', message: 'The human reviewer rejected this patch. Do not resubmit.' }] } }));
    }
  } finally {
    const last = state.messages.filter(message => isToolMessage(message) && message.name === 'submit_patch').at(-1);
    let outcome = 'agent finished without submitting a patch';
    try { if (last) { const parsed = JSON.parse(String(last.content)); outcome = `${parsed.outcome}${parsed.copyDir ? ` (${parsed.copyDir})` : ''}`; } } catch { /* keep default */ }
    console.log(`[adapter:${role}] ${outcome}. Estimated run spend $${guard.runUsd.toFixed(4)}. Record: .local/adapter/${runId}/${role}.json`);
  }
}

async function main() {
  const [command, role, runIdArg] = process.argv.slice(2);
  if (command !== 'adapt' || !role) {
    console.error('Usage: node apps/adapter-agent/dist/index.js adapt <sdk|triage|dispatch> [runId]');
    process.exitCode = 2;
    return;
  }
  const runId = runIdArg || `run-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-')}`;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(runId)) throw new Error('runId must be 1-64 letters, digits, _ or -');
  if (!existsSync(resolve(ROOT, 'packages/cli/dist/index.js'))) throw new Error('Build the bridge first: npm run build:bridge');
  await adapt(role, runId);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(safe(error instanceof Error ? error.message : 'adapter run failed'));
    process.exitCode = 1;
  });
}
