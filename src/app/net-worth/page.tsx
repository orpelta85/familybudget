'use client'

import { useUser } from '@/lib/queries/useUser'
import { useNetWorthEntries, useUpsertNetWorthEntry, useDeleteNetWorthEntry } from '@/lib/queries/useNetWorth'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TrendingUp, Plus, X, Pencil, Check, Trash2, Inbox } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'

const ASSET_CATEGORIES = [
  { value: 'pension', label: 'פנסיה' },
  { value: 'keren_hishtalmut', label: 'קרן השתלמות' },
  { value: 'gemel', label: 'גמל' },
  { value: 'investments', label: 'השקעות' },
  { value: 'apartment_savings', label: 'חיסכון דירה' },
  { value: 'cash', label: 'מזומן / עו"ש' },
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

type EntryForm = { category: string; type: 'asset' | 'liability'; amount: string }

export default function NetWorthPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: entries } = useNetWorthEntries(user?.id)
  const upsert = useUpsertNetWorthEntry()
  const deleteEntry = useDeleteNetWorthEntry()
  const confirm = useConfirmDialog()

  const [newEntry, setNewEntry] = useState<EntryForm | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editAmount, setEditAmount] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return <TableSkeleton rows={5} />

  const assets = (entries ?? []).filter(e => e.type === 'asset')
  const liabilities = (entries ?? []).filter(e => e.type === 'liability')
  const totalAssets = assets.reduce((s, e) => s + e.amount, 0)
  const totalLiabilities = liabilities.reduce((s, e) => s + e.amount, 0)
  const netWorth = totalAssets - totalLiabilities

  async function handleAdd() {
    if (!newEntry || !user) return
    const amount = Number(newEntry.amount)
    if (!newEntry.category || amount <= 0) { toast.error('מלא קטגוריה וסכום'); return }
    try {
      await upsert.mutateAsync({ user_id: user.id, category: newEntry.category, type: newEntry.type, amount })
      toast.success('נוסף')
      setNewEntry(null)
    } catch { toast.error('שגיאה') }
  }

  async function handleSaveEdit(entry: { id: number; category: string; type: 'asset' | 'liability' }) {
    if (!user) return
    const amount = Number(editAmount)
    if (amount <= 0) { setEditingId(null); return }
    try {
      await upsert.mutateAsync({ id: entry.id, user_id: user.id, category: entry.category, type: entry.type, amount })
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

  const allCategories = newEntry?.type === 'liability' ? LIABILITY_CATEGORIES : ASSET_CATEGORIES

  function getLabelForCategory(cat: string, type: string) {
    const list = type === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES
    return list.find(c => c.value === cat)?.label ?? cat
  }

  function renderSection(title: string, items: typeof assets, type: 'asset' | 'liability', total: number, accentColor: string) {
    return (
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-[oklch(0.22_0.01_250)]">
          <span className="font-bold text-sm">{title}</span>
          <span className={`text-lg font-bold ltr ${accentColor}`}>{formatCurrency(total)}</span>
        </div>
        {!items.length
          ? <div className="text-xs text-[oklch(0.65_0.01_250)] text-center py-4"><Inbox size={28} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />אין רשומות</div>
          : items.map(entry => {
            const isEditing = editingId === entry.id
            return (
              <div key={entry.id} className="flex justify-between items-center py-2.5 border-b border-[oklch(0.20_0.01_250)]">
                <span className="text-[13px] font-medium">{getLabelForCategory(entry.category, entry.type)}</span>
                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(entry); if (e.key === 'Escape') setEditingId(null) }} className="w-28 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-inherit text-[13px] ltr text-right" />
                      <button onClick={() => handleSaveEdit(entry)} className="bg-transparent border-none cursor-pointer p-1 text-[oklch(0.70_0.18_145)]"><Check size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="bg-transparent border-none cursor-pointer p-1 text-[oklch(0.65_0.01_250)]"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span className={`text-[13px] font-semibold ltr ${accentColor}`}>{formatCurrency(entry.amount)}</span>
                      <button onClick={() => { setEditingId(entry.id); setEditAmount(String(entry.amount)) }} aria-label="ערוך" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Pencil size={11} /></button>
                      <button onClick={() => handleDelete(entry.id)} aria-label="מחק" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Trash2 size={11} /></button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        }
        <button onClick={() => setNewEntry({ category: '', type, amount: '' })} className="flex items-center gap-1 mt-3 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-lg px-3 py-1.5 text-[oklch(0.65_0.01_250)] text-xs cursor-pointer">
          <Plus size={12} /> הוסף {type === 'asset' ? 'נכס' : 'התחייבות'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <TrendingUp size={18} className="text-[oklch(0.70_0.18_145)]" />
        <h1 className="text-xl font-bold tracking-tight">שווי נקי</h1>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">מעקב אחר נכסים והתחייבויות</p>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">נכסים</div>
          <div className="text-2xl font-bold text-[oklch(0.70_0.18_145)] ltr">{formatCurrency(totalAssets)}</div>
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">התחייבויות</div>
          <div className="text-2xl font-bold text-[oklch(0.62_0.22_27)] ltr">{formatCurrency(totalLiabilities)}</div>
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">שווי נקי</div>
          <div className={`text-2xl font-bold ltr ${netWorth >= 0 ? 'text-[oklch(0.70_0.18_145)]' : 'text-[oklch(0.62_0.22_27)]'}`}>{formatCurrency(netWorth)}</div>
        </div>
      </div>

      {/* Asset / Liability sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderSection('נכסים', assets, 'asset', totalAssets, 'text-[oklch(0.70_0.18_145)]')}
        {renderSection('התחייבויות', liabilities, 'liability', totalLiabilities, 'text-[oklch(0.62_0.22_27)]')}
      </div>

      {/* Add Modal */}
      {newEntry && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-[14px] p-7 w-[360px]">
            <div className="flex justify-between items-center mb-5">
              <span className="font-semibold text-[15px]">הוסף {newEntry.type === 'asset' ? 'נכס' : 'התחייבות'}</span>
              <button onClick={() => setNewEntry(null)} aria-label="סגור" className="bg-transparent border-none text-[oklch(0.65_0.01_250)] cursor-pointer p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">קטגוריה</label>
                <select value={newEntry.category} onChange={e => setNewEntry(prev => prev && { ...prev, category: e.target.value })} className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm">
                  <option value="">בחר...</option>
                  {allCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סכום (₪)</label>
                <input type="number" value={newEntry.amount} onChange={e => setNewEntry(prev => prev && { ...prev, amount: e.target.value })} placeholder="0" autoFocus className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-right" />
              </div>
            </div>
            <button onClick={handleAdd} disabled={upsert.isPending || !newEntry.category || Number(newEntry.amount) <= 0} className={`w-full bg-[oklch(0.70_0.15_185)] border-none rounded-lg py-[11px] font-semibold text-sm text-[oklch(0.10_0.01_250)] ${upsert.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}>
              {upsert.isPending ? '...' : 'הוסף'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
