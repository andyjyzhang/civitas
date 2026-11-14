import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg, { type PoolClient } from 'pg';
import type { ContextEvent, Delivery, PublishContextInput, Subscription } from '@civitas/contracts';
import { canonical, HttpError, makeEvent, type RelayStorage, type Snapshot } from './storage.js';

export type DatabaseConfig = { databaseUrl: string; analyticsEnabled: boolean; databaseCaFile?: string };
export function databasePool(config: DatabaseConfig) {
  // pg honors sslmode in the URI. Force certificate verification for remote DBs;
  // strip SSL query options so they cannot overwrite our verified TLS settings.
  const url = new URL(config.databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must be a PostgreSQL URI.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const tls = !local || ['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') || '');
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation', 'uselibpqcompat', 'host', 'hostaddr', 'port']) url.searchParams.delete(key);
  return { url: url.toString(), tls };
}
export async function openPool(config: DatabaseConfig) {
  const { url, tls } = databasePool(config);
  const ca = config.databaseCaFile ? await readFile(config.databaseCaFile, 'utf8') : undefined;
  const pool = new pg.Pool({ connectionString: url, max: 8, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000, statement_timeout: 10000, lock_timeout: 5000,
    ssl: tls ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) } : false });
  pool.on('error', () => console.error('An idle database connection failed; subsequent requests will reconnect.'));
  return pool;
}

