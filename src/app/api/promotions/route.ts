import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireFeature } from '@/lib/tier';
import { getClinicId } from '@/lib/auth';

// GET /api/promotions
export async function GET() {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(clinicId, 'promotions');
  if (gate) return gate;
  const { data, error } = await supabaseAdmin
    .from('promotions')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/promotions — create new
export async function POST(req: NextRequest) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(clinicId, 'promotions');
  if (gate) return gate;
  try {
    const body = await req.json();
    const { title, description, price, valid_from, valid_until, is_active } = body;

    if (!title || !valid_from || !valid_until) {
      return NextResponse.json({ error: 'title, valid_from, valid_until are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('promotions')
      .insert({
        clinic_id: clinicId,
        title: title.trim(),
        description: description?.trim() ?? null,
        price: price?.trim() ?? null,
        valid_from,
        valid_until,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
