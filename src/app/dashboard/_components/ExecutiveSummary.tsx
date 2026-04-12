'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, AlertCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRIMARY = '#0f4c5c';

type Insight = { title: string; body: string; color: 'blue' | 'green' | 'amber' };
type AiData  = { insights: Insight[]; focusItems: string[] };

// ปรับ color map เป็น teal/green/amber แทน blue/green/amber
const COLOR = {
  blue:  { box: 'bg-teal-50 border-teal-200',  title: 'text-teal-800',  body: 'text-teal-700'  },
  green: { box: 'bg-green-50 border-green-200', title: 'text-green-800', body: 'text-green-700' },
  amber: { box: 'bg-amber-50 border-amber-200', title: 'text-amber-800', body: 'text-amber-700' },
};

function formatText(text: any) {
  const s = String(text ?? '');
  return {
    __html: s
      .replace(/\n/g, '<br/>')
      .replace(/ • /g, '<br/>• ')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold">$1</strong>'),
  };
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 animate-pulse">
          <div className="h-3 w-24 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-full bg-slate-200 rounded mb-1" />
          <div className="h-3 w-3/4 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function ExecutiveSummary() {
  const [aiData, setAiData] = useState<AiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const fetched = useRef(false);

  function lsGet(key: string) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function lsSet(key: string, val: string) {
    try { localStorage.setItem(key, val); } catch { /* ignore */ }
  }

  function shouldRefetch() {
    const lastStr = lsGet('ai_summary_time');
    if (!lastStr) return true;
    const today7am = new Date(); today7am.setHours(7, 0, 0, 0);
    if (new Date() < today7am) today7am.setDate(today7am.getDate() - 1);
    return new Date(parseInt(lastStr)) < today7am;
  }

  async function fetchSummary(force = false) {
    if (loading) return;
    setLoading(true); setError(null);
    try {
      if (!force && !shouldRefetch()) {
        const cached = lsGet('ai_summary_data');
        if (cached) { setAiData(JSON.parse(cached)); setLoading(false); return; }
      }
      const res  = await fetch('/api/ai-summary', { method: 'POST', signal: AbortSignal.timeout(25000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setAiData(data);
      lsSet('ai_summary_data', JSON.stringify(data));
      lsSet('ai_summary_time', Date.now().toString());
    } catch (e: any) {
      setError(e.name === 'TimeoutError' ? 'AI ใช้เวลานานเกินไป กรุณาลองใหม่' : 'ไม่สามารถวิเคราะห์ข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!fetched.current) { fetched.current = true; fetchSummary(); }
    return () => { fetched.current = false; };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: PRIMARY }} />
          <h2 className="text-sm font-heading font-semibold text-slate-700">Executive Summary</h2>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: '#E6F4F4', color: PRIMARY }}>AI</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchSummary(true)} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Insights */}
      <div className="space-y-3 mb-6">
        {loading && !aiData ? <Skeleton /> : error ? (
          <div className="flex flex-col gap-3 text-sm bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="flex items-center gap-2 text-red-600 font-medium">
              <AlertCircle size={16} /> {error}
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchSummary(true)} className="self-start h-8 text-xs">ลองใหม่</Button>
          </div>
        ) : (
          (aiData?.insights ?? []).map((item, i) => (
            <div key={i} className={`rounded-xl border p-3.5 ${COLOR[item.color].box}`}>
              <p className={`text-xs font-bold mb-2 uppercase tracking-tight ${COLOR[item.color].title}`}>{item.title}</p>
              <p className={`text-[13px] leading-relaxed font-medium ${COLOR[item.color].body}`}
                dangerouslySetInnerHTML={formatText(item.body)} />
            </div>
          ))
        )}
      </div>

      {/* Today's Focus */}
      <div className="mt-auto pt-4 border-t border-slate-100">
        <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-3">Today's Focus</p>
        {loading && !aiData ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
            ))}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {(aiData?.focusItems ?? []).map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] font-medium leading-snug">
                <Circle size={6} className="mt-1.5 flex-shrink-0" style={{ fill: PRIMARY, color: PRIMARY }} />
                <span dangerouslySetInnerHTML={formatText(item)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
