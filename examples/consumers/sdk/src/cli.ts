// SYNTHETIC EXAMPLE CONSUMER. Usage: npx tsx src/cli.ts <payload.json>
import { readFileSync } from 'node:fs';
import { decodeRequest } from './request.js';

const file = process.argv[2];
if (!file) throw new Error('Usage: cli.ts <payload.json>');
console.log(JSON.stringify(decodeRequest(readFileSync(file, 'utf8')), null, 2));
