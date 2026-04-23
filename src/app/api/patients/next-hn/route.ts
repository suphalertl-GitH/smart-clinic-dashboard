import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getClinicId } from '@/lib/auth';

// GET /api/patients/next-hn
export async function GET() {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabaseAdmin
    .from('patients')
    .select('hn')
    .eq('clinic_id', clinicId)
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
