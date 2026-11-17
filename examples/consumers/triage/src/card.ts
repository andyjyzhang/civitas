// SYNTHETIC EXAMPLE CONSUMER. Written against maintenance API v1 only.
// Renders the triage card property managers see for a maintenance request.

export interface TriageRequest {
  id: string;
  unit: string;
  summary: string;
  priority: 'urgent' | 'normal' | 'low';
}

const escape = (value: string) => value.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

function label(request: TriageRequest): { text: string; color: string } {
  if (request.priority === 'urgent') return { text: 'Urgent maintenance', color: '#b42318' };
  if (request.priority === 'normal') return { text: 'Routine maintenance', color: '#175cd3' };
  return { text: 'Low priority', color: '#667085' };
}

export function renderCard(request: TriageRequest): string {
  const { text, color } = label(request);
  return `<article class="triage-card" style="border-left:6px solid ${color};padding:12px;margin:12px;font-family:sans-serif">
  <strong style="color:${color}">${escape(text)}</strong>
  <h3>${escape(request.summary)}</h3>
  <p>Unit ${escape(request.unit)} &middot; request ${escape(request.id)}</p>
</article>`;
}
