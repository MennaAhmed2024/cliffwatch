'use client';

import { useEffect, useState } from 'react';
import type { Overview } from '@/lib/dashboard';
import { MetricCard } from './MetricCard';
import { GettingStarted } from './GettingStarted';

const date = (value?: string) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Waiting for first probe';

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
  const needsSetup = !data.lastProbeAt && data.cards.every(card => card.state === 'unknown');
  const statusTitle = data.globalState === 'unknown' ? 'Waiting for trusted data' : data.globalState === 'critical' ? 'You are near the cliff' : data.globalState === 'warn' ? 'Runway is getting short' : 'Your runway looks healthy';
  return <>
    <section className={`status-hero status-hero--${data.globalState}`} data-entrance>
      <div className="status-grid" aria-hidden="true" />
      <div className="status-copy"><span className={`hero-state hero-state--${data.globalState}`}><i /> {data.globalState === 'unknown' ? 'SIGNAL PENDING' : `${data.globalState.toUpperCase()} STATUS`}</span><h2>{statusTitle}</h2><p>{data.error ?? 'Live readings from the local CliffWatch engine. No cloud account required.'}</p></div>
      <div className="status-telemetry">
        <div><span>LAST PROBE</span><strong>{date(data.lastProbeAt)}</strong></div>
        <div><span>MONITORED WINDOWS</span><strong className="numeric">{data.cards.length.toString().padStart(2, '0')}</strong></div>
        <div><span>ALERT LINES</span><strong className="numeric">{data.thresholds.length ? data.thresholds.map(value => `${value}%`).join(' · ') : '—'}</strong></div>
      </div>
    </section>
    <div className="section-heading" data-entrance><div><span className="section-index">01</span><div><h2>Quota runway</h2><p>Provider truth, pace, and estimated time left.</p></div></div><span className="refresh-label"><i /> Auto-refresh · 30s</span></div>
    {data.cards.length ? <div className="cards">{data.cards.map(card => <MetricCard key={card.key} card={card} />)}</div> : <div className="empty">No providers enabled or local configuration unavailable.</div>}
    {needsSetup ? <GettingStarted /> : null}
    <p className="footnote">Pacing appears after at least 80% observed coverage. Missing or stale evidence stays <strong>UNKNOWN</strong>—CliffWatch never invents a safe reading.</p>
  </>;
}
