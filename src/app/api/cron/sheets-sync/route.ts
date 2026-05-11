import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/cron/sheets-sync — ทำงานทุก 1 ชั่วโมง ตรวจ schedule แล้ว sync อัตโนมัติ
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? 'clinic2026secret'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // เวลาปัจจุบัน Bangkok — format "HH:00"
  const nowBkk  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const nowHHMM = `${String(nowBkk.getHours()).padStart(2, '0')}:00`;

  // ดึง clinics ทุกตัวที่เปิด auto sync และมีเวลาตรงกับชั่วโมงนี้
  const { data: clinics, error } = await supabaseAdmin
    .from('settings')
    .select('clinic_id, sync_times')
    .eq('sync_auto_enabled', true)
    .contains('sync_times', [nowHHMM]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!clinics?.length) return NextResponse.json({ triggered: 0 });

  // Trigger sync สำหรับแต่ละ clinic โดยเรียก API ภายใน
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://smart-clinic-cyan.vercel.app';
  const secret  = process.env.CRON_SECRET ?? 'clinic2026secret';

  const results = await Promise.allSettled(
    clinics.map(c =>
      fetch(`${baseUrl}/api/sheets-sync/run`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'authorization': `Bearer ${secret}`,
          'x-clinic-id':   c.clinic_id,
        },
        body: JSON.stringify({ mode: 'today' }),
      }).then(r => r.json())
    )
  );

  return NextResponse.json({
    triggered: clinics.length,
    time:      nowHHMM,
    results:   results.map(r => r.status === 'fulfilled' ? r.value : { error: (r as any).reason?.message }),
  });
}
