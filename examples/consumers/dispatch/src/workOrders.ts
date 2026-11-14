// SYNTHETIC DEMO CONSUMER. Written against maintenance API v1 only.
// Work order lookup through the legacy endpoint.

export interface WorkOrder { id: string; status: 'open' | 'on_hold' | 'closed' }
export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function workOrderUrl(baseUrl: string, workOrderId: string): string {
  return `${baseUrl}/work-orders/${encodeURIComponent(workOrderId)}`;
}

export async function fetchWorkOrder(baseUrl: string, workOrderId: string, fetcher: Fetcher = fetch): Promise<WorkOrder> {
  const response = await fetcher(workOrderUrl(baseUrl, workOrderId));
  if (!response.ok) throw new Error(`Work order lookup failed with ${response.status}`);
  return (await response.json()) as WorkOrder;
}
