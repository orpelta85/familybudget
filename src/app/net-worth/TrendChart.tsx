'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { NetWorthSnapshot } from '@/lib/queries/useNetWorth'

export function TrendChart({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  if (snapshots.length === 0) {
    return <div className="text-[var(--text-secondary)] text-[13px]">אין נתוני היסטוריה</div>
  }

  const data = snapshots.map(s => ({
    date: new Date(s.snapshot_date).toLocaleDateString('he-IL', { month: 'short', year: '2-digit' }),
    netWorth: Number(s.net_worth),
    assets: Number(s.total_assets),
    liabilities: Number(s.total_liabilities),
    liquid: Number(s.liquid_total),
  }))

  return (
    <div dir="ltr">
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-hover)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border-default)' }}
          tickLine={false}
        />
        <YAxis
          orientation="right"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          width={50}
        />
        <Tooltip
          formatter={(v: unknown) => formatCurrency(Number(v))}
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--c-0-85)',
          }}
          labelStyle={{ color: 'var(--text-secondary)' }}
        />
        <Line type="monotone" dataKey="netWorth" stroke="var(--accent-green)" strokeWidth={2} dot={false} name="שווי נקי" />
        <Line type="monotone" dataKey="assets" stroke="var(--accent-blue)" strokeWidth={1.5} dot={false} name="נכסים" strokeDasharray="4 4" />
        <Line type="monotone" dataKey="liquid" stroke="var(--c-teal-0-65)" strokeWidth={1.5} dot={false} name="נזיל" strokeDasharray="4 4" />
      </LineChart>
    </ResponsiveContainer>
    </div>
  )
}
