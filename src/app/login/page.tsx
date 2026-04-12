'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { HeartPulse, Eye, EyeOff, Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react';

type Mode = 'login' | 'forgot';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  function redirectByRole(role?: string) {
    router.replace(role === 'super_admin' ? '/admin' : '/dashboard');
  }

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectByRole(data.session.user.user_metadata?.role);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    redirectByRole(data.user?.user_metadata?.role);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError('ไม่พบอีเมลนี้ในระบบ');
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="min-h-screen flex bg-[#F5F4F0]">

      {/* ── Left panel (branding) — hidden on mobile ── */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[48%] relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0f4c5c 0%, #1a6b7a 55%, #2d8c9e 100%)' }}>

        {/* decorative circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
        <div className="absolute bottom-10 -right-16 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">Smart Clinic</span>
          </div>

          {/* Main copy */}
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">
              ระบบจัดการคลินิก<br />ครบวงจร
            </h2>
            <p className="text-white/70 text-base leading-relaxed mb-8">
              วิเคราะห์ยอดขาย ติดตามลูกค้า<br />
              และบริหารนัดหมายในที่เดียว
            </p>

            {/* Feature list */}
            <div className="space-y-3">
              {[
                'Dashboard & Sales Analytics',
                'CRM & Customer Insights',
                'AI Executive Summary',
                'Clinic Ops & Appointment Heatmap',
              ].map(f => (
                <div key={f} className="flex items-center gap-2.5 text-white/80 text-sm">
                  <CheckCircle className="w-4 h-4 text-[#7dcfe0] shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/40 text-xs">Smart Clinic © {new Date().getFullYear()}</p>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #0f4c5c, #1a6b7a)' }}>
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <p className="text-base font-semibold text-slate-800">Smart Clinic</p>
          </div>

          {/* ── Login form ── */}
          {mode === 'login' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">เข้าสู่ระบบ</h1>
                <p className="text-sm text-slate-400">สำหรับผู้ดูแลและทีมงานคลินิก</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">อีเมล</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="admin@clinic.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c] transition bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่าน</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c] transition bg-slate-50 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); }}
                      className="text-xs text-[#0f4c5c] hover:underline">
                      ลืมรหัสผ่าน?
                    </button>
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
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-60 mt-2"
                  style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0f4c5c, #1a6b7a)' }}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      กำลังเข้าสู่ระบบ...
                    </span>
                  ) : (
                    <>เข้าสู่ระบบ <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ── Forgot password form ── */}
          {mode === 'forgot' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              {resetSent ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 mb-2">ส่งลิงก์แล้ว!</h2>
                  <p className="text-sm text-slate-500 mb-6">
                    กรุณาตรวจสอบอีเมล <span className="font-medium text-slate-700">{email}</span><br />
                    แล้วคลิกลิงก์เพื่อรีเซ็ตรหัสผ่าน
                  </p>
                  <button onClick={() => { setMode('login'); setResetSent(false); }}
                    className="text-sm text-[#0f4c5c] font-medium hover:underline">
                    ← กลับไปหน้าเข้าสู่ระบบ
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-7">
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">ลืมรหัสผ่าน</h1>
                    <p className="text-sm text-slate-400">ระบบจะส่งลิงก์รีเซ็ตไปยังอีเมลของคุณ</p>
                  </div>

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">อีเมล</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          autoComplete="email"
                          placeholder="admin@clinic.com"
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
                      className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-60"
                      style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0f4c5c, #1a6b7a)' }}
                    >
                      {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}
                    </button>

                    <button type="button" onClick={() => { setMode('login'); setError(''); }}
                      className="w-full text-sm text-slate-400 hover:text-slate-600 transition mt-1">
                      ← กลับไปหน้าเข้าสู่ระบบ
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          <p className="text-center text-xs text-slate-400 mt-6">
            Smart Clinic © {new Date().getFullYear()} · Powered by Supabase
          </p>
        </div>
      </div>

    </div>
  );
}
