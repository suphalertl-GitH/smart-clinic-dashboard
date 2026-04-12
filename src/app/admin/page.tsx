'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, TrendingUp, ShieldCheck, LogOut,
  Plus, X, ChevronDown, RefreshCw, CheckCircle, XCircle,
  HeartPulse, BarChart3, Layers,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import type { ClinicWithStats } from '@/types/database';

// ── Types ──────────────────────────────────────────────────────
interface PlatformStats {
  total_clinics: number;
  active_clinics: number;
  total_patients: number;
  total_revenue: number;
  mrr: number;
  tier_counts: { starter: number; professional: number; enterprise: number };
  new_this_month: number;
}

const TIER_LABEL: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  custom: 'Custom',
};
const TIER_COLOR: Record<string, string> = {
  starter:      'bg-sky-100 text-sky-700',
  professional: 'bg-violet-100 text-violet-700',
  enterprise:   'bg-amber-100 text-amber-700',
  custom:       'bg-gray-100 text-gray-700',
};
const TIER_PRICE: Record<string, number> = {
  starter: 1490,
  professional: 3990,
  enterprise: 12000,
  custom: 0,
};

// Feature list (client-safe, mirrors lib/tier.ts FEATURE_META)
const FEATURE_META = [
  { key: 'sales_analytics',   label: 'Sales Analytics',      desc: 'รายงานและวิเคราะห์ยอดขาย' },
  { key: 'customer_insights', label: 'Customer Insights',    desc: 'วิเคราะห์พฤติกรรมลูกค้า' },
  { key: 'ai_summary',        label: 'AI Executive Summary', desc: 'สรุปรายงาน AI ในหน้าแรก' },
  { key: 'promotions',        label: 'Promotions',           desc: 'จัดการโปรโมชั่นและส่วนลด' },
  { key: 'crm',               label: 'CRM & Campaigns',      desc: 'ระบบ CRM, RFM และ campaigns' },
  { key: 'promptpay',         label: 'PromptPay QR',         desc: 'QR พร้อมเพย์ในหน้า visit' },
  { key: 'google_sheets',     label: 'Google Sheets',        desc: 'Sync ข้อมูลกับ Google Sheets' },
  { key: 'predictive',        label: 'Predictive AI',        desc: 'AI พยากรณ์ revenue/churn' },
  { key: 'followup_bot',      label: 'Smart CRM Bot',        desc: 'Bot follow-up อัตโนมัติทาง LINE' },
  { key: 'clinic_ops',        label: 'Clinic Ops',           desc: 'Heatmap นัด + workload แพทย์' },
] as const;

