'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Tag, RefreshCw, X, CheckCircle, AlertTriangle,
  Calendar, DollarSign, FileText,
} from 'lucide-react';

const PRIMARY = '#0f4c5c';
const ACCENT  = '#e36414';

type Promo = {
  id: string;
  title: string;
  description: string | null;
  price: string | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
};

const EMPTY: Omit<Promo, 'id' | 'created_at'> = {
  title: '', description: '', price: '', valid_from: '', valid_until: '', is_active: true,
};

function formatDate(iso: string) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function isExpired(until: string) {
  return new Date(until) < new Date();
}

function StatusBadge({ promo }: { promo: Promo }) {
  if (!promo.is_active)
    return <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">ปิด</span>;
  if (isExpired(promo.valid_until))
    return <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-500 font-semibold">หมดอายุ</span>;
  return <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-semibold">Active</span>;
}

// ── Modal ──────────────────────────────────────────────────────
function PromoModal({
  initial, onSave, onClose, saving,
}: {
  initial: Omit<Promo, 'id' | 'created_at'>;
  onSave: (v: Omit<Promo, 'id' | 'created_at'>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);

  function set(k: keyof typeof form, v: any) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const valid = form.title.trim() !== '' && form.valid_from !== '' && form.valid_until !== '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${PRIMARY}, #1a6b7a)` }}>
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-white" />
            <h3 className="font-heading font-bold text-white">
              {initial.title ? 'แก้ไขโปรโมชั่น' : 'เพิ่มโปรโมชั่นใหม่'}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              ชื่อโปรโมชั่น <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="เช่น Botox Summer Special"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              <FileText size={11} className="inline mr-1" /> รายละเอียด
            </label>
            <textarea
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              rows={2}
              placeholder="รายละเอียดโปรโมชั่น..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              <DollarSign size={11} className="inline mr-1" /> ราคา / ส่วนลด
            </label>
            <input
              type="text"
              value={form.price ?? ''}
              onChange={e => set('price', e.target.value)}
              placeholder="เช่น ฿2,990 หรือ ลด 20%"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                <Calendar size={11} className="inline mr-1" /> วันเริ่ม <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.valid_from}
                onChange={e => set('valid_from', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                <Calendar size={11} className="inline mr-1" /> วันหมดอายุ <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.valid_until}
                onChange={e => set('valid_until', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': PRIMARY } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-700">สถานะ Active</p>
              <p className="text-xs text-slate-400">เปิดให้ LINE chatbot แสดงโปรโมชั่นนี้</p>
            </div>
            <button onClick={() => set('is_active', !form.is_active)} className="transition-opacity hover:opacity-80">
              {form.is_active
                ? <ToggleRight size={32} style={{ color: PRIMARY }} />
                : <ToggleLeft size={32} className="text-slate-300" />
              }
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid || saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: PRIMARY }}
          >
            {saving
              ? <><RefreshCw size={14} className="animate-spin" /> กำลังบันทึก...</>
              : <><CheckCircle size={14} /> บันทึก</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ──────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <h3 className="font-heading font-bold text-slate-800 text-lg mb-1">ลบโปรโมชั่น?</h3>
        <p className="text-sm text-slate-500 mb-5">
          คุณต้องการลบ <span className="font-semibold text-slate-700">"{name}"</span> ใช่ไหม?<br/>
          ไม่สามารถกู้คืนได้
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            ยกเลิก
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">
            ลบเลย
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function PromotionsManager() {
  const [promos, setPromos]       = useState<Promo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  // Modal state
  const [showModal, setShowModal]   = useState(false);
  const [editTarget, setEditTarget] = useState<Promo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Promo | null>(null);

  // Filter
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/promotions');
      setPromos(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derived
  const filtered = promos.filter(p => {
    if (filter === 'active')   return p.is_active && !isExpired(p.valid_until);
    if (filter === 'inactive') return !p.is_active;
    if (filter === 'expired')  return isExpired(p.valid_until);
    return true;
  });

  const counts = {
    all:      promos.length,
    active:   promos.filter(p => p.is_active && !isExpired(p.valid_until)).length,
    inactive: promos.filter(p => !p.is_active).length,
    expired:  promos.filter(p => isExpired(p.valid_until)).length,
  };

  // ── CRUD handlers ──────────────────────────────────────────
  async function handleSave(form: Omit<Promo, 'id' | 'created_at'>) {
    setSaving(true);
    try {
      if (editTarget) {
        // Update
        const res = await fetch(`/api/promotions/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        showToast('แก้ไขโปรโมชั่นเรียบร้อย ✓');
      } else {
        // Create
        const res = await fetch('/api/promotions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        showToast('เพิ่มโปรโมชั่นเรียบร้อย ✓');
      }
      setShowModal(false);
      setEditTarget(null);
      await load();
    } catch {
      showToast('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', false);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(p: Promo) {
    try {
      await fetch(`/api/promotions/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      setPromos(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
    } catch {
      showToast('เกิดข้อผิดพลาด', false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/promotions/${deleteTarget.id}`, { method: 'DELETE' });
      setPromos(prev => prev.filter(x => x.id !== deleteTarget.id));
      showToast('ลบโปรโมชั่นเรียบร้อย ✓');
    } catch {
      showToast('เกิดข้อผิดพลาด', false);
    } finally {
      setDeleteTarget(null);
    }
  }

  function openCreate() { setEditTarget(null); setShowModal(true); }
  function openEdit(p: Promo) { setEditTarget(p); setShowModal(true); }

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all',      label: `ทั้งหมด (${counts.all})` },
    { key: 'active',   label: `Active (${counts.active})` },
    { key: 'inactive', label: `ปิด (${counts.inactive})` },
    { key: 'expired',  label: `หมดอายุ (${counts.expired})` },
  ];

  return (
    <div className="space-y-5">

      {/* ── Toast ───────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-xl shadow-lg text-sm font-semibold text-white transition-all ${
          toast.ok ? '' : 'bg-red-500'
        }`}
          style={toast.ok ? { backgroundColor: PRIMARY } : {}}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #f97316)` }}>
            <Tag size={20} />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-800">Promotions</h2>
            <p className="text-xs text-slate-400">จัดการโปรโมชั่น · แสดงใน LINE chatbot อัตโนมัติ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
            <RefreshCw size={15} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus size={16} /> เพิ่มโปรโมชั่น
          </button>
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
              filter === key
                ? 'text-white border-transparent'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
            style={filter === key ? { backgroundColor: PRIMARY } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
          <RefreshCw size={18} className="animate-spin" /> กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: '#E6F4F4', color: PRIMARY }}>
            <Tag size={28} />
          </div>
          <p className="text-slate-500 font-medium mb-1">ยังไม่มีโปรโมชั่น</p>
          <p className="text-slate-400 text-sm mb-5">กดปุ่ม "เพิ่มโปรโมชั่น" เพื่อเริ่มต้น</p>
          <button onClick={openCreate}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: PRIMARY }}>
            <Plus size={14} className="inline mr-1.5" />เพิ่มโปรโมชั่นแรก
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <PromoCard
              key={p.id}
              promo={p}
              onEdit={() => openEdit(p)}
              onDelete={() => setDeleteTarget(p)}
              onToggle={() => handleToggle(p)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────── */}
      {showModal && (
        <PromoModal
          initial={editTarget
            ? { title: editTarget.title, description: editTarget.description, price: editTarget.price, valid_from: editTarget.valid_from, valid_until: editTarget.valid_until, is_active: editTarget.is_active }
            : EMPTY
          }
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          saving={saving}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.title}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── Promo Card ─────────────────────────────────────────────────
function PromoCard({ promo, onEdit, onDelete, onToggle }: {
  promo: Promo;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const expired = isExpired(promo.valid_until);
  const active  = promo.is_active && !expired;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${
      active ? 'border-slate-100' : 'border-slate-100 opacity-70'
    }`}>
      {/* Top color strip */}
      <div className="h-1.5 w-full" style={{
        background: active
          ? `linear-gradient(90deg, ${PRIMARY}, #1a6b7a)`
          : expired ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)' : 'linear-gradient(90deg, #94a3b8, #cbd5e1)',
      }} />

      <div className="p-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-heading font-bold text-slate-800 text-base leading-snug truncate">{promo.title}</h4>
            {promo.description && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{promo.description}</p>
            )}
          </div>
          <StatusBadge promo={promo} />
        </div>

        {/* Price */}
        {promo.price && (
          <div className="flex items-center gap-1.5 mb-3">
            <DollarSign size={13} style={{ color: ACCENT }} />
            <span className="text-sm font-bold" style={{ color: ACCENT }}>{promo.price}</span>
          </div>
        )}

        {/* Date range */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
          <Calendar size={12} />
          <span>{formatDate(promo.valid_from)} – {formatDate(promo.valid_until)}</span>
          {expired && <span className="text-red-400 font-semibold">(หมดอายุ)</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          {/* Toggle */}
          <button
            onClick={onToggle}
            title={promo.is_active ? 'ปิดโปรโมชั่น' : 'เปิดโปรโมชั่น'}
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors px-3 py-1.5 rounded-lg"
            style={promo.is_active
              ? { backgroundColor: '#E6F4F4', color: PRIMARY }
              : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}
          >
            {promo.is_active
              ? <ToggleRight size={14} />
              : <ToggleLeft size={14} />
            }
            {promo.is_active ? 'Active' : 'ปิด'}
          </button>

          <div className="flex-1" />

          {/* Edit */}
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="แก้ไข"
          >
            <Pencil size={15} />
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
            title="ลบ"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
