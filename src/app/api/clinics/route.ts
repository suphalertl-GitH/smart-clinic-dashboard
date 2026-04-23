import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSessionUser, getClinicId } from '@/lib/auth';

// GET /api/clinics — return list ของคลินิกที่ user มีสิทธิ์เข้าถึง + active clinic id
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('clinic_users')
    .select('clinic_id, clinics(id, name)')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clinics = (data ?? []).map((r: any) => {
    const c = Array.isArray(r.clinics) ? r.clinics[0] : r.clinics;
    return { id: c?.id ?? r.clinic_id, name: c?.name ?? 'Clinic' };
  });

  const activeId = await getClinicId();
  return NextResponse.json({ clinics, activeId });
}
