'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet, RefreshCw, CheckCircle2, XCircle, Users, ClipboardList,
  CalendarDays, Zap, Calendar, Trash2, Clock, ToggleLeft, ToggleRight, Save,
} from 'lucide-react';

type SyncMode = 'today' | 'range';

type SyncStats = {
  patients:     { total: number; updated: number };
  visits:       { total: number; added: number; updated: number; deleted: number };
  appointments: { total: number; added: number; updated: number };
};

const PRIMARY = '#0f4c5c';

export default function SheetsSyncManager() {
  const [loading, setLoading]     = useState<SyncMode | null>(null);
  const [stats, setStats]         = useState<SyncStats | null>(null);
  const [lastMode, setLastMode]   = useState<SyncMode | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [syncedAt, setSyncedAt]   = useState<string | null>(null);
  const [showRange, setShowRange] = useState(false);
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');

  // Auto-sync
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [syncTime, setSyncTime]       = useState('09:00');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved]   = useState(false);

  const loadSchedule = useCallback(async () => {
    const res = await fetch('/api/settings').catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setAutoEnabled(data.sync_auto_enabled ?? false);
    const times: string[] = data.sync_times ?? [];
    if (times.length > 0) setSyncTime(times[0]);
  }, []);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  async function saveSchedule(enabled: boolean, time: string) {
    setSavingSchedule(true);
    setScheduleSaved(false);
    try {
      await fetch('/api/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sync_auto_enabled: enabled, sync_times: [time] }),
      });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2500);
    } finally {
      setSavingSchedule(false);
    }
  }

  function handleSaveSchedule() {
    saveSchedule(autoEnabled, syncTime);
  }

  function toggleAuto() {
    const next = !autoEnabled;
    setAutoEnabled(next);
    saveSchedule(next, syncTime);
  }

  async function handleSync(mode: SyncMode) {
    if (mode === 'range' && (!fromDate || !toDate)) return;
    setLoading(mode);
    setStats(null);
    setError(null);
    try {
      const body: any = { mode };
      if (mode === 'range') { body.fromDate = fromDate; body.toDate = toDate; }
      const res  = await fetch('/api/sheets-sync/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

      {/* Manual sync */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Sheet size={22} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Google Sheets ↔ Supabase</h3>
            <p className="text-xs text-slate-400">ตรวจสอบและปรับยอดให้ตรงกันทั้งสองฝั่ง</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSync('today')}
            disabled={isLoading}
            className="flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold text-sm transition-all hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'today' ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
            <span>{loading === 'today' ? 'กำลัง sync...' : 'Sync วันนี้'}</span>
            <span className="text-[11px] font-normal text-emerald-600 text-center leading-tight">ตรวจ-ลบ-เพิ่ม ให้ตรงชีต</span>
          </button>

          <button
            onClick={() => setShowRange(v => !v)}
            disabled={isLoading}
            className={`flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl border-2 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              showRange ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calendar size={18} />
            <span>เลือกช่วงเวลา</span>
            <span className="text-[11px] font-normal text-center leading-tight" style={{ color: showRange ? '#3b82f6' : '#94a3b8' }}>
              sync ช่วงวันที่เลือก
            </span>
          </button>
        </div>

        {showRange && (
          <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-3">
            <p className="text-xs font-semibold text-blue-700">เลือกช่วงวันที่ที่ต้องการ reconcile</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">จากวันที่</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">ถึงวันที่</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <button
              onClick={() => handleSync('range')}
              disabled={isLoading || !fromDate || !toDate}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading === 'range'
                ? <><RefreshCw size={15} className="animate-spin" /> กำลัง sync...</>
                : <><Zap size={15} /> Sync ช่วงนี้</>}
            </button>
          </div>
        )}

        {syncedAt && !isLoading && (
          <p className="text-center text-xs text-slate-400 mt-3">
            อัปเดตล่าสุด {syncedAt}
            {lastMode && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                lastMode === 'today' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {lastMode === 'today' ? 'วันนี้' : `${fromDate} – ${toDate}`}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Auto-sync */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#E6F4F4' }}>
            <Clock size={20} style={{ color: PRIMARY }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">Sync อัตโนมัติ</h3>
            <p className="text-xs text-slate-400">ดึงข้อมูลจากชีตวันละ 1 ครั้งตามเวลาที่กำหนด</p>
          </div>
          <button onClick={toggleAuto} disabled={savingSchedule} className="transition-opacity disabled:opacity-50">
            {autoEnabled
              ? <ToggleRight size={36} style={{ color: PRIMARY }} />
              : <ToggleLeft size={36} className="text-slate-300" />}
          </button>
        </div>

        {/* Status */}
        <div className={`mb-4 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 ${
          autoEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${autoEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          {autoEnabled ? `เปิดอยู่ — sync ทุกวัน เวลา ${syncTime} น.` : 'ปิดอยู่'}
          {scheduleSaved && (
            <span className="ml-auto text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={12} /> บันทึกแล้ว
            </span>
          )}
        </div>

        {/* Time picker */}
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label className="text-[11px] text-slate-500 mb-1 block">เวลา sync</label>
            <input
              type="time"
              value={syncTime}
              onChange={e => setSyncTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
            />
          </div>
          <button
            onClick={handleSaveSchedule}
            disabled={savingSchedule}
            className="mt-5 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: PRIMARY }}
          >
            {savingSchedule ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            บันทึก
          </button>
        </div>
      </div>

      {/* Result */}
      {stats && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm mb-1">
            <CheckCircle2 size={16} /> Sync สำเร็จ
          </div>
          <StatRow icon={<Users size={15} className="text-blue-500" />}
            label="Patients"
            detail={`${stats.patients.total} รายการ · updated ${stats.patients.updated}`} />
          <StatRow icon={<ClipboardList size={15} className="text-purple-500" />}
            label="Visits"
            detail={`${stats.visits.total} รายการ · added ${stats.visits.added} · updated ${stats.visits.updated}`}
            extra={stats.visits.deleted > 0
              ? <span className="flex items-center gap-1 text-red-500"><Trash2 size={11} /> ลบ {stats.visits.deleted} แถว</span>
              : undefined} />
          <StatRow icon={<CalendarDays size={15} className="text-amber-500" />}
            label="Appointments"
            detail={`${stats.appointments.total} รายการ · added ${stats.appointments.added} · updated ${stats.appointments.updated}`} />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-2 text-sm text-red-700">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function StatRow({ icon, label, detail, extra }: { icon: React.ReactNode; label: string; detail: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2 border-t border-slate-100">
      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
      <span className="text-sm font-medium text-slate-700 w-28">{label}</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-slate-500">{detail}</span>
        {extra && <span className="text-xs">{extra}</span>}
      </div>
    </div>
  );
}
