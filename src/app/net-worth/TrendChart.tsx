'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { NetWorthSnapshot } from '@/lib/queries/useNetWorth'

export function TrendChart({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  if (snapshots.length === 0) {
    return <div className="text-[oklch(0.65_0.01_250)] text-[13px]">אין נתוני היסטוריה</div>
  }

  const data = snapshots.map(s => ({
    date: new Date(s.snapshot_date).toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }),
    netWorth: Number(s.net_worth),
    assets: Number(s.total_assets),
    liabilities: Number(s.total_liabilities),
    liquid: Number(s.liquid_total),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 250)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'oklch(0.55 0.01 250)', fontSize: 11 }}
          axisLine={{ stroke: 'oklch(0.25 0.01 250)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'oklch(0.55 0.01 250)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          width={50}
        />
        <Tooltip
          formatter={(v: unknown) => formatCurrency(Number(v))}
          contentStyle={{
            background: 'oklch(0.16 0.01 250)',
            border: '1px solid oklch(0.28 0.01 250)',
            borderRadius: 8,
            fontSize: 12,
            color: 'oklch(0.85 0.01 250)',
          }}
          labelStyle={{ color: 'oklch(0.65 0.01 250)' }}
        />
        <Line type="monotone" dataKey="netWorth" stroke="oklch(0.70 0.18 145)" strokeWidth={2} dot={false} name="שווי נקי" />
        <Line type="monotone" dataKey="assets" stroke="oklch(0.65 0.18 250)" strokeWidth={1.5} dot={false} name="נכסים" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="liquid" stroke="oklch(0.65 0.15 180)" strokeWidth={1.5} dot={false} name="נזיל" strokeDasharray="4 4" />
      </LineChart>
    </ResponsiveContainer>
  )
}
