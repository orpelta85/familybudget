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

  // Verify the requesting user is in the same family
  const { data: membership } = await sb
    .from('family_members')
    .select('family_id')
    .eq('user_id', authUser.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'no family found' }, { status: 404 })
  }

  // Get display names
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, name')
    .in('id', memberIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.name]))

  // Get expenses for all members in this period
  const { data: expenseRows } = await sb
    .from('personal_expenses')
    .select('*, budget_categories(*)')
    .eq('period_id', Number(periodId))
    .in('user_id', memberIds)
    .order('created_at', { ascending: false })

  // Group by user
  const result = memberIds.map(uid => {
    const userExpenses = (expenseRows ?? []).filter(e => e.user_id === uid)
    const total = userExpenses.reduce((s, e) => s + e.amount, 0)
    return {
      user_id: uid,
      display_name: profileMap.get(uid) ?? 'חבר/ת משפחה',
      expenses: userExpenses,
      total,
    }
  })

  return NextResponse.json(result)
}
