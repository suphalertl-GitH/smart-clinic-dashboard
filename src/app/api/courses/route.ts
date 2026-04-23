import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { requireFeature } from '@/lib/tier';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/courses?status=active&search=
export async function GET(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(CLINIC_ID, 'course_tracker');
  if (gate) return gate;

  const status = req.nextUrl.searchParams.get('status') ?? 'active';
  const search = req.nextUrl.searchParams.get('search') ?? '';

  let query = supabaseAdmin
    .from('treatment_courses')
    .select('*')
    .eq('clinic_id', CLINIC_ID)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') query = query.eq('status', status);
  if (search) query = query.or(`hn.ilike.%${search}%,patient_name.ilike.%${search}%,treatment_name.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/courses — สร้างคอร์สใหม่
export async function POST(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(CLINIC_ID, 'course_tracker');
  if (gate) return gate;

  const body = await req.json();
  const { hn, patient_name, patient_id, treatment_name, total_sessions, price, notes, started_at, expires_at } = body;

  if (!hn || !patient_name || !treatment_name || !total_sessions) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('treatment_courses')
    .insert({
      clinic_id: CLINIC_ID,
      patient_id: patient_id ?? null,
      hn,
      patient_name,
      treatment_name,
      total_sessions: Number(total_sessions),
      price: Number(price) || 0,
      notes: notes ?? null,
      started_at: started_at ?? new Date().toISOString().slice(0, 10),
      expires_at: expires_at ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
