'use client'

import { useUser } from '@/lib/queries/useUser'
import {
  useNetWorthEntries, useNetWorthSnapshots, useUpsertNetWorthEntry,
  useDeleteNetWorthEntry, useSyncFromExistingData, useSaveSnapshot,
  type NetWorthEntry, type LiquidityType,
} from '@/lib/queries/useNetWorth'
import { usePensionReports } from '@/lib/queries/usePension'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  TrendingUp, Plus, X, Check, Trash2, Inbox, RefreshCw,
  Droplets, Clock, Lock, Building2, Pencil, CalendarDays,
} from 'lucide-react'
import { PageInfo } from '@/components/ui/PageInfo'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { PAGE_TIPS } from '@/lib/page-tips'
import { TableSkeleton } from '@/components/ui/Skeleton'
import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/Skeleton'

const LiquidityDonut = dynamic(() => import('@/components/dashboard/ExpenseDonut').then(m => ({ default: m.ExpenseDonut })), {
  loading: () => <ChartSkeleton height={150} />,
  ssr: false,
})

const TrendChart = dynamic(() => import('./TrendChart').then(m => ({ default: m.TrendChart })), {
  loading: () => <ChartSkeleton height={200} />,
  ssr: false,
})

const ASSET_CATEGORIES = [
  { value: 'cash', label: 'מזומן / עו"ש' },
  { value: 'apartment_savings', label: 'חיסכון דירה' },
  { value: 'keren_hishtalmut', label: 'קרן השתלמות' },
  { value: 'gemel', label: 'גמל' },
  { value: 'investments', label: 'השקעות' },
  { value: 'vehicle', label: 'רכב' },
  { value: 'pension', label: 'פנסיה' },
  { value: 'real_estate', label: 'נדל"ן' },
  { value: 'other_asset', label: 'אחר' },
]

const LIABILITY_CATEGORIES = [
  { value: 'mortgage', label: 'משכנתא' },
  { value: 'car_loan', label: 'הלוואת רכב' },
  { value: 'other_loans', label: 'הלוואות אחרות' },
  { value: 'credit_card', label: 'חוב אשראי' },
  { value: 'other_liability', label: 'אחר' },
]

const LIQUIDITY_MAP: Record<string, LiquidityType> = {
  cash: 'liquid',
  apartment_savings: 'liquid',
  keren_hishtalmut: 'semi_liquid',
  gemel: 'semi_liquid',
  investments: 'semi_liquid',
  vehicle: 'semi_liquid',
  pension: 'locked',
  real_estate: 'property',
}

const LIQUIDITY_GROUPS: { key: LiquidityType; label: string; icon: typeof Droplets; color: string; tip: string }[] = [
  { key: 'liquid', label: 'נזיל', icon: Droplets, color: 'var(--accent-green)', tip: 'כסף שאפשר למשוך מיד — עו"ש, חיסכון רגיל, קרנות צבירה' },
  { key: 'semi_liquid', label: 'חצי-נזיל', icon: Clock, color: 'var(--accent-blue)', tip: 'אפשר למשוך אבל עם מס או קנס — קרן השתלמות (לפני 6 שנים), גמל להשקעה' },
  { key: 'locked', label: 'נעול', icon: Lock, color: 'var(--accent-orange)', tip: 'לא ניתן למשוך עד גיל 60+ — קרן פנסיה, ביטוח מנהלים' },
  { key: 'property', label: 'נדל"ן', icon: Building2, color: 'var(--c-purple-0-65)', tip: 'נכס חשוב אבל לא נזיל — אל תספרו עליו לטווח קצר' },
]

type EntryForm = {
  category: string
  type: 'asset' | 'liability'
  amount: string
  name: string
  owner: 'personal' | 'shared'
  return_pct: string
  start_date: string
  end_date: string
}

function monthsRemaining(endDate: string | null): number | null {
  if (!endDate) return null
  const end = new Date(endDate)
  const now = new Date()
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
  return months > 0 ? months : 0
}

function formatMonthsRemaining(months: number): string {
  if (months === 0) return 'הסתיים'
  if (months === 1) return 'נשאר חודש אחד'
  if (months < 12) return `נשארו ${months} חודשים`
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (rem === 0) return `נשארו ${years} שנים`
  return `נשארו ${years} שנים ו-${rem} חודשים`
}

