/** Synthetic maintenance SDK adaptation, grounded in maintenance-v1/v2 fixtures. */
export type MaintenanceRequest = {
  id: string;
  priority: 'urgent' | 'unknown';
  rawPriority: string | null;
  sourceRevision: 'maintenance-v1' | 'maintenance-v2';
};

export function decodeMaintenanceRequest(value: unknown, sourceRevision: MaintenanceRequest['sourceRevision']): MaintenanceRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Maintenance response must be an object.');
  const body = value as Record<string, unknown>;
  if (typeof body.id !== 'string' || !body.id || body.id.length > 256) throw new Error('Maintenance response needs a bounded request ID.');
  // The reviewed fixture establishes P1 only. Unknown codes never become normal priority.
  const raw = sourceRevision === 'maintenance-v2' ? body.priority_code : body.priority;
  if (typeof raw !== 'string' || raw.length > 100) throw new Error('Maintenance response lacks the priority field for this source revision.');
  return {
    id: body.id,
    priority: (sourceRevision === 'maintenance-v2' ? raw === 'P1' : raw === 'urgent') ? 'urgent' : 'unknown',
    rawPriority: raw,
    sourceRevision,
  };
}
