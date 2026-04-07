// Groq API client สำหรับ AI Summary features
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';

export async function claudeComplete(prompt: string, systemPrompt?: string): Promise<string> {
  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      messages: [
        {
          role: 'system',
          content: systemPrompt ?? 'คุณคือที่ปรึกษาคลินิกความงามชั้นนำ วิเคราะห์ข้อมูลและให้คำแนะนำเป็นภาษาไทย',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
