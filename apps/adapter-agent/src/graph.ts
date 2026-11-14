// LangGraph agent server entry (langgraph.json graph "adapter"). A graph factory: the server
// calls it with each run's config, so every run builds its own agent from
// `configurable: { spaceId, role, runId }`. The server supplies the checkpointer.
import { resolve } from 'node:path';
import { buildAdapterAgent, createGuardedModel, inertModel } from './agent.js';
import { ROOT, callCivitas, checkRunId, checkSpaceId, findConsumer, laneSpend, loadConsumers, loadWorkspaceCredentials } from './workspace.js';

type FactoryConfig = { configurable?: Record<string, unknown> };
type FactoryRuntime = { accessContext?: string };

const laneLimit = () => Number(process.env.CIVITAS_ADAPTER_LANE_LIMIT_USD || 3);
const runDirFor = (spaceId: string, runId: string) => resolve(ROOT, '.local/workspace-runs', spaceId, runId);

export async function graph(config: FactoryConfig, runtime?: FactoryRuntime) {
  const configurable = config?.configurable ?? {};
  // Only an actual run gets a priced model and credentials. Other contexts (schema and
  // state reads) only need the graph's shape and never invoke the model or tools.
  const forRun = runtime?.accessContext === undefined || runtime.accessContext === 'threads.create_run';
  if (!forRun) {
    let scope;
    try { scope = { spaceId: checkSpaceId(configurable.spaceId), runId: checkRunId(configurable.runId), consumer: findConsumer(configurable.role) }; }
    catch { scope = { spaceId: 'sp_inert', runId: 'inert', consumer: loadConsumers()[0] }; }
    return buildAdapterAgent({
      consumer: scope.consumer, runId: scope.runId, runDir: runDirFor(scope.spaceId, scope.runId), model: inertModel(),
      civitas: async () => { throw new Error('Inert graph: no Civitas calls outside a run.'); },
    });
  }
  // Validate everything before touching the filesystem or spending.
  const spaceId = checkSpaceId(configurable.spaceId);
  const runId = checkRunId(configurable.runId);
  const consumer = findConsumer(configurable.role);
  const creds = loadWorkspaceCredentials(spaceId, consumer.role);
  const spent = laneSpend();
  if (spent >= laneLimit()) throw new Error(`adapter-agent lane spend $${spent.toFixed(3)} reached its $${laneLimit()} cap; no model call made.`);
  const { model } = createGuardedModel(`${consumer.role}:${runId}`);
  return buildAdapterAgent({
    consumer, runId, runDir: runDirFor(spaceId, runId), model,
    civitas: (name, args) => callCivitas(creds, name, args),
  });
}
