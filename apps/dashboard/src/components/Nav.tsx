'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [{ href: '/', label: 'Overview' }, { href: '/history', label: 'History' }, { href: '/settings', label: 'Settings' }];

export function Nav() {
  const path = usePathname();
  return <nav aria-label="Main navigation" className="nav">{links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? 'page' : undefined} className={path === link.href ? 'active' : undefined}>{link.label}</Link>)}</nav>;
}
