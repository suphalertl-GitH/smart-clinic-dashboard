import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// PUT /api/appointments/[id] — แก้ไขนัดหมาย
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { date, time, name, hn, phone, salesName, status, procedure, note, overrideReason } = body;

    // เช็คคิวซ้ำ (ยกเว้น record ปัจจุบัน)
    if (!overrideReason && date && time) {
      const { data: conflict } = await supabaseAdmin
        .from('appointments')
        .select('id, name')
        .eq('clinic_id', CLINIC_ID)
        .eq('date', date)
        .eq('time', time)
        .neq('id', id);

      if (conflict && conflict.length > 0) {
        return NextResponse.json({
          success: false,
          isConflict: true,
          conflictNames: conflict.map(c => c.name),
          message: 'เวลานี้มีคิวจองแล้ว',
        });
      }
    }

    const finalNote = overrideReason ? `${note ? note + ' | ' : ''}[แทรกคิว: ${overrideReason}]` : (note ?? undefined);

    const updateData: Record<string, any> = {};
    if (date) updateData.date = date;
    if (time) updateData.time = time;
    if (name !== undefined) updateData.name = name;
    if (hn !== undefined) updateData.hn = hn;
    if (phone !== undefined) updateData.phone = phone;
    if (salesName !== undefined) updateData.sales_name = salesName;
    if (status !== undefined) updateData.status = status;
    if (procedure !== undefined) updateData.procedure = procedure;
    if (finalNote !== undefined) updateData.note = finalNote;

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .eq('clinic_id', CLINIC_ID)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, appointment: data, message: `แก้ไขข้อมูลคุณ ${data.name} สำเร็จ ✅` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/appointments/[id] — ยกเลิกนัดหมาย
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { data: appt } = await supabaseAdmin
      .from('appointments')
      .select('name')
      .eq('id', id)
      .eq('clinic_id', CLINIC_ID)
      .single();

    const { error } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('clinic_id', CLINIC_ID);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: `ยกเลิกนัดคุณ ${appt?.name ?? ''} เรียบร้อย 🗑️` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
