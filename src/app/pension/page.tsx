'use client'

import { formatCurrency } from '@/lib/utils'

const PENSION_SNAPSHOT = {
  date: '31/01/2026',
  total: 451046,
  monthly_deposit: 7050,
  insurance_premium: 258,
  products: [
    { name: 'קרן פנסיה מקיפה - הראל', balance: 292300, active: true, monthly: 4478, type: 'pension' },
    { name: 'קרן השתלמות - אלטשולר שחם', balance: 92276, active: true, monthly: 1571, type: 'study' },
    { name: 'קופ"ג להשקעה - הראל', balance: 31372, active: true, monthly: 1000, type: 'invest' },
    { name: 'קופ"ג תגמולים (2 קרנות) - הראל', balance: 35100, active: false, monthly: 0, type: 'other' },
  ],
}

const typeColors: Record<string, string> = {
  pension: 'oklch(0.65 0.18 250)',
  study: 'oklch(0.70 0.18 145)',
  invest: 'oklch(0.68 0.18 295)',
  other: 'oklch(0.60 0.01 250)',
}

export default function PensionPage() {
  const activeTotal = PENSION_SNAPSHOT.products.filter(p => p.active).reduce((s, p) => s + p.balance, 0)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>📈 פנסיה והשקעות</h1>
        <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginTop: 4 }}>נכון ל-{PENSION_SNAPSHOT.date} | מוכן ע&quot;י אלמוג רובין</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'סך חיסכון', value: formatCurrency(PENSION_SNAPSHOT.total), color: 'oklch(0.65 0.18 250)' },
          { label: 'פקדות חודשיות', value: formatCurrency(PENSION_SNAPSHOT.monthly_deposit), color: 'oklch(0.70 0.18 145)' },
          { label: 'פרמיית ביטוח', value: formatCurrency(PENSION_SNAPSHOT.insurance_premium), color: 'oklch(0.72 0.18 55)' },
          { label: 'מוצרים פעילים', value: `${PENSION_SNAPSHOT.products.filter(p => p.active).length}`, color: 'oklch(0.68 0.18 295)' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12, color: 'oklch(0.60 0.01 250)', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, direction: 'ltr' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Products */}
      <div style={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>מוצרי חיסכון</div>
        {PENSION_SNAPSHOT.products.map(p => {
          const pct = (p.balance / PENSION_SNAPSHOT.total) * 100
          return (
            <div key={p.name} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: p.active ? 'oklch(0.20 0.06 145)' : 'oklch(0.20 0.01 250)', color: p.active ? 'oklch(0.70 0.18 145)' : 'oklch(0.55 0.01 250)' }}>
                    {p.active ? 'פעיל' : 'לא פעיל'}
                  </span>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, direction: 'ltr', fontSize: 15 }}>{formatCurrency(p.balance)}</div>
                  {p.monthly > 0 && <div style={{ fontSize: 11, color: 'oklch(0.60 0.01 250)', direction: 'ltr' }}>{formatCurrency(p.monthly)}/חודש</div>}
                </div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%`, background: typeColors[p.type] }} />
              </div>
              <div style={{ fontSize: 11, color: 'oklch(0.55 0.01 250)', marginTop: 3, direction: 'ltr', textAlign: 'left' }}>{pct.toFixed(1)}%</div>
            </div>
          )
        })}
      </div>

      {/* Upload note */}
      <div style={{ background: 'oklch(0.14 0.02 250)', border: '1px dashed oklch(0.30 0.05 250)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>העלאת דוח חדש</div>
        <div style={{ fontSize: 13, color: 'oklch(0.60 0.01 250)', marginBottom: 14 }}>כל חודש העלה את הדוח החדש מאלמוג ויתעדכן אוטומטית</div>
        <div style={{ fontSize: 12, color: 'oklch(0.50 0.01 250)' }}>🔜 יהיה זמין בקרוב</div>
      </div>
    </div>
  )
}
