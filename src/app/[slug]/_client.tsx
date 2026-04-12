'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { HeartPulse, Eye, EyeOff, Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react';

type Clinic = { id: string; name: string; slug: string };

export default function ClinicLoginClient({ clinic }: { clinic: Clinic }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetSent, setResetSent] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      const role = data.session.user.user_metadata?.role;
      if (role !== 'super_admin') router.replace('/dashboard');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    if (data.user?.user_metadata?.role === 'super_admin') {
      await supabase.auth.signOut();
      setError('กรุณาเข้าสู่ระบบผ่านหน้า Admin');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) { setError('ไม่พบอีเมลนี้ในระบบ'); return; }
    setResetSent(true);
  }

  const initials = clinic.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#F5F4F0]">

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[48%] flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0f4c5c 0%, #1a6b7a 55%, #2d8c9e 100%)' }}>
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
        <div className="absolute bottom-10 -right-16 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />

        <div className="relative z-10 flex flex-col justify-between p-12 h-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="text-white/70 text-sm font-medium">Smart Clinic</span>
          </div>

          <div>
            {/* Clinic avatar */}
            <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center text-3xl font-bold text-white mb-6 border-2 border-white/30">
              {initials}
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">
              {clinic.name}
            </h2>
            <p className="text-white/60 text-base">
              ระบบจัดการคลินิก<br />เข้าสู่ระบบเพื่อดูข้อมูลของคุณ
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              {['Dashboard', 'CRM', 'Analytics', 'Appointments'].map(f => (
                <span key={f} className="text-xs bg-white/10 text-white/70 px-3 py-1 rounded-full border border-white/20">
                  {f}
                </span>
              ))}
            </div>
          </div>

          <p className="text-white/30 text-xs">Powered by Smart Clinic © {new Date().getFullYear()}</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          {/* Mobile clinic name */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-[#0f4c5c] flex items-center justify-center text-2xl font-bold text-white mx-auto mb-3">
              {initials}
            </div>
            <p className="font-bold text-slate-800 text-lg">{clinic.name}</p>
            <p className="text-xs text-slate-400 mt-1">Powered by Smart Clinic</p>
          </div>

          {/* Login form */}
          {mode === 'login' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">เข้าสู่ระบบ</h1>
                <p className="text-sm text-slate-400">สำหรับทีมงาน{clinic.name}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">อีเมล</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      required autoComplete="email" placeholder="staff@clinic.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c] transition bg-slate-50 focus:bg-white" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">รหัสผ่าน</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      required autoComplete="current-password" placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c] transition bg-slate-50 focus:bg-white" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); }}
                      className="text-xs text-[#0f4c5c] hover:underline">ลืมรหัสผ่าน?</button>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-60"
                  style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0f4c5c, #1a6b7a)' }}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      กำลังเข้าสู่ระบบ...
                    </span>
                  ) : <><span>เข้าสู่ระบบ</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </div>
          )}

          {/* Forgot password */}
          {mode === 'forgot' && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              {resetSent ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 mb-2">ส่งลิงก์แล้ว!</h2>
                  <p className="text-sm text-slate-500 mb-6">ตรวจสอบอีเมล <span className="font-medium">{email}</span></p>
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
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                          required autoComplete="email" placeholder="staff@clinic.com"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-[#0f4c5c]/20 focus:border-[#0f4c5c] transition bg-slate-50 focus:bg-white" />
                      </div>
                    </div>
                    {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>}
                    <button type="submit" disabled={loading}
                      className="w-full py-3 rounded-xl text-white text-sm font-semibold transition disabled:opacity-60"
                      style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0f4c5c, #1a6b7a)' }}>
                      {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}
                    </button>
                    <button type="button" onClick={() => { setMode('login'); setError(''); }}
                      className="w-full text-sm text-slate-400 hover:text-slate-600 transition">
                      ← กลับ
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          <p className="text-center text-xs text-slate-400 mt-6">
            Powered by Smart Clinic © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
