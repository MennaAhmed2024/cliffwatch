import Database from 'better-sqlite3';
import { mkdirSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Metric } from './probe.js';

export type Sample = Metric & { id: number; periodEpoch: number; state: 'ok' | 'unknown'; reason?: string };
export type Alert = { id: number; dedupeKey: string; provider: string; window: string; threshold: number; periodEpoch: number; state: 'pending' | 'delivered'; channelIndex: number; attempts: number; nextAttemptAt: string; createdAt: string; deliveredAt?: string; lastError?: string };
export type ProbeHealth = { provider: string; state: 'ok' | 'unknown'; reason?: string; observedAt: string };
export interface Store {
  insertSample(metric: Metric): number;
  latestSample(provider: string, bucket: string, window: string, scope: string): Sample | undefined;
  latestSamples(): Sample[];
  history(provider?: string, limit?: number): Sample[];
  insertAlert(alert: Omit<Alert, 'id' | 'state' | 'channelIndex' | 'attempts' | 'nextAttemptAt' | 'createdAt' | 'deliveredAt' | 'lastError'>): boolean;
  alertExists(dedupeKey: string): boolean;
  pendingAlerts(now: Date, limit?: number): Alert[];
  claimDueAlerts(now: Date, leaseMs: number, limit?: number): Alert[];
  markAlertFailure(id: number, channelIndex: number, attempts: number, nextAttemptAt: string, error: string): void;
  markAlertDelivered(id: number, at: string): void;
  alertHistory(limit?: number): Alert[];
  putHealth(health: ProbeHealth): void;
  latestHealth(): ProbeHealth[];
  getHeartbeat(): string | undefined;
  setHeartbeat(at: string): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}

type SampleRow = { id: number; provider: string; bucket: string; window: string; scope: string; period_epoch: number; used_pct: number | null; used_absolute: number | null; limit_absolute: number | null; resets_at: string | null; observed_at: string; source_observed_at: string; state: 'ok' | 'unknown'; reason: string | null };
type AlertRow = { id: number; dedupe_key: string; provider: string; window: string; threshold: number; period_epoch: number; state: 'pending' | 'delivered'; channel_index: number; attempts: number; next_attempt_at: string; created_at: string; delivered_at: string | null; last_error: string | null };
const mapSample = (r: SampleRow): Sample => ({ id: r.id, periodEpoch: r.period_epoch, provider: r.provider, bucket: r.bucket, window: r.window, scope: r.scope, usedPct: r.used_pct ?? NaN, ...(r.used_absolute !== null ? { usedAbsolute: r.used_absolute } : {}), ...(r.limit_absolute !== null ? { limitAbsolute: r.limit_absolute } : {}), ...(r.resets_at ? { resetsAt: r.resets_at } : {}), observedAt: r.observed_at, sourceObservedAt: r.source_observed_at, state: r.state, ...(r.reason ? { reason: r.reason } : {}) });
const mapAlert = (r: AlertRow): Alert => ({ id: r.id, dedupeKey: r.dedupe_key, provider: r.provider, window: r.window, threshold: r.threshold, periodEpoch: r.period_epoch, state: r.state, channelIndex: r.channel_index, attempts: r.attempts, nextAttemptAt: r.next_attempt_at, createdAt: r.created_at, ...(r.delivered_at ? { deliveredAt: r.delivered_at } : {}), ...(r.last_error ? { lastError: r.last_error } : {}) });

