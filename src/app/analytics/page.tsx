'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods } from '@/lib/queries/usePeriods'
import { useAllIncome, useFamilyAllIncome } from '@/lib/queries/useIncome'
import { useAllPersonalExpenses, useBudgetCategories, useFamilyAllPersonalExpenses } from '@/lib/queries/useExpenses'
import { useAllSharedExpenses } from '@/lib/queries/useShared'
import { useApartmentDeposits } from '@/lib/queries/useApartment'
import { useSinkingFunds, useAllSinkingTransactions } from '@/lib/queries/useSinking'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { formatCurrency } from '@/lib/utils'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { BarChart3, Download, FileText } from 'lucide-react'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'
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

const PERIOD_SHORT_LABELS = [
  'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי',
  'אוג', 'ספט', 'אוק', 'נוב', 'דצמ', 'ינו',
]

function buildYearOptions(periods: { id: number; year_number: number; start_date: string }[] | undefined) {
  if (!periods || periods.length === 0) {
    return [{ label: 'הכל', periods: [] as number[] }]
  }
  const allIds = periods.map(p => p.id)
  const yearMap = new Map<number, number[]>()
  for (const p of periods) {
    const arr = yearMap.get(p.year_number) ?? []
    arr.push(p.id)
    yearMap.set(p.year_number, arr)
  }
  const sortedYears = [...yearMap.keys()].sort((a, b) => a - b)
  const yearOptions: { label: string; periods: number[] }[] = [
    { label: 'הכל', periods: allIds },
  ]
  for (const yn of sortedYears) {
    const firstPeriod = periods.find(p => p.year_number === yn)
    const calendarYear = firstPeriod ? new Date(firstPeriod.start_date).getFullYear() : 2024 + yn
    yearOptions.push({ label: `שנה ${yn} — ${calendarYear}`, periods: yearMap.get(yn)! })
  }
  return yearOptions
}

function buildAllPeriodLabels(periods: { id: number; year_number: number; start_date: string }[] | undefined) {
  if (!periods || periods.length === 0) return []
  const yearMap = new Map<number, number>()
  for (const p of periods) {
    if (!yearMap.has(p.year_number)) {
      yearMap.set(p.year_number, new Date(p.start_date).getFullYear() % 100)
    }
  }
  const sortedYears = [...yearMap.keys()].sort((a, b) => a - b)
  const labels: string[] = []
  for (const yn of sortedYears) {
    const suffix = yearMap.get(yn)!
    const count = periods.filter(p => p.year_number === yn).length
    for (let i = 0; i < count; i++) {
      labels.push(`${PERIOD_SHORT_LABELS[i % PERIOD_SHORT_LABELS.length]} ${suffix}`)
    }
  }
  return labels
}

