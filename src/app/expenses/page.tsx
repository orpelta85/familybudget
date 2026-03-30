'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { usePersonalExpenses, useBudgetCategories, useAddExpense, useDeleteExpense, useUpdateExpense, useToggleExpenseFixed, useUpdateCategoryType, useAddBudgetCategory, useCategoryRules, useSaveCategoryRule, useUpdateRuleConfidence, useGlobalMappings, findMatchingRule, useFamilyPersonalExpenses } from '@/lib/queries/useExpenses'
import { categorizeTransaction } from '@/lib/categorization-engine'
import type { MatchResult } from '@/lib/categorization-engine'
import { useSharedExpenses, useUpsertSharedExpense, useDeleteSharedExpense, useUpdateSharedExpense, useToggleSharedFixed } from '@/lib/queries/useShared'
import { useSinkingFunds, useAllSinkingTransactions, useAddSinkingTransaction, useAddSinkingFund } from '@/lib/queries/useSinking'
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
import { Receipt, Upload, Download, FileSpreadsheet, Trash2, X, Pin } from 'lucide-react'
import type { RawExpenseRow } from '@/lib/excel-import'
import type { BudgetCategory, SharedCategory, PersonalExpense, SharedExpense } from '@/lib/types'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'
import { TableSkeleton } from '@/components/ui/Skeleton'

