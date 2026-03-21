import { createClient } from '@/lib/supabase/client'

export async function buildFinancialContext(userId: string, periodId: number): Promise<string> {
  const sb = createClient()

  // Fetch income for current period
  const { data: income } = await sb
    .from('income')
    .select('salary, bonus, other')
    .eq('user_id', userId)
    .eq('period_id', periodId)
    .maybeSingle()

  const totalIncome = income ? (income.salary + income.bonus + income.other) : 0

  // Fetch personal expenses with categories
  const { data: expenses } = await sb
    .from('personal_expenses')
    .select('amount, budget_categories(name, type, monthly_target)')
    .eq('user_id', userId)
    .eq('period_id', periodId)

  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0)

  // Group expenses by category
  const byCat: Record<string, { spent: number; budget: number }> = {}
  for (const e of expenses ?? []) {
    const catName = (e.budget_categories as unknown as { name: string; monthly_target: number } | null)?.name ?? 'אחר'
    const catTarget = (e.budget_categories as unknown as { name: string; monthly_target: number } | null)?.monthly_target ?? 0
    if (!byCat[catName]) byCat[catName] = { spent: 0, budget: catTarget }
    byCat[catName].spent += e.amount
  }

  const topCategories = Object.entries(byCat)
    .sort(([, a], [, b]) => b.spent - a.spent)
    .slice(0, 5)
    .map(([name, { spent, budget }]) => {
      const overBudget = budget > 0 && spent > budget
      return `${name}: ${Math.round(spent).toLocaleString('he-IL')} ₪${budget > 0 ? ` (תקציב: ${Math.round(budget).toLocaleString('he-IL')} ₪${overBudget ? ' — חריגה!' : ''})` : ''}`
    })

  // Fetch debts
  const { data: debts } = await sb
    .from('debts')
    .select('name, balance, interest_rate')
    .eq('user_id', userId)

  const totalDebt = (debts ?? []).reduce((sum, d) => sum + d.balance, 0)

  // Fetch subscriptions
  const { data: subs } = await sb
    .from('subscriptions')
    .select('amount')
    .eq('user_id', userId)
    .eq('is_active', true)

  const totalSubs = (subs ?? []).reduce((sum, s) => sum + s.amount, 0)

  // Fetch savings goals
  const { data: goals } = await sb
    .from('savings_goals')
    .select('name, target_amount')
    .eq('user_id', userId)
    .eq('is_active', true)

  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0

  const lines: string[] = [
    `הכנסה חודשית: ${Math.round(totalIncome).toLocaleString('he-IL')} ₪`,
    `הוצאות חודשיות: ${Math.round(totalExpenses).toLocaleString('he-IL')} ₪`,
    `אחוז חיסכון: ${Math.round(savingsRate * 100)}%`,
    ``,
    `קטגוריות עיקריות:`,
    ...topCategories.map(c => `  - ${c}`),
  ]

  if (totalDebt > 0) {
    lines.push(``, `חובות פעילים: ${Math.round(totalDebt).toLocaleString('he-IL')} ₪`)
    for (const d of debts ?? []) {
      lines.push(`  - ${d.name}: ${Math.round(d.balance).toLocaleString('he-IL')} ₪ (${d.interest_rate}% ריבית)`)
    }
  }

  if (totalSubs > 0) {
    lines.push(``, `מנויים חודשיים: ${Math.round(totalSubs).toLocaleString('he-IL')} ₪`)
  }

  if (goals && goals.length > 0) {
    lines.push(``, `יעדי חיסכון:`)
    for (const g of goals) {
      lines.push(`  - ${g.name}: יעד ${Math.round(g.target_amount).toLocaleString('he-IL')} ₪`)
    }
  }

  return lines.join('\n')
}

export interface TipDataFromDB {
  categories: Array<{ name: string; spent: number; budget: number }>
  totalIncome: number
  totalExpenses: number
  savingsRate: number
  totalSubscriptions: number
  goals: Array<{ name: string; progress: number }>
  debts: Array<{ name: string; balance: number; interest_rate: number }>
  emergencyFundMonths: number
  insuranceRenewals: Array<{ name: string; daysUntilRenewal: number }>
  monthlyAvailable: number
}

