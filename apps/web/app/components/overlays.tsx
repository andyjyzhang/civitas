'use client';

// Drawer (side panel for a full report or diff) and the "⋯ Details" menu that keeps IDs, topics
// and other machinery out of normal view.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { Button } from './ui';

export function Drawer({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', key); panel.current?.focus();
    return () => document.removeEventListener('keydown', key);
  }, []);
  return <>
    <div className="drawer-backdrop" onMouseDown={onClose} aria-hidden="true"/>
    <section className="drawer" role="dialog" aria-modal="true" aria-label={title} ref={panel} tabIndex={-1}>
      <header><h2>{title}</h2><div className="page-actions">{actions}<Button variant="ghost" size="sm" iconOnly aria-label="Close" icon={<X/>} onClick={onClose}/></div></header>
      <div className="drawer-body">{children}</div>
    </section>
  </>;
}

/** "⋯" button opening a small panel of technical details (IDs, topics, storage…). */
export function DetailsMenu({ children, label = 'Details' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className="menu-anchor" ref={root}>
    <Button variant="ghost" size="sm" iconOnly aria-label={label} aria-haspopup="dialog" aria-expanded={open} icon={<MoreHorizontal/>} onClick={() => setOpen(o => !o)}/>
    {open && <div className="menu details-menu" role="dialog" aria-label={label}><div className="menu-label">{label}</div>{children}</div>}
  </div>;
}

/** Rows for a DetailsMenu: label → value (value is usually a <CopyId>). */
export function DetailRows({ rows }: { rows: [string, ReactNode][] }) {
  return <dl>{rows.filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}
