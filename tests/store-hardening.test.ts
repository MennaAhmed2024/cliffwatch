import Database from 'better-sqlite3';
import { afterEach,describe,expect,it } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from '../packages/cli/src/core/store.js';

const directories:string[]=[];
afterEach(async()=>{for(const directory of directories.splice(0))await rm(directory,{recursive:true,force:true});});
async function databasePath(){const directory=await mkdtemp(join(tmpdir(),'cliffwatch-store-'));directories.push(directory);return join(directory,'store.sqlite');}

describe('SQLite schema lifecycle',()=>{
  it('migrates a v1 database in place without losing legacy alerts',async()=>{
    const path=await databasePath(),legacy=new Database(path);
    legacy.exec(`CREATE TABLE samples(id INTEGER PRIMARY KEY,provider TEXT NOT NULL,bucket TEXT NOT NULL,window TEXT NOT NULL,scope TEXT NOT NULL,period_epoch INTEGER NOT NULL,used_pct REAL,used_absolute REAL,limit_absolute REAL,resets_at TEXT,observed_at TEXT NOT NULL,source_observed_at TEXT NOT NULL,state TEXT NOT NULL,reason TEXT);
      CREATE TABLE alerts(id INTEGER PRIMARY KEY,dedupe_key TEXT NOT NULL UNIQUE,provider TEXT NOT NULL,window TEXT NOT NULL,threshold REAL NOT NULL,period_epoch INTEGER NOT NULL,state TEXT NOT NULL,channel_index INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT NOT NULL,created_at TEXT NOT NULL,delivered_at TEXT,last_error TEXT);
      CREATE TABLE health(provider TEXT PRIMARY KEY,state TEXT NOT NULL,reason TEXT,observed_at TEXT NOT NULL);
      CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      INSERT INTO alerts(dedupe_key,provider,window,threshold,period_epoch,state,next_attempt_at,created_at) VALUES('legacy','codex','codex:5h',70,1,'pending','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
      PRAGMA user_version=1;`);
    legacy.close();
    const store=new SqliteStore(path);expect(store.alertHistory()[0]).toMatchObject({dedupeKey:'legacy',kind:'threshold'});store.close();
    const migrated=new Database(path,{readonly:true});
    expect(migrated.pragma('user_version',{simple:true})).toBe(SqliteStore.schemaVersion);
    const indexes=(migrated.pragma('index_list(samples)') as {name:string}[]).map(index=>index.name);
    expect(indexes).toContain('samples_observed_lookup');migrated.close();
  });

  it('checks integrity and prunes old samples in bounded batches',async()=>{
    const path=await databasePath(),store=new SqliteStore(path),reset='2027-01-01T00:00:00.000Z';
    for(let day=1;day<=5;day++){const observedAt=`2026-01-0${day}T00:00:00.000Z`;store.insertSample({provider:'codex',bucket:'codex',window:'5h',scope:'account',usedPct:day,resetsAt:reset,observedAt,sourceObservedAt:observedAt});}
    const recent='2026-02-01T00:00:00.000Z';store.insertSample({provider:'codex',bucket:'codex',window:'5h',scope:'account',usedPct:6,resetsAt:reset,observedAt:recent,sourceObservedAt:recent});
    expect(store.integrityCheck()).toEqual({ok:true,message:'ok'});
    expect(store.pruneSamples('invalid',10)).toBe(0);
    expect(store.pruneSamples('2026-02-01T00:00:00.000Z',2)).toBe(2);
    expect(store.history(undefined,100)).toHaveLength(4);
    expect(store.pruneSamples('2026-02-01T00:00:00.000Z',100)).toBe(3);
    expect(store.history(undefined,100).map(sample=>sample.observedAt)).toEqual([recent]);store.close();
  });
  it('snoozes and acknowledges only pending alerts',async()=>{const path=await databasePath(),store=new SqliteStore(path);store.insertAlert({dedupeKey:'a',provider:'codex',window:'codex:5h',threshold:70,periodEpoch:1,kind:'threshold'});const alert=store.alertHistory()[0]!;expect(store.snoozeAlert(alert.id,'2026-12-01T01:00:00.000Z')).toBe(true);expect(store.pendingAlerts(new Date('2026-12-01T00:00:00.000Z'))).toHaveLength(0);expect(store.acknowledgeAlert(alert.id,'2026-12-01T00:00:00.000Z')).toBe(true);expect(store.pendingAlerts(new Date('2027-01-01T00:00:00.000Z'))).toHaveLength(0);expect(store.alertHistory()[0]?.acknowledgedAt).toBe('2026-12-01T00:00:00.000Z');store.close();});
});
