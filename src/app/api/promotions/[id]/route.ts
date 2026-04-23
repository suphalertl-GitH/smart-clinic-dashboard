import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireFeature } from '@/lib/tier';
import { getClinicId } from '@/lib/auth';

// PATCH /api/promotions/[id] — update fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(clinicId, 'promotions');
  if (gate) return gate;
  try {
    const body = await req.json();
    const { id } = await params;

    // Only allow updating these fields
    const allowed = ['title', 'description', 'price', 'valid_from', 'valid_until', 'is_active'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    const { data, error } = await supabaseAdmin
      .from('promotions')
      .update(update)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/promotions/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(clinicId, 'promotions');
  if (gate) return gate;
  const { id } = await params;
  const { error } = await supabaseAdmin
    .from('promotions')
    .delete()
    .eq('id', id)
    .eq('clinic_id', clinicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
