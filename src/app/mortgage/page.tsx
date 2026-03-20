'use client'

import { useUser } from '@/lib/queries/useUser'
import { useMortgages, useAddMortgage, useAddMortgageTrack, useDeleteMortgage, useDeleteMortgageTrack, TRACK_TYPE_LABELS } from '@/lib/queries/useMortgage'
import type { MortgageTrack } from '@/lib/queries/useMortgage'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Home, Plus, X, Trash2, Inbox, TrendingDown, Calculator } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'

interface MortgageForm {
  name: string
  totalAmount: string
  remainingBalance: string
  startDate: string
  endDate: string
  isShared: boolean
}

interface TrackForm {
  trackName: string
  trackType: 'prime' | 'fixed' | 'cpi_linked' | 'variable'
  originalAmount: string
  remainingAmount: string
  interestRate: string
  monthlyPayment: string
  cpiLinked: boolean
  startDate: string
  endDate: string
}

const emptyTrackForm: TrackForm = {
  trackName: '', trackType: 'fixed', originalAmount: '', remainingAmount: '',
  interestRate: '', monthlyPayment: '', cpiLinked: false, startDate: '', endDate: '',
}

function monthsRemaining(end: string | null): number {
  if (!end) return 0
  const now = new Date()
  const e = new Date(end)
  return Math.max(0, (e.getFullYear() - now.getFullYear()) * 12 + (e.getMonth() - now.getMonth()))
}

// Simple amortization calculation for "what if" extra payment
function computePayoff(balance: number, monthlyRate: number, payment: number): { months: number; totalInterest: number } {
  if (balance <= 0 || payment <= 0 || monthlyRate < 0) return { months: 0, totalInterest: 0 }
  let remaining = balance
  let totalInterest = 0
  let months = 0
  const maxMonths = 600
  while (remaining > 0.01 && months < maxMonths) {
    const interest = remaining * monthlyRate
    totalInterest += interest
    remaining = remaining + interest - payment
    months++
  }
  return { months, totalInterest: Math.round(totalInterest) }
}

