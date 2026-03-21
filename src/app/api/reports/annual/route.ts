import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

function fmt(n: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n)
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const yearParam = req.nextUrl.searchParams.get('year') ?? '2'
  const yearNumber = Number(yearParam)
  const sb = createServiceClient()

  // Get user profile
  const { data: profile } = await sb.from('profiles').select('name').eq('id', authUser.id).single()
  const userName = profile?.name ?? 'משתמש'

  // Get family
  const { data: membership } = await sb.from('family_members').select('family_id').eq('user_id', authUser.id).maybeSingle()
  const familyId = membership?.family_id

  // Get family info
  let familyName = ''
  if (familyId) {
    const { data: fam } = await sb.from('families').select('name').eq('id', familyId).single()
    familyName = fam?.name ?? ''
  }

  // Get periods for this year
  const { data: periods } = await sb.from('periods').select('*').eq('year_number', yearNumber).order('id')
  const periodIds = (periods ?? []).map(p => p.id)

  if (!periodIds.length) {
    return new NextResponse(generateHTML(userName, familyName, yearNumber, {
      totalIncome: 0, totalExpenses: 0, savingsRate: 0, totalSaved: 0,
      monthlyData: [], categoryBreakdown: [], topCategories: [],
      bestMonth: null, worstMonth: null, surpriseCategory: null,
      goals: [], sinkingFunds: [],
    }), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  // Fetch income
  const { data: incomeData } = await sb.from('income').select('*').eq('user_id', authUser.id).in('period_id', periodIds)
  const totalIncome = (incomeData ?? []).reduce((s, i) => s + i.salary + i.bonus + i.other, 0)
  const avgMonthlyIncome = periodIds.length > 0 ? totalIncome / periodIds.length : 0

  // Fetch personal expenses
  const { data: expenseData } = await sb.from('personal_expenses').select('*, budget_categories(name)').eq('user_id', authUser.id).in('period_id', periodIds)
  const totalExpenses = (expenseData ?? []).reduce((s, e) => s + e.amount, 0)

  // Fetch shared expenses
  let totalShared = 0
  if (familyId) {
    const { data: sharedData } = await sb.from('shared_expenses').select('*').eq('family_id', familyId).in('period_id', periodIds)
    totalShared = (sharedData ?? []).reduce((s, e) => s + (e.my_share ?? e.total_amount * 0.5), 0)
  }

  const totalAllExpenses = totalExpenses + totalShared
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalAllExpenses) / totalIncome) * 100 : 0
  const totalSaved = totalIncome - totalAllExpenses

  // Monthly data
  const monthlyData = (periods ?? []).map(p => {
    const income = (incomeData ?? []).filter(i => i.period_id === p.id)
    const expenses = (expenseData ?? []).filter(e => e.period_id === p.id)
    const monthIncome = income.reduce((s, i) => s + i.salary + i.bonus + i.other, 0)
    const monthExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    return {
      label: p.label,
      income: monthIncome,
      expenses: monthExpenses,
      net: monthIncome - monthExpenses,
    }
  })

  // Category breakdown
  const catMap: Record<string, number> = {}
  for (const e of (expenseData ?? [])) {
    const name = e.budget_categories?.name ?? 'אחר'
    catMap[name] = (catMap[name] ?? 0) + e.amount
  }
  const categoryBreakdown = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const topCategories = categoryBreakdown.slice(0, 5)

  // Best/worst months
  const activeMonths = monthlyData.filter(m => m.income > 0)
  const bestMonth = activeMonths.length > 0 ? activeMonths.reduce((best, m) => m.net > best.net ? m : best) : null
  const worstMonth = activeMonths.length > 0 ? activeMonths.reduce((worst, m) => m.net < worst.net ? m : worst) : null

  // Surprise category (most over budget)
  const { data: categories } = await sb.from('budget_categories').select('*').eq('user_id', authUser.id).eq('is_active', true)
  let surpriseCategory: { name: string; overAmount: number } | null = null
  if (categories) {
    for (const cat of categories) {
      if (cat.monthly_target <= 0) continue
      const spent = catMap[cat.name] ?? 0
      const budgetTotal = cat.monthly_target * periodIds.length
      const over = spent - budgetTotal
      if (over > 0 && (!surpriseCategory || over > surpriseCategory.overAmount)) {
        surpriseCategory = { name: cat.name, overAmount: over }
      }
    }
  }

  // Goals
  const { data: goalsData } = await sb.from('savings_goals').select('*').eq('user_id', authUser.id).eq('is_active', true)
  const goals: { name: string; target: number; deposited: number; pct: number }[] = []
  if (goalsData) {
    for (const g of goalsData) {
      const { data: deposits } = await sb.from('goal_deposits').select('amount_deposited').eq('goal_id', g.id)
      const deposited = (deposits ?? []).reduce((s, d) => s + d.amount_deposited, 0)
      goals.push({ name: g.name, target: g.target_amount, deposited, pct: g.target_amount > 0 ? Math.round((deposited / g.target_amount) * 100) : 0 })
    }
  }

  // Sinking funds
  const { data: fundsData } = await sb.from('sinking_funds').select('*').eq('user_id', authUser.id).eq('is_active', true)
  const sinkingFunds: { name: string; target: number; balance: number }[] = []
  if (fundsData) {
    for (const f of fundsData) {
      const { data: txns } = await sb.from('sinking_fund_transactions').select('amount').eq('fund_id', f.id)
      const balance = (txns ?? []).reduce((s, t) => s + t.amount, 0)
      sinkingFunds.push({ name: f.name, target: f.yearly_target, balance })
    }
  }

  const html = generateHTML(userName, familyName, yearNumber, {
    totalIncome, totalExpenses: totalAllExpenses, savingsRate, totalSaved,
    monthlyData, categoryBreakdown, topCategories,
    bestMonth, worstMonth, surpriseCategory,
    goals, sinkingFunds,
  })

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

