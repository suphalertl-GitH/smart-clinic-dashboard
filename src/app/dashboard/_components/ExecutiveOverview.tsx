'use client';

import { DollarSign, TrendingUp, Users, UserCheck, Target, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import KpiCard, { fmt, calcPct, T, CHART_COLORS } from './KpiCard';
import ExecutiveSummary from './ExecutiveSummary';

type Theme = { bg: string; bgDark: string; accent: string; gradient: string };
type Props = { data: any; theme: Theme };

export default function ExecutiveOverview({ data, theme }: Props) {
  const { kpis, revenueTrend, topTreatments, topDoctors } = data;

  // Accent gradient (orange→amber by default)
  const accentGradient = `linear-gradient(135deg, ${theme.accent} 0%, #f59e0b 100%)`;

  return (
    <div className="space-y-5">

      {/* ── KPI Cards: 4 cols matching MedCare layout ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1 — Patients / Revenue Today (teal) */}
        <KpiCard
          variant="colored"
          gradient={theme.gradient}
          icon={<Users size={20} className="text-white" />}
          label="ผู้ป่วยทั้งหมด / Revenue Today"
          value={fmt(kpis.revenueToday)}
          badge={`+${Math.abs(calcPct(kpis.revenueToday, kpis.prevMonthRevenue / 30)).toFixed(0)}%`}
          animClass="fade-in fade-in-d1"
        />
        {/* 2 — Today Appointments (orange) */}
        <KpiCard
          variant="colored"
          gradient={accentGradient}
          icon={<TrendingUp size={20} className="text-white" />}
          label="รายได้เดือนนี้"
          value={fmt(kpis.monthlyRevenue)}
          badge="เดือนนี้"
          animClass="fade-in fade-in-d2"
        />
        {/* 3 — New Customers (white) */}
        <KpiCard
          icon={<Users size={20} />}
          label="ลูกค้าใหม่"
          value={String(kpis.newCustomers)}
          change={calcPct(kpis.newCustomers, kpis.prevNewCustomers)}
          iconBg="#E6F4F4" iconColor={theme.bg}
          animClass="fade-in fade-in-d3"
        />
        {/* 4 — Revenue (white) */}
        <KpiCard
          icon={<DollarSign size={20} />}
          label="Revenue Today"
          value={fmt(kpis.revenueToday)}
          change={calcPct(kpis.revenueToday, kpis.prevMonthRevenue / 30)}
          iconBg="#FEF3EE" iconColor={theme.accent}
          badge={`+8%`}
          animClass="fade-in fade-in-d4"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 text-slate-700 font-heading">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={v => `฿${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']}
              />
              <Line
                type="monotone" dataKey="revenue" stroke={theme.bg} strokeWidth={2.5}
                dot={{ r: 4, fill: theme.bg, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: theme.bg }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 text-slate-700 font-heading">Top Treatments by Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topTreatments.slice(0, 7)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={v => `฿${Math.round(v / 1000)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']}
              />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {topTreatments.slice(0, 7).map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top Doctors + AI Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5 text-slate-700 font-heading">
            <Activity size={14} style={{ color: theme.bg }} /> Top Doctors by Revenue
          </h3>
          <div className="space-y-4">
            {topDoctors.map((doc: any, i: number) => {
              const color = CHART_COLORS[i % CHART_COLORS.length];
              const maxRev = topDoctors[0]?.revenue || 1;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: color }}
                      >
                        {doc.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{doc.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold" style={{ color }}>{fmt(doc.revenue)}</span>
                      <span className="text-xs text-slate-400 ml-2">{doc.visits} visits</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round((doc.revenue / maxRev) * 100)}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <ExecutiveSummary />
      </div>
    </div>
  );
}
