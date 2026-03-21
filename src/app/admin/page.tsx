'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Activity, TrendingUp, Receipt, Crown,
  Search, ChevronDown, Ban, UserCheck, Download,
  ShieldCheck, ArrowUpRight, ArrowDownRight, Minus,
  Eye, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/queries/useUser'

const AdminGrowthChart = dynamic(
  () => import('@/components/dashboard/AdminGrowthChart').then(m => ({ default: m.AdminGrowthChart })),
  { loading: () => <ChartSkeleton height={200} />, ssr: false }
)

// ─── Types ─────────────────────────────────────────────────
interface AdminStats {
  totalUsers: number
  activeUsers: number
  totalFamilies: number
  totalExpenses: number
  totalIncome: number
  newUsersWeek: number
  newUsersMonth: number
  growthRate: number
  premiumUsers: number
  monthlyRegistrations: { month: string; count: number }[]
}

interface AdminUser {
  id: string
  email: string
  name: string | null
  created_at: string
  last_sign_in_at: string | null
  family_id: string | null
  family_name: string | null
  family_role: string | null
  family_member_count: number
  family_member_names: string[]
  family_kids: { name: string; birth_date: string }[]
  is_family_creator: boolean
  has_family: boolean
  plan: string
  plan_active: boolean
  expense_count: number
  status: 'active' | 'inactive'
  is_banned: boolean
}

interface ActivityItem {
  type: string
  message: string
  created_at: string
}

// ─── Hooks ─────────────────────────────────────────────────
function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Failed to load stats')
      return res.json()
    },
  })
}

function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to load users')
      return res.json()
    },
  })
}

function useAdminActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ['admin', 'activity'],
    queryFn: async () => {
      const res = await fetch('/api/admin/activity')
      if (!res.ok) throw new Error('Failed to load activity')
      return res.json()
    },
  })
}

function useChangePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success('תוכנית עודכנה')
    },
    onError: () => toast.error('שגיאה בעדכון תוכנית'),
  })
}

function useBlockUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, block }: { userId: string; block: boolean }) => {
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block }),
      })
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success('סטטוס משתמש עודכן')
    },
    onError: () => toast.error('שגיאה בעדכון משתמש'),
  })
}

// ─── Test Families for Impersonation ──────────────────────
const TEST_FAMILIES = [
  { name: 'משפחת כהן', desc: 'ממוצעת, 4 נפשות, 25K', email: 'avi.cohen@test.com', color: '250' },
  { name: 'משפחת לוי', desc: 'בגירעון, 5 נפשות, 18K', email: 'dani.levi@test.com', color: '27' },
  { name: 'עמית זהבי', desc: 'רווק חוסך, 16K', email: 'amit.zahavi@test.com', color: '145' },
  { name: 'משפחת רחמים', desc: 'מוציאים מעל ההכנסה, 20K', email: 'moshe.rachamim@test.com', color: '330' },
  { name: 'משפחת ביטון', desc: 'חוסכים לדירה, 22K', email: 'yonatan.biton@test.com', color: '80' },
  { name: 'משפחת שרון', desc: 'גדולה מסודרת, 6 נפשות, 31K', email: 'gilad.sharon@test.com', color: '200' },
  { name: 'משפחת אדלר', desc: 'גמלאים, דירה בבעלות, 16K', email: 'yaakov.adler@test.com', color: '55' },
]

// ─── Helpers ───────────────────────────────────────────────
const PLAN_LABELS: Record<string, string> = {
  free: 'חינם',
  premium: 'פרימיום',
  family: 'משפחתי',
  business: 'עסקי',
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-[oklch(0.22_0.01_250)] text-[oklch(0.65_0.01_250)]',
  premium: 'bg-[oklch(0.25_0.08_290)] text-[oklch(0.80_0.16_290)]',
  family: 'bg-[oklch(0.25_0.08_145)] text-[oklch(0.75_0.16_145)]',
  business: 'bg-[oklch(0.25_0.08_55)] text-[oklch(0.80_0.16_55)]',
}

