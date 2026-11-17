import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const envPath = path.join(root, '.env');
let text;
try { text = await readFile(envPath, 'utf8'); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  text = await readFile(path.join(root, '.env.example'), 'utf8');
}
await writeFile(envPath, text, { mode: 0o600 });
loadEnvFile(envPath);
for (const key of ['CIVITAS_PUBLISHER_TOKEN', 'CIVITAS_RECEIVER_TOKEN']) {
  const value = process.env[key] || randomBytes(32).toString('hex');
  if (value.length < 24 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${key} must contain at least 24 letters/digits/underscores/hyphens.`);
  }
  process.env[key] = value;
  const line = new RegExp(`^${key}=.*$`, 'm');
  text = line.test(text) ? text.replace(line, `${key}=${value}`) : text.trimEnd() + `\n${key}=${value}\n`;
}
if (process.env.CIVITAS_PUBLISHER_TOKEN === process.env.CIVITAS_RECEIVER_TOKEN) {
  throw new Error('Use different credentials for the two agents.');
}
await writeFile(envPath, text, { mode: 0o600 });
await chmod(envPath, 0o600);
const local = path.join(root, '.local');
await mkdir(local, { recursive: true, mode: 0o700 });
const host = process.env.RELAY_HOST || '127.0.0.1';
const baseUrl = `http://${host === '::1' ? '[::1]' : host}:${process.env.RELAY_PORT || 4000}`;
for (const [name, token] of [['publisher', process.env.CIVITAS_PUBLISHER_TOKEN], ['receiver', process.env.CIVITAS_RECEIVER_TOKEN]]) {
  const target = path.join(local, `${name}.env`);
  await writeFile(target, `CIVITAS_RELAY_URL=${baseUrl}\nCIVITAS_AGENT_TOKEN=${token}\nCIVITAS_DEMO_SPACE_ID=${process.env.CIVITAS_DEMO_SPACE_ID || 'sp_demo'}\n`, { mode: 0o600 });
  await chmod(target, 0o600);
}
console.log('Local relay credentials saved privately in .env and .local/{publisher,receiver}.env. No tokens printed.');
