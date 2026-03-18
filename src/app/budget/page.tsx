'use client'

import { useUser } from '@/lib/queries/useUser'
import { useBudgetCategories, usePersonalExpenses, useUpdateCategoryTarget } from '@/lib/queries/useExpenses'
import { useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome } from '@/lib/queries/useIncome'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

const THRESHOLD_OPTIONS = [70, 80, 90, 100]

function useThresholds(userId: string | undefined) {
  const key = userId ? `thresholds_${userId}` : null
  function get(catId: number): number {
    if (!key || typeof window === 'undefined') return 90
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}')
      return stored[catId] ?? 90
    } catch { return 90 }
  }
  function set(catId: number, pct: number) {
    if (!key) return
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}')
      localStorage.setItem(key, JSON.stringify({ ...stored, [catId]: pct }))
    } catch { /* ignore */ }
  }
  return { get, set }
}

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
  const updateTarget = useUpdateCategoryTarget()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [, forceUpdate] = useState(0)
  const thresholds = useThresholds(user?.id)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const { data: categories } = useBudgetCategories(user?.id)
  const { data: expenses } = usePersonalExpenses(currentPeriod?.id, user?.id)
  const { data: income } = useIncome(currentPeriod?.id, user?.id)

  if (loading || !user) return <div style={{ padding: 40, textAlign: 'center', color: 'oklch(0.55 0.01 250)' }}>טוען...</div>

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
      <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13, marginBottom: 20 }}>
        {currentPeriod?.label ?? '...'} · לחץ על יעד כדי לערוך
      </p>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: 'תקציב כולל', value: formatCurrency(totalBudget), color: 'oklch(0.65 0.18 250)', showRatio: true },
          { label: 'בוצע עד כה', value: formatCurrency(totalSpent), color: 'oklch(0.72 0.18 55)', showRatio: false },
          { label: 'נותר', value: formatCurrency(totalBudget - totalSpent), color: totalBudget - totalSpent >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)', showRatio: false },
        ].map(k => {
          const totalIncome = income ? (income.salary + income.bonus + income.other) : 0
          const budgetToIncome = totalIncome > 0 ? (totalBudget / totalIncome) * 100 : 0
          const ratioColor = budgetToIncome <= 80 ? 'oklch(0.70 0.18 145)' : budgetToIncome <= 100 ? 'oklch(0.72 0.18 55)' : 'oklch(0.62 0.22 27)'
          return (
            <div key={k.label} style={card}>
              <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color, direction: 'ltr' }}>{k.value}</div>
              {k.showRatio && totalIncome > 0 && (
                <div style={{ fontSize: 12, color: ratioColor, marginTop: 6 }}>
                  {budgetToIncome.toFixed(0)}% מההכנסה
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!categories?.length
        ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 14 }}>אין קטגוריות תקציב</div>
          </div>
        )
        : Object.entries(TYPE_LABELS).map(([type, meta]) => {
          const cats = grouped[type] ?? []
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
                const isEditing = editingId === cat.id
                const threshold = thresholds.get(cat.id)
                const alertPct = pct * 100
                const barColor = pct > 1 ? 'oklch(0.62 0.22 27)' : alertPct >= threshold ? 'oklch(0.72 0.18 55)' : meta.color

                return (
                  <div key={cat.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: 'oklch(0.80 0.01 250)' }}>{cat.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, direction: 'ltr' }}>
                        <span style={{ color: barColor, fontWeight: 500 }}>{formatCurrency(spent)}</span>
                        <span style={{ color: 'oklch(0.45 0.01 250)' }}>/</span>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => saveTarget(cat.id)}
                            onKeyDown={e => { if (e.key === 'Enter') saveTarget(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                            style={{ width: 80, background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.45 0.18 250)', borderRadius: 6, padding: '2px 6px', color: 'inherit', fontSize: 13, textAlign: 'right' }}
                          />
                        ) : (
                          <span
                            onClick={() => { setEditingId(cat.id); setEditValue(String(cat.monthly_target)) }}
                            title="לחץ לעריכה"
                            style={{ color: 'oklch(0.65 0.01 250)', cursor: 'pointer', borderBottom: '1px dashed oklch(0.40 0.01 250)', paddingBottom: 1 }}
                          >
                            {formatCurrency(cat.monthly_target)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'oklch(0.22 0.01 250)', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(pct * 100, 100)}%`, background: barColor, transition: 'width 0.4s ease' }} />
                        {/* threshold marker */}
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${threshold}%`, width: 1, background: 'oklch(0.45 0.01 250)', opacity: 0.6 }} />
                      </div>
                      <select
                        value={threshold}
                        onChange={e => { thresholds.set(cat.id, Number(e.target.value)); forceUpdate(n => n + 1) }}
                        title="סף התראה"
                        style={{ fontSize: 10, background: 'oklch(0.20 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 4, color: 'oklch(0.55 0.01 250)', padding: '1px 2px', cursor: 'pointer' }}
                      >
                        {THRESHOLD_OPTIONS.map(t => <option key={t} value={t}>{t}%</option>)}
                      </select>
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
