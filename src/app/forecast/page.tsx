'use client'

import { useUser } from '@/lib/queries/useUser'
import { useAllIncome } from '@/lib/queries/useIncome'
import { useSubscriptions } from '@/lib/queries/useSubscriptions'
import { useSinkingFunds } from '@/lib/queries/useSinking'
import { useAllSharedExpenses } from '@/lib/queries/useShared'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { CalendarDays, AlertTriangle, TrendingUp } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'

interface ForecastDay {
  date: string
  label: string
  balance: number
  income: number
  expense: number
}

export default function ForecastPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { data: allIncome } = useAllIncome(user?.id)
  const { data: subs } = useSubscriptions(user?.id)
  const { data: funds } = useSinkingFunds(user?.id)
  const { data: allShared } = useAllSharedExpenses(familyId)
  const splitFrac = useSplitFraction(user?.id)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const forecast = useMemo(() => {
    if (!allIncome) return []

    // Estimate monthly income from latest data
    const latestIncome = allIncome[allIncome.length - 1]
    const monthlyIncome = latestIncome ? latestIncome.salary + latestIncome.bonus + latestIncome.other : 0

    // Monthly recurring from subscriptions
    const activeSubs = (subs ?? []).filter(s => s.is_active)

    // Monthly sinking fund allocations
    const fundTotal = (funds ?? []).reduce((s, f) => s + f.monthly_allocation, 0)

    // Average monthly shared expenses (from last 3 entries)
    const recentShared = (allShared ?? []).slice(-3)
    const avgSharedMonthly = recentShared.length > 0
      ? recentShared.reduce((s, e) => s + e.total_amount * splitFrac, 0) / recentShared.length
      : 0

    // Build 90-day forecast
    const today = new Date()
    const days: ForecastDay[] = []
    let runningBalance = monthlyIncome // Start with estimated current balance

    for (let d = 0; d < 90; d++) {
      const date = new Date(today)
      date.setDate(today.getDate() + d)
      const day = date.getDate()
      const month = date.getMonth()
      const dateStr = date.toISOString().split('T')[0]
      const label = `${day}/${month + 1}`

      let dayIncome = 0
      let dayExpense = 0

      // Income on the 10th (typical Israeli salary day)
      if (day === 10) {
        dayIncome += monthlyIncome
      }

      // Subscription charges on their billing days
      for (const sub of activeSubs) {
        if (day === sub.billing_day) {
          dayExpense += sub.amount
        }
      }

      // Sinking fund allocation on the 11th (period start)
      if (day === 11) {
        dayExpense += fundTotal
      }

      // Spread shared expenses evenly (daily)
      dayExpense += avgSharedMonthly / 30

      runningBalance += dayIncome - dayExpense

      days.push({ date: dateStr, label, balance: runningBalance, income: dayIncome, expense: dayExpense })
    }

    return days
  }, [allIncome, subs, funds, allShared, splitFrac])

  if (loading || !user) return <TableSkeleton rows={5} />

  const minBalance = forecast.length > 0 ? Math.min(...forecast.map(d => d.balance)) : 0
  const maxBalance = forecast.length > 0 ? Math.max(...forecast.map(d => d.balance)) : 0
  const lowDays = forecast.filter(d => d.balance < 0)
  const criticalDay = lowDays.length > 0 ? lowDays[0] : null

  // Simple bar chart height calculation
  const range = maxBalance - Math.min(0, minBalance)

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <CalendarDays size={18} className="text-[oklch(0.65_0.18_250)]" />
        <h1 className="text-xl font-bold tracking-tight">תחזית תזרים</h1>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">צפי יתרה ל-90 הימים הקרובים</p>

      {/* Alerts */}
      {criticalDay && (
        <div className="bg-[oklch(0.18_0.04_27)] border border-[oklch(0.28_0.08_27)] rounded-xl px-5 py-3.5 mb-5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[oklch(0.62_0.22_27)] shrink-0" />
          <div>
            <div className="font-semibold text-sm text-[oklch(0.62_0.22_27)]">יתרה צפויה נמוכה</div>
            <div className="text-xs text-[oklch(0.65_0.01_250)]">
              ב-{criticalDay.label} צפויה יתרה של {formatCurrency(criticalDay.balance)}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">יתרה נמוכה ביותר</div>
          <div className={`text-2xl font-bold ltr ${minBalance >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>{formatCurrency(minBalance)}</div>
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">יתרה גבוהה ביותר</div>
          <div className="text-2xl font-bold text-[oklch(0.70_0.18_145)] ltr">{formatCurrency(maxBalance)}</div>
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">ימים באדום</div>
          <div className={`text-2xl font-bold ${lowDays.length > 0 ? 'text-[oklch(0.62_0.22_27)]' : 'text-[oklch(0.70_0.18_145)]'}`}>{lowDays.length}</div>
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-[oklch(0.65_0.18_250)]" />
          <span className="font-semibold text-sm">גרף יתרה צפויה</span>
        </div>
        <div className="flex items-end gap-px h-40 overflow-x-auto">
          {forecast.filter((_, i) => i % 3 === 0).map((day, i) => {
            const height = range > 0 ? ((day.balance - Math.min(0, minBalance)) / range) * 100 : 50
            const isNeg = day.balance < 0
            return (
              <div key={i} className="flex flex-col items-center gap-1 min-w-[14px]" title={`${day.label}: ${formatCurrency(day.balance)}`}>
                <div
                  className={`w-2.5 rounded-sm transition-all ${isNeg ? 'bg-[oklch(0.62_0.22_27)]' : 'bg-[oklch(0.50_0.18_250)]'}`}
                  style={{ height: `${Math.max(2, height)}%` }}
                />
                {i % 5 === 0 && <span className="text-[9px] text-[oklch(0.50_0.01_250)] whitespace-nowrap">{day.label}</span>}
              </div>
            )
          })}
        </div>

        {/* Key dates */}
        <div className="mt-4 pt-3 border-t border-[oklch(0.22_0.01_250)]">
          <div className="text-xs text-[oklch(0.65_0.01_250)] font-semibold mb-2">אירועים צפויים</div>
          {forecast.filter(d => d.income > 0 || d.expense > 500).slice(0, 8).map((day, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 text-xs">
              <span className="text-[oklch(0.70_0.01_250)]">{day.label}</span>
              <div className="flex gap-3">
                {day.income > 0 && <span className="text-[oklch(0.70_0.18_145)] ltr">+{formatCurrency(day.income)}</span>}
                {day.expense > 500 && <span className="text-[oklch(0.62_0.22_27)] ltr">-{formatCurrency(day.expense)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
