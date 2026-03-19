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
    background: 'oklch(0.18 0.01 250)',
    border: '1px solid oklch(0.28 0.01 250)',
    borderRadius: 8,
    fontSize: 12,
    direction: 'rtl' as const,
  },
  labelStyle: { color: 'oklch(0.75 0.01 250)', fontWeight: 600 },
  itemStyle: { color: 'oklch(0.65 0.01 250)' },
}

export function IncomeVsExpensesChart({ data }: { data: ChartEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={2}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 250)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 250)' }} axisLine={false} tickLine={false}
          tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}K`} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            name === 'income' ? 'הכנסות' : name === 'expenses' ? 'הוצאות' : String(name),
          ]}
          labelFormatter={(label) => data.find(d => d.name === label)?.label ?? label}
        />
        <Bar dataKey="income" name="income" fill="oklch(0.65 0.18 250)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expenses" name="expenses" fill="oklch(0.72 0.18 55)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function NetFlowChart({ data }: { data: ChartEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 250)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 250)' }} axisLine={false} tickLine={false}
          tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}K`} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value) => [formatCurrency(Number(value)), 'תזרים נקי']}
          labelFormatter={(label) => data.find(d => d.name === label)?.label ?? label}
        />
        <Line
          type="monotone" dataKey="net" stroke="oklch(0.70 0.18 145)" strokeWidth={2}
          dot={{ r: 3, fill: 'oklch(0.70 0.18 145)', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
