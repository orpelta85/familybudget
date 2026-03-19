'use client'

import { useUser } from '@/lib/queries/useUser'
import { usePensionReports, useUploadPensionReport } from '@/lib/queries/usePension'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import {
  Upload, ChevronDown, ChevronUp, Shield, Heart, TrendingUp,
  Wallet, Building2, FileText, AlertCircle, Check, X, Clock, PiggyBank,
  Users, Pencil, FileUp, Camera,
} from 'lucide-react'
import type { PensionReport, PensionProduct, PensionProductType } from '@/lib/types'
import { TableSkeleton } from '@/components/ui/Skeleton'

const TYPE_LABELS: Record<PensionProductType, string> = {
  pension: 'קרן פנסיה',
  hishtalmut: 'קרן השתלמות',
  gemel_tagmulim: 'קופ"ג תגמולים',
  gemel_invest: 'קופ"ג להשקעה',
  health_insurance: 'ביטוח בריאות',
}

const TYPE_COLORS: Record<PensionProductType, string> = {
  pension: 'oklch(0.65 0.18 250)',
  hishtalmut: 'oklch(0.70 0.18 145)',
  gemel_tagmulim: 'oklch(0.72 0.18 55)',
  gemel_invest: 'oklch(0.68 0.18 295)',
  health_insurance: 'oklch(0.65 0.15 15)',
}

const TYPE_ICONS: Record<PensionProductType, typeof Shield> = {
  pension: PiggyBank,
  hishtalmut: TrendingUp,
  gemel_tagmulim: Wallet,
  gemel_invest: Building2,
  health_insurance: Heart,
}

