'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useJointPoolIncome, useJointPoolExpenses, useUpsertJointIncome, useAddJointExpense } from '@/lib/queries/useJoint'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import { PiggyBank, Trash2, Inbox } from 'lucide-react'
import type { PoolCategory } from '@/lib/types'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'

const POOL_CATEGORIES: { key: PoolCategory; label: string }[] = [
  { key: 'restaurants', label: 'מסעדות' },
  { key: 'entertainment', label: 'בידור' },
  { key: 'travel', label: 'טיולים' },
  { key: 'shopping', label: 'קניות' },
  { key: 'misc', label: 'שונות' },
]

export default function JointPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const { familyId } = useFamilyContext()

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const { data: poolIncome } = useJointPoolIncome(selectedPeriodId, familyId)
  const { data: poolExpenses } = useJointPoolExpenses(selectedPeriodId, familyId)
  const upsertIncome = useUpsertJointIncome()
  const addExpense = useAddJointExpense()
  const queryClient = useQueryClient()
  const confirm = useConfirmDialog()

  const [myContrib, setMyContrib] = useState('')
  const [partnerContrib, setPartnerContrib] = useState('')
  const [expCategory, setExpCategory] = useState<PoolCategory>('restaurants')
  const [expAmount, setExpAmount] = useState('')
  const [expDesc, setExpDesc] = useState('')

  useEffect(() => {
    if (poolIncome) {
      setMyContrib(poolIncome.my_contribution.toString())
      setPartnerContrib(poolIncome.partner_contribution.toString())
    }
  }, [poolIncome, selectedPeriodId])

  if (loading || !user) return <TableSkeleton rows={5} />

  async function handleResetPool() {
    if (!selectedPeriodId || !familyId) return
    if (!(await confirm({ message: 'למחוק את כל הנתונים של הקופה למחזור הנוכחי?' }))) return
    try {
      const sb = createClient()
      await sb.from('joint_pool_income').delete().eq('period_id', selectedPeriodId).eq('family_id', familyId)
      await sb.from('joint_pool_expenses').delete().eq('period_id', selectedPeriodId).eq('family_id', familyId)
      queryClient.invalidateQueries({ queryKey: ['joint_pool_income', selectedPeriodId] })
      queryClient.invalidateQueries({ queryKey: ['joint_pool_expenses', selectedPeriodId] })
      setMyContrib(''); setPartnerContrib('')
      toast.success('הקופה אופסה')
    } catch { toast.error('שגיאה באיפוס') }
  }

  const totalIncome = (Number(myContrib) || 0) + (Number(partnerContrib) || 0)
  const totalExpenses = poolExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const balance = totalIncome - totalExpenses
  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)

  async function saveIncome() {
    if (!selectedPeriodId) return
    if (!familyId) { toast.error('לא משויך למשפחה'); return }
    try {
      await upsertIncome.mutateAsync({ period_id: selectedPeriodId, my_contribution: Number(myContrib) || 0, partner_contribution: Number(partnerContrib) || 0, notes: '', family_id: familyId })
      toast.success('הכנסות נשמרו')
    } catch { toast.error('שגיאה') }
  }

  async function addExp(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPeriodId || !expAmount) return
    if (!familyId) { toast.error('לא משויך למשפחה'); return }
    try {
      await addExpense.mutateAsync({ period_id: selectedPeriodId, category: expCategory, amount: Number(expAmount), description: expDesc, expense_date: new Date().toISOString().split('T')[0], family_id: familyId })
      setExpAmount(''); setExpDesc('')
      toast.success('הוצאה נוספה')
    } catch { toast.error('שגיאה') }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <PiggyBank size={18} className="text-[oklch(0.68_0.18_295)]" />
          <h1 className="text-xl font-bold tracking-tight">קופה משותפת</h1>
        </div>
        <button onClick={handleResetPool} className="flex items-center gap-1.5 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-3.5 py-[7px] text-[oklch(0.65_0.01_250)] text-xs font-medium cursor-pointer">
          <Trash2 size={13} /> אפס קופה
        </button>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">{selectedPeriod?.label ?? '...'}</p>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* Balance hero */}
      <div className={`rounded-xl p-5 mb-5 border ${balance >= 0 ? 'bg-[oklch(0.15_0.02_295)] border-[oklch(0.25_0.05_295)]' : 'bg-[oklch(0.15_0.02_27)] border-[oklch(0.25_0.05_27)]'}`}>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-[oklch(0.60_0.08_295)] mb-1 uppercase tracking-[0.04em]">יתרת הקופה</div>
            <div className={`text-4xl font-extrabold ltr tracking-[-0.04em] ${balance >= 0 ? 'text-[oklch(0.80_0.12_295)]' : 'text-[oklch(0.75_0.15_27)]'}`}>{formatCurrency(balance)}</div>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-lg font-bold ltr text-[oklch(0.70_0.18_145)]">{formatCurrency(totalIncome)}</div>
              <div className="text-[11px] text-[oklch(0.65_0.01_250)]">הכנסות</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold ltr text-[oklch(0.72_0.18_55)]">{formatCurrency(totalExpenses)}</div>
              <div className="text-[11px] text-[oklch(0.65_0.01_250)]">הוצאות</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 gap-4 mb-4">
        {/* Income */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="font-semibold mb-3.5 text-sm">הכנסות לקופה</div>
          {[
            { label: 'החלק שלי', val: myContrib, set: setMyContrib },
            { label: 'החלק של סנדרה', val: partnerContrib, set: setPartnerContrib },
          ].map(f => (
            <div key={f.label} className="mb-3">
              <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">{f.label}</label>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder="0"
                className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-[15px] ltr text-right" />
            </div>
          ))}
          <button onClick={saveIncome} disabled={upsertIncome.isPending}
            className="btn-hover w-full bg-[oklch(0.68_0.18_295)] border-none rounded-lg py-2.5 font-semibold text-[13px] text-[oklch(0.10_0.02_295)] cursor-pointer">
            שמור הכנסות
          </button>
        </div>

        {/* Add expense */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="font-semibold mb-3.5 text-sm">הוצאה משותפת</div>
          <form onSubmit={addExp} className="flex flex-col gap-3">
            <select value={expCategory} onChange={e => setExpCategory(e.target.value as PoolCategory)}
              aria-label="קטגוריית הוצאה"
              className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-[13px]">
              {POOL_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="סכום (₪)" required min="0"
              className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-[15px] ltr text-right" />
            <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="תיאור (אופציונלי)"
              className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-[13px]" />
            <button type="submit" className="btn-hover bg-[oklch(0.72_0.18_55)] border-none rounded-lg py-2.5 font-semibold text-[13px] text-[oklch(0.10_0.01_250)] cursor-pointer">
              + הוסף הוצאה
            </button>
          </form>
        </div>
      </div>

      {/* Expense list */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
        <div className="font-semibold mb-3.5 text-sm">הוצאות המחזור</div>
        {poolExpenses?.length ? poolExpenses.map(e => (
          <div key={e.id} className="flex justify-between py-[9px] border-b border-[oklch(0.20_0.01_250)] text-[13px]">
            <div>
              <span className="font-medium">{POOL_CATEGORIES.find(c => c.key === e.category)?.label ?? e.category}</span>
              {e.description && <span className="text-[oklch(0.65_0.01_250)] ms-2">· {e.description}</span>}
            </div>
            <span className="ltr font-semibold text-[oklch(0.72_0.18_55)]">{formatCurrency(e.amount)}</span>
          </div>
        )) : (
          <div className="text-center py-6">
            <Inbox size={32} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />
            <div className="text-xs text-[oklch(0.65_0.01_250)]">אין הוצאות עדיין</div>
          </div>
        )}
      </div>
    </div>
  )
}
