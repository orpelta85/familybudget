'use client'

import { useState } from 'react'
import { User, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { OnboardingData, FamilyStatus } from '@/app/onboarding/page'

interface Props {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
}

export function StepWelcome({ data, updateData, onNext }: Props) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(data.name)
  const [status, setStatus] = useState<FamilyStatus | null>(data.familyStatus)

  async function handleContinue() {
    if (!name.trim()) {
      toast.error('נא להזין שם מלא')
      return
    }
    if (!status) {
      toast.error('נא לבחור מצב משפחתי')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_welcome',
          name: name.trim(),
          familyStatus: status,
        }),
      })
      if (!res.ok) throw new Error()
      updateData({ name: name.trim(), familyStatus: status })
      onNext()
    } catch {
      toast.error('שגיאה בשמירה')
    }
    setSaving(false)
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-8">
      <h1 className="text-[24px] font-bold text-[var(--text-heading)] mb-2">
        ברוך הבא לניהול הכספים שלך
      </h1>
      <p className="text-[var(--text-secondary)] text-[15px] leading-relaxed mb-8">
        כאן תנהל תקציב, תעקוב אחרי הוצאות והכנסות, ותקבל תמונה ברורה של המצב הפיננסי שלך.
      </p>

      <div className="flex flex-col gap-5">
        {/* Name field */}
        <div>
          <label className="text-[13px] font-medium text-[var(--text-body)] block mb-1.5">
            שם מלא
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="השם שלך"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-sm outline-none focus:border-[var(--accent-blue)] transition-colors"
          />
        </div>

        {/* Family status */}
        <div>
          <label className="text-[13px] font-medium text-[var(--text-body)] block mb-2">
            מצב משפחתי
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStatus('single')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                status === 'single'
                  ? 'border-[var(--accent-blue)] bg-[var(--c-blue-0-16)]'
                  : 'border-[var(--border-light)] bg-transparent hover:border-[var(--c-0-35)]'
              }`}
            >
              <User size={20} className={status === 'single' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)]'} />
              <span className={`text-[14px] font-medium ${status === 'single' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-body)]'}`}>
                יחיד/ה
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatus('family')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                status === 'family'
                  ? 'border-[var(--accent-blue)] bg-[var(--c-blue-0-16)]'
                  : 'border-[var(--border-light)] bg-transparent hover:border-[var(--c-0-35)]'
              }`}
            >
              <Users size={20} className={status === 'family' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)]'} />
              <span className={`text-[14px] font-medium ${status === 'family' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-body)]'}`}>
                זוג / משפחה
              </span>
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleContinue}
        disabled={saving}
        className={`w-full mt-8 bg-[var(--accent-blue)] text-white border-none rounded-lg py-3 font-semibold text-[15px] transition-opacity ${
          saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
        }`}
      >
        {saving ? 'שומר...' : 'המשך'}
      </button>
    </div>
  )
}