function formatDate(d: string) {
  if (!d) return ''
  const parts = d.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

// --- Empty product template for the manual form ---
function emptyProduct(num: number): ManualProduct {
  return {
    product_number: num,
    product_type: 'pension',
    product_name: '',
    company: '',
    account_number: '',
    balance: 0,
    is_active: true,
    mgmt_fee_deposits: 0,
    mgmt_fee_accumulation: 0,
    monthly_deposit: 0,
    monthly_employee: 0,
    monthly_employer: 0,
    monthly_severance: 0,
    salary_basis: 0,
    investment_tracks: [],
    deposit_history: [],
    extra_data: {},
  }
}

type ManualProduct = Omit<PensionProduct, 'id' | 'report_id' | 'start_date'> & { start_date?: string }

export default function PensionPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: reports, isLoading: loadingReports } = usePensionReports(user?.id)
  const uploadMutation = useUploadPensionReport()
  const fileRef = useRef<HTMLInputElement>(null)

  const [showUpload, setShowUpload] = useState(false)
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)
  const [selectedReportIdx, setSelectedReportIdx] = useState(0)

  // Manual form state
  const [formDate, setFormDate] = useState('')
  const [formAdvisor, setFormAdvisor] = useState('אלמוג רובין')
  const [formTotalSavings, setFormTotalSavings] = useState('')
  const [formYtdReturn, setFormYtdReturn] = useState('')
  const [formMonthlyDeposits, setFormMonthlyDeposits] = useState('')
  const [formInsurancePremium, setFormInsurancePremium] = useState('')
  const [formEstimatedPension, setFormEstimatedPension] = useState('')
  const [formDisability, setFormDisability] = useState('')
  const [formSurvivors, setFormSurvivors] = useState('')
  const [formProducts, setFormProducts] = useState<ManualProduct[]>([emptyProduct(1)])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<'manual' | 'pdf' | 'image'>('image')
  const [imageExtracting, setImageExtracting] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const report: PensionReport | null = reports?.[selectedReportIdx] ?? null
  const products = report?.pension_products ?? []
  const healthCoverages = report?.pension_health_coverages ?? []

  // --- Derived data ---
  const activeProducts = products.filter(p => p.is_active)
  const inactiveProducts = products.filter(p => !p.is_active)
  const savingsProducts = products.filter(p => p.product_type !== 'health_insurance')
  const totalBalance = savingsProducts.reduce((s, p) => s + p.balance, 0)

  // Product type distribution
  const typeDistribution = savingsProducts.reduce((acc, p) => {
    acc[p.product_type] = (acc[p.product_type] || 0) + p.balance
    return acc
  }, {} as Record<string, number>)

  // Company distribution
  const companyDistribution = savingsProducts.reduce((acc, p) => {
    acc[p.company] = (acc[p.company] || 0) + p.balance
    return acc
  }, {} as Record<string, number>)

  const handleImageExtract = async () => {
    if (!user || !uploadFile) return
    setImageExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      const res = await fetch('/api/pension/extract-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'extraction failed')

      const d = json.data
      // Save extracted data via the existing pension API
      await uploadMutation.mutateAsync({ userId: user.id, manualData: {
        report_date: d.report_date || '',
        advisor_name: d.advisor_name || '',
        total_savings: d.total_savings || 0,
        ytd_return: d.ytd_return || 0,
        total_monthly_deposits: d.total_monthly_deposits || 0,
        insurance_premium: d.insurance_premium || 0,
        estimated_pension: d.estimated_pension || 0,
        disability_coverage: d.disability_coverage || 0,
        survivors_pension: d.survivors_pension || 0,
        death_coverage: d.death_coverage || 0,
        products: (d.products || []).map((p: Record<string, unknown>, i: number) => ({
          ...p,
          product_number: p.product_number || i + 1,
          investment_tracks: [],
          deposit_history: [],
          extra_data: {},
        })),
        health_coverages: d.health_coverages || [],
        summary_json: {},
      }})
      toast.success('הדוח נקרא ונשמר בהצלחה!')
      setShowUpload(false)
      setUploadFile(null)
    } catch (err) {
      console.error('Image extraction failed:', err)
      const msg = err instanceof Error ? err.message : 'שגיאה בקריאת התמונה'
      toast.error(msg)
    }
    setImageExtracting(false)
  }

  const handleSubmitReport = async () => {
    if (!user) return

    if (uploadMode === 'image' && uploadFile) {
      await handleImageExtract()
      return
    }

    if (uploadMode === 'pdf' && uploadFile) {
      try {
        await uploadMutation.mutateAsync({ file: uploadFile, userId: user.id })
        toast.success('הדוח הועלה בהצלחה')
        setShowUpload(false)
        setUploadFile(null)
      } catch (err) {
        console.error('PDF upload failed:', err)
        const msg = err instanceof Error ? err.message : 'שגיאה בהעלאת הדוח'
        toast.error(msg)
      }
      return
    }

    // Manual mode
    if (!formDate) { toast.error('נא למלא תאריך דוח'); return }

    const [d, m, y] = formDate.split('/')
    const reportDate = y && m && d ? `${y}-${m}-${d}` : formDate

    const manualData = {
      report_date: reportDate,
      advisor_name: formAdvisor,
      total_savings: parseFloat(formTotalSavings) || 0,
      ytd_return: parseFloat(formYtdReturn) || 0,
      total_monthly_deposits: parseFloat(formMonthlyDeposits) || 0,
      insurance_premium: parseFloat(formInsurancePremium) || 0,
      estimated_pension: parseFloat(formEstimatedPension) || 0,
      disability_coverage: parseFloat(formDisability) || 0,
      survivors_pension: parseFloat(formSurvivors) || 0,
      death_coverage: 0,
      products: formProducts.filter(p => p.product_name).map(p => ({
        ...p,
        start_date: p.start_date || null,
      })),
      health_coverages: [],
      summary_json: {},
    }

    try {
      await uploadMutation.mutateAsync({
        userId: user.id,
        file: uploadFile || undefined,
        manualData,
      })
      toast.success('הדוח נשמר בהצלחה')
      setShowUpload(false)
      resetForm()
    } catch {
      toast.error('שגיאה בשמירת הדוח')
    }
  }

  const resetForm = () => {
    setFormDate('')
    setFormTotalSavings('')
    setFormYtdReturn('')
    setFormMonthlyDeposits('')
    setFormInsurancePremium('')
    setFormEstimatedPension('')
    setFormDisability('')
    setFormSurvivors('')
    setFormProducts([emptyProduct(1)])
    setUploadFile(null)
  }

  const updateProduct = (idx: number, field: keyof ManualProduct, value: string | number | boolean) => {
    setFormProducts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  if (loading || loadingReports) {
    return <TableSkeleton rows={6} />
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp size={22} className="text-[oklch(0.65_0.18_250)]" />
            פנסיה והשקעות
          </h1>
          {report && (
            <p className="text-[oklch(0.65_0.01_250)] text-[13px] mt-1">
              נכון ל-{formatDate(report.report_date)} | {report.advisor_name}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-[oklch(0.65_0.18_250)] text-[oklch(0.12_0.01_250)] border-none rounded-lg py-2 px-4 cursor-pointer flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <Upload size={14} />
          העלאת דוח
        </button>
      </div>

      {/* Report selector if multiple reports */}
      {reports && reports.length > 1 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {reports.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setSelectedReportIdx(i)}
              className={`py-1.5 px-3.5 rounded-full text-xs font-medium cursor-pointer border ${
                i === selectedReportIdx
                  ? 'border-[oklch(0.65_0.18_250)] bg-[oklch(0.22_0.05_250)] text-[oklch(0.80_0.10_250)]'
                  : 'border-[oklch(0.25_0.01_250)] bg-[oklch(0.16_0.01_250)] text-[oklch(0.65_0.01_250)]'
              }`}
            >
              {formatDate(r.report_date)}
            </button>
          ))}
        </div>
      )}

      {!report ? (
        /* No reports yet -- show empty state */
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl text-center p-[60px]">
          <FileText size={48} className="text-[oklch(0.65_0.01_250)] mb-4" />
          <div className="text-lg font-semibold mb-2">אין דוחות פנסיה</div>
          <div className="text-sm text-[oklch(0.65_0.01_250)] mb-5">
            העלה את הדוח הראשון שלך מהסוכן הפנסיוני
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-[oklch(0.65_0.18_250)] text-[oklch(0.12_0.01_250)] border-none rounded-lg py-2.5 px-6 cursor-pointer text-sm font-semibold"
          >
            העלאת דוח ראשון
          </button>
        </div>
      ) : (
        <>
          {/* KPIs Row */}
          <div className="grid-kpi mb-5">
            {[
              { label: 'סך חיסכון', value: formatCurrency(report.total_savings || totalBalance), color: TYPE_COLORS.pension, icon: PiggyBank },
              { label: 'תשואה מתחילת שנה', value: `${report.ytd_return}%`, color: 'oklch(0.70 0.18 145)', icon: TrendingUp },
              { label: 'הפקדות חודשיות', value: formatCurrency(report.total_monthly_deposits), color: 'oklch(0.70 0.18 145)', icon: Wallet },
              { label: 'קצבה חזויה', value: formatCurrency(report.estimated_pension), color: TYPE_COLORS.gemel_invest, icon: Clock },
              { label: 'פרמיית ביטוח', value: formatCurrency(report.insurance_premium), color: TYPE_COLORS.health_insurance, icon: Heart },
              { label: 'מוצרים פעילים', value: `${activeProducts.length} / ${products.length}`, color: 'oklch(0.68 0.18 295)', icon: Check },
            ].map(kpi => {
              const Icon = kpi.icon
              return (
                <div key={kpi.label} className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Icon size={14} style={{ color: kpi.color }} />
                    <span className="text-[11px] text-[oklch(0.65_0.01_250)] font-medium">{kpi.label}</span>
                  </div>
                  <div className="text-xl font-bold ltr text-start" style={{ color: kpi.color }}>
                    {kpi.value}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Retirement Projection */}
          {(() => {
            const currentBalance = report.total_savings || totalBalance
            const monthlyDeposit = report.total_monthly_deposits || 0
            const annualRealReturn = 0.04
            const r = annualRealReturn / 12
            const n = 420 // 35 years to retirement
            const futureValue = currentBalance * Math.pow(1 + r, n) + monthlyDeposit * (Math.pow(1 + r, n) - 1) / r
            const monthlyPension = futureValue * 0.005
            const largestProduct = savingsProducts.reduce<PensionProduct | null>((best, p) =>
              !best || p.balance > best.balance ? p : best, null)
            const currentSalary = largestProduct?.salary_basis || 0
            const replacementRatio = currentSalary > 0 ? (monthlyPension / currentSalary) * 100 : 0
            const ratioColor = replacementRatio >= 70
              ? 'oklch(0.70 0.18 145)'
              : replacementRatio >= 50
                ? 'oklch(0.72 0.18 55)'
                : 'oklch(0.65 0.15 15)'

            return (
              <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
                <h2 className="font-semibold text-[15px] flex items-center gap-2 m-0 mb-3.5">
                  <Clock size={16} className="text-[oklch(0.65_0.18_250)]" />
                  תחזית פרישה
                </h2>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                  <div className="bg-[oklch(0.14_0.01_250)] rounded-lg p-3.5">
                    <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5">צבירה צפויה בפרישה</div>
                    <div className="text-lg font-bold ltr text-start text-[oklch(0.65_0.18_250)]">
                      {formatCurrency(futureValue)}
                    </div>
                  </div>
                  <div className="bg-[oklch(0.14_0.01_250)] rounded-lg p-3.5">
                    <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5">קצבה חודשית צפויה</div>
                    <div className="text-lg font-bold ltr text-start text-[oklch(0.70_0.18_145)]">
                      {formatCurrency(monthlyPension)}
                    </div>
                  </div>
                  <div className="bg-[oklch(0.14_0.01_250)] rounded-lg p-3.5">
                    <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5">יחס החלפה</div>
                    <div className="text-lg font-bold ltr text-start" style={{ color: ratioColor }}>
                      {currentSalary > 0 ? `${replacementRatio.toFixed(0)}%` : 'אין נתון'}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-[oklch(0.65_0.01_250)] mt-3">
                  * הנחות: תשואה ריאלית 4% שנתי, גיל פרישה 67, 35 שנה לפרישה
                </div>
              </div>
            )
          })()}

          {/* Insurance Coverage Bar */}
          <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
            <h2 className="font-semibold text-[15px] flex items-center gap-2 m-0 mb-3.5">
              <Shield size={16} className="text-[oklch(0.65_0.18_250)]" />
              כיסויים ביטוחיים
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
              {[
                { label: 'אובדן כושר עבודה', value: report.disability_coverage, Icon: Shield },
                { label: 'קצבה לשאירים', value: report.survivors_pension, Icon: Users },
                { label: 'כיסוי למוות', value: report.death_coverage, Icon: FileText },
              ].map(item => (
                <div key={item.label} className="bg-[oklch(0.14_0.01_250)] rounded-lg p-3.5">
                  <div className="text-[11px] text-[oklch(0.65_0.01_250)] mb-1.5 flex items-center gap-1">
                    <item.Icon size={12} />
                    {item.label}
                  </div>
                  <div className={`text-lg font-bold ltr text-start ${item.value > 0 ? 'text-[oklch(0.80_0.01_250)]' : 'text-[oklch(0.65_0.01_250)]'}`}>
                    {item.value > 0 ? formatCurrency(item.value) : 'אין כיסוי'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Products -- Active */}
          <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
            <h2 className="font-semibold text-[15px] flex items-center gap-2 m-0 mb-4">
              <Wallet size={16} className="text-[oklch(0.70_0.18_145)]" />
              מוצרי חיסכון פעילים
            </h2>
            {activeProducts.length === 0 && (
              <div className="text-center p-5 text-[oklch(0.65_0.01_250)] text-[13px]">אין מוצרים פעילים</div>
            )}
            {activeProducts.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                totalBalance={totalBalance || report.total_savings}
                expanded={expandedProduct === p.id}
                onToggle={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
              />
            ))}
          </div>

          {/* Products -- Inactive */}
          {inactiveProducts.length > 0 && (
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4 opacity-80">
              <div className="font-semibold mb-4 text-[15px] flex items-center gap-2 text-[oklch(0.65_0.01_250)]">
                <AlertCircle size={16} />
                מוצרים לא פעילים ({inactiveProducts.length})
              </div>
              {inactiveProducts.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  totalBalance={totalBalance || report.total_savings}
                  expanded={expandedProduct === p.id}
                  onToggle={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                />
              ))}
            </div>
          )}

          {/* Distribution Charts */}
          <div className="grid-2 mb-4">
            {/* By Product Type */}
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
              <div className="font-semibold mb-3.5 text-sm">לפי סוג מוצר</div>
              {Object.entries(typeDistribution).sort((a, b) => b[1] - a[1]).map(([type, amount]) => {
                const pct = totalBalance > 0 ? (amount / totalBalance) * 100 : 0
                const color = TYPE_COLORS[type as PensionProductType] || 'oklch(0.60 0.01 250)'
                return (
                  <div key={type} className="mb-2.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{TYPE_LABELS[type as PensionProductType] || type}</span>
                      <span className="ltr" style={{ color }}>{pct.toFixed(0)}% · {formatCurrency(amount)}</span>
                    </div>
                    <div className="h-1.5 bg-[oklch(0.20_0.01_250)] rounded-sm">
                      <div className="h-full rounded-sm transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* By Company */}
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
              <div className="font-semibold mb-3.5 text-sm">לפי יצרן</div>
              {Object.entries(companyDistribution).sort((a, b) => b[1] - a[1]).map(([company, amount], i) => {
                const pct = totalBalance > 0 ? (amount / totalBalance) * 100 : 0
                const colors = ['oklch(0.65 0.18 250)', 'oklch(0.70 0.18 145)', 'oklch(0.72 0.18 55)', 'oklch(0.68 0.18 295)']
                const color = colors[i % colors.length]
                return (
                  <div key={company} className="mb-2.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{company}</span>
                      <span className="ltr" style={{ color }}>{pct.toFixed(0)}% · {formatCurrency(amount)}</span>
                    </div>
                    <div className="h-1.5 bg-[oklch(0.20_0.01_250)] rounded-sm">
                      <div className="h-full rounded-sm transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Health Insurance Coverages */}
          {healthCoverages.length > 0 && (
            <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5 mb-4">
              <div className="font-semibold mb-3.5 text-[15px] flex items-center gap-2">
                <Heart size={16} className="text-[oklch(0.65_0.15_15)]" />
                ביטוח בריאות — כיסויים
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[oklch(0.25_0.01_250)]">
                      <th className="text-start p-2 font-semibold">כיסוי</th>
                      <th className="text-start p-2 font-semibold">מבוטח ראשי</th>
                      <th className="text-start p-2 font-semibold">סה&quot;כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthCoverages.map(h => (
                      <tr key={h.id} className="border-b border-[oklch(0.20_0.01_250)]">
                        <td className="p-2">{h.coverage_name}</td>
                        <td className="p-2 ltr text-start">{formatCurrency(h.main_insured)}</td>
                        <td className="p-2 ltr text-start">{formatCurrency(h.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* === Upload / Manual Entry Modal === */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/70 z-[1000] flex items-start justify-center pt-10 overflow-y-auto">
          <div className="bg-[oklch(0.14_0.01_250)] rounded-2xl p-7 w-full max-w-[680px] max-h-[calc(100vh-80px)] overflow-y-auto border border-[oklch(0.25_0.01_250)]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold">העלאת דוח פנסיוני</h2>
              <button onClick={() => setShowUpload(false)} aria-label="סגור" className="bg-transparent border-none cursor-pointer text-[oklch(0.60_0.01_250)] p-2 min-w-9 min-h-9 flex items-center justify-center">
                <X size={20} />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-5">
              {(['image', 'manual', 'pdf'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setUploadMode(mode)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-[13px] font-semibold cursor-pointer border ${
                    uploadMode === mode
                      ? 'border-[oklch(0.65_0.18_250)] bg-[oklch(0.22_0.05_250)] text-[oklch(0.85_0.10_250)]'
                      : 'border-[oklch(0.25_0.01_250)] bg-[oklch(0.18_0.01_250)] text-[oklch(0.65_0.01_250)]'
                  }`}
                >
                  {mode === 'image' ? <><Camera size={14} className="ms-1.5 inline" /> צילום/תמונה</>
                    : mode === 'manual' ? <><Pencil size={14} className="ms-1.5 inline" /> הזנה ידנית</>
                    : <><FileUp size={14} className="ms-1.5 inline" /> העלאת PDF</>}
                </button>
              ))}
            </div>

            {uploadMode === 'image' ? (
              /* Image Upload with AI */
              <div>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed border-[oklch(0.30_0.05_145)] rounded-xl p-10 text-center cursor-pointer mb-4 ${
                    uploadFile ? 'bg-[oklch(0.18_0.03_145)]' : 'bg-[oklch(0.16_0.01_250)]'
                  }`}
                >
                  {uploadFile ? (
                    <>
                      <Check size={32} className="text-[oklch(0.70_0.18_145)] mb-2" />
                      <div className="font-semibold">{uploadFile.name}</div>
                      <div className="text-xs text-[oklch(0.65_0.01_250)] mt-1">
                        {(uploadFile.size / 1024).toFixed(0)} KB
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera size={32} className="text-[oklch(0.70_0.18_145)] mb-2" />
                      <div className="font-semibold">לחץ לבחירת תמונה של הדוח</div>
                      <div className="text-xs text-[oklch(0.65_0.01_250)] mt-1">PNG, JPG — צילום מסך או תמונה מהטלפון</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
                <div className="text-xs text-[oklch(0.65_0.01_250)] mb-4">
                  * AI קורא את הנתונים מהתמונה אוטומטית. וודא שהתמונה חדה וכל הטקסט קריא.
                </div>
                {imageExtracting && (
                  <div className="text-center p-4 text-[oklch(0.70_0.18_145)] text-sm">
                    קורא את הדוח... נא להמתין
                  </div>
                )}
              </div>
            ) : uploadMode === 'pdf' ? (
              /* PDF Upload */
              <div>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed border-[oklch(0.30_0.05_250)] rounded-xl p-10 text-center cursor-pointer mb-4 ${
                    uploadFile ? 'bg-[oklch(0.18_0.03_145)]' : 'bg-[oklch(0.16_0.01_250)]'
                  }`}
                >
                  {uploadFile ? (
                    <>
                      <Check size={32} className="text-[oklch(0.70_0.18_145)] mb-2" />
                      <div className="font-semibold">{uploadFile.name}</div>
                      <div className="text-xs text-[oklch(0.65_0.01_250)] mt-1">
                        {(uploadFile.size / 1024).toFixed(0)} KB
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={32} className="text-[oklch(0.65_0.01_250)] mb-2" />
                      <div className="font-semibold">לחץ לבחירת קובץ PDF</div>
                      <div className="text-xs text-[oklch(0.65_0.01_250)] mt-1">או גרור לכאן</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
                <div className="text-xs text-[oklch(0.65_0.01_250)] mb-4">
                  * ניתוח אוטומטי של דוחות Surense. אם הקובץ מוגן בסיסמה, השתמש בהזנה ידנית.
                </div>
              </div>
            ) : (
              /* Manual Entry Form */
              <div>
                {/* Report header fields */}
                <div className="grid-2 gap-3 mb-4">
                  <div>
                    <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">תאריך דוח (DD/MM/YYYY)</label>
                    <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" value={formDate} onChange={e => setFormDate(e.target.value)} placeholder="31/01/2026" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">שם הסוכן</label>
                    <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" value={formAdvisor} onChange={e => setFormAdvisor(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">סך חיסכון שצברת (₪)</label>
                    <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={formTotalSavings} onChange={e => setFormTotalSavings(e.target.value)} placeholder="451046" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">תשואה מתחילת שנה (%)</label>
                    <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" step="0.1" value={formYtdReturn} onChange={e => setFormYtdReturn(e.target.value)} placeholder="2.1" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">סך הפקדות חודשיות (₪)</label>
                    <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={formMonthlyDeposits} onChange={e => setFormMonthlyDeposits(e.target.value)} placeholder="7050" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">פרמיית ביטוח חודשית (₪)</label>
                    <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={formInsurancePremium} onChange={e => setFormInsurancePremium(e.target.value)} placeholder="258" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">קצבה חזויה (₪/חודש)</label>
                    <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={formEstimatedPension} onChange={e => setFormEstimatedPension(e.target.value)} placeholder="4098" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">כיסוי אובדן כושר (₪)</label>
                    <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={formDisability} onChange={e => setFormDisability(e.target.value)} placeholder="16750" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">קצבה לשאירים (₪)</label>
                    <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={formSurvivors} onChange={e => setFormSurvivors(e.target.value)} placeholder="22334" />
                  </div>
                </div>

                {/* Products */}
                <div className="font-semibold text-sm mb-3 border-t border-[oklch(0.25_0.01_250)] pt-4">
                  מוצרים
                </div>
                {formProducts.map((p, idx) => (
                  <div key={p.product_number} className="bg-[oklch(0.18_0.01_250)] border border-[oklch(0.22_0.01_250)] rounded-[10px] p-4 mb-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-[13px]">מוצר {idx + 1}</span>
                      {formProducts.length > 1 && (
                        <button onClick={() => setFormProducts(prev => prev.filter((_, i) => i !== idx))}
                          aria-label="הסר מוצר"
                          className="bg-transparent border-none cursor-pointer text-[oklch(0.65_0.01_250)]">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div className="grid-2 gap-2.5">
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">סוג מוצר</label>
                        <select
                          className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full cursor-pointer"
                          value={p.product_type}
                          onChange={e => updateProduct(idx, 'product_type', e.target.value)}
                        >
                          <option value="pension">קרן פנסיה</option>
                          <option value="hishtalmut">קרן השתלמות</option>
                          <option value="gemel_tagmulim">קופ&quot;ג תגמולים</option>
                          <option value="gemel_invest">קופ&quot;ג להשקעה</option>
                          <option value="health_insurance">ביטוח בריאות</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">שם מוצר</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" value={p.product_name} onChange={e => updateProduct(idx, 'product_name', e.target.value)} placeholder="קרן פנסיה מקיפה" />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">חברה</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" value={p.company} onChange={e => updateProduct(idx, 'company', e.target.value)} placeholder="הראל" />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">מספר חשבון</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" value={p.account_number} onChange={e => updateProduct(idx, 'account_number', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">צבירה (₪)</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={p.balance || ''} onChange={e => updateProduct(idx, 'balance', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">הפקדה חודשית כוללת (₪)</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={p.monthly_deposit || ''} onChange={e => updateProduct(idx, 'monthly_deposit', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">ד&quot;נ הפקדה (%)</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" step="0.01" value={p.mgmt_fee_deposits || ''} onChange={e => updateProduct(idx, 'mgmt_fee_deposits', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">ד&quot;נ צבירה (%)</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" step="0.01" value={p.mgmt_fee_accumulation || ''} onChange={e => updateProduct(idx, 'mgmt_fee_accumulation', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">הפקדת עובד (₪)</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={p.monthly_employee || ''} onChange={e => updateProduct(idx, 'monthly_employee', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">הפקדת מעסיק (₪)</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={p.monthly_employer || ''} onChange={e => updateProduct(idx, 'monthly_employer', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">פיצויים (₪)</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={p.monthly_severance || ''} onChange={e => updateProduct(idx, 'monthly_severance', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">שכר בסיס (₪)</label>
                        <input className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none w-full" type="number" value={p.salary_basis || ''} onChange={e => updateProduct(idx, 'salary_basis', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <label className="text-[11px] text-[oklch(0.65_0.01_250)] font-medium">פעיל</label>
                        <input type="checkbox" checked={p.is_active} onChange={e => updateProduct(idx, 'is_active', e.target.checked)} />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setFormProducts(prev => [...prev, emptyProduct(prev.length + 1)])}
                  className="w-full p-2.5 border border-dashed border-[oklch(0.30_0.01_250)] rounded-lg bg-transparent text-[oklch(0.60_0.01_250)] cursor-pointer text-[13px] mb-4"
                >
                  + הוסף מוצר
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmitReport}
              disabled={uploadMutation.isPending}
              className={`w-full py-3 px-6 rounded-[10px] border-none text-[oklch(0.12_0.01_250)] text-[15px] font-bold ${
                uploadMutation.isPending
                  ? 'bg-[oklch(0.40_0.05_250)] cursor-wait'
                  : 'bg-[oklch(0.65_0.18_250)] cursor-pointer'
              }`}
            >
              {imageExtracting ? 'קורא את הדוח...' : uploadMutation.isPending ? 'שומר...' : uploadMode === 'image' ? 'קרא ושמור דוח' : 'שמור דוח'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Product Card Component ---
function ProductCard({ product: p, totalBalance, expanded, onToggle }: {
  product: PensionProduct
  totalBalance: number
  expanded: boolean
  onToggle: () => void
}) {
  const pct = totalBalance > 0 ? (p.balance / totalBalance) * 100 : 0
  const color = TYPE_COLORS[p.product_type] || 'oklch(0.60 0.01 250)'
  const Icon = TYPE_ICONS[p.product_type] || Wallet

  return (
    <div className="mb-3 bg-[oklch(0.14_0.01_250)] rounded-[10px] overflow-hidden">
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex justify-between items-center py-3.5 px-4 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-[34px] h-[34px] rounded-lg flex items-center justify-center"
            style={{ background: `${color}20` }}
          >
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <div className="text-[13px] font-semibold">{p.product_name}</div>
            <div className="text-[11px] text-[oklch(0.65_0.01_250)] flex gap-2 mt-0.5">
              <span>{p.company}</span>
              {p.account_number && <span>· {p.account_number}</span>}
              <span className={`py-px px-1.5 rounded-full text-[10px] ${
                p.is_active
                  ? 'bg-[oklch(0.20_0.06_145)] text-[oklch(0.70_0.18_145)]'
                  : 'bg-[oklch(0.20_0.01_250)] text-[oklch(0.65_0.01_250)]'
              }`}>
                {p.is_active ? 'פעיל' : 'לא פעיל'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-start">
            <div className="font-bold text-base ltr" style={{ color }}>{formatCurrency(p.balance)}</div>
            <div className="text-[11px] text-[oklch(0.65_0.01_250)] ltr">{pct.toFixed(1)}% מהתיק</div>
          </div>
          {expanded ? <ChevronUp size={16} className="text-[oklch(0.65_0.01_250)]" /> : <ChevronDown size={16} className="text-[oklch(0.65_0.01_250)]" />}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] bg-[oklch(0.20_0.01_250)]">
        <div className="h-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: color }} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="py-3.5 px-4 border-t border-[oklch(0.20_0.01_250)]">
          {/* Monthly deposits breakdown */}
          {p.monthly_deposit > 0 && (
            <div className="mb-3.5">
              <div className="text-xs font-semibold mb-2 text-[oklch(0.70_0.01_250)]">הפקדות חודשיות</div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
                {[
                  { label: 'סה"כ', value: p.monthly_deposit },
                  { label: 'עובד', value: p.monthly_employee },
                  { label: 'מעסיק', value: p.monthly_employer },
                  { label: 'פיצויים', value: p.monthly_severance },
                ].filter(item => item.value > 0).map(item => (
                  <div key={item.label} className="bg-[oklch(0.18_0.01_250)] rounded-md py-2 px-2.5">
                    <div className="text-[10px] text-[oklch(0.65_0.01_250)]">{item.label}</div>
                    <div className="text-sm font-semibold ltr text-start">{formatCurrency(item.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Management fees */}
          {(p.mgmt_fee_deposits > 0 || p.mgmt_fee_accumulation > 0) && (
            <div className="mb-3.5">
              <div className="text-xs font-semibold mb-2 text-[oklch(0.70_0.01_250)]">דמי ניהול</div>
              <div className="flex gap-4 text-[13px]">
                <div>
                  <span className="text-[oklch(0.65_0.01_250)] ms-1.5">מהפקדה:</span>
                  <span className="font-semibold">{p.mgmt_fee_deposits}%</span>
                </div>
                <div>
                  <span className="text-[oklch(0.65_0.01_250)] ms-1.5">מצבירה:</span>
                  <span className="font-semibold">{p.mgmt_fee_accumulation}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Salary basis */}
          {p.salary_basis > 0 && (
            <div className="mb-3.5 text-[13px]">
              <span className="text-[oklch(0.65_0.01_250)] ms-1.5">שכר בסיס:</span>
              <span className="font-semibold ltr">{formatCurrency(p.salary_basis)}</span>
            </div>
          )}

          {/* Investment tracks */}
          {p.investment_tracks && p.investment_tracks.length > 0 && (
            <div className="mb-3.5">
              <div className="text-xs font-semibold mb-2 text-[oklch(0.70_0.01_250)]">מסלולי השקעה</div>
              {p.investment_tracks.map((t, i) => (
                <div key={i} className="flex justify-between text-xs py-1">
                  <span>{t.name}</span>
                  <span className="font-semibold" style={{ color }}>{t.percentage}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Deposit history */}
          {p.deposit_history && p.deposit_history.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-2 text-[oklch(0.70_0.01_250)]">היסטוריית הפקדות</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-[oklch(0.22_0.01_250)]">
                      <th className="text-start p-1.5">תאריך</th>
                      <th className="text-start p-1.5">שכר</th>
                      <th className="text-start p-1.5">מעסיק</th>
                      <th className="text-start p-1.5">עובד</th>
                      <th className="text-start p-1.5">פיצויים</th>
                      <th className="text-start p-1.5 font-bold">סה&quot;כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.deposit_history.map((d, i) => (
                      <tr key={i} className="border-b border-[oklch(0.18_0.01_250)]">
                        <td className="p-1.5">{d.date}</td>
                        <td className="p-1.5 ltr text-start">{formatCurrency(d.salary)}</td>
                        <td className="p-1.5 ltr text-start">{formatCurrency(d.employer)}</td>
                        <td className="p-1.5 ltr text-start">{formatCurrency(d.employee)}</td>
                        <td className="p-1.5 ltr text-start">{formatCurrency(d.severance)}</td>
                        <td className="p-1.5 ltr text-start font-semibold">{formatCurrency(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
