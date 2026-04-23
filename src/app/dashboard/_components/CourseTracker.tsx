'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Plus, CheckCircle2, Clock, X } from 'lucide-react';

type Course = {
  id: string;
  hn: string;
  patient_name: string;
  treatment_name: string;
  total_sessions: number;
  completed_sessions: number;
  price: number;
  status: 'active' | 'completed' | 'expired';
  notes: string | null;
  started_at: string;
  expires_at: string | null;
};

type StatusTab = 'active' | 'completed' | 'all';

function fmt(n: number) { return n.toLocaleString('th-TH'); }

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const color = pct >= 100 ? '#059669' : pct >= 50 ? '#0f4c5c' : '#f59e0b';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{done}/{total} ครั้ง</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Add Course Form ───────────────────────────────────────────
type AddFormProps = { onClose: () => void; onSaved: () => void };

function AddCourseForm({ onClose, onSaved }: AddFormProps) {
  const [form, setForm] = useState({
    hn: '', patient_name: '', treatment_name: '',
    total_sessions: '5', price: '', notes: '',
    started_at: new Date().toISOString().slice(0, 10), expires_at: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hn || !form.patient_name || !form.treatment_name) { setErr('กรุณากรอกข้อมูลให้ครบ'); return; }
    setSaving(true);
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, total_sessions: Number(form.total_sessions), price: Number(form.price) || 0 }),
    });
    setSaving(false);
    if (!res.ok) { setErr('บันทึกไม่สำเร็จ'); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">เพิ่มคอร์สใหม่</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">HN *</label>
              <input value={form.hn} onChange={e => set('hn', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" placeholder="HN00001" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">ชื่อคนไข้ *</label>
              <input value={form.patient_name} onChange={e => set('patient_name', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">ชื่อการรักษา *</label>
            <input value={form.treatment_name} onChange={e => set('treatment_name', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" placeholder="เช่น Botox, Filler, Sculptra" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">จำนวนครั้ง *</label>
              <input type="number" min="1" value={form.total_sessions} onChange={e => set('total_sessions', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">ราคา (฿)</label>
              <input type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">วันเริ่ม</label>
              <input type="date" value={form.started_at} onChange={e => set('started_at', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">วันหมดอายุ</label>
              <input type="date" value={form.expires_at} onChange={e => set('expires_at', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">หมายเหตุ</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">ยกเลิก</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#0f4c5c' }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกคอร์ส'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CourseTracker() {
  const [tab, setTab] = useState<StatusTab>('active');
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loading = courses === null;
  function load() { setRefreshKey(k => k + 1); }

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status: tab });
    if (search) params.set('search', search);
    fetch(`/api/courses?${params}`)
      .then(r => r.json())
      .then(json => {
        if (!cancelled) setCourses(Array.isArray(json) ? json : []);
      });
    return () => { cancelled = true; setCourses(null); };
  }, [tab, search, refreshKey]);

  async function recordSession(id: string) {
    setRecording(id);
    await fetch(`/api/courses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setRecording(null);
    load();
  }

  const TABS: { key: StatusTab; label: string }[] = [
    { key: 'active', label: 'กำลังใช้งาน' },
    { key: 'completed', label: 'ครบแล้ว' },
    { key: 'all', label: 'ทั้งหมด' },
  ];

  return (
    <div className="space-y-6">
      {showAdd && <AddCourseForm onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Course Tracker</h2>
          <p className="text-sm text-slate-500 mt-0.5">ติดตามคอร์สการรักษาและจำนวนครั้งที่เหลือ</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ backgroundColor: '#0f4c5c' }}>
          <Plus size={15} /> เพิ่มคอร์ส
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา HN / ชื่อ / การรักษา..."
          className="flex-1 min-w-48 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 bg-white" />
        <button onClick={load} disabled={loading} className="p-2 rounded-xl bg-white border border-slate-200">
          <RefreshCw size={15} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-400 gap-2">
          <RefreshCw size={16} className="animate-spin" /> กำลังโหลด...
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Clock size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">ไม่พบคอร์สในหมวดนี้</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map(c => {
            const remaining = c.total_sessions - c.completed_sessions;
            const isComplete = c.status === 'completed';
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{c.patient_name}</p>
                    <p className="text-xs text-slate-400">{c.hn}</p>
                  </div>
                  {isComplete ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                      <CheckCircle2 size={11} /> ครบแล้ว
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full shrink-0">
                      เหลือ {remaining} ครั้ง
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700">{c.treatment_name}</p>
                  {c.price > 0 && <p className="text-xs text-slate-400 mt-0.5">฿{fmt(c.price)}</p>}
                </div>

                <ProgressBar done={c.completed_sessions} total={c.total_sessions} />

                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                  <span>เริ่ม {c.started_at}</span>
                  {c.expires_at && <span>หมด {c.expires_at}</span>}
                </div>

                {!isComplete && (
                  <button
                    onClick={() => recordSession(c.id)}
                    disabled={recording === c.id}
                    className="w-full py-2 rounded-xl text-sm font-medium text-white transition-colors mt-1"
                    style={{ backgroundColor: recording === c.id ? '#94a3b8' : '#0f4c5c' }}>
                    {recording === c.id ? 'กำลังบันทึก...' : '✓ บันทึกครั้งที่ใช้'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
