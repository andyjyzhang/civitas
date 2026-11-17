import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';

// Prints additive configuration. Never reads tokens or modifies an existing MCP config.
export async function configure(args: string[]) {
  const tool = args[0] || 'claude';
  if (!['claude', 'codex', 'json'].includes(tool) || args.length > 2) {
    throw new Error('Usage: civitas-mcp configure [claude|codex|json] [private-agent.env]');
  }
  const envFile = resolve(args[1] || '.local/receiver.env');
  try { await access(envFile); } catch { throw new Error('Private agent env file is missing. Run npm run setup:local or save your linked agent env first.'); }
  const bridge = fileURLToPath(new URL('./index.js', import.meta.url));
  const command = process.execPath;
  const commandArgs = [`--env-file=${envFile}`, bridge];
  const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
  console.log('This helper prints configuration without editing existing servers. If civitas is already configured, choose a different entry name before running the command. The private env file remains on this computer.');
  if (tool === 'json') console.log(JSON.stringify({ mcpServers: { civitas: { command, args: commandArgs } } }, null, 2));
  else console.log(`${tool} mcp add ${tool === 'claude' ? '--scope local --transport stdio ' : ''}civitas -- ${[command, ...commandArgs].map(quote).join(' ')}`);
  console.log('Restart your coding session and inspect the Civitas tools. For group chat, ask the active agent to get_group_messages and reply_to_group_message. For topic context, subscribe before publishing. Sharing context never authorizes execution.');
}
