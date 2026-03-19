'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface DonutEntry {
  name: string
  value: number
  color: string
}

export function ExpenseDonut({ data }: { data: DonutEntry[] }) {
  if (data.length === 0) {
    return <div style={{ color: 'oklch(0.65 0.01 250)', fontSize: 13 }}>אין נתונים</div>
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
          </Pie>
          <Tooltip
            formatter={(v: unknown) => formatCurrency(Number(v))}
            contentStyle={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, fontSize: 12, color: 'oklch(0.85 0.01 250)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginTop: 4 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <span style={{ color: 'oklch(0.70 0.01 250)' }}>{d.name}</span>
            <span style={{ color: 'oklch(0.65 0.01 250)', direction: 'ltr' }}>{formatCurrency(d.value)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
