'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Send, Gift, Star, CheckSquare, Square } from 'lucide-react';

type BdPatient = {
  id: string;
  hn: string;
  full_name: string;
  phone: string;
  line_user_id: string | null;
  birthdate: string | null;
  created_at: string;
  days_until: number;
  years?: number;
};

type ApiData = {
  range: number;
  birthdays: BdPatient[];
  anniversaries: BdPatient[];
};

type TabKey = 'birthday' | 'anniversary';
const RANGES = [{ label: '7 วัน', value: 7 }, { label: '30 วัน', value: 30 }, { label: '90 วัน', value: 90 }];

function DaysChip({ days }: { days: number }) {
  const color = days === 0 ? 'text-red-600 bg-red-50' : days <= 3 ? 'text-amber-600 bg-amber-50' : 'text-teal-600 bg-teal-50';
  const label = days === 0 ? 'วันนี้!' : `อีก ${days} วัน`;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

export default function BirthdayReminder() {
  const [tab, setTab] = useState<TabKey>('birthday');
  const [range, setRange] = useState(30);
  const [data, setData] = useState<ApiData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; skipped: number; errors: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function reload() { setRefreshKey(k => k + 1); setSelected(new Set()); setResult(null); }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/birthday?range=${range}`)
      .then(r => r.json())
      .then((json: ApiData) => { if (!cancelled) setData(json); });
    return () => { cancelled = true; setData(null); };
  }, [range, refreshKey]);

  const list = tab === 'birthday' ? (data?.birthdays ?? []) : (data?.anniversaries ?? []);
  const withLine = list.filter(p => p.line_user_id);
  const allSelected = withLine.length > 0 && selected.size === withLine.length;
  const loading = data === null;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withLine.map(p => p.id)));
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function handleSend() {
    if (selected.size === 0) return;
    setSending(true);
    setResult(null);
    const res = await fetch('/api/birthday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_ids: [...selected], type: tab }),
    });
    const json = await res.json();
    setSending(false);
    setResult(json);
    setSelected(new Set());
  }

  const TABS: { key: TabKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'birthday',    label: 'วันเกิด',    icon: <Gift size={14} />,  count: data?.birthdays.length ?? 0 },
    { key: 'anniversary', label: 'ครบรอบ',     icon: <Star size={14} />,  count: data?.anniversaries.length ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Birthday & Anniversary</h2>
          <p className="text-sm text-slate-500 mt-0.5">ส่ง LINE อวยพรลูกค้าวันเกิดและครบรอบอัตโนมัติ</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {RANGES.map(r => (
              <button key={r.value} onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${range === r.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={reload} disabled={loading} className="p-2 rounded-xl bg-white border border-slate-200">
            <RefreshCw size={15} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(new Set()); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              tab === t.key ? 'text-white border-transparent' : 'text-slate-600 border-slate-200 bg-white hover:border-teal-300'
            }`}
            style={tab === t.key ? { backgroundColor: t.key === 'birthday' ? '#e11d48' : '#7c3aed' } : {}}>
            {t.icon}
            {t.label}
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">สรุป</p>
            <div className="text-sm text-slate-600 space-y-1.5">
              <div className="flex justify-between">
                <span>{tab === 'birthday' ? 'วันเกิดในช่วงนี้' : 'ครบรอบในช่วงนี้'}</span>
                <span className="font-bold text-slate-800">{list.length} คน</span>
              </div>
              <div className="flex justify-between">
                <span>มี LINE</span>
                <span className="font-bold text-teal-700">{withLine.length} คน</span>
              </div>
              <div className="flex justify-between">
                <span>เลือกแล้ว</span>
                <span className="font-bold text-slate-800">{selected.size} คน</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <p className="font-semibold mb-1">⏰ Auto-send</p>
            <p>ระบบส่งอัตโนมัติทุกวัน 08:00 น. ผ่าน Vercel Cron สำหรับวันเกิดและครบรอบที่ตรงกับวันนั้น</p>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: tab === 'birthday' ? '#e11d48' : '#7c3aed' }}>
            <Send size={15} />
            {sending ? 'กำลังส่ง...' : `ส่ง LINE (${selected.size} คน)`}
          </button>

          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
              ✅ ส่งสำเร็จ {result.sent} คน
              {result.skipped > 0 && ` · ข้าม ${result.skipped} (ไม่มี LINE)`}
              {result.errors > 0 && ` · ผิดพลาด ${result.errors}`}
            </div>
          )}
        </div>

        {/* Right — List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">
              {tab === 'birthday' ? `วันเกิดใน ${range} วันข้างหน้า` : `ครบรอบใน ${range} วันข้างหน้า`}
            </span>
            {withLine.length > 0 && (
              <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                {allSelected ? <CheckSquare size={14} className="text-teal-600" /> : <Square size={14} />}
                {allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
              <RefreshCw size={16} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              {tab === 'birthday' ? <Gift size={28} className="opacity-30 mb-2" /> : <Star size={28} className="opacity-30 mb-2" />}
              <p className="text-sm">ไม่มีในช่วงนี้</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
              {list.map(p => {
                const hasLine = !!p.line_user_id;
                const isSelected = selected.has(p.id);
                return (
                  <div key={p.id}
                    onClick={() => hasLine && toggle(p.id)}
                    className={`flex items-center gap-3 px-5 py-3 transition-colors ${hasLine ? 'cursor-pointer hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'} ${isSelected ? 'bg-rose-50' : ''}`}>
                    <div className="shrink-0">
                      {hasLine
                        ? isSelected ? <CheckSquare size={18} className="text-rose-500" /> : <Square size={18} className="text-slate-300" />
                        : <Square size={18} className="text-slate-200" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                      <p className="text-xs text-slate-400">
                        {p.hn} · {tab === 'birthday' ? `เกิด ${p.birthdate}` : `มาครั้งแรก ${p.created_at.slice(0, 10)} (${p.years} ปี)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <DaysChip days={p.days_until} />
                      {hasLine
                        ? <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">LINE</span>
                        : <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">ไม่มี</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
