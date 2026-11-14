import { readStorageConfig } from './config.js';
import { openPool, migrate } from './postgres.js';

try {
  const config = readStorageConfig();
  if (!config.databaseUrl) throw new Error('Set DATABASE_URL before running migrations.');
  const pool = await openPool({ ...config, databaseUrl: config.databaseUrl });
  try { await migrate(pool, config.analyticsEnabled); }
  finally { await pool.end(); }
} catch {
  console.error('Database migration failed. Check connection/TLS, privileges, migration checksums, and Timescale availability when analytics is enabled. No fallback was applied.');
  process.exitCode = 1;
}
