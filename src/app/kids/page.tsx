'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import {
  useKids, useCreateKid, useUpdateKid, useDeleteKid,
  useAllKidExpenses, useCreateKidExpense, useDeleteKidExpense,
  useAllKidActivities, useCreateKidActivity, useUpdateKidActivity, useDeleteKidActivity,
} from '@/lib/queries/useKids'
import { formatCurrency } from '@/lib/utils'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Users, Plus, ChevronDown, ChevronUp, Trash2, X, Baby, Heart, TrendingUp, Coins, PiggyBank } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'
import type { Kid, KidActivity } from '@/lib/types'

const KID_EXPENSE_CATEGORIES = [
  'חינוך', 'בריאות', 'ביגוד', 'חוגים', 'ציוד', 'בילויים', 'אחר'
]

function calcChildBenefit(totalKids: number): number {
  if (totalKids === 0) return 0
  let total = 173 // Kid 1
  for (let i = 2; i <= totalKids; i++) {
    if (i <= 4) total += 219
    else total += 173
  }
  return total
}

function calcAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const BITUACH_LEUMI_SAVINGS = 58

export default function KidsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const { data: kids } = useKids(user?.id, familyId)
  const kidIds = useMemo(() => (kids ?? []).map(k => k.id), [kids])
  const { data: allExpenses } = useAllKidExpenses(kidIds)
  const { data: allActivities } = useAllKidActivities(kidIds)
  const confirm = useConfirmDialog()

  const { selectedMemberId } = useFamilyView()
  const deleteKidMutation = useDeleteKid()
  const [showAddKid, setShowAddKid] = useState(false)
  const [expandedKid, setExpandedKid] = useState<number | null>(null)

  // Auto-expand kid when selected from FamilyViewSelector
  useEffect(() => {
    if (selectedMemberId && selectedMemberId.startsWith('kid-') && kids) {
      const kidId = Number(selectedMemberId.replace('kid-', ''))
      const matchedKid = kids.find(k => k.id === kidId)
      if (matchedKid) {
        setExpandedKid(matchedKid.id)
      }
    }
  }, [selectedMemberId, kids])

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return <TableSkeleton rows={5} />

  const totalKids = kids?.length ?? 0
  const childBenefit = calcChildBenefit(totalKids)
  const totalActivitiesCost = (allActivities ?? []).reduce((s, a) => s + a.monthly_cost, 0)
  const totalPersonalSavings = (kids ?? []).reduce((s, k) => s + (Number(k.monthly_savings) || 0), 0)
  const totalBituachLeumi = totalKids * BITUACH_LEUMI_SAVINGS
  const totalSavingsPerMonth = totalPersonalSavings + totalBituachLeumi

  function getKidActivities(kidId: number) {
    return (allActivities ?? []).filter(a => a.kid_id === kidId)
  }

  function getKidExpenses(kidId: number) {
    return (allExpenses ?? []).filter(e => e.kid_id === kidId)
  }

  function getKidCurrentExpenses(kidId: number) {
    if (!selectedPeriodId) return []
    return getKidExpenses(kidId).filter(e => e.period_id === selectedPeriodId)
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-accent-purple" />
          <h1 className="text-xl font-bold tracking-tight">ילדים</h1>
          <PageInfo {...PAGE_TIPS.kids} />
        </div>
        <button onClick={() => setShowAddKid(true)} className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> הוסף ילד/ה
        </button>
      </div>
      <p className="text-text-secondary text-[13px] mb-5">ניהול הוצאות, חוגים וחיסכון לילדים</p>

      {/* KPI cards */}
      <div className="grid-kpi">
        <div className="kpi-card">
          <div className="flex justify-between items-center mb-2">
            <span className="kpi-label">ילדים</span>
            <Baby size={14} className="opacity-70 text-accent-purple" />
          </div>
          <div className="kpi-value text-accent-purple">{totalKids}</div>
        </div>
        <div className="kpi-card">
          <div className="flex justify-between items-center mb-2">
            <span className="kpi-label">עלות חודשית (חוגים)</span>
            <Coins size={14} className="opacity-70 text-accent-orange" />
          </div>
          <div className="kpi-value text-accent-orange">{formatCurrency(totalActivitiesCost)}</div>
        </div>
        <div className="kpi-card">
          <div className="flex justify-between items-center mb-2">
            <span className="kpi-label">קצבת ילדים</span>
            <Heart size={14} className="opacity-70 text-accent-green" />
          </div>
          <div className="kpi-value text-accent-green">{formatCurrency(childBenefit)}</div>
          <div className="kpi-sub text-text-secondary">חודשי</div>
        </div>
        <div className="kpi-card">
          <div className="flex justify-between items-center mb-2">
            <span className="kpi-label">סה"כ חיסכון חודשי</span>
            <TrendingUp size={14} className="opacity-70 text-accent-teal" />
          </div>
          <div className="kpi-value text-accent-teal">{formatCurrency(totalSavingsPerMonth)}</div>
          <div className="kpi-sub text-text-secondary">
            {formatCurrency(totalPersonalSavings)} אישי + {formatCurrency(totalBituachLeumi)} ביטוח לאומי
          </div>
        </div>
      </div>

      {/* Kids list */}
      {totalKids === 0 ? (
        <div className="card text-center py-12">
          <Baby size={40} className="mx-auto mb-3 text-text-secondary opacity-30" />
          <div className="text-text-secondary text-[13px]">עוד לא הוספת ילדים</div>
          <button onClick={() => setShowAddKid(true)} className="btn-primary mt-4 mx-auto">
            <Plus size={14} /> הוסף ילד/ה
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {(kids ?? []).map(kid => (
            <KidCard
              key={kid.id}
              kid={kid}
              activities={getKidActivities(kid.id)}
              currentExpenses={getKidCurrentExpenses(kid.id)}
              allExpenses={getKidExpenses(kid.id)}
              expanded={expandedKid === kid.id}
              onToggle={() => setExpandedKid(expandedKid === kid.id ? null : kid.id)}
              onDelete={async () => {
                if (!(await confirm({ message: `למחוק את ${kid.name}?` }))) return
                deleteKidMutation.mutate(kid.id, {
                  onSuccess: () => toast.success('ילד/ה נמחק/ה'),
                  onError: () => toast.error('שגיאה במחיקה'),
                })
              }}
              periods={periods}
              selectedPeriodId={selectedPeriodId}
              userId={user.id}
            />
          ))}
        </div>
      )}

      {/* Add Kid Modal */}
      {showAddKid && (
        <AddKidModal
          userId={user.id}
          familyId={familyId}
          onClose={() => setShowAddKid(false)}
        />
      )}
    </div>
  )

}

