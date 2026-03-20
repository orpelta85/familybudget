// ── Shared expenses Excel ─────────────────────────────────────────────────────

async function getXLSX() {
  return await import('xlsx')
}

export interface RawSharedRow {
  label: string
  total_amount: number
}

export async function createSharedTemplate(categoryLabels: string[]): Promise<Blob> {
  const XLSX = await getXLSX()
  const wb = XLSX.utils.book_new()
  const headers = ['קטגוריה', 'סכום כולל (₪)', 'הערות']
  const rows = categoryLabels.map(label => [label, '', ''])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, ws, 'הוצאות משותפות')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export async function parseSharedExcel(file: File): Promise<RawSharedRow[]> {
  const XLSX = await getXLSX()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        const keys = rows[0] ? Object.keys(rows[0]) : []
        const labelKey = keys.find(k => /קטגוריה|שם|category/i.test(k)) ?? keys[0]
        const amountKey = keys.find(k => /סכום|amount|כולל/i.test(k)) ?? keys[1]
        const parsed: RawSharedRow[] = rows
          .map(r => ({
            label: String(r[labelKey] ?? '').trim(),
            total_amount: Math.abs(parseFloat(String(r[amountKey] ?? '0').replace(/[^\d.]/g, '')) || 0),
          }))
          .filter(r => r.label && r.total_amount > 0)
        resolve(parsed)
      } catch (err) { reject(err) }
    }
    reader.readAsArrayBuffer(file)
  })
}

export interface RawExpenseRow {
  date: string
  description: string
  amount: number
  category?: string
  is_shared?: boolean
  fund_name?: string   // אם מולא — גם הוצאה מקרן
}

// Israeli bank/credit card format detection
interface DetectedFormat {
  name: string
  label: string
}

const BANK_FORMATS: { pattern: RegExp; name: string; label: string }[] = [
  { pattern: /ויזה.?כאל|cal.*visa|visa.*cal/i, name: 'visa_cal', label: 'ויזה כאל' },
  { pattern: /ישראכרט|isracard/i, name: 'isracard', label: 'ישראכרט' },
  { pattern: /מקס|max/i, name: 'max', label: 'מקס' },
  { pattern: /לאומי.?קארד|leumi.*card/i, name: 'leumi_card', label: 'לאומי קארד' },
  { pattern: /בנק.?לאומי|leumi/i, name: 'leumi', label: 'בנק לאומי' },
  { pattern: /הפועלים|hapoalim/i, name: 'hapoalim', label: 'בנק הפועלים' },
  { pattern: /דיסקונט|discount/i, name: 'discount', label: 'בנק דיסקונט' },
  { pattern: /מזרחי|mizrahi|טפחות/i, name: 'mizrahi', label: 'מזרחי טפחות' },
]

function detectBankFormat(keys: string[], sheetName: string): DetectedFormat | null {
  const allText = [...keys, sheetName].join(' ')
  for (const fmt of BANK_FORMATS) {
    if (fmt.pattern.test(allText)) return { name: fmt.name, label: fmt.label }
  }
  // Heuristic: credit card format detection by column patterns
  if (keys.some(k => /שם.?בית.?עסק/i.test(k)) && keys.some(k => /סכום.?חיוב/i.test(k))) {
    return { name: 'credit_card', label: 'פירוט כרטיס אשראי' }
  }
  if (keys.some(k => /תאריך.?ערך/i.test(k)) && keys.some(k => /אסמכתא/i.test(k))) {
    return { name: 'bank_statement', label: 'פירוט חשבון בנק' }
  }
  return null
}

export interface ParseResult {
  rows: RawExpenseRow[]
  detectedFormat: DetectedFormat | null
  totalAmount: number
  totalCount: number
}

// פירוט אשראי ישראלי — מנסה לזהות עמודות שונות
export async function parseExpenseExcel(file: File): Promise<RawExpenseRow[]> {
  const result = await parseExpenseExcelDetailed(file)
  return result.rows
}

