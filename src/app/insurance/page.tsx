'use client'

import { useUser } from '@/lib/queries/useUser'
import {
  useInsurancePolicies, useAddInsurancePolicy, useUpdateInsurancePolicy,
  useDeleteInsurancePolicy, POLICY_TYPE_LABELS,
  type InsurancePolicy,
} from '@/lib/queries/useInsurance'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { toast } from 'sonner'
import { Shield, Plus, X, Pencil, Trash2, Calendar, AlertTriangle } from 'lucide-react'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageInfo } from '@/components/ui/PageInfo'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { PAGE_TIPS } from '@/lib/page-tips'

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'health', label: 'בריאות' },
  { value: 'life', label: 'חיים' },
  { value: 'car', label: 'רכב' },
  { value: 'home', label: 'דירה' },
  { value: 'travel', label: 'נסיעות' },
  { value: 'dental', label: 'שיניים' },
  { value: 'other', label: 'אחר' },
]

const TYPE_COLORS: Record<string, string> = {
  health: 'oklch(0.70 0.18 145)',
  life: 'oklch(0.65 0.18 250)',
  car: 'oklch(0.72 0.18 55)',
  home: 'oklch(0.70 0.15 185)',
  travel: 'oklch(0.68 0.18 295)',
  dental: 'oklch(0.75 0.18 80)',
  other: 'oklch(0.65 0.01 250)',
}

