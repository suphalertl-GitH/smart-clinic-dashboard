'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fmt } from './KpiCard';

type Props = { data: any };

const CAT_COLORS: Record<string, string> = {
  Botox: '#3b82f6', Filler: '#8b5cf6', 'Skin quality': '#ec4899',
  SkinQuality: '#ec4899', EBD: '#22c55e', Surgery: '#ef4444', Other: '#f59e0b',
};
const CAT_BADGE: Record<string, string> = {
  Botox: 'bg-blue-100 text-blue-700', Filler: 'bg-purple-100 text-purple-700',
  'Skin quality': 'bg-pink-100 text-pink-700', EBD: 'bg-green-100 text-green-700',
  Surgery: 'bg-red-100 text-red-700', Other: 'bg-amber-100 text-amber-700',
};

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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Revenue by Category (Monthly)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueByCategoryMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `฿${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [fmt(Number(v ?? 0))]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Botox" stackId="a" fill={CAT_COLORS.Botox} />
              <Bar dataKey="Filler" stackId="a" fill={CAT_COLORS.Filler} />
              <Bar dataKey="SkinQuality" name="Skin quality" stackId="a" fill={CAT_COLORS.SkinQuality} />
              <Bar dataKey="EBD" stackId="a" fill={CAT_COLORS.EBD} />
              <Bar dataKey="Surgery" stackId="a" fill={CAT_COLORS.Surgery} />
              <Bar dataKey="Other" stackId="a" fill={CAT_COLORS.Other} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Revenue Share by Category</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={revenueShareByCategory} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={2}>
                {revenueShareByCategory.map((e: any, i: number) => <Cell key={i} fill={CAT_COLORS[e.name] || '#9ca3af'} />)}
              </Pie>
              <Tooltip formatter={(v) => [fmt(Number(v ?? 0))]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
            {revenueShareByCategory.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT_COLORS[item.name] || '#9ca3af' }} />
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Services Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold">Top Services by Revenue</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Treatment</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Category</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Revenue</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Visits</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Avg/Visit</th>
            </tr></thead>
            <tbody>
              {topServices.map((s: any, i: number) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_BADGE[s.category] || 'bg-gray-100 text-gray-600'}`}>{s.category}</span></td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(s.revenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{s.visits}</td>
                  <td className="px-5 py-3 text-right text-gray-400">{fmt(s.avgPerVisit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Ranking */}
      {salesRanking.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200"><h3 className="text-sm font-semibold">Sales Ranking & Progress</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase w-16">Rank</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Sales</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Actual</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase w-32">Target</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase w-48">Progress</th>
              </tr></thead>
              <tbody>
                {salesRanking.map((s: any) => {
                  const target = targets[s.name] ?? s.target;
                  const pct = target > 0 ? Math.min((s.revenue / target) * 100, 100) : 0;
                  const rankColors = ['#f59e0b', '#9ca3af', '#cd7c2f'];
                  return (
                    <tr key={s.rank} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white" style={{ backgroundColor: rankColors[s.rank - 1] || '#6b7280' }}>{s.rank}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">{s.revenue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <input type="text" value={target.toLocaleString()} onChange={e => setTargets(prev => ({ ...prev, [s.name]: parseFloat(e.target.value.replace(/,/g, '')) || 0 }))}
                          className="w-full bg-transparent text-right font-medium text-gray-400 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none p-1" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(1)}%</span>
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
