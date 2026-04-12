import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { claudeComplete } from '@/lib/claude';
import { requireFeature } from '@/lib/tier';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

function getThaiNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
}
function getMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function toMonthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
function addMonths(d: Date, n: number) {
  const r = new Date(d); r.setMonth(r.getMonth() + n); return r;
}

// Linear regression: y = a + b*x  returns next N predicted values
function linearForecast(values: number[], futureN = 3): { trend: number[]; future: number[] } {
  const n = values.length;
  if (n < 2) return { trend: values, future: Array(futureN).fill(values[0] ?? 0) };
  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = values.reduce((s, y) => s + y, 0) / n;
  const b = xs.reduce((s, x, i) => s + (x - xMean) * (values[i] - yMean), 0)
           / xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const a = yMean - b * xMean;
  const trend  = values.map((_, i) => Math.max(0, Math.round(a + b * i)));
  const future = Array.from({ length: futureN }, (_, i) => Math.max(0, Math.round(a + b * (n + i))));
  return { trend, future };
}

// GET /api/predictive
export async function GET(req: NextRequest) {
  const gate = await requireFeature(CLINIC_ID, 'predictive');
  if (gate) return gate;

  const force = req.nextUrl.searchParams.get('force') === '1';

  try {
    const now = getThaiNow();

    // ── Fetch raw data ──────────────────────────────────────
    const [{ data: visits }, { data: patients }, { data: settings }] = await Promise.all([
      supabaseAdmin.from('visits').select('hn, price, treatment_name, created_at').eq('clinic_id', CLINIC_ID).limit(5000),
      // จำกัด patients เฉพาะที่มีข้อมูล loyalty (คนไข้ที่ active จริงๆ)
      supabaseAdmin.from('patients').select('hn, full_name, line_user_id, loyalty_tier, lifetime_spending').eq('clinic_id', CLINIC_ID).limit(1000),
      supabaseAdmin.from('settings').select('treatment_cycles').eq('clinic_id', CLINIC_ID).single(),
    ]);

    const treatmentCycles: { treatment: string; days: number }[] = settings?.treatment_cycles ?? [
      { treatment: 'Botox', days: 120 },
      { treatment: 'Filler', days: 365 },
      { treatment: 'Sculptra', days: 540 },
      { treatment: 'Profhilo', days: 180 },
      { treatment: 'Juvelook', days: 180 },
    ];

    // ── Monthly Revenue Map (last 12 months) ────────────────
    const revenueByMonth: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = addMonths(now, -i);
      revenueByMonth[getMonthKey(d)] = 0;
    }
    for (const v of visits ?? []) {
      const mk = getMonthKey(new Date(v.created_at));
      if (mk in revenueByMonth) revenueByMonth[mk] = (revenueByMonth[mk] ?? 0) + (parseFloat(String(v.price)) || 0);
    }

    const monthKeys = Object.keys(revenueByMonth).sort();
    const monthValues = monthKeys.map(k => revenueByMonth[k]);
    const { trend, future } = linearForecast(monthValues, 3);

    // ── Revenue Forecast data ────────────────────────────────
    const revenueForecast = [
      ...monthKeys.map((k, i) => ({
        month: toMonthLabel(k),
        actual: monthValues[i],
        trend: trend[i],
        forecast: null as number | null,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        month: toMonthLabel(getMonthKey(addMonths(now, i + 1))),
        actual: null as number | null,
        trend: null as number | null,
        forecast: future[i],
      })),
    ];

    // ── Growth rate ──────────────────────────────────────────
    const last3 = monthValues.slice(-3);
    const prev3 = monthValues.slice(-6, -3);
    const last3Sum = last3.reduce((s, v) => s + v, 0);
    const prev3Sum = prev3.reduce((s, v) => s + v, 0);
    const growthRate = prev3Sum > 0 ? ((last3Sum - prev3Sum) / prev3Sum) * 100 : 0;
    const nextMonthForecast = future[0] ?? 0;
    const currentMonthRevenue = monthValues[monthValues.length - 1] ?? 0;
    const forecastChange = currentMonthRevenue > 0
      ? ((nextMonthForecast - currentMonthRevenue) / currentMonthRevenue) * 100 : 0;

    // ── Churn Risk ───────────────────────────────────────────
    // คนไข้ที่มาแล้ว แต่ไม่มาในช่วง 60-180 วัน
    const lastVisitMap: Record<string, { date: Date; count: number; treatment: string }> = {};
    for (const v of visits ?? []) {
      const d = new Date(v.created_at);
      if (!lastVisitMap[v.hn] || d > lastVisitMap[v.hn].date) {
        lastVisitMap[v.hn] = {
          date: d,
          count: (lastVisitMap[v.hn]?.count ?? 0) + 1,
          treatment: v.treatment_name ?? '',
        };
      } else {
        lastVisitMap[v.hn].count++;
      }
    }

    const churnRisk: { hn: string; name: string; lastVisit: string; daysSince: number; visits: number; tier: string; riskLevel: 'high' | 'medium' }[] = [];
    for (const p of patients ?? []) {
      const lv = lastVisitMap[p.hn];
      if (!lv) continue;
      const daysSince = Math.floor((now.getTime() - lv.date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 60 && daysSince <= 365) {
        churnRisk.push({
          hn: p.hn,
          name: p.full_name,
          lastVisit: lv.date.toLocaleDateString('th-TH'),
          daysSince,
          visits: lv.count,
          tier: p.loyalty_tier ?? 'bronze',
          riskLevel: daysSince >= 120 ? 'high' : 'medium',
        });
      }
    }
    churnRisk.sort((a, b) => b.daysSince - a.daysSince);

    const churnStats = {
      high: churnRisk.filter(c => c.riskLevel === 'high').length,
      medium: churnRisk.filter(c => c.riskLevel === 'medium').length,
      total: churnRisk.length,
    };

    // ── Treatment Due Soon (next 30 days) ────────────────────
    const dueSoon: { hn: string; name: string; treatment: string; dueDate: string; daysUntil: number; lineUserId: string | null }[] = [];

    for (const cycle of treatmentCycles) {
      // หา last visit ต่อ treatment type
      const treatVisits: Record<string, Date> = {};
      for (const v of visits ?? []) {
        if (!v.treatment_name?.toLowerCase().includes(cycle.treatment.toLowerCase())) continue;
        const d = new Date(v.created_at);
        if (!treatVisits[v.hn] || d > treatVisits[v.hn]) treatVisits[v.hn] = d;
      }

      for (const [hn, lastDate] of Object.entries(treatVisits)) {
        const dueDate = new Date(lastDate);
        dueDate.setDate(dueDate.getDate() + cycle.days);
        const daysUntil = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil >= -7 && daysUntil <= 30) {
          const patient = (patients ?? []).find(p => p.hn === hn);
          if (!patient) continue;
          dueSoon.push({
            hn,
            name: patient.full_name,
            treatment: cycle.treatment,
            dueDate: dueDate.toLocaleDateString('th-TH'),
            daysUntil,
            lineUserId: patient.line_user_id ?? null,
          });
        }
      }
    }
    dueSoon.sort((a, b) => a.daysUntil - b.daysUntil);

    // ── Revenue by Category trend (last 6 months) ───────────
    const catKeys = ['Botox', 'Filler', 'SkinQuality', 'EBD', 'Surgery', 'Other'];
    function getCategory(t?: string): string {
      if (!t) return 'Other';
      const l = t.toLowerCase();
      if (l.includes('botox') || l.includes('nabota') || l.includes('xeomin')) return 'Botox';
      if (l.includes('filler')) return 'Filler';
      if (l.includes('ultherapy') || l.includes('ultraformer') || l.includes('oligio')) return 'EBD';
      if (l.includes('surgery') || l.includes('nose') || l.includes('chin')) return 'Surgery';
      if (l.includes('sculptra') || l.includes('profhilo') || l.includes('juvelook') || l.includes('meso') || l.includes('treatment')) return 'SkinQuality';
      return 'Other';
    }

    const catMonthMap: Record<string, Record<string, number>> = {};
    for (let i = 5; i >= 0; i--) {
      const mk = getMonthKey(addMonths(now, -i));
      catMonthMap[mk] = { Botox: 0, Filler: 0, SkinQuality: 0, EBD: 0, Surgery: 0, Other: 0 };
    }
    for (const v of visits ?? []) {
      const mk = getMonthKey(new Date(v.created_at));
      if (!(mk in catMonthMap)) continue;
      const cat = getCategory(v.treatment_name);
      catMonthMap[mk][cat] = (catMonthMap[mk][cat] ?? 0) + (parseFloat(String(v.price)) || 0);
    }

    // ── Retention rate (returning / total this month) ────────
    const currentMk = getMonthKey(now);
    const thisMonthVisits = (visits ?? []).filter(v => getMonthKey(new Date(v.created_at)) === currentMk);
    const uniqueThisMonth = new Set(thisMonthVisits.map(v => v.hn));
    const prevMonthVisitors = new Set(
      (visits ?? []).filter(v => getMonthKey(new Date(v.created_at)) === getMonthKey(addMonths(now, -1))).map(v => v.hn)
    );
    const retainedCount = [...uniqueThisMonth].filter(hn => prevMonthVisitors.has(hn)).length;
    const retentionRate = prevMonthVisitors.size > 0 ? Math.round((retainedCount / prevMonthVisitors.size) * 100) : 0;

    // ── AI Narrative (Groq) — รัน parallel แต่ไม่บล็อก response หลัก ──
    let aiNarrative: { summary: string; opportunities: string[]; risks: string[]; actions: string[] } | null = null;

    const prompt = `ข้อมูลคลินิกความงาม:
- รายได้เดือนปัจจุบัน: ฿${currentMonthRevenue.toLocaleString()}
- การเติบโต 3 เดือน: ${growthRate.toFixed(1)}%
- พยากรณ์เดือนหน้า: ฿${nextMonthForecast.toLocaleString()} (${forecastChange > 0 ? '+' : ''}${forecastChange.toFixed(1)}%)
- คนไข้เสี่ยง churn: ${churnStats.total} คน (high: ${churnStats.high}, medium: ${churnStats.medium})
- ใกล้ถึงรอบรักษา (30 วัน): ${dueSoon.length} คน
- Retention rate: ${retentionRate}%
- จำนวนคนไข้ทั้งหมด: ${(patients ?? []).length} คน

ตอบ JSON เท่านั้น:
{"summary":"สรุป 2 ประโยค","opportunities":["o1","o2","o3"],"risks":["r1","r2"],"actions":["a1","a2","a3"]}`;

    try {
      // timeout 7 วิ เพื่อไม่ให้เกิน Vercel 10s limit
      const aiPromise = claudeComplete(prompt, 'คุณคือที่ปรึกษาคลินิก ตอบ JSON เท่านั้น');
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('AI timeout')), 7000)
      );
      const raw = await Promise.race([aiPromise, timeoutPromise]) as string;
      const match = raw.match(/\{[\s\S]+\}/);
      if (match) aiNarrative = JSON.parse(match[0]);
    } catch { /* ใช้ null ถ้า AI ล้มเหลว หรือ timeout */ }

    return NextResponse.json({
      revenueForecast,
      forecastSummary: {
        currentMonth: currentMonthRevenue,
        nextMonth: nextMonthForecast,
        month2: future[1] ?? 0,
        month3: future[2] ?? 0,
        growthRate: Math.round(growthRate * 10) / 10,
        forecastChange: Math.round(forecastChange * 10) / 10,
      },
      churnRisk: churnRisk.slice(0, 20),
      churnStats,
      dueSoon: dueSoon.slice(0, 20),
      retentionRate,
      catTrend: Object.keys(catMonthMap).sort().map(k => ({
        month: toMonthLabel(k), ...catMonthMap[k],
      })),
      totalPatients: (patients ?? []).length,
      aiNarrative,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
