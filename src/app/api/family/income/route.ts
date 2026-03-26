import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const periodId = req.nextUrl.searchParams.get('period_id')
  const memberIdsParam = req.nextUrl.searchParams.get('member_ids')
  if (!periodId || !memberIdsParam) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }

  const memberIds = memberIdsParam.split(',').filter(Boolean)
  const sb = createServiceClient()

  // Verify the requesting user is in the same family as these members
  const { data: membership } = await sb
    .from('family_members')
    .select('family_id')
    .eq('user_id', authUser.id)
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

  // Get income for all members in this period
  const { data: incomeRows } = await sb
    .from('income')
    .select('*')
    .eq('period_id', Number(periodId))
    .in('user_id', memberIds)

  const result = memberIds.map(uid => {
    const inc = (incomeRows ?? []).find(i => i.user_id === uid)
    return {
      user_id: uid,
      display_name: profileMap.get(uid) ?? 'חבר/ת משפחה',
      salary: Number(inc?.salary ?? 0),
      bonus: Number(inc?.bonus ?? 0),
      other: Number(inc?.other ?? 0),
      total: Number(inc?.salary ?? 0) + Number(inc?.bonus ?? 0) + Number(inc?.other ?? 0),
    }
  })

  return NextResponse.json(result)
}
