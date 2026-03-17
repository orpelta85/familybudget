'use client'

import { useUser } from '@/lib/queries/useUser'
import { useBudgetCategories, usePersonalExpenses } from '@/lib/queries/useExpenses'
import { useCurrentPeriod } from '@/lib/queries/usePeriods'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { BarChart3 } from 'lucide-react'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  fixed:    { label: 'קבועות',       color: 'oklch(0.65 0.18 250)' },
  variable: { label: 'משתנות',      color: 'oklch(0.72 0.18 55)' },
  sinking:  { label: 'קרנות צבירה', color: 'oklch(0.70 0.15 185)' },
  savings:  { label: 'חיסכון',      color: 'oklch(0.70 0.18 145)' },
}

export default function BudgetPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const currentPeriod = useCurrentPeriod()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const { data: categories } = useBudgetCategories(user?.id)
  const { data: expenses } = usePersonalExpenses(currentPeriod?.id, user?.id)

  if (loading || !user) return null

  const grouped = Object.groupBy(categories ?? [], c => c.type)
  const spendByCat = (expenses ?? []).reduce<Record<number, number>>((acc, e) => {
    acc[e.category_id] = (acc[e.category_id] ?? 0) + e.amount
    return acc
  }, {})

  const totalBudget = categories?.reduce((s, c) => s + c.monthly_target, 0) ?? 0
  const totalSpent = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0

  const card: React.CSSProperties = { background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 20 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <BarChart3 size={18} style={{ color: 'oklch(0.65 0.18 250)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>תקציב מתוכנן</h1>
      </div>
      <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13, marginBottom: 20 }}>{currentPeriod?.label ?? '...'}</p>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'תקציב כולל', value: formatCurrency(totalBudget), color: 'oklch(0.65 0.18 250)' },
          { label: 'בוצע עד כה', value: formatCurrency(totalSpent), color: 'oklch(0.72 0.18 55)' },
          { label: 'נותר', value: formatCurrency(totalBudget - totalSpent), color: totalBudget - totalSpent >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)' },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, direction: 'ltr' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* By type */}
      {!categories?.length
        ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 14, marginBottom: 8 }}>אין קטגוריות תקציב</div>
            <div style={{ color: 'oklch(0.45 0.01 250)', fontSize: 12 }}>הן ייווצרו אוטומטית לאחר הרצת seed.sql ב-Supabase</div>
          </div>
        )
        : Object.entries(TYPE_LABELS).map(([type, meta]) => {
          const cats = grouped[type as keyof typeof grouped] ?? []
          if (!cats.length) return null
          const typeBudget = cats.reduce((s, c) => s + c.monthly_target, 0)
          const typeSpent = cats.reduce((s, c) => s + (spendByCat[c.id] ?? 0), 0)

          return (
            <div key={type} style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{meta.label}</span>
                  <span style={{ fontSize: 12, color: 'oklch(0.50 0.01 250)' }}>{cats.length} קטגוריות</span>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontWeight: 700, direction: 'ltr', fontSize: 15 }}>{formatCurrency(typeSpent)}</span>
                  <span style={{ color: 'oklch(0.50 0.01 250)', fontSize: 12 }}> / {formatCurrency(typeBudget)}</span>
                </div>
              </div>

              {cats.map(cat => {
                const spent = spendByCat[cat.id] ?? 0
                const pct = cat.monthly_target > 0 ? spent / cat.monthly_target : 0
                const barColor = pct > 1 ? 'oklch(0.62 0.22 27)' : pct > 0.9 ? 'oklch(0.72 0.18 55)' : meta.color

                return (
                  <div key={cat.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: 'oklch(0.80 0.01 250)' }}>{cat.name}</span>
                      <span style={{ direction: 'ltr', color: barColor, fontWeight: 500 }}>
                        {formatCurrency(spent)} / {formatCurrency(cat.monthly_target)}
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'oklch(0.22 0.01 250)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(pct * 100, 100)}%`, background: barColor, transition: 'width 0.4s ease' }} />
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
