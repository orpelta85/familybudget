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
    return <div className="text-[var(--text-secondary)] text-[13px]">אין נתונים</div>
  }

  return (
    <>
      <div dir="ltr">
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
          </Pie>
          <Tooltip
            formatter={(v: unknown) => formatCurrency(Number(v))}
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 12, color: 'var(--c-0-85)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-[5px] mt-1">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-[5px] text-xs">
            <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-[var(--c-0-70)]">{d.name}</span>
            <span className="text-[var(--text-secondary)]">{formatCurrency(d.value)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
