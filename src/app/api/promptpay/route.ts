import { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const generatePayload = require('promptpay-qr');
import QRCode from 'qrcode';
import { requireTier } from '@/lib/tier';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/promptpay?amount=1500
export async function GET(req: NextRequest) {
  const gate = await requireTier(CLINIC_ID, 'professional');
  if (gate) return gate;

  const amount = parseFloat(req.nextUrl.searchParams.get('amount') ?? '0');
  const promptpayId = process.env.PROMPTPAY_ID ?? '';

  if (!promptpayId) {
    return NextResponse.json({ error: 'PROMPTPAY_ID not configured' }, { status: 500 });
  }

  const payload = generatePayload(promptpayId, { amount });
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 2 });

  return NextResponse.json({ qr: qrDataUrl, amount, promptpayId });
}
