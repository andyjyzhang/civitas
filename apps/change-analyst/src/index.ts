import { AnalystError } from './errors.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import type { BaseMessage } from '@langchain/core/messages';
import { Command, MemorySaver } from '@langchain/langgraph';
import { ContextEventSchema, PublishContextInputSchema, UpdatesPageSchema, type PublishContextInput } from '@civitas/contracts';
import { buildAnalystAgent, createGuardedModel, digest, publishResults, relayBody, sourceDigest, toPublishInput, type ApprovalDecision } from './analyst.js';
import { withBridge, callTool, callCivitas } from './mcp.js';
import { ROOT, checkRunId, findSource, processCredentials } from './workspace.js';

// CLI runner: a thin terminal wrapper around the same agent the LangGraph server serves.
const SOURCE_ID = process.env.CIVITAS_ANALYST_SOURCE ?? 'maintenance-api';
const command = process.argv[2];
const positional = process.argv.slice(3).filter(arg => !arg.startsWith('--'));
const flags = new Set(process.argv.slice(3).filter(arg => arg.startsWith('--')));
const runId = checkRunId(positional[0] ?? randomUUID());
const directory = resolve(ROOT, '.local/analyst', runId);
const checkpoint = resolve(directory, 'review.json');

// Escape terminal control characters (C0 except newline/tab, DEL, C1, line separators) in untrusted text.
const escapeText = (text: string) => text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
const escapeJson = (value: unknown) => escapeText(JSON.stringify(value, null, 2));

function checkApprovalMode() {
  if (flags.has('--approve')) {
    if (process.env.CIVITAS_ANALYST_AUTO_APPROVE !== '1') throw new AnalystError('--approve requires CIVITAS_ANALYST_AUTO_APPROVE=1. Nothing run or published.');
  } else if (!process.stdin.isTTY || !process.stdout.isTTY) throw new AnalystError('Approval requires an interactive terminal (or the gated --approve flag). Nothing run or published.');
}

async function askApproval(): Promise<boolean> {
  checkApprovalMode();
  if (flags.has('--approve')) {
    console.log('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('!!! AUTO-APPROVE: CIVITAS_ANALYST_AUTO_APPROVE=1 and --approve were set.   !!!');
    console.log('!!! No human typed the approval. Use only for automated verification.     !!!');
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
    return true;
  }
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await terminal.question(`Publish this exact packet? Type "publish ${runId}": `)) === `publish ${runId}`; }
  finally { terminal.close(); }
}

type State = { messages: BaseMessage[]; files?: Record<string, { content: string[] | string }>; __interrupt__?: Array<{ value?: { actionRequests?: Array<{ name: string; args: unknown }> } }> };

const fileText = (state: State, path: string) => {
  const content = state.files?.[path]?.content;
  return Array.isArray(content) ? content.join('\n') : content ?? '';
};

