import type { CSSProperties } from 'react';
import type { Card } from '@/lib/dashboard';
import SpotlightCard from './SpotlightCard';

const number = (value: number) => value.toFixed(1);
const date = (value?: string) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : 'Unknown';
const eta = (hours: number | null | undefined) => hours === undefined ? 'Unknown' : hours === null ? 'No finite ETA' : `${number(hours)}h`;

export function MetricCard({ card }: { card: Card }) {
  const unknown = card.state === 'unknown';
  const gaugeStyle = { '--gauge': `${card.usedPct ?? 0}%` } as CSSProperties;
  return <SpotlightCard className={`metric-card metric-card--${card.state}`} theme="light" spotlightColor="#4f46ff" intensity={.24} borderGlow={.8} spotlightSize={290} softness={.8} proximity={100} smoothing={.24} grain={.035} flare data-entrance>
    <div className="card-top">
      <div className="provider-title"><span className="provider-mark">{card.provider.slice(0, 1).toUpperCase()}</span><div><div className="eyebrow">{card.provider} / {card.bucket}</div><h2>{card.window === '—' ? 'Waiting for a window' : `${card.window} window`}</h2></div></div>
      <span className={`pill pill--${card.state}`}><i />{card.state.toUpperCase()}</span>
    </div>
    {unknown ? <div className="unknown-box"><div className="unknown-radar" aria-hidden="true"><i /><i /><span>?</span></div><div><strong>No trusted reading yet</strong><p>{card.reason ?? 'No current observation.'}</p></div></div> : <>
      <div className="metric-focus">
        <div className="metric-primary"><span>USED QUOTA</span><strong className="numeric">{number(card.usedPct!)}<small>%</small></strong><em>{number(card.remainingPct!)}% runway remaining</em></div>
        <div className={`quota-gauge quota-gauge--${card.state}`} style={gaugeStyle} aria-hidden="true"><div><img src="/brand/cliffwatch-mark.png" alt="" /></div></div>
      </div>
      <div className="progress" role="progressbar" aria-label={`${card.provider} ${card.window} used`} aria-valuenow={card.usedPct} aria-valuemin={0} aria-valuemax={100}><span data-progress style={{ width: `${card.usedPct}%` }} className={`progress--${card.state}`} /></div>
      <dl className="metric-grid">
        <div><dt>Reset horizon</dt><dd className="numeric small">{date(card.resetsAt)}</dd></div>
        <div><dt>Pace driver</dt><dd>{card.pace?.driver === 'unknown' ? 'Learning your pace' : card.pace?.driver ?? 'Unknown'}</dd></div>
        <div><dt>7-day ETA</dt><dd className="numeric">{eta(card.pace?.sevenDay?.etaHours)}</dd></div>
        <div><dt>6-hour ETA</dt><dd className="numeric">{eta(card.pace?.lastSixHours?.etaHours)}</dd></div>
      </dl>
      {card.pace?.weekly?.overPacePct && card.pace.weekly.overPacePct > 0 ? <p className="pace-warning">Running {number(card.pace.weekly.overPacePct)}% above today’s safe pace.</p> : null}
    </>}
    <div className="card-foot"><span>Scope · {card.scope}</span><span>Observed · {date(card.observedAt)}</span></div>
  </SpotlightCard>;
}
