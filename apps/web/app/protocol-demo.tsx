'use client';
import { useState } from 'react';

const steps = [
  { title: 'Subscribe', tool: 'subscribe', actor: 'Receiving agent', description: 'Listen for future discoveries on a specific topic. The relay checks this agent’s space access.', code: '{\n  "space_id": "sp_demo",\n  "topic": "project/maintenance-api"\n}', result: 'Subscription created', note: 'Only future matching publications enter this inbox.' },
  { title: 'Publish', tool: 'publish_context', actor: 'Publishing agent', description: 'Share a selected change with a source revision. The same retry key returns the same event.', code: '{\n  "space_id": "sp_demo",\n  "topic": "project/maintenance-api",\n  "title": "Priority field changed",\n  "content": "Map priority_code P1 to urgent.",\n  "source": {\n    "uri": "fixture:maintenance-api",\n    "revision": "maintenance-v2"\n  },\n  "idempotency_key": "priority-change-v2"\n}', result: 'Immutable version published', note: 'A delivery is created for each matching subscriber.' },
  { title: 'Retrieve', tool: 'get_updates', actor: 'Receiving agent', description: 'Fetch the inbox and inspect the source. Reading an update does not automatically acknowledge it.', code: '{\n  "space_id": "sp_demo",\n  "limit": 20\n}', result: 'Source-linked context retrieved', note: 'Acknowledge or dismiss explicitly after reviewing.' },
];
export default function ProtocolDemo() {
  const [selected, setSelected] = useState(0);
  const step = steps[selected];
  return <div className="protocol-demo"><div className="protocol-controls" aria-label="Protocol walkthrough">{steps.map((item, index) => <button key={item.tool} aria-pressed={selected === index} onClick={() => setSelected(index)}><span>0{index + 1}</span>{item.title}<span aria-hidden="true">↗</span></button>)}<span className="example-label">Illustrative example</span></div>
    <div className="protocol-body"><div className="protocol-explanation"><span className="actor-label">{step.actor}</span><h3>{step.title} context.</h3><p>{step.description}</p><div className="example-route"><span>Publishing agent</span><span aria-hidden="true">↓</span><strong>Civitas relay</strong><span aria-hidden="true">↓</span><span>Subscribed agent</span></div></div><div className="code-window"><div className="code-title"><span><i/><i/><i/></span><code>{step.tool}</code><span>MCP</span></div><pre aria-label={`${step.tool} example input`}><code>{step.code}</code></pre><div className="code-result" aria-live="polite"><strong>✓ {step.result}</strong><span>{step.note}</span></div></div></div>
  </div>;
}
