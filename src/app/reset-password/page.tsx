'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { HeartPulse, Eye, EyeOff, CheckCircle, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Supabase sends the token via URL hash; the SDK picks it up automatically
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // session is set — user can now update password
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('รหัสผ่านไม่ตรงกัน'); return; }
    if (password.length < 8)  { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) { setError('ไม่สามารถรีเซ็ตรหัสผ่านได้ กรุณาขอลิงก์ใหม่อีกครั้ง'); return; }
    setDone(true);
    setTimeout(() => router.push('/dashboard'), 2500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F4F0] p-6">
      <div className="w-full max-w-[400px]">

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'linear-gradient(135deg, #0f4c5c, #1a6b7a)' }}>
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          <p className="text-base font-semibold text-slate-800">Smart Clinic</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">รีเซ็ตสำเร็จ!</h2>
              <p className="text-sm text-slate-500">กำลังพาไปหน้า Dashboard...</p>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">ตั้งรหัสผ่านใหม่</h1>
                <p className="text-sm text-slate-400">กรอกรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร</p>
              </div>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่านใหม่</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required minLength={8}
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c] transition bg-slate-50 focus:bg-white"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">ยืนยันรหัสผ่าน</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c] transition bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold transition disabled:opacity-60"
                  style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0f4c5c, #1a6b7a)' }}
                >
                  {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Smart Clinic © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
