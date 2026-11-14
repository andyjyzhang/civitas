'use client';
import WorkspaceNav from '../components/workspace-nav';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Space = { spaceId: string; name: string; role: 'owner' | 'member'; kind: 'group' | 'server' };
type Overview = {
  account: { accountId: string; email: string; name: string };
  spaces: Space[]; agents: { agentId: string; name: string }[];
  grants: { spaceId: string; agentId: string; read: boolean; publish: boolean }[];
};
type Credential = { agentId: string; name: string; token: string; relayUrl: string };
async function operation(operation: string, input?: unknown) {
  const response = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, input }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Account request failed.');
  return data;
}
export default function Settings() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [invite, setInvite] = useState('');
  const [credential, setCredential] = useState<Credential | null>(null);
  const currentSpace = overview?.spaces.find(space => space.spaceId === spaceId);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/account', { cache: 'no-store' });
    const data = await response.json();
    if (response.status === 401) { setOverview(null); window.location.replace('/'); return; }
    if (!response.ok) throw new Error(data.error);
    setOverview(data); setSpaceId(previous => data.spaces.some((space: Space) => space.spaceId === previous) ? previous : data.spaces[0]?.spaceId || '');
  }, []);
  useEffect(() => { void refresh().catch(error => setMessage(error.message)).finally(() => setLoading(false)); }, [refresh]);
  async function submit(event: FormEvent<HTMLFormElement>, action: (fields: FormData) => Promise<void>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await action(new FormData(event.currentTarget)); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  async function connect() {
    if (!credential || !spaceId) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: credential.token, spaceId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign('/relay');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not connect.'); }
    finally { setBusy(false); }
  }
  function download() {
    if (!credential) return;
    const body = `CIVITAS_RELAY_URL=${JSON.stringify(credential.relayUrl)}\nCIVITAS_AGENT_TOKEN=${JSON.stringify(credential.token)}\nCIVITAS_DEMO_SPACE_ID=${JSON.stringify(spaceId)}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = `${credential.agentId}.env`; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="shell"><WorkspaceNav active="settings"/><main className="settings-main"><div className="settings-page">
    <header className="settings-header"><a className="brand" href="/">civitas<span className="brand-dot">.</span></a><a className="text-button" href="/relay">Back to relay</a></header>
    <div className="settings-heading"><h1>Agents & access.</h1><p>Invite collaborators and choose what each agent can read and publish.</p></div>
    {message && <div className="alert" role="status">{message}</div>}
    {loading ? <p>Loading your account…</p> : !overview ? <p>Returning to login…</p> : <>
      <div className="settings-account"><span>{overview.account.name} · {overview.account.email}</span><button className="text-button" disabled={busy} onClick={async () => { setBusy(true); try { await operation('logout'); setCredential(null); setOverview(null); window.location.replace('/'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not sign out.'); } finally { setBusy(false); } }}>Sign out</button></div>
      <div className="settings-grid">
        <section className="card settings-section"><h2>Your groups and servers</h2>{overview.spaces.length ? <label>Project or server<select value={spaceId} onChange={event => { setSpaceId(event.target.value); setInvite(''); }}>{overview.spaces.map(space => <option value={space.spaceId} key={space.spaceId}>{space.name} ({space.kind === 'server' ? 'server' : 'group'} · {space.role})</option>)}</select></label> : <p>Create a space or accept an invitation to get started.</p>}
          {currentSpace && <p className="source-id">{currentSpace.spaceId} · <a href={`${currentSpace.kind === 'server' ? '/servers' : '/groups'}?space=${encodeURIComponent(currentSpace.spaceId)}`}>Open {currentSpace.kind === 'server' ? 'server' : 'group chat'} ↗</a></p>}
          <form onSubmit={event => submit(event, async fields => { const space = await operation('createSpace', { name: fields.get('name') }); setSpaceId(space.spaceId); setMessage('Space created. Link an agent and grant access below.'); })}><label>New private group name<input name="name" required maxLength={100} placeholder="Maintenance API team"/></label><button className="secondary" disabled={busy}>Create group</button></form>
          <form onSubmit={event => submit(event, async fields => { const accepted = await operation('acceptInvite', { token: fields.get('token') }); setSpaceId(accepted.spaceId); setMessage('Invitation accepted. Your agents can now be granted access by the space owner.'); })}><label>Invitation token<input name="token" type="password" required autoComplete="off"/></label><button className="secondary" disabled={busy}>Accept invitation</button></form>
          {currentSpace?.role === 'owner' && <form onSubmit={event => submit(event, async fields => { const result = await operation('invite', { spaceId, email: fields.get('email') }); setInvite(result.token); })}><label>Invite a collaborator by email<input name="email" type="email" required/></label><button className="secondary" disabled={busy}>Create invitation</button></form>}
          {invite && <div className="credential-box"><strong>Share this invitation privately</strong><p>The invited email must match the accepting account. No email is sent.</p><code>{invite}</code><button className="text-button" onClick={() => setInvite('')}>Hide invitation</button></div>}
        </section>
        <section className="card settings-section"><h2>Your agents</h2><p>Each linked agent has a separate credential. Register a new agent for each independent participant.</p>
          {overview.agents.map(agent => <div className="managed-agent" key={agent.agentId}><strong>{agent.name}</strong><code>{agent.agentId}</code><small>{(() => { const grant = overview.grants.find(item => item.spaceId === spaceId && item.agentId === agent.agentId); return grant ? `${grant.read ? 'Can read' : 'Cannot read'} · ${grant.publish ? 'Can publish' : 'Cannot publish'}` : 'No access to selected space'; })()}</small></div>)}
          <form onSubmit={event => submit(event, async fields => { setCredential(await operation('createAgent', { name: fields.get('name') })); setMessage('Agent linked. Save its private env file, then grant space access.'); })}><label>New agent name<input name="name" required maxLength={100} placeholder="Frontend agent"/></label><button className="secondary" disabled={busy}>Link agent</button></form>
          {credential && <div className="credential-box"><strong>{credential.name} linked</strong><code>{credential.agentId}</code><p>Save this credential now. It is shown only once. Keep the downloaded env file private.</p><label>Agent credential<input type="password" value={credential.token} readOnly autoComplete="off"/></label><div className="button-row"><button className="secondary" disabled={!spaceId} onClick={download}>Save private env</button><button className="primary" disabled={busy || !spaceId} onClick={connect}>Open relay as agent</button><button className="text-button" onClick={() => setCredential(null)}>Hide credential</button></div></div>}
        </section>
        {currentSpace?.role === 'owner' && <section className="card settings-section"><h2>Agent access</h2><p>Grant access to one of your agents, or paste an agent ID from a member of this space. Turning both permissions off revokes access.</p>
          <form key={credential?.agentId || spaceId} onSubmit={event => submit(event, async fields => { await operation('setGrant', { spaceId, agentId: fields.get('agentId'), read: fields.has('read'), publish: fields.has('publish') }); setMessage('Agent access saved.'); })}><label>Agent ID<input name="agentId" list="owned-agents" required defaultValue={credential?.agentId || ''}/><datalist id="owned-agents">{overview.agents.map(agent => <option value={agent.agentId} key={agent.agentId}>{agent.name}</option>)}</datalist></label><label className="check-label"><input name="read" type="checkbox" defaultChecked/> Read context and subscribe</label><label className="check-label"><input name="publish" type="checkbox" defaultChecked/> Publish context</label><button className="primary" disabled={busy}>Save access</button></form>
          {overview.grants.filter(grant => grant.spaceId === spaceId).map(grant => <p className="source-id" key={grant.agentId}>{grant.agentId}: read {String(grant.read)}, publish {String(grant.publish)}</p>)}
        </section>}
        <section className="card settings-section"><h2>Connect a coding agent</h2><p>Save the agent env file outside your repository, then print an additive MCP setup command:</p><pre>node packages/cli/dist/index.js configure claude /absolute/path/agent.env</pre><p>Use <code>codex</code> or <code>json</code> in place of <code>claude</code> for another client. This helper prints configuration without editing existing entries. Choose a different server name if Civitas is already configured. Subscribe to a topic before publishing an update.</p><p>To reconnect the dashboard with an existing agent key, use the agent-key form on the <a href="/relay">relay overview</a> and enter the selected space ID.</p></section>
      </div>
    </>}
  </div></main></div>;
}
