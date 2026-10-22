import { NextResponse } from 'next/server';
import { loadConfig } from 'quotadog/config';
import { testAlert } from 'quotadog/notify';
import { isLocalSameOrigin } from '@/lib/request';

export async function POST(request: Request) {
  if (!isLocalSameOrigin(request)) return NextResponse.json({ ok: false, message: 'Local same-origin request required.' }, { status: 403 });
  try {
    const config = await loadConfig(process.env.QUOTADOG_CONFIG_PATH);
    await testAlert(config);
    return NextResponse.json({ ok: true, message: 'Test alert delivered.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error && error.message === 'No notification channel configured.' ? error.message : 'Delivery failed. Check your channel settings and local daemon logs.';
    return NextResponse.json({ ok: false, message }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
