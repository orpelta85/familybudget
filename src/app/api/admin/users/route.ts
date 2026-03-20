import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const sb = createServiceClient()

  const { data: allUsers } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const users = allUsers?.users ?? []

  // Get profiles
  const { data: profiles } = await sb.from('profiles').select('id, name')
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.name]))

  // Get family membership
  const { data: memberships } = await sb.from('family_members').select('user_id, family_id, role')
  const membershipMap = new Map((memberships ?? []).map(m => [m.user_id, m]))

  // Family member counts
  const familyCounts = new Map<string, number>()
  for (const m of memberships ?? []) {
    familyCounts.set(m.family_id, (familyCounts.get(m.family_id) ?? 0) + 1)
  }

  // Get plans
  const { data: plans } = await sb.from('user_plans').select('user_id, plan, is_active')
  const planMap = new Map((plans ?? []).map(p => [p.user_id, p]))

  // Get expense counts per user
  const expenseCountMap = new Map<string, number>()
  const { data: expenses } = await sb.from('personal_expenses').select('user_id')
  if (expenses) {
    for (const e of expenses) {
      expenseCountMap.set(e.user_id, (expenseCountMap.get(e.user_id) ?? 0) + 1)
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const result = users.map(u => {
    const membership = membershipMap.get(u.id)
    const familyMemberCount = membership ? familyCounts.get(membership.family_id) ?? 0 : 0
    const plan = planMap.get(u.id)
    const isActive = u.last_sign_in_at ? new Date(u.last_sign_in_at) > new Date(sevenDaysAgo) : false

    return {
      id: u.id,
      email: u.email,
      name: profileMap.get(u.id) ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      family_member_count: familyMemberCount,
      has_family: !!membership,
      plan: plan?.plan ?? 'free',
      plan_active: plan?.is_active ?? true,
      expense_count: expenseCountMap.get(u.id) ?? 0,
      status: isActive ? 'active' : 'inactive',
      is_banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
    }
  })

  return NextResponse.json(result)
}
