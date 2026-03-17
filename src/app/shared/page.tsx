'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useSharedExpenses, useUpsertSharedExpense } from '@/lib/queries/useShared'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import type { SharedCategory } from '@/lib/types'

const SHARED_CATEGORIES: { key: SharedCategory; label: string }[] = [
  { key: 'rent', label: 'שכירות' },
  { key: 'property_tax', label: 'ארנונה' },
  { key: 'electricity', label: 'חשמל' },
  { key: 'water_gas', label: 'מים + גז' },
  { key: 'building_committee', label: 'ועד בית' },
  { key: 'internet', label: 'אינטרנט' },
  { key: 'home_insurance', label: 'ביטוח דירה' },
  { key: 'netflix', label: 'נטפליקס' },
  { key: 'spotify', label: 'ספוטיפיי' },
  { key: 'groceries', label: 'מכולת' },
  { key: 'misc', label: 'שונות' },
]

export default function SharedPage() {
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

  const { data: shared } = useSharedExpenses(selectedPeriodId)
  const upsert = useUpsertSharedExpense()

  const [values, setValues] = useState<Record<string, string>>({})

  useEffect(() => {
    if (shared) {
      const map: Record<string, string> = {}
      shared.forEach(e => { map[e.category] = e.total_amount.toString() })
      setValues(map)
    }
  }, [shared, selectedPeriodId])

  if (loading || !user) return null

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const totalAll = Object.values(values).reduce((s, v) => s + (Number(v) || 0), 0)
  const myShare = totalAll / 2

  async function handleSave() {
    if (!selectedPeriodId) return
    try {
      const promises = SHARED_CATEGORIES
        .filter(c => values[c.key] && Number(values[c.key]) > 0)
        .map(c => upsert.mutateAsync({
          period_id: selectedPeriodId!,
          category: c.key,
          total_amount: Number(values[c.key]),
          notes: '',
        }))
      await Promise.all(promises)
      toast.success('הוצאות משותפות נשמרו')
    } catch {
      toast.error('שגיאה בשמירה')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>🤝 הוצאות משותפות</h1>
        <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginTop: 4 }}>{selectedPeriod?.label ?? '...'}</p>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      <div style={{ maxWidth: 520 }}>
        <div style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 13, color: 'oklch(0.60 0.01 250)', marginBottom: 16 }}>
            הזן את הסכום הכולל לכל קטגוריה — חלקך יחושב אוטומטית (50%)
          </div>

          {SHARED_CATEGORIES.map(cat => (
            <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <label style={{ flex: 1, fontSize: 14, color: 'oklch(0.85 0.01 250)' }}>{cat.label}</label>
              <div style={{ position: 'relative', width: 140 }}>
                <input
                  type="number"
                  value={values[cat.key] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [cat.key]: e.target.value }))}
                  placeholder="0"
                  min="0"
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '8px 36px 8px 12px', color: 'inherit', fontSize: 14, direction: 'ltr', textAlign: 'right' }}
                />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>₪</span>
              </div>
              <div style={{ width: 80, textAlign: 'left', fontSize: 13, color: 'oklch(0.60 0.01 250)', direction: 'ltr' }}>
                {values[cat.key] ? formatCurrency(Number(values[cat.key]) / 2) : '-'}
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid oklch(0.22 0.01 250)', marginTop: 16, paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 14 }}>
              <span style={{ color: 'oklch(0.75 0.01 250)' }}>סה&quot;כ כולל</span>
              <span style={{ direction: 'ltr', fontWeight: 600 }}>{formatCurrency(totalAll)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
              <span>חלקי (50%)</span>
              <span style={{ direction: 'ltr', color: 'oklch(0.65 0.18 250)' }}>{formatCurrency(myShare)}</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            style={{ width: '100%', background: 'oklch(0.65 0.18 250)', color: 'oklch(0.12 0.01 250)', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 16, opacity: upsert.isPending ? 0.7 : 1 }}
          >
            {upsert.isPending ? 'שומר...' : 'שמור הוצאות משותפות'}
          </button>
        </div>
      </div>
    </div>
  )
}
