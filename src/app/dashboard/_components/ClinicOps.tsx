'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { Calendar, Clock, UserX, Stethoscope, RefreshCw, TrendingDown, CheckCircle2 } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────
const DAYS_TH: Record<string, string> = {
  Sun: 'อา', Mon: 'จ', Tue: 'อ', Wed: 'พ', Thu: 'พฤ', Fri: 'ศ', Sat: 'ส',
};
const DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
const WORKLOAD_COLORS = ['#0f4c5c', '#1a6b7a', '#2d8c9e', '#4fb3c9', '#7dcfe0', '#aee5f0', '#d4f4fb'];
const PIE_COLORS = ['#0f4c5c', '#e36414'];

function fmt(n: number) { return n.toLocaleString('th-TH'); }

// ── Heatmap Cell ──────────────────────────────────────────────
function HeatCell({ count, max }: { count: number; max: number }) {
  const intensity = max > 0 ? count / max : 0;
  const bg =
    intensity === 0 ? '#f1f5f9'
    : intensity < 0.25 ? '#cceef5'
    : intensity < 0.5  ? '#7dcfe0'
    : intensity < 0.75 ? '#2d8c9e'
    : '#0f4c5c';
  const text = intensity >= 0.5 ? 'white' : '#374151';
  return (
    <div
      className="rounded flex items-center justify-center text-[9px] font-medium transition-colors"
      style={{ backgroundColor: bg, color: text, aspectRatio: '1' }}
      title={`${count} นัด`}
    >
      {count > 0 ? count : ''}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function ClinicOps() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/clinic-ops?${params}`);
      setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
      <RefreshCw size={18} className="animate-spin" /> กำลังโหลด...
    </div>
  );
  if (!data) return null;

  const { heatmap, noShowRate, totalAppointments, noShowCount, doctorWorkload, unassignedCount, statusBreakdown, peakDay, peakHour } = data;

  // heatmap: compute max for color scale
  const heatMax = Math.max(...(heatmap as any[]).map((c: any) => c.count), 1);

  // index heatmap for O(1) lookup
  const heatIndex: Record<string, number> = {};
  (heatmap as any[]).forEach((c: any) => { heatIndex[`${c.day}-${c.hour}`] = c.count; });

  const completedCount = totalAppointments - noShowCount;

  return (
    <div className="space-y-5">

      {/* ── Date filter ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 bg-white focus:outline-none focus:border-teal-400" />
        <span className="text-slate-300 text-xs">–</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 bg-white focus:outline-none focus:border-teal-400" />
        {(startDate || endDate) && (
          <button onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100">✕</button>
        )}
        <button onClick={load} className="ml-auto p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
          <RefreshCw size={14} className="text-slate-500" />
        </button>
      </div>

      {/* ── KPI row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'นัดทั้งหมด',   value: fmt(totalAppointments), icon: Calendar,    color: 'bg-[#0f4c5c]/10 text-[#0f4c5c]' },
          { label: 'มาตามนัด',    value: fmt(completedCount),     icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
          { label: 'No-show',     value: fmt(noShowCount),         icon: UserX,        color: 'bg-red-100 text-red-500' },
          { label: 'No-show Rate', value: `${noShowRate.toFixed(1)}%`, icon: TrendingDown, color: 'bg-amber-100 text-amber-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-xl font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Peak + Status ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Peak time card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-[#0f4c5c]/10 flex items-center justify-center shrink-0">
            <Clock size={24} className="text-[#0f4c5c]" />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">ช่วงเวลา Peak</p>
            <p className="text-2xl font-bold text-slate-900">
              {DAYS_TH[peakDay] ?? peakDay} — {peakHour}
            </p>
            <p className="text-xs text-slate-400 mt-1">ช่วงที่มีนัดหนาแน่นที่สุด</p>
          </div>
        </div>

        {/* Status pie */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-[#0f4c5c]" /> สถานะนัด
          </h3>
          {totalAppointments > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={statusBreakdown.length ? statusBreakdown : [{ status: 'Completed', count: totalAppointments }]}
                    dataKey="count" cx="50%" cy="50%" innerRadius={30} outerRadius={48}>
                    {(statusBreakdown.length ? statusBreakdown : [{ status: 'Completed', count: totalAppointments }]).map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} นัด`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {(statusBreakdown.length ? statusBreakdown : [{ status: 'Completed', count: totalAppointments }]).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-slate-600">{s.status}</span>
                    <span className="text-xs font-semibold text-slate-800 ml-auto">{fmt(s.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">ไม่มีข้อมูลนัด</p>
          )}
        </div>
      </div>

      {/* ── Appointment Heatmap ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-1.5">
          <Calendar size={14} className="text-[#0f4c5c]" /> Heatmap นัดตามวัน × เวลา
        </h3>

        {/* Legend */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-slate-400">น้อย</span>
          {['#f1f5f9', '#cceef5', '#7dcfe0', '#2d8c9e', '#0f4c5c'].map(c => (
            <div key={c} className="w-5 h-5 rounded" style={{ background: c }} />
          ))}
          <span className="text-xs text-slate-400">มาก</span>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: 520 }}>
            {/* Hour labels */}
            <div className="flex mb-1 ml-8">
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-[9px] text-slate-400 font-medium">{h.slice(0, 2)}</div>
              ))}
            </div>
            {/* Day rows */}
            {DAYS_ORDER.map(day => (
              <div key={day} className="flex items-center gap-1 mb-1">
                <div className="w-7 text-right text-xs font-medium text-slate-500 shrink-0 pr-1">
                  {DAYS_TH[day]}
                </div>
                {HOURS.map(hour => (
                  <div key={hour} className="flex-1">
                    <HeatCell count={heatIndex[`${day}-${hour}`] ?? 0} max={heatMax} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Doctor Workload ───────────────────────────────── */}
      {doctorWorkload?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Stethoscope size={14} className="text-[#0f4c5c]" /> Workload แพทย์
            </h3>
            {unassignedCount > 0 && (
              <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                ⚠ ไม่ระบุแพทย์ {fmt(unassignedCount)} นัด
              </span>
            )}
          </div>

          <div className="space-y-3">
            {(doctorWorkload as any[]).map((d: any, i: number) => {
              const maxVisits = Math.max(...(doctorWorkload as any[]).map((x: any) => x.visits), 1);
              const pct = Math.round((d.visits / maxVisits) * 100);
              const isUnassigned = d.name === 'ไม่ระบุแพทย์';
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: isUnassigned ? '#94a3b8' : WORKLOAD_COLORS[i % WORKLOAD_COLORS.length] }}>
                        {d.name.charAt(0)}
                      </div>
                      <span className={`text-sm ${isUnassigned ? 'text-slate-400 italic' : 'text-slate-700'}`}>{d.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{fmt(d.visits)} นัด</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: isUnassigned ? '#94a3b8' : WORKLOAD_COLORS[i % WORKLOAD_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bar chart — exclude unassigned */}
          {(doctorWorkload as any[]).filter((d: any) => d.name !== 'ไม่ระบุแพทย์').length > 0 && (
            <div className="mt-5">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={(doctorWorkload as any[]).filter((d: any) => d.name !== 'ไม่ระบุแพทย์')} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(val: any) => [`${fmt(val)} นัด`, 'จำนวนนัด']} />
                  <Bar dataKey="visits" name="visits" radius={[4, 4, 0, 0]}>
                    {(doctorWorkload as any[]).filter((d: any) => d.name !== 'ไม่ระบุแพทย์').map((_: any, i: number) => (
                      <Cell key={i} fill={WORKLOAD_COLORS[i % WORKLOAD_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
