// SYNTHETIC DEMO CONSUMER. Usage: npx tsx src/cli.ts <payload.json>
// Uses an offline stub for the work order lookup and prints the URL it requested.
import { readFileSync } from 'node:fs';
import { decide, type DispatchRequest } from './decide.js';

const file = process.argv[2];
if (!file) throw new Error('Usage: cli.ts <payload.json>');
const request = JSON.parse(readFileSync(file, 'utf8')) as DispatchRequest;
const stub = async (url: string) => {
  console.error(`[stub] GET ${url}`);
  return { ok: true, status: 200, json: async () => ({ id: request.work_order_id, status: 'open' }) };
};
console.log(await decide(request, 'https://maintenance.example.test', stub));
