'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface TrendEntry {
  label: string
  total: number
  isCurrent: boolean
}

export function IncomeTrendChart({ data }: { data: TrendEntry[] }) {
  if (data.length < 2) {
    return <div style={{ color: 'oklch(0.65 0.01 250)', fontSize: 13 }}>אין מספיק נתונים היסטוריים</div>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fill: 'oklch(0.65 0.01 250)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          formatter={(v: unknown) => formatCurrency(Number(v))}
          contentStyle={{ background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, fontSize: 12, color: 'oklch(0.85 0.01 250)' }}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.isCurrent ? 'oklch(0.65 0.18 250)' : 'oklch(0.30 0.01 250)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
