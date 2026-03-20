'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome, useAllIncome } from '@/lib/queries/useIncome'
import { usePersonalExpenses, useBudgetCategories, useAllPersonalExpenses } from '@/lib/queries/useExpenses'
import { useSharedExpenses, useAllSharedExpenses } from '@/lib/queries/useShared'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { useSavingsGoals, useAllGoalDeposits } from '@/lib/queries/useGoals'
import { useSinkingFunds, useAllSinkingTransactions } from '@/lib/queries/useSinking'
import { usePensionReports } from '@/lib/queries/usePension'
import { useHasSetup } from '@/lib/queries/useSetup'
import { useAlerts, useMarkAlertRead } from '@/lib/queries/useAlerts'
import { useAlertGeneration } from '@/lib/hooks/useGenerateAlerts'
import { formatCurrency, periodLabel } from '@/lib/utils'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilySummary } from '@/lib/queries/useFamily'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { Wallet, Receipt, TrendingUp, PiggyBank, Target, AlertTriangle, CalendarDays, Users, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { DashboardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'

const ExpenseDonut = dynamic(() => import('@/components/dashboard/ExpenseDonut').then(m => ({ default: m.ExpenseDonut })), {
  loading: () => <ChartSkeleton height={150} />,
  ssr: false,
})

const TYPE_COLORS: Record<string, string> = {
  fixed: 'var(--accent-blue)',
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
  const { familyId } = useFamilyContext()
  const splitFrac = useSplitFraction(user?.id)
  const { viewMode } = useFamilyView()
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
  const { data: shared } = useSharedExpenses(selectedPeriodId, familyId)
  const { data: allShared } = useAllSharedExpenses(familyId)
  const { data: savingsGoals } = useSavingsGoals(user?.id, familyId)
  const goalIds = useMemo(() => (savingsGoals ?? []).map(g => g.id), [savingsGoals])
  const { data: goalDeposits } = useAllGoalDeposits(goalIds)
  const { data: pensionReports } = usePensionReports(user?.id)
  const { data: categories } = useBudgetCategories(user?.id)
  const { data: allExpenses } = useAllPersonalExpenses(user?.id)
  const { data: funds } = useSinkingFunds(user?.id)
  const { data: allSinkingTx } = useAllSinkingTransactions(user?.id)

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
  }, [allExpenses, allShared, yearAgoPeriodId])

  if (userLoading || setupLoading) return <DashboardSkeleton />
  if (!user) return null

  // ── Core numbers ──────────────────────────────────────────────────────────
  const totalIncome = (income?.salary ?? 0) + (income?.bonus ?? 0) + (income?.other ?? 0)
  const totalPersonal = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const totalShared = shared?.reduce((s, e) => s + (e.my_share ?? e.total_amount * splitFrac), 0) ?? 0
  const totalExpenses = totalPersonal + totalShared
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
  const sinkingTargets = (categories ?? []).filter(c => c.type === 'sinking').reduce((s, c) => s + c.monthly_target, 0)
  const savingsTargets = (categories ?? []).filter(c => c.type === 'savings').reduce((s, c) => s + c.monthly_target, 0)
  const safeToSpend = totalIncome - fixedTargets - variableTargets - sinkingTargets - savingsTargets - totalShared

  // ── Year-over-year ────────────────────────────────────────────────────────
  const yearAgoIncome = allIncome?.find(i => i.period_id === yearAgoPeriodId)
  const yearAgoTotalIncome = yearAgoIncome ? yearAgoIncome.salary + yearAgoIncome.bonus + yearAgoIncome.other : null
  const yearAgoPeriod = periods?.find(p => p.id === yearAgoPeriodId)

  // ── Donut data ─────────────────────────────────────────────────────────────
  const expByType = (categories ?? []).reduce<Record<string, number>>((acc, cat) => {
    const spent = spendByCat[cat.id] ?? 0
    if (spent > 0) acc[cat.type] = (acc[cat.type] ?? 0) + spent
    return acc
  }, {})
  if (totalShared > 0) expByType['shared'] = totalShared
  const donutData = Object.entries(expByType).map(([type, value]) => ({
    name: TYPE_LABELS[type] ?? type, value, color: TYPE_COLORS[type] ?? 'oklch(0.65 0.01 250)',
  }))

  // ── Sinking balance ───────────────────────────────────────────────────────
  function getFundBalance(fundId: number) {
    const txns = allSinkingTx?.filter(t => t.fund_id === fundId) ?? []
    return txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      - txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  }
  const totalFundBalance = (funds ?? []).reduce((s, f) => s + getFundBalance(f.id), 0)

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
    return pct >= 0.9
  })
  const showAlert = !dataLoading && (netFlow < 0 || overspentCats.length > 0)

  // ── Net Worth ─────────────────────────────────────────────────────────────
  const pensionTotal = pensionReports?.[0]?.total_savings ?? 0
  const netWorth = totalFundBalance + totalGoalsSaved + pensionTotal

  // ── Financial Health Score (0-100) ─────────────────────────────────────────
  const healthScores: number[] = []
  if (totalIncome > 0) healthScores.push(Math.min(savingsPct / 20 * 30, 30))
  const catsWithTarget = (categories ?? []).filter(c => c.monthly_target > 0)
  if (catsWithTarget.length > 0) {
    const underBudget = catsWithTarget.filter(c => (spendByCat[c.id] ?? 0) <= c.monthly_target).length
    healthScores.push((underBudget / catsWithTarget.length) * 20)
  }
  const emergencyMonths = totalExpenses > 0 ? totalFundBalance / totalExpenses : 0
  healthScores.push(totalExpenses > 0 ? Math.min(emergencyMonths / 3 * 20, 20) : 0)
  healthScores.push(pensionTotal > 0 ? 15 : 0)
  healthScores.push(totalGoalsTarget > 0 ? Math.min((totalGoalsSaved / totalGoalsTarget) * 15, 15) : 0)

  const healthScore = Math.round(healthScores.reduce((s, v) => s + v, 0))
  const healthColor = healthScore >= 75 ? 'var(--accent-green)' : healthScore >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)'
  const healthLabel = healthScore >= 75 ? 'מצוין' : healthScore >= 50 ? 'סביר' : 'דורש שיפור'

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">דשבורד</h1>
        <p className="text-sm mt-1 text-text-secondary">
          {selectedPeriod ? periodLabel(selectedPeriod.start_date) : '...'}
        </p>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* ── Alert banners (from alert system) ───────────────────────────── */}
      {(() => {
        const unread = (dashboardAlerts ?? []).filter(a => !a.is_read).slice(0, 5)
        if (unread.length === 0) return null
        const severityBorder: Record<string, string> = {
          danger: 'border-[oklch(0.45_0.18_27)]',
          warning: 'border-[oklch(0.45_0.15_55)]',
          success: 'border-[oklch(0.40_0.15_145)]',
          info: 'border-[oklch(0.40_0.15_250)]',
        }
        const severityBg: Record<string, string> = {
          danger: 'bg-[oklch(0.16_0.04_27)]',
          warning: 'bg-[oklch(0.16_0.04_55)]',
          success: 'bg-[oklch(0.16_0.04_145)]',
          info: 'bg-[oklch(0.16_0.04_250)]',
        }
        return (
          <div className="flex flex-col gap-2 mb-4">
            {unread.map(alert => (
              <div key={alert.id} className={`${severityBg[alert.severity] ?? ''} border ${severityBorder[alert.severity] ?? ''} rounded-[10px] px-4 py-[11px] flex items-start gap-2.5`}>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold mb-0.5">{alert.title}</div>
                  <div className="text-[12px] text-[oklch(0.70_0.01_250)] leading-relaxed">{alert.message}</div>
                </div>
                {user && (
                  <button
                    onClick={() => markAlertRead.mutate({ id: alert.id, user_id: user.id })}
                    aria-label="סגור התראה"
                    className="bg-transparent border-none cursor-pointer text-[oklch(0.50_0.01_250)] p-1 shrink-0"
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
          dataLoading={dataLoading}
        />
      )}

      {/* ── Personal View ────────────────────────────────────────────────── */}
      {viewMode === 'personal' && <>

      {/* ── Alert bar ──────────────────────────────────────────────────────── */}
      {showAlert && (
        <div className="bg-alert-bg border border-alert-border rounded-[10px] px-4 py-[11px] mb-4 flex items-start gap-2.5">
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
          { label: 'הכנסה נטו', value: dataLoading ? '—' : formatCurrency(totalIncome), color: 'var(--accent-blue)', Icon: Wallet },
          { label: 'הוצאות החודש', value: dataLoading ? '—' : formatCurrency(totalExpenses), color: 'var(--accent-orange)', Icon: Receipt },
          {
            label: 'תזרים נקי', value: dataLoading ? '—' : formatCurrency(netFlow),
            color: netFlow >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', Icon: TrendingUp,
          },
          {
            label: '% חיסכון', value: dataLoading ? '—' : `${savingsPct}%`,
            color: savingsPct >= 20 ? 'var(--accent-green)' : savingsPct >= 0 ? 'var(--accent-orange)' : 'var(--accent-red)',
            Icon: PiggyBank,
            sub: savingsPct >= 20 ? '✓ יעד חיסכון' : savingsPct >= 0 ? 'מתחת ל-20%' : 'גירעון',
          },
        ].map(kpi => (
          <div key={kpi.label} className="kpi-card">
            <div className="flex justify-between items-center mb-2">
              <span className="kpi-label">{kpi.label}</span>
              <kpi.Icon size={14} className="opacity-70" style={{ color: kpi.color }} />
            </div>
            <div className="kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
            {kpi.sub && <div className="kpi-sub" style={{ color: kpi.color }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Forecast + Year-over-year ──────────────────────────────────────── */}
      <div className="grid-2">

        {/* Forecast */}
        <div className="card">
          <h2 className="card-header mb-4">
            <CalendarDays size={14} className="text-accent-blue" />
            תחזית חודש נוכחי
          </h2>
          {dataLoading
            ? <div className="text-text-secondary text-[13px]">בחר תקופה</div>
            : (
              <div className="text-[13px]">
                {[
                  { label: 'הכנסה ידועה', value: totalIncome, color: 'var(--accent-green)', sign: '+' },
                  { label: 'הוצאות קבועות (יעד)', value: -fixedTargets, color: 'var(--text-secondary)', sign: '-' },
                  { label: 'משותפות (שהוזן)', value: -totalShared, color: 'var(--text-secondary)', sign: '-' },
                  { label: 'משתנות (יעד)', value: -variableTargets, color: 'var(--accent-orange)', sign: '-' },
                  ...(sinkingTargets > 0 ? [{ label: 'קרנות צבירה (יעד חודשי)', value: -sinkingTargets, color: 'var(--accent-teal)', sign: '-' }] : []),
                  ...(savingsTargets > 0 ? [{ label: 'חיסכון (יעד חודשי)', value: -savingsTargets, color: 'var(--accent-green)', sign: '-' }] : []),
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-[5px] row-divider">
                    <span className="text-text-body">{row.label}</span>
                    <span className="font-medium" style={{ color: row.color }}>
                      {row.sign}{formatCurrency(Math.abs(row.value))}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-2.5 mt-1">
                  <span className="font-semibold">נשאר בטוח להוציא</span>
                  <span className={`text-base font-bold ${safeToSpend >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {formatCurrency(safeToSpend)}
                  </span>
                </div>
                {variableRemaining > 0 && (
                  <div className="text-[11px] text-text-secondary mt-1.5 text-right">
                    יתרת תקציב משתנות: {formatCurrency(variableRemaining)}
                  </div>
                )}
              </div>
            )
          }
        </div>

        {/* Year-over-year */}
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

      {/* ── Budget utilization + Donut ─────────────────────────────────────── */}
      <div className="grid-2">

        {/* Budget bars */}
        <div className="card">
          <h2 className="font-semibold text-sm mb-3.5">ניצול תקציב</h2>
          {!(categories?.length)
            ? <div className="text-text-secondary text-[13px]">אין קטגוריות</div>
            : [...(categories ?? [])]
              .filter(c => c.monthly_target > 0)
              .sort((a, b) => ((spendByCat[b.id] ?? 0) / b.monthly_target) - ((spendByCat[a.id] ?? 0) / a.monthly_target))
              .slice(0, 7)
              .map(cat => {
                const spent = spendByCat[cat.id] ?? 0
                const rawPct = spent / cat.monthly_target
                const pct = Math.min(rawPct, 1)
                const pctDisplay = Math.round(rawPct * 100)
                const barColor = rawPct >= 1 ? 'var(--accent-red)' : rawPct >= 0.9 ? 'var(--accent-orange)' : 'var(--accent-blue)'
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
                        <span className="font-semibold" style={{ color: barColor }}>{pctDisplay}%</span>
                      </div>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.round(pct * 100)}%`, background: barColor }} />
                    </div>
                  </div>
                )
              })
          }
        </div>

        {/* Donut */}
        <div className="card">
          <h2 className="font-semibold text-sm mb-3.5">חלוקת הוצאות</h2>
          <ExpenseDonut data={donutData} />
        </div>
      </div>

      {/* ── Sinking funds + Apartment ──────────────────────────────────────── */}
      <div className="grid-2 !mb-0">

        {/* Sinking funds */}
        <div className="card">
          <div className="flex justify-between items-center mb-3.5">
            <h2 className="card-header">
              <PiggyBank size={14} className="text-accent-teal" /> קרנות צבירה
            </h2>
            <div className="text-[13px] font-bold text-accent-teal">
              {formatCurrency(totalFundBalance)}
            </div>
          </div>
          {!(funds?.length)
            ? <div className="text-text-secondary text-[13px]">אין קרנות</div>
            : (funds ?? []).map(fund => {
              const balance = getFundBalance(fund.id)
              const annualTarget = fund.yearly_target || fund.monthly_allocation * 12
              const pct = annualTarget > 0 ? Math.min((balance / annualTarget) * 100, 100) : 0
              return (
                <div key={fund.id} className="mb-[11px]">
                  <div className="flex justify-between text-xs mb-[3px]">
                    <span className="text-text-heading">{fund.name}</span>
                    <span className={`font-semibold ${balance >= 0 ? 'text-accent-teal' : 'text-accent-red'}`}>
                      {formatCurrency(balance)}
                    </span>
                  </div>
                  {balance < 0 && (
                    <div className="text-[10px] text-text-secondary mb-0.5">(הוצאה גדולה מהצבירה)</div>
                  )}
                  <div className="bar-track">
                    <div className="bar-fill bg-accent-teal" style={{ width: `${Math.max(0, pct)}%` }} />
                  </div>
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
                    <span className="text-text-heading">{goal.icon} {goal.name}</span>
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

      {/* ── Net Worth + Health Score ───────────────────────────────────────── */}
      {!dataLoading && totalIncome > 0 && (
        <div className="grid-2 mt-3.5">
          {/* Net Worth */}
          <div className="card">
            <h2 className="card-header mb-3.5">
              <Wallet size={14} className="text-accent-purple" /> שווי נקי
            </h2>
            <div className={`text-[28px] font-bold text-right mb-3.5 ${netWorth >= 0 ? 'text-accent-purple' : 'text-accent-red'}`}>
              {formatCurrency(netWorth)}
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              {pensionTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">פנסיה והשקעות</span>
                  <span className="text-text-body">{formatCurrency(pensionTotal)}</span>
                </div>
              )}
              {totalFundBalance !== 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">קרנות צבירה</span>
                  <span className="text-text-body">{formatCurrency(totalFundBalance)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">יעדי חיסכון</span>
                <span className="text-text-body">{formatCurrency(totalGoalsSaved)}</span>
              </div>
            </div>
          </div>

          {/* Health Score */}
          <div className="card">
            <h2 className="card-header mb-3.5">
              <TrendingUp size={14} style={{ color: healthColor }} /> בריאות פיננסית
            </h2>
            <div className="flex items-baseline gap-2.5 mb-2">
              <span className="text-4xl font-bold" style={{ color: healthColor }}>{healthScore}</span>
              <span className="text-sm text-text-secondary">/ 100</span>
              <span className="text-[13px] font-semibold" style={{ color: healthColor }}>{healthLabel}</span>
            </div>
            <div className="bar-track-lg mb-3">
              <div className="bar-fill rounded-[3px]" style={{ width: `${healthScore}%`, background: healthColor }} />
            </div>
            <div className="flex flex-col gap-1 text-[11px] text-text-secondary">
              <span>חיסכון {savingsPct}% מההכנסה {savingsPct >= 20 ? '✓' : ''}</span>
              <span>קרנות: {emergencyMonths.toFixed(1)} חודשי הוצאות</span>
              <span>פנסיה: {pensionTotal > 0 ? '✓ פעילה' : '✗ אין נתונים'}</span>
              <span>יעדים: {totalGoalsTarget > 0 ? ((totalGoalsSaved / totalGoalsTarget) * 100).toFixed(0) : 0}%</span>
            </div>
          </div>
        </div>
      )}

      </>}
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
  dataLoading,
}: {
  summary: import('@/lib/queries/useFamily').FamilySummary | undefined
  totalSharedFromPersonal: number
  shared: import('@/lib/types').SharedExpense[] | undefined
  savingsGoals: import('@/lib/types').SavingsGoal[] | undefined
  goalDeposits: import('@/lib/types').GoalDeposit[] | undefined
  dataLoading: boolean
}) {
  if (!summary) {
    return <DashboardSkeleton />
  }

  const totalExpenses = summary.total_personal_expenses + summary.total_shared_expenses
  const familyNet = summary.total_income - totalExpenses
  const familySavingsPct = summary.total_income > 0 ? Math.round((familyNet / summary.total_income) * 100) : 0

  return (
    <>
      {/* Family KPIs */}
      <div className="grid-kpi">
        {[
          { label: 'הכנסה משפחתית', value: formatCurrency(summary.total_income), color: 'var(--accent-blue)', Icon: Wallet },
          { label: 'הוצאות כוללות', value: formatCurrency(totalExpenses), color: 'var(--accent-orange)', Icon: Receipt },
          {
            label: 'תזרים משפחתי',
            value: formatCurrency(familyNet),
            color: familyNet >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            Icon: TrendingUp,
          },
          {
            label: '% חיסכון משפחתי',
            value: `${familySavingsPct}%`,
            color: familySavingsPct >= 20 ? 'var(--accent-green)' : familySavingsPct >= 0 ? 'var(--accent-orange)' : 'var(--accent-red)',
            Icon: PiggyBank,
          },
        ].map(kpi => (
          <div key={kpi.label} className="kpi-card">
            <div className="flex justify-between items-center mb-2">
              <span className="kpi-label">{kpi.label}</span>
              <kpi.Icon size={14} className="opacity-70" style={{ color: kpi.color }} />
            </div>
            <div className="kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Per-member breakdown */}
      <div className="grid-3 mb-4">
        {summary.members.map(member => {
          const memberNet = member.income - member.personal_expenses
          return (
            <div key={member.user_id} className="card">
              <div className="flex items-center gap-2 mb-3.5">
                <Users size={14} className="text-accent-blue" />
                <span className="font-semibold text-sm">{member.display_name}</span>
              </div>
              {member.show_details ? (
                <div className="flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">הכנסה</span>
                    <span className="font-medium text-accent-green">{formatCurrency(member.income)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">הוצאות אישיות</span>
                    <span className="font-medium text-accent-orange">{formatCurrency(member.personal_expenses)}</span>
                  </div>
                  <div className="flex justify-between border-t border-t-bg-hover pt-2">
                    <span className="font-semibold">נטו</span>
                    <span className={`font-bold ${memberNet >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>{formatCurrency(memberNet)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-text-secondary">
                  <div className="flex justify-between mb-2">
                    <span>הכנסה</span>
                    <span className="font-medium text-accent-green">{formatCurrency(member.income)}</span>
                  </div>
                  <div className="text-xs text-text-secondary italic">פרטי הוצאות מוסתרים</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Shared expenses breakdown */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header mb-3.5">
            <Receipt size={14} className="text-accent-shared" /> הוצאות משותפות
          </div>
          <div className="text-[22px] font-bold text-accent-shared tracking-tight mb-3.5">
            {formatCurrency(summary.total_shared_expenses)}
          </div>
          {(shared ?? []).length > 0 && (
            <div className="flex flex-col gap-1.5 text-xs">
              {(shared ?? []).map(s => (
                <div key={s.id} className="flex justify-between">
                  <span className="text-text-secondary">{s.category}</span>
                  <span className="text-text-body">{formatCurrency(s.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
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
                    <span className="text-text-heading">{goal.icon} {goal.name}</span>
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
