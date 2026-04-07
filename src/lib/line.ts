const LINE_API = 'https://api.line.me/v2/bot/message';

async function linePost(endpoint: string, body: object) {
  const res = await fetch(`${LINE_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LINE API error: ${err}`);
  }
  return res.json();
}

// ส่งข้อความหา user คนเดียว
export async function pushMessage(lineUserId: string, messages: LineMessage[]) {
  return linePost('push', { to: lineUserId, messages });
}

// ส่งข้อความเข้า LINE Group (แจ้ง admin/sales)
export async function pushGroupMessage(messages: LineMessage[]) {
  const groupId = process.env.LINE_GROUP_ID;
  if (!groupId) return; // ถ้าไม่มี group id ก็ข้ามไปเงียบๆ
  return linePost('push', { to: groupId, messages });
}

// ส่งข้อความพร้อมรูป (ใบเสร็จ)
export function textMessage(text: string): LineMessage {
  return { type: 'text', text };
}

export function flexMessage(altText: string, contents: object): LineMessage {
  return { type: 'flex', altText, contents };
}

// สร้าง Flex Message สำหรับแจ้งนัดหมาย
export function appointmentReminderFlex(data: {
  name: string;
  date: string;
  time: string;
  procedure: string;
  clinicName: string;
  clinicPhone: string;
}): LineMessage {
  return flexMessage(`แจ้งเตือนนัดหมาย - ${data.clinicName}`, {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#00B900',
      contents: [
        { type: 'text', text: '📅 แจ้งเตือนนัดหมาย', color: '#ffffff', weight: 'bold', size: 'lg' },
        { type: 'text', text: data.clinicName, color: '#ffffff', size: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        { type: 'text', text: `สวัสดีคุณ ${data.name}`, weight: 'bold', size: 'md' },
        { type: 'text', text: 'คุณมีนัดหมายในวันพรุ่งนี้', color: '#555555', size: 'sm' },
        { type: 'separator', margin: 'md' },
        {
          type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm',
          contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '📅 วันที่', color: '#aaaaaa', size: 'sm', flex: 2 },
              { type: 'text', text: data.date, weight: 'bold', size: 'sm', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '⏰ เวลา', color: '#aaaaaa', size: 'sm', flex: 2 },
              { type: 'text', text: `${data.time} น.`, weight: 'bold', size: 'sm', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '💉 หัตถการ', color: '#aaaaaa', size: 'sm', flex: 2 },
              { type: 'text', text: data.procedure || 'ตามที่นัดไว้', weight: 'bold', size: 'sm', flex: 3, wrap: true },
            ]},
          ],
        },
        { type: 'separator', margin: 'md' },
        { type: 'text', text: `📞 สอบถาม: ${data.clinicPhone}`, color: '#888888', size: 'xs', margin: 'md' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'button', style: 'primary', color: '#00B900',
          action: { type: 'message', label: 'ยืนยันนัดหมาย ✅', text: 'ยืนยันนัดหมาย' } },
        { type: 'button', style: 'secondary', margin: 'sm',
          action: { type: 'message', label: 'ขอเลื่อนนัด', text: 'ขอเลื่อนนัดหมาย' } },
      ],
    },
  });
}

export type LineMessage = {
  type: 'text' | 'flex' | 'image';
  text?: string;
  altText?: string;
  contents?: object;
};
