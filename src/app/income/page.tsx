'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome, useUpsertIncome } from '@/lib/queries/useIncome'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'

export default function IncomePage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>()

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const { data: income } = useIncome(selectedPeriodId, user?.id)
  const upsert = useUpsertIncome()

  const [salary, setSalary] = useState('')
  const [bonus, setBonus] = useState('')
  const [other, setOther] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (income) {
      setSalary(income.salary?.toString() ?? '')
      setBonus(income.bonus?.toString() ?? '')
      setOther(income.other?.toString() ?? '')
      setNotes(income.notes ?? '')
    } else {
      setSalary('')
      setBonus('')
      setOther('')
      setNotes('')
    }
  }, [income, selectedPeriodId])

  if (loading || !user) return null

  const total = (Number(salary) || 0) + (Number(bonus) || 0) + (Number(other) || 0)

  async function handleSave() {
    if (!user || !selectedPeriodId) return
    try {
      await upsert.mutateAsync({
        period_id: selectedPeriodId,
        user_id: user.id,
        salary: Number(salary) || 0,
        bonus: Number(bonus) || 0,
        other: Number(other) || 0,
        notes,
      })
      toast.success('הכנסה נשמרה בהצלחה')
    } catch {
      toast.error('שגיאה בשמירה')
    }
  }

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>💰 הכנסה</h1>
        <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginTop: 4 }}>{selectedPeriod?.label ?? '...'}</p>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      <div style={{ maxWidth: 480 }}>
        <div style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ marginBottom: 20, fontSize: 15, fontWeight: 600 }}>הזנת הכנסה למחזור</div>

          {[
            { label: 'משכורת נטו', val: salary, set: setSalary, placeholder: '16000' },
            { label: 'בונוס', val: bonus, set: setBonus, placeholder: '0' },
            { label: 'הכנסה אחרת', val: other, set: setOther, placeholder: '0' },
          ].map(field => (
            <div key={field.label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 5, color: 'oklch(0.75 0.01 250)' }}>{field.label}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={field.val}
                  onChange={e => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '10px 40px 10px 12px', color: 'inherit', fontSize: 15, direction: 'ltr', textAlign: 'right' }}
                />
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.60 0.01 250)', fontSize: 13 }}>₪</span>
              </div>
            </div>
          ))}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 5, color: 'oklch(0.75 0.01 250)' }}>הערות</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="הערה אופציונלית..."
              style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '10px 12px', color: 'inherit', fontSize: 14 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: '1px solid oklch(0.22 0.01 250)', marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>סה&quot;כ הכנסה</span>
            <span style={{ fontSize: 20, fontWeight: 700, direction: 'ltr', color: 'oklch(0.65 0.18 250)' }}>{formatCurrency(total)}</span>
          </div>

          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            style={{ width: '100%', background: 'oklch(0.65 0.18 250)', color: 'oklch(0.12 0.01 250)', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 4, opacity: upsert.isPending ? 0.7 : 1 }}
          >
            {upsert.isPending ? 'שומר...' : 'שמור הכנסה'}
          </button>
        </div>
      </div>
    </div>
  )
}
