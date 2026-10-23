import type { Metadata } from 'next';
import Link from 'next/link';
import 'lenis/dist/lenis.css';
import './globals.css';
import { Motion } from '@/components/Motion';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: { default: 'CliffWatch', template: '%s · CliffWatch' },
  description: 'Know your AI limits before you hit them.',
  icons: { icon: '/brand/cliffwatch-mark.png', apple: '/brand/cliffwatch-mark.png' },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <Motion />
    <div className="ambient ambient-one" aria-hidden="true" />
    <div className="ambient ambient-two" aria-hidden="true" />
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="CliffWatch overview">
          <span className="brand-icon"><img src="/brand/cliffwatch-mark.png" alt="" /></span>
          <span className="brand-copy"><strong>Cliff<span>Watch</span></strong><small>AI LIMIT INTELLIGENCE</small></span>
        </Link>
        <Nav />
        <div className="sidebar-card">
          <div className="sidebar-card-icon" aria-hidden="true">⌁</div>
          <div><strong>Local by design</strong><p>Usage data stays on this device.</p></div>
        </div>
        <div className="sidebar-foot"><span className="pulse-dot" /> Engine ready <b>v0.1</b></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div><span className="topbar-label">MONITORING WORKSPACE</span><strong>Personal AI limits</strong></div>
          <div className="topbar-actions"><span className="privacy-chip"><i /> Private session</span><span className="local-chip">127.0.0.1</span></div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">CliffWatch <span>·</span> Know your AI limits before you hit them.</footer>
      </div>
    </div>
  </body></html>;
}
