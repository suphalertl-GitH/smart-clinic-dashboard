'use client';

import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fmt, themeChartColors } from './KpiCard';

type Theme = { bg: string; bgDark: string; accent: string; gradient: string };
type Props = { data: any; theme: Theme; hasDateFilter?: boolean };

type Period = 'week' | 'month';

function PeriodPill({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  const opts: { v: Period; label: string }[] = [{ v: 'week', label: 'Week' }, { v: 'month', label: 'Month' }];
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px]">
      {opts.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 rounded-md transition ${
            value === o.v ? 'bg-white shadow-sm text-slate-700 font-medium' : 'text-slate-500 hover:text-slate-700'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function CustomerInsights({ data, theme, hasDateFilter = false }: Props) {
  const PRIMARY = theme.bg;
  const SAGE    = theme.accent;
  const COLORS  = themeChartColors(theme);

  const [period, setPeriod] = useState<Period>('month');
  const bundle = (period === 'week' ? data.customerInsightsWeek : data.customerInsightsMonth) ?? {};
  // When a date filter is active, the rolling-window bundle would be empty if the
  // selected range doesn't overlap today — fall back to filter-aware top-level fields.
  const newRegistrations    = hasDateFilter ? (data.newRegistrationsByMonth ?? []) : (bundle.newRegistrations ?? data.newRegistrationsByMonth ?? []);
  const customerTypeDistribution = hasDateFilter ? (data.customerTypeDistribution ?? []) : (bundle.customerType ?? data.customerTypeDistribution ?? []);
  const acquisitionSource   = hasDateFilter ? (data.acquisitionSource ?? []) : (bundle.acquisitionSource ?? data.acquisitionSource ?? []);
  const visitFrequency      = hasDateFilter ? (data.visitFrequency ?? []) : (bundle.visitFrequency ?? data.visitFrequency ?? []);
  // Top 10 Patients always uses the full-range top-level data — not affected by the page toggle
  const topPatients         = data.topPatients ?? [];
  // When date filter is active, the unit reverts to patient-registration (top-level field)
  const newChartTitle = hasDateFilter ? 'New Patient Registrations' : 'New Customer Visits';

  return (
    <div className="space-y-5">

      {!hasDateFilter && (
        <div className="flex items-center justify-end">
          <PeriodPill value={period} onChange={setPeriod} />
        </div>
      )}

      {/* ── New Registrations + Customer Type (โครงสร้างเดิม) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-heading font-semibold mb-4 text-slate-700">{newChartTitle}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={newRegistrations}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke={PRIMARY} strokeWidth={2.5}
                dot={{ r: 4, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: PRIMARY }} name="New Visits" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-heading font-semibold mb-4 text-slate-700">Customer Type Distribution</h3>
          {customerTypeDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={customerTypeDistribution} cx="50%" cy="50%"
                    innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                    {customerTypeDistribution.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                {customerTypeDistribution.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {item.name}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* ── Acquisition Source + Visit Frequency (โครงสร้างเดิม) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-heading font-semibold mb-4 text-slate-700">Patient Acquisition Source</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={acquisitionSource}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="source" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Bar dataKey="count" fill={PRIMARY} radius={[5, 5, 0, 0]} name="Patients" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-heading font-semibold mb-4 text-slate-700">Visit Frequency Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={visitFrequency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Bar dataKey="count" fill={SAGE} radius={[5, 5, 0, 0]} name="Patients" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top 10 Patients Table (โครงสร้างเดิม) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ background: PRIMARY }} />
          <h3 className="text-sm font-heading font-semibold text-slate-700">Top 10 Patients by Revenue</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase w-12">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Patient HN</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Visits</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Revenue</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase">Avg/Visit</th>
              </tr>
            </thead>
            <tbody>
              {topPatients.map((p: any, i: number) => {
                const color = COLORS[i % COLORS.length];
                return (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: color }}>
                        {i + 1}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{p.hn}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{p.visits}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: PRIMARY }}>{fmt(p.revenue)}</td>
                    <td className="px-5 py-3 text-right text-slate-400">{fmt(p.avgPerVisit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
