import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getEffectiveUserId } from '@/lib/impersonate-server'

export async function GET(req: NextRequest) {
  const effective = await getEffectiveUserId(req)
  if (!effective) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const periodId = req.nextUrl.searchParams.get('period_id')
  const memberIdsParam = req.nextUrl.searchParams.get('member_ids')
  if (!periodId || !memberIdsParam) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }

  const memberIds = memberIdsParam.split(',').filter(Boolean)
  const sb = createServiceClient()

  // Verify the requesting user is in the same family
  const { data: membership } = await sb
    .from('family_members')
    .select('family_id')
    .eq('user_id', effective.userId)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'no family found' }, { status: 404 })
  }

  // Validate all requested memberIds belong to caller's family
  const { data: familyMembers } = await sb
    .from('family_members')
    .select('user_id')
    .eq('family_id', membership.family_id)

  const validMemberIds = new Set((familyMembers ?? []).map(m => m.user_id))
  const invalidIds = memberIds.filter(id => !validMemberIds.has(id))
  if (invalidIds.length > 0) {
    return NextResponse.json({ error: 'unauthorized member_ids' }, { status: 403 })
  }

  // Get display names
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, name')
    .in('id', memberIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.name]))

  // Get privacy settings for all members
  const { data: privacyRows } = await sb
    .from('family_members')
    .select('user_id, privacy_mode')
    .eq('family_id', membership.family_id)
    .in('user_id', memberIds)

  const privacyMap = new Map((privacyRows ?? []).map(m => [m.user_id, m.privacy_mode as string]))

  // Get expenses for all members in this period
  const { data: expenseRows } = await sb
    .from('personal_expenses')
    .select('*, budget_categories(*)')
    .eq('period_id', Number(periodId))
    .in('user_id', memberIds)
    .order('created_at', { ascending: false })

  // Group by user — respect privacy settings
  const result = memberIds.map(uid => {
    const userExpenses = (expenseRows ?? []).filter(e => e.user_id === uid)
    const total = userExpenses.reduce((s, e) => s + Number(e.amount), 0)
    const isCurrentUser = uid === effective.userId
    const privacyMode = isCurrentUser ? 'full_access' : (privacyMap.get(uid) ?? 'summary_only')

    if (privacyMode === 'full_access') {
      // Full access — return all transactions
      return {
        user_id: uid,
        display_name: profileMap.get(uid) ?? 'חבר/ת משפחה',
        expenses: userExpenses,
        total,
        privacy: 'full' as const,
      }
    }

    if (privacyMode === 'hidden') {
      // Hidden — return only total, no categories or transactions
      return {
        user_id: uid,
        display_name: profileMap.get(uid) ?? 'חבר/ת משפחה',
        expenses: [],
        categories: [],
        total,
        privacy: 'hidden' as const,
      }
    }

    // summary_only — return category aggregates, no transaction details
    const categoryTotals = new Map<string, { name: string; total: number }>()
    for (const e of userExpenses) {
      const catName = e.budget_categories?.name ?? 'אחר'
      const existing = categoryTotals.get(catName) ?? { name: catName, total: 0 }
      existing.total += Number(e.amount)
      categoryTotals.set(catName, existing)
    }

    return {
      user_id: uid,
      display_name: profileMap.get(uid) ?? 'חבר/ת משפחה',
      expenses: [],
      categories: Array.from(categoryTotals.values()),
      total,
      privacy: 'summary' as const,
    }
  })

  return NextResponse.json(result)
}
