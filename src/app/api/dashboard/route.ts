import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

function getCategory(t?: string): string {
  if (!t) return 'Other';
  const l = t.toLowerCase();
  if (l.includes('botox') || l.includes('nabota') || l.includes('xeomin') || l.includes('allergan')) return 'Botox';
  if (l.includes('filler')) return 'Filler';
  if (l.includes('ultherapy') || l.includes('ultraformer') || l.includes('oligio')) return 'EBD';
  if (l.includes('surgery') || l.includes('nose') || l.includes('alar') || l.includes('chin')) return 'Surgery';
  if (l.includes('mesofat') || l.includes('mounjaro') || l.includes('iv') || l.includes('hair')) return 'Other';
  if (l.includes('sculptra') || l.includes('profhilo') || l.includes('juvelook') || l.includes('rejuran') || l.includes('meso') || l.includes('treatment')) return 'Skin quality';
  return 'Other';
}

function getMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getMonthLabel(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
function toLabel(key: string) {
  const [y, m] = key.split('-');
  return getMonthLabel(new Date(+y, +m - 1, 1));
}
function getThaiNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
}

// GET /api/dashboard?startDate=2024-01-01&endDate=2024-12-31
export async function GET(req: NextRequest) {
  const clinic_id = CLINIC_ID;

  const startDate = req.nextUrl.searchParams.get('startDate');
  const endDate = req.nextUrl.searchParams.get('endDate');

  const [{ data: allVisits }, { data: allPatients }] = await Promise.all([
    supabaseAdmin.from('visits').select('*').eq('clinic_id', clinic_id).limit(5000),
    supabaseAdmin.from('patients').select('*').eq('clinic_id', clinic_id).limit(5000),
  ]);

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate + 'T23:59:59') : null;

  const inRange = (dateStr?: string) => {
    if (!start && !end) return true;
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  };

  const visits = (allVisits ?? []).filter(v => inRange(v.created_at));
  const patients = (allPatients ?? []).filter(p => inRange(p.created_at));

  const nowThai = getThaiNow();
  const todayStr = nowThai.toISOString().split('T')[0];
  const currentMonthKey = getMonthKey(nowThai);
  const prevDate = new Date(nowThai); prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonthKey = getMonthKey(prevDate);

  // Maps
  const monthlyRevenueMap: Record<string, number> = {};
  const monthlyNew: Record<string, number> = {};
  const monthlyRet: Record<string, number> = {};
  const treatmentMap: Record<string, number> = {};
  const doctorMap: Record<string, { revenue: number; visits: number }> = {};
  const catMonthMap: Record<string, Record<string, number>> = {};
  const serviceMap: Record<string, { revenue: number; visits: number; category: string }> = {};
  const salesMap: Record<string, number> = {};
  const patientMap: Record<string, { revenue: number; visits: number }> = {};
  const customerTypeMap: Record<string, number> = {};

  let revenueToday = 0;
  let currentMonthVisits = 0;
  let currentMonthCompleted = 0;

  for (const v of visits) {
    const revenue = parseFloat(String(v.price)) || 0;
    const createdThai = new Date(new Date(v.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const mk = getMonthKey(createdThai);
    const vDateStr = createdThai.toISOString().split('T')[0];

    if (vDateStr === todayStr) revenueToday += revenue;
    monthlyRevenueMap[mk] = (monthlyRevenueMap[mk] || 0) + revenue;

    const ct = v.customer_type ?? '';
    if (ct === 'new') monthlyNew[mk] = (monthlyNew[mk] || 0) + 1;
    else monthlyRet[mk] = (monthlyRet[mk] || 0) + 1;
    customerTypeMap[ct] = (customerTypeMap[ct] || 0) + 1;

    const tn = v.treatment_name ?? 'Unknown';
    treatmentMap[tn] = (treatmentMap[tn] || 0) + revenue;

    if (mk === currentMonthKey) {
      currentMonthVisits++;
      currentMonthCompleted++; // ทุก visit ที่บันทึกถือว่า completed
    }

    const dr = v.doctor ?? 'Unknown';
    if (!doctorMap[dr]) doctorMap[dr] = { revenue: 0, visits: 0 };
    doctorMap[dr].revenue += revenue; doctorMap[dr].visits++;

    const cat = getCategory(tn);
    if (!catMonthMap[mk]) catMonthMap[mk] = { Botox: 0, Filler: 0, SkinQuality: 0, EBD: 0, Surgery: 0, Other: 0 };
    const ck = cat === 'Skin quality' ? 'SkinQuality' : cat;
    catMonthMap[mk][ck] = (catMonthMap[mk][ck] || 0) + revenue;

    if (!serviceMap[tn]) serviceMap[tn] = { revenue: 0, visits: 0, category: cat };
    serviceMap[tn].revenue += revenue; serviceMap[tn].visits++;

    if (v.sales_name) salesMap[v.sales_name] = (salesMap[v.sales_name] || 0) + revenue;
    const hn = v.hn ?? 'Unknown';
    if (!patientMap[hn]) patientMap[hn] = { revenue: 0, visits: 0 };
    patientMap[hn].revenue += revenue; patientMap[hn].visits++;
  }

  const sourceMap: Record<string, number> = {};
  const patientMonthMap: Record<string, number> = {};
  const visitedHNs = new Set(visits.map(v => v.hn).filter(Boolean));

  for (const p of patients) {
    if (p.source) sourceMap[p.source] = (sourceMap[p.source] || 0) + 1;
    const d = new Date(p.created_at);
    patientMonthMap[getMonthKey(d)] = (patientMonthMap[getMonthKey(d)] || 0) + 1;
  }

  const monthlyRevenue = monthlyRevenueMap[currentMonthKey] || 0;
  const prevMonthRevenue = monthlyRevenueMap[prevMonthKey] || 0;
  const conversionRate = currentMonthVisits > 0 ? (currentMonthCompleted / currentMonthVisits) * 100 : 0;

  const SALES_TARGET = 3600000;

  const catTotals: Record<string, number> = { Botox: 0, Filler: 0, 'Skin quality': 0, EBD: 0, Surgery: 0, Other: 0 };
  Object.values(serviceMap).forEach(s => { catTotals[s.category] = (catTotals[s.category] || 0) + s.revenue; });

  const totalLeads = patients.length;
  const convertedLeads = patients.filter(p => visitedHNs.has(p.hn)).length;

  const leadsMonthMap: Record<string, { leads: number; converted: number }> = {};
  for (const p of patients) {
    const k = getMonthKey(new Date(p.created_at));
    if (!leadsMonthMap[k]) leadsMonthMap[k] = { leads: 0, converted: 0 };
    leadsMonthMap[k].leads++;
    if (visitedHNs.has(p.hn)) leadsMonthMap[k].converted++;
  }

  const visitCounts = Object.values(patientMap).map(p => p.visits);

  return NextResponse.json({
    kpis: {
      revenueToday,
      monthlyRevenue,
      prevMonthRevenue,
      newCustomers: monthlyNew[currentMonthKey] || 0,
      prevNewCustomers: monthlyNew[prevMonthKey] || 0,
      returning: monthlyRet[currentMonthKey] || 0,
      prevReturning: monthlyRet[prevMonthKey] || 0,
      conversionRate,
    },
    revenueTrend: Object.entries(monthlyRevenueMap).filter(([k]) => k !== 'unknown')
      .sort(([a], [b]) => a.localeCompare(b)).map(([k, revenue]) => ({ month: toLabel(k), revenue })),
    topTreatments: Object.entries(treatmentMap).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, revenue]) => ({ name, revenue })),
    appointmentsByStatus: [{ status: 'Completed', count: visits.length }],
    topDoctors: Object.entries(doctorMap).filter(([n]) => n !== 'Unknown' && n !== '')
      .sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 5).map(([name, d]) => ({ name, ...d })),
    revenueByCategoryMonth: Object.keys(catMonthMap).sort()
      .map(k => ({ month: toLabel(k), Botox: 0, Filler: 0, SkinQuality: 0, EBD: 0, Surgery: 0, Other: 0, ...catMonthMap[k] })),
    revenueShareByCategory: Object.entries(catTotals).map(([name, value]) => ({ name, value })).filter(c => c.value > 0).sort((a, b) => b.value - a.value),
    topServices: Object.entries(serviceMap).sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 10)
      .map(([name, d]) => ({ name, category: d.category, revenue: d.revenue, visits: d.visits, avgPerVisit: d.visits ? Math.round(d.revenue / d.visits) : 0 })),
    salesRanking: Object.entries(salesMap).sort(([, a], [, b]) => b - a).map(([name, revenue], i) => ({ rank: i + 1, name, revenue, target: SALES_TARGET })),
    newRegistrationsByMonth: Object.entries(patientMonthMap).sort(([a], [b]) => a.localeCompare(b)).map(([k, count]) => ({ month: toLabel(k), count })),
    customerTypeDistribution: Object.entries(customerTypeMap).map(([name, value]) => ({ name, value })),
    acquisitionSource: Object.entries(sourceMap).sort(([, a], [, b]) => b - a).map(([source, count]) => ({ source, count })),
    visitFrequency: [
      { range: '1 visit', count: visitCounts.filter(c => c === 1).length },
      { range: '2-3 visits', count: visitCounts.filter(c => c >= 2 && c <= 3).length },
      { range: '4-6 visits', count: visitCounts.filter(c => c >= 4 && c <= 6).length },
      { range: '7+ visits', count: visitCounts.filter(c => c >= 7).length },
    ],
    topPatients: Object.entries(patientMap).filter(([hn]) => hn !== 'Unknown')
      .sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 10)
      .map(([hn, d]) => ({ hn, visits: d.visits, revenue: d.revenue, avgPerVisit: d.visits ? Math.round(d.revenue / d.visits) : 0 })),
    totalLeads,
    conversionRateMarketing: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
    totalChannels: Object.keys(sourceMap).length,
    leadsByMonth: Object.entries(leadsMonthMap).sort(([a], [b]) => a.localeCompare(b)).map(([k, d]) => ({ month: toLabel(k), ...d })),
    leadStatusBreakdown: [
      { status: 'Converted (มี Visit)', count: convertedLeads },
      { status: 'Not Converted', count: totalLeads - convertedLeads },
    ].filter(s => s.count > 0),
    channelPerformance: Object.entries(sourceMap).sort(([, a], [, b]) => b - a).slice(0, 6).map(([source, count]) => ({ source, count })),
    lastUpdated: getThaiNow().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  });
}
