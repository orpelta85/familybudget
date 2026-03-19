'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome, useAllIncome } from '@/lib/queries/useIncome'
import { usePersonalExpenses, useBudgetCategories, useAllPersonalExpenses } from '@/lib/queries/useExpenses'
import { useSharedExpenses, useAllSharedExpenses } from '@/lib/queries/useShared'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { useApartmentDeposits } from '@/lib/queries/useApartment'
import { useSinkingFunds, useAllSinkingTransactions } from '@/lib/queries/useSinking'
import { usePensionReports } from '@/lib/queries/usePension'
import { useHasSetup } from '@/lib/queries/useSetup'
import { formatCurrency, periodLabel } from '@/lib/utils'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilySummary } from '@/lib/queries/useFamily'
import { APARTMENT_TARGET, APARTMENT_MONTHLY_DEPOSIT, APARTMENT_TOTAL_PERIODS } from '@/lib/constants'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { Wallet, Receipt, TrendingUp, PiggyBank, Home, AlertTriangle, CalendarDays, Users } from 'lucide-react'
import dynamic from 'next/dynamic'
import { DashboardSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'

const ExpenseDonut = dynamic(() => import('@/components/dashboard/ExpenseDonut').then(m => ({ default: m.ExpenseDonut })), {
  loading: () => <ChartSkeleton height={150} />,
  ssr: false,
})

const CARD: React.CSSProperties = {
  background: 'oklch(0.16 0.01 250)',
  border: '1px solid oklch(0.25 0.01 250)',
  borderRadius: 12,
  padding: 20,
}

const TYPE_COLORS: Record<string, string> = {
  fixed: 'oklch(0.65 0.18 250)',
  variable: 'oklch(0.72 0.18 55)',
  sinking: 'oklch(0.70 0.15 185)',
  savings: 'oklch(0.70 0.18 145)',
  shared: 'oklch(0.68 0.12 310)',
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
  const [viewMode, setViewMode] = useState<'personal' | 'family'>('personal')
  const { data: familySummary } = useFamilySummary(selectedPeriodId, viewMode === 'family')

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
  const { data: deposits } = useApartmentDeposits(familyId)
  const { data: pensionReports } = usePensionReports(user?.id)
  const { data: categories } = useBudgetCategories(user?.id, selectedYear)
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

  // ── Apartment ─────────────────────────────────────────────────────────────
  const totalSaved = deposits?.reduce((s, d) => s + d.amount_deposited, 0) ?? 0
  const apartmentPct = Math.min((totalSaved / APARTMENT_TARGET) * 100, 100)

  // ── Alerts ────────────────────────────────────────────────────────────────
  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const overspentCats = (categories ?? []).filter(c => {
    const pct = c.monthly_target > 0 ? (spendByCat[c.id] ?? 0) / c.monthly_target : 0
    return pct >= 0.9
  })
  const showAlert = !dataLoading && (netFlow < 0 || overspentCats.length > 0)

  // ── Net Worth ─────────────────────────────────────────────────────────────
  const pensionTotal = pensionReports?.[0]?.total_savings ?? 0
  const netWorth = totalFundBalance + totalSaved + pensionTotal

  // ── Financial Health Score (0-100) ─────────────────────────────────────────
  const healthScores: number[] = []
  // 1. Savings rate (0-30 points): 20%+ = full, 0% = 0
  if (totalIncome > 0) healthScores.push(Math.min(savingsPct / 20 * 30, 30))
  // 2. Budget adherence (0-20 points): % of categories under target
  const catsWithTarget = (categories ?? []).filter(c => c.monthly_target > 0)
  if (catsWithTarget.length > 0) {
    const underBudget = catsWithTarget.filter(c => (spendByCat[c.id] ?? 0) <= c.monthly_target).length
    healthScores.push((underBudget / catsWithTarget.length) * 20)
  }
  // 3. Emergency fund (0-20 points): 3 months expenses = full
  const emergencyMonths = totalExpenses > 0 ? totalFundBalance / totalExpenses : 0
  healthScores.push(totalExpenses > 0 ? Math.min(emergencyMonths / 3 * 20, 20) : 0)
  // 4. Pension saving (0-15 points): has pension = 15
  healthScores.push(pensionTotal > 0 ? 15 : 0)
  // 5. Apartment progress (0-15 points): proportional to target
  healthScores.push((totalSaved / APARTMENT_TARGET) * 15)

  const healthScore = Math.round(healthScores.reduce((s, v) => s + v, 0))
  const healthColor = healthScore >= 75 ? 'oklch(0.70 0.18 145)' : healthScore >= 50 ? 'oklch(0.72 0.18 55)' : 'oklch(0.62 0.22 27)'
  const healthLabel = healthScore >= 75 ? 'מצוין' : healthScore >= 50 ? 'סביר' : 'דורש שיפור'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>דשבורד</h1>
          <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginTop: 4 }}>
            {selectedPeriod ? periodLabel(selectedPeriod.start_date) : '...'}
          </p>
        </div>
        {familyId && (
          <div style={{ display: 'flex', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 8, overflow: 'hidden' }}>
            {([
              { key: 'personal' as const, label: 'אישי' },
              { key: 'family' as const, label: 'משפחתי' },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setViewMode(opt.key)}
                style={{
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  background: viewMode === opt.key ? 'oklch(0.22 0.05 250)' : 'transparent',
                  color: viewMode === opt.key ? 'oklch(0.90 0.01 250)' : 'oklch(0.65 0.01 250)',
                  borderRight: opt.key === 'personal' ? '1px solid oklch(0.25 0.01 250)' : 'none',
                  ...(viewMode === opt.key ? { boxShadow: 'inset 0 0 0 1px oklch(0.45 0.15 250)' } : {}),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* ── Family View ──────────────────────────────────────────────────── */}
      {viewMode === 'family' && (
        <FamilyDashboard
          summary={familySummary}
          totalSharedFromPersonal={totalShared}
          shared={shared}
          deposits={deposits}
          APARTMENT_TARGET={APARTMENT_TARGET}
          totalSaved={totalSaved}
          apartmentPct={apartmentPct}
          dataLoading={dataLoading}
        />
      )}

      {/* ── Personal View ────────────────────────────────────────────────── */}
      {viewMode === 'personal' && <>

      {/* ── Alert bar ──────────────────────────────────────────────────────── */}
      {showAlert && (
        <div style={{
          background: 'oklch(0.17 0.06 30)', border: '1px solid oklch(0.32 0.10 30)',
          borderRadius: 10, padding: '11px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <AlertTriangle size={15} style={{ color: 'oklch(0.75 0.18 55)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'oklch(0.85 0.05 55)', lineHeight: 1.5 }}>
            {netFlow < 0 && <span>תזרים שלילי החודש ({formatCurrency(netFlow)}). </span>}
            {overspentCats.length > 0 && <span>קרובים לתקרה: {overspentCats.map(c => c.name).join(' · ')}</span>}
          </div>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid-kpi">
        {[
          { label: 'הכנסה נטו', value: dataLoading ? '—' : formatCurrency(totalIncome), color: 'oklch(0.65 0.18 250)', Icon: Wallet },
          { label: 'הוצאות החודש', value: dataLoading ? '—' : formatCurrency(totalExpenses), color: 'oklch(0.72 0.18 55)', Icon: Receipt },
          {
            label: 'תזרים נקי', value: dataLoading ? '—' : formatCurrency(netFlow),
            color: netFlow >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)', Icon: TrendingUp,
          },
          {
            label: '% חיסכון', value: dataLoading ? '—' : `${savingsPct}%`,
            color: savingsPct >= 20 ? 'oklch(0.70 0.18 145)' : savingsPct >= 0 ? 'oklch(0.72 0.18 55)' : 'oklch(0.62 0.22 27)',
            Icon: PiggyBank,
            sub: savingsPct >= 20 ? '✓ יעד חיסכון' : savingsPct >= 0 ? 'מתחת ל-20%' : 'גירעון',
          },
        ].map(kpi => (
          <div key={kpi.label} style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{kpi.label}</span>
              <kpi.Icon size={14} style={{ color: kpi.color, opacity: 0.7 }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, direction: 'ltr', letterSpacing: '-0.02em' }}>{kpi.value}</div>
            {kpi.sub && <div style={{ fontSize: 11, color: kpi.color, opacity: 0.7, marginTop: 4 }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Forecast + Year-over-year ──────────────────────────────────────── */}
      <div className="grid-2">

        {/* Forecast */}
        <div style={CARD}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, margin: 0, marginBottom: 16 }}>
            <CalendarDays size={14} style={{ color: 'oklch(0.65 0.18 250)' }} />
            תחזית חודש נוכחי
          </h2>
          {dataLoading
            ? <div style={{ color: 'oklch(0.65 0.01 250)', fontSize: 13 }}>בחר תקופה</div>
            : (
              <div style={{ fontSize: 13 }}>
                {[
                  { label: 'הכנסה ידועה', value: totalIncome, color: 'oklch(0.70 0.18 145)', sign: '+' },
                  { label: 'הוצאות קבועות (יעד)', value: -fixedTargets, color: 'oklch(0.65 0.01 250)', sign: '-' },
                  { label: 'משותפות (שהוזן)', value: -totalShared, color: 'oklch(0.65 0.01 250)', sign: '-' },
                  { label: 'משתנות (יעד)', value: -variableTargets, color: 'oklch(0.72 0.18 55)', sign: '-' },
                  ...(sinkingTargets > 0 ? [{ label: 'קרנות צבירה (יעד חודשי)', value: -sinkingTargets, color: 'oklch(0.70 0.15 185)', sign: '-' }] : []),
                  ...(savingsTargets > 0 ? [{ label: 'חיסכון (יעד חודשי)', value: -savingsTargets, color: 'oklch(0.70 0.18 145)', sign: '-' }] : []),
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid oklch(0.20 0.01 250)' }}>
                    <span style={{ color: 'oklch(0.70 0.01 250)' }}>{row.label}</span>
                    <span style={{ direction: 'ltr', color: row.color, fontWeight: 500 }}>
                      {row.sign}{formatCurrency(Math.abs(row.value))}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>נשאר בטוח להוציא</span>
                  <span style={{
                    fontSize: 16, fontWeight: 700, direction: 'ltr',
                    color: safeToSpend >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)',
                  }}>
                    {formatCurrency(safeToSpend)}
                  </span>
                </div>
                {variableRemaining > 0 && (
                  <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginTop: 6, direction: 'ltr', textAlign: 'left' }}>
                    יתרת תקציב משתנות: {formatCurrency(variableRemaining)}
                  </div>
                )}
              </div>
            )
          }
        </div>

        {/* Year-over-year */}
        <div style={CARD}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, margin: 0, marginBottom: 16 }}>
            <TrendingUp size={14} style={{ color: 'oklch(0.70 0.15 185)' }} />
            לעומת שנה שעברה
          </h2>
          {!yearAgoPeriodId
            ? <div style={{ color: 'oklch(0.65 0.01 250)', fontSize: 13 }}>אין נתוני שנה שעברה (פחות מ-12 מחזורים)</div>
            : (
              <div style={{ fontSize: 13 }}>
                <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginBottom: 12 }}>
                  {yearAgoPeriod ? periodLabel(yearAgoPeriod.start_date) : ''} → {selectedPeriod ? periodLabel(selectedPeriod.start_date) : ''}
                </div>
                {[
                  {
                    label: 'הכנסה',
                    current: totalIncome,
                    prev: yearAgoTotalIncome,
                    positiveIsGood: true,
                  },
                  {
                    label: 'הוצאות',
                    current: totalExpenses,
                    prev: yearAgoExpenses,
                    positiveIsGood: false,
                  },
                  {
                    label: 'תזרים נקי',
                    current: netFlow,
                    prev: yearAgoTotalIncome ? yearAgoTotalIncome - yearAgoExpenses : null,
                    positiveIsGood: true,
                  },
                ].map(row => {
                  const pct = row.prev ? Math.round(((row.current - row.prev) / Math.abs(row.prev)) * 100) : null
                  const isGood = pct === null ? null : row.positiveIsGood ? pct >= 0 : pct <= 0
                  return (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid oklch(0.20 0.01 250)' }}>
                      <span style={{ color: 'oklch(0.75 0.01 250)' }}>{row.label}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', direction: 'ltr' }}>
                        {pct !== null && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: isGood ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)' }}>
                            {pct >= 0 ? `↑${pct}%` : `↓${Math.abs(pct)}%`}
                          </span>
                        )}
                        <span style={{ fontWeight: 500 }}>{formatCurrency(row.current)}</span>
                        {row.prev !== null && (
                          <span style={{ color: 'oklch(0.65 0.01 250)', fontSize: 11 }}>/ {formatCurrency(row.prev ?? 0)}</span>
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
        <div style={CARD}>
          <h2 style={{ fontWeight: 600, fontSize: 14, margin: 0, marginBottom: 14 }}>ניצול תקציב</h2>
          {!(categories?.length)
            ? <div style={{ color: 'oklch(0.65 0.01 250)', fontSize: 13 }}>אין קטגוריות</div>
            : [...(categories ?? [])]
              .filter(c => c.monthly_target > 0)
              .sort((a, b) => ((spendByCat[b.id] ?? 0) / b.monthly_target) - ((spendByCat[a.id] ?? 0) / a.monthly_target))
              .slice(0, 7)
              .map(cat => {
                const spent = spendByCat[cat.id] ?? 0
                const rawPct = spent / cat.monthly_target
                const pct = Math.min(rawPct, 1)
                const pctDisplay = Math.round(rawPct * 100)
                const barColor = rawPct >= 1 ? 'oklch(0.62 0.22 27)' : rawPct >= 0.9 ? 'oklch(0.72 0.18 55)' : 'oklch(0.65 0.18 250)'
                const avg = avgByCat[cat.id]
                const deviation = avg && avg > 0 ? Math.round(((spent - avg) / avg) * 100) : null
                return (
                  <div key={cat.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'oklch(0.80 0.01 250)' }}>{cat.name}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', direction: 'ltr' }}>
                        {deviation !== null && (
                          <span style={{ fontSize: 10, color: deviation > 15 ? 'oklch(0.62 0.22 27)' : deviation < -15 ? 'oklch(0.70 0.18 145)' : 'oklch(0.65 0.01 250)' }}>
                            {deviation > 0 ? `↑${deviation}%` : `↓${Math.abs(deviation)}%`}
                          </span>
                        )}
                        <span style={{ color: barColor, fontWeight: 600 }}>{pctDisplay}%</span>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'oklch(0.22 0.01 250)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${Math.round(pct * 100)}%`, background: barColor, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })
          }
        </div>

        {/* Donut */}
        <div style={CARD}>
          <h2 style={{ fontWeight: 600, fontSize: 14, margin: 0, marginBottom: 14 }}>חלוקת הוצאות</h2>
          <ExpenseDonut data={donutData} />
        </div>
      </div>

      {/* ── Sinking funds + Apartment ──────────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 0 }}>

        {/* Sinking funds */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, margin: 0 }}>
              <PiggyBank size={14} style={{ color: 'oklch(0.70 0.15 185)' }} /> קרנות צבירה
            </h2>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.70 0.15 185)', direction: 'ltr' }}>
              {formatCurrency(totalFundBalance)}
            </div>
          </div>
          {!(funds?.length)
            ? <div style={{ color: 'oklch(0.65 0.01 250)', fontSize: 13 }}>אין קרנות</div>
            : (funds ?? []).map(fund => {
              const balance = getFundBalance(fund.id)
              const annualTarget = fund.monthly_allocation * 12
              const pct = annualTarget > 0 ? Math.min((balance / annualTarget) * 100, 100) : 0
              return (
                <div key={fund.id} style={{ marginBottom: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: 'oklch(0.80 0.01 250)' }}>{fund.name}</span>
                    <span style={{ direction: 'ltr', fontWeight: 600, color: balance >= 0 ? 'oklch(0.70 0.15 185)' : 'oklch(0.62 0.22 27)' }}>
                      {formatCurrency(balance)}
                    </span>
                  </div>
                  {balance < 0 && (
                    <div style={{ fontSize: 10, color: 'oklch(0.65 0.01 250)', marginBottom: 2 }}>(הוצאה גדולה מהצבירה)</div>
                  )}
                  <div style={{ height: 4, borderRadius: 2, background: 'oklch(0.22 0.01 250)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${Math.max(0, pct)}%`, background: 'oklch(0.70 0.15 185)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* Apartment */}
        <div style={CARD}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, margin: 0, marginBottom: 6 }}>
            <Home size={14} style={{ color: 'oklch(0.70 0.18 145)' }} /> יעד הדירה
          </h2>
          <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginBottom: 16 }}>{formatCurrency(APARTMENT_MONTHLY_DEPOSIT)} × {APARTMENT_TOTAL_PERIODS} מחזורים = {formatCurrency(APARTMENT_TARGET)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span style={{ fontSize: 26, fontWeight: 700, direction: 'ltr', color: 'oklch(0.70 0.18 145)' }}>{formatCurrency(totalSaved)}</span>
            <span style={{ fontSize: 12, color: 'oklch(0.65 0.01 250)' }}>מתוך {formatCurrency(APARTMENT_TARGET)}</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: 'oklch(0.22 0.01 250)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${apartmentPct}%`, background: 'linear-gradient(90deg, oklch(0.55 0.18 145), oklch(0.70 0.18 145))', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'oklch(0.65 0.01 250)' }}>
            <span>{apartmentPct.toFixed(1)}% מהיעד</span>
            <span style={{ direction: 'ltr' }}>{formatCurrency(APARTMENT_TARGET - totalSaved)} נותר</span>
          </div>
        </div>
      </div>

      {/* ── Net Worth + Health Score ───────────────────────────────────────── */}
      {!dataLoading && totalIncome > 0 && (
        <div className="grid-2" style={{ marginTop: 14 }}>
          {/* Net Worth */}
          <div style={CARD}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, margin: 0, marginBottom: 14 }}>
              <Wallet size={14} style={{ color: 'oklch(0.68 0.18 295)' }} /> שווי נקי
            </h2>
            <div style={{ fontSize: 28, fontWeight: 700, direction: 'ltr', textAlign: 'left', color: netWorth >= 0 ? 'oklch(0.68 0.18 295)' : 'oklch(0.62 0.22 27)', marginBottom: 14 }}>
              {formatCurrency(netWorth)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {pensionTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'oklch(0.65 0.01 250)' }}>פנסיה והשקעות</span>
                  <span style={{ direction: 'ltr', color: 'oklch(0.70 0.01 250)' }}>{formatCurrency(pensionTotal)}</span>
                </div>
              )}
              {totalFundBalance !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'oklch(0.65 0.01 250)' }}>קרנות צבירה</span>
                  <span style={{ direction: 'ltr', color: 'oklch(0.70 0.01 250)' }}>{formatCurrency(totalFundBalance)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'oklch(0.65 0.01 250)' }}>חיסכון לדירה</span>
                <span style={{ direction: 'ltr', color: 'oklch(0.70 0.01 250)' }}>{formatCurrency(totalSaved)}</span>
              </div>
            </div>
          </div>

          {/* Health Score */}
          <div style={CARD}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, margin: 0, marginBottom: 14 }}>
              <TrendingUp size={14} style={{ color: healthColor }} /> בריאות פיננסית
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: healthColor }}>{healthScore}</span>
              <span style={{ fontSize: 14, color: 'oklch(0.65 0.01 250)' }}>/ 100</span>
              <span style={{ fontSize: 13, color: healthColor, fontWeight: 600 }}>{healthLabel}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'oklch(0.22 0.01 250)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${healthScore}%`, background: healthColor, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'oklch(0.65 0.01 250)' }}>
              <span>חיסכון {savingsPct}% מההכנסה {savingsPct >= 20 ? '✓' : ''}</span>
              <span>קרנות: {emergencyMonths.toFixed(1)} חודשי הוצאות</span>
              <span>פנסיה: {pensionTotal > 0 ? '✓ פעילה' : '✗ אין נתונים'}</span>
              <span>דירה: {apartmentPct.toFixed(0)}% מהיעד</span>
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
  deposits,
  APARTMENT_TARGET,
  totalSaved,
  apartmentPct,
  dataLoading,
}: {
  summary: import('@/lib/queries/useFamily').FamilySummary | undefined
  totalSharedFromPersonal: number
  shared: import('@/lib/types').SharedExpense[] | undefined
  deposits: import('@/lib/types').ApartmentDeposit[] | undefined
  APARTMENT_TARGET: number
  totalSaved: number
  apartmentPct: number
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
          { label: 'הכנסה משפחתית', value: formatCurrency(summary.total_income), color: 'oklch(0.65 0.18 250)', Icon: Wallet },
          { label: 'הוצאות כוללות', value: formatCurrency(totalExpenses), color: 'oklch(0.72 0.18 55)', Icon: Receipt },
          {
            label: 'תזרים משפחתי',
            value: formatCurrency(familyNet),
            color: familyNet >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)',
            Icon: TrendingUp,
          },
          {
            label: '% חיסכון משפחתי',
            value: `${familySavingsPct}%`,
            color: familySavingsPct >= 20 ? 'oklch(0.70 0.18 145)' : familySavingsPct >= 0 ? 'oklch(0.72 0.18 55)' : 'oklch(0.62 0.22 27)',
            Icon: PiggyBank,
          },
        ].map(kpi => (
          <div key={kpi.label} style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{kpi.label}</span>
              <kpi.Icon size={14} style={{ color: kpi.color, opacity: 0.7 }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, direction: 'ltr', letterSpacing: '-0.02em' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Per-member breakdown */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        {summary.members.map(member => {
          const memberNet = member.income - member.personal_expenses
          return (
            <div key={member.user_id} style={CARD}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Users size={14} style={{ color: 'oklch(0.65 0.18 250)' }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{member.display_name}</span>
              </div>
              {member.show_details ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'oklch(0.65 0.01 250)' }}>הכנסה</span>
                    <span style={{ direction: 'ltr', fontWeight: 500, color: 'oklch(0.70 0.18 145)' }}>{formatCurrency(member.income)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'oklch(0.65 0.01 250)' }}>הוצאות אישיות</span>
                    <span style={{ direction: 'ltr', fontWeight: 500, color: 'oklch(0.72 0.18 55)' }}>{formatCurrency(member.personal_expenses)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid oklch(0.22 0.01 250)', paddingTop: 8 }}>
                    <span style={{ fontWeight: 600 }}>נטו</span>
                    <span style={{ direction: 'ltr', fontWeight: 700, color: memberNet >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)' }}>{formatCurrency(memberNet)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'oklch(0.65 0.01 250)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>הכנסה</span>
                    <span style={{ direction: 'ltr', fontWeight: 500, color: 'oklch(0.70 0.18 145)' }}>{formatCurrency(member.income)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'oklch(0.65 0.01 250)', fontStyle: 'italic' }}>פרטי הוצאות מוסתרים</div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Shared expenses breakdown */}
      <div className="grid-2">
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
            <Receipt size={14} style={{ color: 'oklch(0.68 0.12 310)' }} /> הוצאות משותפות
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'oklch(0.68 0.12 310)', direction: 'ltr', letterSpacing: '-0.02em', marginBottom: 14 }}>
            {formatCurrency(summary.total_shared_expenses)}
          </div>
          {(shared ?? []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {(shared ?? []).map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'oklch(0.65 0.01 250)' }}>{s.category}</span>
                  <span style={{ direction: 'ltr', color: 'oklch(0.70 0.01 250)' }}>{formatCurrency(s.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Apartment */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            <Home size={14} style={{ color: 'oklch(0.70 0.18 145)' }} /> יעד הדירה
          </div>
          <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginBottom: 16 }}>{formatCurrency(APARTMENT_MONTHLY_DEPOSIT)} x {APARTMENT_TOTAL_PERIODS} = {formatCurrency(APARTMENT_TARGET)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span style={{ fontSize: 26, fontWeight: 700, direction: 'ltr', color: 'oklch(0.70 0.18 145)' }}>{formatCurrency(totalSaved)}</span>
            <span style={{ fontSize: 12, color: 'oklch(0.65 0.01 250)' }}>מתוך {formatCurrency(APARTMENT_TARGET)}</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: 'oklch(0.22 0.01 250)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${apartmentPct}%`, background: 'linear-gradient(90deg, oklch(0.55 0.18 145), oklch(0.70 0.18 145))', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'oklch(0.65 0.01 250)' }}>
            <span>{apartmentPct.toFixed(1)}% מהיעד</span>
            <span style={{ direction: 'ltr' }}>{formatCurrency(APARTMENT_TARGET - totalSaved)} נותר</span>
          </div>
        </div>
      </div>
    </>
  )
}
