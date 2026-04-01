'use client'

import { useState } from 'react'
import { Users, Mail, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import type { OnboardingData } from '@/app/onboarding/page'

interface Props {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

export function StepFamily({ data, updateData, onNext, onSkip, onBack }: Props) {
  const [saving, setSaving] = useState(false)
  const [familyName, setFamilyName] = useState(data.familyName || `משפחת ${data.name?.split(' ').pop() || ''}`)
  const [partnerEmail, setPartnerEmail] = useState(data.partnerEmail)
  const [splitPct, setSplitPct] = useState(data.splitPct)

  async function handleContinue() {
    if (!familyName.trim()) {
      toast.error('נא להזין שם משפחה')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_family',
          familyName: familyName.trim(),
          partnerEmail: partnerEmail.trim(),
          splitPct,
        }),
      })
      if (!res.ok) throw new Error()
      updateData({ familyName: familyName.trim(), partnerEmail: partnerEmail.trim(), splitPct })
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
        <Users size={24} className="text-[var(--accent-purple)]" />
        <h1 className="text-[22px] font-bold text-[var(--text-heading)]">הגדרת המשפחה</h1>
      </div>
      <p className="text-[var(--text-secondary)] text-[14px] leading-relaxed mb-7">
        מצב משפחה מאפשר לך ולבן/בת הזוג לנהל תקציב משותף - כל אחד מזין את הנתונים שלו, ורואים את התמונה המלאה ביחד.
      </p>

      <div className="flex flex-col gap-5">
        <div>
          <label className="text-[13px] font-medium text-[var(--text-body)] block mb-1.5">שם המשפחה</label>
          <input
            type="text"
            value={familyName}
            onChange={e => setFamilyName(e.target.value)}
            placeholder="משפחת כהן"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-sm outline-none focus:border-[var(--accent-blue)] transition-colors"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-[var(--text-body)] block mb-1.5">
            <span className="flex items-center gap-1.5">
              <Mail size={13} />
              אימייל בן/בת הזוג
            </span>
          </label>
          <input
            type="email"
            value={partnerEmail}
            onChange={e => setPartnerEmail(e.target.value)}
            placeholder="partner@email.com"
            dir="ltr"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-sm outline-none focus:border-[var(--accent-blue)] transition-colors text-left"
          />
          <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
            נשלח הזמנה להצטרף למשפחה (אופציונלי)
          </span>
        </div>

        <div>
          <label className="text-[13px] font-medium text-[var(--text-body)] block mb-2">
            חלוקת הוצאות משותפות
          </label>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-[var(--text-secondary)] w-12 text-center">{splitPct}%</span>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={splitPct}
              onChange={e => setSplitPct(Number(e.target.value))}
              className="flex-1 accent-[var(--accent-blue)]"
            />
            <span className="text-[13px] text-[var(--text-secondary)] w-12 text-center">{100 - splitPct}%</span>
          </div>
          <div className="flex justify-between text-[11px] text-[var(--text-muted)] mt-1 px-12">
            <span>אני</span>
            <span>בן/בת הזוג</span>
          </div>
        </div>
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
