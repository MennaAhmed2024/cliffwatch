import { NextResponse } from 'next/server';
import { getDiagnostics } from '@/lib/dashboard';

export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(await getDiagnostics(),{headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename="cliffwatch-diagnostics.json"','X-Content-Type-Options':'nosniff'}});}
