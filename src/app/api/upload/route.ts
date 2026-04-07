import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

// POST /api/upload — รับ base64 รูป แล้ว upload ไป Vercel Blob
export async function POST(req: NextRequest) {
  try {
    const { face, consent, hn } = await req.json();

    const results: { faceUrl: string; consentUrl: string } = {
      faceUrl: '',
      consentUrl: '',
    };

    if (face) {
      const base64Data = face.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = await put(`patients/${hn}/face.jpg`, buffer, {
        access: 'public',
        contentType: 'image/jpeg',
      });
      results.faceUrl = blob.url;
    }

    if (consent) {
      const base64Data = consent.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = await put(`patients/${hn}/consent.png`, buffer, {
        access: 'public',
        contentType: 'image/png',
      });
      results.consentUrl = blob.url;
    }

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
