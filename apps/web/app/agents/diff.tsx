'use client';

// GitHub-style unified diff: one block per file with a header (+/- counts), hunk headers and
// old/new line numbers. Input is model-produced text; rendered as text only.
type Line = { kind: 'add' | 'del' | 'ctx' | 'hunk' | 'note'; text: string; old?: number; new?: number };
type FileDiff = { name: string; added: number; removed: number; lines: Line[] };

export function parseDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let file: FileDiff | null = null; let oldNo = 0; let newNo = 0;
  const start = (name: string) => { file = { name, added: 0, removed: 0, lines: [] }; files.push(file); };
  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git ')) { start(raw.replace(/^diff --git a\/(.*?) b\/.*$/, '$1')); continue; }
    if (raw.startsWith('--- ')) { if (!file) start(raw.slice(4).replace(/^a\//, '')); continue; }
    if (raw.startsWith('+++ ')) { const name = raw.slice(4).replace(/^b\//, ''); if (file && name !== '/dev/null') (file as FileDiff).name = name; continue; }
    if (/^(index |new file mode|deleted file mode|similarity |rename )/.test(raw)) continue;
    if (!file) start('patch');
    const f = file as unknown as FileDiff;
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) { oldNo = Number(hunk[1]); newNo = Number(hunk[2]); f.lines.push({ kind: 'hunk', text: raw }); continue; }
    if (raw.startsWith('+')) { f.added++; f.lines.push({ kind: 'add', text: raw.slice(1), new: newNo++ }); }
    else if (raw.startsWith('-')) { f.removed++; f.lines.push({ kind: 'del', text: raw.slice(1), old: oldNo++ }); }
    else if (raw.startsWith('\\')) f.lines.push({ kind: 'note', text: raw });
    else if (raw.length || f.lines.length) f.lines.push({ kind: 'ctx', text: raw.slice(1), old: oldNo++, new: newNo++ });
  }
  for (const f of files) while (f.lines.length && f.lines.at(-1)!.kind === 'ctx' && !f.lines.at(-1)!.text) f.lines.pop();
  return files;
}

export function DiffView({ text }: { text?: string }) {
  if (!text?.trim()) return <p className="subtle">No patch file.</p>;
  const files = parseDiff(text);
  return <div className="ag-diff">
    {files.map((f, i) => <section key={i} className="ag-diff-file">
      <header><span className="mono">{f.name}</span><span className="ag-diff-stat"><span className="add">+{f.added}</span><span className="del">−{f.removed}</span></span></header>
      <div className="ag-diff-body"><table><tbody>
        {f.lines.map((l, j) => l.kind === 'hunk' || l.kind === 'note'
          ? <tr key={j} className={`ag-diff-${l.kind}`}><td colSpan={3}>{l.text}</td></tr>
          : <tr key={j} className={`ag-diff-${l.kind}`}><td className="ln">{l.old ?? ''}</td><td className="ln">{l.new ?? ''}</td><td className="code"><span className="sign" aria-hidden="true">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}</span>{l.text}</td></tr>)}
      </tbody></table></div>
    </section>)}
  </div>;
}
