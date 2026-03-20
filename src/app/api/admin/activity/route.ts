import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const sb = createServiceClient()

  // Get profiles for name lookup
  const { data: profiles } = await sb.from('profiles').select('id, name')
  const nameMap = new Map((profiles ?? []).map(p => [p.id, p.name]))

  const activities: { type: string; message: string; created_at: string }[] = []

  // Recent expenses (last 50)
  const { data: recentExpenses } = await sb
    .from('personal_expenses')
    .select('user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  // Group expenses by user + day
  const expenseGroups = new Map<string, { user_id: string; count: number; created_at: string }>()
  for (const e of recentExpenses ?? []) {
    const day = e.created_at?.split('T')[0] ?? ''
    const key = `${e.user_id}-${day}`
    if (!expenseGroups.has(key)) {
      expenseGroups.set(key, { user_id: e.user_id, count: 0, created_at: e.created_at })
    }
    expenseGroups.get(key)!.count++
  }
  for (const g of expenseGroups.values()) {
    const name = nameMap.get(g.user_id) ?? 'משתמש'
    activities.push({
      type: 'expense',
      message: `${name} הוסיף/ה ${g.count} הוצאות`,
      created_at: g.created_at,
    })
  }

  // Recent goals
  const { data: recentGoals } = await sb
    .from('savings_goals')
    .select('user_id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  for (const g of recentGoals ?? []) {
    const name = nameMap.get(g.user_id) ?? 'משתמש'
    activities.push({
      type: 'goal',
      message: `${name} יצר/ה יעד חדש: ${g.name}`,
      created_at: g.created_at,
    })
  }

  // Recent user registrations
  const { data: allUsers } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const recentUsers = (allUsers?.users ?? [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  for (const u of recentUsers) {
    activities.push({
      type: 'registration',
      message: `משתמש חדש נרשם: ${u.email}`,
      created_at: u.created_at,
    })
  }

  // Sort all by date desc
  activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json(activities.slice(0, 30))
}
