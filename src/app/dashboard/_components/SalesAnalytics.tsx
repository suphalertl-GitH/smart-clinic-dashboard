'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fmt, CAT_COLORS, CAT_BADGE, CHART_COLORS } from './KpiCard';

const PRIMARY = '#0f4c5c';
const ACCENT  = '#e36414';

type Props = { data: any };

export default function SalesAnalytics({ data }: Props) {
  const { revenueByCategoryMonth, revenueShareByCategory, topServices, salesRanking } = data;
  const [targets, setTargets] = useState<Record<string, number>>({});

  useEffect(() => {
    if (salesRanking) {
      setTargets(salesRanking.reduce((acc: any, s: any) => ({ ...acc, [s.name]: s.target }), {}));
    }
  }, [salesRanking]);

  return (
    <div className="space-y-5">

      {/* ── Stacked Bar + Donut (โครงสร้างเดิม) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-heading font-semibold mb-4 text-slate-700">Revenue by Category (Monthly)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueByCategoryMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={v => `฿${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v) => [fmt(Number(v ?? 0))]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Botox"       stackId="a" fill={CAT_COLORS.Botox} />
              <Bar dataKey="Filler"      stackId="a" fill={CAT_COLORS.Filler} />
              <Bar dataKey="SkinQuality" name="Skin quality" stackId="a" fill={CAT_COLORS.SkinQuality} />
              <Bar dataKey="EBD"         stackId="a" fill={CAT_COLORS.EBD} />
              <Bar dataKey="Surgery"     stackId="a" fill={CAT_COLORS.Surgery} />
              <Bar dataKey="Other"       stackId="a" fill={CAT_COLORS.Other} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-heading font-semibold mb-4 text-slate-700">Revenue Share by Category</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={revenueShareByCategory} cx="50%" cy="50%"
                innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                {revenueShareByCategory.map((e: any, i: number) => (
                  <Cell key={i} fill={CAT_COLORS[e.name] || CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v) => [fmt(Number(v ?? 0))]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
            {revenueShareByCategory.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-1 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CAT_COLORS[item.name] || CHART_COLORS[i % CHART_COLORS.length] }} />
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top Services Table (โครงสร้างเดิม) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ background: PRIMARY }} />
          <h3 className="text-sm font-heading font-semibold text-slate-700">Top Services by Revenue</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Treatment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Visits</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Avg/Visit</th>
              </tr>
            </thead>
            <tbody>
              {topServices.map((s: any, i: number) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-700">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${CAT_BADGE[s.category] || 'bg-slate-100 text-slate-600'}`}>
                      {s.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: PRIMARY }}>{fmt(s.revenue)}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{s.visits}</td>
                  <td className="px-5 py-3 text-right text-slate-400">{fmt(s.avgPerVisit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sales Ranking (โครงสร้างเดิม) ── */}
      {salesRanking.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: ACCENT }} />
            <h3 className="text-sm font-heading font-semibold text-slate-700">Sales Ranking & Progress</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase w-16">Rank</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Sales</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Actual</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase w-32">Target</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase w-48">Progress</th>
                </tr>
              </thead>
              <tbody>
                {salesRanking.map((s: any) => {
                  const target   = targets[s.name] ?? s.target;
                  const progress = target > 0 ? Math.min((s.revenue / target) * 100, 100) : 0;
                  const rankColors = ['#D97706', '#9CA3AF', '#CD7C2F'];
                  const barColor = progress >= 100 ? '#5FAD82' : progress >= 70 ? PRIMARY : ACCENT;
                  return (
                    <tr key={s.rank} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center text-white"
                          style={{ background: rankColors[s.rank - 1] || '#9CA3AF' }}>
                          {s.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: PRIMARY }}>{s.revenue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <input type="text" value={target.toLocaleString()}
                          onChange={e => setTargets(prev => ({ ...prev, [s.name]: parseFloat(e.target.value.replace(/,/g, '')) || 0 }))}
                          className="w-full bg-transparent text-right font-medium text-slate-400 border-b border-transparent hover:border-slate-200 focus:border-teal-400 focus:outline-none p-1" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: barColor }} />
                          </div>
                          <span className="text-xs text-slate-400 w-10 text-right">{progress.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
