'use client';

import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fmt } from './KpiCard';

type Props = { data: any };
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#f97316', '#8b5cf6', '#ec4899'];

export default function CustomerInsights({ data }: Props) {
  const { newRegistrationsByMonth, customerTypeDistribution, acquisitionSource, visitFrequency, topPatients } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">New Patient Registrations by Month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={newRegistrationsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="New Patients" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Customer Type Distribution</h3>
          {customerTypeDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={customerTypeDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {customerTypeDistribution.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                {customerTypeDistribution.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{item.name}
                  </div>
                ))}
              </div>
            </>
          ) : <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Patient Acquisition Source</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={acquisitionSource}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="source" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Patients" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Visit Frequency Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={visitFrequency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[3, 3, 0, 0]} name="Patients" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200"><h3 className="text-sm font-semibold">Top 10 Patients by Revenue</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase w-12">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Patient HN</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Visits</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Revenue</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase">Avg/Visit</th>
            </tr></thead>
            <tbody>
              {topPatients.map((p: any, i: number) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.hn}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{p.visits}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(p.revenue)}</td>
                  <td className="px-5 py-3 text-right text-gray-400">{fmt(p.avgPerVisit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
