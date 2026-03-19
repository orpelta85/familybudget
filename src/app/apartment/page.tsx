'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useApartmentDeposits, useUpsertApartmentDeposit } from '@/lib/queries/useApartment'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Home, CheckCircle, Circle, Trash2 } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'

const MONTHLY_TARGET = 3500
const TOTAL_PERIODS = 36
const TOTAL_GOAL = MONTHLY_TARGET * TOTAL_PERIODS

export default function ApartmentPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { familyId } = useFamilyContext()
  const { data: deposits } = useApartmentDeposits(familyId)
  const upsert = useUpsertApartmentDeposit()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState(MONTHLY_TARGET.toString())
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const confirm = useConfirmDialog()

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return <TableSkeleton rows={5} />

  const totalSaved = deposits?.reduce((s, d) => s + d.amount_deposited, 0) ?? 0
  const pct = Math.min((totalSaved / TOTAL_GOAL) * 100, 100)
  const remaining = TOTAL_GOAL - totalSaved
  const periodsLeft = TOTAL_PERIODS - (deposits?.length ?? 0)
  const depositMap = new Map(deposits?.map(d => [d.period_id, d.amount_deposited]))

  const milestones = [25, 50, 75, 100]

  async function handleResetDeposits() {
    if (!familyId) return
    if (!(await confirm({ message: 'למחוק את כל ההפקדות לדירה?' }))) return
    try {
      const sb = createClient()
      await sb.from('apartment_deposits').delete().eq('family_id', familyId)
      queryClient.invalidateQueries({ queryKey: ['apartment_deposits'] })
      toast.success('כל ההפקדות אופסו')
    } catch { toast.error('שגיאה באיפוס') }
  }

  async function handleDeposit() {
    if (!selectedPeriodId || !amount) return
    if (!familyId) { toast.error('לא משויך למשפחה'); return }
    try {
      await upsert.mutateAsync({ period_id: selectedPeriodId, amount_deposited: Number(amount), notes: '', family_id: familyId })
      toast.success('הפקדה נשמרה!')
    } catch { toast.error('שגיאה בשמירה') }
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <Home size={18} className="text-[oklch(0.70_0.18_145)]" />
          <h1 className="text-xl font-bold tracking-tight">יעד הדירה</h1>
        </div>
        <button onClick={handleResetDeposits} className="flex items-center gap-1.5 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-3.5 py-[7px] text-[oklch(0.65_0.01_250)] text-xs font-medium cursor-pointer">
          <Trash2 size={13} /> אפס הפקדות
        </button>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">
        חיסכון של 3,500 ₪ לחודש × 36 מחזורים
      </p>

      {/* Hero card */}
      <div className="bg-[oklch(0.15_0.02_145)] border border-[oklch(0.25_0.05_145)] rounded-xl p-5 mb-5">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[13px] text-[oklch(0.65_0.10_145)] mb-1.5 uppercase tracking-[0.04em]">נחסך עד כה</div>
            <div className="text-[40px] font-extrabold ltr text-[oklch(0.88_0.08_145)] tracking-[-0.04em]">
              {formatCurrency(totalSaved)}
            </div>
          </div>
          <div className="text-left">
            <div className="text-[13px] text-[oklch(0.65_0.10_145)] mb-1.5">יעד סופי</div>
            <div className="text-[22px] font-bold ltr text-[oklch(0.75_0.08_145)]">{formatCurrency(TOTAL_GOAL)}</div>
          </div>
        </div>

        {/* Progress */}
        <div className="h-3 rounded-md bg-[oklch(0.20_0.03_145)] overflow-hidden relative">
          <div className="h-full rounded-md bg-[oklch(0.70_0.18_145)] transition-[width] duration-[800ms] ease-out relative" style={{ width: `${pct}%` }} />
          {/* Milestone markers */}
          {milestones.map(m => (
            <div key={m} className="absolute top-0 bottom-0 w-px bg-[oklch(0.30_0.05_145)] -translate-x-1/2" style={{ left: `${m}%` }} />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-[oklch(0.70_0.15_145)] font-semibold">{pct.toFixed(1)}% מהיעד</span>
          <span className="text-[oklch(0.60_0.08_145)] ltr">נותר: {formatCurrency(remaining)}</span>
        </div>

        {/* Stats */}
        <div className="grid-3 mt-5 mb-0">
          {[
            { label: 'הפקדות', value: deposits?.length ?? 0 },
            { label: 'מחזורים נותרים', value: periodsLeft },
            { label: 'ממוצע חודשי', value: deposits?.length ? formatCurrency(totalSaved / (deposits?.length ?? 1)) : '—' },
          ].map(s => (
            <div key={s.label} className="bg-[oklch(0.12_0.02_145)] rounded-lg px-3 py-2.5 text-center">
              <div className="text-lg font-bold text-[oklch(0.88_0.08_145)] ltr">{s.value}</div>
              <div className="text-[11px] text-[oklch(0.60_0.08_145)] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-sidebar">
        {/* Deposit form */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="font-semibold mb-3.5 text-sm">הפקדה חדשה</div>
          <div className="mb-3">
            <label className="text-xs block mb-[5px] text-[oklch(0.60_0.01_250)]">מחזור</label>
            <select value={selectedPeriodId ?? ''} onChange={e => setSelectedPeriodId(Number(e.target.value))}
              aria-label="מחזור"
              className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-[13px]">
              {periods?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className="text-xs block mb-[5px] text-[oklch(0.60_0.01_250)]">סכום (₪)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-[15px] ltr text-right" />
          </div>
          <button onClick={handleDeposit} disabled={upsert.isPending}
            className="w-full bg-[oklch(0.70_0.18_145)] border-none rounded-lg py-[11px] font-semibold text-sm text-[oklch(0.10_0.02_145)] cursor-pointer">
            {upsert.isPending ? '...' : 'שמור הפקדה'}
          </button>
        </div>

        {/* Period table */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="font-semibold mb-3.5 text-sm">36 מחזורים</div>
          <div className="grid-6">
            {Array.from({ length: TOTAL_PERIODS }, (_, i) => {
              const period = periods?.[i]
              const deposited = period ? depositMap.get(period.id) : undefined
              return (
                <div key={i} title={period?.label ?? `מחזור ${i + 1}`}
                  className={`rounded-md px-1 py-1.5 text-center text-[11px] border ${
                    deposited
                      ? 'bg-[oklch(0.20_0.05_145)] border-[oklch(0.35_0.08_145)] text-[oklch(0.75_0.12_145)]'
                      : 'bg-[oklch(0.20_0.01_250)] border-[oklch(0.25_0.01_250)] text-[oklch(0.65_0.01_250)]'
                  }`}>
                  {deposited ? <CheckCircle size={12} className="mx-auto" /> : <Circle size={12} className="mx-auto opacity-30" />}
                  <div className="mt-[3px]">{i + 1}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
