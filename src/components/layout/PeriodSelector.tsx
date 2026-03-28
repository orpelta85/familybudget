'use client'

import type { Period } from '@/lib/types'
import { periodLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

interface Props {
  periods: Period[]
  selectedId: number | undefined
  onChange: (id: number) => void
}

export function PeriodSelector({ periods, selectedId, onChange }: Props) {
  const [showAll, setShowAll] = useState(false)

  // Show: 1 before selected, selected, 1 after selected
  const selectedIdx = periods.findIndex(p => p.id === selectedId)
  const centerIdx = selectedIdx >= 0 ? selectedIdx : 0
  const startIdx = Math.max(0, centerIdx - 1)
  const endIdx = Math.min(periods.length, centerIdx + 2)
  const visiblePeriods = periods.slice(startIdx, endIdx)
  const hiddenPeriods = periods.filter(p => !visiblePeriods.includes(p))
  const hasMore = hiddenPeriods.length > 0

  return (
    <div className="mb-5 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-1">
        {visiblePeriods.map(p => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border-none cursor-pointer whitespace-nowrap',
              p.id === selectedId
                ? 'bg-[var(--accent-blue)] text-[var(--c-0-10)] shadow-[0_1px_3px_oklch(0_0_0/0.2)]'
                : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            )}
          >
            {periodLabel(p.start_date)}
          </button>
        ))}
      </div>
      {hasMore && (
        <div className="relative">
          <button
            onClick={() => setShowAll(v => !v)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] border cursor-pointer transition-all duration-150',
              'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-light)] hover:text-[var(--text-primary)]'
            )}
          >
            עוד
            <ChevronDown size={13} className={cn('transition-transform duration-200', showAll && 'rotate-180')} />
          </button>
          {showAll && (
            <div className="absolute top-full inset-inline-start-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-1 shadow-[0_4px_16px_oklch(0_0_0/0.3)] z-50 min-w-[160px]">
              {hiddenPeriods.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onChange(p.id); setShowAll(false) }}
                  className={cn(
                    'w-full text-right px-3 py-1.5 rounded-lg text-[12px] border-none cursor-pointer transition-all duration-150',
                    p.id === selectedId
                      ? 'bg-[var(--accent-blue)] text-[var(--c-0-10)]'
                      : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  )}
                >
                  {periodLabel(p.start_date)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
