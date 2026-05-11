import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getEnabledFeatures } from '@/lib/tier';
import { getClinicId, getSessionUser } from '@/lib/auth';

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

// ดึงข้อมูลโดย paginate + filter ที่ DB เพื่อลด payload
async function fetchAll(table: string, clinic_id: string, fields = '*', from?: string, to?: string) {
  const PAGE = 1000;
  let all: any[] = [];
  let page = 0;
  while (true) {
    let q = supabaseAdmin
      .from(table).select(fields)
      .eq('clinic_id', clinic_id);
    if (from) q = q.gte('created_at', from);
    if (to)   q = q.lte('created_at', to + 'T23:59:59+07:00');
    const { data, error } = await q.range(page * PAGE, (page + 1) * PAGE - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    page++;
  }
  return all;
}

// GET /api/dashboard?startDate=2024-01-01&endDate=2024-12-31
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: 'No clinic associated with this user' }, { status: 403 });
  const clinic_id = clinicId;

  const startDate = req.nextUrl.searchParams.get('startDate');
  const endDate = req.nextUrl.searchParams.get('endDate');

  // Default window: 13 months (ครอบ 12-month chart + current month KPIs)
  const defaultFrom = new Date();
  defaultFrom.setMonth(defaultFrom.getMonth() - 13);
  const queryFrom = startDate ?? defaultFrom.toISOString().slice(0, 10);
  const queryTo   = endDate ?? undefined;

  const [allVisits, allPatients, { data: clinicRow }, enabledFeatures] = await Promise.all([
    fetchAll('visits', clinic_id, '*', queryFrom, queryTo),
    fetchAll('patients', clinic_id, '*', queryFrom, queryTo),
    supabaseAdmin.from('clinics').select('tier, name').eq('id', clinic_id).single(),
    getEnabledFeatures(clinic_id),
  ]);

  // Convert any UTC timestamp to a Bangkok date string 'YYYY-MM-DD'
  const toBkkDate = (dateStr: string) => {
    const s = new Date(dateStr).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
    const d = new Date(s);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const inRange = (dateStr?: string) => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return true;
    const bkk = toBkkDate(dateStr);
    if (startDate && bkk < startDate) return false;
    if (endDate && bkk > endDate) return false;
    return true;
  };

  const visits = (allVisits ?? []).filter(v => inRange(v.created_at));
  const patients = (allPatients ?? []).filter(p => inRange(p.created_at));

  const nowThai = getThaiNow();
  const todayStr = `${nowThai.getFullYear()}-${String(nowThai.getMonth() + 1).padStart(2, '0')}-${String(nowThai.getDate()).padStart(2, '0')}`;
  const yesterdayThai = new Date(nowThai); yesterdayThai.setDate(yesterdayThai.getDate() - 1);
  const yesterdayStr = `${yesterdayThai.getFullYear()}-${String(yesterdayThai.getMonth() + 1).padStart(2, '0')}-${String(yesterdayThai.getDate()).padStart(2, '0')}`;
  const currentMonthKey = getMonthKey(nowThai);
  const prevDate = new Date(nowThai); prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonthKey = getMonthKey(prevDate);

  // Maps
  const monthlyRevenueMap: Record<string, number> = {};
  const dailyRevenueMap: Record<string, number> = {};
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
  let revenuePeriod = 0;
  let currentMonthVisits = 0;
  let currentMonthCompleted = 0;
  let totalNew = 0;
  let totalRet = 0;

  for (const v of visits) {
    const revenue = parseFloat(String(v.price)) || 0;
    const createdThai = new Date(new Date(v.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const mk = getMonthKey(createdThai);
    const vDateStr = toBkkDate(v.created_at);

    revenuePeriod += revenue;
    if (vDateStr === todayStr) revenueToday += revenue;
    monthlyRevenueMap[mk] = (monthlyRevenueMap[mk] || 0) + revenue;
    dailyRevenueMap[vDateStr] = (dailyRevenueMap[vDateStr] || 0) + revenue;

    const ct = v.customer_type || 'returning';
    if (ct === 'new') { monthlyNew[mk] = (monthlyNew[mk] || 0) + 1; totalNew++; }
    else { monthlyRet[mk] = (monthlyRet[mk] || 0) + 1; totalRet++; }
    customerTypeMap[ct] = (customerTypeMap[ct] || 0) + 1;

    const tn = v.treatment_name ?? 'Unknown';
    treatmentMap[tn] = (treatmentMap[tn] || 0) + revenue;

    if (mk === currentMonthKey) {
      currentMonthVisits++;
      currentMonthCompleted++; // ทุก visit ที่บันทึกถือว่า completed
    }

    const dr = v.doctor;
    if (dr) {
      if (!doctorMap[dr]) doctorMap[dr] = { revenue: 0, visits: 0 };
      doctorMap[dr].revenue += revenue; doctorMap[dr].visits++;
    }

    const cat = getCategory(tn);
    if (!catMonthMap[mk]) catMonthMap[mk] = { Botox: 0, Filler: 0, SkinQuality: 0, EBD: 0, Surgery: 0, Other: 0 };
    const ck = cat === 'Skin quality' ? 'SkinQuality' : cat;
    catMonthMap[mk][ck] = (catMonthMap[mk][ck] || 0) + revenue;

    if (!serviceMap[tn]) serviceMap[tn] = { revenue: 0, visits: 0, category: cat };
    serviceMap[tn].revenue += revenue; serviceMap[tn].visits++;

    // Sales ranking: ถ้ามี date filter ใช้ range นั้น (visits filter ไปแล้ว) ถ้าไม่มี ใช้เฉพาะเดือนปัจจุบัน — ตรง scope กับ Monthly Revenue KPI
    if ((startDate || endDate) || mk === currentMonthKey) {
      const sn = v.sales_name || 'ไม่ระบุ';
      salesMap[sn] = (salesMap[sn] || 0) + revenue;
    }
    const hn = v.hn ?? 'Unknown';
    if (!patientMap[hn]) patientMap[hn] = { revenue: 0, visits: 0 };
    patientMap[hn].revenue += revenue; patientMap[hn].visits++;
  }

  const sourceMap: Record<string, number> = {};
  const patientMonthMap: Record<string, number> = {};
  const visitedHNs = new Set(visits.map(v => v.hn).filter(Boolean));

  for (const p of patients) {
    if (p.source) sourceMap[p.source] = (sourceMap[p.source] || 0) + 1;
    // ใช้ Bangkok timezone เพื่อให้ consistent กับ revenue grouping
    const d = new Date(new Date(p.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
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
      revenueToday: (startDate || endDate) ? revenuePeriod : revenueToday,
      yesterdayRevenue: dailyRevenueMap[yesterdayStr] || 0,
      monthlyRevenue,
      prevMonthRevenue,
      newCustomers: (startDate || endDate) ? totalNew : (monthlyNew[currentMonthKey] || 0),
      prevNewCustomers: monthlyNew[prevMonthKey] || 0,
      returning: (startDate || endDate) ? totalRet : (monthlyRet[currentMonthKey] || 0),
      prevReturning: monthlyRet[prevMonthKey] || 0,
      conversionRate,
    },
    revenueTrend: (() => {
      const days: { month: string; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(nowThai);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        days.push({ month: label, revenue: dailyRevenueMap[key] || 0 });
      }
      return days;
    })(),
    revenueTrendMonthly: (() => {
      const months: { month: string; revenue: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(nowThai);
        d.setMonth(d.getMonth() - i, 1);
        const key = getMonthKey(d);
        const label = toLabel(key);
        months.push({ month: label, revenue: monthlyRevenueMap[key] || 0 });
      }
      return months;
    })(),
    topTreatments: Object.entries(treatmentMap).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, revenue]) => ({ name, revenue })),
    appointmentsByStatus: [{ status: 'Completed', count: visits.length }],
    topDoctors: Object.entries(doctorMap)
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
    tier: clinicRow?.tier ?? 'starter',
    clinicName: clinicRow?.name ?? '',
    enabled_features: enabledFeatures,
  });
}
