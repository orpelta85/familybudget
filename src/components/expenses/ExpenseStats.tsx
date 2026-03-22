import { formatCurrency } from '@/lib/utils'

interface ExpenseStatsProps {
  totalPersonal: number
  totalSharedMy: number
  totalAll: number
}

export function ExpenseStats({ totalPersonal, totalSharedMy, totalAll }: ExpenseStatsProps) {
  const stats = [
    { label: 'אישי', value: totalPersonal, color: 'text-primary' },
    { label: 'משותף (חלקי)', value: totalSharedMy, color: 'text-[var(--accent-shared)]' },
    { label: 'סה"כ', value: totalAll, color: 'text-[var(--accent-orange)]' },
  ].filter(t => t.value > 0)

  return (
    <div className="flex gap-3 mb-3 flex-wrap">
      {stats.map(t => (
        <div key={t.label} className="card-transition bg-card border border-border rounded-lg px-3.5 py-2">
          <div className="text-[10px] text-muted-foreground mb-0.5">{t.label}</div>
          <div className={`text-[15px] font-bold ${t.color}`}>{formatCurrency(t.value)}</div>
        </div>
      ))}
    </div>
  )
}