// ── Kid Card ─────────────────────────────────────────────────────────────────
function KidCard({
  kid,
  activities,
  currentExpenses,
  allExpenses,
  expanded,
  onToggle,
  onDelete,
  periods,
  selectedPeriodId,
  userId,
}: {
  kid: Kid
  activities: KidActivity[]
  currentExpenses: import('@/lib/types').KidExpense[]
  allExpenses: import('@/lib/types').KidExpense[]
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  periods: import('@/lib/types').Period[] | undefined
  selectedPeriodId: number | undefined
  userId: string
}) {
  const age = kid.birth_date ? calcAge(kid.birth_date) : null
  const monthlyCost = activities.reduce((s, a) => s + a.monthly_cost, 0)
  const currentMonthExpenses = currentExpenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="card card-hover">
      <button onClick={onToggle}
        className="w-full bg-transparent border-none cursor-pointer text-inherit flex items-center gap-3 p-0">
        <div className="w-10 h-10 rounded-full bg-accent-purple/20 flex items-center justify-center text-accent-purple text-lg font-bold">
          {kid.name.charAt(0)}
        </div>
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{kid.name}</span>
            {age !== null && (
              <span className="text-[11px] text-text-secondary">גיל {age}</span>
            )}
          </div>
          <div className="flex gap-4 text-xs text-text-secondary">
            <span>{activities.length} חוגים</span>
            <span>עלות חודשית: {formatCurrency(monthlyCost)}</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
      </button>

      {expanded && (
        <KidExpandedView
          kid={kid}
          activities={activities}
          currentExpenses={currentExpenses}
          monthlyCost={monthlyCost}
          currentMonthExpenses={currentMonthExpenses}
          age={age}
          onDelete={onDelete}
          periods={periods}
          selectedPeriodId={selectedPeriodId}
          userId={userId}
        />
      )}
    </div>
  )
}

