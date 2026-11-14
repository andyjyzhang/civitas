// LangGraph agent server entry (langgraph.json graph "analyst"). A graph factory: the server
// calls it with each run's config, so every run builds its own agent from
// `configurable: { spaceId, sourceId, runId }`. The server supplies the checkpointer.
import { buildAnalystAgent, createGuardedModel, inertModel } from './analyst.js';
import { callCivitas } from './mcp.js';
import { checkRunId, checkSpaceId, findSource, loadAgentsConfig, loadWorkspaceCredentials } from './workspace.js';

type FactoryConfig = { configurable?: Record<string, unknown> };
type FactoryRuntime = { accessContext?: string };

export async function graph(config: FactoryConfig, runtime?: FactoryRuntime) {
  const configurable = config?.configurable ?? {};
  // Only an actual run gets a priced model and credentials. Other contexts (schema and
  // state reads) only need the graph's shape and never invoke the model or tools.
  const forRun = runtime?.accessContext === undefined || runtime.accessContext === 'threads.create_run';
  if (!forRun) {
    let scope;
    try { scope = { spaceId: checkSpaceId(configurable.spaceId), runId: checkRunId(configurable.runId), source: findSource(configurable.sourceId) }; }
    catch { scope = { spaceId: 'sp_inert', runId: 'inert', source: loadAgentsConfig().sources[0] }; }
    return buildAnalystAgent({ ...scope, model: inertModel(), publisher: async () => { throw new Error('Inert graph: no publishing outside a run.'); } });
  }
  // Validate everything before touching the filesystem or spending.
  const spaceId = checkSpaceId(configurable.spaceId);
  const runId = checkRunId(configurable.runId);
  const source = findSource(configurable.sourceId);
  const creds = loadWorkspaceCredentials(spaceId, 'analyst');
  const { model } = createGuardedModel(runId);
  return buildAnalystAgent({
    spaceId, runId, source, model,
    publisher: body => callCivitas(creds, 'publish_context', body),
  });
}
