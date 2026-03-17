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

        const dateKey = keys.find(k => /תאריך|date/i.test(k)) ?? keys[0]
        const descKey = keys.find(k => /עסק|שם|תיאור|description|merchant/i.test(k)) ?? keys[1]
        const amountKey = keys.find(k => /סכום|חיוב|amount|sum/i.test(k)) ?? keys[2]

        const parsed: RawExpenseRow[] = rows
          .map(row => ({
            date: String(row[dateKey] ?? ''),
            description: String(row[descKey] ?? '').trim(),
            amount: Math.abs(parseFloat(String(row[amountKey] ?? '0').replace(/[^\d.]/g, '')) || 0),
          }))
          .filter(r => r.amount > 0 && r.description)

        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// יוצר קובץ Excel תבנית להוצאות עם עמודת קטגוריה
export function createExpenseTemplate(categories: string[]): Blob {
  const wb = XLSX.utils.book_new()

  const headers = ['תאריך', 'תיאור עסק', 'סכום (₪)', 'קטגוריה']
  const examples = [
    ['15/01/2025', 'סופרסל', '250', 'מזון'],
    ['16/01/2025', 'תחנת דלק', '300', 'דלק'],
    ['17/01/2025', 'בית קפה', '45', 'קפה/מסעדות'],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])

  // רוחב עמודות
  ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 20 }]

  // גיליון קטגוריות
  const catWs = XLSX.utils.aoa_to_sheet([['קטגוריות זמינות'], ...categories.map(c => [c])])
  catWs['!cols'] = [{ wch: 25 }]

  XLSX.utils.book_append_sheet(wb, ws, 'הוצאות')
  XLSX.utils.book_append_sheet(wb, catWs, 'קטגוריות')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
