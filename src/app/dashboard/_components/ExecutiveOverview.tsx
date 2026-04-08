'use client';

import { DollarSign, TrendingUp, Users, UserCheck, Target, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KpiCard, { fmt, calcPct, T, CHART_COLORS } from './KpiCard';
import ExecutiveSummary from './ExecutiveSummary';

type Props = { data: any };

export default function ExecutiveOverview({ data }: Props) {
  const { kpis, revenueTrend, topTreatments, topDoctors } = data;

  return (
    <div className="space-y-5">
      {/* KPI Row — cards 1&2 colored, rest white */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          variant="teal"
          icon={<DollarSign size={20} />}
          label="Revenue Today"
          value={fmt(kpis.revenueToday)}
          change={calcPct(kpis.revenueToday, kpis.prevMonthRevenue / 30)}
          num={1}
        />
        <KpiCard
          variant="orange"
          icon={<TrendingUp size={20} />}
          label="Monthly Revenue"
          value={fmt(kpis.monthlyRevenue)}
          change={calcPct(kpis.monthlyRevenue, kpis.prevMonthRevenue)}
          num={2}
        />
        <KpiCard
          icon={<Users size={20} />}
          label="New Customers"
          value={String(kpis.newCustomers)}
          change={calcPct(kpis.newCustomers, kpis.prevNewCustomers)}
          iconBg="#E6F4F0" iconColor={T.sage}
          num={3}
        />
        <KpiCard
          icon={<UserCheck size={20} />}
          label="Returning"
          value={String(kpis.returning)}
          change={calcPct(kpis.returning, kpis.prevReturning)}
          positiveUp={false}
          iconBg="#FEF3EE" iconColor={T.orange}
          num={4}
        />
        <KpiCard
          icon={<Target size={20} />}
          label="Conversion"
          value={`${kpis.conversionRate.toFixed(1)}%`}
          iconBg="#FDF6EC" iconColor={T.gold}
          num={5}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 text-stone-700">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f0eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis tickFormatter={v => `฿${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']}
              />
              <Line
                type="monotone" dataKey="revenue" stroke={T.teal} strokeWidth={2.5}
                dot={{ r: 4, fill: T.teal, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: T.teal }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 text-stone-700">Top Treatments by Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topTreatments.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f0eb" />
              <XAxis type="number" tickFormatter={v => `฿${Math.round(v / 1000)}k`} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} width={90} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']}
              />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {topTreatments.slice(0, 8).map((_: any, i: number) => (
                  <rect key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Doctors + AI Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5 text-stone-700">
            <Activity size={14} style={{ color: T.teal }} /> Top Doctors by Revenue
          </h3>
          <div className="space-y-4">
            {topDoctors.map((doc: any, i: number) => {
              const color = CHART_COLORS[i % CHART_COLORS.length];
              const maxRev = topDoctors[0]?.revenue || 1;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      {/* Avatar circle */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                        style={{ background: color }}
                      >
                        {doc.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-stone-700">{doc.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold" style={{ color }}>{fmt(doc.revenue)}</span>
                      <span className="text-xs text-stone-400 ml-2">{doc.visits} visits</span>
                    </div>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round(doc.revenue / maxRev * 100)}%`, background: color }}
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
