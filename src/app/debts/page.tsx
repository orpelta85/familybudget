'use client'

import { useUser } from '@/lib/queries/useUser'
import { useDebts, useAddDebt, useDeleteDebt, useFamilyDebts } from '@/lib/queries/useDebts'
import { formatCurrency } from '@/lib/utils'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Calculator, Plus, X, Trash2, Inbox, TrendingDown, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PageInfo } from '@/components/ui/PageInfo'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { PAGE_TIPS } from '@/lib/page-tips'

type DebtType = 'fixed' | 'prime' | 'cpi_linked'
type Method = 'snowball' | 'avalanche'

interface DebtForm {
  name: string
  balance: string
  interestRate: string
  minimumPayment: string
  debtType: DebtType
  earlyPayoffPenalty: boolean
}

interface PayoffResult {
  months: number
  totalInterest: number
  balanceHistory: number[][] // [month][debtIndex]
  payoffOrder: string[]
}

function calculatePayoff(
  debts: { name: string; balance: number; interest_rate: number; minimum_payment: number }[],
  extraMonthly: number,
  method: Method,
): PayoffResult {
  if (debts.length === 0) return { months: 0, totalInterest: 0, balanceHistory: [], payoffOrder: [] }

  const sorted = debts.map((d, i) => ({ ...d, originalIndex: i }))
  if (method === 'snowball') {
    sorted.sort((a, b) => a.balance - b.balance)
  } else {
    sorted.sort((a, b) => b.interest_rate - a.interest_rate)
  }

  const balances = sorted.map(d => d.balance)
  const rates = sorted.map(d => d.interest_rate / 100 / 12)
  const mins = sorted.map(d => d.minimum_payment)
  const history: number[][] = [balances.map(b => b)]
  let totalInterest = 0
  const payoffOrder: string[] = []
  let month = 0
  const maxMonths = 600

  while (balances.some(b => b > 0.01) && month < maxMonths) {
    month++
    let extraLeft = extraMonthly

    // Apply interest
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue
      const interest = balances[i] * rates[i]
      totalInterest += interest
      balances[i] += interest
    }

    // Pay minimums
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue
      const payment = Math.min(mins[i], balances[i])
      balances[i] -= payment
    }

    // Apply extra to target debt (first unpaid in sorted order)
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue
      const payment = Math.min(extraLeft, balances[i])
      balances[i] -= payment
      extraLeft -= payment
      if (balances[i] <= 0.01) {
        balances[i] = 0
        payoffOrder.push(sorted[i].name)
        // Roll over: add this debt's minimum to extra for next round
        extraLeft += mins[i]
      }
      if (extraLeft <= 0) break
    }

    history.push(balances.map(b => Math.max(0, b)))
  }

  // Reorder history columns back to original order
  const reorderedHistory = history.map(row => {
    const newRow = new Array(debts.length).fill(0)
    sorted.forEach((d, sortedIdx) => {
      newRow[d.originalIndex] = row[sortedIdx]
    })
    return newRow
  })

  return { months: month, totalInterest: Math.round(totalInterest), balanceHistory: reorderedHistory, payoffOrder }
}

function calculateMinimumOnly(
  debts: { name: string; balance: number; interest_rate: number; minimum_payment: number }[],
): PayoffResult {
  return calculatePayoff(debts, 0, 'avalanche')
}

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  fixed: 'ריבית קבועה',
  prime: 'פריים',
  cpi_linked: 'צמוד מדד',
}

const COLORS = [
  'var(--accent-blue)',
  'var(--accent-orange)',
  'var(--accent-green)',
  'var(--accent-purple)',
  'var(--accent-red)',
]

