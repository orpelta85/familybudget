'use client'

import { useUser } from '@/lib/queries/useUser'
import { useSubscriptions, useAddSubscription, useUpdateSubscription, useDeleteSubscription, useFamilySubscriptions } from '@/lib/queries/useSubscriptions'
import { useBudgetCategories } from '@/lib/queries/useExpenses'
import { formatCurrency } from '@/lib/utils'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CreditCard, Plus, X, Pencil, Check, Trash2, Inbox, Pause, Play } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'

type SubForm = { name: string; amount: string; billingDay: string; categoryId: string }

export default function SubscriptionsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { members } = useFamilyContext()
  const { viewMode } = useFamilyView()
  const isFamily = viewMode === 'family'
  const familyMemberIds = useMemo(() => members.map(m => m.user_id), [members])
  const { data: mySubs } = useSubscriptions(user?.id)
  const { data: familySubsData } = useFamilySubscriptions(familyMemberIds, isFamily)
  const subs = isFamily ? familySubsData : mySubs
  const { data: categories } = useBudgetCategories(user?.id)
  const addSub = useAddSubscription()
  const updateSub = useUpdateSubscription()
  const deleteSub = useDeleteSubscription()
  const confirm = useConfirmDialog()

  const [newSub, setNewSub] = useState<SubForm | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<SubForm>({ name: '', amount: '', billingDay: '1', categoryId: '' })

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return <TableSkeleton rows={5} />

  const activeSubs = (subs ?? []).filter(s => s.is_active)
  const inactiveSubs = (subs ?? []).filter(s => !s.is_active)
  const totalMonthly = activeSubs.reduce((s, sub) => s + sub.amount, 0)
  const totalYearly = totalMonthly * 12

  async function handleAdd() {
    if (!newSub || !user) return
    const amount = Number(newSub.amount)
    if (!newSub.name.trim() || amount <= 0) { toast.error('מלא שם וסכום'); return }
    try {
      await addSub.mutateAsync({
        user_id: user.id,
        name: newSub.name.trim(),
        amount,
        billing_day: Number(newSub.billingDay) || 1,
        category_id: newSub.categoryId ? Number(newSub.categoryId) : null,
        is_active: true,
      })
      toast.success('מנוי נוסף')
      setNewSub(null)
    } catch { toast.error('שגיאה') }
  }

  async function handleSaveEdit(id: number) {
    if (!user) return
    const amount = Number(editForm.amount)
    if (!editForm.name.trim() || amount <= 0) { setEditingId(null); return }
    try {
      await updateSub.mutateAsync({
        id, user_id: user.id,
        name: editForm.name.trim(),
        amount,
        billing_day: Number(editForm.billingDay) || 1,
        category_id: editForm.categoryId ? Number(editForm.categoryId) : null,
      })
      toast.success('מנוי עודכן')
      setEditingId(null)
    } catch { toast.error('שגיאה') }
  }

  async function handleToggleActive(id: number, isActive: boolean) {
    if (!user) return
    try {
      await updateSub.mutateAsync({ id, user_id: user.id, is_active: !isActive })
      toast.success(!isActive ? 'מנוי הופעל' : 'מנוי הושהה')
    } catch { toast.error('שגיאה בעדכון') }
  }

  async function handleDelete(id: number) {
    if (!user) return
    if (!(await confirm({ message: 'למחוק מנוי זה?' }))) return
    try {
      await deleteSub.mutateAsync({ id, user_id: user.id })
      toast.success('נמחק')
    } catch { toast.error('שגיאה במחיקה') }
  }

  function startEdit(sub: typeof activeSubs[0]) {
    setEditingId(sub.id)
    setEditForm({ name: sub.name, amount: String(sub.amount), billingDay: String(sub.billing_day), categoryId: sub.category_id ? String(sub.category_id) : '' })
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-[oklch(0.65_0.18_310)]" />
          <h1 className="text-xl font-bold tracking-tight">מנויים</h1>
          <PageInfo {...PAGE_TIPS.subscriptions} />
        </div>
        <button onClick={() => setNewSub({ name: '', amount: '', billingDay: '1', categoryId: '' })} className="btn-hover flex items-center gap-1.5 bg-[oklch(0.20_0.04_310)] border border-[oklch(0.32_0.08_310)] rounded-lg px-3.5 py-[7px] text-[oklch(0.70_0.15_310)] text-[13px] font-medium cursor-pointer">
          <Plus size={13} /> מנוי חדש
        </button>
      </div>
      <p className="text-[oklch(0.65_0.01_250)] text-[13px] mb-5">מעקב אחר חיובים חודשיים קבועים</p>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">מנויים פעילים</div>
          <div className="text-2xl font-bold text-[oklch(0.65_0.18_310)]">{activeSubs.length}</div>
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">סה"כ חודשי</div>
          <div className="text-2xl font-bold text-[oklch(0.72_0.18_55)]">{formatCurrency(totalMonthly)}</div>
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 uppercase tracking-wide">צפי שנתי</div>
          <div className="text-2xl font-bold text-[oklch(0.62_0.22_27)]">{formatCurrency(totalYearly)}</div>
        </div>
      </div>

      {/* Active subscriptions */}
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
        <div className="font-bold text-sm mb-4">מנויים פעילים</div>
        {!activeSubs.length
          ? <div className="text-xs text-[oklch(0.65_0.01_250)] text-center py-6"><Inbox size={32} className="text-[oklch(0.30_0.01_250)] mx-auto mb-2" />אין מנויים פעילים</div>
          : activeSubs.map(sub => {
            const isEditing = editingId === sub.id
            const catName = sub.category_id ? categories?.find(c => c.id === sub.category_id)?.name : null
            if (isEditing) {
              return (
                <div key={sub.id} className="py-2.5 border-b border-[oklch(0.20_0.01_250)] flex flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="flex-1 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[12px] text-inherit" />
                    <input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} className="w-20 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[12px] text-inherit ltr text-left" />
                    <input type="number" value={editForm.billingDay} onChange={e => setEditForm(p => ({ ...p, billingDay: e.target.value }))} min="1" max="31" className="w-14 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-md px-2 py-1 text-[12px] text-inherit ltr text-left" placeholder="יום" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleSaveEdit(sub.id)} className="flex items-center gap-1 bg-[oklch(0.65_0.18_310)] text-[oklch(0.10_0.01_250)] border-none rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer"><Check size={11} /> שמור</button>
                    <button onClick={() => setEditingId(null)} className="bg-transparent border border-[oklch(0.28_0.01_250)] text-[oklch(0.65_0.01_250)] rounded-md px-2 py-1 text-[11px] cursor-pointer">ביטול</button>
                  </div>
                </div>
              )
            }
            return (
              <div key={sub.id} className="flex justify-between items-center py-2.5 border-b border-[oklch(0.20_0.01_250)]">
                <div>
                  <div className="text-[13px] font-medium">{sub.name}</div>
                  <div className="text-[11px] text-[oklch(0.65_0.01_250)]">
                    יום {sub.billing_day} לחודש{catName && ` · ${catName}`}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-[oklch(0.72_0.18_55)]">{formatCurrency(sub.amount)}</span>
                  <button onClick={() => startEdit(sub)} aria-label="ערוך" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Pencil size={11} /></button>
                  <button onClick={() => handleToggleActive(sub.id, sub.is_active)} aria-label="השהה" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Pause size={11} /></button>
                  <button onClick={() => handleDelete(sub.id)} aria-label="מחק" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Trash2 size={11} /></button>
                </div>
              </div>
            )
          })
        }
      </div>

      {/* Inactive subscriptions */}
      {inactiveSubs.length > 0 && (
        <div className="bg-[oklch(0.14_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-5 opacity-70">
          <div className="font-bold text-sm mb-3 text-[oklch(0.65_0.01_250)]">מנויים מושהים ({inactiveSubs.length})</div>
          {inactiveSubs.map(sub => (
            <div key={sub.id} className="flex justify-between items-center py-2 border-b border-[oklch(0.20_0.01_250)]">
              <span className="text-[13px] text-[oklch(0.55_0.01_250)]">{sub.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-[oklch(0.55_0.01_250)]">{formatCurrency(sub.amount)}</span>
                <button onClick={() => handleToggleActive(sub.id, sub.is_active)} aria-label="הפעל" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.70_0.18_145)]"><Play size={11} /></button>
                <button onClick={() => handleDelete(sub.id)} aria-label="מחק" className="bg-transparent border-none cursor-pointer p-1.5 text-[oklch(0.45_0.01_250)]"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {newSub && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-[14px] p-7 w-[360px]">
            <div className="flex justify-between items-center mb-5">
              <span className="font-semibold text-[15px]">מנוי חדש</span>
              <button onClick={() => setNewSub(null)} aria-label="סגור" className="bg-transparent border-none text-[oklch(0.65_0.01_250)] cursor-pointer p-2"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">שם מנוי</label>
                <input type="text" value={newSub.name} onChange={e => setNewSub(p => p && { ...p, name: e.target.value })} autoFocus placeholder="למשל: נטפליקס, ספוטיפיי..." className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">סכום חודשי (₪)</label>
                  <input type="number" value={newSub.amount} onChange={e => setNewSub(p => p && { ...p, amount: e.target.value })} placeholder="0" className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
                </div>
                <div>
                  <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">יום חיוב</label>
                  <input type="number" value={newSub.billingDay} onChange={e => setNewSub(p => p && { ...p, billingDay: e.target.value })} min="1" max="31" className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-base ltr text-left" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[oklch(0.60_0.01_250)] block mb-[5px]">קטגוריה (אופציונלי)</label>
                <select value={newSub.categoryId} onChange={e => setNewSub(p => p && { ...p, categoryId: e.target.value })} className="w-full bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-[9px] text-inherit text-sm">
                  <option value="">ללא</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleAdd} disabled={addSub.isPending || !newSub.name.trim() || Number(newSub.amount) <= 0} className={`w-full bg-[oklch(0.65_0.18_310)] border-none rounded-lg py-[11px] font-semibold text-sm text-[oklch(0.10_0.01_250)] ${addSub.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}>
              {addSub.isPending ? '...' : 'הוסף מנוי'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
