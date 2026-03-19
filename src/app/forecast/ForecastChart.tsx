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
    return <div className="text-[oklch(0.65_0.01_250)] text-[13px] text-center py-8">אין נתונים להצגה</div>
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
            <stop offset="0%" stopColor="oklch(0.70 0.18 145)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="oklch(0.70 0.18 145)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="balanceRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.62 0.22 27)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="oklch(0.62 0.22 27)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 250)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'oklch(0.55 0.01 250)', fontSize: 10 }}
          axisLine={{ stroke: 'oklch(0.25 0.01 250)' }}
          tickLine={false}
          interval={6}
        />
        <YAxis
          orientation="left"
          tick={{ fill: 'oklch(0.55 0.01 250)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          width={50}
        />
        <Tooltip
          formatter={(v: unknown) => [formatCurrency(Number(v)), 'יתרה']}
          contentStyle={{
            background: 'oklch(0.16 0.01 250)',
            border: '1px solid oklch(0.28 0.01 250)',
            borderRadius: 8,
            fontSize: 12,
            color: 'oklch(0.85 0.01 250)',
          }}
          labelStyle={{ color: 'oklch(0.65 0.01 250)' }}
        />
        {/* Zero line */}
        <ReferenceLine y={0} stroke="oklch(0.40 0.01 250)" strokeDasharray="4 4" />

        {/* Payday markers */}
        {paydays.map(idx => (
          <ReferenceLine
            key={`pay-${idx}`}
            x={data[idx]?.date}
            stroke="oklch(0.70 0.18 145)"
            strokeDasharray="2 4"
            strokeOpacity={0.5}
            label={{ value: 'M', fill: 'oklch(0.70 0.18 145)', fontSize: 9, position: 'top' }}
          />
        ))}

        <Area
          type="monotone"
          dataKey="balance"
          stroke="oklch(0.65 0.18 250)"
          strokeWidth={2}
          fill="url(#balanceGreen)"
          dot={false}
          activeDot={{ r: 4, fill: 'oklch(0.65 0.18 250)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  )
}
