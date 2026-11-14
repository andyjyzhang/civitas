import { AnalystError } from './errors.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

export async function withBridge<T>(action: (client: Client) => Promise<T>): Promise<T> {
  const { CIVITAS_RELAY_URL, CIVITAS_AGENT_TOKEN } = process.env;
  if (!CIVITAS_RELAY_URL || !CIVITAS_AGENT_TOKEN) throw new AnalystError('Load a private agent env file before using MCP.');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../../../packages/cli/dist/index.js', import.meta.url))],
    // Do not forward model credentials to the bridge process.
    env: { CIVITAS_RELAY_URL, CIVITAS_AGENT_TOKEN },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'civitas-change-analyst', version: '0.0.0' });
  try { await client.connect(transport); return await action(client); }
  finally { await client.close(); }
}

export async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new AnalystError(`MCP ${name} failed; verify relay access and retry the same run.`);
  const blocks = result.content as Array<{ type: string; text?: string }>;
  const value = blocks.find(block => block.type === 'text')?.text;
  if (!value) throw new AnalystError(`MCP ${name} returned no JSON.`);
  return JSON.parse(value) as unknown;
}
