'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/queries/useUser'
import { usePeriods, useCurrentPeriod } from '@/lib/queries/usePeriods'
import { useFamily } from '@/lib/queries/useFamily'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { StepWelcome } from '@/components/onboarding/StepWelcome'
import { StepFamily } from '@/components/onboarding/StepFamily'
import { StepIncome } from '@/components/onboarding/StepIncome'
import { StepExpenses } from '@/components/onboarding/StepExpenses'
import { StepModules } from '@/components/onboarding/StepModules'
import { StepFinish } from '@/components/onboarding/StepFinish'

export type FamilyStatus = 'single' | 'family'

export interface OnboardingData {
  name: string
  familyStatus: FamilyStatus | null
  familyName: string
  partnerEmail: string
  splitPct: number
  salary: number
  bonus: number
  otherIncome: number
  expensesImported: boolean
  importedCount: number
  moduleItems: ModuleItem[]
}

export interface ModuleItem {
  type: string
  data: Record<string, unknown>[]
}

const STEP_LABELS = [
  'פרטים אישיים',
  'הגדרת משפחה',
  'הכנסה חודשית',
  'ייבוא הוצאות',
  'מה רלוונטי לך?',
  'סיום',
]

export default function OnboardingPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: periods } = usePeriods()
  const currentPeriod = useCurrentPeriod()
  const { data: familyData } = useFamily(user?.id)

  const [currentStep, setCurrentStep] = useState(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [data, setData] = useState<OnboardingData>({
    name: '',
    familyStatus: null,
    familyName: '',
    partnerEmail: '',
    splitPct: 50,
    salary: 0,
    bonus: 0,
    otherIncome: 0,
    expensesImported: false,
    importedCount: 0,
    moduleItems: [],
  })

  // Load saved progress
  useEffect(() => {
    if (!user) return
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(d => {
        if (d.completed) {
          router.push('/')
          return
        }
        if (d.step > 0) {
          setCurrentStep(d.step)
        }
        if (d.name) {
          setData(prev => ({ ...prev, name: d.name }))
        }
        setInitialLoading(false)
      })
      .catch(() => setInitialLoading(false))
  }, [user, router])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const goNext = useCallback(() => {
    setCurrentStep(prev => {
      const next = prev + 1
      // Auto-skip family step if single
      if (next === 1 && data.familyStatus === 'single') {
        fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_step', step: 2 }),
        })
        return 2
      }
      return next
    })
  }, [data.familyStatus])

  const goBack = useCallback(() => {
    setCurrentStep(prev => {
      const next = prev - 1
      if (next === 1 && data.familyStatus === 'single') return 0
      return Math.max(0, next)
    })
  }, [data.familyStatus])

  const skipStep = useCallback(() => {
    setCurrentStep(prev => {
      const next = prev + 1
      fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_step', step: next }),
      })
      return next
    })
  }, [])

  const handleComplete = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })
      if (!res.ok) throw new Error('Failed to complete')
      toast.success('!ההגדרה הושלמה בהצלחה')
      window.location.href = '/'
    } catch {
      toast.error('שגיאה בסיום ההגדרה')
    }
  }, [])

  if (loading || initialLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const effectiveSteps = data.familyStatus === 'single'
    ? [0, 2, 3, 4, 5]
    : [0, 1, 2, 3, 4, 5]

  const progressIndex = effectiveSteps.indexOf(currentStep)
  const totalSteps = effectiveSteps.length

  return (
    <div className="max-w-[640px] mx-auto px-4 pb-12">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {effectiveSteps.map((stepNum, idx) => {
          const isCompleted = progressIndex > idx
          const isCurrent = progressIndex === idx
          const label = STEP_LABELS[stepNum]

          const canClick = isCompleted
          return (
            <div key={stepNum} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="flex items-center w-full">
                {idx > 0 && (
                  <div className={`h-[2px] flex-1 transition-colors duration-300 ${
                    isCompleted ? 'bg-[var(--accent-green)]' : 'bg-[var(--c-0-25)]'
                  }`} />
                )}
                <div
                  onClick={() => canClick && setCurrentStep(stepNum)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-[var(--accent-green)] text-white cursor-pointer hover:ring-4 hover:ring-[var(--c-green-0-25)]'
                      : isCurrent
                        ? 'bg-[var(--accent-blue)] text-white ring-4 ring-[var(--c-blue-0-22)]'
                        : 'bg-[var(--c-0-20)] text-[var(--text-muted)]'
                  }`}>
                  {isCompleted ? <Check size={16} /> : idx + 1}
                </div>
                {idx < totalSteps - 1 && (
                  <div className={`h-[2px] flex-1 transition-colors duration-300 ${
                    isCompleted ? 'bg-[var(--accent-green)]' : 'bg-[var(--c-0-25)]'
                  }`} />
                )}
              </div>
              <span
                onClick={() => canClick && setCurrentStep(stepNum)}
                className={`text-[11px] whitespace-nowrap transition-colors ${
                  isCurrent ? 'text-[var(--accent-blue)] font-semibold' : 'text-[var(--text-muted)]'
                } ${canClick ? 'cursor-pointer hover:text-[var(--accent-green)]' : ''}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="animate-in fade-in duration-300">
        {currentStep === 0 && (
          <StepWelcome
            data={data}
            updateData={updateData}
            onNext={goNext}
          />
        )}
        {currentStep === 1 && (
          <StepFamily
            data={data}
            updateData={updateData}
            onNext={goNext}
            onSkip={skipStep}
            onBack={goBack}
          />
        )}
        {currentStep === 2 && (
          <StepIncome
            data={data}
            updateData={updateData}
            onNext={goNext}
            onSkip={skipStep}
            onBack={goBack}
            userId={user.id}
            periodId={currentPeriod?.id}
          />
        )}
        {currentStep === 3 && (
          <StepExpenses
            data={data}
            updateData={updateData}
            onNext={goNext}
            onSkip={skipStep}
            onBack={goBack}
            userId={user.id}
            periodId={currentPeriod?.id}
          />
        )}
        {currentStep === 4 && (
          <StepModules
            data={data}
            updateData={updateData}
            onNext={goNext}
            onSkip={skipStep}
            onBack={goBack}
            userId={user.id}
            familyId={familyData?.family?.id}
            periodId={currentPeriod?.id}
          />
        )}
        {currentStep === 5 && (
          <StepFinish
            data={data}
            onComplete={handleComplete}
            onBack={goBack}
          />
        )}
      </div>
    </div>
  )
}
