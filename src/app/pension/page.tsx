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

const S = {
  card: {
    background: 'oklch(0.16 0.01 250)',
    border: '1px solid oklch(0.25 0.01 250)',
    borderRadius: 12,
    padding: 20,
  } as React.CSSProperties,
  input: {
    background: 'oklch(0.22 0.01 250)',
    border: '1px solid oklch(0.28 0.01 250)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'inherit',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    color: 'oklch(0.55 0.01 250)',
    display: 'block',
    marginBottom: 4,
    fontWeight: 500,
  } as React.CSSProperties,
}

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

// ─── Empty product template for the manual form ───
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

  // ─── Derived data ───
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
    return <div style={{ padding: 40, textAlign: 'center', color: 'oklch(0.55 0.01 250)' }}>טוען...</div>
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={22} style={{ color: 'oklch(0.65 0.18 250)' }} />
            פנסיה והשקעות
          </h1>
          {report && (
            <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 13, marginTop: 4 }}>
              נכון ל-{formatDate(report.report_date)} | {report.advisor_name}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowUpload(true)}
          style={{
            background: 'oklch(0.65 0.18 250)',
            color: 'oklch(0.12 0.01 250)',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Upload size={14} />
          העלאת דוח
        </button>
      </div>

      {/* Report selector if multiple reports */}
      {reports && reports.length > 1 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {reports.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setSelectedReportIdx(i)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: i === selectedReportIdx ? '1px solid oklch(0.65 0.18 250)' : '1px solid oklch(0.25 0.01 250)',
                background: i === selectedReportIdx ? 'oklch(0.22 0.05 250)' : 'oklch(0.16 0.01 250)',
                color: i === selectedReportIdx ? 'oklch(0.80 0.10 250)' : 'oklch(0.55 0.01 250)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {formatDate(r.report_date)}
            </button>
          ))}
        </div>
      )}

      {!report ? (
        /* No reports yet — show empty state */
        <div style={{ ...S.card, textAlign: 'center', padding: 60 }}>
          <FileText size={48} style={{ color: 'oklch(0.40 0.01 250)', marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>אין דוחות פנסיה</div>
          <div style={{ fontSize: 14, color: 'oklch(0.55 0.01 250)', marginBottom: 20 }}>
            העלה את הדוח הראשון שלך מהסוכן הפנסיוני
          </div>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              background: 'oklch(0.65 0.18 250)',
              color: 'oklch(0.12 0.01 250)',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            העלאת דוח ראשון
          </button>
        </div>
      ) : (
        <>
          {/* KPIs Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
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
                <div key={kpi.label} style={{ ...S.card, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Icon size={14} style={{ color: kpi.color }} />
                    <span style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', fontWeight: 500 }}>{kpi.label}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color, direction: 'ltr', textAlign: 'left' }}>
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
              <div style={{ ...S.card, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} style={{ color: 'oklch(0.65 0.18 250)' }} />
                  תחזית פרישה
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <div style={{ background: 'oklch(0.14 0.01 250)', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', marginBottom: 6 }}>צבירה צפויה בפרישה</div>
                    <div style={{ fontSize: 18, fontWeight: 700, direction: 'ltr', textAlign: 'left', color: 'oklch(0.65 0.18 250)' }}>
                      {formatCurrency(futureValue)}
                    </div>
                  </div>
                  <div style={{ background: 'oklch(0.14 0.01 250)', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', marginBottom: 6 }}>קצבה חודשית צפויה</div>
                    <div style={{ fontSize: 18, fontWeight: 700, direction: 'ltr', textAlign: 'left', color: 'oklch(0.70 0.18 145)' }}>
                      {formatCurrency(monthlyPension)}
                    </div>
                  </div>
                  <div style={{ background: 'oklch(0.14 0.01 250)', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', marginBottom: 6 }}>יחס החלפה</div>
                    <div style={{ fontSize: 18, fontWeight: 700, direction: 'ltr', textAlign: 'left', color: ratioColor }}>
                      {currentSalary > 0 ? `${replacementRatio.toFixed(0)}%` : 'אין נתון'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'oklch(0.45 0.01 250)', marginTop: 12 }}>
                  * הנחות: תשואה ריאלית 4% שנתי, גיל פרישה 67, 35 שנה לפרישה
                </div>
              </div>
            )
          })()}

          {/* Insurance Coverage Bar */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} style={{ color: 'oklch(0.65 0.18 250)' }} />
              כיסויים ביטוחיים
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'אובדן כושר עבודה', value: report.disability_coverage, Icon: Shield },
                { label: 'קצבה לשאירים', value: report.survivors_pension, Icon: Users },
                { label: 'כיסוי למוות', value: report.death_coverage, Icon: FileText },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'oklch(0.14 0.01 250)',
                  borderRadius: 8,
                  padding: 14,
                }}>
                  <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <item.Icon size={12} />
                    {item.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, direction: 'ltr', textAlign: 'left', color: item.value > 0 ? 'oklch(0.80 0.01 250)' : 'oklch(0.40 0.01 250)' }}>
                    {item.value > 0 ? formatCurrency(item.value) : 'אין כיסוי'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Products — Active */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={16} style={{ color: 'oklch(0.70 0.18 145)' }} />
              מוצרי חיסכון פעילים
            </div>
            {activeProducts.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'oklch(0.50 0.01 250)', fontSize: 13 }}>אין מוצרים פעילים</div>
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

          {/* Products — Inactive */}
          {inactiveProducts.length > 0 && (
            <div style={{ ...S.card, marginBottom: 16, opacity: 0.8 }}>
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, color: 'oklch(0.55 0.01 250)' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            {/* By Product Type */}
            <div style={S.card}>
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>לפי סוג מוצר</div>
              {Object.entries(typeDistribution).sort((a, b) => b[1] - a[1]).map(([type, amount]) => {
                const pct = totalBalance > 0 ? (amount / totalBalance) * 100 : 0
                const color = TYPE_COLORS[type as PensionProductType] || 'oklch(0.60 0.01 250)'
                return (
                  <div key={type} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>{TYPE_LABELS[type as PensionProductType] || type}</span>
                      <span style={{ direction: 'ltr', color }}>{pct.toFixed(0)}% · {formatCurrency(amount)}</span>
                    </div>
                    <div style={{ height: 6, background: 'oklch(0.20 0.01 250)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* By Company */}
            <div style={S.card}>
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>לפי יצרן</div>
              {Object.entries(companyDistribution).sort((a, b) => b[1] - a[1]).map(([company, amount], i) => {
                const pct = totalBalance > 0 ? (amount / totalBalance) * 100 : 0
                const colors = ['oklch(0.65 0.18 250)', 'oklch(0.70 0.18 145)', 'oklch(0.72 0.18 55)', 'oklch(0.68 0.18 295)']
                const color = colors[i % colors.length]
                return (
                  <div key={company} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>{company}</span>
                      <span style={{ direction: 'ltr', color }}>{pct.toFixed(0)}% · {formatCurrency(amount)}</span>
                    </div>
                    <div style={{ height: 6, background: 'oklch(0.20 0.01 250)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Health Insurance Coverages */}
          {healthCoverages.length > 0 && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Heart size={16} style={{ color: 'oklch(0.65 0.15 15)' }} />
                ביטוח בריאות — כיסויים
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid oklch(0.25 0.01 250)' }}>
                      <th style={{ textAlign: 'right', padding: 8, fontWeight: 600 }}>כיסוי</th>
                      <th style={{ textAlign: 'left', padding: 8, fontWeight: 600 }}>מבוטח ראשי</th>
                      <th style={{ textAlign: 'left', padding: 8, fontWeight: 600 }}>סה&quot;כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthCoverages.map(h => (
                      <tr key={h.id} style={{ borderBottom: '1px solid oklch(0.20 0.01 250)' }}>
                        <td style={{ padding: 8 }}>{h.coverage_name}</td>
                        <td style={{ padding: 8, direction: 'ltr', textAlign: 'left' }}>{formatCurrency(h.main_insured)}</td>
                        <td style={{ padding: 8, direction: 'ltr', textAlign: 'left' }}>{formatCurrency(h.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ Upload / Manual Entry Modal ═══ */}
      {showUpload && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: 40,
          overflowY: 'auto',
        }}>
          <div style={{
            background: 'oklch(0.14 0.01 250)',
            borderRadius: 16,
            padding: 28,
            width: '100%',
            maxWidth: 680,
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            border: '1px solid oklch(0.25 0.01 250)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>העלאת דוח פנסיוני</h2>
              <button onClick={() => setShowUpload(false)} aria-label="סגור" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.60 0.01 250)', padding: 8, minWidth: 36, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['image', 'manual', 'pdf'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setUploadMode(mode)}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 8,
                    border: uploadMode === mode ? '1px solid oklch(0.65 0.18 250)' : '1px solid oklch(0.25 0.01 250)',
                    background: uploadMode === mode ? 'oklch(0.22 0.05 250)' : 'oklch(0.18 0.01 250)',
                    color: uploadMode === mode ? 'oklch(0.85 0.10 250)' : 'oklch(0.55 0.01 250)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {mode === 'image' ? <><Camera size={14} style={{ marginLeft: 6 }} /> צילום/תמונה</>
                    : mode === 'manual' ? <><Pencil size={14} style={{ marginLeft: 6 }} /> הזנה ידנית</>
                    : <><FileUp size={14} style={{ marginLeft: 6 }} /> העלאת PDF</>}
                </button>
              ))}
            </div>

            {uploadMode === 'image' ? (
              /* Image Upload with AI */
              <div>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: '2px dashed oklch(0.30 0.05 145)',
                    borderRadius: 12,
                    padding: 40,
                    textAlign: 'center',
                    cursor: 'pointer',
                    marginBottom: 16,
                    background: uploadFile ? 'oklch(0.18 0.03 145)' : 'oklch(0.16 0.01 250)',
                  }}
                >
                  {uploadFile ? (
                    <>
                      <Check size={32} style={{ color: 'oklch(0.70 0.18 145)', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600 }}>{uploadFile.name}</div>
                      <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', marginTop: 4 }}>
                        {(uploadFile.size / 1024).toFixed(0)} KB
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera size={32} style={{ color: 'oklch(0.70 0.18 145)', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600 }}>לחץ לבחירת תמונה של הדוח</div>
                      <div style={{ fontSize: 12, color: 'oklch(0.50 0.01 250)', marginTop: 4 }}>PNG, JPG — צילום מסך או תמונה מהטלפון</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
                <div style={{ fontSize: 12, color: 'oklch(0.50 0.01 250)', marginBottom: 16 }}>
                  * AI קורא את הנתונים מהתמונה אוטומטית. וודא שהתמונה חדה וכל הטקסט קריא.
                </div>
                {imageExtracting && (
                  <div style={{ textAlign: 'center', padding: 16, color: 'oklch(0.70 0.18 145)', fontSize: 14 }}>
                    🔍 קורא את הדוח... נא להמתין
                  </div>
                )}
              </div>
            ) : uploadMode === 'pdf' ? (
              /* PDF Upload */
              <div>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: '2px dashed oklch(0.30 0.05 250)',
                    borderRadius: 12,
                    padding: 40,
                    textAlign: 'center',
                    cursor: 'pointer',
                    marginBottom: 16,
                    background: uploadFile ? 'oklch(0.18 0.03 145)' : 'oklch(0.16 0.01 250)',
                  }}
                >
                  {uploadFile ? (
                    <>
                      <Check size={32} style={{ color: 'oklch(0.70 0.18 145)', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600 }}>{uploadFile.name}</div>
                      <div style={{ fontSize: 12, color: 'oklch(0.55 0.01 250)', marginTop: 4 }}>
                        {(uploadFile.size / 1024).toFixed(0)} KB
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={32} style={{ color: 'oklch(0.45 0.01 250)', marginBottom: 8 }} />
                      <div style={{ fontWeight: 600 }}>לחץ לבחירת קובץ PDF</div>
                      <div style={{ fontSize: 12, color: 'oklch(0.50 0.01 250)', marginTop: 4 }}>או גרור לכאן</div>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
                <div style={{ fontSize: 12, color: 'oklch(0.50 0.01 250)', marginBottom: 16 }}>
                  * ניתוח אוטומטי של דוחות Surense. אם הקובץ מוגן בסיסמה, השתמש בהזנה ידנית.
                </div>
              </div>
            ) : (
              /* Manual Entry Form */
              <div>
                {/* Report header fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={S.label}>תאריך דוח (DD/MM/YYYY)</label>
                    <input style={S.input} value={formDate} onChange={e => setFormDate(e.target.value)} placeholder="31/01/2026" />
                  </div>
                  <div>
                    <label style={S.label}>שם הסוכן</label>
                    <input style={S.input} value={formAdvisor} onChange={e => setFormAdvisor(e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>סך חיסכון שצברת (₪)</label>
                    <input style={S.input} type="number" value={formTotalSavings} onChange={e => setFormTotalSavings(e.target.value)} placeholder="451046" />
                  </div>
                  <div>
                    <label style={S.label}>תשואה מתחילת שנה (%)</label>
                    <input style={S.input} type="number" step="0.1" value={formYtdReturn} onChange={e => setFormYtdReturn(e.target.value)} placeholder="2.1" />
                  </div>
                  <div>
                    <label style={S.label}>סך הפקדות חודשיות (₪)</label>
                    <input style={S.input} type="number" value={formMonthlyDeposits} onChange={e => setFormMonthlyDeposits(e.target.value)} placeholder="7050" />
                  </div>
                  <div>
                    <label style={S.label}>פרמיית ביטוח חודשית (₪)</label>
                    <input style={S.input} type="number" value={formInsurancePremium} onChange={e => setFormInsurancePremium(e.target.value)} placeholder="258" />
                  </div>
                  <div>
                    <label style={S.label}>קצבה חזויה (₪/חודש)</label>
                    <input style={S.input} type="number" value={formEstimatedPension} onChange={e => setFormEstimatedPension(e.target.value)} placeholder="4098" />
                  </div>
                  <div>
                    <label style={S.label}>כיסוי אובדן כושר (₪)</label>
                    <input style={S.input} type="number" value={formDisability} onChange={e => setFormDisability(e.target.value)} placeholder="16750" />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={S.label}>קצבה לשאירים (₪)</label>
                    <input style={S.input} type="number" value={formSurvivors} onChange={e => setFormSurvivors(e.target.value)} placeholder="22334" />
                  </div>
                </div>

                {/* Products */}
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, borderTop: '1px solid oklch(0.25 0.01 250)', paddingTop: 16 }}>
                  מוצרים
                </div>
                {formProducts.map((p, idx) => (
                  <div key={p.product_number} style={{
                    background: 'oklch(0.18 0.01 250)',
                    border: '1px solid oklch(0.22 0.01 250)',
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>מוצר {idx + 1}</span>
                      {formProducts.length > 1 && (
                        <button onClick={() => setFormProducts(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.50 0.01 250)' }}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={S.label}>סוג מוצר</label>
                        <select
                          style={{ ...S.input, cursor: 'pointer' }}
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
                        <label style={S.label}>שם מוצר</label>
                        <input style={S.input} value={p.product_name} onChange={e => updateProduct(idx, 'product_name', e.target.value)} placeholder="קרן פנסיה מקיפה" />
                      </div>
                      <div>
                        <label style={S.label}>חברה</label>
                        <input style={S.input} value={p.company} onChange={e => updateProduct(idx, 'company', e.target.value)} placeholder="הראל" />
                      </div>
                      <div>
                        <label style={S.label}>מספר חשבון</label>
                        <input style={S.input} value={p.account_number} onChange={e => updateProduct(idx, 'account_number', e.target.value)} />
                      </div>
                      <div>
                        <label style={S.label}>צבירה (₪)</label>
                        <input style={S.input} type="number" value={p.balance || ''} onChange={e => updateProduct(idx, 'balance', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={S.label}>הפקדה חודשית כוללת (₪)</label>
                        <input style={S.input} type="number" value={p.monthly_deposit || ''} onChange={e => updateProduct(idx, 'monthly_deposit', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={S.label}>ד&quot;נ הפקדה (%)</label>
                        <input style={S.input} type="number" step="0.01" value={p.mgmt_fee_deposits || ''} onChange={e => updateProduct(idx, 'mgmt_fee_deposits', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={S.label}>ד&quot;נ צבירה (%)</label>
                        <input style={S.input} type="number" step="0.01" value={p.mgmt_fee_accumulation || ''} onChange={e => updateProduct(idx, 'mgmt_fee_accumulation', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={S.label}>הפקדת עובד (₪)</label>
                        <input style={S.input} type="number" value={p.monthly_employee || ''} onChange={e => updateProduct(idx, 'monthly_employee', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={S.label}>הפקדת מעסיק (₪)</label>
                        <input style={S.input} type="number" value={p.monthly_employer || ''} onChange={e => updateProduct(idx, 'monthly_employer', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={S.label}>פיצויים (₪)</label>
                        <input style={S.input} type="number" value={p.monthly_severance || ''} onChange={e => updateProduct(idx, 'monthly_severance', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={S.label}>שכר בסיס (₪)</label>
                        <input style={S.input} type="number" value={p.salary_basis || ''} onChange={e => updateProduct(idx, 'salary_basis', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ ...S.label, marginBottom: 0 }}>פעיל</label>
                        <input type="checkbox" checked={p.is_active} onChange={e => updateProduct(idx, 'is_active', e.target.checked)} />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setFormProducts(prev => [...prev, emptyProduct(prev.length + 1)])}
                  style={{
                    width: '100%',
                    padding: 10,
                    border: '1px dashed oklch(0.30 0.01 250)',
                    borderRadius: 8,
                    background: 'none',
                    color: 'oklch(0.60 0.01 250)',
                    cursor: 'pointer',
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  + הוסף מוצר
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmitReport}
              disabled={uploadMutation.isPending}
              style={{
                width: '100%',
                padding: '12px 24px',
                borderRadius: 10,
                border: 'none',
                background: uploadMutation.isPending ? 'oklch(0.40 0.05 250)' : 'oklch(0.65 0.18 250)',
                color: 'oklch(0.12 0.01 250)',
                cursor: uploadMutation.isPending ? 'wait' : 'pointer',
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {imageExtracting ? 'קורא את הדוח...' : uploadMutation.isPending ? 'שומר...' : uploadMode === 'image' ? 'קרא ושמור דוח' : 'שמור דוח'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Product Card Component ───
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
    <div style={{ marginBottom: 12, background: 'oklch(0.14 0.01 250)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `${color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.product_name}</div>
            <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', display: 'flex', gap: 8, marginTop: 2 }}>
              <span>{p.company}</span>
              {p.account_number && <span>· {p.account_number}</span>}
              <span style={{
                padding: '1px 6px', borderRadius: 999, fontSize: 10,
                background: p.is_active ? 'oklch(0.20 0.06 145)' : 'oklch(0.20 0.01 250)',
                color: p.is_active ? 'oklch(0.70 0.18 145)' : 'oklch(0.50 0.01 250)',
              }}>
                {p.is_active ? 'פעיל' : 'לא פעיל'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 16, direction: 'ltr', color }}>{formatCurrency(p.balance)}</div>
            <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', direction: 'ltr' }}>{pct.toFixed(1)}% מהתיק</div>
          </div>
          {expanded ? <ChevronUp size={16} style={{ color: 'oklch(0.50 0.01 250)' }} /> : <ChevronDown size={16} style={{ color: 'oklch(0.50 0.01 250)' }} />}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'oklch(0.20 0.01 250)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.5s ease' }} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid oklch(0.20 0.01 250)' }}>
          {/* Monthly deposits breakdown */}
          {p.monthly_deposit > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'oklch(0.70 0.01 250)' }}>הפקדות חודשיות</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                {[
                  { label: 'סה"כ', value: p.monthly_deposit },
                  { label: 'עובד', value: p.monthly_employee },
                  { label: 'מעסיק', value: p.monthly_employer },
                  { label: 'פיצויים', value: p.monthly_severance },
                ].filter(item => item.value > 0).map(item => (
                  <div key={item.label} style={{ background: 'oklch(0.18 0.01 250)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: 'oklch(0.50 0.01 250)' }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, direction: 'ltr', textAlign: 'left' }}>{formatCurrency(item.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Management fees */}
          {(p.mgmt_fee_deposits > 0 || p.mgmt_fee_accumulation > 0) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'oklch(0.70 0.01 250)' }}>דמי ניהול</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'oklch(0.50 0.01 250)', marginLeft: 6 }}>מהפקדה:</span>
                  <span style={{ fontWeight: 600 }}>{p.mgmt_fee_deposits}%</span>
                </div>
                <div>
                  <span style={{ color: 'oklch(0.50 0.01 250)', marginLeft: 6 }}>מצבירה:</span>
                  <span style={{ fontWeight: 600 }}>{p.mgmt_fee_accumulation}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Salary basis */}
          {p.salary_basis > 0 && (
            <div style={{ marginBottom: 14, fontSize: 13 }}>
              <span style={{ color: 'oklch(0.50 0.01 250)', marginLeft: 6 }}>שכר בסיס:</span>
              <span style={{ fontWeight: 600, direction: 'ltr' }}>{formatCurrency(p.salary_basis)}</span>
            </div>
          )}

          {/* Investment tracks */}
          {p.investment_tracks && p.investment_tracks.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'oklch(0.70 0.01 250)' }}>מסלולי השקעה</div>
              {p.investment_tracks.map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                  <span>{t.name}</span>
                  <span style={{ fontWeight: 600, color }}>{t.percentage}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Deposit history */}
          {p.deposit_history && p.deposit_history.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'oklch(0.70 0.01 250)' }}>היסטוריית הפקדות</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid oklch(0.22 0.01 250)' }}>
                      <th style={{ textAlign: 'right', padding: 6 }}>תאריך</th>
                      <th style={{ textAlign: 'left', padding: 6 }}>שכר</th>
                      <th style={{ textAlign: 'left', padding: 6 }}>מעסיק</th>
                      <th style={{ textAlign: 'left', padding: 6 }}>עובד</th>
                      <th style={{ textAlign: 'left', padding: 6 }}>פיצויים</th>
                      <th style={{ textAlign: 'left', padding: 6, fontWeight: 700 }}>סה&quot;כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.deposit_history.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid oklch(0.18 0.01 250)' }}>
                        <td style={{ padding: 6 }}>{d.date}</td>
                        <td style={{ padding: 6, direction: 'ltr', textAlign: 'left' }}>{formatCurrency(d.salary)}</td>
                        <td style={{ padding: 6, direction: 'ltr', textAlign: 'left' }}>{formatCurrency(d.employer)}</td>
                        <td style={{ padding: 6, direction: 'ltr', textAlign: 'left' }}>{formatCurrency(d.employee)}</td>
                        <td style={{ padding: 6, direction: 'ltr', textAlign: 'left' }}>{formatCurrency(d.severance)}</td>
                        <td style={{ padding: 6, direction: 'ltr', textAlign: 'left', fontWeight: 600 }}>{formatCurrency(d.total)}</td>
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
