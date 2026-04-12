import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isSuperAdmin } from '@/lib/auth';

// GET /api/admin/clinics — list all clinics with stats
export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getSupabaseAdmin();

  const { data: clinics, error } = await db
    .from('clinics')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // เพิ่ม stats ต่อ clinic
  const enriched = await Promise.all(
    (clinics ?? []).map(async (clinic) => {
      const [{ count: patient_count }, { data: visits }] = await Promise.all([
        db.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
        db.from('visits').select('price').eq('clinic_id', clinic.id),
      ]);
      const total_revenue = (visits ?? []).reduce((sum, v) => sum + (v.price ?? 0), 0);
      return {
        ...clinic,
        patient_count: patient_count ?? 0,
        visit_count: visits?.length ?? 0,
        total_revenue,
      };
    })
  );

  return NextResponse.json({ clinics: enriched });
}

// POST /api/admin/clinics — สร้าง clinic ใหม่ + admin user
export async function POST(req: NextRequest) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { name, phone, address, owner_email, owner_password, tier } = body;

  if (!name || !phone || !address || !owner_email || !owner_password || !tier) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // 1. สร้าง clinic record
  const { data: clinic, error: clinicErr } = await db
    .from('clinics')
    .insert({
      name,
      phone,
      address,
      tier,
      owner_email,
      is_active: true,
    })
    .select()
    .single();

  if (clinicErr) return NextResponse.json({ error: clinicErr.message }, { status: 500 });

  // 2. สร้าง Supabase auth user
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: owner_email,
    password: owner_password,
    email_confirm: true,
    user_metadata: { role: 'clinic_admin', clinic_id: clinic.id },
  });

  if (authErr) {
    // rollback clinic
    await db.from('clinics').delete().eq('id', clinic.id);
    return NextResponse.json({ error: authErr.message }, { status: 500 });
  }

  // 3. link user → clinic
  await db.from('clinic_users').insert({
    user_id: authUser.user.id,
    clinic_id: clinic.id,
  });

  // 4. default settings
  await db.from('settings').insert({
    clinic_id: clinic.id,
    sales_names: [],
    doctor_names: [],
    time_slots: ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'],
    treatment_cycles: [
      { treatment: 'Botox', days: 120 },
      { treatment: 'Filler', days: 365 },
      { treatment: 'Sculptra', days: 540 },
    ],
  });

  return NextResponse.json({ clinic, user_id: authUser.user.id });
}
