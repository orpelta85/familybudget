'use client'

import { useUser } from '@/lib/queries/useUser'
import { useBudgetCategories, usePersonalExpenses, useUpdateCategoryTarget } from '@/lib/queries/useExpenses'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome } from '@/lib/queries/useIncome'
import { formatCurrency } from '@/lib/utils'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { BarChart3, Inbox, Check, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PeriodSelector } from '@/components/layout/PeriodSelector'

function getBarColor(pct: number): string {
  if (pct > 0.9) return 'oklch(0.62 0.22 27)'
  if (pct > 0.7) return 'oklch(0.72 0.18 55)'
  return 'oklch(0.65 0.18 250)'
}

export default function BudgetPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const currentPeriod = useCurrentPeriod()
  const { data: periods } = usePeriods()
  const updateTarget = useUpdateCategoryTarget()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const selectedPeriod = useMemo(() => periods?.find(p => p.id === selectedPeriodId), [periods, selectedPeriodId])

  const { data: categories } = useBudgetCategories(user?.id)
  const { data: expenses } = usePersonalExpenses(selectedPeriodId ?? currentPeriod?.id, user?.id)
  const { data: income } = useIncome(selectedPeriodId ?? currentPeriod?.id, user?.id)

  if (loading || !user) return <TableSkeleton rows={8} />

  // Split categories by type
  const fixedCats = (categories ?? []).filter(c => c.type === 'fixed')
  const variableCats = (categories ?? []).filter(c => c.type === 'variable')

  // Spending by category
  const spendByCat = (expenses ?? []).reduce<Record<number, number>>((acc, e) => {
    acc[e.category_id] = (acc[e.category_id] ?? 0) + e.amount
    return acc
  }, {})

  // Totals
  const totalIncome = income ? (income.salary + income.bonus + income.other) : 0
  const totalFixed = fixedCats.reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0)
  const totalVariableActual = variableCats.reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0)
  const totalVariableBudget = variableCats.reduce((s, c) => s + c.monthly_target, 0)
  const remaining = totalIncome - totalFixed - totalVariableActual

  async function saveTarget(catId: number) {
    const val = Number(editValue)
    if (!val || val < 0) { setEditingId(null); return }
    await updateTarget.mutateAsync({ id: catId, monthly_target: val, user_id: user!.id })
    toast.success('יעד עודכן')
    setEditingId(null)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <BarChart3 size={18} className="text-primary" />
        <h1 className="text-xl font-bold tracking-tight">תקציב חודשי</h1>
      </div>
      <p className="text-muted-foreground text-[13px] mb-5">
        {selectedPeriod?.label ?? currentPeriod?.label ?? '...'}
      </p>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* KPI Cards */}
      <div className="grid-kpi mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">הכנסה נטו</div>
          <div className="text-[22px] font-bold text-primary ltr leading-none">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">סה״כ קבועות</div>
          <div className="text-[22px] font-bold text-[oklch(0.65_0.18_250)] ltr leading-none">{formatCurrency(totalFixed)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">סה״כ משתנות בפועל</div>
          <div className="text-[22px] font-bold text-[oklch(0.72_0.18_55)] ltr leading-none">{formatCurrency(totalVariableActual)}</div>
          {totalVariableBudget > 0 && (
            <div className="text-[11px] text-muted-foreground mt-1.5">
              מתוך {formatCurrency(totalVariableBudget)} תקציב
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">נשאר פנוי</div>
          <div className={`text-[22px] font-bold ltr leading-none ${remaining >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>
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
                  <span className="text-[11px] text-muted-foreground bg-secondary rounded px-1.5 py-px">{fixedCats.length}</span>
                </div>
                <div className="ltr text-[13px] font-bold text-[oklch(0.80_0.01_250)]">
                  {formatCurrency(totalFixed)}
                </div>
              </div>

              {fixedCats.length === 0 ? (
                <div className="text-muted-foreground text-sm text-center py-6">אין הוצאות קבועות</div>
              ) : (
                <div className="space-y-1">
                  {fixedCats.map(cat => {
                    const spent = spendByCat[cat.id] ?? 0
                    const isPaid = spent > 0

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
                        </div>
                        <span className={`ltr text-[13px] font-semibold ${isPaid ? 'text-[oklch(0.82_0.01_250)]' : 'text-[oklch(0.40_0.01_250)]'}`}>
                          {isPaid ? formatCurrency(spent) : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Fixed total bar */}
              {fixedCats.length > 0 && (
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-[oklch(0.22_0.01_250)]">
                  <span className="text-[12px] text-muted-foreground">
                    {fixedCats.filter(c => (spendByCat[c.id] ?? 0) > 0).length}/{fixedCats.length} שולמו
                  </span>
                  <span className="ltr text-[14px] font-bold text-[oklch(0.65_0.18_250)]">
                    {formatCurrency(totalFixed)}
                  </span>
                </div>
              )}
            </div>

            {/* Left column: Variable expenses */}
            <div className="card-transition bg-card border border-border rounded-xl p-5">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-[oklch(0.22_0.01_250)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: 'oklch(0.72 0.18 55)' }} />
                  <span className="font-bold text-sm">הוצאות משתנות</span>
                  <span className="text-[11px] text-muted-foreground bg-secondary rounded px-1.5 py-px">{variableCats.length}</span>
                </div>
                <div className="ltr text-[13px]">
                  <span className="font-bold text-[oklch(0.80_0.01_250)]">{formatCurrency(totalVariableActual)}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-muted-foreground">{formatCurrency(totalVariableBudget)}</span>
                </div>
              </div>

              {variableCats.length === 0 ? (
                <div className="text-muted-foreground text-sm text-center py-6">אין הוצאות משתנות</div>
              ) : (
                variableCats.map(cat => {
                  const spent = spendByCat[cat.id] ?? 0
                  const pct = cat.monthly_target > 0 ? spent / cat.monthly_target : 0
                  const pctDisplay = Math.round(pct * 100)
                  const isEditing = editingId === cat.id
                  const barColor = getBarColor(pct)
                  const remaining = cat.monthly_target - spent

                  return (
                    <div key={cat.id} className="mb-4">
                      {/* Row 1: Name + remaining */}
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-semibold text-[13px] text-[oklch(0.82_0.01_250)]">{cat.name}</span>
                        <span className={`text-[12px] font-medium ${remaining >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>
                          {remaining >= 0 ? `נותר ${formatCurrency(remaining)}` : `חריגה ${formatCurrency(Math.abs(remaining))}`}
                        </span>
                      </div>
                      {/* Row 2: Actual / Target */}
                      <div className="flex justify-between items-baseline mb-1.5">
                        <div className="flex items-baseline gap-1 ltr text-[13px]">
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
                              className="w-20 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.45_0.18_250)] rounded-md px-1.5 py-0.5 text-inherit text-[13px] text-left"
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
                        <span className="text-[11px] font-medium" style={{ color: barColor }}>
                          {pctDisplay > 200 ? '200%+' : `${pctDisplay}%`}
                        </span>
                      </div>
                      {/* Row 3: Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-[5px] rounded-sm bg-secondary overflow-hidden">
                          <div className="h-full rounded-sm transition-[width] duration-400 ease-out" style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Variable total bar */}
              {variableCats.length > 0 && (
                <div className="flex justify-between items-center mt-2 pt-3 border-t border-[oklch(0.22_0.01_250)]">
                  <span className="text-[12px] text-muted-foreground">
                    {totalVariableBudget > 0 ? `${Math.round((totalVariableActual / totalVariableBudget) * 100)}% מהתקציב` : ''}
                  </span>
                  <div className="ltr text-[14px]">
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
