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

/** ดึง clinic_id ของ admin ที่ login อยู่ คืน null ถ้าไม่มี session */
export async function getClinicId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = makeSupabaseServerClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await getSupabaseAdmin()
    .from('clinic_users')
    .select('clinic_id')
    .eq('user_id', user.id)
    .single();

  return data?.clinic_id ?? null;
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
