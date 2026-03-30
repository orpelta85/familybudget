'use client'

import { useUser } from '@/lib/queries/useUser'
import { useBudgetCategories, usePersonalExpenses, useFamilyPersonalExpenses, useUpdateCategoryTarget, useDeleteCategory, useUpdateCategoryScope, useInactiveCategories, useReactivateCategory, useAddBudgetCategory } from '@/lib/queries/useExpenses'
import { useSharedExpenses } from '@/lib/queries/useShared'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome, useFamilyIncome } from '@/lib/queries/useIncome'
import { formatCurrency } from '@/lib/utils'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { BarChart3, Inbox, Check, Clock, Users, Download, Pencil, ChevronDown, X, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageInfo } from '@/components/ui/PageInfo'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { PAGE_TIPS } from '@/lib/page-tips'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import type { BudgetCategory } from '@/lib/types'

function getBarColor(pct: number): string {
  if (pct > 0.9) return 'var(--accent-red)'
  if (pct > 0.7) return 'var(--accent-orange)'
  return 'var(--accent-blue)'
}

// Shared category enum → fixed budget category name mapping
const SHARED_TO_BUDGET: Record<string, string> = {
  // Fixed
  rent: 'שכירות',
  property_tax: 'ארנונה',
  electricity: 'חשבונות בית',
  water_gas: 'חשבונות בית',
  building_committee: 'חשבונות בית',
  home_insurance: 'ביטוחים',
  insurance: 'ביטוחים',
  internet: 'מנויים',
  netflix: 'מנויים',
  spotify: 'מנויים',
  car_loan: 'הלוואות',
  subscriptions: 'מנויים',
  // Variable
  groceries: 'מכולת',
  eating_out: 'אוכל בחוץ',
  entertainment: 'בילויים ופנאי',
  shopping: 'בגדים וקניות',
  pets: 'חיות מחמד',
  vacation: 'בילויים ופנאי',
  misc: 'שונות',
}

// Notes-based mapping for shared expenses
const NOTES_TO_BUDGET: [RegExp, string][] = [
  [/שכירות/i, 'שכירות'],
  [/ארנונה/i, 'ארנונה'],
  [/חשמל|מים|גז|ועד בית/i, 'חשבונות בית'],
  [/אינטרגז/i, 'חשבונות בית'],
  [/מנורה|ביטוח|הכשרה/i, 'ביטוחים'],
  [/הלוואת רכב|הלוואה/i, 'הלוואות'],
  [/נטפליקס|ספוטיפיי|ALLDEBRID/i, 'מנויים'],
]

function resolveSharedToFixed(category: string, notes?: string): string | null {
  const mapped = SHARED_TO_BUDGET[category]
  if (mapped) return mapped
  if (notes) {
    for (const [pattern, name] of NOTES_TO_BUDGET) {
      if (pattern.test(notes)) return name
    }
  }
  return null
}

