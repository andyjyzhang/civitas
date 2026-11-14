// Hard local spend guard for real model runs. Every LLM call (including nested
// subagent calls) is priced from reported token usage and appended to a shared
// ledger. A run refuses to start, and aborts mid-run, once the total would pass
// CIVITAS_SPEND_LIMIT_USD (default $15 of a $20 provider budget) or the per-run cap
// CIVITAS_RUN_LIMIT_USD (default $1). Prices are conservative (cached input billed
// at full rate). This is a local estimate; set a hard limit in the provider console too.
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { LLMResult } from '@langchain/core/outputs';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICES: Record<string, [number, number]> = { // USD per 1M tokens: [input, output]
  'gpt-4.1': [2, 8], 'gpt-4.1-mini': [0.4, 1.6], 'gpt-4.1-nano': [0.1, 0.4],
  'gpt-5-mini': [0.25, 2], 'gpt-5-nano': [0.05, 0.4], 'gpt-5.4-mini': [0.75, 4.5], 'gpt-5.4-nano': [0.2, 1.25],
};
const root = fileURLToPath(new URL('../../../', import.meta.url));
export const ledgerPath = () => process.env.CIVITAS_SPEND_LEDGER || resolve(root, '.local/model-spend.jsonl');
const limit = () => Number(process.env.CIVITAS_SPEND_LIMIT_USD || 15);
const runLimit = () => Number(process.env.CIVITAS_RUN_LIMIT_USD || 1);

export function totalSpend() {
  try { return readFileSync(ledgerPath(), 'utf8').split('\n').filter(Boolean).reduce((sum, line) => sum + (JSON.parse(line).usd || 0), 0); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0; throw error; }
}

export function priceFor(model: string) {
  const price = PRICES[model];
  if (!price) throw new Error(`No price configured for model ${model}; add it to budget.ts before running.`);
  return price;
}

export class BudgetGuard extends BaseCallbackHandler {
  name = 'civitas-budget-guard';
  raiseError = true;
  runUsd = 0;
  constructor(private app: string, private runId: string, private model: string) {
    super();
    priceFor(model);
    const spent = totalSpend();
    if (spent >= limit()) throw new Error(`Spend limit reached: $${spent.toFixed(2)} of $${limit()} recorded in ${ledgerPath()}. No model call made.`);
  }
  async handleLLMEnd(output: LLMResult) {
    let input = 0, outputTokens = 0;
    for (const generation of output.generations.flat()) {
      const usage = (generation as { message?: { usage_metadata?: { input_tokens?: number; output_tokens?: number } } }).message?.usage_metadata;
      input += usage?.input_tokens ?? 0; outputTokens += usage?.output_tokens ?? 0;
    }
    const [inPrice, outPrice] = priceFor(this.model);
    const usd = (input * inPrice + outputTokens * outPrice) / 1e6;
    this.runUsd += usd;
    mkdirSync(dirname(ledgerPath()), { recursive: true, mode: 0o700 });
    appendFileSync(ledgerPath(), JSON.stringify({ at: new Date().toISOString(), app: this.app, runId: this.runId, model: this.model, input, output: outputTokens, usd }) + '\n', { mode: 0o600 });
    if (this.runUsd > runLimit()) throw new Error(`Run spend $${this.runUsd.toFixed(3)} passed per-run cap $${runLimit()}; aborting.`);
    if (totalSpend() > limit()) throw new Error(`Total spend passed $${limit()}; aborting.`);
  }
}
