import { AnalystError } from './errors.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { ContextEventSchema, PublishContextInputSchema, UpdatesPageSchema, type PublishContextInput } from '@civitas/contracts';
import { createAnalyst, digest, modelSettings, pendingPublish, sourceDigest, validateCandidate, type Candidate } from './analyst.js';
import { withBridge, callTool, loadMcpPublisher } from './mcp.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const space_id = process.env.CIVITAS_DEMO_SPACE_ID ?? 'sp_demo';
const command = process.argv[2];
const positional = process.argv.slice(3).filter(arg => !arg.startsWith('--'));
const flags = new Set(process.argv.slice(3).filter(arg => arg.startsWith('--')));
const runId = positional[0] ?? randomUUID();
if (!/^[a-zA-Z0-9_-]{1,100}$/.test(runId)) throw new AnalystError('Run ID must use 1–100 letters, digits, hyphens or underscores.');
const directory = resolve(root, '.local/analyst', runId);
const checkpoint = resolve(directory, 'review.json');
const MAX_FIX_ATTEMPTS = 1;

// Escape terminal control characters (C0 except newline/tab, DEL, C1, line separators) in untrusted text.
const escapeText = (text: string) => text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u2028\u2029]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
const escapeJson = (value: unknown) => escapeText(JSON.stringify(value, null, 2));

// Exact MCP publish_context arguments for a reviewed packet.
const relayBody = (packet: PublishContextInput) => {
  const { idempotencyKey, ...body } = packet;
  return { space_id, ...body, idempotency_key: idempotencyKey };
};

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

function showCandidate(candidate: Candidate) {
  console.log('\n=== Pending publish_context call (exact relay arguments) ===');
  console.log(escapeJson(relayBody(candidate.packet)));
  for (const [path, text] of Object.entries(candidate.evidence)) {
    console.log(`\n=== Evidence ${path} ===`);
    console.log(escapeText(text));
  }
  console.log('\nModel output can be wrong. Read the complete packet before approving.');
}

async function analyzeCommand() {
  // Fail before reserving the run ID or spending anything.
  checkApprovalMode();
  modelSettings();
  // Exclusive reservation prevents accidentally regenerating an approved retry body.
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(resolve(directory, 'started.json'), JSON.stringify({ runId }), { flag: 'wx', mode: 0o600 });
  const mcp = await loadMcpPublisher();
  try {
    const analyst = await createAnalyst(runId, async input => ContextEventSchema.parse(await mcp.publish(relayBody(input))));
    const sourceHash = await sourceDigest();
    console.log(`Run ${runId}: Deep Agents plan, contract/impact specialists, /repo/ spec files (read-only), /evidence/ scratch. Model ${analyst.model}.`);
    let state = await analyst.start();
    let candidate: Candidate | undefined;
    for (let attempt = 0; ; attempt++) {
      const args = pendingPublish(state);
      if (args === undefined) throw new AnalystError('Analysis ended without a publish_context candidate. Nothing published.');
      const { candidate: valid, problems } = validateCandidate(runId, state, args);
      if (valid) { candidate = valid; break; }
      console.log(`Candidate failed checks: ${problems.join(' ')} Proposed tags: ${escapeText(JSON.stringify((args as { tags?: unknown }).tags ?? null))}`);
      if (attempt >= MAX_FIX_ATTEMPTS) throw new AnalystError('Candidate still failed checks. Nothing published.');
      console.log('Rejecting automatically and asking the analyst to fix it once…');
      state = await analyst.resume({ type: 'reject', message: `Automatic check rejected this packet: ${problems.join(' ')} Fix these issues, then call publish_context again.` });
    }
    // Saved review record: the durable approval boundary and retry body.
    await writeFile(checkpoint, JSON.stringify({ runId, model: analyst.model, sourceHash, spaceId: space_id, packet: candidate.packet, packetHash: digest(candidate.packet), evidence: candidate.evidence, toolCalls: candidate.toolCalls }, null, 2), { flag: 'wx', mode: 0o600 });
    showCandidate(candidate);
    const approved = await askApproval();
    if (!approved) {
      await analyst.resume({ type: 'reject', message: 'The human reviewer rejected this packet. Do not call publish_context again; stop.' });
      console.log(`Not approved. Nothing published; review record kept at .local/analyst/${runId}/review.json.`);
      return;
    }
    analyst.approve(candidate.packet);
    await analyst.resume({ type: 'approve' });
    const event = analyst.publishedEvent();
    if (!event) throw new AnalystError(`Approved, but publish did not complete. Retry with: review ${runId}`);
    await writeFile(resolve(directory, 'published.json'), JSON.stringify(event, null, 2), { mode: 0o600 });
    console.log(`Published ${event.eventId} v${event.version} as ${event.publisherAgentId}. Run spend estimate $${analyst.guard.runUsd.toFixed(4)}.`);
  } finally { await mcp.close(); }
}

async function main() {
  if (command === 'analyze') return analyzeCommand();
  if (command === 'review') {
    // Retry path: republish the saved, previously reviewed packet without a model call.
    const saved = JSON.parse(await readFile(checkpoint, 'utf8'));
    const packet = PublishContextInputSchema.parse(saved.packet);
    if (saved.runId !== runId || saved.packetHash !== digest(packet) || packet.idempotencyKey !== `analyst:${runId}` || saved.spaceId !== space_id) throw new AnalystError('Checkpoint changed or target space differs. Start a new analysis run.');
    console.log(escapeJson({ spaceId: space_id, runId, model: saved.model, packet, evidence: saved.evidence }));
    if (!(await askApproval())) { console.log('Not approved. Nothing published; checkpoint retained.'); return; }
    const event = await withBridge(async client => ContextEventSchema.parse(await callTool(client, 'publish_context', relayBody(packet))));
    await writeFile(resolve(directory, 'published.json'), JSON.stringify(event, null, 2), { mode: 0o600 });
    console.log(`Published ${event.eventId} as ${event.publisherAgentId}. Retry review with the same run ID if needed.`);
    return;
  }
  if (command === 'subscribe' || command === 'updates') {
    const value = await withBridge(client => command === 'subscribe'
      ? callTool(client, 'subscribe', { space_id, topic: 'project/maintenance-api' })
      : callTool(client, 'get_updates', { space_id }));
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