export default function BudgetPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const currentPeriod = useCurrentPeriod()
  const { data: periods } = usePeriods()
  const updateTarget = useUpdateCategoryTarget()
  const deleteCategory = useDeleteCategory()
  const { data: inactiveCategories } = useInactiveCategories(user?.id)
  const reactivateCategory = useReactivateCategory()
  const addCategory = useAddBudgetCategory()
  const updateScope = useUpdateCategoryScope()
  const confirm = useConfirmDialog()
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<'fixed' | 'variable'>('variable')
  const [newCatTarget, setNewCatTarget] = useState('')
  const [newCatScope, setNewCatScope] = useState<'personal' | 'shared' | 'both'>('both')
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const { familyId, members } = useFamilyContext()
  const { viewMode } = useFamilyView()
  const splitFrac = useSplitFraction(user?.id)
  const isFamily = true // Budget is always family-level
  const familyMemberIds = useMemo(() => members.map(m => m.user_id), [members])
  const { data: familyIncome } = useFamilyIncome(selectedPeriodId ?? currentPeriod?.id, familyMemberIds, isFamily && familyMemberIds.length > 0)
  const { data: familyExpenses } = useFamilyPersonalExpenses(selectedPeriodId ?? currentPeriod?.id, familyMemberIds, isFamily && familyMemberIds.length > 0)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [fixedOpen, setFixedOpen] = useState(false)

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

  // Personal spending by category — aggregate family members' expenses only in family view
  const allFamilyExpensesList = useMemo(() => {
    if (isFamily && familyExpenses && familyExpenses.length > 0) {
      return familyExpenses.flatMap(m => m.expenses)
    }
    return expenses ?? []
  }, [isFamily, familyExpenses, expenses])

  // Flat lists
  const allNonFixed = useMemo(() => (categories ?? []).filter(c => c.type !== 'fixed'), [categories])

  if (loading || !user) return <TableSkeleton rows={8} />

  // Split categories by type
  const fixedCats = (categories ?? []).filter(c => c.type === 'fixed')
  const variableCats = (categories ?? []).filter(c => c.type === 'variable')
  const sinkingCats = (categories ?? []).filter(c => c.type === 'sinking')
  const savingsCats = (categories ?? []).filter(c => c.type === 'savings')

  const TYPE_SECTION_LABELS: Record<string, { label: string; color: string }> = {
    variable: { label: 'הוצאות משתנות', color: 'var(--accent-orange)' },
    sinking: { label: 'קרנות צבירה', color: 'var(--accent-teal)' },
    savings: { label: 'חיסכון', color: 'var(--accent-green)' },
  }
  const groupedNonFixed = [
    { type: 'variable', cats: variableCats },
    { type: 'sinking', cats: sinkingCats },
    { type: 'savings', cats: savingsCats },
  ].filter(g => g.cats.length > 0)

  const spendByCat = allFamilyExpensesList.reduce<Record<number, number>>((acc, e) => {
    acc[e.category_id] = (acc[e.category_id] ?? 0) + e.amount
    return acc
  }, {})

  // Shared expenses: map to budget categories by name — MY SHARE
  const allCats = categories ?? []
  const sharedSpendByCatName = (sharedExpenses ?? []).reduce<Record<string, number>>((acc, se) => {
    const catName = resolveSharedToFixed(se.category, se.notes)
    if (catName) {
      acc[catName] = (acc[catName] ?? 0) + Number(se.my_share ?? se.total_amount * splitFrac)
    }
    return acc
  }, {})

  // Shared expenses: FULL amount (both partners)
  const sharedSpendFullByCatName = (sharedExpenses ?? []).reduce<Record<string, number>>((acc, se) => {
    const catName = resolveSharedToFixed(se.category, se.notes)
    if (catName) {
      acc[catName] = (acc[catName] ?? 0) + Number(se.total_amount)
    }
    return acc
  }, {})

  // Unmatched shared expenses
  const unmatchedSharedTotal = (sharedExpenses ?? []).reduce((sum, se) => {
    return resolveSharedToFixed(se.category, se.notes) ? sum : sum + Number(se.my_share ?? se.total_amount * splitFrac)
  }, 0)
  const unmatchedSharedFull = (sharedExpenses ?? []).reduce((sum, se) => {
    return resolveSharedToFixed(se.category, se.notes) ? sum : sum + Number(se.total_amount)
  }, 0)

  // Combined spend for any category: personal + shared
  function catSpend(cat: BudgetCategory): number {
    return (spendByCat[cat.id] ?? 0) + (sharedSpendByCatName[cat.name] ?? 0)
  }
  function catSpendPersonal(cat: BudgetCategory): number {
    return spendByCat[cat.id] ?? 0
  }
  function catSpendShared(cat: BudgetCategory): number {
    return sharedSpendByCatName[cat.name] ?? 0
  }
  function catSpendSharedFull(cat: BudgetCategory): number {
    return sharedSpendFullByCatName[cat.name] ?? 0
  }

  // Categories with shared spending (for shared budget section)
  const catsWithSharedSpend = variableCats.filter(c => catSpendShared(c) > 0 || sharedSpendByCatName[c.name])
  // Categories with personal spending (for personal budget section)
  const catsPersonalOnly = variableCats

  // Totals
  const familyTotalIncome = (familyIncome ?? []).reduce((s, m) => s + m.total, 0)
  const personalIncome = income ? (income.salary + income.bonus + income.other) : 0
  const totalIncome = isFamily && familyTotalIncome > 0 ? familyTotalIncome : personalIncome
  const totalFixedMy = fixedCats.reduce((s, c) => s + catSpend(c), 0) + unmatchedSharedTotal
  const totalFixedFull = fixedCats.reduce((s, c) => s + catSpendPersonal(c) + catSpendSharedFull(c), 0) + unmatchedSharedFull
  const totalVariableMy = allNonFixed.reduce((s, c) => s + catSpend(c), 0)
  const totalVariableFull = allNonFixed.reduce((s, c) => s + catSpendPersonal(c) + catSpendSharedFull(c), 0)
  const totalVariableBudget = allNonFixed.reduce((s, c) => s + c.monthly_target, 0)
  const totalSharedVariableActual = (sharedExpenses ?? []).reduce((s, se) => {
    const catName = resolveSharedToFixed(se.category, se.notes)
    if (!catName) return s
    const cat = (categories ?? []).find(c => c.name === catName && c.type === 'variable')
    return cat ? s + Number(se.my_share ?? se.total_amount * splitFrac) : s
  }, 0) + unmatchedSharedTotal
  const totalPersonalVariableActual = variableCats.reduce((s, c) => s + catSpendPersonal(c), 0)
  const remaining = totalIncome - totalFixedMy - totalVariableMy

  async function saveTarget(catId: number) {
    const val = Number(editValue)
    if (!val || val < 0) { setEditingId(null); return }
    try {
      await updateTarget.mutateAsync({ id: catId, monthly_target: val, user_id: user!.id })
      toast.success('יעד עודכן')
      setEditingId(null)
    } catch (e) { console.error('Update budget target:', e); toast.error('שגיאה בעדכון היעד') }
  }

  async function handleAddCategory() {
    if (!user || !newCatName.trim()) return
    const maxSort = (categories ?? []).reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0)
    try {
      await addCategory.mutateAsync({
        user_id: user.id,
        name: newCatName.trim(),
        type: newCatType,
        monthly_target: Number(newCatTarget) || 0,
        sort_order: maxSort + 1,
        year: new Date().getFullYear(),
        budget_scope: newCatScope,
      })
      toast.success(`${newCatName.trim()} נוסף לתקציב`)
      setNewCatName('')
      setNewCatTarget('')
      setShowAddModal(false)
    } catch (e) { console.error('Add category:', e); toast.error('שגיאה בהוספה') }
  }

  async function handleReactivate(catId: number, catName: string) {
    if (!user) return
    try {
      await reactivateCategory.mutateAsync({ id: catId, user_id: user.id })
      toast.success(`${catName} חזר לתקציב`)
    } catch (e) { console.error('Reactivate:', e); toast.error('שגיאה') }
  }

  async function handleDeleteFromSection(catId: number, catName: string, section: 'personal' | 'shared') {
    if (!(await confirm({ message: `להסיר את "${catName}" מתקציב ${section === 'shared' ? 'משותף' : 'אישי'}?` }))) return
    const cat = (categories ?? []).find(c => c.id === catId)
    const scope = cat?.budget_scope ?? 'both'
    try {
      if (scope === 'both') {
        // Remove from one section by switching scope to the other
        const newScope = section === 'personal' ? 'shared' : 'personal'
        await updateScope.mutateAsync({ id: catId, budget_scope: newScope, user_id: user!.id })
      } else {
        // Already in one section only — hide completely
        await deleteCategory.mutateAsync({ id: catId, user_id: user!.id })
      }
      toast.success(`${catName} הוסר מתקציב ${section === 'shared' ? 'משותף' : 'אישי'}`)
    } catch (e) { console.error('Delete category:', e); toast.error('שגיאה') }
  }

  async function handleDeleteCategory(catId: number, catName: string) {
    if (!(await confirm({ message: `להסתיר את "${catName}" מהתקציב?` }))) return
    try {
      await deleteCategory.mutateAsync({ id: catId, user_id: user!.id })
      toast.success(`${catName} הוסר מהתקציב`)
    } catch (e) { console.error('Delete category:', e); toast.error('שגיאה במחיקה') }
  }

  const fixedPaidCount = fixedCats.filter(c => catSpend(c) > 0).length

  async function handleExportBudget() {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const rows: (string | number)[][] = [
        ['תקציב משפחתי', selectedPeriod?.label ?? ''],
        [],
        ['הכנסה נטו', totalIncome],
        ['סה"כ קבועות', totalFixedMy],
        ['סה"כ משתנות', totalVariableMy],
        ['תקציב משתנות', totalVariableBudget],
        ['נשאר פנוי', remaining],
        [],
        ['הוצאות קבועות'],
        ['קטגוריה', 'תקציב', 'בפועל', '% ניצול'],
      ]
      fixedCats.forEach(c => {
        const spent = catSpend(c)
        const pct = c.monthly_target > 0 ? Math.round((spent / c.monthly_target) * 100) : 0
        rows.push([c.name, c.monthly_target, spent, `${pct}%`])
      })
      rows.push([], ['הוצאות משתנות'], ['קטגוריה', 'תקציב', 'בפועל', '% ניצול'])
      allNonFixed.forEach(c => {
        const spent = catSpend(c)
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
    } catch (e) { console.error('Export budget:', e); toast.error('שגיאה בייצוא') }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-primary" />
          <h1 className="text-xl font-bold tracking-tight">תקציב משפחתי</h1>
          <PageInfo {...PAGE_TIPS.budget} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 bg-[var(--c-green-0-20)] border border-[var(--c-green-0-32)] rounded-lg px-3 py-[7px] text-[var(--accent-green)] text-[13px] font-medium cursor-pointer">
            <Plus size={13} /> הוסף קטגוריה
          </button>
          <button onClick={handleExportBudget} className="flex items-center gap-1.5 bg-[var(--c-blue-0-20)] border border-[var(--c-blue-0-32)] rounded-lg px-3 py-[7px] text-[var(--accent-blue)] text-[13px] font-medium cursor-pointer">
            <Download size={13} /> הורד לאקסל
          </button>
        </div>
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
          <div className="text-[22px] font-bold text-[var(--accent-blue)] leading-none">{formatCurrency(totalFixedFull)}</div>
          {totalFixedFull !== totalFixedMy && (
            <div className="text-[10px] text-muted-foreground mt-1">החלק שלי: {formatCurrency(totalFixedMy)}</div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">סה״כ משתנות בפועל</div>
          <div className="text-[22px] font-bold text-[var(--accent-orange)] leading-none">{formatCurrency(totalVariableFull)}</div>
          {totalVariableBudget > 0 && (
            <div className="text-[11px] text-muted-foreground mt-1">
              מתוך {formatCurrency(totalVariableBudget)} תקציב
            </div>
          )}
          {totalVariableFull !== totalVariableMy && (
            <div className="text-[10px] text-muted-foreground">החלק שלי: {formatCurrency(totalVariableMy)}</div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide flex items-center gap-1">נשאר פנוי <InfoTooltip body="הכנסה פחות הוצאות (קבועות + משתנות). זה מה שנשאר לחיסכון" /></div>
          <div className={`text-[22px] font-bold leading-none ${remaining >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
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
            <Inbox size={36} className="text-[var(--c-0-30)] mx-auto mb-2.5" />
            <div className="text-muted-foreground text-sm">אין קטגוריות תקציב</div>
          </div>
        )
        : (
          <div className="space-y-5">
            {/* ── Shared Variable Budget ─────────────────────────────────────── */}
            {(() => {
              // Shared variable categories: categories that have shared spending mapped to them
              const sharedVarCats = variableCats.filter(c => (c.budget_scope ?? 'both') !== 'personal' && (catSpendShared(c) > 0 || (c.budget_scope ?? 'both') === 'shared'))
              const sharedVarBudget = sharedVarCats.reduce((s, c) => s + c.monthly_target, 0)
              const sharedVarFullActual = sharedVarCats.reduce((s, c) => s + catSpendSharedFull(c), 0) + unmatchedSharedFull
              const sharedVarMyShare = sharedVarCats.reduce((s, c) => s + catSpendShared(c), 0) + unmatchedSharedTotal
              if (sharedVarCats.length === 0 && unmatchedSharedFull === 0) return null
              const splitPctLabel = Math.round(splitFrac * 100)
              return (
                <div className="card-transition bg-card border border-border rounded-xl p-5">
                  <div className="flex justify-between items-center mb-1 pb-3 border-b border-[var(--bg-hover)]">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-[var(--accent-shared)]" />
                      <span className="font-bold text-sm">תקציב משותף</span>
                      <InfoTooltip body="הוצאות משתנות משותפות לשני בני הזוג. הסכום הראשי הוא הסה״כ, מתחתיו החלק שלך" />
                      <span className="text-[11px] text-muted-foreground bg-secondary rounded px-1.5 py-px">{sharedVarCats.length}</span>
                    </div>
                    <div className="text-left">
                      <div className="text-[13px]">
                        <span className="font-bold text-[var(--accent-shared)]">{formatCurrency(sharedVarFullActual)}</span>
                        {sharedVarBudget > 0 && <>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-muted-foreground">{formatCurrency(sharedVarBudget)}</span>
                        </>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">החלק שלי ({splitPctLabel}%): {formatCurrency(sharedVarMyShare)}</div>
                    </div>
                  </div>
                  <div>
                    {sharedVarCats.map(cat => {
                      const spentFull = catSpendSharedFull(cat)
                      const spentMy = catSpendShared(cat)
                      const pct = cat.monthly_target > 0 ? spentFull / cat.monthly_target : 0
                      const isEditing = editingId === cat.id
                      const barColor = getBarColor(pct)
                      const catRemaining = cat.monthly_target - spentFull
                      return (
                        <div key={cat.id} className="group flex items-center gap-3 py-2.5 border-b border-[var(--c-0-18)] last:border-b-0 hover:bg-[var(--c-0-18)] rounded px-2 transition-colors">
                          <div className="min-w-[100px] shrink-0">
                            <span className="font-medium text-[13px] text-[var(--c-0-82)] block">{cat.name}</span>
                            {spentMy !== spentFull && <span className="text-[10px] text-muted-foreground">חלקי: {formatCurrency(spentMy)}</span>}
                          </div>
                          <div className="flex-1 h-[5px] rounded-full bg-[var(--c-0-20)] overflow-hidden min-w-[60px]">
                            <div className="h-full rounded-full transition-[width] duration-400 ease-out" style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} />
                          </div>
                          <div className="flex items-center gap-1 text-[12px] shrink-0">
                            <span className="font-semibold" style={{ color: barColor }}>{formatCurrency(spentFull)}</span>
                            <span className="text-muted-foreground">/</span>
                            {isEditing ? (
                              <input autoFocus type="number" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => saveTarget(cat.id)} onKeyDown={e => { if (e.key === 'Enter') saveTarget(cat.id); if (e.key === 'Escape') setEditingId(null) }} className="w-24 bg-[var(--c-0-20)] border border-[var(--c-blue-0-45)] rounded-md px-2 py-0.5 text-inherit text-[12px] text-left" title="סכום יעד" />
                            ) : (
                              <>
                                <span className="text-muted-foreground">{formatCurrency(cat.monthly_target)}</span>
                                <button type="button" onClick={() => { setEditingId(cat.id); setEditValue(String(cat.monthly_target)) }} className="p-0.5 rounded hover:bg-[var(--c-0-25)] transition-colors text-muted-foreground hover:text-[var(--text-body)]" title="ערוך תקציב"><Pencil size={12} /></button>
                              </>
                            )}
                          </div>
                          {cat.monthly_target > 0 && (
                            <span className={`text-[11px] font-medium shrink-0 min-w-[75px] text-left ${catRemaining >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                              {catRemaining >= 0 ? `נותר ${formatCurrency(catRemaining)}` : `חריגה ${formatCurrency(Math.abs(catRemaining))}`}
                            </span>
                          )}
                          <button type="button" onClick={() => handleDeleteFromSection(cat.id, cat.name, 'shared')} className="p-0.5 rounded hover:bg-[var(--c-red-0-18)] transition-colors text-[var(--c-0-35)] hover:text-[var(--accent-red)] opacity-0 group-hover:opacity-100" title="הסר מתקציב משותף"><X size={12} /></button>
                        </div>
                      )
                    })}
                    {unmatchedSharedTotal > 0 && (
                      <div className="flex items-center gap-3 py-2.5 px-2 text-[12px] text-muted-foreground">
                        <span className="min-w-[100px]">שונות (לא ממופה)</span>
                        <span className="font-semibold">{formatCurrency(unmatchedSharedTotal)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── Personal Variable Budget ────────────────────────────────────── */}
            <div className="card-transition bg-card border border-border rounded-xl p-5">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--bg-hover)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-orange)' }} />
                  <span className="font-bold text-sm">תקציב אישי</span>
                  <InfoTooltip body="הוצאות משתנות אישיות, קרנות צבירה וחיסכון" />
                  <span className="text-[11px] text-muted-foreground bg-secondary rounded px-1.5 py-px">{allNonFixed.length}</span>
                </div>
                <div className="text-[13px]">
                  <span className="font-bold text-[var(--text-heading)]">{formatCurrency(totalPersonalVariableActual)}</span>
                  {totalVariableBudget > 0 && <>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-muted-foreground">{formatCurrency(totalVariableBudget)}</span>
                  </>}
                </div>
              </div>

              {allNonFixed.length === 0 ? (
                <div className="text-muted-foreground text-sm text-center py-6">אין הוצאות</div>
              ) : (
                <div>
                  {groupedNonFixed.map((group, gi) => {
                    const personalCats = group.cats.filter(c => (c.budget_scope ?? 'both') !== 'shared')
                    if (personalCats.length === 0) return null
                    const section = TYPE_SECTION_LABELS[group.type]
                    const sectionSpent = personalCats.reduce((s, c) => s + catSpendPersonal(c), 0)
                    const sectionBudget = personalCats.reduce((s, c) => s + c.monthly_target, 0)
                    return (
                      <div key={group.type} className={gi > 0 ? 'mt-4 pt-3 border-t border-[var(--bg-hover)]' : ''}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: section.color }} />
                            <span className="text-[12px] font-semibold text-[var(--c-0-65)] uppercase tracking-wide">{section.label}</span>
                            <span className="text-[10px] text-muted-foreground bg-secondary rounded px-1 py-px">{group.cats.length}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            <span className="font-semibold" style={{ color: section.color }}>{formatCurrency(sectionSpent)}</span>
                            {sectionBudget > 0 && <> / {formatCurrency(sectionBudget)}</>}
                          </div>
                        </div>
                        <div>
                          {personalCats.map(cat => {
                            const spent = catSpendPersonal(cat)
                            const pct = cat.monthly_target > 0 ? spent / cat.monthly_target : 0
                            const isEditing = editingId === cat.id
                            const barColor = getBarColor(pct)
                            const catRemaining = cat.monthly_target - spent
                            return (
                              <div key={cat.id} className="group flex items-center gap-3 py-2.5 border-b border-[var(--c-0-18)] last:border-b-0 hover:bg-[var(--c-0-18)] rounded px-2 transition-colors">
                                <span className="font-medium text-[13px] text-[var(--c-0-82)] min-w-[100px] shrink-0">{cat.name}</span>
                                <div className="flex-1 h-[5px] rounded-full bg-[var(--c-0-20)] overflow-hidden min-w-[60px]">
                                  <div className="h-full rounded-full transition-[width] duration-400 ease-out" style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} />
                                </div>
                                <div className="flex items-center gap-1 text-[12px] shrink-0">
                                  <span className="font-semibold" style={{ color: barColor }}>{formatCurrency(spent)}</span>
                                  <span className="text-muted-foreground">/</span>
                                  {isEditing ? (
                                    <input autoFocus type="number" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => saveTarget(cat.id)} onKeyDown={e => { if (e.key === 'Enter') saveTarget(cat.id); if (e.key === 'Escape') setEditingId(null) }} className="w-24 bg-[var(--c-0-20)] border border-[var(--c-blue-0-45)] rounded-md px-2 py-0.5 text-inherit text-[12px] text-left" title="סכום יעד" />
                                  ) : (
                                    <>
                                      <span className="text-muted-foreground">{formatCurrency(cat.monthly_target)}</span>
                                      <button type="button" onClick={() => { setEditingId(cat.id); setEditValue(String(cat.monthly_target)) }} className="p-0.5 rounded hover:bg-[var(--c-0-25)] transition-colors text-muted-foreground hover:text-[var(--text-body)]" title="ערוך תקציב"><Pencil size={12} /></button>
                                    </>
                                  )}
                                </div>
                                {cat.monthly_target > 0 && (
                                  <span className={`text-[11px] font-medium shrink-0 min-w-[75px] text-left ${catRemaining >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                                    {catRemaining >= 0 ? `נותר ${formatCurrency(catRemaining)}` : `חריגה ${formatCurrency(Math.abs(catRemaining))}`}
                                  </span>
                                )}
                                <button type="button" onClick={() => handleDeleteFromSection(cat.id, cat.name, 'personal')} className="p-0.5 rounded hover:bg-[var(--c-red-0-18)] transition-colors text-[var(--c-0-35)] hover:text-[var(--accent-red)] opacity-0 group-hover:opacity-100" title="הסר מתקציב אישי"><X size={12} /></button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="card-transition bg-card border border-border rounded-xl overflow-hidden">
              <div role="button" tabIndex={0} onClick={() => setFixedOpen(!fixedOpen)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFixedOpen(!fixedOpen) } }} className="w-full flex justify-between items-center p-5 cursor-pointer hover:bg-[var(--c-0-18)] transition-colors">
                <div className="flex items-center gap-2">
                  <ChevronDown size={16} className={`transition-transform duration-200 ${fixedOpen ? 'rotate-180' : ''}`} />
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-blue)' }} />
                  <span className="font-bold text-sm">הוצאות קבועות</span>
                  <InfoTooltip body="הוצאות שלא משתנות מחודש לחודש — שכירות, ביטוח, הלוואות" />
                  <span className="text-[11px] text-muted-foreground bg-secondary rounded px-1.5 py-px">{fixedCats.length}</span>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-muted-foreground">{fixedPaidCount}/{fixedCats.length} שולמו</span>
                    <span className="text-[13px] font-bold text-[var(--text-heading)]">{formatCurrency(totalFixedFull)}</span>
                  </div>
                  {totalFixedFull !== totalFixedMy && (
                    <div className="text-[10px] text-muted-foreground text-left">החלק שלי: {formatCurrency(totalFixedMy)}</div>
                  )}
                </div>
              </div>
              {fixedOpen && (
                <div className="px-5 pb-5 border-t border-[var(--bg-hover)]">
                  {fixedCats.length === 0 && unmatchedSharedTotal === 0 ? (
                    <div className="text-muted-foreground text-sm text-center py-6">אין הוצאות קבועות</div>
                  ) : (
                    <div className="space-y-1 mt-3">
                      {fixedCats.map(cat => {
                        const spentTotal = catSpendPersonal(cat) + catSpendSharedFull(cat)
                        const spentMy = catSpend(cat)
                        const isPaid = spentTotal > 0
                        const hasShared = catSpendSharedFull(cat) > 0

                        return (
                          <div
                            key={cat.id}
                            className="group flex justify-between items-center py-2.5 px-2 rounded-lg hover:bg-[var(--c-0-18)] transition-colors duration-150"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isPaid ? 'bg-[var(--accent-green)]' : 'bg-[var(--border-default)]'}`}>
                                {isPaid
                                  ? <Check size={12} className="text-[var(--c-0-15)]" />
                                  : <Clock size={12} className="text-[var(--c-0-45)]" />
                                }
                              </div>
                              <div>
                                <span className={`text-[13px] font-medium ${isPaid ? 'text-[var(--c-0-82)]' : 'text-[var(--c-0-50)]'}`}>
                                  {cat.name}
                                </span>
                                {hasShared && spentMy !== spentTotal && (
                                  <div className="text-[10px] text-muted-foreground">חלקי: {formatCurrency(spentMy)}</div>
                                )}
                              </div>
                              {hasShared && (
                                <Users size={11} className="text-[var(--c-0-50)]" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[13px] font-semibold ${isPaid ? 'text-[var(--c-0-82)]' : 'text-[var(--c-0-40)]'}`}>
                                {isPaid ? formatCurrency(spentTotal) : '—'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                className="p-0.5 rounded hover:bg-[var(--c-red-0-18)] transition-colors text-[var(--c-0-35)] hover:text-[var(--accent-red)] opacity-0 group-hover:opacity-100"
                                title="הסר מהתקציב"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {unmatchedSharedTotal > 0 && (
                        <div className="flex justify-between items-center py-2.5 px-2 rounded-lg hover:bg-[var(--c-0-18)] transition-colors duration-150">
                          <div className="flex items-center gap-2.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-[var(--accent-green)]">
                              <Users size={12} className="text-[var(--c-0-15)]" />
                            </div>
                            <span className="text-[13px] font-medium text-[var(--c-0-82)]">
                              הוצאות משותפות
                            </span>
                          </div>
                          <span className="text-[13px] font-semibold text-[var(--c-0-82)]">
                            {formatCurrency(unmatchedSharedTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {(fixedCats.length > 0 || unmatchedSharedTotal > 0) && (
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-[var(--bg-hover)]">
                      <span className="text-[12px] text-muted-foreground">
                        {fixedPaidCount}/{fixedCats.length} שולמו
                      </span>
                      <span className="text-[14px] font-bold text-[var(--accent-blue)]">
                        {formatCurrency(totalFixedMy)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      }
      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-[14px] p-7 w-[420px] max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <span className="font-semibold text-[15px]">הוסף קטגוריה לתקציב</span>
              <button onClick={() => setShowAddModal(false)} aria-label="סגור" className="bg-transparent border-none text-muted-foreground cursor-pointer p-2">
                <X size={18} />
              </button>
            </div>

            {/* Reactivate hidden categories */}
            {(inactiveCategories ?? []).length > 0 && (
              <div className="mb-5">
                <div className="text-[12px] text-muted-foreground mb-2">קטגוריות מוסתרות - לחץ להחזיר</div>
                <div className="flex flex-wrap gap-1.5">
                  {(inactiveCategories ?? []).map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleReactivate(cat.id, cat.name)}
                      className="flex items-center gap-1 bg-[var(--c-0-22)] border border-[var(--border-light)] rounded-lg px-2.5 py-1.5 text-[12px] text-[var(--c-0-70)] cursor-pointer hover:bg-[var(--c-0-28)] transition-colors"
                    >
                      <RotateCcw size={10} /> {cat.name}
                    </button>
                  ))}
                </div>
                <div className="border-b border-[var(--c-0-20)] my-4" />
              </div>
            )}

            {/* New category form */}
            <div className="flex flex-col gap-3.5">
              <div>
                <label htmlFor="cat-name" className="text-xs text-[var(--c-0-60)] block mb-[5px]">שם קטגוריה</label>
                <input
                  id="cat-name"
                  type="text"
                  autoFocus
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="למשל: ביגוד, חינוך..."
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">סוג</label>
                <div className="flex gap-2">
                  {([['fixed', 'קבוע'], ['variable', 'משתנה']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNewCatType(val)}
                      className={`flex-1 rounded-lg py-[9px] text-[12px] cursor-pointer ${
                        newCatType === val
                          ? 'bg-[var(--c-blue-0-24)] border border-[var(--c-blue-0-40)] text-[var(--c-blue-0-75)] font-semibold'
                          : 'bg-[var(--c-0-20)] border border-[var(--border-light)] text-muted-foreground font-normal'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">שייך ל</label>
                <div className="flex gap-2">
                  {([['personal', 'אישי'], ['shared', 'משותף'], ['both', 'שניהם']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNewCatScope(val)}
                      className={`flex-1 rounded-lg py-[9px] text-[12px] cursor-pointer ${
                        newCatScope === val
                          ? 'bg-[var(--c-blue-0-24)] border border-[var(--c-blue-0-40)] text-[var(--c-blue-0-75)] font-semibold'
                          : 'bg-[var(--c-0-20)] border border-[var(--border-light)] text-muted-foreground font-normal'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="cat-target" className="text-xs text-[var(--c-0-60)] block mb-[5px]">יעד חודשי (₪)</label>
                <input
                  id="cat-target"
                  type="text"
                  inputMode="numeric"
                  value={newCatTarget}
                  onChange={e => setNewCatTarget(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="0"
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={!newCatName.trim() || addCategory.isPending}
                className={`w-full bg-[var(--accent-green)] border-none rounded-lg py-[11px] font-semibold text-sm text-[var(--c-0-10)] ${
                  !newCatName.trim() || addCategory.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              >
                {addCategory.isPending ? '...' : 'הוסף קטגוריה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
