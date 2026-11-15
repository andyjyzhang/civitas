// Shared UI primitives. Server-safe (no hooks) except CopyId (copy-id.tsx) and the
// Drawer / DetailsMenu client components in overlays.tsx (import those directly).
// Spec and token rules: the comment block at the top of app/globals.css.
import Link from 'next/link';
import { Bot, Info } from 'lucide-react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export { default as CopyId } from './copy-id';
export { shortId } from './short-id';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';
type ButtonOwnProps = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; iconRight?: ReactNode; iconOnly?: boolean };
export type ButtonProps = ButtonOwnProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
export type LinkButtonProps = ButtonOwnProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Button. Pass `href` to render a link styled as a button. `iconOnly` needs an aria-label. */
export function Button(props: ButtonProps | LinkButtonProps) {
  const { variant = 'secondary', size = 'md', icon, iconRight, iconOnly, className, children, ...rest } = props;
  const classes = cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', iconOnly && 'btn-icon', className);
  const body = <>{icon}{children}{iconRight}</>;
  if (typeof rest.href === 'string') {
    const { href, ...anchor } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
    return <Link href={href} className={classes} {...anchor}>{body}</Link>;
  }
  const button = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return <button type={button.type ?? 'button'} className={classes} {...button}>{body}</button>;
}

export type Tone = 'neutral' | 'accent' | 'working' | 'waiting' | 'done' | 'failed' | 'idle';
/** Small label. `mono` for versions / IDs (only inside Details). */
export function Badge({ tone = 'neutral', mono, icon, className, children, ...rest }: { tone?: Tone; mono?: boolean; icon?: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('badge', tone !== 'neutral' && `badge-${tone}`, mono && 'badge-mono', className)} {...rest}>{icon}{children}</span>;
}

export type Status = 'working' | 'waiting' | 'done' | 'failed' | 'idle';
export const STATUS_LABELS: Record<Status, string> = { working: 'Working', waiting: 'Waiting for you', done: 'Done', failed: 'Failed', idle: 'Idle' };
/** Dot + text status. Colour is never the only signal. */
export function StatusPill({ status, label, className }: { status: Status; label?: string; className?: string }) {
  return <span className={cx('status-pill', `pill-${status}`, className)}><span className="dot" aria-hidden="true"/>{label ?? STATUS_LABELS[status]}</span>;
}

/** The one card style. Optional header (title / description / actions); `padded` pads the body. */
export function Card({ title, description, actions, padded = true, className, children, ...rest }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; padded?: boolean } & Omit<HTMLAttributes<HTMLElement>, 'title'>) {
  return <section className={cx('card', className)} {...rest}>
    {(title || actions) && <header className="card-header"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>}
    {padded ? <div className="card-body">{children}</div> : children}
  </section>;
}

/** Page title with at most one line of description, plus an actions slot (one primary max). */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

/** Wraps page content with standard max-width and padding. `wide` allows a wider layout. */
export function Page({ wide, className, children }: { wide?: boolean; className?: string; children: ReactNode }) {
  return <div className={cx('page', wide && 'page-wide', className)}>{children}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state">{icon && <span className="empty-state-icon" aria-hidden="true">{icon}</span>}<h2>{title}</h2>{description && <p>{description}</p>}{action && <div className="empty-state-action">{action}</div>}</div>;
}

/** Marks agent-authored content (teal). */
export function AgentBadge({ label = 'Agent' }: { label?: string }) {
  return <span className="agent-badge"><Bot aria-hidden="true"/>{label}</span>;
}

/** Agent identity: bot glyph inside the lime→teal brand ring. People use <Avatar>. */
export function AgentAvatar({ small, label }: { small?: boolean; label?: string }) {
  return <span className={cx('agent-avatar', small && 'small')} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}><span><Bot aria-hidden="true"/></span></span>;
}

/** Info icon with a native tooltip (title attr). Use sparingly. */
export function InfoTip({ text }: { text: string }) {
  return <span className="info-tip" title={text} aria-label={text} role="img"><Info aria-hidden="true"/></span>;
}

/** A person's initial. Pass `agent` to get the agent ring instead. */
export function Avatar({ name, small, agent }: { name: string; small?: boolean; agent?: boolean }) {
  if (agent) return <AgentAvatar small={small}/>;
  return <span className={cx('avatar', small && 'small')} aria-hidden="true">{name.trim()[0]?.toUpperCase() || '?'}</span>;
}
