'use client'

import { cn } from '@/lib/utils'
import { CalendarRange, CalendarDays } from 'lucide-react'
import type { PeriodViewMode } from '@/lib/context/PeriodContext'

interface Props {
  viewMode: PeriodViewMode
  onModeChange: (mode: PeriodViewMode) => void
  dateFrom: string
  dateTo: string
  onRangeChange: (from: string, to: string) => void
}

/**
 * Toggle between month-cube view and a free date-range view.
 * In range mode it also renders the two date inputs.
 */
export function PeriodModeToggle({ viewMode, onModeChange, dateFrom, dateTo, onRangeChange }: Props) {
  return (
    <div className="mb-5 flex items-center gap-2.5 flex-wrap">
      <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-1">
        <button
          onClick={() => onModeChange('month')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border-none cursor-pointer whitespace-nowrap',
            viewMode === 'month'
              ? 'bg-[var(--accent-blue)] text-[var(--c-0-10)] shadow-[0_1px_3px_oklch(0_0_0/0.2)]'
              : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
          )}
        >
          <CalendarDays size={14} />
          לפי חודש
        </button>
        <button
          onClick={() => onModeChange('range')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 border-none cursor-pointer whitespace-nowrap',
            viewMode === 'range'
              ? 'bg-[var(--accent-blue)] text-[var(--c-0-10)] shadow-[0_1px_3px_oklch(0_0_0/0.2)]'
              : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
          )}
        >
          <CalendarRange size={14} />
          טווח תאריכים
        </button>
      </div>

      {viewMode === 'range' && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label htmlFor="period-range-from" className="text-[12px] text-[var(--text-secondary)]">מתאריך</label>
            <input
              id="period-range-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={e => onRangeChange(e.target.value, dateTo)}
              className="bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-lg px-2.5 py-1.5 text-[13px] text-inherit outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="period-range-to" className="text-[12px] text-[var(--text-secondary)]">עד תאריך</label>
            <input
              id="period-range-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => onRangeChange(dateFrom, e.target.value)}
              className="bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-lg px-2.5 py-1.5 text-[13px] text-inherit outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  )
}
