import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getClinicId } from '@/lib/auth';
import { requireFeature } from '@/lib/tier';

// PATCH /api/courses/[id] — บันทึกครั้งการรักษา
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(clinicId, 'course_tracker');
  if (gate) return gate;

  const { id } = await params;
  const body = await req.json() as { doctor?: string; notes?: string; session_date?: string };

  // ดึง course ปัจจุบัน
  const { data: course, error: fetchErr } = await supabaseAdmin
    .from('treatment_courses')
    .select('completed_sessions, total_sessions, status')
    .eq('id', id)
    .eq('clinic_id', clinicId)
    .single();

  if (fetchErr || !course) return NextResponse.json({ error: 'ไม่พบคอร์ส' }, { status: 404 });
  if (course.status !== 'active') return NextResponse.json({ error: 'คอร์สนี้ปิดแล้ว' }, { status: 400 });
  if (course.completed_sessions >= course.total_sessions) {
    return NextResponse.json({ error: 'ครบจำนวนครั้งแล้ว' }, { status: 400 });
  }

  const newCompleted = course.completed_sessions + 1;
  const newStatus = newCompleted >= course.total_sessions ? 'completed' : 'active';

  // บันทึก session log + อัปเดต course พร้อมกัน
  const [sessionResult, updateResult] = await Promise.all([
    supabaseAdmin.from('course_sessions').insert({
      course_id: id,
      clinic_id: clinicId,
      doctor: body.doctor ?? null,
      notes: body.notes ?? null,
      session_date: body.session_date ?? new Date().toISOString().slice(0, 10),
    }),
    supabaseAdmin
      .from('treatment_courses')
      .update({ completed_sessions: newCompleted, status: newStatus })
      .eq('id', id)
      .select()
      .single(),
  ]);

  if (sessionResult.error) return NextResponse.json({ error: sessionResult.error.message }, { status: 500 });
  if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

  return NextResponse.json(updateResult.data);
}
