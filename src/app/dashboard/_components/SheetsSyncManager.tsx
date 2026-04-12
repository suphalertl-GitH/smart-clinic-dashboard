'use client';

import { useState } from 'react';
import { Sheet, RefreshCw, CheckCircle2, XCircle, Users, ClipboardList, CalendarDays } from 'lucide-react';

type SyncStats = {
  patients:     { total: number; updated: number };
  visits:       { total: number; added: number; updated: number };
  appointments: { total: number; added: number; updated: number };
};

export default function SheetsSyncManager() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats]     = useState<SyncStats | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setStats(null);
    setError(null);
    try {
      const res  = await fetch('/api/sheets-sync/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Sync failed');
      setStats(data.stats);
      setSyncedAt(new Date().toLocaleTimeString('th-TH'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Sheet size={22} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Google Sheets → Supabase</h3>
            <p className="text-xs text-slate-400">ดึงประวัติคนไข้ · Visit · นัดหมาย เข้าระบบ</p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
          style={{ backgroundColor: '#059669' }}
        >
          {loading
            ? <><RefreshCw size={16} className="animate-spin" /> กำลังดึงข้อมูล...</>
            : <><RefreshCw size={16} /> ดึงข้อมูลจาก Google Sheets</>
          }
        </button>

        {syncedAt && !loading && (
          <p className="text-center text-xs text-slate-400 mt-2">อัปเดตล่าสุด {syncedAt}</p>
        )}
      </div>

      {/* Result */}
      {stats && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-1">
            <CheckCircle2 size={16} /> ดึงข้อมูลสำเร็จ
          </div>

          <StatRow icon={<Users size={15} className="text-blue-500" />}
            label="Patients"
            detail={`${stats.patients.total} รายการ · updated ${stats.patients.updated}`} />

          <StatRow icon={<ClipboardList size={15} className="text-purple-500" />}
            label="Visits"
            detail={`${stats.visits.total} รายการ · added ${stats.visits.added} · updated ${stats.visits.updated}`} />

          <StatRow icon={<CalendarDays size={15} className="text-amber-500" />}
            label="Appointments"
            detail={`${stats.appointments.total} รายการ · added ${stats.appointments.added} · updated ${stats.appointments.updated}`} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-2 text-sm text-red-700">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

    </div>
  );
}

function StatRow({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-t border-slate-100">
      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
      <span className="text-sm font-medium text-slate-700 w-28">{label}</span>
      <span className="text-xs text-slate-500">{detail}</span>
    </div>
  );
}
