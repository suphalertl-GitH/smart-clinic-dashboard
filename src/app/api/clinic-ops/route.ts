import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

const DOCTOR_SCHEDULE: Record<number, string> = {
  2: 'หมอพลอยใส', 3: 'หมอมินนี่', 4: 'หมอปอย',
  5: 'หมอพลอยใส', 6: 'หมอพลอยใส', 0: 'หมอพลอยใส',
};
const SLOTS_PER_DAY = 20;

// GET /api/clinic-ops?startDate=...&endDate=...
export async function GET(req: NextRequest) {
  const startDate = req.nextUrl.searchParams.get('startDate');
  const endDate = req.nextUrl.searchParams.get('endDate');

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate + 'T23:59:59') : null;

  let query = supabaseAdmin.from('appointments').select('*').eq('clinic_id', CLINIC_ID).limit(5000);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data: appts } = await query;
  const appointments = appts ?? [];

  const heatmapMap: Record<string, number> = {};
  const doctorVisitMap: Record<string, number> = {};
  const statusCountMap: Record<string, number> = {};
  let noShowCount = 0;
  let minTime = Infinity, maxTime = -Infinity;

  for (const a of appointments) {
    const date = new Date(a.date);
    const t = date.getTime();
    if (t < minTime) minTime = t;
    if (t > maxTime) maxTime = t;

    // Parse time HH:MM
    const hour = parseInt((a.time ?? '').split(':')[0]);
    if (!isNaN(hour) && hour >= 8 && hour <= 20) {
      const dayIdx = date.getDay();
      const hourStr = `${String(hour).padStart(2, '0')}:00`;
      const key = `${DAYS[dayIdx]}-${hourStr}`;
      heatmapMap[key] = (heatmapMap[key] || 0) + 1;
    }

    if (a.sales_name) doctorVisitMap[a.sales_name] = (doctorVisitMap[a.sales_name] || 0) + 1;

    const st = (a.note ?? '').toLowerCase();
    const noShow = st.includes('no-show') || st.includes('noshow') || st.includes('ไม่มา');
    if (noShow) noShowCount++;
    statusCountMap[noShow ? 'No-show' : 'Completed'] = (statusCountMap[noShow ? 'No-show' : 'Completed'] || 0) + 1;
  }

  const total = appointments.length;

  // Build heatmap array
  const heatmap = DAYS.flatMap(day =>
    HOURS.map(hour => ({ day, hour, count: heatmapMap[`${day}-${hour}`] || 0 }))
  );

  // Peak slot
  let peakKey = '', peakCount = 0;
  for (const [key, count] of Object.entries(heatmapMap)) {
    if (count > peakCount) { peakCount = count; peakKey = key; }
  }
  const [peakDayStr, peakHour] = peakKey.split('-');

  // Doctor workload
  const effectiveStart = start ?? (minTime !== Infinity ? new Date(minTime) : new Date());
  const effectiveEnd = end ?? (maxTime !== -Infinity ? new Date(maxTime) : new Date());
  const potentialDays: Record<string, number> = { 'หมอพลอยใส': 0, 'หมอมินนี่': 0, 'หมอปอย': 0 };

  for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
    const doc = DOCTOR_SCHEDULE[d.getDay()];
    if (doc) potentialDays[doc]++;
  }

  const { data: settingsData } = await supabaseAdmin.from('settings').select('doctor_names').eq('clinic_id', CLINIC_ID).single();
  const doctorNames: string[] = settingsData?.doctor_names ?? [];
  const allDoctors = new Set([...doctorNames, ...Object.keys(doctorVisitMap), ...Object.keys(potentialDays)]);

  const doctorWorkload = [...allDoctors].filter(Boolean).map(name => {
    const visits = doctorVisitMap[name] || 0;
    let cap = potentialDays[name] !== undefined ? potentialDays[name] * SLOTS_PER_DAY : Math.max(Math.ceil(visits * 1.25 / 10) * 10, SLOTS_PER_DAY);
    if (cap === 0) cap = SLOTS_PER_DAY;
    return { name, visits, capacity: cap };
  }).sort((a, b) => b.visits - a.visits).slice(0, 8);

  return NextResponse.json({
    heatmap,
    noShowRate: total > 0 ? (noShowCount / total) * 100 : 0,
    totalAppointments: total,
    noShowCount,
    doctorWorkload,
    statusBreakdown: Object.entries(statusCountMap).sort(([, a], [, b]) => b - a).map(([status, count]) => ({ status, count })),
    peakDay: peakDayStr ?? 'Mon',
    peakHour: peakHour ?? '14:00',
  });
}
