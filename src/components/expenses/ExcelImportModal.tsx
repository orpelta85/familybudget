'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Upload, X, FileSpreadsheet, CheckCircle2, AlertCircle, HelpCircle, Sparkles, Loader2 } from 'lucide-react'
import type { RawExpenseRow } from '@/lib/excel-import'
import type { BudgetCategory, SinkingFund } from '@/lib/types'
import { SmartCategorizeButton } from './SmartCategorizeButton'

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
  categoryRules?: Array<{ merchant_pattern: string; category_id: number | null; confidence: number; times_used: number }>
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

function formatDate(d: string | undefined): string {
  if (!d) return '-'
  // Excel serial date (e.g. 46174.00 or 46174)
  const num = parseFloat(d)
  if (!isNaN(num) && num > 30000 && num < 60000 && /^\d{4,5}(\.\d+)?$/.test(d.trim())) {
    const epoch = new Date(1899, 11, 30)
    const dt = new Date(epoch.getTime() + num * 86400000)
    return `${dt.getDate()}/${dt.getMonth() + 1}`
  }
  // ISO date string or Date object toString
  const iso = Date.parse(d)
  if (!isNaN(iso)) {
    const dt = new Date(iso)
    return `${dt.getDate()}/${dt.getMonth() + 1}`
  }
  // DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY
  const m = d.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/)
  if (m) return `${m[1]}/${m[2]}`
  return d.substring(0, 8)
}