// ── Kid Expanded View ────────────────────────────────────────────────────────
function KidExpandedView({
  kid,
  activities,
  currentExpenses,
  monthlyCost,
  currentMonthExpenses,
  age,
  onDelete,
  periods,
  selectedPeriodId,
  userId,
}: {
  kid: Kid
  activities: KidActivity[]
  currentExpenses: import('@/lib/types').KidExpense[]
  monthlyCost: number
  currentMonthExpenses: number
  age: number | null
  onDelete: () => void
  periods: import('@/lib/types').Period[] | undefined
  selectedPeriodId: number | undefined
  userId: string
}) {
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingSavings, setEditingSavings] = useState(false)
  const [savingsAmount, setSavingsAmount] = useState(String(kid.monthly_savings ?? 0))
  const [savingsYears, setSavingsYears] = useState(String(kid.savings_years ?? 18))
  const confirm = useConfirmDialog()
  const deleteActivity = useDeleteKidActivity()
  const deleteExpense = useDeleteKidExpense()
  const updateKid = useUpdateKid()

  const totalMonthly = monthlyCost + currentMonthExpenses

  const monthlySavings = Number(kid.monthly_savings) || 0
  const targetAge = Number(kid.savings_years) || 18
  const remainingYears = age !== null ? Math.max(targetAge - age, 0) : 0
  const totalMonthlySavingsWithBL = monthlySavings + BITUACH_LEUMI_SAVINGS
  const projectedSavings = totalMonthlySavingsWithBL * 12 * remainingYears

  async function handleSaveSavings() {
    updateKid.mutate({
      id: kid.id,
      monthly_savings: Number(savingsAmount) || 0,
      savings_years: Number(savingsYears) || 18,
    }, {
      onSuccess: () => {
        toast.success('חיסכון עודכן')
        setEditingSavings(false)
      },
      onError: () => toast.error('שגיאה בעדכון'),
    })
  }

  async function handleDeleteActivity(id: number) {
    if (!(await confirm({ message: 'למחוק חוג זה?' }))) return
    deleteActivity.mutate(id, {
      onSuccess: () => toast.success('חוג נמחק'),
      onError: () => toast.error('שגיאה'),
    })
  }

  async function handleDeleteExpense(id: number) {
    if (!(await confirm({ message: 'למחוק הוצאה זו?' }))) return
    deleteExpense.mutate(id, {
      onSuccess: () => toast.success('הוצאה נמחקה'),
      onError: () => toast.error('שגיאה'),
    })
  }

  return (
    <div className="mt-5 pt-5 border-t border-t-[oklch(0.22_0.01_250)]">
      {/* Monthly summary */}
      <div className="bg-[oklch(0.13_0.01_250)] rounded-xl p-4 mb-5">
        <div className="font-semibold text-sm mb-3">סיכום חודשי</div>
        <div className="grid-3 mb-0">
          <div className="bg-[oklch(0.16_0.01_250)] rounded-lg px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-accent-orange">{formatCurrency(monthlyCost)}</div>
            <div className="text-[11px] text-text-secondary mt-0.5">חוגים</div>
          </div>
          <div className="bg-[oklch(0.16_0.01_250)] rounded-lg px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-accent-red">{formatCurrency(currentMonthExpenses)}</div>
            <div className="text-[11px] text-text-secondary mt-0.5">הוצאות</div>
          </div>
          <div className="bg-[oklch(0.16_0.01_250)] rounded-lg px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-accent-purple">{formatCurrency(totalMonthly)}</div>
            <div className="text-[11px] text-text-secondary mt-0.5">סה"כ</div>
          </div>
        </div>
      </div>

      {/* Personal savings */}
      {age !== null && (
        <div className="bg-[oklch(0.13_0.02_280)] border border-[oklch(0.25_0.04_280)] rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PiggyBank size={14} className="text-accent-purple" />
              <span className="font-semibold text-sm">חיסכון אישי</span>
            </div>
            {!editingSavings && (
              <button onClick={() => setEditingSavings(true)}
                className="btn-secondary text-[12px] py-1 px-2.5">
                עריכה
              </button>
            )}
          </div>
          {editingSavings ? (
            <div className="flex flex-col gap-3">
              <div className="grid-2 !mb-0">
                <div>
                  <label className="text-xs block mb-[5px] text-text-secondary">חיסכון חודשי (₪)</label>
                  <input type="number" value={savingsAmount} onChange={e => setSavingsAmount(e.target.value)}
                    className="input-field w-full ltr text-right" />
                </div>
                <div>
                  <label className="text-xs block mb-[5px] text-text-secondary">לכמה שנים (עד גיל)</label>
                  <input type="number" value={savingsYears} onChange={e => setSavingsYears(e.target.value)}
                    className="input-field w-full ltr text-right" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveSavings} disabled={updateKid.isPending}
                  className="btn-primary text-[12px] py-1.5 px-3">
                  {updateKid.isPending ? '...' : 'שמור'}
                </button>
                <button onClick={() => setEditingSavings(false)}
                  className="btn-secondary text-[12px] py-1.5 px-3">
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <div className="grid-2 !mb-0">
              <div className="bg-[oklch(0.16_0.02_280)] rounded-lg px-3 py-2.5 text-center">
                <div className="text-lg font-bold text-accent-purple">{formatCurrency(monthlySavings)}</div>
                <div className="text-[11px] text-text-secondary mt-0.5">חיסכון חודשי</div>
              </div>
              <div className="bg-[oklch(0.16_0.02_280)] rounded-lg px-3 py-2.5 text-center">
                <div className="text-lg font-bold text-accent-purple">{formatCurrency(projectedSavings)}</div>
                <div className="text-[11px] text-text-secondary mt-0.5">תחזית לגיל {targetAge}</div>
              </div>
            </div>
          )}
          {!editingSavings && (
            <div className="text-[11px] text-text-secondary mt-2">
              ({formatCurrency(monthlySavings)} חיסכון + {BITUACH_LEUMI_SAVINGS} ₪ ביטוח לאומי) × 12 × {remainingYears} שנים
            </div>
          )}
        </div>
      )}

      {/* Bituach Leumi savings */}
      {age !== null && (
        <div className="bg-[oklch(0.15_0.02_185)] border border-[oklch(0.25_0.05_185)] rounded-xl p-4 mb-5 text-[13px]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-accent-teal" />
            <span className="font-semibold">חיסכון ביטוח לאומי</span>
          </div>
          <p className="text-text-body">
            {BITUACH_LEUMI_SAVINGS} ₪ לחודש × 12 × {remainingYears} שנים ={' '}
            <strong className="text-accent-teal">{formatCurrency(BITUACH_LEUMI_SAVINGS * 12 * remainingYears)}</strong>
          </p>
        </div>
      )}

      <div className="grid-2">
        {/* Activities */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="font-semibold text-sm">חוגים ופעילויות</span>
            <button onClick={() => setShowAddActivity(true)} className="btn-secondary text-[12px] py-1 px-2.5 flex items-center gap-1">
              <Plus size={12} /> הוסף
            </button>
          </div>
          {activities.length === 0 ? (
            <div className="text-text-secondary text-[13px]">אין חוגים</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {activities.map(a => (
                <div key={a.id} className="flex justify-between items-center py-2 px-2 rounded-lg hover:bg-[oklch(0.18_0.01_250)] transition-colors text-[13px]">
                  <div>
                    <span className="text-text-heading">{a.name}</span>
                    <div className="flex gap-3 text-[11px] text-text-secondary mt-0.5">
                      <span>{formatCurrency(a.monthly_cost)}/חודש</span>
                      {a.equipment_cost > 0 && <span>ציוד: {formatCurrency(a.equipment_cost)}</span>}
                      {a.transport_cost > 0 && <span>הסעות: {formatCurrency(a.transport_cost)}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteActivity(a.id)} aria-label="מחק"
                    className="bg-transparent border-none cursor-pointer text-text-secondary hover:text-accent-red p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly expenses (current period) */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="font-semibold text-sm">הוצאות חודשיות</span>
            <button onClick={() => setShowAddExpense(true)} className="btn-secondary text-[12px] py-1 px-2.5 flex items-center gap-1">
              <Plus size={12} /> הוסף
            </button>
          </div>
          {currentExpenses.length === 0 ? (
            <div className="text-text-secondary text-[13px]">אין הוצאות בתקופה הנוכחית</div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {currentExpenses.map(e => (
                  <div key={e.id} className="flex justify-between items-center py-2 px-2 rounded-lg hover:bg-[oklch(0.18_0.01_250)] transition-colors text-[13px]">
                    <div>
                      <span className="text-text-heading">{e.description || e.category}</span>
                      <div className="text-[11px] text-text-secondary mt-0.5">{e.category}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-accent-red">{formatCurrency(e.amount)}</span>
                      <button onClick={() => handleDeleteExpense(e.id)} aria-label="מחק"
                        className="bg-transparent border-none cursor-pointer text-text-secondary hover:text-accent-red p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-t-[oklch(0.22_0.01_250)] text-sm">
                <span className="font-semibold text-text-secondary">סה"כ חודשי</span>
                <span className="font-bold text-accent-red">{formatCurrency(currentMonthExpenses)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete kid */}
      <div className="mt-5">
        <button onClick={onDelete} className="btn-danger flex items-center gap-1.5 text-[13px]">
          <Trash2 size={13} /> מחק ילד/ה
        </button>
      </div>

      {/* Add Activity Modal */}
      {showAddActivity && (
        <AddActivityModal kidId={kid.id} onClose={() => setShowAddActivity(false)} />
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <AddExpenseModal
          kidId={kid.id}
          userId={userId}
          periods={periods}
          selectedPeriodId={selectedPeriodId}
          onClose={() => setShowAddExpense(false)}
        />
      )}
    </div>
  )
}

// ── Add Kid Modal ────────────────────────────────────────────────────────────
function AddKidModal({
  userId,
  familyId,
  onClose,
}: {
  userId: string
  familyId: string | undefined
  onClose: () => void
}) {
  const createKid = useCreateKid()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')

  async function handleSubmit() {
    if (!name) return
    try {
      await createKid.mutateAsync({
        user_id: userId,
        family_id: familyId,
        name,
        birth_date: birthDate || undefined,
      } as Omit<Kid, 'id' | 'created_at' | 'is_active'>)
      toast.success('ילד/ה נוסף/ה!')
      onClose()
    } catch { toast.error('שגיאה') }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4">
      <div className="bg-[oklch(0.14_0.01_250)] rounded-2xl p-6 w-full max-w-[380px] border border-[oklch(0.25_0.01_250)]">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold">הוסף ילד/ה</h3>
          <button onClick={onClose} aria-label="סגור"
            className="bg-transparent border-none cursor-pointer text-text-secondary p-2">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">שם</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="input-field w-full" placeholder="שם הילד/ה" />
          </div>
          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">תאריך לידה</label>
            <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
              className="input-field w-full ltr" />
          </div>
          <button onClick={handleSubmit} disabled={createKid.isPending || !name}
            className="btn-primary w-full py-3 mt-2 disabled:opacity-50">
            {createKid.isPending ? '...' : 'הוסף'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Activity Modal ───────────────────────────────────────────────────────
function AddActivityModal({
  kidId,
  onClose,
}: {
  kidId: number
  onClose: () => void
}) {
  const createActivity = useCreateKidActivity()
  const [name, setName] = useState('')
  const [monthlyCost, setMonthlyCost] = useState('')
  const [equipmentCost, setEquipmentCost] = useState('')
  const [transportCost, setTransportCost] = useState('')

  async function handleSubmit() {
    if (!name || !monthlyCost) return
    try {
      await createActivity.mutateAsync({
        kid_id: kidId,
        name,
        monthly_cost: Number(monthlyCost),
        equipment_cost: Number(equipmentCost) || 0,
        transport_cost: Number(transportCost) || 0,
      })
      toast.success('חוג נוסף!')
      onClose()
    } catch { toast.error('שגיאה') }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4">
      <div className="bg-[oklch(0.14_0.01_250)] rounded-2xl p-6 w-full max-w-[380px] border border-[oklch(0.25_0.01_250)]">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold">הוסף חוג / פעילות</h3>
          <button onClick={onClose} aria-label="סגור"
            className="bg-transparent border-none cursor-pointer text-text-secondary p-2">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">שם החוג</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="input-field w-full" placeholder="כדורגל, פסנתר..." />
          </div>
          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">עלות חודשית (₪)</label>
            <input type="number" value={monthlyCost} onChange={e => setMonthlyCost(e.target.value)}
              className="input-field w-full ltr text-right" />
          </div>
          <div className="grid-2 !mb-0">
            <div>
              <label className="text-xs block mb-[5px] text-text-secondary">ציוד (₪)</label>
              <input type="number" value={equipmentCost} onChange={e => setEquipmentCost(e.target.value)}
                className="input-field w-full ltr text-right" placeholder="0" />
            </div>
            <div>
              <label className="text-xs block mb-[5px] text-text-secondary">הסעות (₪)</label>
              <input type="number" value={transportCost} onChange={e => setTransportCost(e.target.value)}
                className="input-field w-full ltr text-right" placeholder="0" />
            </div>
          </div>
          <button onClick={handleSubmit} disabled={createActivity.isPending || !name || !monthlyCost}
            className="btn-primary w-full py-3 mt-2 disabled:opacity-50">
            {createActivity.isPending ? '...' : 'הוסף חוג'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Expense Modal ────────────────────────────────────────────────────────
function AddExpenseModal({
  kidId,
  userId,
  periods,
  selectedPeriodId,
  onClose,
}: {
  kidId: number
  userId: string
  periods: import('@/lib/types').Period[] | undefined
  selectedPeriodId: number | undefined
  onClose: () => void
}) {
  const createExpense = useCreateKidExpense()
  const [category, setCategory] = useState(KID_EXPENSE_CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [periodId, setPeriodId] = useState(selectedPeriodId ?? 0)

  useEffect(() => {
    if (selectedPeriodId) setPeriodId(selectedPeriodId)
  }, [selectedPeriodId])

  async function handleSubmit() {
    if (!amount || !periodId) return
    try {
      await createExpense.mutateAsync({
        kid_id: kidId,
        user_id: userId,
        category,
        amount: Number(amount),
        description: description || undefined,
        expense_date: new Date().toISOString().split('T')[0],
        period_id: periodId,
      } as import('@/lib/types').KidExpense)
      toast.success('הוצאה נוספה!')
      onClose()
    } catch { toast.error('שגיאה') }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4">
      <div className="bg-[oklch(0.14_0.01_250)] rounded-2xl p-6 w-full max-w-[380px] border border-[oklch(0.25_0.01_250)]">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold">הוסף הוצאה</h3>
          <button onClick={onClose} aria-label="סגור"
            className="bg-transparent border-none cursor-pointer text-text-secondary p-2">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">קטגוריה</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="input-field w-full">
              {KID_EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">סכום (₪)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="input-field w-full ltr text-right" />
          </div>
          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">תיאור</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="input-field w-full" placeholder="אופציונלי" />
          </div>
          <div>
            <label className="text-xs block mb-[5px] text-text-secondary">מחזור</label>
            <select value={periodId} onChange={e => setPeriodId(Number(e.target.value))}
              className="input-field w-full">
              {periods?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <button onClick={handleSubmit} disabled={createExpense.isPending || !amount}
            className="btn-primary w-full py-3 mt-2 disabled:opacity-50">
            {createExpense.isPending ? '...' : 'הוסף הוצאה'}
          </button>
        </div>
      </div>
    </div>
  )
}
