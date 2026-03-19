'use client'

import { useUser } from '@/lib/queries/useUser'
import { useBudgetCategories, usePersonalExpenses, useUpdateCategoryTarget } from '@/lib/queries/useExpenses'
import { useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome } from '@/lib/queries/useIncome'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BarChart3, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import { TableSkeleton } from '@/components/ui/Skeleton'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  fixed:    { label: 'קבועות',       color: 'oklch(0.65 0.18 250)' },
  variable: { label: 'משתנות',      color: 'oklch(0.72 0.18 55)' },
  sinking:  { label: 'קרנות צבירה', color: 'oklch(0.70 0.15 185)' },
  savings:  { label: 'חיסכון',      color: 'oklch(0.70 0.18 145)' },
}

function getBarColor(pct: number): string {
  if (pct > 0.9) return 'oklch(0.62 0.22 27)'
  if (pct > 0.7) return 'oklch(0.72 0.18 55)'
  return 'oklch(0.65 0.18 250)'
}

export default function BudgetPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const currentPeriod = useCurrentPeriod()
  const updateTarget = useUpdateCategoryTarget()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const { data: categories } = useBudgetCategories(user?.id, currentPeriod?.year_number)
  const { data: expenses } = usePersonalExpenses(currentPeriod?.id, user?.id)
  const { data: income } = useIncome(currentPeriod?.id, user?.id)

  if (loading || !user) return <TableSkeleton rows={8} />

  const grouped = (categories ?? []).reduce<Record<string, typeof categories>>((acc, c) => {
    if (!acc[c.type]) acc[c.type] = []
    acc[c.type]!.push(c)
    return acc
  }, {})

  const spendByCat = (expenses ?? []).reduce<Record<number, number>>((acc, e) => {
    acc[e.category_id] = (acc[e.category_id] ?? 0) + e.amount
    return acc
  }, {})

  const totalBudget = categories?.reduce((s, c) => s + c.monthly_target, 0) ?? 0
  const totalSpent = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const totalRemaining = totalBudget - totalSpent
  const totalIncome = income ? (income.salary + income.bonus + income.other) : 0
  const budgetToIncome = totalIncome > 0 ? (totalBudget / totalIncome) * 100 : 0
  const ratioColor = budgetToIncome <= 80 ? 'oklch(0.70 0.18 145)' : budgetToIncome <= 100 ? 'oklch(0.72 0.18 55)' : 'oklch(0.62 0.22 27)'

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
        <h1 className="text-xl font-bold tracking-tight">תקציב מתוכנן</h1>
      </div>
      <p className="text-muted-foreground text-[13px] mb-5">
        {currentPeriod?.label ?? '...'}
      </p>

      {/* KPI Cards */}
      <div className="grid-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wide">תקציב כולל</div>
          <div className="text-[28px] font-bold text-primary ltr leading-none">{formatCurrency(totalBudget)}</div>
          {totalIncome > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5">
              <div className="flex-1 h-[3px] rounded-sm bg-secondary overflow-hidden">
                <div className="h-full rounded-sm transition-[width] duration-400 ease-out" style={{ width: `${Math.min(budgetToIncome, 100)}%`, background: ratioColor }} />
              </div>
              <span className="text-xs font-semibold whitespace-nowrap" style={{ color: ratioColor }}>{budgetToIncome.toFixed(0)}% מההכנסה</span>
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wide">בוצע עד כה</div>
          <div className="text-[28px] font-bold text-[oklch(0.72_0.18_55)] ltr leading-none">{formatCurrency(totalSpent)}</div>
          {totalBudget > 0 && (
            <div className="text-xs text-muted-foreground mt-2.5">
              {((totalSpent / totalBudget) * 100).toFixed(0)}% מהתקציב
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wide">נותר</div>
          <div className={`text-[28px] font-bold ltr leading-none ${totalRemaining >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>{formatCurrency(totalRemaining)}</div>
          {totalBudget > 0 && (
            <div className="text-xs text-muted-foreground mt-2.5">
              {((totalRemaining / totalBudget) * 100).toFixed(0)}% נותר
            </div>
          )}
        </div>
      </div>

      {/* Category Sections */}
      {!categories?.length
        ? (
          <div className="bg-card border border-border rounded-xl text-center p-10">
            <Inbox size={36} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2.5" />
            <div className="text-muted-foreground text-sm">אין קטגוריות תקציב</div>
          </div>
        )
        : Object.entries(TYPE_LABELS).map(([type, meta]) => {
          const cats = grouped[type] ?? []
          if (!cats.length) return null
          const typeBudget = cats.reduce((s, c) => s + c.monthly_target, 0)
          const typeSpent = cats.reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0)

          return (
            <div key={type} className="card-transition bg-card border border-border rounded-xl p-5 mb-4">
              {/* Section Header */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-[oklch(0.22_0.01_250)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                  <span className="font-bold text-sm">{meta.label}</span>
                  <span className="text-[11px] text-muted-foreground bg-secondary rounded px-1.5 py-px">{cats.length}</span>
                </div>
                <div className="ltr text-[13px]">
                  <span className="font-bold text-[oklch(0.80_0.01_250)]">{formatCurrency(typeSpent)}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-muted-foreground">{formatCurrency(typeBudget)}</span>
                </div>
              </div>

              {/* Category Rows */}
              {cats.map(cat => {
                const spent = spendByCat[cat.id] ?? 0
                const pct = cat.monthly_target > 0 ? spent / cat.monthly_target : 0
                const pctDisplay = Math.round(pct * 100)
                const isEditing = editingId === cat.id
                const barColor = getBarColor(pct)
                const spentColor = pct > 1 ? 'oklch(0.62 0.22 27)' : pct > 0.9 ? 'oklch(0.72 0.18 55)' : 'oklch(0.70 0.18 145)'

                return (
                  <div key={cat.id} className="mb-3.5">
                    {/* Row 1: Name + Spent / Target */}
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="font-semibold text-[13px] text-[oklch(0.82_0.01_250)]">{cat.name}</span>
                      <div className="flex items-baseline gap-1 ltr text-[13px]">
                        <span className="font-semibold" style={{ color: spentColor }}>{formatCurrency(spent)}</span>
                        <span className="text-muted-foreground">/</span>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveTarget(cat.id)}
                            onKeyDown={e => { if (e.key === 'Enter') saveTarget(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                            className="w-20 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.45_0.18_250)] rounded-md px-1.5 py-0.5 text-inherit text-[13px] text-right"
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
                    {/* Row 2: Progress bar + percentage */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-[5px] rounded-sm bg-secondary overflow-hidden">
                        <div className="h-full rounded-sm transition-[width] duration-400 ease-out" style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} />
                      </div>
                      <span className="text-[11px] font-medium min-w-8 text-left ltr" style={{ color: barColor }}>{pctDisplay > 200 ? '200%+' : `${pctDisplay}%`}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      }
    </div>
  )
}
