'use client';

import { useState } from 'react';
import { DollarSign, TrendingUp, Users, UserCheck, Target, Activity, Lock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import KpiCard, { fmt, calcPct, themeChartColors } from './KpiCard';
import ExecutiveSummary from './ExecutiveSummary';

type Theme = { bg: string; bgDark: string; accent: string; gradient: string };
type Props  = { data: any; theme: Theme; enabledFeatures?: string[]; hasDateFilter?: boolean };

type TrendPeriod = 'week' | 'month';
type TrendMetric = 'revenue' | 'new' | 'returning' | 'transactions';

const METRIC_LABEL: Record<TrendMetric, string> = {
  revenue: 'Revenue',
  new: 'New Customers',
  returning: 'Returning',
  transactions: 'Transactions',
};

function Pill<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px]">
      {options.map(opt => (
        <button
          key={opt.v}
          type="button"
          onClick={() => onChange(opt.v)}
          className={`px-2 py-0.5 rounded-md transition ${
            value === opt.v
              ? 'bg-white shadow-sm text-slate-700 font-medium'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function ExecutiveOverview({ data, theme, enabledFeatures = [], hasDateFilter = false }: Props) {
  const { kpis, revenueTrend, revenueTrendMonthly, topTreatments, topDoctors } = data;
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('week');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('revenue');

  const trendData = trendPeriod === 'week' ? revenueTrend : revenueTrendMonthly;
  const isMoneyMetric = trendMetric === 'revenue';
  const metricLabel = METRIC_LABEL[trendMetric];

  const accentGradient = `linear-gradient(135deg, ${theme.accent} 0%, #f59e0b 100%)`;
  const COLORS = themeChartColors(theme);

  return (
    <div className="space-y-5">

      {/* ── KPI 5 Cards (โครงสร้างเดิม) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          variant="colored" gradient={theme.gradient}
          icon={<DollarSign size={20} className="text-white" />}
          label={hasDateFilter ? 'Period Revenue' : 'Revenue Today'}
          value={fmt(kpis.revenueToday)}
          change={hasDateFilter ? undefined : calcPct(kpis.revenueToday, kpis.yesterdayRevenue)}
          animClass="fade-in fade-in-d1"
        />
        <KpiCard
          variant="colored" gradient={accentGradient}
          icon={<TrendingUp size={20} className="text-white" />}
          label="Monthly Revenue"
          value={fmt(kpis.monthlyRevenue)}
          change={calcPct(kpis.monthlyRevenue, kpis.prevMonthRevenue)}
          animClass="fade-in fade-in-d2"
        />
        <KpiCard
          icon={<Users size={20} />}
          label="New Customers"
          value={String(kpis.newCustomers)}
          change={calcPct(kpis.newCustomers, kpis.prevNewCustomers)}
          sub={kpis.newCustomersWeek !== undefined ? `${kpis.newCustomersWeek} this week` : undefined}
          iconBg="#E6F4F4" iconColor={theme.bg}
          animClass="fade-in fade-in-d3"
        />
        <KpiCard
          icon={<UserCheck size={20} />}
          label="Returning"
          value={String(kpis.returning)}
          change={calcPct(kpis.returning, kpis.prevReturning)}
          sub={kpis.returningWeek !== undefined ? `${kpis.returningWeek} this week` : undefined}
          positiveUp={false}
          iconBg="#FEF3EE" iconColor={theme.accent}
          animClass="fade-in fade-in-d4"
        />
        <KpiCard
          icon={<Target size={20} />}
          label="Conversion"
          value={`${kpis.conversionRate.toFixed(1)}%`}
          iconBg="#FDF6EC" iconColor="#D97706"
          animClass="fade-in fade-in-d4"
        />
      </div>

      {/* ── Charts Row (โครงสร้างเดิม) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
            <h3 className="text-sm font-heading font-semibold text-slate-700">{metricLabel} Trend</h3>
            <div className="flex flex-col gap-1.5 items-end">
              <Pill<TrendMetric>
                value={trendMetric}
                onChange={setTrendMetric}
                options={[
                  { v: 'revenue', label: 'Revenue' },
                  { v: 'new', label: 'New' },
                  { v: 'returning', label: 'Ret.' },
                  { v: 'transactions', label: 'Trx' },
                ]}
              />
              <Pill<TrendPeriod>
                value={trendPeriod}
                onChange={setTrendPeriod}
                options={[
                  { v: 'week', label: 'Week' },
                  { v: 'month', label: 'Month' },
                ]}
              />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis
                tickFormatter={v => isMoneyMetric ? `฿${v >= 1000 ? Math.round(v / 1000) + 'k' : v}` : String(v)}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v) => [isMoneyMetric ? fmt(Number(v ?? 0)) : String(v ?? 0), metricLabel]}
              />
              <Line type="monotone" dataKey={trendMetric} stroke={theme.bg} strokeWidth={2.5}
                dot={{ r: 4, fill: theme.bg, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: theme.bg }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-heading font-semibold mb-4 text-slate-700">Top Treatments by Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topTreatments.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={v => `฿${Math.round(v / 1000)}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v) => [fmt(Number(v ?? 0)), 'Revenue']}
              />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {topTreatments.slice(0, 8).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top Doctors + AI Summary (โครงสร้างเดิม) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-1.5 text-slate-700">
            <Activity size={14} style={{ color: theme.bg }} /> Top Doctors by Revenue (Monthly)
          </h3>
          <div className="space-y-4">
            {topDoctors.map((doc: any, i: number) => {
              const color  = COLORS[i % COLORS.length];
              const maxRev = topDoctors[0]?.revenue || 1;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: color }}>
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
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round((doc.revenue / maxRev) * 100)}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {!enabledFeatures.includes('ai_summary') ? (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3 min-h-[200px]">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Lock size={22} className="text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700 flex items-center justify-center gap-1.5">
                Executive AI Summary <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-violet-100 text-violet-600">AI</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">ฟีเจอร์นี้สำหรับ <span className="font-semibold text-violet-600">Professional</span> ขึ้นไป</p>
            </div>
            <a href="mailto:support@smartclinic.app"
              className="text-xs px-4 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition">
              อัพเกรดแพ็กเกจ
            </a>
          </div>
        ) : (
          <ExecutiveSummary />
        )}
      </div>
    </div>
  );
}
