export interface OrenTip {
  id: string
  message: string
  type: 'warning' | 'success' | 'info' | 'suggestion'
  priority: number
  seen: boolean
}

interface TipData {
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

export function generateTips(data: TipData): OrenTip[] {
  const tips: OrenTip[] = []

  // Budget overspend warnings
  for (const cat of data.categories) {
    if (cat.budget > 0 && cat.spent > cat.budget * 1.1) {
      const pct = Math.round(((cat.spent - cat.budget) / cat.budget) * 100)
      tips.push({
        id: `overspend-${cat.name}`,
        message: `שים לב שחרגת ב"${cat.name}" ב-${pct}%. אולי כדאי לבדוק את ההוצאות שם?`,
        type: 'warning',
        priority: 90,
        seen: false,
      })
    }
  }

  // Good savings rate
  if (data.savingsRate > 0.2) {
    const pct = Math.round(data.savingsRate * 100)
    tips.push({
      id: 'good-savings',
      message: `כל הכבוד! אחוז החיסכון שלך ${pct}% — מעל הממוצע! תמשיך ככה.`,
      type: 'success',
      priority: 50,
      seen: false,
    })
  }

  // Low emergency fund
  if (data.totalExpenses > 0 && data.emergencyFundMonths < 3 && data.emergencyFundMonths >= 0) {
    const months = Math.round(data.emergencyFundMonths * 10) / 10
    tips.push({
      id: 'low-emergency',
      message: `קרן החירום שלך מכסה רק ${months} חודשים. מומלץ לשאוף ל-3-6 חודשים.`,
      type: 'suggestion',
      priority: 80,
      seen: false,
    })
  }

  // High subscriptions
  if (data.totalSubscriptions > 500) {
    const total = Math.round(data.totalSubscriptions).toLocaleString('he-IL')
    tips.push({
      id: 'high-subscriptions',
      message: `סה"כ מנויים: ${total} ₪/חודש. בדקת אם כולם בשימוש?`,
      type: 'info',
      priority: 60,
      seen: false,
    })
  }

  // Goal almost done
  for (const goal of data.goals) {
    if (goal.progress >= 0.8 && goal.progress < 1) {
      const pct = Math.round(goal.progress * 100)
      tips.push({
        id: `goal-almost-${goal.name}`,
        message: `כמעט שם! יעד "${goal.name}" ב-${pct}%. עוד קצת! 💪`,
        type: 'success',
        priority: 70,
        seen: false,
      })
    }
  }

  // Insurance renewal coming up
  for (const ins of data.insuranceRenewals) {
    if (ins.daysUntilRenewal > 0 && ins.daysUntilRenewal < 30) {
      tips.push({
        id: `insurance-${ins.name}`,
        message: `הביטוח "${ins.name}" מתחדש בעוד ${ins.daysUntilRenewal} ימים. כדאי להשוות מחירים!`,
        type: 'info',
        priority: 75,
        seen: false,
      })
    }
  }

  // Debt + extra money tip
  if (data.debts.length > 0 && data.monthlyAvailable > 500) {
    const extra = Math.round(data.monthlyAvailable).toLocaleString('he-IL')
    tips.push({
      id: 'debt-extra',
      message: `יש לך ${extra} ₪ פנויים החודש. אם תפנה אותם לחוב, תחסוך בריבית!`,
      type: 'suggestion',
      priority: 65,
      seen: false,
    })
  }

  // All spending under budget
  const allUnderBudget = data.categories.length > 0 && data.categories.every(c => c.budget <= 0 || c.spent <= c.budget)
  if (allUnderBudget && data.categories.length > 2) {
    tips.push({
      id: 'all-under-budget',
      message: `מעולה! כל הקטגוריות בתקציב החודש. אתם על הדרך הנכונה!`,
      type: 'success',
      priority: 40,
      seen: false,
    })
  }

  // Sort by priority descending
  tips.sort((a, b) => b.priority - a.priority)

  return tips
}
