import { NextRequest, NextResponse } from 'next/server';
import { claudeComplete } from '@/lib/claude';
import { supabaseAdmin } from '@/lib/supabase';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

// POST /api/ai-summary
export async function POST(_req: NextRequest) {
  try {
    // ดึงข้อมูลเดือนนี้
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [{ data: visits }, { data: patients }] = await Promise.all([
      supabaseAdmin.from('visits').select('treatment_name, price, sales_name, doctor, payment_method, customer_type, created_at')
        .eq('clinic_id', CLINIC_ID).gte('created_at', startOfMonth).limit(500),
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

    // Payment method breakdown
    const payMap: Record<string, number> = {};
    for (const v of vList) {
      const m = v.payment_method || 'ไม่ระบุ';
      payMap[m] = (payMap[m] || 0) + 1;
    }
    const paySummary = Object.entries(payMap)
      .map(([m, c]) => `${m}: ${c} ครั้ง`)
      .join(', ');

    // Customer type
    const newCount = vList.filter(v => v.customer_type === 'new').length;
    const retCount = totalVisits - newCount;

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

=== การชำระเงิน ===
${paySummary || 'ไม่มีข้อมูล'}

วิเคราะห์ 3 ด้าน ใช้ตัวเลขด้านบนโดยตรง ห้ามคำนวณใหม่ ตอบเป็น JSON เท่านั้น:
1. Sales Performance - สรุปยอดขาย เซลล์ไหนทำได้ดี ต้องเพิ่มอีกเท่าไหร่
2. Retention Drop-off - ลูกค้าใหม่ vs เก่า แนะนำ re-booking
3. Payment Logistics - สัดส่วนการชำระเงิน average ticket size

รูปแบบ JSON:
{
  "insights": [
    {"title": "SALES PERFORMANCE", "body": "สรุปสั้นๆ 2-3 bullet", "color": "blue"},
    {"title": "RETENTION DROP-OFF", "body": "สรุปสั้นๆ 2-3 bullet", "color": "green"},
    {"title": "PAYMENT LOGISTICS", "body": "สรุปสั้นๆ 2-3 bullet", "color": "amber"}
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