export async function parseExpenseExcelDetailed(file: File): Promise<ParseResult> {
  const XLSX = await getXLSX()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = wb.SheetNames[0]
        const sheet = wb.Sheets[sheetName]
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (!rows.length) { resolve({ rows: [], detectedFormat: null, totalAmount: 0, totalCount: 0 }); return }

        // זיהוי עמודות — תומך בפורמטים של ישראכרט, ויזה, מאסטרקארד, לאומי, פועלים, כאל, מקס
        const firstRow = rows[0]
        const keys = Object.keys(firstRow)

        // Detect format
        const detectedFormat = detectBankFormat(keys, sheetName)

        const dateKey   = keys.find(k => /תאריך.?עסקה|תאריך.?חיוב|תאריך|date/i.test(k)) ?? keys[0]
        const descKey   = keys.find(k => /שם.?בית.?עסק|שם.?עסק|עסק|בית.?עסק|שם|תיאור|פירוט|description|merchant/i.test(k)) ?? keys[1]
        const amountKey = keys.find(k => /סכום.?חיוב|סכום.?עסקה|סכום|חיוב|amount|sum|סה.?כ/i.test(k)) ?? keys[2]
        const catKey    = keys.find(k => /קטגוריה|category|סוג.?הוצאה|ענף|קטגורי/i.test(k))
        const typeKey   = keys.find(k => /אישי|משותף|סוג|type|personal|shared/i.test(k)) ?? keys[4]
        const fundKey   = keys.find(k => /קרן|fund/i.test(k)) ?? keys[5]

        const parsed: RawExpenseRow[] = rows
          .map(row => {
            const rawTypeVal = typeKey ? String(row[typeKey] ?? '') : ''
            const typeVal = rawTypeVal.trim().replace(/[\u200f\u200e\u202a\u202b\u202c]/g, '')
            const fundVal = fundKey ? String(row[fundKey] ?? '').trim() : ''
            return {
              date: String(row[dateKey] ?? ''),
              description: String(row[descKey] ?? '').trim(),
              amount: Math.abs(parseFloat(String(row[amountKey] ?? '0').replace(/[^\d.]/g, '')) || 0),
              category: catKey ? String(row[catKey] ?? '').trim() || undefined : undefined,
              is_shared: typeVal.length > 0 && !/אישי|personal/i.test(typeVal),
              fund_name: fundVal || undefined,
            }
          })
          .filter(r => r.amount > 0 && r.description)

        const totalAmount = parsed.reduce((s, r) => s + r.amount, 0)

        resolve({
          rows: parsed,
          detectedFormat,
          totalAmount,
          totalCount: parsed.length,
        })
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// יוצר קובץ Excel תבנית להוצאות — הכל בגיליון אחד
// A-F: נתוני הוצאה | H: קטגוריות לעיון | I: קרנות לעיון
export async function createExpenseTemplate(categories: string[], funds: string[] = []): Promise<Blob> {
  const XLSX = await getXLSX()
  const wb = XLSX.utils.book_new()

  const headers = ['תאריך', 'תיאור עסק', 'סכום (₪)', 'קטגוריה', 'אישי / משותף', 'קרן (אופציונלי)', '', 'קטגוריות זמינות', 'קרנות זמינות']
  const examples = [
    ['15/01/2025', 'סופרסל',            '250', categories[0] ?? 'מזון',      'אישי',    '',           '', categories[0] ?? '', funds[0] ?? ''],
    ['16/01/2025', 'ביטוח רכב',         '150', categories[1] ?? 'רכב',       'משותף',   funds[0] ?? '','', categories[1] ?? '', funds[1] ?? ''],
    ['17/01/2025', 'ארוחת צהריים ביחד', '120', categories[2] ?? 'מסעדות',   'משותף',   '',           '', categories[2] ?? '', funds[2] ?? ''],
  ]

  const maxRef = Math.max(categories.length, funds.length)
  const rows: (string | number)[][] = examples.map((r, i) => {
    const row = [...r]
    if (i < categories.length) row[7] = categories[i]
    if (i < funds.length)      row[8] = funds[i]
    return row
  })

  // שאר הרפרנסים מהשורה הרביעית
  for (let i = examples.length; i < maxRef; i++) {
    rows.push(['', '', '', '', '', '', '', categories[i] ?? '', funds[i] ?? ''])
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  ws['!cols'] = [
    { wch: 14 }, // A תאריך
    { wch: 28 }, // B תיאור עסק
    { wch: 12 }, // C סכום
    { wch: 22 }, // D קטגוריה
    { wch: 16 }, // E אישי/משותף
    { wch: 20 }, // F קרן
    { wch: 2  }, // G רווח
    { wch: 24 }, // H קטגוריות זמינות
    { wch: 22 }, // I קרנות זמינות
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'הוצאות')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
