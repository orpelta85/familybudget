import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin-server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, { maxRequests: 30, windowMs: 60_000, prefix: 'admin-users' })
  if (limited) return limited

  const { error } = await requireAdmin()
  if (error) return error

  try {
    const sb = createServiceClient()

    // Run all independent queries in parallel for speed
    const [usersResult, profilesResult, membershipsResult, familiesResult, kidsResult, plansResult, expensesResult] = await Promise.all([
      sb.auth.admin.listUsers({ perPage: 1000 }),
      sb.from('profiles').select('id, name'),
      sb.from('family_members').select('user_id, family_id, role'),
      sb.from('families').select('id, name, created_by'),
      sb.from('kids').select('id, name, family_id, birth_date'),
      sb.from('user_plans').select('user_id, plan, is_active'),
      sb.from('personal_expenses').select('user_id').limit(10000),
    ])

    if (usersResult.error) {
      console.error('Admin listUsers error:', usersResult.error.message)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    const users = usersResult.data?.users ?? []
    const profiles = profilesResult.data ?? []
    const memberships = membershipsResult.data ?? []
    const families = familiesResult.data ?? []
    const kids = kidsResult.data ?? []
    const plans = plansResult.data ?? []
    const expenses = expensesResult.data ?? []

    const profileMap = new Map(profiles.map(p => [p.id, p.name]))
    const membershipMap = new Map(memberships.map(m => [m.user_id, m]))

    // Family member counts + family member names
    const familyCounts = new Map<string, number>()
    const familyMembers = new Map<string, string[]>()
    for (const m of memberships) {
      familyCounts.set(m.family_id, (familyCounts.get(m.family_id) ?? 0) + 1)
      const memberName = profileMap.get(m.user_id) ?? m.user_id.slice(0, 8)
      if (!familyMembers.has(m.family_id)) familyMembers.set(m.family_id, [])
      familyMembers.get(m.family_id)!.push(memberName)
    }

    const familyNameMap = new Map(families.map(f => [f.id, f.name]))
    const familyCreatorMap = new Map(families.map(f => [f.id, f.created_by]))

    const familyKids = new Map<string, { name: string; birth_date: string }[]>()
    for (const k of kids) {
      if (!familyKids.has(k.family_id)) familyKids.set(k.family_id, [])
      familyKids.get(k.family_id)!.push({ name: k.name, birth_date: k.birth_date })
    }

    const planMap = new Map(plans.map(p => [p.user_id, p]))

    const expenseCountMap = new Map<string, number>()
    for (const e of expenses) {
      expenseCountMap.set(e.user_id, (expenseCountMap.get(e.user_id) ?? 0) + 1)
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const result = users.map(u => {
      const membership = membershipMap.get(u.id)
      const familyMemberCount = membership ? familyCounts.get(membership.family_id) ?? 0 : 0
      const plan = planMap.get(u.id)
      const isActive = u.last_sign_in_at ? new Date(u.last_sign_in_at) > new Date(sevenDaysAgo) : false

      const familyId = membership?.family_id
      return {
        id: u.id,
        email: u.email,
        name: profileMap.get(u.id) ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        family_id: familyId ?? null,
        family_name: familyId ? (familyNameMap.get(familyId) ?? 'משפחה') : null,
        family_role: membership?.role ?? null,
        family_member_count: familyMemberCount,
        family_member_names: familyId ? (familyMembers.get(familyId) ?? []) : [],
        family_kids: familyId ? (familyKids.get(familyId) ?? []) : [],
        is_family_creator: familyId ? familyCreatorMap.get(familyId) === u.id : false,
        has_family: !!membership,
        plan: plan?.plan ?? 'free',
        plan_active: plan?.is_active ?? true,
        expense_count: expenseCountMap.get(u.id) ?? 0,
        status: isActive ? 'active' : 'inactive',
        is_banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('Admin users endpoint error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
