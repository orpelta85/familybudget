'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Plus, User, Users, Target, Lock } from 'lucide-react'
import type { BudgetCategory, SinkingFund } from '@/lib/types'

export type ExpType = 'personal' | 'shared'

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

export { SHARED_CATEGORIES }

interface ExpenseFormProps {
  categories: BudgetCategory[] | undefined
  funds: SinkingFund[] | undefined
  splitFrac: number
  isPending: boolean
  onAdd: (data: {
    expType: ExpType
    categoryId: string
    customCat: string
    useCustomCat: boolean
    sharedLabel: string
    sharedCategory: string
    amount: string
    detailMode: boolean
    description: string
  }) => void
}

export function ExpenseForm({ categories, funds, splitFrac, isPending, onAdd }: ExpenseFormProps) {
  const [expType, setExpType] = useState<ExpType>('personal')
  const [categoryId, setCategoryId] = useState('')
  const [customCat, setCustomCat] = useState('')
  const [useCustomCat, setUseCustom] = useState(false)
  const [sharedLabel, setSharedLabel] = useState('')
  const [sharedCategory, setSharedCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [detailMode, setDetailMode] = useState(true)
  const [description, setDescription] = useState('')

  const splitPctLabel = Math.round(splitFrac * 100)
  const totalSinking = (funds ?? []).reduce((s, f) => s + f.monthly_allocation, 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onAdd({ expType, categoryId, customCat, useCustomCat, sharedLabel, sharedCategory, amount, detailMode, description })
    setAmount(''); setSharedLabel(''); setCustomCat(''); setCategoryId(''); setSharedCategory(''); setDescription('')
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3.5">
        <Plus size={13} className="text-primary" />
        <h2 className="font-semibold text-[13px] m-0">הוספה ידנית</h2>
      </div>

      {/* Type toggle */}
      <div className="flex gap-1.5 mb-3 bg-secondary rounded-[9px] p-[3px]">
        {(['personal', 'shared'] as ExpType[]).map(t => (
          <button key={t} onClick={() => setExpType(t)} className={`flex-1 flex items-center justify-center gap-1 border-none rounded-[7px] py-1.5 text-xs cursor-pointer ${
            expType === t
              ? (t === 'personal'
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'bg-[var(--c-purple-0-55)] text-primary-foreground font-semibold')
              : 'bg-transparent text-muted-foreground font-normal'
          }`}>
            {t === 'personal' ? <><User size={11} /> אישית</> : <><Users size={11} /> משותפת</>}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {/* Detail mode toggle */}
        <div className="flex gap-1.5 bg-secondary rounded-[9px] p-[3px]">
          <button type="button" onClick={() => setDetailMode(true)} className={`flex-1 border-none rounded-[7px] py-1 text-[11px] cursor-pointer ${
            detailMode ? 'bg-[var(--c-blue-0-25)] text-[var(--c-0-85)] font-semibold' : 'bg-transparent text-muted-foreground font-normal'
          }`}>פירוט</button>
          <button type="button" onClick={() => setDetailMode(false)} className={`flex-1 border-none rounded-[7px] py-1 text-[11px] cursor-pointer ${
            !detailMode ? 'bg-[var(--c-blue-0-25)] text-[var(--c-0-85)] font-semibold' : 'bg-transparent text-muted-foreground font-normal'
          }`}>סה&quot;כ בלבד</button>
        </div>

        {/* Category */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="expense-category" className="text-[11px] text-muted-foreground block font-medium">קטגוריה</label>
            <button type="button" onClick={() => setUseCustom(v => !v)}
              className="bg-transparent border-none text-[10px] text-[var(--c-blue-0-55)] cursor-pointer p-0">
              {useCustomCat ? '← מרשימה' : '+ ידנית'}
            </button>
          </div>
          {useCustomCat ? (
            <input id="expense-category" type="text" value={expType === 'shared' ? sharedLabel : customCat}
              onChange={e => expType === 'shared' ? setSharedLabel(e.target.value) : setCustomCat(e.target.value)}
              placeholder="שם קטגוריה חופשי..."
              className="w-full bg-secondary border border-[var(--border-light)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none" />
          ) : expType === 'shared' ? (
            <select id="expense-category" value={sharedCategory} onChange={e => { setSharedCategory(e.target.value); setSharedLabel(SHARED_CATEGORIES.find(c => c.value === e.target.value)?.label ?? '') }}
              className="w-full bg-secondary border border-[var(--border-light)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none">
              <option value="">בחר...</option>
              {SHARED_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          ) : (
            <select id="expense-category" value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full bg-secondary border border-[var(--border-light)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none">
              <option value="">בחר...</option>
              {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {/* Description — only in detail mode */}
        {detailMode && (
          <div>
            <label htmlFor="expense-desc" className="text-[11px] text-muted-foreground block mb-1 font-medium">תיאור</label>
            <input id="expense-desc" type="text" value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={expType === 'shared' ? 'תיאור ההוצאה...' : 'לדוגמה: טיב טעם, WOLT...'}
              className="w-full bg-secondary border border-[var(--border-light)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none" />
          </div>
        )}

        {/* Amount */}
        <div>
          <label htmlFor="expense-amount" className="text-[11px] text-muted-foreground block mb-1 font-medium">סכום (₪){expType === 'shared' ? ` — כולל (חלקך ${splitPctLabel}%)` : ''}</label>
          <div className="relative">
            <input id="expense-amount" type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0" required min="0.01" step="0.01"
              className="w-full bg-secondary border border-[var(--border-light)] rounded-lg pl-8 pr-3 py-2 text-inherit text-[13px] outline-none text-right" style={{ direction: 'ltr' }} />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[12px]">₪</span>
          </div>
          {expType === 'shared' && Number(amount) > 0 && (
            <div className="mt-1 text-[11px] text-[var(--accent-shared)]">
              חלקך: {formatCurrency(Number(amount) * splitFrac)}
            </div>
          )}
        </div>

        <button type="submit" disabled={isPending} className={`btn-hover border-none rounded-lg py-2.5 font-semibold text-[13px] cursor-pointer text-primary-foreground ${
          expType === 'personal' ? 'bg-primary' : 'bg-[var(--c-purple-0-55)]'
        }`}>
          {isPending ? '...' : '+ הוסף'}
        </button>
      </form>

      {/* Sinking fund rows */}
      {(funds ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mt-3">
          <div className="flex items-center gap-1.5 mb-2.5 text-xs text-[var(--accent-teal)] font-semibold">
            <Target size={12} /> קרנות שנתיות — הפרשה חודשית
            <span className="font-normal text-muted-foreground mr-1">(נעולות — לשינוי עבור לעמוד הקרנות)</span>
          </div>
          {(funds ?? []).map(fund => (
            <div key={fund.id} className="flex justify-between items-center py-2.5 border-b border-[var(--c-0-20)] opacity-85">
              <div className="flex items-center gap-2">
                <Lock size={11} className="text-[var(--accent-teal)] shrink-0" />
                <span className="text-[13px] text-[var(--text-heading)]">{fund.name}</span>
              </div>
              <span className="text-[13px] font-semibold text-[var(--accent-teal)]">
                {formatCurrency(fund.monthly_allocation)}
              </span>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-1 text-xs text-[var(--c-0-60)]">
            <span>סה&quot;כ קרנות חודשי</span>
            <span className="font-semibold text-[var(--accent-teal)]">{formatCurrency(totalSinking)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
