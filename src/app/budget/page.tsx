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

  const card: React.CSSProperties = { background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 20 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <BarChart3 size={18} style={{ color: 'oklch(0.65 0.18 250)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>תקציב מתוכנן</h1>
      </div>
      <p style={{ color: 'oklch(0.65 0.01 250)', fontSize: 13, marginBottom: 20 }}>
        {currentPeriod?.label ?? '...'}
      </p>

      {/* KPI Cards */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div style={card}>
          <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>תקציב כולל</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'oklch(0.65 0.18 250)', direction: 'ltr', lineHeight: 1.1 }}>{formatCurrency(totalBudget)}</div>
          {totalIncome > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'oklch(0.22 0.01 250)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(budgetToIncome, 100)}%`, background: ratioColor, transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: ratioColor, whiteSpace: 'nowrap' }}>{budgetToIncome.toFixed(0)}% מההכנסה</span>
            </div>
          )}
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>בוצע עד כה</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'oklch(0.72 0.18 55)', direction: 'ltr', lineHeight: 1.1 }}>{formatCurrency(totalSpent)}</div>
          {totalBudget > 0 && (
            <div style={{ fontSize: 12, color: 'oklch(0.65 0.01 250)', marginTop: 10 }}>
              {((totalSpent / totalBudget) * 100).toFixed(0)}% מהתקציב
            </div>
          )}
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>נותר</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: totalRemaining >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)', direction: 'ltr', lineHeight: 1.1 }}>{formatCurrency(totalRemaining)}</div>
          {totalBudget > 0 && (
            <div style={{ fontSize: 12, color: 'oklch(0.65 0.01 250)', marginTop: 10 }}>
              {((totalRemaining / totalBudget) * 100).toFixed(0)}% נותר
            </div>
          )}
        </div>
      </div>

      {/* Category Sections */}
      {!categories?.length
        ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <Inbox size={36} style={{ color: 'oklch(0.30 0.01 250)', margin: '0 auto 10px' }} />
            <div style={{ color: 'oklch(0.65 0.01 250)', fontSize: 14 }}>אין קטגוריות תקציב</div>
          </div>
        )
        : Object.entries(TYPE_LABELS).map(([type, meta]) => {
          const cats = grouped[type] ?? []
          if (!cats.length) return null
          const typeBudget = cats.reduce((s, c) => s + c.monthly_target, 0)
          const typeSpent = cats.reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0)

          return (
            <div key={type} className="card-transition" style={{ ...card, marginBottom: 16 }}>
              {/* Section Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid oklch(0.22 0.01 250)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', background: 'oklch(0.20 0.01 250)', borderRadius: 4, padding: '1px 6px' }}>{cats.length}</span>
                </div>
                <div style={{ direction: 'ltr', fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: 'oklch(0.80 0.01 250)' }}>{formatCurrency(typeSpent)}</span>
                  <span style={{ color: 'oklch(0.65 0.01 250)', margin: '0 4px' }}>/</span>
                  <span style={{ color: 'oklch(0.65 0.01 250)' }}>{formatCurrency(typeBudget)}</span>
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
                  <div key={cat.id} style={{ marginBottom: 14 }}>
                    {/* Row 1: Name + Spent / Target */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'oklch(0.82 0.01 250)' }}>{cat.name}</span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, direction: 'ltr', fontSize: 13 }}>
                        <span style={{ color: spentColor, fontWeight: 600 }}>{formatCurrency(spent)}</span>
                        <span style={{ color: 'oklch(0.65 0.01 250)' }}>/</span>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveTarget(cat.id)}
                            onKeyDown={e => { if (e.key === 'Enter') saveTarget(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                            style={{ width: 80, background: 'oklch(0.20 0.01 250)', border: '1px solid oklch(0.45 0.18 250)', borderRadius: 6, padding: '2px 6px', color: 'inherit', fontSize: 13, textAlign: 'right' }}
                          />
                        ) : (
                          <span
                            onClick={() => { setEditingId(cat.id); setEditValue(String(cat.monthly_target)) }}
                            title="לחץ לעריכה"
                            style={{ color: 'oklch(0.65 0.01 250)', cursor: 'pointer', borderBottom: '1px dashed oklch(0.38 0.01 250)', paddingBottom: 1, transition: 'color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'oklch(0.75 0.01 250)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'oklch(0.65 0.01 250)')}
                          >
                            {formatCurrency(cat.monthly_target)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Row 2: Progress bar + percentage */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'oklch(0.22 0.01 250)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(pct * 100, 100)}%`, background: barColor, transition: 'width 0.4s ease' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: barColor, minWidth: 32, textAlign: 'left', direction: 'ltr' }}>{pctDisplay > 200 ? '200%+' : `${pctDisplay}%`}</span>
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
