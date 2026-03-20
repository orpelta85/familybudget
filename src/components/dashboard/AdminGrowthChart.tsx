'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'

interface Props {
  data: { name: string; users: number }[]
}

export function AdminGrowthChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.65 0.18 290)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="oklch(0.65 0.18 290)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 250)" />
        <XAxis dataKey="name" stroke="oklch(0.45 0.01 250)" fontSize={11} />
        <YAxis stroke="oklch(0.45 0.01 250)" fontSize={11} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: 'oklch(0.18 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'oklch(0.65 0.01 250)' }}
          itemStyle={{ color: 'oklch(0.85 0.16 290)' }}
        />
        <Area type="monotone" dataKey="users" stroke="oklch(0.65 0.18 290)" fill="url(#regGrad)" strokeWidth={2} name="משתמשים" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
