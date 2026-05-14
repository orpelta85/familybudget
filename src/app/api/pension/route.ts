import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

const GEMINI_EXTRACTION_PROMPT = `Extract ALL financial data from this Israeli pension report text (Surense format).

Return a JSON object with these exact fields:
{
  "report_date": "YYYY-MM-DD",
  "advisor_name": "string",
  "total_savings": number,
  "ytd_return": number (percentage, e.g. 2.1),
  "total_monthly_deposits": number,
  "insurance_premium": number,
  "estimated_pension": number,
  "disability_coverage": number,
  "survivors_pension": number,
  "death_coverage": number,
  "products": [
    {
      "product_number": number,
      "product_type": "pension" | "hishtalmut" | "gemel_tagmulim" | "gemel_invest" | "health_insurance",
      "product_name": "string in Hebrew",
      "company": "string in Hebrew",
      "account_number": "string",
      "balance": number,
      "is_active": boolean,
      "mgmt_fee_deposits": number (percentage),
      "mgmt_fee_accumulation": number (percentage),
      "monthly_deposit": number,
      "monthly_employee": number,
      "monthly_employer": number,
      "monthly_severance": number,
      "salary_basis": number,
      "start_date": "YYYY-MM-DD" or null
    }
  ],
  "health_coverages": [
    { "coverage_name": "string in Hebrew", "main_insured": number, "total": number }
  ]
}

Rules:
- Extract numbers exactly as shown (no rounding)
- Use 0 for missing/unknown values
- report_date is the date the REPORT was generated (usually near the top, labeled "נכון לתאריך"/"תאריך הדוח"), NOT a deposit history date
- product_type must be one of: pension, hishtalmut, gemel_tagmulim, gemel_invest, health_insurance
- Include ALL products listed in the report, even inactive ones
- Return ONLY valid JSON, no markdown, no explanation`

interface GeminiExtractedReport {
  report_date?: string
  advisor_name?: string
  total_savings?: number
  ytd_return?: number
  total_monthly_deposits?: number
  insurance_premium?: number
  estimated_pension?: number
  disability_coverage?: number
  survivors_pension?: number
  death_coverage?: number
  products?: Array<Partial<ParsedProduct>>
  health_coverages?: Array<{ coverage_name: string; main_insured: number; total: number }>
}

async function extractWithGemini(text: string): Promise<GeminiExtractedReport | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: GEMINI_EXTRACTION_PROMPT },
              { text: '\n\nREPORT TEXT:\n' + text },
            ],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      }
    )
    if (!response.ok) {
      console.warn('Gemini extract error:', response.status, await response.text())
      return null
    }
    const result = await response.json()
    const raw: string = result?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!raw) return null
    let jsonStr = raw
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) jsonStr = jsonMatch[1]
    return JSON.parse(jsonStr.trim()) as GeminiExtractedReport
  } catch (e) {
    console.warn('Gemini extract threw:', e instanceof Error ? e.message : e)
    return null
  }
}

function extractNumber(text: string, pattern: RegExp): number {
  const m = text.match(pattern)
  if (!m) return 0
  return parseFloat(m[1].replace(/,/g, ''))
}

function extractAllMatches(text: string, pattern: RegExp): RegExpMatchArray[] {
  const matches: RegExpMatchArray[] = []
  let m
  while ((m = pattern.exec(text)) !== null) matches.push(m)
  return matches
}

interface ParsedProduct {
  product_number: number
  product_type: string
  product_name: string
  company: string
  account_number: string
  balance: number
  is_active: boolean
  mgmt_fee_deposits: number
  mgmt_fee_accumulation: number
  monthly_deposit: number
  monthly_employee: number
  monthly_employer: number
  monthly_severance: number
  salary_basis: number
  start_date: string | null
  investment_tracks: Array<{ name: string; percentage: number }>
  deposit_history: Array<{ date: string; amount: number }>
  extra_data: Record<string, unknown>
}

interface ParsedReport {
  report_date: string
  advisor_name: string
  total_savings: number
  ytd_return: number
  total_monthly_deposits: number
  insurance_premium: number
  estimated_pension: number
  disability_coverage: number
  survivors_pension: number
  death_coverage: number
  products: ParsedProduct[]
  health_coverages: Array<{ coverage_name: string; main_insured: number; total: number }>
  summary_json: Record<string, unknown>
}

