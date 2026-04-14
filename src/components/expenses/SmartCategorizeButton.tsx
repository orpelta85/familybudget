'use client'

import { useState } from 'react'
import { Sparkles, Loader2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { BudgetCategory } from '@/lib/types'
import type { ImportRow } from './ExcelImportModal'

type Suggestion = {
  rowIndex: number
  description: string
  amount: number
  currentCategoryId: string
  currentCategoryName: string
  suggestedCategoryId: string
  suggestedCategoryName: string
  confidence: number
  accept: boolean
}

interface SmartCategorizeButtonProps {
  importRows: ImportRow[]
  setImportRows: React.Dispatch<React.SetStateAction<ImportRow[]>>
  categories: BudgetCategory[] | undefined
}

const MISC_NAMES = ['שונות', 'אחר', 'כללי']

function isMiscOrEmpty(row: ImportRow, categories: BudgetCategory[] | undefined): boolean {
  if (!row.categoryId) return true
  if ((row.matchConfidence ?? 0) < 0.5) return true
  const cat = categories?.find(c => String(c.id) === String(row.categoryId))
  if (cat && MISC_NAMES.some(n => cat.name.includes(n))) return true
  return false
}

export function SmartCategorizeButton({ importRows, setImportRows, categories }: SmartCategorizeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)

  const candidateIndexes = importRows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => isMiscOrEmpty(r, categories))
    .map(({ i }) => i)

  if (!categories || categories.length === 0) return null
  if (importRows.length === 0) return null

  async function runCategorize() {
    if (candidateIndexes.length === 0) {
      toast.info('אין הוצאות שדורשות סיווג חכם')
      return
    }
    setLoading(true)
    try {
      const expensesToSend = candidateIndexes.map(i => ({
        description: importRows[i].description,
        amount: importRows[i].amount,
      }))
      const categoriesToSend = categories!.map(c => ({ id: String(c.id), name: c.name }))

      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: expensesToSend, categories: categoriesToSend }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data?.error || 'שגיאה בסיווג AI')
        return
      }

      const mapping: Array<{ description: string; categoryId: string | null; confidence: number }> = data.mapping || []
      const newSuggestions: Suggestion[] = []

      mapping.forEach((m, idx) => {
        const rowIndex = candidateIndexes[idx]
        if (rowIndex === undefined) return
        const row = importRows[rowIndex]
        if (!m.categoryId || m.confidence < 0.4) return
        if (String(row.categoryId) === String(m.categoryId)) return
        const suggestedCat = categories!.find(c => String(c.id) === String(m.categoryId))
        if (!suggestedCat) return
        const currentCat = categories!.find(c => String(c.id) === String(row.categoryId))
        newSuggestions.push({
          rowIndex,
          description: row.description,
          amount: row.amount,
          currentCategoryId: String(row.categoryId || ''),
          currentCategoryName: currentCat?.name || '-',
          suggestedCategoryId: String(m.categoryId),
          suggestedCategoryName: suggestedCat.name,
          confidence: m.confidence,
          accept: true,
        })
      })

      if (newSuggestions.length === 0) {
        toast.success('אין הצעות חדשות - כל ההוצאות מסווגות היטב')
        return
      }
      setSuggestions(newSuggestions)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בחיבור לשרת')
    } finally {
      setLoading(false)
    }
  }

  function applySuggestions() {
    if (!suggestions) return
    const accepted = suggestions.filter(s => s.accept)
    if (accepted.length === 0) {
      setSuggestions(null)
      return
    }
    setImportRows(prev => {
      const next = [...prev]
      for (const s of accepted) {
        const row = next[s.rowIndex]
        if (!row) continue
        next[s.rowIndex] = {
          ...row,
          categoryId: s.suggestedCategoryId,
          category: s.suggestedCategoryName,
          matchConfidence: s.confidence,
          matchSource: 'user-fuzzy',
        }
      }
      return next
    })
    toast.success(`סווגו ${accepted.length} הוצאות`)
    setSuggestions(null)
  }

  function toggleAccept(idx: number) {
    setSuggestions(prev => prev && prev.map((s, i) => i === idx ? { ...s, accept: !s.accept } : s))
  }

  function acceptAll(val: boolean) {
    setSuggestions(prev => prev && prev.map(s => ({ ...s, accept: val })))
  }

  return (
    <>
      <button
        type="button"
        onClick={runCategorize}
        disabled={loading || candidateIndexes.length === 0}
        title={candidateIndexes.length === 0 ? 'אין הוצאות לסיווג' : `סווג ${candidateIndexes.length} הוצאות`}
        className="flex items-center gap-1 bg-[var(--c-purple-0-22)] border border-[var(--c-purple-0-40)] text-[var(--c-purple-0-75)] rounded-md px-2 py-0.5 text-[11px] font-semibold cursor-pointer hover:bg-[var(--c-purple-0-30)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading
          ? <><Loader2 size={11} className="animate-spin" /> מסווג...</>
          : <><Sparkles size={11} /> סווג עם AI</>
        }
      </button>

      {/* Suggestions modal */}
      {suggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-[var(--bg-default)] border border-[var(--border-default)] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--c-purple-0-75)]" />
                <span className="font-semibold text-[14px]">הצעות סיווג AI ({suggestions.length})</span>
              </div>
              <button onClick={() => setSuggestions(null)} aria-label="סגור" className="bg-transparent border-none cursor-pointer p-1">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-default)] text-[11px]">
              <button onClick={() => acceptAll(true)} className="bg-[var(--c-teal-0-22)] border border-[var(--c-teal-0-40)] text-[var(--c-teal-0-75)] rounded px-2 py-0.5 cursor-pointer hover:bg-[var(--c-teal-0-30)]">בחר הכל</button>
              <button onClick={() => acceptAll(false)} className="bg-secondary border border-[var(--border-light)] text-muted-foreground rounded px-2 py-0.5 cursor-pointer">בטל הכל</button>
              <span className="text-[var(--text-muted)] mr-auto">
                {suggestions.filter(s => s.accept).length} נבחרו
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {suggestions.map((s, idx) => (
                <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg text-[12px] ${s.accept ? 'bg-[var(--c-teal-0-10)]' : 'bg-transparent'} hover:bg-[var(--c-0-10)]`}>
                  <input
                    type="checkbox"
                    checked={s.accept}
                    onChange={() => toggleAccept(idx)}
                    className="cursor-pointer w-4 h-4"
                    aria-label={`אשר ${s.description}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-[var(--text-heading)]">{s.description}</div>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mt-0.5">
                      <span>{s.currentCategoryName || '-'}</span>
                      <span>←</span>
                      <span className="text-[var(--c-purple-0-75)] font-semibold">{s.suggestedCategoryName}</span>
                      <span className={`${s.confidence >= 0.8 ? 'text-[var(--c-teal-0-75)]' : s.confidence >= 0.5 ? 'text-[var(--accent-orange)]' : 'text-[var(--text-muted)]'}`}>
                        {Math.round(s.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 p-4 border-t border-[var(--border-default)]">
              <button
                onClick={applySuggestions}
                className="flex-1 bg-primary text-primary-foreground border-none rounded-lg py-2 text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1"
              >
                <Check size={14} /> אשר ({suggestions.filter(s => s.accept).length})
              </button>
              <button
                onClick={() => setSuggestions(null)}
                className="bg-secondary border border-[var(--border-light)] rounded-lg px-4 py-2 text-xs cursor-pointer"
              >
                בטל
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
