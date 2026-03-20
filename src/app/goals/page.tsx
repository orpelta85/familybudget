'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import {
  useSavingsGoals, useAllGoalDeposits,
  useCreateGoal, useUpdateGoal, useDeleteGoal,
  useAddGoalDeposit, useDeleteGoalDeposit,
} from '@/lib/queries/useGoals'
import { formatCurrency } from '@/lib/utils'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { toast } from 'sonner'
import { Target, Plus, ChevronDown, ChevronUp, Trash2, Edit3, TrendingUp, X } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'
import type { SavingsGoal, GoalDeposit, Period } from '@/lib/types'

const ICON_OPTIONS = ['🎯', '🏠', '🚗', '✈️', '💍', '🎓', '💻', '📱', '🏖️', '💰', '🎁', '🏥']
const COLOR_OPTIONS = [
  'oklch(0.65 0.18 250)',
  'oklch(0.70 0.18 145)',
  'oklch(0.72 0.18 55)',
  'oklch(0.70 0.15 185)',
  'oklch(0.68 0.18 295)',
  'oklch(0.62 0.22 27)',
  'oklch(0.68 0.12 310)',
  'oklch(0.75 0.18 80)',
]

export default function GoalsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const { data: goals } = useSavingsGoals(user?.id, familyId)
  const goalIds = useMemo(() => (goals ?? []).map(g => g.id), [goals])
  const { data: allDeposits } = useAllGoalDeposits(goalIds)
  const confirm = useConfirmDialog()
  const deleteGoalMutation = useDeleteGoal()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null)
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null)
  const { viewMode: globalView } = useFamilyView()
  const goalsFilter = globalView === 'personal' ? 'personal' : 'all'

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return <TableSkeleton rows={5} />

  const filteredGoals = (goals ?? []).filter(g => {
    if (goalsFilter === 'personal') return !g.is_shared
    return true
  })

  function getGoalDeposits(goalId: number) {
    return (allDeposits ?? []).filter(d => d.goal_id === goalId)
  }

  function getGoalTotalSaved(goalId: number) {
    return getGoalDeposits(goalId).reduce((s, d) => s + d.amount_deposited, 0)
  }

  const totalAllGoals = (goals ?? []).reduce((s, g) => s + g.target_amount, 0)
  const totalAllSaved = (goals ?? []).reduce((s, g) => s + getGoalTotalSaved(g.id), 0)
  const overallPct = totalAllGoals > 0 ? (totalAllSaved / totalAllGoals) * 100 : 0

  async function handleDeleteGoal(goal: SavingsGoal) {
    if (!(await confirm({ message: `למחוק את היעד "${goal.name}"?` }))) return
    deleteGoalMutation.mutate(goal.id, {
      onSuccess: () => toast.success('היעד נמחק'),
      onError: () => toast.error('שגיאה במחיקה'),
    })
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-accent-blue" />
          <h1 className="text-xl font-bold tracking-tight">יעדי חיסכון</h1>
          <PageInfo {...PAGE_TIPS.goals} />
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> הוסף יעד
        </button>
      </div>
      <p className="text-text-secondary text-[13px] mb-5">ניהול יעדי חיסכון אישיים ומשפחתיים</p>

      {/* Summary KPIs */}
      <div className="grid-kpi">
        <div className="kpi-card">
          <div className="flex justify-between items-center mb-2">
            <span className="kpi-label">יעדים פעילים</span>
            <Target size={14} className="opacity-70 text-accent-blue" />
          </div>
          <div className="kpi-value text-accent-blue">{goals?.length ?? 0}</div>
        </div>
        <div className="kpi-card">
          <div className="flex justify-between items-center mb-2">
            <span className="kpi-label">סה"כ יעדים</span>
            <TrendingUp size={14} className="opacity-70 text-accent-orange" />
          </div>
          <div className="kpi-value text-accent-orange">{formatCurrency(totalAllGoals)}</div>
        </div>
        <div className="kpi-card">
          <div className="flex justify-between items-center mb-2">
            <span className="kpi-label">נחסך עד כה</span>
            <TrendingUp size={14} className="opacity-70 text-accent-green" />
          </div>
          <div className="kpi-value text-accent-green">{formatCurrency(totalAllSaved)}</div>
        </div>
        <div className="kpi-card">
          <div className="flex justify-between items-center mb-2">
            <span className="kpi-label">התקדמות כוללת</span>
          </div>
          <div className="kpi-value text-accent-teal">{overallPct.toFixed(1)}%</div>
          <div className="bar-track mt-2">
            <div className="bar-fill bg-accent-teal" style={{ width: `${Math.min(overallPct, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Goals list */}
      {filteredGoals.length === 0 ? (
        <div className="card text-center py-12">
          <Target size={40} className="mx-auto mb-3 text-text-secondary opacity-30" />
          <div className="text-text-secondary text-[13px]">אין יעדי חיסכון עדיין</div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary mt-4 mx-auto flex items-center gap-1.5">
            <Plus size={14} /> הוסף יעד ראשון
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filteredGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              deposits={getGoalDeposits(goal.id)}
              totalSaved={getGoalTotalSaved(goal.id)}
              expanded={expandedGoal === goal.id}
              onToggle={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
              onEdit={() => setEditGoal(goal)}
              onDelete={() => handleDeleteGoal(goal)}
              periods={periods}
              selectedPeriodId={selectedPeriodId}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editGoal) && (
        <GoalModal
          goal={editGoal}
          userId={user.id}
          familyId={familyId}
          onClose={() => { setShowAddModal(false); setEditGoal(null) }}
        />
      )}
    </div>
  )
}

// ── Goal Card ────────────────────────────────────────────────────────────────
function GoalCard({
  goal,
  deposits,
  totalSaved,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  periods,
  selectedPeriodId,
}: {
  goal: SavingsGoal
  deposits: GoalDeposit[]
  totalSaved: number
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  periods: Period[] | undefined
  selectedPeriodId: number | undefined
}) {
  const pct = Math.min((totalSaved / goal.target_amount) * 100, 100)
  const remaining = goal.target_amount - totalSaved
  const monthsRemaining = goal.monthly_deposit > 0
    ? Math.ceil(remaining / goal.monthly_deposit)
    : null

  return (
    <div className="card card-hover">
      {/* Header */}
      <button onClick={onToggle}
        className="w-full bg-transparent border-none cursor-pointer text-inherit flex items-center gap-3 p-0">
        <span className="text-2xl">{goal.icon}</span>
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{goal.name}</span>
            {goal.is_shared && (
              <span className="text-[10px] bg-[oklch(0.22_0.02_250)] rounded px-1.5 py-0.5 text-text-secondary">משותף</span>
            )}
          </div>
          <div className="flex gap-4 text-xs text-text-secondary">
            <span>{formatCurrency(totalSaved)} / {formatCurrency(goal.target_amount)}</span>
            <span>{pct.toFixed(1)}%</span>
            {monthsRemaining !== null && monthsRemaining > 0 && (
              <span>עוד {monthsRemaining} חודשים</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24">
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: goal.color }} />
            </div>
          </div>
          {expanded ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <GoalExpandedView
          goal={goal}
          deposits={deposits}
          totalSaved={totalSaved}
          pct={pct}
          remaining={remaining}
          monthsRemaining={monthsRemaining}
          onEdit={onEdit}
          onDelete={onDelete}
          periods={periods}
          selectedPeriodId={selectedPeriodId}
        />
      )}
    </div>
  )
}

// ── Goal Expanded View ───────────────────────────────────────────────────────
function GoalExpandedView({
  goal,
  deposits,
  totalSaved,
  pct,
  remaining,
  monthsRemaining,
  onEdit,
  onDelete,
  periods,
  selectedPeriodId,
}: {
  goal: SavingsGoal
  deposits: GoalDeposit[]
  totalSaved: number
  pct: number
  remaining: number
  monthsRemaining: number | null
  onEdit: () => void
  onDelete: () => void
  periods: Period[] | undefined
  selectedPeriodId: number | undefined
}) {
  const [amount, setAmount] = useState(goal.monthly_deposit.toString())
  const [periodId, setPeriodId] = useState(selectedPeriodId ?? 0)
  const [notes, setNotes] = useState('')
  const addDeposit = useAddGoalDeposit()
  const deleteDeposit = useDeleteGoalDeposit()
  const confirm = useConfirmDialog()

  useEffect(() => {
    if (selectedPeriodId) setPeriodId(selectedPeriodId)
  }, [selectedPeriodId])

  async function handleDeposit() {
    if (!periodId || !amount) return
    try {
      await addDeposit.mutateAsync({
        goal_id: goal.id,
        period_id: periodId,
        amount_deposited: Number(amount),
        deposit_date: new Date().toISOString().split('T')[0],
        notes: notes || undefined,
      } as GoalDeposit)
      toast.success('הפקדה נשמרה!')
      setNotes('')
    } catch { toast.error('שגיאה בשמירה') }
  }

  async function handleDeleteDeposit(id: number) {
    if (!(await confirm({ message: 'למחוק הפקדה זו?' }))) return
    deleteDeposit.mutate(id, {
      onSuccess: () => toast.success('הפקדה נמחקה'),
      onError: () => toast.error('שגיאה במחיקה'),
    })
  }

  const periodMap = new Map(periods?.map(p => [p.id, p.label]))

  return (
    <div className="mt-5 pt-5 border-t border-t-[oklch(0.22_0.01_250)]">
      {/* Progress hero */}
      <div className="bg-[oklch(0.13_0.01_250)] rounded-xl p-4 mb-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[13px] text-text-secondary mb-1">נחסך עד כה</div>
            <div className="text-[32px] font-extrabold" style={{ color: goal.color }}>
              {formatCurrency(totalSaved)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] text-text-secondary mb-1">יעד סופי</div>
            <div className="text-lg font-bold text-text-heading">{formatCurrency(goal.target_amount)}</div>
          </div>
        </div>
        <div className="bar-track-lg mb-2">
          <div className="bar-fill rounded-[4px]" style={{ width: `${pct}%`, background: goal.color }} />
        </div>
        <div className="flex justify-between text-xs text-text-secondary">
          <span style={{ color: goal.color }} className="font-semibold">{pct.toFixed(1)}% מהיעד</span>
          <span>נותר: {formatCurrency(remaining)}</span>
        </div>

        {/* Stats */}
        <div className="grid-3 mt-4 mb-0">
          {[
            { label: 'הפקדות', value: deposits.length },
            { label: 'הפקדה חודשית', value: formatCurrency(goal.monthly_deposit) },
            { label: monthsRemaining !== null && monthsRemaining > 0 ? 'חודשים נותרים' : 'הושלם', value: monthsRemaining !== null && monthsRemaining > 0 ? monthsRemaining : '✓' },
          ].map(s => (
            <div key={s.label} className="bg-[oklch(0.16_0.01_250)] rounded-lg px-3 py-2.5 text-center">
              <div className="text-lg font-bold text-text-heading">{s.value}</div>
              <div className="text-[11px] text-text-secondary mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-sidebar">
        {/* Deposit form */}
        <div>
          <div className="font-semibold mb-3.5 text-sm">הפקדה חדשה</div>
          <div className="mb-3">
            <label className="text-xs block mb-[5px] text-text-secondary">מחזור</label>
            <select value={periodId} onChange={e => setPeriodId(Number(e.target.value))}
              aria-label="מחזור" className="input-field w-full">
              {periods?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className="text-xs block mb-[5px] text-text-secondary">סכום (₪)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="input-field w-full ltr text-right" />
          </div>
          <div className="mb-4">
            <label className="text-xs block mb-[5px] text-text-secondary">הערות</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="input-field w-full" placeholder="אופציונלי" />
          </div>
          <button onClick={handleDeposit} disabled={addDeposit.isPending}
            className="w-full border-none rounded-lg py-[11px] font-semibold text-sm cursor-pointer text-[oklch(0.10_0.02_250)]"
            style={{ background: goal.color }}>
            {addDeposit.isPending ? '...' : 'שמור הפקדה'}
          </button>
        </div>

        {/* Deposit history */}
        <div>
          <div className="font-semibold mb-3.5 text-sm">היסטוריית הפקדות</div>
          {deposits.length === 0 ? (
            <div className="text-text-secondary text-[13px]">אין הפקדות עדיין</div>
          ) : (
            <div className="flex flex-col gap-1">
              {deposits.map(d => (
                <div key={d.id} className="flex justify-between items-center py-2 px-2 rounded-lg hover:bg-[oklch(0.18_0.01_250)] transition-colors text-[13px]">
                  <div>
                    <span className="text-text-heading">{periodMap.get(d.period_id) ?? `#${d.period_id}`}</span>
                    {d.notes && <span className="text-text-secondary mr-2 text-[11px]">— {d.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: goal.color }}>{formatCurrency(d.amount_deposited)}</span>
                    <button onClick={() => handleDeleteDeposit(d.id)} aria-label="מחק"
                      className="bg-transparent border-none cursor-pointer text-text-secondary hover:text-accent-red p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Projection */}
      {monthsRemaining !== null && monthsRemaining > 0 && goal.monthly_deposit > 0 && (
        <div className="bg-[oklch(0.15_0.02_250)] border border-[oklch(0.25_0.02_250)] rounded-xl p-4 mt-5 text-[13px]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} style={{ color: goal.color }} />
            <span className="font-semibold">תחזית</span>
          </div>
          <p className="text-text-body">
            בקצב הנוכחי של {formatCurrency(goal.monthly_deposit)} לחודש, תגיע ליעד בעוד{' '}
            <strong className="text-text-primary">{monthsRemaining} חודשים</strong>.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-5">
        <button onClick={onEdit} className="btn-secondary flex items-center gap-1.5 text-[13px]">
          <Edit3 size={13} /> ערוך יעד
        </button>
        <button onClick={onDelete} className="btn-danger flex items-center gap-1.5 text-[13px]">
          <Trash2 size={13} /> מחק יעד
        </button>
      </div>
    </div>
  )
}

// ── Goal Modal ───────────────────────────────────────────────────────────────
function GoalModal({
  goal,
  userId,
  familyId,
  onClose,
}: {
  goal: SavingsGoal | null
  userId: string
  familyId: string | undefined
  onClose: () => void
}) {
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()

  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal?.target_amount?.toString() ?? '')
  const [monthly, setMonthly] = useState(goal?.monthly_deposit?.toString() ?? '')
  const [totalPeriods, setTotalPeriods] = useState(goal?.total_periods?.toString() ?? '36')
  const [isShared, setIsShared] = useState(goal?.is_shared ?? false)
  const [icon, setIcon] = useState(goal?.icon ?? '🎯')
  const [color, setColor] = useState(goal?.color ?? COLOR_OPTIONS[0])

  async function handleSubmit() {
    if (!name || !target) return
    try {
      if (goal) {
        await updateGoal.mutateAsync({
          id: goal.id,
          name,
          target_amount: Number(target),
          monthly_deposit: Number(monthly) || 0,
          total_periods: Number(totalPeriods) || 36,
          is_shared: isShared,
          icon,
          color,
        })
        toast.success('יעד עודכן!')
      } else {
        await createGoal.mutateAsync({
          user_id: userId,
          family_id: isShared ? familyId : undefined,
          name,
          target_amount: Number(target),
          monthly_deposit: Number(monthly) || 0,
          total_periods: Number(totalPeriods) || 36,
          is_shared: isShared,
          icon,
          color,
        })
        toast.success('יעד נוצר!')
      }
      onClose()
    } catch { toast.error('שגיאה בשמירה') }
  }

  const isPending = createGoal.isPending || updateGoal.isPending

  return (
    <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4">
      <div className="bg-[oklch(0.14_0.01_250)] rounded-2xl p-6 w-full max-w-[420px] border border-[oklch(0.25_0.01_250)] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold">{goal ? 'ערוך יעד' : 'הוסף יעד חדש'}</h3>
          <button onClick={onClose} aria-label="סגור"
            className="bg-transparent border-none cursor-pointer text-text-secondary p-2">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">שם היעד</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="input-field w-full" placeholder="למשל: דירה, רכב, חופשה" />
          </div>

          <div className="grid-2 !mb-0">
            <div>
              <label className="text-xs block mb-[5px] text-text-secondary">סכום יעד (₪)</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)}
                className="input-field w-full ltr text-right" />
            </div>
            <div>
              <label className="text-xs block mb-[5px] text-text-secondary">הפקדה חודשית (₪)</label>
              <input type="number" value={monthly} onChange={e => setMonthly(e.target.value)}
                className="input-field w-full ltr text-right" />
            </div>
          </div>

          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">מספר תקופות</label>
            <input type="number" value={totalPeriods} onChange={e => setTotalPeriods(e.target.value)}
              className="input-field w-full ltr text-right" />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)}
              className="w-4 h-4 rounded accent-accent-blue" />
            <span className="text-[13px] text-text-body">יעד משותף (משפחתי)</span>
          </label>

          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">אייקון</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(i => (
                <button key={i} onClick={() => setIcon(i)}
                  className={`w-9 h-9 rounded-lg border cursor-pointer text-lg flex items-center justify-center transition-colors ${
                    icon === i ? 'border-accent-blue bg-[oklch(0.22_0.02_250)]' : 'border-[oklch(0.25_0.01_250)] bg-transparent'
                  }`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">צבע</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
                    color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={isPending || !name || !target}
            className="btn-primary w-full py-3 mt-2 disabled:opacity-50">
            {isPending ? '...' : goal ? 'עדכן יעד' : 'צור יעד'}
          </button>
        </div>
      </div>
    </div>
  )
}
