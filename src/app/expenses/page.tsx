'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { usePersonalExpenses, useBudgetCategories, useAddExpense, useDeleteExpense, useAddBudgetCategory, useCategoryRules, useSaveCategoryRule, findMatchingRule } from '@/lib/queries/useExpenses'
import { useSharedExpenses, useUpsertSharedExpense, useDeleteSharedExpense } from '@/lib/queries/useShared'
import { useSinkingFunds, useAddSinkingTransaction } from '@/lib/queries/useSinking'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { parseExpenseExcel, createExpenseTemplate } from '@/lib/excel-import'
import { useRecurringPersonal, useRecurringShared, personalItemId } from '@/lib/hooks/useRecurring'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useMemo } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import { Receipt, Upload, Download, Plus, X, FileSpreadsheet, User, Users, Lock, Unlock, Target, Trash2, Inbox } from 'lucide-react'
import type { RawExpenseRow } from '@/lib/excel-import'
import type { BudgetCategory, SharedCategory } from '@/lib/types'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'

type ExpType = 'personal' | 'shared'

const SHARED_CATEGORIES: { value: string; label: string }[] = [
  { value: 'rent', label: 'שכירות' },
  { value: 'property_tax', label: 'ארנונה' },
  { value: 'electricity', label: 'חשמל' },
  { value: 'water_gas', label: 'מים+גז' },
  { value: 'building_committee', label: 'ועד בית' },
  { value: 'internet', label: 'אינטרנט' },
  { value: 'home_insurance', label: 'ביטוח דירה' },
  { value: 'netflix', label: 'נטפליקס' },
  { value: 'spotify', label: 'ספוטיפיי' },
  { value: 'groceries', label: 'מכולת' },
  { value: 'misc', label: 'שונות' },
]