export default function DebtsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { members } = useFamilyContext()
  const { viewMode } = useFamilyView()
  const isFamily = viewMode === 'family'
  const familyMemberIds = useMemo(() => members.map(m => m.user_id), [members])
  const { data: myDebts } = useDebts(user?.id)
  const { data: familyDebtsData } = useFamilyDebts(familyMemberIds, isFamily)
  const debts = isFamily ? familyDebtsData : myDebts
  const addDebt = useAddDebt()
  const deleteDebt = useDeleteDebt()
  const confirm = useConfirmDialog()

  const [newDebt, setNewDebt] = useState<DebtForm | null>(null)
  const [extraMonthly, setExtraMonthly] = useState('500')
  const [method, setMethod] = useState<Method>('avalanche')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const debtList = useMemo(() => (debts ?? []).map(d => ({
    name: d.name,
    balance: Number(d.balance),
    interest_rate: Number(d.interest_rate),
    minimum_payment: Number(d.minimum_payment),
  })), [debts])

  const extra = Number(extraMonthly) || 0
  const minimumResult = useMemo(() => calculateMinimumOnly(debtList), [debtList])
  const snowballResult = useMemo(() => calculatePayoff(debtList, extra, 'snowball'), [debtList, extra])
  const avalancheResult = useMemo(() => calculatePayoff(debtList, extra, 'avalanche'), [debtList, extra])
  const activeResult = method === 'snowball' ? snowballResult : avalancheResult

  const totalBalance = debtList.reduce((s, d) => s + d.balance, 0)
  const totalMinimum = debtList.reduce((s, d) => s + d.minimum_payment, 0)

  if (loading || !user) return <TableSkeleton rows={5} />

  async function handleAddDebt() {
    if (!newDebt || !user) return
    const balance = Number(newDebt.balance)
    const rate = Number(newDebt.interestRate)
    const min = Number(newDebt.minimumPayment)
    if (!newDebt.name.trim() || balance <= 0 || rate < 0 || min <= 0) return
    try {
      await addDebt.mutateAsync({
        user_id: user.id,
        name: newDebt.name.trim(),
        balance,
        interest_rate: rate,
        minimum_payment: min,
        debt_type: newDebt.debtType,
        early_payoff_penalty: newDebt.earlyPayoffPenalty,
      })
      toast.success('חוב נוסף')
      setNewDebt(null)
    } catch (e) { console.error('Add debt:', e); toast.error('שגיאה בהוספה') }
  }

  async function handleDeleteDebt(id: number, name: string) {
    if (!(await confirm({ message: `למחוק את "${name}"?` }))) return
    try {
      await deleteDebt.mutateAsync({ id, user_id: user!.id })
      toast.success('חוב נמחק')
    } catch (e) { console.error('Delete debt:', e); toast.error('שגיאה במחיקה') }
  }

  function formatMonths(m: number): string {
    const years = Math.floor(m / 12)
    const months = m % 12
    if (years === 0) return `${months} חודשים`
    if (months === 0) return `${years} שנים`
    return `${years} שנים ו-${months} חודשים`
  }

  // Stacked area chart data — sample every N months to fit
  const maxChartPoints = 36
  const step = Math.max(1, Math.floor(activeResult.balanceHistory.length / maxChartPoints))
  const chartData = activeResult.balanceHistory.filter((_, i) => i % step === 0 || i === activeResult.balanceHistory.length - 1)
  const chartMax = Math.max(...(chartData[0] ?? [0]), 1)

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <Calculator size={18} className="text-[var(--accent-orange)]" />
          <h1 className="text-xl font-bold tracking-tight">מחשבון חובות</h1>
          <PageInfo {...PAGE_TIPS.debts} />
        </div>
        <button
          onClick={() => setNewDebt({ name: '', balance: '', interestRate: '', minimumPayment: '', debtType: 'fixed', earlyPayoffPenalty: false })}
          className="btn-hover flex items-center gap-1.5 bg-[var(--c-orange-0-20)] border border-[var(--c-orange-0-32)] rounded-lg px-3.5 py-[7px] text-[var(--accent-orange)] text-[13px] font-medium cursor-pointer"
        >
          <Plus size={13} /> הוסף חוב
        </button>
      </div>
      <p className="text-[var(--text-secondary)] text-[13px] mb-5">
        השווה בין שיטות פירעון — Snowball מול Avalanche
      </p>

      {/* Debt list */}
      {!debts?.length ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-10 text-center mb-5">
          <Inbox size={36} className="text-[var(--c-0-30)] mx-auto mb-2.5" />
          <div className="text-[var(--text-secondary)] text-sm">אין חובות — לחץ &quot;הוסף חוב&quot; להתחיל</div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid-kpi mb-5">
            <div className="kpi-card">
              <div className="kpi-label">סה&quot;כ חוב</div>
              <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>{formatCurrency(totalBalance)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">מינימום חודשי</div>
              <div className="kpi-value" style={{ color: 'var(--accent-orange)' }}>{formatCurrency(totalMinimum)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">ריבית כוללת (מינימום)</div>
              <div className="kpi-value" style={{ color: 'var(--accent-orange)' }}>{formatCurrency(minimumResult.totalInterest)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">זמן פירעון (מינימום)</div>
              <div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>{formatMonths(minimumResult.months)}</div>
            </div>
          </div>

          {/* Debt cards */}
          <div className="flex flex-col gap-2 mb-5">
            {(debts ?? []).map((debt, i) => (
              <div key={debt.id} className="card-hover card-transition bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-[18px] py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <div>
                      <div className="font-semibold text-sm">{debt.name}</div>
                      <div className="text-xs text-[var(--text-secondary)] flex gap-3 mt-0.5">
                        <span className="flex items-center gap-0.5">{DEBT_TYPE_LABELS[debt.debt_type as DebtType] ?? debt.debt_type}
                          {debt.debt_type === 'prime' && <InfoTooltip body="ריבית בסיס של בנק ישראל + 1.5%. משתנה כל כמה חודשים" />}
                          {debt.debt_type === 'cpi_linked' && <InfoTooltip body="הקרן עולה עם האינפלציה. ריבית נמוכה יותר אבל הקרן גדלה" />}
                        </span>
                        <span>{Number(debt.interest_rate)}% ריבית</span>
                        {debt.early_payoff_penalty && <span className="text-[var(--accent-orange)]">קנס פירעון מוקדם</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-base font-bold text-[var(--c-0-88)]">{formatCurrency(Number(debt.balance))}</div>
                      <div className="text-xs text-[var(--text-secondary)]">מינימום: {formatCurrency(Number(debt.minimum_payment))}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteDebt(debt.id, debt.name)}
                      aria-label="מחק חוב"
                      className="flex items-center justify-center bg-[var(--c-red-0-18)] border border-[var(--c-red-0-28)] rounded-[7px] p-2 min-w-9 min-h-9 text-[var(--c-red-0-62)] text-xs cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Extra payment input */}
          <div className="card mb-5">
            <label className="text-sm font-semibold block mb-2">כמה אתה יכול להוסיף מעבר למינימום?</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={extraMonthly}
                onChange={e => setExtraMonthly(e.target.value.replace(/[^\d]/g, ''))}
                className="w-32 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left"
              />
              <span className="text-[var(--text-secondary)] text-sm">₪ לחודש</span>
            </div>
          </div>

          {/* Comparison table */}
          <div className="card mb-5">
            <h2 className="font-semibold text-sm mb-4">השוואת שיטות</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--bg-hover)]">
                    <th className="py-2 px-3 text-right text-[var(--text-secondary)] font-medium text-[11px]">שיטה</th>
                    <th className="py-2 px-3 text-right text-[var(--text-secondary)] font-medium text-[11px]">זמן פירעון</th>
                    <th className="py-2 px-3 text-right text-[var(--text-secondary)] font-medium text-[11px]">ריבית כוללת</th>
                    <th className="py-2 px-3 text-right text-[var(--text-secondary)] font-medium text-[11px]">חיסכון</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--c-0-20)] opacity-60">
                    <td className="py-2.5 px-3 font-medium">מינימום בלבד</td>
                    <td className="py-2.5 px-3">{formatMonths(minimumResult.months)}</td>
                    <td className="py-2.5 px-3 text-[var(--accent-orange)]">{formatCurrency(minimumResult.totalInterest)}</td>
                    <td className="py-2.5 px-3">—</td>
                  </tr>
                  <tr className={`border-b border-[var(--c-0-20)] ${method === 'snowball' ? 'bg-[var(--c-blue-0-18)]' : ''}`}>
                    <td className="py-2.5 px-3">
                      <button onClick={() => setMethod('snowball')} className={`bg-transparent border-none cursor-pointer text-inherit font-medium ${method === 'snowball' ? 'text-[var(--accent-green)]' : ''}`}>
                        Snowball (מהקטן לגדול) <InfoTooltip body="שיטה שבה סוגרים קודם את החוב הקטן ביותר — נותן מוטיבציה" />
                      </button>
                    </td>
                    <td className="py-2.5 px-3">{formatMonths(snowballResult.months)}</td>
                    <td className="py-2.5 px-3 text-[var(--accent-orange)]">{formatCurrency(snowballResult.totalInterest)}</td>
                    <td className="py-2.5 px-3 text-[var(--accent-green)] font-semibold">{formatCurrency(minimumResult.totalInterest - snowballResult.totalInterest)}</td>
                  </tr>
                  <tr className={`${method === 'avalanche' ? 'bg-[var(--c-blue-0-18)]' : ''}`}>
                    <td className="py-2.5 px-3">
                      <button onClick={() => setMethod('avalanche')} className={`bg-transparent border-none cursor-pointer text-inherit font-medium ${method === 'avalanche' ? 'text-[var(--accent-green)]' : ''}`}>
                        Avalanche (מהיקר לזול) <InfoTooltip body="שיטה שבה סוגרים קודם את החוב עם הריבית הגבוהה — חוסך הכי הרבה כסף" />
                      </button>
                    </td>
                    <td className="py-2.5 px-3">{formatMonths(avalancheResult.months)}</td>
                    <td className="py-2.5 px-3 text-[var(--accent-orange)]">{formatCurrency(avalancheResult.totalInterest)}</td>
                    <td className="py-2.5 px-3 text-[var(--accent-green)] font-semibold">{formatCurrency(minimumResult.totalInterest - avalancheResult.totalInterest)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Method selector */}
          <div className="flex gap-2 mb-5">
            {(['snowball', 'avalanche'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`flex-1 rounded-lg py-2.5 text-[13px] cursor-pointer font-medium ${
                  method === m
                    ? 'bg-[var(--c-blue-0-24)] border border-[var(--c-blue-0-40)] text-[var(--c-blue-0-75)]'
                    : 'bg-[var(--c-0-20)] border border-[var(--border-light)] text-[var(--text-secondary)]'
                }`}
              >
                {m === 'snowball' ? 'Snowball (מהקטן)' : 'Avalanche (מהיקר)'}
              </button>
            ))}
          </div>

          {/* Stacked area chart */}
          {chartData.length > 1 && (
            <div className="card mb-5">
              <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <TrendingDown size={14} className="text-[var(--accent-green)]" />
                ירידת יתרות לאורך זמן ({method === 'snowball' ? 'Snowball' : 'Avalanche'})
              </h2>
              <div className="relative h-48 flex items-end gap-px">
                {chartData.map((row, colIdx) => {
                  return (
                    <div key={colIdx} className="flex-1 flex flex-col-reverse" style={{ height: '100%' }}>
                      {row.map((val, debtIdx) => {
                        const h = chartMax > 0 ? (val / chartMax) * 100 : 0
                        return (
                          <div
                            key={debtIdx}
                            style={{
                              height: `${h}%`,
                              background: COLORS[debtIdx % COLORS.length],
                              opacity: 0.8,
                            }}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3">
                {debtList.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-[var(--c-0-70)]">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment schedule */}
          {activeResult.payoffOrder.length > 0 && (
            <div className="card mb-5">
              <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <ArrowDown size={14} className="text-[var(--accent-blue)]" />
                סדר פירעון ({method === 'snowball' ? 'Snowball' : 'Avalanche'})
              </h2>
              <div className="flex flex-col gap-2">
                {activeResult.payoffOrder.map((name, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--c-0-20)] last:border-b-0">
                    <div className="w-6 h-6 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[11px] font-bold text-[var(--accent-green)]">
                      {i + 1}
                    </div>
                    <span className="text-[13px] font-medium">{name}</span>
                    <span className="text-[11px] text-[var(--text-secondary)]">נפרע — התשלום שלו מתגלגל לבא</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly payment schedule table */}
          {activeResult.balanceHistory.length > 1 && (
            <div className="card">
              <h2 className="font-semibold text-sm mb-4">לוח תשלומים חודשי</h2>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead className="sticky top-0 bg-[var(--bg-card)]">
                    <tr className="border-b border-[var(--bg-hover)]">
                      <th className="py-2 px-2 text-right text-[var(--text-secondary)] font-medium text-[11px]">חודש</th>
                      {debtList.map((d, i) => (
                        <th key={i} className="py-2 px-2 text-right font-medium text-[11px]" style={{ color: COLORS[i % COLORS.length] }}>{d.name}</th>
                      ))}
                      <th className="py-2 px-2 text-right text-[var(--text-secondary)] font-medium text-[11px]">סה&quot;כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeResult.balanceHistory.filter((_, i) => i > 0 && (i % Math.max(1, Math.floor(activeResult.balanceHistory.length / 24)) === 0 || i === activeResult.balanceHistory.length - 1)).map((row, rowIdx) => {
                      const monthNum = activeResult.balanceHistory.indexOf(row)
                      const total = row.reduce((s, v) => s + v, 0)
                      return (
                        <tr key={rowIdx} className="border-b border-[var(--c-0-18)]">
                          <td className="py-1.5 px-2 text-[var(--text-secondary)]">{monthNum}</td>
                          {row.map((val, i) => (
                            <td key={i} className="py-1.5 px-2" style={{ color: val > 0 ? COLORS[i % COLORS.length] : 'var(--c-0-40)' }}>
                              {val > 0 ? formatCurrency(Math.round(val)) : '0 ₪'}
                            </td>
                          ))}
                          <td className="py-1.5 px-2 font-semibold text-[var(--text-heading)]">{formatCurrency(Math.round(total))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Debt Modal */}
      {newDebt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-[14px] p-7 w-[400px]">
            <div className="flex justify-between items-center mb-5">
              <span className="font-semibold text-[15px]">הוסף חוב</span>
              <button onClick={() => setNewDebt(null)} aria-label="סגור" className="bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-2 min-w-9 min-h-9 flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">שם</label>
                <input type="text" autoFocus value={newDebt.name}
                  onChange={e => setNewDebt(p => p && { ...p, name: e.target.value })}
                  placeholder="למשל: הלוואת רכב, אשראי..."
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm" />
              </div>
              <div>
                <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">יתרה (₪)</label>
                <input type="text" inputMode="numeric" value={newDebt.balance}
                  onChange={e => setNewDebt(p => p && { ...p, balance: e.target.value.replace(/[^\d]/g, '') })}
                  placeholder="0"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
              </div>
              <div>
                <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">ריבית שנתית (%)</label>
                <input type="text" inputMode="decimal" value={newDebt.interestRate}
                  onChange={e => setNewDebt(p => p && { ...p, interestRate: e.target.value.replace(/[^\d.]/g, '') })}
                  placeholder="0"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
              </div>
              <div>
                <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">תשלום מינימלי חודשי (₪)</label>
                <input type="text" inputMode="numeric" value={newDebt.minimumPayment}
                  onChange={e => setNewDebt(p => p && { ...p, minimumPayment: e.target.value.replace(/[^\d]/g, '') })}
                  placeholder="0"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
              </div>
              <div>
                <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">סוג הלוואה</label>
                <div className="flex gap-2">
                  {(['fixed', 'prime', 'cpi_linked'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setNewDebt(p => p && { ...p, debtType: t })}
                      className={`flex-1 rounded-lg py-[9px] text-[12px] cursor-pointer ${
                        newDebt.debtType === t
                          ? 'bg-[var(--c-blue-0-24)] border border-[var(--c-blue-0-40)] text-[var(--c-blue-0-75)] font-semibold'
                          : 'bg-[var(--c-0-20)] border border-[var(--border-light)] text-[var(--text-secondary)] font-normal'
                      }`}>
                      {DEBT_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newDebt.earlyPayoffPenalty}
                  onChange={e => setNewDebt(p => p && { ...p, earlyPayoffPenalty: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent-orange)]" />
                <span className="text-[13px] text-[var(--c-0-70)]">קנס פירעון מוקדם</span>
              </label>
            </div>
            <button
              onClick={handleAddDebt}
              disabled={addDebt.isPending || !newDebt.name.trim() || Number(newDebt.balance) <= 0}
              className={`w-full bg-[var(--accent-orange)] border-none rounded-lg py-[11px] font-semibold text-sm text-[var(--c-0-10)] ${
                addDebt.isPending || !newDebt.name.trim() || Number(newDebt.balance) <= 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'
              }`}
            >
              {addDebt.isPending ? '...' : 'הוסף חוב'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
