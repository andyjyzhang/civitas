'use client';

// Client helpers shared by Activity, Agents and Inbox. Everything these pages show that came from a
// model or a remote agent is rendered as plain text (React escapes it) — never as HTML.
import { useCallback, useEffect, useState } from 'react';
import type { AccountOverview } from '@civitas/contracts';
import type { RoleStatus, RunStatus, RunSummary } from '../../lib/agents';
import type { Status } from '../components/ui';

/** GET /api/agents?space= */
export type AgentsOverview = {
  space: AccountOverview['spaces'][number]; accountId: string;
  sources: { id: string; label: string; topic: string }[];
  consumers: { role: string; label: string; topic: string }[];
  workspace: RoleStatus[]; agentServer: { url: string; up: boolean; message: string };
  runs: RunSummary[]; runsError: string;
};
export const shortLabel = (label: string) => label.replace(/\s*\(.*\)\s*$/, '').trim() || label;

/** Polls the group's agent overview: every 3s while a run is active or waiting, else every 10s. */
export function useAgentsOverview(spaceId: string) {
  const [overview, setOverview] = useState<AgentsOverview | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!spaceId) return;
    try { setOverview(await call<AgentsOverview>('/api/agents?space=' + encodeURIComponent(spaceId))); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load agents.'); }
  }, [spaceId]);
  useEffect(() => { void load(); }, [load]);
  const active = overview?.runs.some(r => r.status === 'running' || r.status === 'waiting') ?? false;
  useEffect(() => { const t = setInterval(() => void load(), active ? 3000 : 10000); return () => clearInterval(t); }, [load, active]);
  return { overview, error, load };
}

/** Owner-only actions (enforced server-side too). */
export const agentActions = {
  decide: (threadId: string, decision: 'approve' | 'reject', message = '') => call(`/api/agents/runs/${encodeURIComponent(threadId)}`, { method: 'POST', body: JSON.stringify({ decision, message }) }),
  startAdapter: (spaceId: string, role: string) => call<{ threadId: string }>('/api/agents/runs', { method: 'POST', body: JSON.stringify({ spaceId, kind: 'adapter', role }) }),
  startAnalyst: (spaceId: string, sourceId: string, goal: string) => call<{ threadId: string }>('/api/agents/runs', { method: 'POST', body: JSON.stringify({ spaceId, kind: 'analyst', sourceId, goal }) }),
  sample: (spaceId: string) => call<{ threadId: string; enabled: boolean }>('/api/agents/sample', { method: 'POST', body: JSON.stringify({ spaceId }) }),
};

export async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  if (response.status === 401) { window.location.assign('/'); throw new Error('Please sign in.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { data, status: response.status });
  return data as T;
}

/** Re-renders every `ms` so relative times stay fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function relTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '';
  const t = new Date(iso).getTime(); if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export const fullTime = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

export function duration(from?: string, to?: string) {
  if (!from || !to) return '';
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Spec status + label for a run. `owner` decides between "Waiting for you" and "Waiting for owner". */
export function runStatus(run: Pick<RunSummary, 'status' | 'stopped'>, owner: boolean): { status: Status; label: string } {
  const s: RunStatus = run.status;
  if (s === 'running') return { status: 'working', label: 'Working' };
  if (s === 'waiting') return { status: 'waiting', label: owner ? 'Needs your review' : 'Waiting for owner' };
  if (s === 'published') return { status: 'done', label: 'Shared' };
  if (s === 'applied') return { status: 'done', label: 'Updated' };
  if (s === 'completed') return { status: 'done', label: 'Done' };
  if (s === 'rejected') return { status: 'idle', label: 'Rejected' };
  if (run.stopped) return { status: 'idle', label: 'Stopped' };
  return { status: 'failed', label: 'Failed' };
}
