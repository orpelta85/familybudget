'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods } from '@/lib/queries/usePeriods'
import { useSinkingFunds, useAllSinkingTransactions, useAddSinkingTransaction, useUpdateSinkingFund, useAddSinkingFund, useDeleteSinkingFund } from '@/lib/queries/useSinking'
import { useSplitFraction } from '@/lib/queries/useProfile'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Target, Plus, X, Pencil, Users, User, Trash2, Inbox } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'

// ── Fund type (personal / shared) stored in localStorage ─────────────────────
function getFundMeta(userId: string): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(`fund_shared_${userId}`) ?? '{}') } catch { return {} }
}
function setFundShared(userId: string, fundId: number, isShared: boolean) {
  const meta = getFundMeta(userId)
  meta[fundId] = isShared
  localStorage.setItem(`fund_shared_${userId}`, JSON.stringify(meta))
}
function isFundShared(userId: string, fundId: number): boolean {
  return getFundMeta(userId)[fundId] ?? false
}

type FundForm = { name: string; totalAnnual: string; isShared: boolean }

const modalBase: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}
const modalCard: React.CSSProperties = {
  background: 'oklch(0.18 0.01 250)', border: '1px solid oklch(0.28 0.01 250)',
  borderRadius: 14, padding: 28, width: 360,
}
const inputBase: React.CSSProperties = {
  width: '100%', background: 'oklch(0.22 0.01 250)',
  border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8,
  padding: '9px 12px', color: 'inherit', fontSize: 14,
}

