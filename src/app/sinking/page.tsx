'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods } from '@/lib/queries/usePeriods'
import { useSinkingFunds, useAllSinkingTransactions, useAddSinkingTransaction, useUpdateSinkingFund, useAddSinkingFund } from '@/lib/queries/useSinking'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Target, Plus, Minus, X, Pencil } from 'lucide-react'

export default function SinkingPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const { data: funds } = useSinkingFunds(user?.id)
  const { data: allTxns } = useAllSinkingTransactions(user?.id)
  const addTxn = useAddSinkingTransaction()

  const updateFund = useUpdateSinkingFund()
  const addFund = useAddSinkingFund()
  const [newFund, setNewFund] = useState<{ name: string; annual: string } | null>(null)
  const [modal, setModal] = useState<{ fundId: number; type: 'add' | 'use' | 'personal' | 'shared' } | null>(null)
  const [txAmount, setTxAmount] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [txPeriodId, setTxPeriodId] = useState<number | undefined>()
  const [editFund, setEditFund] = useState<{ id: number; name: string; annual: string } | null>(null)

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

  if (loading || !user) return null

  // חישוב יתרה לכל קרן
  function getFundBalance(fundId: number, monthlyAlloc: number) {
    const txns = allTxns?.filter(t => t.fund_id === fundId) ?? []
    const deposits = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const withdrawals = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    return deposits - withdrawals
  }

  async function handleTxn() {
    if (!modal || !txAmount || !txPeriodId) return
    const rawAmount = Number(txAmount)
    let amount: number
    if (modal.type === 'add') amount = rawAmount
    else if (modal.type === 'shared') amount = -(rawAmount / 2)
    else amount = -rawAmount  // 'use' or 'personal'

    const desc = txDesc || (modal.type === 'shared' ? `הוצאה משותפת (סה"כ ${formatCurrency(rawAmount)})` : modal.type === 'personal' ? 'הוצאה אישית' : modal.type === 'add' ? 'הפקדה' : 'שימוש')
    try {
      await addTxn.mutateAsync({ fund_id: modal.fundId, period_id: txPeriodId, amount, description: desc, transaction_date: new Date().toISOString().split('T')[0] })
      toast.success(modal.type === 'add' ? 'הפקדה נרשמה' : 'הוצאה נרשמה')
      setModal(null); setTxAmount(''); setTxDesc('')
    } catch { toast.error('שגיאה') }
  }

  async function handleAddFund() {
    if (!newFund || !user) return
    const annual = Number(newFund.annual)
    if (!newFund.name.trim() || !annual || annual <= 0) return
    try {
      await addFund.mutateAsync({ name: newFund.name.trim(), monthly_allocation: Math.round(annual / 12), user_id: user.id })
      toast.success('קרן נוספה!')
      setNewFund(null)
    } catch { toast.error('שגיאה בהוספה') }
  }

  async function handleEditFund() {
    if (!editFund) return
    const annual = Number(editFund.annual)
    if (!annual || annual <= 0) return
    await updateFund.mutateAsync({ id: editFund.id, name: editFund.name, monthly_allocation: Math.round(annual / 12) })
    toast.success('קרן עודכנה')
    setEditFund(null)
  }

  const card: React.CSSProperties = { background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 20 }
  const totalBalance = funds?.reduce((s, f) => s + getFundBalance(f.id, f.monthly_allocation), 0) ?? 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} style={{ color: 'oklch(0.70 0.15 185)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>קרנות צבירה</h1>
        </div>
        <button
          onClick={() => setNewFund({ name: '', annual: '' })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'oklch(0.20 0.04 185)', border: '1px solid oklch(0.32 0.08 185)', borderRadius: 8, padding: '7px 14px', color: 'oklch(0.70 0.15 185)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={13} /> קרן חדשה
        </button>
      </div>
      <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13, marginBottom: 20 }}>
        יתרה כוללת: <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: 600, color: 'oklch(0.70 0.15 185)' }}>{formatCurrency(totalBalance)}</span>
      </p>

      {!funds?.length
        ? (
          <div style={{ ...card, textAlign: 'center', padding: 40 }}>
            <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 14 }}>אין קרנות צבירה — הן ייווצרו אוטומטית לאחר seed.sql</div>
          </div>
        )
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {funds.map(fund => {
              const balance = getFundBalance(fund.id, fund.monthly_allocation)
              const annualTarget = fund.monthly_allocation * 12
              const pct = annualTarget > 0 ? Math.min((balance / annualTarget) * 100, 100) : 0
              const remaining = annualTarget - balance
              const funded = balance >= annualTarget
              const txns = allTxns?.filter(t => t.fund_id === fund.id) ?? []
              const lastTxn = txns[0]

              return (
                <div key={fund.id} style={card}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14 }}>
                      {fund.name}
                      <button onClick={() => setEditFund({ id: fund.id, name: fund.name, annual: String(annualTarget) })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.50 0.01 250)', padding: 0, display: 'flex' }}>
                        <Pencil size={11} />
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', textAlign: 'left', direction: 'ltr' }}>
                      יעד שנתי: {formatCurrency(annualTarget)}
                    </div>
                  </div>

                  {/* Balance row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)' }}>צבור</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, direction: 'ltr' }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: funded ? 'oklch(0.70 0.18 145)' : balance > 0 ? 'oklch(0.70 0.15 185)' : 'oklch(0.62 0.22 27)' }}>
                        {formatCurrency(balance)}
                      </span>
                      <span style={{ fontSize: 12, color: 'oklch(0.50 0.01 250)' }}>/ {formatCurrency(annualTarget)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ height: 6, borderRadius: 3, background: 'oklch(0.22 0.01 250)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${Math.max(0, pct)}%`,
                        background: funded ? 'oklch(0.70 0.18 145)' : pct >= 70 ? 'oklch(0.70 0.15 185)' : 'oklch(0.55 0.10 185)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: lastTxn ? 10 : 14 }}>
                    <span style={{ color: funded ? 'oklch(0.70 0.18 145)' : 'oklch(0.55 0.01 250)' }}>
                      {funded ? '✓ ממומן מלא' : `נותר ${formatCurrency(Math.max(0, remaining))}`}
                    </span>
                    <span style={{ color: 'oklch(0.60 0.01 250)', direction: 'ltr' }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>

                  {lastTxn && (
                    <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid oklch(0.22 0.01 250)' }}>
                      אחרון: {lastTxn.description ?? (lastTxn.amount > 0 ? 'הפקדה' : 'שימוש')} — {formatCurrency(Math.abs(lastTxn.amount))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setModal({ fundId: fund.id, type: 'add' }); setTxAmount(fund.monthly_allocation.toString()) }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'oklch(0.20 0.04 145)', border: '1px solid oklch(0.30 0.06 145)', borderRadius: 8, padding: '8px 0', color: 'oklch(0.70 0.15 185)', fontSize: 13, cursor: 'pointer' }}>
                      <Plus size={13} /> הפקדה
                    </button>
                    <button onClick={() => { setModal({ fundId: fund.id, type: 'personal' }); setTxAmount('') }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'oklch(0.20 0.02 55)', border: '1px solid oklch(0.28 0.06 55)', borderRadius: 8, padding: '8px 0', color: 'oklch(0.72 0.18 55)', fontSize: 13, cursor: 'pointer' }}>
                      <Minus size={13} /> אישית
                    </button>
                    <button onClick={() => { setModal({ fundId: fund.id, type: 'shared' }); setTxAmount('') }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'oklch(0.20 0.02 320)', border: '1px solid oklch(0.28 0.06 320)', borderRadius: 8, padding: '8px 0', color: 'oklch(0.72 0.18 320)', fontSize: 13, cursor: 'pointer' }}>
                      <Minus size={13} /> משותפת
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      {/* Edit Fund Modal */}
      {editFund && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'oklch(0.18 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 14, padding: 28, width: 340 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>עריכת קרן</span>
              <button onClick={() => setEditFund(null)} style={{ background: 'none', border: 'none', color: 'oklch(0.55 0.01 250)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>שם הקרן</label>
                <input type="text" value={editFund.name} onChange={e => setEditFund(f => f && ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>
                  יעד שנתי (₪) — כמה תוציא על זה בשנה?
                </label>
                <input type="number" value={editFund.annual} onChange={e => setEditFund(f => f && ({ ...f, annual: e.target.value }))} placeholder="0" min="0"
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 15, direction: 'ltr', textAlign: 'right' }} />
              </div>
              {editFund.annual && Number(editFund.annual) > 0 && (
                <div style={{ background: 'oklch(0.20 0.02 185)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'oklch(0.70 0.15 185)', direction: 'ltr', textAlign: 'left' }}>
                  ≈ {formatCurrency(Math.round(Number(editFund.annual) / 12))} / חודש להפקיד
                </div>
              )}
              <button onClick={handleEditFund} disabled={updateFund.isPending}
                style={{ background: 'oklch(0.70 0.15 185)', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 600, fontSize: 14, color: 'oklch(0.10 0.01 250)', cursor: 'pointer' }}>
                {updateFund.isPending ? '...' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'oklch(0.18 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 14, padding: 28, width: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>
                {modal.type === 'add' ? 'הפקדה לקרן' : modal.type === 'shared' ? 'הוצאה משותפת' : 'הוצאה אישית'}
              </span>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'oklch(0.55 0.01 250)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>מחזור</label>
                <select value={txPeriodId ?? ''} onChange={e => setTxPeriodId(Number(e.target.value))}
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 13 }}>
                  {periods?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>
                  {modal.type === 'shared' ? 'סכום כולל (₪) — חלקך 50%' : 'סכום (₪)'}
                </label>
                <input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0" min="0"
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 15, direction: 'ltr', textAlign: 'right' }} />
                {modal.type === 'shared' && txAmount && Number(txAmount) > 0 && (
                  <div style={{ marginTop: 6, fontSize: 13, color: 'oklch(0.72 0.18 320)' }}>
                    = {formatCurrency(Number(txAmount) / 2)} יורד מהקרן
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>תיאור</label>
                <input type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="אופציונלי..."
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 13 }} />
              </div>
              <button onClick={handleTxn} disabled={addTxn.isPending}
                style={{ background: modal.type === 'add' ? 'oklch(0.70 0.15 185)' : modal.type === 'shared' ? 'oklch(0.72 0.18 320)' : 'oklch(0.72 0.18 55)', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 600, fontSize: 14, color: 'oklch(0.10 0.01 250)', cursor: 'pointer' }}>
                {addTxn.isPending ? '...' : modal.type === 'add' ? 'רשום הפקדה' : 'רשום הוצאה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add new fund modal ── */}
      {newFund && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'oklch(0.18 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 14, padding: 28, width: 340 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>קרן חדשה</span>
              <button onClick={() => setNewFund(null)} style={{ background: 'none', border: 'none', color: 'oklch(0.55 0.01 250)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>שם הקרן</label>
                <input
                  type="text" autoFocus
                  value={newFund.name}
                  onChange={e => setNewFund(f => f && ({ ...f, name: e.target.value }))}
                  placeholder="למשל: טיולים, חתונה, מחשב..."
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>יעד שנתי (₪) — כמה תוציא בשנה?</label>
                <input
                  type="number"
                  value={newFund.annual}
                  onChange={e => setNewFund(f => f && ({ ...f, annual: e.target.value }))}
                  placeholder="0" min="0"
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 15, direction: 'ltr', textAlign: 'right' }}
                />
              </div>
              {newFund.annual && Number(newFund.annual) > 0 && (
                <div style={{ background: 'oklch(0.20 0.02 185)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'oklch(0.70 0.15 185)', direction: 'ltr', textAlign: 'left' }}>
                  ≈ {formatCurrency(Math.round(Number(newFund.annual) / 12))} / חודש להפקיד
                </div>
              )}
              <button
                onClick={handleAddFund}
                disabled={addFund.isPending || !newFund.name.trim() || !Number(newFund.annual)}
                style={{ background: 'oklch(0.70 0.15 185)', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 600, fontSize: 14, color: 'oklch(0.10 0.01 250)', cursor: 'pointer', opacity: (addFund.isPending || !newFund.name.trim() || !Number(newFund.annual)) ? 0.5 : 1 }}
              >
                {addFund.isPending ? '...' : 'הוסף קרן'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
