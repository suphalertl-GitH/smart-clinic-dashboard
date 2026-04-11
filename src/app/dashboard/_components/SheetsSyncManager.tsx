'use client';

import { useState } from 'react';
import { RefreshCw, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, CheckCircle2, XCircle, Loader2, Sheet } from 'lucide-react';

type SyncResult = {
  success: boolean;
  direction: string;
  stats: any;
  error?: string;
};

export default function SheetsSyncManager() {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [connection, setConnection] = useState<{ ok: boolean; title?: string; error?: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  async function doSync(direction: string) {
    setLoading(true);
    setAction(direction);
    setResult(null);
    try {
      const res = await fetch('/api/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setResult(data);
    } catch (err: any) {
      setResult({ success: false, direction, stats: null, error: err.message });
    } finally {
      setLoading(false);
      setAction('');
    }
  }

  async function testConn() {
    setTestingConnection(true);
    setConnection(null);
    try {
      const res = await fetch('/api/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'test' }),
      });
      const data = await res.json();
      setConnection(data);
    } catch (err: any) {
      setConnection({ ok: false, error: err.message });
    } finally {
      setTestingConnection(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Sheet size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Google Sheets Connection</h3>
              <p className="text-xs text-slate-400">เชื่อมต่อกับ Google Sheets เดิม</p>
            </div>
          </div>
          <button
            onClick={testConn}
            disabled={testingConnection}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
          >
            {testingConnection ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            ทดสอบการเชื่อมต่อ
          </button>
        </div>

        {connection && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
            connection.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {connection.ok ? (
              <>
                <CheckCircle2 size={16} />
                <span>เชื่อมต่อสำเร็จ — <strong>{connection.title}</strong></span>
              </>
            ) : (
              <>
                <XCircle size={16} />
                <span>เชื่อมต่อไม่สำเร็จ: {connection.error}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sync Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sheets → Supabase */}
        <button
          onClick={() => doSync('sheets-to-supabase')}
          disabled={loading}
          className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition-all text-left group disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
            <ArrowDownToLine size={22} className="text-blue-600" />
          </div>
          <h4 className="font-semibold text-slate-800 mb-1">Sheets → Supabase</h4>
          <p className="text-xs text-slate-400">นำเข้าข้อมูลจาก Google Sheets เข้า Supabase</p>
          {loading && action === 'sheets-to-supabase' && (
            <div className="mt-3 flex items-center gap-2 text-blue-600 text-xs">
              <Loader2 size={14} className="animate-spin" /> กำลัง sync...
            </div>
          )}
        </button>

        {/* Supabase → Sheets */}
        <button
          onClick={() => doSync('supabase-to-sheets')}
          disabled={loading}
          className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-emerald-300 hover:shadow-md transition-all text-left group disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
            <ArrowUpFromLine size={22} className="text-emerald-600" />
          </div>
          <h4 className="font-semibold text-slate-800 mb-1">Supabase → Sheets</h4>
          <p className="text-xs text-slate-400">ส่งออกข้อมูลจาก Supabase ไป Google Sheets</p>
          {loading && action === 'supabase-to-sheets' && (
            <div className="mt-3 flex items-center gap-2 text-emerald-600 text-xs">
              <Loader2 size={14} className="animate-spin" /> กำลัง sync...
            </div>
          )}
        </button>

        {/* Two-way Sync */}
        <button
          onClick={() => doSync('two-way')}
          disabled={loading}
          className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-amber-300 hover:shadow-md transition-all text-left group disabled:opacity-50"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4 group-hover:bg-amber-200 transition-colors">
            <ArrowLeftRight size={22} className="text-amber-600" />
          </div>
          <h4 className="font-semibold text-slate-800 mb-1">Sync ทั้ง 2 ทาง</h4>
          <p className="text-xs text-slate-400">Merge ข้อมูลทั้ง 2 ฝั่งให้ตรงกัน</p>
          {loading && action === 'two-way' && (
            <div className="mt-3 flex items-center gap-2 text-amber-600 text-xs">
              <Loader2 size={14} className="animate-spin" /> กำลัง sync...
            </div>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className={`bg-white rounded-2xl border p-6 ${
          result.success ? 'border-emerald-200' : 'border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-4">
            {result.success ? (
              <CheckCircle2 size={20} className="text-emerald-500" />
            ) : (
              <XCircle size={20} className="text-red-500" />
            )}
            <h4 className="font-semibold text-slate-800">
              {result.success ? 'Sync สำเร็จ!' : 'Sync ล้มเหลว'}
            </h4>
          </div>

          {result.error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{result.error}</p>
          )}

          {result.success && result.stats && (
            <div className="space-y-3">
              {result.direction === 'two-way' ? (
                <>
                  <div className="text-sm text-slate-600">
                    <p className="font-medium mb-1">Import (Sheets → Supabase):</p>
                    <div className="flex gap-4 text-xs ml-2">
                      <span className="text-emerald-600">+{result.stats.import?.patients?.added ?? 0} patients added</span>
                      <span className="text-blue-600">{result.stats.import?.patients?.updated ?? 0} updated</span>
                      <span className="text-slate-400">{result.stats.import?.patients?.skipped ?? 0} skipped</span>
                    </div>
                    <div className="flex gap-4 text-xs ml-2 mt-1">
                      <span className="text-emerald-600">+{result.stats.import?.visits?.added ?? 0} visits added</span>
                      <span className="text-blue-600">{result.stats.import?.visits?.updated ?? 0} updated</span>
                      <span className="text-slate-400">{result.stats.import?.visits?.skipped ?? 0} skipped</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p className="font-medium mb-1">Export (Supabase → Sheets):</p>
                    <div className="flex gap-4 text-xs ml-2">
                      <span className="text-emerald-600">{result.stats.export?.patients?.written ?? 0} patients written</span>
                      <span className="text-emerald-600">{result.stats.export?.visits?.written ?? 0} visits written</span>
                    </div>
                  </div>
                </>
              ) : result.direction === 'sheets-to-supabase' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-2">Patients</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-emerald-600">+{result.stats.patients?.added ?? 0} เพิ่มใหม่</p>
                      <p className="text-blue-600">{result.stats.patients?.updated ?? 0} อัปเดต</p>
                      <p className="text-slate-400">{result.stats.patients?.skipped ?? 0} ข้าม</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-2">Visits</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-emerald-600">+{result.stats.visits?.added ?? 0} เพิ่มใหม่</p>
                      <p className="text-blue-600">{result.stats.visits?.updated ?? 0} อัปเดต</p>
                      <p className="text-slate-400">{result.stats.visits?.skipped ?? 0} ข้าม</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-2">Patients</p>
                    <p className="text-lg font-bold text-emerald-600">{result.stats.patients?.written ?? 0} rows</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-2">Visits</p>
                    <p className="text-lg font-bold text-emerald-600">{result.stats.visits?.written ?? 0} rows</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-slate-50 rounded-2xl p-5 text-xs text-slate-500 space-y-2">
        <p className="font-semibold text-slate-600">Column Mapping:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="font-medium text-slate-600 mb-1">PatientDataGAS → patients</p>
            <p>HN, ชื่อ-นามสกุล, เบอร์โทร, ประวัติแพ้ยา, โรคประจำตัว, Source, Sales_Name</p>
          </div>
          <div>
            <p className="font-medium text-slate-600 mb-1">VisitData → visits</p>
            <p>HN, Treatment, ราคา, หมอ, Sales, Customer Type, Payment, นัดหมาย</p>
          </div>
        </div>
      </div>
    </div>
  );
}
