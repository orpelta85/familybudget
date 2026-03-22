'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { User, Lock, Unlock, X, Pencil, Check, Inbox } from 'lucide-react'
import type { BudgetCategory, PersonalExpense } from '@/lib/types'

interface PersonalExpenseListProps {
  expenses: PersonalExpense[]
  categories: BudgetCategory[] | undefined
  totalPersonal: number
  isLocked: (id: string) => boolean
  getItemId: (categoryId: number, description: string, expenseId: number) => string
  onEdit: (data: { id: number; category_id: number; amount: number; description: string; period_id: number; user_id: string }) => Promise<void>
  onDelete: (exp: { id: number; category_id: number; amount: number; description?: string }) => void
  onToggleLock: (exp: { id: number; category_id: number; amount: number; description?: string }) => void
}

export function PersonalExpenseList({
  expenses, categories, totalPersonal,
  isLocked, getItemId, onEdit, onDelete, onToggleLock,
}: PersonalExpenseListProps) {
  const [editingPersonal, setEditingPersonal] = useState<{ id: number; categoryId: string; amount: string; description: string } | null>(null)

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
          <User size={12} className="text-primary" /> <h2 className="text-[13px] font-semibold m-0 inline">הוצאות אישיות</h2>
        </div>
        <span className="text-sm font-bold text-primary">{formatCurrency(totalPersonal)}</span>
      </div>
      {!expenses.length
        ? <div className="text-xs text-muted-foreground text-center py-6"><Inbox size={32} className="text-[var(--c-0-30)] mx-auto mb-2" />אין הוצאות אישיות</div>
        : expenses.map(e => {
          const itemId = getItemId(e.category_id, e.description ?? '', e.id)
          const locked = isLocked(itemId)
          const catName = (e.budget_categories as BudgetCategory)?.name ?? 'כללי'
          const isEditing = editingPersonal?.id === e.id

          if (isEditing) {
            return (
              <div key={e.id} className="py-2 border-b border-[var(--c-0-20)] flex flex-col gap-1.5">
                <input type="text" value={editingPersonal.description} onChange={ev => setEditingPersonal(prev => prev && { ...prev, description: ev.target.value })} placeholder="תיאור" className="w-full bg-secondary border border-[var(--border-light)] rounded-md px-2 py-1 text-[12px] text-inherit" />
                <div className="flex gap-1.5">
                  <select value={editingPersonal.categoryId} onChange={ev => setEditingPersonal(prev => prev && { ...prev, categoryId: ev.target.value })} className="flex-1 bg-secondary border border-[var(--border-light)] rounded-md px-2 py-1 text-[12px] text-inherit">
                    {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="number" value={editingPersonal.amount} onChange={ev => setEditingPersonal(prev => prev && { ...prev, amount: ev.target.value })} className="w-20 bg-secondary border border-[var(--border-light)] rounded-md px-2 py-1 text-[12px] text-inherit text-left" style={{ direction: 'ltr' }} />
                </div>
                <div className="flex gap-1">
                  <button onClick={async () => {
                    if (!editingPersonal) return
                    await onEdit({
                      id: editingPersonal.id,
                      category_id: Number(editingPersonal.categoryId),
                      amount: Number(editingPersonal.amount),
                      description: editingPersonal.description,
                      period_id: 0, // will be overridden by parent
                      user_id: '', // will be overridden by parent
                    })
                    setEditingPersonal(null)
                  }} className="flex items-center gap-1 bg-primary text-primary-foreground border-none rounded-md px-2 py-1 text-[11px] font-semibold cursor-pointer"><Check size={11} /> שמור</button>
                  <button onClick={() => setEditingPersonal(null)} className="bg-transparent border border-[var(--border-light)] text-muted-foreground rounded-md px-2 py-1 text-[11px] cursor-pointer">ביטול</button>
                </div>
              </div>
            )
          }

          return (
            <div key={e.id} className="flex justify-between items-center py-2.5 border-b border-[var(--c-0-20)] last:border-b-0">
              <div>
                <div className="text-[13px] font-medium text-[var(--c-0-82)]">{e.description || catName}</div>
                {e.description && <div className="text-[10px] text-muted-foreground">{catName}</div>}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold">{formatCurrency(e.amount)}</span>
                <button onClick={() => setEditingPersonal({ id: e.id, categoryId: String(e.category_id), amount: String(e.amount), description: e.description ?? '' })}
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
                <button onClick={() => onDelete(e)} aria-label="מחק הוצאה" className="bg-transparent border-none cursor-pointer flex items-center justify-center p-1 min-w-6 min-h-6 text-muted-foreground">
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
