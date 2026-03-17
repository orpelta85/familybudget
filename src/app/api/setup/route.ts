import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const STARTER_CATEGORIES = [
  { name: 'שכירות (חלקי)', type: 'fixed', monthly_target: 2500, sort_order: 1 },
  { name: 'ארנונה (חלקי)', type: 'fixed', monthly_target: 150, sort_order: 2 },
  { name: 'חשמל (חלקי)', type: 'fixed', monthly_target: 100, sort_order: 3 },
  { name: 'מים+גז (חלקי)', type: 'fixed', monthly_target: 75, sort_order: 4 },
  { name: 'ועד בית (חלקי)', type: 'fixed', monthly_target: 125, sort_order: 5 },
  { name: 'אינטרנט (חלקי)', type: 'fixed', monthly_target: 50, sort_order: 6 },
  { name: 'ביטוח דירה (חלקי)', type: 'fixed', monthly_target: 60, sort_order: 7 },
  { name: 'נטפליקס (חלקי)', type: 'fixed', monthly_target: 30, sort_order: 8 },
  { name: 'ספוטיפיי (חלקי)', type: 'fixed', monthly_target: 25, sort_order: 9 },
  { name: 'מכולת (חלקי)', type: 'variable', monthly_target: 600, sort_order: 10 },
  { name: 'הוצאות אישיות', type: 'variable', monthly_target: 1500, sort_order: 11 },
  { name: 'בגדים', type: 'variable', monthly_target: 300, sort_order: 12 },
  { name: 'בריאות', type: 'variable', monthly_target: 200, sort_order: 13 },
  { name: 'תחבורה', type: 'variable', monthly_target: 400, sort_order: 14 },
  { name: 'ספורט', type: 'variable', monthly_target: 200, sort_order: 15 },
  { name: 'שונות', type: 'variable', monthly_target: 200, sort_order: 16 },
  { name: 'קרן חירום', type: 'sinking', monthly_target: 500, sort_order: 17 },
  { name: 'חופשה', type: 'sinking', monthly_target: 400, sort_order: 18 },
  { name: 'רכב', type: 'sinking', monthly_target: 300, sort_order: 19 },
  { name: 'דירה', type: 'savings', monthly_target: 3500, sort_order: 20 },
  { name: 'השקעות', type: 'savings', monthly_target: 500, sort_order: 21 },
]

const STARTER_FUNDS = [
  { name: 'קרן חירום', monthly_allocation: 500 },
  { name: 'חופשה', monthly_allocation: 400 },
  { name: 'רכב — תחזוקה', monthly_allocation: 300 },
  { name: 'אלקטרוניקה', monthly_allocation: 150 },
  { name: 'מתנות', monthly_allocation: 100 },
]

export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'missing userId' }, { status: 400 })

  const sb = createServiceClient()

  // Upsert profile
  await sb.from('profiles').upsert({ id: userId, name: 'אורי' }, { onConflict: 'id' })

  // Insert categories (skip if already exist)
  const { error: catError } = await sb
    .from('budget_categories')
    .insert(STARTER_CATEGORIES.map(c => ({ ...c, user_id: userId, year: 1 })))
  if (catError && !catError.message.includes('duplicate')) {
    return NextResponse.json({ error: catError.message }, { status: 500 })
  }

  // Insert sinking funds (skip if already exist)
  const { error: fundError } = await sb
    .from('sinking_funds')
    .insert(STARTER_FUNDS.map(f => ({ ...f, user_id: userId })))
  if (fundError && !fundError.message.includes('duplicate')) {
    return NextResponse.json({ error: fundError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
