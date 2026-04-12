import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isSuperAdmin } from '@/lib/auth';

// GET /api/admin/clinics/[id]/users — list users of a clinic
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getSupabaseAdmin();

  const { data: links } = await db
    .from('clinic_users')
    .select('user_id')
    .eq('clinic_id', id);

  const userIds = (links ?? []).map(l => l.user_id);
  if (userIds.length === 0) return NextResponse.json({ users: [] });

  const users = await Promise.all(
    userIds.map(async (uid) => {
      const { data } = await db.auth.admin.getUserById(uid);
      if (!data?.user) return null;
      return {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
        role: data.user.user_metadata?.role ?? 'clinic_admin',
      };
    })
  );

  return NextResponse.json({ users: users.filter(Boolean) });
}

// POST /api/admin/clinics/[id]/users — add new user to existing clinic
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // Verify clinic exists
  const { data: clinic } = await db.from('clinics').select('id, name').eq('id', id).single();
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });

  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'clinic_admin', clinic_id: id },
  });

  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  await db.from('clinic_users').insert({
    user_id: authUser.user.id,
    clinic_id: id,
  });

  return NextResponse.json({ user_id: authUser.user.id, email });
}
