'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods } from '@/lib/queries/usePeriods'
import { useAllIncome } from '@/lib/queries/useIncome'
import { useAllPersonalExpenses } from '@/lib/queries/useExpenses'
import { useAllSharedExpenses } from '@/lib/queries/useShared'
import { useApartmentDeposits } from '@/lib/queries/useApartment'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { formatCurrency } from '@/lib/utils'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/Skeleton'

const IncomeVsExpensesChart = dynamic(() => import('@/components/dashboard/AnalyticsCharts').then(m => ({ default: m.IncomeVsExpensesChart })), {
  loading: () => <ChartSkeleton height={220} />,
  ssr: false,
})
const NetFlowChart = dynamic(() => import('@/components/dashboard/AnalyticsCharts').then(m => ({ default: m.NetFlowChart })), {
  loading: () => <ChartSkeleton height={180} />,
  ssr: false,
})

const YEAR_OPTIONS = [
  { label: 'הכל', periods: Array.from({ length: 36 }, (_, i) => i + 1) },
  { label: 'שנה 1 — 2025', periods: Array.from({ length: 12 }, (_, i) => i + 1) },
  { label: 'שנה 2 — 2026', periods: Array.from({ length: 12 }, (_, i) => i + 13) },
  { label: 'שנה 3 — 2027', periods: Array.from({ length: 12 }, (_, i) => i + 25) },
]

const PERIOD_SHORT_LABELS = [
  'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי',
  'אוג', 'ספט', 'אוק', 'נוב', 'דצמ', 'ינו',
]

// Generate labels for all 36 periods
const ALL_PERIOD_LABELS = [
  ...PERIOD_SHORT_LABELS.map(l => `${l} 25`),
  ...PERIOD_SHORT_LABELS.map(l => `${l} 26`),
  ...PERIOD_SHORT_LABELS.map(l => `${l} 27`),
]

