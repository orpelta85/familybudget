'use client'

import { useUser } from '@/lib/queries/useUser'
import { useAllIncome } from '@/lib/queries/useIncome'
import { useAllPersonalExpenses } from '@/lib/queries/useExpenses'
import {
  useForecastSettings, useUpsertForecastSettings,
  useForecastEvents, useUpsertForecastEvent, useDeleteForecastEvent,
  type ForecastEventRow, type AmountMode,
} from '@/lib/queries/useForecast'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  CalendarDays, AlertTriangle, TrendingUp, Settings, ChevronDown, ChevronUp,
  ArrowDownCircle, ArrowUpCircle, Repeat,
  Plus, Trash2, Pencil, X, Check, Inbox,
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
  type: 'salary' | 'manual'
  description: string
  amount: number
  icon: 'salary' | 'manual'
  source: 'auto' | 'manual'
}

type EventForm = {
  name: string
  amount: string
  day_of_month: string
  type: 'income' | 'expense'
  amount_mode: AmountMode
}

const emptyEventForm: EventForm = { name: '', amount: '', day_of_month: '1', type: 'expense', amount_mode: 'fixed' }

export default function ForecastPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: allIncome } = useAllIncome(user?.id)
  const { data: allExpenses } = useAllPersonalExpenses(user?.id)
  const { data: settings } = useForecastSettings(user?.id)
  const upsertSettings = useUpsertForecastSettings()
  const { data: manualEvents } = useForecastEvents(user?.id)
  const upsertEvent = useUpsertForecastEvent()
  const deleteEvent = useDeleteForecastEvent()
  const confirm = useConfirmDialog()

  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    current_balance: '',
    payday: '10',
  })
  const [eventForm, setEventForm] = useState<EventForm | null>(null)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (settings) {
      setSettingsForm({
        current_balance: String(settings.current_balance),
        payday: String(settings.payday),
      })
    }
  }, [settings])

  // Compute average monthly personal expenses from last 3 months
  const avgMonthlyExpenses = useMemo(() => {
    if (!allExpenses?.length) return 0
    const byPeriod: Record<number, number> = {}
    for (const e of allExpenses) {
      byPeriod[e.period_id] = (byPeriod[e.period_id] || 0) + Number(e.amount)
    }
    const periodTotals = Object.values(byPeriod)
    const last3 = periodTotals.slice(-3)
    return last3.length > 0 ? last3.reduce((s, v) => s + v, 0) / last3.length : 0
  }, [allExpenses])

  // Active manual events
  const activeManualEvents = useMemo(() => {
    return (manualEvents ?? []).filter(e => e.is_active)
  }, [manualEvents])

  const forecast = useMemo(() => {
    const currentBalance = settings?.current_balance ?? 0
    const payday = settings?.payday ?? 10

    // Estimate monthly income from latest data
    const latestIncome = allIncome?.length ? allIncome[allIncome.length - 1] : null
    const monthlyIncome = latestIncome ? latestIncome.salary + latestIncome.bonus + latestIncome.other : 0

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
      if (day === payday && monthlyIncome > 0) {
        runningBalance += monthlyIncome
        events.push({ type: 'salary', description: 'משכורת', amount: monthlyIncome, icon: 'salary', source: 'auto' })
      }

      // Manual recurring events
      for (const me of activeManualEvents) {
        if (day === me.day_of_month) {
          const resolvedAmount = me.amount_mode === 'average' ? avgMonthlyExpenses : Number(me.amount)
          const amt = me.type === 'income' ? resolvedAmount : -resolvedAmount
          runningBalance += amt
          events.push({
            type: 'manual',
            description: me.name,
            amount: amt,
            icon: 'manual',
            source: 'manual',
          })
        }
      }

      days.push({ date: dateStr, label, balance: runningBalance, events })
    }

    return days
  }, [allIncome, avgMonthlyExpenses, settings, activeManualEvents])

  if (loading || !user) return <TableSkeleton rows={5} />

  const minDay = forecast.length > 0 ? forecast.reduce((min, d) => d.balance < min.balance ? d : min, forecast[0]) : null
  const maxDay = forecast.length > 0 ? forecast.reduce((max, d) => d.balance > max.balance ? d : max, forecast[0]) : null
  const lowDays = forecast.filter(d => d.balance < 0)

  // All events flattened and sorted chronologically
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
      })
      toast.success('ההגדרות נשמרו')
      setShowSettings(false)
    } catch { toast.error('שגיאה בשמירה') }
  }

  async function handleSaveEvent() {
    if (!user || !eventForm) return
    const isAverage = eventForm.amount_mode === 'average'
    const amount = isAverage ? avgMonthlyExpenses : Number(eventForm.amount)
    if (!eventForm.name.trim() || (!isAverage && amount <= 0)) {
      toast.error('מלא שם וסכום')
      return
    }
    try {
      await upsertEvent.mutateAsync({
        id: editingEventId ?? undefined,
        user_id: user.id,
        name: eventForm.name.trim(),
        amount: isAverage ? 0 : amount,
        day_of_month: Number(eventForm.day_of_month),
        type: eventForm.type,
        amount_mode: eventForm.amount_mode,
      })
      toast.success(editingEventId ? 'עודכן' : 'נוסף')
      setEventForm(null)
      setEditingEventId(null)
    } catch { toast.error('שגיאה') }
  }

  async function handleDeleteEvent(ev: ForecastEventRow) {
    if (!user) return
    if (!(await confirm({ message: `למחוק את "${ev.name}"?` }))) return
    try {
      await deleteEvent.mutateAsync({ id: ev.id, user_id: user.id })
      toast.success('נמחק')
    } catch { toast.error('שגיאה') }
  }

  function startEditEvent(ev: ForecastEventRow) {
    setEditingEventId(ev.id)
    setEventForm({
      name: ev.name,
      amount: String(ev.amount),
      day_of_month: String(ev.day_of_month),
      type: ev.type as 'income' | 'expense',
      amount_mode: ev.amount_mode ?? 'fixed',
    })
  }

  const dayOptions = Array.from({ length: 28 }, (_, i) => i + 1)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-[oklch(0.65_0.18_250)]" />
          <h1 className="text-xl font-bold tracking-tight">תחזית תזרים</h1>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-[oklch(0.65_0.01_250)] text-xs font-medium cursor-pointer"
        >
          <Settings size={13} />
          הגדרות
          {showSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">צפי יתרה ל-90 הימים הקרובים</p>

      {/* Settings section */}
      {showSettings && (
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-5">
          <h2 className="font-semibold text-sm mb-4">הגדרות תחזית</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

      {/* Manual recurring events section */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Repeat size={14} className="text-[oklch(0.65_0.18_250)]" />
            <h2 className="font-semibold text-sm">אירועים חוזרים</h2>
          </div>
          {!eventForm && (
            <button
              onClick={() => { setEventForm({ ...emptyEventForm }); setEditingEventId(null) }}
              className="flex items-center gap-1.5 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-3 py-1.5 text-[oklch(0.65_0.01_250)] text-xs cursor-pointer"
            >
              <Plus size={12} /> הוסף אירוע
            </button>
          )}
        </div>

        {/* Event list */}
        {(manualEvents ?? []).length === 0 && !eventForm ? (
          <div className="text-xs text-[oklch(0.65_0.01_250)] text-center py-6">
            <Inbox size={24} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />
            <div>אין אירועים חוזרים</div>
            <div className="mt-1 text-[oklch(0.50_0.01_250)]">הוסף אירועים כמו שכירות, ביטוח, חיוב אשראי</div>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {(manualEvents ?? []).map(ev => (
              <div key={ev.id} className="flex items-center justify-between py-2.5 border-b border-[oklch(0.20_0.01_250)] last:border-b-0">
                <div className="flex items-center gap-3">
                  {ev.type === 'income' ? (
                    <ArrowDownCircle size={14} className="text-[oklch(0.70_0.18_145)]" />
                  ) : (
                    <ArrowUpCircle size={14} className="text-[oklch(0.62_0.22_27)]" />
                  )}
                  <div>
                    <div className="text-[13px] font-medium">{ev.name}</div>
                    <div className="text-[11px] text-[oklch(0.50_0.01_250)]">
                      יום {ev.day_of_month} בחודש
                      {ev.amount_mode === 'average' && (
                        <span className="text-[oklch(0.65_0.15_250)] mr-2">ממוצע 3 חודשים</span>
                      )}
                      {!ev.is_active && <span className="text-[oklch(0.55_0.15_55)] mr-2">מושבת</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] font-semibold ltr ${ev.type === 'income' ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>
                    {ev.amount_mode === 'average'
                      ? `~${formatCurrency(avgMonthlyExpenses)}`
                      : `${ev.type === 'income' ? '+' : '-'}${formatCurrency(Number(ev.amount))}`
                    }
                  </span>
                  <button onClick={() => startEditEvent(ev)} aria-label="ערוך" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Pencil size={11} /></button>
                  <button onClick={() => handleDeleteEvent(ev)} aria-label="מחק" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline add/edit form */}
        {eventForm && (
          <div className="mt-4 pt-4 border-t border-[oklch(0.22_0.01_250)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">שם</label>
                <input
                  type="text"
                  value={eventForm.name}
                  onChange={e => setEventForm(prev => prev && { ...prev, name: e.target.value })}
                  placeholder='לדוגמה: "שכירות" / "חיוב אשראי"'
                  autoFocus
                  className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סוג</label>
                <div className="flex border border-[oklch(0.25_0.01_250)] rounded-lg overflow-hidden h-[38px]">
                  {([
                    { key: 'expense' as const, label: 'הוצאה' },
                    { key: 'income' as const, label: 'הכנסה' },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setEventForm(prev => prev && { ...prev, type: opt.key })}
                      className={`flex-1 px-3 text-[13px] font-medium cursor-pointer border-none ${
                        eventForm.type === opt.key
                          ? opt.key === 'income'
                            ? 'bg-[oklch(0.22_0.02_145)] text-[oklch(0.70_0.18_145)]'
                            : 'bg-[oklch(0.22_0.02_27)] text-[oklch(0.62_0.22_27)]'
                          : 'bg-transparent text-[oklch(0.65_0.01_250)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">אופן חישוב</label>
                <div className="flex border border-[oklch(0.25_0.01_250)] rounded-lg overflow-hidden h-[38px]">
                  {([
                    { key: 'fixed' as const, label: 'סכום קבוע' },
                    { key: 'average' as const, label: 'ממוצע 3 חודשים' },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setEventForm(prev => prev && { ...prev, amount_mode: opt.key })}
                      className={`flex-1 px-3 text-[13px] font-medium cursor-pointer border-none ${
                        eventForm.amount_mode === opt.key
                          ? 'bg-[oklch(0.22_0.02_250)] text-[oklch(0.70_0.18_250)]'
                          : 'bg-transparent text-[oklch(0.65_0.01_250)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {eventForm.amount_mode === 'fixed' ? (
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סכום (₪)</label>
                  <input
                    type="number"
                    value={eventForm.amount}
                    onChange={e => setEventForm(prev => prev && { ...prev, amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm ltr text-left"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סכום (חישוב אוטומטי)</label>
                  <div className="w-full bg-[oklch(0.19_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-lg px-3 py-[9px] text-[oklch(0.55_0.01_250)] text-sm ltr text-left">
                    ~{formatCurrency(avgMonthlyExpenses)}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">יום בחודש</label>
                <select
                  value={eventForm.day_of_month}
                  onChange={e => setEventForm(prev => prev && { ...prev, day_of_month: e.target.value })}
                  className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm"
                >
                  {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveEvent}
                disabled={upsertEvent.isPending}
                className={`flex items-center gap-1.5 bg-[oklch(0.70_0.15_185)] border-none rounded-lg px-4 py-2 font-semibold text-sm text-[oklch(0.10_0.01_250)] ${upsertEvent.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <Check size={13} />
                {editingEventId ? 'עדכן' : 'הוסף'}
              </button>
              <button
                onClick={() => { setEventForm(null); setEditingEventId(null) }}
                className="flex items-center gap-1.5 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-4 py-2 text-[oklch(0.65_0.01_250)] text-sm cursor-pointer"
              >
                <X size={13} /> ביטול
              </button>
            </div>
          </div>
        )}
      </div>

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
        <ForecastChart forecast={forecast} payday={settings?.payday ?? 10} />
      </div>

      {/* Event list — all events chronological */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
        <h2 className="font-semibold text-sm mb-4">אירועים צפויים</h2>
        {upcomingEvents.length === 0 ? (
          <div className="text-xs text-[oklch(0.65_0.01_250)] text-center py-6">
            <Inbox size={24} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />
            אין אירועים צפויים — הוסף נתוני הכנסה או אירועים חוזרים
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {upcomingEvents.slice(0, 30).map((ev, i) => {
              const EventIcon = ev.icon === 'salary' ? ArrowDownCircle
                : ev.amount > 0 ? ArrowDownCircle : ArrowUpCircle
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
