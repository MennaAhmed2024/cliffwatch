'use client';

import { useState,useTransition } from 'react';
import type { ReceiptsSnapshot } from '@/lib/receipts';

const number=new Intl.NumberFormat('en-US');
export function ReceiptsView({initial}:Readonly<{initial:ReceiptsSnapshot}>){
  const [data,setData]=useState(initial),[pending,startTransition]=useTransition();
  const action=(body:{action:'scan'|'dismiss';eventId?:string})=>startTransition(async()=>{try{const response=await fetch('/api/receipts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new Error('request failed');const next=await response.json() as ReceiptsSnapshot;setData(next);}catch{setData(current=>({...current,error:'The local Receipts action failed. Confirm the dashboard and Receipts CLI are running on this device.'}));}});
  const unattributedPct=data.summary.sessions?data.summary.unattributed/data.summary.sessions*100:0;
  return <>
    <div className="receipts-actions"><div><span className="eyebrow">CURRENT LEDGER</span><strong>{data.month}</strong></div><button className="button" type="button" disabled={pending} onClick={()=>action({action:'scan'})}>{pending?'Refreshing…':'Refresh scan'}</button></div>
    {data.error?<div className="error-panel" role="status">{data.error}</div>:null}
    <section className="receipt-stats" aria-label="Monthly AI ledger summary">
      <div><span>Sessions</span><strong>{number.format(data.summary.sessions)}</strong></div><div><span>Input tokens</span><strong>{number.format(data.summary.input)}</strong></div><div><span>Output tokens</span><strong>{number.format(data.summary.output)}</strong></div><div><span>Cache tokens</span><strong>{number.format(data.summary.cache)}</strong></div><div><span>Provider cost</span><strong>{data.summary.providerCost===null?'—':`$${data.summary.providerCost.toFixed(4)}`}</strong></div><div><span>Unattributed</span><strong>{unattributedPct.toFixed(1)}%</strong></div>
    </section>
    <div className="section-heading"><h2>Work attribution</h2><span>{data.links.length} evidence links</span></div>
    {data.links.length?<div className="panel event-panel"><table><thead><tr><th>Confidence</th><th>Share</th><th>Session</th><th>Evidence</th><th>Commit</th><th>Work</th></tr></thead><tbody>{data.links.map(link=><tr key={`${link.sessionId}:${link.commitSha??'manual'}:${link.work}`}><td><span className={`pill pill--${link.confidence==='tagged'?'ok':'warn'}`}>{link.confidence}</span></td><td className="numeric">{(link.share*100).toFixed(1)}%</td><td className="numeric">{link.sessionId.slice(0,8)}</td><td>{link.basis}</td><td className="numeric">{link.commitSha?.slice(0,12)??'manual'}</td><td>{link.work}</td></tr>)}</tbody></table></div>:<div className="empty">No attribution links yet. Refresh the scan after your AI sessions and Git commits exist.</div>}
    <div className="section-heading"><h2>Rework signals</h2><span>{data.rework.length} active events</span></div>
    {data.rework.length?<div className="receipt-events">{data.rework.map(event=><article className="panel" key={event.id}><div><span className="pill pill--warn">{event.kind}</span><h3>{event.work}</h3><p>{event.evidence}</p><code>{event.id}</code></div><button className="receipt-dismiss" type="button" disabled={pending} onClick={()=>action({action:'dismiss',eventId:event.id})}>Dismiss false positive</button></article>)}</div>:<div className="empty">No active rework events for this month.</div>}
    <div className="hint"><strong>Honest accounting</strong><p>Codex subscription usage is shown as tokens. CliffWatch does not invent a dollar value or ROI multiplier.</p></div>
  </>;
}
