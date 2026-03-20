'use client'

import { useUser } from '@/lib/queries/useUser'
import { useAllPersonalExpenses, useBudgetCategories } from '@/lib/queries/useExpenses'
import { useAllSharedExpenses } from '@/lib/queries/useShared'
import { useAllIncome } from '@/lib/queries/useIncome'
import { useSinkingFunds } from '@/lib/queries/useSinking'
import { useSubscriptions } from '@/lib/queries/useSubscriptions'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, Lightbulb, TrendingDown, TrendingUp, PiggyBank, AlertTriangle } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'

interface Tip {
  icon: 'saving' | 'spending' | 'fund' | 'alert' | 'growth'
  title: string
  body: string
  priority: 'high' | 'medium' | 'low'
}

function getIcon(type: Tip['icon']) {
  switch (type) {
    case 'saving': return <PiggyBank size={16} className="text-[oklch(0.70_0.18_145)]" />
    case 'spending': return <TrendingDown size={16} className="text-[oklch(0.72_0.18_55)]" />
    case 'fund': return <Lightbulb size={16} className="text-[oklch(0.65_0.18_250)]" />
    case 'alert': return <AlertTriangle size={16} className="text-[oklch(0.62_0.22_27)]" />
    case 'growth': return <TrendingUp size={16} className="text-[oklch(0.70_0.18_145)]" />
  }
}

function getPriorityBorder(p: Tip['priority']) {
  switch (p) {
    case 'high': return 'border-l-[oklch(0.62_0.22_27)]'
    case 'medium': return 'border-l-[oklch(0.72_0.18_55)]'
    case 'low': return 'border-l-[oklch(0.65_0.18_250)]'
  }
}

