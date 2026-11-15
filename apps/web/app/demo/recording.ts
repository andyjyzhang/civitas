import type { RunDetail, SubagentTrace } from '../../lib/agents';
export type Frame = { at: number; run: RunDetail; subagents?: Record<string, SubagentTrace> };
export type Recording = {
  version: 1; kind: 'recorded' | 'illustrative'; title: string; recordedAt: string | null;
  model: string | null; costUsd: number | null; durationMs: number | null;
  approvalMode: 'interactive' | 'automated' | 'unknown'; langsmithUrl: string | null; frames: Frame[];
};
export const stages = [0, 5, 25, 35, 70, 85, 90];
export const stageNames = ['Setup', 'Analyze', 'Review', 'Rollout', 'Result', 'Wrap'];
export function stageAt(t: number) { const i = stages.findIndex((s, i) => t >= s && t < stages[i + 1]); return i < 0 ? 5 : i; }
export const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export function parseRecording(value: unknown): Recording {
  const r = value as Recording;
  if (!r || r.version !== 1 || !['recorded', 'illustrative'].includes(r.kind) || !Array.isArray(r.frames) || r.frames.length > 2000
    || !['interactive', 'automated', 'unknown'].includes(r.approvalMode) || typeof r.title !== 'string'
    || (r.recordedAt !== null && (typeof r.recordedAt !== 'string' || !Number.isFinite(Date.parse(r.recordedAt))))
    || (r.model !== null && typeof r.model !== 'string') || (r.costUsd !== null && (typeof r.costUsd !== 'number' || !Number.isFinite(r.costUsd) || r.costUsd < 0))
    || (r.durationMs !== null && (typeof r.durationMs !== 'number' || !Number.isFinite(r.durationMs) || r.durationMs < 0))) throw new Error('Unsupported recording. Export a v1 recording from the live demo.');
  const validTimeline = (items: unknown): boolean => Array.isArray(items) && items.every(s => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.detail === 'string' && ['tool', 'task', 'say'].includes(s.kind) && ['running', 'done', 'error'].includes(s.status) && (s.name === undefined || typeof s.name === 'string') && (s.subagent === undefined || typeof s.subagent === 'string') && (s.result === undefined || typeof s.result === 'string'));
  let previous = -1;
  for (const frame of r.frames) {
    const run = frame?.run;
    if (!Number.isFinite(frame?.at) || frame.at < previous || !run || typeof run.threadId !== 'string'
      || typeof run.createdAt !== 'string' || typeof run.updatedAt !== 'string' || (run.result !== undefined && typeof run.result !== 'string')
      || !['analyst', 'adapter'].includes(run.kind) || !['running', 'waiting', 'published', 'applied', 'rejected', 'failed', 'completed'].includes(run.status) || typeof run.title !== 'string' || !Array.isArray(run.todos) || !validTimeline(run.timeline)
      || !run.files || typeof run.files !== 'object' || !Object.values(run.files).every(f => typeof f === 'string')
      || !run.todos.every(t => typeof t.content === 'string' && typeof t.status === 'string')) throw new Error('Invalid run snapshot in recording.');
    if (run.approval) {
      const actions = run.approval.actions;
      if (!Array.isArray(actions) || !actions.every(a => {
        if (!a || typeof a.name !== 'string' || !a.args || typeof a.args !== 'object') return false;
        if (a.args.content !== undefined && typeof a.args.content !== 'string') return false;
        return a.args.tags === undefined || (Array.isArray(a.args.tags) && a.args.tags.every((t: unknown) => typeof t === 'string'));
      })) throw new Error('Invalid approval request.');
    }
    if (frame.subagents && (typeof frame.subagents !== 'object' || !Object.values(frame.subagents).every(sub => sub && (sub.subagent === undefined || typeof sub.subagent === 'string') && validTimeline(sub.timeline)))) throw new Error('Invalid specialist trace.');
    previous = frame.at;
  }
  if (r.kind === 'recorded' && (!r.frames.length || !r.recordedAt)) throw new Error('A real recording needs timestamped run snapshots.');
  if (r.langsmithUrl) {
    try { const u = new URL(r.langsmithUrl); if (u.protocol !== 'https:' || u.hostname !== 'smith.langchain.com' || u.username || u.password) r.langsmithUrl = null; }
    catch { r.langsmithUrl = null; }
  }
  return r;
}
export function downloadRecording(recording: Recording) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(recording, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'civitas-recording.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Capture selected evidence and diffs, excluding the consumer's entire /work tree. */
export function selectedRun(run: RunDetail): RunDetail {
  return { ...run, files: Object.fromEntries(Object.entries(run.files).filter(([name]) => /^\/(evidence|patches|notes)\//.test(name))) };
}