export default function NetWorthPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { data: entries } = useNetWorthEntries(user?.id)
  const { data: snapshots } = useNetWorthSnapshots(user?.id)
  const { data: pensionReports } = usePensionReports(user?.id)
  const upsert = useUpsertNetWorthEntry()
  const deleteEntry = useDeleteNetWorthEntry()
  const syncMutation = useSyncFromExistingData()
  const saveSnapshot = useSaveSnapshot()
  const confirm = useConfirmDialog()

  const { viewMode } = useFamilyView()
  const [newEntry, setNewEntry] = useState<EntryForm | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editAmount, setEditAmount] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Build a map of pension product id -> ytd_return from the latest pension report
  const pensionReturnMap = useMemo(() => {
    const map: Record<number, { ytd: number; name: string }> = {}
    if (!pensionReports?.length) return map
    const latest = pensionReports[0] // already sorted desc by date
    if (latest?.pension_products) {
      for (const p of latest.pension_products) {
        // Store report-level ytd_return per product
        map[p.id] = { ytd: latest.ytd_return, name: p.product_name }
      }
    }
    return map
  }, [pensionReports])

  // Filter entries by view mode
  const filteredEntries = useMemo(() => {
    if (!entries) return []
    if (viewMode !== 'personal') return entries
    return entries.filter(e => e.owner === 'personal')
  }, [entries, viewMode])

  const assets = useMemo(() => filteredEntries.filter(e => e.type === 'asset'), [filteredEntries])
  const liabilities = useMemo(() => filteredEntries.filter(e => e.type === 'liability'), [filteredEntries])
  const totalAssets = assets.reduce((s, e) => s + e.amount, 0)
  const totalLiabilities = liabilities.reduce((s, e) => s + e.amount, 0)
  const netWorth = totalAssets - totalLiabilities
  const liquidTotal = assets.filter(e => e.liquidity === 'liquid').reduce((s, e) => s + e.amount, 0)

  // Returns summary
  const returnsSummary = useMemo(() => {
    const assetsWithReturn = assets.filter(a => {
      const r = getReturnForEntry(a)
      return r.annual !== null && r.annual !== 0
    })
    if (assetsWithReturn.length === 0) return null

    let weightedSum = 0
    let totalWeight = 0
    for (const a of assetsWithReturn) {
      const r = getReturnForEntry(a)
      if (r.annual !== null) {
        weightedSum += a.amount * r.annual
        totalWeight += a.amount
      }
    }
    const weightedAvgPct = totalWeight > 0 ? weightedSum / totalWeight : 0
    const annualReturn = weightedSum / 100
    const monthlyReturn = annualReturn / 12

    return { monthlyReturn, annualReturn, weightedAvgPct }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, pensionReturnMap])

  // Group assets by liquidity
  const assetsByLiquidity = useMemo(() => {
    const groups: Record<LiquidityType, NetWorthEntry[]> = {
      liquid: [], semi_liquid: [], locked: [], property: [],
    }
    assets.forEach(a => {
      const liq = a.liquidity || LIQUIDITY_MAP[a.category] || 'liquid'
      groups[liq].push(a)
    })
    return groups
  }, [assets])

  // Donut data
  const donutData = useMemo(() => {
    return LIQUIDITY_GROUPS.map(g => ({
      name: g.label,
      value: assetsByLiquidity[g.key].reduce((s, e) => s + e.amount, 0),
      color: g.color,
    })).filter(d => d.value > 0)
  }, [assetsByLiquidity])

  function getLabelForCategory(cat: string, type: string) {
    const list = type === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES
    return list.find(c => c.value === cat)?.label ?? cat
  }

  function getReturnForEntry(entry: NetWorthEntry): { annual: number | null; cumulative: number | null; source: 'pension' | 'manual' } {
    if (entry.source === 'pension' && entry.source_ref_id && pensionReturnMap[entry.source_ref_id]) {
      return {
        annual: pensionReturnMap[entry.source_ref_id].ytd,
        cumulative: entry.cumulative_return_pct,
        source: 'pension',
      }
    }
    return {
      annual: entry.return_pct,
      cumulative: entry.cumulative_return_pct,
      source: 'manual',
    }
  }

  if (loading || !user) return <TableSkeleton rows={5} />

  async function handleAdd() {
    if (!newEntry || !user) return
    const amount = Number(newEntry.amount)
    if (!newEntry.category || amount <= 0) { toast.error('מלא קטגוריה וסכום'); return }
    try {
      await upsert.mutateAsync({
        user_id: user.id,
        category: newEntry.category,
        type: newEntry.type,
        amount,
        liquidity: newEntry.type === 'liability' ? 'liquid' : (LIQUIDITY_MAP[newEntry.category] ?? 'liquid'),
        source: 'manual',
        owner: newEntry.owner,
        name: newEntry.name || null,
        return_pct: newEntry.type === 'asset' && newEntry.return_pct ? Number(newEntry.return_pct) : null,
        start_date: newEntry.start_date || null,
        end_date: newEntry.end_date || null,
      })
      toast.success('נוסף')
      setNewEntry(null)
    } catch (e) { console.error('Add net worth entry:', e); toast.error('שגיאה') }
  }

  async function handleSaveEdit(entry: NetWorthEntry) {
    if (!user) return
    const amount = Number(editAmount)
    if (amount <= 0) { setEditingId(null); return }
    try {
      await upsert.mutateAsync({
        id: entry.id,
        user_id: user.id,
        category: entry.category,
        type: entry.type,
        amount,
        liquidity: entry.liquidity,
        source: entry.source,
        owner: entry.owner,
        name: entry.name,
      })
      toast.success('עודכן')
      setEditingId(null)
    } catch (e) { console.error('Edit net worth entry:', e); toast.error('שגיאה') }
  }

  async function handleDelete(id: number) {
    if (!user) return
    if (!(await confirm({ message: 'למחוק רשומה זו?' }))) return
    try {
      await deleteEntry.mutateAsync({ id, user_id: user.id })
      toast.success('נמחק')
    } catch (e) { console.error('Delete net worth entry:', e); toast.error('שגיאה במחיקה') }
  }

  async function handleSync() {
    if (!user) return
    try {
      const result = await syncMutation.mutateAsync({ userId: user.id, familyId })
      if (result.synced.length === 0) {
        toast.info('אין נתונים חדשים לסנכרון')
      } else {
        toast.success(`סונכרנו ${result.synced.length} רשומות`)
      }
      // Save a snapshot
      const allEntries = entries ?? []
      const allAssets = allEntries.filter(e => e.type === 'asset')
      const allLiabilities = allEntries.filter(e => e.type === 'liability')
      const ta = allAssets.reduce((s, e) => s + e.amount, 0)
      const tl = allLiabilities.reduce((s, e) => s + e.amount, 0)
      const lt = allAssets.filter(e => e.liquidity === 'liquid').reduce((s, e) => s + e.amount, 0)
      await saveSnapshot.mutateAsync({
        user_id: user.id,
        snapshot_date: new Date().toISOString().split('T')[0],
        total_assets: ta,
        total_liabilities: tl,
        net_worth: ta - tl,
        liquid_total: lt,
      })
    } catch (e) { console.error('Sync net worth:', e); toast.error('שגיאה בסנכרון') }
  }

  const allCategories = newEntry?.type === 'liability' ? LIABILITY_CATEGORIES : ASSET_CATEGORIES
  const isLiabilityForm = newEntry?.type === 'liability'
  const isAssetForm = newEntry?.type === 'asset'

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp size={18} className="text-[var(--accent-green)]" />
            <h1 className="text-xl font-bold tracking-tight">שווי נקי</h1>
            <PageInfo {...PAGE_TIPS['net-worth']} />
          </div>
          <p className="text-[var(--text-secondary)] text-[13px]">מעקב אחר נכסים והתחייבויות</p>
        </div>

        <div className="flex gap-2 items-center">
          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className={`flex items-center gap-1.5 bg-[var(--c-0-20)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-[var(--accent-green)] text-xs font-medium ${syncMutation.isPending ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
          >
            <RefreshCw size={13} className={syncMutation.isPending ? 'animate-spin' : ''} />
            סנכרן מנתונים קיימים
          </button>

        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'סה"כ נכסים', value: formatCurrency(totalAssets), color: 'var(--accent-green)' },
          { label: 'סה"כ התחייבויות', value: formatCurrency(totalLiabilities), color: 'var(--accent-red)' },
          { label: 'שווי נקי', value: formatCurrency(netWorth), color: netWorth >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' },
          { label: 'נזילות', value: formatCurrency(liquidTotal), color: 'var(--accent-blue)' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
            <div className="text-[11px] text-[var(--text-secondary)] mb-1.5 tracking-wide">{kpi.label}</div>
            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Returns summary */}
      {returnsSummary && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-[var(--accent-blue)]" />
            <span className="font-bold text-sm">סיכום תשואות</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[11px] text-[var(--text-secondary)] mb-1 tracking-wide flex items-center gap-1">תשואה חודשית <InfoTooltip body="כמה הכסף שלכם הרוויח (או הפסיד). תשואה שנתית של 8% = ממוצע שוק המניות" /></div>
              <div className={`text-xl font-bold ${returnsSummary.monthlyReturn >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                {returnsSummary.monthlyReturn >= 0 ? '+' : ''}{formatCurrency(returnsSummary.monthlyReturn)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-secondary)] mb-1 tracking-wide">תשואה שנתית</div>
              <div className={`text-xl font-bold ${returnsSummary.annualReturn >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                {returnsSummary.annualReturn >= 0 ? '+' : ''}{formatCurrency(returnsSummary.annualReturn)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-secondary)] mb-1 tracking-wide">תשואה ממוצעת משוקללת</div>
              <div className={`text-xl font-bold ${returnsSummary.weightedAvgPct >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                {returnsSummary.weightedAvgPct >= 0 ? '+' : ''}{returnsSummary.weightedAvgPct.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assets grouped by liquidity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {LIQUIDITY_GROUPS.map(group => {
          const items = assetsByLiquidity[group.key]
          const groupTotal = items.reduce((s, e) => s + e.amount, 0)
          const Icon = group.icon
          return (
            <div key={group.key} className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--bg-hover)]">
                <div className="flex items-center gap-2">
                  <Icon size={15} style={{ color: group.color }} />
                  <span className="font-bold text-sm">{group.label}</span>
                  <InfoTooltip body={group.tip} />
                </div>
                <span className="text-lg font-bold" style={{ color: group.color }}>{formatCurrency(groupTotal)}</span>
              </div>
              {!items.length ? (
                <div className="text-xs text-[var(--text-secondary)] text-center py-4">
                  <Inbox size={24} className="text-[var(--c-0-30)] mx-auto mb-2" />
                  אין רשומות
                </div>
              ) : (
                items.map(entry => {
                  const isEditing = editingId === entry.id
                  const isAuto = entry.source !== 'manual'
                  const returns = getReturnForEntry(entry)
                  return (
                    <div key={entry.id} className="py-2.5 border-b border-[var(--c-0-20)] last:border-b-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium">
                            {entry.name || getLabelForCategory(entry.category, entry.type)}
                          </span>
                          {isAuto && (
                            <span className="text-[10px] bg-[var(--c-blue-0-25)] text-[var(--c-blue-0-70)] px-1.5 py-0.5 rounded-md font-medium">
                              אוטומטי
                            </span>
                          )}
                          {entry.owner === 'shared' && viewMode !== 'personal' && (
                            <span className="text-[10px] bg-[var(--c-teal-0-25)] text-[var(--accent-teal)] px-1.5 py-0.5 rounded-md font-medium">
                              משותף
                            </span>
                          )}
                          {entry.tax_note && (
                            <span className="text-[10px] text-[var(--text-muted)]" title={entry.tax_note}>
                              *
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <input
                                type="number"
                                value={editAmount}
                                onChange={e => setEditAmount(e.target.value)}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(entry); if (e.key === 'Escape') setEditingId(null) }}
                                className="w-28 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-md px-2 py-1 text-inherit text-[13px] ltr text-left"
                              />
                              <button onClick={() => handleSaveEdit(entry)} aria-label="שמור" className="bg-transparent border-none cursor-pointer p-1 text-[var(--accent-green)]"><Check size={14} /></button>
                              <button onClick={() => setEditingId(null)} aria-label="ביטול" className="bg-transparent border-none cursor-pointer p-1 text-[var(--text-secondary)]"><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <span className="text-[13px] font-semibold" style={{ color: group.color }}>{formatCurrency(entry.amount)}</span>
                              {!isAuto && (
                                <>
                                  <button onClick={() => { setEditingId(entry.id); setEditAmount(String(entry.amount)) }} aria-label="ערוך" className="bg-transparent border-none cursor-pointer p-1.5 text-[var(--c-0-45)]"><Pencil size={11} /></button>
                                  <button onClick={() => handleDelete(entry.id)} aria-label="מחק" className="bg-transparent border-none cursor-pointer p-1.5 text-[var(--c-0-45)]"><Trash2 size={11} /></button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {/* Return info row */}
                      {(returns.annual !== null || returns.cumulative !== null) && (
                        <div className="flex gap-3 mt-1">
                          {returns.annual !== null && (
                            <span className={`text-[11px] ltr ${returns.annual >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                              תשואה שנתית: {returns.annual.toFixed(1)}%
                              {returns.source === 'pension' && (
                                <span className="text-[var(--c-0-50)] mr-1">(מדוח פנסיה)</span>
                              )}
                            </span>
                          )}
                          {returns.cumulative !== null && (
                            <span className={`text-[11px] ltr ${returns.cumulative >= 0 ? 'text-[var(--c-teal-0-65)]' : 'text-[var(--accent-red)]'}`}>
                              תשואה מצטברת: {returns.cumulative.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <button
                onClick={() => setNewEntry({ category: '', type: 'asset', amount: '', name: '', owner: viewMode !== 'personal' ? 'shared' : 'personal', return_pct: '', start_date: '', end_date: '' })}
                className="flex items-center gap-1 mt-3 bg-transparent border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-[var(--text-secondary)] text-xs cursor-pointer"
              >
                <Plus size={12} /> הוסף נכס
              </button>
            </div>
          )
        })}
      </div>

      {/* Liabilities + Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Liabilities */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--bg-hover)]">
            <span className="font-bold text-sm">התחייבויות</span>
            <span className="text-lg font-bold text-[var(--accent-red)]">{formatCurrency(totalLiabilities)}</span>
          </div>
          {!liabilities.length ? (
            <div className="text-xs text-[var(--text-secondary)] text-center py-4">
              <Inbox size={24} className="text-[var(--c-0-30)] mx-auto mb-2" />
              אין התחייבויות
            </div>
          ) : (
            liabilities.map(entry => {
              const isEditing = editingId === entry.id
              const remaining = monthsRemaining(entry.end_date)
              return (
                <div key={entry.id} className="py-2.5 border-b border-[var(--c-0-20)] last:border-b-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-medium">
                      {entry.name || getLabelForCategory(entry.category, entry.type)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(entry); if (e.key === 'Escape') setEditingId(null) }}
                            className="w-28 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-md px-2 py-1 text-inherit text-[13px] ltr text-left"
                          />
                          <button onClick={() => handleSaveEdit(entry)} aria-label="שמור" className="bg-transparent border-none cursor-pointer p-1 text-[var(--accent-green)]"><Check size={14} /></button>
                          <button onClick={() => setEditingId(null)} aria-label="ביטול" className="bg-transparent border-none cursor-pointer p-1 text-[var(--text-secondary)]"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <span className="text-[13px] font-semibold text-[var(--accent-red)]">{formatCurrency(entry.amount)}</span>
                          <button onClick={() => { setEditingId(entry.id); setEditAmount(String(entry.amount)) }} aria-label="ערוך" className="bg-transparent border-none cursor-pointer p-1.5 text-[var(--c-0-45)]"><Pencil size={11} /></button>
                          <button onClick={() => handleDelete(entry.id)} aria-label="מחק" className="bg-transparent border-none cursor-pointer p-1.5 text-[var(--c-0-45)]"><Trash2 size={11} /></button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Date info row */}
                  {(entry.start_date || entry.end_date) && (
                    <div className="flex items-center gap-3 mt-1">
                      <CalendarDays size={11} className="text-[var(--c-0-45)]" />
                      {entry.start_date && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          מ-{new Date(entry.start_date).toLocaleDateString('he-IL')}
                        </span>
                      )}
                      {entry.end_date && (
                        <span className="text-[11px] text-[var(--text-muted)]">
                          עד {new Date(entry.end_date).toLocaleDateString('he-IL')}
                        </span>
                      )}
                      {remaining !== null && (
                        <span className={`text-[11px] font-medium ${remaining <= 6 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-blue)]'}`}>
                          {formatMonthsRemaining(remaining)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
          <button
            onClick={() => setNewEntry({ category: '', type: 'liability', amount: '', name: '', owner: 'personal', return_pct: '', start_date: '', end_date: '' })}
            className="flex items-center gap-1 mt-3 bg-transparent border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-[var(--text-secondary)] text-xs cursor-pointer"
          >
            <Plus size={12} /> הוסף התחייבות
          </button>
        </div>

        {/* Liquidity donut */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
          <h2 className="font-bold text-sm mb-4">חלוקה לפי נזילות</h2>
          <LiquidityDonut data={donutData} />
        </div>
      </div>

      {/* Trend chart */}
      {(snapshots?.length ?? 0) > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 mb-4">
          <h2 className="font-bold text-sm mb-4">מגמת שווי נקי</h2>
          <TrendChart snapshots={snapshots ?? []} />
        </div>
      )}

      {/* Add Modal */}
      {newEntry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-[14px] p-7 w-[380px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <span className="font-semibold text-[15px]">הוסף {newEntry.type === 'asset' ? 'נכס' : 'התחייבות'}</span>
              <button onClick={() => setNewEntry(null)} aria-label="סגור" className="bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <label htmlFor="nw-name" className="text-xs text-[var(--c-0-60)] block mb-[5px]">שם (אופציונלי)</label>
                <input
                  id="nw-name"
                  type="text"
                  value={newEntry.name}
                  onChange={e => setNewEntry(prev => prev && { ...prev, name: e.target.value })}
                  placeholder='לדוגמה: "חשבון בנק לאומי"'
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm"
                />
              </div>
              <div>
                <label htmlFor="nw-category" className="text-xs text-[var(--c-0-60)] block mb-[5px]">קטגוריה</label>
                <select
                  id="nw-category"
                  value={newEntry.category}
                  onChange={e => setNewEntry(prev => prev && { ...prev, category: e.target.value })}
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm"
                >
                  <option value="">בחר...</option>
                  {allCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nw-amount" className="text-xs text-[var(--c-0-60)] block mb-[5px]">סכום (₪)</label>
                <input
                  id="nw-amount"
                  type="number"
                  value={newEntry.amount}
                  onChange={e => setNewEntry(prev => prev && { ...prev, amount: e.target.value })}
                  placeholder="0"
                  autoFocus
                  className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left"
                />
              </div>

              {/* Return % for assets */}
              {isAssetForm && (
                <div>
                  <label htmlFor="nw-return" className="text-xs text-[var(--c-0-60)] block mb-[5px]">תשואה שנתית % (אופציונלי)</label>
                  <input
                    id="nw-return"
                    type="number"
                    step="0.1"
                    value={newEntry.return_pct}
                    onChange={e => setNewEntry(prev => prev && { ...prev, return_pct: e.target.value })}
                    placeholder="לדוגמה: 7.5"
                    className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm ltr text-left"
                  />
                </div>
              )}

              {/* Date fields for liabilities */}
              {isLiabilityForm && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="nw-start-date" className="text-xs text-[var(--c-0-60)] block mb-[5px]">תאריך התחלה</label>
                    <input
                      id="nw-start-date"
                      type="date"
                      value={newEntry.start_date}
                      onChange={e => setNewEntry(prev => prev && { ...prev, start_date: e.target.value })}
                      className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="nw-end-date" className="text-xs text-[var(--c-0-60)] block mb-[5px]">תאריך סיום</label>
                    <input
                      id="nw-end-date"
                      type="date"
                      value={newEntry.end_date}
                      onChange={e => setNewEntry(prev => prev && { ...prev, end_date: e.target.value })}
                      className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-[9px] text-inherit text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Owner toggle */}
              <div>
                <label className="text-xs text-[var(--c-0-60)] block mb-[5px]">בעלות</label>
                <div className="flex border border-[var(--border-default)] rounded-lg overflow-hidden">
                  {([
                    { key: 'personal' as const, label: 'אישי' },
                    { key: 'shared' as const, label: 'משותף' },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setNewEntry(prev => prev && { ...prev, owner: opt.key })}
                      className={`flex-1 px-3 py-1.5 text-[13px] font-medium cursor-pointer border-none ${
                        newEntry.owner === opt.key
                          ? 'bg-[var(--bg-hover)] text-[var(--c-0-92)]'
                          : 'bg-transparent text-[var(--text-secondary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={upsert.isPending || !newEntry.category || Number(newEntry.amount) <= 0}
              className={`w-full bg-[var(--accent-teal)] border-none rounded-lg py-[11px] font-semibold text-sm text-[var(--c-0-10)] ${upsert.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            >
              {upsert.isPending ? '...' : 'הוסף'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
