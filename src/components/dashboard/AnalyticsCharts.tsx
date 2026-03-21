'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

interface ChartEntry {
  name: string
  label: string
  income: number
  expenses: number
  net: number
}

const tooltipStyle = {
  contentStyle: {
    background: 'var(--c-0-18)',
    border: '1px solid var(--border-light)',
    borderRadius: 8,
    fontSize: 12,
    direction: 'rtl' as const,
  },
  labelStyle: { color: 'var(--text-body)', fontWeight: 600 },
  itemStyle: { color: 'var(--text-secondary)' },
}

export function IncomeVsExpensesChart({ data }: { data: ChartEntry[] }) {
  return (
    <div dir="ltr">
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={2}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
        <YAxis orientation="right" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false}
          tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}K`} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            name === 'income' ? 'הכנסות' : name === 'expenses' ? 'הוצאות' : String(name),
          ]}
          labelFormatter={(label) => data.find(d => d.name === label)?.label ?? label}
        />
        <Bar dataKey="income" name="income" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expenses" name="expenses" fill="var(--accent-orange)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
    </div>
  )
}

export function NetFlowChart({ data }: { data: ChartEntry[] }) {
  return (
    <div dir="ltr">
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
        <YAxis orientation="right" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false}
          tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}K`} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value) => [formatCurrency(Number(value)), 'תזרים נקי']}
          labelFormatter={(label) => data.find(d => d.name === label)?.label ?? label}
        />
        <Line
          type="monotone" dataKey="net" stroke="var(--accent-green)" strokeWidth={2}
          dot={{ r: 3, fill: 'var(--accent-green)', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  )
}
