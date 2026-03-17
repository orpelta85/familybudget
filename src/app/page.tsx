'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useIncome } from '@/lib/queries/useIncome'
import { usePersonalExpenses } from '@/lib/queries/useExpenses'
import { useSharedExpenses } from '@/lib/queries/useShared'
import { useApartmentDeposits } from '@/lib/queries/useApartment'
import { useHasSetup } from '@/lib/queries/useSetup'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PeriodSelector } from '@/components/layout/PeriodSelector'
import { Wallet, Receipt, TrendingUp, PiggyBank, Home, Users } from 'lucide-react'
import type { BudgetCategory } from '@/lib/types'

export default function Dashboard() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const { data: hasSetup, isLoading: setupLoading } = useHasSetup(user?.id)
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>()

  useEffect(() => {
    if (currentPeriod && !selectedPeriodId) setSelectedPeriodId(currentPeriod.id)
  }, [currentPeriod, selectedPeriodId])

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
  }, [user, userLoading, router])

  useEffect(() => {
    if (!userLoading && !setupLoading && user && hasSetup === false) router.push('/setup')
  }, [user, userLoading, hasSetup, setupLoading, router])

  const { data: income } = useIncome(selectedPeriodId, user?.id)
  const { data: expenses } = usePersonalExpenses(selectedPeriodId, user?.id)
  const { data: shared } = useSharedExpenses(selectedPeriodId)
  const { data: deposits } = useApartmentDeposits()

  if (userLoading || setupLoading) return <div style={{ padding: 40, color: 'oklch(0.55 0.01 250)', fontSize: 14 }}>טוען...</div>
  if (!user) return null

  const dataLoading = !selectedPeriodId
  const totalIncome = (income?.salary ?? 0) + (income?.bonus ?? 0) + (income?.other ?? 0)
  const totalPersonal = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const totalShared = shared?.reduce((s, e) => s + (e.my_share ?? e.total_amount * 0.5), 0) ?? 0
  const totalExpenses = totalPersonal + totalShared
  const netFlow = totalIncome - totalExpenses
  const savingsPct = totalIncome > 0 ? netFlow / totalIncome : 0
  const APARTMENT_TARGET = 3500 * 36

  const kpis = [
    { label: 'הכנסה נטו', value: dataLoading ? '—' : formatCurrency(totalIncome), color: 'oklch(0.65 0.18 250)', Icon: Wallet },
    { label: 'הוצאות החודש', value: dataLoading ? '—' : formatCurrency(totalExpenses), color: 'oklch(0.72 0.18 55)', Icon: Receipt },
    { label: 'תזרים נקי', value: dataLoading ? '—' : formatCurrency(netFlow), color: netFlow >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)', Icon: TrendingUp },
    { label: '% חיסכון', value: dataLoading ? '—' : `${Math.round(savingsPct * 100)}%`, color: 'oklch(0.70 0.15 185)', Icon: PiggyBank },
  ]

  const selectedPeriod = periods?.find(p => p.id === selectedPeriodId)
  const totalSaved = deposits?.reduce((s, d) => s + d.amount_deposited, 0) ?? 0
  const apartmentPct = Math.min((totalSaved / APARTMENT_TARGET) * 100, 100)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>דשבורד</h1>
        <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginTop: 4 }}>{selectedPeriod?.label ?? '...'}</p>
      </div>

      {periods && (
        <PeriodSelector periods={periods} selectedId={selectedPeriodId} onChange={setSelectedPeriodId} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{kpi.label}</span>
              <kpi.Icon size={15} style={{ color: kpi.color, opacity: 0.7 }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color, direction: 'ltr', letterSpacing: '-0.03em' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15 }}>
              <Home size={15} style={{ color: 'oklch(0.70 0.18 145)' }} /> יעד הדירה
            </div>
            <div style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', marginTop: 2 }}>3,500 ₪ × 36 מחזורים = 126,000 ₪</div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 18, fontWeight: 700, direction: 'ltr' }}>{formatCurrency(totalSaved)}</div>
            <div style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)' }}>מתוך {formatCurrency(APARTMENT_TARGET)}</div>
          </div>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${apartmentPct}%`, background: 'oklch(0.70 0.18 145)' }} />
        </div>
        <div style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', marginTop: 8, textAlign: 'center' }}>{apartmentPct.toFixed(1)}% מהיעד</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
            <Receipt size={14} style={{ color: 'oklch(0.72 0.18 55)' }} /> הוצאות אישיות
          </div>
          {!expenses?.length
            ? <div style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13 }}>אין הוצאות</div>
            : expenses.slice(0, 5).map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid oklch(0.20 0.01 250)', fontSize: 13 }}>
                <span style={{ color: 'oklch(0.75 0.01 250)' }}>{(e.budget_categories as BudgetCategory)?.name ?? 'כללי'}</span>
                <span style={{ direction: 'ltr', fontWeight: 500 }}>{formatCurrency(e.amount)}</span>
              </div>
            ))
          }
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontSize: 13, fontWeight: 600 }}>
            <span>סה&quot;כ</span>
            <span style={{ direction: 'ltr' }}>{formatCurrency(totalPersonal)}</span>
          </div>
        </div>

        <div style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
            <Users size={14} style={{ color: 'oklch(0.65 0.18 250)' }} /> הוצאות משותפות
          </div>
          {!shared?.length
            ? <div style={{ color: 'oklch(0.60 0.01 250)', fontSize: 13 }}>אין הוצאות</div>
            : shared.slice(0, 5).map(e => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid oklch(0.20 0.01 250)', fontSize: 13 }}>
                <span style={{ color: 'oklch(0.75 0.01 250)' }}>{sharedLabel(e.category)}</span>
                <span style={{ direction: 'ltr', fontWeight: 500 }}>{formatCurrency(e.my_share ?? e.total_amount / 2)}</span>
              </div>
            ))
          }
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontSize: 13, fontWeight: 600 }}>
            <span>חלקי</span>
            <span style={{ direction: 'ltr' }}>{formatCurrency(totalShared)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function sharedLabel(cat: string): string {
  const m: Record<string, string> = {
    rent: 'שכירות', property_tax: 'ארנונה', electricity: 'חשמל', water_gas: 'מים+גז',
    building_committee: 'ועד בית', internet: 'אינטרנט', home_insurance: 'ביטוח',
    netflix: 'נטפליקס', spotify: 'ספוטיפיי', groceries: 'מכולת', misc: 'שונות',
  }
  return m[cat] ?? cat
}
