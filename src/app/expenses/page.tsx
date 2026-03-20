'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { usePersonalExpenses, useBudgetCategories, useAddExpense, useDeleteExpense, useUpdateExpense, useAddBudgetCategory, useCategoryRules, useSaveCategoryRule, findMatchingRule } from '@/lib/queries/useExpenses'
import { useSharedExpenses, useUpsertSharedExpense, useDeleteSharedExpense, useUpdateSharedExpense } from '@/lib/queries/useShared'
import { useSinkingFunds, useAddSinkingTransaction, useAddSinkingFund } from '@/lib/queries/useSinking'
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
import { Receipt, Upload, Download, Plus, X, FileSpreadsheet, User, Users, Lock, Unlock, Target, Trash2, Inbox, Pencil, Check, ChevronDown, ChevronLeft } from 'lucide-react'
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

  // ── Add form state ──────────────────────────────────────────────────────────
  const [expType, setExpType]         = useState<ExpType>('personal')
  const [categoryId, setCategoryId]   = useState('')       // from dropdown
  const [customCat, setCustomCat]     = useState('')       // free-text fallback
  const [useCustomCat, setUseCustom]  = useState(false)   // toggle dropdown vs text
  const [sharedLabel, setSharedLabel] = useState('')
  const [sharedCategory, setSharedCategory] = useState('')
  const [amount, setAmount]           = useState('')
  const [detailMode, setDetailMode]   = useState(true)  // true = פירוט, false = סה"כ בלבד
  const [description, setDescription] = useState('')     // description for detailed mode

  // Expand/collapse state for category groups
  const [expandedPersonal, setExpandedPersonal] = useState<Set<number>>(new Set())
  const [expandedShared, setExpandedShared]     = useState<Set<string>>(new Set())

  // Edit expense state
  const [editingPersonal, setEditingPersonal] = useState<{ id: number; categoryId: string; amount: string; description: string } | null>(null)
  const [editingShared, setEditingShared] = useState<{ id: number; category: string; totalAmount: string; notes: string } | null>(null)

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

  // ── Group personal expenses by category_id ──────────────────────────────────
  const personalGroups = useMemo(() => {
    if (!personalExp?.length) return []
    const map = new Map<number, { catId: number; catName: string; total: number; expenses: typeof personalExp }>()
    for (const e of personalExp) {
      const catId = e.category_id
      const catName = (e.budget_categories as BudgetCategory)?.name ?? 'כללי'
      if (!map.has(catId)) map.set(catId, { catId, catName, total: 0, expenses: [] })
      const g = map.get(catId)!
      g.total += e.amount
      g.expenses.push(e)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [personalExp])

  // ── Group shared expenses by category ───────────────────────────────────────
  const sharedGroups = useMemo(() => {
    if (!sharedExp?.length) return []
    const map = new Map<string, { category: string; categoryLabel: string; total: number; totalMy: number; expenses: typeof sharedExp }>()
    for (const e of sharedExp) {
      const cat = e.category
      const catLabel = SHARED_CATEGORIES.find(c => c.value === cat)?.label ?? cat
      if (!map.has(cat)) map.set(cat, { category: cat, categoryLabel: catLabel, total: 0, totalMy: 0, expenses: [] })
      const g = map.get(cat)!
      g.total += e.total_amount
      g.totalMy += (e.my_share ?? e.total_amount * splitFrac)
      g.expenses.push(e)
    }
    return [...map.values()].sort((a, b) => b.totalMy - a.totalMy)
  }, [sharedExp, splitFrac])

  // Initialize expanded sets when data changes
  useEffect(() => {
    if (personalGroups.length && expandedPersonal.size === 0) {
      setExpandedPersonal(new Set(personalGroups.map(g => g.catId)))
    }
  }, [personalGroups.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sharedGroups.length && expandedShared.size === 0) {
      setExpandedShared(new Set(sharedGroups.map(g => g.category)))
    }
  }, [sharedGroups.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function togglePersonalGroup(catId: number) {
    setExpandedPersonal(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId); else next.add(catId)
      return next
    })
  }

  function toggleSharedGroup(cat: string) {
    setExpandedShared(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

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
        const desc = detailMode ? description.trim() : (useCustomCat ? customCat.trim() : (categories?.find(c => c.id === resolvedCatId)?.name ?? ''))
        await addExpense.mutateAsync({
          period_id: selectedPeriodId, user_id: user.id,
          category_id: resolvedCatId,
          amount: amt,
          description: desc,
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
      setAmount(''); setSharedLabel(''); setCustomCat(''); setCategoryId(''); setSharedCategory(''); setDescription('')
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
      // Flag new funds: if fund_name doesn't match existing fund names, prefix with __new_fund__
      const existingFundNames = (funds ?? []).map(f => f.name)
      mapped.forEach(row => {
        if (row.fund_name && !existingFundNames.includes(row.fund_name)) {
          row.fund_name = `__new_fund__${row.fund_name}`
        }
      })
      setImportRows(mapped); setShowImport(true)
      const sharedCount = mapped.filter(r => r.is_shared).length
      const matched = mapped.filter(r => r.categoryId && !r.categoryId.startsWith('__new__')).length
      const newCats = new Set(mapped.filter(r => r.categoryId.startsWith('__new__')).map(r => r.category)).size
      const newFunds = new Set(mapped.filter(r => r.fund_name?.startsWith('__new_fund__')).map(r => r.fund_name!.replace('__new_fund__', ''))).size
      let msg = `נטענו ${r.length} שורות`
      if (sharedCount > 0) msg += ` · ${sharedCount} משותפות`
      if (matched > 0) msg += ` · ${matched} קטגוריות זוהו`
      if (autoMatched > 0) msg += ` · ${autoMatched} זוהו אוטומטית`
      if (newCats > 0) msg += ` · ${newCats} קטגוריות חדשות ייווצרו`
      if (newFunds > 0) msg += ` · ${newFunds} קרנות חדשות ייווצרו`
      toast.success(msg)
    } catch { toast.error('שגיאה בקריאת הקובץ') }
    e.target.value = ''
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
        const label = e.notes || SHARED_CATEGORIES.find(c => c.value === e.category)?.label || e.category
        rows.push({ 'תאריך': '', 'תיאור': label, 'סכום': e.total_amount, 'קטגוריה': e.category, 'סוג': 'משותף' })
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
    } catch { toast.error('שגיאה בייצוא') }
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
          // Fund deduction — resolve new fund names
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
          // Save category rule for future auto-categorization
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
      // Invalidate queries
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
    const hasPersonal = (personalExp ?? []).length > 0
    const hasShared = (sharedExp ?? []).length > 0
    if (!hasPersonal && !hasShared) { toast.info('אין הוצאות למחיקה'); return }

    // Build options based on what exists
    let resetTarget: 'personal' | 'shared' | 'both' = 'personal'
    if (hasPersonal && hasShared) {
      const msg = 'מה ברצונך למחוק?\n\n• "אישי" — רק הוצאות אישיות\n• "משותף" — רק הוצאות משותפות\n• "הכל" — אישיות + משותפות'
      const result = prompt(msg, 'הכל')
      if (!result) return
      const trimmed = result.trim()
      if (trimmed === 'אישי' || trimmed.toLowerCase() === 'personal') resetTarget = 'personal'
      else if (trimmed === 'משותף' || trimmed.toLowerCase() === 'shared') resetTarget = 'shared'
      else resetTarget = 'both'
    } else if (hasShared && !hasPersonal) {
      resetTarget = 'shared'
    }

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
        queryClient.invalidateQueries({ queryKey: ['shared_expenses', selectedPeriodId] })
      }
      toast.success(`ההוצאות ה${labels[resetTarget]} אופסו`)
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
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[7px] text-[oklch(0.75_0.01_250)] text-xs cursor-pointer">
            <Download size={13} /> הורד לאקסל
          </button>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[7px] text-[oklch(0.75_0.01_250)] text-xs cursor-pointer">
            <FileSpreadsheet size={13} /> תבנית
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
                  <span className="text-xs font-semibold text-left text-[oklch(0.72_0.18_55)]">{formatCurrency(row.amount)}</span>
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
                  {/* קטגוריה — dropdown + manual input */}
                  <div className="flex items-center gap-1">
                    <select
                      value={row.categoryId?.startsWith('__new__') ? '__new__' : (row.categoryId || '')}
                      onChange={e => {
                        const val = e.target.value
                        if (val === '__manual__') {
                          const name = prompt('שם קטגוריה חדשה:')
                          if (name?.trim()) {
                            setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: `__new__${name.trim()}`, category: name.trim() } : r))
                          }
                        } else {
                          const text = e.target.selectedOptions[0]?.text || ''
                          setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: val === '__new__' ? `__new__${r.category}` : val, category: val === '__new__' ? r.category : text } : r))
                        }
                      }}
                      aria-label="בחר קטגוריה"
                      className={`min-w-[120px] bg-[oklch(0.20_0.01_250)] border-2 rounded-lg px-2 py-1 text-[12px] text-inherit outline-none cursor-pointer appearance-auto ${
                        isAutoMatched ? 'border-[oklch(0.50_0.15_150)] text-[oklch(0.80_0.10_150)]'
                        : isNewCat ? 'border-[oklch(0.50_0.15_55)] text-[oklch(0.80_0.10_55)]'
                        : 'border-[oklch(0.40_0.01_250)] text-[oklch(0.65_0.01_250)]'
                      }`}>
                      {isNewCat && <option value="__new__">{row.category} (חדש)</option>}
                      {!isNewCat && !row.categoryId && <option value="">— בחר —</option>}
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value="__manual__">+ קטגוריה חדשה...</option>
                    </select>
                  </div>
                  {/* קרן — optional fund dropdown */}
                  <select
                    value={row.fund_name?.startsWith('__new_fund__') ? '__new_fund__' : (row.fund_name || '')}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '__manual_fund__') {
                        const name = prompt('שם קרן חדשה:')
                        if (name?.trim()) {
                          setImportRows(p => p.map((r, j) => j === i ? { ...r, fund_name: `__new_fund__${name.trim()}` } : r))
                        }
                      } else {
                        setImportRows(p => p.map((r, j) => j === i ? { ...r, fund_name: val === '__new_fund__' ? r.fund_name : (val || undefined) } : r))
                      }
                    }}
                    aria-label="בחר קרן"
                    className={`min-w-[90px] bg-[oklch(0.20_0.01_250)] border rounded-lg px-1.5 py-1 text-[11px] text-inherit outline-none cursor-pointer appearance-auto ${
                      row.fund_name?.startsWith('__new_fund__') ? 'border-[oklch(0.50_0.15_185)] text-[oklch(0.80_0.10_185)]' : 'border-[oklch(0.30_0.01_250)]'
                    }`}
                  >
                    {row.fund_name?.startsWith('__new_fund__') && <option value="__new_fund__">{row.fund_name.replace('__new_fund__', '')} (חדש)</option>}
                    <option value="">ללא קרן</option>
                    {funds?.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                    <option value="__manual_fund__">+ קרן חדשה...</option>
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
            {/* Detail mode toggle */}
            <div className="flex gap-1.5 bg-secondary rounded-[9px] p-[3px]">
              <button type="button" onClick={() => setDetailMode(true)} className={`flex-1 border-none rounded-[7px] py-1 text-[11px] cursor-pointer ${
                detailMode ? 'bg-[oklch(0.25_0.02_250)] text-[oklch(0.85_0.01_250)] font-semibold' : 'bg-transparent text-muted-foreground font-normal'
              }`}>פירוט</button>
              <button type="button" onClick={() => setDetailMode(false)} className={`flex-1 border-none rounded-[7px] py-1 text-[11px] cursor-pointer ${
                !detailMode ? 'bg-[oklch(0.25_0.02_250)] text-[oklch(0.85_0.01_250)] font-semibold' : 'bg-transparent text-muted-foreground font-normal'
              }`}>סה&quot;כ בלבד</button>
            </div>

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

            {/* Description — only in detail mode */}
            {detailMode && (
              <div>
                <label htmlFor="expense-desc" className="text-[11px] text-muted-foreground block mb-1 font-medium">תיאור</label>
                <input id="expense-desc" type="text" value={expType === 'shared' ? sharedLabel : description}
                  onChange={e => expType === 'shared' ? setSharedLabel(e.target.value) : setDescription(e.target.value)}
                  placeholder={expType === 'shared' ? 'תיאור ההוצאה...' : 'לדוגמה: טיב טעם, WOLT...'}
                  className="w-full bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none" />
              </div>
            )}

            {/* Amount */}
            <div>
              <label htmlFor="expense-amount" className="text-[11px] text-muted-foreground block mb-1 font-medium">סכום (₪){expType === 'shared' ? ` — כולל (חלקך ${splitPctLabel}%)` : ''}</label>
              <input id="expense-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" required min="0.01" step="0.01"
                className="w-full bg-secondary border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none text-left" style={{ direction: 'ltr' }} />
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
                <div className={`text-[15px] font-bold ${t.color}`}>{formatCurrency(t.value)}</div>
              </div>
            ))}
          </div>

          {/* ── Sinking fund rows (locked, read-only) ────────────────────────── */}
          {(funds ?? []).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 mb-3">
              <div className="flex items-center gap-1.5 mb-2.5 text-xs text-[oklch(0.70_0.15_185)] font-semibold">
                <Target size={12} /> קרנות שנתיות — הפרשה חודשית
                <span className="font-normal text-muted-foreground ml-1">(נעולות — לשינוי עבור לעמוד הקרנות)</span>
              </div>
              {(funds ?? []).map(fund => (
                <div key={fund.id} className="flex justify-between items-center py-2.5 border-b border-[oklch(0.20_0.01_250)] opacity-85">
                  <div className="flex items-center gap-2">
                    <Lock size={11} className="text-[oklch(0.70_0.15_185)] shrink-0" />
                    <span className="text-[13px] text-[oklch(0.80_0.01_250)]">{fund.name}</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[oklch(0.70_0.15_185)]">
                    {formatCurrency(fund.monthly_allocation)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1 text-xs text-[oklch(0.60_0.01_250)]">
                <span>סה&quot;כ קרנות חודשי</span>
                <span className="font-semibold text-[oklch(0.70_0.15_185)]">{formatCurrency(totalSinking)}</span>
              </div>
            </div>
          )}

          {/* ── Personal + Shared side by side ──────────────────────────────── */}
          <div className="grid-2 items-start">

          {/* ── Personal expenses (grouped by category) ──────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <User size={12} className="text-primary" /> <h2 className="text-[13px] font-semibold m-0 inline">הוצאות אישיות</h2>
              </div>
              <span className="text-sm font-bold text-primary">{formatCurrency(totalPersonal)}</span>
            </div>
            {!personalGroups.length
              ? <div className="text-xs text-muted-foreground text-center py-6"><Inbox size={32} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />אין הוצאות אישיות</div>
              : personalGroups.map(group => {
                const isOpen = expandedPersonal.has(group.catId)
                return (
                  <div key={group.catId} className="mb-1">
                    {/* Category header */}
                    <button
                      onClick={() => togglePersonalGroup(group.catId)}
                      className="w-full flex justify-between items-center py-2.5 px-1 bg-transparent border-none cursor-pointer text-inherit rounded-lg hover:bg-[oklch(0.18_0.01_250)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronLeft size={14} className="text-muted-foreground" />}
                        <span className="text-[13px] font-semibold">{group.catName}</span>
                        <span className="text-[11px] text-muted-foreground">({group.expenses.length})</span>
                      </div>
                      <span className="text-[13px] font-bold text-primary">{formatCurrency(group.total)}</span>
                    </button>
                    {/* Expanded items */}
                    {isOpen && (
                      <div className="pr-6 border-r-2 border-[oklch(0.25_0.01_250)] mr-[7px]">
                        {group.expenses.map(e => {
                          const itemId = personalItemId(e.category_id, e.description ?? '', e.id)
                          const locked = recurringPersonal.isLocked(itemId)
                          const catName = (e.budget_categories as BudgetCategory)?.name ?? 'כללי'
                          const isEditing = editingPersonal?.id === e.id

                          if (isEditing) {
                            return (
                              <div key={e.id} className="py-2 border-b border-[oklch(0.20_0.01_250)] flex flex-col gap-1.5">
                                <input type="text" value={editingPersonal.description} onChange={ev => setEditingPersonal(prev => prev && { ...prev, description: ev.target.value })} placeholder="תיאור" className="w-full bg-secondary border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[12px] text-inherit" />
                                <div className="flex gap-1.5">
                                  <select value={editingPersonal.categoryId} onChange={ev => setEditingPersonal(prev => prev && { ...prev, categoryId: ev.target.value })} className="flex-1 bg-secondary border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[12px] text-inherit">
                                    {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                  <input type="number" value={editingPersonal.amount} onChange={ev => setEditingPersonal(prev => prev && { ...prev, amount: ev.target.value })} className="w-20 bg-secondary border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[12px] text-inherit text-left" style={{ direction: 'ltr' }} />
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={async () => {
                                    if (!editingPersonal || !user || !selectedPeriodId) return
                                    await updateExpense.mutateAsync({ id: editingPersonal.id, period_id: selectedPeriodId, user_id: user.id, category_id: Number(editingPersonal.categoryId), amount: Number(editingPersonal.amount), description: editingPersonal.description })
                                    toast.success('הוצאה עודכנה')
                                    setEditingPersonal(null)
                                  }} className="flex items-center gap-1 bg-primary text-primary-foreground border-none rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer"><Check size={11} /> שמור</button>
                                  <button onClick={() => setEditingPersonal(null)} className="bg-transparent border border-[oklch(0.28_0.01_250)] text-muted-foreground rounded-md px-2 py-1 text-[11px] cursor-pointer">ביטול</button>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div key={e.id} className="flex justify-between items-center py-2 border-b border-[oklch(0.20_0.01_250)]">
                              <div className="text-[12px] text-[oklch(0.80_0.01_250)]">{e.description || catName}</div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-semibold">{formatCurrency(e.amount)}</span>
                                <button onClick={() => setEditingPersonal({ id: e.id, categoryId: String(e.category_id), amount: String(e.amount), description: e.description ?? '' })}
                                  aria-label="ערוך הוצאה"
                                  className="bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 text-[oklch(0.45_0.01_250)] hover:text-[oklch(0.70_0.01_250)]">
                                  <Pencil size={10} />
                                </button>
                                <button onClick={() => toggleLockPersonal(e)}
                                  title={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                                  aria-label={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                                  className={`bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 ${locked ? 'text-[oklch(0.70_0.15_185)]' : 'text-[oklch(0.35_0.01_250)]'}`}>
                                  {locked ? <Lock size={11} /> : <Unlock size={11} />}
                                </button>
                                <button onClick={() => handleDeletePersonal(e)} aria-label="מחק הוצאה" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 text-muted-foreground">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                        {/* Quick add to this category */}
                        <button
                          onClick={() => { setExpType('personal'); setCategoryId(String(group.catId)); setDetailMode(true) }}
                          className="flex items-center gap-1 text-[11px] text-[oklch(0.55_0.18_250)] bg-transparent border-none cursor-pointer py-1.5 px-0 hover:text-primary"
                        >
                          <Plus size={11} /> הוסף ל{group.catName}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            }
          </div>

          {/* ── Shared expenses (grouped by category) ──────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <Users size={12} className="text-[oklch(0.65_0.12_310)]" /> <h2 className="text-[13px] font-semibold m-0 inline">הוצאות משותפות</h2>
              </div>
              <span className="text-sm font-bold text-[oklch(0.65_0.12_310)]">{formatCurrency(totalSharedMy)}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mb-2.5">
              הסכום שמוצג הוא חלקך ({splitPctLabel}%) — ניתן לנעול הוצאות קבועות
            </div>
            {!sharedGroups.length
              ? <div className="text-xs text-muted-foreground text-center py-6"><Inbox size={32} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />אין הוצאות משותפות</div>
              : sharedGroups.map(group => {
                const isOpen = expandedShared.has(group.category)
                return (
                  <div key={group.category} className="mb-1">
                    {/* Category header */}
                    <button
                      onClick={() => toggleSharedGroup(group.category)}
                      className="w-full flex justify-between items-center py-2.5 px-1 bg-transparent border-none cursor-pointer text-inherit rounded-lg hover:bg-[oklch(0.18_0.01_250)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronLeft size={14} className="text-muted-foreground" />}
                        <span className="text-[13px] font-semibold">{group.categoryLabel}</span>
                        <span className="text-[11px] text-muted-foreground">({group.expenses.length})</span>
                      </div>
                      <span className="text-[13px] font-bold text-[oklch(0.65_0.12_310)]">{formatCurrency(group.totalMy)}</span>
                    </button>
                    {/* Expanded items */}
                    {isOpen && (
                      <div className="pr-6 border-r-2 border-[oklch(0.25_0.01_250)] mr-[7px]">
                        {group.expenses.map(e => {
                          const myAmt = e.my_share ?? e.total_amount * splitFrac
                          const locked = recurringShared.isLocked(e.category)
                          const label = e.notes || e.category
                          const catLabel = SHARED_CATEGORIES.find(c => c.value === e.category)?.label ?? e.category
                          const isEditing = editingShared?.id === e.id

                          if (isEditing) {
                            return (
                              <div key={e.id} className="py-2 border-b border-[oklch(0.20_0.01_250)] flex flex-col gap-1.5">
                                <input type="text" value={editingShared.notes} onChange={ev => setEditingShared(prev => prev && { ...prev, notes: ev.target.value })} placeholder="תיאור" className="w-full bg-secondary border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[12px] text-inherit" />
                                <div className="flex gap-1.5">
                                  <select value={editingShared.category} onChange={ev => setEditingShared(prev => prev && { ...prev, category: ev.target.value })} className="flex-1 bg-secondary border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[12px] text-inherit">
                                    {SHARED_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                  </select>
                                  <input type="number" value={editingShared.totalAmount} onChange={ev => setEditingShared(prev => prev && { ...prev, totalAmount: ev.target.value })} className="w-20 bg-secondary border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[12px] text-inherit text-left" style={{ direction: 'ltr' }} placeholder="סכום כולל" />
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={async () => {
                                    if (!editingShared || !selectedPeriodId) return
                                    await updateShared.mutateAsync({ id: editingShared.id, period_id: selectedPeriodId, category: editingShared.category, total_amount: Number(editingShared.totalAmount), notes: editingShared.notes })
                                    toast.success('הוצאה עודכנה')
                                    setEditingShared(null)
                                  }} className="flex items-center gap-1 bg-[oklch(0.55_0.12_310)] text-primary-foreground border-none rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer"><Check size={11} /> שמור</button>
                                  <button onClick={() => setEditingShared(null)} className="bg-transparent border border-[oklch(0.28_0.01_250)] text-muted-foreground rounded-md px-2 py-1 text-[11px] cursor-pointer">ביטול</button>
                                </div>
                              </div>
                            )
                          }

                          return (
                            <div key={e.id} className="flex justify-between items-center py-2 border-b border-[oklch(0.20_0.01_250)]">
                              <div>
                                <div className="text-[12px] text-[oklch(0.80_0.01_250)]">{label}</div>
                                {label !== catLabel && <div className="text-[10px] text-muted-foreground">{catLabel}</div>}
                                <div className="text-[10px] text-muted-foreground">
                                  סה&quot;כ {formatCurrency(e.total_amount)} · חלקי {formatCurrency(myAmt)}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-semibold text-[oklch(0.65_0.12_310)]">{formatCurrency(myAmt)}</span>
                                <button onClick={() => setEditingShared({ id: e.id, category: e.category, totalAmount: String(e.total_amount), notes: e.notes ?? '' })}
                                  aria-label="ערוך הוצאה"
                                  className="bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 text-[oklch(0.45_0.01_250)] hover:text-[oklch(0.70_0.01_250)]">
                                  <Pencil size={10} />
                                </button>
                                <button onClick={() => toggleLockShared(e)}
                                  title={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                                  aria-label={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                                  className={`bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 ${locked ? 'text-[oklch(0.70_0.15_185)]' : 'text-[oklch(0.35_0.01_250)]'}`}>
                                  {locked ? <Lock size={11} /> : <Unlock size={11} />}
                                </button>
                                <button onClick={() => handleDeleteShared(e.id)} aria-label="מחק הוצאה" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 text-muted-foreground">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                        {/* Quick add to this category */}
                        <button
                          onClick={() => { setExpType('shared'); setSharedCategory(group.category); setSharedLabel(group.categoryLabel); setDetailMode(true) }}
                          className="flex items-center gap-1 text-[11px] text-[oklch(0.55_0.18_250)] bg-transparent border-none cursor-pointer py-1.5 px-0 hover:text-[oklch(0.65_0.12_310)]"
                        >
                          <Plus size={11} /> הוסף ל{group.categoryLabel}
                        </button>
                      </div>
                    )}
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
