import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isSuperAdmin } from '@/lib/auth';

// GET /api/admin/clinics/[id]/users
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = getSupabaseAdmin();

  // Get clinic (for owner_email fallback)
  const { data: clinic } = await db
    .from('clinics')
    .select('owner_email')
    .eq('id', id)
    .single();

  const { data: links } = await db
    .from('clinic_users')
    .select('user_id')
    .eq('clinic_id', id);

  const linkedUserIds = new Set((links ?? []).map(l => l.user_id));

  // If owner_email exists but no clinic_users rows → find user and auto-link
  if (linkedUserIds.size === 0 && clinic?.owner_email) {
    const { data: allUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const ownerUser = (allUsers?.users ?? []).find(u => u.email === clinic.owner_email);
    if (ownerUser) {
      const { data: alreadyLinked } = await db
        .from('clinic_users')
        .select('id')
        .eq('user_id', ownerUser.id)
        .eq('clinic_id', id)
        .single();
      if (!alreadyLinked) {
        await db.from('clinic_users').insert({ user_id: ownerUser.id, clinic_id: id });
      }
      linkedUserIds.add(ownerUser.id);
    }
  }

  if (linkedUserIds.size === 0) return NextResponse.json({ users: [] });

  const users = await Promise.all(
    [...linkedUserIds].map(async (uid) => {
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

// POST /api/admin/clinics/[id]/users
// If email already exists → link to clinic instead of erroring
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

  const { data: clinic } = await db.from('clinics').select('id, name').eq('id', id).single();
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });

  // Try to create new user
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'clinic_admin', clinic_id: id },
  });

  let userId: string;

  if (authErr) {
    const isAlreadyRegistered =
      authErr.message.toLowerCase().includes('already been registered') ||
      authErr.message.toLowerCase().includes('already registered') ||
      authErr.message.toLowerCase().includes('already exists');

    if (!isAlreadyRegistered) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    // User exists → find and link instead
    const { data: all } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = (all?.users ?? []).find(u => u.email === email);
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบ user นี้ในระบบ' }, { status: 404 });
    }
    userId = existing.id;
  } else {
    userId = authUser.user.id;
  }

  // Link user → clinic (skip if already linked)
  const { data: alreadyLinked } = await db
    .from('clinic_users')
    .select('id')
    .eq('user_id', userId)
    .eq('clinic_id', id)
    .single();
  if (!alreadyLinked) {
    await db.from('clinic_users').insert({ user_id: userId, clinic_id: id });
  }

  return NextResponse.json({ user_id: userId, email });
}