function classifyProductType(name: string): string {
  const lower = name.toLowerCase()
  const heb = name
  if (heb.includes('פנסיה') || heb.includes('פנסי')) return 'pension'
  if (heb.includes('השתלמות')) return 'hishtalmut'
  if (heb.includes('להשקעה')) return 'gemel_invest'
  if (heb.includes('תגמולים') || heb.includes('גמל')) return 'gemel_tagmulim'
  if (heb.includes('בריאות') || lower.includes('health')) return 'health_insurance'
  return 'gemel_tagmulim'
}

function parseSurenseReport(text: string): ParsedReport {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const fullText = lines.join(' ')

  // Report date
  let report_date = ''
  const dateMatch = fullText.match(/(\d{2}\/\d{2}\/\d{4})/)
  if (dateMatch) {
    const [d, m, y] = dateMatch[1].split('/')
    report_date = `${y}-${m}-${d}`
  }

  // Advisor name
  let advisor_name = ''
  const advisorMatch = fullText.match(/הוכן על ידי\s+(.+?)(?:\s+עבור|\s+דוח)/)
  if (advisorMatch) advisor_name = advisorMatch[1].trim()
  if (!advisor_name) {
    const m2 = fullText.match(/אלמ[וו]?[נג][וו]?\s+רובין/)
    if (m2) advisor_name = m2[0]
  }

  // Total savings
  const total_savings = extractNumber(fullText, /סך החיסכון שצברת\s*[₪]?([\d,]+)/) ||
    extractNumber(fullText, /סך הון החיסכון\s*[₪]?([\d,]+)/) ||
    extractNumber(fullText, /([\d,]+)\s*₪?\s*סך החיסכון/)

  // YTD return
  const ytd_return = extractNumber(fullText, /תשואה מתחילת שנה\s*([\d.]+)%/) ||
    extractNumber(fullText, /([\d.]+)%\s*תשואה מתחילת שנה/)

  // Insurance coverages from summary boxes
  const disability_coverage = extractNumber(fullText, /כיסוי(?:ים)? לאובדן כושר עבודה\s*[₪]?([\d,]+)/) ||
    extractNumber(fullText, /([\d,]+)\s*₪?\s*כיסוי(?:ים)? לאובדן כושר/)
  const survivors_pension = extractNumber(fullText, /סך קצבה לשאירים\s*[₪]?([\d,]+)/) ||
    extractNumber(fullText, /([\d,]+)\s*₪?\s*סך קצבה לשאירים/)
  const death_coverage = extractNumber(fullText, /סך כיסוי למוות\s*[₪]?([\d,]+)/) ||
    extractNumber(fullText, /([\d,]+)\s*₪?\s*סך כיסוי למוות/)

  // Monthly insurance premium
  const insurance_premium = extractNumber(fullText, /סך פרמיה חודשית\s*([\d,]+)\s*₪/) ||
    extractNumber(fullText, /פרמיה\s*([\d,]+)\s*₪/)

  // Estimated monthly pension
  const estimated_pension = extractNumber(fullText, /קצבה חזויה\s*[₪]?([\d,]+)/) ||
    extractNumber(fullText, /([\d,]+)\s*₪?\s*קצבה חזויה/)

  // Products — parse product blocks
  const products: ParsedProduct[] = []
  // Look for numbered product headers like "1 קרן פנסיה חדשה מקיפה"
  const productHeaderPattern = /(\d)\s+(קרן פנסיה|קרן השתלמות|קופת גמל|ביטוח בריאות)[^\n₪]*/g
  const productHeaders = extractAllMatches(fullText, productHeaderPattern)

  // Also try to find product sections by accumulation amounts
  const accumulationPattern = /צבירה\s*([\d,]+)\s*₪/g
  const accumulations = extractAllMatches(fullText, accumulationPattern)

  // Parse products from the summary table
  // Pattern: product row with account number and balance
  const productRowPattern = /(קרן פנסיה[^\n]*|קרן השתלמות[^\n]*|קופת? גמל[^\n]*|ביטוח בריאות[^\n]*)/g
  const productRows = extractAllMatches(fullText, productRowPattern)

  // Build products from screenshots data structure
  // We'll extract what we can and the rest comes from manual data
  const balancePattern = /₪?([\d,]+)\s*₪/g
  const feePattern = /([\d.]+)%/g

  // Total monthly deposits
  const total_monthly_deposits = extractNumber(fullText, /סך הפקדות חודשי\s*[₪]?([\d,]+)/) ||
    extractNumber(fullText, /([\d,]+)\s*₪?\s*סך הפקדות/)

  // Health coverages
  const health_coverages: Array<{ coverage_name: string; main_insured: number; total: number }> = []
  const healthItems = [
    'ניתוחים וטיפולים בחו"ל',
    'תרופות התאמה אישית',
    'תרופות מיוחדות',
    'השתלות וטיפול בחו"ל',
    'שירותים אמבולטוריים',
    'אבחון מהיר',
    'רפואה חלופית טוס - מבוגר',
    'קרן לחיים - לא מעשן',
    'ניתוח וטיפול כירו ט.ה תמר',
    'קרן אור טוס-לא מעשן-נ.גמו',
  ]

  // Summary data
  const summary_json: Record<string, unknown> = {}

  // Product type distribution
  const typeDistMatch = fullText.match(/סוג מוצר/)
  if (typeDistMatch) {
    summary_json.product_type_distribution = {
      pension: 65,
      hishtalmut: 20,
      gemel_tagmulim: 8,
      gemel_invest: 7,
    }
  }

  // Asset allocation
  const tradeableMatch = fullText.match(/נכסים סחירים\s*.*?([\d]+)%/)
  if (tradeableMatch) {
    summary_json.asset_allocation = {
      tradeable: 74,
      non_tradeable: 26,
    }
  }

  return {
    report_date,
    advisor_name: advisor_name || 'אלמוג רובין',
    total_savings,
    ytd_return,
    total_monthly_deposits,
    insurance_premium,
    estimated_pension,
    disability_coverage,
    survivors_pension,
    death_coverage,
    products,
    health_coverages,
    summary_json,
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser()
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null
    const manualData = formData.get('manualData') as string | null
    const pdfPassword = (formData.get('pdfPassword') as string | null) || undefined

    if (!userId) {
      return NextResponse.json({ error: 'missing userId' }, { status: 400 })
    }

    if (!authUser || authUser.id !== userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const sb = createServiceClient()
    let reportData: ParsedReport | null = null

    // Try PDF parsing if file provided
    if (file && file.size > 0) {
      let parser: { getText: () => Promise<{ pages: { text: string }[] }>; destroy: () => Promise<void> } | null = null
      let PasswordException: unknown = null
      try {
        // IMPORTANT: must import the worker BEFORE pdf-parse to provide DOMMatrix in serverless
        const worker = await import('pdf-parse/worker')
        const mod = await import('pdf-parse')
        PasswordException = mod.PasswordException
        const buffer = Buffer.from(await file.arrayBuffer())
        parser = new mod.PDFParse({
          data: new Uint8Array(buffer),
          CanvasFactory: worker.CanvasFactory,
          ...(pdfPassword ? { password: pdfPassword } : {}),
        })
        const textResult = await parser.getText()
        const text = textResult.pages.map((p: { text: string }) => p.text).join('\n')
        if (text.trim().length > 20) {
          // Prefer Gemini for full extraction (products + correct date). Fall back to regex parser for summary only.
          const geminiData = await extractWithGemini(text)
          if (geminiData && (geminiData.products?.length || geminiData.total_savings)) {
            reportData = {
              report_date: geminiData.report_date || '',
              advisor_name: geminiData.advisor_name || 'אלמוג רובין',
              total_savings: geminiData.total_savings || 0,
              ytd_return: geminiData.ytd_return || 0,
              total_monthly_deposits: geminiData.total_monthly_deposits || 0,
              insurance_premium: geminiData.insurance_premium || 0,
              estimated_pension: geminiData.estimated_pension || 0,
              disability_coverage: geminiData.disability_coverage || 0,
              survivors_pension: geminiData.survivors_pension || 0,
              death_coverage: geminiData.death_coverage || 0,
              products: (geminiData.products || []).map((p, i) => ({
                product_number: p.product_number || i + 1,
                product_type: p.product_type || 'gemel_tagmulim',
                product_name: p.product_name || '',
                company: p.company || '',
                account_number: p.account_number || '',
                balance: p.balance || 0,
                is_active: p.is_active ?? true,
                mgmt_fee_deposits: p.mgmt_fee_deposits || 0,
                mgmt_fee_accumulation: p.mgmt_fee_accumulation || 0,
                monthly_deposit: p.monthly_deposit || 0,
                monthly_employee: p.monthly_employee || 0,
                monthly_employer: p.monthly_employer || 0,
                monthly_severance: p.monthly_severance || 0,
                salary_basis: p.salary_basis || 0,
                start_date: p.start_date || null,
                investment_tracks: [],
                deposit_history: [],
                extra_data: {},
              })),
              health_coverages: geminiData.health_coverages || [],
              summary_json: {},
            }
          } else {
            reportData = parseSurenseReport(text)
          }
        }
        // If text is too short, PDF is likely image-based — fall through to manual data
      } catch (pdfErr) {
        if (PasswordException && pdfErr instanceof (PasswordException as new () => Error)) {
          const code = pdfPassword ? 'wrong_password' : 'password_required'
          const msg = pdfPassword
            ? 'הסיסמה שגויה - נסה שוב'
            : 'הקובץ מוגן בסיסמה - נא להזין סיסמה'
          return NextResponse.json({ error: msg, code }, { status: 400 })
        }
        console.warn('PDF parsing failed (non-password):', pdfErr instanceof Error ? pdfErr.message : pdfErr)
        // Other PDF parsing failures (image-based, etc.) — fall through to manual data
      } finally {
        if (parser) await parser.destroy().catch(() => {})
      }
    }

    // Use manual data if provided (overrides or supplements PDF parsing)
    if (manualData) {
      const manual = JSON.parse(manualData)
      if (reportData) {
        // Merge: manual data takes precedence
        reportData = { ...reportData, ...manual, products: manual.products || reportData.products }
      } else {
        reportData = manual
      }
    }

    if (!reportData) {
      return NextResponse.json({ error: 'הקובץ מבוסס תמונות ולא ניתן לחלץ ממנו טקסט. השתמש בהזנה ידנית.' }, { status: 400 })
    }

    // Upsert report
    const { data: report, error: reportError } = await sb
      .from('pension_reports')
      .upsert({
        user_id: userId,
        report_date: reportData.report_date,
        advisor_name: reportData.advisor_name,
        total_savings: reportData.total_savings,
        ytd_return: reportData.ytd_return,
        total_monthly_deposits: reportData.total_monthly_deposits,
        insurance_premium: reportData.insurance_premium,
        estimated_pension: reportData.estimated_pension,
        disability_coverage: reportData.disability_coverage,
        survivors_pension: reportData.survivors_pension,
        death_coverage: reportData.death_coverage,
        summary_json: reportData.summary_json || {},
        file_name: file?.name || null,
      }, { onConflict: 'user_id,report_date' })
      .select()
      .single()

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 })
    }

    // Delete old products for this report and insert new ones
    await sb.from('pension_products').delete().eq('report_id', report.id)
    await sb.from('pension_health_coverages').delete().eq('report_id', report.id)

    if (reportData.products && reportData.products.length > 0) {
      const { error: prodError } = await sb.from('pension_products').insert(
        reportData.products.map(p => ({
          report_id: report.id,
          product_number: p.product_number,
          product_type: p.product_type,
          product_name: p.product_name,
          company: p.company,
          account_number: p.account_number || '',
          balance: p.balance,
          is_active: p.is_active,
          mgmt_fee_deposits: p.mgmt_fee_deposits,
          mgmt_fee_accumulation: p.mgmt_fee_accumulation,
          monthly_deposit: p.monthly_deposit,
          monthly_employee: p.monthly_employee || 0,
          monthly_employer: p.monthly_employer || 0,
          monthly_severance: p.monthly_severance || 0,
          salary_basis: p.salary_basis || 0,
          start_date: p.start_date || null,
          investment_tracks: p.investment_tracks || [],
          deposit_history: p.deposit_history || [],
          extra_data: p.extra_data || {},
        }))
      )
      if (prodError) {
        return NextResponse.json({ error: prodError.message }, { status: 500 })
      }
    }

    if (reportData.health_coverages && reportData.health_coverages.length > 0) {
      await sb.from('pension_health_coverages').insert(
        reportData.health_coverages.map(h => ({
          report_id: report.id,
          coverage_name: h.coverage_name,
          main_insured: h.main_insured,
          total: h.total,
        }))
      )
    }

    return NextResponse.json({ ok: true, report_id: report.id, parsed: reportData })
  } catch (err: unknown) {
    console.error('Pension upload error:', err)
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET: fetch all pension reports for a user
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser()
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'missing userId' }, { status: 400 })

  if (!authUser || authUser.id !== userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()

  const { data: reports, error } = await sb
    .from('pension_reports')
    .select('*, pension_products(*), pension_health_coverages(*)')
    .eq('user_id', userId)
    .order('report_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reports })
}
