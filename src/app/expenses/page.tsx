'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { usePersonalExpenses, useBudgetCategories, useAddExpense, useDeleteExpense, useDeleteAllPeriodExpenses } from '@/lib/queries/useExpenses'
import { formatCurrency } from '@/lib/utils'
import { parseExpenseExcel, createExpenseTemplate } from '@/lib/excel-import'
import { useRecurringPersonal, personalItemId } from '@/lib/hooks/useRecurring'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import { Receipt, Upload, Download, Plus, X, FileSpreadsheet, Lock, Unlock, RotateCcw } from 'lucide-react'
import type { RawExpenseRow } from '@/lib/excel-import'
import type { BudgetCategory } from '@/lib/types'

export default function ExpensesPage() {
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

  const { data: expenses } = usePersonalExpenses(selectedPeriodId, user?.id)
  const { data: categories } = useBudgetCategories(user?.id)
  const addExpense = useAddExpense()
  const deleteExpense = useDeleteExpense()
  const deleteAll = useDeleteAllPeriodExpenses()
  const recurring = useRecurringPersonal(user?.id)

  // Quick add form
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  // Excel import state
  const [importRows, setImportRows] = useState<(RawExpenseRow & { categoryId: string })[]>([])
  const [showImport, setShowImport] = useState(false)

  // Auto-insert locked templates when period is empty
  useEffect(() => {
    if (!expenses || !user || !selectedPeriodId) return
    if (expenses.length > 0) return
    if (recurring.items.length === 0) return
    // Auto-insert locked items into empty period
    Promise.all(recurring.items.map(item =>
      addExpense.mutateAsync({
        period_id: selectedPeriodId,
        user_id: user.id,
        category_id: item.category_id,
        amount: item.amount,
        description: item.description,
        expense_date: new Date().toISOString().split('T')[0],
      })
    )).then(() => {
      toast.success(`${recurring.items.length} פריטים קבועים נוספו אוטומטית`)
    }).catch(() => {})
  // Run only when period changes (not on every expense update)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriodId, user?.id])

  if (loading || !user) return null

  const total = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedPeriodId || !categoryId || !amount) return
    try {
      await addExpense.mutateAsync({
        period_id: selectedPeriodId,
        user_id: user.id,
        category_id: Number(categoryId),
        amount: Number(amount),
        description,
        expense_date: new Date().toISOString().split('T')[0],
      })
      setAmount('')
      setDescription('')
      toast.success('הוצאה נוספה')
    } catch { toast.error('שגיאה בהוספה') }
  }

  async function handleDelete(id: number) {
    if (!user || !selectedPeriodId) return
    await deleteExpense.mutateAsync({ id, period_id: selectedPeriodId, user_id: user.id })
    toast.success('נמחק')
  }

  // Reset: delete all non-locked, keep/re-insert locked templates
  async function handleReset() {
    if (!user || !selectedPeriodId) return
    if (!confirm('לאפס את החודש? רק הפריטים הנעולים ישמרו.')) return
    try {
      // Delete expenses that are NOT locked
      const locked = recurring.items
      const toDelete = (expenses ?? []).filter(e => {
        const id = personalItemId(e.category_id, e.description ?? '')
        return !locked.some(l => l.id === id)
      })
      await Promise.all(toDelete.map(e =>
        deleteExpense.mutateAsync({ id: e.id, period_id: selectedPeriodId, user_id: user.id })
      ))

      // Insert locked templates that aren't already present
      const existingKeys = new Set(
        (expenses ?? []).map(e => personalItemId(e.category_id, e.description ?? ''))
      )
      const toInsert = locked.filter(l => !existingKeys.has(l.id))
      await Promise.all(toInsert.map(item =>
        addExpense.mutateAsync({
          period_id: selectedPeriodId,
          user_id: user.id,
          category_id: item.category_id,
          amount: item.amount,
          description: item.description,
          expense_date: new Date().toISOString().split('T')[0],
        })
      ))
      toast.success(`אופס — ${locked.length} פריטים קבועים שמורים`)
    } catch { toast.error('שגיאה באיפוס') }
  }

  function toggleLock(expense: { category_id: number; amount: number; description: string | null | undefined }) {
    const catName = (categories ?? []).find(c => c.id === expense.category_id)?.name ?? ''
    const desc = expense.description ?? ''
    const id = personalItemId(expense.category_id, desc)
    recurring.toggle({ id, category_id: expense.category_id, category_name: catName, amount: expense.amount, description: desc })
    toast.success(recurring.isLocked(id) ? `בוטל נעילה: ${catName}` : `${catName} נועל לחודשים הבאים`)
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await parseExpenseExcel(file)
      setImportRows(rows.map(r => ({ ...r, categoryId: '' })))
      setShowImport(true)
      toast.success(`נטענו ${rows.length} שורות`)
    } catch { toast.error('שגיאה בקריאת הקובץ') }
    e.target.value = ''
  }

  function downloadTemplate() {
    const catNames = categories?.map(c => c.name) ?? []
    const blob = createExpenseTemplate(catNames)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'תבנית_הוצאות.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportSave() {
    if (!user || !selectedPeriodId) return
    const valid = importRows.filter(r => r.categoryId && r.amount > 0)
    if (!valid.length) { toast.error('לא נבחרו קטגוריות'); return }
    try {
      await Promise.all(valid.map(r => addExpense.mutateAsync({
        period_id: selectedPeriodId,
        user_id: user.id,
        category_id: Number(r.categoryId),
        amount: r.amount,
        description: r.description,
        expense_date: new Date().toISOString().split('T')[0],
      })))
      toast.success(`יובאו ${valid.length} הוצאות`)
      setShowImport(false)
      setImportRows([])
    } catch { toast.error('שגיאה בייבוא') }
  }

  const card: React.CSSProperties = { background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 20 }
  const lockedCount = recurring.items.length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Receipt size={18} style={{ color: 'oklch(0.72 0.18 55)' }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>הוצאות אישיות</h1>
          </div>
          <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>
            {selectedPeriod?.label ?? '...'}
            {lockedCount > 0 && <span style={{ marginRight: 8, color: 'oklch(0.70 0.15 185)' }}>· {lockedCount} פריטים נעולים</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={handleReset} title="אפס חודש (שמור רק נעולים)" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '8px 12px', color: 'oklch(0.75 0.01 250)', fontSize: 13, cursor: 'pointer' }}>
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
          <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', marginBottom: 12 }}>
            בחר קטגוריה לכל הוצאה. שורות ללא קטגוריה יידלגו.
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {importRows.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 160px', gap: 8, padding: '6px 0', borderBottom: '1px solid oklch(0.20 0.01 250)', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'oklch(0.80 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</span>
                <span style={{ fontSize: 13, fontWeight: 600, direction: 'ltr', textAlign: 'right', color: 'oklch(0.72 0.18 55)' }}>{formatCurrency(row.amount)}</span>
                <select
                  value={row.categoryId}
                  onChange={e => setImportRows(prev => prev.map((r, j) => j === i ? { ...r, categoryId: e.target.value } : r))}
                  style={{ background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 6, padding: '4px 8px', color: 'inherit', fontSize: 12 }}
                >
                  <option value="">בחר...</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={handleImportSave} disabled={addExpense.isPending} style={{ flex: 1, background: 'oklch(0.65 0.18 250)', border: 'none', borderRadius: 8, padding: '10px 0', color: 'oklch(0.12 0.01 250)', fontWeight: 600, cursor: 'pointer' }}>
              {addExpense.isPending ? 'מייבא...' : `ייבא ${importRows.filter(r => r.categoryId).length} הוצאות`}
            </button>
            <button onClick={() => { setShowImport(false); setImportRows([]) }} style={{ background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '10px 16px', color: 'oklch(0.75 0.01 250)', cursor: 'pointer' }}>
              ביטול
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Add form */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Plus size={15} style={{ color: 'oklch(0.65 0.18 250)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>הוספה ידנית</span>
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="קטגוריה">
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={inputStyleForm}>
                <option value="">בחר...</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="סכום (₪)">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" required min="0" style={{ ...inputStyleForm, direction: 'ltr', textAlign: 'right' }} />
            </Field>
            <Field label="תיאור">
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="אופציונלי..." style={inputStyleForm} />
            </Field>
            <button type="submit" disabled={addExpense.isPending} style={primaryBtn}>
              {addExpense.isPending ? '...' : '+ הוסף הוצאה'}
            </button>
          </form>
        </div>

        {/* List */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>הוצאות המחזור</span>
            <span style={{ fontSize: 20, fontWeight: 700, direction: 'ltr', color: 'oklch(0.72 0.18 55)' }}>{formatCurrency(total)}</span>
          </div>
          {!expenses?.length
            ? <Empty text="אין הוצאות — הוסף ידנית או ייבא מאקסל" />
            : expenses.map(e => {
              const itemId = personalItemId(e.category_id, e.description ?? '')
              const locked = recurring.isLocked(itemId)
              return (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid oklch(0.20 0.01 250)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{(e.budget_categories as BudgetCategory)?.name ?? 'כללי'}</div>
                    {e.description && <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', marginTop: 1 }}>{e.description}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, direction: 'ltr' }}>{formatCurrency(e.amount)}</span>
                    {/* Lock toggle */}
                    <button
                      onClick={() => toggleLock({ category_id: e.category_id, amount: e.amount, description: e.description ?? null })}
                      title={locked ? 'בטל נעילה' : 'נעל — יתווסף אוטומטית חודש הבא'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: locked ? 'oklch(0.70 0.15 185)' : 'oklch(0.35 0.01 250)', display: 'flex', alignItems: 'center', padding: 2 }}
                    >
                      {locked ? <Lock size={13} /> : <Unlock size={13} />}
                    </button>
                    <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: 'oklch(0.45 0.01 250)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, display: 'block', marginBottom: 5, color: 'oklch(0.60 0.01 250)', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ color: 'oklch(0.50 0.01 250)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>{text}</div>
}

const inputStyleForm: React.CSSProperties = {
  width: '100%',
  background: 'oklch(0.22 0.01 250)',
  border: '1px solid oklch(0.28 0.01 250)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'inherit',
  fontSize: 13,
  outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  background: 'oklch(0.65 0.18 250)',
  color: 'oklch(0.12 0.01 250)',
  border: 'none',
  borderRadius: 8,
  padding: '10px 0',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
}