export class SqliteStore implements Store {
  private db: Database.Database;
  constructor(path = join(homedir(), '.quotadog', 'quotadog.sqlite')) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new Database(path, { timeout: 5000, fileMustExist: false });
    if (path !== ':memory:') { try { chmodSync(path, 0o600); } catch { /* Windows ACLs apply instead. */ } }
    this.db.pragma('journal_mode = WAL'); this.db.pragma('busy_timeout = 5000');
    this.db.exec(`CREATE TABLE IF NOT EXISTS samples (
      id INTEGER PRIMARY KEY, provider TEXT NOT NULL, bucket TEXT NOT NULL, window TEXT NOT NULL, scope TEXT NOT NULL, period_epoch INTEGER NOT NULL,
      used_pct REAL, used_absolute REAL, limit_absolute REAL, resets_at TEXT,
      observed_at TEXT NOT NULL, source_observed_at TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('ok','unknown')), reason TEXT
    );
    CREATE INDEX IF NOT EXISTS samples_lookup ON samples(provider,bucket,window,scope,id DESC);
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY, dedupe_key TEXT NOT NULL UNIQUE, provider TEXT NOT NULL, window TEXT NOT NULL,
      threshold REAL NOT NULL, period_epoch INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','delivered')),
      channel_index INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL, created_at TEXT NOT NULL, delivered_at TEXT, last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS alerts_pending ON alerts(state,next_attempt_at);
    CREATE TABLE IF NOT EXISTS health (provider TEXT PRIMARY KEY, state TEXT NOT NULL, reason TEXT, observed_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  insertSample(m: Metric): number {
    const previous = this.latestSample(m.provider,m.bucket,m.window,m.scope);
    const sameCreditPeriod = previous && previous.limitAbsolute === m.limitAbsolute && m.usedPct >= previous.usedPct;
    const periodEpoch = m.resetsAt ? Math.floor(Date.parse(m.resetsAt)/1000) : sameCreditPeriod ? previous.periodEpoch : Math.max(Math.floor(Date.parse(m.observedAt)/1000), (previous?.periodEpoch ?? 0)+1);
    const row = this.db.prepare(`INSERT INTO samples(provider,bucket,window,scope,period_epoch,used_pct,used_absolute,limit_absolute,resets_at,observed_at,source_observed_at,state)
      VALUES(?,?,?,?,?,?,?,?,?,?,?, 'ok')`).run(m.provider, m.bucket, m.window, m.scope, periodEpoch, m.usedPct, m.usedAbsolute ?? null, m.limitAbsolute ?? null, m.resetsAt ?? null, m.observedAt, m.sourceObservedAt);
    return Number(row.lastInsertRowid);
  }
  latestSample(provider: string, bucket: string, window: string, scope: string): Sample | undefined {
    const r = this.db.prepare('SELECT * FROM samples WHERE provider=? AND bucket=? AND window=? AND scope=? ORDER BY id DESC LIMIT 1').get(provider, bucket, window, scope) as SampleRow | undefined;
    return r ? mapSample(r) : undefined;
  }
  latestSamples(): Sample[] {
    const rows = this.db.prepare(`SELECT s.* FROM samples s JOIN (SELECT provider,bucket,window,scope,MAX(id) id FROM samples GROUP BY provider,bucket,window,scope) x ON s.id=x.id ORDER BY s.provider,s.window`).all() as SampleRow[];
    return rows.map(mapSample);
  }
  history(provider?: string, limit = 200): Sample[] {
    const capped = Math.min(10000, Math.max(1, limit));
    const rows = provider ? this.db.prepare('SELECT * FROM samples WHERE provider=? ORDER BY id DESC LIMIT ?').all(provider, capped) : this.db.prepare('SELECT * FROM samples ORDER BY id DESC LIMIT ?').all(capped);
    return (rows as SampleRow[]).map(mapSample);
  }
  insertAlert(a: Omit<Alert, 'id' | 'state' | 'channelIndex' | 'attempts' | 'nextAttemptAt' | 'createdAt' | 'deliveredAt' | 'lastError'>): boolean {
    const now = new Date().toISOString();
    return this.db.prepare(`INSERT OR IGNORE INTO alerts(dedupe_key,provider,window,threshold,period_epoch,state,next_attempt_at,created_at) VALUES(?,?,?,?,?,'pending',?,?)`).run(a.dedupeKey,a.provider,a.window,a.threshold,a.periodEpoch,now,now).changes === 1;
  }
  alertExists(key: string): boolean { return Boolean(this.db.prepare('SELECT 1 FROM alerts WHERE dedupe_key=?').get(key)); }
  pendingAlerts(now: Date, limit = 100): Alert[] { return (this.db.prepare("SELECT * FROM alerts WHERE state='pending' AND next_attempt_at<=? ORDER BY id LIMIT ?").all(now.toISOString(),Math.min(1000,Math.max(1,limit))) as AlertRow[]).map(mapAlert); }
  claimDueAlerts(now: Date, leaseMs: number, limit = 100): Alert[] {
    return this.transaction(() => {
      const due = this.pendingAlerts(now,limit);
      const until = new Date(now.getTime()+leaseMs).toISOString();
      const claim = this.db.prepare("UPDATE alerts SET next_attempt_at=? WHERE id=? AND state='pending' AND next_attempt_at<=?");
      return due.filter(a => claim.run(until,a.id,now.toISOString()).changes === 1);
    });
  }
  markAlertFailure(id: number, channelIndex: number, attempts: number, nextAttemptAt: string, error: string): void {
    this.db.prepare("UPDATE alerts SET channel_index=?, attempts=?, next_attempt_at=?, last_error=? WHERE id=? AND state='pending'").run(channelIndex, attempts, nextAttemptAt, error.slice(0, 240), id);
  }
  markAlertDelivered(id: number, at: string): void { this.db.prepare("UPDATE alerts SET state='delivered', delivered_at=?, last_error=NULL WHERE id=? AND state='pending'").run(at,id); }
  alertHistory(limit = 100): Alert[] { return (this.db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT ?').all(Math.min(1000,Math.max(1,limit))) as AlertRow[]).map(mapAlert); }
  putHealth(h: ProbeHealth): void { this.db.prepare('INSERT INTO health(provider,state,reason,observed_at) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET state=excluded.state,reason=excluded.reason,observed_at=excluded.observed_at').run(h.provider,h.state,h.reason ?? null,h.observedAt); }
  latestHealth(): ProbeHealth[] { return (this.db.prepare('SELECT * FROM health ORDER BY provider').all() as {provider:string;state:'ok'|'unknown';reason:string|null;observed_at:string}[]).map(r => ({ provider:r.provider,state:r.state,...(r.reason ? {reason:r.reason}:{}),observedAt:r.observed_at })); }
  getHeartbeat(): string | undefined { return (this.db.prepare("SELECT value FROM metadata WHERE key='heartbeat'").get() as {value:string}|undefined)?.value; }
  setHeartbeat(at: string): void { this.db.prepare("INSERT INTO metadata(key,value) VALUES('heartbeat',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(at); }
  transaction<T>(fn: () => T): T { return this.db.transaction(fn)(); }
  close(): void { this.db.close(); }
}
