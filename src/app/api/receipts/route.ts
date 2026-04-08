import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { put } from '@vercel/blob';
import { pushMessage, textMessage } from '@/lib/line';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';

const CLINIC_INFO = {
  name: 'Ploysai Clinic',
  nameTh: 'พลอยใสคลินิก',
  address: '76/14 โครงการแพลทินัมเพลส ซ.รามคำแหง 178 เขตมีนบุรี กทม. 10510',
  phone: '065-553-9361',
};

function generateReceiptHtml(data: {
  hn: string; fullName: string; items: { name: string; price: number }[];
  total: number; payment: string; receiver: string; date: string;
}) {
  const itemsHtml = data.items.map((item, i) => `
    <tr style="border-bottom:1px solid #fce4ec;">
      <td style="padding:12px;text-align:center;color:#555;">${i + 1}</td>
      <td style="padding:12px;color:#555;">${item.name}</td>
      <td style="padding:12px;text-align:right;color:#333;">${Number(item.price).toLocaleString()}.-</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600&display=swap" rel="stylesheet">
    </head><body style="font-family:'Sarabun',sans-serif;background:#fff;margin:0;padding:20px;">
    <div style="width:650px;margin:auto;border-radius:15px;border:1px solid #fce4ec;overflow:hidden;">
      <div style="background:#fce4ec;padding:40px;">
        <table style="width:100%;border:none;"><tr>
          <td style="width:50%;">
            <h1 style="margin:0;font-size:32px;color:#333;">${CLINIC_INFO.name}</h1>
            <div style="font-size:14px;color:#555;letter-spacing:2px;">CLINIC</div>
          </td>
          <td style="width:50%;text-align:right;">
            <h2 style="margin:0;font-size:26px;color:#333;">ใบเสร็จรับเงิน</h2>
            <div style="font-size:14px;color:#555;">RECEIPT</div>
          </td>
        </tr></table>
      </div>
      <div style="padding:30px 40px;">
        <table style="width:100%;font-size:14px;color:#444;margin-bottom:30px;"><tr>
          <td style="width:50%;vertical-align:top;">
            <b style="color:#333;">ข้อมูลลูกค้า:</b><br>คุณ ${data.fullName}<br><b>HN:</b> ${data.hn}
          </td>
          <td style="width:50%;vertical-align:top;text-align:right;">
            <b style="color:#333;">${CLINIC_INFO.nameTh}</b><br>
            ${CLINIC_INFO.address}<br>
            <b>Tel:</b> ${CLINIC_INFO.phone}<br>
            <b>วันที่:</b> ${data.date}
          </td>
        </tr></table>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#f8bbd0;color:#333;">
            <th style="padding:10px;text-align:center;width:60px;">ลำดับ</th>
            <th style="padding:10px;text-align:left;">รายการ</th>
            <th style="padding:10px;text-align:right;width:120px;">ราคา</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="margin-top:20px;text-align:right;">
          <div style="display:inline-block;background:#fce4ec;padding:15px 30px;border-radius:8px;">
            <span style="color:#555;margin-right:20px;font-size:14px;">ราคารวมสุทธิ</span>
            <b style="color:#333;font-size:20px;">${data.total.toLocaleString()} บาท</b>
          </div>
        </div>
        <div style="margin-top:40px;font-size:14px;color:#555;">
          <p><b>วิธีชำระเงิน:</b> ${data.payment}</p>
          <div style="text-align:right;margin-top:10px;">
            <p>ผู้รับเงิน: ${data.receiver}</p>
            <p style="color:#bbb;font-size:12px;">(ลงชื่อพนักงาน)</p>
          </div>
        </div>
        <div style="margin-top:40px;text-align:center;color:#888;font-size:12px;font-style:italic;">
          " ${CLINIC_INFO.nameTh} ขอบคุณลูกค้าที่ใช้บริการ "
        </div>
      </div>
    </div></body></html>`;
}

// POST /api/receipts — สร้างใบเสร็จ PDF
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hn, fullName, items, total, payment, receiver, date, visitId, lineUserId } = body;

    if (!hn || !items || !receiver) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const html = generateReceiptHtml({ hn, fullName, items, total, payment, receiver, date });

    // บันทึก HTML ไว้ก่อน (PDF generation ต้องใช้ headless browser หรือ service)
    // ตอนนี้ save HTML ไปที่ Vercel Blob ก่อน
    const htmlBlob = await put(
      `receipts/${hn}_${date.replace(/\//g, '-')}_${Date.now()}.html`,
      html,
      { access: 'public', contentType: 'text/html' }
    );

    // บันทึก receipt record
    const { data: receipt, error } = await supabaseAdmin
      .from('receipts')
      .insert({
        clinic_id: CLINIC_ID,
        visit_id: visitId || null,
        hn,
        full_name: fullName,
        items,
        total,
        payment_method: payment,
        receiver,
        pdf_url: htmlBlob.url,
        date,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ส่งใบเสร็จ LINE ถ้ามี line_user_id
    if (lineUserId) {
      pushMessage(lineUserId, [
        textMessage(`🧾 ใบเสร็จรับเงิน\n👤 คุณ${fullName}\n💰 รวม ${Number(total).toLocaleString()} บาท\n📄 ดูใบเสร็จ: ${htmlBlob.url}`)
      ]).catch(() => {});
    }

    return NextResponse.json({ success: true, url: htmlBlob.url, receipt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/receipts?hn=HN00001&date=2024-01-01
export async function GET(req: NextRequest) {
  const hn = req.nextUrl.searchParams.get('hn');
  const date = req.nextUrl.searchParams.get('date');

  if (!hn) return NextResponse.json({ error: 'hn required' }, { status: 400 });

  let query = supabaseAdmin
    .from('receipts')
    .select('*')
    .eq('clinic_id', CLINIC_ID)
    .eq('hn', hn)
    .order('created_at', { ascending: false });

  if (date) query = query.eq('date', date);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
