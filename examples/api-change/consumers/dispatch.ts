import type { MaintenanceRequest } from './sdk.js';

/** A local routing decision only. This never sends a notification or dispatches anyone. */
export function dispatchDecision(request: MaintenanceRequest) {
  return {
    requestId: request.id,
    queue: request.priority === 'urgent' ? 'immediate-dispatch' : 'manual-review',
    requiresHumanDispatch: true,
    reason: request.priority === 'urgent'
      ? `Urgent priority preserved from ${request.sourceRevision} (${request.rawPriority}).`
      : `No reviewed mapping exists for ${request.rawPriority}; request needs manual review.`,
    sourceRevision: request.sourceRevision,
  };
}
