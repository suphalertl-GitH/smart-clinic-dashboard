import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getClinicId } from '@/lib/auth';

// GET /api/visits?hn=HN00001&date=2024-01-01
export async function GET(req: NextRequest) {
  const clinic_id = await getClinicId();
  if (!clinic_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hn = req.nextUrl.searchParams.get('hn');
  const date = req.nextUrl.searchParams.get('date');

  if (!hn) return NextResponse.json({ error: 'hn required' }, { status: 400 });

  let query = supabaseAdmin
    .from('visits')
    .select('id, hn, treatment_name, price, doctor, sales_name, payment_method, created_at')
    .eq('clinic_id', clinic_id)
    .eq('hn', hn);

  if (date) {
    // กรองเฉพาะวันที่กำหนด (created_at ช่วงนั้น)
    const start = `${date}T00:00:00+07:00`;
    const end = `${date}T23:59:59+07:00`;
    query = query.gte('created_at', start).lte('created_at', end);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/visits — บันทึก visit ใหม่
export async function POST(req: NextRequest) {
  try {
    const clinic_id = await getClinicId();
    if (!clinic_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { hn, fullName, phone, treatmentName, price, salesName, doctor, customerType, paymentMethod, apptDate, apptTime, apptTreatmentName } = body;

    if (!hn || !treatmentName || !price) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    // หา patient_id จาก hn
    const { data: patient, error: patientErr } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('clinic_id', clinic_id)
      .eq('hn', hn)
      .single();

    if (patientErr || !patient) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลคนไข้' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('visits')
      .insert({
        clinic_id: clinic_id,
        patient_id: patient.id,
        hn,
        treatment_name: treatmentName,
        price: parseFloat(price),
        doctor: doctor || null,
        sales_name: salesName || null,
        customer_type: customerType || 'returning',
        payment_method: paymentMethod || 'โอน',
        appt_date: apptDate || null,
        appt_time: apptTime || null,
        appt_treatment: apptTreatmentName || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // บวก spending + points + อัป loyalty tier
    const priceNum = parseFloat(price);
    try {
      await supabaseAdmin.rpc('add_visit_spending', {
        p_clinic_id: clinic_id,
        p_hn: hn,
        p_amount: priceNum,
      });
    } catch { /* ข้ามถ้า RPC ยังไม่มี */ }

    // ส่ง satisfaction survey ผ่าน LINE (ถ้าคนไข้ลง LINE ไว้)
    const { data: patientLine } = await supabaseAdmin
      .from('patients')
      .select('line_user_id, full_name, loyalty_tier')
      .eq('clinic_id', clinic_id)
      .eq('hn', hn)
      .single();

    if (patientLine?.line_user_id) {
      const { pushMessage, flexMessage } = await import('@/lib/line');
      const tierMap: Record<string, string> = { platinum: '💎 Platinum', gold: '🥇 Gold', silver: '🥈 Silver', bronze: '🥉 Bronze' };
      const tierLabel = tierMap[patientLine.loyalty_tier ?? 'bronze'] ?? '🥉 Bronze';
      const surveyMsg = flexMessage('ช่วยให้คะแนนบริการของเราหน่อยนะคะ 🙏', {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical', backgroundColor: '#4F46E5',
          contents: [
            { type: 'text', text: '⭐ ประเมินความพึงพอใจ', color: '#ffffff', weight: 'bold', size: 'md' },
            { type: 'text', text: 'ขอบคุณที่มาใช้บริการนะคะ', color: '#c7d2fe', size: 'sm' },
          ],
        },
        body: {
          type: 'box', layout: 'vertical', spacing: 'sm',
          contents: [
            { type: 'text', text: `${tierLabel} | คุณ${patientLine.full_name}`, weight: 'bold', size: 'sm' },
            { type: 'text', text: `บริการ: ${treatmentName}`, color: '#555555', size: 'sm', wrap: true },
            { type: 'text', text: 'ให้คะแนนบริการวันนี้ได้เลยค่ะ 👇', color: '#888888', size: 'xs', margin: 'md' },
          ],
        },
        footer: {
          type: 'box', layout: 'horizontal', spacing: 'sm',
          contents: [1, 2, 3, 4, 5].map(s => ({
            type: 'button', style: s >= 4 ? 'primary' : 'secondary',
            color: s >= 4 ? '#4F46E5' : undefined,
            action: { type: 'message', label: `${'⭐'.repeat(s)}`, text: `survey:${s}:${data.id}` },
            flex: 1,
          })),
        },
      });
      pushMessage(patientLine.line_user_id, [surveyMsg]).catch(() => {});
    }

    // ถ้ามีนัดหมายครั้งหน้า — สร้าง appointment ด้วย
    if (apptDate && apptTime) {
      await supabaseAdmin.from('appointments').insert({
        clinic_id: clinic_id,
        patient_id: patient.id,
        hn,
        name: fullName,
        phone,
        sales_name: salesName || null,
        status: 'returning',
        date: apptDate,
        time: apptTime,
        procedure: apptTreatmentName || null,
      });
    }

    return NextResponse.json({ success: true, visit: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
