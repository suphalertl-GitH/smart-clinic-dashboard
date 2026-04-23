'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Send, Users, MessageSquare, CheckSquare, Square } from 'lucide-react';

type LapsedPatient = {
  id: string;
  hn: string;
  full_name: string;
  phone: string;
  line_user_id: string | null;
  last_visit: string | null;
  days_since: number | null;
};

type ApiData = { days: number; count: number; patients: LapsedPatient[] };

const THRESHOLDS = [
  { label: '60 วัน', value: 60 },
  { label: '90 วัน', value: 90 },
  { label: '180 วัน', value: 180 },
  { label: '1 ปี', value: 365 },
];

const DEFAULT_TEMPLATE =
  'นานแล้วที่ไม่ได้พบกัน 😊 ทางคลินิกอยากเชิญคุณกลับมาดูแลตัวเองนะคะ ' +
  'ตอนนี้มีโปรโมชั่นพิเศษสำหรับลูกค้าเก่า สอบถามเพิ่มเติมได้ที่ {phone} ค่ะ';

export default function ReEngagement() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<ApiData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; skipped: number; errors: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function reload() { setRefreshKey(k => k + 1); setSelected(new Set()); setResult(null); }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/re-engagement?days=${days}`)
      .then(r => r.json())
      .then((json: ApiData) => { if (!cancelled) setData(json); });
    return () => { cancelled = true; setData(null); };
  }, [days, refreshKey]);

  const patients = data?.patients ?? [];
  const withLine = patients.filter(p => p.line_user_id);

  function toggleAll() {
    if (selected.size === withLine.length) {
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
    const res = await fetch('/api/re-engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_ids: [...selected], message_template: template }),
    });
    const json = await res.json();
    setSending(false);
    setResult(json);
    setSelected(new Set());
  }

  const loading = data === null;
  const allSelected = withLine.length > 0 && selected.size === withLine.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Re-engagement Campaign</h2>
          <p className="text-sm text-slate-500 mt-0.5">ส่ง LINE หาลูกค้าที่ไม่มาตามระยะเวลาที่กำหนด</p>
        </div>
        <button onClick={reload} disabled={loading} className="p-2 rounded-xl bg-white border border-slate-200">
          <RefreshCw size={15} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left — Config */}
        <div className="space-y-4">
          {/* Threshold */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">ระยะเวลาที่ไม่มาคลินิก</p>
            <div className="grid grid-cols-2 gap-2">
              {THRESHOLDS.map(t => (
                <button key={t.value} onClick={() => setDays(t.value)}
                  className={`py-2 rounded-xl text-sm font-medium border transition-colors ${
                    days === t.value
                      ? 'text-white border-transparent'
                      : 'text-slate-600 border-slate-200 hover:border-teal-300'
                  }`}
                  style={days === t.value ? { backgroundColor: '#0f4c5c' } : {}}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">สรุป</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-1.5"><Users size={14} />พบลูกค้า</span>
              <span className="font-bold text-slate-800">{data?.count ?? '—'} คน</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-1.5"><MessageSquare size={14} />มี LINE</span>
              <span className="font-bold text-teal-700">{withLine.length} คน</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">เลือกแล้ว</span>
              <span className="font-bold text-slate-800">{selected.size} คน</span>
            </div>
          </div>

          {/* Message Template */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">ข้อความ</p>
            <p className="text-xs text-slate-400 mb-2">
              ใช้ <code className="bg-slate-100 px-1 rounded">{'{name}'}</code>{' '}
              <code className="bg-slate-100 px-1 rounded">{'{phone}'}</code>{' '}
              <code className="bg-slate-100 px-1 rounded">{'{clinic}'}</code>
            </p>
            <textarea
              value={template}
              onChange={e => setTemplate(e.target.value)}
              rows={5}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 resize-none"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: '#0f4c5c' }}>
            <Send size={15} />
            {sending ? 'กำลังส่ง...' : `ส่ง LINE (${selected.size} คน)`}
          </button>

          {/* Result */}
          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
              ✅ ส่งสำเร็จ {result.sent} คน
              {result.skipped > 0 && ` · ข้าม ${result.skipped} คน (ไม่มี LINE)`}
              {result.errors > 0 && ` · ผิดพลาด ${result.errors} คน`}
            </div>
          )}
        </div>

        {/* Right — Patient List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">
              รายชื่อลูกค้าที่ไม่มาเกิน {days} วัน
            </span>
            {withLine.length > 0 && (
              <button onClick={toggleAll}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                {allSelected ? <CheckSquare size={14} className="text-teal-600" /> : <Square size={14} />}
                {allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
              <RefreshCw size={16} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Users size={28} className="opacity-30 mb-2" />
              <p className="text-sm">ไม่พบลูกค้าในช่วงนี้</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
              {patients.map(p => {
                const hasLine = !!p.line_user_id;
                const isSelected = selected.has(p.id);
                return (
                  <div key={p.id}
                    onClick={() => hasLine && toggle(p.id)}
                    className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                      hasLine ? 'cursor-pointer hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'
                    } ${isSelected ? 'bg-teal-50' : ''}`}>
                    <div className="shrink-0">
                      {hasLine
                        ? isSelected
                          ? <CheckSquare size={18} className="text-teal-600" />
                          : <Square size={18} className="text-slate-300" />
                        : <Square size={18} className="text-slate-200" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                      <p className="text-xs text-slate-400">{p.hn} · {p.phone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-700">
                        {p.days_since !== null ? `${p.days_since} วัน` : 'ไม่เคยมา'}
                      </p>
                      {p.last_visit && (
                        <p className="text-xs text-slate-400">{p.last_visit.slice(0, 10)}</p>
                      )}
                    </div>
                    <div className="shrink-0">
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
