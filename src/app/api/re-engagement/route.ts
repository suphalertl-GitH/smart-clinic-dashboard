import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getClinicContext } from '@/lib/auth';
import { requireFeature } from '@/lib/tier';
import { pushMessage, flexMessage } from '@/lib/line';

type PatientRow = {
  id: string;
  hn: string;
  full_name: string;
  phone: string;
  line_user_id: string | null;
};

type VisitRow = {
  patient_id: string;
  created_at: string;
};

// GET /api/re-engagement?days=90
// คืน list คนไข้ที่ไม่มา visit เกิน N วัน
export async function GET(req: NextRequest) {
  const ctx = await getClinicContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { clinicId } = ctx;
  const gate = await requireFeature(clinicId, 're_engagement');
  if (gate) return gate;

  const days = Math.max(1, parseInt(req.nextUrl.searchParams.get('days') ?? '90'));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // ดึง patients ทั้งหมด + last visit แยก แล้ว join ใน JS
  const [{ data: patients }, { data: visits }] = await Promise.all([
    supabaseAdmin
      .from('patients')
      .select('id, hn, full_name, phone, line_user_id')
      .eq('clinic_id', clinicId)
      .order('full_name'),
    supabaseAdmin
      .from('visits')
      .select('patient_id, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false }),
  ]);

  // หา last_visit per patient
  const lastVisitMap: Record<string, string> = {};
  for (const v of (visits as VisitRow[]) ?? []) {
    if (!lastVisitMap[v.patient_id]) lastVisitMap[v.patient_id] = v.created_at;
  }

  const lapsed = ((patients as PatientRow[]) ?? [])
    .map(p => {
      const lastVisit = lastVisitMap[p.id] ?? null;
      const daysSince = lastVisit
        ? Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86_400_000)
        : null;
      return { ...p, last_visit: lastVisit, days_since: daysSince };
    })
    .filter(p => p.days_since === null || p.days_since >= days)
    .sort((a, b) => (b.days_since ?? 99999) - (a.days_since ?? 99999));

  return NextResponse.json({ days, count: lapsed.length, patients: lapsed });
}

// POST /api/re-engagement — ส่ง LINE ให้คนไข้ที่เลือก
export async function POST(req: NextRequest) {
  const ctx = await getClinicContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { clinicId, clinicName, clinicPhone } = ctx;
  const gate = await requireFeature(clinicId, 're_engagement');
  if (gate) return gate;

  const body = await req.json() as {
    patient_ids: string[];
    message_template: string;
  };

  if (!Array.isArray(body.patient_ids) || body.patient_ids.length === 0) {
    return NextResponse.json({ error: 'ไม่มีคนไข้ที่เลือก' }, { status: 400 });
  }

  const { data: patients } = await supabaseAdmin
    .from('patients')
    .select('id, hn, full_name, line_user_id')
    .eq('clinic_id', clinicId)
    .in('id', body.patient_ids);

  const scheduledAt = new Date().toISOString();
  const results = { sent: 0, skipped: 0, errors: 0 };
  const notifications: object[] = [];

  for (const p of (patients as PatientRow[]) ?? []) {
    if (!p.line_user_id) { results.skipped++; continue; }

    const msgText = body.message_template
      .replace('{name}', p.full_name)
      .replace('{hn}', p.hn)
      .replace('{clinic}', clinicName)
      .replace('{phone}', clinicPhone);

    const lineMsg = flexMessage(`${clinicName} — นัดมาดูแลตัวเองนะคะ`, {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#0f4c5c',
        contents: [
          { type: 'text', text: '💌 ข่าวสารจากคลินิก', color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: clinicName, color: '#ffffff80', size: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: `สวัสดีคุณ ${p.full_name} 😊`, weight: 'bold', size: 'md' },
          { type: 'text', text: msgText, wrap: true, color: '#555555', size: 'sm' },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: `📞 ติดต่อ: ${clinicPhone}`, color: '#888888', size: 'xs', margin: 'md' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'button', style: 'primary', color: '#0f4c5c',
            action: { type: 'message', label: '📅 นัดหมายเลย', text: 'ขอนัดหมาย' } },
        ],
      },
    });

    try {
      await pushMessage(p.line_user_id, [lineMsg]);
      results.sent++;
      notifications.push({
        clinic_id: clinicId,
        patient_id: p.id,
        type: 'marketing',
        line_user_id: p.line_user_id,
        message: msgText,
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
