import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth'

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

  // Convert image to base64
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mimeType = file.type || 'image/png'

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64 },
            },
            {
              type: 'text',
              text: `Extract ALL financial data from this Israeli pension report image (Surense format).

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
            }
          ]
        }]
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `Claude API error: ${err}` }, { status: 500 })
    }

    const result = await response.json()
    const text = result.content?.[0]?.text || ''

    // Parse JSON from response (might have markdown wrapper)
    let jsonStr = text
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) jsonStr = jsonMatch[1]
    jsonStr = jsonStr.trim()

    const parsed = JSON.parse(jsonStr)
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
