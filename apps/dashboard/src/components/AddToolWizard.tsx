'use client';

import { useEffect, useState } from 'react';

type ToolName = 'codex' | 'openrouter' | 'claude';
type Detection = { name: ToolName; found: boolean; supported: boolean; detail: string };
type Metric = { provider: string; window: string; usedPct: number; resetsAt?: string };
type Result = { state: 'ok' | 'unknown'; reason?: string; metrics: Metric[] };

const labels: Record<ToolName, string> = { codex: 'Codex', openrouter: 'OpenRouter', claude: 'Claude Code' };

export function AddToolWizard() {
  const [tools, setTools] = useState<Detection[]>([]);
  const [selected, setSelected] = useState<ToolName | undefined>();
  const [key, setKey] = useState('');
  const [result, setResult] = useState<Result>();
  const [message, setMessage] = useState('Detecting local tools…');
  const [busy, setBusy] = useState(false);

  useEffect(() => { let active = true; fetch('/api/tools', { cache: 'no-store' }).then(response => response.json()).then(data => { if (active) { setTools(data.tools as Detection[]); setMessage('Choose a tool to connect.'); } }).catch(() => { if (active) setMessage('Detection failed. You can retry by reloading this page.'); }); return () => { active = false; }; }, []);

  const submit = async (action: 'test' | 'save') => {
    if (!selected) return;
    setBusy(true); setMessage(action === 'test' ? 'Testing connection…' : 'Testing and saving…');
    try {
      const response = await fetch('/api/tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, provider: selected, key: selected === 'openrouter' ? key : undefined }) });
      const data = await response.json() as { ok: boolean; message: string; result?: Result };
      setResult(data.result); setMessage(data.message);
      if (data.ok && action === 'save') setKey('');
    } catch { setMessage('Connection failed before a trusted result was returned.'); setResult(undefined); }
    finally { setBusy(false); }
  };

  return <div className="tool-wizard">
    <section className="panel tool-step"><div className="eyebrow">01 · CHOOSE</div><h2>Add AI tool</h2><p>{message}</p><div className="tool-options">{tools.map(tool => <button type="button" key={tool.name} className={`tool-option${selected === tool.name ? ' selected' : ''}`} onClick={() => { setSelected(tool.name); setResult(undefined); setMessage(tool.supported ? `${labels[tool.name]} selected.` : `${labels[tool.name]} is detected but its quota adapter is not ready.`); }} disabled={!tool.supported || busy}><strong>{labels[tool.name]}</strong><span className={`pill pill--${tool.found ? 'ok' : 'unknown'}`}>{tool.found ? 'Found' : 'Not found'}</span><small>{tool.detail}</small></button>)}</div></section>
    {selected ? <section className="panel tool-step"><div className="eyebrow">02 · CONNECT</div><h2>{labels[selected]}</h2>{selected === 'openrouter' ? <label className="secret-field"><span>OpenRouter API key</span><input type="password" autoComplete="off" spellCheck={false} value={key} onChange={event => setKey(event.target.value)} placeholder="Stored in Windows user environment" /><small>The key stays on this machine and is never returned by the API.</small></label> : <p>CliffWatch will use the local signed-in Codex installation it detected.</p>}<button className="plan-action plan-action--primary" type="button" disabled={busy || (selected === 'openrouter' && !key)} onClick={() => submit('test')}>Test connection</button></section> : null}
    {result?.state === 'ok' ? <section className="panel tool-step"><div className="eyebrow">03 · FIRST LIVE READING</div><h2>Connection verified</h2><div className="first-readings">{result.metrics.map((metric, index) => <div key={`${metric.provider}-${metric.window}-${index}`}><strong>{metric.window}</strong><span className="numeric">{metric.usedPct.toFixed(1)}% used</span><small>{metric.resetsAt ? `Resets ${new Date(metric.resetsAt).toLocaleString()}` : 'No reset supplied'}</small></div>)}</div><button className="plan-action plan-action--primary" type="button" disabled={busy} onClick={() => submit('save')}>Save tool</button></section> : null}
  </div>;
}
