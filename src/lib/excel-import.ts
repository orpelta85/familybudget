import * as XLSX from 'xlsx'

// ── Shared expenses Excel ─────────────────────────────────────────────────────

export interface RawSharedRow {
  label: string
  total_amount: number
}

export function createSharedTemplate(categoryLabels: string[]): Blob {
  const wb = XLSX.utils.book_new()
  const headers = ['קטגוריה', 'סכום כולל (₪)', 'הערות']
  const rows = categoryLabels.map(label => [label, '', ''])
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, ws, 'הוצאות משותפות')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function parseSharedExcel(file: File): Promise<RawSharedRow[]> {
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

// פירוט אשראי ישראלי — מנסה לזהות עמודות שונות
export function parseExpenseExcel(file: File): Promise<RawExpenseRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (!rows.length) { resolve([]); return }

        // זיהוי עמודות (ישראכרט / ויזה / מאסטרקארד)
        const firstRow = rows[0]
        const keys = Object.keys(firstRow)

        const dateKey   = keys.find(k => /תאריך|date/i.test(k)) ?? keys[0]
        const descKey   = keys.find(k => /עסק|שם|תיאור|description|merchant/i.test(k)) ?? keys[1]
        const amountKey = keys.find(k => /סכום|חיוב|amount|sum/i.test(k)) ?? keys[2]
        const catKey    = keys.find(k => /קטגוריה|category|סוג הוצאה|קטגורי/i.test(k))
        const typeKey   = keys.find(k => /אישי|משותף|סוג|type/i.test(k))
        const fundKey   = keys.find(k => /קרן|fund/i.test(k))

        const parsed: RawExpenseRow[] = rows
          .map(row => {
            const typeVal = typeKey ? String(row[typeKey] ?? '').trim() : ''
            const fundVal = fundKey ? String(row[fundKey] ?? '').trim() : ''
            return {
              date: String(row[dateKey] ?? ''),
              description: String(row[descKey] ?? '').trim(),
              amount: Math.abs(parseFloat(String(row[amountKey] ?? '0').replace(/[^\d.]/g, '')) || 0),
              category: catKey ? String(row[catKey] ?? '').trim() || undefined : undefined,
              is_shared: typeVal === 'משותף' || typeVal === 'shared',
              fund_name: fundVal || undefined,
            }
          })
          .filter(r => r.amount > 0 && r.description)

        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// יוצר קובץ Excel תבנית להוצאות — הכל בגיליון אחד
// A-F: נתוני הוצאה | H: קטגוריות לעיון | I: קרנות לעיון
export function createExpenseTemplate(categories: string[], funds: string[] = []): Blob {
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
