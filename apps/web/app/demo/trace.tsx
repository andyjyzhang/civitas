'use client';
import { useEffect, useRef } from 'react';
import { Button } from '../components/ui';
import { DiffView } from '../agents/diff';
import { clock, downloadRecording, type Recording } from './recording';
export default function Trace({ recording, onClose }: { recording: Recording; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="demo-trace" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <header><div><h2>{recording.kind === 'recorded' ? 'The recorded run' : 'Illustrative walkthrough'}</h2><p>{recording.frames.length ? 'Captured snapshots, with original timestamps and outputs.' : 'No real run is bundled yet. Run live and export a recording to replace this walkthrough.'}</p></div><Button variant="ghost" onClick={onClose}>Close</Button></header>
    {recording.langsmithUrl ? <a className="btn btn-secondary" href={recording.langsmithUrl} target="_blank" rel="noreferrer">Open LangSmith trace</a> : <p className="subtle">No verified LangSmith link was captured.</p>}
    <Button variant="secondary" onClick={() => downloadRecording(recording)}>Download recording JSON</Button>
    <ol className="demo-trace-list">{recording.frames.map((frame, i) => <li key={i}>
      <details><summary>{clock(frame.at / 1000)} · {frame.run.title} · {frame.run.status}</summary>
        <p>Original timestamp: {frame.run.updatedAt}</p>
        <ul>{frame.run.todos.map((todo, j) => <li key={j}>{todo.status}: {todo.content}</li>)}</ul>
        <ol>{frame.run.timeline.map((step, j) => <li key={j}><strong>{step.name || step.kind} · {step.status}</strong><pre>{step.detail}</pre>{step.result && <pre>{step.result}</pre>}</li>)}</ol>
        {Object.entries(frame.subagents ?? {}).map(([ns, sub]) => <details key={ns}><summary>{sub.subagent || 'Specialist'}</summary><pre>{JSON.stringify(sub.timeline, null, 2)}</pre></details>)}
        {frame.run.approval && <><h3>Exact approval request</h3><pre>{JSON.stringify(frame.run.approval, null, 2)}</pre></>}
        {Object.entries(frame.run.files).map(([name, content]) => <details key={name}><summary>{name}</summary>{name.endsWith('.diff') ? <DiffView text={content}/> : <pre>{content}</pre>}</details>)}
        {frame.run.result && <pre>{frame.run.result}</pre>}
      </details>
    </li>)}</ol>
  </dialog>;
}
