'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center h-full min-h-screen bg-slate-50">
      <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md w-full mx-4 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} className="text-red-500" />
        </div>
        <h2 className="font-bold text-slate-800 text-lg mb-2">เกิดข้อผิดพลาด</h2>
        <p className="text-sm text-slate-500 mb-6">
          {error.message || 'ไม่สามารถโหลดแดชบอร์ดได้ กรุณาลองใหม่'}
        </p>
        <button
          onClick={reset}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 transition-colors"
        >
          <RefreshCw size={14} /> ลองใหม่
        </button>
      </div>
    </div>
  );
}
