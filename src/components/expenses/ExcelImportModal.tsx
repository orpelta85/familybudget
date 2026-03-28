'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, HelpCircle, Sparkles, Loader2 } from 'lucide-react'
import type { RawExpenseRow } from '@/lib/excel-import'
import type { BudgetCategory, SinkingFund } from '@/lib/types'

export type ImportRow = RawExpenseRow & {
  categoryId: string
  matchConfidence?: number
  matchSource?: 'user-exact' | 'user-fuzzy' | 'global' | 'none'
  matchRuleId?: number
  originalCategoryId?: string
}

interface ExcelImportModalProps {
  importRows: ImportRow[]
  setImportRows: React.Dispatch<React.SetStateAction<ImportRow[]>>
  showImport: boolean
  setShowImport: (v: boolean) => void
  importing: boolean
  detectedFormat: string | null
  importTotal: number
  categories: BudgetCategory[] | undefined
  funds: SinkingFund[] | undefined
  isDragging: boolean
  setIsDragging: (v: boolean) => void
  fileRef: React.RefObject<HTMLInputElement | null>
  onDrop: (e: React.DragEvent) => void
  onImportSave: () => void
  showTextInput: (title: string) => Promise<string | null>
  onAcceptAllSuggestions?: () => void
  parsingFiles?: boolean
  parseProgress?: { current: number; total: number } | null
}