export async function fetchTipData(userId: string, periodId: number): Promise<TipDataFromDB> {
  const sb = createClient()

  // Income
  const { data: income } = await sb
    .from('income')
    .select('salary, bonus, other')
    .eq('user_id', userId)
    .eq('period_id', periodId)
    .maybeSingle()

  const totalIncome = income ? (income.salary + income.bonus + income.other) : 0

  // Expenses with categories
  const { data: expenses } = await sb
    .from('personal_expenses')
    .select('amount, budget_categories(name, monthly_target)')
    .eq('user_id', userId)
    .eq('period_id', periodId)

  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0)

  // Group by category
  const byCat: Record<string, { spent: number; budget: number }> = {}
  for (const e of expenses ?? []) {
    const cat = e.budget_categories as unknown as { name: string; monthly_target: number } | null
    const catName = cat?.name ?? 'אחר'
    const catTarget = cat?.monthly_target ?? 0
    if (!byCat[catName]) byCat[catName] = { spent: 0, budget: catTarget }
    byCat[catName].spent += e.amount
  }

  const categories = Object.entries(byCat).map(([name, v]) => ({ name, ...v }))

  // Subscriptions
  const { data: subs } = await sb
    .from('subscriptions')
    .select('amount')
    .eq('user_id', userId)
    .eq('is_active', true)

  const totalSubscriptions = (subs ?? []).reduce((sum, s) => sum + s.amount, 0)

  // Goals + deposits
  const { data: goals } = await sb
    .from('savings_goals')
    .select('id, name, target_amount')
    .eq('user_id', userId)
    .eq('is_active', true)

  const goalProgress: Array<{ name: string; progress: number }> = []
  for (const g of goals ?? []) {
    const { data: deposits } = await sb
      .from('goal_deposits')
      .select('amount_deposited')
      .eq('goal_id', g.id)
    const totalDeposited = (deposits ?? []).reduce((sum, d) => sum + d.amount_deposited, 0)
    goalProgress.push({ name: g.name, progress: g.target_amount > 0 ? totalDeposited / g.target_amount : 0 })
  }

  // Debts
  const { data: debts } = await sb
    .from('debts')
    .select('name, balance, interest_rate')
    .eq('user_id', userId)

  // Insurance renewals
  const { data: insurance } = await sb
    .from('insurance_policies')
    .select('name, renewal_date')
    .eq('user_id', userId)
    .eq('is_active', true)

  const now = new Date()
  const insuranceRenewals = (insurance ?? [])
    .filter(p => p.renewal_date)
    .map(p => {
      const renewalDate = new Date(p.renewal_date!)
      const diffDays = Math.ceil((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { name: p.name, daysUntilRenewal: diffDays }
    })

  // Sinking funds (emergency fund estimate)
  const { data: sinkingFunds } = await sb
    .from('sinking_funds')
    .select('id, name, monthly_allocation')
    .eq('user_id', userId)
    .eq('is_active', true)

  let emergencyBalance = 0
  for (const fund of sinkingFunds ?? []) {
    if (fund.name.includes('חירום') || fund.name.includes('emergency')) {
      const { data: txs } = await sb
        .from('sinking_fund_transactions')
        .select('amount')
        .eq('fund_id', fund.id)
      emergencyBalance += (txs ?? []).reduce((sum, t) => sum + t.amount, 0)
    }
  }

  const emergencyFundMonths = totalExpenses > 0 ? emergencyBalance / totalExpenses : 99

  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0
  const monthlyAvailable = totalIncome - totalExpenses

  return {
    categories,
    totalIncome,
    totalExpenses,
    savingsRate,
    totalSubscriptions,
    goals: goalProgress,
    debts: (debts ?? []).map(d => ({ name: d.name, balance: d.balance, interest_rate: d.interest_rate })),
    emergencyFundMonths,
    insuranceRenewals,
    monthlyAvailable,
  }
}
