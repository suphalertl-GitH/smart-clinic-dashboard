import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasFeature } from '@/lib/tier';
import { pushMessage, flexMessage } from '@/lib/line';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';
const CLINIC = { name: 'พลอยใสคลินิก', phone: '065-553-9361' };

type PatientRow = {
  id: string;
  hn: string;
  full_name: string;
  line_user_id: string | null;
  birthdate: string | null;
  created_at: string;
};

// GET /api/cron/birthday — รันทุกวัน 08:00 Thai (01:00 UTC)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await hasFeature(CLINIC_ID, 'birthday_reminder'))) {
    return NextResponse.json({ skipped: 'birthday_reminder not enabled' });
  }

  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const todayMon = today.getMonth();
  const todayDay = today.getDate();
  const todayYear = today.getFullYear();

  const { data: patients } = await supabaseAdmin
    .from('patients')
    .select('id, hn, full_name, line_user_id, birthdate, created_at')
    .eq('clinic_id', CLINIC_ID);

  const results = { birthday_sent: 0, anniversary_sent: 0, errors: 0 };
  const notifications: object[] = [];
  const scheduledAt = today.toISOString();

  for (const p of (patients as PatientRow[]) ?? []) {
    if (!p.line_user_id) continue;

    // วันเกิด
    if (p.birthdate) {
      const bd = new Date(p.birthdate);
      if (bd.getMonth() === todayMon && bd.getDate() === todayDay) {
        const msg = flexMessage(`🎂 สุขสันต์วันเกิด - ${p.full_name}`, {
          type: 'bubble',
          header: {
            type: 'box', layout: 'vertical', backgroundColor: '#e11d48',
            contents: [
              { type: 'text', text: '🎂 สุขสันต์วันเกิด!', color: '#ffffff', weight: 'bold', size: 'xl' },
              { type: 'text', text: CLINIC.name, color: '#ffffff90', size: 'sm' },
            ],
          },
          body: {
            type: 'box', layout: 'vertical',
            contents: [
              { type: 'text', text: `สุขสันต์วันเกิดคุณ ${p.full_name} นะคะ 🎉\nขอให้มีสุขภาพดี สวยงาม และมีความสุขตลอดปีนะคะ 💖`, wrap: true, size: 'sm', color: '#444444' },
            ],
          },
          footer: {
            type: 'box', layout: 'vertical',
            contents: [{ type: 'button', style: 'primary', color: '#e11d48', action: { type: 'message', label: '📅 นัดหมายเลย', text: 'ขอนัดหมาย' } }],
          },
        });
        try {
          await pushMessage(p.line_user_id, [msg]);
          results.birthday_sent++;
          notifications.push({ clinic_id: CLINIC_ID, patient_id: p.id, type: 'marketing', line_user_id: p.line_user_id, message: `สุขสันต์วันเกิด ${p.full_name}`, status: 'sent', scheduled_at: scheduledAt, sent_at: new Date().toISOString() });
        } catch { results.errors++; }
      }
    }

    // ครบรอบ (วันที่ created_at ปีก่อน)
    const created = new Date(p.created_at);
    if (created.getMonth() === todayMon && created.getDate() === todayDay && created.getFullYear() < todayYear) {
      const years = todayYear - created.getFullYear();
      const msg = flexMessage(`🌟 ครบรอบ ${years} ปี - ${p.full_name}`, {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical', backgroundColor: '#7c3aed',
          contents: [
            { type: 'text', text: `🌟 ครบรอบ ${years} ปีแล้วนะคะ!`, color: '#ffffff', weight: 'bold', size: 'lg' },
            { type: 'text', text: CLINIC.name, color: '#ffffff90', size: 'sm' },
          ],
        },
        body: {
          type: 'box', layout: 'vertical',
          contents: [
            { type: 'text', text: `ขอบคุณที่ไว้วางใจ ${CLINIC.name} มา ${years} ปีนะคะ ✨\nยินดีดูแลคุณ ${p.full_name} เสมอค่ะ 💕`, wrap: true, size: 'sm', color: '#444444' },
          ],
        },
        footer: {
          type: 'box', layout: 'vertical',
          contents: [{ type: 'button', style: 'primary', color: '#7c3aed', action: { type: 'message', label: '📅 นัดหมายเลย', text: 'ขอนัดหมาย' } }],
        },
      });
      try {
        await pushMessage(p.line_user_id, [msg]);
        results.anniversary_sent++;
        notifications.push({ clinic_id: CLINIC_ID, patient_id: p.id, type: 'marketing', line_user_id: p.line_user_id, message: `ครบรอบ ${years} ปี ${p.full_name}`, status: 'sent', scheduled_at: scheduledAt, sent_at: new Date().toISOString() });
      } catch { results.errors++; }
    }
  }

  if (notifications.length > 0) {
    await supabaseAdmin.from('notifications').insert(notifications);
  }

  return NextResponse.json({ date: today.toISOString().slice(0, 10), ...results });
}
