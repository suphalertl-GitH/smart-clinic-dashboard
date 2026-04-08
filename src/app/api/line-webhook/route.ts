import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { claudeComplete } from '@/lib/claude';

const CLINIC_ID = 'a0000000-0000-0000-0000-000000000001';
const CLINIC = { name: 'พลอยใสคลินิก', phone: '065-553-9361' };
const LINE_REPLY_API = 'https://api.line.me/v2/bot/message/reply';
const LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';

const SYSTEM_PROMPT = `คุณคือ AI assistant ของ ${CLINIC.name} คลินิกความงาม
ตอบเป็นภาษาไทย กระชับ เป็นมิตร ไม่เกิน 3-4 ประโยค

ข้อมูลคลินิก:
- ชื่อ: ${CLINIC.name}
- เบอร์โทร: ${CLINIC.phone}
- บริการ: Botox, Filler, Sculptra, Profhilo, Juvelook, Rejuran, Ultherapy, Ultraformer, Oligio, Fat, Mounjaro, IV Drip, Hair
- เวลาเปิด: 11:00-19:00 น. ทุกวัน

ถ้าถามเรื่องราคา: แนะนำให้โทรสอบถามหรือ DM เพราะราคาขึ้นกับการประเมินของแพทย์
ถ้าถามเรื่องนัด: บอกให้แจ้งชื่อ-นามสกุล เพื่อเช็คนัดหมาย
ห้ามแต่งข้อมูลที่ไม่รู้`;

async function linePost(url: string, body: object) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

async function replyText(replyToken: string, text: string) {
  return linePost(LINE_REPLY_API, {
    replyToken,
    messages: [{ type: 'text', text }],
  });
}

async function pushText(to: string, text: string) {
  return linePost(LINE_PUSH_API, {
    to,
    messages: [{ type: 'text', text }],
  });
}

async function handleTextMessage(event: any) {
  const text: string = event.message?.text ?? '';
  const userId: string = event.source?.userId ?? '';
  const replyToken: string = event.replyToken ?? '';
  const lowerText = text.toLowerCase().trim();

  // คำสั่ง: โปรโมชั่น
  if (lowerText.includes('โปร') || lowerText.includes('ส่วนลด') || lowerText.includes('ราคาพิเศษ') || lowerText.includes('promotion') || lowerText.includes('deal')) {
    const today = new Date().toISOString().split('T')[0];
    const { data: promos } = await supabaseAdmin
      .from('promotions')
      .select('title, description, price, valid_from, valid_until')
      .eq('clinic_id', CLINIC_ID)
      .eq('is_active', true)
      .lte('valid_from', today)
      .gte('valid_until', today)
      .order('valid_until', { ascending: true });

    if (promos && promos.length > 0) {
      const lines = promos.map(p => {
        const until = new Date(p.valid_until).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        return `🌟 ${p.title}\n   ${p.description ?? ''}\n   💰 ${p.price ?? ''}\n   ⏰ ถึง ${until}`;
      }).join('\n\n');
      return replyText(replyToken, `โปรโมชั่นที่มีอยู่ตอนนี้ค่ะ 🎉\n\n${lines}\n\n📞 สอบถาม/จองได้เลยที่ ${CLINIC.phone} ค่ะ`);
    } else {
      return replyText(replyToken, `ขณะนี้ยังไม่มีโปรโมชั่นพิเศษค่ะ\nติดตามได้ที่ LINE นี้เลยนะคะ 😊\n📞 ${CLINIC.phone}`);
    }
  }

  // คำสั่ง: เช็คนัด
  if (lowerText.includes('นัด') || lowerText.includes('appointment') || lowerText.includes('คิว')) {
    const { data: appts } = await supabaseAdmin
      .from('appointments')
      .select('name, date, time, procedure')
      .eq('clinic_id', CLINIC_ID)
      .eq('line_user_id', userId)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(3);

    if (appts && appts.length > 0) {
      const lines = appts.map(a => {
        const d = new Date(a.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        return `📅 ${d} เวลา ${a.time} น.${a.procedure ? ` (${a.procedure})` : ''}`;
      }).join('\n');
      return replyText(replyToken, `นัดหมายของคุณที่จะถึง:\n${lines}\n\nสอบถามเพิ่มเติม: ${CLINIC.phone}`);
    } else {
      return replyText(replyToken, `ไม่พบนัดหมายที่จะถึงในระบบค่ะ\nหากต้องการนัดใหม่ กรุณาโทร ${CLINIC.phone} หรือ DM มาได้เลยค่ะ 😊`);
    }
  }

  // คำสั่ง: ยืนยันนัดหมาย (จากปุ่มใน Flex Message)
  if (lowerText === 'ยืนยันนัดหมาย') {
    const groupId = process.env.LINE_GROUP_ID;
    if (groupId) {
      // ดึงชื่อจาก patients
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('full_name')
        .eq('clinic_id', CLINIC_ID)
        .eq('line_user_id', userId)
        .single();
      const name = patient?.full_name ?? 'ลูกค้า';
      pushText(groupId, `✅ ${name} ยืนยันนัดหมายแล้ว`).catch(() => {});
    }
    return replyText(replyToken, `ขอบคุณที่ยืนยันนัดหมายค่ะ 🙏\nพบกันในวันนัดนะคะ!\n\nหากต้องการเปลี่ยนแปลง โทร ${CLINIC.phone} ได้เลยค่ะ`);
  }

  // คำสั่ง: ขอเลื่อนนัดหมาย
  if (lowerText.includes('เลื่อน') || lowerText === 'ขอเลื่อนนัดหมาย') {
    const groupId = process.env.LINE_GROUP_ID;
    if (groupId) {
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('full_name')
        .eq('clinic_id', CLINIC_ID)
        .eq('line_user_id', userId)
        .single();
      const name = patient?.full_name ?? userId;
      pushText(groupId, `⚠️ ${name} ขอเลื่อนนัดหมาย กรุณาติดต่อกลับ`).catch(() => {});
    }
    return replyText(replyToken, `รับทราบค่ะ ทีมงานจะติดต่อกลับเพื่อนัดวันใหม่นะคะ 😊\nหรือโทรหาเราได้เลยที่ ${CLINIC.phone} ค่ะ`);
  }

  // AI ตอบคำถามทั่วไป
  try {
    const answer = await claudeComplete(text, SYSTEM_PROMPT);
    return replyText(replyToken, answer);
  } catch {
    return replyText(replyToken, `ขอโทษค่ะ ระบบขัดข้องชั่วคราว\nกรุณาโทรสอบถามที่ ${CLINIC.phone} ได้เลยค่ะ 🙏`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events = body.events ?? [];

    for (const event of events) {
      // แจ้ง group เมื่อมี follow หรือ unfollow
      if (event.type === 'follow') {
        const groupId = process.env.LINE_GROUP_ID;
        if (groupId) {
          pushText(groupId, `🆕 มีคนเพิ่มเพื่อน LINE OA ใหม่`).catch(() => {});
        }
        await replyText(event.replyToken, `สวัสดีค่ะ ยินดีต้อนรับสู่ ${CLINIC.name} 🌸\n\nสามารถสอบถามข้อมูลบริการ, เช็คนัดหมาย หรือพิมพ์ "นัด" เพื่อดูนัดของคุณได้เลยค่ะ\n\n📞 ${CLINIC.phone}`);
        continue;
      }

      if (event.type === 'message' && event.message?.type === 'text') {
        // ไม่ตอบ message จาก group (ตอบเฉพาะ 1:1)
        if (event.source?.type === 'group') continue;
        await handleTextMessage(event);
      }
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
