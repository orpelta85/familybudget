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
import { PiggyBank, Trash2 } from 'lucide-react'
import type { PoolCategory } from '@/lib/types'

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

  if (loading || !user) return <div style={{ padding: 40, textAlign: 'center', color: 'oklch(0.55 0.01 250)' }}>טוען...</div>

  async function handleResetPool() {
    if (!selectedPeriodId || !familyId) return
    if (!confirm('למחוק את כל הנתונים של הקופה למחזור הנוכחי?')) return
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

  const card: React.CSSProperties = { background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 20 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PiggyBank size={18} style={{ color: 'oklch(0.68 0.18 295)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>קופה משותפת</h1>
        </div>
        <button onClick={handleResetPool} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 8, padding: '7px 14px', color: 'oklch(0.55 0.01 250)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          <Trash2 size={13} /> אפס קופה
        </button>
      </div>
      <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13, marginBottom: 20 }}>{selectedPeriod?.label ?? '...'}</p>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* Balance hero */}
      <div style={{ ...card, marginBottom: 20, background: balance >= 0 ? 'oklch(0.15 0.02 295)' : 'oklch(0.15 0.02 27)', borderColor: balance >= 0 ? 'oklch(0.25 0.05 295)' : 'oklch(0.25 0.05 27)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'oklch(0.60 0.08 295)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>יתרת הקופה</div>
            <div style={{ fontSize: 36, fontWeight: 800, direction: 'ltr', color: balance >= 0 ? 'oklch(0.80 0.12 295)' : 'oklch(0.75 0.15 27)', letterSpacing: '-0.04em' }}>{formatCurrency(balance)}</div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, direction: 'ltr', color: 'oklch(0.70 0.18 145)' }}>{formatCurrency(totalIncome)}</div>
              <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)' }}>הכנסות</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, direction: 'ltr', color: 'oklch(0.72 0.18 55)' }}>{formatCurrency(totalExpenses)}</div>
              <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)' }}>הוצאות</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Income */}
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>הכנסות לקופה</div>
          {[
            { label: 'החלק שלי', val: myContrib, set: setMyContrib },
            { label: 'החלק של סנדרה', val: partnerContrib, set: setPartnerContrib },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>{f.label}</label>
              <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder="0"
                style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 15, direction: 'ltr', textAlign: 'right' }} />
            </div>
          ))}
          <button onClick={saveIncome} disabled={upsertIncome.isPending}
            style={{ width: '100%', background: 'oklch(0.68 0.18 295)', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 13, color: 'oklch(0.10 0.02 295)', cursor: 'pointer' }}>
            שמור הכנסות
          </button>
        </div>

        {/* Add expense */}
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>הוצאה משותפת</div>
          <form onSubmit={addExp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <select value={expCategory} onChange={e => setExpCategory(e.target.value as PoolCategory)}
              style={{ background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 13 }}>
              {POOL_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="סכום (₪)" required min="0"
              style={{ background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 15, direction: 'ltr', textAlign: 'right' }} />
            <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="תיאור (אופציונלי)"
              style={{ background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 13 }} />
            <button type="submit" style={{ background: 'oklch(0.72 0.18 55)', border: 'none', borderRadius: 8, padding: '10px 0', fontWeight: 600, fontSize: 13, color: 'oklch(0.10 0.01 250)', cursor: 'pointer' }}>
              + הוסף הוצאה
            </button>
          </form>
        </div>
      </div>

      {/* Expense list */}
      {!!poolExpenses?.length && (
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>הוצאות המחזור</div>
          {poolExpenses.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid oklch(0.20 0.01 250)', fontSize: 13 }}>
              <div>
                <span style={{ fontWeight: 500 }}>{POOL_CATEGORIES.find(c => c.key === e.category)?.label ?? e.category}</span>
                {e.description && <span style={{ color: 'oklch(0.55 0.01 250)', marginRight: 8 }}>· {e.description}</span>}
              </div>
              <span style={{ direction: 'ltr', fontWeight: 600, color: 'oklch(0.72 0.18 55)' }}>{formatCurrency(e.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
