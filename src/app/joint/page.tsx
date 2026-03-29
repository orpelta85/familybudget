'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useJointPoolIncome, useJointPoolExpenses, useUpsertJointIncome, useAddJointExpense, useDeleteJointExpense, useJointCarryOver } from '@/lib/queries/useJoint'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import { PiggyBank, Trash2, Inbox, X } from 'lucide-react'
import type { PoolCategory } from '@/lib/types'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'

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
  const deleteExpense = useDeleteJointExpense()
  const { data: carryOver = 0 } = useJointCarryOver(selectedPeriodId, familyId, periods ?? undefined)
  const queryClient = useQueryClient()
  const confirm = useConfirmDialog()

  const [myContrib, setMyContrib] = useState('')
  const [partnerContrib, setPartnerContrib] = useState('')
  const [expCategory, setExpCategory] = useState<PoolCategory>('restaurants')
  const [useCustomCat, setUseCustomCat] = useState(false)
  const [customCatName, setCustomCatName] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDesc, setExpDesc] = useState('')
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0])

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
    } catch (e) { console.error('Reset joint pool:', e); toast.error('שגיאה באיפוס') }
  }

  const totalIncome = (Number(myContrib) || 0) + (Number(partnerContrib) || 0)
  const totalExpenses = poolExpenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0
  const balance = carryOver + totalIncome - totalExpenses
  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)

  async function saveIncome() {
    if (!selectedPeriodId) return
    if (!familyId) { toast.error('לא משויך למשפחה'); return }
    try {
      await upsertIncome.mutateAsync({ period_id: selectedPeriodId, my_contribution: Number(myContrib) || 0, partner_contribution: Number(partnerContrib) || 0, notes: '', family_id: familyId })
      toast.success('הכנסות נשמרו')
    } catch (e) { console.error('Save joint income:', e); toast.error('שגיאה') }
  }

  async function handleDeleteExpense(id: number) {
    if (!selectedPeriodId) return
    if (!(await confirm({ message: 'למחוק את ההוצאה?' }))) return
    try {
      await deleteExpense.mutateAsync({ id, periodId: selectedPeriodId })
      toast.success('ההוצאה נמחקה')
    } catch (e) { console.error('Delete joint expense:', e); toast.error('שגיאה במחיקה') }
  }

  async function addExp(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPeriodId || !expAmount) return
    if (!familyId) { toast.error('לא משויך למשפחה'); return }
    try {
      const category = useCustomCat ? 'misc' as PoolCategory : expCategory
      const desc = useCustomCat ? (customCatName.trim() + (expDesc ? ` - ${expDesc}` : '')) : expDesc
      await addExpense.mutateAsync({ period_id: selectedPeriodId, category, amount: Number(expAmount), description: desc, expense_date: expDate, family_id: familyId })
      setExpAmount(''); setExpDesc(''); setCustomCatName(''); setExpDate(new Date().toISOString().split('T')[0])
      toast.success('הוצאה נוספה')
    } catch (e) { console.error('Add joint expense:', e); toast.error('שגיאה') }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div>
          <div className="flex items-center gap-2">
            <PiggyBank size={18} className="text-[var(--accent-purple)]" />
            <h1 className="text-xl font-bold tracking-tight">קופה קטנה</h1>
            <PageInfo {...PAGE_TIPS.joint} />
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">מזומן, שוברים, מתנות והוצאות/הכנסות קטנות שלא נכנסים לתקציב הגדול</p>
        </div>
        <button onClick={handleResetPool} className="flex items-center gap-1.5 bg-transparent border border-[var(--border-default)] rounded-lg px-3.5 py-[7px] text-[var(--text-secondary)] text-xs font-medium cursor-pointer">
          <Trash2 size={13} /> אפס קופה
        </button>
      </div>
      <p className="text-[var(--text-secondary)] text-[13px] mb-5">{selectedPeriod?.label ?? '...'}</p>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* Balance hero */}
      <div className={`rounded-xl p-5 mb-5 border ${balance >= 0 ? 'bg-[var(--c-purple-0-15)] border-[var(--c-purple-0-25)]' : 'bg-[var(--c-red-0-15)] border-[var(--c-red-0-25)]'}`}>
        <div className="flex justify-between items-center">
          <div className="flex gap-6">
            {carryOver !== 0 && (
              <div className="text-center">
                <div className={`text-lg font-bold ${carryOver >= 0 ? 'text-[var(--accent-blue)]' : 'text-[var(--accent-orange)]'}`}>{formatCurrency(carryOver)}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">העברה</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-lg font-bold text-[var(--accent-green)]">{formatCurrency(totalIncome)}</div>
              <div className="text-[11px] text-[var(--text-secondary)]">הכנסות</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-[var(--accent-orange)]">{formatCurrency(totalExpenses)}</div>
              <div className="text-[11px] text-[var(--text-secondary)]">הוצאות</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--c-purple-0-60)] mb-1 uppercase tracking-[0.04em] text-left">יתרת הקופה</div>
            <div className={`text-4xl font-extrabold tracking-[-0.04em] ${balance >= 0 ? 'text-[var(--c-purple-0-80)]' : 'text-[var(--c-red-0-75)]'}`}>{formatCurrency(balance)}</div>
          </div>
        </div>
      </div>

      <div className="grid-2 gap-4 mb-4">
        {/* Income */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
          <div className="font-semibold mb-3.5 text-sm">הכנסות לקופה</div>
          {[
            { label: 'החלק שלי', val: myContrib, set: setMyContrib },
            { label: 'החלק של סנדרה', val: partnerContrib, set: setPartnerContrib },
          ].map(f => (
            <div key={f.label} className="mb-3">
              <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">{f.label}</label>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder="0"
                className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-[15px] text-right [direction:ltr]" />
            </div>
          ))}
          <button onClick={saveIncome} disabled={upsertIncome.isPending}
            className="btn-hover w-full bg-[var(--accent-purple)] border-none rounded-lg py-2.5 font-semibold text-[13px] text-[var(--c-purple-0-15)] cursor-pointer">
            שמור הכנסות
          </button>
        </div>

        {/* Add expense */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
          <div className="font-semibold mb-3.5 text-sm">הוצאה משותפת</div>
          <form onSubmit={addExp} className="flex flex-col gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] text-[var(--c-0-60)] block font-medium">קטגוריה</label>
                <button type="button" onClick={() => setUseCustomCat(v => !v)}
                  className="bg-transparent border-none text-[10px] text-[var(--accent-purple)] cursor-pointer p-0">
                  {useCustomCat ? '← מרשימה' : '+ ידנית'}
                </button>
              </div>
              {useCustomCat ? (
                <input type="text" value={customCatName} onChange={e => setCustomCatName(e.target.value)}
                  placeholder="שם קטגוריה חופשי..."
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-[13px]" />
              ) : (
                <select value={expCategory} onChange={e => setExpCategory(e.target.value as PoolCategory)}
                  aria-label="קטגוריית הוצאה"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-[13px]">
                  {POOL_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              )}
            </div>
            <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="סכום (₪)" required min="0"
              className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-[15px] text-right [direction:ltr]" />
            <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="תיאור (אופציונלי)"
              className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-[13px]" />
            <div>
              <label className="text-[11px] text-[var(--c-0-60)] block mb-[5px] font-medium">תאריך</label>
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} aria-label="תאריך הוצאה"
                className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-[13px] [direction:ltr]" />
            </div>
            <button type="submit" className="btn-hover bg-[var(--accent-orange)] border-none rounded-lg py-2.5 font-semibold text-[13px] text-[var(--c-0-10)] cursor-pointer">
              + הוסף הוצאה
            </button>
          </form>
        </div>
      </div>

      {/* Expense list */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
        <div className="font-semibold mb-3.5 text-sm">הוצאות המחזור</div>
        {poolExpenses?.length ? poolExpenses.map(e => (
          <div key={e.id} className="flex items-center justify-between py-[9px] border-b border-[var(--c-0-20)] text-[13px] group">
            <div className="flex-1 min-w-0">
              <div>
                <span className="font-medium">{POOL_CATEGORIES.find(c => c.key === e.category)?.label ?? e.category}</span>
                {e.description && <span className="text-[var(--text-secondary)] mr-2">· {e.description}</span>}
              </div>
              {e.expense_date && (
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{new Date(e.expense_date).toLocaleDateString('he-IL')}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--accent-orange)]">{formatCurrency(Number(e.amount))}</span>
              <button type="button" onClick={() => handleDeleteExpense(e.id)} aria-label="מחק הוצאה"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--c-red-0-15)] text-[var(--text-secondary)] hover:text-[var(--c-red-0-75)]">
                <X size={14} />
              </button>
            </div>
          </div>
        )) : (
          <div className="text-center py-6">
            <Inbox size={32} className="text-[var(--c-0-30)] mx-auto mb-2" />
            <div className="text-xs text-[var(--text-secondary)]">אין הוצאות עדיין</div>
          </div>
        )}
      </div>
    </div>
  )
}
