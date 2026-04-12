'use client';

import { useState } from 'react';
import { Sheet, RefreshCw, CheckCircle2, XCircle, Users, ClipboardList, CalendarDays, Zap, Database } from 'lucide-react';

type SyncMode = 'today' | 'full';

type SyncStats = {
  patients:     { total: number; updated: number };
  visits:       { total: number; added: number; updated: number };
  appointments: { total: number; added: number; updated: number };
};

export default function SheetsSyncManager() {
  const [loading, setLoading]   = useState<SyncMode | null>(null);
  const [stats, setStats]       = useState<SyncStats | null>(null);
  const [lastMode, setLastMode] = useState<SyncMode | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  async function handleSync(mode: SyncMode) {
    setLoading(mode);
    setStats(null);
    setError(null);
    try {
      const res  = await fetch('/api/sheets-sync/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Sync failed');
      setStats(data.stats);
      setLastMode(mode);
      setSyncedAt(new Date().toLocaleTimeString('th-TH'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <div className="max-w-lg space-y-4">

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Sheet size={22} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Google Sheets → Supabase</h3>
            <p className="text-xs text-slate-400">ดึงประวัติคนไข้ · Visit · นัดหมาย เข้าระบบ</p>
          </div>
        </div>

        {/* 2 Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Today */}
          <button
            onClick={() => handleSync('today')}
            disabled={isLoading}
            className="flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold text-sm transition-all hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'today'
              ? <RefreshCw size={18} className="animate-spin" />
              : <Zap size={18} />
            }
            <span>{loading === 'today' ? 'กำลังดึง...' : 'Sync วันนี้'}</span>
            <span className="text-[11px] font-normal text-emerald-600 text-center leading-tight">
              timestamp = วันนี้{'\n'}เร็ว &lt;3 วิ
            </span>
          </button>

          {/* Full */}
          <button
            onClick={() => handleSync('full')}
            disabled={isLoading}
            className="flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl border-2 border-slate-300 bg-slate-50 text-slate-700 font-semibold text-sm transition-all hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'full'
              ? <RefreshCw size={18} className="animate-spin" />
              : <Database size={18} />
            }
            <span>{loading === 'full' ? 'กำลังดึง...' : 'Sync ทั้งหมด'}</span>
            <span className="text-[11px] font-normal text-slate-500 text-center leading-tight">
              ทุก record{'\n'}~15–30 วิ
            </span>
          </button>
        </div>

        {syncedAt && !isLoading && (
          <p className="text-center text-xs text-slate-400 mt-3">
            อัปเดตล่าสุด {syncedAt}
            {lastMode && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                lastMode === 'today'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {lastMode === 'today' ? 'วันนี้' : 'ทั้งหมด'}
              </span>
            )}
          </p>
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
