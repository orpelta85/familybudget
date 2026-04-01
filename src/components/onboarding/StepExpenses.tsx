'use client'

import { useState, useRef, useCallback } from 'react'
import { FileSpreadsheet, Upload, ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { OnboardingData } from '@/app/onboarding/page'
import type { BudgetCategory, SinkingFund } from '@/lib/types'
import type { ParseResult } from '@/lib/excel-import'
import { ExcelImportModal, type ImportRow } from '@/components/expenses/ExcelImportModal'
import { categorizeTransaction } from '@/lib/categorization-engine'
import type { MatchResult } from '@/lib/categorization-engine'
import { useGlobalMappings } from '@/lib/queries/useExpenses'

interface Props {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
  userId: string
  periodId: number | undefined
}

const SUPPORTED_BANKS = [
  'לאומי', 'הפועלים', 'דיסקונט', 'מזרחי', 'פירסט אינטרנשיונל',
  'ישראכרט', 'כאל', 'מקס',
]

export function StepExpenses({ data, updateData, onNext, onSkip, onBack, userId, periodId }: Props) {
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [importDone, setImportDone] = useState(data.expensesImported)
  const [importedCount, setImportedCount] = useState(data.importedCount)
  const [parsingFiles, setParsingFiles] = useState(false)
  const [parseProgress, setParseProgress] = useState<{ current: number; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Ensure categories exist before import
  const { data: categories } = useQuery<BudgetCategory[]>({
    queryKey: ['budget_categories', userId, 'onboarding'],
    queryFn: async () => {
      // Ensure default categories
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ensure_categories' }),
      })
      const sb = createClient()
      const { data } = await sb
        .from('budget_categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order')
      return data ?? []
    },
  })

  const { data: globalMappings } = useGlobalMappings()

  const { data: funds } = useQuery<SinkingFund[]>({
    queryKey: ['sinking_funds', userId, 'onboarding'],
    queryFn: async () => {
      const sb = createClient()
      const { data } = await sb
        .from('sinking_funds')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
      return data ?? []
    },
  })

  const importTotal = importRows.reduce((sum, r) => sum + Number(r.amount), 0)

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    await processFiles(files)
  }, [categories])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    await processFiles(files)
    e.target.value = ''
  }, [categories])

  async function processFiles(files: File[]) {
    setParsingFiles(true)
    setParseProgress({ current: 0, total: files.length })

    try {
      const { parseExpenseExcelDetailed } = await import('@/lib/excel-import')
      let allRows: ImportRow[] = []

      for (let i = 0; i < files.length; i++) {
        setParseProgress({ current: i + 1, total: files.length })
        const result: ParseResult = await parseExpenseExcelDetailed(files[i])
        if (result.rows.length > 0) {
          setDetectedFormat(result.detectedFormat?.label ?? null)
          const CATEGORY_ALIASES: Record<string, string> = {
            'דוגווקרס': 'חיות מחמד', 'כלבים': 'חיות מחמד',
            'הלוואת רכב': 'הלוואות', 'מים+גז': 'חשבונות בית',
            'בילויים': 'בילויים ופנאי', 'בגדים': 'בגדים וקניות',
            'בריאות': 'בריאות ורפואה', 'השקעות': 'חיסכון והשקעות',
          }
          const cats = categories ?? []
          const globals = (globalMappings ?? []) as import('@/lib/categorization-engine').GlobalMapping[]

          const mapped = result.rows.map(r => {
            let categoryId = ''
            let matchConfidence = 0
            let matchSource: ImportRow['matchSource'] = 'none'

            if (r.category) {
              const catName = CATEGORY_ALIASES[r.category.trim()] ?? r.category.trim()
              const exactMatch = cats.find(c => c.name === catName)
                || cats.find(c => c.name.trim().toLowerCase() === catName.toLowerCase())
              if (exactMatch) {
                categoryId = String(exactMatch.id); matchConfidence = 1.0; matchSource = 'user-exact'
              } else {
                const partialMatch = cats.find(c => c.name.includes(catName) || catName.includes(c.name))
                if (partialMatch) {
                  categoryId = String(partialMatch.id); matchConfidence = 0.85; matchSource = 'user-exact'
                } else {
                  categoryId = `__new__${catName}`; matchConfidence = 0.9; matchSource = 'user-exact'
                }
              }
            }

            if (!categoryId && r.description) {
              const matchResult: MatchResult = categorizeTransaction(r.description, [], globals, cats)
              if (matchResult.matchSource !== 'none') {
                if (matchResult.categoryId) categoryId = String(matchResult.categoryId)
                else if (matchResult.categoryName) categoryId = `__new__${matchResult.categoryName}`
                matchConfidence = matchResult.confidence
                matchSource = matchResult.matchSource
              }
            }

            if (!categoryId) {
              categoryId = String(cats.find(c => c.name === 'שונות')?.id ?? '')
              if (categoryId) { matchConfidence = 0.1; matchSource = 'none' }
            }

            return { ...r, categoryId, matchConfidence, matchSource, sourceFile: files[i].name } as ImportRow
          })
          allRows = [...allRows, ...mapped]
        }
      }

      if (allRows.length === 0) {
        toast.error('לא נמצאו שורות הוצאות בקבצים')
        setParsingFiles(false)
        return
      }

      setImportRows(allRows)
      setShowImport(true)
    } catch (err) {
      console.error('Parse error:', err)
      toast.error('שגיאה בקריאת הקובץ')
    }
    setParsingFiles(false)
    setParseProgress(null)
  }

  async function handleImportSave() {
    if (!periodId) {
      toast.error('לא נמצאה תקופה נוכחית')
      return
    }

    setImporting(true)
    try {
      const sb = createClient()
      const validRows = importRows.filter(r => (r.categoryId || r.category) && r.amount > 0)
      let savedCount = 0

      // Create new categories first
      const newCats = new Map<string, number>()
      for (const row of validRows) {
        if (row.categoryId?.startsWith('__new__')) {
          const catName = row.categoryId.replace('__new__', '')
          if (!newCats.has(catName)) {
            const { data: newCat } = await sb
              .from('budget_categories')
              .insert({ user_id: userId, name: catName, type: 'variable', monthly_target: 0, year: 1, sort_order: 99 })
              .select('id')
              .single()
            if (newCat) newCats.set(catName, newCat.id)
          }
        }
      }

      // Insert expenses
      const expenses = validRows.map(row => {
        let catId: number
        if (row.categoryId?.startsWith('__new__')) {
          catId = newCats.get(row.categoryId.replace('__new__', '')) ?? 0
        } else {
          catId = Number(row.categoryId)
        }
        const today = new Date().toISOString().split('T')[0]
        return {
          period_id: periodId,
          user_id: userId,
          category_id: catId,
          amount: Number(row.amount),
          description: row.description || '',
          expense_date: row.date || today,
        }
      }).filter(e => e.category_id > 0)

      if (expenses.length > 0) {
        const { error } = await sb.from('personal_expenses').insert(expenses)
        if (error) throw error
        savedCount = expenses.length
      }

      setImportDone(true)
      setImportedCount(savedCount)
      setShowImport(false)
      updateData({ expensesImported: true, importedCount: savedCount })
      toast.success(`יובאו ${savedCount} הוצאות בהצלחה`)
    } catch (err) {
      console.error('Import error:', err)
      toast.error('שגיאה בייבוא ההוצאות')
    }
    setImporting(false)
  }

  function showTextInput(title: string): Promise<string | null> {
    return new Promise(resolve => {
      const result = window.prompt(title)
      resolve(result)
    })
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[13px] text-[var(--text-muted)] mb-4 bg-transparent border-none cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
      >
        <ArrowRight size={14} />
        חזרה
      </button>

      <div className="flex items-center gap-3 mb-2">
        <FileSpreadsheet size={24} className="text-[var(--accent-orange)]" />
        <h1 className="text-[22px] font-bold text-[var(--text-heading)]">ייבוא הוצאות מהבנק</h1>
      </div>
      <p className="text-[var(--text-secondary)] text-[14px] leading-relaxed mb-4">
        ייבוא קובץ אקסל מהבנק או כרטיס האשראי ימלא את ההוצאות שלך אוטומטית.
      </p>

      {/* Supported banks */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SUPPORTED_BANKS.map(bank => (
          <span key={bank} className="text-[11px] bg-[var(--c-0-14)] text-[var(--text-secondary)] px-2.5 py-1 rounded-md">
            {bank}
          </span>
        ))}
      </div>

      {importDone ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <CheckCircle2 size={48} className="text-[var(--accent-green)]" />
          <span className="text-[16px] font-semibold text-[var(--text-heading)]">
            יובאו {importedCount} הוצאות בהצלחה
          </span>
          <span className="text-[13px] text-[var(--text-muted)]">
            ניתן לייבא קבצים נוספים מדף ההוצאות
          </span>
        </div>
      ) : (
        <>
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

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
            onDrop={handleFileDrop}
            onImportSave={handleImportSave}
            showTextInput={showTextInput}
            parsingFiles={parsingFiles}
            parseProgress={parseProgress}
          />
        </>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={onNext}
          className="flex-1 bg-[var(--accent-blue)] text-white border-none rounded-lg py-3 font-semibold text-[15px] cursor-pointer hover:opacity-90 transition-opacity"
        >
          המשך
        </button>
        <button
          onClick={onSkip}
          className="px-5 bg-transparent border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg py-3 text-[13px] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
        >
          אדלג, אגדיר אחר כך
        </button>
      </div>
    </div>
  )
}
