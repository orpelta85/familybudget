import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

function fmt(n: number): string {
  const formatted = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(Math.abs(n))
  const sign = n < 0 ? '-' : ''
  return `${sign}${formatted} ₪`
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = req.nextUrl.searchParams.get('user_id')
  const periodId = req.nextUrl.searchParams.get('period_id')

  if (!userId || !periodId) {
    return NextResponse.json({ error: 'Missing user_id or period_id' }, { status: 400 })
  }

  if (authUser.id !== userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()

  // Fetch income
  const { data: income } = await sb
    .from('income')
    .select('salary, bonus, other')
    .eq('user_id', userId)
    .eq('period_id', Number(periodId))
    .single()

  const totalIncome = Number(income?.salary ?? 0) + Number(income?.bonus ?? 0) + Number(income?.other ?? 0)

  // Fetch personal expenses with categories
  const { data: expenses } = await sb
    .from('personal_expenses')
    .select('amount, category_id, budget_categories(name)')
    .eq('user_id', userId)
    .eq('period_id', Number(periodId))

  const totalExpenses = (expenses ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0)
  const netFlow = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? Math.round((netFlow / totalIncome) * 100) : 0

  // Category spending
  const catSpend: Record<string, number> = {}
  for (const e of expenses ?? []) {
    const catName = (e.budget_categories as unknown as { name: string } | null)?.name ?? 'אחר'
    catSpend[catName] = (catSpend[catName] ?? 0) + Number(e.amount)
  }

  // Fetch budget categories for utilization
  const { data: categories } = await sb
    .from('budget_categories')
    .select('id, name, monthly_target')
    .eq('user_id', userId)

  // Top 3 overspent
  const overspent = (categories ?? [])
    .map(c => {
      const spent = catSpend[c.name] ?? 0
      const target = Number(c.monthly_target)
      const pct = target > 0 ? (spent / target) * 100 : 0
      return { name: c.name, spent, target, pct }
    })
    .filter(c => c.pct > 100)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)

  // Budget utilization
  const totalBudget = (categories ?? []).reduce((s, c) => s + Number(c.monthly_target), 0)
  const budgetUtilization = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0

  // Sinking funds progress
  const { data: funds } = await sb
    .from('sinking_funds')
    .select('id, name, yearly_target')
    .eq('user_id', userId)
    .eq('is_active', true)

  const { data: fundTx } = await sb
    .from('sinking_fund_transactions')
    .select('fund_id, amount')
    .in('fund_id', (funds ?? []).map(f => f.id))

  const fundProgress = (funds ?? []).map(f => {
    const balance = (fundTx ?? [])
      .filter(t => t.fund_id === f.id)
      .reduce((s, t) => s + Number(t.amount), 0)
    const target = Number(f.yearly_target)
    return { name: f.name, balance, target, pct: target > 0 ? Math.round((balance / target) * 100) : 0 }
  })

  // Period info
  const { data: period } = await sb
    .from('periods')
    .select('label, start_date')
    .eq('id', Number(periodId))
    .single()

  const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
  const d = period?.start_date ? new Date(period.start_date) : new Date()
  const periodLabel = `${HE_MONTHS[d.getMonth()]} ${d.getFullYear()}`

  // Generate HTML email
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #0d0d1a; color: #e0e0e8; font-family: 'Heebo', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 22px; color: #fff; margin: 0 0 8px; }
    .header p { font-size: 14px; color: #8888a0; margin: 0; }
    .kpi-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
    .kpi { flex: 1; min-width: 120px; background: #1a1a2e; border: 1px solid #2a2a40; border-radius: 12px; padding: 16px; text-align: center; }
    .kpi .value { font-size: 20px; font-weight: 700; color: #fff; }
    .kpi .label { font-size: 12px; color: #8888a0; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; font-weight: 700; margin: 0 0 12px; color: #b0b0c8; border-bottom: 1px solid #2a2a40; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1a1a2e; font-size: 13px; }
    .row .name { color: #c0c0d0; }
    .row .val { font-weight: 600; }
    .overspent { color: #e06050; }
    .good { color: #50c878; }
    .warn { color: #e8a840; }
    .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #2a2a40; font-size: 11px; color: #6060a0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>סיכום חודשי — ${periodLabel}</h1>
      <p>Family Plan</p>
    </div>

    <div class="kpi-grid">
      <div class="kpi">
        <div class="value">${fmt(totalIncome)}</div>
        <div class="label">הכנסות</div>
      </div>
      <div class="kpi">
        <div class="value">${fmt(totalExpenses)}</div>
        <div class="label">הוצאות</div>
      </div>
      <div class="kpi">
        <div class="value ${netFlow >= 0 ? 'good' : 'overspent'}">${fmt(netFlow)}</div>
        <div class="label">תזרים נקי</div>
      </div>
      <div class="kpi">
        <div class="value">${savingsRate}%</div>
        <div class="label">אחוז חיסכון</div>
      </div>
    </div>

    <div class="section">
      <h2>ניצול תקציב: ${budgetUtilization}%</h2>
      <div style="background: #1a1a2e; border-radius: 8px; height: 8px; overflow: hidden;">
        <div style="background: ${budgetUtilization > 100 ? '#e06050' : budgetUtilization > 80 ? '#e8a840' : '#50c878'}; height: 100%; width: ${Math.min(budgetUtilization, 100)}%; border-radius: 8px;"></div>
      </div>
    </div>

    ${overspent.length > 0 ? `
    <div class="section">
      <h2>קטגוריות בחריגה</h2>
      ${overspent.map(c => `
      <div class="row">
        <span class="name">${c.name}</span>
        <span class="val overspent">${fmt(c.spent)} / ${fmt(c.target)} (${Math.round(c.pct)}%)</span>
      </div>`).join('')}
    </div>` : ''}

    ${fundProgress.length > 0 ? `
    <div class="section">
      <h2>קרנות צבירה</h2>
      ${fundProgress.map(f => `
      <div class="row">
        <span class="name">${f.name}</span>
        <span class="val ${f.pct >= 100 ? 'good' : f.pct >= 50 ? 'warn' : ''}">${fmt(f.balance)} / ${fmt(f.target)} (${f.pct}%)</span>
      </div>`).join('')}
    </div>` : ''}

    <div class="footer">
      <p>דוח זה נוצר אוטומטית על ידי Family Plan</p>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
