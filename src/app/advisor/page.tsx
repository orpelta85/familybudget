'use client'

import { useUser } from '@/lib/queries/useUser'
import { useAllPersonalExpenses, useBudgetCategories } from '@/lib/queries/useExpenses'
import { useAllSharedExpenses } from '@/lib/queries/useShared'
import { useAllIncome } from '@/lib/queries/useIncome'
import { useSinkingFunds } from '@/lib/queries/useSinking'
import { useSubscriptions } from '@/lib/queries/useSubscriptions'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Sparkles, RefreshCw, Lightbulb, TrendingDown, TrendingUp, PiggyBank, AlertTriangle, Info } from 'lucide-react'
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
    case 'saving': return <PiggyBank size={16} className="text-[var(--accent-green)]" />
    case 'spending': return <TrendingDown size={16} className="text-[var(--accent-orange)]" />
    case 'fund': return <Lightbulb size={16} className="text-[var(--accent-blue)]" />
    case 'alert': return <AlertTriangle size={16} className="text-[var(--accent-red)]" />
    case 'growth': return <TrendingUp size={16} className="text-[var(--accent-green)]" />
  }
}

function getPriorityBorder(p: Tip['priority']) {
  switch (p) {
    case 'high': return 'border-r-[var(--accent-red)]'
    case 'medium': return 'border-r-[var(--accent-orange)]'
    case 'low': return 'border-r-[var(--accent-blue)]'
  }
}

