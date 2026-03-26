import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth'

const SYSTEM_PROMPT = `You are אורן (Oren), a friendly Israeli financial advisor for the Family Plan app.
You speak Hebrew. You are warm, supportive, and practical.
You give advice in casual Hebrew — not formal. You are encouraging, never judgmental.
Use ₪ for currency. Keep answers short — 2-3 sentences max, unless the user asks for more detail.
When relevant, use the user's financial data provided below to give personalized advice.
Sign off important tips with "— אורן" occasionally.

User's financial data:
{context}
`

// Free tier: use our API key with rate limiting (3 messages per day per user)
const FREE_TIER_KEY = process.env.GEMINI_API_KEY || ''
const FREE_TIER_MODEL = 'gemini-2.0-flash'
const freeUsage = new Map<string, { count: number; date: string }>()

function checkFreeLimit(userId: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  const usage = freeUsage.get(userId)
  if (!usage || usage.date !== today) {
    freeUsage.set(userId, { count: 1, date: today })
    return true
  }
  if (usage.count >= 3) return false
  usage.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { message, context, apiKey, history } = await request.json()
    const userId = authUser.id

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 })
    }

    // Determine which API key to use
    let activeKey = apiKey
    let isFree = false

    if (!apiKey) {
      // Free tier — use our key with rate limit
      if (!FREE_TIER_KEY) {
        return NextResponse.json({ error: 'חבר API key בהגדרות כדי לשוחח עם אורן', needsKey: true }, { status: 200 })
      }
      if (!checkFreeLimit(userId || 'anonymous')) {
        return NextResponse.json({ error: 'הגעת למגבלת 3 שאלות חינמיות ביום. חבר API key משלך לשימוש ללא הגבלה!', needsKey: true }, { status: 200 })
      }
      activeKey = FREE_TIER_KEY
      isFree = true
    }

    const systemPrompt = SYSTEM_PROMPT.replace('{context}', context || 'No data available')

    const messages = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'מובן, אני אורן היועץ הפיננסי שלך. איך אפשר לעזור?' }] },
    ]

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        })
      }
    }

    messages.push({ role: 'user', parts: [{ text: message }] })

    const model = isFree ? FREE_TIER_MODEL : 'gemini-2.0-flash'
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
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
