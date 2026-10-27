import nextDynamic from 'next/dynamic';
import { getHistory } from '@/lib/dashboard';
import { AlertActions } from '@/components/AlertActions';

const HistoryChart = nextDynamic(() => import('@/components/HistoryChart').then(module => module.HistoryChart), { loading: () => <div className="chart chart-loading">Loading chart…</div> });
export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await getHistory();
  return <><div className="page-heading" data-entrance><div><div className="eyebrow">TRENDS & ACTIVITY</div><h1>History</h1><p>Seven days of observed usage and fired alert events.</p></div></div>
    {data.error ? <div className="error-panel">{data.error}</div> : null}
    <div className="section-heading"><h2>Usage trends</h2><span>Last 7 days · UTC samples</span></div>
    {data.series.length ? <div className="chart-list">{data.series.map(series => <section className="panel" key={series.key} data-entrance><div className="chart-title"><div><span className="eyebrow">{series.provider} / {series.bucket}</span><h2>{series.window} window</h2></div><span>{series.points.length} samples</span></div><HistoryChart points={series.points} /></section>)}</div> : <div className="empty">No samples yet — run <code>cliffwatch daemon</code>. The chart appears after observations are saved.</div>}
    <div className="section-heading"><h2>Alert events</h2><span>Most recent 100</span></div>
    {data.alerts.length ? <div className="panel event-panel"><table><thead><tr><th>Event</th><th>Trigger</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{data.alerts.map(alert => <tr key={alert.id}><td>{alert.provider} / {alert.window}</td><td className="numeric">{alert.kind === 'predictive' ? 'Predicted exhaustion' : `${alert.threshold}% used`}</td><td><span className={`pill pill--${alert.state === 'delivered' ? 'ok' : alert.acknowledgedAt ? 'unknown':'warn'}`}>{alert.acknowledgedAt?'acknowledged':alert.state}</span></td><td className="numeric">{new Date(alert.createdAt).toLocaleString()}</td><td>{alert.state==='pending'&&!alert.acknowledgedAt?<AlertActions alertId={alert.id}/>:<span>—</span>}</td></tr>)}</tbody></table></div> : <div className="empty">No alert events have been recorded.</div>}
  </>;
}
