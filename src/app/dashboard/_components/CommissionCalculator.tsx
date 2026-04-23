'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Save, TrendingUp } from 'lucide-react';

type Row = {
  sales_name: string;
  visits: number;
  revenue: number;
  rate: number;
  commission: number;
};

type ApiData = {
  month: string;
  rows: Row[];
  totals: { revenue: number; commission: number };
};

function fmt(n: number) { return n.toLocaleString('th-TH'); }

export default function CommissionCalculator() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/commissions?month=${month}`);
      const json: ApiData = await res.json();
      setData(json);
      const init: Record<string, string> = {};
      for (const r of json.rows) init[r.sales_name] = String(r.rate);
      setRates(init);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    const body = Object.entries(rates).map(([sales_name, rate]) => ({
      sales_name,
      rate: parseFloat(rate) || 0,
    }));
    await fetch('/api/commissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  // คำนวณ commission แบบ live จาก rate ที่แก้ไขอยู่
  function liveCommission(row: Row) {
    const r = parseFloat(rates[row.sales_name] ?? '0') || 0;
    return Math.round((row.revenue * r) / 100);
  }
  function liveTotalCommission() {
    return (data?.rows ?? []).reduce((acc, row) => acc + liveCommission(row), 0);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Commission Calculator</h2>
          <p className="text-sm text-slate-500 mt-0.5">คำนวณค่าคอมมิชชั่นรายเดือนต่อพนักงานขาย</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-teal-400"
          />
          <button onClick={load} disabled={loading} className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50">
            <RefreshCw size={15} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">ยอดขายรวม</p>
            <p className="text-2xl font-bold text-slate-800">฿{fmt(data.totals.revenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">คอมมิชชั่นรวม (live)</p>
            <p className="text-2xl font-bold text-teal-600">฿{fmt(liveTotalCommission())}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-slate-500 mb-1">จำนวนพนักงานขาย</p>
            <p className="text-2xl font-bold text-slate-800">{data.rows.length} คน</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <TrendingUp size={16} className="text-teal-500" />
            รายละเอียดรายบุคคล
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: saved ? '#059669' : '#0f4c5c' }}
          >
            <Save size={14} />
            {saved ? 'บันทึกแล้ว ✓' : saving ? 'กำลังบันทึก...' : 'บันทึก Rate'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-slate-400 gap-2">
            <RefreshCw size={16} className="animate-spin" /> กำลังโหลด...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3">พนักงานขาย</th>
                  <th className="text-right px-4 py-3">visits</th>
                  <th className="text-right px-4 py-3">ยอดขาย</th>
                  <th className="text-center px-4 py-3">Rate (%)</th>
                  <th className="text-right px-5 py-3">คอมมิชชั่น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.rows ?? []).map(row => (
                  <tr key={row.sales_name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-800">{row.sales_name}</td>
                    <td className="px-4 py-3.5 text-right text-slate-600">{row.visits}</td>
                    <td className="px-4 py-3.5 text-right text-slate-700">฿{fmt(row.revenue)}</td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={rates[row.sales_name] ?? '0'}
                          onChange={e => setRates(prev => ({ ...prev, [row.sales_name]: e.target.value }))}
                          className="w-16 text-center border border-slate-200 rounded-lg py-1 text-sm focus:outline-none focus:border-teal-400"
                        />
                        <span className="text-slate-400 text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-teal-700">
                      ฿{fmt(liveCommission(row))}
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                {data && data.rows.length > 0 && (
                  <tr className="bg-slate-50 font-semibold text-slate-800">
                    <td className="px-5 py-3.5" colSpan={2}>รวมทั้งหมด</td>
                    <td className="px-4 py-3.5 text-right">฿{fmt(data.totals.revenue)}</td>
                    <td className="px-4 py-3.5" />
                    <td className="px-5 py-3.5 text-right text-teal-700">฿{fmt(liveTotalCommission())}</td>
                  </tr>
                )}
                {data?.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      ไม่มีข้อมูลยอดขายในเดือนนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        * แก้ไข Rate (%) แล้วกด &ldquo;บันทึก Rate&rdquo; เพื่อบันทึก — ค่าคอมมิชชั่นจะอัปเดตทันที
      </p>
    </div>
  );
}
