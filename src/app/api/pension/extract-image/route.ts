import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth'

const EXTRACTION_PROMPT = `Extract ALL financial data from this Israeli pension report image (Surense format).

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
- product_type must be one of: pension, hishtalmut, gemel_tagmulim, gemel_invest, health_insurance
- Return ONLY valid JSON, no markdown, no explanation
- If the image doesn't contain pension data, return {"error": "not a pension report"}`

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'no file' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mimeType = file.type || 'image/png'

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  try {
    // Try flash-lite → flash → pro (flash-lite has best free-tier quota)
    const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro']
    let response: Response | null = null
    let lastStatus = 0
    for (const model of models) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: mimeType, data: base64 } },
                { text: EXTRACTION_PROMPT },
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
      if (response.ok) break
      lastStatus = response.status
      if (response.status !== 429 && response.status !== 503) {
        // Non-quota error - log and stop trying other models
        const err = await response.text()
        console.error(`Gemini ${model} error:`, response.status, err)
        break
      }
      console.warn(`Gemini ${model} returned ${response.status}, trying next model`)
    }

    if (!response || !response.ok) {
      const msg = lastStatus === 429 || lastStatus === 503
        ? 'שירות ה-AI עמוס. נסה שוב בעוד דקה.'
        : `שגיאה בשירות AI (${lastStatus})`
      return NextResponse.json({ error: msg }, { status: lastStatus === 429 ? 503 : 500 })
    }

    const result = await response.json()
    const text: string = result?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!text) {
      return NextResponse.json({ error: 'AI לא החזיר תוצאה' }, { status: 500 })
    }

    let jsonStr = text
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) jsonStr = jsonMatch[1]
    jsonStr = jsonStr.trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'תשובת AI אינה JSON תקין' }, { status: 500 })
    }

    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, data: parsed })
  } catch (err) {
    console.error('Pension image extraction error:', err)
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
