import { formatCurrency } from '@/lib/utils'

interface ExpenseStatsProps {
  totalPersonal: number
  totalSharedMy: number
  totalAll: number
  sinkingMonthly?: number
  totalWithSinking?: number
  isSolo?: boolean
}

export function ExpenseStats({ totalPersonal, totalSharedMy, totalAll, sinkingMonthly, totalWithSinking, isSolo }: ExpenseStatsProps) {
  const stats = [
    { label: 'אישי', value: totalPersonal, color: 'text-primary' },
    ...(!isSolo ? [{ label: 'משותף (חלקי)', value: totalSharedMy, color: 'text-[var(--accent-shared)]' }] : []),
    ...(!isSolo ? [{ label: 'סה"כ', value: totalAll, color: 'text-[var(--accent-orange)]' }] : []),
    ...(sinkingMonthly && totalWithSinking ? [{ label: 'כולל קרנות', value: totalWithSinking, color: 'text-[var(--accent-teal)]' }] : []),
  ].filter(t => t.value > 0)

  return (
    <div className={`grid gap-3 mb-3 ${isSolo ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
      {stats.map(t => (
        <div key={t.label} className="card-transition bg-card border border-border rounded-lg px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-muted-foreground font-medium">{t.label}</span>
            <span className={`text-[16px] font-bold ${t.color}`}>{formatCurrency(t.value)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
