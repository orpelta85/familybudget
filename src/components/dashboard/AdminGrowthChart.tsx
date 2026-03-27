'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'

interface Props {
  data: { name: string; users: number }[]
}

export function AdminGrowthChart({ data }: Props) {
  if (!data.length) return null

  return (
    <div dir="ltr" style={{ width: '100%', height: 200 }}>
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--c-purple-0-65)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--c-purple-0-65)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-hover)" />
        <XAxis dataKey="name" stroke="var(--c-0-45)" fontSize={11} />
        <YAxis stroke="var(--c-0-45)" fontSize={11} allowDecimals={false} orientation="right" />
        <Tooltip
          contentStyle={{ background: 'var(--c-0-18)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'var(--text-secondary)' }}
          itemStyle={{ color: 'var(--c-purple-0-85)' }}
        />
        <Area type="monotone" dataKey="users" stroke="var(--c-purple-0-65)" fill="url(#regGrad)" strokeWidth={2} name="משתמשים" />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  )
}
