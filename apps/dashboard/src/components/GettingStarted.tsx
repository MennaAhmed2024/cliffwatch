'use client';

import { useState } from 'react';

const steps = [
  { number: '01', title: 'Check the connection', copy: 'Run one live read from your configured providers.', command: 'cliffwatch status' },
  { number: '02', title: 'Start the watcher', copy: 'Keep collecting samples so CliffWatch can learn your pace.', command: 'cliffwatch daemon' },
  { number: '03', title: 'Open the command center', copy: 'Return here any time to see quota, ETA, and alerts.', command: 'cliffwatch dashboard' },
];

export function GettingStarted() {
  const [copied, setCopied] = useState('');
  async function copy(command: string) {
    await navigator.clipboard.writeText(command);
    setCopied(command);
    window.setTimeout(() => setCopied(current => current === command ? '' : current), 1400);
  }
  return <section className="setup-panel" data-entrance>
    <div className="setup-intro"><div className="eyebrow accent-eyebrow"><span /> FIRST RUN</div><h2>Bring your first signal online.</h2><p>Your dashboard is connected. Run these commands in a terminal to turn unknown cards into live quota readings.</p><div className="config-path"><span>CONFIG</span><code>~/.cliffwatch/config.yaml</code></div></div>
    <ol className="setup-steps">{steps.map(step => <li key={step.number}><span className="step-number">{step.number}</span><div><strong>{step.title}</strong><p>{step.copy}</p><button type="button" onClick={() => copy(step.command)}><code>{step.command}</code><span>{copied === step.command ? 'Copied' : 'Copy'}</span></button></div></li>)}</ol>
  </section>;
}
