'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Activity, RefreshCw, LayoutDashboard, BarChart2, Users,
  Megaphone, Stethoscope, Bell, Search, LogOut, HeartPulse,
  Brain, Tag, Menu, X, ChevronRight, Settings, Sheet,
} from 'lucide-react';
import ClinicOps from './_components/ClinicOps';
import ExecutiveOverview from './_components/ExecutiveOverview';
import SalesAnalytics from './_components/SalesAnalytics';
import CustomerInsights from './_components/CustomerInsights';
import CrmInsights from './_components/CrmInsights';
import PredictiveDashboard from './_components/PredictiveDashboard';
import PromotionsManager from './_components/PromotionsManager';
import SettingsManager from './_components/SettingsManager';
import SheetsSyncManager from './_components/SheetsSyncManager';
import { MOCK_DASHBOARD } from '@/lib/mock-dashboard';

// ── Theme Definitions ─────────────────────────────────────────
type ThemeKey = 'teal' | 'emerald' | 'blue' | 'purple' | 'rose' | 'amber' | 'cyan' | 'fuchsia';
const THEMES: Record<ThemeKey, { bg: string; bgDark: string; accent: string; gradient: string }> = {
  teal:    { bg: '#0f4c5c', bgDark: '#1a6b7a', accent: '#e36414', gradient: 'linear-gradient(135deg, #0f4c5c, #1a6b7a)' },
  emerald: { bg: '#059669', bgDark: '#10b981', accent: '#f59e0b', gradient: 'linear-gradient(135deg, #059669, #10b981)' },
  blue:    { bg: '#0369a1', bgDark: '#0ea5e9', accent: '#f59e0b', gradient: 'linear-gradient(135deg, #0369a1, #0ea5e9)' },
  purple:  { bg: '#7c3aed', bgDark: '#a78bfa', accent: '#e36414', gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)' },
  rose:    { bg: '#e11d48', bgDark: '#fb7185', accent: '#f59e0b', gradient: 'linear-gradient(135deg, #e11d48, #fb7185)' },
  amber:   { bg: '#d97706', bgDark: '#fbbf24', accent: '#0f4c5c', gradient: 'linear-gradient(135deg, #d97706, #fbbf24)' },
  cyan:    { bg: '#0891b2', bgDark: '#06b6d4', accent: '#e36414', gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)' },
  fuchsia: { bg: '#d946ef', bgDark: '#ec4899', accent: '#f59e0b', gradient: 'linear-gradient(135deg, #d946ef, #ec4899)' },
};

// ── Nav items ─────────────────────────────────────────────────
type NavId = 'overview' | 'sales' | 'customers' | 'crm' | 'promotions' | 'predictive' | 'sheets' | 'settings' | 'clinicops';

const NAV: { id: NavId; label: string; icon: React.FC<any>; badge?: string; featureKey?: string; divider?: boolean }[] = [
  { id: 'overview',   label: 'Executive Summary',  icon: LayoutDashboard },
  { id: 'sales',      label: 'Sales Analytics',   icon: BarChart2 },
  { id: 'customers',  label: 'Customer Insights', icon: Users,      featureKey: 'customer_insights' },
  { id: 'crm',        label: 'CRM & Campaigns',   icon: Megaphone,  featureKey: 'crm' },
  { id: 'promotions', label: 'Promotions',         icon: Tag,        featureKey: 'promotions' },
  { id: 'predictive', label: 'Predictive AI',      icon: Brain,      featureKey: 'predictive', badge: 'AI' },
  { id: 'clinicops',  label: 'Clinic Ops',         icon: Activity,   featureKey: 'clinic_ops' },
  { id: 'sheets',     label: 'Connect Google Sheets', icon: Sheet,   featureKey: 'google_sheets' },
  { id: 'settings',   label: 'Settings',           icon: Settings,   divider: true },
];
const DISABLED_NAV: { label: string; icon: React.FC<any> }[] = [];

// Bottom nav — show 5 most-used items on mobile
const BOTTOM_NAV: { id: NavId; label: string; icon: React.FC<any> }[] = [
  { id: 'overview',   label: 'หน้าหลัก',  icon: LayoutDashboard },
  { id: 'sales',      label: 'Sales',     icon: BarChart2 },
  { id: 'customers',  label: 'ลูกค้า',    icon: Users },
  { id: 'crm',        label: 'CRM',       icon: Megaphone },
  { id: 'promotions', label: 'โปรโม',     icon: Tag },
];