async function analyzeCommand() {
  // Fail before reserving the run ID or spending anything.
  checkApprovalMode();
  const creds = processCredentials();
  const source = findSource(SOURCE_ID);
  const { model, guard, modelId } = createGuardedModel(runId);
  // Exclusive reservation prevents accidentally regenerating an approved retry body.
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(resolve(directory, 'started.json'), JSON.stringify({ runId }), { flag: 'wx', mode: 0o600 });
  const scope = { runId, spaceId: creds.spaceId, source };
  const agent = buildAnalystAgent({ ...scope, model, checkpointer: new MemorySaver(), publisher: body => callCivitas(creds, 'publish_context', body) });
  const config = { configurable: { thread_id: `analyst:${runId}` }, recursionLimit: 80 };
  const run = async (input: unknown) => (await agent.invoke(input as never, config as never)) as unknown as State;
  const sourceHash = await sourceDigest(source);
  console.log(`Run ${runId}: Deep Agents plan, contract/impact specialists, /repo/ ${source.path} (read-only), /evidence/ scratch. Model ${modelId}.`);
  // Automatic checks and one bounce-back happen inside publish_context before this interrupt.
  const state = await run({ messages: [{ role: 'user', content: 'Analyze what changed in /repo/ and what consumers must do, then submit the context packet for review.' }] });
  const request = (state.__interrupt__ ?? []).flatMap(item => item.value?.actionRequests ?? []);
  if (request.length !== 1 || request[0].name !== 'publish_context') throw new AnalystError('Analysis ended without a checked publish_context candidate. Nothing published.');
  const packet = toPublishInput(scope, request[0].args);
  const evidence = { '/evidence/contract.md': fileText(state, '/evidence/contract.md'), '/evidence/impact.md': fileText(state, '/evidence/impact.md') };
  // Saved review record: the durable approval boundary and retry body.
  await writeFile(checkpoint, JSON.stringify({ runId, model: modelId, sourceId: source.id, sourceHash, spaceId: creds.spaceId, packet, packetHash: digest(packet), evidence }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('\n=== Pending publish_context call (exact relay arguments) ===');
  console.log(escapeJson(relayBody(creds.spaceId, packet)));
  for (const [path, text] of Object.entries(evidence)) console.log(`\n=== Evidence ${path} ===\n${escapeText(text)}`);
  console.log('\nModel output can be wrong. Read the complete packet before approving.');
  const approved = await askApproval();
  const decision: ApprovalDecision = approved ? { type: 'approve' } : { type: 'reject', message: 'The human reviewer rejected this packet.' };
  const final = await run(new Command({ resume: { decisions: [decision] } }));
  if (!approved) { console.log(`Not approved. Nothing published; review record kept at .local/analyst/${runId}/review.json.`); return; }
  const result = publishResults(final.messages).at(-1);
  if (result?.outcome !== 'published') throw new AnalystError(`Approved, but publish did not complete. Retry with: review ${runId}`);
  const event = result.event as { eventId: string; version: number; publisherAgentId: string };
  await writeFile(resolve(directory, 'published.json'), JSON.stringify(event, null, 2), { mode: 0o600 });
  console.log(`Published ${event.eventId} v${event.version} as ${event.publisherAgentId}. Run spend estimate $${guard.runUsd.toFixed(4)}.`);
}

async function main() {
  if (command === 'analyze') return analyzeCommand();
  const creds = processCredentials();
  if (command === 'review') {
    // Retry path: republish the saved, previously reviewed packet without a model call.
    const saved = JSON.parse(await readFile(checkpoint, 'utf8'));
    const packet: PublishContextInput = PublishContextInputSchema.parse(saved.packet);
    if (saved.runId !== runId || saved.packetHash !== digest(packet) || packet.idempotencyKey !== `analyst:${runId}` || saved.spaceId !== creds.spaceId) throw new AnalystError('Checkpoint changed or target space differs. Start a new analysis run.');
    console.log(escapeJson({ spaceId: creds.spaceId, runId, model: saved.model, packet, evidence: saved.evidence }));
    if (!(await askApproval())) { console.log('Not approved. Nothing published; checkpoint retained.'); return; }
    const event = await withBridge(creds, async client => ContextEventSchema.parse(await callTool(client, 'publish_context', relayBody(creds.spaceId, packet))));
    await writeFile(resolve(directory, 'published.json'), JSON.stringify(event, null, 2), { mode: 0o600 });
    console.log(`Published ${event.eventId} as ${event.publisherAgentId}. Retry review with the same run ID if needed.`);
    return;
  }
  if (command === 'subscribe' || command === 'updates') {
    const value = await withBridge(creds, client => command === 'subscribe'
      ? callTool(client, 'subscribe', { space_id: creds.spaceId, topic: findSource(SOURCE_ID).topic })
      : callTool(client, 'get_updates', { space_id: creds.spaceId }));
    console.log(escapeJson(command === 'updates' ? UpdatesPageSchema.parse(value) : value));
    return;
  }
  console.log('Commands: analyze [new-run-id] [--approve], review <run-id>, subscribe, updates. See apps/change-analyst/README.md.');
}
main().catch((error: unknown) => {
  // Provider/transport errors may embed request bodies or credentials. Keep details local to the provider.
  if (error instanceof AnalystError) console.error(error.message);
  else if (process.env.CIVITAS_ANALYST_DEBUG === '1' && error instanceof Error) console.error(`${error.name}: ${escapeText(error.message).slice(0, 500)}`);
  console.error(`Analyst ${command ?? 'command'} failed. Check model credential, build, relay, or checkpoint. No analysis success is implied. A failed model run needs a new run ID; publication retries use review <run-id>.`);
  process.exitCode = 1;
});