export async function migrate(pool: pg.Pool, analytics: boolean) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize migrations with each other. Table locking below also excludes writes
    // while adding the telemetry trigger and backfilling historical transitions.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('civitas:migrations', 0))");
    await client.query('CREATE TABLE IF NOT EXISTS civitas_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const files = ['001_core.sql', ...(analytics ? ['002_timescale.sql'] : [])];
    for (const name of files) {
      const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query('SELECT checksum FROM civitas_migrations WHERE name=$1', [name]);
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}. Add a new migration instead.`);
        continue;
      }
      if (name === '002_timescale.sql') await client.query('LOCK TABLE civitas_transitions IN ACCESS EXCLUSIVE MODE');
      await client.query(sql);
      await client.query('INSERT INTO civitas_migrations (name,checksum) VALUES ($1,$2)', [name, checksum]);
      console.log(`Applied ${name}`);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

const iso = (value: Date | string) => new Date(value).toISOString();
function subscription(row: any): Subscription {
  return { subscriptionId: row.subscription_id, spaceId: row.space_id, agentId: row.agent_id, topic: row.topic, createdAt: iso(row.created_at) };
}
function delivery(row: any): Delivery {
  return { deliveryId: row.delivery_id, event: row.event, deliveredAt: iso(row.delivered_at), acknowledgedAt: null, status: 'pending' };
}

export class PostgresStorage implements RelayStorage {
  mode = 'postgres' as const;
  constructor(private pool: pg.Pool, public analyticsEnabled: boolean) {}
  async ready() {
    await this.pool.query('SELECT 1 FROM civitas_events LIMIT 0');
    if (this.analyticsEnabled) {
      const result = await this.pool.query("SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_schema='public' AND hypertable_name='civitas_activity'");
      if (!result.rowCount) throw new Error('Timescale migration is required.');
    }
  }
  async close() { await this.pool.end(); }
  private async transaction<T>(space: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // A small demo prioritizes deterministic ordering over per-space throughput.
      // All space mutations and snapshots use this DB lock across relay processes.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`civitas:space:${space}`]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* release unusable connection below */ }
      throw error;
    } finally { client.release(); }
  }
  async touch(space: string, agent: string) {
    await this.pool.query(`INSERT INTO civitas_agent_activity VALUES ($1,$2,clock_timestamp())
      ON CONFLICT (space_id,agent_id) DO UPDATE SET last_activity_at=GREATEST(civitas_agent_activity.last_activity_at, EXCLUDED.last_activity_at)`, [space, agent]);
  }
  async subscribe(space: string, agent: string, topic: string) {
    return this.transaction(space, async client => {
      await client.query(`INSERT INTO civitas_subscriptions (subscription_id,space_id,agent_id,topic) VALUES ($1,$2,$3,$4)
        ON CONFLICT (space_id,agent_id,topic) DO NOTHING`, [`sub_${randomUUID()}`, space, agent, topic]);
      const result = await client.query('SELECT * FROM civitas_subscriptions WHERE space_id=$1 AND agent_id=$2 AND topic=$3', [space, agent, topic]);
      return subscription(result.rows[0]);
    });
  }
  async publish(space: string, agent: string, input: PublishContextInput, allowedAgents: string[]): Promise<ContextEvent> {
    return this.transaction(space, async client => {
      const existing = await client.query('SELECT request_body,event FROM civitas_events WHERE space_id=$1 AND publisher_agent_id=$2 AND idempotency_key=$3', [space, agent, input.idempotencyKey]);
      if (existing.rowCount) {
        if (canonical(existing.rows[0].request_body) !== canonical(input)) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Retry key already used for different content.');
        return existing.rows[0].event;
      }
      const clock = await client.query('SELECT clock_timestamp() AS time');
      const event = makeEvent(space, agent, input, iso(clock.rows[0].time));
      await client.query(`INSERT INTO civitas_events (event_id,space_id,publisher_agent_id,idempotency_key,request_body,context_id,version,published_at,event)
        VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8)`, [event.eventId, space, agent, input.idempotencyKey, input, event.contextId, event.publishedAt, event]);
      await client.query(`INSERT INTO civitas_transitions (transition_id,space_id,event_id,agent_id,kind,occurred_at)
        VALUES ($1,$2,$3,$4,'published',$5)`, [randomUUID(), space, event.eventId, agent, event.publishedAt]);
      const matches = await client.query('SELECT agent_id FROM civitas_subscriptions WHERE space_id=$1 AND topic=$2 AND agent_id=ANY($3::text[])', [space, input.topic, allowedAgents]);
      for (const row of matches.rows) {
        const deliveryId = `dlv_${randomUUID()}`;
        const inserted = await client.query(`INSERT INTO civitas_deliveries (delivery_id,space_id,event_id,agent_id,delivered_at)
          VALUES ($1,$2,$3,$4,clock_timestamp()) RETURNING delivered_at`, [deliveryId, space, event.eventId, row.agent_id]);
        await client.query(`INSERT INTO civitas_transitions (transition_id,space_id,event_id,agent_id,delivery_id,kind,occurred_at,latency_ms)
          VALUES ($1,$2,$3,$4,$5,'delivered',$6,GREATEST(0,EXTRACT(EPOCH FROM ($6::timestamptz-$7::timestamptz))*1000))`,
          [randomUUID(), space, event.eventId, row.agent_id, deliveryId, inserted.rows[0].delivered_at, event.publishedAt]);
      }
      return event;
    });
  }
  async updates(space: string, agent: string) {
    return this.transaction(space, async client => {
      // UPDATE RETURNING emits transitions only for the first retrieval, including
      // concurrent polls and retries on another relay instance.
      const first = await client.query(`UPDATE civitas_deliveries SET retrieved_at=clock_timestamp()
        WHERE space_id=$1 AND agent_id=$2 AND retrieved_at IS NULL RETURNING *`, [space, agent]);
      for (const row of first.rows) {
        await client.query(`INSERT INTO civitas_transitions (transition_id,space_id,event_id,agent_id,delivery_id,kind,occurred_at,latency_ms)
          SELECT $1,$2,event_id,$3,$4,'retrieved',$5,GREATEST(0,EXTRACT(EPOCH FROM ($5::timestamptz-published_at))*1000)
          FROM civitas_events WHERE space_id=$2 AND event_id=$6`, [randomUUID(), space, agent, row.delivery_id, row.retrieved_at, row.event_id]);
      }
      const rows = await client.query(`SELECT d.*,e.event FROM civitas_deliveries d JOIN civitas_events e USING (space_id,event_id)
        WHERE d.space_id=$1 AND d.agent_id=$2 ORDER BY d.delivered_at,d.delivery_id`, [space, agent]);
      return rows.rows.map(delivery);
    });
  }
  async snapshot(space: string, allowed: string[]): Promise<Snapshot> {
    return this.transaction(space, async client => {
      const subscriptions = await client.query('SELECT * FROM civitas_subscriptions WHERE space_id=$1 AND agent_id=ANY($2::text[]) ORDER BY created_at,subscription_id', [space, allowed]);
      const events = await client.query('SELECT event FROM civitas_events WHERE space_id=$1 ORDER BY published_at DESC,event_id', [space]);
      const deliveries = await client.query(`SELECT d.*,e.event FROM civitas_deliveries d JOIN civitas_events e USING (space_id,event_id)
        WHERE d.space_id=$1 AND d.agent_id=ANY($2::text[]) ORDER BY d.delivered_at,d.delivery_id`, [space, allowed]);
      const seen = await client.query('SELECT agent_id,last_activity_at FROM civitas_agent_activity WHERE space_id=$1', [space]);
      return {
        subscriptions: subscriptions.rows.map(subscription), events: events.rows.map(row => row.event),
        deliveries: deliveries.rows.map(row => ({ ...delivery(row), retrievedAt: row.retrieved_at ? iso(row.retrieved_at) : null })),
        agents: allowed.map(agentId => ({ agentId, lastActivityAt: seen.rows.find(row => row.agent_id === agentId)?.last_activity_at?.toISOString() || null })),
      };
    });
  }
  async analytics(space: string, from: string, to: string) {
    if (!this.analyticsEnabled) throw new HttpError(503, 'ANALYTICS_DISABLED', 'Enable Timescale analytics after applying its migration.');
    const result = await this.pool.query(`SELECT time_bucket('1 minute',occurred_at) AS bucket, kind,
      count(*)::integer AS samples, avg(latency_ms) AS mean_latency_ms,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS median_latency_ms,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms
      FROM civitas_activity WHERE space_id=$1 AND occurred_at >= $2 AND occurred_at < $3
      GROUP BY bucket,kind ORDER BY bucket,kind`, [space, from, to]);
    return { spaceId: space, from, to, bucketSeconds: 60, storage: 'postgres', analytics: 'timescale',
      generatedAt: new Date().toISOString(), buckets: result.rows.map(row => ({
        bucket: iso(row.bucket), kind: row.kind, samples: row.samples,
        meanLatencyMs: row.mean_latency_ms, medianLatencyMs: row.median_latency_ms, p95LatencyMs: row.p95_latency_ms,
      })), latencyDefinition: 'Server publication to delivery or first inbox retrieval. Includes polling delay; not model comprehension or action.' };
  }
}
