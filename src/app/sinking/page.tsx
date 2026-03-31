'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods } from '@/lib/queries/usePeriods'
import { useSinkingFunds, useAllSinkingTransactions, useAddSinkingTransaction, useUpdateSinkingFund, useAddSinkingFund, useDeleteSinkingFund, useDeleteSinkingTransaction, useFamilySinkingFunds, useFamilySinkingTransactions } from '@/lib/queries/useSinking'
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
import { Target, Plus, X, Pencil, Users, User, Trash2, Inbox, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PageInfo } from '@/components/ui/PageInfo'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { PAGE_TIPS } from '@/lib/page-tips'

type FundForm = { name: string; totalAnnual: string; isShared: boolean }

export default function SinkingPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { members, isSolo } = useFamilyContext()
  const { viewMode } = useFamilyView()
  const isFamily = viewMode === 'family'
  const familyMemberIds = useMemo(() => members.map(m => m.user_id), [members])
  const splitFrac = useSplitFraction(user?.id)
  const { data: periods } = usePeriods()
  const { data: myFunds } = useSinkingFunds(user?.id)
  const { data: familyFundsData } = useFamilySinkingFunds(familyMemberIds, isFamily)
  const rawFunds = isFamily ? familyFundsData : myFunds
  // In solo mode, hide shared funds
  const funds = isSolo ? rawFunds?.filter(f => !f.is_shared) : rawFunds
  const { data: myTxns } = useAllSinkingTransactions(user?.id)
  const { data: familyTxnsData } = useFamilySinkingTransactions(familyMemberIds, isFamily)
  const allTxns = isFamily ? familyTxnsData : myTxns
  const addTxn = useAddSinkingTransaction()
  const updateFund = useUpdateSinkingFund()
  const addFund = useAddSinkingFund()
  const deleteFund = useDeleteSinkingFund()
  const deleteTxn = useDeleteSinkingTransaction()
  const queryClient = useQueryClient()
  const confirm = useConfirmDialog()

  // Fund create / edit
  const [newFund, setNewFund] = useState<FundForm | null>(null)
  const [editFund, setEditFund] = useState<(FundForm & { id: number }) | null>(null)

  // Transaction (log expense/deposit)
  const [txModal, setTxModal] = useState<{ fundId: number; fundName: string; type: 'add' | 'use' } | null>(null)
  const [txAmount, setTxAmount] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0])
  const [txPeriodId, setTxPeriodId] = useState<number | undefined>()
  const [expandedFunds, setExpandedFunds] = useState<Set<number>>(new Set())

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
    } catch (e) { console.error('Reset sinking funds:', e); toast.error('שגיאה באיפוס') }
  }

  function getFundSpent(fundId: number) {
    const txns = allTxns?.filter(t => t.fund_id === fundId) ?? []
    return txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  }

  function getFundRemaining(fundId: number) {
    const fund = (funds ?? []).find(f => f.id === fundId)
    if (!fund) return 0
    const totalAnnual = fund.yearly_target || fund.monthly_allocation * 12
    return totalAnnual - getFundSpent(fundId)
  }

  async function handleDeleteFund(id: number, name: string) {
    if (!(await confirm({ message: `למחוק את קרן "${name}"? הפעולה לא תמחק את היסטוריית העסקאות.` }))) return
    try {
      await deleteFund.mutateAsync(id)
      toast.success('קרן נמחקה')
    } catch (e) { console.error('Delete sinking fund:', e); toast.error('שגיאה במחיקה') }
  }

  async function handleDeleteTxn(id: number) {
    if (!(await confirm({ message: 'למחוק את העסקה?' }))) return
    try {
      await deleteTxn.mutateAsync(id)
      toast.success('עסקה נמחקה')
    } catch (e) { console.error('Delete sinking txn:', e); toast.error('שגיאה במחיקה') }
  }

  function toggleFundExpand(fundId: number) {
    setExpandedFunds(prev => {
      const next = new Set(prev)
      if (next.has(fundId)) next.delete(fundId)
      else next.add(fundId)
      return next
    })
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
    } catch (e) { console.error('Add sinking fund:', e); toast.error('שגיאה בהוספה') }
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
    } catch (e) { console.error('Edit sinking fund:', e); toast.error('שגיאה בעדכון הקרן') }
  }

  async function handleTxn() {
    if (!txModal || !txAmount || !txPeriodId) return
    const raw = Number(txAmount)
    const amount = txModal.type === 'add' ? raw : -raw
    const desc = txDesc || (txModal.type === 'add' ? 'הפקדה' : 'הוצאה')
    try {
      await addTxn.mutateAsync({ fund_id: txModal.fundId, period_id: txPeriodId, amount, description: desc, transaction_date: txDate })
      toast.success(txModal.type === 'add' ? 'הפקדה נרשמה' : 'הוצאה נרשמה')
      setTxModal(null); setTxAmount(''); setTxDesc(''); setTxDate(new Date().toISOString().split('T')[0])
    } catch (e) { console.error('Sinking fund transaction:', e); toast.error('שגיאה') }
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
  const totalAnnualAll = (funds ?? []).reduce((s, f) => s + (f.yearly_target || f.monthly_allocation * 12), 0)
  const totalSpentAll = (funds ?? []).reduce((s, f) => s + getFundSpent(f.id), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-[var(--accent-teal)]" />
          <h1 className="text-xl font-bold tracking-tight">קרנות צבירה</h1>
          <PageInfo {...PAGE_TIPS.sinking} />
        </div>
        <div className="flex gap-2">
          <button onClick={handleResetBalances} className="flex items-center gap-1.5 bg-transparent border border-[var(--border-default)] rounded-lg px-3.5 py-[7px] text-[var(--text-secondary)] text-xs font-medium cursor-pointer">
            <Trash2 size={13} /> אפס יתרות
          </button>
          <button
            onClick={() => setNewFund({ name: '', totalAnnual: '', isShared: false })}
            className="btn-hover flex items-center gap-1.5 bg-[var(--c-teal-0-20)] border border-[var(--c-teal-0-32)] rounded-lg px-3.5 py-[7px] text-[var(--accent-teal)] text-[13px] font-medium cursor-pointer"
          >
            <Plus size={13} /> קרן חדשה
          </button>
        </div>
      </div>
      <div className="text-[var(--text-secondary)] text-[13px] mb-5">
        סה&quot;כ הפרשה חודשית: <span className="inline-block font-semibold text-[var(--accent-teal)]">{formatCurrency(totalMonthly)}</span>
        <span className="mr-2 text-[var(--text-secondary)] text-xs">
          (תקציב שנתי: {formatCurrency(totalAnnualAll)})
        </span>
        {totalSpentAll > 0 && (
          <span className="mr-2 text-xs">
            הוצאת: <span className="text-[var(--accent-orange)] font-semibold">{formatCurrency(totalSpentAll)}</span>
            {' '}נשאר: <span className="text-[var(--accent-green)] font-semibold">{formatCurrency(totalAnnualAll - totalSpentAll)}</span>
          </span>
        )}
      </div>

      {/* Fund list */}
      {!funds?.length
        ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-10 text-center">
            <Inbox size={36} className="text-[var(--c-0-30)] mx-auto mb-2.5" />
            <div className="text-[var(--text-secondary)] text-sm">אין קרנות -- לחץ &quot;קרן חדשה&quot; להתחיל</div>
          </div>
        )
        : (
          <div className="flex flex-col gap-2.5">
            {funds.map(fund => {
              const shared = fund.is_shared
              const totalAnnual = fund.yearly_target || fund.monthly_allocation * 12
              const spent = getFundSpent(fund.id)
              const remaining = totalAnnual - spent
              const spentPct = totalAnnual > 0 ? Math.min((spent / totalAnnual) * 100, 100) : 0
              const isExpanded = expandedFunds.has(fund.id)
              const fundTxns = (allTxns ?? []).filter(t => t.fund_id === fund.id).sort((a, b) => (b.transaction_date ?? '').localeCompare(a.transaction_date ?? ''))

              return (
                <div key={fund.id} className="card-hover card-transition bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl px-[18px] py-3.5">
                  <div className="flex items-center gap-2.5">
                    {/* Name + type - right side in RTL (first in DOM) */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{fund.name}</span>
                        <span className={`inline-flex items-center gap-[3px] rounded-[20px] px-2 py-0.5 text-[11px] ${
                          shared
                            ? 'bg-[var(--c-blue-0-20)] border border-[var(--c-blue-0-32)] text-[var(--accent-blue)]'
                            : 'bg-[var(--c-teal-0-20)] border border-[var(--c-teal-0-32)] text-[var(--c-teal-0-65)]'
                        }`}>
                          {shared ? <Users size={10} /> : <User size={10} />}
                          {shared ? 'משותף' : 'אישי'}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-sm bg-[var(--bg-hover)] overflow-hidden max-w-[240px]">
                        <div className="h-full rounded-sm bg-[var(--accent-orange)] transition-[width] duration-[400ms] ease-out" style={{ width: `${Math.max(0, spentPct)}%` }} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => { setTxModal({ fundId: fund.id, fundName: fund.name, type: 'use' }); setTxAmount(''); setTxDate(new Date().toISOString().split('T')[0]) }}
                        className="flex items-center justify-center gap-1 bg-[var(--c-orange-0-20)] border border-[var(--c-orange-0-28)] rounded-[7px] px-2.5 py-2 min-h-9 text-[var(--accent-orange)] text-xs cursor-pointer"
                      >
                        <X size={11} /> הוצאה
                      </button>
                      <button
                        onClick={() => openEdit(fund)}
                        aria-label="ערוך קרן"
                        className="flex items-center justify-center bg-[var(--c-0-20)] border border-[var(--border-light)] rounded-[7px] p-2 min-w-9 min-h-9 text-[var(--text-secondary)] text-xs cursor-pointer"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteFund(fund.id, fund.name)}
                        aria-label="מחק קרן"
                        className="flex items-center justify-center bg-[var(--c-red-0-18)] border border-[var(--c-red-0-28)] rounded-[7px] p-2 min-w-9 min-h-9 text-[var(--c-red-0-62)] text-xs cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Amounts - left side in RTL (last in DOM) */}
                    <div className="text-left shrink-0">
                      <div className="text-base font-bold text-[var(--c-0-88)]">{formatCurrency(fund.monthly_allocation)}<span className="text-[11px] font-normal text-[var(--text-secondary)] mr-[3px]">/חודש</span></div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        תקציב שנתי: {formatCurrency(totalAnnual)}
                        {shared && <span className="mr-1 text-[var(--text-secondary)]">(חלקי: {formatCurrency(fund.monthly_allocation * 12)})</span>}
                      </div>
                    </div>
                  </div>

                  {/* Spent / Remaining row */}
                  <div className="mt-2 text-xs text-[var(--text-secondary)] flex justify-between pt-2 border-t border-[var(--c-0-20)]">
                    <span>הוצאת: <span className="text-[var(--accent-orange)] font-semibold">{formatCurrency(spent)}</span> מתוך {formatCurrency(totalAnnual)}</span>
                    <span>נשאר: <span className={`font-semibold ${remaining >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>{formatCurrency(remaining)}</span></span>
                  </div>

                  {/* Transaction history toggle */}
                  {fundTxns.length > 0 && (
                    <button
                      onClick={() => toggleFundExpand(fund.id)}
                      className="mt-2 flex items-center gap-1 text-[11px] text-[var(--text-secondary)] bg-transparent border-none cursor-pointer p-0 hover:text-[var(--c-0-70)]"
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {fundTxns.length} עסקאות
                    </button>
                  )}

                  {/* Expanded transaction list */}
                  {isExpanded && fundTxns.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-[var(--c-0-20)] pt-2">
                      {fundTxns.map(tx => (
                        <div key={tx.id} className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-[var(--bg-hover)]">
                          <span className="text-[var(--text-secondary)] shrink-0 w-[70px] text-left ltr">{tx.transaction_date ?? '-'}</span>
                          <span className="flex-1 min-w-0 truncate text-[var(--c-0-70)]">{tx.description || '-'}</span>
                          <span className={`shrink-0 font-medium ${tx.amount > 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]'}`}>
                            {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                          </span>
                          <button
                            onClick={() => handleDeleteTxn(tx.id)}
                            aria-label="מחק עסקה"
                            className="shrink-0 bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-1 hover:text-[var(--accent-red)]"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add fund inline card */}
            <button
              onClick={() => setNewFund({ name: '', totalAnnual: '', isShared: false })}
              className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--border-default)] rounded-xl px-[18px] py-5 text-[var(--text-secondary)] text-sm cursor-pointer bg-transparent hover:border-[var(--accent-teal)] hover:text-[var(--accent-teal)] transition-colors"
            >
              <Plus size={15} />
              הוסף קרן
            </button>
          </div>
        )
      }

      {/* Add Fund Modal */}
      {newFund && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-[14px] p-7 w-full max-w-[360px]">
            <ModalHeader title="קרן שנתית חדשה" onClose={() => setNewFund(null)} />
            <FundFormFields form={newFund} onChange={setNewFund} splitFrac={splitFrac} />
            <button
              onClick={handleAddFund}
              disabled={addFund.isPending || !newFund.name.trim() || Number(newFund.totalAnnual) < 0}
              className={`w-full bg-[var(--accent-teal)] border-none rounded-lg py-[11px] font-semibold text-sm text-[var(--c-0-10)] ${addFund.isPending || !newFund.name.trim() || Number(newFund.totalAnnual) < 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            >
              {addFund.isPending ? '...' : 'הוסף קרן'}
            </button>
          </div>
        </div>
      )}

      {/* Edit Fund Modal */}
      {editFund && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-[14px] p-7 w-full max-w-[360px]">
            <ModalHeader title="עריכת קרן" onClose={() => setEditFund(null)} />
            <FundFormFields form={editFund} onChange={f => setEditFund(prev => prev && { ...prev, ...f })} splitFrac={splitFrac} />
            <button
              onClick={handleEditFund}
              disabled={updateFund.isPending || !editFund.name.trim() || Number(editFund.totalAnnual) < 0}
              className={`w-full bg-[var(--accent-teal)] border-none rounded-lg py-[11px] font-semibold text-sm text-[var(--c-0-10)] ${updateFund.isPending || !editFund.name.trim() || Number(editFund.totalAnnual) < 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            >
              {updateFund.isPending ? '...' : 'שמור'}
            </button>
          </div>
        </div>
      )}

      {/* Log Transaction Modal */}
      {txModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-[14px] p-7 w-full max-w-[360px]">
            <ModalHeader title={`${txModal.fundName} — הוצאה`} onClose={() => setTxModal(null)} />
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="sinking-tx-period" className="text-xs text-[var(--c-0-60)] block mb-[5px]">מחזור</label>
                <select id="sinking-tx-period" value={txPeriodId ?? ''} onChange={e => setTxPeriodId(Number(e.target.value))}
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm">
                  {periods?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="sinking-tx-amount" className="text-xs text-[var(--c-0-60)] block mb-[5px]">סכום (₪)</label>
                <input id="sinking-tx-amount" type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                  placeholder="0" min="0" autoFocus
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
              </div>
              <div>
                <label htmlFor="sinking-tx-date" className="text-xs text-[var(--c-0-60)] block mb-[5px]">תאריך</label>
                <input id="sinking-tx-date" type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm ltr text-left" />
              </div>
              <div>
                <label htmlFor="sinking-tx-desc" className="text-xs text-[var(--c-0-60)] block mb-[5px]">תיאור (אופציונלי)</label>
                <input id="sinking-tx-desc" type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)}
                  placeholder="לדוגמה: כרטיסי טיסה, מוצר..."
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setTxModal({ ...txModal, type: 'use' }) }}
                  className={`flex-1 rounded-lg py-2 text-[13px] cursor-pointer ${txModal.type === 'use' ? 'bg-[var(--accent-orange)] border border-[var(--accent-orange)] text-[var(--c-0-10)] font-semibold' : 'bg-[var(--bg-hover)] border border-[var(--border-light)] text-[var(--c-0-70)] font-normal'}`}
                >
                  הוצאה
                </button>
                <button
                  onClick={() => { setTxModal({ ...txModal, type: 'add' }) }}
                  className={`flex-1 rounded-lg py-2 text-[13px] cursor-pointer ${txModal.type === 'add' ? 'bg-[var(--accent-teal)] border border-[var(--accent-teal)] text-[var(--c-0-10)] font-semibold' : 'bg-[var(--bg-hover)] border border-[var(--border-light)] text-[var(--c-0-70)] font-normal'}`}
                >
                  הפקדה
                </button>
              </div>
              <button onClick={handleTxn} disabled={addTxn.isPending || !txAmount}
                className={`w-full bg-[var(--accent-teal)] border-none rounded-lg py-[11px] font-semibold text-sm text-[var(--c-0-10)] ${addTxn.isPending || !txAmount ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}>
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
      <button onClick={onClose} aria-label="סגור" className="bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-2 min-w-9 min-h-9 flex items-center justify-center"><X size={18} /></button>
    </div>
  )
}

function FundFormFields({ form, onChange, splitFrac }: { form: FundForm; onChange: (f: FundForm) => void; splitFrac: number }) {
  const total = Number(form.totalAnnual)
  const monthly = total > 0 ? (form.isShared ? Math.round(total / 12 * splitFrac) : Math.round(total / 12)) : 0

  return (
    <div className="flex flex-col gap-3.5 mb-4">
      <div>
        <label htmlFor="fund-name" className="text-xs text-[var(--c-0-60)] block mb-[5px]">שם הקרן</label>
        <input id="fund-name" type="text" autoFocus value={form.name}
          onChange={e => onChange({ ...form, name: e.target.value })}
          placeholder="למשל: טיולים, חתונה, רכב..."
          className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm" />
      </div>
      <div>
        <label htmlFor="fund-annual" className="text-xs text-[var(--c-0-60)] block mb-[5px]">תקציב שנתי כולל (₪) — כמה תוציאו על זה בשנה?</label>
        <input id="fund-annual" type="text" inputMode="numeric" value={form.totalAnnual}
          onChange={e => onChange({ ...form, totalAnnual: e.target.value.replace(/[^\d]/g, '') })}
          placeholder="0"
          className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
      </div>
      {/* Personal / Shared toggle */}
      <div>
        <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">סוג</label>
        <div className="flex gap-2">
          {([false, true] as const).map(shared => (
            <button key={String(shared)} type="button"
              onClick={() => onChange({ ...form, isShared: shared })}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-[9px] text-[13px] cursor-pointer ${
                form.isShared === shared
                  ? shared
                    ? 'bg-[var(--c-blue-0-24)] border border-[var(--c-blue-0-40)] text-[var(--c-blue-0-75)] font-semibold'
                    : 'bg-[var(--c-teal-0-24)] border border-[var(--c-teal-0-50)] text-[var(--c-teal-0-75)] font-semibold'
                  : 'bg-[var(--c-0-20)] border border-[var(--border-light)] text-[var(--text-secondary)] font-normal'
              }`}>
              {shared ? <><Users size={13} /> משותף</> : <><User size={13} /> אישי</>}
            </button>
          ))}
        </div>
      </div>
      {monthly > 0 && (
        <div className="bg-[var(--c-teal-0-20)] rounded-lg px-3.5 py-2.5 text-[13px] text-[var(--accent-teal)]">
          <div className="text-right">
            חלקך: <strong>{formatCurrency(monthly)}</strong> לחודש
            {form.isShared && <span className="text-[var(--text-secondary)] mr-1.5">({formatCurrency(monthly * 12)} לשנה)</span>}
          </div>
          {form.isShared && (
            <div className="text-[11px] text-[var(--text-secondary)] mt-[3px] text-right">
              יעד כולל: {formatCurrency(Number(form.totalAnnual))} × {Math.round(splitFrac * 100)}% ÷ 12
            </div>
          )}
        </div>
      )}
    </div>
  )
}
