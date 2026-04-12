import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTier } from '@/lib/tier';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/promotions
export async function GET() {
  const gate = await requireTier(CLINIC_ID, 'professional');
  if (gate) return gate;
  const { data, error } = await supabaseAdmin
    .from('promotions')
    .select('*')
    .eq('clinic_id', CLINIC_ID)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/promotions — create new
export async function POST(req: NextRequest) {
  const gate = await requireTier(CLINIC_ID, 'professional');
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
        clinic_id: CLINIC_ID,
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
