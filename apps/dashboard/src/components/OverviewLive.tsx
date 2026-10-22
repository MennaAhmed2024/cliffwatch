'use client';

import { useEffect, useState } from 'react';
import type { Overview } from '@/lib/dashboard';
import { MetricCard } from './MetricCard';

const date = (value?: string) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';

export function OverviewLive({ initial }: { initial: Overview }) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try { const response = await fetch('/api/overview', { cache: 'no-store' }); if (!response.ok) throw new Error(); const next = await response.json() as Overview; if (active) setData(next); }
      catch { if (active) setData(current => ({ ...current, globalState: 'unknown', cards: current.cards.map(card => ({ ...card, state: 'unknown', reason: 'Dashboard refresh failed.' })), error: 'Dashboard refresh failed.' })); }
    };
    const timer = window.setInterval(poll, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return <><section className="summary" data-entrance><div><div className="eyebrow">SYSTEM STATUS</div><div className="summary-title"><span className={`status-dot status-dot--${data.globalState}`} />{data.globalState === 'unknown' ? 'Quota status unknown' : data.globalState === 'critical' ? 'Quota is critical' : data.globalState === 'warn' ? 'Approaching quota' : 'All monitored windows healthy'}</div><p>{data.error ?? 'Live data from your local QuotaDog daemon.'}</p></div><div className="summary-meta"><span>Last probe</span><strong className="numeric">{date(data.lastProbeAt)}</strong></div></section>
    <div className="section-heading"><h2>Connections</h2><span>{data.cards.length} windows · refreshes every 30s</span></div>
    {data.cards.length ? <div className="cards">{data.cards.map(card => <MetricCard key={card.key} card={card} />)}</div> : <div className="empty">No providers enabled or local configuration unavailable.</div>}
    <p className="footnote">Pacing needs at least 80% observed coverage over its time horizon. Missing history stays unknown.</p></>;
}
