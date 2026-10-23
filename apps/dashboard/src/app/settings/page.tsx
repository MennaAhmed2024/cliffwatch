import { getSafeSettings } from '@/lib/dashboard';
import { TestAlertButton } from '@/components/TestAlertButton';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await getSafeSettings();
  return <><div className="page-heading" data-entrance><div><div className="eyebrow">LOCAL CONFIGURATION</div><h1>Settings</h1><p>Read-only settings from your local config file. Secret values are never shown.</p></div></div>
    {data.error ? <div className="error-panel">{data.error}</div> : null}
    <div className="settings-grid"><section className="panel" data-entrance><div className="eyebrow">MONITORING</div><h2>Probe schedule</h2><dl className="settings-list"><div><dt>Interval</dt><dd className="numeric">{data.intervalSeconds ? `${data.intervalSeconds} seconds` : 'Unknown'}</dd></div><div><dt>Request timeout</dt><dd className="numeric">{data.timeoutMs ? `${data.timeoutMs} ms` : 'Unknown'}</dd></div><div><dt>Alert thresholds</dt><dd className="numeric">{data.thresholds.length ? data.thresholds.map(n => `${n}%`).join(' · ') : 'Unknown'}</dd></div></dl></section><section className="panel" data-entrance><div className="eyebrow">CONNECTIONS</div><h2>Providers</h2><dl className="settings-list">{data.providers.map(provider => <div key={provider.name}><dt>{provider.name}<small>{provider.detail}</small></dt><dd><span className={`pill pill--${provider.enabled ? 'ok' : 'unknown'}`}>{provider.enabled ? 'Enabled' : 'Disabled'}</span></dd></div>)}</dl></section></div>
    <section className="panel settings-panel" data-entrance><div><div className="eyebrow">NOTIFICATIONS</div><h2>Alert channels</h2><p>Only environment variable names are displayed.</p>{data.channels.length ? <ul className="channel-list">{data.channels.map((channel, index) => <li key={`${channel.type}-${index}`}><strong>{channel.type}</strong><span>{channel.envNames.join(', ') || 'Local desktop'}</span></li>)}</ul> : <p className="muted">No channels configured.</p>}</div><TestAlertButton disabled={!data.channels.length || Boolean(data.error)} /></section>
    <div className="hint"><strong>Adding a provider?</strong><p>Use the guided local connection flow. It detects supported tools, tests them, and shows the first trusted reading before saving.</p><Link href="/tools">Add AI Tool</Link></div>
  </>;
}
