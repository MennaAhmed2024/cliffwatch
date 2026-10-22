import type { Card } from '@/lib/dashboard';
import { SpotlightCard } from './SpotlightCard';

const number = (value: number) => value.toFixed(1);
const date = (value?: string) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : 'Unknown';
const eta = (hours: number | null | undefined) => hours === undefined ? 'Unknown' : hours === null ? 'No finite ETA' : `${number(hours)}h`;

export function MetricCard({ card }: { card: Card }) {
  const unknown = card.state === 'unknown';
  return <SpotlightCard className={`metric-card ${unknown ? 'metric-card--unknown' : ''}`} data-entrance>
    <div className="card-top"><div><div className="eyebrow">{card.provider} / {card.bucket}</div><h2>{card.window === '—' ? 'No window available' : `${card.window} window`}</h2></div><span className={`pill pill--${card.state}`}>{card.state.toUpperCase()}</span></div>
    {unknown ? <div className="unknown-box"><strong>Quota unavailable</strong><p>{card.reason ?? 'No current observation.'}</p></div> : <>
      <div className="metric-primary"><strong className="numeric">{number(card.usedPct!)}%</strong><span>used</span></div>
      <div className="progress" role="progressbar" aria-label={`${card.provider} ${card.window} used`} aria-valuenow={card.usedPct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${card.usedPct}%` }} className={`progress--${card.state}`} /></div>
      <dl className="metric-grid"><div><dt>Remaining</dt><dd className="numeric">{number(card.remainingPct!)}%</dd></div><div><dt>Reset</dt><dd className="numeric small">{date(card.resetsAt)}</dd></div><div><dt>Pace driver</dt><dd>{card.pace?.driver === 'unknown' ? 'Insufficient history' : card.pace?.driver ?? 'Unknown'}</dd></div><div><dt>ETA 7d / 6h</dt><dd className="numeric small">{eta(card.pace?.sevenDay?.etaHours)} / {eta(card.pace?.lastSixHours?.etaHours)}</dd></div></dl>
      {card.pace?.weekly?.overPacePct && card.pace.weekly.overPacePct > 0 ? <p className="pace-warning">{number(card.pace.weekly.overPacePct)}% over today’s pace</p> : null}
    </>}
    <div className="card-foot">Scope: {card.scope} · Observed {date(card.observedAt)}</div>
  </SpotlightCard>;
}
