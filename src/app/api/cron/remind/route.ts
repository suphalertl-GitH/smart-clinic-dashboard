import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { pushMessage, pushGroupMessage, appointmentReminderFlex, textMessage } from '@/lib/line';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';
const CLINIC = { name: 'พลอยใสคลินิก', phone: '065-553-9361' };

// GET /api/cron/remind — เรียกจาก Vercel Cron ทุกวัน 09:00
// vercel.json: { "crons": [{ "path": "/api/cron/remind", "schedule": "0 2 * * *" }] }
// (UTC 02:00 = Thai 09:00)
export async function GET(req: NextRequest) {
  // ป้องกัน unauthorized call
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // หาวันพรุ่งนี้ (Thai timezone)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // ดึงนัดหมายพรุ่งนี้ที่มี line_user_id
    const { data: appointments, error } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('clinic_id', CLINIC_ID)
      .eq('date', tomorrowStr)
      .not('line_user_id', 'is', null);

    if (error) throw error;
    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ sent: 0, message: 'ไม่มีนัดหมายพรุ่งนี้' });
    }

    // เช็คว่าส่งไปแล้วหรือยัง (ป้องกัน duplicate)
    const { data: alreadySent } = await supabaseAdmin
      .from('notifications')
      .select('appointment_id')
      .eq('clinic_id', CLINIC_ID)
      .eq('type', 'reminder')
      .in('appointment_id', appointments.map(a => a.id));

    const sentIds = new Set(alreadySent?.map(n => n.appointment_id) ?? []);

    let sent = 0;
    const errors: string[] = [];

    for (const appt of appointments) {
      if (sentIds.has(appt.id)) continue; // ส่งไปแล้ว ข้ามได้เลย

      try {
        const dateObj = new Date(appt.date);
        const dateStr = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

        const message = appointmentReminderFlex({
          name: appt.name,
          date: dateStr,
          time: appt.time,
          procedure: appt.procedure ?? '',
          clinicName: CLINIC.name,
          clinicPhone: CLINIC.phone,
        });

        await pushMessage(appt.line_user_id!, [message]);

        await supabaseAdmin.from('notifications').insert({
          clinic_id: CLINIC_ID,
          appointment_id: appt.id,
          patient_id: appt.patient_id,
          line_user_id: appt.line_user_id!,
          type: 'reminder',
          message: JSON.stringify(message),
          status: 'sent',
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        });

        sent++;
      } catch (err: any) {
        errors.push(`${appt.name}: ${err.message}`);
        // บันทึก failed
        await supabaseAdmin.from('notifications').insert({
          clinic_id: CLINIC_ID,
          appointment_id: appt.id,
          line_user_id: appt.line_user_id!,
          type: 'reminder',
          message: '',
          status: 'failed',
          scheduled_at: new Date().toISOString(),
        });
      }
    }

    // ส่งสรุปตารางพรุ่งนี้เข้า LINE Group
    const total = appointments.length;
    const lines = appointments.map(a => `  • ${a.time} น. — ${a.name}${a.procedure ? ` (${a.procedure})` : ''}`).join('\n');
    const dateLabel = new Date(tomorrowStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    await pushGroupMessage([textMessage(
      `📋 ตารางนัดพรุ่งนี้ (${dateLabel})\nทั้งหมด ${total} คิว\n${lines}\n\nส่งแจ้งเตือนลูกค้าแล้ว ${sent} คน`
    )]).catch(() => {});

    return NextResponse.json({ success: true, sent, errors, date: tomorrowStr });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
