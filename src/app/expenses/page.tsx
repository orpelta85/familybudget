'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { usePersonalExpenses, useBudgetCategories, useAddExpense, useDeleteExpense, useAddBudgetCategory } from '@/lib/queries/useExpenses'
import { useSharedExpenses, useUpsertSharedExpense, useDeleteSharedExpense } from '@/lib/queries/useShared'
import { useSinkingFunds, useAddSinkingTransaction } from '@/lib/queries/useSinking'
import { formatCurrency } from '@/lib/utils'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { parseExpenseExcel, createExpenseTemplate } from '@/lib/excel-import'
import { useRecurringPersonal, useRecurringShared, personalItemId } from '@/lib/hooks/useRecurring'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import { Receipt, Upload, Download, Plus, X, FileSpreadsheet, User, Users, Lock, Unlock, Target } from 'lucide-react'
import type { RawExpenseRow } from '@/lib/excel-import'
import type { BudgetCategory } from '@/lib/types'

type ExpType = 'personal' | 'shared'

const S = {
  card: {
    background: 'oklch(0.16 0.01 250)',
    border: '1px solid oklch(0.25 0.01 250)',
    borderRadius: 12,
    padding: 20,
  } as React.CSSProperties,
  input: {
    background: 'oklch(0.22 0.01 250)',
    border: '1px solid oklch(0.28 0.01 250)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'inherit',
    fontSize: 13,
    outline: 'none',
  } as React.CSSProperties,
  label: { fontSize: 11, color: 'oklch(0.55 0.01 250)', display: 'block', marginBottom: 4, fontWeight: 500 } as React.CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid oklch(0.20 0.01 250)' } as React.CSSProperties,
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, minWidth: 36, minHeight: 36 } as React.CSSProperties,
}

