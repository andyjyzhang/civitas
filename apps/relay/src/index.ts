import { readConfig } from './config.js';
import { createRelay } from './server.js';
import { MemoryStorage, type RelayStorage } from './storage.js';
import { openPool, PostgresStorage } from './postgres.js';

let storage: RelayStorage | undefined;
try {
  const config = readConfig();
  storage = config.storage === 'postgres'
    ? new PostgresStorage(await openPool({ ...config, databaseUrl: config.databaseUrl! }), config.analyticsEnabled)
    : new MemoryStorage();
  await storage.ready();
  const app = createRelay(config, storage);
  const address = await app.listen({ host: config.host, port: config.port });
  console.error(`Civitas relay: ${address} | space ${config.spaceId} | ${storage.mode === 'memory' ? 'IN-MEMORY: restart clears all data' : 'POSTGRESQL: durable storage'} | Timescale analytics ${storage.analyticsEnabled ? 'enabled' : 'disabled'}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, async () => { await app.close(); process.exit(0); });
  }
} catch {
  // Driver errors may include user/host details. Do not dump credentials or DB errors.
  console.error('Relay startup failed. Check agent credentials, storage config, database/TLS connectivity, migrations, and listening port. No fallback to memory.');
  await storage?.close();
  process.exitCode = 1;
}
