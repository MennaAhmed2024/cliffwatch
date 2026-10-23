import { NextResponse } from 'next/server';
import { detectTools, saveTool, testTool, type ToolName } from 'cliffwatch/setup';
import { isLocalSameOrigin } from '@/lib/request';

export const dynamic = 'force-dynamic';
const names = new Set<ToolName>(['codex', 'openrouter', 'claude']);

export async function GET() {
  return NextResponse.json({ tools: await detectTools() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!isLocalSameOrigin(request)) return NextResponse.json({ ok: false, message: 'Local same-origin request required.' }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 8192) return NextResponse.json({ ok: false, message: 'Request is too large.' }, { status: 413 });
    const body = JSON.parse(text) as { action?: unknown; provider?: unknown; key?: unknown };
    if ((body.action !== 'test' && body.action !== 'save') || typeof body.provider !== 'string' || !names.has(body.provider as ToolName) || (body.key !== undefined && typeof body.key !== 'string')) {
      return NextResponse.json({ ok: false, message: 'Invalid tool request.' }, { status: 400 });
    }
    const provider = body.provider as ToolName;
    const key = typeof body.key === 'string' ? body.key.trim() : undefined;
    const result = await testTool(provider, key);
    if (result.state !== 'ok') return NextResponse.json({ ok: false, message: result.reason ?? 'No trusted quota reading is available.', result }, { status: 422, headers: { 'Cache-Control': 'no-store' } });
    if (body.action === 'save') await saveTool(provider, key, process.env.CLIFFWATCH_CONFIG_PATH);
    return NextResponse.json({ ok: true, message: body.action === 'save' ? 'Tool saved. Run sync-now or restart the daemon.' : 'Connection succeeded.', result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, message: 'Tool operation failed. The secret was not logged.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
