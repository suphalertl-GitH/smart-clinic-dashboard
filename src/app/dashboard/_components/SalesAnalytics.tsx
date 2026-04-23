'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Trophy, TrendingUp, TrendingDown, Check, Loader2, Save, AlertCircle } from 'lucide-react';
import { fmt, CAT_COLORS, themeChartColors } from './KpiCard';

const SAGE = '#5FAD82';
const GOLD = '#D97706';

type Theme = { bg: string; bgDark: string; accent: string; gradient: string };
type Props = { data: any; theme: Theme };

export default function SalesAnalytics({ data, theme }: Props) {
  const PRIMARY = theme.bg;
  const ACCENT  = theme.accent;
  const COLORS  = themeChartColors(theme);
  const { revenueTrendMonthly = [], revenueShareByCategory, topDoctors, topServices, salesRanking } = data;
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [savedTargets, setSavedTargets] = useState<Record<string, number>>({});
  const [savingName, setSavingName] = useState<string | null>(null);
  const [savedName, setSavedName]   = useState<string | null>(null);
  const [errorName, setErrorName]   = useState<{ name: string; msg: string } | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // โหลด target ที่ save ไว้ใน DB
  useEffect(() => {
    fetch('/api/sales-targets')
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json?.targets) setSavedTargets(json.targets); })
      .catch(() => {/* silent — fallback ไปใช้ค่า default */});
  }, []);

  // เริ่มค่าเริ่มต้น: ใช้ savedTargets ก่อน ถ้าไม่มีใช้ default จาก API (SALES_TARGET)
  useEffect(() => {
    if (!salesRanking) return;
    setTargets(salesRanking.reduce((acc: any, s: any) => ({
      ...acc,
      [s.name]: savedTargets[s.name] ?? s.target,
    }), {}));
  }, [salesRanking, savedTargets]);

  async function saveTarget(name: string, value: number) {
    setErrorName(null);
    setSavingName(name);
    try {
      const res = await fetch('/api/sales-targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sales_name: name, target: value }),
      });
      if (res.ok) {
        setSavedTargets(prev => ({ ...prev, [name]: value }));
        setSavedName(name);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSavedName(null), 2000);
      } else {
        const j = await res.json().catch(() => ({}));
        setErrorName({ name, msg: j?.error ?? `HTTP ${res.status}` });
      }
    } catch (e: any) {
      setErrorName({ name, msg: e?.message ?? 'Network error' });
    } finally {
      setSavingName(null);
    }
  }

  const totalSales = salesRanking.reduce((sum: number, s: any) => sum + s.revenue, 0);
  const topPerformer = salesRanking[0] ?? null;

  // Avg ticket size per category — weighted avg (total revenue / total visits per category)
  const catRevMap: Record<string, { revenue: number; visits: number }> = {};
  for (const s of topServices ?? []) {
    if (!catRevMap[s.category]) catRevMap[s.category] = { revenue: 0, visits: 0 };
    catRevMap[s.category].revenue += s.revenue;
    catRevMap[s.category].visits  += s.visits;
  }
  const avgCards = Object.entries(catRevMap).slice(0, 4).map(([cat, { revenue, visits }]) => ({
    cat, avg: visits > 0 ? Math.round(revenue / visits) : 0,
  }));

  return (
    <div className="space-y-6">

      {/* ── Row 1: Area Revenue Trend + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Area Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-base font-heading font-semibold text-slate-800 mb-4">Revenue Trend (12 Months)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueTrendMonthly}>
              <defs>
                <linearGradient id="areaGradSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke={PRIMARY} strokeWidth={2.5}
                fill="url(#areaGradSales)"
                dot={{ r: 4, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: PRIMARY }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut: Revenue by Treatment */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-base font-heading font-semibold text-slate-800 mb-2">Revenue by Treatment</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={revenueShareByCategory} cx="50%" cy="50%"
                innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                {revenueShareByCategory.map((e: any, i: number) => (
                  <Cell key={i} fill={CAT_COLORS[e.name] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v) => [fmt(Number(v ?? 0))]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-auto">
            {revenueShareByCategory.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-1 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CAT_COLORS[item.name] || COLORS[i % COLORS.length] }} />
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Doctor Performance + Avg Ticket Size ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Doctor Horizontal Bars */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-base font-heading font-semibold text-slate-800 mb-4">Performance by Doctor</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topDoctors} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={v => `฿${Math.round(v / 1000)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']} />
              <Bar dataKey="revenue" fill={PRIMARY} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Avg Ticket Size + Total Clinic Avg */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 flex-1">
            {avgCards.map(({ cat, avg }, i) => (
              <div key={cat} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{cat}</p>
                <p className="text-xl font-heading font-black text-slate-800">฿{avg.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">avg/visit</p>
              </div>
            ))}
          </div>
          {/* Clinic overall avg */}
          {totalSales > 0 && (
            <div className="rounded-2xl p-4 text-white flex items-center justify-between"
              style={{ background: theme.gradient }}>
              <div>
                <p className="text-xs text-white/70 mb-1">ค่าเฉลี่ยรวมทั้งคลินิก</p>
                <p className="text-2xl font-heading font-black">{fmt(totalSales)}</p>
              </div>
              <TrendingUp size={28} className="text-white/30" />
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Sales Performance ── */}
      {salesRanking.length > 0 && (
        <div>
          <h3 className="text-base font-heading font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Trophy size={16} style={{ color: GOLD }} /> Sales Performance
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            {/* #1 Performer Card */}
            {topPerformer && (
              <div className="lg:col-span-2 rounded-2xl p-5 text-white relative overflow-hidden stat-glow"
                style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #fbbf24 100%)` }}>
                <span className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full bg-white/25">
                  #1 Performer
                </span>
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                  <Trophy size={20} className="text-white" />
                </div>
                <p className="text-xs text-white/70 font-medium mb-1">Top Sales</p>
                <p className="text-2xl font-heading font-black">{topPerformer.name}</p>
                <p className="text-white/80 text-sm mt-1">{fmt(topPerformer.revenue)}</p>
              </div>
            )}
            {/* Total Sales Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${PRIMARY}18`, color: PRIMARY }}>
                <TrendingUp size={20} />
              </div>
              <p className="text-xs text-slate-400 font-medium mb-1">Total Sales</p>
              <p className="text-2xl font-heading font-black text-slate-800">{fmt(totalSales)}</p>
            </div>
          </div>

          {/* ── Sales Ranking Table ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-heading font-semibold text-slate-700">Sales Ranking & Progress</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Rank</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Sales Name</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Actual Sales</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Target</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase w-52">Achieved %</th>
                  </tr>
                </thead>
                <tbody>
                  {salesRanking.map((s: any) => {
                    const target   = targets[s.name] ?? s.target;
                    const progress = target > 0 ? Math.min((s.revenue / target) * 100, 100) : 0;
                    const medal = ['🥇', '🥈', '🥉'][s.rank - 1] ?? `#${s.rank}`;
                    const barColor = progress >= 100 ? SAGE : progress >= 70 ? PRIMARY : ACCENT;
                    return (
                      <tr key={s.rank} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-lg">{medal}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: PRIMARY }}>
                          {fmt(s.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(() => {
                            const dirty   = target !== (savedTargets[s.name] ?? s.target);
                            const saving  = savingName === s.name;
                            const success = savedName === s.name;
                            const err     = errorName && errorName.name === s.name ? errorName.msg : null;
                            return (
                              <div className="flex items-center justify-end gap-1.5">
                                <input type="text" value={target.toLocaleString()}
                                  onChange={e => setTargets(prev => ({ ...prev, [s.name]: parseFloat(e.target.value.replace(/,/g, '')) || 0 }))}
                                  onKeyDown={e => { if (e.key === 'Enter') saveTarget(s.name, target); }}
                                  className="w-full bg-transparent text-right font-medium text-slate-500 border-b border-transparent hover:border-slate-200 focus:border-teal-400 focus:outline-none p-1 text-sm"
                                />
                                {err ? (
                                  <span title={err} className="shrink-0 flex items-center">
                                    <AlertCircle size={14} className="text-red-500" />
                                  </span>
                                ) : success && !dirty ? (
                                  <span className="shrink-0 flex items-center" title="บันทึกแล้ว">
                                    <Check size={14} className="text-emerald-500" />
                                  </span>
                                ) : (
                                  <button type="button"
                                    onClick={() => saveTarget(s.name, target)}
                                    disabled={!dirty || saving}
                                    title={dirty ? 'บันทึก' : 'ยังไม่มีการแก้ไข'}
                                    className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                                      dirty ? 'text-teal-600 hover:bg-teal-50' : 'text-slate-300 cursor-default'
                                    } disabled:opacity-60`}
                                  >
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${progress}%`, background: barColor }} />
                            </div>
                            <span className="text-xs font-semibold w-12 text-right"
                              style={{ color: barColor }}>{progress.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
