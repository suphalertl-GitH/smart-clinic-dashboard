import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/settings
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('clinic_id', CLINIC_ID)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
