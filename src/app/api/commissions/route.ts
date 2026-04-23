import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { requireFeature } from '@/lib/tier';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/commissions?month=2026-04
export async function GET(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(CLINIC_ID, 'commission_calculator');
  if (gate) return gate;

  const month = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split('-').map(Number);
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
  const endDate = new Date(year, mon, 0).toISOString().slice(0, 10); // last day of month

  const [{ data: rules }, { data: visits }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from('commission_rules')
      .select('sales_name, rate')
      .eq('clinic_id', CLINIC_ID),
    supabaseAdmin
      .from('visits')
      .select('sales_name, price')
      .eq('clinic_id', CLINIC_ID)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59'),
    supabaseAdmin
      .from('settings')
      .select('sales_names')
      .eq('clinic_id', CLINIC_ID)
      .single(),
  ]);

  const rateMap: Record<string, number> = {};
  for (const r of rules ?? []) rateMap[r.sales_name] = Number(r.rate);

  const salesNames: string[] = settings?.sales_names ?? [];

  // นับจาก visits จริง + รวม sales_names จาก settings
  const statsMap: Record<string, { visits: number; revenue: number }> = {};
  for (const name of salesNames) {
    if (!statsMap[name]) statsMap[name] = { visits: 0, revenue: 0 };
  }
  for (const v of visits ?? []) {
    const name = v.sales_name?.trim() || 'ไม่ระบุ';
    if (!statsMap[name]) statsMap[name] = { visits: 0, revenue: 0 };
    statsMap[name].visits += 1;
    statsMap[name].revenue += Number(v.price) || 0;
  }

  const rows = Object.entries(statsMap).map(([sales_name, s]) => {
    const rate = rateMap[sales_name] ?? 0;
    return {
      sales_name,
      visits: s.visits,
      revenue: s.revenue,
      rate,
      commission: Math.round((s.revenue * rate) / 100),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const totals = rows.reduce(
    (acc, r) => ({ revenue: acc.revenue + r.revenue, commission: acc.commission + r.commission }),
    { revenue: 0, commission: 0 }
  );

  return NextResponse.json({ month, rows, totals });
}

// POST /api/commissions — upsert commission rates
export async function POST(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireFeature(CLINIC_ID, 'commission_calculator');
  if (gate) return gate;

  const body = await req.json() as { sales_name: string; rate: number }[];
  if (!Array.isArray(body)) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const upserts = body.map(({ sales_name, rate }) => ({
    clinic_id: CLINIC_ID,
    sales_name: sales_name.trim(),
    rate: Math.min(100, Math.max(0, Number(rate))),
  }));

  const { error } = await supabaseAdmin
    .from('commission_rules')
    .upsert(upserts, { onConflict: 'clinic_id,sales_name' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
