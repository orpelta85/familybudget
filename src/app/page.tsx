'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome, useAllIncome } from '@/lib/queries/useIncome'
import { usePersonalExpenses, useBudgetCategories, useAllPersonalExpenses } from '@/lib/queries/useExpenses'
import { useSharedExpenses } from '@/lib/queries/useShared'
import { useApartmentDeposits } from '@/lib/queries/useApartment'
import { useSinkingFunds, useAllSinkingTransactions } from '@/lib/queries/useSinking'
import { useHasSetup } from '@/lib/queries/useSetup'
import { formatCurrency, periodLabel } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { Wallet, Receipt, TrendingUp, PiggyBank, Home, AlertTriangle, CalendarDays } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

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
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>()

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId])

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
  }, [user, userLoading, router])

  useEffect(() => {
    if (!userLoading && !setupLoading && user && hasSetup === false) router.push('/setup')
  }, [user, userLoading, hasSetup, setupLoading, router])

  const { data: income } = useIncome(selectedPeriodId, user?.id)
  const { data: allIncome } = useAllIncome(user?.id)
  const { data: expenses } = usePersonalExpenses(selectedPeriodId, user?.id)
  const { data: shared } = useSharedExpenses(selectedPeriodId)
  const { data: deposits } = useApartmentDeposits()
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
    return allExpenses.filter(e => e.period_id === yearAgoPeriodId).reduce((s, e) => s + e.amount, 0)
  }, [allExpenses, yearAgoPeriodId])

  if (userLoading || setupLoading) return (
    <div style={{ padding: 40, color: 'oklch(0.55 0.01 250)', fontSize: 14 }}>טוען...</div>
  )
  if (!user) return null

  // ── Core numbers ──────────────────────────────────────────────────────────
  const totalIncome = (income?.salary ?? 0) + (income?.bonus ?? 0) + (income?.other ?? 0)
  const totalPersonal = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const totalShared = shared?.reduce((s, e) => s + (e.my_share ?? e.total_amount * 0.5), 0) ?? 0
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
  const safeToSpend = totalIncome - fixedTargets - totalShared - variableSpent

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
    name: TYPE_LABELS[type] ?? type, value, color: TYPE_COLORS[type] ?? 'oklch(0.50 0.01 250)',
  }))

  // ── Sinking balance ───────────────────────────────────────────────────────
  function getFundBalance(fundId: number) {
    const txns = allSinkingTx?.filter(t => t.fund_id === fundId) ?? []
    return txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      - txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  }
  const totalFundBalance = (funds ?? []).reduce((s, f) => s + getFundBalance(f.id), 0)

  // ── Apartment ─────────────────────────────────────────────────────────────
  const APARTMENT_TARGET = 3500 * 36
  const totalSaved = deposits?.reduce((s, d) => s + d.amount_deposited, 0) ?? 0
  const apartmentPct = Math.min((totalSaved / APARTMENT_TARGET) * 100, 100)

  // ── Alerts ────────────────────────────────────────────────────────────────
  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const overspentCats = (categories ?? []).filter(c => {
    const pct = c.monthly_target > 0 ? (spendByCat[c.id] ?? 0) / c.monthly_target : 0
    return pct >= 0.9
  })
  const showAlert = !dataLoading && (netFlow < 0 || overspentCats.length > 0)

  function diffBadge(current: number, prev: number) {
    if (!prev) return null
    const pct = Math.round(((current - prev) / prev) * 100)
    const up = pct >= 0
    const color = up ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)'
    return <span style={{ fontSize: 11, color, fontWeight: 600 }}>{up ? '↑' : '↓'}{Math.abs(pct)}%</span>
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>דשבורד</h1>
        <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginTop: 4 }}>
          {selectedPeriod ? periodLabel(selectedPeriod.start_date) : '...'}
        </p>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

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
              <span style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{kpi.label}</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            <CalendarDays size={14} style={{ color: 'oklch(0.65 0.18 250)' }} />
            תחזית חודש נוכחי
          </div>
          {dataLoading
            ? <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>בחר תקופה</div>
            : (
              <div style={{ fontSize: 13 }}>
                {[
                  { label: 'הכנסה ידועה', value: totalIncome, color: 'oklch(0.70 0.18 145)', sign: '+' },
                  { label: 'הוצאות קבועות (יעד)', value: -fixedTargets, color: 'oklch(0.55 0.01 250)', sign: '-' },
                  { label: 'משותפות (שהוזן)', value: -totalShared, color: 'oklch(0.55 0.01 250)', sign: '-' },
                  { label: 'משתנות - הוצאתי', value: -variableSpent, color: 'oklch(0.72 0.18 55)', sign: '-' },
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
                  <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', marginTop: 6, direction: 'ltr', textAlign: 'left' }}>
                    יתרת תקציב משתנות: {formatCurrency(variableRemaining)}
                  </div>
                )}
              </div>
            )
          }
        </div>

        {/* Year-over-year */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            <TrendingUp size={14} style={{ color: 'oklch(0.70 0.15 185)' }} />
            לעומת שנה שעברה
          </div>
          {!yearAgoPeriodId
            ? <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>אין נתוני שנה שעברה (פחות מ-12 מחזורים)</div>
            : (
              <div style={{ fontSize: 13 }}>
                <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', marginBottom: 12 }}>
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
                    label: 'הוצאות אישיות',
                    current: totalPersonal,
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
                          <span style={{ color: 'oklch(0.45 0.01 250)', fontSize: 11 }}>/ {formatCurrency(row.prev ?? 0)}</span>
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
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>ניצול תקציב</div>
          {!(categories?.length)
            ? <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>אין קטגוריות</div>
            : [...(categories ?? [])]
              .filter(c => c.monthly_target > 0)
              .sort((a, b) => ((spendByCat[b.id] ?? 0) / b.monthly_target) - ((spendByCat[a.id] ?? 0) / a.monthly_target))
              .slice(0, 7)
              .map(cat => {
                const spent = spendByCat[cat.id] ?? 0
                const pct = Math.min(spent / cat.monthly_target, 1)
                const pctNum = Math.round(pct * 100)
                const barColor = pct >= 1 ? 'oklch(0.62 0.22 27)' : pct >= 0.9 ? 'oklch(0.72 0.18 55)' : 'oklch(0.65 0.18 250)'
                const avg = avgByCat[cat.id]
                const deviation = avg && avg > 0 ? Math.round(((spent - avg) / avg) * 100) : null
                return (
                  <div key={cat.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'oklch(0.80 0.01 250)' }}>{cat.name}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', direction: 'ltr' }}>
                        {deviation !== null && (
                          <span style={{ fontSize: 10, color: deviation > 15 ? 'oklch(0.62 0.22 27)' : deviation < -15 ? 'oklch(0.70 0.18 145)' : 'oklch(0.50 0.01 250)' }}>
                            {deviation > 0 ? `↑${deviation}%` : `↓${Math.abs(deviation)}%`}
                          </span>
                        )}
                        <span style={{ color: barColor, fontWeight: 600 }}>{pctNum}%</span>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'oklch(0.22 0.01 250)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${pctNum}%`, background: barColor, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })
          }
        </div>

        {/* Donut */}
        <div style={CARD}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>חלוקת הוצאות</div>
          {donutData.length === 0
            ? <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>אין נתונים</div>
            : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={2}>
                      {donutData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: unknown) => formatCurrency(Number(v))}
                      contentStyle={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, fontSize: 12, color: 'oklch(0.85 0.01 250)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginTop: 4 }}>
                  {donutData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ color: 'oklch(0.70 0.01 250)' }}>{d.name}</span>
                      <span style={{ color: 'oklch(0.55 0.01 250)', direction: 'ltr' }}>{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </div>
      </div>

      {/* ── Sinking funds + Apartment ──────────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 0 }}>

        {/* Sinking funds */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14 }}>
              <PiggyBank size={14} style={{ color: 'oklch(0.70 0.15 185)' }} /> קרנות צבירה
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.70 0.15 185)', direction: 'ltr' }}>
              {formatCurrency(totalFundBalance)}
            </div>
          </div>
          {!(funds?.length)
            ? <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>אין קרנות</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            <Home size={14} style={{ color: 'oklch(0.70 0.18 145)' }} /> יעד הדירה
          </div>
          <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', marginBottom: 16 }}>3,500 ₪ × 36 מחזורים = 126,000 ₪</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span style={{ fontSize: 26, fontWeight: 700, direction: 'ltr', color: 'oklch(0.70 0.18 145)' }}>{formatCurrency(totalSaved)}</span>
            <span style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)' }}>מתוך {formatCurrency(APARTMENT_TARGET)}</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: 'oklch(0.22 0.01 250)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${apartmentPct}%`, background: 'linear-gradient(90deg, oklch(0.55 0.18 145), oklch(0.70 0.18 145))', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'oklch(0.55 0.01 250)' }}>
            <span>{apartmentPct.toFixed(1)}% מהיעד</span>
            <span style={{ direction: 'ltr' }}>{formatCurrency(APARTMENT_TARGET - totalSaved)} נותר</span>
          </div>
        </div>
      </div>
    </div>
  )
}
