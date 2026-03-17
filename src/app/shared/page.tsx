'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useSharedExpenses, useUpsertSharedExpense } from '@/lib/queries/useShared'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import { Plus, X, Users } from 'lucide-react'
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

const PREDEFINED_KEYS = new Set(SHARED_CATEGORIES.map(c => c.key))

type CustomRow = { id: string; label: string; amount: string }

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
  const [customRows, setCustomRows] = useState<CustomRow[]>([])

  useEffect(() => {
    if (!shared) return
    const map: Record<string, string> = {}
    const extras: CustomRow[] = []
    shared.forEach(e => {
      if (PREDEFINED_KEYS.has(e.category as SharedCategory)) {
        map[e.category] = e.total_amount.toString()
      } else {
        extras.push({ id: e.category, label: e.notes || e.category, amount: e.total_amount.toString() })
      }
    })
    setValues(map)
    setCustomRows(extras)
  }, [shared, selectedPeriodId])

  if (loading || !user) return null

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const predefinedTotal = Object.values(values).reduce((s, v) => s + (Number(v) || 0), 0)
  const customTotal = customRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const totalAll = predefinedTotal + customTotal
  const myShare = totalAll / 2

  function addCustomRow() {
    setCustomRows(r => [...r, { id: `custom_${Date.now()}`, label: '', amount: '' }])
  }

  function updateCustomRow(id: string, field: 'label' | 'amount', val: string) {
    setCustomRows(r => r.map(row => row.id === id ? { ...row, [field]: val } : row))
  }

  function removeCustomRow(id: string) {
    setCustomRows(r => r.filter(row => row.id !== id))
  }

  async function handleSave() {
    if (!selectedPeriodId) return
    try {
      const predefined = SHARED_CATEGORIES
        .filter(c => values[c.key] && Number(values[c.key]) > 0)
        .map(c => upsert.mutateAsync({ period_id: selectedPeriodId, category: c.key, total_amount: Number(values[c.key]), notes: '' }))

      const custom = customRows
        .filter(r => r.label.trim() && Number(r.amount) > 0)
        .map(r => upsert.mutateAsync({
          period_id: selectedPeriodId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          category: r.id as any,
          total_amount: Number(r.amount),
          notes: r.label.trim(),
        }))

      await Promise.all([...predefined, ...custom])
      toast.success('הוצאות משותפות נשמרו')
    } catch {
      toast.error('שגיאה בשמירה')
    }
  }

  const inputStyle = {
    width: '100%', background: 'oklch(0.22 0.01 250)',
    border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8,
    padding: '8px 36px 8px 12px', color: 'inherit', fontSize: 14,
    direction: 'ltr' as const, textAlign: 'right' as const,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Users size={18} style={{ color: 'oklch(0.65 0.18 250)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>הוצאות משותפות</h1>
      </div>
      <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginBottom: 20 }}>{selectedPeriod?.label ?? '...'}</p>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      <div style={{ maxWidth: 520 }}>
        <div style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', marginBottom: 16 }}>
            הזן את הסכום הכולל — חלקך (50%) מחושב אוטומטית
          </div>

          {/* Predefined categories */}
          {SHARED_CATEGORIES.map(cat => (
            <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <label style={{ flex: 1, fontSize: 14, color: 'oklch(0.85 0.01 250)' }}>{cat.label}</label>
              <div style={{ position: 'relative', width: 130 }}>
                <input type="number" value={values[cat.key] ?? ''} onChange={e => setValues(v => ({ ...v, [cat.key]: e.target.value }))}
                  placeholder="0" min="0" style={inputStyle} />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>₪</span>
              </div>
              <div style={{ width: 72, textAlign: 'left', fontSize: 13, color: 'oklch(0.60 0.01 250)', direction: 'ltr' }}>
                {values[cat.key] ? formatCurrency(Number(values[cat.key]) / 2) : '—'}
              </div>
            </div>
          ))}

          {/* Custom rows */}
          {customRows.length > 0 && (
            <div style={{ borderTop: '1px solid oklch(0.22 0.01 250)', marginTop: 14, paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', marginBottom: 10 }}>קטגוריות נוספות</div>
              {customRows.map(row => (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <input type="text" value={row.label} onChange={e => updateCustomRow(row.id, 'label', e.target.value)}
                    placeholder="שם קטגוריה..." style={{ flex: 1, background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '8px 12px', color: 'inherit', fontSize: 14 }} />
                  <div style={{ position: 'relative', width: 130 }}>
                    <input type="number" value={row.amount} onChange={e => updateCustomRow(row.id, 'amount', e.target.value)}
                      placeholder="0" min="0" style={inputStyle} />
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>₪</span>
                  </div>
                  <div style={{ width: 72, textAlign: 'left', fontSize: 13, color: 'oklch(0.60 0.01 250)', direction: 'ltr' }}>
                    {row.amount ? formatCurrency(Number(row.amount) / 2) : '—'}
                  </div>
                  <button onClick={() => removeCustomRow(row.id)} style={{ background: 'none', border: 'none', color: 'oklch(0.50 0.01 250)', cursor: 'pointer', padding: 4 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add custom */}
          <button onClick={addCustomRow} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed oklch(0.30 0.01 250)', borderRadius: 8, padding: '7px 14px', color: 'oklch(0.55 0.01 250)', cursor: 'pointer', fontSize: 13, marginTop: 12, width: '100%', justifyContent: 'center' }}>
            <Plus size={13} /> הוסף קטגוריה
          </button>

          {/* Totals */}
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

          <button onClick={handleSave} disabled={upsert.isPending}
            style={{ width: '100%', background: 'oklch(0.65 0.18 250)', color: 'oklch(0.12 0.01 250)', border: 'none', borderRadius: 8, padding: '12px 0', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 16, opacity: upsert.isPending ? 0.7 : 1 }}>
            {upsert.isPending ? 'שומר...' : 'שמור הוצאות משותפות'}
          </button>
        </div>
      </div>
    </div>
  )
}
