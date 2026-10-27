import { NextResponse } from 'next/server';
import { getReceiptsSnapshot,runReceiptsAction } from '@/lib/receipts';

export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(getReceiptsSnapshot(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
  let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid JSON body.'},{status:400});}
  const value=body as {action?:unknown;eventId?:unknown};
  if(value.action!=='scan'&&value.action!=='dismiss')return NextResponse.json({error:'Unsupported action.'},{status:400});
  return NextResponse.json(await runReceiptsAction(value.action,typeof value.eventId==='string'?value.eventId:undefined),{headers:{'Cache-Control':'no-store'}});
}