export default function AnalyticsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const splitFrac = useSplitFraction(user?.id)
  const { data: periods } = usePeriods()
  const { data: allIncome } = useAllIncome(user?.id)
  const { data: allPersonal } = useAllPersonalExpenses(user?.id)
  const { data: allShared } = useAllSharedExpenses(familyId)
  const { data: deposits } = useApartmentDeposits(familyId)

  const [selectedYearIdx, setSelectedYearIdx] = useState(0)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return null

  const yearDef = YEAR_OPTIONS[selectedYearIdx]
  const periodIds = new Set(yearDef.periods)

  // Build per-period data for selected year
  const isAllView = selectedYearIdx === 0
  const labelsList = isAllView ? ALL_PERIOD_LABELS : PERIOD_SHORT_LABELS

  const chartData = yearDef.periods.map((periodId, i) => {
    const period = periods?.find(p => p.id === periodId)
    const income = allIncome?.find(inc => inc.period_id === periodId)
    const personalExpenses = allPersonal?.filter(e => e.period_id === periodId) ?? []
    const sharedExpenses = allShared?.filter(e => e.period_id === periodId) ?? []

    const totalIncome = income ? income.salary + income.bonus + income.other : 0
    const totalPersonal = personalExpenses.reduce((s, e) => s + e.amount, 0)
    const totalShared = sharedExpenses.reduce((s, e) => s + (e.my_share ?? e.total_amount * splitFrac), 0)
    const totalExpenses = totalPersonal + totalShared
    const netFlow = totalIncome - totalExpenses
    const deposit = deposits?.find(d => d.period_id === periodId)

    return {
      name: labelsList[i] ?? `מ${periodId}`,
      periodId,
      label: period?.label ?? `מחזור ${periodId}`,
      income: totalIncome,
      expenses: totalExpenses,
      personal: totalPersonal,
      shared: totalShared,
      net: netFlow,
      saved: deposit?.amount_deposited ?? 0,
    }
  })

  // Annual summary
  const yearIncome = chartData.reduce((s, d) => s + d.income, 0)
  const yearExpenses = chartData.reduce((s, d) => s + d.expenses, 0)
  const yearNet = yearIncome - yearExpenses
  const yearSaved = chartData.reduce((s, d) => s + d.saved, 0)
  const avgSavingsPct = yearIncome > 0 ? (yearNet / yearIncome) * 100 : 0
  const activeMonths = chartData.filter(d => d.income > 0).length

  const card: React.CSSProperties = {
    background: 'oklch(0.16 0.01 250)',
    border: '1px solid oklch(0.25 0.01 250)',
    borderRadius: 12,
    padding: 20,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <BarChart3 size={18} style={{ color: 'oklch(0.65 0.18 250)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>ניתוח שנתי</h1>
      </div>
      <p style={{ color: 'oklch(0.65 0.01 250)', fontSize: 13, marginBottom: 20 }}>
        סיכום הכנסות, הוצאות וחיסכון לאורך השנה
      </p>

      {/* Year selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {YEAR_OPTIONS.map((y, i) => (
          <button key={i} onClick={() => setSelectedYearIdx(i)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: selectedYearIdx === i ? 'oklch(0.65 0.18 250)' : 'oklch(0.20 0.01 250)',
              border: `1px solid ${selectedYearIdx === i ? 'oklch(0.65 0.18 250)' : 'oklch(0.28 0.01 250)'}`,
              color: selectedYearIdx === i ? 'oklch(0.10 0.01 250)' : 'oklch(0.70 0.01 250)',
            }}>
            {y.label}
          </button>
        ))}
      </div>

      {/* Annual KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        {[
          { label: 'הכנסות', value: formatCurrency(yearIncome), color: 'oklch(0.65 0.18 250)' },
          { label: 'הוצאות', value: formatCurrency(yearExpenses), color: 'oklch(0.72 0.18 55)' },
          { label: 'תזרים נקי', value: formatCurrency(yearNet), color: yearNet >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)' },
          { label: '% חיסכון ממוצע', value: `${avgSavingsPct.toFixed(1)}%`, color: 'oklch(0.70 0.15 185)' },
          { label: 'חיסכון לדירה', value: formatCurrency(yearSaved), color: 'oklch(0.70 0.18 145)' },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{kpi.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color, direction: 'ltr', letterSpacing: '-0.03em' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Income vs Expenses bar chart */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          הכנסות מול הוצאות — לפי מחזור
        </div>
        <IncomeVsExpensesChart data={chartData} />
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'oklch(0.65 0.01 250)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'oklch(0.65 0.18 250)', display: 'inline-block' }} /> הכנסות
          </span>
          <span style={{ fontSize: 12, color: 'oklch(0.65 0.01 250)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'oklch(0.72 0.18 55)', display: 'inline-block' }} /> הוצאות
          </span>
        </div>
      </div>

      {/* Net flow line chart */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>תזרים נקי לאורך השנה</div>
        <NetFlowChart data={chartData} />
      </div>

      {/* Monthly breakdown table */}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>פירוט חודשי</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid oklch(0.22 0.01 250)' }}>
                {['מחזור', 'הכנסות', 'אישי', 'משותף', 'סה"כ הוצ׳', 'תזרים', 'דירה'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: 'oklch(0.65 0.01 250)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => {
                const hasData = row.income > 0 || row.expenses > 0
                return (
                  <tr key={i} style={{ borderBottom: '1px solid oklch(0.20 0.01 250)', opacity: hasData ? 1 : 0.35 }}>
                    <td style={{ padding: '8px 12px', color: 'oklch(0.75 0.01 250)' }}>{row.name}</td>
                    <td style={{ padding: '8px 12px', direction: 'ltr', textAlign: 'right', color: 'oklch(0.65 0.18 250)', fontWeight: 500 }}>{row.income > 0 ? formatCurrency(row.income) : '—'}</td>
                    <td style={{ padding: '8px 12px', direction: 'ltr', textAlign: 'right' }}>{row.personal > 0 ? formatCurrency(row.personal) : '—'}</td>
                    <td style={{ padding: '8px 12px', direction: 'ltr', textAlign: 'right' }}>{row.shared > 0 ? formatCurrency(row.shared) : '—'}</td>
                    <td style={{ padding: '8px 12px', direction: 'ltr', textAlign: 'right', color: 'oklch(0.72 0.18 55)' }}>{row.expenses > 0 ? formatCurrency(row.expenses) : '—'}</td>
                    <td style={{ padding: '8px 12px', direction: 'ltr', textAlign: 'right', fontWeight: 600, color: row.net >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)' }}>
                      {row.income > 0 ? formatCurrency(row.net) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', direction: 'ltr', textAlign: 'right', color: 'oklch(0.70 0.18 145)' }}>{row.saved > 0 ? formatCurrency(row.saved) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid oklch(0.25 0.01 250)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'oklch(0.75 0.01 250)' }}>סה&quot;כ שנתי</td>
                <td style={{ padding: '10px 12px', direction: 'ltr', textAlign: 'right', fontWeight: 700, color: 'oklch(0.65 0.18 250)' }}>{formatCurrency(yearIncome)}</td>
                <td colSpan={2} />
                <td style={{ padding: '10px 12px', direction: 'ltr', textAlign: 'right', fontWeight: 700, color: 'oklch(0.72 0.18 55)' }}>{formatCurrency(yearExpenses)}</td>
                <td style={{ padding: '10px 12px', direction: 'ltr', textAlign: 'right', fontWeight: 700, color: yearNet >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)' }}>{formatCurrency(yearNet)}</td>
                <td style={{ padding: '10px 12px', direction: 'ltr', textAlign: 'right', fontWeight: 700, color: 'oklch(0.70 0.18 145)' }}>{formatCurrency(yearSaved)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
