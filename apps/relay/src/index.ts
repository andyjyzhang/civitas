import { readConfig } from './config.js';
import { createRelay } from './server.js';

try {
  const config = readConfig();
  const app = createRelay(config);
  const address = await app.listen({ host: config.host, port: config.port });
  console.error(`Civitas relay: ${address} | space ${config.spaceId} | IN-MEMORY: restart clears all data`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, async () => { await app.close(); process.exit(0); });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not start relay.');
  process.exitCode = 1;
}
