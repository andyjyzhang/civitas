import { readStorageConfig } from './config.js';
import { openPool, migrate, databaseFailureHint } from './postgres.js';

try {
  const config = readStorageConfig();
  if (!config.databaseUrl) throw new Error('Set DATABASE_URL before running migrations.');
  const pool = await openPool({ ...config, databaseUrl: config.databaseUrl });
  try { await migrate(pool, config.analyticsEnabled); }
  finally { await pool.end(); }
} catch (error) {
  console.error(`Database migration failed. ${databaseFailureHint(error)} No fallback was applied.`);
  process.exitCode = 1;
}
