import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

try {
  loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

export function readConfig() {
  const publisherToken = process.env.CIVITAS_PUBLISHER_TOKEN;
  const receiverToken = process.env.CIVITAS_RECEIVER_TOKEN;
  if (!publisherToken || !receiverToken || publisherToken.length < 24 || receiverToken.length < 24) {
    throw new Error('Configure two agent credentials with npm run setup:demo first.');
  }
  if (publisherToken === receiverToken) throw new Error('Agent credentials must be different.');
  const host = process.env.RELAY_HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('This temporary relay must bind to a loopback host.');
  }
  const port = Number(process.env.RELAY_PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid RELAY_PORT.');
  return {
    host, port,
    spaceId: process.env.CIVITAS_DEMO_SPACE_ID || 'sp_demo',
    agents: new Map([
      [publisherToken, 'ag_publisher'],
      [receiverToken, 'ag_receiver'],
    ]),
  };
}
