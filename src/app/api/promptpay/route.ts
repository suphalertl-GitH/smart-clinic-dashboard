import { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const generatePayload = require('promptpay-qr');
import QRCode from 'qrcode';
import { requireFeature } from '@/lib/tier';
import { getClinicId } from '@/lib/auth';

// GET /api/promptpay?amount=1500
export async function GET(req: NextRequest) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(clinicId, 'promptpay');
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
