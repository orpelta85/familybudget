'use client'

import { useUser } from '@/lib/queries/useUser'
import { useAllIncome } from '@/lib/queries/useIncome'
import { useSubscriptions } from '@/lib/queries/useSubscriptions'
import { useSinkingFunds } from '@/lib/queries/useSinking'
import { useAllPersonalExpenses } from '@/lib/queries/useExpenses'
import { useForecastSettings, useUpsertForecastSettings } from '@/lib/queries/useForecast'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useAllSharedExpenses } from '@/lib/queries/useShared'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarDays, AlertTriangle, TrendingUp, Settings, ChevronDown, ChevronUp,
  CreditCard, Wallet, ArrowDownCircle, ArrowUpCircle, Repeat,
} from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/Skeleton'

const ForecastChart = dynamic(() => import('./ForecastChart'), {
  loading: () => <ChartSkeleton height={280} />,
  ssr: false,
})

export interface ForecastDay {
  date: string
  label: string
  balance: number
  events: ForecastEvent[]
}

export interface ForecastEvent {
  type: 'salary' | 'credit_card' | 'subscription' | 'sinking_fund'
  description: string
  amount: number
  icon: 'salary' | 'credit' | 'subscription' | 'sinking'
}

export default function ForecastPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { data: allIncome } = useAllIncome(user?.id)
  const { data: subs } = useSubscriptions(user?.id)
  const { data: funds } = useSinkingFunds(user?.id)
  const { data: allExpenses } = useAllPersonalExpenses(user?.id)
  const { data: allShared } = useAllSharedExpenses(familyId)
  const splitFrac = useSplitFraction(user?.id)
  const { data: settings } = useForecastSettings(user?.id)
  const upsertSettings = useUpsertForecastSettings()

  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    current_balance: '',
    payday: '10',
    credit_card_day: '2',
  })
  const [viewMode, setViewMode] = useState<'personal' | 'family'>('personal')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Sync settings form when data loads
  useEffect(() => {
    if (settings) {
      setSettingsForm({
        current_balance: String(settings.current_balance),
        payday: String(settings.payday),
        credit_card_day: String(settings.credit_card_day),
      })
    }
  }, [settings])

  // Compute average monthly expenses from last 3 months of personal_expenses
  const avgMonthlyExpenses = useMemo(() => {
    if (!allExpenses?.length) return 0
    // Group by period_id and take the last 3
    const byPeriod: Record<number, number> = {}
    for (const e of allExpenses) {
      byPeriod[e.period_id] = (byPeriod[e.period_id] || 0) + e.amount
    }
    const periodTotals = Object.values(byPeriod)
    const last3 = periodTotals.slice(-3)
    return last3.length > 0 ? last3.reduce((s, v) => s + v, 0) / last3.length : 0
  }, [allExpenses])

  // Average monthly shared expenses
  const avgSharedMonthly = useMemo(() => {
    if (!allShared?.length) return 0
    const byPeriod: Record<number, number> = {}
    for (const e of allShared) {
      byPeriod[e.period_id] = (byPeriod[e.period_id] || 0) + e.total_amount
    }
    const periodTotals = Object.values(byPeriod)
    const last3 = periodTotals.slice(-3)
    if (last3.length === 0) return 0
    const avg = last3.reduce((s, v) => s + v, 0) / last3.length
    return avg * splitFrac
  }, [allShared, splitFrac])

  const forecast = useMemo(() => {
    const currentBalance = settings?.current_balance ?? 0
    const payday = settings?.payday ?? 10
    const creditCardDay = settings?.credit_card_day ?? 2

    // Estimate monthly income from latest data
    const latestIncome = allIncome?.length ? allIncome[allIncome.length - 1] : null
    const monthlyIncome = latestIncome ? latestIncome.salary + latestIncome.bonus + latestIncome.other : 0

    // Monthly recurring from subscriptions
    const activeSubs = (subs ?? []).filter(s => s.is_active)

    // Monthly sinking fund allocations
    const fundTotal = (funds ?? []).reduce((s, f) => s + f.monthly_allocation, 0)

    // Non-subscription expenses (charged on credit card day)
    const creditCardCharge = viewMode === 'family'
      ? avgMonthlyExpenses + avgSharedMonthly
      : avgMonthlyExpenses

    // Build 90-day forecast
    const today = new Date()
    const days: ForecastDay[] = []
    let runningBalance = currentBalance

    for (let d = 0; d < 90; d++) {
      const date = new Date(today)
      date.setDate(today.getDate() + d)
      const day = date.getDate()
      const month = date.getMonth()
      const dateStr = date.toISOString().split('T')[0]
      const label = `${day}/${month + 1}`
      const events: ForecastEvent[] = []

      // Income on payday
      if (day === payday) {
        runningBalance += monthlyIncome
        if (monthlyIncome > 0) {
          events.push({ type: 'salary', description: 'משכורת', amount: monthlyIncome, icon: 'salary' })
        }
      }

      // Credit card charge day — sum of average non-recurring expenses
      if (day === creditCardDay) {
        runningBalance -= creditCardCharge
        if (creditCardCharge > 0) {
          events.push({ type: 'credit_card', description: 'חיוב כרטיס אשראי', amount: -creditCardCharge, icon: 'credit' })
        }
      }

      // Subscription charges on their billing days
      for (const sub of activeSubs) {
        if (day === sub.billing_day) {
          runningBalance -= sub.amount
          events.push({ type: 'subscription', description: sub.name, amount: -sub.amount, icon: 'subscription' })
        }
      }

      // Sinking fund allocation on the 1st
      if (day === 1 && fundTotal > 0) {
        runningBalance -= fundTotal
        events.push({ type: 'sinking_fund', description: 'הקצאת קרנות', amount: -fundTotal, icon: 'sinking' })
      }

      days.push({ date: dateStr, label, balance: runningBalance, events })
    }

    return days
  }, [allIncome, subs, funds, avgMonthlyExpenses, avgSharedMonthly, settings, viewMode])

  if (loading || !user) return <TableSkeleton rows={5} />

  const minDay = forecast.length > 0 ? forecast.reduce((min, d) => d.balance < min.balance ? d : min, forecast[0]) : null
  const maxDay = forecast.length > 0 ? forecast.reduce((max, d) => d.balance > max.balance ? d : max, forecast[0]) : null
  const lowDays = forecast.filter(d => d.balance < 0)

  // All events flattened and sorted
  const upcomingEvents = forecast
    .filter(d => d.events.length > 0)
    .flatMap(d => d.events.map(ev => ({ ...ev, date: d.date, label: d.label, balanceAfter: d.balance })))

  async function handleSaveSettings() {
    if (!user) return
    try {
      await upsertSettings.mutateAsync({
        user_id: user.id,
        current_balance: Number(settingsForm.current_balance) || 0,
        payday: Number(settingsForm.payday) || 10,
        credit_card_day: Number(settingsForm.credit_card_day) || 2,
      })
      toast.success('ההגדרות נשמרו')
      setShowSettings(false)
    } catch { toast.error('שגיאה בשמירה') }
  }

  const dayOptions = Array.from({ length: 28 }, (_, i) => i + 1)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-[oklch(0.65_0.18_250)]" />
          <h1 className="text-xl font-bold tracking-tight">תחזית תזרים</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Personal/Family toggle */}
          {familyId && (
            <div className="flex border border-[oklch(0.25_0.01_250)] rounded-lg overflow-hidden">
              {([
                { key: 'personal' as const, label: 'אישי' },
                { key: 'family' as const, label: 'משפחתי' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setViewMode(opt.key)}
                  className={`px-4 py-1.5 text-[13px] font-medium cursor-pointer border-none ${
                    viewMode === opt.key
                      ? 'bg-[oklch(0.22_0.01_250)] text-[oklch(0.92_0.01_250)] shadow-[inset_0_0_0_1px_oklch(0.65_0.18_250)]'
                      : 'bg-transparent text-[oklch(0.65_0.01_250)]'
                  } ${opt.key === 'personal' ? 'border-l border-l-[oklch(0.25_0.01_250)]' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-[oklch(0.65_0.01_250)] text-xs font-medium cursor-pointer"
          >
            <Settings size={13} />
            הגדרות
            {showSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">צפי יתרה ל-90 הימים הקרובים</p>

      {/* Settings section */}
      {showSettings && (
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-5">
          <h2 className="font-semibold text-sm mb-4">הגדרות תחזית</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">יתרת עו&quot;ש נוכחית (₪)</label>
              <input
                type="number"
                value={settingsForm.current_balance}
                onChange={e => setSettingsForm(prev => ({ ...prev, current_balance: e.target.value }))}
                placeholder="0"
                className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm ltr text-left"
              />
            </div>
            <div>
              <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">יום משכורת</label>
              <select
                value={settingsForm.payday}
                onChange={e => setSettingsForm(prev => ({ ...prev, payday: e.target.value }))}
                className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm"
              >
                {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">יום חיוב אשראי</label>
              <select
                value={settingsForm.credit_card_day}
                onChange={e => setSettingsForm(prev => ({ ...prev, credit_card_day: e.target.value }))}
                className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm"
              >
                {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={upsertSettings.isPending}
            className={`bg-[oklch(0.70_0.15_185)] border-none rounded-lg px-6 py-[9px] font-semibold text-sm text-[oklch(0.10_0.01_250)] ${upsertSettings.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            {upsertSettings.isPending ? '...' : 'שמור הגדרות'}
          </button>
        </div>
      )}

      {/* No settings warning */}
      {!settings && (
        <div className="bg-[oklch(0.18_0.04_55)] border border-[oklch(0.28_0.08_55)] rounded-xl px-5 py-3.5 mb-5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[oklch(0.72_0.18_55)] shrink-0" />
          <div>
            <div className="font-semibold text-sm text-[oklch(0.72_0.18_55)]">הגדר יתרה נוכחית</div>
            <div className="text-xs text-[oklch(0.65_0.01_250)]">
              לחץ על &quot;הגדרות&quot; כדי להזין את יתרת העו&quot;ש הנוכחית לתחזית מדויקת יותר
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {lowDays.length > 0 && (
        <div className="bg-[oklch(0.18_0.04_27)] border border-[oklch(0.28_0.08_27)] rounded-xl px-5 py-3.5 mb-5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[oklch(0.62_0.22_27)] shrink-0" />
          <div>
            <div className="font-semibold text-sm text-[oklch(0.62_0.22_27)]">יתרה צפויה שלילית</div>
            <div className="text-xs text-[oklch(0.65_0.01_250)]">
              ב-{lowDays[0].label} צפויה יתרה של {formatCurrency(lowDays[0].balance)}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 tracking-wide">יתרה נמוכה ביותר</div>
          <div className={`text-2xl font-bold ltr ${(minDay?.balance ?? 0) >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>
            {formatCurrency(minDay?.balance ?? 0)}
          </div>
          {minDay && (
            <div className="text-[11px] text-[oklch(0.50_0.01_250)] mt-1">{minDay.label}</div>
          )}
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 tracking-wide">יתרה גבוהה ביותר</div>
          <div className="text-2xl font-bold text-[oklch(0.70_0.18_145)] ltr">{formatCurrency(maxDay?.balance ?? 0)}</div>
          {maxDay && (
            <div className="text-[11px] text-[oklch(0.50_0.01_250)] mt-1">{maxDay.label}</div>
          )}
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 tracking-wide">ימים במינוס</div>
          <div className={`text-2xl font-bold ${lowDays.length > 0 ? 'text-[oklch(0.62_0.22_27)]' : 'text-[oklch(0.70_0.18_145)]'}`}>{lowDays.length}</div>
        </div>
      </div>

      {/* Timeline chart */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-[oklch(0.65_0.18_250)]" />
          <span className="font-semibold text-sm">גרף יתרה צפויה — 90 ימים</span>
        </div>
        <ForecastChart forecast={forecast} payday={settings?.payday ?? 10} creditCardDay={settings?.credit_card_day ?? 2} />
      </div>

      {/* Event list */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
        <h2 className="font-semibold text-sm mb-4">אירועים צפויים</h2>
        {upcomingEvents.length === 0 ? (
          <div className="text-xs text-[oklch(0.65_0.01_250)] text-center py-6">אין אירועים צפויים</div>
        ) : (
          <div className="flex flex-col gap-0">
            {upcomingEvents.slice(0, 20).map((ev, i) => {
              const EventIcon = ev.icon === 'salary' ? ArrowDownCircle
                : ev.icon === 'credit' ? CreditCard
                : ev.icon === 'subscription' ? Repeat
                : Wallet
              const isPositive = ev.amount > 0
              return (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-[oklch(0.20_0.01_250)] last:border-b-0">
                  <div className="flex items-center gap-3">
                    <EventIcon size={14} className={isPositive ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'} />
                    <div>
                      <div className="text-[13px] font-medium">{ev.description}</div>
                      <div className="text-[11px] text-[oklch(0.50_0.01_250)]">{ev.label}</div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`text-[13px] font-semibold ltr ${isPositive ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(ev.amount)}
                    </div>
                    <div className="text-[11px] text-[oklch(0.50_0.01_250)] ltr">
                      יתרה: {formatCurrency(ev.balanceAfter)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
