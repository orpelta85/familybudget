'use client'

import { useUser } from '@/lib/queries/useUser'
import {
  useNetWorthEntries, useNetWorthSnapshots, useUpsertNetWorthEntry,
  useDeleteNetWorthEntry, useSyncFromExistingData, useSaveSnapshot,
  type NetWorthEntry, type LiquidityType,
} from '@/lib/queries/useNetWorth'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  TrendingUp, Plus, X, Check, Trash2, Inbox, RefreshCw,
  Droplets, Clock, Lock, Building2, Pencil,
} from 'lucide-react'
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

const LIQUIDITY_GROUPS: { key: LiquidityType; label: string; icon: typeof Droplets; color: string }[] = [
  { key: 'liquid', label: 'נזיל', icon: Droplets, color: 'oklch(0.70 0.18 145)' },
  { key: 'semi_liquid', label: 'חצי-נזיל', icon: Clock, color: 'oklch(0.65 0.18 250)' },
  { key: 'locked', label: 'נעול', icon: Lock, color: 'oklch(0.65 0.18 40)' },
  { key: 'property', label: 'נדל"ן', icon: Building2, color: 'oklch(0.65 0.18 300)' },
]

type EntryForm = {
  category: string
  type: 'asset' | 'liability'
  amount: string
  name: string
  owner: 'personal' | 'shared'
}

