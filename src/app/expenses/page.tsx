'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { usePersonalExpenses, useBudgetCategories, useAddExpense, useDeleteExpense, useUpdateExpense, useAddBudgetCategory, useCategoryRules, useSaveCategoryRule, findMatchingRule, useFamilyPersonalExpenses } from '@/lib/queries/useExpenses'
import { useSharedExpenses, useUpsertSharedExpense, useDeleteSharedExpense, useUpdateSharedExpense } from '@/lib/queries/useShared'
import { useSinkingFunds, useAddSinkingTransaction, useAddSinkingFund } from '@/lib/queries/useSinking'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { parseExpenseExcelDetailed, createExpenseTemplate } from '@/lib/excel-import'
import type { ParseResult } from '@/lib/excel-import'
import { useRecurringPersonal, useRecurringShared, personalItemId } from '@/lib/hooks/useRecurring'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { toast } from 'sonner'
import { Receipt, Upload, Download, FileSpreadsheet, Trash2 } from 'lucide-react'
import type { RawExpenseRow } from '@/lib/excel-import'
import type { BudgetCategory, SharedCategory } from '@/lib/types'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'
import { TableSkeleton } from '@/components/ui/Skeleton'

// Extracted components
import { ExpenseForm, type ExpType } from '@/components/expenses/ExpenseForm'
import { ExpenseStats } from '@/components/expenses/ExpenseStats'
import { PersonalExpenseList } from '@/components/expenses/PersonalExpenseList'
import { SharedExpenseList, sharedCatLabel } from '@/components/expenses/SharedExpenseList'
import { ExcelImportModal, type ImportRow } from '@/components/expenses/ExcelImportModal'
import { FamilyExpensesView } from '@/components/expenses/FamilyExpensesView'