const PAGE_TITLE: Record<NavId, string> = {
  overview:   'Executive Summary',
  sales:      'Sales Analytics',
  customers:  'Customer Insights',
  crm:        'CRM & Campaigns',
  promotions: 'Promotions',
  predictive: 'Predictive AI',
  sheets:     'Connect Google Sheets',
  clinicops:  'Clinic Ops',
  settings:   'Settings',
};

// ── Sidebar inner content (reused in both desktop & drawer) ────
function SidebarContent({
  activeNav, setActiveNav, theme, setTheme, t, onNavClick, enabledFeatures, tierLabel, onLogout,
}: {
  activeNav: NavId;
  setActiveNav: (id: NavId) => void;
  theme: ThemeKey;
  setTheme: (k: ThemeKey) => void;
  t: typeof THEMES.teal;
  onNavClick?: () => void;
  enabledFeatures: string[];
  tierLabel: string;
  onLogout: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: t.accent }}>
            <HeartPulse size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-base leading-tight">Smart Clinic</h1>
            <p className="text-xs text-white/50">{tierLabel}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-auto">
        {NAV.map(({ id, label, icon: Icon, badge, featureKey, divider }) => {
          const active = activeNav === id;
          const locked = !!featureKey && !enabledFeatures.includes(featureKey);
          if (locked) return null; // ซ่อน item ที่ tier ไม่รองรับ
          return (
            <div key={id}>
              {divider && <div className="my-2 border-t border-white/10" />}
              <button
              onClick={() => { setActiveNav(id); onNavClick?.(); }}
              className={`sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/8'
              }`}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-white/20 text-white/80">
                  {badge}
                </span>
              )}
              {active && <ChevronRight size={14} className="text-white/40" />}
            </button>
            </div>
          );
        })}

        {DISABLED_NAV.length > 0 && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest px-3 mb-2">Coming Soon</p>
            </div>
            {DISABLED_NAV.map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/25 cursor-not-allowed select-none">
                <Icon size={18} />
                {label}
              </div>
            ))}
          </>
        )}
      </nav>

      {/* Theme Switcher */}
      <div className="px-3 py-3 border-t border-white/10 mb-1 shrink-0">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2.5 px-1">ธีมสี</p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(THEMES) as [ThemeKey, typeof THEMES.teal][]).map(([key, th]) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              title={key}
              className="w-full h-7 rounded-lg border-2 transition-all hover:scale-105"
              style={{
                background: th.gradient,
                borderColor: theme === key ? '#fff' : 'transparent',
                boxShadow:   theme === key ? '0 0 8px rgba(255,255,255,0.3)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Admin footer */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: t.accent }}
          >
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Admin</p>
            <p className="text-xs text-white/40">ผู้ดูแลระบบ</p>
          </div>
          <button onClick={onLogout} title="ออกจากระบบ"
            className="text-white/40 hover:text-white transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [dashData, setDashData]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [usingMock, setUsingMock]   = useState(false);
  const [activeNav, setActiveNav]   = useState<NavId>('overview');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [theme, setTheme]           = useState<ThemeKey>('teal');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [tierLabel, setTierLabel]   = useState('Starter');

  const t = THEMES[theme];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate)   params.set('endDate', endDate);
      const res  = await fetch(`/api/dashboard?${params}`);
      const text = await res.text();
      if (!text) throw new Error('empty');
      const parsed = JSON.parse(text);
      setDashData(parsed);
      if (parsed.enabled_features) setEnabledFeatures(parsed.enabled_features);
      if (parsed.tier) {
        const labels: Record<string, string> = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise', custom: 'Custom' };
        setTierLabel(labels[parsed.tier] ?? parsed.tier);
      }
      setUsingMock(false);
    } catch (e: any) {
      console.warn('Dashboard: using mock data —', e.message);
      setDashData(MOCK_DASHBOARD);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // Close sidebar on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const sidebarProps = { activeNav, setActiveNav, theme, setTheme, t, enabledFeatures, tierLabel, onLogout: handleLogout };

  return (
    <div className="flex h-full w-full font-body overflow-hidden" style={{ backgroundColor: '#f1f5f9' }}>

      {/* ── Mobile backdrop ─────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop: static | mobile: fixed drawer) ── */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 lg:w-64 flex-shrink-0 flex flex-col text-white
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ backgroundColor: t.bg }}
      >
        {/* Mobile close button */}
        <button
          className="lg:hidden absolute top-4 right-4 text-white/60 hover:text-white z-50"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={20} />
        </button>

        <SidebarContent
          {...sidebarProps}
          onNavClick={() => setSidebarOpen(false)}
        />
      </aside>

      {/* ── Main area ─────────────────────────────────────── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">

        {/* Sticky header */}
        <header
          className="sticky top-0 z-20 px-4 lg:px-6 py-3 lg:py-4 flex items-center gap-3 shrink-0"
          style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}
        >
          {/* Hamburger (mobile only) */}
          <button
            className="lg:hidden p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} className="text-slate-600" />
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h2 className="font-heading font-bold text-lg lg:text-xl truncate" style={{ color: t.bg }}>
              {PAGE_TITLE[activeNav]}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {usingMock ? (
                <span className="flex items-center gap-1 text-[11px] text-amber-500 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Mock
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Live
                </span>
              )}
              {dashData?.lastUpdated && (
                <span className="text-[11px] text-slate-400 hidden sm:inline">· {dashData.lastUpdated}</span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Date filters — desktop only */}
            <div className="hidden lg:flex items-center gap-2">
              <input
                type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-600 bg-white focus:outline-none focus:border-teal-400"
              />
              <span className="text-slate-300 text-xs">–</span>
              <input
                type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-600 bg-white focus:outline-none focus:border-teal-400"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100"
                >✕</button>
              )}
            </div>

            {/* Search — hidden on small mobile */}
            <div className="relative hidden sm:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหา..."
                className="pl-8 pr-3 py-2 rounded-xl text-xs border border-slate-200 bg-white focus:outline-none focus:ring-2 w-32 lg:w-44"
                style={{ '--tw-ring-color': t.bg } as React.CSSProperties}
              />
            </div>

            {/* Refresh */}
            <button
              onClick={loadData} disabled={loading}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Bell */}
            <button className="relative p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
              <Bell size={16} className="text-slate-500" />
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold"
                style={{ backgroundColor: t.accent }}
              >3</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
          {loading && !dashData ? (
            <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
              <RefreshCw size={20} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : dashData ? (
            <>
              {activeNav === 'overview'   && <ExecutiveOverview data={dashData} theme={t} enabledFeatures={enabledFeatures} hasDateFilter={!!(startDate || endDate)} />}
              {activeNav === 'sales'      && <SalesAnalytics data={dashData} theme={t} />}
              {activeNav === 'customers'  && <CustomerInsights data={dashData} theme={t} />}
              {activeNav === 'crm'        && <CrmInsights />}
              {activeNav === 'promotions' && <PromotionsManager />}
              {activeNav === 'predictive' && <PredictiveDashboard />}
              {activeNav === 'sheets'     && <SheetsSyncManager />}
              {activeNav === 'clinicops'  && <ClinicOps />}
              {activeNav === 'settings'   && <SettingsManager />}
            </>
          ) : (
            <div className="text-center text-slate-400 mt-20">ไม่สามารถโหลดข้อมูลได้</div>
          )}
        </div>
      </main>

      {/* ── Bottom Nav (mobile only) ──────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-20 flex border-t border-slate-200"
        style={{ backgroundColor: '#fff' }}
      >
        {BOTTOM_NAV.filter(({ id }) => {
          const navItem = NAV.find(n => n.id === id);
          return navItem?.featureKey ? enabledFeatures.includes(navItem.featureKey) : true;
        }).map(({ id, label, icon: Icon }) => {
          const active = activeNav === id;
          return (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
            >
              <div
                className={`w-9 h-7 rounded-xl flex items-center justify-center transition-all ${active ? 'scale-110' : ''}`}
                style={active ? { backgroundColor: t.bg } : {}}
              >
                <Icon size={17} className={active ? 'text-white' : 'text-slate-400'} />
              </div>
              <span
                className={`text-[10px] font-semibold leading-none ${active ? '' : 'text-slate-400'}`}
                style={active ? { color: t.bg } : {}}
              >
                {label}
              </span>
            </button>
          );
        })}

        {/* More (เปิด sidebar) */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
        >
          <div className="w-9 h-7 rounded-xl flex items-center justify-center">
            <Menu size={17} className="text-slate-400" />
          </div>
          <span className="text-[10px] font-semibold text-slate-400 leading-none">เพิ่มเติม</span>
        </button>
      </nav>
    </div>
  );
}
