import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin-server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, { maxRequests: 30, windowMs: 60_000, prefix: 'admin-stats' })
  if (limited) return limited

  const { error } = await requireAdmin()
  if (error) return error

  const sb = createServiceClient()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // Total users
  const { data: allUsers } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const users = allUsers?.users ?? []
  const totalUsers = users.length

  // Active users (7 days)
  const activeUsers = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) > new Date(sevenDaysAgo)).length

  // New users this week / month
  const newUsersWeek = users.filter(u => new Date(u.created_at) > new Date(sevenDaysAgo)).length
  const newUsersMonth = users.filter(u => new Date(u.created_at) > new Date(thirtyDaysAgo)).length
  const newUsersPrevMonth = users.filter(u => {
    const d = new Date(u.created_at)
    return d > new Date(sixtyDaysAgo) && d <= new Date(thirtyDaysAgo)
  }).length

  // Growth rate
  const growthRate = newUsersPrevMonth > 0 ? ((newUsersMonth - newUsersPrevMonth) / newUsersPrevMonth) : 0

  // Total families
  const { count: totalFamilies } = await sb.from('families').select('*', { count: 'exact', head: true })

  // Total expenses
  const { count: totalExpenses } = await sb.from('personal_expenses').select('*', { count: 'exact', head: true })

  // Total income records
  const { count: totalIncome } = await sb.from('income').select('*', { count: 'exact', head: true })

  // Premium users
  const { count: premiumUsers } = await sb.from('user_plans').select('*', { count: 'exact', head: true }).neq('plan', 'free').eq('is_active', true)

  // Monthly registration data (last 12 months)
  const monthlyRegistrations: { month: string; count: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const count = users.filter(u => {
      const cd = new Date(u.created_at)
      return cd >= d && cd < nextMonth
    }).length
    monthlyRegistrations.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      count,
    })
  }

  return NextResponse.json({
    totalUsers,
    activeUsers,
    totalFamilies: totalFamilies ?? 0,
    totalExpenses: totalExpenses ?? 0,
    totalIncome: totalIncome ?? 0,
    newUsersWeek,
    newUsersMonth,
    growthRate,
    premiumUsers: premiumUsers ?? 0,
    monthlyRegistrations,
  })
}