export default function AdvisorPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { viewMode } = useFamilyView()
  const { data: allExpenses } = useAllPersonalExpenses(user?.id)
  const { data: allShared } = useAllSharedExpenses(familyId)
  const { data: allIncome } = useAllIncome(user?.id)
  const { data: categories } = useBudgetCategories(user?.id)
  const { data: funds } = useSinkingFunds(user?.id)
  const { data: subs } = useSubscriptions(user?.id)

  const [tips, setTips] = useState<Tip[]>([])
  const [generating, setGenerating] = useState(false)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!hasInitialized.current && user && allExpenses && allIncome && categories) {
      hasInitialized.current = true
      generateTips()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, allExpenses, allIncome, categories, funds, subs])

  async function generateTips() {
    setGenerating(true)
    setTips([])
    // Brief pause so user sees the refresh animation
    await new Promise(r => setTimeout(r, 400))
    const newTips: Tip[] = []

    // Analyze income
    const recentIncome = allIncome?.slice(-3) ?? []
    const avgIncome = recentIncome.length > 0
      ? recentIncome.reduce((s, i) => s + i.salary + i.bonus + i.other, 0) / recentIncome.length
      : 0

    // Analyze expenses by category — track unique periods for proper monthly average
    const recentExpenses = allExpenses?.slice(-100) ?? []
    const catSpend: Record<number, { name: string; total: number; periods: Set<number> }> = {}
    for (const e of recentExpenses) {
      const cat = categories?.find(c => c.id === e.category_id)
      if (!cat) continue
      if (!catSpend[cat.id]) catSpend[cat.id] = { name: cat.name, total: 0, periods: new Set() }
      catSpend[cat.id].total += e.amount
      catSpend[cat.id].periods.add(e.period_id)
    }

    // Budget utilization — compare average monthly spend (strictly greater) to target
    const overBudgetCats = (categories ?? []).filter(cat => {
      const info = catSpend[cat.id]
      if (!info || cat.monthly_target <= 0) return false
      const months = Math.max(1, info.periods.size)
      const avgMonth = info.total / months
      return avgMonth > cat.monthly_target
    })
    for (const cat of overBudgetCats) {
      const info = catSpend[cat.id]
      const months = Math.max(1, info.periods.size)
      const avgMonth = info.total / months
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

    // General financial tips pool — rotated randomly on each refresh
    const generalTips: Tip[] = [
      // פנסיה וחיסכון פנסיוני
      { icon: 'fund', title: 'בדוק את הפנסיה', body: 'ודא שהפרשות המעסיק מלאות (6.5%+6%+8.33%). דמי ניהול מעל 0.5% מהצבירה דורשים משא ומתן.', priority: 'low' },
      { icon: 'growth', title: 'קרן השתלמות', body: 'קרן השתלמות היא ההטבה הכי טובה בישראל - פטורה ממס אחרי 6 שנים. ודא שאתה מפקיד את המקסימום (2.5% עובד + 7.5% מעסיק).', priority: 'low' },
      { icon: 'fund', title: 'מסלולי פנסיה', body: 'בדוק שמסלול הפנסיה מתאים לגילך. עד גיל 40 מומלץ מסלול מנייתי (תשואה גבוהה יותר לטווח ארוך).', priority: 'low' },
      { icon: 'fund', title: 'איחוד קופות פנסיה', body: 'אם יש לך כמה קופות ממקומות עבודה שונים, שקול לאחד אותן. זה חוסך דמי ניהול כפולים.', priority: 'low' },
      // קרנות חירום וחיסכון
      { icon: 'fund', title: 'קרן חירום', body: 'מומלץ לשמור 3-6 חודשי הוצאות בחשבון נזיל לשעת חירום. זה הבסיס לכל תכנון פיננסי.', priority: 'low' },
      { icon: 'saving', title: 'כלל 50/30/20', body: '50% מההכנסה להוצאות חובה, 30% לרצונות, 20% לחיסכון והשקעות. בדוק איך ההוצאות שלך מתחלקות.', priority: 'low' },
      { icon: 'saving', title: 'שלם לעצמך קודם', body: 'העבר חיסכון אוטומטי ביום המשכורת - לפני שאתה מתחיל להוציא. מה שלא רואים, לא מוציאים.', priority: 'low' },
      { icon: 'growth', title: 'ריבית דריבית', body: 'השקעה של 1,000 ₪ בחודש עם תשואה של 7% שנתי הופכת ל-1.2 מיליון ₪ אחרי 30 שנה. התחל מוקדם.', priority: 'low' },
      // השקעות
      { icon: 'growth', title: 'השקעה פסיבית', body: 'קרן מחקה מדד S&P 500 עם דמי ניהול נמוכים (0.1%-0.3%) היא דרך פשוטה לחיסכון ארוך טווח.', priority: 'low' },
      { icon: 'growth', title: 'פיזור השקעות', body: 'אל תשים את כל הביצים בסל אחד. פזר בין מניות, אג"ח, נדל"ן וקרנות מחקות לצמצום סיכון.', priority: 'low' },
      { icon: 'growth', title: 'אל תתזמן את השוק', body: 'השקעה קבועה כל חודש (DCA) מנצחת ניסיון לתזמן את השוק ב-90% מהמקרים לאורך 20 שנה.', priority: 'low' },
      { icon: 'growth', title: 'דמי ניהול בהשקעות', body: 'הפרש של 1% בדמי ניהול לאורך 30 שנה מפחית את התיק ב-25%. בדוק ומשווה דמי ניהול.', priority: 'low' },
      // ביטוח
      { icon: 'fund', title: 'ביטוח חיים ונכות', body: 'ודא שיש לך ביטוח חיים וביטוח אובדן כושר עבודה מספיקים. בדוק את הכיסוי בתלוש השכר.', priority: 'low' },
      { icon: 'fund', title: 'ביטוח בריאות', body: 'בדוק שיש לך ביטוח משלים וביטוח שיניים. טיפול שיניים אחד יכול לעלות יותר מפרמיה שנתית.', priority: 'low' },
      { icon: 'spending', title: 'השוואת ביטוחים', body: 'פעם בשנה השווה מחירי ביטוח רכב, דירה ובריאות. הפרשים של 30-50% בין חברות על אותו כיסוי.', priority: 'low' },
      // חיסכון יומיומי
      { icon: 'saving', title: 'נהל משא ומתן', body: 'פעם בשנה כדאי לנהל מו"מ על ביטוחים, תקשורת ודמי ניהול. חיסכון ממוצע: 2,000-5,000 ₪ בשנה.', priority: 'low' },
      { icon: 'spending', title: 'בדוק חיובים חוזרים', body: 'עבור על דף המנויים ובדוק שאין חיובים שכחת לבטל. ישראלים מפסידים בממוצע 200 ₪ בחודש על מנויים לא פעילים.', priority: 'low' },
      { icon: 'saving', title: 'קניות מתוכננות', body: 'רשימת קניות חוסכת 15-25% בסופר. תכנן ארוחות שבועיות וקנה לפי רשימה בלבד.', priority: 'low' },
      { icon: 'spending', title: 'עמלות בנק', body: 'בדוק את העמלות בדף ריכוז העמלות השנתי. מעבר לבנק דיגיטלי יכול לחסוך 500-1,500 ₪ בשנה.', priority: 'low' },
      { icon: 'saving', title: 'כלל 24 השעות', body: 'לפני רכישה מעל 200 ₪ שלא תכננת, חכה 24 שעות. 70% מהרכישות האימפולסיביות נמנעות ככה.', priority: 'low' },
      { icon: 'spending', title: 'עלות לשעה', body: 'חשב כמה שעות עבודה עולה כל רכישה. טלפון ב-4,000 ₪ = 50 שעות עבודה. זה משנה פרספקטיבה.', priority: 'low' },
      // מיסים והטבות
      { icon: 'growth', title: 'הטבות מס', body: 'בדוק זכאות לנקודות זיכוי: תואר אקדמי, ילדים, יישוב מזכה, תרומות. כל נקודה שווה 2,904 ₪ בשנה.', priority: 'low' },
      { icon: 'growth', title: 'תרומות מוכרות', body: 'תרומה למוסד מוכר מעל 190 ₪ מזכה בזיכוי מס של 35%. תרומה של 1,000 ₪ = 350 ₪ חזרה.', priority: 'low' },
      { icon: 'fund', title: 'החזר מס שנתי', body: 'שכירים יכולים לבקש החזר מס עד 6 שנים אחורה. שווה לבדוק באתר רשות המסים או עם רואה חשבון.', priority: 'low' },
      { icon: 'growth', title: 'הפקדה לפנסיה כעצמאי', body: 'עצמאים יכולים להפקיד עד 16.5% מההכנסה לפנסיה ולקבל הטבת מס משמעותית. אל תוותרו.', priority: 'low' },
      // תכנון פרישה ועתיד
      { icon: 'fund', title: 'תכנון פרישה', body: 'חשב כמה תצטרך לפרישה: הכפל את ההוצאה החודשית הרצויה ב-300. זה הסכום שצריך לצבור.', priority: 'low' },
      { icon: 'fund', title: 'גיל פרישה', body: 'גיל פרישה בישראל: 67 לגברים, 65 לנשים (עולה בהדרגה). תכנן את החיסכון בהתאם למספר השנים שנותרו.', priority: 'low' },
      { icon: 'growth', title: 'פנסיה תקציבית vs צוברת', body: 'אם אתה זכאי לפנסיה תקציבית ממקום עבודה ישן, אל תפספס אותה. היא שווה הרבה יותר מצוברת.', priority: 'low' },
      // משכנתא ונדל"ן
      { icon: 'spending', title: 'מחזור משכנתא', body: 'בדוק אם כדאי למחזר את המשכנתא. ירידה של 0.5% בריבית על מיליון ₪ חוסכת עשרות אלפי ₪.', priority: 'low' },
      { icon: 'fund', title: 'מסלולי משכנתא', body: 'פזר את המשכנתא בין 3 מסלולים לפחות: קבועה צמודה, קבועה לא צמודה, ופריים. זה מצמצם סיכון.', priority: 'low' },
      { icon: 'spending', title: 'עלויות נלוות בדירה', body: 'בחישוב עלות דירה, הוסף 5-8% לעלויות: מס רכישה, עו"ד, שיפוץ, מכשירי חשמל, מעבר.', priority: 'low' },
      // ילדים ומשפחה
      { icon: 'saving', title: 'חיסכון לילדים', body: 'חיסכון של 200 ₪ בחודש מגיל 0 מגיע ל-80,000 ₪+ עד גיל 18. תכנית חיסכון לכל ילד היא מתנה לעתיד.', priority: 'low' },
      { icon: 'fund', title: 'קצבת ילדים', body: 'קצבת הילדים מביטוח לאומי: 164 ₪ לילד (2024). העבר אוטומטית לחיסכון - הילדים לא ירגישו.', priority: 'low' },
      { icon: 'saving', title: 'חינוך פיננסי לילדים', body: 'תנו לילדים דמי כיס קבועים מגיל 6-7 ותנו להם לנהל תקציב קטן. זה בונה הרגלים טובים לחיים.', priority: 'low' },
      // הרגלים פיננסיים
      { icon: 'saving', title: 'יום כספים חודשי', body: 'קבע יום קבוע בחודש לסקירת הוצאות, עדכון תקציב ובדיקת חשבון. 30 דקות שחוסכות אלפים.', priority: 'low' },
      { icon: 'fund', title: 'צוואה ויפוי כח', body: 'גם אם אתה צעיר, צוואה וייפוי כוח מתמשך הם חובה. זה מגן על המשפחה ועולה 1,000-2,000 ₪ פעם אחת.', priority: 'low' },
      { icon: 'growth', title: 'השכלה פיננסית', body: 'קרא ספר אחד בשנה על כסף. המלצות: "אבא עשיר אבא עני", "המשקיע הנבון", "נבל דרך ככלב".', priority: 'low' },
    ]

    // Fisher-Yates shuffle for reliable randomization
    for (let i = generalTips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [generalTips[i], generalTips[j]] = [generalTips[j], generalTips[i]]
    }
    const pickCount = newTips.length >= 3 ? 3 : 4
    newTips.push(...generalTips.slice(0, pickCount))

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
          <Lightbulb size={18} className="text-[var(--accent-orange)]" />
          <h1 className="text-xl font-bold tracking-tight">טיפים פיננסיים</h1>
          <PageInfo {...PAGE_TIPS.advisor} />
        </div>
        <button onClick={generateTips} disabled={generating} className="flex items-center gap-1.5 bg-[var(--c-orange-0-20)] border border-[var(--c-orange-0-32)] rounded-lg px-3.5 py-[7px] text-[var(--accent-orange)] text-[13px] font-medium cursor-pointer">
          <RefreshCw size={13} className={generating ? 'animate-spin' : ''} /> רענן
        </button>
      </div>
      <p className="text-[var(--text-secondary)] text-[13px] mb-5">המלצות מותאמות אישית על בסיס הנתונים הפיננסיים שלך</p>

      {viewMode === 'family' && (
        <div className="bg-[var(--c-blue-0-18)] border border-[var(--c-blue-0-28)] rounded-xl px-5 py-3.5 mb-5 flex items-center gap-3">
          <Info size={18} className="text-[var(--accent-blue)] shrink-0" />
          <div>
            <div className="font-semibold text-sm text-[var(--accent-blue)]">היועץ מנתח נתונים אישיים</div>
            <div className="text-xs text-[var(--text-secondary)]">עבור לתצוגה אישית לקבלת המלצות מותאמות</div>
          </div>
        </div>
      )}

      {!tips.length
        ? <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-10 text-center text-[var(--text-secondary)] text-sm">טוען המלצות...</div>
        : (
          <div className="flex flex-col gap-3">
            {tips.map((tip, i) => (
              <div key={i} className={`bg-[var(--bg-card)] border border-[var(--border-default)] border-r-2 ${getPriorityBorder(tip.priority)} rounded-xl px-5 py-4`}>
                <div className="flex items-center gap-2 mb-2">
                  {getIcon(tip.icon)}
                  <span className="font-semibold text-sm">{tip.title}</span>
                </div>
                <p className="text-[13px] text-[var(--c-0-70)] leading-relaxed m-0">{tip.body}</p>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