export default function MortgagePage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { viewMode } = useFamilyView()
  const { data: mortgages, isLoading } = useMortgages(user?.id, familyId)
  const addMortgage = useAddMortgage()
  const addTrack = useAddMortgageTrack()
  const deleteMortgage = useDeleteMortgage()
  const deleteTrack = useDeleteMortgageTrack()
  const confirm = useConfirmDialog()

  const [showAddMortgage, setShowAddMortgage] = useState(false)
  const [mortgageForm, setMortgageForm] = useState<MortgageForm>({
    name: 'משכנתא', totalAmount: '', remainingBalance: '', startDate: '', endDate: '', isShared: true,
  })
  const [showAddTrack, setShowAddTrack] = useState<number | null>(null)
  const [trackForm, setTrackForm] = useState<TrackForm>(emptyTrackForm)

  // What-if calculator
  const [extraPayment, setExtraPayment] = useState('500')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Filter by view mode
  const filtered = useMemo(() => {
    if (!mortgages) return []
    if (viewMode === 'personal') return mortgages.filter(m => m.user_id === user?.id && !m.is_shared)
    return mortgages
  }, [mortgages, viewMode, user?.id])

  if (loading || !user) return <TableSkeleton rows={5} />

  // Aggregate KPIs
  const totalOriginal = filtered.reduce((s, m) => s + m.total_amount, 0)
  const totalRemaining = filtered.reduce((s, m) => s + m.remaining_balance, 0)
  const totalPaid = totalOriginal - totalRemaining
  const totalMonthlyPayment = filtered.reduce((s, m) =>
    s + (m.mortgage_tracks ?? []).reduce((ts, t) => ts + t.monthly_payment, 0), 0)
  const maxMonthsLeft = filtered.reduce((max, m) => Math.max(max, monthsRemaining(m.end_date)), 0)
  const paidPct = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0

  async function handleAddMortgage() {
    if (!user) return
    const total = Number(mortgageForm.totalAmount)
    const remaining = Number(mortgageForm.remainingBalance)
    if (!mortgageForm.name.trim() || total <= 0 || remaining <= 0) {
      toast.error('מלא שם, סכום כולל ויתרה')
      return
    }
    try {
      await addMortgage.mutateAsync({
        user_id: user.id,
        family_id: mortgageForm.isShared ? familyId ?? null : null,
        name: mortgageForm.name.trim(),
        total_amount: total,
        remaining_balance: remaining,
        start_date: mortgageForm.startDate || undefined,
        end_date: mortgageForm.endDate || undefined,
        is_shared: mortgageForm.isShared,
      })
      toast.success('משכנתא נוספה')
      setShowAddMortgage(false)
    } catch { toast.error('שגיאה בהוספה') }
  }

  async function handleAddTrack() {
    if (!showAddTrack) return
    const orig = Number(trackForm.originalAmount)
    const remaining = Number(trackForm.remainingAmount)
    const rate = Number(trackForm.interestRate)
    const payment = Number(trackForm.monthlyPayment)
    if (!trackForm.trackName.trim() || orig <= 0 || payment <= 0) {
      toast.error('מלא את כל השדות')
      return
    }
    try {
      await addTrack.mutateAsync({
        mortgage_id: showAddTrack,
        track_name: trackForm.trackName.trim(),
        track_type: trackForm.trackType,
        original_amount: orig,
        remaining_amount: remaining || orig,
        interest_rate: rate,
        monthly_payment: payment,
        cpi_linked: trackForm.cpiLinked,
        start_date: trackForm.startDate || null,
        end_date: trackForm.endDate || null,
      })
      toast.success('מסלול נוסף')
      setShowAddTrack(null)
      setTrackForm(emptyTrackForm)
    } catch { toast.error('שגיאה') }
  }

  async function handleDeleteMortgage(id: number) {
    if (!(await confirm({ message: 'למחוק את המשכנתא? כל המסלולות יימחקו.' }))) return
    await deleteMortgage.mutateAsync(id)
    toast.success('נמחק')
  }

  async function handleDeleteTrack(id: number) {
    if (!(await confirm({ message: 'למחוק את המסלול?' }))) return
    await deleteTrack.mutateAsync(id)
    toast.success('מסלול נמחק')
  }

  // What-if calculation
  const extra = Number(extraPayment) || 0
  const whatIfResults = useMemo(() => {
    if (!filtered.length) return null
    let totalRemainingBal = 0
    let totalCurrentPayment = 0
    let totalCurrentInterest = 0
    let totalExtraInterest = 0
    let maxCurrentMonths = 0
    let maxExtraMonths = 0

    for (const m of filtered) {
      for (const t of (m.mortgage_tracks ?? [])) {
        const monthlyRate = t.interest_rate / 100 / 12
        const currentResult = computePayoff(t.remaining_amount, monthlyRate, t.monthly_payment)
        const extraPerTrack = extra * (t.remaining_amount / totalRemaining)
        const extraResult = computePayoff(t.remaining_amount, monthlyRate, t.monthly_payment + extraPerTrack)

        totalRemainingBal += t.remaining_amount
        totalCurrentPayment += t.monthly_payment
        totalCurrentInterest += currentResult.totalInterest
        totalExtraInterest += extraResult.totalInterest
        maxCurrentMonths = Math.max(maxCurrentMonths, currentResult.months)
        maxExtraMonths = Math.max(maxExtraMonths, extraResult.months)
      }
    }

    return {
      currentMonths: maxCurrentMonths,
      extraMonths: maxExtraMonths,
      savedMonths: maxCurrentMonths - maxExtraMonths,
      currentInterest: totalCurrentInterest,
      extraInterest: totalExtraInterest,
      savedInterest: totalCurrentInterest - totalExtraInterest,
    }
  }, [filtered, extra, totalRemaining])

  // Amortization chart data (simplified: show remaining balance over time)
  const amortizationData = useMemo(() => {
    if (!filtered.length) return []
    const allTracks = filtered.flatMap(m => m.mortgage_tracks ?? [])
    if (!allTracks.length) return []

    const maxMonths = Math.max(...allTracks.map(t => {
      const monthlyRate = t.interest_rate / 100 / 12
      return computePayoff(t.remaining_amount, monthlyRate, t.monthly_payment).months
    }))

    const points: { month: number; principal: number; interest: number; balance: number }[] = []
    const step = Math.max(1, Math.floor(maxMonths / 30))

    // Simulate month by month
    const balances = allTracks.map(t => t.remaining_amount)
    const rates = allTracks.map(t => t.interest_rate / 100 / 12)
    const payments = allTracks.map(t => t.monthly_payment)

    for (let month = 0; month <= maxMonths; month += step) {
      // Reset to initial and simulate to this month
      const bals = allTracks.map(t => t.remaining_amount)
      let totalInterestPaid = 0
      let totalPrincipalPaid = 0

      for (let m = 0; m < month; m++) {
        for (let i = 0; i < bals.length; i++) {
          if (bals[i] <= 0) continue
          const interest = bals[i] * rates[i]
          totalInterestPaid += interest
          const principalPart = Math.min(payments[i] - interest, bals[i])
          totalPrincipalPaid += principalPart
          bals[i] = Math.max(0, bals[i] + interest - payments[i])
        }
      }

      const totalBalance = bals.reduce((s, b) => s + b, 0)
      points.push({
        month,
        principal: Math.round(totalPrincipalPaid),
        interest: Math.round(totalInterestPaid),
        balance: Math.round(totalBalance),
      })

      if (totalBalance <= 0) break
    }

    return points
  }, [filtered])

  const chartMax = amortizationData.length > 0 ? Math.max(...amortizationData.map(d => d.principal + d.interest)) : 1

  function formatMonths(m: number): string {
    const years = Math.floor(m / 12)
    const months = m % 12
    if (years === 0) return `${months} חודשים`
    if (months === 0) return `${years} שנים`
    return `${years} שנים ו-${months} חודשים`
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <Home size={18} className="text-[oklch(0.70_0.15_185)]" />
          <h1 className="text-xl font-bold tracking-tight">משכנתא</h1>
        </div>
        <button
          onClick={() => setShowAddMortgage(true)}
          className="btn-hover flex items-center gap-1.5 bg-[oklch(0.20_0.04_185)] border border-[oklch(0.32_0.08_185)] rounded-lg px-3.5 py-[7px] text-[oklch(0.70_0.15_185)] text-[13px] font-medium cursor-pointer"
        >
          <Plus size={13} /> הוסף משכנתא
        </button>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">
        מעקב מסלולים, תשלומים וסימולציות פירעון מוקדם
      </p>

      {isLoading ? <TableSkeleton rows={4} /> : !filtered.length ? (
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-10 text-center">
          <Inbox size={36} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2.5" />
          <div className="text-[oklch(0.65_0.01_250)] text-sm">אין משכנתאות — לחץ &quot;הוסף משכנתא&quot;</div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid-kpi mb-5">
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-4">
              <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">סכום מקורי</div>
              <div className="text-xl font-bold tracking-tight text-[oklch(0.65_0.18_250)]">{formatCurrency(totalOriginal)}</div>
            </div>
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-4">
              <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">יתרה נוכחית</div>
              <div className="text-xl font-bold tracking-tight text-[oklch(0.72_0.18_55)]">{formatCurrency(totalRemaining)}</div>
            </div>
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-4">
              <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">שולם</div>
              <div className="text-xl font-bold tracking-tight text-[oklch(0.70_0.18_145)]">{formatCurrency(totalPaid)}</div>
            </div>
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-4">
              <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">תשלום חודשי</div>
              <div className="text-xl font-bold tracking-tight text-[oklch(0.72_0.18_55)]">{formatCurrency(totalMonthlyPayment)}</div>
            </div>
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-4">
              <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">חודשים שנותרו</div>
              <div className="text-xl font-bold tracking-tight text-[oklch(0.65_0.18_250)]">{formatMonths(maxMonthsLeft)}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
            <div className="flex justify-between text-[13px] mb-2">
              <span className="text-[oklch(0.70_0.18_145)] font-semibold">שולם {paidPct.toFixed(1)}%</span>
              <span className="text-[oklch(0.65_0.01_250)]">{formatCurrency(totalPaid)} מתוך {formatCurrency(totalOriginal)}</span>
            </div>
            <div className="h-3 rounded-full bg-[oklch(0.22_0.01_250)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[oklch(0.70_0.18_145)] transition-[width] duration-500"
                style={{ width: `${Math.min(paidPct, 100)}%` }}
              />
            </div>
          </div>

          {/* Tracks breakdown per mortgage */}
          {filtered.map(mortgage => (
            <div key={mortgage.id} className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Home size={14} className="text-[oklch(0.70_0.15_185)]" />
                  <span className="font-semibold text-sm">{mortgage.name}</span>
                  {mortgage.is_shared && (
                    <span className="text-[10px] bg-[oklch(0.22_0.05_295)] text-[oklch(0.75_0.15_295)] px-1.5 py-0.5 rounded font-medium">משותף</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { setShowAddTrack(mortgage.id); setTrackForm(emptyTrackForm) }}
                    className="flex items-center gap-1 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-2.5 py-1.5 text-[oklch(0.65_0.01_250)] text-xs cursor-pointer"
                  >
                    <Plus size={11} /> מסלול
                  </button>
                  <button
                    onClick={() => handleDeleteMortgage(mortgage.id)}
                    aria-label="מחק"
                    className="flex items-center justify-center bg-[oklch(0.18_0.03_15)] border border-[oklch(0.28_0.06_15)] rounded-lg p-1.5 text-[oklch(0.60_0.18_15)] cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Track cards */}
              {!(mortgage.mortgage_tracks?.length) ? (
                <div className="text-xs text-[oklch(0.65_0.01_250)] text-center py-4">אין מסלולים — הוסף מסלול</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {mortgage.mortgage_tracks.map(track => {
                    const trackPaidPct = track.original_amount > 0
                      ? ((track.original_amount - track.remaining_amount) / track.original_amount) * 100
                      : 0
                    return (
                      <div key={track.id} className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-[13px]">{track.track_name}</span>
                              <span className="text-[10px] bg-[oklch(0.20_0.04_250)] border border-[oklch(0.30_0.06_250)] px-1.5 py-0.5 rounded text-[oklch(0.65_0.15_250)]">
                                {TRACK_TYPE_LABELS[track.track_type] ?? track.track_type}
                              </span>
                              {track.cpi_linked && (
                                <span className="text-[10px] bg-[oklch(0.20_0.04_55)] border border-[oklch(0.30_0.06_55)] px-1.5 py-0.5 rounded text-[oklch(0.72_0.18_55)]">צמוד</span>
                              )}
                            </div>
                            <div className="text-[11px] text-[oklch(0.55_0.01_250)] flex gap-3">
                              <span>ריבית: {track.interest_rate}%</span>
                              <span>תשלום: {formatCurrency(track.monthly_payment)}/חודש</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-[13px] font-bold text-[oklch(0.80_0.01_250)]">{formatCurrency(track.remaining_amount)}</div>
                              <div className="text-[10px] text-[oklch(0.55_0.01_250)]">מתוך {formatCurrency(track.original_amount)}</div>
                            </div>
                            <button
                              onClick={() => handleDeleteTrack(track.id)}
                              aria-label="מחק מסלול"
                              className="bg-transparent border-none cursor-pointer p-1 text-[oklch(0.45_0.01_250)]"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        {/* Track progress */}
                        <div className="h-1.5 rounded-full bg-[oklch(0.20_0.01_250)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[oklch(0.65_0.18_250)] transition-[width] duration-500"
                            style={{ width: `${Math.min(trackPaidPct, 100)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-[oklch(0.55_0.01_250)] mt-1 text-left">{trackPaidPct.toFixed(1)}% שולם</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Amortization Chart */}
          {amortizationData.length > 1 && (
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
              <div className="font-semibold text-sm mb-4 flex items-center gap-2">
                <TrendingDown size={14} className="text-[oklch(0.70_0.18_145)]" />
                לוח סילוקין — קרן מול ריבית
              </div>
              <div className="relative h-48 flex items-end gap-px">
                {amortizationData.map((d, i) => {
                  const principalH = chartMax > 0 ? (d.principal / chartMax) * 100 : 0
                  const interestH = chartMax > 0 ? (d.interest / chartMax) * 100 : 0
                  return (
                    <div key={i} className="flex-1 flex flex-col-reverse" style={{ height: '100%' }}>
                      <div style={{ height: `${principalH}%`, background: 'oklch(0.65 0.18 250)', opacity: 0.8 }} />
                      <div style={{ height: `${interestH}%`, background: 'oklch(0.62 0.22 27)', opacity: 0.7 }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 justify-center mt-3">
                <span className="text-xs text-[oklch(0.65_0.01_250)] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[oklch(0.65_0.18_250)] inline-block" /> קרן
                </span>
                <span className="text-xs text-[oklch(0.65_0.01_250)] flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[oklch(0.62_0.22_27)] inline-block" /> ריבית
                </span>
              </div>
            </div>
          )}

          {/* What-if Calculator */}
          <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
            <div className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Calculator size={14} className="text-[oklch(0.72_0.18_55)]" />
              מה קורה אם מוסיפים תשלום חודשי?
            </div>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                inputMode="numeric"
                value={extraPayment}
                onChange={e => setExtraPayment(e.target.value.replace(/[^\d]/g, ''))}
                className="w-32 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left"
              />
              <span className="text-[oklch(0.65_0.01_250)] text-sm">₪ נוספים לחודש</span>
            </div>
            {whatIfResults && extra > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-lg p-3">
                  <div className="text-[10px] text-[oklch(0.65_0.01_250)] mb-1">חיסכון בזמן</div>
                  <div className="text-base font-bold text-[oklch(0.70_0.18_145)]">{formatMonths(whatIfResults.savedMonths)}</div>
                  <div className="text-[10px] text-[oklch(0.55_0.01_250)]">
                    {formatMonths(whatIfResults.currentMonths)} → {formatMonths(whatIfResults.extraMonths)}
                  </div>
                </div>
                <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-lg p-3">
                  <div className="text-[10px] text-[oklch(0.65_0.01_250)] mb-1">חיסכון בריבית</div>
                  <div className="text-base font-bold text-[oklch(0.70_0.18_145)]">{formatCurrency(whatIfResults.savedInterest)}</div>
                </div>
                <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-lg p-3">
                  <div className="text-[10px] text-[oklch(0.65_0.01_250)] mb-1">סה&quot;כ ריבית חדש</div>
                  <div className="text-base font-bold text-[oklch(0.72_0.18_55)]">{formatCurrency(whatIfResults.extraInterest)}</div>
                  <div className="text-[10px] text-[oklch(0.55_0.01_250)]">
                    במקום {formatCurrency(whatIfResults.currentInterest)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Mortgage Modal */}
      {showAddMortgage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-[14px] p-7 w-[400px]">
            <div className="flex justify-between items-center mb-5">
              <span className="font-semibold text-[15px]">הוסף משכנתא</span>
              <button onClick={() => setShowAddMortgage(false)} aria-label="סגור" className="bg-transparent border-none text-[oklch(0.65_0.01_250)] cursor-pointer p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">שם</label>
                <input type="text" value={mortgageForm.name} onChange={e => setMortgageForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סכום מקורי (₪)</label>
                  <input type="text" inputMode="numeric" value={mortgageForm.totalAmount} onChange={e => setMortgageForm(f => ({ ...f, totalAmount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
                </div>
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">יתרה נוכחית (₪)</label>
                  <input type="text" inputMode="numeric" value={mortgageForm.remainingBalance} onChange={e => setMortgageForm(f => ({ ...f, remainingBalance: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">תאריך התחלה</label>
                  <input type="date" value={mortgageForm.startDate} onChange={e => setMortgageForm(f => ({ ...f, startDate: e.target.value }))} className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm" dir="ltr" />
                </div>
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">תאריך סיום</label>
                  <input type="date" value={mortgageForm.endDate} onChange={e => setMortgageForm(f => ({ ...f, endDate: e.target.value }))} className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm" dir="ltr" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={mortgageForm.isShared} onChange={e => setMortgageForm(f => ({ ...f, isShared: e.target.checked }))} className="w-4 h-4 rounded accent-[oklch(0.70_0.15_185)]" />
                <span className="text-[13px] text-[oklch(0.70_0.01_250)]">משכנתא משותפת (משפחתית)</span>
              </label>
            </div>
            <button
              onClick={handleAddMortgage}
              disabled={addMortgage.isPending}
              className={`w-full bg-[oklch(0.70_0.15_185)] border-none rounded-lg py-[11px] font-semibold text-sm text-[oklch(0.10_0.01_250)] ${addMortgage.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            >
              {addMortgage.isPending ? '...' : 'הוסף'}
            </button>
          </div>
        </div>
      )}

      {/* Add Track Modal */}
      {showAddTrack && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-[14px] p-7 w-[420px]">
            <div className="flex justify-between items-center mb-5">
              <span className="font-semibold text-[15px]">הוסף מסלול</span>
              <button onClick={() => setShowAddTrack(null)} aria-label="סגור" className="bg-transparent border-none text-[oklch(0.65_0.01_250)] cursor-pointer p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">שם מסלול</label>
                <input type="text" value={trackForm.trackName} onChange={e => setTrackForm(f => ({ ...f, trackName: e.target.value }))} placeholder="פריים, קבועה..." className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm" />
              </div>
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סוג</label>
                <div className="flex gap-2">
                  {(['prime', 'fixed', 'cpi_linked', 'variable'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTrackForm(f => ({ ...f, trackType: t, cpiLinked: t === 'cpi_linked' }))}
                      className={`flex-1 rounded-lg py-[8px] text-[11px] cursor-pointer ${trackForm.trackType === t ? 'bg-[oklch(0.24_0.06_250)] border border-[oklch(0.40_0.10_250)] text-[oklch(0.75_0.15_250)] font-semibold' : 'bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] text-[oklch(0.65_0.01_250)] font-normal'}`}>
                      {TRACK_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סכום מקורי (₪)</label>
                  <input type="text" inputMode="numeric" value={trackForm.originalAmount} onChange={e => setTrackForm(f => ({ ...f, originalAmount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
                </div>
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">יתרה נוכחית (₪)</label>
                  <input type="text" inputMode="numeric" value={trackForm.remainingAmount} onChange={e => setTrackForm(f => ({ ...f, remainingAmount: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">ריבית שנתית (%)</label>
                  <input type="text" inputMode="decimal" value={trackForm.interestRate} onChange={e => setTrackForm(f => ({ ...f, interestRate: e.target.value.replace(/[^\d.]/g, '') }))} placeholder="0" className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
                </div>
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">תשלום חודשי (₪)</label>
                  <input type="text" inputMode="numeric" value={trackForm.monthlyPayment} onChange={e => setTrackForm(f => ({ ...f, monthlyPayment: e.target.value.replace(/[^\d]/g, '') }))} placeholder="0" className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">תאריך התחלה</label>
                  <input type="date" value={trackForm.startDate} onChange={e => setTrackForm(f => ({ ...f, startDate: e.target.value }))} className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm" dir="ltr" />
                </div>
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">תאריך סיום</label>
                  <input type="date" value={trackForm.endDate} onChange={e => setTrackForm(f => ({ ...f, endDate: e.target.value }))} className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm" dir="ltr" />
                </div>
              </div>
            </div>
            <button
              onClick={handleAddTrack}
              disabled={addTrack.isPending}
              className={`w-full bg-[oklch(0.70_0.15_185)] border-none rounded-lg py-[11px] font-semibold text-sm text-[oklch(0.10_0.01_250)] ${addTrack.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            >
              {addTrack.isPending ? '...' : 'הוסף מסלול'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
