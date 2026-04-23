import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { requireFeature } from '@/lib/tier';
import { pushMessage, flexMessage } from '@/lib/line';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';
const CLINIC = { name: 'พลอยใสคลินิก', phone: '065-553-9361' };

type PatientRow = {
  id: string;
  hn: string;
  full_name: string;
  phone: string;
  line_user_id: string | null;
  birthdate: string | null;
  created_at: string;
};

function upcomingDays(dateStr: string, windowDays: number): number | null {
  const today = new Date();
  const ref = new Date(dateStr);
  const thisYear = new Date(today.getFullYear(), ref.getMonth(), ref.getDate());
  const nextYear = new Date(today.getFullYear() + 1, ref.getMonth(), ref.getDate());
  const diffThis = Math.floor((thisYear.getTime() - today.getTime()) / 86_400_000);
  const diffNext = Math.floor((nextYear.getTime() - today.getTime()) / 86_400_000);
  if (diffThis >= 0 && diffThis <= windowDays) return diffThis;
  if (diffNext >= 0 && diffNext <= windowDays) return diffNext;
  return null;
}

// GET /api/birthday?range=30 — upcoming birthdays + anniversaries
export async function GET(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(CLINIC_ID, 'birthday_reminder');
  if (gate) return gate;

  const range = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get('range') ?? '30')));

  const { data: patients } = await supabaseAdmin
    .from('patients')
    .select('id, hn, full_name, phone, line_user_id, birthdate, created_at')
    .eq('clinic_id', CLINIC_ID);

  const birthdays: (PatientRow & { days_until: number })[] = [];
  const anniversaries: (PatientRow & { days_until: number; years: number })[] = [];
  const today = new Date();

  for (const p of (patients as PatientRow[]) ?? []) {
    if (p.birthdate) {
      const days = upcomingDays(p.birthdate, range);
      if (days !== null) birthdays.push({ ...p, days_until: days });
    }
    // Anniversary — ครบรอบปีที่มาคลินิก (ต้องมีอายุ >= 1 ปี)
    const createdYear = new Date(p.created_at).getFullYear();
    if (today.getFullYear() > createdYear) {
      const days = upcomingDays(p.created_at, range);
      if (days !== null) {
        anniversaries.push({ ...p, days_until: days, years: today.getFullYear() - createdYear });
      }
    }
  }

  birthdays.sort((a, b) => a.days_until - b.days_until);
  anniversaries.sort((a, b) => a.days_until - b.days_until);

  return NextResponse.json({ range, birthdays, anniversaries });
}

// POST /api/birthday — ส่ง LINE อวยพร
export async function POST(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(CLINIC_ID, 'birthday_reminder');
  if (gate) return gate;

  const body = await req.json() as {
    patient_ids: string[];
    type: 'birthday' | 'anniversary';
  };

  if (!Array.isArray(body.patient_ids) || body.patient_ids.length === 0) {
    return NextResponse.json({ error: 'ไม่มีคนไข้ที่เลือก' }, { status: 400 });
  }

  const { data: patients } = await supabaseAdmin
    .from('patients')
    .select('id, hn, full_name, line_user_id')
    .eq('clinic_id', CLINIC_ID)
    .in('id', body.patient_ids);

  const isBirthday = body.type === 'birthday';
  const results = { sent: 0, skipped: 0, errors: 0 };
  const notifications: object[] = [];
  const scheduledAt = new Date().toISOString();

  for (const p of (patients as PatientRow[]) ?? []) {
    if (!p.line_user_id) { results.skipped++; continue; }

    const headerText = isBirthday ? '🎂 สุขสันต์วันเกิด!' : '🌟 ครบรอบพิเศษ!';
    const bodyText = isBirthday
      ? `สุขสันต์วันเกิดคุณ ${p.full_name} นะคะ 🎉\nขอให้มีสุขภาพดี สวยงาม และมีความสุขตลอดปีนะคะ 💖`
      : `ขอบคุณที่ไว้วางใจ ${CLINIC.name} ตลอดมานะคะ ✨\nยินดีดูแลคุณ ${p.full_name} เสมอค่ะ 💕`;
    const headerColor = isBirthday ? '#e11d48' : '#7c3aed';

    const msg = flexMessage(`${headerText} - ${p.full_name}`, {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: headerColor,
        contents: [
          { type: 'text', text: headerText, color: '#ffffff', weight: 'bold', size: 'xl' },
          { type: 'text', text: CLINIC.name, color: '#ffffff90', size: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: bodyText, wrap: true, size: 'sm', color: '#444444' },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: `📞 ${CLINIC.phone}`, color: '#888888', size: 'xs', margin: 'md' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'button', style: 'primary', color: headerColor,
            action: { type: 'message', label: '📅 นัดหมายเลย', text: 'ขอนัดหมาย' } },
        ],
      },
    });

    try {
      await pushMessage(p.line_user_id, [msg]);
      results.sent++;
      notifications.push({
        clinic_id: CLINIC_ID,
        patient_id: p.id,
        type: 'marketing',
        line_user_id: p.line_user_id,
        message: bodyText,
        status: 'sent',
        scheduled_at: scheduledAt,
        sent_at: new Date().toISOString(),
      });
    } catch {
      results.errors++;
    }
  }

  if (notifications.length > 0) {
    await supabaseAdmin.from('notifications').insert(notifications);
  }

  return NextResponse.json(results);
}
