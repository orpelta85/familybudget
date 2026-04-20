import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { getAuthUser } from '@/lib/supabase/auth'

type ExpenseInput = { description: string; amount: number }
type CategoryInput = { id: string; name: string }
type HistoryExample = { merchant: string; categoryId: string }
type MappingRow = { description: string; categoryId: string | null; confidence: number }

const MODEL = 'gemini-2.5-flash-lite'
const MAX_ROWS = 200
const MAX_HISTORY = 60

function buildSystemPrompt(categories: CategoryInput[], history: HistoryExample[]): string {
  const catList = categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n')
  const historyBlock = history.length
    ? `\nדוגמאות מהחודשים הקודמים - כך המשתמש סיווג עסקים דומים בעבר (חשוב - עקוב אחרי זה):\n${history.map(h => `- "${h.merchant}" → categoryId: ${h.categoryId}`).join('\n')}\n`
    : ''
  return `אתה מומחה לסיווג הוצאות של משפחה ישראלית.
תקבל רשימת הוצאות (תיאור + סכום) ואת רשימת הקטגוריות הזמינות.
עבור כל הוצאה, החזר את הקטגוריה המתאימה ביותר מתוך הרשימה.

הקטגוריות הזמינות:
${catList}
${historyBlock}
כללים:
1. החזר JSON בלבד, בפורמט { "mapping": [{ "description": "...", "categoryId": "...", "confidence": 0.0-1.0 }] }
2. categoryId חייב להיות אחד מה-ids שלמעלה בלבד, או null אם אין התאמה
3. confidence: 0.9+ ברור לחלוטין, 0.7-0.9 בטוח, 0.4-0.7 סביר, מתחת ל-0.4 החזר null ל-categoryId
4. אם ההוצאה דומה לדוגמה מההיסטוריה - סווג אותה לאותה קטגוריה עם confidence גבוה (0.9+)
5. זהה שמות עסקים ישראליים נפוצים (שופרסל, רמי לוי, יינות ביתן = סופר; פז, סונול, דלק = דלק; וכו')
6. אל תמציא קטגוריות חדשות - השתמש רק במה שקיים ברשימה
7. החזר את כל ההוצאות שנשלחו, באותו סדר`
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'סיווג AI לא מוגדר. הוסף GEMINI_API_KEY ל-.env.local',
          needsKey: true,
        },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => null) as {
      expenses?: ExpenseInput[]
      categories?: CategoryInput[]
      history?: HistoryExample[]
    } | null

    if (!body?.expenses || !Array.isArray(body.expenses) || body.expenses.length === 0) {
      return NextResponse.json({ error: 'Missing or empty expenses array' }, { status: 400 })
    }
    if (!body.categories || !Array.isArray(body.categories) || body.categories.length === 0) {
      return NextResponse.json({ error: 'Missing or empty categories array' }, { status: 400 })
    }

    const expenses = body.expenses.slice(0, MAX_ROWS)
    const categories = body.categories
    const validIds = new Set(categories.map(c => c.id))
    const history = Array.isArray(body.history)
      ? body.history
          .filter(h => h?.merchant && h?.categoryId && validIds.has(String(h.categoryId)))
          .slice(0, MAX_HISTORY)
          .map(h => ({ merchant: String(h.merchant), categoryId: String(h.categoryId) }))
      : []

    const ai = new GoogleGenAI({ apiKey })
    const systemPrompt = buildSystemPrompt(categories, history)
    const userPayload = JSON.stringify({ expenses }, null, 2)

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `סווג את ההוצאות הבאות:\n\n${userPayload}\n\nהחזר JSON בלבד.`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mapping: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  categoryId: { type: Type.STRING, nullable: true },
                  confidence: { type: Type.NUMBER },
                },
                required: ['description', 'confidence'],
              },
            },
          },
          required: ['mapping'],
        },
      },
    })

    const raw = response.text ?? ''

    let parsed: { mapping?: MappingRow[] } = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch (e) {
      console.error('AI categorize parse error:', e, raw)
      return NextResponse.json({ error: 'שגיאה בפענוח תשובת ה-AI' }, { status: 500 })
    }

    const mapping: MappingRow[] = Array.isArray(parsed.mapping)
      ? parsed.mapping.map(r => ({
          description: String(r?.description ?? ''),
          categoryId: r?.categoryId && validIds.has(String(r.categoryId)) ? String(r.categoryId) : null,
          confidence: Math.max(0, Math.min(1, Number(r?.confidence ?? 0))),
        }))
      : []

    return NextResponse.json({ mapping })
  } catch (error) {
    console.error('AI categorize error:', error)
    const msg = error instanceof Error ? error.message : 'שגיאה פנימית'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
