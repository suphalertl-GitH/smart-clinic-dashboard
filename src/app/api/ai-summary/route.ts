import { NextRequest, NextResponse } from 'next/server';
import { claudeComplete } from '@/lib/claude';
import { supabaseAdmin } from '@/lib/supabase';
import { requireFeature } from '@/lib/tier';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// POST /api/ai-summary
export async function POST(_req: NextRequest) {
  const gate = await requireFeature(CLINIC_ID, 'ai_summary');
  if (gate) return gate;
  try {
    // ดึงข้อมูลเดือนนี้
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    // Bangkok UTC+7 → start of month in UTC = day 1 at 17:00 previous day UTC
    const startOfMonthBkk = new Date(now.getFullYear(), now.getMonth(), 1); // midnight Bangkok
    const startOfMonthUTC = new Date(startOfMonthBkk.getTime() - 7 * 60 * 60 * 1000); // convert to UTC

    const [{ data: visits }, { data: patients }] = await Promise.all([
      supabaseAdmin.from('visits').select('hn, treatment_name, price, sales_name, doctor, payment_method, customer_type, created_at')
        .eq('clinic_id', CLINIC_ID).gte('created_at', startOfMonthUTC.toISOString()).limit(500),
      supabaseAdmin.from('patients').select('source, sales_name, created_at')
        .eq('clinic_id', CLINIC_ID).limit(500),
    ]);

    // ── Pre-compute stats so AI doesn't have to calculate ──
    const vList = visits ?? [];
    const totalRevenue = vList.reduce((s, v) => s + (parseFloat(String(v.price)) || 0), 0);
    const totalVisits = vList.length;
    const avgTicket = totalVisits > 0 ? Math.round(totalRevenue / totalVisits) : 0;

    // Revenue by sales
    const salesMap: Record<string, { revenue: number; visits: number }> = {};
    for (const v of vList) {
      const name = v.sales_name || 'ไม่ระบุ';
      if (!salesMap[name]) salesMap[name] = { revenue: 0, visits: 0 };
      salesMap[name].revenue += parseFloat(String(v.price)) || 0;
      salesMap[name].visits++;
    }
    const salesSummary = Object.entries(salesMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([name, d]) => `${name}: ${d.revenue.toLocaleString()} บาท (${d.visits} visits)`)
      .join('\n');

    // Revenue by treatment
    const treatMap: Record<string, { revenue: number; visits: number }> = {};
    for (const v of vList) {
      const name = v.treatment_name || 'Other';
      if (!treatMap[name]) treatMap[name] = { revenue: 0, visits: 0 };
      treatMap[name].revenue += parseFloat(String(v.price)) || 0;
      treatMap[name].visits++;
    }
    const treatSummary = Object.entries(treatMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([name, d]) => `${name}: ${d.revenue.toLocaleString()} บาท (${d.visits} visits)`)
      .join('\n');

    // Revenue by doctor
    const docMap: Record<string, { revenue: number; visits: number }> = {};
    for (const v of vList) {
      const name = v.doctor || 'ไม่ระบุ';
      if (!docMap[name]) docMap[name] = { revenue: 0, visits: 0 };
      docMap[name].revenue += parseFloat(String(v.price)) || 0;
      docMap[name].visits++;
    }
    const docSummary = Object.entries(docMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([name, d]) => `${name}: ${d.revenue.toLocaleString()} บาท (${d.visits} visits)`)
      .join('\n');

    // Customer type
    const newCount = vList.filter(v => v.customer_type === 'new').length;
    const retCount = totalVisits - newCount;

    // Treatment bundle analysis — treatments done by the same HN in the same month
    const hnTreatMap: Record<string, Set<string>> = {};
    for (const v of vList) {
      const hn = v.hn || 'unknown';
      if (!hnTreatMap[hn]) hnTreatMap[hn] = new Set();
      if (v.treatment_name) hnTreatMap[hn].add(v.treatment_name);
    }
    // Count treatment pairs
    const pairMap: Record<string, number> = {};
    for (const treatments of Object.values(hnTreatMap)) {
      const arr = [...treatments];
      if (arr.length < 2) continue;
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const pair = [arr[i], arr[j]].sort().join(' + ');
          pairMap[pair] = (pairMap[pair] || 0) + 1;
        }
      }
    }
    const topPairs = Object.entries(pairMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pair, count]) => `${pair} (${count} ราย)`)
      .join('\n');

    // Single-treatment HNs — potential upsell targets
    const singleTreatHNs = Object.entries(hnTreatMap).filter(([, s]) => s.size === 1);
    const singleTreatCount = singleTreatHNs.length;
    // Top treatments among single-treatment customers
    const singleTreatFreq: Record<string, number> = {};
    for (const [, s] of singleTreatHNs) {
      const t = [...s][0];
      singleTreatFreq[t] = (singleTreatFreq[t] || 0) + 1;
    }
    const singleTreatTop = Object.entries(singleTreatFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, c]) => `${t} (${c} ราย)`)
      .join('\n');

    const prompt = `วิเคราะห์ข้อมูลคลินิกความงามพลอยใสประจำเดือนนี้ (ตัวเลขคำนวณแล้ว ห้ามคำนวณเอง):

=== สรุปยอดขาย ===
ยอดขายรวม: ${totalRevenue.toLocaleString()} บาท
จำนวน Visit: ${totalVisits} ครั้ง
Average Ticket: ${avgTicket.toLocaleString()} บาท
ลูกค้าใหม่: ${newCount} | ลูกค้าเก่า: ${retCount}
เป้ายอดขาย: 3,600,000 บาท/เดือน
สัดส่วนเป้า: ${((totalRevenue / 3600000) * 100).toFixed(1)}%

=== ยอดขายตามเซลล์ ===
${salesSummary || 'ไม่มีข้อมูล'}

=== ยอดขายตาม Treatment (Top 10) ===
${treatSummary || 'ไม่มีข้อมูล'}

=== ยอดขายตามแพทย์ ===
${docSummary || 'ไม่มีข้อมูล'}

=== Treatment Bundles ที่ลูกค้าทำคู่กันบ่อย ===
${topPairs || 'ไม่มีข้อมูล'}

=== ลูกค้าที่ทำ Treatment เดียว (โอกาส Upsell) ===
จำนวน: ${singleTreatCount} ราย
Treatment หลักที่ทำ:
${singleTreatTop || 'ไม่มีข้อมูล'}

วิเคราะห์ 3 ด้าน ใช้ตัวเลขด้านบนโดยตรง ห้ามคำนวณใหม่ ตอบเป็น JSON เท่านั้น:
1. Sales Performance - สรุปยอดขาย เซลล์ไหนทำได้ดี ต้องเพิ่มอีกเท่าไหร่
2. Retention Drop-off - ลูกค้าใหม่ vs เก่า แนะนำ re-booking
3. Upsell Opportunities - อ้างอิงจาก bundle ที่ทำคู่กันบ่อย + ลูกค้า single-treatment แนะนำว่าควร offer อะไรเพิ่ม เพื่อเพิ่มยอดต่อ visit

รูปแบบ JSON:
{
  "insights": [
    {"title": "SALES PERFORMANCE", "body": "สรุปสั้นๆ 2-3 bullet", "color": "blue"},
    {"title": "RETENTION DROP-OFF", "body": "สรุปสั้นๆ 2-3 bullet", "color": "green"},
    {"title": "UPSELL OPPORTUNITIES", "body": "สรุปสั้นๆ 2-3 bullet อ้างอิงจาก bundle จริง", "color": "amber"}
  ],
  "focusItems": ["สิ่งที่ต้องทำ 1", "สิ่งที่ต้องทำ 2", "สิ่งที่ต้องทำ 3"]
}`;

    const text = await claudeComplete(prompt);

    // Parse JSON from Claude response — sanitize control characters first
    const sanitized = text.replace(/[\x00-\x1F\x7F]/g, (ch) =>
      ch === '\n' || ch === '\r' || ch === '\t' ? ch : ' '
    );
    const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude ไม่ส่ง JSON กลับมา');
    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      insights: (parsed.insights ?? []).slice(0, 3),
      focusItems: (parsed.focusItems ?? []).slice(0, 4),
    });
  } catch (err: any) {
    // Fallback graceful error
    return NextResponse.json({
      insights: [{ title: 'ไม่สามารถวิเคราะห์ได้', body: err.message, color: 'amber' }],
      focusItems: [],
    });
  }
}
