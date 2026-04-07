import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { pushMessage, appointmentReminderFlex } from '@/lib/line';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

const CLINIC = {
  name: 'พลอยใสคลินิก',
  phone: '065-553-9361',
};

// POST /api/notifications/send — ส่งแจ้งเตือนทันที
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, lineUserId, type } = body;

    if (!lineUserId) {
      return NextResponse.json({ error: 'lineUserId required' }, { status: 400 });
    }

    let message;
    if (type === 'reminder' && appointmentId) {
      const { data: appt } = await supabaseAdmin
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (!appt) return NextResponse.json({ error: 'appointment not found' }, { status: 404 });

      const dateObj = new Date(appt.date);
      const dateStr = dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

      message = appointmentReminderFlex({
        name: appt.name,
        date: dateStr,
        time: appt.time,
        procedure: appt.procedure ?? '',
        clinicName: CLINIC.name,
        clinicPhone: CLINIC.phone,
      });
    } else {
      return NextResponse.json({ error: 'invalid type' }, { status: 400 });
    }

    await pushMessage(lineUserId, [message]);

    // บันทึกประวัติการส่ง
    await supabaseAdmin.from('notifications').insert({
      clinic_id: CLINIC_ID,
      appointment_id: appointmentId || null,
      line_user_id: lineUserId,
      type,
      message: JSON.stringify(message),
      status: 'sent',
      scheduled_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/notifications — ดูประวัติการแจ้งเตือน
export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('clinic_id', CLINIC_ID)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