export function ExcelImportModal({
  importRows, setImportRows, showImport, setShowImport,
  importing, detectedFormat, importTotal,
  categories, funds, categoryRules,
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

  function applyBulkShared(isShared: boolean) {
    if (selectedRows.size === 0) return
    setImportRows(prev => prev.map((r, i) => selectedRows.has(i) ? { ...r, is_shared: isShared } : r))
  }

  function applyBulkFund(fundName: string) {
    if (selectedRows.size === 0) return
    setImportRows(prev => prev.map((r, i) => selectedRows.has(i) ? { ...r, fund_name: fundName || undefined } : r))
  }

  const validCount = importRows.filter(r => (r.categoryId || r.category) && r.amount > 0).length

  const sessionNewCategories = Array.from(new Set(
    importRows
      .map(r => r.categoryId)
      .filter((c): c is string => !!c && c.startsWith('__new__'))
      .map(c => c.replace('__new__', ''))
  )).sort()

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
          {parsingFiles && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-[var(--c-0-10)]/80 backdrop-blur-sm z-10">
              <Loader2 size={28} className="animate-spin text-[var(--accent-blue)] mb-2" />
              <div className="text-[14px] text-[var(--accent-blue)] font-semibold">קורא קבצים...</div>
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
        <div className="relative bg-card border border-[var(--accent-blue)] rounded-xl p-4 mb-4 min-w-0 overflow-x-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={14} className="text-primary" />
              <span className="font-semibold text-[13px]">{importRows.length} שורות מ-Excel</span>
              {detectedFormat && (
                <span className="text-[11px] bg-[var(--c-blue-0-22)] text-[var(--c-blue-0-75)] px-2 py-0.5 rounded-md font-medium">
                  {detectedFormat}
                </span>
              )}
            </div>
            <button onClick={() => setShowImport(false)} aria-label="סגור ייבוא" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-2 min-w-9 min-h-9 text-muted-foreground"><X size={14} /></button>
          </div>

          {/* Summary bar */}
          {(() => {
            const autoMatched = importRows.filter(r => (r.matchConfidence ?? 0) >= 0.8).length
            const suggestions = importRows.filter(r => (r.matchConfidence ?? 0) >= 0.3 && (r.matchConfidence ?? 0) < 0.8).length
            const needsInput = importRows.filter(r => (r.matchConfidence ?? 0) < 0.3).length
            const newCats = new Set(importRows.filter(r => r.categoryId.startsWith('__new__')).map(r => r.category)).size
            return (
              <div className="flex flex-wrap items-center gap-3 mb-3 text-[12px] text-[var(--text-secondary)] bg-[var(--c-0-14)] rounded-lg px-3 py-2">
                <span>סה&quot;כ: <strong className="text-[var(--text-heading)]">{formatCurrency(importTotal)}</strong></span>
                <span className="text-[var(--c-0-45)]">|</span>
                {autoMatched > 0 && <span className="flex items-center gap-1 text-[var(--c-teal-0-75)]"><CheckCircle2 size={12} /> {autoMatched} זוהו</span>}
                {suggestions > 0 && <span className="flex items-center gap-1 text-[var(--accent-orange)]"><AlertCircle size={12} /> {suggestions} הצעות</span>}
                {needsInput > 0 && <span className="flex items-center gap-1 text-[var(--c-red-0-65)]"><HelpCircle size={12} /> {needsInput} ללא קטגוריה</span>}
                {newCats > 0 && <span className="text-[var(--accent-orange)]">{newCats} קטגוריות חדשות</span>}
                {suggestions > 0 && onAcceptAllSuggestions && (
                  <>
                    <span className="text-[var(--c-0-45)]">|</span>
                    <button type="button" onClick={onAcceptAllSuggestions}
                      className="flex items-center gap-1 bg-[var(--c-teal-0-22)] border border-[var(--c-teal-0-40)] text-[var(--c-teal-0-75)] rounded-md px-2 py-0.5 text-[11px] font-semibold cursor-pointer hover:bg-[var(--c-teal-0-30)] transition-colors">
                      <Sparkles size={11} /> קבל הכל
                    </button>
                  </>
                )}
                <span className="text-[var(--c-0-45)]">|</span>
                <SmartCategorizeButton importRows={importRows} setImportRows={setImportRows} categories={categories} categoryRules={categoryRules} />
              </div>
            )
          })()}

          {/* Bulk actions bar */}
          {selectedRows.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3 bg-[var(--c-blue-0-18)] rounded-lg px-3 py-2">
              <span className="text-[12px] text-[var(--c-blue-0-75)] font-semibold">{selectedRows.size} נבחרו</span>
              <span className="text-[var(--c-0-30)]">|</span>
              {/* Bulk category */}
              <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}
                className="bg-[var(--c-0-20)] border border-[var(--border-light)] rounded-md px-1.5 py-1 text-[11px] text-inherit cursor-pointer">
                <option value="">קטגוריה...</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {sessionNewCategories.length > 0 && (
                  <optgroup label="חדשות (ייוצרו בשמירה)">
                    {sessionNewCategories.map(name => (
                      <option key={`new-${name}`} value={`__new__${name}`}>{name} (חדשה)</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button onClick={applyBulkCategory} disabled={!bulkCategory}
                className="bg-[var(--accent-blue)] border-none rounded-md px-2 py-1 text-[10px] font-semibold text-[var(--c-0-10)] cursor-pointer disabled:opacity-40">
                החל
              </button>
              <span className="text-[var(--c-0-30)]">|</span>
              {/* Bulk personal/shared */}
              <button onClick={() => applyBulkShared(false)}
                className="bg-secondary border border-[var(--border-light)] rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground cursor-pointer hover:bg-[var(--c-0-25)]">
                אישי
              </button>
              <button onClick={() => applyBulkShared(true)}
                className="bg-[var(--c-purple-0-22)] border border-[var(--c-purple-0-40)] rounded-md px-2 py-1 text-[10px] font-semibold text-[var(--c-purple-0-75)] cursor-pointer hover:bg-[var(--c-purple-0-30)]">
                משותף
              </button>
              <span className="text-[var(--c-0-30)]">|</span>
              {/* Bulk fund */}
              <select onChange={e => applyBulkFund(e.target.value)} defaultValue="" aria-label="שינוי קרן בבולק"
                className="bg-[var(--c-0-20)] border border-[var(--border-light)] rounded-md px-1.5 py-1 text-[11px] text-inherit cursor-pointer">
                <option value="" disabled>קרן...</option>
                <option value="">ללא קרן</option>
                {funds?.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              </select>
              <span className="text-[var(--c-0-30)]">|</span>
              <button onClick={() => setSelectedRows(new Set())}
                className="bg-transparent border-none text-[var(--text-muted)] text-[11px] cursor-pointer underline">
                נקה
              </button>
            </div>
          )}

          {/* Select all + Rows list */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <input
              type="checkbox"
              aria-label="בחר הכל"
              checked={selectedRows.size === importRows.length && importRows.length > 0}
              onChange={() => {
                if (selectedRows.size === importRows.length) {
                  setSelectedRows(new Set())
                } else {
                  setSelectedRows(new Set(importRows.map((_, i) => i)))
                }
              }}
              className="cursor-pointer w-3.5 h-3.5"
            />
            <span className="text-[11px] text-[var(--text-muted)]">
              {selectedRows.size === importRows.length ? 'בטל בחירה' : 'בחר הכל'}
            </span>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {importRows.map((row, i) => {
              const isAutoMatched = row.categoryId && !row.categoryId.startsWith('__new__') && row.category
              const isNewCat = row.categoryId?.startsWith('__new__')
              const conf = row.matchConfidence ?? 0
              const dateStr = formatDate(row.date)
              return (
                <div key={i} className="py-1.5 px-1 border-b border-[var(--c-0-12)] hover:bg-[var(--c-0-10)] transition-colors text-[12px]">
                  {/* Desktop: single row | Mobile: 2 lines */}
                  {/* Line 1: checkbox + confidence + description + amount (mobile: full width) */}
                  <div className="flex items-center gap-2">
                    {/* Checkbox */}
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
                    {/* Confidence dot */}
                    <span
                      className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                        conf >= 0.8 ? 'bg-[var(--c-teal-0-65)]' : conf >= 0.3 ? 'bg-[var(--accent-orange)]' : 'bg-[var(--c-red-0-55)]'
                      }`}
                    />
                    {/* Date - hidden on mobile line 1, shown on desktop */}
                    <span className="hidden md:inline shrink-0 text-[10px] text-[var(--c-0-55)] font-mono w-[32px] text-center" title={row.date}>
                      {dateStr}
                    </span>
                    {/* Description - takes available space */}
                    <span className="text-[var(--text-heading)] truncate min-w-[120px] max-w-[200px] md:max-w-[300px]" title={row.description}>
                      {row.description}
                    </span>
                    {/* Source badge */}
                    {row.sourceFile && (
                      <span className="hidden lg:inline shrink-0 text-[9px] bg-[var(--c-0-18)] text-[var(--c-0-50)] px-1 py-0.5 rounded" title={row.sourceFile}>
                        {row.sourceFile.length > 10 ? row.sourceFile.substring(0, 10) + '..' : row.sourceFile}
                      </span>
                    )}
                    {/* Installment */}
                    {row.installmentInfo && (
                      <span className="shrink-0 text-[9px] bg-[var(--c-purple-0-22)] text-[var(--c-purple-0-75)] px-1 py-0.5 rounded whitespace-nowrap">
                        {row.installmentInfo}
                      </span>
                    )}
                    {/* Amount */}
                    <span className="shrink-0 w-[60px] text-left font-semibold text-[var(--accent-orange)] tabular-nums">
                      {formatCurrency(row.amount)}
                    </span>
                    {/* Desktop-only: shared toggle, category, fund inline */}
                    {/* Personal/Shared toggle */}
                    <button
                      onClick={() => setImportRows(p => p.map((r, j) => j === i ? { ...r, is_shared: !r.is_shared } : r))}
                      className={`hidden md:inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer whitespace-nowrap w-[48px] text-center ${
                        row.is_shared
                          ? 'bg-[var(--c-purple-0-22)] border border-[var(--c-purple-0-40)] text-[var(--c-purple-0-75)]'
                          : 'bg-secondary border border-[var(--border-light)] text-muted-foreground'
                      }`}
                    >
                      {row.is_shared ? 'משותף' : 'אישי'}
                    </button>
                    {/* Category - desktop */}
                    <select
                      value={row.categoryId || ''}
                      onChange={e => {
                        const val = e.target.value
                        if (val === '__manual__') {
                          showTextInput('שם קטגוריה חדשה:').then(name => {
                            if (name?.trim()) {
                              setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: `__new__${name.trim()}`, category: name.trim() } : r))
                            }
                          })
                        } else if (val.startsWith('__new__')) {
                          const name = val.replace('__new__', '')
                          setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: val, category: name } : r))
                        } else {
                          const text = e.target.selectedOptions[0]?.text || ''
                          setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: val, category: text } : r))
                        }
                      }}
                      aria-label="קטגוריה"
                      className={`hidden md:inline shrink-0 w-[110px] bg-[var(--c-0-20)] border rounded px-1 py-0.5 text-[11px] text-inherit outline-none cursor-pointer appearance-auto ${
                        isAutoMatched ? 'border-[var(--c-teal-0-50)] text-[var(--c-teal-0-75)]'
                        : isNewCat ? 'border-[var(--c-orange-0-50)] text-[var(--c-orange-0-80)]'
                        : 'border-[var(--c-0-40)] text-[var(--text-secondary)]'
                      }`}>
                      {!row.categoryId && <option value="">— בחר —</option>}
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      {sessionNewCategories.length > 0 && (
                        <optgroup label="חדשות (ייוצרו בשמירה)">
                          {sessionNewCategories.map(name => (
                            <option key={`new-${name}`} value={`__new__${name}`}>{name} (חדשה)</option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__manual__">+ חדשה...</option>
                    </select>
                    {/* Fund - desktop */}
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
                      aria-label="קרן"
                      className={`hidden md:inline shrink-0 w-[85px] bg-[var(--c-0-20)] border rounded px-1 py-0.5 text-[11px] text-inherit outline-none cursor-pointer appearance-auto ${
                        row.fund_name?.startsWith('__new_fund__') ? 'border-[var(--c-teal-0-50)] text-[var(--c-teal-0-75)]' : 'border-[var(--c-0-30)]'
                      }`}
                    >
                      {row.fund_name?.startsWith('__new_fund__') && <option value="__new_fund__">{row.fund_name.replace('__new_fund__', '')} (חדש)</option>}
                      <option value="">ללא קרן</option>
                      {funds?.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                      <option value="__manual_fund__">+ חדשה...</option>
                    </select>
                  </div>
                  {/* Line 2: mobile only - date + shared toggle + category + fund */}
                  <div className="flex md:hidden items-center gap-1.5 mt-1 pr-7">
                    {/* Date */}
                    <span className="shrink-0 text-[10px] text-[var(--c-0-55)] font-mono" title={row.date}>
                      {dateStr}
                    </span>
                    {/* Personal/Shared toggle */}
                    <button
                      onClick={() => setImportRows(p => p.map((r, j) => j === i ? { ...r, is_shared: !r.is_shared } : r))}
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold cursor-pointer whitespace-nowrap text-center ${
                        row.is_shared
                          ? 'bg-[var(--c-purple-0-22)] border border-[var(--c-purple-0-40)] text-[var(--c-purple-0-75)]'
                          : 'bg-secondary border border-[var(--border-light)] text-muted-foreground'
                      }`}
                    >
                      {row.is_shared ? 'משותף' : 'אישי'}
                    </button>
                    {/* Category */}
                    <select
                      value={row.categoryId || ''}
                      onChange={e => {
                        const val = e.target.value
                        if (val === '__manual__') {
                          showTextInput('שם קטגוריה חדשה:').then(name => {
                            if (name?.trim()) {
                              setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: `__new__${name.trim()}`, category: name.trim() } : r))
                            }
                          })
                        } else if (val.startsWith('__new__')) {
                          const name = val.replace('__new__', '')
                          setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: val, category: name } : r))
                        } else {
                          const text = e.target.selectedOptions[0]?.text || ''
                          setImportRows(p => p.map((r, j) => j === i ? { ...r, categoryId: val, category: text } : r))
                        }
                      }}
                      aria-label="קטגוריה"
                      className={`min-w-0 flex-1 bg-[var(--c-0-20)] border rounded px-1 py-0.5 text-[11px] text-inherit outline-none cursor-pointer appearance-auto ${
                        isAutoMatched ? 'border-[var(--c-teal-0-50)] text-[var(--c-teal-0-75)]'
                        : isNewCat ? 'border-[var(--c-orange-0-50)] text-[var(--c-orange-0-80)]'
                        : 'border-[var(--c-0-40)] text-[var(--text-secondary)]'
                      }`}>
                      {!row.categoryId && <option value="">— בחר —</option>}
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      {sessionNewCategories.length > 0 && (
                        <optgroup label="חדשות (ייוצרו בשמירה)">
                          {sessionNewCategories.map(name => (
                            <option key={`new-${name}`} value={`__new__${name}`}>{name} (חדשה)</option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__manual__">+ חדשה...</option>
                    </select>
                    {/* Fund */}
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
                      aria-label="קרן"
                      className={`shrink-0 w-[80px] bg-[var(--c-0-20)] border rounded px-1 py-0.5 text-[11px] text-inherit outline-none cursor-pointer appearance-auto ${
                        row.fund_name?.startsWith('__new_fund__') ? 'border-[var(--c-teal-0-50)] text-[var(--c-teal-0-75)]' : 'border-[var(--c-0-30)]'
                      }`}
                    >
                      {row.fund_name?.startsWith('__new_fund__') && <option value="__new_fund__">{row.fund_name.replace('__new_fund__', '')} (חדש)</option>}
                      <option value="">ללא קרן</option>
                      {funds?.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                      <option value="__manual_fund__">+ חדשה...</option>
                    </select>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            <button onClick={onImportSave} disabled={importing} className={`flex-1 border-none rounded-lg py-2.5 text-primary-foreground font-semibold text-[13px] ${importing ? 'bg-[var(--c-blue-0-40)] cursor-wait' : 'bg-primary cursor-pointer'}`}>
              {importing ? 'מייבא... נא להמתין' : `ייבא ${validCount} שורות`}
            </button>
            <button onClick={() => { setShowImport(false); setImportRows([]) }} disabled={importing} className="bg-secondary border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-xs cursor-pointer outline-none disabled:opacity-40 disabled:cursor-not-allowed">ביטול</button>
          </div>

          {/* Importing overlay */}
          {importing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-[var(--c-0-10)]/80 backdrop-blur-sm z-10">
              <Loader2 size={32} className="animate-spin text-[var(--accent-blue)] mb-3" />
              <div className="text-[15px] text-[var(--accent-blue)] font-semibold">מייבא הוצאות...</div>
              <div className="text-[12px] text-[var(--text-secondary)] mt-1">נא להמתין, הפעולה עשויה לקחת מספר שניות</div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
