import type { Config } from '../config.js';
export async function testAlert(config: Config, env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch): Promise<void> {
  const channel = config.channels[0];
  if (!channel) throw new Error('No webhook configured. Add channels with type: webhook and urlEnv.');
  let url: URL;
  try { url = new URL(env[channel.urlEnv] ?? ''); } catch { throw new Error('Webhook URL environment variable is missing or invalid.'); }
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Webhook must use HTTPS (HTTP allowed only for loopback testing), without URL user credentials.');
  try {
    const response = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'quotadog.test', message: 'QuotaDog test alert: notification delivery is working.', at: new Date().toISOString() }), signal: AbortSignal.timeout(config.timeoutMs), redirect: 'error' });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Webhook HTTP ${response.status}`);
  } catch { throw new Error('Webhook delivery failed (HTTP error, timeout or connection error); destination credentials were not logged.'); }
}
