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
    return <div className="text-[var(--text-secondary)] text-[13px]">אין מספיק נתונים היסטוריים</div>
  }

  return (
    <div dir="ltr">
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          formatter={(v: unknown) => formatCurrency(Number(v))}
          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 12, color: 'var(--c-0-85)' }}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.isCurrent ? 'var(--accent-blue)' : 'var(--c-0-30)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  )
}
