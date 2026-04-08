import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/visits?hn=HN00001&date=2024-01-01
export async function GET(req: NextRequest) {
  const hn = req.nextUrl.searchParams.get('hn');
  const date = req.nextUrl.searchParams.get('date');

  if (!hn) return NextResponse.json({ error: 'hn required' }, { status: 400 });

  let query = supabaseAdmin
    .from('visits')
    .select('id, hn, treatment_name, price, doctor, sales_name, payment_method, created_at')
    .eq('clinic_id', CLINIC_ID)
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
    const body = await req.json();
    const { hn, fullName, phone, treatmentName, price, salesName, doctor, customerType, paymentMethod, apptDate, apptTime, apptTreatmentName } = body;

    if (!hn || !treatmentName || !price) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    // หา patient_id จาก hn
    const { data: patient, error: patientErr } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('clinic_id', CLINIC_ID)
      .eq('hn', hn)
      .single();

    if (patientErr || !patient) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลคนไข้' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('visits')
      .insert({
        clinic_id: CLINIC_ID,
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

    // บวก points: 1 แต้ม ต่อ 100 บาท
    const earnedPoints = Math.floor(parseFloat(price) / 100);
    if (earnedPoints > 0) {
      await supabaseAdmin.rpc('increment_patient_points', {
        p_clinic_id: CLINIC_ID,
        p_hn: hn,
        p_points: earnedPoints,
      }).catch(() => {}); // ถ้า RPC ยังไม่มี ก็ข้ามไป
    }

    // ถ้ามีนัดหมายครั้งหน้า — สร้าง appointment ด้วย
    if (apptDate && apptTime) {
      await supabaseAdmin.from('appointments').insert({
        clinic_id: CLINIC_ID,
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
