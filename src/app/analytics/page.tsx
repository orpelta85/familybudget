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

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <BarChart3 size={18} className="text-[oklch(0.65_0.18_250)]" />
        <h1 className="text-xl font-bold tracking-tight">ניתוח שנתי</h1>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">
        סיכום הכנסות, הוצאות וחיסכון לאורך השנה
      </p>

      {/* Year selector */}
      <div className="flex gap-2 mb-5">
        {YEAR_OPTIONS.map((y, i) => (
          <button key={i} onClick={() => setSelectedYearIdx(i)}
            className={`py-[7px] px-4 rounded-lg text-[13px] font-medium cursor-pointer border ${
              selectedYearIdx === i
                ? 'bg-[oklch(0.65_0.18_250)] border-[oklch(0.65_0.18_250)] text-[oklch(0.10_0.01_250)]'
                : 'bg-[oklch(0.20_0.01_250)] border-[oklch(0.28_0.01_250)] text-[oklch(0.70_0.01_250)]'
            }`}>
            {y.label}
          </button>
        ))}
      </div>

      {/* Annual KPI cards */}
      <div className="grid-kpi mb-5">
        {[
          { label: 'הכנסות', value: formatCurrency(yearIncome), color: 'oklch(0.65_0.18_250)' },
          { label: 'הוצאות', value: formatCurrency(yearExpenses), color: 'oklch(0.72_0.18_55)' },
          { label: 'תזרים נקי', value: formatCurrency(yearNet), color: yearNet >= 0 ? 'oklch(0.70_0.18_145)' : 'oklch(0.62_0.22_27)' },
          { label: '% חיסכון ממוצע', value: `${avgSavingsPct.toFixed(1)}%`, color: 'oklch(0.70_0.15_185)' },
          { label: 'חיסכון לדירה', value: formatCurrency(yearSaved), color: 'oklch(0.70_0.18_145)' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-4">
            <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">{kpi.label}</div>
            <div className={`text-xl font-bold ltr tracking-tight text-[${kpi.color}]`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Income vs Expenses bar chart */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
        <div className="font-semibold text-sm mb-4 flex items-center gap-2">
          הכנסות מול הוצאות — לפי מחזור
        </div>
        <IncomeVsExpensesChart data={chartData} />
        <div className="flex gap-4 justify-center mt-2">
          <span className="text-xs text-[oklch(0.65_0.01_250)] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[oklch(0.65_0.18_250)] inline-block" /> הכנסות
          </span>
          <span className="text-xs text-[oklch(0.65_0.01_250)] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[oklch(0.72_0.18_55)] inline-block" /> הוצאות
          </span>
        </div>
      </div>

      {/* Net flow line chart */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
        <div className="font-semibold text-sm mb-4">תזרים נקי לאורך השנה</div>
        <NetFlowChart data={chartData} />
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
        <div className="font-semibold text-sm mb-3.5">פירוט חודשי</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[oklch(0.22_0.01_250)]">
                {['מחזור', 'הכנסות', 'אישי', 'משותף', 'סה"כ הוצ׳', 'תזרים', 'דירה'].map(h => (
                  <th key={h} className="py-2 px-3 text-right text-[oklch(0.65_0.01_250)] font-medium text-[11px] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => {
                const hasData = row.income > 0 || row.expenses > 0
                return (
                  <tr key={i} className={`border-b border-[oklch(0.20_0.01_250)] ${hasData ? 'opacity-100' : 'opacity-35'}`}>
                    <td className="py-2 px-3 text-[oklch(0.75_0.01_250)]">{row.name}</td>
                    <td className="py-2 px-3 ltr text-right text-[oklch(0.65_0.18_250)] font-medium">{row.income > 0 ? formatCurrency(row.income) : '—'}</td>
                    <td className="py-2 px-3 ltr text-right">{row.personal > 0 ? formatCurrency(row.personal) : '—'}</td>
                    <td className="py-2 px-3 ltr text-right">{row.shared > 0 ? formatCurrency(row.shared) : '—'}</td>
                    <td className="py-2 px-3 ltr text-right text-[oklch(0.72_0.18_55)]">{row.expenses > 0 ? formatCurrency(row.expenses) : '—'}</td>
                    <td className={`py-2 px-3 ltr text-right font-semibold ${row.net >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>
                      {row.income > 0 ? formatCurrency(row.net) : '—'}
                    </td>
                    <td className="py-2 px-3 ltr text-right text-[oklch(0.70_0.18_145)]">{row.saved > 0 ? formatCurrency(row.saved) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[oklch(0.25_0.01_250)]">
                <td className="py-2.5 px-3 font-semibold text-[oklch(0.75_0.01_250)]">סה&quot;כ שנתי</td>
                <td className="py-2.5 px-3 ltr text-right font-bold text-[oklch(0.65_0.18_250)]">{formatCurrency(yearIncome)}</td>
                <td colSpan={2} />
                <td className="py-2.5 px-3 ltr text-right font-bold text-[oklch(0.72_0.18_55)]">{formatCurrency(yearExpenses)}</td>
                <td className={`py-2.5 px-3 ltr text-right font-bold ${yearNet >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>{formatCurrency(yearNet)}</td>
                <td className="py-2.5 px-3 ltr text-right font-bold text-[oklch(0.70_0.18_145)]">{formatCurrency(yearSaved)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