interface ReportData {
  totalIncome: number
  totalExpenses: number
  savingsRate: number
  totalSaved: number
  monthlyData: { label: string; income: number; expenses: number; net: number }[]
  categoryBreakdown: [string, number][]
  topCategories: [string, number][]
  bestMonth: { label: string; net: number } | null
  worstMonth: { label: string; net: number } | null
  surpriseCategory: { name: string; overAmount: number } | null
  goals: { name: string; target: number; deposited: number; pct: number }[]
  sinkingFunds: { name: string; target: number; balance: number }[]
}

function generateHTML(userName: string, familyName: string, yearNumber: number, data: ReportData): string {
  const yearLabel = yearNumber === 1 ? '2025' : yearNumber === 2 ? '2026' : yearNumber === 3 ? '2027' : String(2024 + yearNumber)
  const avgMonthlyIncome = data.monthlyData.length > 0 ? data.totalIncome / data.monthlyData.length : 0
  const avgMonthlyExpenses = data.monthlyData.length > 0 ? data.totalExpenses / data.monthlyData.length : 0
  const israeliAvgSavings = 15

  const categoryRows = data.topCategories.map(([name, amount]) => {
    const pct = data.totalExpenses > 0 ? ((amount / data.totalExpenses) * 100).toFixed(1) : '0'
    const barW = data.topCategories[0]?.[1] > 0 ? Math.round((amount / data.topCategories[0][1]) * 100) : 0
    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <span style="width:80px;text-align:right;font-size:13px;color:#b0b8c8">${name}</span>
        <div style="flex:1;height:18px;border-radius:4px;background:#1a1e2e;overflow:hidden">
          <div style="height:100%;width:${barW}%;background:linear-gradient(90deg,#5b7cf7,#8b5cf6);border-radius:4px"></div>
        </div>
        <span style="width:80px;text-align:left;font-size:12px;color:#8891a5">${fmt(amount)} (${pct}%)</span>
      </div>`
  }).join('')

  const monthlyRows = data.monthlyData.map(m => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2235;color:#b0b8c8;font-size:13px">${m.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2235;text-align:left;color:#5b7cf7;font-size:13px">${fmt(m.income)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2235;text-align:left;color:#f59e42;font-size:13px">${fmt(m.expenses)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2235;text-align:left;font-weight:600;color:${m.net >= 0 ? '#34d399' : '#ef4444'};font-size:13px">${fmt(m.net)}</td>
    </tr>`).join('')

  const goalRows = data.goals.map(g => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
        <span style="color:#e0e4ef">${g.name}</span>
        <span style="color:#8891a5">${g.pct}% — ${fmt(g.deposited)} / ${fmt(g.target)}</span>
      </div>
      <div style="height:6px;border-radius:3px;background:#1a1e2e;overflow:hidden">
        <div style="height:100%;width:${Math.min(g.pct, 100)}%;background:#34d399;border-radius:3px"></div>
      </div>
    </div>`).join('')

  const fundRows = data.sinkingFunds.map(f => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1e2235;font-size:13px">
      <span style="color:#e0e4ef">${f.name}</span>
      <span style="color:#5b7cf7;font-weight:600">${fmt(f.balance)}</span>
    </div>`).join('')

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>סיכום שנתי ${yearLabel}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; background:#0c0e1a; color:#e0e4ef; }
  .page { max-width:800px; margin:0 auto; padding:40px; }
  .cover { text-align:center; padding:80px 40px; border-radius:20px; background:linear-gradient(135deg,#151829 0%,#1a1e35 100%); border:1px solid #262a42; margin-bottom:40px; }
  .cover h1 { font-size:32px; font-weight:800; letter-spacing:-1px; background:linear-gradient(135deg,#5b7cf7,#8b5cf6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:8px; }
  .cover .subtitle { font-size:16px; color:#8891a5; margin-bottom:4px; }
  .cover .date { font-size:13px; color:#555d75; }
  .section { background:#13162a; border:1px solid #1e2235; border-radius:16px; padding:28px; margin-bottom:20px; }
  .section-title { font-size:16px; font-weight:700; margin-bottom:20px; color:#e0e4ef; }
  .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:20px; }
  .kpi { background:#181c32; border:1px solid #232740; border-radius:12px; padding:16px; }
  .kpi .label { font-size:11px; color:#8891a5; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }
  .kpi .value { font-size:22px; font-weight:700; }
  .blue { color:#5b7cf7; }
  .orange { color:#f59e42; }
  .green { color:#34d399; }
  .red { color:#ef4444; }
  .purple { color:#8b5cf6; }
  table { width:100%; border-collapse:collapse; }
  th { padding:8px 12px; text-align:right; font-size:11px; color:#8891a5; text-transform:uppercase; border-bottom:2px solid #232740; }
  .fun-stat { background:#181c32; border:1px solid #232740; border-radius:12px; padding:16px 20px; margin-bottom:10px; font-size:14px; }
  .fun-stat .emoji { font-size:18px; margin-left:8px; }
  .footer { text-align:center; padding:30px; font-size:12px; color:#555d75; }
  @media print {
    body { background:#0c0e1a; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { padding:20px; }
    .section { break-inside:avoid; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Cover -->
  <div class="cover">
    <h1>סיכום שנתי ${yearLabel}</h1>
    <div class="subtitle">${familyName ? `משפחת ${familyName}` : userName}</div>
    <div class="date">הופק בתאריך ${new Date().toLocaleDateString('he-IL')}</div>
  </div>

  <!-- Income -->
  <div class="section">
    <div class="section-title">הכנסות</div>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="label">סה"כ שנתי</div>
        <div class="value blue">${fmt(data.totalIncome)}</div>
      </div>
      <div class="kpi">
        <div class="label">ממוצע חודשי</div>
        <div class="value blue">${fmt(avgMonthlyIncome)}</div>
      </div>
    </div>
  </div>

  <!-- Expenses -->
  <div class="section">
    <div class="section-title">הוצאות</div>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="label">סה"כ שנתי</div>
        <div class="value orange">${fmt(data.totalExpenses)}</div>
      </div>
      <div class="kpi">
        <div class="label">ממוצע חודשי</div>
        <div class="value orange">${fmt(avgMonthlyExpenses)}</div>
      </div>
    </div>
    <div style="margin-top:16px">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#b0b8c8">Top 5 קטגוריות</div>
      ${categoryRows}
    </div>
  </div>

  <!-- Savings -->
  <div class="section">
    <div class="section-title">חיסכון</div>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="label">שיעור חיסכון</div>
        <div class="value ${data.savingsRate >= israeliAvgSavings ? 'green' : 'red'}">${data.savingsRate.toFixed(1)}%</div>
      </div>
      <div class="kpi">
        <div class="label">סה"כ חסכת</div>
        <div class="value green">${fmt(data.totalSaved)}</div>
      </div>
      <div class="kpi">
        <div class="label">ממוצע ישראלי</div>
        <div class="value" style="color:#8891a5">${israeliAvgSavings}%</div>
      </div>
    </div>
    <div style="font-size:13px;color:#8891a5;margin-top:8px">
      ${data.savingsRate >= israeliAvgSavings
        ? `מעולה! אתם חוסכים מעל הממוצע הישראלי (${israeliAvgSavings}%).`
        : `שיעור החיסכון נמוך מהממוצע הישראלי (${israeliAvgSavings}%). שווה לבחון אפשרויות לצמצום הוצאות.`}
    </div>
  </div>

  <!-- Monthly Breakdown -->
  <div class="section">
    <div class="section-title">פירוט חודשי</div>
    <table>
      <thead>
        <tr>
          <th>מחזור</th>
          <th style="text-align:left">הכנסות</th>
          <th style="text-align:left">הוצאות</th>
          <th style="text-align:left">תזרים</th>
        </tr>
      </thead>
      <tbody>${monthlyRows}</tbody>
    </table>
  </div>

  ${data.goals.length > 0 ? `
  <!-- Goals -->
  <div class="section">
    <div class="section-title">יעדי חיסכון</div>
    ${goalRows}
  </div>` : ''}

  ${data.sinkingFunds.length > 0 ? `
  <!-- Sinking Funds -->
  <div class="section">
    <div class="section-title">קרנות צבירה</div>
    ${fundRows}
  </div>` : ''}

  <!-- Fun Stats -->
  <div class="section">
    <div class="section-title">סטטיסטיקות מעניינות</div>
    ${data.surpriseCategory ? `
    <div class="fun-stat">
      <span class="emoji">🎯</span>
      הקטגוריה שהכי הפתיעה: <strong>${data.surpriseCategory.name}</strong> — ${fmt(data.surpriseCategory.overAmount)} מעל התקציב
    </div>` : ''}
    ${data.bestMonth ? `
    <div class="fun-stat">
      <span class="emoji">🏆</span>
      החודש הכי חסכוני: <strong>${data.bestMonth.label}</strong> — תזרים של ${fmt(data.bestMonth.net)}
    </div>` : ''}
    ${data.worstMonth ? `
    <div class="fun-stat">
      <span class="emoji">📉</span>
      החודש הכי יקר: <strong>${data.worstMonth.label}</strong> — תזרים של ${fmt(data.worstMonth.net)}
    </div>` : ''}
    <div class="fun-stat">
      <span class="emoji">💡</span>
      טיפ: ${data.savingsRate >= 20
        ? 'שיעור החיסכון שלך מצוין! שקול להשקיע את העודפים בקרן השתלמות או תיק השקעות.'
        : data.savingsRate >= 10
        ? 'שיעור חיסכון סביר. נסו לזהות 2-3 קטגוריות שניתן לצמצם ב-10% כדי להגיע ל-20%.'
        : 'שיעור החיסכון נמוך מהרצוי. מומלץ לעשות סקירת הוצאות ולזהות חיובים שניתן לבטל.'}
    </div>
  </div>

  <div class="footer">
    הופק על ידי Family Plan — ${new Date().toLocaleDateString('he-IL')}
  </div>
</div>
</body>
</html>`
}
