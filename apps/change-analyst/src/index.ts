import { AnalystError } from './errors.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { ContextEventSchema, PublishContextInputSchema, UpdatesPageSchema } from '@civitas/contracts';
import { analyze } from './analyst.js';
import { withBridge, callTool } from './mcp.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const space_id = process.env.CIVITAS_DEMO_SPACE_ID ?? 'sp_demo';
const command = process.argv[2];
const runId = process.argv[3] ?? randomUUID();
if (!/^[a-zA-Z0-9_-]{1,100}$/.test(runId)) throw new AnalystError('Run ID must use 1–100 letters, digits, hyphens or underscores.');
const directory = resolve(root, '.local/analyst', runId);
const checkpoint = resolve(directory, 'review.json');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function main() {
  if (command === 'analyze') {
    // Exclusive reservation prevents accidentally regenerating an approved retry body.
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, 'started.json'), JSON.stringify({ runId }), { flag: 'wx', mode: 0o600 });
    const result = await analyze(runId);
    await writeFile(checkpoint, JSON.stringify({ ...result, spaceId: space_id, packetHash: digest(result.packet) }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(`Candidate saved for review. Run: npm run review -w @civitas/change-analyst -- ${runId}`);
    return;
  }
  if (command === 'review') {
    const saved = JSON.parse(await readFile(checkpoint, 'utf8'));
    const packet = PublishContextInputSchema.parse(saved.packet);
    if (saved.runId !== runId || saved.packetHash !== digest(packet) || packet.idempotencyKey !== `analyst:${runId}` || saved.spaceId !== space_id) throw new AnalystError('Checkpoint changed or target space differs. Start a new analysis run.');
    // Escape control characters from untrusted model output before terminal display.
    console.log(JSON.stringify({ spaceId: space_id, runId, model: saved.model, packet, evidence: saved.evidence }, null, 2));
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new AnalystError('Review requires an interactive terminal. Nothing published.');
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    let approval: string;
    try { approval = await terminal.question(`Publish this exact packet? Type "publish ${runId}": `); }
    finally { terminal.close(); }
    if (approval !== `publish ${runId}`) { console.log('Not approved. Nothing published; checkpoint retained.'); return; }
    const { idempotencyKey, ...body } = packet;
    const event = await withBridge(async client => ContextEventSchema.parse(await callTool(client, 'publish_context', { space_id, ...body, idempotency_key: idempotencyKey })));
    await writeFile(resolve(directory, 'published.json'), JSON.stringify(event, null, 2), { mode: 0o600 });
    console.log(`Published ${event.eventId} as ${event.publisherAgentId}. Retry review with the same run ID if needed.`);
    return;
  }
  if (command === 'subscribe' || command === 'updates') {
    const value = await withBridge(client => command === 'subscribe'
      ? callTool(client, 'subscribe', { space_id, topic: 'project/maintenance-api' })
      : callTool(client, 'get_updates', { space_id }));
    console.log(JSON.stringify(command === 'updates' ? UpdatesPageSchema.parse(value) : value, null, 2));
    return;
  }
  console.log('Commands: analyze [new-run-id], review <run-id>, subscribe, updates. See apps/change-analyst/README.md.');
}
main().catch((error: unknown) => {
  // Provider/transport errors may embed request bodies or credentials. Keep details local to the provider.
  if (error instanceof AnalystError) console.error(error.message);
  console.error(`Analyst ${command ?? 'command'} failed. Check model credential, build, relay, or checkpoint. No analysis success is implied. A failed model run needs a new run ID; publication retries use the existing review ID.`);
  process.exitCode = 1;
});
