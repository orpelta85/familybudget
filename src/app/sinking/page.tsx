'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods } from '@/lib/queries/usePeriods'
import { useSinkingFunds, useAllSinkingTransactions, useAddSinkingTransaction } from '@/lib/queries/useSinking'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Target, Plus, Minus, X } from 'lucide-react'

export default function SinkingPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const { data: funds } = useSinkingFunds(user?.id)
  const { data: allTxns } = useAllSinkingTransactions(user?.id)
  const addTxn = useAddSinkingTransaction()

  const [modal, setModal] = useState<{ fundId: number; type: 'add' | 'use' } | null>(null)
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
    const amount = Number(txAmount) * (modal.type === 'use' ? -1 : 1)
    try {
      await addTxn.mutateAsync({ fund_id: modal.fundId, period_id: txPeriodId, amount, description: txDesc, transaction_date: new Date().toISOString().split('T')[0] })
      toast.success(modal.type === 'use' ? 'שימוש נרשם' : 'הפקדה נרשמה')
      setModal(null); setTxAmount(''); setTxDesc('')
    } catch { toast.error('שגיאה') }
  }

  const card: React.CSSProperties = { background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 20 }
  const totalBalance = funds?.reduce((s, f) => s + getFundBalance(f.id, f.monthly_allocation), 0) ?? 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Target size={18} style={{ color: 'oklch(0.70 0.15 185)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>קרנות צבירה</h1>
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
              const txns = allTxns?.filter(t => t.fund_id === fund.id) ?? []
              const lastTxn = txns[0]

              return (
                <div key={fund.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{fund.name}</div>
                      <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)' }}>{formatCurrency(fund.monthly_allocation)} / חודש</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, direction: 'ltr', color: balance >= 0 ? 'oklch(0.70 0.15 185)' : 'oklch(0.62 0.22 27)' }}>
                      {formatCurrency(balance)}
                    </div>
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
                    <button onClick={() => { setModal({ fundId: fund.id, type: 'use' }); setTxAmount('') }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'oklch(0.20 0.02 55)', border: '1px solid oklch(0.28 0.06 55)', borderRadius: 8, padding: '8px 0', color: 'oklch(0.72 0.18 55)', fontSize: 13, cursor: 'pointer' }}>
                      <Minus size={13} /> שימוש
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'oklch(0.18 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 14, padding: 28, width: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{modal.type === 'use' ? 'שימוש בקרן' : 'הפקדה לקרן'}</span>
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
                <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>סכום (₪)</label>
                <input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0" min="0"
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 15, direction: 'ltr', textAlign: 'right' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', display: 'block', marginBottom: 5 }}>תיאור</label>
                <input type="text" value={txDesc} onChange={e => setTxDesc(e.target.value)} placeholder="אופציונלי..."
                  style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '9px 12px', color: 'inherit', fontSize: 13 }} />
              </div>
              <button onClick={handleTxn} disabled={addTxn.isPending}
                style={{ background: modal.type === 'use' ? 'oklch(0.72 0.18 55)' : 'oklch(0.70 0.15 185)', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 600, fontSize: 14, color: 'oklch(0.10 0.01 250)', cursor: 'pointer' }}>
                {addTxn.isPending ? '...' : modal.type === 'use' ? 'רשום שימוש' : 'רשום הפקדה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
