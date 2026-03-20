'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome, useUpsertIncome, useAllIncome, useFamilyIncome } from '@/lib/queries/useIncome'
import { formatCurrency, periodLabel } from '@/lib/utils'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { Wallet, TrendingUp, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { TableSkeleton, ChartSkeleton } from '@/components/ui/Skeleton'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'

const IncomeTrendChart = dynamic(() => import('@/components/dashboard/IncomeTrendChart').then(m => ({ default: m.IncomeTrendChart })), {
  loading: () => <ChartSkeleton height={200} />,
  ssr: false,
})

export default function IncomePage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { selectedPeriodId, setSelectedPeriodId } = useSharedPeriod()
  const { familyId, members } = useFamilyContext()
  const [viewMode, setViewMode] = useState<'personal' | 'family'>('personal')

  const familyMemberIds = useMemo(() => members.map(m => m.user_id), [members])
  const { data: familyIncome } = useFamilyIncome(selectedPeriodId, familyMemberIds, viewMode === 'family')

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId, setSelectedPeriodId])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const { data: income } = useIncome(selectedPeriodId, user?.id)
  const { data: allIncome } = useAllIncome(user?.id)
  const upsert = useUpsertIncome()
  const confirm = useConfirmDialog()

  const [salary, setSalary] = useState('')
  const [bonus, setBonus] = useState('')
  const [other, setOther] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (income) {
      setSalary(income.salary?.toString() ?? '')
      setBonus(income.bonus?.toString() ?? '')
      setOther(income.other?.toString() ?? '')
      setNotes(income.notes ?? '')
    } else {
      setSalary('')
      setBonus('')
      setOther('')
      setNotes('')
    }
  }, [income, selectedPeriodId])

  if (loading || !user) return <TableSkeleton rows={4} />

  const total = (Number(salary) || 0) + (Number(bonus) || 0) + (Number(other) || 0)

  async function handleSave() {
    if (!user || !selectedPeriodId) return
    try {
      await upsert.mutateAsync({
        period_id: selectedPeriodId,
        user_id: user.id,
        salary: Number(salary) || 0,
        bonus: Number(bonus) || 0,
        other: Number(other) || 0,
        notes,
      })
      toast.success('הכנסה נשמרה')
    } catch {
      toast.error('שגיאה בשמירה')
    }
  }

  async function handleResetIncome() {
    if (!user || !selectedPeriodId) return
    if (!(await confirm({ message: 'לאפס את ההכנסה של המחזור הנוכחי?' }))) return
    try {
      await upsert.mutateAsync({
        period_id: selectedPeriodId,
        user_id: user.id,
        salary: 0, bonus: 0, other: 0, notes: '',
      })
      setSalary(''); setBonus(''); setOther(''); setNotes('')
      toast.success('הכנסה אופסה')
    } catch { toast.error('שגיאה באיפוס') }
  }

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)

  // Trend: last 6 periods with income data
  const trendData = (() => {
    if (!allIncome || !periods) return []
    const currentIdx = periods.findIndex(p => p.id === selectedPeriodId)
    const slice = periods.slice(Math.max(0, currentIdx - 5), currentIdx + 1)
    return slice.map(p => {
      const inc = allIncome.find(i => i.period_id === p.id)
      return {
        label: periodLabel(p.start_date),
        total: inc ? inc.salary + inc.bonus + inc.other : 0,
        salary: inc?.salary ?? 0,
        bonus: inc?.bonus ?? 0,
        other: inc?.other ?? 0,
        isCurrent: p.id === selectedPeriodId,
      }
    }).filter(d => d.total > 0)
  })()

  const avgIncome = trendData.length > 1
    ? trendData.slice(0, -1).reduce((s, d) => s + d.total, 0) / (trendData.length - 1)
    : 0

  // Family totals
  const familyTotal = (familyIncome ?? []).reduce((s, m) => s + m.total, 0)

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-[oklch(0.65_0.18_250)]" />
          <h1 className="text-xl font-bold tracking-tight">הכנסה</h1>
        </div>
        <div className="flex items-center gap-3">
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
                      ? 'bg-[oklch(0.20_0.01_250)] text-[oklch(0.92_0.01_250)] shadow-[inset_0_0_0_1px_var(--accent-blue)]'
                      : 'bg-transparent text-[oklch(0.55_0.01_250)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={handleResetIncome} className="flex items-center gap-1.5 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-3.5 py-[7px] text-[oklch(0.65_0.01_250)] text-xs font-medium cursor-pointer">
            <Trash2 size={13} /> אפס הכנסה
          </button>
        </div>
      </div>
      <p className="text-[oklch(0.60_0.01_250)] text-sm mb-5">
        {selectedPeriod ? periodLabel(selectedPeriod.start_date) : '...'}
      </p>

      {periods && <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />}

      {/* ── Family View ──────────────────────────────────────────────────── */}
      {viewMode === 'family' && (
        <>
          {/* Family total KPI */}
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-[oklch(0.65_0.18_250)]" />
              <span className="font-semibold text-sm">הכנסה משפחתית כוללת</span>
            </div>
            <div className="text-[28px] font-bold text-[oklch(0.65_0.18_250)] mb-4">
              {formatCurrency(familyTotal)}
            </div>
          </div>

          {/* Per-member breakdown */}
          <div className="grid-2 items-start">
            {(familyIncome ?? []).map(member => (
              <div key={member.user_id} className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold text-sm">{member.display_name}</span>
                  <span className="text-[18px] font-bold text-[oklch(0.65_0.18_250)]">{formatCurrency(member.total)}</span>
                </div>
                <div className="flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-[oklch(0.65_0.01_250)]">משכורת</span>
                    <span className="font-medium">{formatCurrency(member.salary)}</span>
                  </div>
                  {member.bonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[oklch(0.65_0.01_250)]">בונוס</span>
                      <span className="font-medium text-[oklch(0.70_0.18_145)]">{formatCurrency(member.bonus)}</span>
                    </div>
                  )}
                  {member.other > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[oklch(0.65_0.01_250)]">אחר</span>
                      <span className="font-medium">{formatCurrency(member.other)}</span>
                    </div>
                  )}
                </div>
                {/* Contribution percentage */}
                {familyTotal > 0 && (
                  <div className="mt-3 pt-2 border-t border-[oklch(0.22_0.01_250)]">
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-[oklch(0.55_0.01_250)]">תרומה להכנסה משפחתית</span>
                      <span className="font-semibold text-[oklch(0.65_0.18_250)]">{Math.round((member.total / familyTotal) * 100)}%</span>
                    </div>
                    <div className="h-[3px] rounded-sm bg-[oklch(0.20_0.01_250)] overflow-hidden mt-1.5">
                      <div className="h-full rounded-sm bg-[oklch(0.65_0.18_250)]" style={{ width: `${Math.round((member.total / familyTotal) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Personal View ────────────────────────────────────────────────── */}
      {viewMode === 'personal' && (
      <div className="grid-2 items-start">

        {/* Input form */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="mb-[18px] font-semibold text-sm">הזנת הכנסה למחזור</div>

          {[
            { label: 'משכורת נטו', val: salary, set: setSalary, placeholder: '0' },
            { label: 'בונוס', val: bonus, set: setBonus, placeholder: '0' },
            { label: 'הכנסה אחרת', val: other, set: setOther, placeholder: '0' },
          ].map(field => (
            <div key={field.label} className="mb-3.5">
              <label className="text-[13px] block mb-[5px] text-[oklch(0.75_0.01_250)]">
                {field.label}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={field.val}
                  onChange={e => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2.5 pr-10 pl-3 text-inherit text-[15px] text-left" style={{ direction: 'ltr' }}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[oklch(0.65_0.01_250)] text-[13px]">₪</span>
              </div>
            </div>
          ))}

          <div className="mb-3.5">
            <label className="text-[13px] block mb-[5px] text-[oklch(0.75_0.01_250)]">הערות</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="הערה אופציונלית..."
              className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2.5 px-3 text-inherit text-sm"
            />
          </div>

          <div className="flex justify-between items-center py-3.5 border-t border-[oklch(0.22_0.01_250)]">
            <span className="font-semibold">סה&quot;כ הכנסה</span>
            <span className="text-[22px] font-bold text-[oklch(0.65_0.18_250)]">
              {formatCurrency(total)}
            </span>
          </div>

          {avgIncome > 0 && total > 0 && (
            <div className="text-xs text-[oklch(0.65_0.01_250)] mb-3 text-center">
              ממוצע 3 חודשים: {formatCurrency(avgIncome)}
              {' '}
              <span className={total >= avgIncome ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}>
                ({total >= avgIncome ? '↑' : '↓'}{Math.abs(Math.round(((total - avgIncome) / avgIncome) * 100))}%)
              </span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            className={`btn-hover w-full bg-[oklch(0.65_0.18_250)] text-[oklch(0.12_0.01_250)] border-none rounded-lg py-3 font-semibold text-[15px] cursor-pointer ${upsert.isPending ? 'opacity-70' : 'opacity-100'}`}
          >
            {upsert.isPending ? 'שומר...' : 'שמור הכנסה'}
          </button>
        </div>

        {/* Trend chart */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="flex items-center gap-[7px] font-semibold text-sm mb-4">
            <TrendingUp size={14} className="text-[oklch(0.65_0.18_250)]" />
            מגמת הכנסה
          </div>
          <IncomeTrendChart data={trendData} />

          {/* Last 6 periods summary */}
          {trendData.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-[oklch(0.65_0.01_250)] mb-2">סיכום לפי מחזור</div>
              {[...trendData].reverse().map(d => (
                <div key={d.label} className="flex justify-between text-xs py-[5px] border-b border-[oklch(0.20_0.01_250)]">
                  <span className={`${d.isCurrent ? 'text-[oklch(0.92_0.01_250)] font-semibold' : 'text-[oklch(0.65_0.01_250)] font-normal'}`}>
                    {d.label}{d.isCurrent ? ' ✦' : ''}
                  </span>
                  <span className={`${d.isCurrent ? 'font-semibold' : 'font-normal'}`}>{formatCurrency(d.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
