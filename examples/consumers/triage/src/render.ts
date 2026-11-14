// SYNTHETIC DEMO CONSUMER. Usage: npx tsx src/render.ts <payload.json>  (prints HTML)
import { readFileSync } from 'node:fs';
import { renderCard, type TriageRequest } from './card.js';

const file = process.argv[2];
if (!file) throw new Error('Usage: render.ts <payload.json>');
const request = JSON.parse(readFileSync(file, 'utf8')) as TriageRequest;
console.log(renderCard(request));