export default function AdvisorPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { data: allExpenses } = useAllPersonalExpenses(user?.id)
  const { data: allShared } = useAllSharedExpenses(familyId)
  const { data: allIncome } = useAllIncome(user?.id)
  const { data: categories } = useBudgetCategories(user?.id)
  const { data: funds } = useSinkingFunds(user?.id)
  const { data: subs } = useSubscriptions(user?.id)

  const [tips, setTips] = useState<Tip[]>([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (user && allExpenses && allIncome && categories) {
      generateTips()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, allExpenses, allIncome, categories, funds, subs])

  function generateTips() {
    setGenerating(true)
    const newTips: Tip[] = []

    // Analyze income
    const recentIncome = allIncome?.slice(-3) ?? []
    const avgIncome = recentIncome.length > 0
      ? recentIncome.reduce((s, i) => s + i.salary + i.bonus + i.other, 0) / recentIncome.length
      : 0

    // Analyze expenses by category
    const recentExpenses = allExpenses?.slice(-100) ?? []
    const catSpend: Record<number, { name: string; total: number; count: number }> = {}
    for (const e of recentExpenses) {
      const cat = categories?.find(c => c.id === e.category_id)
      if (!cat) continue
      if (!catSpend[cat.id]) catSpend[cat.id] = { name: cat.name, total: 0, count: 0 }
      catSpend[cat.id].total += e.amount
      catSpend[cat.id].count++
    }

    // Budget utilization
    const overBudgetCats = (categories ?? []).filter(cat => {
      const spent = catSpend[cat.id]?.total ?? 0
      return cat.monthly_target > 0 && spent > cat.monthly_target * 3 // 3 months
    })
    for (const cat of overBudgetCats) {
      const spent = catSpend[cat.id]?.total ?? 0
      const months = Math.max(1, catSpend[cat.id]?.count ?? 1)
      const avgMonth = spent / months
      newTips.push({
        icon: 'alert',
        title: `חריגה ב${cat.name}`,
        body: `ממוצע חודשי: ${formatCurrency(avgMonth)} מתוך יעד ${formatCurrency(cat.monthly_target)}. שקול להגדיל את התקציב או לצמצם הוצאות.`,
        priority: 'high',
      })
    }

    // Savings rate
    const totalExpenses = recentExpenses.reduce((s, e) => s + e.amount, 0)
    const totalShared = (allShared ?? []).slice(-20).reduce((s, e) => s + e.total_amount, 0)
    const months = Math.max(1, recentIncome.length)
    const avgExpense = (totalExpenses + totalShared) / months
    if (avgIncome > 0) {
      const savingsRate = ((avgIncome - avgExpense) / avgIncome) * 100
      if (savingsRate < 10) {
        newTips.push({
          icon: 'saving',
          title: 'שיעור חיסכון נמוך',
          body: `שיעור החיסכון שלך הוא ${savingsRate.toFixed(0)}%. מומלץ לשאוף ל-20% לפחות. נסה לזהות הוצאות שניתן לצמצם.`,
          priority: 'high',
        })
      } else if (savingsRate >= 20) {
        newTips.push({
          icon: 'growth',
          title: 'חיסכון מצוין!',
          body: `שיעור החיסכון שלך הוא ${savingsRate.toFixed(0)}%. שקול להשקיע את העודפים בקרן השתלמות או תיק השקעות.`,
          priority: 'low',
        })
      }
    }

    // Subscription analysis
    const activeSubs = (subs ?? []).filter(s => s.is_active)
    const subTotal = activeSubs.reduce((s, sub) => s + sub.amount, 0)
    if (subTotal > 0 && avgIncome > 0) {
      const subPct = (subTotal / avgIncome) * 100
      if (subPct > 5) {
        newTips.push({
          icon: 'spending',
          title: 'הוצאות מנויים גבוהות',
          body: `מנויים מהווים ${subPct.toFixed(1)}% מההכנסה (${formatCurrency(subTotal)}/חודש). בדוק אם כל המנויים בשימוש.`,
          priority: 'medium',
        })
      }
    }

    // Sinking fund tips
    const totalFundMonthly = (funds ?? []).reduce((s, f) => s + f.monthly_allocation, 0)
    if (totalFundMonthly === 0 && avgIncome > 0) {
      newTips.push({
        icon: 'fund',
        title: 'אין קרנות צבירה',
        body: 'מומלץ להקצות קרנות שנתיות (חופשות, חירום, רכב) כדי להימנע מהפתעות.',
        priority: 'medium',
      })
    }

    // Israeli-specific: pension check
    if (avgIncome > 0) {
      newTips.push({
        icon: 'fund',
        title: 'בדוק את הפנסיה',
        body: 'ודא שהפרשות המעסיק מלאות (6.5%+6%+8.33%). דמי ניהול מעל 0.5% מהצבירה דורשים משא ומתן.',
        priority: 'low',
      })
    }

    // Keren hishtalmut tip
    newTips.push({
      icon: 'growth',
      title: 'קרן השתלמות',
      body: 'קרן השתלמות היא ההטבה הכי טובה בישראל — פטורה ממס אחרי 6 שנים. ודא שאתה מפקיד את המקסימום (2.5% עובד + 7.5% מעסיק).',
      priority: 'low',
    })

    // Sort by priority
    const order = { high: 0, medium: 1, low: 2 }
    newTips.sort((a, b) => order[a.priority] - order[b.priority])

    setTips(newTips)
    setGenerating(false)
  }

  if (loading || !user) return <TableSkeleton rows={5} />

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[oklch(0.72_0.18_55)]" />
          <h1 className="text-xl font-bold tracking-tight">יועץ פיננסי</h1>
          <PageInfo {...PAGE_TIPS.advisor} />
        </div>
        <button onClick={generateTips} disabled={generating} className="flex items-center gap-1.5 bg-[oklch(0.20_0.04_55)] border border-[oklch(0.32_0.08_55)] rounded-lg px-3.5 py-[7px] text-[oklch(0.72_0.18_55)] text-[13px] font-medium cursor-pointer">
          <RefreshCw size={13} className={generating ? 'animate-spin' : ''} /> רענן
        </button>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">המלצות מותאמות אישית על בסיס הנתונים הפיננסיים שלך</p>

      {!tips.length
        ? <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-10 text-center text-[oklch(0.65_0.01_250)] text-sm">טוען המלצות...</div>
        : (
          <div className="flex flex-col gap-3">
            {tips.map((tip, i) => (
              <div key={i} className={`bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] border-l-2 ${getPriorityBorder(tip.priority)} rounded-xl px-5 py-4`}>
                <div className="flex items-center gap-2 mb-2">
                  {getIcon(tip.icon)}
                  <span className="font-semibold text-sm">{tip.title}</span>
                </div>
                <p className="text-[13px] text-[oklch(0.70_0.01_250)] leading-relaxed m-0">{tip.body}</p>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