// Extracted components
import { ExpenseForm, type ExpType } from '@/components/expenses/ExpenseForm'
import { ExpenseStats } from '@/components/expenses/ExpenseStats'
import { PersonalExpenseList } from '@/components/expenses/PersonalExpenseList'
import { SharedExpenseList, sharedCatLabel, isSharedExpenseFixed } from '@/components/expenses/SharedExpenseList'
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
  const { data: allSinkingTx } = useAllSinkingTransactions(user?.id)
  const addExpense    = useAddExpense()
  const deleteExpense = useDeleteExpense()
  const upsertShared  = useUpsertSharedExpense()
  const deleteShared  = useDeleteSharedExpense()
  const updateExpense = useUpdateExpense()
  const toggleFixed   = useToggleExpenseFixed()
  const updateCatType = useUpdateCategoryType()
  const toggleSharedFixed = useToggleSharedFixed()
  const updateShared  = useUpdateSharedExpense()
  const addSinkingTx  = useAddSinkingTransaction()
  const addFund       = useAddSinkingFund()
  const addCategory   = useAddBudgetCategory()
  const { data: categoryRules } = useCategoryRules(user?.id)
  const { data: globalMappings } = useGlobalMappings()
  const saveCategoryRule = useSaveCategoryRule()
  const updateRuleConfidence = useUpdateRuleConfidence()
  const recurringPersonal = useRecurringPersonal(user?.id)
  const recurringShared   = useRecurringShared(user?.id)
  const queryClient = useQueryClient()
  const confirm = useConfirmDialog()

  // Excel import state (kept here because import save needs all the mutation hooks)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parsingFiles, setParsingFiles] = useState(false)
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null)
  const [importTotal, setImportTotal] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [parseProgress, setParseProgress] = useState<{ current: number; total: number } | null>(null)

  // Multi-file + period selection state
  const [rawParsedRows, setRawParsedRows] = useState<ImportRow[]>([])
  const [showPeriodStep, setShowPeriodStep] = useState(false)
  const [importPeriodId, setImportPeriodId] = useState<number | null>(null)
  const [parsedFormats, setParsedFormats] = useState<string[]>([])
  const [importDateFrom, setImportDateFrom] = useState('')
  const [importDateTo, setImportDateTo] = useState('')

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
  const sinkingMonthly = (funds ?? []).filter(f => f.is_active).reduce((s, f) => s + f.monthly_allocation, 0)
  const fundWithdrawals = (allSinkingTx ?? []).filter(t => t.period_id === selectedPeriodId && t.amount < 0).reduce((s, t) => {
    const fund = (funds ?? []).find(f => f.id === t.fund_id)
    const share = fund?.is_shared ? splitFrac : 1
    return s + Math.abs(t.amount) * share
  }, 0)
  const sinkingNet = Math.max(0, sinkingMonthly - fundWithdrawals)
  const totalWithSinking = totalAll + sinkingNet

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
        const notes = data.detailMode && data.description.trim()
          ? `${label} - ${data.description.trim()}`
          : label
        await upsertShared.mutateAsync({ period_id: selectedPeriodId, category: resolvedCategory as SharedCategory, total_amount: amt, notes, family_id: familyId })
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

  // Categorize parsed rows using existing rules and categories
  function categorizeRows(rows: RawExpenseRow[]): ImportRow[] {
    const cats = categories ?? []
    const rules = (categoryRules ?? []) as import('@/lib/categorization-engine').CategoryRule[]
    const globals = (globalMappings ?? []) as import('@/lib/categorization-engine').GlobalMapping[]

    const mapped = rows.map(row => {
      let categoryId = ''
      let matchConfidence = 0
      let matchSource: ImportRow['matchSource'] = 'none'
      let matchRuleId: number | undefined

      if (row.category) {
        // Aliases: map common variants to canonical category names
        const CATEGORY_ALIASES: Record<string, string> = {
          'דוגווקרס': 'חיות מחמד', 'כלבים': 'חיות מחמד',
          'הלוואת רכב': 'הלוואות', 'מים+גז': 'חשבונות בית',
          'בילויים': 'בילויים ופנאי', 'בגדים': 'בגדים וקניות',
          'בריאות': 'בריאות ורפואה', 'השקעות': 'חיסכון והשקעות',
        }
        const catName = CATEGORY_ALIASES[row.category.trim()] ?? row.category.trim()
        // Priority 1: exact match
        const exactMatch = cats.find(c => c.name === catName)
          || cats.find(c => c.name.trim().toLowerCase() === catName.toLowerCase())
        if (exactMatch) {
          categoryId = String(exactMatch.id); matchConfidence = 1.0; matchSource = 'user-exact'
        } else {
          // Priority 2: partial match — Excel "בילויים" → DB "בילויים ופנאי"
          const partialMatch = cats.find(c => c.name.includes(catName) || catName.includes(c.name))
          if (partialMatch) {
            categoryId = String(partialMatch.id); matchConfidence = 0.85; matchSource = 'user-exact'
          } else {
            // No match at all — mark for creation
            categoryId = `__new__${catName}`; matchConfidence = 0.9; matchSource = 'user-exact'
          }
        }
      }

      if (!categoryId && row.description) {
        const result: MatchResult = categorizeTransaction(row.description, rules, globals, cats)
        if (result.matchSource !== 'none') {
          if (result.categoryId) categoryId = String(result.categoryId)
          else if (result.categoryName) categoryId = `__new__${result.categoryName}`
          matchConfidence = result.confidence
          matchSource = result.matchSource
          matchRuleId = result.ruleId
          if (result.isShared) row.is_shared = true
        }
      }

      return { ...row, categoryId, matchConfidence, matchSource, matchRuleId, originalCategoryId: categoryId }
    })

    const existingFundNames = (funds ?? []).map(f => f.name)
    mapped.forEach(row => {
      if (row.fund_name && !existingFundNames.includes(row.fund_name)) {
        row.fund_name = `__new_fund__${row.fund_name}`
      }
    })

    return mapped
  }

  // Parse multiple files and merge results
  async function processExcelFiles(files: File[]) {
    if (parsingFiles) {
      toast.info('הקבצים עדיין נטענים, אנא המתן')
      return
    }
    setParsingFiles(true)
    setParseProgress({ current: 0, total: files.length })
    try {
      const allRows: RawExpenseRow[] = []
      const formats: string[] = []

      for (let i = 0; i < files.length; i++) {
        setParseProgress({ current: i + 1, total: files.length })
        const file = files[i]
        const result: ParseResult = await parseExpenseExcelDetailed(file)
        const sourceLabel = result.detectedFormat?.label ?? file.name.replace(/\.(xlsx|xls|csv)$/i, '')
        for (const row of result.rows) {
          row.sourceFile = sourceLabel
        }
        allRows.push(...result.rows)
        if (result.detectedFormat?.label) formats.push(result.detectedFormat.label)
      }

      if (!allRows.length) { toast.error('לא נמצאו שורות בקבצים'); return }

      const mapped = categorizeRows(allRows)
      setParsedFormats(formats)

      const hasDates = mapped.some(r => r.chargeDate || r.date)

      if (hasDates && periods?.length) {
        setRawParsedRows(mapped)
        setImportPeriodId(selectedPeriodId ?? null)
        // Default to current period's date range
        const curPeriod = periods.find(p => p.id === selectedPeriodId)
        if (curPeriod) {
          setImportDateFrom(curPeriod.start_date)
          setImportDateTo(curPeriod.end_date)
        } else {
          // Default to current month
          const now = new Date()
          setImportDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
          setImportDateTo(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`)
        }
        setShowPeriodStep(true)
      } else {
        finishImportSetup(mapped, formats)
      }

      const msg = files.length > 1
        ? `נקראו ${files.length} קבצים · ${allRows.length} שורות`
        : `נקראו ${allRows.length} שורות`
      toast.success(msg + (formats.length ? ` · ${formats.join(', ')}` : ''))
    } catch (e) {
      console.error('Excel import error:', e)
      const errMsg = e instanceof Error ? e.message : String(e)
      if (errMsg.includes('שגיאה בקריאת הקובץ')) {
        toast.error(errMsg)
      } else if (errMsg.includes('dynamically imported module') || errMsg.includes('Failed to fetch') || errMsg.includes('import')) {
        toast.error('שגיאה בטעינת ספריית Excel - בדוק את חיבור האינטרנט')
      } else {
        toast.error(`שגיאה בקריאת הקבצים: ${errMsg}`)
      }
    } finally {
      setParsingFiles(false)
      setParseProgress(null)
    }
  }

  // Apply date range filter and show import modal
  function applyDateFilter(fromDate: string, toDate: string) {
    let rows = rawParsedRows
    if (fromDate && toDate) {
      const start = new Date(fromDate)
      const end = new Date(toDate)
      end.setHours(23, 59, 59) // Include the entire end day
      rows = rows.filter(r => {
        // Use chargeDate if available, otherwise fall back to date
        const dateStr = r.chargeDate || r.date
        if (!dateStr) return true
        const parsed = parseHebrewDate(dateStr)
        if (!parsed) return true
        return parsed >= start && parsed <= end
      })
    }
    setShowPeriodStep(false)
    finishImportSetup(rows, parsedFormats)
    // Try to match to an existing period for the selected period selector
    if (fromDate && periods) {
      const from = new Date(fromDate)
      const match = periods.find(p => {
        const ps = new Date(p.start_date)
        return ps.getMonth() === from.getMonth() && ps.getFullYear() === from.getFullYear()
      })
      if (match) setSelectedPeriodId(match.id)
    }
  }

  // Legacy period-based filter (still used internally)
  function applyPeriodFilter(periodId: number | null) {
    if (periodId && periods) {
      const period = periods.find(p => p.id === periodId)
      if (period) {
        applyDateFilter(period.start_date, period.end_date)
        return
      }
    }
    applyDateFilter('', '')
  }

  // Count rows matching current date filter (inline calculation, no hook needed)
  const filteredRowCount = (() => {
    if (!importDateFrom || !importDateTo) return rawParsedRows.length
    const start = new Date(importDateFrom)
    const end = new Date(importDateTo)
    end.setHours(23, 59, 59)
    return rawParsedRows.filter(r => {
      const ds = r.chargeDate || r.date
      if (!ds) return true
      // Try DD/MM/YYYY regex FIRST (Israeli format), before Date.parse (which assumes MM/DD)
      const m = ds.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/)
      if (m) {
        const yr = parseInt(m[3]) < 100 ? 2000 + parseInt(m[3]) : parseInt(m[3])
        const d = new Date(yr, parseInt(m[2]) - 1, parseInt(m[1]))
        return d >= start && d <= end
      }
      // Only use Date.parse for ISO strings (YYYY-MM-DD)
      if (/^\d{4}-/.test(ds)) {
        const iso = Date.parse(ds)
        if (!isNaN(iso)) return new Date(iso) >= start && new Date(iso) <= end
      }
      return true
    }).length
  })()

  function finishImportSetup(mapped: ImportRow[], formats: string[]) {
    setImportRows(mapped)
    setShowImport(true)
    setDetectedFormat(formats.join(', ') || null)
    setImportTotal(mapped.reduce((s, r) => s + r.amount, 0))
  }

  // Parse date strings in Israeli formats (DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, Date objects)
  function parseHebrewDate(dateStr: string): Date | null {
    if (!dateStr) return null
    // Try DD/MM/YYYY FIRST — Date.parse("9/2/2026") wrongly gives September (US format)
    const m = dateStr.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/)
    if (m) {
      const day = parseInt(m[1])
      const month = parseInt(m[2]) - 1
      const year = parseInt(m[3]) < 100 ? 2000 + parseInt(m[3]) : parseInt(m[3])
      return new Date(year, month, day)
    }
    // Only use Date.parse for ISO format (YYYY-MM-DD)
    if (/^\d{4}-/.test(dateStr)) {
      const iso = Date.parse(dateStr)
      if (!isNaN(iso)) return new Date(iso)
    }
    return null
  }

  // Legacy single-file handler (still works)
  async function processExcelFile(file: File) {
    await processExcelFiles([file])
  }

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    await processExcelFiles(Array.from(files))
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(xlsx|xls|csv)$/i.test(f.name))
    if (files.length > 0) {
      processExcelFiles(files)
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

      // Auto-create new categories from Excel (use Supabase directly for reliability)
      const newCatNames = [...new Set(valid.filter(r => r.categoryId.startsWith('__new__')).map(r => r.categoryId.replace('__new__', '')))]
      const createdCatMap: Record<string, number> = {}
      const failedCats: string[] = []
      const maxSort = Math.max(0, ...(categories ?? []).map(c => c.sort_order ?? 0))
      for (let i = 0; i < newCatNames.length; i++) {
        const catName = newCatNames[i]
        // First check if category already exists (exact match only — partial matches should have been resolved in categorizeRows)
        const existing = (categories ?? []).find(c => c.name === catName)
          || (categories ?? []).find(c => c.name.toLowerCase() === catName.toLowerCase())
        if (existing) {
          createdCatMap[catName] = existing.id
          continue
        }
        // Create new category directly via Supabase
        const { data: created, error } = await sb.from('budget_categories').insert({
          user_id: user.id, name: catName, type: 'variable',
          monthly_target: 0, sort_order: maxSort + i + 1,
          year: selectedYear ?? 1,
        }).select('id').single()
        if (created) {
          createdCatMap[catName] = created.id
        } else {
          console.error(`Failed to create category "${catName}":`, error)
          // Try fetching it — might have been created by another concurrent request
          const { data: fetched } = await sb.from('budget_categories')
            .select('id').eq('user_id', user.id).eq('name', catName).single()
          if (fetched) {
            createdCatMap[catName] = fetched.id
          } else {
            failedCats.push(catName)
          }
        }
      }
      if (failedCats.length) {
        console.warn(`Categories that failed to create (will fall back to שונות): ${failedCats.join(', ')}`)
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

      // Resolve categories for all rows
      const personalRows: { period_id: number; user_id: string; category_id: number; amount: number; description: string; expense_date: string }[] = []
      const sharedRows: { period_id: number; category: string; total_amount: number; notes: string; family_id: string }[] = []
      const fundTxRows: { fund_id: number; period_id: number; amount: number; description: string; transaction_date: string }[] = []

      for (const r of valid) {
        let resolvedCatId: number
        if (r.categoryId.startsWith('__new__')) {
          resolvedCatId = createdCatMap[r.categoryId.replace('__new__', '')]
        } else {
          resolvedCatId = Number(r.categoryId)
        }
        if (!resolvedCatId || isNaN(resolvedCatId)) {
          // Fallback to "שונות" (misc), not the first category
          const origName = r.categoryId.startsWith('__new__') ? r.categoryId.replace('__new__', '') : r.category
          console.warn(`Category "${origName}" could not be resolved for "${r.description}" — falling back to שונות`)
          const miscCat = categories?.find(c => c.name === 'שונות')
          resolvedCatId = miscCat?.id ?? categories?.[0]?.id ?? 1
        }

        if (r.is_shared && familyId) {
          // Map Hebrew category name to shared category enum value
          const catName = r.category || categories?.find(c => String(c.id) === r.categoryId)?.name || ''
          // Must match shared_category enum in DB:
          // rent, property_tax, electricity, water_gas, building_committee, internet,
          // home_insurance, netflix, spotify, groceries, misc, car_loan, insurance,
          // eating_out, entertainment, subscriptions, shopping, pets, travel
          const LABEL_TO_KEY: Record<string, string> = {
            'שכירות': 'rent', 'ארנונה': 'property_tax', 'חשמל': 'electricity',
            'מים+גז': 'water_gas', 'ועד בית': 'building_committee', 'אינטרנט': 'internet',
            'ביטוח דירה': 'home_insurance', 'נטפליקס': 'netflix', 'ספוטיפיי': 'spotify',
            'מכולת': 'groceries', 'הלוואת רכב': 'car_loan', 'ביטוחים': 'insurance',
            'אוכל בחוץ': 'eating_out', 'בילויים ופנאי': 'entertainment', 'בילויים': 'entertainment',
            'מנויים': 'subscriptions', 'בגדים וקניות': 'shopping', 'בגדים': 'shopping',
            'חיות מחמד': 'pets', 'כלבים': 'pets', 'דוגווקרס': 'pets',
            'טיולים': 'travel', 'חופשה': 'vacation',
            'פארם': 'groceries',
            'חשבונות בית': 'misc', 'הלוואות': 'misc', 'תחבורה': 'misc',
            'בריאות ורפואה': 'misc', 'בריאות': 'misc', 'ילדים': 'misc',
            'חיסכון והשקעות': 'misc', 'השקעות': 'misc',
            'ספורט': 'misc', 'מוזיקה': 'misc', 'טיפוח': 'misc', 'אימון אישי': 'misc',
          }
          const sharedCat = LABEL_TO_KEY[catName] || 'misc'
          // When mapping to misc, prefix notes with original category so the info isn't lost
          let sharedNotes = r.description
          if (sharedCat === 'misc' && catName && catName !== 'שונות') {
            sharedNotes = `[${catName}] ${r.description}`
          }
          sharedRows.push({
            period_id: selectedPeriodId, category: sharedCat,
            total_amount: r.amount, notes: sharedNotes, family_id: familyId,
          })
        } else {
          personalRows.push({
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
            fundTxRows.push({
              fund_id: fundId, period_id: selectedPeriodId,
              amount: -r.amount, description: r.description, transaction_date: today,
            })
          }
        }
        // Smart confidence feedback (fire-and-forget)
        if (r.description && resolvedCatId && !isNaN(resolvedCatId)) {
          const userChangedCategory = r.originalCategoryId && r.categoryId !== r.originalCategoryId
          if (r.matchRuleId && !userChangedCategory) {
            updateRuleConfidence.mutate({ ruleId: r.matchRuleId, userId: user.id, delta: 0.1 })
          } else if (r.matchRuleId && userChangedCategory) {
            updateRuleConfidence.mutate({ ruleId: r.matchRuleId, userId: user.id, delta: -0.15 })
          }
          saveCategoryRule.mutate({
            user_id: user.id, merchant_pattern: r.description.trim(),
            category_id: resolvedCatId, fund_name: rawFundName || undefined,
            confidence: r.matchSource === 'none' ? 0.5 : (r.matchConfidence ?? 0.5),
            source: 'user',
          })
        }
      }

      // Batch insert (much faster than one-by-one)
      let imported = 0
      let failed = 0
      if (personalRows.length) {
        const { error } = await sb.from('personal_expenses').insert(personalRows)
        if (error) { console.error('Batch personal insert error:', error); failed += personalRows.length }
        else imported += personalRows.length
      }
      if (sharedRows.length) {
        const { error } = await sb.from('shared_expenses').insert(sharedRows)
        if (error) { console.error('Batch shared insert error:', error); failed += sharedRows.length }
        else imported += sharedRows.length
      }
      if (fundTxRows.length) {
        await sb.from('sinking_fund_transactions').insert(fundTxRows)
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

  // ── Fixed/Variable toggle ───────────────────────────────────────────────────
  function handleToggleFixed(exp: PersonalExpense) {
    if (!user || !selectedPeriod) return
    const cat = categories?.find(c => c.id === exp.category_id)
    const currentlyFixed = exp.is_fixed !== null && exp.is_fixed !== undefined ? exp.is_fixed : cat?.type === 'fixed'
    const newValue = currentlyFixed ? false : true
    toggleFixed.mutate({
      id: exp.id,
      period_id: selectedPeriod.id,
      user_id: user.id,
      is_fixed: newValue,
    })
    toast.success(newValue ? 'סומן כהוצאה קבועה' : 'סומן כהוצאה משתנה')
  }

  function handleToggleSharedFixed(exp: SharedExpense) {
    if (!selectedPeriod) return
    const currentlyFixed = isSharedExpenseFixed(exp)
    toggleSharedFixed.mutate({
      id: exp.id,
      period_id: selectedPeriod.id,
      is_fixed: !currentlyFixed,
    })
    toast.success(!currentlyFixed ? 'סומן כהוצאה קבועה' : 'סומן כהוצאה משתנה')
  }

  function handleToggleCategoryType(categoryId: number, currentType: string) {
    if (!user) return
    const newType = currentType === 'fixed' ? 'variable' : 'fixed' as 'fixed' | 'variable'
    const catName = categories?.find(c => c.id === categoryId)?.name ?? ''
    updateCatType.mutate({ id: categoryId, type: newType, user_id: user.id })
    toast.success(`${catName}: ${newType === 'fixed' ? 'קבוע' : 'משתנה'}`)
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={18} className="text-[var(--accent-orange)]" />
            <h1 className="text-xl font-bold tracking-tight">הוצאות</h1>
            <PageInfo {...PAGE_TIPS.expenses} />
          </div>
          <p className="text-muted-foreground text-[13px] break-words">{selectedPeriod?.label ?? '...'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleResetExpenses} className="flex items-center gap-1.5 bg-transparent border border-border rounded-lg px-2.5 sm:px-3.5 py-[7px] text-muted-foreground text-xs font-medium cursor-pointer" title="אפס הוצאות">
            <Trash2 size={13} className="shrink-0" /> <span className="hidden sm:inline-block">אפס הוצאות</span>
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 bg-secondary border border-[var(--border-light)] rounded-lg px-2.5 sm:px-3 py-[7px] text-[var(--text-body)] text-xs cursor-pointer" title="הורד לאקסל">
            <Download size={13} className="shrink-0" /> <span className="hidden sm:inline-block">הורד לאקסל</span>
          </button>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 bg-secondary border border-[var(--border-light)] rounded-lg px-2.5 sm:px-3 py-[7px] text-[var(--text-body)] text-xs cursor-pointer" title="תבנית">
            <FileSpreadsheet size={13} className="shrink-0" /> <span className="hidden sm:inline-block">תבנית</span>
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn-hover flex items-center gap-1.5 bg-primary border-none rounded-lg px-2.5 sm:px-3 py-[7px] text-primary-foreground text-xs font-semibold cursor-pointer" title="Excel">
            <Upload size={13} className="shrink-0" /> <span className="hidden sm:inline-block">Excel</span>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden" onChange={handleExcelUpload} />
        </div>
      </div>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* ── Period Selection Step (after file upload, before preview) ──── */}
      {showPeriodStep && periods && (
        <div className="bg-card border border-[var(--accent-blue)] rounded-xl p-5 mb-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={14} className="text-primary" />
              <span className="font-semibold text-[13px]">סינון לפי תאריך חיוב</span>
            </div>
            <button onClick={() => { setShowPeriodStep(false); setRawParsedRows([]) }} aria-label="ביטול" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-2 min-w-9 min-h-9 text-muted-foreground">
              <X size={14} />
            </button>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] mb-3">
            נמצאו {rawParsedRows.length} שורות. בחר טווח תאריכים או ייבא הכל.
          </p>
          {/* Select all OR date range */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => applyDateFilter('', '')}
              className="shrink-0 bg-[var(--c-teal-0-22)] border border-[var(--c-teal-0-40)] rounded-lg px-4 py-2 text-[var(--c-teal-0-75)] text-[13px] font-semibold cursor-pointer hover:bg-[var(--c-teal-0-30)] transition-colors"
            >
              בחר הכל ({rawParsedRows.length})
            </button>
            <span className="text-[12px] text-[var(--c-0-40)]">או</span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-[11px] text-[var(--text-secondary)] mb-1">מתאריך</label>
              <input
                type="date"
                value={importDateFrom}
                onChange={e => setImportDateFrom(e.target.value)}
                aria-label="מתאריך"
                className="w-full bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-[13px] text-inherit outline-none focus:border-[var(--accent-blue)] transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-[var(--text-secondary)] mb-1">עד תאריך</label>
              <input
                type="date"
                value={importDateTo}
                onChange={e => setImportDateTo(e.target.value)}
                aria-label="עד תאריך"
                className="w-full bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-[13px] text-inherit outline-none focus:border-[var(--accent-blue)] transition-colors"
              />
            </div>
          </div>
          {/* Quick select presets */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(() => {
              const now = new Date()
              const presets: { label: string; from: string; to: string }[] = []
              for (let i = 0; i < 6; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const y = d.getFullYear()
                const m = d.getMonth()
                const monthName = d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' })
                // Calendar month (1st to last day)
                const lastDay = new Date(y, m + 1, 0).getDate()
                presets.push({
                  label: monthName,
                  from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
                  to: `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
                })
              }
              return presets.map(p => (
                <button
                  key={p.from}
                  onClick={() => { setImportDateFrom(p.from); setImportDateTo(p.to) }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                    importDateFrom === p.from && importDateTo === p.to
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-[var(--c-0-18)] border border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--c-0-25)] hover:text-[var(--text-body)]'
                  }`}
                >
                  {p.label}
                </button>
              ))
            })()}
          </div>
          {/* Match count */}
          {importDateFrom && importDateTo && (
            <div className="text-[12px] text-[var(--text-secondary)] mb-3">
              {filteredRowCount === rawParsedRows.length
                ? `כל ${rawParsedRows.length} השורות בטווח`
                : `${filteredRowCount} מתוך ${rawParsedRows.length} שורות בטווח`
              }
            </div>
          )}
          <button
            onClick={() => applyDateFilter(importDateFrom, importDateTo)}
            disabled={!importDateFrom || !importDateTo}
            className="w-full bg-primary border-none rounded-lg py-2.5 text-primary-foreground font-semibold text-[13px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {importDateFrom && importDateTo ? `סנן והמשך (${filteredRowCount})` : 'בחר טווח תאריכים'}
          </button>
        </div>
      )}

      {/* ── Family View ──────────────────────────────────────────────────── */}
      {viewMode !== 'personal' && (
        <FamilyExpensesView
          familyExpenses={familyExpenses}
          sharedExp={sharedExp}
          splitFrac={splitFrac}
          sinkingMonthly={sinkingMonthly}
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
        parsingFiles={parsingFiles}
        parseProgress={parseProgress}
        onAcceptAllSuggestions={() => {
          // Accept all suggestions with confidence >= 0.3 — no change needed, they already have categoryId set
          toast.success('כל ההצעות אושרו')
        }}
      />

      <div className="grid-2 items-start">

        {/* ── Add form ───────────────────────────────────────────────────────── */}
        <ExpenseForm
          categories={categories}
          funds={funds}
          allSinkingTx={allSinkingTx}
          selectedPeriodId={selectedPeriodId}
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
            sinkingMonthly={sinkingMonthly}
            totalWithSinking={totalWithSinking}
          />

          {/* ── Fixed vs Variable Bar ──────────────────────────────────────── */}
          {(sortedPersonalExp.length > 0 || sortedSharedExp.length > 0) && (() => {
            let fixedTotal = 0
            let variableTotal = 0
            for (const e of sortedPersonalExp) {
              const cat = categories?.find(c => c.id === e.category_id)
              const isFixed = e.is_fixed !== null && e.is_fixed !== undefined ? e.is_fixed : cat?.type === 'fixed'
              if (isFixed) fixedTotal += e.amount
              else variableTotal += e.amount
            }
            for (const e of sortedSharedExp) {
              const myAmt = e.my_share ?? e.total_amount * splitFrac
              if (isSharedExpenseFixed(e)) fixedTotal += myAmt
              else variableTotal += myAmt
            }
            const total = fixedTotal + variableTotal
            if (total <= 0) return null
            const fixedPct = Math.round((fixedTotal / total) * 100)
            const varPct = 100 - fixedPct
            return (
              <div className="bg-card border border-border rounded-xl px-4 py-3 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <Pin size={12} className="text-[var(--accent-orange)] shrink-0" />
                  <div className="flex-1 flex rounded-md overflow-hidden h-5">
                    {fixedPct > 0 && (
                      <div className="flex items-center justify-center text-[10px] font-semibold text-[var(--c-0-10)]"
                        style={{ width: `${fixedPct}%`, background: 'var(--accent-orange)', minWidth: '32px' }}>
                        {fixedPct}%
                      </div>
                    )}
                    {varPct > 0 && (
                      <div className="flex items-center justify-center text-[10px] font-semibold text-[var(--c-0-10)]"
                        style={{ width: `${varPct}%`, background: 'var(--accent-blue)', minWidth: '32px' }}>
                        {varPct}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--accent-orange)' }} />
                    <span className="text-muted-foreground">קבועות</span>
                    <span className="font-semibold">{formatCurrency(fixedTotal)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--accent-blue)' }} />
                    <span className="text-muted-foreground">משתנות</span>
                    <span className="font-semibold">{formatCurrency(variableTotal)}</span>
                  </div>
                </div>
              </div>
            )
          })()}

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
              onToggleFixed={handleToggleFixed}
              onToggleCategoryType={handleToggleCategoryType}
            />

            <SharedExpenseList
              expenses={sortedSharedExp}
              splitFrac={splitFrac}
              totalSharedMy={totalSharedMy}
              isLocked={recurringShared.isLocked}
              onEdit={handleEditShared}
              onDelete={handleDeleteShared}
              onToggleLock={toggleLockShared}
              onToggleFixed={handleToggleSharedFixed}
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
