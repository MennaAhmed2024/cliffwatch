import 'server-only';
import Database from 'better-sqlite3';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run=promisify(execFile);
const databasePath=()=>process.env.RECEIPTS_DATA_FILE??join(homedir(),'.receipts','receipts.sqlite');
const cliPath=()=>process.env.RECEIPTS_CLI_PATH??join(homedir(),'Documents','Default Project','receipts','dist','cli.js');
const bounds=(now=new Date())=>{const year=now.getUTCFullYear(),month=now.getUTCMonth();return{label:`${year}-${String(month+1).padStart(2,'0')}`,start:new Date(Date.UTC(year,month,1)).toISOString(),end:new Date(Date.UTC(year,month+1,1)).toISOString()};};

export type ReceiptLink={sessionId:string;confidence:'tagged'|'likely';share:number;basis:string;commitSha?:string;work:string};
export type ReceiptRework={id:string;kind:string;detectedAt:string;work:string;evidence:string};
export type ReceiptsSnapshot={month:string;configured:boolean;summary:{sessions:number;input:number;output:number;cache:number;providerCost:number|null;unattributed:number};links:ReceiptLink[];rework:ReceiptRework[];error?:string};
type SummaryRow={sessions:number;input:number;output:number;cache:number;provider_cost:number|null};
type LinkRow={session_id:string;confidence:'tagged'|'likely';share:number;evidence_json:string;title:string};
type EventRow={id:string;kind:string;detected_at:string;title:string;evidence:string};

export function getReceiptsSnapshot(now=new Date()):ReceiptsSnapshot{
  const period=bounds(now),empty:ReceiptsSnapshot={month:period.label,configured:false,summary:{sessions:0,input:0,output:0,cache:0,providerCost:null,unattributed:0},links:[],rework:[]};
  const path=databasePath();if(!existsSync(path))return{...empty,error:'Receipts database not found yet. Use Refresh scan to create the first reading.'};
  let db:Database.Database|undefined;
  try{
    db=new Database(path,{readonly:true,fileMustExist:true});
    const summary=db.prepare(`SELECT COUNT(*) sessions,COALESCE(SUM(input_tokens),0) input,COALESCE(SUM(output_tokens),0) output,COALESCE(SUM(cache_tokens),0) cache,SUM(CASE WHEN cost_source='provider' THEN cost_amount END) provider_cost FROM sessions WHERE started_at>=? AND started_at<?`).get(period.start,period.end) as SummaryRow;
    const unattributed=(db.prepare(`SELECT COUNT(*) count FROM sessions s WHERE s.started_at>=? AND s.started_at<? AND NOT EXISTS(SELECT 1 FROM links l WHERE l.session_id=s.id)`).get(period.start,period.end) as {count:number}).count;
    const links=(db.prepare(`SELECT l.session_id,l.confidence,l.share,l.evidence_json,w.title FROM links l JOIN sessions s ON s.id=l.session_id JOIN works w ON w.id=l.work_id WHERE s.started_at>=? AND s.started_at<? ORDER BY l.confidence='tagged' DESC,s.started_at,w.title`).all(period.start,period.end) as LinkRow[]).map(row=>{const evidence=JSON.parse(row.evidence_json) as {basis?:string;commitSha?:string};return{sessionId:row.session_id,confidence:row.confidence,share:row.share,basis:evidence.basis??'unknown',commitSha:evidence.commitSha,work:row.title};});
    const rework=(db.prepare(`SELECT e.id,e.kind,e.detected_at,w.title,e.evidence FROM rework_events e JOIN works w ON w.id=e.work_id LEFT JOIN dismissals d ON d.event_id=e.id WHERE d.event_id IS NULL AND e.detected_at>=? AND e.detected_at<? ORDER BY e.detected_at DESC`).all(period.start,period.end) as EventRow[]).map(row=>({id:row.id,kind:row.kind,detectedAt:row.detected_at,work:row.title,evidence:row.evidence}));
    return{month:period.label,configured:true,summary:{sessions:summary.sessions,input:summary.input,output:summary.output,cache:summary.cache,providerCost:summary.provider_cost,unattributed},links,rework};
  }catch{return{...empty,error:'Receipts data exists but could not be read. Rebuild receipts and run Refresh scan.'};}finally{db?.close();}
}

function latestRepoPath():string{
  const configured=process.env.RECEIPTS_REPO_PATH;if(configured)return configured;
  const path=databasePath();if(existsSync(path)){const db=new Database(path,{readonly:true,fileMustExist:true});try{const row=db.prepare('SELECT repo_path FROM commits ORDER BY authored_at DESC LIMIT 1').get() as {repo_path:string}|undefined;if(row)return row.repo_path;}finally{db.close();}}
  return process.cwd();
}
export async function runReceiptsAction(action:'scan'|'dismiss',eventId?:string):Promise<ReceiptsSnapshot>{
  const cli=cliPath();if(!existsSync(cli))return{...getReceiptsSnapshot(),error:'Receipts CLI is unavailable. Build it or configure RECEIPTS_CLI_PATH.'};
  const args=action==='scan'?[cli,'scan','--repo',latestRepoPath()]:[cli,'dismiss',eventId??''];
  if(action==='dismiss'&&!/^rework:[a-f0-9]{16}$/.test(eventId??''))return{...getReceiptsSnapshot(),error:'Invalid rework event id.'};
  try{await run(process.execPath,args,{windowsHide:true,timeout:60_000,maxBuffer:2*1024*1024});return getReceiptsSnapshot();}
  catch{return{...getReceiptsSnapshot(),error:'Receipts command failed. Check that its CLI build and repository path are available.'};}
}
