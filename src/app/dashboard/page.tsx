'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, RefreshCw, LayoutDashboard, BarChart2, Users,
  Megaphone, Stethoscope, Bell, Search, LogOut, HeartPulse, Brain, Tag,
} from 'lucide-react';
import ExecutiveOverview from './_components/ExecutiveOverview';
import SalesAnalytics from './_components/SalesAnalytics';
import CustomerInsights from './_components/CustomerInsights';
import CrmInsights from './_components/CrmInsights';
import PredictiveDashboard from './_components/PredictiveDashboard';
import PromotionsManager from './_components/PromotionsManager';
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
type NavId = 'overview' | 'sales' | 'customers' | 'crm' | 'promotions' | 'predictive';
const NAV: { id: NavId; label: string; icon: React.FC<any>; badge?: string }[] = [
  { id: 'overview',    label: 'แดชบอร์ด',          icon: LayoutDashboard },
  { id: 'sales',       label: 'Sales Analytics',   icon: BarChart2 },
  { id: 'customers',   label: 'Customer Insights', icon: Users },
  { id: 'crm',         label: 'CRM & Campaigns',   icon: Megaphone },
  { id: 'promotions',  label: 'Promotions',         icon: Tag },
  { id: 'predictive',  label: 'Predictive AI',      icon: Brain, badge: 'Enterprise' },
];
const DISABLED_NAV = [
  { label: 'แพทย์', icon: Stethoscope },
  { label: 'Clinic Ops', icon: Activity },
];

const PAGE_TITLE: Record<NavId, string> = {
  overview:   'แดชบอร์ด',
  sales:      'Sales Analytics',
  customers:  'Customer Insights',
  crm:        'CRM & Campaigns',
  promotions: 'Promotions',
  predictive: 'Predictive Analytics',
};

export default function DashboardPage() {
  const [dashData, setDashData]   = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>('overview');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [theme, setTheme]         = useState<ThemeKey>('teal');

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
      setDashData(JSON.parse(text));
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

  return (
    <div className="flex h-full w-full font-body" style={{ backgroundColor: '#f1f5f9' }}>

      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col text-white" style={{ backgroundColor: t.bg }}>

        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: t.accent }}>
              <HeartPulse size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-base leading-tight">Smart Clinic</h1>
              <p className="text-xs text-white/50">Management System</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-auto">
          {NAV.map(({ id, label, icon: Icon, badge }) => {
            const active = activeNav === id;
            return (
              <button
                key={id}
                onClick={() => setActiveNav(id)}
                className={`sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                  active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-white/20 text-white/80">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 pb-1">
            <p className="text-[10px] uppercase font-bold text-white/30 tracking-widest px-3 mb-2">Coming Soon</p>
          </div>
          {DISABLED_NAV.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/25 cursor-not-allowed select-none">
              <Icon size={18} />
              {label}
            </div>
          ))}
        </nav>

        {/* Theme Switcher */}
        <div className="px-3 py-3 border-t border-white/10 mb-1">
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
        <div className="p-4 border-t border-white/10">
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
            <button className="text-white/40 hover:text-white transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">

        {/* Sticky header */}
        <header
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between shrink-0"
          style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}
        >
          <div>
            <h2 className="font-heading font-bold text-xl" style={{ color: t.bg }}>
              {PAGE_TITLE[activeNav]}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {usingMock ? (
                <span className="flex items-center gap-1 text-[11px] text-amber-500 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Mock Data
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Live
                </span>
              )}
              {dashData?.lastUpdated && (
                <span className="text-[11px] text-slate-400">· {dashData.lastUpdated}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date filters */}
            <div className="hidden md:flex items-center gap-2">
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

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหา..."
                className="pl-9 pr-4 py-2 rounded-xl text-sm border border-slate-200 bg-white focus:outline-none focus:ring-2 w-44"
                style={{ '--tw-ring-color': t.bg } as React.CSSProperties}
              />
            </div>

            {/* Refresh */}
            <button
              onClick={loadData} disabled={loading}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Bell */}
            <button className="relative p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
              <Bell size={18} className="text-slate-500" />
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold"
                style={{ backgroundColor: t.accent }}
              >3</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6">
          {loading && !dashData ? (
            <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
              <RefreshCw size={20} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : dashData ? (
            <>
              {activeNav === 'overview'    && <ExecutiveOverview data={dashData} theme={t} />}
              {activeNav === 'sales'       && <SalesAnalytics data={dashData} />}
              {activeNav === 'customers'   && <CustomerInsights data={dashData} />}
              {activeNav === 'crm'         && <CrmInsights />}
              {activeNav === 'promotions'  && <PromotionsManager />}
              {activeNav === 'predictive'  && <PredictiveDashboard />}
            </>
          ) : (
            <div className="text-center text-slate-400 mt-20">ไม่สามารถโหลดข้อมูลได้</div>
          )}
        </div>
      </main>
    </div>
  );
}
