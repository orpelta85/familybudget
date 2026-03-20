'use client'

import { useUser } from '@/lib/queries/useUser'
import { useBudgetCategories, usePersonalExpenses, useUpdateCategoryTarget } from '@/lib/queries/useExpenses'
import { useSharedExpenses } from '@/lib/queries/useShared'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome, useFamilyIncome } from '@/lib/queries/useIncome'
import { formatCurrency } from '@/lib/utils'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { BarChart3, Inbox, Check, Clock, ChevronDown, Users, Download } from 'lucide-react'
import { toast } from 'sonner'
import { PageInfo } from '@/components/ui/PageInfo'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { PAGE_TIPS } from '@/lib/page-tips'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import type { BudgetCategory } from '@/lib/types'

function getBarColor(pct: number): string {
  if (pct > 0.9) return 'oklch(0.62 0.22 27)'
  if (pct > 0.7) return 'oklch(0.72 0.18 55)'
  return 'oklch(0.65 0.18 250)'
}

// Shared category enum → fixed budget category name mapping
const SHARED_TO_FIXED: Record<string, string> = {
  rent: 'שכירות',
  property_tax: 'ארנונה',
  electricity: 'חשמל',
  water_gas: 'מים+גז',
  building_committee: 'ועד בית',
  home_insurance: 'ביטוחים',
  internet: 'מנויים',
  netflix: 'מנויים',
  spotify: 'מנויים',
}

// Notes-based mapping for shared expenses stored as 'misc'
// Maps note substrings to fixed budget category names
const NOTES_TO_FIXED: [RegExp, string][] = [
  [/שכירות/i, 'שכירות'],
  [/ארנונה/i, 'ארנונה'],
  [/חשמל/i, 'חשמל'],
  [/אינטרגז|מים|גז/i, 'מים+גז'],
  [/ועד בית/i, 'ועד בית'],
  [/מנורה|ביטוח|הכשרה/i, 'ביטוחים'],
  [/הלוואת רכב/i, 'הלוואת רכב'],
  [/נטפליקס|ספוטיפיי|ALLDEBRID/i, 'מנויים'],
]

function resolveSharedToFixed(category: string, notes?: string): string | null {
  const mapped = SHARED_TO_FIXED[category]
  if (mapped) return mapped
  if (notes) {
    for (const [pattern, name] of NOTES_TO_FIXED) {
      if (pattern.test(notes)) return name
    }
  }
  return null
}

// Variable category grouping
interface CategoryGroup {
  key: string
  label: string
  categoryNames: string[]
}

const VARIABLE_GROUPS: CategoryGroup[] = [
  { key: 'food', label: 'אוכל', categoryNames: ['מכולת', 'אוכל בחוץ'] },
  { key: 'leisure', label: 'פנאי ובילויים', categoryNames: ['בילויים', 'מוזיקה', 'ספורט'] },
  { key: 'personal', label: 'פיתוח אישי', categoryNames: ['אימון אישי', 'טיפוח', 'רפואה', 'בריאות'] },
  { key: 'shopping', label: 'קניות', categoryNames: ['בגדים', 'מוצרים לבית', 'פארם'] },
  { key: 'pets', label: 'חיות מחמד', categoryNames: ['כלבים', 'דוגווקרס'] },
  { key: 'transport', label: 'תחבורה', categoryNames: ['תחבורה'] },
  { key: 'savings', label: 'חיסכון', categoryNames: ['השקעות'] },
  { key: 'other', label: 'שונות', categoryNames: ['שונות'] },
]

