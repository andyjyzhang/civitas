import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { UpdatesPageSchema, type ContextEvent } from '@civitas/contracts';
import { decodeMaintenanceRequest } from './consumers/sdk.js';
import { triageItem } from './consumers/triage.js';
import { dispatchDecision } from './consumers/dispatch.js';

const consumer = process.argv[2];
const action = process.argv[3];
const selectedId = process.argv[4];
const consumers = ['sdk', 'triage', 'dispatch'];
const space_id = process.env.CIVITAS_DEMO_SPACE_ID ?? 'sp_demo';
const topic = 'project/maintenance-api';
async function main() {
  if (!consumer || !consumers.includes(consumer) || !['subscribe', 'list', 'receive'].includes(action ?? '')) throw new Error('Usage: receive.ts sdk|triage|dispatch subscribe|list|receive [selected-event-id]');
  if (action === 'receive' && !selectedId) throw new Error('Select an event ID from list; no event is selected automatically.');
  const { CIVITAS_RELAY_URL, CIVITAS_AGENT_TOKEN } = process.env;
  if (!CIVITAS_RELAY_URL || !CIVITAS_AGENT_TOKEN) throw new Error('Load a private admitted receiver env file.');
  const client = new Client({ name: `civitas-consumer-${consumer}`, version: '0.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../../packages/cli/dist/index.js', import.meta.url))], env: { CIVITAS_RELAY_URL, CIVITAS_AGENT_TOKEN }, stderr: 'ignore' });
  async function tool(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`MCP ${name} failed. Check the admitted identity and relay.`);
    const text = (result.content as { type: string; text?: string }[]).find(item => item.type === 'text')?.text;
    if (!text) throw new Error('MCP returned no JSON.');
    return JSON.parse(text);
  }
  try {
    await client.connect(transport);
    if (action === 'subscribe') {
      const subscription = await tool('subscribe', { space_id, topic });
      console.log(JSON.stringify(subscription, null, 2));
      return;
    }
    let event: ContextEvent | undefined;
    let deliveryId: string | undefined;
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
      const page = UpdatesPageSchema.parse(await tool('get_updates', { space_id, limit: 100, ...(cursor ? { cursor } : {}) }));
      for (const item of page.items) {
        if (action === 'list') console.log(JSON.stringify({ eventId: item.event.eventId, title: item.event.title, source: item.event.source, publisherAgentId: item.event.publisherAgentId }));
        if (item.event.eventId === selectedId) { event = item.event; deliveryId = item.deliveryId; }
      }
      cursor = page.nextCursor;
      if (!cursor || event) break;
    }
    if (action === 'list') return;
    if (!event || !deliveryId) throw new Error('Selected event was not found in this receiver inbox.');
    if (event.spaceId !== space_id || event.topic !== topic || !['examples/api-change/after.json', 'fixture:examples/api-change/after.json'].includes(event.source.uri) || event.source.revision !== 'maintenance-v2') throw new Error('Selected event does not reference the approved synthetic fixture.');
    // Context is recorded as untrusted data. It cannot supply commands, filenames,
    // code, mappings or credentials. All behavior below comes from local adapters.
    const fixture = JSON.parse(await readFile(new URL('./after.json', import.meta.url), 'utf8'));
    const request = decodeMaintenanceRequest(fixture.response, 'maintenance-v2');
    const outcome = consumer === 'sdk' ? request : consumer === 'triage' ? triageItem(request) : dispatchDecision(request);
    const receipt = { synthetic: true, consumer, deliveryId, selectedEvent: event, outcome, execution: 'Local preimplemented adapter; incoming context was not executed and did not generate code.', receivedAt: new Date().toISOString() };
    const directory = fileURLToPath(new URL('../../.local/consumer-demo/', import.meta.url));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(`${directory}${consumer}.json`, JSON.stringify(receipt, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ consumer, eventId: event.eventId, source: event.source, outcome, receipt: `.local/consumer-demo/${consumer}.json` }, null, 2));
  } finally { await client.close(); }
}
main().catch(() => { console.error('Consumer command failed. Verify arguments, selected event, private agent env, bridge build, and relay. Nothing from incoming context was executed.'); process.exitCode = 1; });
