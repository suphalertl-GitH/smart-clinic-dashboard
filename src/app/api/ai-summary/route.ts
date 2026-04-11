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

    const visitSummary = (visits ?? []).map(v =>
      `${v.treatment_name},${v.price},${v.sales_name},${v.doctor},${v.payment_method},${v.customer_type}`
    ).join('\n');

    const patientSummary = (patients ?? []).map(p => `${p.source},${p.sales_name}`).join('\n');

    const prompt = `วิเคราะห์ข้อมูลคลินิกความงามพลอยใสประจำเดือนนี้:

=== ข้อมูล Visit (treatment,price,sales,doctor,payment,type) ===
${visitSummary || 'ยังไม่มีข้อมูล'}

=== ข้อมูลผู้ป่วยใหม่ (source,sales) ===
${patientSummary || 'ยังไม่มีข้อมูล'}

เป้ายอดขาย: 3,600,000 บาท/เดือน

วิเคราะห์ 3 ด้านนี้ และตอบเป็น JSON เท่านั้น:
1. Sales Performance - ยอดขายแต่ละเซลล์เทียบเป้า
2. Retention Drop-off - จุดที่ลูกค้าหายไป แนะนำ re-booking
3. Payment Logistics - สัดส่วนการชำระเงิน และ average ticket size

รูปแบบ JSON:
{
  "insights": [
    {"title": "หัวข้อ", "body": "• **ข้อมูลสำคัญ**: ...\n• **ข้อมูล2**: ...", "color": "blue"},
    {"title": "หัวข้อ", "body": "...", "color": "green"},
    {"title": "หัวข้อ", "body": "...", "color": "amber"}
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
