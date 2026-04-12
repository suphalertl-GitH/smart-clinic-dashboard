import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireFeature } from '@/lib/tier';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// GET /api/crm — CRM overview + RFM segments
export async function GET() {
  const gate = await requireFeature(CLINIC_ID, 'crm');
  if (gate) return gate;
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

    // ดึงข้อมูลคนไข้ทั้งหมด
    const { data: patients } = await supabaseAdmin
      .from('patients')
      .select('id, hn, full_name, loyalty_tier, points, lifetime_spending, created_at, line_user_id')
      .eq('clinic_id', CLINIC_ID);

    // ดึง visits ทั้งหมด
    const { data: allVisits } = await supabaseAdmin
      .from('visits')
      .select('hn, price, created_at')
      .eq('clinic_id', CLINIC_ID)
      .order('created_at', { ascending: false });

    // ── Tier summary ──
    const tierCount = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
    for (const p of patients ?? []) {
      const t = p.loyalty_tier as keyof typeof tierCount;
      if (t in tierCount) tierCount[t]++;
    }

    // ── At-risk (ไม่มา >= 90 วัน) ──
    const cutoff90 = new Date(now);
    cutoff90.setDate(cutoff90.getDate() - 90);
    const recentHns = new Set(
      (allVisits ?? []).filter(v => new Date(v.created_at) >= cutoff90).map(v => v.hn)
    );
    const atRisk = (patients ?? []).filter(p => !recentHns.has(p.hn)).length;

    // LINE registered
    const lineRegistered = (patients ?? []).filter(p => p.line_user_id).length;

    // ── RFM Analysis ──
    // คำนวณ R, F, M ต่อคนไข้
    const patientMap = new Map<string, { r: number; f: number; m: number; name: string; tier: string }>();
    for (const p of patients ?? []) {
      const visits = (allVisits ?? []).filter(v => v.hn === p.hn);
      if (visits.length === 0) {
        patientMap.set(p.hn, { r: 999, f: 0, m: 0, name: p.full_name, tier: p.loyalty_tier });
        continue;
      }
      const lastVisit = new Date(visits[0].created_at);
      const recency = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
      const frequency = visits.length;
      const monetary = visits.reduce((sum, v) => sum + (v.price ?? 0), 0);
      patientMap.set(p.hn, { r: recency, f: frequency, m: monetary, name: p.full_name, tier: p.loyalty_tier });
    }

    // ให้คะแนน R F M แต่ละคน (1-3)
    const rfmData = Array.from(patientMap.entries()).map(([hn, d]) => ({ hn, ...d }));

    const rScored = scoreQuintile(rfmData, 'r', true); // recency: ยิ่งน้อยยิ่งดี
    const fScored = scoreQuintile(rfmData, 'f', false); // frequency: ยิ่งมากยิ่งดี
    const mScored = scoreQuintile(rfmData, 'm', false); // monetary: ยิ่งมากยิ่งดี

    const rfmSegments: Record<string, { label: string; color: string; patients: string[] }> = {
      champions: { label: 'Champions', color: '#4F46E5', patients: [] },
      loyal: { label: 'Loyal Customers', color: '#7C3AED', patients: [] },
      at_risk: { label: 'At Risk', color: '#F59E0B', patients: [] },
      need_attention: { label: 'Need Attention', color: '#EF4444', patients: [] },
      lost: { label: 'Lost', color: '#9CA3AF', patients: [] },
      new: { label: 'New Customers', color: '#10B981', patients: [] },
      potential: { label: 'Potential Loyalists', color: '#06B6D4', patients: [] },
    };

    rfmData.forEach((p, i) => {
      const r = rScored[i];
      const f = fScored[i];
      const m = mScored[i];

      if (r === 3 && f === 3 && m === 3) rfmSegments.champions.patients.push(p.hn);
      else if (r >= 2 && f >= 2) rfmSegments.loyal.patients.push(p.hn);
      else if (r === 1 && f >= 2) rfmSegments.at_risk.patients.push(p.hn);
      else if (r === 1 && f === 1) rfmSegments.lost.patients.push(p.hn);
      else if (r === 3 && f === 1) rfmSegments.new.patients.push(p.hn);
      else if (r >= 2 && f === 1) rfmSegments.potential.patients.push(p.hn);
      else rfmSegments.need_attention.patients.push(p.hn);
    });

    const rfmSummary = Object.entries(rfmSegments).map(([key, v]) => ({
      key,
      label: v.label,
      color: v.color,
      count: v.patients.length,
    }));

    // ── Campaigns ──
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, sent_count, sent_at, target_tier, created_at')
      .eq('clinic_id', CLINIC_ID)
      .order('created_at', { ascending: false })
      .limit(10);

    // ── Satisfaction surveys ──
    const { data: surveys } = await supabaseAdmin
      .from('satisfaction_surveys')
      .select('score, created_at')
      .eq('clinic_id', CLINIC_ID);

    const avgScore = surveys && surveys.length > 0
      ? surveys.reduce((sum, s) => sum + s.score, 0) / surveys.length
      : null;

    const scoreDistrib = [1, 2, 3, 4, 5].map(s => ({
      score: s,
      count: (surveys ?? []).filter(sv => sv.score === s).length,
    }));

    // ── Top spenders ──
    const topSpenders = (patients ?? [])
      .sort((a, b) => (b.lifetime_spending ?? 0) - (a.lifetime_spending ?? 0))
      .slice(0, 5)
      .map(p => ({
        hn: p.hn,
        name: p.full_name,
        tier: p.loyalty_tier,
        spending: p.lifetime_spending,
        points: p.points,
      }));

    // ── Smart Audience (Behavior Segments) ──
    // จำนวน visit ต่อคนไข้
    const visitCountMap = new Map<string, number>();
    const lastVisitMap = new Map<string, Date>();
    for (const v of allVisits ?? []) {
      visitCountMap.set(v.hn, (visitCountMap.get(v.hn) ?? 0) + 1);
      if (!lastVisitMap.has(v.hn)) lastVisitMap.set(v.hn, new Date(v.created_at));
    }

    const visitedHns = new Set(visitCountMap.keys());

    // ลูกค้าที่ยังไม่เคยมา
    const neverVisited = (patients ?? []).filter(p => !visitedHns.has(p.hn)).length;

    // ลูกค้าครั้งแรก (เดือนนี้)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const { data: newThisMonth } = await supabaseAdmin
      .from('visits')
      .select('hn')
      .eq('clinic_id', CLINIC_ID)
      .eq('customer_type', 'new')
      .gte('created_at', startOfMonth.toISOString());
    const newThisMonthCount = new Set((newThisMonth ?? []).map(v => v.hn)).size;

    // ลูกค้ามาครั้งเดียว (แล้วหายไป > 60 วัน)
    const cutoff60 = new Date(now);
    cutoff60.setDate(cutoff60.getDate() - 60);
    const oneTimeInactive = (patients ?? []).filter(p => {
      const cnt = visitCountMap.get(p.hn) ?? 0;
      const last = lastVisitMap.get(p.hn);
      return cnt === 1 && last && last < cutoff60;
    }).length;

    // ลูกค้าไม่มาตามนัด (นัดหมายผ่านไปแล้ว แต่ยังไม่มี visit ในวันนั้น)
    const { data: pastAppts } = await supabaseAdmin
      .from('appointments')
      .select('hn, date')
      .eq('clinic_id', CLINIC_ID)
      .lt('date', now.toISOString().split('T')[0]);

    const { data: visitDates } = await supabaseAdmin
      .from('visits')
      .select('hn, appt_date')
      .eq('clinic_id', CLINIC_ID)
      .not('appt_date', 'is', null);

    const visitedApptKeys = new Set((visitDates ?? []).map(v => `${v.hn}:${v.appt_date}`));
    const noShowCount = (pastAppts ?? []).filter(a =>
      a.hn && !visitedApptKeys.has(`${a.hn}:${a.date}`)
    ).length;

    // ลูกค้า VIP (gold + platinum)
    const vipCount = (patients ?? []).filter(p =>
      p.loyalty_tier === 'gold' || p.loyalty_tier === 'platinum'
    ).length;

    // ลูกค้า High Frequency (5+ ครั้ง)
    const highFreqCount = (patients ?? []).filter(p => (visitCountMap.get(p.hn) ?? 0) >= 5).length;

    const smartAudience = {
      behavior: [
        { key: 'never_visited',   label: 'ยังไม่เคยมา',         desc: 'ลงทะเบียนแล้วแต่ยังไม่เคยใช้บริการ',    count: neverVisited,       color: '#6B7280' },
        { key: 'no_show',         label: 'ไม่มาตามนัด',         desc: 'นัดไว้แต่ไม่มาคลินิก',                   count: noShowCount,         color: '#EF4444' },
        { key: 'one_time',        label: 'มาครั้งเดียวแล้วหาย', desc: 'มาใช้บริการครั้งเดียว ไม่มากว่า 60 วัน', count: oneTimeInactive,     color: '#F59E0B' },
        { key: 'new_this_month',  label: 'ลูกค้าใหม่เดือนนี้',  desc: 'เพิ่งมาใช้บริการครั้งแรกในเดือนนี้',    count: newThisMonthCount,  color: '#10B981' },
        { key: 'at_risk',         label: 'ไม่มา > 90 วัน',      desc: 'เคยมาแต่ขาดหายไปกว่า 90 วัน',           count: atRisk,             color: '#EF4444' },
        { key: 'vip',             label: 'VIP Member',           desc: 'ลูกค้า Gold และ Platinum tier',          count: vipCount,           color: '#7C3AED' },
        { key: 'high_freq',       label: 'ลูกค้าประจำ (5+)',    desc: 'เข้ารับบริการ 5 ครั้งขึ้นไป',           count: highFreqCount,      color: '#4F46E5' },
      ],
      segment: rfmSummary.map(seg => ({
        ...seg,
        desc: RFM_DESC[seg.key] ?? '',
      })),
    };

    // ── Cohort Analysis (Frequency × Spending) ──
    const freqBands = [
      { label: '1 ครั้ง',   min: 1, max: 1 },
      { label: '2-3 ครั้ง', min: 2, max: 3 },
      { label: '4-6 ครั้ง', min: 4, max: 6 },
      { label: '7+ ครั้ง',  min: 7, max: Infinity },
    ];
    const spendBands = [
      { label: '<3K',      min: 0,     max: 3000 },
      { label: '3K-10K',   min: 3000,  max: 10000 },
      { label: '10K-30K',  min: 10000, max: 30000 },
      { label: '30K+',     min: 30000, max: Infinity },
    ];

    const cohort = freqBands.map(fb => ({
      label: fb.label,
      cells: spendBands.map(sb => {
        const count = (patients ?? []).filter(p => {
          const freq = visitCountMap.get(p.hn) ?? 0;
          const spend = p.lifetime_spending ?? 0;
          return freq >= fb.min && freq <= fb.max && spend >= sb.min && spend < sb.max;
        }).length;
        return { label: sb.label, count };
      }),
    }));

    return NextResponse.json({
      totalPatients: (patients ?? []).length,
      lineRegistered,
      atRisk,
      tierCount,
      avgSatisfaction: avgScore ? Math.round(avgScore * 10) / 10 : null,
      totalSurveys: (surveys ?? []).length,
      scoreDistrib,
      rfmSegments: rfmSummary,
      smartAudience,
      cohort,
      campaigns: campaigns ?? [],
      topSpenders,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const RFM_DESC: Record<string, string> = {
  champions:     'ลูกค้าที่ดีที่สุด ซื้อบ่อย ใช้เงินสูง กลับมาล่าสุด',
  loyal:         'ลูกค้าประจำ กำลังซื้อสูงถึงสูงมาก',
  potential:     'ลูกค้าใหม่ที่มีแนวโน้มเป็นลูกค้าประจำ',
  new:           'ลูกค้าใหม่ที่เพิ่งมาครั้งแรก',
  need_attention:'ลูกค้าที่ต้องการการดูแลเป็นพิเศษ',
  at_risk:       'เคยมาบ่อยแต่ไม่มานานแล้ว ควรติดตาม',
  lost:          'ลูกค้าที่หายไปนาน ซื้อน้อย ไม่ค่อยกลับมา',
};

// ให้คะแนน 1-3 แบบ percentile
function scoreQuintile(
  data: { hn: string; [key: string]: any }[],
  field: string,
  lowerIsBetter: boolean
): number[] {
  const vals = data.map(d => d[field] as number);
  const sorted = [...vals].sort((a, b) => a - b);
  const p33 = sorted[Math.floor(sorted.length * 0.33)];
  const p66 = sorted[Math.floor(sorted.length * 0.66)];

  return vals.map(v => {
    if (lowerIsBetter) {
      if (v <= p33) return 3;
      if (v <= p66) return 2;
      return 1;
    } else {
      if (v >= p66) return 3;
      if (v >= p33) return 2;
      return 1;
    }
  });
}
