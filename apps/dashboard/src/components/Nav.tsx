'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Overview', icon: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></> },
  { href: '/tools', label: 'Add AI Tool', icon: <><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/></> },
  { href: '/history', label: 'History', icon: <><path d="M4 18V6"/><path d="M4 18h16"/><path d="m7 14 4-4 3 2 5-6"/></> },
  { href: '/pricing', label: 'Pricing', icon: <><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></> },
  { href: '/settings', label: 'Settings', icon: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.07 14H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.07V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.93 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></> },
];

export function Nav() {
  const path = usePathname();
  return <nav aria-label="Main navigation" className="nav"><div className="nav-label">WORKSPACE</div>{links.map(link => {
    const active = path === link.href;
    return <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={active ? 'active' : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{link.icon}</svg><span>{link.label}</span>{active ? <i /> : null}
    </Link>;
  })}</nav>;
}
