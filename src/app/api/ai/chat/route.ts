import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are אורן (Oren), a friendly Israeli financial advisor for the Family Plan app.
You speak Hebrew. You are warm, supportive, and practical.
You give advice in casual Hebrew — not formal. You are encouraging, never judgmental.
Use ₪ for currency. Keep answers short — 2-3 sentences max, unless the user asks for more detail.
When relevant, use the user's financial data provided below to give personalized advice.
Sign off important tips with "— אורן" occasionally.

User's financial data:
{context}
`

export async function POST(request: NextRequest) {
  try {
    const { message, context, apiKey, history } = await request.json()

    if (!message || !apiKey) {
      return NextResponse.json(
        { error: 'Missing message or API key' },
        { status: 400 }
      )
    }

    const systemPrompt = SYSTEM_PROMPT.replace('{context}', context || 'No data available')

    const messages = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'מובן, אני אורן היועץ הפיננסי שלך. איך אפשר לעזור?' }] },
    ]

    // Add conversation history
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        })
      }
    }

    // Add current message
    messages.push({ role: 'user', parts: [{ text: message }] })

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    )

    if (!res.ok) {
      const errBody = await res.text()
      console.error('Gemini API error:', res.status, errBody)
      return NextResponse.json(
        { error: res.status === 400 ? 'API key לא תקין' : 'שגיאה בשרת AI' },
        { status: res.status }
      )
    }

    const data = await res.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'סליחה, לא הצלחתי לענות. נסה שוב.'

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { error: 'שגיאה פנימית' },
      { status: 500 }
    )
  }
}