export default function AnalyticsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId, members, isSolo } = useFamilyContext()
  const { viewMode } = useFamilyView()
  const isFamily = viewMode === 'family'
  const familyMemberIds = useMemo(() => members.map(m => m.user_id), [members])
  const splitFrac = useSplitFraction(user?.id)
  const { data: periods } = usePeriods()
  const { data: myIncome } = useAllIncome(user?.id)
  const { data: familyIncomeData } = useFamilyAllIncome(familyMemberIds, isFamily)
  const allIncome = isFamily ? familyIncomeData : myIncome
  const { data: myPersonal } = useAllPersonalExpenses(user?.id)
  const { data: familyPersonalData } = useFamilyAllPersonalExpenses(familyMemberIds, isFamily)
  const allPersonal = isFamily ? familyPersonalData : myPersonal
  const { data: allShared } = useAllSharedExpenses(isSolo ? undefined : familyId)
  const { data: deposits } = useApartmentDeposits(familyId)
  const { data: categories } = useBudgetCategories(user?.id)
  const { data: sinkingFunds } = useSinkingFunds(user?.id)
  const { data: allSinkingTx } = useAllSinkingTransactions(user?.id)

  const [selectedYearIdx, setSelectedYearIdx] = useState(0)
  const YEAR_OPTIONS = useMemo(() => buildYearOptions(periods), [periods])
  const ALL_PERIOD_LABELS = useMemo(() => buildAllPeriodLabels(periods), [periods])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  async function handleDownloadReport() {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Summary sheet
      const summaryRows = [
        ['דוח שנתי', yearDef.label],
        [],
        ['סה"כ הכנסות', yearIncome],
        ['סה"כ הוצאות', yearExpenses],
        ['תזרים נקי', yearNet],
        ['% חיסכון', `${avgSavingsPct.toFixed(1)}%`],
        ['חיסכון לדירה', yearSaved],
        ['חודשים פעילים', activeMonths],
      ]
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows)
      summaryWs['!cols'] = [{ wch: 20 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, summaryWs, 'סיכום')

      // Monthly detail sheet
      const monthHeaders = ['מחזור', 'הכנסות', 'הוצאות אישי', 'הוצאות משותף', 'סה"כ הוצאות', 'תזרים', 'דירה']
      const monthRows = chartData.map(d => [d.name, d.income, d.personal, d.shared, d.expenses, d.net, d.saved])
      monthRows.push(['סה"כ', yearIncome, '', '', yearExpenses, yearNet, yearSaved])
      const monthWs = XLSX.utils.aoa_to_sheet([monthHeaders, ...monthRows])
      monthWs['!cols'] = monthHeaders.map(() => ({ wch: 16 }))
      XLSX.utils.book_append_sheet(wb, monthWs, 'פירוט חודשי')

      // Category breakdown sheet
      const filteredPersonal = (allPersonal ?? []).filter(e => new Set(yearDef.periods).has(e.period_id))
      const catMap: Record<string, number> = {}
      for (const e of filteredPersonal) {
        const name = categories?.find(c => c.id === e.category_id)?.name ?? 'אחר'
        catMap[name] = (catMap[name] ?? 0) + e.amount
      }
      const catRows = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([name, amount]) => [name, amount, yearIncome > 0 ? `${((amount / yearIncome) * 100).toFixed(1)}%` : ''])
      const catWs = XLSX.utils.aoa_to_sheet([['קטגוריה', 'סכום', '% מהכנסה'], ...catRows])
      catWs['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, catWs, 'קטגוריות')

      // Sinking fund progress sheet
      if (sinkingFunds?.length) {
        const fundRows = sinkingFunds.map(f => {
          const txns = (allSinkingTx ?? []).filter(t => t.fund_id === f.id)
          const balance = txns.reduce((s, t) => s + t.amount, 0)
          const pct = f.yearly_target > 0 ? Math.round((balance / f.yearly_target) * 100) : 0
          return [f.name, f.monthly_allocation, f.yearly_target, balance, `${pct}%`]
        })
        const fundWs = XLSX.utils.aoa_to_sheet([['קרן', 'הפקדה חודשית', 'יעד שנתי', 'יתרה', '% התקדמות'], ...fundRows])
        fundWs['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
        XLSX.utils.book_append_sheet(wb, fundWs, 'קרנות צבירה')
      }

      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `דוח_שנתי_${yearDef.label}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export annual report:', e)
    }
  }

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
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-[var(--accent-blue)]" />
          <h1 className="text-xl font-bold tracking-tight">ניתוח שנתי</h1>
          <PageInfo {...PAGE_TIPS.analytics} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            const yearNum = selectedYearIdx === 0 ? 2 : selectedYearIdx
            window.open(`/api/reports/annual?year=${yearNum}`, '_blank')
          }} className="flex items-center gap-1.5 bg-[var(--c-shared-0-20)] border border-[var(--c-shared-0-32)] rounded-lg px-3.5 py-[7px] text-[var(--c-shared-0-70)] text-[13px] font-medium cursor-pointer">
            <Download size={13} /> דוח שנתי PDF
          </button>
          <button onClick={handleDownloadReport} className="flex items-center gap-1.5 bg-[var(--c-blue-0-20)] border border-[var(--c-blue-0-32)] rounded-lg px-3.5 py-[7px] text-[var(--accent-blue)] text-[13px] font-medium cursor-pointer">
            <FileText size={13} /> הורד Excel
          </button>
        </div>
      </div>
      <p className="text-[var(--text-secondary)] text-[13px] mb-5">
        סיכום הכנסות, הוצאות וחיסכון לאורך השנה
      </p>

      {/* Year selector */}
      <div className="flex gap-2 mb-5">
        {YEAR_OPTIONS.map((y, i) => (
          <button key={i} onClick={() => setSelectedYearIdx(i)}
            className={`py-[7px] px-4 rounded-lg text-[13px] font-medium cursor-pointer border ${
              selectedYearIdx === i
                ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)] text-[var(--c-0-10)]'
                : 'bg-[var(--c-0-20)] border-[var(--border-light)] text-[var(--c-0-70)]'
            }`}>
            {y.label}
          </button>
        ))}
      </div>

      {/* Annual KPI cards */}
      <div className="grid-kpi mb-5">
        {[
          { label: 'הכנסות', value: formatCurrency(yearIncome), color: 'var(--accent-blue)' },
          { label: 'הוצאות', value: formatCurrency(yearExpenses), color: 'var(--accent-orange)' },
          { label: 'תזרים נקי', value: formatCurrency(yearNet), color: yearNet >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
          { label: '% חיסכון ממוצע', value: `${avgSavingsPct.toFixed(1)}%`, color: 'var(--accent-teal)' },
          { label: 'חיסכון לדירה', value: formatCurrency(yearSaved), color: 'var(--accent-green)' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4">
            <div className="text-[11px] text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide">{kpi.label}</div>
            <div className={`text-xl font-bold tracking-tight text-[${kpi.color}]`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Income vs Expenses bar chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 mb-4">
        <div className="font-semibold text-sm mb-4 flex items-center gap-2">
          הכנסות מול הוצאות — לפי מחזור
        </div>
        <IncomeVsExpensesChart data={chartData} />
        <div className="flex gap-4 justify-center mt-2">
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--accent-blue)] inline-block" /> הכנסות
          </span>
          <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--accent-orange)] inline-block" /> הוצאות
          </span>
        </div>
      </div>

      {/* Net flow line chart */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 mb-4">
        <div className="font-semibold text-sm mb-4">תזרים נקי לאורך השנה</div>
        <NetFlowChart data={chartData} />
      </div>

      {/* Money Flow (Sankey-style) */}
      {yearIncome > 0 && (() => {
        // Build category breakdown for selected period
        const filteredPersonal = (allPersonal ?? []).filter(e => periodIds.has(e.period_id))
        const filteredShared = (allShared ?? []).filter(e => periodIds.has(e.period_id))
        const catMap: Record<string, number> = {}
        for (const e of filteredPersonal) {
          const name = categories?.find(c => c.id === e.category_id)?.name ?? 'אחר'
          catMap[name] = (catMap[name] ?? 0) + e.amount
        }
        const sharedTotal = filteredShared.reduce((s, e) => s + (e.my_share ?? e.total_amount * splitFrac), 0)
        if (sharedTotal > 0) catMap['משותפות'] = sharedTotal
        const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
        const maxCat = sorted[0]?.[1] ?? 1

        return (
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 mb-4">
            <div className="font-semibold text-sm mb-4">זרימת כסף — הכנסה → קטגוריות</div>
            <div className="flex flex-col gap-2">
              {sorted.map(([name, amount]) => {
                const pct = (amount / yearIncome) * 100
                const width = Math.max(2, (amount / maxCat) * 100)
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-[12px] text-[var(--c-0-70)] w-24 text-right truncate shrink-0">{name}</span>
                    <div className="flex-1 h-5 rounded-sm bg-[var(--c-0-20)] overflow-hidden">
                      <div className="h-full rounded-sm bg-[var(--c-blue-0-50)] transition-[width] duration-500" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-[11px] text-[var(--text-secondary)] w-16 text-right shrink-0">{formatCurrency(amount)}</span>
                    <span className="text-[10px] text-[var(--text-muted)] w-10 text-right shrink-0">{pct.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
            {yearNet > 0 && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--bg-hover)]">
                <span className="text-[12px] text-[var(--accent-green)] w-24 text-right shrink-0 font-semibold">חיסכון</span>
                <div className="flex-1 h-5 rounded-sm bg-[var(--c-0-20)] overflow-hidden">
                  <div className="h-full rounded-sm bg-[var(--c-green-0-50)] transition-[width] duration-500" style={{ width: `${Math.max(2, (yearNet / maxCat) * 100)}%` }} />
                </div>
                <span className="text-[11px] text-[var(--accent-green)] w-16 text-right shrink-0 font-semibold">{formatCurrency(yearNet)}</span>
                <span className="text-[10px] text-[var(--text-muted)] w-10 text-right shrink-0">{((yearNet / yearIncome) * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* Monthly breakdown table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
        <div className="font-semibold text-sm mb-3.5">פירוט חודשי</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--bg-hover)]">
                {['מחזור', 'הכנסות', 'אישי', 'משותף', 'סה"כ הוצ׳', 'תזרים', 'דירה'].map(h => (
                  <th key={h} className="py-2 px-3 text-right text-[var(--text-secondary)] font-medium text-[11px] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, i) => {
                const hasData = row.income > 0 || row.expenses > 0
                return (
                  <tr key={i} className={`border-b border-[var(--c-0-20)] ${hasData ? 'opacity-100' : 'opacity-35'}`}>
                    <td className="py-2 px-3 text-[var(--text-body)]">{row.name}</td>
                    <td className="py-2 px-3 text-right text-[var(--accent-blue)] font-medium">{row.income > 0 ? formatCurrency(row.income) : '—'}</td>
                    <td className="py-2 px-3 text-right">{row.personal > 0 ? formatCurrency(row.personal) : '—'}</td>
                    <td className="py-2 px-3 text-right">{row.shared > 0 ? formatCurrency(row.shared) : '—'}</td>
                    <td className="py-2 px-3 text-right text-[var(--accent-orange)]">{row.expenses > 0 ? formatCurrency(row.expenses) : '—'}</td>
                    <td className={`py-2 px-3 text-right font-semibold ${row.net >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                      {row.income > 0 ? formatCurrency(row.net) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-[var(--accent-green)]">{row.saved > 0 ? formatCurrency(row.saved) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border-default)]">
                <td className="py-2.5 px-3 font-semibold text-[var(--text-body)]">סה&quot;כ שנתי</td>
                <td className="py-2.5 px-3 text-right font-bold text-[var(--accent-blue)]">{formatCurrency(yearIncome)}</td>
                <td colSpan={2} />
                <td className="py-2.5 px-3 text-right font-bold text-[var(--accent-orange)]">{formatCurrency(yearExpenses)}</td>
                <td className={`py-2.5 px-3 text-right font-bold ${yearNet >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>{formatCurrency(yearNet)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-[var(--accent-green)]">{formatCurrency(yearSaved)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
