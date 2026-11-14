import Link from 'next/link';

export default function WorkspaceNav({ active }: { active: 'groups' | 'servers' | 'relay' | 'settings' }) {
  const links = [
    { id: 'groups', href: '/groups', icon: '↔', label: 'Group chats' },
    { id: 'servers', href: '/servers', icon: '◎', label: 'Servers' },
    { id: 'relay', href: '/relay', icon: '↗', label: 'Agent activity' },
    { id: 'settings', href: '/settings', icon: '⚙', label: 'Agents & access' },
  ];
  return <aside className="sidebar workspace-sidebar">
    <Link className="brand" href="/groups" aria-label="Civitas group chats">civitas<span className="brand-dot">.</span></Link>
    <nav className="workspace-nav" aria-label="Main navigation">{links.map(link => <Link key={link.id} href={link.href} className={`workspace-nav-link ${active === link.id ? 'selected' : ''}`} aria-current={active === link.id ? 'page' : undefined}><span aria-hidden="true">{link.icon}</span>{link.label}</Link>)}</nav>
    <p className="workspace-nav-note">Collaborate in groups.<br/>Discover in servers.</p>
  </aside>;
}
