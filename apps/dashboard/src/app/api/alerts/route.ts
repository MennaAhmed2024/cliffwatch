import { NextResponse } from 'next/server';
import { loadConfig } from 'cliffwatch/config';
import { openExistingStore } from 'cliffwatch/daemon';
import { parseAlertAction,readLocalJson } from '@/lib/request';

export async function POST(request:Request){
  const body=await readLocalJson(request);if(!body.ok)return NextResponse.json({error:body.message},{status:body.status});
  const action=parseAlertAction(body.value);if(!action)return NextResponse.json({error:'Invalid alert action.'},{status:400});
  try{
    const config=await loadConfig(process.env.CLIFFWATCH_CONFIG_PATH),store=openExistingStore(config);if(!store)return NextResponse.json({error:'Local alert store is unavailable.'},{status:409});
    try{const now=new Date(),changed=action.action==='acknowledge'?store.acknowledgeAlert(action.alertId,now.toISOString()):store.snoozeAlert(action.alertId,new Date(now.getTime()+action.minutes*60000).toISOString());return NextResponse.json(changed?{ok:true}:{error:'Pending alert was not found.'},{status:changed?200:404,headers:{'Cache-Control':'no-store'}});}
    finally{store.close();}
  }catch{return NextResponse.json({error:'Alert action failed.'},{status:500});}
}
