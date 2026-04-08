import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { pushMessage, textMessage } from '@/lib/line';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/crm/campaigns — ดึงรายการ campaigns + preview กลุ่มเป้าหมาย
export async function GET(req: NextRequest) {
  const preview = req.nextUrl.searchParams.get('preview');
  const targetTier = req.nextUrl.searchParams.get('tier') ?? null;
  const targetTreatment = req.nextUrl.searchParams.get('treatment') ?? null;
  const minDays = req.nextUrl.searchParams.get('minDays');

  if (preview === '1') {
    // นับจำนวนคนที่จะได้รับ campaign
    const count = await countTargets({ targetTier, targetTreatment, minDays: minDays ? parseInt(minDays) : null });
    return NextResponse.json({ count });
  }

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('clinic_id', CLINIC_ID)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/crm/campaigns — สร้าง campaign ใหม่และส่ง LINE ทันที
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, message, targetTier, targetTreatment, minDays } = body;

    if (!name || !message) {
      return NextResponse.json({ error: 'name และ message จำเป็น' }, { status: 400 });
    }

    // หากลุ่มเป้าหมาย
    const targets = await getTargets({ targetTier, targetTreatment, minDays: minDays ?? null });

    // สร้าง campaign record
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('campaigns')
      .insert({
        clinic_id: CLINIC_ID,
        name,
        message,
        target_tier: targetTier ?? null,
        target_treatment: targetTreatment ?? null,
        target_min_days_since_visit: minDays ?? null,
        sent_count: 0,
      })
      .select()
      .single();

    if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });

    // ส่ง LINE ให้ทุกคนในกลุ่มเป้าหมาย (background, ไม่รอ)
    let sentCount = 0;
    for (const patient of targets) {
      if (!patient.line_user_id) continue;
      try {
        await pushMessage(patient.line_user_id, [textMessage(message)]);
        sentCount++;

        // บันทึกใน notifications
        await supabaseAdmin.from('notifications').insert({
          clinic_id: CLINIC_ID,
          appointment_id: null,
          patient_id: null,
          line_user_id: patient.line_user_id,
          type: 'marketing',
          message,
          status: 'sent',
          scheduled_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        });
      } catch { /* ข้ามถ้าส่งไม่ได้ */ }
    }

    // อัปเดต sent_count
    await supabaseAdmin
      .from('campaigns')
      .update({ sent_count: sentCount, sent_at: new Date().toISOString() })
      .eq('id', campaign.id);

    return NextResponse.json({ success: true, sentCount, campaignId: campaign.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function getTargets(filters: {
  targetTier: string | null;
  targetTreatment: string | null;
  minDays: number | null;
}) {
  let query = supabaseAdmin
    .from('patients')
    .select('hn, full_name, line_user_id, loyalty_tier')
    .eq('clinic_id', CLINIC_ID)
    .not('line_user_id', 'is', null);

  if (filters.targetTier) {
    query = query.eq('loyalty_tier', filters.targetTier);
  }

  const { data: patients } = await query;
  if (!patients) return [];

  // กรอง minDays (คนที่ไม่มา >= N วัน)
  if (filters.minDays && filters.minDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.minDays);
    const { data: recentVisits } = await supabaseAdmin
      .from('visits')
      .select('hn')
      .eq('clinic_id', CLINIC_ID)
      .gte('created_at', cutoff.toISOString());

    const recentHns = new Set((recentVisits ?? []).map(v => v.hn));
    return patients.filter(p => !recentHns.has(p.hn));
  }

  // กรอง treatment (เคยทำ treatment นี้)
  if (filters.targetTreatment) {
    const { data: treatVisits } = await supabaseAdmin
      .from('visits')
      .select('hn')
      .eq('clinic_id', CLINIC_ID)
      .ilike('treatment_name', `%${filters.targetTreatment}%`);

    const treatHns = new Set((treatVisits ?? []).map(v => v.hn));
    return patients.filter(p => treatHns.has(p.hn));
  }

  return patients;
}

async function countTargets(filters: {
  targetTier: string | null;
  targetTreatment: string | null;
  minDays: number | null;
}) {
  const targets = await getTargets(filters);
  return targets.filter(p => p.line_user_id).length;
}
