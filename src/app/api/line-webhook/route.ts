import { NextRequest, NextResponse } from 'next/server';

// Temporary webhook to capture Group ID
export async function POST(req: NextRequest) {
  const body = await req.json();
  const events = body.events ?? [];

  for (const event of events) {
    const source = event.source;
    if (source?.type === 'group') {
      console.log('=== LINE GROUP ID ===', source.groupId);
    }
    if (source?.type === 'user') {
      console.log('=== LINE USER ID ===', source.userId);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
