'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { usePersonalExpenses, useBudgetCategories, useAddExpense, useDeleteExpense } from '@/lib/queries/useExpenses'
import { useSharedExpenses, useUpsertSharedExpense, useDeleteSharedExpense } from '@/lib/queries/useShared'
import { formatCurrency } from '@/lib/utils'
import { parseExpenseExcel, createExpenseTemplate } from '@/lib/excel-import'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import { Receipt, Upload, Download, Plus, X, FileSpreadsheet, User, Users } from 'lucide-react'
import type { RawExpenseRow } from '@/lib/excel-import'
import type { BudgetCategory } from '@/lib/types'

type ExpType = 'personal' | 'shared'

type DisplayRow = {
  key: string
  type: ExpType
  categoryName: string
  myAmount: number
  totalAmount: number
  description?: string
  dbId: number
  periodId: number
}

const CARD: React.CSSProperties = {
  background: 'oklch(0.16 0.01 250)',
  border: '1px solid oklch(0.25 0.01 250)',
  borderRadius: 12,
  padding: 20,
}

const INPUT: React.CSSProperties = {
  background: 'oklch(0.22 0.01 250)',
  border: '1px solid oklch(0.28 0.01 250)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'inherit',
  fontSize: 13,
  width: '100%',
  outline: 'none',
}

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

  const { data: personalExp } = usePersonalExpenses(selectedPeriodId, user?.id)
  const { data: sharedExp } = useSharedExpenses(selectedPeriodId)
  const { data: categories } = useBudgetCategories(user?.id)
  const addExpense = useAddExpense()
  const deleteExpense = useDeleteExpense()
  const upsertShared = useUpsertSharedExpense()
  const deleteShared = useDeleteSharedExpense()

  // Form state
  const [expType, setExpType] = useState<ExpType>('personal')
  const [categoryId, setCategoryId] = useState('')
  const [sharedLabel, setSharedLabel] = useState('')
  const [amount, setAmount] = useState('')

  // Excel import
  const [importRows, setImportRows] = useState<(RawExpenseRow & { categoryId: string })[]>([])
  const [showImport, setShowImport] = useState(false)

  if (loading || !user) return null

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)

  // ── Build unified list ──────────────────────────────────────────────────────
  const rows: DisplayRow[] = [
    ...(personalExp ?? []).map(e => ({
      key: `p_${e.id}`,
      type: 'personal' as ExpType,
      categoryName: (e.budget_categories as BudgetCategory)?.name ?? 'כללי',
      myAmount: e.amount,
      totalAmount: e.amount,
      description: e.description,
      dbId: e.id,
      periodId: selectedPeriodId!,
    })),
    ...(sharedExp ?? []).map(e => ({
      key: `s_${e.id}`,
      type: 'shared' as ExpType,
      categoryName: e.notes || e.category,
      myAmount: e.my_share ?? e.total_amount / 2,
      totalAmount: e.total_amount,
      description: undefined,
      dbId: e.id,
      periodId: selectedPeriodId!,
    })),
  ]

  const totalPersonal = rows.filter(r => r.type === 'personal').reduce((s, r) => s + r.myAmount, 0)
  const totalSharedMy = rows.filter(r => r.type === 'shared').reduce((s, r) => s + r.myAmount, 0)
  const totalAll = totalPersonal + totalSharedMy

  // ── Add expense ─────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedPeriodId || !amount) return
    const amt = Number(amount)
    if (!amt || amt <= 0) return

    try {
      if (expType === 'personal') {
        if (!categoryId) { toast.error('בחר קטגוריה'); return }
        await addExpense.mutateAsync({
          period_id: selectedPeriodId,
          user_id: user.id,
          category_id: Number(categoryId),
          amount: amt,
          description: '',
          expense_date: new Date().toISOString().split('T')[0],
        })
      } else {
        const label = sharedLabel.trim() || 'הוצאה משותפת'
        await upsertShared.mutateAsync({
          period_id: selectedPeriodId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          category: `u_${Date.now()}` as any,
          total_amount: amt,
          notes: label,
        })
      }
      setAmount('')
      setSharedLabel('')
      toast.success('הוצאה נוספה')
    } catch { toast.error('שגיאה בהוספה') }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(row: DisplayRow) {
    try {
      if (row.type === 'personal') {
        await deleteExpense.mutateAsync({ id: row.dbId, period_id: row.periodId, user_id: user!.id })
      } else {
        await deleteShared.mutateAsync({ id: row.dbId, period_id: row.periodId })
      }
      toast.success('נמחק')
    } catch { toast.error('שגיאה במחיקה') }
  }

  // ── Excel ────────────────────────────────────────────────────────────────────
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const r = await parseExpenseExcel(file)
      setImportRows(r.map(row => ({ ...row, categoryId: '' })))
      setShowImport(true)
      toast.success(`נטענו ${r.length} שורות`)
    } catch { toast.error('שגיאה בקריאת הקובץ') }
    e.target.value = ''
  }

  function downloadTemplate() {
    const blob = createExpenseTemplate(categories?.map(c => c.name) ?? [])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'תבנית_הוצאות.xlsx'; a.click()
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
      setShowImport(false); setImportRows([])
    } catch { toast.error('שגיאה בייבוא') }
  }

  const isPending = addExpense.isPending || upsertShared.isPending

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Receipt size={18} style={{ color: 'oklch(0.72 0.18 55)' }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>הוצאות</h1>
          </div>
          <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>{selectedPeriod?.label ?? '...'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '8px 12px', color: 'oklch(0.75 0.01 250)', fontSize: 13, cursor: 'pointer' }}>
            <Download size={14} /> תבנית
          </button>
          <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.65 0.18 250)', border: 'none', borderRadius: 8, padding: '8px 12px', color: 'oklch(0.12 0.01 250)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Upload size={14} /> ייבוא Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleExcelUpload} />
        </div>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* Excel Import Preview */}
      {showImport && (
        <div style={{ ...CARD, marginBottom: 16, borderColor: 'oklch(0.65 0.18 250 / 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={15} style={{ color: 'oklch(0.65 0.18 250)' }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>{importRows.length} שורות מאקסל</span>
            </div>
            <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', color: 'oklch(0.55 0.01 250)', cursor: 'pointer' }}><X size={15} /></button>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
            {importRows.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 160px', gap: 8, padding: '5px 0', borderBottom: '1px solid oklch(0.20 0.01 250)', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'oklch(0.80 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</span>
                <span style={{ fontSize: 12, fontWeight: 600, direction: 'ltr', textAlign: 'right', color: 'oklch(0.72 0.18 55)' }}>{formatCurrency(row.amount)}</span>
                <select value={row.categoryId} onChange={e => setImportRows(prev => prev.map((r, j) => j === i ? { ...r, categoryId: e.target.value } : r))}
                  style={{ background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 6, padding: '3px 6px', color: 'inherit', fontSize: 11 }}>
                  <option value="">בחר...</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleImportSave} disabled={addExpense.isPending} style={{ flex: 1, background: 'oklch(0.65 0.18 250)', border: 'none', borderRadius: 8, padding: '9px 0', color: 'oklch(0.12 0.01 250)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              ייבא {importRows.filter(r => r.categoryId).length} הוצאות
            </button>
            <button onClick={() => { setShowImport(false); setImportRows([]) }} style={{ background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 14px', color: 'oklch(0.75 0.01 250)', cursor: 'pointer', fontSize: 13 }}>
              ביטול
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Add form ───────────────────────────────────────────────────────── */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Plus size={14} style={{ color: 'oklch(0.65 0.18 250)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>הוספה ידנית</span>
          </div>

          {/* Type toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'oklch(0.20 0.01 250)', borderRadius: 9, padding: 3 }}>
            {(['personal', 'shared'] as ExpType[]).map(t => (
              <button key={t} onClick={() => setExpType(t)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: expType === t ? (t === 'personal' ? 'oklch(0.65 0.18 250)' : 'oklch(0.55 0.12 310)') : 'transparent',
                border: 'none', borderRadius: 7, padding: '7px 0',
                color: expType === t ? 'oklch(0.12 0.01 250)' : 'oklch(0.55 0.01 250)',
                fontSize: 12, fontWeight: expType === t ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {t === 'personal' ? <><User size={12} /> אישית</> : <><Users size={12} /> משותפת</>}
              </button>
            ))}
          </div>

          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Category — personal: dropdown, shared: text */}
            {expType === 'personal' ? (
              <div>
                <label style={LABEL}>קטגוריה</label>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required style={INPUT}>
                  <option value="">בחר...</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label style={LABEL}>תיאור ההוצאה</label>
                <input type="text" value={sharedLabel} onChange={e => setSharedLabel(e.target.value)}
                  placeholder="למשל: שכירות, חשמל, מכולת..."
                  style={INPUT} />
              </div>
            )}

            {/* Amount */}
            <div>
              <label style={LABEL}>
                {expType === 'shared' ? 'סכום כולל (₪) — חלקך 50%' : 'סכום (₪)'}
              </label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" required min="0.01" step="0.01"
                style={{ ...INPUT, direction: 'ltr', textAlign: 'right' }} />
              {expType === 'shared' && Number(amount) > 0 && (
                <div style={{ marginTop: 5, fontSize: 12, color: 'oklch(0.68 0.12 310)' }}>
                  חלקך: {formatCurrency(Number(amount) / 2)}
                </div>
              )}
            </div>

            <button type="submit" disabled={isPending} style={{
              background: expType === 'personal' ? 'oklch(0.65 0.18 250)' : 'oklch(0.55 0.12 310)',
              color: 'oklch(0.12 0.01 250)', border: 'none', borderRadius: 8,
              padding: '10px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}>
              {isPending ? '...' : '+ הוסף הוצאה'}
            </button>
          </form>
        </div>

        {/* ── Expense list ───────────────────────────────────────────────────── */}
        <div style={CARD}>
          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>הוצאות המחזור</span>
            <div style={{ display: 'flex', gap: 16, direction: 'ltr', flexWrap: 'wrap' }}>
              {totalPersonal > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'oklch(0.50 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.04em', direction: 'rtl' }}>אישי</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'oklch(0.65 0.18 250)' }}>{formatCurrency(totalPersonal)}</div>
                </div>
              )}
              {totalSharedMy > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'oklch(0.50 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.04em', direction: 'rtl' }}>משותף (חלקי)</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'oklch(0.68 0.12 310)' }}>{formatCurrency(totalSharedMy)}</div>
                </div>
              )}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'oklch(0.50 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.04em', direction: 'rtl' }}>סה&quot;כ</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'oklch(0.72 0.18 55)' }}>{formatCurrency(totalAll)}</div>
              </div>
            </div>
          </div>

          {rows.length === 0
            ? <div style={{ color: 'oklch(0.50 0.01 250)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>אין הוצאות — הוסף ידנית או ייבא מ-Excel</div>
            : rows.map(row => (
              <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid oklch(0.20 0.01 250)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
                  {/* Type badge */}
                  <span style={{
                    flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: row.type === 'personal' ? 'oklch(0.20 0.04 250)' : 'oklch(0.20 0.04 310)',
                    border: `1px solid ${row.type === 'personal' ? 'oklch(0.32 0.08 250)' : 'oklch(0.32 0.08 310)'}`,
                    borderRadius: 20, padding: '2px 7px', fontSize: 10,
                    color: row.type === 'personal' ? 'oklch(0.65 0.15 250)' : 'oklch(0.68 0.12 310)',
                  }}>
                    {row.type === 'personal' ? <User size={9} /> : <Users size={9} />}
                    {row.type === 'personal' ? 'אישי' : 'משותף'}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.categoryName}</div>
                    {row.type === 'shared' && (
                      <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', direction: 'ltr', marginTop: 1 }}>
                        סה&quot;כ {formatCurrency(row.totalAmount)} · חלקי {formatCurrency(row.myAmount)}
                      </div>
                    )}
                    {row.description && (
                      <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', marginTop: 1 }}>{row.description}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, direction: 'ltr' }}>{formatCurrency(row.myAmount)}</span>
                  <button onClick={() => handleDelete(row)} style={{ background: 'none', border: 'none', color: 'oklch(0.40 0.01 250)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

const LABEL: React.CSSProperties = {
  fontSize: 11, color: 'oklch(0.55 0.01 250)', display: 'block', marginBottom: 5, fontWeight: 500,
}
