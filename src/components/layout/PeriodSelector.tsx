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
    <div className="mb-5">
      <select
        value={selectedId ?? ''}
        onChange={e => onChange(Number(e.target.value))}
        aria-label="בחר תקופה"
        className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg py-2 px-3 text-inherit text-[13px] cursor-pointer"
        dir="rtl"
      >
        {periods.map(p => (
          <option key={p.id} value={p.id}>{periodLabel(p.start_date)}</option>
        ))}
      </select>
    </div>
  )
}
