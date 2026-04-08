import { NextRequest, NextResponse } from 'next/server';
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';

// GET /api/promptpay?amount=1500
export async function GET(req: NextRequest) {
  const amount = parseFloat(req.nextUrl.searchParams.get('amount') ?? '0');
  const promptpayId = process.env.PROMPTPAY_ID ?? '';

  if (!promptpayId) {
    return NextResponse.json({ error: 'PROMPTPAY_ID not configured' }, { status: 500 });
  }

  const payload = generatePayload(promptpayId, { amount });
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 2 });

  return NextResponse.json({ qr: qrDataUrl, amount, promptpayId });
}