export default function NetWorthPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { data: entries } = useNetWorthEntries(user?.id)
  const { data: snapshots } = useNetWorthSnapshots(user?.id)
  const upsert = useUpsertNetWorthEntry()
  const deleteEntry = useDeleteNetWorthEntry()
  const syncMutation = useSyncFromExistingData()
  const saveSnapshot = useSaveSnapshot()
  const confirm = useConfirmDialog()

  const [viewMode, setViewMode] = useState<'personal' | 'family'>('personal')
  const [newEntry, setNewEntry] = useState<EntryForm | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editAmount, setEditAmount] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Filter entries by view mode
  const filteredEntries = useMemo(() => {
    if (!entries) return []
    if (viewMode === 'family') return entries
    return entries.filter(e => e.owner === 'personal')
  }, [entries, viewMode])

  const assets = useMemo(() => filteredEntries.filter(e => e.type === 'asset'), [filteredEntries])
  const liabilities = useMemo(() => filteredEntries.filter(e => e.type === 'liability'), [filteredEntries])
  const totalAssets = assets.reduce((s, e) => s + e.amount, 0)
  const totalLiabilities = liabilities.reduce((s, e) => s + e.amount, 0)
  const netWorth = totalAssets - totalLiabilities
  const liquidTotal = assets.filter(e => e.liquidity === 'liquid').reduce((s, e) => s + e.amount, 0)

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

  if (loading || !user) return <TableSkeleton rows={5} />

  function getLabelForCategory(cat: string, type: string) {
    const list = type === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES
    return list.find(c => c.value === cat)?.label ?? cat
  }

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
      })
      toast.success('נוסף')
      setNewEntry(null)
    } catch { toast.error('שגיאה') }
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
    } catch { toast.error('שגיאה') }
  }

  async function handleDelete(id: number) {
    if (!user) return
    if (!(await confirm({ message: 'למחוק רשומה זו?' }))) return
    await deleteEntry.mutateAsync({ id, user_id: user.id })
    toast.success('נמחק')
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
    } catch { toast.error('שגיאה בסנכרון') }
  }

  const allCategories = newEntry?.type === 'liability' ? LIABILITY_CATEGORIES : ASSET_CATEGORIES

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp size={18} className="text-[oklch(0.70_0.18_145)]" />
            <h1 className="text-xl font-bold tracking-tight">שווי נקי</h1>
          </div>
          <p className="text-[oklch(0.65_0.01_250)] text-[13px]">מעקב אחר נכסים והתחייבויות</p>
        </div>

        <div className="flex gap-2 items-center">
          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className={`flex items-center gap-1.5 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-[oklch(0.70_0.18_145)] text-xs font-medium ${syncMutation.isPending ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
          >
            <RefreshCw size={13} className={syncMutation.isPending ? 'animate-spin' : ''} />
            סנכרן מנתונים קיימים
          </button>

          {/* Personal/Family toggle */}
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
                      ? 'bg-[oklch(0.22_0.01_250)] text-[oklch(0.92_0.01_250)] shadow-[inset_0_0_0_1px_oklch(0.65_0.18_250)]'
                      : 'bg-transparent text-[oklch(0.65_0.01_250)]'
                  } ${opt.key === 'personal' ? 'border-l border-l-[oklch(0.25_0.01_250)]' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'סה"כ נכסים', value: formatCurrency(totalAssets), color: 'oklch(0.70 0.18 145)' },
          { label: 'סה"כ התחייבויות', value: formatCurrency(totalLiabilities), color: 'oklch(0.62 0.22 27)' },
          { label: 'שווי נקי', value: formatCurrency(netWorth), color: netWorth >= 0 ? 'oklch(0.70 0.18 145)' : 'oklch(0.62 0.22 27)' },
          { label: 'נזילות', value: formatCurrency(liquidTotal), color: 'oklch(0.65 0.18 250)' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
            <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 tracking-wide">{kpi.label}</div>
            <div className="text-2xl font-bold ltr" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Assets grouped by liquidity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {LIQUIDITY_GROUPS.map(group => {
          const items = assetsByLiquidity[group.key]
          const groupTotal = items.reduce((s, e) => s + e.amount, 0)
          const Icon = group.icon
          return (
            <div key={group.key} className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-[oklch(0.22_0.01_250)]">
                <div className="flex items-center gap-2">
                  <Icon size={15} style={{ color: group.color }} />
                  <span className="font-bold text-sm">{group.label}</span>
                </div>
                <span className="text-lg font-bold ltr" style={{ color: group.color }}>{formatCurrency(groupTotal)}</span>
              </div>
              {!items.length ? (
                <div className="text-xs text-[oklch(0.65_0.01_250)] text-center py-4">
                  <Inbox size={24} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />
                  אין רשומות
                </div>
              ) : (
                items.map(entry => {
                  const isEditing = editingId === entry.id
                  const isAuto = entry.source !== 'manual'
                  return (
                    <div key={entry.id} className="flex justify-between items-center py-2.5 border-b border-[oklch(0.20_0.01_250)] last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">
                          {entry.name || getLabelForCategory(entry.category, entry.type)}
                        </span>
                        {isAuto && (
                          <span className="text-[10px] bg-[oklch(0.25_0.02_250)] text-[oklch(0.70_0.18_250)] px-1.5 py-0.5 rounded-md font-medium">
                            אוטומטי
                          </span>
                        )}
                        {entry.owner === 'shared' && viewMode === 'family' && (
                          <span className="text-[10px] bg-[oklch(0.25_0.02_180)] text-[oklch(0.70_0.15_180)] px-1.5 py-0.5 rounded-md font-medium">
                            משותף
                          </span>
                        )}
                        {entry.tax_note && (
                          <span className="text-[10px] text-[oklch(0.55_0.01_250)]" title={entry.tax_note}>
                            💡
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
                              className="w-28 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-inherit text-[13px] ltr text-left"
                            />
                            <button onClick={() => handleSaveEdit(entry)} className="bg-transparent border-none cursor-pointer p-1 text-[oklch(0.70_0.18_145)]"><Check size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="bg-transparent border-none cursor-pointer p-1 text-[oklch(0.65_0.01_250)]"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <span className="text-[13px] font-semibold ltr" style={{ color: group.color }}>{formatCurrency(entry.amount)}</span>
                            {!isAuto && (
                              <>
                                <button onClick={() => { setEditingId(entry.id); setEditAmount(String(entry.amount)) }} aria-label="ערוך" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Pencil size={11} /></button>
                                <button onClick={() => handleDelete(entry.id)} aria-label="מחק" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Trash2 size={11} /></button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <button
                onClick={() => setNewEntry({ category: '', type: 'asset', amount: '', name: '', owner: viewMode === 'family' ? 'shared' : 'personal' })}
                className="flex items-center gap-1 mt-3 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-3 py-1.5 text-[oklch(0.65_0.01_250)] text-xs cursor-pointer"
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
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-[oklch(0.22_0.01_250)]">
            <span className="font-bold text-sm">התחייבויות</span>
            <span className="text-lg font-bold ltr text-[oklch(0.62_0.22_27)]">{formatCurrency(totalLiabilities)}</span>
          </div>
          {!liabilities.length ? (
            <div className="text-xs text-[oklch(0.65_0.01_250)] text-center py-4">
              <Inbox size={24} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />
              אין התחייבויות
            </div>
          ) : (
            liabilities.map(entry => {
              const isEditing = editingId === entry.id
              return (
                <div key={entry.id} className="flex justify-between items-center py-2.5 border-b border-[oklch(0.20_0.01_250)] last:border-b-0">
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
                          className="w-28 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-inherit text-[13px] ltr text-left"
                        />
                        <button onClick={() => handleSaveEdit(entry)} className="bg-transparent border-none cursor-pointer p-1 text-[oklch(0.70_0.18_145)]"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="bg-transparent border-none cursor-pointer p-1 text-[oklch(0.65_0.01_250)]"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span className="text-[13px] font-semibold ltr text-[oklch(0.62_0.22_27)]">{formatCurrency(entry.amount)}</span>
                        <button onClick={() => { setEditingId(entry.id); setEditAmount(String(entry.amount)) }} aria-label="ערוך" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Pencil size={11} /></button>
                        <button onClick={() => handleDelete(entry.id)} aria-label="מחק" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Trash2 size={11} /></button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <button
            onClick={() => setNewEntry({ category: '', type: 'liability', amount: '', name: '', owner: 'personal' })}
            className="flex items-center gap-1 mt-3 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-3 py-1.5 text-[oklch(0.65_0.01_250)] text-xs cursor-pointer"
          >
            <Plus size={12} /> הוסף התחייבות
          </button>
        </div>

        {/* Liquidity donut */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <h2 className="font-bold text-sm mb-4">חלוקה לפי נזילות</h2>
          <LiquidityDonut data={donutData} />
        </div>
      </div>

      {/* Trend chart */}
      {(snapshots?.length ?? 0) > 0 && (
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
          <h2 className="font-bold text-sm mb-4">מגמת שווי נקי</h2>
          <TrendChart snapshots={snapshots ?? []} />
        </div>
      )}

      {/* Add Modal */}
      {newEntry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-[14px] p-7 w-[380px]">
            <div className="flex justify-between items-center mb-5">
              <span className="font-semibold text-[15px]">הוסף {newEntry.type === 'asset' ? 'נכס' : 'התחייבות'}</span>
              <button onClick={() => setNewEntry(null)} aria-label="סגור" className="bg-transparent border-none text-[oklch(0.65_0.01_250)] cursor-pointer p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">שם (אופציונלי)</label>
                <input
                  type="text"
                  value={newEntry.name}
                  onChange={e => setNewEntry(prev => prev && { ...prev, name: e.target.value })}
                  placeholder='לדוגמה: "חשבון בנק לאומי"'
                  className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">קטגוריה</label>
                <select
                  value={newEntry.category}
                  onChange={e => setNewEntry(prev => prev && { ...prev, category: e.target.value })}
                  className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm"
                >
                  <option value="">בחר...</option>
                  {allCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סכום (₪)</label>
                <input
                  type="number"
                  value={newEntry.amount}
                  onChange={e => setNewEntry(prev => prev && { ...prev, amount: e.target.value })}
                  placeholder="0"
                  autoFocus
                  className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left"
                />
              </div>
              {/* Owner toggle */}
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">בעלות</label>
                <div className="flex border border-[oklch(0.25_0.01_250)] rounded-lg overflow-hidden">
                  {([
                    { key: 'personal' as const, label: 'אישי' },
                    { key: 'shared' as const, label: 'משותף' },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setNewEntry(prev => prev && { ...prev, owner: opt.key })}
                      className={`flex-1 px-3 py-1.5 text-[13px] font-medium cursor-pointer border-none ${
                        newEntry.owner === opt.key
                          ? 'bg-[oklch(0.22_0.01_250)] text-[oklch(0.92_0.01_250)]'
                          : 'bg-transparent text-[oklch(0.65_0.01_250)]'
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
              className={`w-full bg-[oklch(0.70_0.15_185)] border-none rounded-lg py-[11px] font-semibold text-sm text-[oklch(0.10_0.01_250)] ${upsert.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            >
              {upsert.isPending ? '...' : 'הוסף'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
