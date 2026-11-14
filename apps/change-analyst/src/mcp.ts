import { AnalystError } from './errors.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../../../packages/cli/dist/index.js', import.meta.url));

function bridgeEnv() {
  const { CIVITAS_RELAY_URL, CIVITAS_AGENT_TOKEN } = process.env;
  if (!CIVITAS_RELAY_URL || !CIVITAS_AGENT_TOKEN) throw new AnalystError('Load a private agent env file before using MCP.');
  // Do not forward model credentials to the bridge process.
  return { CIVITAS_RELAY_URL, CIVITAS_AGENT_TOKEN };
}

export async function withBridge<T>(action: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({ command: process.execPath, args: [cliPath], env: bridgeEnv(), stderr: 'ignore' });
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
 * Loads the Civitas MCP publish_context tool through @langchain/mcp-adapters.
 * The raw tool is never given to the model; the runner wraps it and injects scope.
 */
export async function loadMcpPublisher() {
  const client = new MultiServerMCPClient({
    mcpServers: { civitas: { transport: 'stdio', command: process.execPath, args: [cliPath], env: bridgeEnv(), stderr: 'ignore' } },
    throwOnLoadError: true,
    onConnectionError: 'throw',
  });
  try {
    const raw = (await client.getTools()).find(item => item.name === 'publish_context');
    if (!raw) throw new AnalystError('Civitas MCP bridge does not expose publish_context.');
    const publish = async (args: Record<string, unknown>) => {
      let output: unknown;
      try { output = await raw.invoke(args); }
      catch { throw new AnalystError('MCP publish_context failed; verify relay access and retry with review <run-id>.'); }
      return parseToolJson(output);
    };
    return { publish, close: () => client.close() };
  } catch (error) { await client.close(); throw error; }
}

function parseToolJson(output: unknown): unknown {
  if (typeof output === 'string') return JSON.parse(output);
  if (Array.isArray(output)) {
    const text = (output.flat() as Array<{ type?: string; text?: string }>).find(block => block?.type === 'text')?.text;
    if (text) return JSON.parse(text);
  }
  if (output && typeof output === 'object' && 'content' in output) return parseToolJson((output as { content: unknown }).content);
  throw new AnalystError('MCP publish_context returned no JSON.');
}
