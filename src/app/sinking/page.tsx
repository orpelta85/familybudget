'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods } from '@/lib/queries/usePeriods'
import { useSinkingFunds, useAllSinkingTransactions, useAddSinkingTransaction, useUpdateSinkingFund, useAddSinkingFund, useDeleteSinkingFund, useFamilySinkingFunds, useFamilySinkingTransactions } from '@/lib/queries/useSinking'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Target, Plus, X, Pencil, Users, User, Trash2, Inbox } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PageInfo } from '@/components/ui/PageInfo'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { PAGE_TIPS } from '@/lib/page-tips'

type FundForm = { name: string; totalAnnual: string; isShared: boolean }

export default function SinkingPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { members } = useFamilyContext()
  const { viewMode } = useFamilyView()
  const isFamily = viewMode === 'family'
  const familyMemberIds = useMemo(() => members.map(m => m.user_id), [members])
  const splitFrac = useSplitFraction(user?.id)
  const { data: periods } = usePeriods()
  const { data: myFunds } = useSinkingFunds(user?.id)
  const { data: familyFundsData } = useFamilySinkingFunds(familyMemberIds, isFamily)
  const funds = isFamily ? familyFundsData : myFunds
  const { data: myTxns } = useAllSinkingTransactions(user?.id)
  const { data: familyTxnsData } = useFamilySinkingTransactions(familyMemberIds, isFamily)
  const allTxns = isFamily ? familyTxnsData : myTxns
  const addTxn = useAddSinkingTransaction()
  const updateFund = useUpdateSinkingFund()
  const addFund = useAddSinkingFund()
  const deleteFund = useDeleteSinkingFund()
  const queryClient = useQueryClient()
  const confirm = useConfirmDialog()

  // Fund create / edit
  const [newFund, setNewFund] = useState<FundForm | null>(null)
  const [editFund, setEditFund] = useState<(FundForm & { id: number }) | null>(null)

  // Transaction (log expense/deposit)
  const [txModal, setTxModal] = useState<{ fundId: number; fundName: string; type: 'add' | 'use' } | null>(null)
  const [txAmount, setTxAmount] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [txPeriodId, setTxPeriodId] = useState<number | undefined>()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (periods?.length && !txPeriodId) {
      const today = new Date().toISOString().split('T')[0]
      const cur = periods.find(p => p.start_date <= today && p.end_date >= today)
      setTxPeriodId(cur?.id ?? periods[0]?.id)
    }
  }, [periods, txPeriodId])

  if (loading || !user) return <TableSkeleton rows={5} />

  async function handleResetBalances() {
    if (!user) return
    if (!(await confirm({ message: 'למחוק את כל התנועות בקרנות? היתרות יתאפסו.' }))) return
    try {
      const sb = createClient()
      const fundIds = (funds ?? []).map(f => f.id)
      if (fundIds.length > 0) {
        await sb.from('sinking_fund_transactions').delete().in('fund_id', fundIds)
      }
      queryClient.invalidateQueries({ queryKey: ['all_sinking_transactions'] })
      queryClient.invalidateQueries({ queryKey: ['sinking_transactions'] })
      toast.success('כל היתרות אופסו')
    } catch { toast.error('שגיאה באיפוס') }
  }

  function getFundBalance(fundId: number) {
    const txns = allTxns?.filter(t => t.fund_id === fundId) ?? []
    const deposits = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const withdrawals = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    return deposits - withdrawals
  }

  async function handleDeleteFund(id: number, name: string) {
    if (!(await confirm({ message: `למחוק את קרן "${name}"? הפעולה לא תמחק את היסטוריית העסקאות.` }))) return
    try {
      await deleteFund.mutateAsync(id)
      toast.success('קרן נמחקה')
    } catch { toast.error('שגיאה במחיקה') }
  }

  async function handleAddFund() {
    if (!newFund || !user) return
    const total = Number(newFund.totalAnnual)
    if (!newFund.name.trim() || total < 0) return
    // monthly_allocation = user's share per month
    const monthly = newFund.isShared ? Math.round(total / 12 * splitFrac) : Math.round(total / 12)
    try {
      await addFund.mutateAsync({
        name: newFund.name.trim(),
        monthly_allocation: monthly,
        user_id: user.id,
        yearly_target: total,
        is_shared: newFund.isShared,
      })
      toast.success('קרן נוספה')
      setNewFund(null)
    } catch { toast.error('שגיאה בהוספה') }
  }

  async function handleEditFund() {
    if (!editFund || !user) return
    const total = Number(editFund.totalAnnual)
    if (total < 0) return
    try {
      // monthly_allocation = user's share per month
      const monthly = editFund.isShared ? Math.round(total / 12 * splitFrac) : Math.round(total / 12)
      await updateFund.mutateAsync({
        id: editFund.id,
        name: editFund.name,
        monthly_allocation: monthly,
        yearly_target: total,
        is_shared: editFund.isShared,
      })
      toast.success('קרן עודכנה')
      setEditFund(null)
    } catch { toast.error('שגיאה בעדכון הקרן') }
  }

  async function handleTxn() {
    if (!txModal || !txAmount || !txPeriodId) return
    const raw = Number(txAmount)
    const amount = txModal.type === 'add' ? raw : -raw
    const desc = txDesc || (txModal.type === 'add' ? 'הפקדה' : 'הוצאה')
    try {
      await addTxn.mutateAsync({ fund_id: txModal.fundId, period_id: txPeriodId, amount, description: desc, transaction_date: new Date().toISOString().split('T')[0] })
      toast.success(txModal.type === 'add' ? 'הפקדה נרשמה' : 'הוצאה נרשמה')
      setTxModal(null); setTxAmount(''); setTxDesc('')
    } catch { toast.error('שגיאה') }
  }

  function openEdit(fund: { id: number; name: string; monthly_allocation: number; yearly_target: number; is_shared: boolean }) {
    // Use yearly_target directly from DB — no reconstruction needed
    setEditFund({
      id: fund.id,
      name: fund.name,
      totalAnnual: String(fund.yearly_target || fund.monthly_allocation * 12),
      isShared: fund.is_shared,
    })
  }

  const totalMonthly = (funds ?? []).reduce((s, f) => s + f.monthly_allocation, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-[oklch(0.70_0.15_185)]" />
          <h1 className="text-xl font-bold tracking-tight">קרנות שנתיות</h1>
          <PageInfo {...PAGE_TIPS.sinking} />
        </div>
        <div className="flex gap-2">
          <button onClick={handleResetBalances} className="flex items-center gap-1.5 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-3.5 py-[7px] text-[oklch(0.65_0.01_250)] text-xs font-medium cursor-pointer">
            <Trash2 size={13} /> אפס יתרות
          </button>
          <button
            onClick={() => setNewFund({ name: '', totalAnnual: '', isShared: false })}
            className="btn-hover flex items-center gap-1.5 bg-[oklch(0.20_0.04_185)] border border-[oklch(0.32_0.08_185)] rounded-lg px-3.5 py-[7px] text-[oklch(0.70_0.15_185)] text-[13px] font-medium cursor-pointer"
          >
            <Plus size={13} /> קרן חדשה
          </button>
        </div>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">
        סה&quot;כ הפרשה חודשית <InfoTooltip body="הסכום שמפרישים כל חודש לקרן. נקבע לפי היעד השנתי חלקי 12" />: <span className="inline-block font-semibold text-[oklch(0.70_0.15_185)]">{formatCurrency(totalMonthly)}</span>
        <span className="mr-2 text-[oklch(0.65_0.01_250)] text-xs">
          (יעד שנתי: {formatCurrency((funds ?? []).reduce((s, f) => s + (f.yearly_target || f.monthly_allocation * 12), 0))})
        </span>
      </p>

      {/* Fund list */}
      {!funds?.length
        ? (
          <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-10 text-center">
            <Inbox size={36} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2.5" />
            <div className="text-[oklch(0.65_0.01_250)] text-sm">אין קרנות -- לחץ &quot;קרן חדשה&quot; להתחיל</div>
          </div>
        )
        : (
          <div className="flex flex-col gap-2.5">
            {funds.map(fund => {
              const shared = fund.is_shared
              // Use yearly_target from DB directly — the source of truth
              const totalAnnual = fund.yearly_target || fund.monthly_allocation * 12
              const balance = getFundBalance(fund.id)
              const pct = totalAnnual > 0 ? Math.min((balance / totalAnnual) * 100, 100) : 0

              return (
                <div key={fund.id} className="card-hover card-transition bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl px-[18px] py-3.5">
                  <div className="flex items-center gap-2.5">
                    {/* Name + type */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{fund.name}</span>
                        <span className={`inline-flex items-center gap-[3px] rounded-[20px] px-2 py-0.5 text-[11px] ${
                          shared
                            ? 'bg-[oklch(0.20_0.04_250)] border border-[oklch(0.32_0.08_250)] text-[oklch(0.65_0.15_250)]'
                            : 'bg-[oklch(0.20_0.04_185)] border border-[oklch(0.32_0.08_185)] text-[oklch(0.65_0.15_185)]'
                        }`}>
                          {shared ? <Users size={10} /> : <User size={10} />}
                          {shared ? 'משותף' : 'אישי'}
                        </span>
                      </div>
                      {/* Progress bar */}
                      {balance > 0 && (
                        <div className="mt-1.5 h-1 rounded-sm bg-[oklch(0.22_0.01_250)] overflow-hidden max-w-[240px]">
                          <div className="h-full rounded-sm bg-[oklch(0.70_0.15_185)] transition-[width] duration-[400ms] ease-out" style={{ width: `${Math.max(0, pct)}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Amounts */}
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-[oklch(0.88_0.01_250)]">{formatCurrency(fund.monthly_allocation)}<span className="text-[11px] font-normal text-[oklch(0.65_0.01_250)] mr-[3px]">/חודש</span></div>
                      <div className="text-xs text-[oklch(0.65_0.01_250)]">
                        יעד שנתי: {formatCurrency(totalAnnual)}
                        {shared && <span className="mr-1 text-[oklch(0.65_0.01_250)]">(חלקי: {formatCurrency(fund.monthly_allocation * 12)})</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => { setTxModal({ fundId: fund.id, fundName: fund.name, type: 'use' }); setTxAmount('') }}
                        className="flex items-center justify-center gap-1 bg-[oklch(0.20_0.02_55)] border border-[oklch(0.28_0.06_55)] rounded-[7px] px-2.5 py-2 min-h-9 text-[oklch(0.72_0.18_55)] text-xs cursor-pointer"
                      >
                        <X size={11} /> הוצאה
                      </button>
                      <button
                        onClick={() => openEdit(fund)}
                        aria-label="ערוך קרן"
                        className="flex items-center justify-center bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-[7px] p-2 min-w-9 min-h-9 text-[oklch(0.65_0.01_250)] text-xs cursor-pointer"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteFund(fund.id, fund.name)}
                        aria-label="מחק קרן"
                        className="flex items-center justify-center bg-[oklch(0.18_0.03_15)] border border-[oklch(0.28_0.06_15)] rounded-[7px] p-2 min-w-9 min-h-9 text-[oklch(0.60_0.18_15)] text-xs cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Balance row — BUG 2 FIX: inverted colors */}
                  {/* Sinking fund = savings. Green = money available (good). Red = overspent (bad). */}
                  {balance !== 0 && (() => {
                    const remaining = totalAnnual - balance
                    // For sinking funds: balance > 0 means saved money still available = GREEN
                    // balance < 0 means overspent = RED
                    const balanceColor = balance > 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'
                    const currentMonth = new Date().getMonth() + 1
                    const expectedPct = (currentMonth / 12) * 100
                    const trackStatus = pct >= expectedPct
                      ? { text: 'בזמן ✓', color: 'text-[oklch(0.70_0.18_145)]' }
                      : pct >= expectedPct * 0.8
                        ? { text: 'קצת מאחור', color: 'text-[oklch(0.72_0.18_55)]' }
                        : { text: 'מאחור', color: 'text-[oklch(0.62_0.22_27)]' }
                    return (
                      <div className="mt-2 text-xs text-[oklch(0.65_0.01_250)] flex justify-between pt-2 border-t border-[oklch(0.20_0.01_250)]">
                        <span>צבור <InfoTooltip body="כמה צברתם עד עכשיו. ירוק = לא חרגתם, אדום = הוצאתם יותר ממה שצברתם" />: <span className={`${balanceColor} font-semibold inline-block`}>{formatCurrency(balance)}</span>{balance < 0 && <span className="text-[11px] text-[oklch(0.65_0.01_250)] mr-1">(הוצאה גדולה מהצבירה)</span>}</span>
                        <span className="flex items-center gap-2">
                          {pct.toFixed(0)}% מהיעד השנתי
                          <span className={`text-[11px] font-medium ${trackStatus.color}`}>{trackStatus.text}</span>
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )
      }

      {/* Add Fund Modal */}
      {newFund && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-[14px] p-7 w-[360px]">
            <ModalHeader title="קרן שנתית חדשה" onClose={() => setNewFund(null)} />
            <FundFormFields form={newFund} onChange={setNewFund} splitFrac={splitFrac} />
            <button
              onClick={handleAddFund}
              disabled={addFund.isPending || !newFund.name.trim() || Number(newFund.totalAnnual) < 0}
              className={`w-full bg-[oklch(0.70_0.15_185)] border-none rounded-lg py-[11px] font-semibold text-sm text-[oklch(0.10_0.01_250)] ${addFund.isPending || !newFund.name.trim() || Number(newFund.totalAnnual) < 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            >
              {addFund.isPending ? '...' : 'הוסף קרן'}
            </button>
          </div>
        </div>
      )}

      {/* Edit Fund Modal */}
      {editFund && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-[14px] p-7 w-[360px]">
            <ModalHeader title="עריכת קרן" onClose={() => setEditFund(null)} />
            <FundFormFields form={editFund} onChange={f => setEditFund(prev => prev && { ...prev, ...f })} splitFrac={splitFrac} />
            <button
              onClick={handleEditFund}
              disabled={updateFund.isPending || !editFund.name.trim() || Number(editFund.totalAnnual) < 0}
              className={`w-full bg-[oklch(0.70_0.15_185)] border-none rounded-lg py-[11px] font-semibold text-sm text-[oklch(0.10_0.01_250)] ${updateFund.isPending || !editFund.name.trim() || Number(editFund.totalAnnual) < 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            >
              {updateFund.isPending ? '...' : 'שמור'}
            </button>
          </div>
        </div>
      )}

      {/* Log Transaction Modal */}
      {txModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-[14px] p-7 w-[360px]">
            <ModalHeader title={`${txModal.fundName} — הוצאה`} onClose={() => setTxModal(null)} />
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">מחזור</label>
                <select value={txPeriodId ?? ''} onChange={e => setTxPeriodId(Number(e.target.value))}
                  aria-label="מחזור"
                  className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm">
                  {periods?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סכום (₪)</label>
                <input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                  placeholder="0" min="0" autoFocus
                  className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
              </div>
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">תיאור (אופציונלי)</label>
                <input type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)}
                  placeholder="לדוגמה: כרטיסי טיסה, מוצר..."
                  className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setTxModal({ ...txModal, type: 'use' }) }}
                  className={`flex-1 rounded-lg py-2 text-[13px] cursor-pointer ${txModal.type === 'use' ? 'bg-[oklch(0.72_0.18_55)] border border-[oklch(0.72_0.18_55)] text-[oklch(0.10_0.01_250)] font-semibold' : 'bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] text-[oklch(0.70_0.01_250)] font-normal'}`}
                >
                  הוצאה
                </button>
                <button
                  onClick={() => { setTxModal({ ...txModal, type: 'add' }) }}
                  className={`flex-1 rounded-lg py-2 text-[13px] cursor-pointer ${txModal.type === 'add' ? 'bg-[oklch(0.70_0.15_185)] border border-[oklch(0.70_0.15_185)] text-[oklch(0.10_0.01_250)] font-semibold' : 'bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] text-[oklch(0.70_0.01_250)] font-normal'}`}
                >
                  הפקדה
                </button>
              </div>
              <button onClick={handleTxn} disabled={addTxn.isPending || !txAmount}
                className={`w-full bg-[oklch(0.70_0.15_185)] border-none rounded-lg py-[11px] font-semibold text-sm text-[oklch(0.10_0.01_250)] ${addTxn.isPending || !txAmount ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}>
                {addTxn.isPending ? '...' : 'רשום'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared sub-components

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex justify-between items-center mb-5">
      <span className="font-semibold text-[15px]">{title}</span>
      <button onClick={onClose} aria-label="סגור" className="bg-transparent border-none text-[oklch(0.65_0.01_250)] cursor-pointer p-2 min-w-9 min-h-9 flex items-center justify-center"><X size={18} /></button>
    </div>
  )
}

function FundFormFields({ form, onChange, splitFrac }: { form: FundForm; onChange: (f: FundForm) => void; splitFrac: number }) {
  const total = Number(form.totalAnnual)
  const monthly = total > 0 ? (form.isShared ? Math.round(total / 12 * splitFrac) : Math.round(total / 12)) : 0

  return (
    <div className="flex flex-col gap-3.5 mb-4">
      <div>
        <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">שם הקרן</label>
        <input type="text" autoFocus value={form.name}
          onChange={e => onChange({ ...form, name: e.target.value })}
          placeholder="למשל: טיולים, חתונה, רכב..."
          className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm" />
      </div>
      <div>
        <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">יעד שנתי כולל (₪) — כמה תוציאו על זה בשנה?</label>
        <input type="text" inputMode="numeric" value={form.totalAnnual}
          onChange={e => onChange({ ...form, totalAnnual: e.target.value.replace(/[^\d]/g, '') })}
          placeholder="0"
          className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
      </div>
      {/* Personal / Shared toggle */}
      <div>
        <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סוג</label>
        <div className="flex gap-2">
          {([false, true] as const).map(shared => (
            <button key={String(shared)} type="button"
              onClick={() => onChange({ ...form, isShared: shared })}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-[9px] text-[13px] cursor-pointer ${
                form.isShared === shared
                  ? shared
                    ? 'bg-[oklch(0.24_0.06_250)] border border-[oklch(0.40_0.10_250)] text-[oklch(0.75_0.15_250)] font-semibold'
                    : 'bg-[oklch(0.24_0.06_185)] border border-[oklch(0.40_0.10_185)] text-[oklch(0.75_0.15_185)] font-semibold'
                  : 'bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] text-[oklch(0.65_0.01_250)] font-normal'
              }`}>
              {shared ? <><Users size={13} /> משותף</> : <><User size={13} /> אישי</>}
            </button>
          ))}
        </div>
      </div>
      {monthly > 0 && (
        <div className="bg-[oklch(0.20_0.02_185)] rounded-lg px-3.5 py-2.5 text-[13px] text-[oklch(0.70_0.15_185)]">
          <div className="text-right">
            חלקך: <strong>{formatCurrency(monthly)}</strong> לחודש
            {form.isShared && <span className="text-[oklch(0.65_0.01_250)] mr-1.5">({formatCurrency(monthly * 12)} לשנה)</span>}
          </div>
          {form.isShared && (
            <div className="text-[11px] text-[oklch(0.65_0.01_250)] mt-[3px] text-right">
              יעד כולל: {formatCurrency(Number(form.totalAnnual))} × {Math.round(splitFrac * 100)}% ÷ 12
            </div>
          )}
        </div>
      )}
    </div>
  )
}
