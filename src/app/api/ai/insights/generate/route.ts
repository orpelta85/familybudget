import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAuthUser } from '@/lib/supabase/auth'

const MODEL = 'gemini-2.5-flash-lite'

type InsightCategory = 'spending' | 'saving' | 'alert' | 'achievement' | 'action'
type InsightSeverity = 'info' | 'warning' | 'positive'

interface GeneratedInsight {
  text: string
  category: InsightCategory
  severity: InsightSeverity
}

const VALID_CATEGORIES: InsightCategory[] = ['spending', 'saving', 'alert', 'achievement', 'action']
const VALID_SEVERITIES: InsightSeverity[] = ['info', 'warning', 'positive']

const SYSTEM_PROMPT = `אתה יועץ פיננסי מומחה בעברית. תפקידך לנתח את נתוני ההוצאות/הכנסות של משפחה בחודש האחרון ולתת 3-5 תובנות קונקרטיות וחיוביות.

תובנות צריכות להיות:
1. מבוססות נתונים — הזכר מספרים ספציפיים מהנתונים שקיבלת.
2. ברות ביצוע — הצע פעולה קונקרטית שהמשתמש יכול לעשות.
3. בטון תומך ולא שיפוטי — עודד, אל תבקר.
4. בעברית תקנית, קצרות ותמציתיות (עד 25 מילים כל אחת).
5. השתמש בסימן ₪ אחרי מספרים, ומקף רגיל (-), לא em-dash.

החזר JSON בלבד בפורמט הבא:
{
  "insights": [
    { "text": "טקסט התובנה בעברית", "category": "spending|saving|alert|achievement|action", "severity": "info|warning|positive" }
  ]
}

קטגוריות:
- spending: תובנות על דפוסי הוצאה
- saving: תובנות על חיסכון
- alert: התראות על חריגות או בעיות
- achievement: הישגים חיוביים
- action: פעולות מומלצות

חומרות:
- positive: הישג או מגמה חיובית (ירוק)
- info: מידע ניטרלי או המלצה (כחול)
- warning: אזהרה או דבר שצריך תשומת לב (צהוב)`

export async function POST(_request: NextRequest) {
  try {
    const authUser = await getAuthUser()
    if (!authUser) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'תובנות AI לא מוגדרות. הוסף GEMINI_API_KEY ל-.env.local',
          needsKey: true,
        },
        { status: 503 }
      )
    }

    const cookieStore = await cookies()
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )

    // Load last 30 days of financial data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [expensesRes, sharedRes, incomeRes, categoriesRes, familyRes] = await Promise.all([
      sb
        .from('personal_expenses')
        .select('amount, description, category_id, created_at')
        .eq('user_id', authUser.id)
        .gte('created_at', thirtyDaysAgo)
        .limit(500),
      sb
        .from('shared_expenses')
        .select('total_amount, category, notes, created_at')
        .gte('created_at', thirtyDaysAgo)
        .limit(300),
      sb
        .from('income')
        .select('salary, bonus, other, period_id')
        .eq('user_id', authUser.id)
        .order('period_id', { ascending: false })
        .limit(3),
      sb
        .from('budget_categories')
        .select('id, name, monthly_target')
        .eq('user_id', authUser.id),
      sb
        .from('family_members')
        .select('family_id')
        .eq('user_id', authUser.id)
        .maybeSingle(),
    ])

    const expenses = expensesRes.data ?? []
    const shared = sharedRes.data ?? []
    const income = incomeRes.data ?? []
    const categories = categoriesRes.data ?? []
    const familyId = familyRes.data?.family_id ?? null

    // Summarize for the model (smaller context)
    const categoryMap = new Map(categories.map(c => [c.id, c.name]))
    const spendingByCategory: Record<string, number> = {}
    for (const e of expenses) {
      const name = (e.category_id && categoryMap.get(e.category_id)) || 'לא מסווג'
      spendingByCategory[name] = (spendingByCategory[name] ?? 0) + Number(e.amount ?? 0)
    }
    const sharedByCategory: Record<string, number> = {}
    for (const s of shared) {
      const name = s.category || 'משותפות'
      sharedByCategory[name] = (sharedByCategory[name] ?? 0) + Number(s.total_amount ?? 0)
    }

    const totalIncome = income.reduce(
      (sum, i) => sum + Number(i.salary ?? 0) + Number(i.bonus ?? 0) + Number(i.other ?? 0),
      0
    ) / Math.max(income.length, 1)

    const totalSpent =
      Object.values(spendingByCategory).reduce((a, b) => a + b, 0) +
      Object.values(sharedByCategory).reduce((a, b) => a + b, 0)

    const budgetVsActual = categories.map(c => ({
      name: c.name,
      target: Number(c.monthly_target ?? 0),
      actual: spendingByCategory[c.name] ?? 0,
    }))

    const summary = {
      period: 'הוצאות 30 ימים אחרונים',
      total_spent: Math.round(totalSpent),
      avg_monthly_income: Math.round(totalIncome),
      personal_spending_by_category: spendingByCategory,
      shared_spending_by_category: sharedByCategory,
      budget_vs_actual: budgetVsActual,
      expense_count: expenses.length + shared.length,
    }

    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `נתוני המשפחה:\n\n${JSON.stringify(summary, null, 2)}\n\nתן 3-5 תובנות פיננסיות בעברית. החזר JSON בלבד.`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    enum: ['spending', 'saving', 'alert', 'achievement', 'action'],
                  },
                  severity: {
                    type: Type.STRING,
                    enum: ['info', 'warning', 'positive'],
                  },
                },
                required: ['text', 'category', 'severity'],
              },
            },
          },
          required: ['insights'],
        },
      },
    })

    const raw = response.text ?? ''

    let parsed: { insights?: GeneratedInsight[] } = {}
    try {
      parsed = raw ? JSON.parse(raw) : {}
    } catch (e) {
      console.error('AI insights parse error:', e, raw)
      return NextResponse.json({ error: 'שגיאה בפענוח תשובת ה-AI' }, { status: 500 })
    }

    const insights: GeneratedInsight[] = Array.isArray(parsed.insights)
      ? parsed.insights
          .map(i => ({
            text: String(i?.text ?? '').trim(),
            category: (VALID_CATEGORIES.includes(i?.category as InsightCategory)
              ? i.category
              : 'spending') as InsightCategory,
            severity: (VALID_SEVERITIES.includes(i?.severity as InsightSeverity)
              ? i.severity
              : 'info') as InsightSeverity,
          }))
          .filter(i => i.text.length > 0)
          .slice(0, 5)
      : []

    if (insights.length === 0) {
      return NextResponse.json({ error: 'לא התקבלו תובנות מה-AI' }, { status: 500 })
    }

    // Remove old unread insights for this user (keep history clean)
    await sb
      .from('ai_insights')
      .delete()
      .eq('user_id', authUser.id)
      .lt('generated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    // Insert new insights
    const rows = insights.map(i => ({
      user_id: authUser.id,
      family_id: familyId,
      insight_text: i.text,
      category: i.category,
      severity: i.severity,
      is_read: false,
    }))

    const { data: inserted, error: insertError } = await sb
      .from('ai_insights')
      .insert(rows)
      .select('*')

    if (insertError) {
      console.error('AI insights insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ insights: inserted })
  } catch (error) {
    console.error('AI insights error:', error)
    const msg = error instanceof Error ? error.message : 'שגיאה פנימית'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