export default function SinkingPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const splitFrac = useSplitFraction(user?.id)
  const { data: periods } = usePeriods()
  const { data: funds } = useSinkingFunds(user?.id)
  const { data: allTxns } = useAllSinkingTransactions(user?.id)
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

  // Force re-render when localStorage changes
  const [, forceUpdate] = useState(0)

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
    const monthly = newFund.isShared ? Math.round(total / 12 * splitFrac) : Math.round(total / 12)
    try {
      const created = await addFund.mutateAsync({ name: newFund.name.trim(), monthly_allocation: monthly, user_id: user.id })
      if (created?.id) {
        setFundShared(user.id, created.id, newFund.isShared)
        forceUpdate(n => n + 1)
      }
      toast.success('קרן נוספה')
      setNewFund(null)
    } catch { toast.error('שגיאה בהוספה') }
  }

  async function handleEditFund() {
    if (!editFund || !user) return
    const total = Number(editFund.totalAnnual)
    if (total < 0) return
    const monthly = editFund.isShared ? Math.round(total / 12 * splitFrac) : Math.round(total / 12)
    await updateFund.mutateAsync({ id: editFund.id, name: editFund.name, monthly_allocation: monthly })
    setFundShared(user.id, editFund.id, editFund.isShared)
    forceUpdate(n => n + 1)
    toast.success('קרן עודכנה')
    setEditFund(null)
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

  function openEdit(fund: { id: number; name: string; monthly_allocation: number }) {
    if (!user) return
    const shared = isFundShared(user.id, fund.id)
    const totalAnnual = shared
      ? fund.monthly_allocation * 12 * 2   // reconstruct total from user's half
      : fund.monthly_allocation * 12
    setEditFund({ id: fund.id, name: fund.name, totalAnnual: String(totalAnnual), isShared: shared })
  }

  const totalMonthly = (funds ?? []).reduce((s, f) => s + f.monthly_allocation, 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} style={{ color: 'oklch(0.70 0.15 185)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>קרנות שנתיות</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleResetBalances} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 8, padding: '7px 14px', color: 'oklch(0.65 0.01 250)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <Trash2 size={13} /> אפס יתרות
          </button>
          <button
            onClick={() => setNewFund({ name: '', totalAnnual: '', isShared: false })}
            className="btn-hover"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.20 0.04 185)', border: '1px solid oklch(0.32 0.08 185)', borderRadius: 8, padding: '7px 14px', color: 'oklch(0.70 0.15 185)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            <Plus size={13} /> קרן חדשה
          </button>
        </div>
      </div>
      <p style={{ color: 'oklch(0.65 0.01 250)', fontSize: 13, marginBottom: 20 }}>
        סה&quot;כ הפרשה חודשית: <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: 600, color: 'oklch(0.70 0.15 185)' }}>{formatCurrency(totalMonthly)}</span>
        <span style={{ marginRight: 8, color: 'oklch(0.65 0.01 250)', fontSize: 12 }}>
          (יעד שנתי: {formatCurrency(totalMonthly * 12)})
        </span>
      </p>

      {/* ── Fund list ─────────────────────────────────────────────────────────── */}
      {!funds?.length
        ? (
          <div style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <Inbox size={36} style={{ color: 'oklch(0.30 0.01 250)', margin: '0 auto 10px' }} />
            <div style={{ color: 'oklch(0.65 0.01 250)', fontSize: 14 }}>אין קרנות -- לחץ &quot;קרן חדשה&quot; להתחיל</div>
          </div>
        )
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {funds.map(fund => {
              const shared = isFundShared(user.id, fund.id)
              const totalAnnual = shared ? fund.monthly_allocation * 12 * 2 : fund.monthly_allocation * 12
              const balance = getFundBalance(fund.id)
              const pct = totalAnnual > 0 ? Math.min((balance / totalAnnual) * 100, 100) : 0

              return (
                <div key={fund.id} className="card-hover card-transition" style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Name + type */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{fund.name}</span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          background: shared ? 'oklch(0.20 0.04 250)' : 'oklch(0.20 0.04 185)',
                          border: `1px solid ${shared ? 'oklch(0.32 0.08 250)' : 'oklch(0.32 0.08 185)'}`,
                          borderRadius: 20, padding: '2px 8px', fontSize: 11,
                          color: shared ? 'oklch(0.65 0.15 250)' : 'oklch(0.65 0.15 185)',
                        }}>
                          {shared ? <Users size={10} /> : <User size={10} />}
                          {shared ? 'משותף' : 'אישי'}
                        </span>
                      </div>
                      {/* Progress bar */}
                      {balance > 0 && (
                        <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'oklch(0.22 0.01 250)', overflow: 'hidden', maxWidth: 240 }}>
                          <div style={{ height: '100%', borderRadius: 2, width: `${Math.max(0, pct)}%`, background: 'oklch(0.70 0.15 185)', transition: 'width 0.4s ease' }} />
                        </div>
                      )}
                    </div>

                    {/* Amounts */}
                    <div style={{ textAlign: 'left', direction: 'ltr', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'oklch(0.88 0.01 250)' }}>{formatCurrency(fund.monthly_allocation)}<span style={{ fontSize: 11, fontWeight: 400, color: 'oklch(0.65 0.01 250)', marginRight: 3 }}>/חודש</span></div>
                      <div style={{ fontSize: 12, color: 'oklch(0.65 0.01 250)' }}>
                        יעד שנתי: {formatCurrency(totalAnnual)}
                        {shared && <span style={{ marginRight: 4, color: 'oklch(0.65 0.01 250)' }}>(חלקי: {formatCurrency(fund.monthly_allocation * 12)})</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => { setTxModal({ fundId: fund.id, fundName: fund.name, type: 'use' }); setTxAmount('') }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'oklch(0.20 0.02 55)', border: '1px solid oklch(0.28 0.06 55)', borderRadius: 7, padding: '8px 10px', minHeight: 36, color: 'oklch(0.72 0.18 55)', fontSize: 12, cursor: 'pointer' }}
                      >
                        <X size={11} /> הוצאה
                      </button>
                      <button
                        onClick={() => openEdit(fund)}
                        aria-label="ערוך קרן"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.20 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 7, padding: 8, minWidth: 36, minHeight: 36, color: 'oklch(0.65 0.01 250)', fontSize: 12, cursor: 'pointer' }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteFund(fund.id, fund.name)}
                        aria-label="מחק קרן"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.18 0.03 15)', border: '1px solid oklch(0.28 0.06 15)', borderRadius: 7, padding: 8, minWidth: 36, minHeight: 36, color: 'oklch(0.60 0.18 15)', fontSize: 12, cursor: 'pointer' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Balance row if any transactions */}
                  {balance !== 0 && (() => {
                    const currentMonth = new Date().getMonth() + 1
                    const expectedPct = (currentMonth / 12) * 100
                    const trackStatus = pct >= expectedPct
                      ? { text: 'בזמן ✓', color: 'oklch(0.70 0.18 145)' }
                      : pct >= expectedPct * 0.8
                        ? { text: 'קצת מאחור', color: 'oklch(0.72 0.18 55)' }
                        : { text: 'מאחור', color: 'oklch(0.62 0.22 27)' }
                    return (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'oklch(0.65 0.01 250)', display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid oklch(0.20 0.01 250)' }}>
                        <span>צבור: <span style={{ color: balance > 0 ? 'oklch(0.70 0.15 185)' : 'oklch(0.62 0.22 27)', fontWeight: 600, direction: 'ltr', display: 'inline-block' }}>{formatCurrency(balance)}</span>{balance < 0 && <span style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginRight: 4 }}>(הוצאה גדולה מהצבירה)</span>}</span>
                        <span style={{ direction: 'ltr', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {pct.toFixed(0)}% מהיעד השנתי
                          <span style={{ fontSize: 11, fontWeight: 500, color: trackStatus.color }}>{trackStatus.text}</span>
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

      {/* ── Add Fund Modal ────────────────────────────────────────────────────── */}
      {newFund && (
        <div style={modalBase}>
          <div style={modalCard}>
            <ModalHeader title="קרן שנתית חדשה" onClose={() => setNewFund(null)} />
            <FundFormFields form={newFund} onChange={setNewFund} />
            <button
              onClick={handleAddFund}
              disabled={addFund.isPending || !newFund.name.trim() || Number(newFund.totalAnnual) < 0}
              style={primaryBtn(addFund.isPending || !newFund.name.trim() || Number(newFund.totalAnnual) < 0)}
            >
              {addFund.isPending ? '...' : 'הוסף קרן'}
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Fund Modal ───────────────────────────────────────────────────── */}
      {editFund && (
        <div style={modalBase}>
          <div style={modalCard}>
            <ModalHeader title="עריכת קרן" onClose={() => setEditFund(null)} />
            <FundFormFields form={editFund} onChange={f => setEditFund(prev => prev && { ...prev, ...f })} />
            <button
              onClick={handleEditFund}
              disabled={updateFund.isPending || !editFund.name.trim() || Number(editFund.totalAnnual) < 0}
              style={primaryBtn(updateFund.isPending || !editFund.name.trim() || Number(editFund.totalAnnual) < 0)}
            >
              {updateFund.isPending ? '...' : 'שמור'}
            </button>
          </div>
        </div>
      )}

      {/* ── Log Transaction Modal ─────────────────────────────────────────────── */}
      {txModal && (
        <div style={modalBase}>
          <div style={modalCard}>
            <ModalHeader title={`${txModal.fundName} — הוצאה`} onClose={() => setTxModal(null)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>מחזור</label>
                <select value={txPeriodId ?? ''} onChange={e => setTxPeriodId(Number(e.target.value))}
                  aria-label="מחזור"
                  style={inputBase}>
                  {periods?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>סכום (₪)</label>
                <input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                  placeholder="0" min="0" autoFocus
                  style={{ ...inputBase, direction: 'ltr', textAlign: 'right', fontSize: 16 }} />
              </div>
              <div>
                <label style={labelStyle}>תיאור (אופציונלי)</label>
                <input type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)}
                  placeholder="לדוגמה: כרטיסי טיסה, מוצר..."
                  style={inputBase} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setTxModal({ ...txModal, type: 'use' }) }}
                  style={{ flex: 1, background: txModal.type === 'use' ? 'oklch(0.72 0.18 55)' : 'oklch(0.22 0.01 250)', border: `1px solid ${txModal.type === 'use' ? 'oklch(0.72 0.18 55)' : 'oklch(0.28 0.01 250)'}`, borderRadius: 8, padding: '8px 0', color: txModal.type === 'use' ? 'oklch(0.10 0.01 250)' : 'oklch(0.70 0.01 250)', fontSize: 13, cursor: 'pointer', fontWeight: txModal.type === 'use' ? 600 : 400 }}
                >
                  הוצאה
                </button>
                <button
                  onClick={() => { setTxModal({ ...txModal, type: 'add' }) }}
                  style={{ flex: 1, background: txModal.type === 'add' ? 'oklch(0.70 0.15 185)' : 'oklch(0.22 0.01 250)', border: `1px solid ${txModal.type === 'add' ? 'oklch(0.70 0.15 185)' : 'oklch(0.28 0.01 250)'}`, borderRadius: 8, padding: '8px 0', color: txModal.type === 'add' ? 'oklch(0.10 0.01 250)' : 'oklch(0.70 0.01 250)', fontSize: 13, cursor: 'pointer', fontWeight: txModal.type === 'add' ? 600 : 400 }}
                >
                  הפקדה
                </button>
              </div>
              <button onClick={handleTxn} disabled={addTxn.isPending || !txAmount}
                style={primaryBtn(addTxn.isPending || !txAmount)}>
                {addTxn.isPending ? '...' : 'רשום'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
      <button onClick={onClose} aria-label="סגור" style={{ background: 'none', border: 'none', color: 'oklch(0.65 0.01 250)', cursor: 'pointer', padding: 8, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
    </div>
  )
}

function FundFormFields({ form, onChange }: { form: FundForm; onChange: (f: FundForm) => void }) {
  const total = Number(form.totalAnnual)
  const monthly = total > 0 ? (form.isShared ? Math.round(total / 12 / 2) : Math.round(total / 12)) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
      <div>
        <label style={labelStyle}>שם הקרן</label>
        <input type="text" autoFocus value={form.name}
          onChange={e => onChange({ ...form, name: e.target.value })}
          placeholder="למשל: טיולים, חתונה, רכב..."
          style={inputBase} />
      </div>
      <div>
        <label style={labelStyle}>יעד שנתי כולל (₪) — כמה תוציאו על זה בשנה?</label>
        <input type="text" inputMode="numeric" value={form.totalAnnual}
          onChange={e => onChange({ ...form, totalAnnual: e.target.value.replace(/[^\d]/g, '') })}
          placeholder="0"
          style={{ ...inputBase, direction: 'ltr', textAlign: 'right', fontSize: 16 }} />
      </div>
      {/* Personal / Shared toggle */}
      <div>
        <label style={labelStyle}>סוג</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {([false, true] as const).map(shared => (
            <button key={String(shared)} type="button"
              onClick={() => onChange({ ...form, isShared: shared })}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: form.isShared === shared ? (shared ? 'oklch(0.24 0.06 250)' : 'oklch(0.24 0.06 185)') : 'oklch(0.20 0.01 250)',
                border: `1px solid ${form.isShared === shared ? (shared ? 'oklch(0.40 0.10 250)' : 'oklch(0.40 0.10 185)') : 'oklch(0.28 0.01 250)'}`,
                borderRadius: 8, padding: '9px 0',
                color: form.isShared === shared ? (shared ? 'oklch(0.75 0.15 250)' : 'oklch(0.75 0.15 185)') : 'oklch(0.65 0.01 250)',
                fontSize: 13, cursor: 'pointer', fontWeight: form.isShared === shared ? 600 : 400,
              }}>
              {shared ? <><Users size={13} /> משותף</> : <><User size={13} /> אישי</>}
            </button>
          ))}
        </div>
      </div>
      {monthly > 0 && (
        <div style={{ background: 'oklch(0.20 0.02 185)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'oklch(0.70 0.15 185)' }}>
          <div style={{ direction: 'ltr', textAlign: 'left' }}>
            חלקך: <strong>{formatCurrency(monthly)}</strong> לחודש
            {form.isShared && <span style={{ color: 'oklch(0.65 0.01 250)', marginRight: 6 }}>({formatCurrency(monthly * 12)} לשנה)</span>}
          </div>
          {form.isShared && (
            <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginTop: 3, direction: 'ltr', textAlign: 'left' }}>
              יעד כולל: {formatCurrency(Number(form.totalAnnual))} ÷ 2 ÷ 12
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5,
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', background: 'oklch(0.70 0.15 185)', border: 'none', borderRadius: 8,
    padding: '11px 0', fontWeight: 600, fontSize: 14, color: 'oklch(0.10 0.01 250)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  }
}
