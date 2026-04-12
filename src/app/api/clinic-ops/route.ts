import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];


// GET /api/clinic-ops?startDate=...&endDate=...
export async function GET(req: NextRequest) {
  const startDate = req.nextUrl.searchParams.get('startDate');
  const endDate = req.nextUrl.searchParams.get('endDate');

  let query = supabaseAdmin.from('appointments').select('*').eq('clinic_id', CLINIC_ID).limit(5000);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data: appts } = await query;
  const appointments = appts ?? [];

  const heatmapMap: Record<string, number> = {};
  const statusCountMap: Record<string, number> = {};
  let noShowCount = 0;
  let minTime = Infinity, maxTime = -Infinity;

  for (const a of appointments) {
    // append time to force local-time parsing (bare date strings parse as UTC → wrong day in +7)
    const date = new Date(a.date + 'T00:00:00');
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

    const st = (a.note ?? '').toLowerCase();
    const noShow = st.includes('no-show') || st.includes('noshow') || st.includes('ไม่มา');
    if (noShow) noShowCount++;
    statusCountMap[noShow ? 'No-show' : 'Completed'] = (statusCountMap[noShow ? 'No-show' : 'Completed'] || 0) + 1;
  }

  // Doctor workload — ดึงจาก visits table (มี doctor field จาก sheet sync)
  // เพราะ appointments table ไม่มี column doctor
  let visitsQuery = supabaseAdmin.from('visits').select('doctor').eq('clinic_id', CLINIC_ID).limit(5000);
  if (startDate) visitsQuery = visitsQuery.gte('visit_date', startDate);
  if (endDate)   visitsQuery = visitsQuery.lte('visit_date', endDate);
  const { data: visitsData } = await visitsQuery;

  const doctorVisitMap: Record<string, number> = {};
  for (const v of visitsData ?? []) {
    const docKey = v.doctor?.trim() || 'ไม่ระบุแพทย์';
    doctorVisitMap[docKey] = (doctorVisitMap[docKey] || 0) + 1;
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

  // Doctor workload — ใช้ doctor_names จาก settings + นับจาก visits จริง
  const { data: settingsData } = await supabaseAdmin.from('settings').select('doctor_names').eq('clinic_id', CLINIC_ID).single();
  const doctorNames: string[] = settingsData?.doctor_names ?? [];

  // รวมทุกชื่อหมอที่ปรากฏใน appointments (รวม "ไม่ระบุแพทย์") + ชื่อจาก settings
  const allDoctors = new Set([...doctorNames, ...Object.keys(doctorVisitMap)]);

  const doctorWorkload = [...allDoctors].filter(Boolean).map(name => {
    const visits = doctorVisitMap[name] || 0;
    return { name, visits };
  }).sort((a, b) => b.visits - a.visits).slice(0, 10);

  const unassignedCount = doctorVisitMap['ไม่ระบุแพทย์'] ?? 0;

  return NextResponse.json({
    heatmap,
    noShowRate: total > 0 ? (noShowCount / total) * 100 : 0,
    totalAppointments: total,
    noShowCount,
    doctorWorkload,
    unassignedCount,
    statusBreakdown: Object.entries(statusCountMap).sort(([, a], [, b]) => b - a).map(([status, count]) => ({ status, count })),
    peakDay: peakDayStr ?? 'Mon',
    peakHour: peakHour ?? '14:00',
  });
}
