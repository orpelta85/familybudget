'use client'

import { useState, useCallback } from 'react'
import { ArrowRight, ChevronDown, ChevronLeft, Plus, Trash2, PiggyBank, Target, Heart, Home, Baby, CreditCard, Shield, Tv, Goal, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { OnboardingData, ModuleItem } from '@/app/onboarding/page'

interface Props {
  data: OnboardingData
  updateData: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onSkip: () => void
  onBack: () => void
  userId: string
  familyId: string | undefined
  periodId: number | undefined
}

interface ModuleConfig {
  key: string
  label: string
  description: string
  icon: React.ReactNode
  familyOnly?: boolean
  fields: FieldConfig[]
}

interface FieldConfig {
  key: string
  label: string
  type: 'text' | 'number' | 'select'
  placeholder?: string
  options?: { value: string; label: string }[]
}

const MODULES: ModuleConfig[] = [
  {
    key: 'budget',
    label: 'תקציב חודשי',
    description: 'הגדר יעדים חודשיים לכל קטגוריית הוצאה',
    icon: <PiggyBank size={18} />,
    fields: [
      { key: 'name', label: 'קטגוריה', type: 'text', placeholder: 'שם הקטגוריה' },
      { key: 'target', label: 'יעד חודשי', type: 'number', placeholder: '0' },
    ],
  },
  {
    key: 'sinking',
    label: 'קרנות צבירה',
    description: 'חסכון חודשי ייעודי - חופשה, רכב, חירום',
    icon: <Target size={18} />,
    fields: [
      { key: 'name', label: 'שם הקרן', type: 'text', placeholder: 'קרן חירום' },
      { key: 'target', label: 'סכום יעד', type: 'number', placeholder: '0' },
      { key: 'monthlyDeposit', label: 'הפקדה חודשית', type: 'number', placeholder: '0' },
    ],
  },
  {
    key: 'pension',
    label: 'פנסיה',
    description: 'מעקב אחרי הפקדות וצבירת הפנסיה שלך',
    icon: <Heart size={18} />,
    fields: [
      { key: 'company', label: 'חברת ביטוח', type: 'text', placeholder: 'מגדל, הראל...' },
      { key: 'balance', label: 'סכום צבור', type: 'number', placeholder: '0' },
      { key: 'monthlyDeposit', label: 'הפקדה חודשית', type: 'number', placeholder: '0' },
    ],
  },
  {
    key: 'mortgage',
    label: 'משכנתא',
    description: 'מעקב אחרי מסלולי המשכנתא, יתרות ותשלומים',
    icon: <Home size={18} />,
    fields: [
      { key: 'name', label: 'שם מסלול', type: 'text', placeholder: 'פריים, קבועה...' },
      { key: 'originalAmount', label: 'סכום מקורי', type: 'number', placeholder: '0' },
      { key: 'balance', label: 'יתרה', type: 'number', placeholder: '0' },
      { key: 'monthlyPayment', label: 'החזר חודשי', type: 'number', placeholder: '0' },
      { key: 'interestRate', label: 'ריבית %', type: 'number', placeholder: '0' },
    ],
  },
  {
    key: 'kids',
    label: 'ילדים',
    description: 'מעקב אחרי הוצאות ילדים - חינוך, חוגים, ביגוד',
    icon: <Baby size={18} />,
    fields: [
      { key: 'name', label: 'שם', type: 'text', placeholder: 'שם הילד/ה' },
      { key: 'birthYear', label: 'שנת לידה', type: 'number', placeholder: '2020' },
      { key: 'monthlyExpenses', label: 'הוצאות חודשיות', type: 'number', placeholder: '0' },
    ],
  },
  {
    key: 'debts',
    label: 'חובות / הלוואות',
    description: 'מעקב אחרי הלוואות, חובות ולוחות סילוקין',
    icon: <CreditCard size={18} />,
    fields: [
      { key: 'name', label: 'שם', type: 'text', placeholder: 'הלוואת רכב' },
      { key: 'originalAmount', label: 'סכום מקורי', type: 'number', placeholder: '0' },
      { key: 'balance', label: 'יתרה', type: 'number', placeholder: '0' },
      { key: 'monthlyPayment', label: 'החזר חודשי', type: 'number', placeholder: '0' },
    ],
  },
  {
    key: 'insurance',
    label: 'ביטוחים',
    description: 'ריכוז כל הביטוחים - חיים, בריאות, רכב, דירה',
    icon: <Shield size={18} />,
    fields: [
      { key: 'type', label: 'סוג', type: 'select', options: [
        { value: 'life', label: 'חיים' },
        { value: 'health', label: 'בריאות' },
        { value: 'car', label: 'רכב' },
        { value: 'home', label: 'דירה' },
        { value: 'other', label: 'אחר' },
      ] },
      { key: 'company', label: 'חברה', type: 'text', placeholder: 'שם החברה' },
      { key: 'monthlyCost', label: 'עלות חודשית', type: 'number', placeholder: '0' },
    ],
  },
  {
    key: 'subscriptions',
    label: 'מנויים',
    description: 'נטפליקס, ספוטיפיי, חדר כושר - כל המנויים במקום אחד',
    icon: <Tv size={18} />,
    fields: [
      { key: 'name', label: 'שם', type: 'text', placeholder: 'נטפליקס' },
      { key: 'monthlyCost', label: 'עלות חודשית', type: 'number', placeholder: '0' },
      { key: 'billingDay', label: 'יום חיוב', type: 'number', placeholder: '1' },
    ],
  },
  {
    key: 'goals',
    label: 'יעדים פיננסיים',
    description: 'הגדר יעדי חיסכון - דירה, רכב, טיול',
    icon: <Goal size={18} />,
    fields: [
      { key: 'name', label: 'שם', type: 'text', placeholder: 'דירה, רכב...' },
      { key: 'target', label: 'סכום יעד', type: 'number', placeholder: '0' },
      { key: 'targetDate', label: 'תאריך יעד', type: 'text', placeholder: '2027-01' },
      { key: 'currentSavings', label: 'חיסכון נוכחי', type: 'number', placeholder: '0' },
    ],
  },
  {
    key: 'shared_expenses',
    label: 'הוצאות משותפות',
    description: 'חלוקת הוצאות בין בני הזוג',
    icon: <Users size={18} />,
    familyOnly: true,
    fields: [
      { key: 'name', label: 'שם', type: 'text', placeholder: 'שכירות' },
      { key: 'amount', label: 'סכום חודשי', type: 'number', placeholder: '0' },
      { key: 'split', label: 'חלוקה (% שלי)', type: 'number', placeholder: '50' },
    ],
  },
]

type ModuleData = Record<string, Record<string, unknown>[]>

export function StepModules({ data, updateData, onNext, onSkip, onBack, userId, familyId, periodId }: Props) {
  const [saving, setSaving] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const [moduleData, setModuleData] = useState<ModuleData>({})

  const isFamily = data.familyStatus === 'family'

  const visibleModules = MODULES.filter(m => !m.familyOnly || isFamily)

  const toggleCheck = useCallback((key: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        if (expanded === key) setExpanded(null)
      } else {
        next.add(key)
        setExpanded(key)
        // Initialize with one empty row
        if (!moduleData[key] || moduleData[key].length === 0) {
          setModuleData(prev => ({ ...prev, [key]: [{}] }))
        }
      }
      return next
    })
  }, [expanded, moduleData])

  const toggleExpand = useCallback((key: string) => {
    if (!checked.has(key)) return
    setExpanded(prev => prev === key ? null : key)
  }, [checked])

  const addRow = useCallback((moduleKey: string) => {
    setModuleData(prev => ({
      ...prev,
      [moduleKey]: [...(prev[moduleKey] || []), {}],
    }))
  }, [])

  const removeRow = useCallback((moduleKey: string, index: number) => {
    setModuleData(prev => ({
      ...prev,
      [moduleKey]: (prev[moduleKey] || []).filter((_, i) => i !== index),
    }))
  }, [])

  const updateField = useCallback((moduleKey: string, rowIndex: number, fieldKey: string, value: string | number) => {
    setModuleData(prev => {
      const rows = [...(prev[moduleKey] || [])]
      rows[rowIndex] = { ...rows[rowIndex], [fieldKey]: value }
      return { ...prev, [moduleKey]: rows }
    })
  }, [])

  async function handleContinue() {
    const activeModules = Array.from(checked)
    if (activeModules.length === 0) {
      onNext()
      return
    }

    setSaving(true)
    try {
      const items: ModuleItem[] = activeModules
        .filter(key => moduleData[key] && moduleData[key].length > 0)
        .map(key => {
          let rowData = moduleData[key].filter(row => Object.values(row).some(v => v))
          if (key === 'shared_expenses') {
            rowData = rowData.map(row => ({ ...row, familyId, periodId }))
          }
          return { type: key, data: rowData }
        })
        .filter(item => item.data.length > 0)

      if (items.length > 0) {
        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_step5_items', items }),
        })
        if (!res.ok) throw new Error()
      }

      updateData({ moduleItems: items })
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

      <h1 className="text-[22px] font-bold text-[var(--text-heading)] mb-2">מה עוד רלוונטי לך?</h1>
      <div className="bg-[var(--c-blue-0-16)] border border-[var(--c-blue-0-30)] rounded-lg px-4 py-3 mb-6">
        <span className="text-[13px] text-[var(--accent-blue)] font-medium">
          אפשר להגדיר עכשיו או בכל שלב מתוך המערכת
        </span>
      </div>
      <p className="text-[var(--text-secondary)] text-[14px] leading-relaxed mb-6">
        סמן את מה שרלוונטי - נפתח לך מיני-טופס קצר להזנת הנתונים הבסיסיים.
      </p>

      <div className="flex flex-col gap-2">
        {visibleModules.map(mod => {
          const isChecked = checked.has(mod.key)
          const isExpanded = expanded === mod.key
          const rows = moduleData[mod.key] || []

          return (
            <div key={mod.key} className="border border-[var(--border-light)] rounded-xl overflow-hidden transition-all">
              {/* Header */}
              <div
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  isChecked ? 'bg-[var(--c-blue-0-16)]' : 'hover:bg-[var(--bg-hover)]'
                }`}
                onClick={() => toggleCheck(mod.key)}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCheck(mod.key)}
                  onClick={e => e.stopPropagation()}
                  className="w-4 h-4 accent-[var(--accent-blue)] cursor-pointer shrink-0"
                />
                <span className={`shrink-0 ${isChecked ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)]'}`}>
                  {mod.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-[14px] font-medium ${isChecked ? 'text-[var(--text-heading)]' : 'text-[var(--text-body)]'}`}>
                    {mod.label}
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] truncate">{mod.description}</div>
                </div>
                {isChecked && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleExpand(mod.key) }}
                    className="bg-transparent border-none cursor-pointer text-[var(--text-muted)] p-1"
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
                  </button>
                )}
              </div>

              {/* Expanded mini-form */}
              {isChecked && isExpanded && (
                <div className="px-4 pb-4 border-t border-[var(--border-light)] bg-[var(--c-0-14)]">
                  {rows.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex flex-wrap items-end gap-2 mt-3 pb-3 border-b border-[var(--c-0-20)] last:border-b-0">
                      {mod.fields.map(field => (
                        <div key={field.key} className="flex-1 min-w-[120px]">
                          <label className="text-[11px] text-[var(--text-muted)] block mb-1">{field.label}</label>
                          {field.type === 'select' ? (
                            <select
                              value={(row[field.key] as string) || ''}
                              onChange={e => updateField(mod.key, rowIdx, field.key, e.target.value)}
                              className="w-full bg-[var(--bg-input)] border border-[var(--border-light)] rounded-md px-2 py-1.5 text-[12px] text-inherit outline-none"
                            >
                              <option value="">בחר...</option>
                              {field.options?.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type}
                              value={(row[field.key] as string) ?? ''}
                              onChange={e => updateField(mod.key, rowIdx, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                              placeholder={field.placeholder}
                              dir={field.type === 'number' ? 'ltr' : 'rtl'}
                              className={`w-full bg-[var(--bg-input)] border border-[var(--border-light)] rounded-md px-2 py-1.5 text-[12px] text-inherit outline-none focus:border-[var(--accent-blue)] ${
                                field.type === 'number' ? 'text-left' : ''
                              }`}
                            />
                          )}
                        </div>
                      ))}
                      {rows.length > 1 && (
                        <button
                          onClick={() => removeRow(mod.key, rowIdx)}
                          className="bg-transparent border-none cursor-pointer text-[var(--accent-red)] p-1 mb-0.5 hover:opacity-70"
                          aria-label="הסר שורה"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addRow(mod.key)}
                    className="flex items-center gap-1 mt-2 bg-transparent border border-dashed border-[var(--c-0-30)] rounded-lg px-3 py-1.5 text-[12px] text-[var(--accent-blue)] cursor-pointer hover:bg-[var(--c-blue-0-16)] transition-colors"
                  >
                    <Plus size={13} />
                    הוסף עוד
                  </button>
                </div>
              )}
            </div>
          )
        })}
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
