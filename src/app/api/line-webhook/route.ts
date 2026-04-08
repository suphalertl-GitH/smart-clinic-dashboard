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
ห้ามแต่งข้อมูลที่ไม่รู้`;

// ── LINE API helpers ──────────────────────────────────────────
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

async function reply(replyToken: string, messages: object[]) {
  return linePost(LINE_REPLY_API, { replyToken, messages });
}

function replyText(replyToken: string, text: string) {
  return reply(replyToken, [{ type: 'text', text }]);
}

async function pushText(to: string, text: string) {
  return linePost(LINE_PUSH_API, { to, messages: [{ type: 'text', text }] });
}

// ── Session helpers ───────────────────────────────────────────
async function getSession(userId: string) {
  const { data } = await supabaseAdmin
    .from('chat_sessions')
    .select('step, data')
    .eq('clinic_id', CLINIC_ID)
    .eq('line_user_id', userId)
    .single();
  return data ?? { step: 'idle', data: {} };
}

async function setSession(userId: string, step: string, data: object) {
  await supabaseAdmin.from('chat_sessions').upsert({
    clinic_id: CLINIC_ID,
    line_user_id: userId,
    step,
    data,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'clinic_id,line_user_id' });
}

async function clearSession(userId: string) {
  await setSession(userId, 'idle', {});
}

// ── Date helpers ──────────────────────────────────────────────
function thaiDateLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function next7Days(): { label: string; value: string }[] {
  const days = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
    days.push({ label, value });
  }
  return days;
}

function parseDate(text: string): string | null {
  const today = new Date();
  const t = text.trim();
  if (t.includes('วันนี้')) { return today.toISOString().split('T')[0]; }
  if (t.includes('พรุ่งนี้')) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  // รูปแบบ YYYY-MM-DD (จากปุ่ม quick reply)
  const iso = t.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (iso) return iso[1];
  // รูปแบบ d/m หรือ dd/mm
  const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dmy) {
    const year = today.getFullYear();
    const month = parseInt(dmy[2]);
    const day = parseInt(dmy[1]);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

// ── Available slots ───────────────────────────────────────────
async function getAvailableSlots(date: string): Promise<string[]> {
  const [settingsRes, bookedRes] = await Promise.all([
    supabaseAdmin.from('settings').select('time_slots').eq('clinic_id', CLINIC_ID).single(),
    supabaseAdmin.from('appointments').select('time').eq('clinic_id', CLINIC_ID).eq('date', date),
  ]);
  const allSlots: string[] = settingsRes.data?.time_slots ?? [];
  const booked = new Set((bookedRes.data ?? []).map((a: any) => a.time));
  return allSlots.filter(s => !booked.has(s));
}

// ── Quick reply builder ───────────────────────────────────────
function quickReply(items: { label: string; text: string }[]) {
  return {
    type: 'text',
    text: 'เลือกได้เลยค่ะ 👇',
    quickReply: {
      items: items.slice(0, 13).map(i => ({
        type: 'action',
        action: { type: 'message', label: i.label, text: i.text },
      })),
    },
  };
}

// ── Build patient context ─────────────────────────────────────
async function buildPatientContext(userId: string) {
  // ข้อมูลคนไข้
  const { data: patient } = await supabaseAdmin
    .from('patients')
    .select('hn, full_name, phone, allergies, disease, points, created_at')
    .eq('clinic_id', CLINIC_ID)
    .eq('line_user_id', userId)
    .single();

  if (!patient) return { patient: null, systemPrompt: SYSTEM_PROMPT };

  // ประวัติการรักษา (5 ครั้งล่าสุด)
  const { data: visits } = await supabaseAdmin
    .from('visits')
    .select('treatment_name, price, created_at, doctor')
    .eq('clinic_id', CLINIC_ID)
    .eq('hn', patient.hn)
    .order('created_at', { ascending: false })
    .limit(5);

  // นัดหมายที่จะถึง
  const { data: upcoming } = await supabaseAdmin
    .from('appointments')
    .select('date, time, procedure')
    .eq('clinic_id', CLINIC_ID)
    .eq('hn', patient.hn)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true })
    .limit(2);

  const visitHistory = visits && visits.length > 0
    ? visits.map(v => {
        const d = new Date(v.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        return `- ${d}: ${v.treatment_name} (${Number(v.price).toLocaleString()} บาท)${v.doctor ? ` โดย ${v.doctor}` : ''}`;
      }).join('\n')
    : '- ยังไม่มีประวัติการรักษา';

  const upcomingText = upcoming && upcoming.length > 0
    ? upcoming.map(a => `- ${thaiDateLabel(a.date)} เวลา ${a.time} น.${a.procedure ? ` (${a.procedure})` : ''}`).join('\n')
    : '- ไม่มีนัดหมายที่จะถึง';

  const memberSince = new Date(patient.created_at).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  const contextPrompt = `${SYSTEM_PROMPT}

