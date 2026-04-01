'use client'

import { useState } from 'react'
import { PartyPopper, CheckCircle2, ArrowRight, User, Users, Wallet, FileSpreadsheet, LayoutGrid, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { OnboardingData } from '@/app/onboarding/page'

interface Props {
  data: OnboardingData
  onComplete: () => Promise<void>
  onBack: () => void
}

export function StepFinish({ data, onComplete, onBack }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    setLoading(true)
    await onComplete()
    setLoading(false)
  }

  const summaryItems: { icon: React.ReactNode; label: string; value: string }[] = []

  if (data.name) {
    summaryItems.push({
      icon: <User size={16} />,
      label: 'שם',
      value: data.name,
    })
  }

  if (data.familyStatus) {
    summaryItems.push({
      icon: <Users size={16} />,
      label: 'מצב',
      value: data.familyStatus === 'family'
        ? data.familyName ? `משפחה - ${data.familyName}` : 'משפחה'
        : 'יחיד/ה',
    })
  }

  const totalIncome = Number(data.salary) + Number(data.bonus) + Number(data.otherIncome)
  if (totalIncome > 0) {
    summaryItems.push({
      icon: <Wallet size={16} />,
      label: 'הכנסה חודשית',
      value: formatCurrency(totalIncome),
    })
  }

  if (data.expensesImported && data.importedCount > 0) {
    summaryItems.push({
      icon: <FileSpreadsheet size={16} />,
      label: 'הוצאות שיובאו',
      value: `${data.importedCount} הוצאות`,
    })
  }

  if (data.moduleItems.length > 0) {
    const moduleLabels: Record<string, string> = {
      budget: 'תקציב', sinking: 'קרנות צבירה', pension: 'פנסיה',
      mortgage: 'משכנתא', kids: 'ילדים', debts: 'חובות',
      insurance: 'ביטוחים', subscriptions: 'מנויים', goals: 'יעדים',
      shared_expenses: 'הוצאות משותפות',
    }
    const names = data.moduleItems.map(m => moduleLabels[m.type] || m.type).join(', ')
    summaryItems.push({
      icon: <LayoutGrid size={16} />,
      label: 'מודולים שהוגדרו',
      value: names,
    })
  }

  const skippedEverything = summaryItems.length <= 1

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-8 text-center">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[13px] text-[var(--text-muted)] mb-6 bg-transparent border-none cursor-pointer hover:text-[var(--text-secondary)] transition-colors"
      >
        <ArrowRight size={14} />
        חזרה
      </button>

      <PartyPopper size={48} className="text-[var(--accent-gold)] mx-auto mb-4" />

      <h1 className="text-[26px] font-bold text-[var(--text-heading)] mb-2">הכל מוכן!</h1>

      {!skippedEverything && (
        <>
          <p className="text-[var(--text-secondary)] text-[15px] mb-6">הנה סיכום מה שהגדרת:</p>
          <div className="flex flex-col gap-2.5 text-right max-w-[400px] mx-auto mb-8">
            {summaryItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-[var(--c-0-14)] rounded-lg px-4 py-2.5">
                <span className="text-[var(--accent-green)] shrink-0">
                  <CheckCircle2 size={16} />
                </span>
                <span className="text-[var(--text-muted)] shrink-0">{item.icon}</span>
                <span className="text-[13px] text-[var(--text-body)] font-medium">{item.label}:</span>
                <span className="text-[13px] text-[var(--text-heading)] font-semibold mr-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {skippedEverything && (
        <p className="text-[var(--text-secondary)] text-[14px] leading-relaxed mb-8 max-w-[360px] mx-auto">
          דילגת על רוב השלבים - אין בעיה! אפשר להגדיר הכל מתוך המערכת בכל שלב.
        </p>
      )}

      <button
        onClick={handleStart}
        disabled={loading}
        className={`w-full max-w-[360px] mx-auto bg-[var(--accent-green)] text-white border-none rounded-xl py-3.5 font-bold text-[17px] transition-all flex items-center justify-center gap-2 ${
          loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
        }`}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            מסיים הגדרה...
          </>
        ) : (
          'בואו נתחיל'
        )}
      </button>
    </div>
  )
}
