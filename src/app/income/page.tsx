'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome, useUpsertIncome, useAllIncome } from '@/lib/queries/useIncome'
import { formatCurrency, periodLabel } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { Wallet, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CARD: React.CSSProperties = {
  background: 'oklch(0.16 0.01 250)',
  border: '1px solid oklch(0.25 0.01 250)',
  borderRadius: 12,
  padding: 20,
}

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
  const { data: allIncome } = useAllIncome(user?.id)
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
      toast.success('הכנסה נשמרה')
    } catch {
      toast.error('שגיאה בשמירה')
    }
  }

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)

  // Trend: last 6 periods with income data
  const trendData = (() => {
    if (!allIncome || !periods) return []
    const currentIdx = periods.findIndex(p => p.id === selectedPeriodId)
    const slice = periods.slice(Math.max(0, currentIdx - 5), currentIdx + 1)
    return slice.map(p => {
      const inc = allIncome.find(i => i.period_id === p.id)
      return {
        label: periodLabel(p.start_date),
        total: inc ? inc.salary + inc.bonus + inc.other : 0,
        salary: inc?.salary ?? 0,
        bonus: inc?.bonus ?? 0,
        other: inc?.other ?? 0,
        isCurrent: p.id === selectedPeriodId,
      }
    }).filter(d => d.total > 0)
  })()

  const avgIncome = trendData.length > 1
    ? trendData.slice(0, -1).reduce((s, d) => s + d.total, 0) / (trendData.length - 1)
    : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Wallet size={18} style={{ color: 'oklch(0.65 0.18 250)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>הכנסה</h1>
      </div>
      <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginBottom: 20 }}>
        {selectedPeriod ? periodLabel(selectedPeriod.start_date) : '...'}
      </p>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      <div className="grid-2" style={{ alignItems: 'start' }}>

        {/* Input form */}
        <div style={CARD}>
          <div style={{ marginBottom: 18, fontWeight: 600, fontSize: 14 }}>הזנת הכנסה למחזור</div>

          {[
            { label: 'משכורת נטו', val: salary, set: setSalary, placeholder: '0' },
            { label: 'בונוס', val: bonus, set: setBonus, placeholder: '0' },
            { label: 'הכנסה אחרת', val: other, set: setOther, placeholder: '0' },
          ].map(field => (
            <div key={field.label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 5, color: 'oklch(0.75 0.01 250)' }}>
                {field.label}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  value={field.val}
                  onChange={e => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%', background: 'oklch(0.22 0.01 250)',
                    border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8,
                    padding: '10px 40px 10px 12px', color: 'inherit', fontSize: 15,
                    direction: 'ltr', textAlign: 'right',
                  }}
                />
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>₪</span>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: '1px solid oklch(0.22 0.01 250)' }}>
            <span style={{ fontWeight: 600 }}>סה&quot;כ הכנסה</span>
            <span style={{ fontSize: 22, fontWeight: 700, direction: 'ltr', color: 'oklch(0.65 0.18 250)' }}>
              {formatCurrency(total)}
            </span>
          </div>

          {avgIncome > 0 && total > 0 && (
            <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', marginBottom: 12, textAlign: 'center' }}>
              ממוצע 3 חודשים: {formatCurrency(avgIncome)}
              {' '}
              <span style={{ color: total >= avgIncome ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)' }}>
                ({total >= avgIncome ? '↑' : '↓'}{Math.abs(Math.round(((total - avgIncome) / avgIncome) * 100))}%)
              </span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            style={{ width: '100%', background: 'oklch(0.65 0.18 250)', color: 'oklch(0.12 0.01 250)', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, fontSize: 15, cursor: 'pointer', opacity: upsert.isPending ? 0.7 : 1 }}
          >
            {upsert.isPending ? 'שומר...' : 'שמור הכנסה'}
          </button>
        </div>

        {/* Trend chart */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
            <TrendingUp size={14} style={{ color: 'oklch(0.65 0.18 250)' }} />
            מגמת הכנסה
          </div>
          {trendData.length < 2
            ? <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>אין מספיק נתונים היסטוריים</div>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: 'oklch(0.55 0.01 250)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: unknown) => formatCurrency(Number(v))}
                    contentStyle={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, fontSize: 12, color: 'oklch(0.85 0.01 250)' }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {trendData.map((entry, i) => (
                      <Cell key={i} fill={entry.isCurrent ? 'oklch(0.65 0.18 250)' : 'oklch(0.30 0.01 250)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }

          {/* Last 6 periods summary */}
          {trendData.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: 'oklch(0.50 0.01 250)', marginBottom: 8 }}>סיכום לפי מחזור</div>
              {[...trendData].reverse().map(d => (
                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid oklch(0.20 0.01 250)' }}>
                  <span style={{ color: d.isCurrent ? 'oklch(0.92 0.01 250)' : 'oklch(0.65 0.01 250)', fontWeight: d.isCurrent ? 600 : 400 }}>
                    {d.label}{d.isCurrent ? ' ✦' : ''}
                  </span>
                  <span style={{ direction: 'ltr', fontWeight: d.isCurrent ? 600 : 400 }}>{formatCurrency(d.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