const TYPE_ICONS: Record<string, string> = {
  health: '🏥',
  life: '💚',
  car: '🚗',
  home: '🏠',
  travel: '✈️',
  dental: '🦷',
  other: '📋',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function renewalColor(days: number | null): string {
  if (days === null) return 'oklch(0.50 0.01 250)'
  if (days < 0) return 'oklch(0.62 0.22 27)'
  if (days <= 30) return 'oklch(0.62 0.22 27)'
  if (days <= 90) return 'oklch(0.72 0.18 55)'
  return 'oklch(0.70 0.18 145)'
}

function renewalLabel(days: number | null): string {
  if (days === null) return 'לא הוגדר'
  if (days < 0) return `פג תוקף לפני ${Math.abs(days)} ימים`
  if (days === 0) return 'היום!'
  if (days <= 30) return `בעוד ${days} ימים`
  if (days <= 90) return `בעוד ${days} ימים`
  return `בעוד ${days} ימים`
}

interface FormState {
  name: string
  provider: string
  policy_type: string
  monthly_cost: string
  annual_cost: string
  renewal_date: string
  is_shared: boolean
  notes: string
}

const emptyForm: FormState = {
  name: '', provider: '', policy_type: 'health', monthly_cost: '', annual_cost: '',
  renewal_date: '', is_shared: false, notes: '',
}

export default function InsurancePage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { familyId } = useFamilyContext()
  const { viewMode } = useFamilyView()
  const { data: policies, isLoading } = useInsurancePolicies(user?.id, familyId)
  const addPolicy = useAddInsurancePolicy()
  const updatePolicy = useUpdateInsurancePolicy()
  const deletePolicy = useDeleteInsurancePolicy()
  const confirm = useConfirmDialog()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  // Filter by view mode
  const filtered = useMemo(() => {
    if (!policies) return []
    if (viewMode === 'personal') return policies.filter(p => !p.is_shared)
    return policies
  }, [policies, viewMode])

  // Group by type
  const grouped = useMemo(() => {
    const map = new Map<string, InsurancePolicy[]>()
    for (const p of filtered) {
      const type = p.policy_type ?? 'other'
      if (!map.has(type)) map.set(type, [])
      map.get(type)!.push(p)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  // KPIs
  const totalMonthly = filtered.reduce((s, p) => s + Number(p.monthly_cost), 0)
  const totalAnnual = filtered.reduce((s, p) => s + (Number(p.annual_cost) || Number(p.monthly_cost) * 12), 0)
  const policyCount = filtered.length
  const nextRenewal = useMemo(() => {
    const upcoming = filtered
      .filter(p => p.renewal_date && daysUntil(p.renewal_date)! >= 0)
      .sort((a, b) => daysUntil(a.renewal_date)! - daysUntil(b.renewal_date)!)
    return upcoming[0] ?? null
  }, [filtered])

  function openAdd() {
    setForm(emptyForm)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(p: InsurancePolicy) {
    setForm({
      name: p.name,
      provider: p.provider ?? '',
      policy_type: p.policy_type,
      monthly_cost: String(p.monthly_cost),
      annual_cost: p.annual_cost ? String(p.annual_cost) : '',
      renewal_date: p.renewal_date ?? '',
      is_shared: p.is_shared,
      notes: p.notes ?? '',
    })
    setEditId(p.id)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.name || !form.monthly_cost) { toast.error('שם ועלות חודשית חובה'); return }

    const payload = {
      user_id: user.id,
      family_id: form.is_shared ? familyId ?? null : null,
      name: form.name,
      provider: form.provider || null,
      policy_type: form.policy_type as InsurancePolicy['policy_type'],
      monthly_cost: Number(form.monthly_cost),
      annual_cost: form.annual_cost ? Number(form.annual_cost) : null,
      renewal_date: form.renewal_date || null,
      is_shared: form.is_shared,
      notes: form.notes || null,
    }

    try {
      if (editId) {
        await updatePolicy.mutateAsync({ id: editId, ...payload })
        toast.success('הפוליסה עודכנה')
      } else {
        await addPolicy.mutateAsync(payload)
        toast.success('פוליסה חדשה נוספה')
      }
      setShowForm(false)
      setEditId(null)
    } catch { toast.error('שגיאה בשמירה') }
  }

  async function handleDelete(id: number) {
    if (!(await confirm({ message: 'למחוק את הפוליסה?' }))) return
    await deletePolicy.mutateAsync(id)
    toast.success('הפוליסה נמחקה')
  }

  if (loading || !user) return null

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-[oklch(0.65_0.18_250)]" />
            <h1 className="text-xl font-bold tracking-tight">ביטוחים</h1>
            <PageInfo {...PAGE_TIPS.insurance} />
          </div>
          <p className="text-[oklch(0.65_0.01_250)] text-[13px]">ניהול פוליסות ביטוח ומעקב חידושים</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-[oklch(0.65_0.18_250)] border-none rounded-lg px-3.5 py-[7px] text-[oklch(0.10_0.01_250)] text-[13px] font-semibold cursor-pointer"
        >
          <Plus size={14} /> הוסף פוליסה
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1">עלות חודשית</div>
          <div className="text-lg font-bold">{formatCurrency(totalMonthly)}</div>
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1">עלות שנתית</div>
          <div className="text-lg font-bold">{formatCurrency(totalAnnual)}</div>
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1 flex items-center gap-1">חידוש הבא <InfoTooltip body="היום שבו הפוליסה מתחדשת — ההזדמנות לעבור לביטוח זול יותר" /></div>
          <div className="text-lg font-bold" style={{ color: nextRenewal ? renewalColor(daysUntil(nextRenewal.renewal_date)) : undefined }}>
            {nextRenewal ? renewalLabel(daysUntil(nextRenewal.renewal_date)) : 'אין'}
          </div>
          {nextRenewal && <div className="text-[11px] text-[oklch(0.55_0.01_250)] mt-0.5">{nextRenewal.name}</div>}
        </div>
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4">
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1">פוליסות פעילות</div>
          <div className="text-lg font-bold">{policyCount}</div>
        </div>
      </div>

      {/* Policy List by Type */}
      {isLoading ? (
        <div className="text-center py-10 text-[oklch(0.50_0.01_250)]">טוען...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16">
          <Shield size={32} className="mx-auto mb-3 text-[oklch(0.35_0.01_250)]" />
          <div className="text-[oklch(0.55_0.01_250)] text-[13px]">אין פוליסות ביטוח</div>
          <button onClick={openAdd} className="mt-3 text-[oklch(0.65_0.18_250)] text-[13px] cursor-pointer bg-transparent border-none underline">
            הוסף פוליסה ראשונה
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([type, items]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{TYPE_ICONS[type] ?? '📋'}</span>
                <h2 className="text-[14px] font-semibold text-[oklch(0.80_0.01_250)] flex items-center gap-1">
                  {POLICY_TYPE_LABELS[type] ?? type}
                  {type === 'life' && <InfoTooltip body="משלם לשארים במקרה פטירה. חשוב במיוחד להורים עם ילדים" />}
                </h2>
                <span className="text-[11px] text-[oklch(0.50_0.01_250)]">({items.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map(p => {
                  const days = daysUntil(p.renewal_date)
                  return (
                    <div
                      key={p.id}
                      className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4 flex items-center gap-4"
                    >
                      {/* Color indicator */}
                      <div
                        className="w-1 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: TYPE_COLORS[p.policy_type] ?? TYPE_COLORS.other }}
                      />
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold">{p.name}</span>
                          {p.provider && (
                            <span className="text-[11px] text-[oklch(0.55_0.01_250)]">{p.provider}</span>
                          )}
                          {p.is_shared && (
                            <span className="text-[10px] bg-[oklch(0.22_0.05_295)] text-[oklch(0.75_0.15_295)] px-1.5 py-0.5 rounded font-medium">משותף</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[12px] text-[oklch(0.60_0.01_250)]">
                          <span className="font-semibold text-[oklch(0.80_0.01_250)]">{formatCurrency(Number(p.monthly_cost))}/חודש</span>
                          {p.annual_cost && (
                            <span>{formatCurrency(Number(p.annual_cost))}/שנה</span>
                          )}
                          {p.renewal_date && (
                            <span className="flex items-center gap-1" style={{ color: renewalColor(days) }}>
                              {days !== null && days <= 30 && <AlertTriangle size={11} />}
                              <Calendar size={11} />
                              {renewalLabel(days)}
                            </span>
                          )}
                        </div>
                        {p.notes && (
                          <div className="text-[11px] text-[oklch(0.50_0.01_250)] mt-1">{p.notes}</div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(p)}
                          aria-label="עריכה"
                          className="bg-transparent border-none cursor-pointer text-[oklch(0.55_0.01_250)] p-1.5 rounded hover:bg-[oklch(0.20_0.01_250)]"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          aria-label="מחיקה"
                          className="bg-transparent border-none cursor-pointer text-[oklch(0.55_0.01_250)] p-1.5 rounded hover:bg-[oklch(0.20_0.01_250)]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Renewal Timeline */}
      {filtered.filter(p => p.renewal_date).length > 0 && (
        <div className="mt-8">
          <h2 className="text-[14px] font-semibold text-[oklch(0.80_0.01_250)] mb-3 flex items-center gap-2">
            <Calendar size={14} className="text-[oklch(0.65_0.18_250)]" />
            לוח חידושים
          </h2>
          <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-xl p-4">
            <div className="flex flex-col gap-2">
              {filtered
                .filter(p => p.renewal_date)
                .sort((a, b) => new Date(a.renewal_date!).getTime() - new Date(b.renewal_date!).getTime())
                .map(p => {
                  const days = daysUntil(p.renewal_date)
                  const date = new Date(p.renewal_date!)
                  const HE_MONTHS = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ']
                  const dateLabel = `${date.getDate()} ${HE_MONTHS[date.getMonth()]} ${date.getFullYear()}`
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[oklch(0.20_0.01_250)] last:border-b-0">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: renewalColor(days) }}
                      />
                      <div className="flex-1">
                        <span className="text-[13px] font-medium">{p.name}</span>
                        {p.provider && <span className="text-[11px] text-[oklch(0.50_0.01_250)] mr-2">{p.provider}</span>}
                      </div>
                      <div className="text-[12px] text-[oklch(0.60_0.01_250)]">{dateLabel}</div>
                      <div className="text-[12px] font-semibold" style={{ color: renewalColor(days) }}>
                        {renewalLabel(days)}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center">
          <div className="bg-[oklch(0.14_0.01_250)] rounded-2xl p-6 w-[440px] max-h-[90vh] overflow-y-auto border border-[oklch(0.25_0.01_250)]">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold">{editId ? 'עריכת פוליסה' : 'הוספת פוליסה'}</h3>
              <button onClick={() => { setShowForm(false); setEditId(null) }} aria-label="סגור"
                className="bg-transparent border-none cursor-pointer text-[oklch(0.65_0.01_250)] p-2">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="text-[12px] text-[oklch(0.65_0.01_250)] mb-1 block">שם הפוליסה *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-[13px] text-inherit"
                  placeholder="ביטוח בריאות"
                />
              </div>
              <div>
                <label className="text-[12px] text-[oklch(0.65_0.01_250)] mb-1 block">חברת ביטוח</label>
                <input
                  value={form.provider}
                  onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                  className="w-full bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-[13px] text-inherit"
                  placeholder="מנורה, הראל..."
                />
              </div>
              <div>
                <label className="text-[12px] text-[oklch(0.65_0.01_250)] mb-1 block">סוג ביטוח</label>
                <select
                  value={form.policy_type}
                  onChange={e => setForm(f => ({ ...f, policy_type: e.target.value }))}
                  className="w-full bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-[13px] text-inherit cursor-pointer"
                >
                  {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] text-[oklch(0.65_0.01_250)] mb-1 block">עלות חודשית *</label>
                  <input
                    type="number"
                    value={form.monthly_cost}
                    onChange={e => setForm(f => ({ ...f, monthly_cost: e.target.value }))}
                    className="w-full bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-[13px] text-inherit"
                    placeholder="258"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-[oklch(0.65_0.01_250)] mb-1 block">עלות שנתית</label>
                  <input
                    type="number"
                    value={form.annual_cost}
                    onChange={e => setForm(f => ({ ...f, annual_cost: e.target.value }))}
                    className="w-full bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-[13px] text-inherit"
                    placeholder="3096"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className="text-[12px] text-[oklch(0.65_0.01_250)] mb-1 block">תאריך חידוש</label>
                <input
                  type="date"
                  value={form.renewal_date}
                  onChange={e => setForm(f => ({ ...f, renewal_date: e.target.value }))}
                  className="w-full bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-[13px] text-inherit"
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_shared"
                  checked={form.is_shared}
                  onChange={e => setForm(f => ({ ...f, is_shared: e.target.checked }))}
                  className="cursor-pointer"
                />
                <label htmlFor="is_shared" className="text-[13px] cursor-pointer">פוליסה משותפת (משפחתית)</label>
              </div>
              <div>
                <label className="text-[12px] text-[oklch(0.65_0.01_250)] mb-1 block">הערות</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-[13px] text-inherit resize-none"
                  rows={2}
                  placeholder="פרטים נוספים..."
                />
              </div>
              <button
                type="submit"
                disabled={addPolicy.isPending || updatePolicy.isPending}
                className="bg-[oklch(0.65_0.18_250)] border-none rounded-lg py-2.5 text-[oklch(0.10_0.01_250)] font-semibold text-[13px] cursor-pointer mt-1"
              >
                {editId ? 'עדכן' : 'הוסף'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
