import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isSuperAdmin } from '@/lib/auth';

// PATCH /api/admin/clinics/[id] — อัพเดต tier / is_active / subscription_expires_at
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { tier, is_active, subscription_expires_at } = body;

  const updates: Record<string, unknown> = {};
  if (tier !== undefined) updates.tier = tier;
  if (is_active !== undefined) updates.is_active = is_active;
  if (subscription_expires_at !== undefined) updates.subscription_expires_at = subscription_expires_at;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('clinics')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clinic: data });
}