function fmt(n: number) {
  return n.toLocaleString('th-TH');
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.FC<{ className?: string }>; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-start shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Onboard Modal ──────────────────────────────────────────────
function OnboardModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', phone: '', address: '',
    owner_email: '', owner_password: '', tier: 'starter',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/clinics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'เกิดข้อผิดพลาด'); setLoading(false); return; }
    onCreated();
    onClose();
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Onboard คลินิกใหม่</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            { label: 'ชื่อคลินิก', key: 'name', placeholder: 'เช่น ราชาคลินิก', type: 'text' },
            { label: 'เบอร์โทร', key: 'phone', placeholder: '0812345678', type: 'tel' },
            { label: 'ที่อยู่', key: 'address', placeholder: 'กรุงเทพฯ', type: 'text' },
            { label: 'อีเมลผู้ดูแล', key: 'owner_email', placeholder: 'admin@clinic.com', type: 'email' },
            { label: 'รหัสผ่านเริ่มต้น', key: 'owner_password', placeholder: '••••••••', type: 'password' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type={type}
                required
                placeholder={placeholder}
                {...field(key as keyof typeof form)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c]"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subscription Tier</label>
            <div className="relative">
              <select
                {...field('tier')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c]"
              >
                <option value="starter">Starter — 1,490 ฿/เดือน</option>
                <option value="professional">Professional — 3,990 ฿/เดือน</option>
                <option value="enterprise">Enterprise — 12,000 ฿/เดือน</option>
                <option value="custom">Custom — กำหนดเอง</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl bg-[#0f4c5c] text-white text-sm font-medium hover:bg-[#0d3f4d] disabled:opacity-60 transition">
              {loading ? 'กำลังสร้าง...' : 'สร้างคลินิก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Tier / Status Modal ───────────────────────────────────
function EditClinicModal({ clinic, onClose, onSaved }: {
  clinic: ClinicWithStats; onClose: () => void; onSaved: () => void;
}) {
  const [tier, setTier] = useState(clinic.tier);
  const [isActive, setIsActive] = useState(clinic.is_active !== false);
  const [expiresAt, setExpiresAt] = useState(clinic.subscription_expires_at?.slice(0, 10) ?? '');
  const [customFeatures, setCustomFeatures] = useState<Record<string, boolean>>(
    (clinic.custom_features as Record<string, boolean>) ?? {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggleFeature(key: string) {
    setCustomFeatures(f => ({ ...f, [key]: !f[key] }));
  }

  async function handleSave() {
    setLoading(true);
    setError('');
    const body: Record<string, unknown> = {
      tier,
      is_active: isActive,
      subscription_expires_at: expiresAt || null,
    };
    if (tier === 'custom') body.custom_features = customFeatures;
    const res = await fetch(`/api/admin/clinics/${clinic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'เกิดข้อผิดพลาด'); setLoading(false); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">แก้ไขคลินิก</h2>
            <p className="text-xs text-gray-500 mt-0.5">{clinic.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Tier */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subscription Tier</label>
            <div className="relative">
              <select
                value={tier}
                onChange={e => setTier(e.target.value as typeof tier)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c]"
              >
                <option value="starter">Starter — 1,490 ฿/เดือน</option>
                <option value="professional">Professional — 3,990 ฿/เดือน</option>
                <option value="enterprise">Enterprise — 12,000 ฿/เดือน</option>
                <option value="custom">Custom — กำหนดเอง</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Custom features */}
          {tier === 'custom' && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                เลือก Features
              </p>
              <div className="divide-y divide-gray-50">
                {FEATURE_META.map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div
                      onClick={() => toggleFeature(key)}
                      className={`w-9 h-5 rounded-full flex-shrink-0 relative transition-colors cursor-pointer ${
                        customFeatures[key] ? 'bg-[#0f4c5c]' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        customFeatures[key] ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">วันหมดอายุ Subscription</label>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c]"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsActive(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-[#0f4c5c]' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-700">{isActive ? 'Active' : 'Suspended'}</span>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
              ยกเลิก
            </button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 py-2 rounded-xl bg-[#0f4c5c] text-white text-sm font-medium hover:bg-[#0d3f4d] disabled:opacity-60 transition">
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [clinics, setClinics] = useState<ClinicWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'clinics'>('overview');
  const [showOnboard, setShowOnboard] = useState(false);
  const [editClinic, setEditClinic] = useState<ClinicWithStats | null>(null);
  const [search, setSearch] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [statsRes, clinicsRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/clinics'),
    ]);
    if (statsRes.status === 403 || clinicsRes.status === 403) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    const statsJson = await statsRes.json();
    const clinicsJson = await clinicsRes.json();
    setStats(statsJson);
    setClinics(clinicsJson.clinics ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push('/login');
  }

  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.owner_email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Unauthorized ───────────────────────────────────────────
  if (unauthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0]">
        <div className="text-center">
          <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h1 className="font-semibold text-gray-800 mb-1">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-sm text-gray-500 mb-4">หน้านี้สำหรับ Super Admin เท่านั้น</p>
          <button onClick={() => router.push('/dashboard')}
            className="text-sm text-[#0f4c5c] hover:underline">
            ไปหน้า Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F4F0] flex flex-col">
      {/* Header */}
      <header className="bg-[#0f4c5c] text-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <HeartPulse className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-sm">Smart Clinic</span>
            <span className="ml-2 text-[10px] bg-amber-400 text-amber-900 font-bold px-2 py-0.5 rounded-full">SUPER ADMIN</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/10 transition" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10 transition" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-1">
          {([
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'clinics',  label: 'Clinics',  icon: Building2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-[#0f4c5c] text-[#0f4c5c]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        ) : activeTab === 'overview' ? (
          <OverviewTab stats={stats} clinics={clinics} />
        ) : (
          <ClinicsTab
            clinics={filteredClinics}
            search={search}
            onSearch={setSearch}
            onAdd={() => setShowOnboard(true)}
            onEdit={setEditClinic}
          />
        )}
      </main>

      {showOnboard && (
        <OnboardModal
          onClose={() => setShowOnboard(false)}
          onCreated={load}
        />
      )}
      {editClinic && (
        <EditClinicModal
          clinic={editClinic}
          onClose={() => setEditClinic(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────
function OverviewTab({ stats, clinics }: { stats: PlatformStats | null; clinics: ClinicWithStats[] }) {
  if (!stats) return null;

  const recentClinics = [...clinics]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="คลินิกทั้งหมด" value={String(stats.total_clinics)}
          sub={`${stats.new_this_month} ใหม่เดือนนี้`}
          icon={Building2} color="bg-[#0f4c5c]/10 text-[#0f4c5c]" />
        <StatCard label="Active" value={String(stats.active_clinics)}
          sub={`${stats.total_clinics - stats.active_clinics} suspended`}
          icon={CheckCircle} color="bg-emerald-100 text-emerald-600" />
        <StatCard label="ผู้ป่วยรวม" value={fmt(stats.total_patients)}
          icon={Users} color="bg-sky-100 text-sky-600" />
        <StatCard label="Revenue รวม" value={`฿${fmt(stats.total_revenue)}`}
          icon={TrendingUp} color="bg-violet-100 text-violet-600" />
        <StatCard label="MRR (est.)" value={`฿${fmt(stats.mrr)}`}
          sub="Recurring/เดือน"
          icon={Layers} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Tier breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Subscription Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(stats.tier_counts).map(([tier, count]) => (
            <div key={tier} className="text-center p-4 rounded-xl bg-gray-50">
              <p className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-2 ${TIER_COLOR[tier]}`}>
                {TIER_LABEL[tier]}
              </p>
              <p className="text-3xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400 mt-1">฿{fmt(TIER_PRICE[tier] * count)}/เดือน</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent clinics */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">คลินิกล่าสุด</h3>
        <div className="divide-y divide-gray-50">
          {recentClinics.map(c => (
            <div key={c.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-400">{c.owner_email ?? '-'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLOR[c.tier]}`}>
                  {TIER_LABEL[c.tier]}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(c.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          {recentClinics.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">ยังไม่มีคลินิก</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Clinics Tab ────────────────────────────────────────────────
function ClinicsTab({
  clinics, search, onSearch, onAdd, onEdit,
}: {
  clinics: ClinicWithStats[];
  search: string;
  onSearch: (v: string) => void;
  onAdd: () => void;
  onEdit: (c: ClinicWithStats) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="ค้นหาชื่อคลินิก หรืออีเมล..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c] bg-white"
        />
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0f4c5c] text-white text-sm font-medium hover:bg-[#0d3f4d] transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Onboard ใหม่
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">คลินิก</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">สถานะ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ผู้ป่วย</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">หมดอายุ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clinics.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.owner_email ?? '-'}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TIER_COLOR[c.tier]}`}>
                      {TIER_LABEL[c.tier]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {c.is_active !== false ? (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                        <XCircle className="w-3.5 h-3.5" /> Suspended
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-700 font-medium">{fmt(c.patient_count)}</td>
                  <td className="px-4 py-3.5 text-right text-gray-700 font-medium">฿{fmt(c.total_revenue)}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">
                    {c.subscription_expires_at
                      ? new Date(c.subscription_expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => onEdit(c)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition"
                    >
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
              {clinics.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm text-gray-400">
                    ไม่พบคลินิก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {clinics.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            {clinics.length} คลินิก
          </div>
        )}
      </div>
    </div>
  );
}
