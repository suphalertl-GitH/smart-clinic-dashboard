'use client';

import { DollarSign, TrendingUp, Users, UserCheck, Target, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KpiCard, { fmt, calcPct } from './KpiCard';
import ExecutiveSummary from './ExecutiveSummary';

type Props = { data: any };
const DOCTOR_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#f97316', '#8b5cf6'];

export default function ExecutiveOverview({ data }: Props) {
  const { kpis, revenueTrend, topTreatments, topDoctors } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard icon={<DollarSign size={20} />} label="Revenue Today" value={fmt(kpis.revenueToday)} change={calcPct(kpis.revenueToday, kpis.prevMonthRevenue / 30)} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <KpiCard icon={<TrendingUp size={20} />} label="Monthly Revenue" value={fmt(kpis.monthlyRevenue)} change={calcPct(kpis.monthlyRevenue, kpis.prevMonthRevenue)} iconBg="bg-green-50" iconColor="text-green-600" />
        <KpiCard icon={<Users size={20} />} label="New Customers" value={String(kpis.newCustomers)} change={calcPct(kpis.newCustomers, kpis.prevNewCustomers)} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <KpiCard icon={<UserCheck size={20} />} label="Returning" value={String(kpis.returning)} change={calcPct(kpis.returning, kpis.prevReturning)} positiveUp={false} iconBg="bg-purple-50" iconColor="text-purple-600" />
        <KpiCard icon={<Target size={20} />} label="Conversion" value={`${kpis.conversionRate.toFixed(1)}%`} iconBg="bg-red-50" iconColor="text-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `฿${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), "Revenue"]} />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Top Treatments by Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topTreatments.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={v => `฿${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), "Revenue"]} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5"><Activity size={14} /> Top Doctors by Revenue</h3>
          <div className="space-y-4">
            {topDoctors.map((doc: any, i: number) => {
              const maxRev = topDoctors[0]?.revenue || 1;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                        style={{ backgroundColor: DOCTOR_COLORS[i] + '22', color: DOCTOR_COLORS[i] }}>{i + 1}</span>
                      <span className="text-sm font-medium">{doc.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-blue-600">{fmt(doc.revenue)}</span>
                      <span className="text-xs text-gray-400 ml-2">{doc.visits} visits</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(doc.revenue / maxRev * 100)}%`, backgroundColor: DOCTOR_COLORS[i] }} />
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
