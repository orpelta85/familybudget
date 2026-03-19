import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

const STARTER_CATEGORIES = [
  { name: 'שכירות', type: 'fixed', monthly_target: 2500, sort_order: 1 },
  { name: 'ארנונה', type: 'fixed', monthly_target: 150, sort_order: 2 },
  { name: 'חשמל', type: 'fixed', monthly_target: 100, sort_order: 3 },
  { name: 'מים+גז', type: 'fixed', monthly_target: 75, sort_order: 4 },
  { name: 'ועד בית', type: 'fixed', monthly_target: 125, sort_order: 5 },
  { name: 'ביטוחים', type: 'fixed', monthly_target: 200, sort_order: 6 },
  { name: 'הלוואת רכב', type: 'fixed', monthly_target: 800, sort_order: 7 },
  { name: 'מנויים', type: 'fixed', monthly_target: 100, sort_order: 8 },
  { name: 'מכולת', type: 'variable', monthly_target: 600, sort_order: 9 },
  { name: 'אוכל בחוץ', type: 'variable', monthly_target: 500, sort_order: 10 },
  { name: 'בגדים', type: 'variable', monthly_target: 300, sort_order: 11 },
  { name: 'בריאות', type: 'variable', monthly_target: 200, sort_order: 12 },
  { name: 'פארם', type: 'variable', monthly_target: 150, sort_order: 13 },
  { name: 'תחבורה', type: 'variable', monthly_target: 400, sort_order: 14 },
  { name: 'ספורט', type: 'variable', monthly_target: 200, sort_order: 15 },
  { name: 'מוזיקה', type: 'variable', monthly_target: 100, sort_order: 16 },
  { name: 'בילויים', type: 'variable', monthly_target: 300, sort_order: 17 },
  { name: 'טיפוח', type: 'variable', monthly_target: 150, sort_order: 18 },
  { name: 'כלבים', type: 'variable', monthly_target: 200, sort_order: 19 },
  { name: 'מוצרים לבית', type: 'variable', monthly_target: 200, sort_order: 20 },
  { name: 'השקעות', type: 'savings', monthly_target: 500, sort_order: 21 },
  { name: 'אימון אישי', type: 'variable', monthly_target: 400, sort_order: 22 },
  { name: 'דוגווקרס', type: 'variable', monthly_target: 300, sort_order: 23 },
  { name: 'שונות', type: 'variable', monthly_target: 200, sort_order: 24 },
  { name: 'רפואה', type: 'variable', monthly_target: 200, sort_order: 25 },
]

const STARTER_FUNDS = [
  { name: 'קרן חירום', monthly_allocation: 500, yearly_target: 6000 },
  { name: 'חופשה', monthly_allocation: 400, yearly_target: 4800 },
  { name: 'רכב — תחזוקה', monthly_allocation: 300, yearly_target: 3600 },
  { name: 'אלקטרוניקה', monthly_allocation: 150, yearly_target: 1800 },
  { name: 'מתנות', monthly_allocation: 100, yearly_target: 1200 },
]

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser()
  const { userId, familyName, inviteCode, name: requestName } = await req.json()
  if (!userId) return NextResponse.json({ error: 'missing userId' }, { status: 400 })

  if (!authUser || authUser.id !== userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()

  // Upsert profile — use provided name, fall back to email username
  const profileName = requestName || authUser.email?.split('@')[0] || 'משתמש'
  await sb.from('profiles').upsert({ id: userId, name: profileName }, { onConflict: 'id' })

  // Family: join existing or create new
  if (inviteCode) {
    // Join existing family via invite code
    const { data: family, error: famErr } = await sb
      .from('families')
      .select('id')
      .eq('invite_code', inviteCode)
      .single()
    if (famErr || !family) {
      return NextResponse.json({ error: 'קוד הזמנה לא תקין' }, { status: 400 })
    }
    const { error: joinErr } = await sb
      .from('family_members')
      .insert({ family_id: family.id, user_id: userId, role: 'member' })
    if (joinErr && !joinErr.message.includes('duplicate')) {
      return NextResponse.json({ error: joinErr.message }, { status: 500 })
    }
  } else {
    // Create new family (admin)
    const name = familyName || 'המשפחה שלי'
    const { data: existingMember } = await sb
      .from('family_members')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (!existingMember) {
      const { data: family, error: famErr } = await sb
        .from('families')
        .insert({ name, created_by: userId })
        .select()
        .single()
      if (famErr) return NextResponse.json({ error: famErr.message }, { status: 500 })

      await sb.from('family_members').insert({
        family_id: family.id,
        user_id: userId,
        role: 'admin',
        show_personal_to_family: true,
      })
    }
  }

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
