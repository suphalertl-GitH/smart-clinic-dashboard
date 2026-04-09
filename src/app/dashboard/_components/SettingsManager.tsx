'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope, Clock, RefreshCw, Plus, Trash2,
  Save, CheckCircle, AlertTriangle, Users, Repeat,
  GripVertical, ChevronDown, ChevronUp,
} from 'lucide-react';

const PRIMARY = '#0f4c5c';
const ACCENT  = '#e36414';

type TreatmentCycle = { treatment: string; days: number };
type Settings = {
  doctor_names:      string[];
  sales_names:       string[];
  time_slots:        string[];
  treatment_cycles:  TreatmentCycle[];
};

const DEFAULT_SETTINGS: Settings = {
  doctor_names:     [],
  sales_names:      [],
  time_slots:       [],
  treatment_cycles: [],
};

// ── Toast ──────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-xl shadow-lg text-sm font-semibold text-white animate-fadeIn"
      style={{ backgroundColor: ok ? PRIMARY : '#ef4444' }}
    >
      {ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  );
}

// ── Section Card wrapper ───────────────────────────────────────
function Section({
  icon: Icon, title, subtitle, iconBg, iconColor, children, saving, onSave, dirty,
}: {
  icon: React.FC<any>; title: string; subtitle: string;
  iconBg: string; iconColor: string;
  children: React.ReactNode;
  saving?: boolean; onSave?: () => void; dirty?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-slate-800 text-sm">{title}</h3>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        {open
          ? <ChevronUp size={16} className="text-slate-400 shrink-0" />
          : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
      </div>

      {open && (
        <>
          <div className="px-5 pb-4 border-t border-slate-50">
            <div className="pt-4">{children}</div>
          </div>
          {onSave && (
            <div className="px-5 pb-4 flex justify-end">
              <button
                onClick={onSave}
                disabled={saving || !dirty}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: PRIMARY }}
              >
                {saving
                  ? <><RefreshCw size={14} className="animate-spin" /> กำลังบันทึก...</>
                  : <><Save size={14} /> บันทึก{dirty ? ' *' : ''}</>
                }
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Simple string list editor (doctors / sales / time_slots) ───
function StringListEditor({
  items, onChange, placeholder, addLabel,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const [newVal, setNewVal] = useState('');

  function add() {
    const v = newVal.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setNewVal('');
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {/* List */}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-400 py-2">ยังไม่มีรายการ</p>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 group">
            <GripVertical size={14} className="text-slate-300 shrink-0" />
            <span className="flex-1 text-sm font-medium text-slate-700">{item}</span>
            <button
              onClick={() => remove(i)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newVal}
          onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder}
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
        />
        <button
          onClick={add}
          disabled={!newVal.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus size={15} /> {addLabel}
        </button>
      </div>
    </div>
  );
}

// ── Time Slots editor ──────────────────────────────────────────
function TimeSlotsEditor({
  items, onChange,
}: {
  items: string[];
  onChange: (v: string[]) => void;
}) {
  const [newTime, setNewTime] = useState('');

  function add() {
    const v = newTime.trim();
    if (!v || items.includes(v)) return;
    // sort by time
    const sorted = [...items, v].sort();
    onChange(sorted);
    setNewTime('');
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {items.length === 0 && (
          <p className="col-span-full text-sm text-slate-400 py-2">ยังไม่มี time slot</p>
        )}
        {items.map((slot, i) => (
          <div key={i}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 group text-sm">
            <div className="flex items-center gap-2">
              <Clock size={13} style={{ color: PRIMARY }} />
              <span className="font-medium text-slate-700">{slot}</span>
            </div>
            <button
              onClick={() => remove(i)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-500 text-slate-300"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Add */}
      <div className="flex gap-2">
        <input
          type="time"
          value={newTime}
          onChange={e => setNewTime(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
        />
        <button
          onClick={add}
          disabled={!newTime}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus size={15} /> เพิ่ม Slot
        </button>
        <button
          onClick={() => {
            const defaults = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
            const merged = [...new Set([...items, ...defaults])].sort();
            onChange(merged);
          }}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          ใช้ค่า Default
        </button>
      </div>
    </div>
  );
}

// ── Treatment Cycles editor ────────────────────────────────────
const CYCLE_PRESETS: TreatmentCycle[] = [
  { treatment: 'Botox',    days: 120 },
  { treatment: 'Filler',   days: 365 },
  { treatment: 'Sculptra', days: 540 },
  { treatment: 'Profhilo', days: 180 },
  { treatment: 'Juvelook', days: 180 },
];

function TreatmentCyclesEditor({
  items, onChange,
}: {
  items: TreatmentCycle[];
  onChange: (v: TreatmentCycle[]) => void;
}) {
  const [newTreatment, setNewTreatment] = useState('');
  const [newDays, setNewDays]           = useState('');

  function add() {
    const t = newTreatment.trim();
    const d = parseInt(newDays);
    if (!t || !d || d <= 0) return;
    if (items.some(x => x.treatment.toLowerCase() === t.toLowerCase())) return;
    onChange([...items, { treatment: t, days: d }]);
    setNewTreatment(''); setNewDays('');
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  function updateDays(i: number, days: number) {
    onChange(items.map((x, idx) => idx === i ? { ...x, days } : x));
  }

  function addPresets() {
    const merged = [...items];
    for (const p of CYCLE_PRESETS) {
      if (!merged.some(x => x.treatment.toLowerCase() === p.treatment.toLowerCase())) {
        merged.push(p);
      }
    }
    onChange(merged);
  }

  return (
    <div className="space-y-3">
      {/* List */}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-400 py-2">ยังไม่มี treatment cycle</p>
        )}
        {items.map((cycle, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 group">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIMARY }} />
            <span className="flex-1 text-sm font-semibold text-slate-700">{cycle.treatment}</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={cycle.days}
                min={1}
                onChange={e => updateDays(i, parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center font-medium focus:outline-none focus:ring-1"
                style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
              />
              <span className="text-xs text-slate-400">วัน</span>
            </div>
            <div className="px-2 py-1 rounded-lg text-xs font-semibold hidden sm:block"
              style={{ backgroundColor: '#E6F4F4', color: PRIMARY }}>
              ~{Math.round(cycle.days / 30)} เดือน
            </div>
            <button
              onClick={() => remove(i)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newTreatment}
          onChange={e => setNewTreatment(e.target.value)}
          placeholder="ชื่อ Treatment"
          className="flex-1 min-w-32 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
        />
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={newDays}
            onChange={e => setNewDays(e.target.value)}
            placeholder="วัน"
            min={1}
            className="w-20 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
          />
          <span className="text-xs text-slate-400">วัน</span>
        </div>
        <button
          onClick={add}
          disabled={!newTreatment.trim() || !newDays}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus size={15} /> เพิ่ม
        </button>
        <button
          onClick={addPresets}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          ใช้ค่า Default
        </button>
      </div>

      {/* Info */}
      <p className="text-xs text-slate-400">
        * ระบบจะส่ง LINE แจ้งเตือนคนไข้อัตโนมัติเมื่อครบรอบ (Smart CRM Bot)
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function SettingsManager() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  // Dirty tracking per section
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          doctor_names:    data.doctor_names    ?? [],
          sales_names:     data.sales_names     ?? [],
          time_slots:      data.time_slots      ?? [],
          treatment_cycles: data.treatment_cycles ?? [],
        });
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(s => ({ ...s, [key]: value }));
    setDirty(d => ({ ...d, [key]: true }));
  }

  async function save(key: keyof Settings) {
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: settings[key] }),
      });
      if (!res.ok) throw new Error();
      setDirty(d => ({ ...d, [key]: false }));
      showToast('บันทึกเรียบร้อย ✓');
    } catch {
      showToast('เกิดข้อผิดพลาด ลองใหม่', false);
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
        <RefreshCw size={18} className="animate-spin" /> กำลังโหลด...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* ── Page header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: `linear-gradient(135deg, ${PRIMARY}, #1a6b7a)` }}>
            <Stethoscope size={20} />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">Settings</h2>
            <p className="text-xs text-slate-400">ตั้งค่าคลินิก · แพทย์, เวลา, รอบการรักษา</p>
          </div>
        </div>
        <button onClick={load}
          className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
          <RefreshCw size={15} className="text-slate-500" />
        </button>
      </div>

      {/* ── 1. Doctor Names ─────────────────────────────── */}
      <Section
        icon={Stethoscope} title="แพทย์" subtitle="รายชื่อแพทย์ที่ใช้ใน Appointment & Visit"
        iconBg="#E6F4F4" iconColor={PRIMARY}
        saving={saving.doctor_names} dirty={dirty.doctor_names}
        onSave={() => save('doctor_names')}
      >
        <StringListEditor
          items={settings.doctor_names}
          onChange={v => update('doctor_names', v)}
          placeholder="เช่น หมอพลอยใส"
          addLabel="เพิ่ม"
        />
      </Section>

      {/* ── 2. Sales / Staff Names ──────────────────────── */}
      <Section
        icon={Users} title="Sales / Staff" subtitle="รายชื่อพนักงาน Sales ที่ใช้ใน Appointment"
        iconBg="#FEF3EE" iconColor={ACCENT}
        saving={saving.sales_names} dirty={dirty.sales_names}
        onSave={() => save('sales_names')}
      >
        <StringListEditor
          items={settings.sales_names}
          onChange={v => update('sales_names', v)}
          placeholder="เช่น ไลลา"
          addLabel="เพิ่ม"
        />
      </Section>

      {/* ── 3. Time Slots ───────────────────────────────── */}
      <Section
        icon={Clock} title="Time Slots" subtitle="ช่วงเวลานัดหมายที่เปิดรับ (LINE chatbot + Calendar)"
        iconBg="#FDF6EC" iconColor="#D97706"
        saving={saving.time_slots} dirty={dirty.time_slots}
        onSave={() => save('time_slots')}
      >
        <TimeSlotsEditor
          items={settings.time_slots}
          onChange={v => update('time_slots', v)}
        />
      </Section>

      {/* ── 4. Treatment Cycles ─────────────────────────── */}
      <Section
        icon={Repeat} title="Treatment Cycles" subtitle="รอบการรักษา — ใช้โดย Predictive Dashboard & Smart CRM Bot"
        iconBg="#EDE9FE" iconColor="#7c3aed"
        saving={saving.treatment_cycles} dirty={dirty.treatment_cycles}
        onSave={() => save('treatment_cycles')}
      >
        <TreatmentCyclesEditor
          items={settings.treatment_cycles}
          onChange={v => update('treatment_cycles', v)}
        />
      </Section>
    </div>
  );
}
