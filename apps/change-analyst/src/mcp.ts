import { AnalystError } from './errors.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { fileURLToPath } from 'node:url';
import type { Credentials } from './workspace.js';

const cliPath = fileURLToPath(new URL('../../../packages/cli/dist/index.js', import.meta.url));

// Only the relay URL and this agent's token reach the bridge; model credentials are never forwarded.
const bridgeEnv = (creds: Credentials) => ({ CIVITAS_RELAY_URL: creds.relayUrl, CIVITAS_AGENT_TOKEN: creds.token });

export async function withBridge<T>(creds: Credentials, action: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({ command: process.execPath, args: [cliPath], env: bridgeEnv(creds), stderr: 'ignore' });
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

/**
 * Calls one Civitas MCP tool through @langchain/mcp-adapters over a short-lived stdio
 * bridge. The raw MCP tools are never given to the model; callers wrap them and inject scope.
 */
export async function callCivitas(creds: Credentials, name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = new MultiServerMCPClient({
    mcpServers: { civitas: { transport: 'stdio', command: process.execPath, args: [cliPath], env: bridgeEnv(creds), stderr: 'ignore' } },
    throwOnLoadError: true,
    onConnectionError: 'throw',
  });
  try {
    const raw = (await client.getTools()).find(item => item.name === name);
    if (!raw) throw new AnalystError(`Civitas MCP bridge does not expose ${name}.`);
    let output: unknown;
    try { output = await raw.invoke(args); }
    catch { throw new AnalystError(`MCP ${name} failed; verify relay access and retry.`); }
    return parseToolJson(output, name);
  } finally { await client.close(); }
}

function parseToolJson(output: unknown, name: string): unknown {
  if (typeof output === 'string') return JSON.parse(output);
  if (Array.isArray(output)) {
    const text = (output.flat() as Array<{ type?: string; text?: string }>).find(block => block?.type === 'text')?.text;
    if (text) return JSON.parse(text);
  }
  if (output && typeof output === 'object' && 'content' in output) return parseToolJson((output as { content: unknown }).content, name);
  throw new AnalystError(`MCP ${name} returned no JSON.`);
}
