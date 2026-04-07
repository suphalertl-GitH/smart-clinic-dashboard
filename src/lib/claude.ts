// Claude API client สำหรับ Enterprise tier features
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export async function claudeComplete(prompt: string, systemPrompt?: string): Promise<string> {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt ?? 'คุณคือที่ปรึกษาคลินิกความงามชั้นนำ วิเคราะห์ข้อมูลและให้คำแนะนำเป็นภาษาไทย',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}
