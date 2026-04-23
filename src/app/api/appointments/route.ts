import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { pushGroupMessage, textMessage } from '@/lib/line';
import { getClinicId } from '@/lib/auth';

// GET /api/appointments?date=2024-01-01
export async function GET(req: NextRequest) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = req.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('date', date)
    .order('time', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/appointments — เพิ่มคิวใหม่
export async function POST(req: NextRequest) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { date, time, name, hn, phone, salesName, status, procedure, note, overrideReason } = body;

    if (!date || !time || !name || !phone) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    // เช็คคิวซ้ำ
    if (!overrideReason) {
      const { data: conflict } = await supabaseAdmin
        .from('appointments')
        .select('id, name')
        .eq('clinic_id', clinicId)
        .eq('date', date)
        .eq('time', time);

      if (conflict && conflict.length > 0) {
        return NextResponse.json({
          success: false,
          isConflict: true,
          conflictNames: conflict.map(c => c.name),
          message: 'เวลานี้มีคิวจองแล้ว',
        });
      }
    }

    // หา patient_id ถ้ามี HN
    let patientId: string | null = null;
    if (hn) {
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('hn', hn)
        .single();
      if (patient) patientId = patient.id;
    }

    const finalNote = overrideReason ? `${note ? note + ' | ' : ''}[แทรกคิว: ${overrideReason}]` : (note || null);

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        hn: hn || null,
        name,
        phone,
        sales_name: salesName || null,
        status: status || 'new',
        date,
        time,
        procedure: procedure || null,
        note: finalNote,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // แจ้ง LINE Group
    const salesTag = salesName ? ` (${salesName})` : '';
    const procTag = procedure ? ` — ${procedure}` : '';
    pushGroupMessage([textMessage(
      `📅 นัดใหม่${salesTag}\n👤 ${name}  📞 ${phone}\n🕐 ${date} ${time} น.${procTag}`
    )]).catch(() => {}); // fire-and-forget

    return NextResponse.json({ success: true, appointment: data, message: `บันทึกคิวคุณ ${name} สำเร็จ ✅` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
