// SYNTHETIC EXAMPLE CONSUMER. Written against maintenance API v1 only.
// Decides how a maintenance request is dispatched to vendors.
import { fetchWorkOrder, type Fetcher } from './workOrders.js';

export type Decision = 'immediate-dispatch' | 'standard-queue' | 'manual-review';

export interface DispatchRequest {
  id: string;
  priority: 'urgent' | 'normal' | 'low';
  work_order_id: string;
}

export async function decide(request: DispatchRequest, baseUrl: string, fetcher?: Fetcher): Promise<Decision> {
  const workOrder = await fetchWorkOrder(baseUrl, request.work_order_id, fetcher);
  if (workOrder.status === 'on_hold') return 'manual-review';
  if (request.priority === 'urgent') return 'immediate-dispatch';
  return 'standard-queue';
}
