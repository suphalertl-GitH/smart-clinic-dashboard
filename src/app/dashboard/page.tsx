'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, RefreshCw, LayoutDashboard, BarChart2,
  Users, Megaphone, Stethoscope, ChevronRight, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExecutiveOverview from './_components/ExecutiveOverview';
import SalesAnalytics from './_components/SalesAnalytics';
import CustomerInsights from './_components/CustomerInsights';
import { MOCK_DASHBOARD } from '@/lib/mock-dashboard';

type NavId = 'overview' | 'sales' | 'customers';

const NAV = [
  { id: 'overview' as NavId, label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'sales' as NavId, label: 'Sales Analytics', icon: BarChart2 },
  { id: 'customers' as NavId, label: 'Customer Insights', icon: Users },
];

const DISABLED_NAV = [
  { label: 'Marketing Perf', icon: Megaphone },
  { label: 'Clinic Ops', icon: Stethoscope },
];

export default function DashboardPage() {
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>('overview');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/dashboard?${params}`);
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

  const activeLabel = NAV.find(n => n.id === activeNav)?.label ?? '';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F5F4F0' }}>
      {/* ── Sidebar ── */}
      <aside className="w-60 flex flex-col shrink-0 bg-white border-r border-stone-200">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-stone-100">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#4F46E5' }}>
            <Activity size={17} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-black leading-tight tracking-tight text-stone-800">Smart Clinic</p>
            <p className="text-[10px] text-stone-400 leading-tight font-medium">Business Intelligence</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = activeNav === id;
            return (
              <button
                key={id}
                onClick={() => setActiveNav(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'text-white shadow-md'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                }`}
                style={active ? { background: '#4F46E5' } : {}}
              >
                <Icon size={16} className={active ? 'text-white' : 'text-stone-400'} />
                {label}
                {active && <ChevronRight size={13} className="ml-auto text-indigo-200" />}
              </button>
            );
          })}

          <div className="pt-4 pb-1 px-3">
            <p className="text-[10px] uppercase font-bold text-stone-300 tracking-widest">Coming Soon</p>
          </div>
          {DISABLED_NAV.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-300 cursor-not-allowed select-none">
              <Icon size={16} className="text-stone-200" />
              {label}
            </div>
          ))}
        </nav>

        {/* Plan badge */}
        <div className="p-4">
          <div className="rounded-2xl p-4" style={{ background: '#1E1B4B' }}>
            <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-bold mb-0.5">Current Plan</p>
            <p className="text-sm font-black text-white mb-3">Starter</p>
            <button className="w-full text-white text-xs font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5" style={{ background: '#4F46E5' }}>
              <Zap size={12} /> Upgrade
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 className="text-base font-black text-stone-800 tracking-tight">{activeLabel}</h1>
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
                <span className="text-[11px] text-stone-400">· {dashData.lastUpdated}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-600 bg-stone-50 focus:outline-none focus:border-indigo-400"
              />
              <span className="text-stone-300 text-xs">–</span>
              <input
                type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-600 bg-stone-50 focus:outline-none focus:border-indigo-400"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                >✕</button>
              )}
            </div>

            <Button
              variant="outline" size="sm"
              onClick={loadData} disabled={loading}
              className="h-8 text-xs gap-1.5 text-stone-600 border-stone-200 rounded-lg font-semibold"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {loading && !dashData ? (
            <div className="flex items-center justify-center h-64 text-stone-400 gap-2">
              <RefreshCw size={20} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : dashData ? (
            <>
              {activeNav === 'overview' && <ExecutiveOverview data={dashData} />}
              {activeNav === 'sales' && <SalesAnalytics data={dashData} />}
              {activeNav === 'customers' && <CustomerInsights data={dashData} />}
            </>
          ) : (
            <div className="text-center text-stone-400 mt-20">ไม่สามารถโหลดข้อมูลได้</div>
          )}
        </main>
      </div>
    </div>
  );
}