export function ExcelImportModal({
  importRows, setImportRows, showImport, setShowImport,
  importing, detectedFormat, importTotal,
  categories, funds,
  isDragging, setIsDragging, fileRef,
  onDrop, onImportSave, showTextInput, onAcceptAllSuggestions,
  parsingFiles = false, parseProgress,
}: ExcelImportModalProps) {
  const [bulkCategory, setBulkCategory] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  function applyBulkCategory() {
    if (!bulkCategory || selectedRows.size === 0) return
    setImportRows(prev => prev.map((r, i) => {
      if (!selectedRows.has(i)) return r
      if (bulkCategory.startsWith('__new__')) return { ...r, categoryId: bulkCategory, category: bulkCategory.replace('__new__', '') }
      const catName = categories?.find(c => String(c.id) === bulkCategory)?.name ?? ''
      return { ...r, categoryId: bulkCategory, category: catName }
    }))
    setSelectedRows(new Set())
    setBulkCategory('')
  }

  return (
    <>
      {/* Drag & Drop Zone */}
      {!showImport && (
        <div className="relative mb-4">
          <div
            onDragOver={e => { if (!parsingFiles) { e.preventDefault(); setIsDragging(true) } }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={parsingFiles ? undefined : onDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
              parsingFiles
                ? 'border-[var(--accent-blue)] bg-[var(--c-blue-0-16)] pointer-events-none opacity-60'
                : isDragging
                  ? 'border-[var(--accent-blue)] bg-[var(--c-blue-0-16)] cursor-pointer'
                  : 'border-[var(--border-default)] bg-transparent hover:border-[var(--c-0-35)] cursor-pointer'
            }`}
            onClick={() => !parsingFiles && fileRef.current?.click()}
          >
            <Upload size={24} className={`mx-auto mb-2 ${isDragging ? 'text-[var(--accent-blue)]' : 'text-[var(--c-0-40)]'}`} />
            <div className="text-[13px] text-[var(--text-secondary)]">
              גרור קבצי Excel לכאן או לחץ לבחירה
            </div>
            <div className="text-[11px] text-[var(--c-0-45)] mt-1">
              xlsx, xls, csv — ניתן לבחור מספר קבצים בו-זמנית (בנקים + אשראי)
            </div>
          </div>
          {/* Loading overlay */}
          {parsingFiles && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-[var(--c-0-10)]/80 backdrop-blur-sm z-10">
              <Loader2 size={28} className="animate-spin text-[var(--accent-blue)] mb-2" />
              <div className="text-[14px] text-[var(--accent-blue)] font-semibold">
                קורא קבצים...
              </div>
              {parseProgress && parseProgress.total > 1 && (
                <div className="text-[12px] text-[var(--text-secondary)] mt-1">
                  קורא קובץ {parseProgress.current} מתוך {parseProgress.total}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Excel import preview */}
      {showImport && (
        <div className="relative bg-card border border-[var(--accent-blue)] rounded-xl p-5 mb-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={14} className="text-primary" />
              <span className="font-semibold text-[13px]">{importRows.length} שורות מ-Excel</span>
              {detectedFormat && (
                <span className="text-[11px] bg-[var(--c-blue-0-22)] text-[var(--c-blue-0-75)] px-2 py-0.5 rounded-md font-medium">
                  זוהה: {detectedFormat}
                </span>
              )}
            </div>
            <button onClick={() => setShowImport(false)} aria-label="סגור ייבוא" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-2 min-w-9 min-h-9 text-muted-foreground"><X size={14} /></button>
          </div>
          {/* Smart categorization summary bar */}
          {(() => {
            const autoMatched = importRows.filter(r => (r.matchConfidence ?? 0) >= 0.8).length
            const suggestions = importRows.filter(r => (r.matchConfidence ?? 0) >= 0.3 && (r.matchConfidence ?? 0) < 0.8).length
            const needsInput = importRows.filter(r => (r.matchConfidence ?? 0) < 0.3).length
            const newCats = new Set(importRows.filter(r => r.categoryId.startsWith('__new__')).map(r => r.category)).size
            return (
              <div className="flex flex-wrap items-center gap-3 mb-3 text-[12px] text-[var(--text-secondary)] bg-[var(--c-0-14)] rounded-lg px-3 py-2">
                <span>סה&quot;כ: <strong className="text-[var(--text-heading)]">{formatCurrency(importTotal)}</strong></span>
                <span className="text-[var(--c-0-45)]">|</span>
                {autoMatched > 0 && (
                  <span className="flex items-center gap-1 text-[var(--c-teal-0-75)]">
                    <CheckCircle2 size={12} /> {autoMatched} זוהו
                  </span>
                )}
                {suggestions > 0 && (
                  <span className="flex items-center gap-1 text-[var(--accent-orange)]">
                    <AlertCircle size={12} /> {suggestions} הצעות
                  </span>
                )}
                {needsInput > 0 && (
                  <span className="flex items-center gap-1 text-[var(--c-red-0-65)]">
                    <HelpCircle size={12} /> {needsInput} ללא קטגוריה
                  </span>
                )}
                {newCats > 0 && (
                  <span className="text-[var(--accent-orange)]">{newCats} קטגוריות חדשות</span>
                )}
                {suggestions > 0 && onAcceptAllSuggestions && (
                  <>
                    <span className="text-[var(--c-0-45)]">|</span>
                    <button
                      type="button"
                      onClick={onAcceptAllSuggestions}
                      className="flex items-center gap-1 bg-[var(--c-teal-0-22)] border border-[var(--c-teal-0-40)] text-[var(--c-teal-0-75)] rounded-md px-2 py-0.5 text-[11px] font-semibold cursor-pointer hover:bg-[var(--c-teal-0-30)] transition-colors"
                    >
                      <Sparkles size={11} /> קבל הכל
                    </button>
                  </>
                )}
              </div>
            )
          })()}
          {/* Bulk category change */}
          {selectedRows.size > 0 && (
            <div className="flex items-center gap-2 mb-3 bg-[var(--c-blue-0-18)] rounded-lg px-3 py-2">
              <span className="text-[12px] text-[var(--c-blue-0-75)]">{selectedRows.size} נבחרו</span>
              <select
                value={bulkCategory}
                onChange={e => setBulkCategory(e.target.value)}
                className="bg-[var(--c-0-20)] border border-[var(--border-light)] rounded-lg px-2 py-1 text-[12px] text-inherit cursor-pointer"
              >
                <option value="">שנה קטגוריה ל...</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={applyBulkCategory}
                disabled={!bulkCategory}
                className="bg-[var(--accent-blue)] border-none rounded-md px-2.5 py-1 text-[11px] font-semibold text-[var(--c-0-10)] cursor-pointer disabled:opacity-40"
              >
                החל
              </button>
              <button
                onClick={() => setSelectedRows(new Set())}
                className="bg-transparent border-none text-[var(--text-muted)] text-[11px] cursor-pointer underline"
              >
                נקה בחירה
              </button>
            </div>
          )}
          <div className="max-h-80 overflow-y-auto mb-2.5">
            {importRows.map((row, i) => {
              const isAutoMatched = row.categoryId && !row.categoryId.startsWith('__new__') && row.category
              const isNewCat = row.categoryId?.startsWith('__new__')
              const conf = row.matchConfidence ?? 0
              return (
                <div key={i} className="grid-import-row py-1.5 border-b border-[var(--c-0-20)]">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(i)}
                    onChange={() => setSelectedRows(prev => {
                      const next = new Set(prev)
                      if (next.has(i)) next.delete(i); else next.add(i)
                      return next
                    })}
                    className="cursor-pointer shrink-0 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1.5 text-xs text-[var(--text-heading)] overflow-hidden text-ellipsis whitespace-nowrap">
                    <span
                      className={`shrink-0 w-2 h-2 rounded-full ${
                        conf >= 0.8 ? 'bg-[var(--c-teal-0-65)]' : conf >= 0.3 ? 'bg-[var(--accent-orange)]' : 'bg-[var(--c-red-0-55)]'
                      }`}
                      title={conf >= 0.8 ? 'זוהה אוטומטית' : conf >= 0.3 ? 'הצעה' : 'לא זוהה'}
                    />
                    {row.sourceFile && (
                      <span className="shrink-0 text-[9px] bg-[var(--c-0-20)] text-[var(--c-0-60)] px-1.5 py-0.5 rounded font-medium max-w-[60px] overflow-hidden text-ellipsis whitespace-nowrap" title={row.sourceFile}>
                        {row.sourceFile}
                      </span>
                    )}
                    {row.description}
                    {row.installmentInfo && (
                      <span className="shrink-0 text-[9px] bg-[var(--c-purple-0-22)] text-[var(--c-purple-0-75)] px-1.5 py-0.5 rounded font-medium whitespace-nowrap" title={row.originalAmount ? `סכום עסקה: ${row.originalAmount.toLocaleString()} ₪` : undefined}>
                        {row.installmentInfo}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-semibold text-right text-[var(--accent-orange)]">{formatCurrency(row.amount)}</span>
                  {/* Toggle personal/shared */}
                  <button
                    onClick={() => setImportRows(p => p.map((r, j) => j === i ? { ...r, is_shared: !r.is_shared } : r))}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold cursor-pointer whitespace-nowrap ${
                      row.is_shared
                        ? 'bg-[var(--c-purple-0-22)] border border-[var(--c-purple-0-40)] text-[var(--c-purple-0-75)]'
                        : 'bg-secondary border border-[var(--border-light)] text-muted-foreground'
                    }`}
                  >
                    {row.is_shared ? 'משותף' : 'אישי'}
                  </button>
                  {/* Category dropdown */}
                  <div className="flex items-center gap-1">
                    <select
                      value={row.categoryId?.startsWith('__new__') ? '__new__' : (row.categoryId || '')}
                      onChange={e => {
                        const val = e.target.value
                        if (val === '__manual__') {
                          showTextInput('שם קטגוריה חדשה:').then(name => {
                            if (name?.trim()) {
                              setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: `__new__${name.trim()}`, category: name.trim() } : r))
                            }
                          })
                        } else {
                          const text = e.target.selectedOptions[0]?.text || ''
                          setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: val === '__new__' ? `__new__${r.category}` : val, category: val === '__new__' ? r.category : text } : r))
                        }
                      }}
                      aria-label="בחר קטגוריה"
                      className={`min-w-[120px] bg-[var(--c-0-20)] border-2 rounded-lg px-2 py-1 text-[12px] text-inherit outline-none cursor-pointer appearance-auto ${
                        isAutoMatched ? 'border-[var(--c-teal-0-50)] text-[var(--c-teal-0-75)]'
                        : isNewCat ? 'border-[var(--c-orange-0-50)] text-[var(--c-orange-0-80)]'
                        : 'border-[var(--c-0-40)] text-[var(--text-secondary)]'
                      }`}>
                      {isNewCat && <option value="__new__">{row.category} (חדש)</option>}
                      {!isNewCat && !row.categoryId && <option value="">— בחר —</option>}
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value="__manual__">+ קטגוריה חדשה...</option>
                    </select>
                  </div>
                  {/* Fund dropdown */}
                  <select
                    value={row.fund_name?.startsWith('__new_fund__') ? '__new_fund__' : (row.fund_name || '')}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '__manual_fund__') {
                        showTextInput('שם קרן חדשה:').then(name => {
                          if (name?.trim()) {
                            setImportRows(p => p.map((r, j) => j === i ? { ...r, fund_name: `__new_fund__${name.trim()}` } : r))
                          }
                        })
                      } else {
                        setImportRows(p => p.map((r, j) => j === i ? { ...r, fund_name: val === '__new_fund__' ? r.fund_name : (val || undefined) } : r))
                      }
                    }}
                    aria-label="בחר קרן"
                    className={`min-w-[90px] bg-[var(--c-0-20)] border rounded-lg px-1.5 py-1 text-[11px] text-inherit outline-none cursor-pointer appearance-auto ${
                      row.fund_name?.startsWith('__new_fund__') ? 'border-[var(--c-teal-0-50)] text-[var(--c-teal-0-75)]' : 'border-[var(--c-0-30)]'
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
            <button onClick={onImportSave} disabled={importing} className={`flex-1 border-none rounded-lg py-2.5 text-primary-foreground font-semibold text-[13px] ${importing ? 'bg-[var(--c-blue-0-40)] cursor-wait' : 'bg-primary cursor-pointer'}`}>
              {importing ? 'מייבא... נא להמתין' : `ייבא ${importRows.filter(r => (r.categoryId || r.category) && r.amount > 0).length}`}
            </button>
            <button onClick={() => { setShowImport(false); setImportRows([]) }} disabled={importing} className="bg-secondary border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-xs cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed">ביטול</button>
          </div>
          {/* Importing overlay */}
          {importing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-[var(--c-0-10)]/80 backdrop-blur-sm z-10">
              <Loader2 size={32} className="animate-spin text-[var(--accent-blue)] mb-3" />
              <div className="text-[15px] text-[var(--accent-blue)] font-semibold">
                מייבא הוצאות...
              </div>
              <div className="text-[12px] text-[var(--text-secondary)] mt-1">
                נא להמתין, הפעולה עשויה לקחת מספר שניות
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
