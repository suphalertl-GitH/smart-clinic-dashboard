import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/patients/next-hn
export async function GET() {
  const { data } = await supabaseAdmin
    .from('patients')
    .select('hn')
    .eq('clinic_id', CLINIC_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let nextNum = 1;
  if (data?.hn) {
    const match = data.hn.match(/(\d+)/);
    if (match) nextNum = parseInt(match[0]) + 1;
  }

  return NextResponse.json({ hn: 'HN' + nextNum.toString().padStart(5, '0') });
}
