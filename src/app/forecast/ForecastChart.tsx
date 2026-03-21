'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import type { ForecastDay } from './page'

interface Props {
  forecast: ForecastDay[]
  payday: number
}

export default function ForecastChart({ forecast, payday }: Props) {
  if (forecast.length === 0) {
    return <div className="text-[var(--text-secondary)] text-[13px] text-center py-8">אין נתונים להצגה</div>
  }

  const data = forecast.map(d => ({
    date: d.label,
    balance: Math.round(d.balance),
    isNegative: d.balance < 0,
  }))

  // Find payday indices for reference lines
  const paydays = forecast
    .map((d, i) => ({ i, day: new Date(d.date).getDate() }))
    .filter(d => d.day === payday)
    .map(d => d.i)

  return (
    <div dir="ltr" style={{ width: '100%' }}>
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="balanceGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-green)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--accent-green)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="balanceRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-red)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--accent-red)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-hover)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
          axisLine={{ stroke: 'var(--border-default)' }}
          tickLine={false}
          interval={6}
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
          formatter={(v: unknown) => [formatCurrency(Number(v)), 'יתרה']}
          contentStyle={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--c-0-85)',
          }}
          labelStyle={{ color: 'var(--text-secondary)' }}
        />
        {/* Zero line */}
        <ReferenceLine y={0} stroke="var(--c-0-40)" strokeDasharray="4 4" />

        {/* Payday markers */}
        {paydays.map(idx => (
          <ReferenceLine
            key={`pay-${idx}`}
            x={data[idx]?.date}
            stroke="var(--accent-green)"
            strokeDasharray="2 4"
            strokeOpacity={0.5}
            label={{ value: 'M', fill: 'var(--accent-green)', fontSize: 9, position: 'top' }}
          />
        ))}

        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--accent-blue)"
          strokeWidth={2}
          fill="url(#balanceGreen)"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--accent-blue)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  )
}
