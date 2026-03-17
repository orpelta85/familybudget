'use client'

import type { Period } from '@/lib/types'
import { periodLabel } from '@/lib/utils'

interface Props {
  periods: Period[]
  selectedId: number | undefined
  onChange: (id: number) => void
}

export function PeriodSelector({ periods, selectedId, onChange }: Props) {
  return (
    <div style={{ marginBottom: 20 }}>
      <select
        value={selectedId ?? ''}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          background: 'oklch(0.22 0.01 250)',
          border: '1px solid oklch(0.28 0.01 250)',
          borderRadius: 8,
          padding: '8px 12px',
          color: 'inherit',
          fontSize: 13,
          cursor: 'pointer',
          direction: 'rtl',
        }}
      >
        {periods.map(p => (
          <option key={p.id} value={p.id}>{periodLabel(p.start_date)}</option>
        ))}
      </select>
    </div>
  )
}
