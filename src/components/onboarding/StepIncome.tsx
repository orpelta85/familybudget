'use client'

import { useState } from 'react'
import { Wallet, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import type { OnboardingData } from '@/app/onboarding/page'

interface Props {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
  userId: string
  periodId: number | undefined
}

export function StepIncome({ data, updateData, onNext, onSkip, onBack, userId, periodId }: Props) {
  const [saving, setSaving] = useState(false)
  const [salary, setSalary] = useState(data.salary || 0)
  const [bonus, setBonus] = useState(data.bonus || 0)
  const [other, setOther] = useState(data.otherIncome || 0)

  const total = Number(salary) + Number(bonus) + Number(other)

  async function handleContinue() {
    if (!salary && !bonus && !other) {
      toast.error('נא להזין לפחות שדה אחד')
      return
    }
    if (!periodId) {
      toast.error('לא נמצאה תקופה נוכחית')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_income',
          salary: Number(salary),
          bonus: Number(bonus),
          other: Number(other),
          periodId,
        }),
      })
      if (!res.ok) throw new Error()
      updateData({ salary: Number(salary), bonus: Number(bonus), otherIncome: Number(other) })
      onNext()
    } catch {
      toast.error('שגיאה בשמירה')
    }
    setSaving(false)
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[13px] text-[var(--text-muted)] mb-4 bg-transparent border-none cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
      >
        <ArrowRight size={14} />
        חזרה
      </button>

      <div className="flex items-center gap-3 mb-2">
        <Wallet size={24} className="text-[var(--accent-green)]" />
        <h1 className="text-[22px] font-bold text-[var(--text-heading)]">ההכנסה החודשית שלך</h1>
      </div>
      <p className="text-[var(--text-secondary)] text-[14px] leading-relaxed mb-7">
        ההכנסה היא הבסיס לחישוב התקציב, שיעור החיסכון והתחזיות שלך.
      </p>

      <div className="flex flex-col gap-5">
        <div>
          <label className="text-[13px] font-medium text-[var(--text-body)] block mb-1.5">משכורת נטו</label>
          <input
            type="number"
            value={salary || ''}
            onChange={e => setSalary(Number(e.target.value))}
            placeholder="0"
            dir="ltr"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-sm outline-none focus:border-[var(--accent-blue)] transition-colors text-left"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-[var(--text-body)] block mb-1.5">בונוס / עמלות חודשי</label>
          <input
            type="number"
            value={bonus || ''}
            onChange={e => setBonus(Number(e.target.value))}
            placeholder="0"
            dir="ltr"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-sm outline-none focus:border-[var(--accent-blue)] transition-colors text-left"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-[var(--text-body)] block mb-1.5">הכנסה נוספת</label>
          <input
            type="number"
            value={other || ''}
            onChange={e => setOther(Number(e.target.value))}
            placeholder="0"
            dir="ltr"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-sm outline-none focus:border-[var(--accent-blue)] transition-colors text-left"
          />
          <span className="text-[11px] text-[var(--text-muted)] mt-1 block">שכירות, פרילנס, רווחי השקעות וכו׳</span>
        </div>

        {total > 0 && (
          <div className="bg-[var(--c-0-14)] rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-[14px] font-medium text-[var(--text-body)]">סה"כ הכנסה חודשית</span>
            <span className="text-[18px] font-bold text-[var(--accent-green)]">{formatCurrency(total)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={handleContinue}
          disabled={saving}
          className={`flex-1 bg-[var(--accent-blue)] text-white border-none rounded-lg py-3 font-semibold text-[15px] transition-opacity ${
            saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
          }`}
        >
          {saving ? 'שומר...' : 'המשך'}
        </button>
        <button
          onClick={onSkip}
          className="px-5 bg-transparent border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg py-3 text-[13px] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
        >
          אדלג, אגדיר אחר כך
        </button>
      </div>
    </div>
  )
}
