'use client';

import { useState } from 'react';

export function TestAlertButton({ disabled }: { disabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function send() {
    setPending(true); setMessage('');
    try {
      const response = await fetch('/api/test-alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' });
      const result = await response.json() as { ok?: boolean; message?: string };
      setMessage(result.message ?? (response.ok ? 'Test alert delivered.' : 'Test alert failed.'));
    } catch { setMessage('Cannot reach the local dashboard.'); }
    finally { setPending(false); }
  }
  return <div><button type="button" className="button" onClick={send} disabled={disabled || pending}>{pending ? 'Sending…' : 'Send test alert'}</button>{message ? <p role="status" className="action-message">{message}</p> : null}</div>;
}
