import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getClinicId } from '@/lib/auth';

// GET /api/sales-targets — return map ของ target ต่อ sales_name ในคลินิก
export async function GET() {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('sales_targets')
    .select('sales_name, target')
    .eq('clinic_id', clinicId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targets: Record<string, number> = {};
  for (const r of data ?? []) targets[r.sales_name] = Number(r.target);
  return NextResponse.json({ targets });
}

// PUT /api/sales-targets — upsert target สำหรับ sales_name
export async function PUT(req: NextRequest) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { sales_name?: string; target?: number } | null;
  const salesName = body?.sales_name?.trim();
  const target = Number(body?.target);
  if (!salesName || !Number.isFinite(target) || target < 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('sales_targets')
    .upsert(
      { clinic_id: clinicId, sales_name: salesName, target, updated_at: new Date().toISOString() },
      { onConflict: 'clinic_id,sales_name' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
