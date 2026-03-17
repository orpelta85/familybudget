'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useSharedExpenses, useUpsertSharedExpense, useDeleteAllPeriodSharedExpenses } from '@/lib/queries/useShared'
import { formatCurrency } from '@/lib/utils'
import { createSharedTemplate, parseSharedExcel } from '@/lib/excel-import'
import { useRecurringShared } from '@/lib/hooks/useRecurring'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import { Users, Plus, X, Lock, Unlock, Download, Upload, FileSpreadsheet, RotateCcw } from 'lucide-react'
import type { SharedCategory } from '@/lib/types'
import type { RawSharedRow } from '@/lib/excel-import'

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

const card: React.CSSProperties = {
  background: 'oklch(0.16 0.01 250)',
  border: '1px solid oklch(0.25 0.01 250)',
  borderRadius: 12,
  padding: 20,
}

const inputStyle: React.CSSProperties = {
  background: 'oklch(0.22 0.01 250)',
  border: '1px solid oklch(0.28 0.01 250)',
  borderRadius: 8,
  padding: '8px 34px 8px 12px',
  color: 'inherit',
  fontSize: 14,
  direction: 'ltr',
  textAlign: 'right',
  width: '100%',
}

export default function SharedPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const { data: shared } = useSharedExpenses(selectedPeriodId)
  const upsert = useUpsertSharedExpense()
  const deleteAll = useDeleteAllPeriodSharedExpenses()
  const recurring = useRecurringShared(user?.id)

  const [values, setValues] = useState<Record<string, string>>({})
  const [customRows, setCustomRows] = useState<CustomRow[]>([])

  // Excel import state
  const [importRows, setImportRows] = useState<RawSharedRow[]>([])
  const [showImport, setShowImport] = useState(false)

  // Load DB data into form whenever period or data changes
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
    // If period is empty, pre-fill from locked templates
    if (shared.length === 0 && recurring.items.length > 0) {
      recurring.items.forEach(item => {
        if (PREDEFINED_KEYS.has(item.category as SharedCategory)) {
          map[item.category] = item.amount.toString()
        } else {
          extras.push({ id: item.category, label: item.label, amount: item.amount.toString() })
        }
      })
    }
    setValues(map)
    setCustomRows(extras)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Reset: clear period, re-fill locked items only
  async function handleReset() {
    if (!selectedPeriodId) return
    if (!confirm('לאפס את החודש? רק הפריטים הנעולים ישארו.')) return
    try {
      await deleteAll.mutateAsync(selectedPeriodId)
      // Re-insert locked items
      if (recurring.items.length > 0) {
        await Promise.all(recurring.items.map(item =>
          upsert.mutateAsync({
            period_id: selectedPeriodId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            category: item.category as any,
            total_amount: item.amount,
            notes: PREDEFINED_KEYS.has(item.category as SharedCategory) ? '' : item.label,
          })
        ))
      }
      toast.success('אופס — פריטים קבועים שוחזרו')
    } catch {
      toast.error('שגיאה באיפוס')
    }
  }

  function toggleLockPredefined(key: string, label: string, amount: string) {
    const amt = Number(amount)
    if (recurring.isLocked(key)) {
      recurring.unlock(key)
      toast.success(`בוטל נעילה: ${label}`)
    } else {
      if (!amt) { toast.error('הזן סכום לפני נעילה'); return }
      recurring.lock({ category: key, label, amount: amt })
      toast.success(`${label} נועל לחודשים הבאים`)
    }
  }

  function toggleLockCustom(row: CustomRow) {
    const amt = Number(row.amount)
    if (recurring.isLocked(row.id)) {
      recurring.unlock(row.id)
      toast.success(`בוטל נעילה: ${row.label}`)
    } else {
      if (!amt || !row.label) { toast.error('מלא שם וסכום לפני נעילה'); return }
      recurring.lock({ category: row.id, label: row.label, amount: amt })
      toast.success(`${row.label} נועל לחודשים הבאים`)
    }
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await parseSharedExcel(file)
      setImportRows(rows)
      setShowImport(true)
      toast.success(`נטענו ${rows.length} שורות`)
    } catch { toast.error('שגיאה בקריאת הקובץ') }
    e.target.value = ''
  }

  function applyImport() {
    const newValues = { ...values }
    const newCustom = [...customRows]
    importRows.forEach(row => {
      // Try to match a predefined category by label
      const matched = SHARED_CATEGORIES.find(c => c.label === row.label)
      if (matched) {
        newValues[matched.key] = row.total_amount.toString()
      } else {
        // Check if custom row with this label already exists
        const existing = newCustom.find(r => r.label === row.label)
        if (existing) {
          existing.amount = row.total_amount.toString()
        } else {
          newCustom.push({ id: `import_${Date.now()}_${Math.random()}`, label: row.label, amount: row.total_amount.toString() })
        }
      }
    })
    setValues(newValues)
    setCustomRows(newCustom)
    setShowImport(false)
    setImportRows([])
    toast.success('הנתונים יובאו — לחץ "שמור" לאישור')
  }

  function downloadTemplate() {
    const allLabels = [...SHARED_CATEGORIES.map(c => c.label)]
    const blob = createSharedTemplate(allLabels)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'תבנית_הוצאות_משותפות.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const lockedCount = recurring.items.length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Users size={18} style={{ color: 'oklch(0.65 0.18 250)' }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>הוצאות משותפות</h1>
          </div>
          <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 13 }}>
            {selectedPeriod?.label ?? '...'}
            {lockedCount > 0 && <span style={{ marginRight: 8, color: 'oklch(0.70 0.15 185)' }}>· {lockedCount} פריטים נעולים</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={handleReset} disabled={deleteAll.isPending} title="אפס חודש (שמור רק נעולים)" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '8px 12px', color: 'oklch(0.75 0.01 250)', fontSize: 13, cursor: 'pointer' }}>
            <RotateCcw size={14} /> אתחול
          </button>
          <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '8px 12px', color: 'oklch(0.75 0.01 250)', fontSize: 13, cursor: 'pointer' }}>
            <Download size={14} /> תבנית Excel
          </button>
          <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.65 0.18 250)', border: 'none', borderRadius: 8, padding: '8px 12px', color: 'oklch(0.12 0.01 250)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Upload size={14} /> ייבוא אקסל
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleExcelUpload} />
        </div>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* Excel Import Preview */}
      {showImport && importRows.length > 0 && (
        <div style={{ ...card, marginBottom: 20, borderColor: 'oklch(0.65 0.18 250 / 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={16} style={{ color: 'oklch(0.65 0.18 250)' }} />
              <span style={{ fontWeight: 600 }}>ייבוא מאקסל — {importRows.length} שורות</span>
            </div>
            <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', color: 'oklch(0.55 0.01 250)', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
            {importRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid oklch(0.20 0.01 250)', fontSize: 13 }}>
                <span style={{ color: 'oklch(0.85 0.01 250)' }}>{row.label}</span>
                <span style={{ direction: 'ltr', fontWeight: 600, color: 'oklch(0.65 0.18 250)' }}>{formatCurrency(row.total_amount)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={applyImport} style={{ flex: 1, background: 'oklch(0.65 0.18 250)', border: 'none', borderRadius: 8, padding: '10px 0', color: 'oklch(0.12 0.01 250)', fontWeight: 600, cursor: 'pointer' }}>
              החל {importRows.length} שורות
            </button>
            <button onClick={() => { setShowImport(false); setImportRows([]) }} style={{ background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '10px 16px', color: 'oklch(0.75 0.01 250)', cursor: 'pointer' }}>
              ביטול
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 580 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', marginBottom: 16 }}>
            הזן סכום כולל — חלקך (50%) מחושב אוטומטית · לחץ 🔒 לנעילה לחודשים הבאים
          </div>

          {/* Predefined categories */}
          {SHARED_CATEGORIES.map(cat => {
            const locked = recurring.isLocked(cat.key)
            const val = values[cat.key] ?? ''
            return (
              <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {/* Lock button */}
                <button
                  onClick={() => toggleLockPredefined(cat.key, cat.label, val)}
                  title={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: locked ? 'oklch(0.70 0.15 185)' : 'oklch(0.35 0.01 250)', flexShrink: 0 }}
                >
                  {locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
                <label style={{ flex: 1, fontSize: 14, color: locked ? 'oklch(0.90 0.01 250)' : 'oklch(0.80 0.01 250)' }}>{cat.label}</label>
                <div style={{ position: 'relative', width: 130 }}>
                  <input
                    type="number"
                    value={val}
                    onChange={e => {
                      setValues(v => ({ ...v, [cat.key]: e.target.value }))
                      // Update lock amount if locked
                      if (locked && Number(e.target.value) > 0) {
                        recurring.lock({ category: cat.key, label: cat.label, amount: Number(e.target.value) })
                      }
                    }}
                    placeholder="0"
                    min="0"
                    style={{ ...inputStyle, borderColor: locked ? 'oklch(0.40 0.08 185)' : 'oklch(0.28 0.01 250)' }}
                  />
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.55 0.01 250)', fontSize: 13, pointerEvents: 'none' }}>₪</span>
                </div>
                <div style={{ width: 72, textAlign: 'left', fontSize: 13, color: 'oklch(0.60 0.01 250)', direction: 'ltr', flexShrink: 0 }}>
                  {val ? formatCurrency(Number(val) / 2) : '—'}
                </div>
              </div>
            )
          })}

          {/* Custom rows */}
          {customRows.length > 0 && (
            <div style={{ borderTop: '1px solid oklch(0.22 0.01 250)', marginTop: 14, paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', marginBottom: 10 }}>קטגוריות נוספות</div>
              {customRows.map(row => {
                const locked = recurring.isLocked(row.id)
                return (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <button
                      onClick={() => toggleLockCustom(row)}
                      title={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: locked ? 'oklch(0.70 0.15 185)' : 'oklch(0.35 0.01 250)', flexShrink: 0 }}
                    >
                      {locked ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                    <input
                      type="text"
                      value={row.label}
                      onChange={e => updateCustomRow(row.id, 'label', e.target.value)}
                      placeholder="שם קטגוריה..."
                      style={{ flex: 1, background: 'oklch(0.22 0.01 250)', border: `1px solid ${locked ? 'oklch(0.40 0.08 185)' : 'oklch(0.28 0.01 250)'}`, borderRadius: 8, padding: '8px 12px', color: 'inherit', fontSize: 14 }}
                    />
                    <div style={{ position: 'relative', width: 130 }}>
                      <input
                        type="number"
                        value={row.amount}
                        onChange={e => {
                          updateCustomRow(row.id, 'amount', e.target.value)
                          if (locked && Number(e.target.value) > 0 && row.label) {
                            recurring.lock({ category: row.id, label: row.label, amount: Number(e.target.value) })
                          }
                        }}
                        placeholder="0"
                        min="0"
                        style={{ ...inputStyle, borderColor: locked ? 'oklch(0.40 0.08 185)' : 'oklch(0.28 0.01 250)' }}
                      />
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'oklch(0.55 0.01 250)', fontSize: 13, pointerEvents: 'none' }}>₪</span>
                    </div>
                    <div style={{ width: 72, textAlign: 'left', fontSize: 13, color: 'oklch(0.60 0.01 250)', direction: 'ltr', flexShrink: 0 }}>
                      {row.amount ? formatCurrency(Number(row.amount) / 2) : '—'}
                    </div>
                    <button onClick={() => removeCustomRow(row.id)} style={{ background: 'none', border: 'none', color: 'oklch(0.50 0.01 250)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
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
