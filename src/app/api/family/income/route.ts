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
  const periodIdsParam = req.nextUrl.searchParams.get('period_ids')
  // Range mode: caller passes the ids of every period overlapping the range.
  const rangePeriodIds = (periodIdsParam ?? '')
    .split(',')
    .map(s => Number(s))
    .filter(n => Number.isFinite(n) && n > 0)
  const rangeMode = rangePeriodIds.length > 0
  if ((!periodId && !rangeMode) || !memberIdsParam) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }

  const memberIds = memberIdsParam.split(',').filter(Boolean)
  const sb = createServiceClient()

  // Verify the requesting user is in the same family as these members
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

  // Get income for all members — by period, or across overlapping periods in range mode.
  let incomeQuery = sb
    .from('income')
    .select('*')
    .in('user_id', memberIds)
  if (rangeMode) {
    incomeQuery = incomeQuery.in('period_id', rangePeriodIds)
  } else {
    incomeQuery = incomeQuery.eq('period_id', Number(periodId))
  }
  const { data: incomeRows } = await incomeQuery

  const result = memberIds.map(uid => {
    // Range mode may return several rows per member — sum them all.
    const userIncome = (incomeRows ?? []).filter(i => i.user_id === uid)
    const salary = userIncome.reduce((s, i) => s + Number(i.salary ?? 0), 0)
    const bonus = userIncome.reduce((s, i) => s + Number(i.bonus ?? 0), 0)
    const other = userIncome.reduce((s, i) => s + Number(i.other ?? 0), 0)
    const total = salary + bonus + other
    const isCurrentUser = uid === effective.userId
    const privacyMode = isCurrentUser ? 'full_access' : (privacyMap.get(uid) ?? 'summary_only')

    if (privacyMode === 'full_access') {
      return {
        user_id: uid,
        display_name: profileMap.get(uid) ?? 'חבר/ת משפחה',
        salary,
        bonus,
        other,
        total,
        privacy: 'full' as const,
      }
    }

    // summary_only or hidden — return only total, no breakdown
    return {
      user_id: uid,
      display_name: profileMap.get(uid) ?? 'חבר/ת משפחה',
      salary: 0,
      bonus: 0,
      other: 0,
      total,
      privacy: privacyMode as 'summary' | 'hidden',
    }
  })

  return NextResponse.json(result)
}
