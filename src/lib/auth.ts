import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from './supabase';

function makeSupabaseServerClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // เรียกจาก Server Component — middleware จัดการ refresh session แทน
          }
        },
      },
    }
  );
}

const ACTIVE_CLINIC_COOKIE = 'active_clinic_id';

/** ดึง clinic_id list ของ admin ที่ login อยู่ (รองรับ user ที่ผูกกับหลายคลินิก) */
export async function getClinicIds(): Promise<string[]> {
  const cookieStore = await cookies();
  const supabase = makeSupabaseServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await getSupabaseAdmin()
    .from('clinic_users')
    .select('clinic_id')
    .eq('user_id', user.id);

  return (data ?? []).map(r => r.clinic_id).filter(Boolean);
}

/** ดึง clinic_id ที่ active อยู่ (อ่านจาก cookie ถ้า user ผูกกับหลายคลินิก) คืน null ถ้าไม่มี session หรือไม่มีคลินิก */
export async function getClinicId(): Promise<string | null> {
  const cookieStore = await cookies();
  const ids = await getClinicIds();
  if (ids.length === 0) return null;

  const active = cookieStore.get(ACTIVE_CLINIC_COOKIE)?.value;
  if (active && ids.includes(active)) return active;
  return ids[0];
}

export type ClinicContext = { clinicId: string; clinicName: string; clinicPhone: string };

/** ดึง clinic_id + name + phone ของคลินิกที่ active สำหรับ route ที่ต้องส่ง LINE message */
export async function getClinicContext(): Promise<ClinicContext | null> {
  const clinicId = await getClinicId();
  if (!clinicId) return null;

  const { data } = await getSupabaseAdmin()
    .from('clinics')
    .select('id, name, phone')
    .eq('id', clinicId)
    .single();

  if (!data) return null;
  return {
    clinicId: data.id,
    clinicName: data.name ?? '',
    clinicPhone: data.phone ?? '',
  };
}

/** ดึง user object ของ session ปัจจุบัน */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = makeSupabaseServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** ตรวจสอบว่า user ปัจจุบันเป็น Super Admin หรือไม่ */
export async function isSuperAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  return user.user_metadata?.role === 'super_admin';
}
