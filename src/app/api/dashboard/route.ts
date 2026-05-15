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

  // Patient lookups — built first so the main visits loop can determine "new" by
  // patient registration date (not by visit.customer_type flag). allPatients is
  // used so patients registered before the dashboard date range still resolve.
  const patientSourceByHn: Record<string, string> = {};
  const patientCreatedByHn: Record<string, Date> = {};
  for (const p of allPatients ?? []) {
    if (!p.hn) continue;
    patientSourceByHn[p.hn] = (p.source as string | null) || 'ไม่ระบุ';
    if (p.created_at) {
      patientCreatedByHn[p.hn] = new Date(new Date(p.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    }
  }
  const getCreatedMonthKey = (hn: string): string | null => {
    const d = patientCreatedByHn[hn];
    return d ? getMonthKey(d) : null;
  };
  const getCreatedBkkDate = (hn: string): string | null => {
    const d = patientCreatedByHn[hn];
    if (!d) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const isPatientNewForRange = (hn: string): boolean => {
    if (!startDate && !endDate) return false;
    const dateStr = getCreatedBkkDate(hn);
    if (!dateStr) return false;
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    return true;
  };

  // Maps
  const monthlyRevenueMap: Record<string, number> = {};
  const dailyRevenueMap: Record<string, number> = {};
  const monthlyNew: Record<string, number> = {};
  const monthlyRet: Record<string, number> = {};
  const monthlyTrx: Record<string, number> = {};
  const dailyNewMap: Record<string, number> = {};
  const dailyRetMap: Record<string, number> = {};
  const dailyTrxMap: Record<string, number> = {};
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

  // Sets used to count UNIQUE returning patients (not visits) per period
  const monthlyRetHns: Record<string, Set<string>> = {};
  const dailyRetHns:   Record<string, Set<string>> = {};
  const visitedHnsInScope = new Set<string>();

  for (const v of visits) {
    const revenue = parseFloat(String(v.price)) || 0;
    const createdThai = new Date(new Date(v.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const mk = getMonthKey(createdThai);
    const vDateStr = toBkkDate(v.created_at);

    revenuePeriod += revenue;
    if (vDateStr === todayStr) revenueToday += revenue;
    monthlyRevenueMap[mk] = (monthlyRevenueMap[mk] || 0) + revenue;
    dailyRevenueMap[vDateStr] = (dailyRevenueMap[vDateStr] || 0) + revenue;

    // Returning = unique patients who visited but registered outside this period.
    // Same-month visit + patient created same month → handled by patient registrations.
    const patientMkOfVisit = getCreatedMonthKey(v.hn);
    if (patientMkOfVisit !== mk) {
      if (!monthlyRetHns[mk]) monthlyRetHns[mk] = new Set();
      if (v.hn) monthlyRetHns[mk].add(v.hn);
      const patientBkk = getCreatedBkkDate(v.hn);
      if (patientBkk !== vDateStr) {
        if (!dailyRetHns[vDateStr]) dailyRetHns[vDateStr] = new Set();
        if (v.hn) dailyRetHns[vDateStr].add(v.hn);
      }
    }
    if (v.hn) visitedHnsInScope.add(v.hn);

    monthlyTrx[mk] = (monthlyTrx[mk] || 0) + 1;
    dailyTrxMap[vDateStr] = (dailyTrxMap[vDateStr] || 0) + 1;

    const tn = v.treatment_name ?? 'Unknown';
    treatmentMap[tn] = (treatmentMap[tn] || 0) + revenue;

    if (mk === currentMonthKey) {
      currentMonthVisits++;
      currentMonthCompleted++; // ทุก visit ที่บันทึกถือว่า completed
    }

    // Top Doctors: scope to current calendar month only, regardless of dashboard date filter
    const dr = v.doctor;
    if (dr && mk === currentMonthKey) {
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

  const patientMonthMap: Record<string, number> = {};
  const visitedHNs = new Set(visits.map(v => v.hn).filter(Boolean));

  for (const p of patients) {
    // ใช้ Bangkok timezone เพื่อให้ consistent กับ revenue grouping
    const d = new Date(new Date(p.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    patientMonthMap[getMonthKey(d)] = (patientMonthMap[getMonthKey(d)] || 0) + 1;
  }

  // ── 'New' counts come from PATIENT REGISTRATIONS (unique people), not visits ──
  // monthlyNew[mk] = patients registered in month mk
  // dailyNewMap[date] = patients registered on that date
  // Iterate over ALL patients within the dashboard fetch window (queryFrom..queryTo)
  for (const p of allPatients ?? []) {
    if (!p.created_at) continue;
    const d = new Date(new Date(p.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const mk = getMonthKey(d);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    monthlyNew[mk] = (monthlyNew[mk] || 0) + 1;
    dailyNewMap[dateStr] = (dailyNewMap[dateStr] || 0) + 1;
  }

  // monthlyRet / dailyRetMap derived from the Sets built in the visits loop
  for (const [mk, set] of Object.entries(monthlyRetHns)) monthlyRet[mk] = set.size;
  for (const [dateStr, set] of Object.entries(dailyRetHns))  dailyRetMap[dateStr] = set.size;

  // Top-level KPI: totalNew / totalRet (filter range when filter set, current month otherwise)
  if (startDate || endDate) {
    for (const p of allPatients ?? []) {
      if (!p.created_at) continue;
      const dateStr = getCreatedBkkDate(p.hn ?? '');
      if (!dateStr) continue;
      if (startDate && dateStr < startDate) continue;
      if (endDate && dateStr > endDate) continue;
      totalNew++;
    }
    for (const hn of visitedHnsInScope) {
      if (!isPatientNewForRange(hn)) totalRet++;
    }
  } else {
    totalNew = monthlyNew[currentMonthKey] || 0;
    // Returning in current month: unique HNs visiting in current month with patient registered before
    const currentMonthVisitorHns = new Set<string>();
    for (const v of visits) {
      const createdThai = new Date(new Date(v.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      if (getMonthKey(createdThai) === currentMonthKey && v.hn) currentMonthVisitorHns.add(v.hn);
    }
    for (const hn of currentMonthVisitorHns) {
      if (getCreatedMonthKey(hn) !== currentMonthKey) totalRet++;
    }
  }

  // customerTypeMap (top-level pie): unique patients in current scope, new vs returning
  customerTypeMap['new'] = totalNew;
  customerTypeMap['returning'] = totalRet;

  // Patient Acquisition Source: UNIQUE NEW PATIENTS in scope, grouped by source
  const sourceMap: Record<string, number> = {};
  for (const p of allPatients ?? []) {
    if (!p.hn || !p.created_at) continue;
    const dateStr = getCreatedBkkDate(p.hn);
    if (!dateStr) continue;
    let isNew = false;
    if (startDate || endDate) {
      const inRange = (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate);
      isNew = inRange;
    } else {
      isNew = getCreatedMonthKey(p.hn) === currentMonthKey;
    }
    if (!isNew) continue;
    const src = patientSourceByHn[p.hn] || 'ไม่ระบุ';
    sourceMap[src] = (sourceMap[src] || 0) + 1;
  }

  const monthlyRevenue = monthlyRevenueMap[currentMonthKey] || 0;
  const prevMonthRevenue = monthlyRevenueMap[prevMonthKey] || 0;
  const conversionRate = currentMonthVisits > 0 ? (currentMonthCompleted / currentMonthVisits) * 100 : 0;

  // Weekly: rolling 7 days from today, independent of user date filter
  // Also build week/month treatment maps for the toggle on Top Treatments chart
  // weekNew = unique patients registered in rolling 7 days
  // weekRet = unique patients visiting in rolling 7 days who registered earlier
  const weekStartBkk = new Date(nowThai); weekStartBkk.setDate(weekStartBkk.getDate() - 7);
  const treatmentWeekMap: Record<string, number> = {};
  const treatmentMonthMap: Record<string, number> = {};
  const weekVisitorHns = new Set<string>();
  for (const v of allVisits ?? []) {
    const createdThai = new Date(new Date(v.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const revenue = parseFloat(String(v.price)) || 0;
    const tn = v.treatment_name ?? 'Unknown';
    const inWeek = createdThai >= weekStartBkk && createdThai <= nowThai;
    const inMonth = getMonthKey(createdThai) === currentMonthKey;
    if (inWeek) {
      if (v.hn) weekVisitorHns.add(v.hn);
      treatmentWeekMap[tn] = (treatmentWeekMap[tn] || 0) + revenue;
    }
    if (inMonth) {
      treatmentMonthMap[tn] = (treatmentMonthMap[tn] || 0) + revenue;
    }
  }
  let weekNew = 0;
  let weekRet = 0;
  for (const p of allPatients ?? []) {
    if (!p.created_at) continue;
    const d = new Date(new Date(p.created_at).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    if (d >= weekStartBkk && d <= nowThai) weekNew++;
  }
  for (const hn of weekVisitorHns) {
    const pCreated = patientCreatedByHn[hn];
    if (!pCreated || pCreated < weekStartBkk || pCreated > nowThai) weekRet++;
  }

  // ── Customer Insights page bundles (Week / Month windows) ──
  // Week = rolling 7 days from today; Month = current calendar month (1 → last day)
  const monthStartBkk = new Date(nowThai); monthStartBkk.setDate(1);
  const lastDayOfMonth = new Date(nowThai.getFullYear(), nowThai.getMonth() + 1, 0).getDate();
  const monthEndBkk = new Date(nowThai); monthEndBkk.setDate(lastDayOfMonth); monthEndBkk.setHours(23, 59, 59, 999);

  const inDateWindow = (dateStr: string, start: Date, end: Date) => {
    const t = new Date(new Date(dateStr).toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    return t >= start && t <= end;
  };

  type InsightsBundle = {
    customerType: { name: string; value: number }[];
    acquisitionSource: { source: string; count: number }[];
    visitFrequency: { range: string; count: number }[];
    topPatients: { hn: string; visits: number; revenue: number; avgPerVisit: number }[];
    newRegistrations: { month: string; count: number }[];
  };

  function buildInsightsBundle(windowVisits: any[], dailyAxis: { key: string; label: string }[], winStart: Date, winEnd: Date): InsightsBundle {
    const patientVisitCount: Record<string, number> = {};
    const pm: Record<string, { revenue: number; visits: number }> = {};
    const visitorHns = new Set<string>();
    for (const v of windowVisits) {
      if (v.hn) {
        visitorHns.add(v.hn);
        patientVisitCount[v.hn] = (patientVisitCount[v.hn] || 0) + 1;
      }
      const hn = v.hn ?? 'Unknown';
      if (!pm[hn]) pm[hn] = { revenue: 0, visits: 0 };
      pm[hn].revenue += parseFloat(String(v.price)) || 0;
      pm[hn].visits++;
    }
    const counts = Object.values(patientVisitCount);

    // Unique-patient based new/returning + source counts within this window
    const newHnsInWindow: string[] = [];
    for (const hn of Object.keys(patientCreatedByHn)) {
      const d = patientCreatedByHn[hn];
      if (d >= winStart && d <= winEnd) newHnsInWindow.push(hn);
    }
    const newHnSet = new Set(newHnsInWindow);
    let retCount = 0;
    for (const hn of visitorHns) if (!newHnSet.has(hn)) retCount++;

    const srcMap: Record<string, number> = {};
    for (const hn of newHnsInWindow) {
      const src = patientSourceByHn[hn] || 'ไม่ระบุ';
      srcMap[src] = (srcMap[src] || 0) + 1;
    }

    // newRegistrations daily series: patient registrations per day inside window
    const newRegDailyMap: Record<string, number> = {};
    for (const hn of newHnsInWindow) {
      const d = patientCreatedByHn[hn];
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      newRegDailyMap[k] = (newRegDailyMap[k] || 0) + 1;
    }

    return {
      customerType: [
        { name: 'new',       value: newHnsInWindow.length },
        { name: 'returning', value: retCount },
      ].filter(x => x.value > 0),
      acquisitionSource: Object.entries(srcMap).sort(([, a], [, b]) => b - a).map(([source, count]) => ({ source, count })),
      visitFrequency: [
        { range: '1 visit',    count: counts.filter(c => c === 1).length },
        { range: '2-3 visits', count: counts.filter(c => c >= 2 && c <= 3).length },
        { range: '4-6 visits', count: counts.filter(c => c >= 4 && c <= 6).length },
        { range: '7+ visits',  count: counts.filter(c => c >= 7).length },
      ],
      topPatients: Object.entries(pm)
        .filter(([hn]) => hn !== 'Unknown')
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(([hn, d]) => ({ hn, visits: d.visits, revenue: d.revenue, avgPerVisit: d.visits ? Math.round(d.revenue / d.visits) : 0 })),
      newRegistrations: dailyAxis.map(({ key, label }) => ({ month: label, count: newRegDailyMap[key] || 0 })),
    };
  }

  const weekVisits  = (allVisits ?? []).filter(v => inDateWindow(v.created_at, weekStartBkk, nowThai));
  const monthVisits = (allVisits ?? []).filter(v => inDateWindow(v.created_at, monthStartBkk, monthEndBkk));

  const weekAxis: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nowThai); d.setDate(d.getDate() - i);
    weekAxis.push({ key: d.toISOString().split('T')[0], label: `${d.getDate()}/${d.getMonth() + 1}` });
  }
  const monthAxis: { key: string; label: string }[] = [];
  for (let day = 1; day <= lastDayOfMonth; day++) {
    const d = new Date(nowThai); d.setDate(day);
    monthAxis.push({ key: d.toISOString().split('T')[0], label: String(day) });
  }

  const customerInsightsWeek  = buildInsightsBundle(weekVisits,  weekAxis,  weekStartBkk,  nowThai);
  const customerInsightsMonth = buildInsightsBundle(monthVisits, monthAxis, monthStartBkk, monthEndBkk);

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
      newCustomersWeek: weekNew,
      returning: (startDate || endDate) ? totalRet : (monthlyRet[currentMonthKey] || 0),
      prevReturning: monthlyRet[prevMonthKey] || 0,
      returningWeek: weekRet,
      conversionRate,
    },
    revenueTrend: (() => {
      const days: { month: string; revenue: number; new: number; returning: number; transactions: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(nowThai);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        days.push({
          month: label,
          revenue: dailyRevenueMap[key] || 0,
          new: dailyNewMap[key] || 0,
          returning: dailyRetMap[key] || 0,
          transactions: dailyTrxMap[key] || 0,
        });
      }
      return days;
    })(),
    // 12-month aggregate (used by Sales Analytics)
    revenueTrendMonthly: (() => {
      const months: { month: string; revenue: number; new: number; returning: number; transactions: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(nowThai);
        d.setMonth(d.getMonth() - i, 1);
        const key = getMonthKey(d);
        const label = toLabel(key);
        months.push({
          month: label,
          revenue: monthlyRevenueMap[key] || 0,
          new: monthlyNew[key] || 0,
          returning: monthlyRet[key] || 0,
          transactions: monthlyTrx[key] || 0,
        });
      }
      return months;
    })(),
    // Day-by-day for current calendar month (used by Executive Overview Month toggle)
    revenueTrendThisMonth: (() => {
      const days: { month: string; revenue: number; new: number; returning: number; transactions: number }[] = [];
      const y = nowThai.getFullYear();
      const m = nowThai.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      for (let day = 1; day <= lastDay; day++) {
        const d = new Date(nowThai);
        d.setDate(day);
        const key = d.toISOString().split('T')[0];
        days.push({
          month: String(day),
          revenue: dailyRevenueMap[key] || 0,
          new: dailyNewMap[key] || 0,
          returning: dailyRetMap[key] || 0,
          transactions: dailyTrxMap[key] || 0,
        });
      }
      return days;
    })(),
    topTreatments: Object.entries(treatmentMap).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, revenue]) => ({ name, revenue })),
    topTreatmentsWeek: Object.entries(treatmentWeekMap).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, revenue]) => ({ name, revenue })),
    topTreatmentsMonth: Object.entries(treatmentMonthMap).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, revenue]) => ({ name, revenue })),
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
    customerInsightsWeek,
    customerInsightsMonth,
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