export default function ExpensesPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const fileRef = useRef<HTMLInputElement>(null)
  const { familyId } = useFamilyContext()

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])
  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const { data: personalExp } = usePersonalExpenses(selectedPeriodId, user?.id)
  const { data: sharedExp }   = useSharedExpenses(selectedPeriodId, familyId)
  const { data: categories }  = useBudgetCategories(user?.id)
  const { data: funds }       = useSinkingFunds(user?.id)
  const addExpense    = useAddExpense()
  const deleteExpense = useDeleteExpense()
  const upsertShared  = useUpsertSharedExpense()
  const deleteShared  = useDeleteSharedExpense()
  const addSinkingTx  = useAddSinkingTransaction()
  const addCategory   = useAddBudgetCategory()
  const recurringPersonal = useRecurringPersonal(user?.id)
  const recurringShared   = useRecurringShared(user?.id)

  // ── Add form state ──────────────────────────────────────────────────────────
  const [expType, setExpType]         = useState<ExpType>('personal')
  const [categoryId, setCategoryId]   = useState('')       // from dropdown
  const [customCat, setCustomCat]     = useState('')       // free-text fallback
  const [useCustomCat, setUseCustom]  = useState(false)   // toggle dropdown vs text
  const [sharedLabel, setSharedLabel] = useState('')
  const [amount, setAmount]           = useState('')

  // Excel import
  const [importRows, setImportRows] = useState<(RawExpenseRow & { categoryId: string })[]>([])
  const [showImport, setShowImport] = useState(false)

  if (loading || !user) return <div style={{ padding: 40, textAlign: 'center', color: 'oklch(0.55 0.01 250)' }}>טוען...</div>

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const totalPersonal  = (personalExp ?? []).reduce((s, e) => s + e.amount, 0)
  const totalSharedMy  = (sharedExp ?? []).reduce((s, e) => s + (e.my_share ?? e.total_amount / 2), 0)
  const totalSinking   = (funds ?? []).reduce((s, f) => s + f.monthly_allocation, 0)
  const totalAll       = totalPersonal + totalSharedMy

  // ── Add expense ─────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedPeriodId || !amount) return
    const amt = Number(amount)
    if (!amt || amt <= 0) return
    try {
      if (expType === 'personal') {
        const catId = useCustomCat ? null : (categoryId ? Number(categoryId) : null)
        if (!catId && !customCat.trim()) { toast.error('הזן קטגוריה'); return }
        // If custom category, use the first matching category or skip (store as description)
        const resolvedCatId = catId ?? categories?.[0]?.id ?? 1
        await addExpense.mutateAsync({
          period_id: selectedPeriodId, user_id: user.id,
          category_id: resolvedCatId,
          amount: amt,
          description: useCustomCat ? customCat.trim() : '',
          expense_date: new Date().toISOString().split('T')[0],
        })
      } else {
        const label = sharedLabel.trim() || 'הוצאה משותפת'
        if (!familyId) { toast.error('לא משויך למשפחה'); return }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await upsertShared.mutateAsync({ period_id: selectedPeriodId, category: `u_${Date.now()}` as any, total_amount: amt, notes: label, family_id: familyId })
      }
      setAmount(''); setSharedLabel(''); setCustomCat(''); setCategoryId('')
      toast.success('הוצאה נוספה')
    } catch { toast.error('שגיאה בהוספה') }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDeletePersonal(exp: { id: number; category_id: number; amount: number; description?: string }) {
    if (!confirm('למחוק את ההוצאה?')) return
    await deleteExpense.mutateAsync({ id: exp.id, period_id: selectedPeriodId!, user_id: user!.id })
    toast.success('נמחק')
  }

  async function handleDeleteShared(id: number) {
    if (!confirm('למחוק את ההוצאה?')) return
    await deleteShared.mutateAsync({ id, period_id: selectedPeriodId! })
    toast.success('נמחק')
  }

  // ── Excel ───────────────────────────────────────────────────────────────────
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const r = await parseExpenseExcel(file)
      const cats = categories ?? []
      const mapped = r.map(row => {
        // Auto-match category name from Excel to existing budget categories
        let categoryId = ''
        if (row.category) {
          const match = cats.find(c => c.name === row.category)
          if (match) categoryId = String(match.id)
          else categoryId = `__new__${row.category}` // marker for auto-create
        }
        return { ...row, categoryId }
      })
      setImportRows(mapped); setShowImport(true)
      const matched = mapped.filter(r => r.categoryId && !r.categoryId.startsWith('__new__')).length
      const newCats = new Set(mapped.filter(r => r.categoryId.startsWith('__new__')).map(r => r.category)).size
      let msg = `נטענו ${r.length} שורות`
      if (matched > 0) msg += ` · ${matched} קטגוריות זוהו`
      if (newCats > 0) msg += ` · ${newCats} קטגוריות חדשות ייווצרו`
      toast.success(msg)
    } catch { toast.error('שגיאה בקריאת הקובץ') }
    e.target.value = ''
  }

  function downloadTemplate() {
    const blob = createExpenseTemplate(
      categories?.map(c => c.name) ?? [],
      funds?.map(f => f.name) ?? []
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'תבנית_הוצאות.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportSave() {
    if (!user || !selectedPeriodId) return
    const valid = importRows.filter(r => r.categoryId && r.amount > 0)
    if (!valid.length) { toast.error('לא נבחרו קטגוריות'); return }
    try {
      const today = new Date().toISOString().split('T')[0]
      if (!familyId) { toast.error('לא משויך למשפחה'); return }

      // Auto-create new categories from Excel before saving expenses
      const newCatNames = [...new Set(valid.filter(r => r.categoryId.startsWith('__new__')).map(r => r.categoryId.replace('__new__', '')))]
      const createdCatMap: Record<string, number> = {}
      const maxSort = Math.max(0, ...(categories ?? []).map(c => c.sort_order ?? 0))
      for (let i = 0; i < newCatNames.length; i++) {
        const created = await addCategory.mutateAsync({
          user_id: user.id, name: newCatNames[i], type: 'variable',
          monthly_target: 0, sort_order: maxSort + i + 1,
        })
        createdCatMap[newCatNames[i]] = created.id
      }

      await Promise.all(valid.map(async r => {
        // Resolve category ID — either existing or newly created
        let resolvedCatId: number
        if (r.categoryId.startsWith('__new__')) {
          resolvedCatId = createdCatMap[r.categoryId.replace('__new__', '')]
        } else {
          resolvedCatId = Number(r.categoryId)
        }

        if (r.is_shared) {
          await upsertShared.mutateAsync({
            period_id: selectedPeriodId, category: `u_${Date.now()}` as any,
            total_amount: r.amount, notes: r.description, family_id: familyId,
          })
        } else {
          await addExpense.mutateAsync({
            period_id: selectedPeriodId, user_id: user.id,
            category_id: resolvedCatId, amount: r.amount,
            description: r.description, expense_date: today,
          })
        }
        // אם צוינה קרן — גם הוצאה מהקרן (סכום שלילי)
        if (r.fund_name) {
          const fund = (funds ?? []).find(f => f.name === r.fund_name)
          if (fund) {
            await addSinkingTx.mutateAsync({
              fund_id: fund.id, period_id: selectedPeriodId,
              amount: -r.amount, description: r.description, transaction_date: today,
            })
          }
        }
      }))
      const newCount = newCatNames.length
      toast.success(`יובאו ${valid.length} הוצאות` + (newCount ? ` · ${newCount} קטגוריות חדשות נוצרו` : ''))
      setShowImport(false); setImportRows([])
    } catch { toast.error('שגיאה בייבוא') }
  }

  // ── Lock helpers ────────────────────────────────────────────────────────────
  function toggleLockPersonal(exp: { category_id: number; amount: number; description?: string }) {
    const catName = (categories ?? []).find(c => c.id === exp.category_id)?.name ?? ''
    const desc = exp.description ?? ''
    const id = personalItemId(exp.category_id, desc)
    recurringPersonal.toggle({ id, category_id: exp.category_id, category_name: catName, amount: exp.amount, description: desc })
    toast.success(recurringPersonal.isLocked(id) ? `בוטל נעילה: ${catName || desc}` : `נעול: ${catName || desc}`)
  }

  function toggleLockShared(exp: { id: number; category: string; total_amount: number; notes?: string | null }) {
    const label = exp.notes || exp.category
    if (recurringShared.isLocked(exp.category)) {
      recurringShared.unlock(exp.category)
      toast.success(`בוטל נעילה: ${label}`)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recurringShared.lock({ category: exp.category as any, label, amount: exp.total_amount })
      toast.success(`נעול: ${label}`)
    }
  }

  const isPending = addExpense.isPending || upsertShared.isPending

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Receipt size={18} style={{ color: 'oklch(0.72 0.18 55)' }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>הוצאות</h1>
          </div>
          <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>{selectedPeriod?.label ?? '...'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '7px 11px', color: 'oklch(0.75 0.01 250)', fontSize: 12, cursor: 'pointer' }}>
            <Download size={13} /> תבנית
          </button>
          <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'oklch(0.65 0.18 250)', border: 'none', borderRadius: 8, padding: '7px 11px', color: 'oklch(0.12 0.01 250)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Upload size={13} /> Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleExcelUpload} />
        </div>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* ── Excel import preview ────────────────────────────────────────────── */}
      {showImport && (
        <div style={{ ...S.card, marginBottom: 16, borderColor: 'oklch(0.65 0.18 250 / 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <FileSpreadsheet size={14} style={{ color: 'oklch(0.65 0.18 250)' }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{importRows.length} שורות מ-Excel</span>
            </div>
            <button onClick={() => setShowImport(false)} style={{ ...S.iconBtn, color: 'oklch(0.55 0.01 250)' }}><X size={14} /></button>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
            {importRows.map((row, i) => {
              const isAutoMatched = row.categoryId && !row.categoryId.startsWith('__new__') && row.category
              const isNewCat = row.categoryId.startsWith('__new__')
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 150px', gap: 6, padding: '4px 0', borderBottom: '1px solid oklch(0.20 0.01 250)', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'oklch(0.80 0.01 250)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, direction: 'ltr', textAlign: 'right', color: 'oklch(0.72 0.18 55)' }}>{formatCurrency(row.amount)}</span>
                  {isAutoMatched ? (
                    <span style={{ fontSize: 11, color: 'oklch(0.70 0.18 150)', fontWeight: 500 }}>{row.category}</span>
                  ) : isNewCat ? (
                    <span style={{ fontSize: 11, color: 'oklch(0.72 0.18 55)', fontWeight: 500 }}>{row.category} (חדש)</span>
                  ) : (
                    <select value={row.categoryId} onChange={e => setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: e.target.value } : r))}
                      style={{ ...S.input, padding: '3px 6px', fontSize: 11 }}>
                      <option value="">בחר...</option>
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleImportSave} disabled={addExpense.isPending} style={{ flex: 1, background: 'oklch(0.65 0.18 250)', border: 'none', borderRadius: 8, padding: '8px 0', color: 'oklch(0.12 0.01 250)', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
              ייבא {importRows.filter(r => r.categoryId && r.amount > 0).length}
            </button>
            <button onClick={() => { setShowImport(false); setImportRows([]) }} style={{ ...S.input, padding: '8px 12px', cursor: 'pointer', fontSize: 12, width: 'auto' }}>ביטול</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Add form ───────────────────────────────────────────────────────── */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
            <Plus size={13} style={{ color: 'oklch(0.65 0.18 250)' }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>הוספה ידנית</span>
          </div>

          {/* Type toggle */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 12, background: 'oklch(0.20 0.01 250)', borderRadius: 9, padding: 3 }}>
            {(['personal', 'shared'] as ExpType[]).map(t => (
              <button key={t} onClick={() => setExpType(t)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                background: expType === t ? (t === 'personal' ? 'oklch(0.65 0.18 250)' : 'oklch(0.55 0.12 310)') : 'transparent',
                border: 'none', borderRadius: 7, padding: '6px 0',
                color: expType === t ? 'oklch(0.12 0.01 250)' : 'oklch(0.55 0.01 250)',
                fontSize: 12, fontWeight: expType === t ? 600 : 400, cursor: 'pointer',
              }}>
                {t === 'personal' ? <><User size={11} /> אישית</> : <><Users size={11} /> משותפת</>}
              </button>
            ))}
          </div>

          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {expType === 'personal' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={S.label}>קטגוריה</label>
                  <button type="button" onClick={() => setUseCustom(v => !v)}
                    style={{ background: 'none', border: 'none', fontSize: 10, color: 'oklch(0.55 0.18 250)', cursor: 'pointer', padding: 0 }}>
                    {useCustomCat ? '← מרשימה' : '+ ידנית'}
                  </button>
                </div>
                {useCustomCat
                  ? <input type="text" value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="שם קטגוריה חופשי..." style={{ ...S.input, width: '100%' }} />
                  : (
                    <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ ...S.input, width: '100%' }}>
                      <option value="">בחר...</option>
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )
                }
              </div>
            ) : (
              <div>
                <label style={S.label}>תיאור</label>
                <input type="text" value={sharedLabel} onChange={e => setSharedLabel(e.target.value)}
                  placeholder="שכירות, חשמל, מכולת..." style={{ ...S.input, width: '100%' }} />
              </div>
            )}

            <div>
              <label style={S.label}>{expType === 'shared' ? 'סכום כולל ₪ (חלקך 50%)' : 'סכום (₪)'}</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" required min="0.01" step="0.01"
                style={{ ...S.input, width: '100%', direction: 'ltr', textAlign: 'right' }} />
              {expType === 'shared' && Number(amount) > 0 && (
                <div style={{ marginTop: 4, fontSize: 11, color: 'oklch(0.65 0.12 310)' }}>
                  חלקך: {formatCurrency(Number(amount) / 2)}
                </div>
              )}
            </div>

            <button type="submit" disabled={isPending} style={{
              background: expType === 'personal' ? 'oklch(0.65 0.18 250)' : 'oklch(0.55 0.12 310)',
              color: 'oklch(0.12 0.01 250)', border: 'none', borderRadius: 8,
              padding: '9px 0', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
              {isPending ? '...' : '+ הוסף'}
            </button>
          </form>
        </div>

        {/* ── Lists ──────────────────────────────────────────────────────────── */}
        <div>
          {/* Totals summary */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'אישי', value: totalPersonal, color: 'oklch(0.65 0.18 250)' },
              { label: 'משותף (חלקי)', value: totalSharedMy, color: 'oklch(0.65 0.12 310)' },
              { label: 'סה"כ', value: totalAll, color: 'oklch(0.72 0.18 55)' },
            ].filter(t => t.value > 0).map(t => (
              <div key={t.label} style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 8, padding: '8px 14px' }}>
                <div style={{ fontSize: 10, color: 'oklch(0.50 0.01 250)', marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.color, direction: 'ltr' }}>{formatCurrency(t.value)}</div>
              </div>
            ))}
          </div>

          {/* ── Sinking fund rows (locked, read-only) ────────────────────────── */}
          {(funds ?? []).length > 0 && (
            <div style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: 'oklch(0.70 0.15 185)', fontWeight: 600 }}>
                <Target size={12} /> קרנות שנתיות — הפרשה חודשית
                <span style={{ fontWeight: 400, color: 'oklch(0.50 0.01 250)', marginRight: 4 }}>(נעולות — לשינוי עבור לעמוד הקרנות)</span>
              </div>
              {(funds ?? []).map(fund => (
                <div key={fund.id} style={{ ...S.row, opacity: 0.85 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Lock size={11} style={{ color: 'oklch(0.70 0.15 185)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'oklch(0.80 0.01 250)' }}>{fund.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, direction: 'ltr', color: 'oklch(0.70 0.15 185)' }}>
                    {formatCurrency(fund.monthly_allocation)}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, fontSize: 12, color: 'oklch(0.60 0.01 250)' }}>
                <span>סה&quot;כ קרנות חודשי</span>
                <span style={{ direction: 'ltr', fontWeight: 600, color: 'oklch(0.70 0.15 185)' }}>{formatCurrency(totalSinking)}</span>
              </div>
            </div>
          )}

          {/* ── Personal expenses ─────────────────────────────────────────────── */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                <User size={12} style={{ color: 'oklch(0.65 0.18 250)' }} /> הוצאות אישיות
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, direction: 'ltr', color: 'oklch(0.65 0.18 250)' }}>{formatCurrency(totalPersonal)}</span>
            </div>
            {!(personalExp?.length)
              ? <div style={{ fontSize: 12, color: 'oklch(0.45 0.01 250)', textAlign: 'center', padding: '16px 0' }}>אין הוצאות אישיות</div>
              : personalExp.map(e => {
                const itemId = personalItemId(e.category_id, e.description ?? '')
                const locked = recurringPersonal.isLocked(itemId)
                const catName = (e.budget_categories as BudgetCategory)?.name ?? 'כללי'
                return (
                  <div key={e.id} style={S.row}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{e.description || catName}</div>
                      {e.description && <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)' }}>{catName}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, direction: 'ltr' }}>{formatCurrency(e.amount)}</span>
                      <button onClick={() => toggleLockPersonal(e)}
                        title={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                        style={{ ...S.iconBtn, color: locked ? 'oklch(0.70 0.15 185)' : 'oklch(0.35 0.01 250)' }}>
                        {locked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                      <button onClick={() => handleDeletePersonal(e)} aria-label="מחק הוצאה" style={{ ...S.iconBtn, color: 'oklch(0.40 0.01 250)' }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )
              })
            }
          </div>

          {/* ── Shared expenses ────────────────────────────────────────────────── */}
          <div style={{ ...S.card, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                <Users size={12} style={{ color: 'oklch(0.65 0.12 310)' }} /> הוצאות משותפות
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, direction: 'ltr', color: 'oklch(0.65 0.12 310)' }}>{formatCurrency(totalSharedMy)}</span>
            </div>
            <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', marginBottom: 10 }}>
              הסכום שמוצג הוא חלקך (50%) — ניתן לנעול הוצאות קבועות
            </div>
            {!(sharedExp?.length)
              ? <div style={{ fontSize: 12, color: 'oklch(0.45 0.01 250)', textAlign: 'center', padding: '16px 0' }}>אין הוצאות משותפות</div>
              : sharedExp.map(e => {
                const myAmt = e.my_share ?? e.total_amount / 2
                const locked = recurringShared.isLocked(e.category)
                const label = e.notes || e.category
                return (
                  <div key={e.id} style={S.row}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', direction: 'ltr', marginTop: 1 }}>
                        סה&quot;כ {formatCurrency(e.total_amount)} · חלקי {formatCurrency(myAmt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, direction: 'ltr', color: 'oklch(0.65 0.12 310)' }}>{formatCurrency(myAmt)}</span>
                      <button onClick={() => toggleLockShared(e)}
                        title={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                        style={{ ...S.iconBtn, color: locked ? 'oklch(0.70 0.15 185)' : 'oklch(0.35 0.01 250)' }}>
                        {locked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                      <button onClick={() => handleDeleteShared(e.id)} aria-label="מחק הוצאה" style={{ ...S.iconBtn, color: 'oklch(0.40 0.01 250)' }}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
      </div>
    </div>
  )
}
