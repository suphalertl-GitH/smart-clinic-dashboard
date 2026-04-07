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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-200">
            <Activity size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight tracking-tight">Smart Clinic</p>
            <p className="text-[10px] text-gray-400 leading-tight">Business Intelligence</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = activeNav === id;
            return (
              <button
                key={id}
                onClick={() => setActiveNav(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <Icon size={16} className={active ? 'text-blue-600' : 'text-gray-400'} />
                {label}
                {active && <ChevronRight size={13} className="ml-auto text-blue-400" />}
              </button>
            );
          })}

          <div className="pt-3 pb-1 px-3">
            <p className="text-[10px] uppercase font-semibold text-gray-300 tracking-wider">Coming Soon</p>
          </div>
          {DISABLED_NAV.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 cursor-not-allowed select-none">
              <Icon size={16} className="text-gray-200" />
              {label}
            </div>
          ))}
        </nav>

        {/* Plan badge */}
        <div className="p-4">
          <div className="bg-gray-900 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Current Plan</p>
            <p className="text-sm font-bold text-white mb-3">Starter</p>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <Zap size={12} /> Upgrade
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 className="text-base font-bold text-gray-800">{activeLabel}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {usingMock ? (
                <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Mock Data
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Live
                </span>
              )}
              {dashData?.lastUpdated && (
                <span className="text-[11px] text-gray-400">· {dashData.lastUpdated}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date filter */}
            <div className="flex items-center gap-2">
              <input
                type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-gray-50 focus:outline-none focus:border-blue-400"
              />
              <span className="text-gray-300 text-xs">–</span>
              <input
                type="date" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-gray-50 focus:outline-none focus:border-blue-400"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >✕</button>
              )}
            </div>

            <Button
              variant="outline" size="sm"
              onClick={loadData} disabled={loading}
              className="h-8 text-xs gap-1.5 text-gray-600 border-gray-200"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {loading && !dashData ? (
            <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
              <RefreshCw size={20} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : dashData ? (
            <>
              {activeNav === 'overview' && <ExecutiveOverview data={dashData} />}
              {activeNav === 'sales' && <SalesAnalytics data={dashData} />}
              {activeNav === 'customers' && <CustomerInsights data={dashData} />}
            </>
          ) : (
            <div className="text-center text-gray-400 mt-20">ไม่สามารถโหลดข้อมูลได้</div>
          )}
        </main>
      </div>
    </div>
  );
}
