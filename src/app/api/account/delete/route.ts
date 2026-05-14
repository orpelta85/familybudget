import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

// DELETE /api/account/delete - permanently delete the user's account and all data
export async function DELETE(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'DELETE') {
    return NextResponse.json({ error: 'must confirm with DELETE' }, { status: 400 })
  }

  const userId = authUser.id
  const sb = createServiceClient()

  // Delete user-owned data. Order matters - clear children before parents.
  // pension chain
  const { data: reports } = await sb.from('pension_reports').select('id').eq('user_id', userId)
  const reportIds = (reports ?? []).map(r => r.id)
  if (reportIds.length) {
    await sb.from('pension_products').delete().in('report_id', reportIds)
    await sb.from('pension_health_coverages').delete().in('report_id', reportIds)
  }
  await sb.from('pension_reports').delete().eq('user_id', userId)

  // goals + deposits
  const { data: userGoals } = await sb.from('goals').select('id').eq('user_id', userId)
  const goalIds = (userGoals ?? []).map(g => g.id)
  if (goalIds.length) await sb.from('goal_deposits').delete().in('goal_id', goalIds)
  await sb.from('goals').delete().eq('user_id', userId)

  // mortgages + tracks
  const { data: userMortgages } = await sb.from('mortgages').select('id').eq('user_id', userId)
  const mortgageIds = (userMortgages ?? []).map(m => m.id)
  if (mortgageIds.length) await sb.from('mortgage_tracks').delete().in('mortgage_id', mortgageIds)
  await sb.from('mortgages').delete().eq('user_id', userId)

  // All other user-scoped tables
  await Promise.all([
    sb.from('sinking_fund_transactions').delete().eq('user_id', userId),
    sb.from('sinking_funds').delete().eq('user_id', userId),
    sb.from('personal_expenses').delete().eq('user_id', userId),
    sb.from('income').delete().eq('user_id', userId),
    sb.from('shared_expenses').delete().eq('user_id', userId),
    sb.from('kids').delete().eq('user_id', userId),
    sb.from('net_worth_entries').delete().eq('user_id', userId),
    sb.from('net_worth_snapshots').delete().eq('user_id', userId),
    sb.from('debts').delete().eq('user_id', userId),
    sb.from('insurance_policies').delete().eq('user_id', userId),
    sb.from('subscriptions').delete().eq('user_id', userId),
    sb.from('budget_categories').delete().eq('user_id', userId),
    sb.from('category_rules').delete().eq('user_id', userId),
    sb.from('periods').delete().eq('user_id', userId),
    sb.from('family_members').delete().eq('user_id', userId),
    sb.from('profiles').delete().eq('id', userId),
  ])

  // Finally delete the auth user itself
  const { error: authDelErr } = await sb.auth.admin.deleteUser(userId)
  if (authDelErr) {
    return NextResponse.json({ error: `auth delete failed: ${authDelErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
