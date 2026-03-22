'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Users, Lock, Unlock, X, Pencil, Check, Inbox } from 'lucide-react'
import type { SharedExpense } from '@/lib/types'

const SHARED_CATEGORIES: { value: string; label: string }[] = [
  { value: 'rent', label: 'שכירות' },
  { value: 'household', label: 'חשבונות בית' },
  { value: 'insurance', label: 'ביטוחים' },
  { value: 'loans', label: 'הלוואות' },
  { value: 'subscriptions', label: 'מנויים' },
  { value: 'groceries', label: 'מכולת' },
  { value: 'eating_out', label: 'אוכל בחוץ' },
  { value: 'transport', label: 'תחבורה' },
  { value: 'health', label: 'בריאות ורפואה' },
  { value: 'clothing', label: 'בגדים וקניות' },
  { value: 'leisure', label: 'בילויים ופנאי' },
  { value: 'kids', label: 'ילדים' },
  { value: 'pets', label: 'חיות מחמד' },
  { value: 'savings', label: 'חיסכון והשקעות' },
  { value: 'misc', label: 'שונות' },
]

// Complete Hebrew label lookup
const SHARED_CAT_LABEL_MAP: Record<string, string> = {
  rent: 'שכירות',
  household: 'חשבונות בית',
  insurance: 'ביטוחים',
  loans: 'הלוואות',
  subscriptions: 'מנויים',
  groceries: 'מכולת',
  eating_out: 'אוכל בחוץ',
  transport: 'תחבורה',
  health: 'בריאות ורפואה',
  clothing: 'בגדים וקניות',
  leisure: 'בילויים ופנאי',
  kids: 'ילדים',
  pets: 'חיות מחמד',
  savings: 'חיסכון והשקעות',
  misc: 'שונות',
  travel: 'טיולים',
  car_loan: 'הלוואת רכב',
  property_tax: 'ארנונה',
  electricity: 'חשמל',
  water_gas: 'מים+גז',
  building_committee: 'ועד בית',
  entertainment: 'בילויים ופנאי',
  shopping: 'בגדים וקניות',
  home_insurance: 'ביטוח דירה',
  internet: 'אינטרנט',
  netflix: 'נטפליקס',
  spotify: 'ספוטיפיי',
}

export function sharedCatLabel(category: string): string {
  return SHARED_CAT_LABEL_MAP[category] ?? category
}

interface SharedExpenseListProps {
  expenses: SharedExpense[]
  splitFrac: number
  totalSharedMy: number
  isLocked: (category: string) => boolean
  onEdit: (data: { id: number; category: string; total_amount: number; notes: string; period_id: number }) => Promise<void>
  onDelete: (id: number) => void
  onToggleLock: (exp: { id: number; category: string; total_amount: number; notes?: string | null }) => void
}

export function SharedExpenseList({
  expenses, splitFrac, totalSharedMy,
  isLocked, onEdit, onDelete, onToggleLock,
}: SharedExpenseListProps) {
  const [editingShared, setEditingShared] = useState<{ id: number; category: string; totalAmount: string; notes: string } | null>(null)
  const splitPctLabel = Math.round(splitFrac * 100)

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Users size={12} className="text-[var(--accent-shared)]" /> <h2 className="text-[13px] font-semibold m-0 inline">הוצאות משותפות</h2>
        </div>
        <span className="text-sm font-bold text-[var(--accent-shared)]">{formatCurrency(totalSharedMy)}</span>
      </div>
      <div className="text-[11px] text-muted-foreground mb-2.5">
        הסכום שמוצג הוא חלקך ({splitPctLabel}%) — ניתן לנעול הוצאות קבועות
      </div>
      {!expenses.length
        ? <div className="text-xs text-muted-foreground text-center py-6"><Inbox size={32} className="text-[var(--c-0-30)] mx-auto mb-2" />אין הוצאות משותפות</div>
        : expenses.map(e => {
          const myAmt = e.my_share ?? e.total_amount * splitFrac
          const locked = isLocked(e.category)
          const label = e.notes || sharedCatLabel(e.category)
          const catLabel = sharedCatLabel(e.category)
          const isEditing = editingShared?.id === e.id

          if (isEditing) {
            return (
              <div key={e.id} className="py-2 border-b border-[var(--c-0-20)] flex flex-col gap-1.5">
                <input type="text" value={editingShared.notes} onChange={ev => setEditingShared(prev => prev && { ...prev, notes: ev.target.value })} placeholder="תיאור" className="w-full bg-secondary border border-[var(--border-light)] rounded-md px-2 py-1 text-[12px] text-inherit" />
                <div className="flex gap-1.5">
                  <select value={editingShared.category} onChange={ev => setEditingShared(prev => prev && { ...prev, category: ev.target.value })} className="flex-1 bg-secondary border border-[var(--border-light)] rounded-md px-2 py-1 text-[12px] text-inherit">
                    {SHARED_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <input type="number" value={editingShared.totalAmount} onChange={ev => setEditingShared(prev => prev && { ...prev, totalAmount: ev.target.value })} className="w-20 bg-secondary border border-[var(--border-light)] rounded-md px-2 py-1 text-[12px] text-inherit text-left" style={{ direction: 'ltr' }} placeholder="סכום כולל" />
                </div>
                <div className="flex gap-1">
                  <button onClick={async () => {
                    if (!editingShared) return
                    await onEdit({
                      id: editingShared.id,
                      category: editingShared.category,
                      total_amount: Number(editingShared.totalAmount),
                      notes: editingShared.notes,
                      period_id: 0, // will be overridden by parent
                    })
                    setEditingShared(null)
                  }} className="flex items-center gap-1 bg-[var(--c-purple-0-55)] text-primary-foreground border-none rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer"><Check size={11} /> שמור</button>
                  <button onClick={() => setEditingShared(null)} className="bg-transparent border border-[var(--border-light)] text-muted-foreground rounded-md px-2 py-1 text-[11px] cursor-pointer">ביטול</button>
                </div>
              </div>
            )
          }

          return (
            <div key={e.id} className="flex justify-between items-center py-2.5 border-b border-[var(--c-0-20)] last:border-b-0">
              <div>
                <div className="text-[13px] font-medium text-[var(--c-0-82)]">{label}</div>
                {label !== catLabel && <div className="text-[10px] text-muted-foreground">{catLabel}</div>}
                <div className="text-[10px] text-muted-foreground">
                  סה&quot;כ {formatCurrency(e.total_amount)} · חלקי {formatCurrency(myAmt)}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[var(--accent-shared)]">{formatCurrency(myAmt)}</span>
                <button onClick={() => setEditingShared({ id: e.id, category: e.category, totalAmount: String(e.total_amount), notes: e.notes ?? '' })}
                  aria-label="ערוך הוצאה"
                  className="bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 text-[var(--c-0-45)] hover:text-[var(--c-0-70)]">
                  <Pencil size={10} />
                </button>
                <button onClick={() => onToggleLock(e)}
                  title={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                  aria-label={locked ? 'בטל נעילה' : 'נעל לחודשים הבאים'}
                  className={`bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 ${locked ? 'text-[var(--accent-teal)]' : 'text-[var(--c-0-35)]'}`}>
                  {locked ? <Lock size={11} /> : <Unlock size={11} />}
                </button>
                <button onClick={() => onDelete(e.id)} aria-label="מחק הוצאה" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 text-muted-foreground">
                  <X size={12} />
                </button>
              </div>
            </div>
          )
        })
      }
    </div>
  )
}
