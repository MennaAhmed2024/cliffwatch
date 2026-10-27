import { NextResponse } from 'next/server';
import { getReceiptsSnapshot,runReceiptsAction } from '@/lib/receipts';
import { parseReceiptsAction, readLocalJson } from '@/lib/request';

export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(getReceiptsSnapshot(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){
  const parsed=await readLocalJson(request);if(!parsed.ok)return NextResponse.json({error:parsed.message},{status:parsed.status});
  const action=parseReceiptsAction(parsed.value);if(!action)return NextResponse.json({error:'Invalid Receipts request.'},{status:400});
  return NextResponse.json(await runReceiptsAction(action.action,action.action==='dismiss'?action.eventId:undefined),{headers:{'Cache-Control':'no-store'}});
}
