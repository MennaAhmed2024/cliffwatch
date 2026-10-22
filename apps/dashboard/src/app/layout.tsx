import type { Metadata } from 'next';
import Link from 'next/link';
import 'lenis/dist/lenis.css';
import './globals.css';
import { Motion } from '@/components/Motion';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = { title: 'QuotaDog — local quota dashboard', description: 'Local-first quota status, pacing, and alerts.' };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Motion /><header className="site-header"><div className="header-inner"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">Q</span><span>QuotaDog</span><span className="brand-tag">LOCAL</span></Link><Nav /><div className="header-state"><span className="header-state-dot" /> Private by design</div></div></header><main className="container">{children}</main><footer className="site-footer"><div className="container">QuotaDog <span>·</span> Data stays on this device.</div></footer></body></html>;
}
