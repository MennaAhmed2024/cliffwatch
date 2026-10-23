import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Config } from '../config.js';
import type { Store } from './store.js';
import { boundedJson } from './http.js';
const run = promisify(execFile);
type Channel = Config['channels'][number];
const safeUrl = (raw: string | undefined): URL => {
  let url: URL;
  try { url = new URL(raw ?? ''); } catch { throw new Error('Notification URL environment variable is missing or invalid.'); }
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Webhook must use HTTPS (HTTP allowed only for loopback testing), without URL user credentials.');
  return url;
};
async function post(request: typeof fetch, url: URL, init: RequestInit, timeoutMs: number): Promise<void> {
  try {
    const response = await request(url, { ...init, method: 'POST', signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    await response.body?.cancel();
    if (!response.ok) throw new Error();
  } catch { throw new Error('Notification delivery failed (HTTP error, timeout or connection error); destination credentials were not logged.'); }
}
async function desktop(message: string, timeoutMs: number): Promise<void> {
  try {
    if (process.platform === 'win32') {
      const script = 'Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $n=New-Object System.Windows.Forms.NotifyIcon; $n.Icon=[System.Drawing.SystemIcons]::Information; $n.Visible=$true; $n.BalloonTipTitle="CliffWatch"; $n.BalloonTipText=$env:CLIFFWATCH_ALERT_TEXT; $n.ShowBalloonTip(3000); Start-Sleep -Seconds 4; $n.Dispose()';
      await run('powershell.exe', ['-NoProfile','-NonInteractive','-Command',script], { timeout: timeoutMs, windowsHide: true, env: { CLIFFWATCH_ALERT_TEXT: message, SystemRoot: process.env.SystemRoot } });
    } else if (process.platform === 'darwin') {
      await run('osascript', ['-e','on run argv','-e','display notification (item 1 of argv) with title "CliffWatch"','-e','end run',message], { timeout: timeoutMs });
    } else {
      await run('notify-send', ['CliffWatch',message], { timeout: timeoutMs });
    }
  } catch { throw new Error('Desktop notification failed; check graphical session/notification support.'); }
}
export async function sendMessage(channel: Channel, message: string, kind: 'test' | 'threshold', timeoutMs: number, env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch): Promise<void> {
  if (channel.type === 'desktop') return desktop(message, timeoutMs);
  if (channel.type === 'webhook') return post(request, safeUrl(env[channel.urlEnv]), { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: `cliffwatch.${kind}`, message, at: new Date().toISOString() }) }, timeoutMs);
  if (channel.type === 'discord') return post(request, safeUrl(env[channel.urlEnv]), { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } }) }, timeoutMs);
  if (channel.type === 'ntfy') return post(request, safeUrl(env[channel.urlEnv]), { headers: { 'Content-Type': 'text/plain; charset=utf-8', Title: 'CliffWatch' }, body: message }, timeoutMs);
  const token = env[channel.botTokenEnv], chatId = env[channel.chatIdEnv];
  if (!token || !/^[0-9]+:[A-Za-z0-9_-]+$/.test(token) || !chatId || !/^-?[0-9]+$/.test(chatId)) throw new Error('Telegram token/chat ID environment values are missing or invalid.');
  try {
    const response = await request(new URL(`https://api.telegram.org/bot${token}/sendMessage`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }), signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    if (!response.ok || (await boundedJson(response) as {ok?:unknown}).ok !== true) throw new Error();
  } catch { throw new Error('Telegram notification failed; credentials were not logged.'); }
}
export async function testAlert(config: Config, env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch): Promise<void> {
  const channel = config.channels[0];
  if (!channel) throw new Error('No notification channel configured.');
  await sendMessage(channel, 'CliffWatch test alert: notification delivery is working.', 'test', config.timeoutMs, env, request);
}
export async function deliverDueAlerts(store: Store, config: Config, now: Date, request: typeof fetch = fetch, log: (message: string) => void = console.error): Promise<void> {
  const due = store.claimDueAlerts(now, Math.max(30000,config.timeoutMs+10000));
  for (const alert of due) {
    const channel = config.channels[alert.channelIndex];
    if (!channel) {
      log(`CliffWatch alert ${alert.dedupeKey}: no configured fallback channel; pending.`);
      store.markAlertFailure(alert.id,alert.channelIndex,alert.attempts+1,new Date(now.getTime()+300000).toISOString(),'No channel configured');
      continue;
    }
    const message = `CliffWatch: ${alert.provider} ${alert.window} crossed ${alert.threshold}% used. Check status before the quota wall.`;
    try {
      await sendMessage(channel,message,'threshold',config.timeoutMs,process.env,request);
      store.markAlertDelivered(alert.id,new Date().toISOString());
    } catch {
      const attempts = alert.attempts+1;
      const nextIndex = attempts % 2 === 0 ? Math.min(alert.channelIndex+1,config.channels.length-1) : alert.channelIndex;
      const delay = Math.min(3600000,30000*2**Math.min(attempts-1,10));
      store.markAlertFailure(alert.id,nextIndex,attempts,new Date(now.getTime()+delay).toISOString(),'Delivery failed');
      log(`CliffWatch alert ${alert.dedupeKey}: delivery failed on ${channel.type}; retry scheduled${nextIndex !== alert.channelIndex ? ' via fallback' : ''}.`);
    }
  }
}
