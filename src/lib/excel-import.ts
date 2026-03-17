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
        const catKey = keys.find(k => /קטגוריה|category/i.test(k))
        const typeKey = keys.find(k => /אישי|משותף|סוג|type/i.test(k))

        const parsed: RawExpenseRow[] = rows
          .map(row => {
            const typeVal = typeKey ? String(row[typeKey] ?? '').trim() : ''
            return {
              date: String(row[dateKey] ?? ''),
              description: String(row[descKey] ?? '').trim(),
              amount: Math.abs(parseFloat(String(row[amountKey] ?? '0').replace(/[^\d.]/g, '')) || 0),
              category: catKey ? String(row[catKey] ?? '').trim() || undefined : undefined,
              is_shared: typeVal === 'משותף' || typeVal === 'shared',
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
export function createExpenseTemplate(categories: string[]): Blob {
  const wb = XLSX.utils.book_new()

  // עמודות A-E: נתוני הוצאה | עמודה G: רשימת קטגוריות לעיון
  const headers = ['תאריך', 'תיאור עסק', 'סכום (₪)', 'קטגוריה', 'אישי / משותף', '', 'קטגוריות זמינות']
  const examples = [
    ['15/01/2025', 'סופרסל', '250', categories[0] ?? 'מזון', 'אישי', '', categories[0] ?? ''],
    ['16/01/2025', 'תחנת דלק', '300', categories[1] ?? 'דלק', 'אישי', '', categories[1] ?? ''],
    ['17/01/2025', 'ארוחת צהריים ביחד', '120', categories[2] ?? 'מסעדות', 'משותף', '', categories[2] ?? ''],
  ]

  // שאר הקטגוריות בעמודה G (מהשורה הרביעית)
  const maxRows = Math.max(examples.length, categories.length)
  const rows: (string | number)[][] = []
  for (let i = 0; i < maxRows; i++) {
    if (i < examples.length) {
      const row = [...examples[i]]
      // אם יש קטגוריה נוספת בשורה זו (מעבר לאלו שכבר ב-examples)
      if (i >= 3 && categories[i]) row[6] = categories[i]
      rows.push(row)
    } else {
      // שורה ריקה עם קטגוריה נוספת רק בעמודה G
      rows.push(['', '', '', '', '', '', categories[i] ?? ''])
    }
  }

  // הוסף שאר הקטגוריות שלא נכנסו לדוגמאות
  for (let i = examples.length; i < categories.length; i++) {
    rows[i] = rows[i] ?? ['', '', '', '', '', '', '']
    rows[i][6] = categories[i]
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  ws['!cols'] = [
    { wch: 14 }, // תאריך
    { wch: 28 }, // תיאור עסק
    { wch: 12 }, // סכום
    { wch: 22 }, // קטגוריה
    { wch: 16 }, // אישי/משותף
    { wch: 2  }, // רווח
    { wch: 25 }, // קטגוריות זמינות
  ]

  // הדגש כותרת עמודה G
  ws['G1'] = { v: 'קטגוריות זמינות', t: 's' }

  XLSX.utils.book_append_sheet(wb, ws, 'הוצאות')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
