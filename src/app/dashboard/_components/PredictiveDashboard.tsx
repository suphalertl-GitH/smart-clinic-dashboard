'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, Clock, RefreshCw,
  Brain, Sparkles, Users, ShieldAlert, Calendar, BarChart3,
} from 'lucide-react';
import { fmt } from './KpiCard';

const PRIMARY  = '#0f4c5c';
const ACCENT   = '#e36414';
const SAGE     = '#5FAD82';
const GOLD     = '#D97706';
const ROSE     = '#e11d48';
const CAT_PAL  = ['#0f4c5c', '#e36414', '#5FAD82', '#D97706', '#0891b2', '#d946ef'];

// ── Shared section header ──────────────────────────────────────
function SectionHeader({ icon: Icon, title, badge }: { icon: React.FC<any>; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E6F4F4', color: PRIMARY }}>
        <Icon size={16} />
      </div>
      <h3 className="text-base font-heading font-semibold text-slate-800">{title}</h3>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: ACCENT }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Forecast KPI card ──────────────────────────────────────────
function ForecastCard({ label, value, sub, up, gradient }: {
  label: string; value: string; sub?: string; up?: boolean; gradient?: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 text-white relative overflow-hidden stat-glow"
      style={{ background: gradient ?? `linear-gradient(135deg, ${PRIMARY}, #1a6b7a)` }}
    >
      <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold mb-1 leading-snug">{label}</p>
      <p className="text-lg lg:text-2xl font-heading font-black">{value}</p>
      {sub && (
        <div className="flex items-center gap-1 mt-1.5">
          {up !== undefined && (
            up ? <TrendingUp size={12} className="text-white/70" /> : <TrendingDown size={12} className="text-white/70" />
          )}
          <span className="text-xs text-white/70 font-medium">{sub}</span>
        </div>
      )}
    </div>
  );
}

// ── Custom dashed dot ──────────────────────────────────────────
const DashedDot = (props: any) => {
  const { cx, cy } = props;
  return <circle cx={cx} cy={cy} r={4} fill={ACCENT} stroke="#fff" strokeWidth={2} />;
};

// ── Main Component ─────────────────────────────────────────────
export default function PredictiveDashboard() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const fetched = useRef(false);

  async function load(force = false) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/predictive${force ? '?force=1' : ''}`, {
        signal: AbortSignal.timeout(25000),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e: any) {
      setError(e.name === 'TimeoutError' ? 'วิเคราะห์ใช้เวลานานเกินไป กรุณากด รีเฟรช' : (e.message ?? 'ไม่สามารถโหลดข้อมูลได้'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!fetched.current) { fetched.current = true; load(); }
    return () => { fetched.current = false; };
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
        <RefreshCw size={20} className="animate-spin" /> กำลังวิเคราะห์ข้อมูล...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 rounded-2xl p-8 text-center border border-red-200">
        <AlertTriangle size={32} className="mx-auto text-red-400 mb-3" />
        <p className="text-red-600 font-semibold mb-3">{error}</p>
        <button onClick={() => load(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: PRIMARY }}>
          ลองใหม่
        </button>
      </div>
    );
  }

  const {
    revenueForecast = [],
    forecastSummary = {},
    churnRisk = [],
    churnStats = { high: 0, medium: 0, total: 0 },
    dueSoon = [],
    retentionRate = 0,
    catTrend = [],
    totalPatients = 0,
    aiNarrative = null,
  } = data ?? {};

  const { currentMonth = 0, nextMonth = 0, month2 = 0, month3 = 0, growthRate = 0, forecastChange = 0 } = forecastSummary;

  // Split chart into actual + forecast zones for coloring
  const chartData = revenueForecast.map((d: any) => ({
    ...d,
    actual:   d.actual   ?? undefined,
    trend:    d.trend    ?? undefined,
    forecast: d.forecast ?? undefined,
  }));

  const catKeys = catTrend.length > 0
    ? Object.keys(catTrend[0]).filter(k => k !== 'month')
    : ['Botox', 'Filler', 'SkinQuality', 'EBD', 'Surgery', 'Other'];

  return (
    <div className="space-y-7">

      {/* ── Header strip ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY}, #1a6b7a)` }}>
            <Brain size={20} />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">Predictive Analytics</h2>
            <p className="text-xs text-slate-400">AI-powered revenue forecast & patient retention insights</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold text-white" style={{ backgroundColor: '#1E1B4B' }}>
            Enterprise
          </span>
        </div>
        <button
          onClick={() => load(true)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: PRIMARY }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      {/* ── KPI forecast cards ───────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
        <ForecastCard
          label="เดือนนี้ (Actual)"
          value={fmt(currentMonth)}
          sub={`เติบโต ${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}% (3M)`}
          up={growthRate >= 0}
        />
        <ForecastCard
          label="พยากรณ์เดือนหน้า"
          value={fmt(nextMonth)}
          sub={`${forecastChange > 0 ? '+' : ''}${forecastChange.toFixed(1)}% จากเดือนนี้`}
          up={forecastChange >= 0}
          gradient={`linear-gradient(135deg, ${ACCENT}, #f97316)`}
        />
        <ForecastCard
          label="พยากรณ์ +2 เดือน"
          value={fmt(month2)}
          gradient="linear-gradient(135deg, #0891b2, #06b6d4)"
        />
        <ForecastCard
          label="พยากรณ์ +3 เดือน"
          value={fmt(month3)}
          gradient="linear-gradient(135deg, #7c3aed, #a78bfa)"
        />
        <ForecastCard
          label="Retention Rate"
          value={`${retentionRate}%`}
          sub={`${totalPatients} คนไข้ทั้งหมด`}
          gradient={retentionRate >= 60
            ? `linear-gradient(135deg, ${SAGE}, #34d399)`
            : `linear-gradient(135deg, ${ROSE}, #fb7185)`}
        />
      </div>

      {/* ── Revenue Forecast Chart ───────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <SectionHeader icon={TrendingUp} title="Revenue Forecast (12 months + 3 months predicted)" />
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.18} />
                <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.18} />
                <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis
              tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              formatter={(v: any, name: any) => [fmt(Number(v ?? 0)), name === 'actual' ? 'Actual' : name === 'trend' ? 'Trend' : 'Forecast']}
            />
            <Legend
              iconType="circle" iconSize={8}
              formatter={(v) => v === 'actual' ? 'Actual Revenue' : v === 'trend' ? 'Trend Line' : 'Forecast'}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Area
              type="monotone" dataKey="actual" name="actual"
              stroke={PRIMARY} strokeWidth={2.5}
              fill="url(#gradActual)"
              dot={{ r: 3.5, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false}
            />
            <Area
              type="monotone" dataKey="trend" name="trend"
              stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3"
              fill="none"
              dot={false}
              connectNulls={false}
            />
            <Area
              type="monotone" dataKey="forecast" name="forecast"
              stroke={ACCENT} strokeWidth={2.5} strokeDasharray="6 3"
              fill="url(#gradForecast)"
              dot={<DashedDot />}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-400 mt-3 text-center">
          เส้น Trend คำนวณจาก Linear Regression · Forecast คาดการณ์ 3 เดือนข้างหน้า
        </p>
      </div>

      {/* ── Churn Risk + Due Soon ────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Churn Risk */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FFF1F0', color: ROSE }}>
                <ShieldAlert size={16} />
              </div>
              <h3 className="text-sm font-heading font-semibold text-slate-800">Churn Risk Patients</h3>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: ROSE }}>
                High {churnStats.high}
              </span>
              <span className="px-2 py-0.5 rounded-full text-white bg-amber-500">
                Med {churnStats.medium}
              </span>
            </div>
          </div>
          {churnRisk.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">ไม่มีคนไข้ที่มีความเสี่ยง</div>
          ) : (
            <div className="overflow-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">ชื่อ</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">ห่างหาย</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">Tier</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">ความเสี่ยง</th>
                  </tr>
                </thead>
                <tbody>
                  {churnRisk.map((p: any, i: number) => (
                    <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-700">{p.name || p.hn}</p>
                        <p className="text-xs text-slate-400">{p.lastVisit}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-bold" style={{ color: p.riskLevel === 'high' ? ROSE : GOLD }}>
                          {p.daysSince}d
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize"
                          style={{
                            backgroundColor: p.tier === 'platinum' ? '#EDE9FE' : p.tier === 'gold' ? '#FEF3C7' : p.tier === 'silver' ? '#F1F5F9' : '#F9FAFB',
                            color: p.tier === 'platinum' ? '#7c3aed' : p.tier === 'gold' ? '#D97706' : p.tier === 'silver' ? '#475569' : '#6B7280',
                          }}>
                          {p.tier}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          p.riskLevel === 'high' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          {p.riskLevel === 'high' ? 'High' : 'Med'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Treatment Due Soon */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E6F4F4', color: PRIMARY }}>
                <Calendar size={16} />
              </div>
              <h3 className="text-sm font-heading font-semibold text-slate-800">Treatment Due Soon</h3>
            </div>
            <span className="text-xs font-bold text-white px-2.5 py-0.5 rounded-full" style={{ backgroundColor: PRIMARY }}>
              {dueSoon.length} คน
            </span>
          </div>
          {dueSoon.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">ไม่มีนัดหมายในช่วง 30 วัน</div>
          ) : (
            <div className="overflow-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">ชื่อ</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">Treatment</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">วันที่ครบรอบ</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase">อีกกี่วัน</th>
                  </tr>
                </thead>
                <tbody>
                  {dueSoon.map((d: any, i: number) => {
                    const overdue = d.daysUntil < 0;
                    const urgent  = d.daysUntil >= 0 && d.daysUntil <= 7;
                    return (
                      <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-700">{d.name || d.hn}</p>
                          <p className="text-xs text-slate-400">{d.hn}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: '#E6F4F4', color: PRIMARY }}>
                            {d.treatment}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-slate-500">{d.dueDate}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            overdue ? 'bg-red-100 text-red-600'
                            : urgent ? 'bg-amber-100 text-amber-600'
                            : 'bg-slate-100 text-slate-500'
                          }`}>
                            {overdue ? `${Math.abs(d.daysUntil)}d ago` : `${d.daysUntil}d`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Revenue by Category trend ─────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <SectionHeader icon={BarChart3} title="Revenue by Category (6 months)" />
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={catTrend} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              formatter={(v: any) => [fmt(Number(v ?? 0))]}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            {catKeys.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="a" fill={CAT_PAL[i % CAT_PAL.length]}
                radius={i === catKeys.length - 1 ? [4, 4, 0, 0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── AI Narrative ─────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${PRIMARY}, #1a6b7a)` }}>
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-white text-sm">AI Business Insights</h3>
            <p className="text-xs text-white/60">วิเคราะห์โดย Groq AI · อัปเดตทุกครั้งที่รีเฟรช</p>
          </div>
        </div>

        {!aiNarrative ? (
          <div className="bg-white p-8 text-center text-slate-400 text-sm">
            ไม่สามารถวิเคราะห์ข้อมูล AI ได้ในขณะนี้
          </div>
        ) : (
          <div className="bg-white p-5 space-y-5">
            {/* Summary */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">สรุปภาพรวม</p>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{aiNarrative.summary}</p>
            </div>

            {/* 3 columns: Opportunities / Risks / Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Opportunities */}
              <div className="rounded-xl bg-teal-50 border border-teal-100 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-3 flex items-center gap-1.5">
                  <TrendingUp size={12} /> โอกาสทางธุรกิจ
                </p>
                <ul className="space-y-2">
                  {(aiNarrative.opportunities ?? []).map((op: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-teal-800 font-medium">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                      {op}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risks */}
              <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> ความเสี่ยง
                </p>
                <ul className="space-y-2">
                  {(aiNarrative.risks ?? []).map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-red-700 font-medium">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3 flex items-center gap-1.5">
                  <Clock size={12} /> Action Items
                </p>
                <ul className="space-y-2">
                  {(aiNarrative.actions ?? []).map((a: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-amber-800 font-medium">
                      <span className="font-black text-amber-400 text-xs flex-shrink-0 mt-0.5">{i + 1}.</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