export default function ExpensesPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const fileRef = useRef<HTMLInputElement>(null)
  const { familyId, members } = useFamilyContext()
  const splitFrac = useSplitFraction(user?.id)
  const { viewMode } = useFamilyView()
  const familyMemberIds = useMemo(() => members.map(m => m.user_id), [members])
  const { data: familyExpenses } = useFamilyPersonalExpenses(selectedPeriodId, familyMemberIds, viewMode !== 'personal')

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
  const { data: categories }  = useBudgetCategories(user?.id)
  const { data: funds }       = useSinkingFunds(user?.id)
  const addExpense    = useAddExpense()
  const deleteExpense = useDeleteExpense()
  const upsertShared  = useUpsertSharedExpense()
  const deleteShared  = useDeleteSharedExpense()
  const updateExpense = useUpdateExpense()
  const updateShared  = useUpdateSharedExpense()
  const addSinkingTx  = useAddSinkingTransaction()
  const addFund       = useAddSinkingFund()
  const addCategory   = useAddBudgetCategory()
  const { data: categoryRules } = useCategoryRules(user?.id)
  const saveCategoryRule = useSaveCategoryRule()
  const recurringPersonal = useRecurringPersonal(user?.id)
  const recurringShared   = useRecurringShared(user?.id)
  const queryClient = useQueryClient()
  const confirm = useConfirmDialog()

  // Excel import state (kept here because import save needs all the mutation hooks)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null)
  const [importTotal, setImportTotal] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Reset expenses dialog state
  const [showResetDialog, setShowResetDialog] = useState(false)

  // Inline text input modal (replaces native prompt)
  const [textInputModal, setTextInputModal] = useState<{ title: string; resolve: (value: string | null) => void } | null>(null)
  const [textInputValue, setTextInputValue] = useState('')

  function showTextInput(title: string): Promise<string | null> {
    return new Promise(resolve => {
      setTextInputValue('')
      setTextInputModal({ title, resolve })
    })
  }

  // Sort personal expenses by amount descending
  const sortedPersonalExp = useMemo(() => {
    if (!personalExp?.length) return []
    return [...personalExp].sort((a, b) => b.amount - a.amount)
  }, [personalExp])

  // Sort shared expenses by my share descending
  const sortedSharedExp = useMemo(() => {
    if (!sharedExp?.length) return []
    return [...sharedExp].sort((a, b) => {
      const myA = a.my_share ?? a.total_amount * splitFrac
      const myB = b.my_share ?? b.total_amount * splitFrac
      return myB - myA
    })
  }, [sharedExp, splitFrac])

  if (loading || !user) return <TableSkeleton rows={6} />

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const totalPersonal  = (personalExp ?? []).reduce((s, e) => s + e.amount, 0)
  const totalSharedMy  = (sharedExp ?? []).reduce((s, e) => s + (e.my_share ?? e.total_amount * splitFrac), 0)
  const totalAll       = totalPersonal + totalSharedMy

  // ── Add expense ─────────────────────────────────────────────────────────────
  async function handleAdd(data: {
    expType: ExpType
    categoryId: string
    customCat: string
    useCustomCat: boolean
    sharedLabel: string
    sharedCategory: string
    amount: string
    detailMode: boolean
    description: string
  }) {
    if (!user || !selectedPeriodId) return
    if (!data.amount || Number(data.amount) <= 0) { toast.error('הזן סכום'); return }
    const amt = Number(data.amount)
    try {
      if (data.expType === 'personal') {
        const catId = data.useCustomCat ? null : (data.categoryId ? Number(data.categoryId) : null)
        if (!catId && !data.customCat.trim()) { toast.error('בחר קטגוריה'); return }
        const resolvedCatId = catId ?? categories?.[0]?.id ?? 1
        const desc = data.detailMode ? data.description.trim() : (data.useCustomCat ? data.customCat.trim() : (categories?.find(c => c.id === resolvedCatId)?.name ?? ''))
        await addExpense.mutateAsync({
          period_id: selectedPeriodId, user_id: user.id,
          category_id: resolvedCatId,
          amount: amt,
          description: desc,
          expense_date: new Date().toISOString().split('T')[0],
        })
      } else {
        if (!familyId) { toast.error('לא משויך למשפחה'); return }
        const resolvedCategory = data.useCustomCat ? 'misc' : (data.sharedCategory || '')
        if (!resolvedCategory) { toast.error('בחר קטגוריה'); return }
        const label = data.useCustomCat
          ? (data.sharedLabel.trim() || 'הוצאה משותפת')
          : (data.sharedLabel.trim() || sharedCatLabel(data.sharedCategory) || 'הוצאה משותפת')
        await upsertShared.mutateAsync({ period_id: selectedPeriodId, category: resolvedCategory as SharedCategory, total_amount: amt, notes: label, family_id: familyId })
      }
      toast.success('הוצאה נוספה')
    } catch (e) { console.error('Add expense:', e); toast.error('שגיאה בהוספה') }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDeletePersonal(exp: { id: number; category_id: number; amount: number; description?: string }) {
    if (!(await confirm({ message: 'למחוק את ההוצאה?' }))) return
    try {
      await deleteExpense.mutateAsync({ id: exp.id, period_id: selectedPeriodId!, user_id: user!.id })
      toast.success('נמחק')
    } catch (e) { console.error('Delete personal expense:', e); toast.error('שגיאה במחיקה') }
  }

  async function handleDeleteShared(id: number) {
    if (!(await confirm({ message: 'למחוק את ההוצאה?' }))) return
    try {
      await deleteShared.mutateAsync({ id, period_id: selectedPeriodId!, family_id: familyId })
      toast.success('נמחק')
    } catch (e) { console.error('Delete shared expense:', e); toast.error('שגיאה במחיקה') }
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────
  async function handleEditPersonal(data: { id: number; category_id: number; amount: number; description: string }) {
    if (!user || !selectedPeriodId) return
    await updateExpense.mutateAsync({ id: data.id, period_id: selectedPeriodId, user_id: user.id, category_id: data.category_id, amount: data.amount, description: data.description })
    toast.success('הוצאה עודכנה')
  }

  async function handleEditShared(data: { id: number; category: string; total_amount: number; notes: string }) {
    if (!selectedPeriodId) return
    await updateShared.mutateAsync({ id: data.id, period_id: selectedPeriodId, category: data.category, total_amount: data.total_amount, notes: data.notes })
    toast.success('הוצאה עודכנה')
  }

  // ── Excel ───────────────────────────────────────────────────────────────────
  async function processExcelFile(file: File) {
    try {
      const result: ParseResult = await parseExpenseExcelDetailed(file)
      const r = result.rows
      const cats = categories ?? []
      const rules = categoryRules ?? []
      let autoMatched = 0
      const mapped = r.map(row => {
        let categoryId = ''
        if (row.category) {
          const catName = row.category.trim()
          const match = cats.find(c => c.name === catName)
            || cats.find(c => c.name.trim().toLowerCase() === catName.toLowerCase())
            || cats.find(c => c.name.includes(catName) || catName.includes(c.name))
          if (match) categoryId = String(match.id)
          else categoryId = `__new__${catName}`
        }
        if (!categoryId && row.description && rules.length > 0) {
          const rule = findMatchingRule(row.description, rules)
          if (rule) {
            categoryId = String(rule.category_id)
            autoMatched++
          }
        }
        return { ...row, categoryId }
      })
      const existingFundNames = (funds ?? []).map(f => f.name)
      mapped.forEach(row => {
        if (row.fund_name && !existingFundNames.includes(row.fund_name)) {
          row.fund_name = `__new_fund__${row.fund_name}`
        }
      })
      setImportRows(mapped); setShowImport(true)
      setDetectedFormat(result.detectedFormat?.label ?? null)
      setImportTotal(result.totalAmount)
      const sharedCount = mapped.filter(r => r.is_shared).length
      const matched = mapped.filter(r => r.categoryId && !r.categoryId.startsWith('__new__')).length
      const newCats = new Set(mapped.filter(r => r.categoryId.startsWith('__new__')).map(r => r.category)).size
      const newFunds = new Set(mapped.filter(r => r.fund_name?.startsWith('__new_fund__')).map(r => r.fund_name!.replace('__new_fund__', ''))).size
      let msg = `נטענו ${r.length} שורות`
      if (result.detectedFormat) msg += ` · זוהה: ${result.detectedFormat.label}`
      if (sharedCount > 0) msg += ` · ${sharedCount} משותפות`
      if (matched > 0) msg += ` · ${matched} קטגוריות זוהו`
      if (autoMatched > 0) msg += ` · ${autoMatched} זוהו אוטומטית`
      if (newCats > 0) msg += ` · ${newCats} קטגוריות חדשות ייווצרו`
      if (newFunds > 0) msg += ` · ${newFunds} קרנות חדשות ייווצרו`
      toast.success(msg)
    } catch (e) { console.error('Read Excel file:', e); toast.error('שגיאה בקריאת הקובץ') }
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    await processExcelFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && /\.(xlsx|xls|csv)$/i.test(file.name)) {
      processExcelFile(file)
    } else {
      toast.error('קובץ לא נתמך — השתמש ב-xlsx, xls או csv')
    }
  }

  async function handleExportExcel() {
    if (!personalExp && !sharedExp) { toast.info('אין הוצאות לייצוא'); return }
    try {
      const XLSX = await import('xlsx')
      const rows: Record<string, string | number>[] = []
      for (const e of personalExp ?? []) {
        const catName = (e.budget_categories as BudgetCategory)?.name ?? 'כללי'
        rows.push({ 'תאריך': e.expense_date ?? '', 'תיאור': e.description ?? '', 'סכום': e.amount, 'קטגוריה': catName, 'סוג': 'אישי' })
      }
      for (const e of sharedExp ?? []) {
        const label = e.notes || sharedCatLabel(e.category)
        rows.push({ 'תאריך': '', 'תיאור': label, 'סכום': e.total_amount, 'קטגוריה': sharedCatLabel(e.category), 'סוג': 'משותף' })
      }
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 22 }, { wch: 12 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'הוצאות')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `הוצאות_${selectedPeriod?.label ?? 'export'}.xlsx`; a.click()
      URL.revokeObjectURL(url)
      toast.success('הקובץ הורד')
    } catch (e) { console.error('Export expenses:', e); toast.error('שגיאה בייצוא') }
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
    if (!valid.length) { toast.error('אין שורות עם קטגוריה וסכום'); setImporting(false); return }
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
          const existing = (categories ?? []).find(c => c.name.includes(newCatNames[i]))
          if (existing) createdCatMap[newCatNames[i]] = existing.id
        }
      }

      // Auto-create new sinking funds from Excel
      const newFundNames = [...new Set(valid.filter(r => r.fund_name?.startsWith('__new_fund__')).map(r => r.fund_name!.replace('__new_fund__', '')))]
      const createdFundMap: Record<string, number> = {}
      for (const fundName of newFundNames) {
        try {
          const created = await addFund.mutateAsync({
            name: fundName, monthly_allocation: 0, user_id: user.id, yearly_target: 0, is_shared: false,
          })
          if (created?.id) createdFundMap[fundName] = created.id
        } catch {
          const existing = (funds ?? []).find(f => f.name === fundName)
          if (existing) createdFundMap[fundName] = existing.id
        }
      }

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
          const rawFundName = r.fund_name?.startsWith('__new_fund__') ? r.fund_name.replace('__new_fund__', '') : r.fund_name
          if (rawFundName) {
            const fund = (funds ?? []).find(f => f.name === rawFundName)
            const fundId = fund?.id ?? createdFundMap[rawFundName]
            if (fundId) {
              await sb.from('sinking_fund_transactions').insert({
                fund_id: fundId, period_id: selectedPeriodId,
                amount: -r.amount, description: r.description, transaction_date: today,
              })
            }
          }
          if (r.description && resolvedCatId && !isNaN(resolvedCatId)) {
            saveCategoryRule.mutate({
              user_id: user.id,
              merchant_pattern: r.description.trim(),
              category_id: resolvedCatId,
              fund_name: rawFundName || undefined,
            })
          }
          imported++
        } catch {
          failed++
        }
      }
      queryClient.invalidateQueries({ queryKey: ['personal_expenses'] })
      queryClient.invalidateQueries({ queryKey: ['shared_expenses'] })
      queryClient.invalidateQueries({ queryKey: ['all_sinking_transactions'] })
      if (newFundNames.length) queryClient.invalidateQueries({ queryKey: ['sinking_funds'] })

      const newCount = newCatNames.length
      const newFundCount = newFundNames.length
      let msg = `יובאו ${imported} הוצאות`
      if (newCount) msg += ` · ${newCount} קטגוריות חדשות`
      if (newFundCount) msg += ` · ${newFundCount} קרנות חדשות`
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
    const wasLocked = recurringPersonal.isLocked(lockId)
    recurringPersonal.toggle({ id: lockId, category_id: exp.category_id, category_name: catName, amount: exp.amount, description: desc })
    toast.success(wasLocked ? `בוטל נעילה: ${desc || catName}` : `נעול: ${desc || catName}`)
  }

  function toggleLockShared(exp: { id: number; category: string; total_amount: number; notes?: string | null }) {
    const label = exp.notes || sharedCatLabel(exp.category)
    if (recurringShared.isLocked(exp.category)) {
      recurringShared.unlock(exp.category)
      toast.success(`בוטל נעילה: ${label}`)
    } else {
      recurringShared.lock({ category: exp.category, label, amount: exp.total_amount })
      toast.success(`נעול: ${label}`)
    }
  }

  function handleResetExpenses() {
    if (!user || !selectedPeriodId) return
    const hasPersonal = (personalExp ?? []).length > 0
    const hasShared = (sharedExp ?? []).length > 0
    if (!hasPersonal && !hasShared) { toast.info('אין הוצאות למחיקה'); return }

    if (hasPersonal && hasShared) {
      setShowResetDialog(true)
    } else if (hasShared && !hasPersonal) {
      doResetExpenses('shared')
    } else {
      doResetExpenses('personal')
    }
  }

  async function doResetExpenses(resetTarget: 'personal' | 'shared' | 'both') {
    if (!user || !selectedPeriodId) return
    setShowResetDialog(false)
    const labels = { personal: 'אישיות', shared: 'משותפות', both: 'אישיות + משותפות' }
    if (!(await confirm({ message: `למחוק את כל ההוצאות ה${labels[resetTarget]} של המחזור הנוכחי?` }))) return

    try {
      const sb = createClient()
      if (resetTarget === 'personal' || resetTarget === 'both') {
        await sb.from('personal_expenses').delete().eq('period_id', selectedPeriodId).eq('user_id', user.id)
        queryClient.invalidateQueries({ queryKey: ['personal_expenses', selectedPeriodId, user.id] })
      }
      if ((resetTarget === 'shared' || resetTarget === 'both') && familyId) {
        await sb.from('shared_expenses').delete().eq('period_id', selectedPeriodId).eq('family_id', familyId)
        queryClient.invalidateQueries({ queryKey: ['shared_expenses', selectedPeriodId, familyId] })
      }
      toast.success(`ההוצאות ה${labels[resetTarget]} אופסו`)
    } catch (e) { console.error('Reset expenses:', e); toast.error('שגיאה באיפוס') }
  }

  const isPending = addExpense.isPending || upsertShared.isPending

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={18} className="text-[var(--accent-orange)]" />
            <h1 className="text-xl font-bold tracking-tight">הוצאות</h1>
            <PageInfo {...PAGE_TIPS.expenses} />
          </div>
          <p className="text-muted-foreground text-[13px]">{selectedPeriod?.label ?? '...'}</p>
        </div>
        <div className="flex items-center gap-3">
        <div className="flex gap-2">
          <button onClick={handleResetExpenses} className="flex items-center gap-1.5 bg-transparent border border-border rounded-lg px-3.5 py-[7px] text-muted-foreground text-xs font-medium cursor-pointer">
            <Trash2 size={13} /> אפס הוצאות
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 bg-secondary border border-[var(--border-light)] rounded-lg px-3 py-[7px] text-[var(--text-body)] text-xs cursor-pointer">
            <Download size={13} /> הורד לאקסל
          </button>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 bg-secondary border border-[var(--border-light)] rounded-lg px-3 py-[7px] text-[var(--text-body)] text-xs cursor-pointer">
            <FileSpreadsheet size={13} /> תבנית
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-hover flex items-center gap-1.5 bg-primary border-none rounded-lg px-3 py-[7px] text-primary-foreground text-xs font-semibold cursor-pointer">
            <Upload size={13} /> Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelUpload} />
        </div>
        </div>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* ── Family View ──────────────────────────────────────────────────── */}
      {viewMode !== 'personal' && (
        <FamilyExpensesView
          familyExpenses={familyExpenses}
          sharedExp={sharedExp}
          splitFrac={splitFrac}
          formatCurrency={formatCurrency}
        />
      )}

      {/* ── Personal View ────────────────────────────────────────────────── */}
      {viewMode === 'personal' && <>{/* Personal View */}

      <ExcelImportModal
        importRows={importRows}
        setImportRows={setImportRows}
        showImport={showImport}
        setShowImport={setShowImport}
        importing={importing}
        detectedFormat={detectedFormat}
        importTotal={importTotal}
        categories={categories}
        funds={funds}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        fileRef={fileRef}
        onDrop={handleDrop}
        onImportSave={handleImportSave}
        showTextInput={showTextInput}
      />

      <div className="grid-2 items-start">

        {/* ── Add form ───────────────────────────────────────────────────────── */}
        <ExpenseForm
          categories={categories}
          funds={funds}
          splitFrac={splitFrac}
          isPending={isPending}
          onAdd={handleAdd}
        />

        {/* ── Lists ──────────────────────────────────────────────────────────── */}
        <div>
          <ExpenseStats
            totalPersonal={totalPersonal}
            totalSharedMy={totalSharedMy}
            totalAll={totalAll}
          />

          {/* ── Personal + Shared side by side ──────────────────────────────── */}
          <div className="grid-2 items-start">
            <PersonalExpenseList
              expenses={sortedPersonalExp}
              categories={categories}
              totalPersonal={totalPersonal}
              isLocked={recurringPersonal.isLocked}
              getItemId={personalItemId}
              onEdit={handleEditPersonal}
              onDelete={handleDeletePersonal}
              onToggleLock={toggleLockPersonal}
            />

            <SharedExpenseList
              expenses={sortedSharedExp}
              splitFrac={splitFrac}
              totalSharedMy={totalSharedMy}
              isLocked={recurringShared.isLocked}
              onEdit={handleEditShared}
              onDelete={handleDeleteShared}
              onToggleLock={toggleLockShared}
            />
          </div>{/* close grid-2 */}
        </div>
      </div>

      </>}

      {/* ── Reset Expenses Dialog ─────────────────────────────────────────── */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-xl p-6 w-[340px]">
            <h3 className="text-base font-semibold mb-4">מה ברצונך למחוק?</h3>
            <div className="flex flex-col gap-2">
              <button onClick={() => doResetExpenses('personal')} className="bg-secondary border border-border rounded-lg py-2.5 text-[13px] font-medium cursor-pointer text-inherit hover:bg-[var(--bg-hover)]">
                רק הוצאות אישיות
              </button>
              <button onClick={() => doResetExpenses('shared')} className="bg-secondary border border-border rounded-lg py-2.5 text-[13px] font-medium cursor-pointer text-inherit hover:bg-[var(--bg-hover)]">
                רק הוצאות משותפות
              </button>
              <button onClick={() => doResetExpenses('both')} className="bg-[var(--c-red-0-20)] border border-[var(--c-red-0-32)] rounded-lg py-2.5 text-[13px] font-semibold cursor-pointer text-[var(--c-red-0-75)] hover:bg-[var(--c-red-0-24)]">
                הכל — אישיות + משותפות
              </button>
              <button onClick={() => setShowResetDialog(false)} className="bg-transparent border border-border rounded-lg py-2.5 text-[13px] font-medium cursor-pointer text-muted-foreground">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Text Input Modal (replaces native prompt) ────────────────────── */}
      {textInputModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-xl p-6 w-[340px]">
            <h3 className="text-base font-semibold mb-3">{textInputModal.title}</h3>
            <input
              type="text"
              value={textInputValue}
              onChange={e => setTextInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { textInputModal.resolve(textInputValue); setTextInputModal(null) }
                if (e.key === 'Escape') { textInputModal.resolve(null); setTextInputModal(null) }
              }}
              autoFocus
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-inherit text-sm mb-4 outline-none"
              placeholder="הקלד כאן..."
            />
            <div className="flex gap-2">
              <button
                onClick={() => { textInputModal.resolve(textInputValue); setTextInputModal(null) }}
                disabled={!textInputValue.trim()}
                className="flex-1 bg-primary border-none rounded-lg py-2 text-primary-foreground font-semibold text-[13px] cursor-pointer disabled:opacity-40"
              >
                אישור
              </button>
              <button
                onClick={() => { textInputModal.resolve(null); setTextInputModal(null) }}
                className="bg-secondary border border-border rounded-lg px-4 py-2 text-inherit text-[13px] cursor-pointer"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