export default function BudgetPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const currentPeriod = useCurrentPeriod()
  const { data: periods } = usePeriods()
  const updateTarget = useUpdateCategoryTarget()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const { familyId, members } = useFamilyContext()
  const familyMemberIds = useMemo(() => members.map(m => m.user_id), [members])
  const { data: familyIncome } = useFamilyIncome(selectedPeriodId ?? currentPeriod?.id, familyMemberIds, familyMemberIds.length > 0)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const activePeriodId = selectedPeriodId ?? currentPeriod?.id
  const selectedPeriod = useMemo(() => periods?.find(p => p.id === selectedPeriodId), [periods, selectedPeriodId])

  const { data: categories } = useBudgetCategories(user?.id)
  const { data: expenses } = usePersonalExpenses(activePeriodId, user?.id)
  const { data: sharedExpenses } = useSharedExpenses(activePeriodId, familyId)
  const { data: income } = useIncome(activePeriodId, user?.id)

  if (loading || !user) return <TableSkeleton rows={8} />

  // Split categories by type
  const fixedCats = (categories ?? []).filter(c => c.type === 'fixed')
  const allNonFixed = (categories ?? []).filter(c => c.type !== 'fixed')

  // Personal spending by category
  const spendByCat = (expenses ?? []).reduce<Record<number, number>>((acc, e) => {
    acc[e.category_id] = (acc[e.category_id] ?? 0) + e.amount
    return acc
  }, {})

  // Shared expenses: map to fixed categories by name, accumulate my_share
  const sharedSpendByCatName = (sharedExpenses ?? []).reduce<Record<string, number>>((acc, se) => {
    const fixedName = resolveSharedToFixed(se.category, se.notes)
    if (fixedName) {
      acc[fixedName] = (acc[fixedName] ?? 0) + se.my_share
    }
    return acc
  }, {})

  // Unmatched shared expenses (category not mapped to a fixed budget category)
  const unmatchedSharedTotal = (sharedExpenses ?? []).reduce((sum, se) => {
    return resolveSharedToFixed(se.category, se.notes) ? sum : sum + se.my_share
  }, 0)

  // Combined spend for fixed categories: personal + shared
  function fixedSpend(cat: BudgetCategory): number {
    return (spendByCat[cat.id] ?? 0) + (sharedSpendByCatName[cat.name] ?? 0)
  }

  // Group variable categories
  const groupedVariables = useMemo(() => {
    return VARIABLE_GROUPS.map(group => {
      const cats = group.categoryNames
        .map(name => allNonFixed.find(c => c.name === name))
        .filter((c): c is BudgetCategory => !!c)
      return { ...group, cats }
    }).filter(g => g.cats.length > 0)
  }, [allNonFixed])

  // Categories not in any group (catch-all)
  const groupedNames = new Set(VARIABLE_GROUPS.flatMap(g => g.categoryNames))
  const ungroupedCats = allNonFixed.filter(c => !groupedNames.has(c.name))

  // Totals — use family income if available (this is "תקציב משפחתי")
  const familyTotalIncome = (familyIncome ?? []).reduce((s, m) => s + m.total, 0)
  const personalIncome = income ? (income.salary + income.bonus + income.other) : 0
  const totalIncome = familyTotalIncome > 0 ? familyTotalIncome : personalIncome
  const totalFixedPersonal = fixedCats.reduce((s, c) => s + fixedSpend(c), 0)
  const totalFixed = totalFixedPersonal + unmatchedSharedTotal
  const totalVariableActual = allNonFixed.reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0)
  const totalVariableBudget = allNonFixed.reduce((s, c) => s + c.monthly_target, 0)
  const remaining = totalIncome - totalFixed - totalVariableActual

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function saveTarget(catId: number) {
    const val = Number(editValue)
    if (!val || val < 0) { setEditingId(null); return }
    await updateTarget.mutateAsync({ id: catId, monthly_target: val, user_id: user!.id })
    toast.success('יעד עודכן')
    setEditingId(null)
  }

  const fixedPaidCount = fixedCats.filter(c => fixedSpend(c) > 0).length

  async function handleExportBudget() {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const rows: (string | number)[][] = [
        ['תקציב משפחתי', selectedPeriod?.label ?? ''],
        [],
        ['הכנסה נטו', totalIncome],
        ['סה"כ קבועות', totalFixed],
        ['סה"כ משתנות', totalVariableActual],
        ['תקציב משתנות', totalVariableBudget],
        ['נשאר פנוי', remaining],
        [],
        ['הוצאות קבועות'],
        ['קטגוריה', 'תקציב', 'בפועל', '% ניצול'],
      ]
      fixedCats.forEach(c => {
        const spent = fixedSpend(c)
        const pct = c.monthly_target > 0 ? Math.round((spent / c.monthly_target) * 100) : 0
        rows.push([c.name, c.monthly_target, spent, `${pct}%`])
      })
      rows.push([], ['הוצאות משתנות'], ['קטגוריה', 'תקציב', 'בפועל', '% ניצול'])
      allNonFixed.forEach(c => {
        const spent = spendByCat[c.id] ?? 0
        const pct = c.monthly_target > 0 ? Math.round((spent / c.monthly_target) * 100) : 0
        rows.push([c.name, c.monthly_target, spent, `${pct}%`])
      })
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws, 'תקציב')
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `תקציב_${selectedPeriod?.label ?? 'export'}.xlsx`; a.click()
      URL.revokeObjectURL(url)
      toast.success('הקובץ הורד')
    } catch { toast.error('שגיאה בייצוא') }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" />
          <h1 className="text-xl font-bold tracking-tight">תקציב משפחתי</h1>
          <PageInfo {...PAGE_TIPS.budget} />
        </div>
        <button onClick={handleExportBudget} className="flex items-center gap-1.5 bg-[oklch(0.20_0.04_250)] border border-[oklch(0.32_0.08_250)] rounded-lg px-3 py-[7px] text-[oklch(0.65_0.18_250)] text-[13px] font-medium cursor-pointer">
          <Download size={13} /> הורד לאקסל
        </button>
      </div>
      <p className="text-muted-foreground text-[13px] mb-5">
        {selectedPeriod?.label ?? currentPeriod?.label ?? '...'}
      </p>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* KPI Cards */}
      <div className="grid-kpi mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide flex items-center gap-1">הכנסה נטו <InfoTooltip body="הכנסה אחרי מס ונכויים — הסכום שבאמת נכנס לחשבון" /></div>
          <div className="text-[22px] font-bold text-primary leading-none">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">סה״כ קבועות</div>
          <div className="text-[22px] font-bold text-[oklch(0.65_0.18_250)] leading-none">{formatCurrency(totalFixed)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">סה״כ משתנות בפועל</div>
          <div className="text-[22px] font-bold text-[oklch(0.72_0.18_55)] leading-none">{formatCurrency(totalVariableActual)}</div>
          {totalVariableBudget > 0 && (
            <div className="text-[11px] text-muted-foreground mt-1.5">
              מתוך {formatCurrency(totalVariableBudget)} תקציב
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide flex items-center gap-1">נשאר פנוי <InfoTooltip body="הכנסה פחות הוצאות (קבועות + משתנות). זה מה שנשאר לחיסכון" /></div>
          <div className={`text-[22px] font-bold leading-none ${remaining >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>
            {formatCurrency(remaining)}
          </div>
          {totalIncome > 0 && (
            <div className="text-[11px] text-muted-foreground mt-1.5">
              {Math.round((remaining / totalIncome) * 100)}% מההכנסה
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout: Right = Fixed, Left = Variable */}
      {!categories?.length
        ? (
          <div className="bg-card border border-border rounded-xl text-center p-10">
            <Inbox size={36} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2.5" />
            <div className="text-muted-foreground text-sm">אין קטגוריות תקציב</div>
          </div>
        )
        : (
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Right column: Fixed expenses */}
            <div className="card-transition bg-card border border-border rounded-xl p-5">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-[oklch(0.22_0.01_250)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.65 0.18 250)' }} />
                  <span className="font-bold text-sm">הוצאות קבועות</span>
                  <InfoTooltip body="הוצאות שלא משתנות מחודש לחודש — שכירות, ביטוח, הלוואות" />
                  <span className="text-[11px] text-muted-foreground bg-secondary rounded px-1.5 py-px">{fixedCats.length}</span>
                </div>
                <div className="text-[13px] font-bold text-[oklch(0.80_0.01_250)]">
                  {formatCurrency(totalFixed)}
                </div>
              </div>

              {fixedCats.length === 0 && unmatchedSharedTotal === 0 ? (
                <div className="text-muted-foreground text-sm text-center py-6">אין הוצאות קבועות</div>
              ) : (
                <div className="space-y-1">
                  {fixedCats.map(cat => {
                    const spent = fixedSpend(cat)
                    const isPaid = spent > 0
                    const hasShared = (sharedSpendByCatName[cat.name] ?? 0) > 0

                    return (
                      <div
                        key={cat.id}
                        className="flex justify-between items-center py-2.5 px-2 rounded-lg hover:bg-[oklch(0.18_0.01_250)] transition-colors duration-150"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isPaid ? 'bg-[oklch(0.70_0.18_145)]' : 'bg-[oklch(0.25_0.01_250)]'}`}>
                            {isPaid
                              ? <Check size={12} className="text-[oklch(0.15_0_0)]" />
                              : <Clock size={12} className="text-[oklch(0.45_0.01_250)]" />
                            }
                          </div>
                          <span className={`text-[13px] font-medium ${isPaid ? 'text-[oklch(0.82_0.01_250)]' : 'text-[oklch(0.50_0.01_250)]'}`}>
                            {cat.name}
                          </span>
                          {hasShared && (
                            <Users size={11} className="text-[oklch(0.50_0.01_250)]" />
                          )}
                        </div>
                        <span className={`text-[13px] font-semibold ${isPaid ? 'text-[oklch(0.82_0.01_250)]' : 'text-[oklch(0.40_0.01_250)]'}`}>
                          {isPaid ? formatCurrency(spent) : '—'}
                        </span>
                      </div>
                    )
                  })}

                  {/* Unmatched shared expenses */}
                  {unmatchedSharedTotal > 0 && (
                    <div className="flex justify-between items-center py-2.5 px-2 rounded-lg hover:bg-[oklch(0.18_0.01_250)] transition-colors duration-150">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center bg-[oklch(0.70_0.18_145)]">
                          <Users size={12} className="text-[oklch(0.15_0_0)]" />
                        </div>
                        <span className="text-[13px] font-medium text-[oklch(0.82_0.01_250)]">
                          הוצאות משותפות
                        </span>
                      </div>
                      <span className="text-[13px] font-semibold text-[oklch(0.82_0.01_250)]">
                        {formatCurrency(unmatchedSharedTotal)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Fixed total bar */}
              {(fixedCats.length > 0 || unmatchedSharedTotal > 0) && (
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-[oklch(0.22_0.01_250)]">
                  <span className="text-[12px] text-muted-foreground">
                    {fixedPaidCount}/{fixedCats.length} שולמו
                  </span>
                  <span className="text-[14px] font-bold text-[oklch(0.65_0.18_250)]">
                    {formatCurrency(totalFixed)}
                  </span>
                </div>
              )}
            </div>

            {/* Left column: Variable expenses — grouped */}
            <div className="card-transition bg-card border border-border rounded-xl p-5">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-[oklch(0.22_0.01_250)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.72 0.18 55)' }} />
                  <span className="font-bold text-sm">הוצאות משתנות</span>
                  <InfoTooltip body="הוצאות שמשתנות — אוכל, בילויים, קניות. כאן אפשר לחסוך!" />
                  <span className="text-[11px] text-muted-foreground bg-secondary rounded px-1.5 py-px">{allNonFixed.length}</span>
                </div>
                <div className="text-[13px]">
                  <span className="font-bold text-[oklch(0.80_0.01_250)]">{formatCurrency(totalVariableActual)}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-muted-foreground">{formatCurrency(totalVariableBudget)}</span>
                </div>
              </div>

              {allNonFixed.length === 0 ? (
                <div className="text-muted-foreground text-sm text-center py-6">אין הוצאות משתנות</div>
              ) : (
                <div className="space-y-2">
                  {groupedVariables.map(group => {
                    const isCollapsed = collapsedGroups[group.key] ?? false
                    const groupActual = group.cats.reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0)
                    const groupBudget = group.cats.reduce((s, c) => s + c.monthly_target, 0)
                    const groupPct = groupBudget > 0 ? groupActual / groupBudget : 0
                    const groupBarColor = getBarColor(groupPct)

                    return (
                      <div key={group.key} className="rounded-lg border border-[oklch(0.20_0.01_250)] overflow-hidden">
                        {/* Group header */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          className="w-full flex items-center justify-between px-3 py-2.5 bg-[oklch(0.15_0.005_250)] hover:bg-[oklch(0.17_0.005_250)] transition-colors duration-150 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-[oklch(0.50_0.01_250)] transition-transform duration-200" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                              <ChevronDown size={14} />
                            </div>
                            <span className="font-semibold text-[13px] text-[oklch(0.82_0.01_250)]">{group.label}</span>
                            <span className="text-[11px] text-muted-foreground bg-[oklch(0.20_0.01_250)] rounded px-1.5 py-px">{group.cats.length}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-[4px] rounded-sm bg-[oklch(0.20_0.01_250)] overflow-hidden">
                              <div className="h-full rounded-sm transition-[width] duration-400 ease-out" style={{ width: `${Math.min(groupPct * 100, 100)}%`, background: groupBarColor }} />
                            </div>
                            <div className="text-[12px]">
                              <span className="font-semibold" style={{ color: groupBarColor }}>{formatCurrency(groupActual)}</span>
                              {groupBudget > 0 && (
                                <>
                                  <span className="text-muted-foreground mx-0.5">/</span>
                                  <span className="text-muted-foreground">{formatCurrency(groupBudget)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Group content */}
                        {!isCollapsed && (
                          <div className="px-3 py-1.5">
                            {group.cats.map(cat => {
                              const spent = spendByCat[cat.id] ?? 0
                              const pct = cat.monthly_target > 0 ? spent / cat.monthly_target : 0
                              const pctDisplay = Math.round(pct * 100)
                              const isEditing = editingId === cat.id
                              const barColor = getBarColor(pct)
                              const catRemaining = cat.monthly_target - spent

                              return (
                                <div key={cat.id} className="py-2 border-b border-[oklch(0.18_0.005_250)] last:border-b-0">
                                  {/* Row 1: Name + remaining */}
                                  <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-medium text-[12px] text-[oklch(0.75_0.01_250)]">{cat.name}</span>
                                    {cat.monthly_target > 0 && (
                                      <span className={`text-[11px] font-medium ${catRemaining >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>
                                        {catRemaining >= 0 ? `נותר ${formatCurrency(catRemaining)}` : `חריגה ${formatCurrency(Math.abs(catRemaining))}`}
                                      </span>
                                    )}
                                  </div>
                                  {/* Row 2: Actual / Target */}
                                  <div className="flex justify-between items-baseline mb-1">
                                    <div className="flex items-baseline gap-1 text-[12px]">
                                      <span className="font-semibold" style={{ color: barColor }}>{formatCurrency(spent)}</span>
                                      <span className="text-muted-foreground">/</span>
                                      {isEditing ? (
                                        <input
                                          autoFocus
                                          type="number"
                                          value={editValue}
                                          onChange={e => setEditValue(e.target.value)}
                                          onBlur={() => saveTarget(cat.id)}
                                          onKeyDown={e => { if (e.key === 'Enter') saveTarget(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                                          className="w-20 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.45_0.18_250)] rounded-md px-1.5 py-0.5 text-inherit text-[12px] text-left"
                                        />
                                      ) : (
                                        <span
                                          onClick={() => { setEditingId(cat.id); setEditValue(String(cat.monthly_target)) }}
                                          title="לחץ לעריכה"
                                          className="text-muted-foreground cursor-pointer border-b border-dashed border-[oklch(0.38_0.01_250)] pb-px transition-colors duration-150 hover:text-[oklch(0.75_0.01_250)]"
                                        >
                                          {formatCurrency(cat.monthly_target)}
                                        </span>
                                      )}
                                    </div>
                                    {cat.monthly_target > 0 && (
                                      <span className="text-[10px] font-medium" style={{ color: barColor }}>
                                        {pctDisplay > 200 ? '200%+' : `${pctDisplay}%`}
                                      </span>
                                    )}
                                  </div>
                                  {/* Row 3: Mini progress bar */}
                                  <div className="h-[3px] rounded-sm bg-[oklch(0.20_0.01_250)] overflow-hidden">
                                    <div className="h-full rounded-sm transition-[width] duration-400 ease-out" style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Ungrouped categories fallback */}
                  {ungroupedCats.length > 0 && (
                    <div className="rounded-lg border border-[oklch(0.20_0.01_250)] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleGroup('_ungrouped')}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-[oklch(0.15_0.005_250)] hover:bg-[oklch(0.17_0.005_250)] transition-colors duration-150 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-[oklch(0.50_0.01_250)] transition-transform duration-200" style={{ transform: (collapsedGroups['_ungrouped'] ?? false) ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                            <ChevronDown size={14} />
                          </div>
                          <span className="font-semibold text-[13px] text-[oklch(0.82_0.01_250)]">אחר</span>
                          <span className="text-[11px] text-muted-foreground bg-[oklch(0.20_0.01_250)] rounded px-1.5 py-px">{ungroupedCats.length}</span>
                        </div>
                        <div className="text-[12px]">
                          <span className="font-semibold text-[oklch(0.65_0.18_250)]">
                            {formatCurrency(ungroupedCats.reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0))}
                          </span>
                        </div>
                      </button>
                      {!(collapsedGroups['_ungrouped'] ?? false) && (
                        <div className="px-3 py-1.5">
                          {ungroupedCats.map(cat => {
                            const spent = spendByCat[cat.id] ?? 0
                            const pct = cat.monthly_target > 0 ? spent / cat.monthly_target : 0
                            const barColor = getBarColor(pct)
                            const isEditing = editingId === cat.id
                            return (
                              <div key={cat.id} className="py-2 border-b border-[oklch(0.18_0.005_250)] last:border-b-0">
                                <div className="flex justify-between items-baseline mb-1">
                                  <span className="font-medium text-[12px] text-[oklch(0.75_0.01_250)]">{cat.name}</span>
                                </div>
                                <div className="flex justify-between items-baseline mb-1">
                                  <div className="flex items-baseline gap-1 text-[12px]">
                                    <span className="font-semibold" style={{ color: barColor }}>{formatCurrency(spent)}</span>
                                    <span className="text-muted-foreground">/</span>
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        type="number"
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onBlur={() => saveTarget(cat.id)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveTarget(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                                        className="w-20 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.45_0.18_250)] rounded-md px-1.5 py-0.5 text-inherit text-[12px] text-left"
                                      />
                                    ) : (
                                      <span
                                        onClick={() => { setEditingId(cat.id); setEditValue(String(cat.monthly_target)) }}
                                        title="לחץ לעריכה"
                                        className="text-muted-foreground cursor-pointer border-b border-dashed border-[oklch(0.38_0.01_250)] pb-px transition-colors duration-150 hover:text-[oklch(0.75_0.01_250)]"
                                      >
                                        {formatCurrency(cat.monthly_target)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-[3px] rounded-sm bg-[oklch(0.20_0.01_250)] overflow-hidden">
                                  <div className="h-full rounded-sm transition-[width] duration-400 ease-out" style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Variable total bar */}
              {allNonFixed.length > 0 && (
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-[oklch(0.22_0.01_250)]">
                  <span className="text-[12px] text-muted-foreground">
                    {totalVariableBudget > 0 ? `${Math.round((totalVariableActual / totalVariableBudget) * 100)}% מהתקציב` : ''}
                  </span>
                  <div className="text-[14px]">
                    <span className="font-bold text-[oklch(0.80_0.01_250)]">{formatCurrency(totalVariableActual)}</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-muted-foreground">{formatCurrency(totalVariableBudget)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div>
  )
}
