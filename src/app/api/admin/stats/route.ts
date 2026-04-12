import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isSuperAdmin } from '@/lib/auth';

const TIER_PRICE: Record<string, number> = {
  starter: 1490,
  professional: 3990,
  enterprise: 12000,
};

// GET /api/admin/stats — platform-wide stats
export async function GET() {
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getSupabaseAdmin();

  const [
    { data: clinics },
    { count: total_patients },
    { data: visits },
  ] = await Promise.all([
    db.from('clinics').select('tier, is_active, created_at'),
    db.from('patients').select('*', { count: 'exact', head: true }),
    db.from('visits').select('price'),
  ]);

  const total_clinics = clinics?.length ?? 0;
  const active_clinics = clinics?.filter(c => c.is_active !== false).length ?? 0;
  const total_revenue = (visits ?? []).reduce((sum, v) => sum + (v.price ?? 0), 0);

  // MRR estimate
  const tier_counts = { starter: 0, professional: 0, enterprise: 0 };
  (clinics ?? []).forEach(c => {
    if (c.is_active !== false && c.tier in tier_counts) {
      tier_counts[c.tier as keyof typeof tier_counts]++;
    }
  });
  const mrr = Object.entries(tier_counts).reduce(
    (sum, [tier, count]) => sum + (TIER_PRICE[tier] ?? 0) * count, 0
  );

  // new clinics this month
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const new_this_month = clinics?.filter(
    c => new Date(c.created_at) >= thisMonth
  ).length ?? 0;

  return NextResponse.json({
    total_clinics,
    active_clinics,
    total_patients: total_patients ?? 0,
    total_revenue,
    mrr,
    tier_counts,
    new_this_month,
  });
}
