'use client'

import { useEffect, useRef } from 'react'
import { useGenerateAlerts as useGenerateAlertsMutation } from '@/lib/queries/useAlerts'
import type { Alert } from '@/lib/queries/useAlerts'
import { useBudgetCategories, usePersonalExpenses } from '@/lib/queries/useExpenses'
import { useIncome } from '@/lib/queries/useIncome'
import { useSavingsGoals, useAllGoalDeposits } from '@/lib/queries/useGoals'
import { useSubscriptions } from '@/lib/queries/useSubscriptions'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { formatCurrency } from '@/lib/utils'
import { useMemo } from 'react'

export function useAlertGeneration(
  userId: string | undefined,
  periodId: number | undefined,
  familyId: string | undefined,
) {
  const generateAlerts = useGenerateAlertsMutation()
  const splitFrac = useSplitFraction(userId)
  const { data: categories } = useBudgetCategories(userId)
  const { data: expenses } = usePersonalExpenses(periodId, userId)
  const { data: income } = useIncome(periodId, userId)
  const { data: goals } = useSavingsGoals(userId, familyId)
  const goalIds = useMemo(() => (goals ?? []).map(g => g.id), [goals])
  const { data: goalDeposits } = useAllGoalDeposits(goalIds)
  const { data: subs } = useSubscriptions(userId)
  const generated = useRef(false)

  useEffect(() => {
    if (!userId || !periodId || !categories || !expenses || !income || generated.current) return
    generated.current = true

    const alerts: Omit<Alert, 'id' | 'created_at' | 'is_read'>[] = []

    // Spending by category
    const spendByCat: Record<number, number> = {}
    for (const e of expenses) {
      spendByCat[e.category_id] = (spendByCat[e.category_id] ?? 0) + e.amount
    }

    // 1. Category overspend (>130%)
    for (const cat of categories) {
      if (cat.monthly_target <= 0) continue
      const spent = spendByCat[cat.id] ?? 0
      const pct = spent / cat.monthly_target
      if (pct > 1.3) {
        const overPct = Math.round((pct - 1) * 100)
        alerts.push({
          user_id: userId,
          type: `category_overspend_${cat.id}`,
          severity: 'warning',
          title: `חריגה ב${cat.name}`,
          message: `הוצאת ${overPct}% יותר על ${cat.name} (${formatCurrency(spent)} מתוך תקציב ${formatCurrency(cat.monthly_target)})`,
        })
        if (alerts.length >= 5) break
      }
    }

    // 2. Low balance forecast (negative net flow)
    const totalIncome = (income?.salary ?? 0) + (income?.bonus ?? 0) + (income?.other ?? 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const netFlow = totalIncome - totalExpenses

    if (netFlow < 0 && alerts.length < 5) {
      alerts.push({
        user_id: userId,
        type: 'low_balance',
        severity: 'danger',
        title: 'תזרים שלילי',
        message: `צפויה יתרה שלילית החודש (${formatCurrency(netFlow)})`,
      })
    }

    // 3. Goal achieved
    if (goals && goalDeposits && alerts.length < 5) {
      for (const goal of goals) {
        const saved = goalDeposits.filter(d => d.goal_id === goal.id).reduce((s, d) => s + d.amount_deposited, 0)
        if (saved >= goal.target_amount && goal.target_amount > 0) {
          alerts.push({
            user_id: userId,
            type: `goal_achieved_${goal.id}`,
            severity: 'success',
            title: `הגעת ליעד ${goal.name}!`,
            message: `מזל טוב! צברת ${formatCurrency(saved)} מתוך יעד ${formatCurrency(goal.target_amount)}`,
          })
          if (alerts.length >= 5) break
        }
      }
    }

    // 4. Low savings rate
    const savingsPct = totalIncome > 0 ? (netFlow / totalIncome) * 100 : 0
    if (totalIncome > 0 && savingsPct < 10 && savingsPct >= 0 && alerts.length < 5) {
      alerts.push({
        user_id: userId,
        type: 'low_savings_rate',
        severity: 'warning',
        title: 'אחוז חיסכון נמוך',
        message: `אחוז החיסכון שלך ${Math.round(savingsPct)}% — מתחת לממוצע`,
      })
    }

    // 5. Subscription cost > 500
    const activeSubs = (subs ?? []).filter(s => s.is_active)
    const subTotal = activeSubs.reduce((s, sub) => s + sub.amount, 0)
    if (subTotal > 500 && alerts.length < 5) {
      alerts.push({
        user_id: userId,
        type: 'subscription_cost',
        severity: 'info',
        title: 'עלות מנויים',
        message: `סה"כ מנויים חודשיים: ${formatCurrency(subTotal)}`,
      })
    }

    if (alerts.length > 0) {
      generateAlerts.mutate({ user_id: userId, alerts: alerts.slice(0, 5) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, periodId, categories, expenses, income, goals, goalDeposits, subs])
}