const HE_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ']

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'אף פעם'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'עכשיו'
  if (minutes < 60) return `לפני ${minutes} דקות`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `לפני ${hours} שעות`
  const days = Math.floor(hours / 24)
  if (days < 30) return `לפני ${days} ימים`
  const months = Math.floor(days / 30)
  return `לפני ${months} חודשים`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function exportUsersCSV(users: AdminUser[]) {
  const header = 'ID,Email,Name,Plan,Status,Created,Last Login,Expenses,Family\n'
  const rows = users.map(u =>
    `${u.id},${u.email},${u.name ?? ''},${u.plan},${u.status},${u.created_at},${u.last_sign_in_at ?? ''},${u.expense_count},${u.has_family}`
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'users_export.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ─────────────────────────────────────────────
export default function AdminPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: users, isLoading: usersLoading } = useAdminUsers()
  const { data: activity } = useAdminActivity()
  const changePlan = useChangePlan()
  const blockUser = useBlockUser()

  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [familyFilter, setFamilyFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'last_sign_in_at' | 'plan'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [planMenuUser, setPlanMenuUser] = useState<string | null>(null)

  const tip = PAGE_TIPS.admin

  const filteredUsers = useMemo(() => {
    if (!users) return []
    let filtered = [...users]

    // Search
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(u =>
        (u.name?.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q)
      )
    }

    // Plan filter
    if (planFilter !== 'all') {
      filtered = filtered.filter(u => u.plan === planFilter)
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => u.status === statusFilter)
    }

    // Family filter
    if (familyFilter !== 'all') {
      if (familyFilter === 'has') filtered = filtered.filter(u => u.has_family)
      else filtered = filtered.filter(u => !u.has_family)
    }

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = (a.name ?? '').localeCompare(b.name ?? '')
      else if (sortBy === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else if (sortBy === 'last_sign_in_at') cmp = new Date(a.last_sign_in_at ?? 0).getTime() - new Date(b.last_sign_in_at ?? 0).getTime()
      else if (sortBy === 'plan') cmp = a.plan.localeCompare(b.plan)
      return sortDir === 'desc' ? -cmp : cmp
    })

    return filtered
  }, [users, search, planFilter, statusFilter, familyFilter, sortBy, sortDir])

  const chartData = useMemo(() => {
    if (!stats?.monthlyRegistrations) return []
    return stats.monthlyRegistrations.map(r => {
      const [, m] = r.month.split('-')
      return { name: HE_MONTHS[parseInt(m) - 1], users: r.count }
    })
  }, [stats])

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  if (statsLoading || usersLoading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck size={22} className="text-[oklch(0.65_0.18_290)]" />
          <h1 className="text-xl font-bold tracking-tight">פאנל ניהול</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-[100px] rounded-xl bg-[oklch(0.16_0.01_250)] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const conversionRate = stats && stats.totalUsers > 0
    ? ((stats.premiumUsers / stats.totalUsers) * 100).toFixed(1)
    : '0'

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={22} className="text-[oklch(0.65_0.18_290)]" />
        <h1 className="text-xl font-bold tracking-tight flex-1">פאנל ניהול</h1>
        <PageInfo title={tip.title} description={tip.description} tips={tip.tips} />
      </div>

      {/* ─── Section 1: KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KPICard
          label="סה״כ משתמשים"
          value={stats?.totalUsers ?? 0}
          sub={stats && stats.newUsersMonth > 0 ? `+${stats.newUsersMonth} החודש` : undefined}
          trend={stats?.growthRate}
          icon={<Users size={16} />}
          color="290"
        />
        <KPICard
          label="משתמשים פעילים"
          value={stats?.activeUsers ?? 0}
          sub={stats ? `${stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}% מהכלל` : undefined}
          icon={<Activity size={16} />}
          color="145"
        />
        <KPICard
          label="משפחות"
          value={stats?.totalFamilies ?? 0}
          icon={<Users size={16} />}
          color="250"
        />
        <KPICard
          label="הוצאות"
          value={stats?.totalExpenses ?? 0}
          icon={<Receipt size={16} />}
          color="27"
        />
        <KPICard
          label="פרימיום"
          value={stats?.premiumUsers ?? 0}
          sub={`${conversionRate}% המרה`}
          icon={<Crown size={16} />}
          color="55"
        />
      </div>

      {/* ─── Section 2: Growth Chart ─── */}
      <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4 mb-6">
        <h2 className="text-[14px] font-semibold text-[oklch(0.75_0.01_250)] mb-4">הרשמות חודשיות</h2>
        <div className="h-[200px]" dir="ltr">
          <AdminGrowthChart data={chartData} />
        </div>
      </div>

      {/* ─── Section 3: Users Table ─── */}
      <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-[14px] font-semibold text-[oklch(0.75_0.01_250)] flex-1">משתמשים</h2>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[oklch(0.45_0.01_250)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש..."
              className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-lg py-1.5 pr-8 pl-3 text-[12px] text-inherit w-[180px]"
            />
          </div>

          {/* Filters */}
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-lg py-1.5 px-2.5 text-[12px] text-inherit cursor-pointer"
          >
            <option value="all">כל התוכניות</option>
            <option value="free">חינם</option>
            <option value="premium">פרימיום</option>
            <option value="family">משפחתי</option>
            <option value="business">עסקי</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-lg py-1.5 px-2.5 text-[12px] text-inherit cursor-pointer"
          >
            <option value="all">כל הסטטוסים</option>
            <option value="active">פעיל</option>
            <option value="inactive">לא פעיל</option>
          </select>

          <select
            value={familyFilter}
            onChange={e => setFamilyFilter(e.target.value)}
            className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-lg py-1.5 px-2.5 text-[12px] text-inherit cursor-pointer"
          >
            <option value="all">כל המשתמשים</option>
            <option value="has">עם משפחה</option>
            <option value="no">יחיד</option>
          </select>

          {/* Export */}
          <button
            onClick={() => users && exportUsersCSV(users)}
            className="flex items-center gap-1.5 bg-[oklch(0.18_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-lg py-1.5 px-3 text-[12px] text-[oklch(0.65_0.01_250)] cursor-pointer hover:bg-[oklch(0.22_0.01_250)] transition-colors"
          >
            <Download size={13} />
            CSV
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[oklch(0.50_0.01_250)] text-right">
                <th className="py-2 px-2 font-medium">משתמש</th>
                <th className="py-2 px-2 font-medium cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                  <span className="flex items-center gap-1">הרשמה {sortBy === 'created_at' && <ChevronDown size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />}</span>
                </th>
                <th className="py-2 px-2 font-medium cursor-pointer select-none" onClick={() => toggleSort('last_sign_in_at')}>
                  <span className="flex items-center gap-1">כניסה אחרונה {sortBy === 'last_sign_in_at' && <ChevronDown size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />}</span>
                </th>
                <th className="py-2 px-2 font-medium">משפחה</th>
                <th className="py-2 px-2 font-medium cursor-pointer select-none" onClick={() => toggleSort('plan')}>
                  <span className="flex items-center gap-1">תוכנית {sortBy === 'plan' && <ChevronDown size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />}</span>
                </th>
                <th className="py-2 px-2 font-medium">הוצאות</th>
                <th className="py-2 px-2 font-medium">סטטוס</th>
                <th className="py-2 px-2 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-t border-[oklch(0.20_0.01_250)] hover:bg-[oklch(0.16_0.01_250)] transition-colors">
                  {/* User */}
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[oklch(0.25_0.08_290)] text-[oklch(0.80_0.16_290)] flex items-center justify-center text-[11px] font-bold shrink-0">
                        {(u.name ?? u.email)?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-[oklch(0.85_0.01_250)]">{u.name ?? 'ללא שם'}</div>
                        <div className="text-[11px] text-[oklch(0.50_0.01_250)]" dir="ltr">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  {/* Registration */}
                  <td className="py-2.5 px-2 text-[oklch(0.65_0.01_250)]">{formatDate(u.created_at)}</td>
                  {/* Last login */}
                  <td className="py-2.5 px-2 text-[oklch(0.65_0.01_250)]">{relativeTime(u.last_sign_in_at)}</td>
                  {/* Family */}
                  <td className="py-2.5 px-2 text-[oklch(0.65_0.01_250)]">
                    {u.has_family ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-[oklch(0.85_0.01_250)] font-medium">{u.family_name ?? 'משפחה'}</span>
                          {u.is_family_creator && <span className="text-[9px] bg-[oklch(0.35_0.15_250)] text-[oklch(0.85_0.15_250)] px-1.5 py-0.5 rounded-full">מנהל</span>}
                        </div>
                        <div className="text-[10px] text-[oklch(0.55_0.01_250)]">
                          {u.family_member_names.join(', ')}
                          {u.family_kids.length > 0 && (
                            <span> + {u.family_kids.length} ילדים ({u.family_kids.map(k => k.name).join(', ')})</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[oklch(0.45_0.01_250)]">יחיד</span>
                    )}
                  </td>
                  {/* Plan */}
                  <td className="py-2.5 px-2">
                    <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-medium', PLAN_COLORS[u.plan] ?? PLAN_COLORS.free)}>
                      {PLAN_LABELS[u.plan] ?? u.plan}
                    </span>
                  </td>
                  {/* Expense count */}
                  <td className="py-2.5 px-2 text-[oklch(0.65_0.01_250)]">{u.expense_count.toLocaleString()}</td>
                  {/* Status */}
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('w-2 h-2 rounded-full', u.is_banned ? 'bg-[oklch(0.55_0.22_27)]' : u.status === 'active' ? 'bg-[oklch(0.65_0.20_145)]' : 'bg-[oklch(0.40_0.01_250)]')} />
                      <span className="text-[oklch(0.60_0.01_250)]">
                        {u.is_banned ? 'חסום' : u.status === 'active' ? 'פעיל' : 'לא פעיל'}
                      </span>
                    </div>
                  </td>
                  {/* Actions */}
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      {/* Plan dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setPlanMenuUser(planMenuUser === u.id ? null : u.id)}
                          className="bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[11px] text-[oklch(0.65_0.01_250)] cursor-pointer hover:bg-[oklch(0.24_0.01_250)] transition-colors"
                          title="שנה תוכנית"
                        >
                          <Crown size={12} />
                        </button>
                        {planMenuUser === u.id && (
                          <div className="absolute top-full left-0 mt-1 bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg p-1 min-w-[120px] z-30 shadow-[0_4px_16px_oklch(0_0_0/0.4)]">
                            {['free', 'premium', 'family', 'business'].map(p => (
                              <button
                                key={p}
                                onClick={() => { changePlan.mutate({ userId: u.id, plan: p }); setPlanMenuUser(null) }}
                                className={cn(
                                  'block w-full text-right px-3 py-1.5 rounded-md text-[12px] bg-transparent border-none cursor-pointer transition-colors',
                                  u.plan === p ? 'text-[oklch(0.80_0.16_290)] bg-[oklch(0.22_0.03_290)]' : 'text-[oklch(0.70_0.01_250)] hover:bg-[oklch(0.22_0.01_250)]'
                                )}
                              >
                                {PLAN_LABELS[p]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Block/unblock */}
                      <button
                        onClick={() => blockUser.mutate({ userId: u.id, block: !u.is_banned })}
                        className={cn(
                          'border rounded-md px-2 py-1 text-[11px] cursor-pointer transition-colors',
                          u.is_banned
                            ? 'bg-[oklch(0.22_0.04_145)] border-[oklch(0.30_0.06_145)] text-[oklch(0.70_0.16_145)] hover:bg-[oklch(0.26_0.06_145)]'
                            : 'bg-[oklch(0.20_0.01_250)] border-[oklch(0.28_0.01_250)] text-[oklch(0.55_0.01_250)] hover:bg-[oklch(0.22_0.03_27)] hover:text-[oklch(0.65_0.18_27)] hover:border-[oklch(0.30_0.06_27)]'
                        )}
                        title={u.is_banned ? 'שחרר חסימה' : 'חסום משתמש'}
                      >
                        {u.is_banned ? <UserCheck size={12} /> : <Ban size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-[oklch(0.45_0.01_250)] text-[13px]">לא נמצאו משתמשים</div>
          )}
        </div>
      </div>

      {/* ─── Section 4: Activity Feed ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4">
          <h2 className="text-[14px] font-semibold text-[oklch(0.75_0.01_250)] mb-3">פעילות אחרונה</h2>
          <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto">
            {(activity ?? []).map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 px-2.5 rounded-lg hover:bg-[oklch(0.16_0.01_250)] transition-colors">
                <div className={cn(
                  'w-2 h-2 rounded-full mt-1.5 shrink-0',
                  a.type === 'expense' ? 'bg-[oklch(0.65_0.18_27)]' :
                  a.type === 'goal' ? 'bg-[oklch(0.65_0.18_145)]' :
                  'bg-[oklch(0.65_0.18_290)]'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[oklch(0.78_0.01_250)]">{a.message}</div>
                  <div className="text-[11px] text-[oklch(0.45_0.01_250)] mt-0.5">{relativeTime(a.created_at)}</div>
                </div>
              </div>
            ))}
            {!activity?.length && (
              <div className="text-[12px] text-[oklch(0.45_0.01_250)] text-center py-4">אין פעילות</div>
            )}
          </div>
        </div>

        {/* ─── Section 5: Platform Health ─── */}
        <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4">
          <h2 className="text-[14px] font-semibold text-[oklch(0.75_0.01_250)] mb-3">בריאות הפלטפורמה</h2>
          <div className="flex flex-col gap-2">
            <HealthRow label="סה״כ רשומות הוצאות" value={(stats?.totalExpenses ?? 0).toLocaleString()} />
            <HealthRow label="סה״כ רשומות הכנסה" value={(stats?.totalIncome ?? 0).toLocaleString()} />
            <HealthRow label="משתמשים חדשים השבוע" value={String(stats?.newUsersWeek ?? 0)} />
            <HealthRow label="משתמשים חדשים החודש" value={String(stats?.newUsersMonth ?? 0)} />
            <HealthRow label="שיעור צמיחה חודשי" value={`${((stats?.growthRate ?? 0) * 100).toFixed(0)}%`} />
            <HealthRow label="אחוז משתמשים עם משפחה" value={stats && stats.totalUsers > 0 ? `${Math.round(((stats.totalFamilies * 2) / stats.totalUsers) * 100)}%` : '0%'} />
          </div>
        </div>
      </div>

      {/* ─── Section 6: Test Families (Impersonation) ─── */}
      <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4 mb-6">
        <h2 className="text-[14px] font-semibold text-[oklch(0.75_0.01_250)] mb-1">משפחות לדוגמה</h2>
        <p className="text-[11px] text-[oklch(0.45_0.01_250)] mb-4">התחבר כמשפחת בדיקה כדי לראות איך האפליקציה נראית עם נתונים שונים</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {TEST_FAMILIES.map(fam => (
            <button
              key={fam.email}
              onClick={async () => {
                const sb = createClient()
                const { data: { user: currentUser } } = await sb.auth.getUser()
                if (currentUser?.email) {
                  localStorage.setItem('admin_original_email', currentUser.email)
                }
                const { error } = await sb.auth.signInWithPassword({
                  email: fam.email,
                  password: 'Test123456!',
                })
                if (error) {
                  toast.error(`שגיאה בהתחברות: ${error.message}`)
                } else {
                  toast.success(`מחובר כ: ${fam.name}`)
                  window.location.href = '/'
                }
              }}
              className={cn(
                'flex flex-col items-start gap-1.5 p-3 rounded-xl border cursor-pointer transition-all text-right',
                'bg-[oklch(0.16_0.01_250)] border-[oklch(0.24_0.01_250)]',
                'hover:bg-[oklch(0.20_0.02_250)] hover:border-[oklch(0.32_0.04_250)]'
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <div className={`w-2.5 h-2.5 rounded-full bg-[oklch(0.60_0.18_${fam.color})]`} />
                <span className="text-[13px] font-semibold text-[oklch(0.85_0.01_250)]">{fam.name}</span>
              </div>
              <span className="text-[11px] text-[oklch(0.50_0.01_250)]">{fam.desc}</span>
              <div className="flex items-center gap-1.5 mt-1">
                <Eye size={12} className="text-[oklch(0.50_0.01_250)]" />
                <span className="text-[11px] text-[oklch(0.50_0.01_250)]">צפה כמשפחה</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Section 7: Quick Actions ─── */}
      <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4">
        <h2 className="text-[14px] font-semibold text-[oklch(0.75_0.01_250)] mb-3">פעולות מהירות</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => users && exportUsersCSV(users)}
            className="flex items-center gap-2 bg-[oklch(0.20_0.02_290)] border border-[oklch(0.28_0.04_290)] rounded-lg py-2 px-4 text-[13px] text-[oklch(0.80_0.14_290)] cursor-pointer hover:bg-[oklch(0.24_0.04_290)] transition-colors"
          >
            <Download size={15} />
            ייצוא כל המשתמשים ל-CSV
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────

function KPICard({ label, value, sub, trend, icon, color }: {
  label: string
  value: number
  sub?: string
  trend?: number
  icon: React.ReactNode
  color: string
}) {
  const TrendIcon = trend !== undefined
    ? (trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus)
    : null

  return (
    <div className={`bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`text-[oklch(0.65_0.18_${color})]`}>
          {icon}
        </div>
        <span className="text-[11px] text-[oklch(0.50_0.01_250)] font-medium">{label}</span>
      </div>
      <div className="text-[22px] font-bold text-[oklch(0.90_0.01_250)] tracking-tight">
        {value.toLocaleString()}
      </div>
      {(sub || TrendIcon) && (
        <div className="flex items-center gap-1.5 mt-1">
          {TrendIcon && (
            <TrendIcon size={12} className={
              (trend ?? 0) > 0 ? 'text-[oklch(0.65_0.18_145)]' :
              (trend ?? 0) < 0 ? 'text-[oklch(0.65_0.18_27)]' :
              'text-[oklch(0.50_0.01_250)]'
            } />
          )}
          {sub && <span className="text-[11px] text-[oklch(0.50_0.01_250)]">{sub}</span>}
        </div>
      )}
    </div>
  )
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-[oklch(0.16_0.01_250)]">
      <span className="text-[12px] text-[oklch(0.60_0.01_250)]">{label}</span>
      <span className="text-[12px] font-semibold text-[oklch(0.80_0.01_250)]">{value}</span>
    </div>
  )
}
