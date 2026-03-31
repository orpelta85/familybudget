import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getEffectiveUserId } from '@/lib/impersonate-server'

export async function GET(req: NextRequest) {
  const effective = await getEffectiveUserId(req)
  if (!effective) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const periodId = req.nextUrl.searchParams.get('period_id')
  if (!periodId) {
    return NextResponse.json({ error: 'missing period_id' }, { status: 400 })
  }

  const sb = createServiceClient()

  // Get user's family membership
  const { data: membership } = await sb
    .from('family_members')
    .select('family_id')
    .eq('user_id', effective.userId)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'no family found' }, { status: 404 })
  }

  // Get all family members
  const { data: members } = await sb
    .from('family_members')
    .select('user_id, role, show_personal_to_family, privacy_mode')
    .eq('family_id', membership.family_id)
    .order('joined_at')

  if (!members || members.length === 0) {
    return NextResponse.json({ error: 'no members found' }, { status: 404 })
  }

  const memberIds = members.map(m => m.user_id)

  // Get display names from profiles
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, name')
    .in('id', memberIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.name]))

  // Get income for all members in this period
  const { data: incomeRows } = await sb
    .from('income')
    .select('user_id, salary, bonus, other')
    .eq('period_id', Number(periodId))
    .in('user_id', memberIds)

  const incomeMap = new Map(
    (incomeRows ?? []).map(i => [i.user_id, Number(i.salary) + Number(i.bonus) + Number(i.other)])
  )

  // Get personal expenses for all members in this period
  const { data: expenseRows } = await sb
    .from('personal_expenses')
    .select('user_id, amount')
    .eq('period_id', Number(periodId))
    .in('user_id', memberIds)

  const expenseMap = new Map<string, number>()
  for (const e of expenseRows ?? []) {
    expenseMap.set(e.user_id, (expenseMap.get(e.user_id) ?? 0) + Number(e.amount))
  }

  // Get shared expenses for this family in this period
  const { data: sharedRows } = await sb
    .from('shared_expenses')
    .select('total_amount')
    .eq('family_id', membership.family_id)
    .eq('period_id', Number(periodId))

  const totalSharedExpenses = (sharedRows ?? []).reduce((s, e) => s + Number(e.total_amount), 0)

  // Build per-member data
  let totalIncome = 0
  let totalPersonalExpenses = 0

  const memberData = members.map(m => {
    const income = incomeMap.get(m.user_id) ?? 0
    const personalExpenses = expenseMap.get(m.user_id) ?? 0
    const isCurrentUser = m.user_id === effective.userId
    const privacyMode = isCurrentUser ? 'full_access' : ((m as Record<string, unknown>).privacy_mode as string ?? 'summary_only')

    totalIncome += income
    totalPersonalExpenses += personalExpenses

    return {
      user_id: m.user_id,
      display_name: profileMap.get(m.user_id) ?? 'חבר/ת משפחה',
      income: privacyMode !== 'hidden' ? income : undefined,
      personal_expenses: privacyMode !== 'hidden' ? personalExpenses : undefined,
      show_details: privacyMode === 'full_access',
      privacy_mode: privacyMode,
    }
  })

  return NextResponse.json({
    total_income: totalIncome,
    total_personal_expenses: totalPersonalExpenses,
    total_shared_expenses: totalSharedExpenses,
    members: memberData,
  })
}
