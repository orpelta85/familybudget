'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome, useAllIncome } from '@/lib/queries/useIncome'
import { usePersonalExpenses, useBudgetCategories, useAllPersonalExpenses } from '@/lib/queries/useExpenses'
import { useSharedExpenses, useAllSharedExpenses } from '@/lib/queries/useShared'
import { useProfile, useSplitFraction } from '@/lib/queries/useProfile'
import { useSavingsGoals, useAllGoalDeposits } from '@/lib/queries/useGoals'
import { useSinkingFunds, useAllSinkingTransactions } from '@/lib/queries/useSinking'
import { usePensionReports } from '@/lib/queries/usePension'
import { useNetWorthEntries } from '@/lib/queries/useNetWorth'
import { useHasSetup } from '@/lib/queries/useSetup'
import { useAlerts, useMarkAlertRead } from '@/lib/queries/useAlerts'
import { useAlertGeneration } from '@/lib/hooks/useGenerateAlerts'
import { formatCurrency, periodLabel } from '@/lib/utils'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilySummary } from '@/lib/queries/useFamily'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { Wallet, Receipt, TrendingUp, PiggyBank, Target, AlertTriangle, CalendarDays, Users, X, Download, MoreHorizontal, Home, Car, Plane, GraduationCap, ShieldAlert, Heart, Baby, EyeOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const GOAL_ICON_MAP: Record<string, LucideIcon> = {
  '\u{1F3E0}': Home, 'home': Home, '\u{1F3E1}': Home,
  '\u{1F697}': Car, 'car': Car, '\u{1F698}': Car,
  '\u{2708}\uFE0F': Plane, '\u{1F6EB}': Plane, 'plane': Plane, 'vacation': Plane,
  '\u{1F393}': GraduationCap, 'graduation-cap': GraduationCap, 'education': GraduationCap,
  '\u{1F6E1}\uFE0F': ShieldAlert, 'shield-alert': ShieldAlert, 'emergency': ShieldAlert,
  '\u{2764}\uFE0F': Heart, '\u{1F492}': Heart, 'heart': Heart, 'wedding': Heart,
  '\u{1F476}': Baby, 'baby': Baby,
  'target': Target, '\u{1F3AF}': Target,
  'piggy-bank': PiggyBank, '\u{1F416}': PiggyBank,
  'wallet': Wallet, '\u{1F4B0}': Wallet,
}
function GoalIcon({ icon, color, size = 13 }: { icon: string; color?: string; size?: number }) {
  const Icon = GOAL_ICON_MAP[icon.trim().toLowerCase()] ?? GOAL_ICON_MAP[icon.trim()] ?? Target
  return <Icon size={size} style={color ? { color } : undefined} />
}
import { PageInfo } from '@/components/ui/PageInfo'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { PAGE_TIPS } from '@/lib/page-tips'
import { sharedCatLabel } from '@/components/expenses/SharedExpenseList'
import dynamic from 'next/dynamic'
import { DashboardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'

const ExpenseDonut = dynamic(() => import('@/components/dashboard/ExpenseDonut').then(m => ({ default: m.ExpenseDonut })), {
  loading: () => <ChartSkeleton height={150} />,
  ssr: false,
})

const TYPE_COLORS: Record<string, string> = {
  fixed: 'var(--accent-green)',
  variable: 'var(--accent-orange)',
  sinking: 'var(--accent-teal)',
  savings: 'var(--accent-green)',
  shared: 'var(--accent-shared)',
}
const TYPE_LABELS: Record<string, string> = {
  fixed: 'קבועות', variable: 'משתנות', sinking: 'קרנות', savings: 'חיסכון', shared: 'משותפות',
}

export default function Dashboard() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const { data: hasSetup, isLoading: setupLoading } = useHasSetup(user?.id)
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const { familyId, isSolo, loading: familyLoading } = useFamilyContext()
  const splitFrac = useSplitFraction(user?.id)
  const { data: profile } = useProfile(user?.id)
  const { viewMode, setViewMode } = useFamilyView()

  // Reset to personal view when becoming solo (partner removed)
  useEffect(() => {
    if (!familyLoading && isSolo && viewMode !== 'personal') setViewMode('personal')
  }, [familyLoading, isSolo, viewMode, setViewMode])
  const { data: familySummary } = useFamilySummary(selectedPeriodId, viewMode !== 'personal')
  const { data: dashboardAlerts } = useAlerts(user?.id)
  const markAlertRead = useMarkAlertRead()

  // Generate alerts on dashboard load
  useAlertGeneration(user?.id, selectedPeriodId, familyId)

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
  }, [user, userLoading, router])

  useEffect(() => {
    if (!userLoading && !setupLoading && user && hasSetup === false) router.push('/setup')
  }, [user, userLoading, hasSetup, setupLoading, router])

  const selectedYear = useMemo(() => {
    if (!periods || !selectedPeriodId) return undefined
    return periods.find(p => p.id === selectedPeriodId)?.year_number
  }, [periods, selectedPeriodId])

  const { data: income } = useIncome(selectedPeriodId, user?.id)
  const { data: allIncome } = useAllIncome(user?.id)
  const { data: expenses } = usePersonalExpenses(selectedPeriodId, user?.id)
  const { data: shared } = useSharedExpenses(selectedPeriodId, isSolo ? undefined : familyId)
  const { data: allShared } = useAllSharedExpenses(isSolo ? undefined : familyId)
  const { data: savingsGoals } = useSavingsGoals(user?.id, familyId)
  const goalIds = useMemo(() => (savingsGoals ?? []).map(g => g.id), [savingsGoals])
  const { data: goalDeposits } = useAllGoalDeposits(goalIds)
  const { data: pensionReports } = usePensionReports(user?.id)
  const { data: categories } = useBudgetCategories(user?.id)
  const { data: allExpenses } = useAllPersonalExpenses(user?.id)
  const { data: funds } = useSinkingFunds(user?.id)
  const { data: allSinkingTx } = useAllSinkingTransactions(user?.id)
  const { data: nwEntries } = useNetWorthEntries(user?.id)

  // ── 3-month rolling average (must be before early returns) ────────────────
  const avgByCat = useMemo(() => {
    if (!allExpenses || !periods || !selectedPeriodId) return {} as Record<number, number>
    const idx = periods.findIndex(p => p.id === selectedPeriodId)
    const prev = periods.slice(Math.max(0, idx - 3), idx)
    if (prev.length === 0) return {} as Record<number, number>
    const prevIds = new Set(prev.map(p => p.id))
    const sums: Record<number, number> = {}
    allExpenses.forEach(e => {
      if (prevIds.has(e.period_id)) sums[e.category_id] = (sums[e.category_id] ?? 0) + e.amount
    })
    const result: Record<number, number> = {}
    Object.keys(sums).forEach(k => { result[Number(k)] = sums[Number(k)] / prev.length })
    return result
  }, [allExpenses, periods, selectedPeriodId])

  // ── Year-over-year (must be before early returns) ─────────────────────────
  const yearAgoPeriodId = useMemo(() => {
    if (!periods || !selectedPeriodId) return undefined
    const idx = periods.findIndex(p => p.id === selectedPeriodId)
    return idx >= 12 ? periods[idx - 12]?.id : undefined
  }, [periods, selectedPeriodId])

  const yearAgoExpenses = useMemo(() => {
    if (!allExpenses || !yearAgoPeriodId) return 0
    const personal = allExpenses.filter(e => e.period_id === yearAgoPeriodId).reduce((s, e) => s + e.amount, 0)
    const sharedYearAgo = (allShared ?? []).filter(e => e.period_id === yearAgoPeriodId).reduce((s, e) => s + (e.my_share ?? e.total_amount * splitFrac), 0)
    return personal + sharedYearAgo
  }, [allExpenses, allShared, yearAgoPeriodId, splitFrac])

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  if (userLoading || setupLoading) return <DashboardSkeleton />
  if (!user) return null

  // ── Core numbers ──────────────────────────────────────────────────────────
  const totalIncome = (income?.salary ?? 0) + (income?.bonus ?? 0) + (income?.other ?? 0)
  const totalPersonal = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const totalShared = shared?.reduce((s, e) => s + (e.my_share ?? e.total_amount * splitFrac), 0) ?? 0
  const activeFunds = (funds ?? []).filter(f => f.is_active && (!isSolo || !f.is_shared))
  const sinkingMonthly = activeFunds.reduce((s, f) => s + f.monthly_allocation, 0)
  const fundWithdrawals = (allSinkingTx ?? []).filter(t => t.period_id === selectedPeriodId && t.amount < 0).reduce((s, t) => {
    const fund = (funds ?? []).find(f => f.id === t.fund_id)
    const share = fund?.is_shared ? splitFrac : 1
    return s + Math.abs(t.amount) * share
  }, 0)
  const sinkingNet = Math.max(0, sinkingMonthly - fundWithdrawals)
  const totalExpenses = totalPersonal + totalShared + sinkingNet
  const netFlow = totalIncome - totalExpenses
  const savingsPct = totalIncome > 0 ? Math.round((netFlow / totalIncome) * 100) : 0
  const dataLoading = !selectedPeriodId

  // ── Budget utilization ────────────────────────────────────────────────────
  const spendByCat = (expenses ?? []).reduce<Record<number, number>>((acc, e) => {
    acc[e.category_id] = (acc[e.category_id] ?? 0) + e.amount
    return acc
  }, {})

  // ── Forecast ──────────────────────────────────────────────────────────────
  const fixedTargets = (categories ?? []).filter(c => c.type === 'fixed').reduce((s, c) => s + c.monthly_target, 0)
  const variableCats = (categories ?? []).filter(c => c.type === 'variable')
  const variableTargets = variableCats.reduce((s, c) => s + c.monthly_target, 0)
  const variableSpent = variableCats.reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0)
  const variableRemaining = variableTargets - variableSpent
  const savingsSpent = (categories ?? []).filter(c => c.type === 'savings').reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0)
  const personalExclSavings = totalPersonal - savingsSpent
  const safeToSpend = totalIncome - personalExclSavings - totalShared - sinkingMonthly - savingsSpent

  // ── Fixed vs Variable breakdown (using is_fixed override or category type) ─
  const fixedVsVariable = (() => {
    let fixedTotal = 0
    let variableTotal = 0
    for (const e of (expenses ?? [])) {
      const cat = (categories ?? []).find(c => c.id === e.category_id)
      const isFixed = e.is_fixed !== null && e.is_fixed !== undefined ? e.is_fixed : cat?.type === 'fixed'
      if (isFixed) fixedTotal += e.amount
      else variableTotal += e.amount
    }
    // Shared expenses are mostly fixed (rent, utilities)
    fixedTotal += totalShared
    return { fixedTotal, variableTotal, total: fixedTotal + variableTotal }
  })()

  // ── Year-over-year ────────────────────────────────────────────────────────
  const yearAgoIncome = allIncome?.find(i => i.period_id === yearAgoPeriodId)
  const yearAgoTotalIncome = yearAgoIncome ? yearAgoIncome.salary + yearAgoIncome.bonus + yearAgoIncome.other : null
  const yearAgoPeriod = periods?.find(p => p.id === yearAgoPeriodId)

  // ── Donut data (personal expenses by type + shared as "fixed") ──────────
  const expByType = (categories ?? []).reduce<Record<string, number>>((acc, cat) => {
    const spent = spendByCat[cat.id] ?? 0
    if (spent > 0) acc[cat.type] = (acc[cat.type] ?? 0) + spent
    return acc
  }, {})
  // Shared expenses are mostly fixed (rent, utilities, insurance) — add to fixed
  if (totalShared > 0) expByType['fixed'] = (expByType['fixed'] ?? 0) + totalShared
  const donutData = Object.entries(expByType).map(([type, value]) => ({
    name: TYPE_LABELS[type] ?? type, value, color: TYPE_COLORS[type] ?? 'var(--text-secondary)',
  }))

  // ── Sinking funds — spent vs annual target ─────────────────────────────────
  function getFundSpent(fundId: number) {
    const txns = allSinkingTx?.filter(t => t.fund_id === fundId) ?? []
    return txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  }
  function getFundRemaining(fundId: number) {
    const fund = (funds ?? []).find(f => f.id === fundId)
    if (!fund) return 0
    const totalAnnual = fund.yearly_target || fund.monthly_allocation * 12
    return totalAnnual - getFundSpent(fundId)
  }
  const totalFundAnnual = (funds ?? []).reduce((s, f) => s + (f.yearly_target || f.monthly_allocation * 12), 0)
  const totalFundSpent = (funds ?? []).reduce((s, f) => s + getFundSpent(f.id), 0)
  const totalFundRemaining = totalFundAnnual - totalFundSpent

  // ── Goals ────────────────────────────────────────────────────────────────
  function getGoalSaved(goalId: number) {
    return (goalDeposits ?? []).filter(d => d.goal_id === goalId).reduce((s, d) => s + d.amount_deposited, 0)
  }
  const totalGoalsSaved = (savingsGoals ?? []).reduce((s, g) => s + getGoalSaved(g.id), 0)
  const totalGoalsTarget = (savingsGoals ?? []).reduce((s, g) => s + g.target_amount, 0)

  // ── Alerts ────────────────────────────────────────────────────────────────
  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const overspentCats = (categories ?? []).filter(c => {
    const pct = c.monthly_target > 0 ? (spendByCat[c.id] ?? 0) / c.monthly_target : 0
    return pct > 1.1
  })
  const showAlert = !dataLoading && (netFlow < 0 || overspentCats.length > 0)

  // ── Net Worth ─────────────────────────────────────────────────────────────
  const pensionTotal = pensionReports?.[0]?.total_savings ?? 0
  const netWorthEntries = (nwEntries ?? [])
  const nwAssets = netWorthEntries.filter(e => e.type === 'asset').reduce((s, e) => s + e.amount, 0)
  const nwLiabilities = netWorthEntries.filter(e => e.type === 'liability').reduce((s, e) => s + e.amount, 0)
  const netWorthFromEntries = nwAssets - nwLiabilities
  const netWorth = netWorthFromEntries > 0 ? netWorthFromEntries : (totalFundRemaining + totalGoalsSaved + pensionTotal)

  // ── Financial Health Score (0-100) ─────────────────────────────────────────
  // Sinking funds are treated as savings (planned allocation), not real expenses
  const coreExpenses = totalPersonal + totalShared
  const coreSavingsPct = totalIncome > 0 ? Math.round(((totalIncome - coreExpenses) / totalIncome) * 100) : 0
  const healthScores: number[] = []
  if (totalIncome > 0) healthScores.push(Math.min(coreSavingsPct / 20 * 30, 30))
  const catsWithTarget = (categories ?? []).filter(c => c.monthly_target > 0)
  if (catsWithTarget.length > 0) {
    const underBudget = catsWithTarget.filter(c => (spendByCat[c.id] ?? 0) <= c.monthly_target).length
    healthScores.push((underBudget / catsWithTarget.length) * 20)
  }
  const emergencyMonths = coreExpenses > 0 ? totalFundRemaining / coreExpenses : 0
  healthScores.push(coreExpenses > 0 ? Math.min(emergencyMonths / 3 * 20, 20) : 0)
  healthScores.push(pensionTotal > 0 ? 15 : 0)
  healthScores.push(totalGoalsTarget > 0 ? Math.min((totalGoalsSaved / totalGoalsTarget) * 15, 15) : 0)
  // Bonus: having active sinking funds shows financial planning discipline
  healthScores.push(sinkingNet > 0 ? Math.min(5, 5) : 0)

  const healthScore = Math.min(100, Math.round(healthScores.reduce((s, v) => s + v, 0)))
  const healthColor = healthScore >= 75 ? 'var(--accent-green)' : healthScore >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)'
  const healthLabel = healthScore >= 75 ? 'מצוין' : healthScore >= 50 ? 'סביר' : 'דורש שיפור'

  const handleExport = async () => {
    setMenuOpen(false)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const summaryRows = [
        ['סיכום חודשי', selectedPeriod?.label ?? ''],
        [],
        ['הכנסות', totalIncome],
        ['הוצאות אישיות', totalPersonal],
        ['הוצאות משותפות (חלקי)', totalShared],
        ['סה"כ הוצאות', totalExpenses],
        ['תזרים נקי', netFlow],
        ['אחוז חיסכון', `${savingsPct}%`],
        [],
        ['פירוט קטגוריות'],
        ['קטגוריה', 'תקציב', 'הוצאות', '% ניצול'],
      ];
      (categories ?? []).forEach(c => {
        const spent = spendByCat[c.id] ?? 0
        const pct = c.monthly_target > 0 ? Math.round((spent / c.monthly_target) * 100) : 0
        summaryRows.push([c.name, c.monthly_target, spent, `${pct}%`])
      })
      const ws = XLSX.utils.aoa_to_sheet(summaryRows)
      ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws, 'סיכום חודשי')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `סיכום_חודשי_${selectedPeriod?.label ?? 'export'}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error('Export monthly summary:', e) }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              {profile?.name ? `שלום, ${profile.name}` : 'דשבורד'}
            </h1>
            <PageInfo {...PAGE_TIPS.dashboard} />
          </div>
          <p className="text-sm mt-1 text-text-secondary">
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {selectedPeriod ? ` · ${periodLabel(selectedPeriod.start_date)}` : ''}
          </p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label="תפריט פעולות"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card hover:bg-bg-hover cursor-pointer transition-colors"
          >
            <MoreHorizontal size={16} className="text-text-secondary" />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[180px] z-50">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-text-body hover:bg-bg-hover cursor-pointer bg-transparent border-none text-right"
              >
                <Download size={13} className="text-text-secondary shrink-0" />
                הורד סיכום חודשי
              </button>
            </div>
          )}
        </div>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* ── Alert banners (from alert system) ───────────────────────────── */}
      {(() => {
        const unread = (dashboardAlerts ?? []).filter(a => !a.is_read).slice(0, 5)
        if (unread.length === 0) return null
        const severityBorder: Record<string, string> = {
          danger: 'border-[var(--c-red-0-45)]',
          warning: 'border-[var(--c-orange-0-50)]',
          success: 'border-[var(--c-green-0-40)]',
          info: 'border-[var(--c-blue-0-40)]',
        }
        const severityBg: Record<string, string> = {
          danger: 'bg-[var(--c-red-0-18)]',
          warning: 'bg-[var(--c-orange-0-16)]',
          success: 'bg-[var(--c-green-0-18)]',
          info: 'bg-[var(--c-blue-0-16)]',
        }
        return (
          <div className="flex flex-col gap-2 mb-4">
            {unread.map(alert => (
              <div key={alert.id} className={`${severityBg[alert.severity] ?? ''} border ${severityBorder[alert.severity] ?? ''} rounded-[10px] px-4 py-[11px] flex items-start gap-2.5`}>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold mb-0.5">{alert.title}</div>
                  <div className="text-[12px] text-[var(--c-0-70)] leading-relaxed">{alert.message}</div>
                </div>
                {user && (
                  <button
                    onClick={() => markAlertRead.mutate({ id: alert.id, user_id: user.id })}
                    aria-label="סגור התראה"
                    className="bg-transparent border-none cursor-pointer text-[var(--c-0-50)] p-1 shrink-0"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Family View ──────────────────────────────────────────────────── */}
      {(viewMode === 'family' || viewMode === 'member') && (
        <FamilyDashboard
          summary={familySummary}
          totalSharedFromPersonal={totalShared}
          shared={shared}
          savingsGoals={savingsGoals}
          goalDeposits={goalDeposits}
          funds={funds}
          allSinkingTx={allSinkingTx}
          selectedPeriodId={selectedPeriodId}
          categories={categories}
          spendByCat={spendByCat}
          dataLoading={dataLoading}
        />
      )}

      {/* ── Personal View ────────────────────────────────────────────────── */}
      {viewMode === 'personal' && <>

      {/* ── Health Score (Financial Status) — top of dashboard ────────── */}
      {!dataLoading && totalIncome > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 mb-4"
          style={{ height: 48, background: 'var(--bg-hover)' }}
        >
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ background: healthColor }}
          />
          <span className="text-sm font-bold" style={{ color: healthColor }}>{healthScore}</span>
          <span className="text-[13px] text-text-secondary">/ 100</span>
          <span className="text-[13px] text-text-body">
            {healthScore >= 70 ? 'מצב פיננסי טוב' : healthScore >= 40 ? 'מצב פיננסי סביר - יש מקום לשיפור' : 'מצב פיננסי דורש תשומת לב'}
          </span>
          <InfoTooltip body="ציון מ-0 עד 100 שמשקלל: חיסכון (ללא קרנות), עמידה בתקציב, קרן חירום, פנסיה, יעדים, קרנות צבירה" />
        </div>
      )}

      {/* ── Empty state for new users ──────────────────────────────────────── */}
      {!dataLoading && totalIncome === 0 && totalExpenses === 0 && !(categories?.length) && (
        <div className="bg-card border border-border rounded-xl p-8 mb-5 text-center">
          <Wallet size={36} className="text-accent-green mx-auto mb-3 opacity-70" />
          <h2 className="text-lg font-bold mb-2">ברוכים הבאים לדשבורד</h2>
          <p className="text-sm text-text-secondary mb-5 max-w-md mx-auto">
            כדי להתחיל לראות נתונים, הזן את ההכנסה החודשית שלך ואת קטגוריות התקציב.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/income"
              className="flex items-center gap-1.5 bg-accent-green text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold no-underline"
            >
              <Wallet size={14} />
              הזן הכנסה
            </Link>
            <Link
              href="/budget"
              className="flex items-center gap-1.5 bg-[var(--c-0-20)] border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-text-heading no-underline"
            >
              <Receipt size={14} />
              הגדר תקציב
            </Link>
          </div>
        </div>
      )}

      {/* ── Alert bar ──────────────────────────────────────────────────────── */}
      {showAlert && (
        <div className="bg-alert-bg border border-alert-border rounded-[10px] px-4 py-[11px] flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-accent-orange shrink-0 mt-px" />
          <div className="text-[13px] text-alert-text leading-relaxed">
            {netFlow < 0 && <span>תזרים שלילי החודש ({formatCurrency(netFlow)}). </span>}
            {overspentCats.length > 0 && <span>קרובים לתקרה: {overspentCats.map(c => c.name).join(' · ')}</span>}
          </div>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid-kpi">
        {[
          { label: 'הכנסה נטו', value: dataLoading ? '—' : formatCurrency(totalIncome), color: 'var(--accent-green)', Icon: Wallet, tip: 'הכנסה אחרי מס ונכויים - הסכום שבאמת נכנס לחשבון' },
          { label: 'הוצאות החודש', value: dataLoading ? '—' : formatCurrency(totalPersonal + totalShared), color: 'var(--accent-orange)', Icon: Receipt, tip: 'הוצאות החודש מציגות הוצאות אישיות בלבד (ללא קרנות צבירה). "כולל קרנות" מראה את הסך הכולל כולל הסכום שהועבר לקרנות השונות שלך.' },
          ...(sinkingMonthly > 0 ? [{
            label: 'כולל קרנות', value: dataLoading ? '—' : formatCurrency(totalExpenses),
            color: 'var(--accent-teal)', Icon: PiggyBank, tip: 'הוצאות + הקצאה חודשית לקרנות צבירה',
          }] : []),
          {
            label: 'תזרים נקי', value: dataLoading ? '—' : formatCurrency(netFlow),
            color: netFlow >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', Icon: TrendingUp, tip: '',
            sub: dataLoading ? undefined : `${savingsPct}% חיסכון`,
            subColor: savingsPct >= 20 ? 'var(--accent-green)' : savingsPct >= 0 ? 'var(--accent-orange)' : 'var(--accent-red)',
          },
        ].map(kpi => (
          <div key={kpi.label} className="kpi-card">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-1">
                <span className="kpi-label">{kpi.label}</span>
                {kpi.tip && <InfoTooltip body={kpi.tip} />}
              </div>
              <kpi.Icon size={14} className="opacity-70" style={{ color: kpi.color }} />
            </div>
            <div className="kpi-value" dir="ltr" style={{ color: kpi.color }}>{kpi.value}</div>
            {kpi.sub && <div className="kpi-sub" style={{ color: (kpi as { subColor?: string }).subColor ?? kpi.color }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Month at a Glance — 2 cards ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Summary table (1/3) */}
        <div className="card">
          <h2 className="card-header mb-4">
            <CalendarDays size={14} className="text-accent-green" />
            מבט על החודש
          </h2>
          {dataLoading
            ? <div className="text-text-secondary text-[13px]">בחר תקופה</div>
            : (
              <div className="text-[13px]">
                {[
                  { label: 'הכנסה', value: totalIncome, color: 'var(--accent-green)', sign: '+' },
                  { label: 'הוצאות אישיות', value: -personalExclSavings, color: 'var(--accent-orange)', sign: '-' },
                  { label: 'הוצאות משותפות (החלק שלי)', value: -totalShared, color: 'var(--accent-shared)', sign: '-' },
                  ...(sinkingMonthly > 0 ? [{ label: 'קרנות צבירה', value: -sinkingMonthly, color: 'var(--accent-teal)', sign: '-' }] : []),
                  ...(savingsSpent > 0 ? [{ label: 'חיסכון', value: -savingsSpent, color: 'var(--accent-green)', sign: '-' }] : []),
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-[5px] row-divider">
                    <span className="text-text-body">{row.label}</span>
                    <span className="font-medium" style={{ color: row.color }}>
                      {row.sign}{formatCurrency(Math.abs(row.value))}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-2.5 mt-1">
                  <span className="font-semibold">נשאר להוציא</span>
                  <span className={`text-base font-bold ${safeToSpend >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {formatCurrency(safeToSpend)}
                  </span>
                </div>
              </div>
            )
          }
        </div>

        {/* Card 2: Donut chart (2/3) */}
        {donutData.length > 0 && (
          <div className="card flex flex-col items-center justify-center">
            <ExpenseDonut data={donutData} />
          </div>
        )}
      </div>

      {/* ── Fixed vs Variable ─────────────────────────────────────────────── */}
      {fixedVsVariable.total > 0 && (
        <div className="card">
          <h2 className="card-header mb-4">
            <Receipt size={14} className="text-accent-orange" />
            קבועות לעומת משתנות
            <InfoTooltip body="חלוקה לפי סוג ההוצאה. קבועה = שכירות, ביטוח, מנויים. משתנה = סופר, מסעדות, קניות. ניתן לשנות ברמת עסקה בעמוד הוצאות" />
          </h2>
          <div className="flex gap-4 items-center">
            {/* Bar */}
            <div className="flex-1">
              <div className="flex rounded-lg overflow-hidden h-7">
                <div
                  className="flex items-center justify-center text-[11px] font-semibold text-[var(--c-0-10)]"
                  style={{
                    width: `${Math.round((fixedVsVariable.fixedTotal / fixedVsVariable.total) * 100)}%`,
                    background: 'var(--accent-orange)',
                    minWidth: '40px',
                  }}
                >
                  {Math.round((fixedVsVariable.fixedTotal / fixedVsVariable.total) * 100)}%
                </div>
                <div
                  className="flex items-center justify-center text-[11px] font-semibold text-[var(--c-0-10)]"
                  style={{
                    width: `${Math.round((fixedVsVariable.variableTotal / fixedVsVariable.total) * 100)}%`,
                    background: 'var(--accent-green)',
                    minWidth: '40px',
                  }}
                >
                  {Math.round((fixedVsVariable.variableTotal / fixedVsVariable.total) * 100)}%
                </div>
              </div>
              {/* Legend */}
              <div className="flex justify-between mt-2.5 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent-orange)' }} />
                  <span className="text-text-secondary">קבועות</span>
                  <span className="font-semibold">{formatCurrency(fixedVsVariable.fixedTotal)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent-green)' }} />
                  <span className="text-text-secondary">משתנות</span>
                  <span className="font-semibold">{formatCurrency(fixedVsVariable.variableTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Budget + Year-over-year ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Right (in RTL): Budget utilization */}
        <div className="card">
          <h2 className="card-header mb-3.5">
            <Target size={14} className="text-accent-green" /> ניצול תקציב
          </h2>
          {!(categories?.length)
            ? <div className="text-text-secondary text-[13px]">אין קטגוריות</div>
            : [...(categories ?? [])]
              .filter(c => c.monthly_target > 0)
              .sort((a, b) => ((spendByCat[b.id] ?? 0) / b.monthly_target) - ((spendByCat[a.id] ?? 0) / a.monthly_target))
              .slice(0, 5)
              .map(cat => {
                const spent = spendByCat[cat.id] ?? 0
                const rawPct = spent / cat.monthly_target
                const pct = Math.min(rawPct, 1)
                const pctDisplay = Math.round(rawPct * 100)
                const barColor = rawPct >= 1 ? 'var(--accent-red)' : rawPct >= 0.9 ? 'var(--accent-orange)' : 'var(--accent-green)'
                const avg = avgByCat[cat.id]
                const deviation = avg && avg > 0 ? Math.round(((spent - avg) / avg) * 100) : null
                return (
                  <div key={cat.id} className="mb-2.5">
                    <div className="flex justify-between text-xs mb-[3px]">
                      <span className="text-text-heading">{cat.name}</span>
                      <div className="flex gap-1.5 items-center">
                        {deviation !== null && (
                          <span className={`text-[10px] ${deviation > 15 ? 'text-accent-red' : deviation < -15 ? 'text-accent-green' : 'text-text-secondary'}`}>
                            {deviation > 0 ? `↑${deviation}%` : `↓${Math.abs(deviation)}%`}
                          </span>
                        )}
                        <span className="font-semibold" style={{ color: barColor }}>{pctDisplay > 200 ? '200%+' : `${pctDisplay}%`}</span>
                      </div>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.round(pct * 100)}%`, background: barColor }} />
                    </div>
                  </div>
                )
              })
          }
          {variableRemaining > 0 && (
            <div className="text-[11px] text-text-secondary mt-2 text-right">
              יתרת תקציב משתנות: {formatCurrency(variableRemaining)}
            </div>
          )}
        </div>

        {/* Left (in RTL): Year-over-year */}
        <div className="card">
          <h2 className="card-header mb-4">
            <TrendingUp size={14} className="text-accent-teal" />
            לעומת שנה שעברה
          </h2>
          {!yearAgoPeriodId
            ? <div className="text-text-secondary text-[13px]">אין נתוני שנה שעברה (פחות מ-12 מחזורים)</div>
            : (
              <div className="text-[13px]">
                <div className="text-[11px] text-text-secondary mb-3">
                  {yearAgoPeriod ? periodLabel(yearAgoPeriod.start_date) : ''} → {selectedPeriod ? periodLabel(selectedPeriod.start_date) : ''}
                </div>
                {[
                  { label: 'הכנסה', current: totalIncome, prev: yearAgoTotalIncome, positiveIsGood: true },
                  { label: 'הוצאות', current: totalExpenses, prev: yearAgoExpenses, positiveIsGood: false },
                  { label: 'תזרים נקי', current: netFlow, prev: yearAgoTotalIncome ? yearAgoTotalIncome - yearAgoExpenses : null, positiveIsGood: true },
                ].map(row => {
                  const pct = row.prev ? Math.round(((row.current - row.prev) / Math.abs(row.prev)) * 100) : null
                  const isGood = pct === null ? null : row.positiveIsGood ? pct >= 0 : pct <= 0
                  return (
                    <div key={row.label} className="flex justify-between items-center py-[7px] row-divider">
                      <span className="text-text-body">{row.label}</span>
                      <div className="flex gap-2 items-center">
                        {pct !== null && (
                          <span className={`text-[11px] font-semibold ${isGood ? 'text-accent-green' : 'text-accent-red'}`}>
                            {pct >= 0 ? `↑${pct}%` : `↓${Math.abs(pct)}%`}
                          </span>
                        )}
                        <span className="font-medium">{formatCurrency(row.current)}</span>
                        {row.prev !== null && (
                          <span className="text-text-secondary text-[11px]">/ {formatCurrency(row.prev ?? 0)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* ── Sinking funds + Goals ──────────────────────────────────────────── */}
      <div className="grid-2">

        {/* Sinking funds */}
        <div className="card">
          <div className="flex justify-between items-center mb-3.5">
            <h2 className="card-header">
              <PiggyBank size={14} className="text-accent-teal" /> קרנות צבירה
              <InfoTooltip body="כסף שמופרש מדי חודש ליעדים ספציפיים — חירום, חופשה, רכב" />
            </h2>
            <div className="text-[13px]">
              <span className="font-bold text-accent-orange">{formatCurrency(totalFundSpent)}</span>
              <span className="text-text-secondary mx-1">/</span>
              <span className="text-text-secondary">{formatCurrency(totalFundAnnual)}</span>
            </div>
          </div>
          {!(funds?.length)
            ? <div className="text-text-secondary text-[13px]">אין קרנות</div>
            : (funds ?? []).map(fund => {
              const spent = getFundSpent(fund.id)
              const annualTarget = fund.yearly_target || fund.monthly_allocation * 12
              const remaining = annualTarget - spent
              const pct = annualTarget > 0 ? Math.min((spent / annualTarget) * 100, 100) : 0
              return (
                <div key={fund.id} className="mb-[11px]">
                  <div className="flex justify-between text-xs mb-[3px]">
                    <span className="text-text-heading">{fund.name}</span>
                    <span className="text-text-secondary">
                      <span className="text-accent-orange font-semibold">{formatCurrency(spent)}</span> / {formatCurrency(annualTarget)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill bg-accent-orange" style={{ width: `${Math.max(0, pct)}%` }} />
                  </div>
                  <div className="text-[10px] text-text-secondary mt-0.5">נשאר: <span className={`font-medium ${remaining >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>{formatCurrency(remaining)}</span></div>
                </div>
              )
            })
          }
        </div>

        {/* Goals */}
        <div className="card">
          <Link href="/goals" className="no-underline text-inherit">
            <h2 className="card-header mb-3.5">
              <Target size={14} className="text-accent-green" /> יעדי חיסכון
            </h2>
          </Link>
          {!(savingsGoals?.length)
            ? <div className="text-text-secondary text-[13px]">אין יעדים</div>
            : (savingsGoals ?? []).map(goal => {
              const saved = getGoalSaved(goal.id)
              const pct = goal.target_amount > 0 ? Math.min((saved / goal.target_amount) * 100, 100) : 0
              return (
                <div key={goal.id} className="mb-[11px]">
                  <div className="flex justify-between text-xs mb-[3px]">
                    <span className="text-text-heading flex items-center gap-1"><GoalIcon icon={goal.icon} color={goal.color} /> {goal.name}</span>
                    <span className="font-semibold" style={{ color: goal.color }}>
                      {formatCurrency(saved)} / {formatCurrency(goal.target_amount)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: goal.color }} />
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>

      {/* Year-over-year moved into budget grid above, Net Worth moved to KPI card */}

      {/* Health Score moved to top (below alerts) */}

      </>}
    </div>
  )
}

// ── Family Member Card ──────────────────────────────────────────────────────
function FamilyMemberCard({ member, memberShared, memberSinking }: {
  member: { user_id: string; display_name: string; income?: number; personal_expenses?: number; show_details: boolean; privacy_mode: string }
  memberShared: number
  memberSinking: number
}) {
  const [showSinking, setShowSinking] = useState(true)
  const income = member.income ?? 0
  const personalExpenses = member.personal_expenses ?? 0
  const netBefore = income - personalExpenses - memberShared
  const netAfter = netBefore - memberSinking
  const privacyMode = member.privacy_mode ?? 'summary_only'

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3.5">
        <Users size={14} className="text-accent-green" />
        <span className="font-semibold text-sm">{member.display_name}</span>
        {privacyMode === 'summary_only' && (
          <span className="text-[10px] text-text-secondary bg-[var(--bg-hover)] px-1.5 py-0.5 rounded" title="מציג סיכום בלבד">סיכום</span>
        )}
        {privacyMode === 'hidden' && (
          <span className="text-[10px] text-text-secondary bg-[var(--bg-hover)] px-1.5 py-0.5 rounded" title="נתונים מוסתרים">מוסתר</span>
        )}
      </div>
      {privacyMode === 'hidden' ? (
        <div className="text-[13px] text-text-secondary">
          <div className="text-xs text-text-secondary italic flex items-center gap-1.5">
            <EyeOff size={12} />
            הנתונים האישיים מוסתרים
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-text-secondary">הכנסה</span>
            <span className="font-medium text-accent-green">+{formatCurrency(income)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">הוצאות אישיות</span>
            <span className="font-medium text-accent-orange">-{formatCurrency(personalExpenses)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">הוצאות משותפות</span>
            <span className="font-medium text-accent-shared">-{formatCurrency(memberShared)}</span>
          </div>
          {showSinking && memberSinking > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">קרנות צבירה</span>
              <span className="font-medium text-accent-teal">-{formatCurrency(memberSinking)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-t-bg-hover pt-2">
            <span className="font-semibold">{showSinking ? 'נטו אחרי קרנות' : 'נטו אמיתי'}</span>
            <span className={`font-bold ${(showSinking ? netAfter : netBefore) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {formatCurrency(showSinking ? netAfter : netBefore)}
            </span>
          </div>
          {memberSinking > 0 && (
            <button
              type="button"
              onClick={() => setShowSinking(v => !v)}
              className="self-start mt-1 px-2 py-1 rounded text-[11px] cursor-pointer transition-all duration-150 bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:text-[var(--text-primary)]"
            >
              {showSinking ? 'הסתר קרנות' : 'הצג קרנות'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Family Dashboard Component ──────────────────────────────────────────────
function FamilyDashboard({
  summary,
  totalSharedFromPersonal,
  shared,
  savingsGoals,
  goalDeposits,
  funds,
  allSinkingTx,
  selectedPeriodId,
  categories,
  spendByCat,
  dataLoading,
}: {
  summary: import('@/lib/queries/useFamily').FamilySummary | undefined
  totalSharedFromPersonal: number
  shared: import('@/lib/types').SharedExpense[] | undefined
  savingsGoals: import('@/lib/types').SavingsGoal[] | undefined
  goalDeposits: import('@/lib/types').GoalDeposit[] | undefined
  funds: import('@/lib/types').SinkingFund[] | undefined
  allSinkingTx: import('@/lib/types').SinkingFundTransaction[] | undefined
  selectedPeriodId: number | undefined
  categories: import('@/lib/types').BudgetCategory[] | undefined
  spendByCat: Record<number, number>
  dataLoading: boolean
}) {
  if (!summary) {
    return <DashboardSkeleton />
  }

  const familySinkingMonthly = (funds ?? []).filter(f => f.is_active).reduce((s, f) => s + f.monthly_allocation, 0)
  const familyFundWithdrawals = (allSinkingTx ?? []).filter(t => t.period_id === selectedPeriodId && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const familySinkingNet = Math.max(0, familySinkingMonthly - familyFundWithdrawals)
  const totalExpenses = summary.total_personal_expenses + summary.total_shared_expenses + familySinkingNet
  const familyNet = summary.total_income - totalExpenses
  const familySavingsPct = summary.total_income > 0 ? Math.round((familyNet / summary.total_income) * 100) : 0

  // Sinking fund spent/remaining
  function getFundBal(fundId: number) {
    const fund = (funds ?? []).find(f => f.id === fundId)
    if (!fund) return 0
    const txns = (allSinkingTx ?? []).filter(t => t.fund_id === fundId)
    const spent = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const annualTarget = fund.yearly_target || fund.monthly_allocation * 12
    return annualTarget - spent
  }
  const totalFundBal = (funds ?? []).reduce((s, f) => s + getFundBal(f.id), 0)

  // Budget utilization
  const totalBudget = (categories ?? []).reduce((s, c) => s + c.monthly_target, 0)
  const totalSpent = Object.values(spendByCat).reduce((s, v) => s + v, 0) + totalSharedFromPersonal
  const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  return (
    <>
      {/* Family KPIs */}
      <div className="grid-kpi">
        {[
          { label: 'הכנסה משפחתית', value: formatCurrency(summary.total_income), color: 'var(--accent-green)', Icon: Wallet },
          { label: 'הוצאות החודש', value: formatCurrency(summary.total_personal_expenses + summary.total_shared_expenses), color: 'var(--accent-orange)', Icon: Receipt },
          ...(familySinkingMonthly > 0 ? [{
            label: 'כולל קרנות', value: formatCurrency(totalExpenses),
            color: 'var(--accent-teal)', Icon: PiggyBank,
          }] : []),
          {
            label: 'תזרים משפחתי',
            value: formatCurrency(familyNet),
            color: familyNet >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            Icon: TrendingUp,
            sub: `${familySavingsPct}% חיסכון`,
            subColor: familySavingsPct >= 20 ? 'var(--accent-green)' : familySavingsPct >= 0 ? 'var(--accent-orange)' : 'var(--accent-red)',
          },
        ].map(kpi => (
          <div key={kpi.label} className="kpi-card">
            <div className="flex justify-between items-center mb-2">
              <span className="kpi-label">{kpi.label}</span>
              <kpi.Icon size={14} className="opacity-70" style={{ color: kpi.color }} />
            </div>
            <div className="kpi-value" dir="ltr" style={{ color: kpi.color }}>{kpi.value}</div>
            {(kpi as { sub?: string }).sub && (
              <div className="kpi-sub" style={{ color: (kpi as { subColor?: string }).subColor ?? kpi.color }}>
                {(kpi as { sub?: string }).sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Per-member breakdown + donut */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-4">
        {summary.members.map(member => (
          <FamilyMemberCard
            key={member.user_id}
            member={member}
            memberShared={summary.total_shared_expenses > 0 ? Math.round(summary.total_shared_expenses / summary.members.length) : 0}
            memberSinking={Math.round(familySinkingMonthly / summary.members.length)}
          />
        ))}
        {/* Family donut */}
        <div className="card flex flex-col items-center justify-center">
          <h2 className="card-header mb-3 self-end">
            <CalendarDays size={14} className="text-accent-green" />
            חלוקת הוצאות
          </h2>
          <ExpenseDonut data={[
            { name: 'אישיות', value: summary.total_personal_expenses, color: 'var(--accent-orange)' },
            { name: 'משותפות', value: summary.total_shared_expenses, color: 'var(--accent-shared)' },
            ...(familySinkingMonthly > 0 ? [{ name: 'קרנות צבירה', value: familySinkingMonthly, color: 'var(--accent-teal)' }] : []),
          ]} />
        </div>
      </div>

      {/* member cards handled by FamilyMemberCard above */}

      {/* Budget summary + Shared expenses */}
      <div className="grid-2">
        {/* Budget summary */}
        <div className="card">
          <div className="card-header mb-3.5">
            <Target size={14} className="text-accent-green" /> סיכום תקציב
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-[22px] font-bold tracking-tight ${budgetPct <= 100 ? 'text-accent-green' : 'text-accent-red'}`}>
              {budgetPct}%
            </span>
            <span className="text-xs text-text-secondary">ניצול מתוך {formatCurrency(totalBudget)}</span>
          </div>
          <div className="bar-track mb-2">
            <div
              className="bar-fill"
              style={{
                width: `${Math.min(budgetPct, 100)}%`,
                background: budgetPct <= 80 ? 'var(--accent-green)' : budgetPct <= 100 ? 'var(--accent-orange)' : 'var(--accent-red)',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-text-secondary">
            <span>הוצאות: {formatCurrency(totalSpent)}</span>
            <span>תקציב: {formatCurrency(totalBudget)}</span>
          </div>
        </div>

        {/* Shared expenses */}
        <div className="card">
          <div className="card-header mb-3.5">
            <Receipt size={14} className="text-accent-shared" /> הוצאות משותפות
          </div>
          <div className="text-[22px] font-bold text-accent-shared tracking-tight mb-3.5">
            {formatCurrency(summary.total_shared_expenses)}
          </div>
          {(shared ?? []).length > 0 && (
            <div className="flex flex-col gap-1.5 text-xs">
              {Object.entries(
                (shared ?? []).reduce<Record<string, number>>((acc, s) => {
                  acc[s.category] = (acc[s.category] ?? 0) + Number(s.total_amount)
                  return acc
                }, {})
              ).map(([cat, total]) => (
                <div key={cat} className="flex justify-between">
                  <span className="text-text-secondary">{sharedCatLabel(cat)}</span>
                  <span className="text-text-body">{formatCurrency(total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Family Fixed vs Variable ─────────────────────────────────────── */}
      {(() => {
        // Family level: shared expenses = fixed, personal = variable (approximation)
        const familyFixedTotal = summary.total_shared_expenses
        const familyVariableTotal = summary.total_personal_expenses
        const familyTotal = familyFixedTotal + familyVariableTotal
        if (familyTotal <= 0) return null
        const fixedPct = Math.round((familyFixedTotal / familyTotal) * 100)
        const varPct = 100 - fixedPct
        return (
          <div className="card">
            <h2 className="card-header mb-4">
              <Receipt size={14} className="text-accent-orange" />
              קבועות לעומת משתנות (משפחתי)
            </h2>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <div className="flex rounded-lg overflow-hidden h-7">
                  <div
                    className="flex items-center justify-center text-[11px] font-semibold text-[var(--c-0-10)]"
                    style={{ width: `${fixedPct}%`, background: 'var(--accent-orange)', minWidth: '40px' }}
                  >
                    {fixedPct}%
                  </div>
                  <div
                    className="flex items-center justify-center text-[11px] font-semibold text-[var(--c-0-10)]"
                    style={{ width: `${varPct}%`, background: 'var(--accent-green)', minWidth: '40px' }}
                  >
                    {varPct}%
                  </div>
                </div>
                <div className="flex justify-between mt-2.5 text-[12px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent-orange)' }} />
                    <span className="text-text-secondary">קבועות (משותפות)</span>
                    <span className="font-semibold">{formatCurrency(familyFixedTotal)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--accent-green)' }} />
                    <span className="text-text-secondary">משתנות (אישיות)</span>
                    <span className="font-semibold">{formatCurrency(familyVariableTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Sinking Funds + Goals */}
      <div className="grid-2">
        {/* Sinking funds */}
        <div className="card">
          <div className="flex justify-between items-center mb-3.5">
            <div className="card-header">
              <PiggyBank size={14} className="text-accent-teal" /> קרנות צבירה
            </div>
            <div className="text-[13px] font-bold text-accent-teal">
              נשאר: {formatCurrency(totalFundBal)}
            </div>
          </div>
          {!(funds?.length)
            ? <div className="text-text-secondary text-[13px]">אין קרנות</div>
            : (funds ?? []).map(fund => {
              const remaining = getFundBal(fund.id)
              const annualTarget = fund.yearly_target || fund.monthly_allocation * 12
              const spent = annualTarget - remaining
              const pct = annualTarget > 0 ? Math.min((spent / annualTarget) * 100, 100) : 0
              return (
                <div key={fund.id} className="mb-[11px]">
                  <div className="flex justify-between text-xs mb-[3px]">
                    <span className="text-text-heading">{fund.name}</span>
                    <span className="text-text-secondary">
                      <span className="text-accent-orange font-semibold">{formatCurrency(spent)}</span> / {formatCurrency(annualTarget)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill bg-accent-orange" style={{ width: `${Math.max(0, pct)}%` }} />
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* Goals */}
        <div className="card">
          <Link href="/goals" className="no-underline text-inherit">
            <div className="card-header mb-3.5">
              <Target size={14} className="text-accent-green" /> יעדי חיסכון
            </div>
          </Link>
          {!(savingsGoals?.length)
            ? <div className="text-text-secondary text-[13px]">אין יעדים</div>
            : (savingsGoals ?? []).map(goal => {
              const saved = (goalDeposits ?? []).filter(d => d.goal_id === goal.id).reduce((s, d) => s + d.amount_deposited, 0)
              const pct = goal.target_amount > 0 ? Math.min((saved / goal.target_amount) * 100, 100) : 0
              return (
                <div key={goal.id} className="mb-[11px]">
                  <div className="flex justify-between text-xs mb-[3px]">
                    <span className="text-text-heading flex items-center gap-1"><GoalIcon icon={goal.icon} color={goal.color} /> {goal.name}</span>
                    <span className="font-semibold" style={{ color: goal.color }}>
                      {formatCurrency(saved)} / {formatCurrency(goal.target_amount)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: goal.color }} />
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>
    </>
  )
}