=== ข้อมูลลูกค้าที่กำลังคุยด้วย ===
ชื่อ: คุณ${patient.full_name}
HN: ${patient.hn}
เบอร์: ${patient.phone}
แต้มสะสม: ${patient.points ?? 0} แต้ม
สมาชิกตั้งแต่: ${memberSince}
${patient.allergies ? `แพ้ยา: ${patient.allergies}` : ''}
${patient.disease ? `โรคประจำตัว: ${patient.disease}` : ''}

ประวัติการรักษา (ล่าสุด):
${visitHistory}

นัดหมายที่จะถึง:
${upcomingText}

ให้เรียกชื่อลูกค้าว่า "คุณ${patient.full_name}" และตอบโดยอ้างอิงประวัติที่มี เช่น ถ้าลูกค้าถามเรื่อง Botox และเคยทำมาแล้ว ให้บอกว่าครั้งก่อนทำเมื่อไหร่ด้วย`;

  return { patient, systemPrompt: contextPrompt };
}

// ── Main message handler ──────────────────────────────────────
async function handleTextMessage(event: any) {
  const text: string = event.message?.text?.trim() ?? '';
  const userId: string = event.source?.userId ?? '';
  const replyToken: string = event.replyToken ?? '';
  const lower = text.toLowerCase();

  // โหลด context ลูกค้า
  const { patient, systemPrompt } = await buildPatientContext(userId);

  // ยกเลิก / reset
  if (lower === 'ยกเลิก' || lower === 'cancel' || lower === 'เริ่มใหม่') {
    await clearSession(userId);
    return replyText(replyToken, 'รับทราบค่ะ ยกเลิกแล้ว 😊\nมีอะไรให้ช่วยอีกไหมคะ?');
  }

  const session = await getSession(userId);

  // ── STEP: waiting_name ────────────────────────────────────
  if (session.step === 'waiting_name') {
    if (text.length < 2) {
      return replyText(replyToken, 'กรุณากรอกชื่อ-นามสกุลค่ะ');
    }
    await setSession(userId, 'waiting_phone', { ...session.data, name: text });
    return replyText(replyToken, `ขอบคุณค่ะ คุณ${text} 😊\nกรุณากรอกเบอร์โทรศัพท์ด้วยนะคะ`);
  }

  // ── STEP: waiting_phone ───────────────────────────────────
  if (session.step === 'waiting_phone') {
    const phoneMatch = text.match(/0\d{8,9}/);
    if (!phoneMatch) {
      return replyText(replyToken, 'กรุณากรอกเบอร์โทรให้ถูกต้องค่ะ เช่น 0812345678');
    }
    const phone = phoneMatch[0];
    const name = (session.data as any).name;
    const nextStep = (session.data as any).nextStep ?? 'idle';

    // แจ้ง admin group
    const groupId = process.env.LINE_GROUP_ID;
    if (groupId) {
      pushText(groupId, `🆕 ลูกค้าใหม่ทาง LINE\n👤 ${name}  📞 ${phone}\n(ยังไม่ได้ลงทะเบียนในระบบ)`).catch(() => {});
    }

    // ถ้าขั้นต่อไปคือจองนัด
    if (nextStep === 'booking') {
      await setSession(userId, 'waiting_date', { name, phone });
      const days = next7Days();
      return reply(replyToken, [
        { type: 'text', text: `ขอบคุณค่ะ คุณ${name} 😊\nต้องการนัดวันไหนคะ?` },
        quickReply(days.map(d => ({ label: d.label, text: d.value }))),
      ]);
    }

    await clearSession(userId);
    return replyText(replyToken, `ขอบคุณค่ะ คุณ${name} 😊\nทีมงานจะติดต่อกลับที่ ${phone} นะคะ\nหรือโทรหาเราได้เลยที่ ${CLINIC.phone} ค่ะ`);
  }

  // ── STEP: waiting_date ────────────────────────────────────
  if (session.step === 'waiting_date') {
    const date = parseDate(text);
    if (!date) {
      return replyText(replyToken, 'ไม่เข้าใจวันที่ค่ะ กรุณาเลือกจากปุ่มด้านบน หรือพิมพ์ เช่น "พรุ่งนี้" หรือ "9/4" ค่ะ');
    }
    const slots = await getAvailableSlots(date);
    if (slots.length === 0) {
      await clearSession(userId);
      return replyText(replyToken, `วัน${thaiDateLabel(date)} เต็มแล้วค่ะ 😔\nกรุณาเลือกวันอื่น หรือโทร ${CLINIC.phone} ค่ะ`);
    }
    await setSession(userId, 'waiting_slot', { ...session.data, date });
    const qr = quickReply(slots.map(s => ({ label: s, text: s })));
    return reply(replyToken, [
      { type: 'text', text: `วัน${thaiDateLabel(date)} มีช่วงเวลาว่างดังนี้ค่ะ 📅` },
      qr,
    ]);
  }

  // ── STEP: waiting_slot ────────────────────────────────────
  if (session.step === 'waiting_slot') {
    const timeMatch = text.match(/^(\d{1,2}:\d{2})$/);
    if (!timeMatch) {
      return replyText(replyToken, 'กรุณาเลือกเวลาจากปุ่มด้านบนค่ะ');
    }
    const time = timeMatch[1];
    const date = (session.data as any).date;
    await setSession(userId, 'waiting_treatment', { ...session.data, date, time });

    const TREATMENT_LIST = ['Botox', 'Filler', 'Sculptra', 'Profhilo', 'Juvelook', 'Rejuran', 'Ultherapy', 'Ultraformer', 'Oligio', 'Fat dissolve', 'IV Drip', 'Hair', 'อื่นๆ'];
    return reply(replyToken, [
      { type: 'text', text: `เลือกเวลา ${time} น. แล้วค่ะ 👍\nต้องการมาใช้บริการอะไรคะ?` },
      quickReply(TREATMENT_LIST.map(t => ({ label: t, text: t }))),
    ]);
  }

  // ── STEP: waiting_treatment ───────────────────────────────
  if (session.step === 'waiting_treatment') {
    const treatment = text;
    const { date, time } = session.data as any;
    await setSession(userId, 'waiting_confirm', { ...session.data, date, time, treatment });
    const name = patient?.full_name ?? (session.data as any).name ?? '';
    const nameTag = name ? `คุณ${name}` : '';
    return reply(replyToken, [{
      type: 'text',
      text: `สรุปนัดหมาย${nameTag ? ` ของ${nameTag}` : ''} 📋\n📅 ${thaiDateLabel(date)}\n⏰ ${time} น.\n💉 ${treatment}\n\nยืนยันถูกต้องไหมคะ?`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '✅ ยืนยัน', text: 'ยืนยัน' } },
          { type: 'action', action: { type: 'message', label: '❌ ยกเลิก', text: 'ยกเลิก' } },
        ],
      },
    }]);
  }

  // ── STEP: waiting_confirm ─────────────────────────────────
  if (session.step === 'waiting_confirm') {
    if (lower === 'ยืนยัน' || lower === 'ใช่' || lower === 'ok' || lower === 'โอเค') {
      const { date, time, treatment, rescheduleApptId, oldDate, oldTime } = session.data as any;

      // ถ้าเป็นการเลื่อนนัด → update แทน insert
      if (rescheduleApptId) {
        // ดึงชื่อจาก appointment เดิม (กรณีไม่ได้ register)
        const { data: oldAppt } = await supabaseAdmin.from('appointments').select('name, phone').eq('id', rescheduleApptId).single();
        await supabaseAdmin.from('appointments').update({ date, time, ...(treatment ? { procedure: treatment } : {}) })
          .eq('id', rescheduleApptId).eq('clinic_id', CLINIC_ID);
        const groupId = process.env.LINE_GROUP_ID;
        const name = patient?.full_name ?? oldAppt?.name ?? (session.data as any).name ?? 'ลูกค้า';
        const phone = patient?.phone ?? oldAppt?.phone ?? '';
        if (groupId) pushText(groupId, `🔄 เลื่อนนัด\n👤 ${name}${phone ? `  📞 ${phone}` : ''}\nเดิม: ${thaiDateLabel(oldDate)} ${oldTime} น.\nใหม่: ${thaiDateLabel(date)} ${time} น.`).catch(() => {});
        await clearSession(userId);
        return replyText(replyToken, `เลื่อนนัดเรียบร้อยแล้วค่ะ ✅\n📅 ${thaiDateLabel(date)}\n⏰ ${time} น.\n\nพบกันในวันใหม่นะคะ 😊`);
      }

      const name = patient?.full_name ?? (session.data as any).name ?? 'ลูกค้า LINE';
      const phone = patient?.phone ?? (session.data as any).phone ?? '-';
      const hn = patient?.hn ?? null;

      // จองนัด
      await supabaseAdmin.from('appointments').insert({
        clinic_id: CLINIC_ID,
        hn,
        name,
        phone,
        date,
        time,
        procedure: treatment ?? null,
        status: hn ? 'returning' : 'new',
        line_user_id: userId,
        note: 'จองผ่าน LINE Chatbot',
      });

      // แจ้ง admin group
      const groupId = process.env.LINE_GROUP_ID;
      if (groupId) {
        pushText(groupId, `📅 จองผ่าน LINE\n👤 ${name}  📞 ${phone}\n🕐 ${thaiDateLabel(date)} ${time} น.\n💉 ${treatment ?? '-'}`).catch(() => {});
      }

      await clearSession(userId);
      return replyText(replyToken, `จองนัดเรียบร้อยแล้วค่ะ ✅\n📅 ${thaiDateLabel(date)}\n⏰ ${time} น.\n💉 ${treatment ?? '-'}\n\nทีมงานจะติดต่อยืนยันอีกครั้งนะคะ 😊\nสอบถาม: ${CLINIC.phone}`);
    } else {
      await clearSession(userId);
      return replyText(replyToken, 'ยกเลิกการจองแล้วค่ะ 😊\nหากต้องการนัดใหม่ พิมพ์ "จองนัด" ได้เลยนะคะ');
    }
  }

  // ── โปรโมชั่น ─────────────────────────────────────────────
  if (lower.includes('โปร') || lower.includes('ส่วนลด') || lower.includes('ราคาพิเศษ') || lower.includes('promotion')) {
    const today = new Date().toISOString().split('T')[0];
    const { data: promos } = await supabaseAdmin
      .from('promotions').select('title, description, price, valid_until')
      .eq('clinic_id', CLINIC_ID).eq('is_active', true)
      .lte('valid_from', today).gte('valid_until', today)
      .order('valid_until', { ascending: true });

    if (promos && promos.length > 0) {
      const lines = promos.map(p => {
        const until = new Date(p.valid_until).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        return `🌟 ${p.title}\n   ${p.description ?? ''}\n   💰 ${p.price ?? ''}\n   ⏰ ถึง ${until}`;
      }).join('\n\n');
      return replyText(replyToken, `โปรโมชั่นที่มีอยู่ตอนนี้ค่ะ 🎉\n\n${lines}\n\n📞 สอบถาม/จอง: ${CLINIC.phone}`);
    }
    return replyText(replyToken, `ขณะนี้ยังไม่มีโปรโมชั่นพิเศษค่ะ\nติดตามได้ที่ LINE นี้เลยนะคะ 😊`);
  }

  // ── STEP: waiting_cancel_confirm ─────────────────────────
  if (session.step === 'waiting_cancel_confirm') {
    if (lower === 'ยืนยัน' || lower === 'ใช่' || lower === 'ยกเลิกนัด') {
      const { apptId, date, time } = session.data as any;
      const { data: cancelAppt } = await supabaseAdmin.from('appointments').select('name, phone').eq('id', apptId).single();
      await supabaseAdmin.from('appointments').delete()
        .eq('id', apptId).eq('clinic_id', CLINIC_ID);
      const groupId = process.env.LINE_GROUP_ID;
      const name = patient?.full_name ?? cancelAppt?.name ?? 'ลูกค้า';
      const phone = patient?.phone ?? cancelAppt?.phone ?? '';
      if (groupId) pushText(groupId, `❌ ยกเลิกนัด\n👤 ${name}${phone ? `  📞 ${phone}` : ''}\n📅 ${thaiDateLabel(date)} ${time} น.`).catch(() => {});
      await clearSession(userId);
      return replyText(replyToken, `ยกเลิกนัดเรียบร้อยแล้วค่ะ ✅\n📅 ${thaiDateLabel(date)} ${time} น.\n\nหากต้องการนัดใหม่ พิมพ์ "จองนัด" ได้เลยนะคะ 😊`);
    }
    await clearSession(userId);
    return replyText(replyToken, 'รับทราบค่ะ ยังคงนัดหมายไว้เหมือนเดิมนะคะ 😊');
  }

  // ── STEP: waiting_reschedule_select ──────────────────────
  if (session.step === 'waiting_reschedule_select') {
    const appts = (session.data as any).appts as any[];
    // รับ index เช่น "นัด1", "นัด2"
    const idxMatch = text.match(/^นัด(\d+)$/);
    const idx = idxMatch ? parseInt(idxMatch[1]) - 1 : -1;
    const selected = appts?.[idx];
    if (!selected) return replyText(replyToken, 'กรุณาเลือกจากปุ่มด้านบนค่ะ');
    await setSession(userId, 'waiting_date', { rescheduleApptId: selected.id, oldDate: selected.date, oldTime: selected.time });
    const days = next7Days();
    return reply(replyToken, [
      { type: 'text', text: `เลื่อนนัดจาก ${thaiDateLabel(selected.date)} ${selected.time} น.${selected.procedure ? ` (${selected.procedure})` : ''}\nต้องการนัดวันใหม่วันไหนคะ? 📅` },
      quickReply(days.map(d => ({ label: d.label, text: d.value }))),
    ]);
  }

  // ── STEP: waiting_reschedule_confirm ──────────────────────
  if (session.step === 'waiting_reschedule_confirm') {
    if (lower === 'ยืนยัน' || lower === 'ใช่') {
      const { rescheduleApptId, date, time, treatment, oldDate, oldTime } = session.data as any;
      await supabaseAdmin.from('appointments').update({ date, time, procedure: treatment ?? undefined })
        .eq('id', rescheduleApptId).eq('clinic_id', CLINIC_ID);
      const groupId = process.env.LINE_GROUP_ID;
      const name = patient?.full_name ?? 'ลูกค้า';
      if (groupId) pushText(groupId, `🔄 ${name} เลื่อนนัด\nเดิม: ${thaiDateLabel(oldDate)} ${oldTime} น.\nใหม่: ${thaiDateLabel(date)} ${time} น.`).catch(() => {});
      await clearSession(userId);
      return replyText(replyToken, `เลื่อนนัดเรียบร้อยแล้วค่ะ ✅\n📅 ${thaiDateLabel(date)}\n⏰ ${time} น.\n\nพบกันในวันใหม่นะคะ 😊`);
    }
    await clearSession(userId);
    return replyText(replyToken, 'รับทราบค่ะ ยกเลิกการเลื่อนนัดแล้วนะคะ 😊');
  }

  // ── เลื่อนนัด ──────────────────────────────────────────────
  if (lower.includes('เลื่อนนัด') || lower.includes('เลื่อน นัด') || lower.includes('ขอเลื่อน')) {
    const today = new Date().toISOString().split('T')[0];
    const query = patient
      ? supabaseAdmin.from('appointments').select('id, date, time, procedure').eq('clinic_id', CLINIC_ID).eq('hn', patient.hn).gte('date', today).order('date').limit(3)
      : supabaseAdmin.from('appointments').select('id, date, time, procedure').eq('clinic_id', CLINIC_ID).eq('line_user_id', userId).gte('date', today).order('date').limit(3);
    const { data: reschedAppts } = await query;
    if (!reschedAppts || reschedAppts.length === 0) {
      return replyText(replyToken, 'ไม่พบนัดหมายที่จะถึงในระบบค่ะ\nหากต้องการจองใหม่ พิมพ์ "จองนัด" ได้เลยนะคะ 😊');
    }
    if (reschedAppts.length === 1) {
      const a = reschedAppts[0];
      await setSession(userId, 'waiting_date', { rescheduleApptId: a.id, oldDate: a.date, oldTime: a.time });
      const days = next7Days();
      return reply(replyToken, [
        { type: 'text', text: `เลื่อนนัดจาก ${thaiDateLabel(a.date)} ${a.time} น.${a.procedure ? ` (${a.procedure})` : ''}\nต้องการนัดวันใหม่วันไหนคะ? 📅` },
        quickReply(days.map(d => ({ label: d.label, text: d.value }))),
      ]);
    }
    await setSession(userId, 'waiting_reschedule_select', { appts: reschedAppts });
    const apptLines = reschedAppts.map((a, i) =>
      `${i + 1}. ${thaiDateLabel(a.date)} ${a.time} น.${a.procedure ? ` (${a.procedure})` : ''}`
    ).join('\n');
    return reply(replyToken, [
      { type: 'text', text: `ต้องการเลื่อนนัดไหนคะ?\n${apptLines}` },
      quickReply(reschedAppts.map((a, i) => ({
        label: `นัด ${i + 1} — ${new Date(a.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`,
        text: `นัด${i + 1}`,
      }))),
    ]);
  }

  // ── เช็คนัดหมาย ────────────────────────────────────────────
  if ((lower.includes('นัด') || lower.includes('คิว') || lower.includes('appointment')) && !lower.includes('ยกเลิก')) {
    // ถ้าถามว่าว่างไหม / จองนัด → เริ่ม booking flow
    if (lower.includes('จอง') || lower.includes('ว่าง') || lower.includes('ตาราง') || lower.includes('หมอ') || lower.includes('เพิ่มนัด') || lower.includes('นัดใหม่') || lower.includes('อยากนัด') || lower.includes('ต้องการนัด')) {
      // ลูกค้าใหม่ ยังไม่มีข้อมูลในระบบ → ถามชื่อก่อน
      if (!patient) {
        await setSession(userId, 'waiting_name', { nextStep: 'booking' });
        return replyText(replyToken, `ยินดีต้อนรับค่ะ 🌸\nก่อนจองนัด ขอทราบชื่อ-นามสกุลของคุณด้วยนะคะ`);
      }
      await setSession(userId, 'waiting_date', {});
      const days = next7Days();
      return reply(replyToken, [
        { type: 'text', text: `สวัสดีค่ะ คุณ${patient.full_name} 😊\nต้องการนัดวันไหนคะ? 📅` },
        quickReply(days.map(d => ({ label: d.label, text: d.value }))),
      ]);
    }

    // เช็คนัดของตัวเอง
    const { data: appts } = await supabaseAdmin
      .from('appointments').select('name, date, time, procedure')
      .eq('clinic_id', CLINIC_ID).eq('line_user_id', userId)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true }).limit(3);

    if (appts && appts.length > 0) {
      const lines = appts.map(a => `📅 ${thaiDateLabel(a.date)} เวลา ${a.time} น.${a.procedure ? ` (${a.procedure})` : ''}`).join('\n');
      return replyText(replyToken, `นัดหมายของคุณที่จะถึง:\n${lines}\n\nสอบถาม: ${CLINIC.phone}`);
    }
    return replyText(replyToken, `ไม่พบนัดหมายในระบบค่ะ\nต้องการจองนัดใหม่ไหมคะ?`, );
  }

  // ── ยกเลิกนัด ──────────────────────────────────────────────
  if (lower.includes('ยกเลิกนัด') || lower === 'cancel appointment') {
    const today = new Date().toISOString().split('T')[0];
    const query = patient
      ? supabaseAdmin.from('appointments').select('id, date, time, procedure').eq('clinic_id', CLINIC_ID).eq('hn', patient.hn).gte('date', today).order('date').limit(3)
      : supabaseAdmin.from('appointments').select('id, date, time, procedure').eq('clinic_id', CLINIC_ID).eq('line_user_id', userId).gte('date', today).order('date').limit(3);
    const { data: appts } = await query;
    if (!appts || appts.length === 0) {
      return replyText(replyToken, 'ไม่พบนัดหมายที่จะถึงในระบบค่ะ 😊');
    }
    if (appts.length === 1) {
      const a = appts[0];
      await setSession(userId, 'waiting_cancel_confirm', { apptId: a.id, date: a.date, time: a.time });
      return reply(replyToken, [{
        type: 'text',
        text: `ยืนยันยกเลิกนัดหมายนี้ไหมคะ?\n📅 ${thaiDateLabel(a.date)}\n⏰ ${a.time} น.${a.procedure ? `\n💉 ${a.procedure}` : ''}`,
        quickReply: { items: [
          { type: 'action', action: { type: 'message', label: '✅ ยืนยันยกเลิก', text: 'ยืนยัน' } },
          { type: 'action', action: { type: 'message', label: '❌ ไม่ยกเลิก', text: 'ไม่' } },
        ]},
      }]);
    }
    // มีหลายนัด → ให้เลือก
    await setSession(userId, 'waiting_cancel_confirm', { apptId: appts[0].id, date: appts[0].date, time: appts[0].time });
    const lines = appts.map((a, i) => `${i + 1}. ${thaiDateLabel(a.date)} ${a.time} น.${a.procedure ? ` (${a.procedure})` : ''}`).join('\n');
    return reply(replyToken, [{
      type: 'text', text: `นัดหมายที่จะถึงค่ะ:\n${lines}\n\nยืนยันยกเลิกนัดแรก ถูกต้องไหมคะ?`,
      quickReply: { items: [
        { type: 'action', action: { type: 'message', label: '✅ ยืนยันยกเลิก', text: 'ยืนยัน' } },
        { type: 'action', action: { type: 'message', label: '❌ ไม่ยกเลิก', text: 'ไม่' } },
      ]},
    }]);
  }

  // ── ยืนยันนัด (จากปุ่ม Flex reminder) ─────────────────────
  if (lower === 'ยืนยันนัดหมาย') {
    const groupId = process.env.LINE_GROUP_ID;
    if (groupId) pushText(groupId, `✅ ${patient?.full_name ?? 'ลูกค้า'} ยืนยันนัดหมายแล้ว`).catch(() => {});
    return replyText(replyToken, `ขอบคุณที่ยืนยันนัดหมายค่ะ 🙏\nพบกันในวันนัดนะคะ!\nสอบถาม: ${CLINIC.phone}`);
  }

  // ── AI ตอบทั่วไป (พร้อม patient context) ───────────────────
  try {
    const answer = await claudeComplete(text, systemPrompt);
    return replyText(replyToken, answer);
  } catch {
    return replyText(replyToken, `ขอโทษค่ะ ระบบขัดข้องชั่วคราว\nกรุณาโทร ${CLINIC.phone} ค่ะ 🙏`);
  }
}

// ── Webhook entry point ───────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    for (const event of body.events ?? []) {
      if (event.type === 'follow') {
        const followUserId = event.source?.userId ?? '';
        const groupId = process.env.LINE_GROUP_ID;
        if (groupId) pushText(groupId, `🆕 มีคนเพิ่มเพื่อน LINE OA ใหม่`).catch(() => {});
        // เช็คว่าเคย register ไหม
        const { data: existingPatient } = await supabaseAdmin
          .from('patients').select('full_name').eq('clinic_id', CLINIC_ID).eq('line_user_id', followUserId).single();
        if (existingPatient) {
          await replyText(event.replyToken, `สวัสดีค่ะ คุณ${existingPatient.full_name} 🌸 ยินดีต้อนรับกลับมานะคะ!\n\n• "จองนัด" — นัดหมายกับหมอ\n• "นัด" — เช็คนัดของคุณ\n• "โปรโมชั่น" — ดูโปรปัจจุบัน\n\n📞 ${CLINIC.phone}`);
        } else {
          await replyText(event.replyToken, `สวัสดีค่ะ ยินดีต้อนรับสู่ ${CLINIC.name} 🌸\n\nสามารถพิมพ์ได้เลยค่ะ เช่น\n• "โปรโมชั่น" — ดูโปรปัจจุบัน\n• "จองนัด" — นัดหมายกับหมอ\n• ถามอะไรก็ได้ค่ะ 😊\n\n📞 ${CLINIC.phone}`);
        }
        continue;
      }
      if (event.type === 'message' && event.message?.type === 'text') {
        if (event.source?.type === 'group') continue; // ไม่ตอบในกลุ่ม
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