export default function ExpensesPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const fileRef = useRef<HTMLInputElement>(null)
  const { familyId } = useFamilyContext()
  const splitFrac = useSplitFraction(user?.id)
  const splitPctLabel = Math.round(splitFrac * 100)

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])
  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const selectedYear = useMemo(() => {
    if (!periods || !selectedPeriodId) return undefined
    return periods.find(p => p.id === selectedPeriodId)?.year_number
  }, [periods, selectedPeriodId])

  const { data: personalExp } = usePersonalExpenses(selectedPeriodId, user?.id)
  const { data: sharedExp }   = useSharedExpenses(selectedPeriodId, familyId)
  const { data: categories }  = useBudgetCategories(user?.id, selectedYear)
  const { data: funds }       = useSinkingFunds(user?.id)
  const addExpense    = useAddExpense()
  const deleteExpense = useDeleteExpense()
  const upsertShared  = useUpsertSharedExpense()
  const deleteShared  = useDeleteSharedExpense()
  const addSinkingTx  = useAddSinkingTransaction()
  const addCategory   = useAddBudgetCategory()
  const { data: categoryRules } = useCategoryRules(user?.id)
  const saveCategoryRule = useSaveCategoryRule()
  const recurringPersonal = useRecurringPersonal(user?.id)
  const recurringShared   = useRecurringShared(user?.id)
  const queryClient = useQueryClient()
  const confirm = useConfirmDialog()

  // ── Add form state ──────────────────────────────────────────────────────────
  const [expType, setExpType]         = useState<ExpType>('personal')
  const [categoryId, setCategoryId]   = useState('')       // from dropdown
  const [customCat, setCustomCat]     = useState('')       // free-text fallback
  const [useCustomCat, setUseCustom]  = useState(false)   // toggle dropdown vs text
  const [sharedLabel, setSharedLabel] = useState('')
  const [sharedCategory, setSharedCategory] = useState('')
  const [amount, setAmount]           = useState('')

  // Excel import
  const [importRows, setImportRows] = useState<(RawExpenseRow & { categoryId: string })[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)

  if (loading || !user) return <div className="loading-pulse p-10 text-center text-muted-foreground">טוען...</div>

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const totalPersonal  = (personalExp ?? []).reduce((s, e) => s + e.amount, 0)
  const totalSharedMy  = (sharedExp ?? []).reduce((s, e) => s + (e.my_share ?? e.total_amount * splitFrac), 0)
  const totalSinking   = (funds ?? []).reduce((s, f) => s + f.monthly_allocation, 0)
  const totalAll       = totalPersonal + totalSharedMy

  // ── Add expense ─────────────────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedPeriodId) return
    if (!amount || Number(amount) <= 0) { toast.error('הזן סכום'); return }
    const amt = Number(amount)
    try {
      if (expType === 'personal') {
        const catId = useCustomCat ? null : (categoryId ? Number(categoryId) : null)
        if (!catId && !customCat.trim()) { toast.error('בחר קטגוריה'); return }
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
        if (!familyId) { toast.error('לא משויך למשפחה'); return }
        const resolvedCategory = useCustomCat ? 'misc' : (sharedCategory || '')
        if (!resolvedCategory) { toast.error('בחר קטגוריה'); return }
        const label = useCustomCat
          ? (sharedLabel.trim() || 'הוצאה משותפת')
          : (sharedLabel.trim() || SHARED_CATEGORIES.find(c => c.value === sharedCategory)?.label || 'הוצאה משותפת')
        await upsertShared.mutateAsync({ period_id: selectedPeriodId, category: resolvedCategory as SharedCategory, total_amount: amt, notes: label, family_id: familyId })
      }
      setAmount(''); setSharedLabel(''); setCustomCat(''); setCategoryId(''); setSharedCategory('')
      toast.success('הוצאה נוספה')
    } catch { toast.error('שגיאה בהוספה') }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDeletePersonal(exp: { id: number; category_id: number; amount: number; description?: string }) {
    if (!(await confirm({ message: 'למחוק את ההוצאה?' }))) return
    await deleteExpense.mutateAsync({ id: exp.id, period_id: selectedPeriodId!, user_id: user!.id })
    toast.success('נמחק')
  }

  async function handleDeleteShared(id: number) {
    if (!(await confirm({ message: 'למחוק את ההוצאה?' }))) return
    await deleteShared.mutateAsync({ id, period_id: selectedPeriodId! })
    toast.success('נמחק')
  }

  // ── Excel ───────────────────────────────────────────────────────────────────
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const r = await parseExpenseExcel(file)
      const cats = categories ?? []
      const rules = categoryRules ?? []
      let autoMatched = 0
      const mapped = r.map(row => {
        // Auto-match category name from Excel to existing budget categories
        let categoryId = ''
        if (row.category) {
          const catName = row.category.trim()
          const match = cats.find(c => c.name === catName)
            || cats.find(c => c.name.trim().toLowerCase() === catName.toLowerCase())
            || cats.find(c => c.name.includes(catName) || catName.includes(c.name))
          if (match) categoryId = String(match.id)
          else categoryId = `__new__${catName}`
        }
        // If no category from Excel — try auto-categorize by merchant name rules
        if (!categoryId && row.description && rules.length > 0) {
          const rule = findMatchingRule(row.description, rules)
          if (rule) {
            categoryId = String(rule.category_id)
            autoMatched++
          }
        }
        return { ...row, categoryId }
      })
      setImportRows(mapped); setShowImport(true)
      const sharedCount = mapped.filter(r => r.is_shared).length
      const matched = mapped.filter(r => r.categoryId && !r.categoryId.startsWith('__new__')).length
      const newCats = new Set(mapped.filter(r => r.categoryId.startsWith('__new__')).map(r => r.category)).size
      let msg = `נטענו ${r.length} שורות`
      if (sharedCount > 0) msg += ` · ${sharedCount} משותפות`
      if (matched > 0) msg += ` · ${matched} קטגוריות זוהו`
      if (autoMatched > 0) msg += ` · ${autoMatched} זוהו אוטומטית`
      if (newCats > 0) msg += ` · ${newCats} קטגוריות חדשות ייווצרו`
      toast.success(msg)
    } catch { toast.error('שגיאה בקריאת הקובץ') }
    e.target.value = ''
  }

  async function downloadTemplate() {
    const blob = await createExpenseTemplate(
      categories?.map(c => c.name) ?? [],
      funds?.map(f => f.name) ?? []
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'תבנית_הוצאות.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportSave() {
    if (!user || !selectedPeriodId || importing) return
    setImporting(true)
    const valid = importRows.filter(r => (r.categoryId || r.category) && r.amount > 0)
    if (!valid.length) { toast.error('אין שורות עם קטגוריה וסכום'); return }
    // Auto-assign __new__ for rows that have category name but no categoryId
    valid.forEach(r => {
      if (!r.categoryId && r.category) r.categoryId = `__new__${r.category.trim()}`
    })
    try {
      const today = new Date().toISOString().split('T')[0]
      const sb = createClient()

      // Auto-create new categories from Excel
      const newCatNames = [...new Set(valid.filter(r => r.categoryId.startsWith('__new__')).map(r => r.categoryId.replace('__new__', '')))]
      const createdCatMap: Record<string, number> = {}
      const maxSort = Math.max(0, ...(categories ?? []).map(c => c.sort_order ?? 0))
      for (let i = 0; i < newCatNames.length; i++) {
        try {
          const created = await addCategory.mutateAsync({
            user_id: user.id, name: newCatNames[i], type: 'variable',
            monthly_target: 0, sort_order: maxSort + i + 1,
          })
          createdCatMap[newCatNames[i]] = created.id
        } catch {
          // Category might already exist — find it
          const existing = (categories ?? []).find(c => c.name.includes(newCatNames[i]))
          if (existing) createdCatMap[newCatNames[i]] = existing.id
        }
      }

      // Save expenses one by one (not Promise.all — avoids one failure killing all)
      let imported = 0
      let failed = 0
      for (const r of valid) {
        try {
          let resolvedCatId: number
          if (r.categoryId.startsWith('__new__')) {
            resolvedCatId = createdCatMap[r.categoryId.replace('__new__', '')]
          } else {
            resolvedCatId = Number(r.categoryId)
          }
          if (!resolvedCatId || isNaN(resolvedCatId)) {
            // Last resort — use first category
            resolvedCatId = categories?.[0]?.id ?? 1
          }

          if (r.is_shared && familyId) {
            await sb.from('shared_expenses').insert({
              period_id: selectedPeriodId, category: 'misc',
              total_amount: r.amount, notes: r.description, family_id: familyId,
            })
          } else {
            await sb.from('personal_expenses').insert({
              period_id: selectedPeriodId, user_id: user.id,
              category_id: resolvedCatId, amount: r.amount,
              description: r.description, expense_date: today,
            })
          }
          // Fund deduction
          if (r.fund_name) {
            const fund = (funds ?? []).find(f => f.name === r.fund_name)
            if (fund) {
              await sb.from('sinking_fund_transactions').insert({
                fund_id: fund.id, period_id: selectedPeriodId,
                amount: -r.amount, description: r.description, transaction_date: today,
              })
            }
          }
          // Save category rule for future auto-categorization
          if (r.description && resolvedCatId && !isNaN(resolvedCatId)) {
            saveCategoryRule.mutate({
              user_id: user.id,
              merchant_pattern: r.description.trim(),
              category_id: resolvedCatId,
              fund_name: r.fund_name || undefined,
            })
          }
          imported++
        } catch {
          failed++
        }
      }
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['personal_expenses'] })
      queryClient.invalidateQueries({ queryKey: ['shared_expenses'] })
      queryClient.invalidateQueries({ queryKey: ['all_sinking_transactions'] })

      const newCount = newCatNames.length
      let msg = `יובאו ${imported} הוצאות`
      if (newCount) msg += ` · ${newCount} קטגוריות חדשות`
      if (failed) msg += ` · ${failed} נכשלו`
      toast.success(msg)
      setShowImport(false); setImportRows([])
    } catch (err) {
      console.error('Import failed:', err)
      const msg = err instanceof Error ? err.message : 'שגיאה בייבוא'
      toast.error(msg)
    }
    setImporting(false)
  }

  // ── Lock helpers ────────────────────────────────────────────────────────────
  function toggleLockPersonal(exp: { id: number; category_id: number; amount: number; description?: string }) {
    const catName = (categories ?? []).find(c => c.id === exp.category_id)?.name ?? ''
    const desc = exp.description ?? ''
    const lockId = personalItemId(exp.category_id, desc, exp.id)
    recurringPersonal.toggle({ id: lockId, category_id: exp.category_id, category_name: catName, amount: exp.amount, description: desc })
    toast.success(recurringPersonal.isLocked(lockId) ? `בוטל נעילה: ${desc || catName}` : `נעול: ${desc || catName}`)
  }

  function toggleLockShared(exp: { id: number; category: string; total_amount: number; notes?: string | null }) {
    const label = exp.notes || exp.category
    if (recurringShared.isLocked(exp.category)) {
      recurringShared.unlock(exp.category)
      toast.success(`בוטל נעילה: ${label}`)
    } else {
      recurringShared.lock({ category: exp.category, label, amount: exp.total_amount })
      toast.success(`נעול: ${label}`)
    }
  }

  async function handleResetExpenses() {
    if (!user || !selectedPeriodId) return
    const hasShared = (sharedExp ?? []).length > 0
    const msg = hasShared
      ? 'למחוק את כל ההוצאות האישיות של המחזור הנוכחי?\n(הוצאות משותפות לא יימחקו — יש למחוק אותן בנפרד)'
      : 'למחוק את כל ההוצאות האישיות של המחזור הנוכחי?'
    if (!(await confirm({ message: msg }))) return
    try {
      const sb = createClient()
      await sb.from('personal_expenses').delete().eq('period_id', selectedPeriodId).eq('user_id', user.id)
      queryClient.invalidateQueries({ queryKey: ['personal_expenses', selectedPeriodId, user.id] })
      toast.success('ההוצאות האישיות אופסו')
      if (hasShared) toast.info('הוצאות משותפות לא נמחקו — ניתן למחוק כל אחת בנפרד')
    } catch { toast.error('שגיאה באיפוס') }
  }

  const isPending = addExpense.isPending || upsertShared.isPending

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={18} className="text-[oklch(0.72_0.18_55)]" />
            <h1 className="text-xl font-bold tracking-tight">הוצאות</h1>
          </div>
          <p className="text-muted-foreground text-[13px]">{selectedPeriod?.label ?? '...'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleResetExpenses} className="flex items-center gap-1.5 bg-transparent border border-border rounded-lg px-3.5 py-[7px] text-muted-foreground text-xs font-medium cursor-pointer">
            <Trash2 size={13} /> אפס הוצאות
          </button>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[7px] text-[oklch(0.75_0.01_250)] text-xs cursor-pointer">
            <Download size={13} /> תבנית
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-hover flex items-center gap-1.5 bg-primary border-none rounded-lg px-3 py-[7px] text-primary-foreground text-xs font-semibold cursor-pointer">
            <Upload size={13} /> Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
        </div>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* ── Excel import preview ────────────────────────────────────────────── */}
      {showImport && (
        <div className="bg-card border border-[oklch(0.65_0.18_250_/_0.4)] rounded-xl p-5 mb-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={14} className="text-primary" />
              <span className="font-semibold text-[13px]">{importRows.length} שורות מ-Excel</span>
            </div>
            <button onClick={() => setShowImport(false)} aria-label="סגור ייבוא" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-2 min-w-9 min-h-9 text-muted-foreground"><X size={14} /></button>
          </div>
          <div className="max-h-80 overflow-y-auto mb-2.5">
            {importRows.map((row, i) => {
              const isAutoMatched = row.categoryId && !row.categoryId.startsWith('__new__') && row.category
              const isNewCat = row.categoryId?.startsWith('__new__')
              return (
                <div key={i} className="grid-import-row py-1.5 border-b border-[oklch(0.20_0.01_250)]">
                  <span className="text-xs text-[oklch(0.80_0.01_250)] overflow-hidden text-ellipsis whitespace-nowrap">{row.description}</span>
                  <span className="text-xs font-semibold ltr text-right text-[oklch(0.72_0.18_55)]">{formatCurrency(row.amount)}</span>
                  {/* Toggle אישי/משותף */}
                  <button
                    onClick={() => setImportRows(p => p.map((r, j) => j === i ? { ...r, is_shared: !r.is_shared } : r))}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold cursor-pointer whitespace-nowrap ${
                      row.is_shared
                        ? 'bg-[oklch(0.22_0.05_295)] border border-[oklch(0.40_0.12_295)] text-[oklch(0.75_0.15_295)]'
                        : 'bg-secondary border border-[oklch(0.28_0.01_250)] text-muted-foreground'
                    }`}
                  >
                    {row.is_shared ? 'משותף' : 'אישי'}
                  </button>
                  {/* קטגוריה — always editable dropdown */}
                  <select
                    value={row.categoryId?.startsWith('__new__') ? '__new__' : (row.categoryId || '')}
                    onChange={e => {
                      const val = e.target.value
                      const text = e.target.selectedOptions[0]?.text || ''
                      setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: val === '__new__' ? `__new__${r.category}` : val, category: val === '__new__' ? r.category : text } : r))
                    }}
                    aria-label="בחר קטגוריה"
                    className={`min-w-[120px] bg-[oklch(0.20_0.01_250)] border-2 rounded-lg px-2 py-1 text-[12px] text-inherit outline-none cursor-pointer appearance-auto ${
                      isAutoMatched ? 'border-[oklch(0.50_0.15_150)] text-[oklch(0.80_0.10_150)]'
                      : isNewCat ? 'border-[oklch(0.50_0.15_55)] text-[oklch(0.80_0.10_55)]'
                      : 'border-[oklch(0.40_0.01_250)] text-[oklch(0.65_0.01_250)]'
                    }`}>
                    {isNewCat && <option value="__new__">{row.category} (חדש)</option>}
                    {!isNewCat && !row.categoryId && <option value="">— בחר קטגוריה —</option>}
                    {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={handleImportSave} disabled={importing} className={`flex-1 border-none rounded-lg py-2 text-primary-foreground font-semibold text-xs ${importing ? 'bg-[oklch(0.40_0.05_250)] cursor-wait' : 'bg-primary cursor-pointer'}`}>
              {importing ? 'מייבא... נא להמתין' : `ייבא ${importRows.filter(r => (r.categoryId || r.category) && r.amount > 0).length}`}
            </button>
            <button onClick={() => { setShowImport(false); setImportRows([]) }} className="bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-xs cursor-pointer outline-none">ביטול</button>
          </div>
        </div>
      )}

      <div className="grid-2 items-start">

        {/* ── Add form ───────────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3.5">
            <Plus size={13} className="text-primary" />
            <h2 className="font-semibold text-[13px] m-0">הוספה ידנית</h2>
          </div>

          {/* Type toggle */}
          <div className="flex gap-1.5 mb-3 bg-secondary rounded-[9px] p-[3px]">
            {(['personal', 'shared'] as ExpType[]).map(t => (
              <button key={t} onClick={() => setExpType(t)} className={`flex-1 flex items-center justify-center gap-1 border-none rounded-[7px] py-1.5 text-xs cursor-pointer ${
                expType === t
                  ? (t === 'personal'
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-[oklch(0.55_0.12_310)] text-primary-foreground font-semibold')
                  : 'bg-transparent text-muted-foreground font-normal'
              }`}>
                {t === 'personal' ? <><User size={11} /> אישית</> : <><Users size={11} /> משותפת</>}
              </button>
            ))}
          </div>

          <form onSubmit={handleAdd} className="flex flex-col gap-2.5">
            {/* Category — identical for both types */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="expense-category" className="text-[11px] text-muted-foreground block font-medium">קטגוריה</label>
                <button type="button" onClick={() => setUseCustom(v => !v)}
                  className="bg-transparent border-none text-[10px] text-[oklch(0.55_0.18_250)] cursor-pointer p-0">
                  {useCustomCat ? '← מרשימה' : '+ ידנית'}
                </button>
              </div>
              {useCustomCat ? (
                <input id="expense-category" type="text" value={expType === 'shared' ? sharedLabel : customCat}
                  onChange={e => expType === 'shared' ? setSharedLabel(e.target.value) : setCustomCat(e.target.value)}
                  placeholder="שם קטגוריה חופשי..."
                  className="w-full bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none" />
              ) : expType === 'shared' ? (
                <select id="expense-category" value={sharedCategory} onChange={e => { setSharedCategory(e.target.value); setSharedLabel(SHARED_CATEGORIES.find(c => c.value === e.target.value)?.label ?? '') }}
                  className="w-full bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none">
                  <option value="">בחר...</option>
                  {SHARED_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              ) : (
                <select id="expense-category" value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  className="w-full bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none">
                  <option value="">בחר...</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="expense-amount" className="text-[11px] text-muted-foreground block mb-1 font-medium">סכום (₪){expType === 'shared' ? ` — כולל (חלקך ${splitPctLabel}%)` : ''}</label>
              <input id="expense-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" required min="0.01" step="0.01"
                className="w-full bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none ltr text-right" />
              {expType === 'shared' && Number(amount) > 0 && (
                <div className="mt-1 text-[11px] text-[oklch(0.65_0.12_310)]">
                  חלקך: {formatCurrency(Number(amount) * splitFrac)}
                </div>
              )}
            </div>

            <button type="submit" disabled={isPending} className={`btn-hover border-none rounded-lg py-2.5 font-semibold text-[13px] cursor-pointer text-primary-foreground ${
              expType === 'personal' ? 'bg-primary' : 'bg-[oklch(0.55_0.12_310)]'
            }`}>
              {isPending ? '...' : '+ הוסף'}
            </button>
          </form>
        </div>

        {/* ── Lists ──────────────────────────────────────────────────────────── */}
        <div>
          {/* Totals summary */}
          <div className="flex gap-3 mb-3 flex-wrap">
            {[
              { label: 'אישי', value: totalPersonal, color: 'text-primary' },
              { label: 'משותף (חלקי)', value: totalSharedMy, color: 'text-[oklch(0.65_0.12_310)]' },
              { label: 'סה"כ', value: totalAll, color: 'text-[oklch(0.72_0.18_55)]' },
            ].filter(t => t.value > 0).map(t => (
              <div key={t.label} className="card-transition bg-card border border-border rounded-lg px-3.5 py-2">
                <div className="text-[10px] text-muted-foreground mb-0.5">{t.label}</div>
                <div className={`text-[15px] font-bold ltr ${t.color}`}>{formatCurrency(t.value)}</div>
              </div>
            ))}
          </div>

          {/* ── Sinking fund rows (locked, read-only) ────────────────────────── */}
          {(funds ?? []).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 mb-3">
              <div className="flex items-center gap-1.5 mb-2.5 text-xs text-[oklch(0.70_0.15_185)] font-semibold">
                <Target size={12} /> קרנות שנתיות — הפרשה חודשית
                <span className="font-normal text-muted-foreground mr-1">(נעולות — לשינוי עבור לעמוד הקרנות)</span>
              </div>
              {(funds ?? []).map(fund => (
                <div key={fund.id} className="flex justify-between items-center py-2.5 border-b border-[oklch(0.20_0.01_250)] opacity-85">
                  <div className="flex items-center gap-2">
                    <Lock size={11} className="text-[oklch(0.70_0.15_185)] shrink-0" />
                    <span className="text-[13px] text-[oklch(0.80_0.01_250)]">{fund.name}</span>
                  </div>
                  <span className="text-[13px] font-semibold ltr text-[oklch(0.70_0.15_185)]">
                    {formatCurrency(fund.monthly_allocation)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1 text-xs text-[oklch(0.60_0.01_250)]">
                <span>סה&quot;כ קרנות חודשי</span>
                <span className="ltr font-semibold text-[oklch(0.70_0.15_185)]">{formatCurrency(totalSinking)}</span>
              </div>
            </div>
          )}

          {/* ── Personal + Shared side by side ──────────────────────────────── */}
          <div className="grid-2 items-start">

          {/* ── Personal expenses ─────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <User size={12} className="text-primary" /> <h2 className="text-[13px] font-semibold m-0 inline">הוצאות אישיות</h2>
              </div>
              <span className="text-sm font-bold ltr text-primary">{formatCurrency(totalPersonal)}</span>
            </div>
            {!(personalExp?.length)
              ? <div className="text-xs text-muted-foreground text-center py-6"><Inbox size={32} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />אין הוצאות אישיות</div>
              : personalExp.map(e => {
                const itemId = personalItemId(e.category_id, e.description ?? '', e.id)
                const locked = recurringPersonal.isLocked(itemId)
                const catName = (e.budget_categories as BudgetCategory)?.name ?? 'כללי'
                return (
                  <div key={e.id} className="flex justify-between items-center py-2.5 border-b border-[oklch(0.20_0.01_250)]">
                    <div>
                      <div className="text-[13px] font-medium">{e.description || catName}</div>
                      {e.description && <div className="text-[11px] text-muted-foreground">{catName}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold ltr">{formatCurrency(e.amount)}</span>
                      <button onClick={() => toggleLockPersonal(e)}
                        title={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                        aria-label={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                        className={`bg-transparent border-none cursor-pointer flex items-center justify-center p-2 min-w-9 min-h-9 ${locked ? 'text-[oklch(0.70_0.15_185)]' : 'text-[oklch(0.35_0.01_250)]'}`}>
                        {locked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                      <button onClick={() => handleDeletePersonal(e)} aria-label="מחק הוצאה" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-2 min-w-9 min-h-9 text-muted-foreground">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )
              })
            }
          </div>

          {/* ── Shared expenses ────────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Users size={12} className="text-[oklch(0.65_0.12_310)]" /> <h2 className="text-[13px] font-semibold m-0 inline">הוצאות משותפות</h2>
              </div>
              <span className="text-sm font-bold ltr text-[oklch(0.65_0.12_310)]">{formatCurrency(totalSharedMy)}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mb-2.5">
              הסכום שמוצג הוא חלקך ({splitPctLabel}%) — ניתן לנעול הוצאות קבועות
            </div>
            {!(sharedExp?.length)
              ? <div className="text-xs text-muted-foreground text-center py-6"><Inbox size={32} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />אין הוצאות משותפות</div>
              : sharedExp.map(e => {
                const myAmt = e.my_share ?? e.total_amount * splitFrac
                const locked = recurringShared.isLocked(e.category)
                const label = e.notes || e.category
                return (
                  <div key={e.id} className="flex justify-between items-center py-2.5 border-b border-[oklch(0.20_0.01_250)]">
                    <div>
                      <div className="text-[13px] font-medium">{label}</div>
                      <div className="text-[11px] text-muted-foreground ltr mt-px">
                        סה&quot;כ {formatCurrency(e.total_amount)} · חלקי {formatCurrency(myAmt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold ltr text-[oklch(0.65_0.12_310)]">{formatCurrency(myAmt)}</span>
                      <button onClick={() => toggleLockShared(e)}
                        title={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                        aria-label={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                        className={`bg-transparent border-none cursor-pointer flex items-center justify-center p-2 min-w-9 min-h-9 ${locked ? 'text-[oklch(0.70_0.15_185)]' : 'text-[oklch(0.35_0.01_250)]'}`}>
                        {locked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                      <button onClick={() => handleDeleteShared(e.id)} aria-label="מחק הוצאה" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-2 min-w-9 min-h-9 text-muted-foreground">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )
              })
            }
          </div>
          </div>{/* close grid-2 */}
        </div>
      </div>
    </div>
  )
}
