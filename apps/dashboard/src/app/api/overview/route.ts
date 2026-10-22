import { NextResponse } from 'next/server';
import { getOverview } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(await getOverview(), { headers: { 'Cache-Control': 'no-store' } });
}
