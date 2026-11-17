// SYNTHETIC EXAMPLE CONSUMER. Written against maintenance API v1 only.
// Decodes maintenance request payloads for downstream services.

export type Priority = 'urgent' | 'normal' | 'low';

export interface MaintenanceRequest {
  id: string;
  unit: string;
  summary: string;
  priority: Priority;
  workOrderId: string;
  reportedAt: string;
}

const PRIORITIES: readonly Priority[] = ['urgent', 'normal', 'low'];

export function decodeRequest(json: string): MaintenanceRequest {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const priority = raw.priority as Priority;
  if (!PRIORITIES.includes(priority)) {
    throw new Error(`Invalid maintenance request: unknown priority ${JSON.stringify(raw.priority)}`);
  }
  return {
    id: String(raw.id),
    unit: String(raw.unit),
    summary: String(raw.summary),
    priority,
    workOrderId: String(raw.work_order_id),
    reportedAt: String(raw.reported_at),
  };
}
