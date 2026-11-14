import type { MaintenanceRequest } from './sdk.js';

export function triageItem(request: MaintenanceRequest) {
  return {
    requestId: request.id,
    label: request.priority === 'urgent' ? 'Urgent maintenance' : 'Priority needs review',
    tone: request.priority === 'urgent' ? 'urgent' as const : 'review' as const,
    nextAction: request.priority === 'urgent' ? 'Dispatch immediately' : 'Review source priority',
    sourceRevision: request.sourceRevision,
  };
}

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export function renderTriage(request: MaintenanceRequest) {
  const item = triageItem(request);
  return `<article class="request ${item.tone}"><div class="signal" aria-hidden="true"></div><div><span class="priority">${escapeHtml(item.label)}</span><h2>Maintenance request ${escapeHtml(item.requestId)}</h2><p>${escapeHtml(item.nextAction)}</p><dl><dt>Received priority</dt><dd>${escapeHtml(request.rawPriority ?? 'Missing')}</dd><dt>Source revision</dt><dd>${escapeHtml(item.sourceRevision)}</dd></dl></div></article>`;
}
