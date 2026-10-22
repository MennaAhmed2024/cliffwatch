import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const expected = `127.0.0.1:${process.env.PORT ?? '3000'}`;
  if (request.headers.get('host') !== expected) return new NextResponse('Local dashboard only.', { status: 403 });
  return NextResponse.next();
}
