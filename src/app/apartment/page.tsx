'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useApartmentDeposits, useUpsertApartmentDeposit } from '@/lib/queries/useApartment'
import { formatCurrency } from '@/lib/utils'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Home, CheckCircle, Circle } from 'lucide-react'

const MONTHLY_TARGET = 3500
const TOTAL_PERIODS = 36
const TOTAL_GOAL = MONTHLY_TARGET * TOTAL_PERIODS

export default function ApartmentPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { data: deposits } = useApartmentDeposits()
  const upsert = useUpsertApartmentDeposit()
  const [amount, setAmount] = useState(MONTHLY_TARGET.toString())
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return null

  const totalSaved = deposits?.reduce((s, d) => s + d.amount_deposited, 0) ?? 0
  const pct = Math.min((totalSaved / TOTAL_GOAL) * 100, 100)
  const remaining = TOTAL_GOAL - totalSaved
  const periodsLeft = TOTAL_PERIODS - (deposits?.length ?? 0)
  const depositMap = new Map(deposits?.map(d => [d.period_id, d.amount_deposited]))

  const milestones = [25, 50, 75, 100]

  async function handleDeposit() {
    if (!selectedPeriodId || !amount) return
    try {
      await upsert.mutateAsync({ period_id: selectedPeriodId, amount_deposited: Number(amount), notes: '' })
      toast.success('הפקדה נשמרה!')
    } catch { toast.error('שגיאה בשמירה') }
  }

  const card: React.CSSProperties = { background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 20 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Home size={18} style={{ color: 'oklch(0.70 0.18 145)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>יעד הדירה</h1>
      </div>
      <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13, marginBottom: 20 }}>
        חיסכון של 3,500 ₪ לחודש × 36 מחזורים
      </p>

      {/* Hero card */}
      <div style={{ ...card, marginBottom: 20, background: 'oklch(0.15 0.02 145)', borderColor: 'oklch(0.25 0.05 145)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'oklch(0.65 0.10 145)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>נחסך עד כה</div>
            <div style={{ fontSize: 40, fontWeight: 800, direction: 'ltr', color: 'oklch(0.88 0.08 145)', letterSpacing: '-0.04em' }}>
              {formatCurrency(totalSaved)}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, color: 'oklch(0.65 0.10 145)', marginBottom: 6 }}>יעד סופי</div>
            <div style={{ fontSize: 22, fontWeight: 700, direction: 'ltr', color: 'oklch(0.75 0.08 145)' }}>{formatCurrency(TOTAL_GOAL)}</div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ height: 12, borderRadius: 6, background: 'oklch(0.20 0.03 145)', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', borderRadius: 6, width: `${pct}%`, background: 'oklch(0.70 0.18 145)', transition: 'width 0.8s ease', position: 'relative' }} />
          {/* Milestone markers */}
          {milestones.map(m => (
            <div key={m} style={{ position: 'absolute', top: 0, bottom: 0, left: `${m}%`, width: 1, background: 'oklch(0.30 0.05 145)', transform: 'translateX(-50%)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
          <span style={{ color: 'oklch(0.70 0.15 145)', fontWeight: 600 }}>{pct.toFixed(1)}% מהיעד</span>
          <span style={{ color: 'oklch(0.60 0.08 145)', direction: 'ltr' }}>נותר: {formatCurrency(remaining)}</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
          {[
            { label: 'הפקדות', value: deposits?.length ?? 0 },
            { label: 'מחזורים נותרים', value: periodsLeft },
            { label: 'ממוצע חודשי', value: deposits?.length ? formatCurrency(totalSaved / (deposits?.length ?? 1)) : '—' },
          ].map(s => (
            <div key={s.label} style={{ background: 'oklch(0.12 0.02 145)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'oklch(0.88 0.08 145)', direction: 'ltr' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'oklch(0.60 0.08 145)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Deposit form */}
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>הפקדה חדשה</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 5, color: 'oklch(0.60 0.01 250)' }}>מחזור</label>
            <select value={selectedPeriodId ?? ''} onChange={e => setSelectedPeriodId(Number(e.target.value))}
              style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 13 }}>
              {periods?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 5, color: 'oklch(0.60 0.01 250)' }}>סכום (₪)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 15, direction: 'ltr', textAlign: 'right' }} />
          </div>
          <button onClick={handleDeposit} disabled={upsert.isPending}
            style={{ width: '100%', background: 'oklch(0.70 0.18 145)', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 600, fontSize: 14, color: 'oklch(0.10 0.02 145)', cursor: 'pointer' }}>
            {upsert.isPending ? '...' : 'שמור הפקדה'}
          </button>
        </div>

        {/* Period table */}
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>36 מחזורים</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {Array.from({ length: TOTAL_PERIODS }, (_, i) => {
              const period = periods?.[i]
              const deposited = period ? depositMap.get(period.id) : undefined
              return (
                <div key={i} title={period?.label ?? `מחזור ${i + 1}`}
                  style={{ borderRadius: 6, padding: '6px 4px', textAlign: 'center', fontSize: 11,
                    background: deposited ? 'oklch(0.20 0.05 145)' : 'oklch(0.20 0.01 250)',
                    border: `1px solid ${deposited ? 'oklch(0.35 0.08 145)' : 'oklch(0.25 0.01 250)'}`,
                    color: deposited ? 'oklch(0.75 0.12 145)' : 'oklch(0.45 0.01 250)',
                  }}>
                  {deposited ? <CheckCircle size={12} style={{ margin: '0 auto' }} /> : <Circle size={12} style={{ margin: '0 auto', opacity: 0.3 }} />}
                  <div style={{ marginTop: 3 }}>{i + 1}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
