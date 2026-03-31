'use client'

import { User, Users, Inbox, Pin } from 'lucide-react'
import type { BudgetCategory, SharedExpense } from '@/lib/types'
import type { FamilyMemberExpenses } from '@/lib/queries/useExpenses'
import { sharedCatLabel, isSharedExpenseFixed } from './SharedExpenseList'

interface FamilyExpensesViewProps {
  familyExpenses: FamilyMemberExpenses[] | undefined
  sharedExp: SharedExpense[] | undefined
  splitFrac: number
  sinkingMonthly?: number
  formatCurrency: (n: number) => string
}

export function FamilyExpensesView({
  familyExpenses,
  sharedExp,
  splitFrac,
  sinkingMonthly = 0,
  formatCurrency: fmt,
}: FamilyExpensesViewProps) {
  const totalShared = (sharedExp ?? []).reduce((s, e) => s + e.total_amount, 0)
  const totalFamilyPersonal = (familyExpenses ?? []).reduce((s, m) => s + m.total, 0)
  const totalAll = totalFamilyPersonal + totalShared
  const totalWithSinking = totalAll + sinkingMonthly

  const sharedCatSorted = (() => {
    const catTotals = new Map<string, number>()
    for (const e of (sharedExp ?? [])) {
      const label = sharedCatLabel(e.category)
      catTotals.set(label, (catTotals.get(label) ?? 0) + e.total_amount)
    }
    return [...catTotals.entries()].sort((a, b) => b[1] - a[1])
  })()

  return (
    <>
      {/* Family KPI Cards */}
      <div className="grid-kpi mb-5">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1">הוצאות משותפות</div>
          <div className="text-[22px] font-bold text-[var(--accent-shared)] leading-none">{fmt(totalShared)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1">הוצאות אישיות (כולם)</div>
          <div className="text-[22px] font-bold text-primary leading-none">{fmt(totalFamilyPersonal)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[11px] text-muted-foreground mb-1">סה&quot;כ משפחתי</div>
          <div className="text-[22px] font-bold text-[var(--accent-orange)] leading-none">{fmt(totalAll)}</div>
        </div>
        {sinkingMonthly > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-[11px] text-muted-foreground mb-1">כולל קרנות</div>
            <div className="text-[22px] font-bold text-[var(--accent-teal)] leading-none">{fmt(totalWithSinking)}</div>
          </div>
        )}
      </div>

      {/* ── Fixed vs Variable Bar (Family) ──────────────────────────────── */}
      {(() => {
        let fixedTotal = 0
        let variableTotal = 0
        // All personal expenses from all members
        for (const member of (familyExpenses ?? [])) {
          for (const e of member.expenses) {
            const cat = e.budget_categories as BudgetCategory | undefined
            const isFixed = e.is_fixed !== null && e.is_fixed !== undefined ? e.is_fixed : cat?.type === 'fixed'
            if (isFixed) fixedTotal += e.amount
            else variableTotal += e.amount
          }
        }
        // Shared expenses (full amount, not split)
        for (const e of (sharedExp ?? [])) {
          if (isSharedExpenseFixed(e)) fixedTotal += e.total_amount
          else variableTotal += e.total_amount
        }
        const total = fixedTotal + variableTotal
        if (total <= 0) return null
        const fixedPct = Math.round((fixedTotal / total) * 100)
        const varPct = 100 - fixedPct
        return (
          <div className="bg-card border border-border rounded-xl px-4 py-3 mb-5">
            <div className="flex items-center gap-3 mb-2">
              <Pin size={12} className="text-[var(--accent-orange)] shrink-0" />
              <div className="flex-1 flex rounded-md overflow-hidden h-5">
                {fixedPct > 0 && (
                  <div className="flex items-center justify-center text-[10px] font-semibold text-[var(--c-0-10)]"
                    style={{ width: `${fixedPct}%`, background: 'var(--accent-orange)', minWidth: '32px' }}>
                    {fixedPct}%
                  </div>
                )}
                {varPct > 0 && (
                  <div className="flex items-center justify-center text-[10px] font-semibold text-[var(--c-0-10)]"
                    style={{ width: `${varPct}%`, background: 'var(--accent-blue)', minWidth: '32px' }}>
                    {varPct}%
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--accent-orange)' }} />
                <span className="text-muted-foreground">קבועות (לשנינו)</span>
                <span className="font-semibold">{fmt(fixedTotal)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--accent-blue)' }} />
                <span className="text-muted-foreground">משתנות (לשנינו)</span>
                <span className="font-semibold">{fmt(variableTotal)}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Shared + Personal side by side ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Shared expenses card */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[var(--accent-shared)]" />
              <span className="font-semibold text-sm">הוצאות משותפות</span>
              {sharedCatSorted.length > 0 && (
                <span className="text-[10px] text-[var(--c-0-50)] bg-[var(--c-0-20)] px-2 py-0.5 rounded-full">{sharedCatSorted.length} קטגוריות</span>
              )}
            </div>
            <span className="text-[15px] font-bold text-[var(--accent-shared)]">{fmt(totalShared)}</span>
          </div>
          {sharedCatSorted.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              <Inbox size={24} className="text-[var(--c-0-30)] mx-auto mb-1.5" />
              אין הוצאות משותפות
            </div>
          ) : (
            <div className="flex flex-col">
              {sharedCatSorted.map(([label, total]) => (
                <div key={label} className="flex justify-between items-center py-2.5 border-b border-[var(--c-0-20)] last:border-b-0">
                  <span className="text-[12px] text-[var(--text-body)]">{label}</span>
                  <span className="text-[12px] font-semibold">{fmt(total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Personal expenses card - breakdown by member */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <User size={14} className="text-primary" />
              <span className="font-semibold text-sm">הוצאות אישיות</span>
            </div>
            <span className="text-[15px] font-bold text-primary">{fmt(totalFamilyPersonal)}</span>
          </div>
          {(familyExpenses ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              <Inbox size={24} className="text-[var(--c-0-30)] mx-auto mb-1.5" />
              אין הוצאות אישיות
            </div>
          ) : (
            <div className="flex flex-col">
              {(familyExpenses ?? []).map((member, idx) => (
                <div key={member.user_id}>
                  {idx > 0 && <div className="border-t-2 border-[var(--border-default)] my-2" />}
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[13px] font-semibold text-[var(--text-heading)]">{member.display_name}</span>
                    <span className="text-[13px] font-bold text-primary">{fmt(member.total)}</span>
                  </div>
                  {(() => {
                    // Use categories from API (summary mode) or compute from expenses (full mode)
                    let catGroups: [string, number][]
                    if (member.categories && member.categories.length > 0) {
                      catGroups = member.categories.map(c => [c.name, c.total] as [string, number]).sort((a, b) => b[1] - a[1])
                    } else if (member.expenses.length > 0) {
                      const catMap = new Map<string, number>()
                      for (const e of member.expenses) {
                        const catName = (e.budget_categories as BudgetCategory)?.name ?? 'כללי'
                        catMap.set(catName, (catMap.get(catName) ?? 0) + e.amount)
                      }
                      catGroups = [...catMap.entries()].sort((a, b) => b[1] - a[1])
                    } else {
                      catGroups = []
                    }
                    if (catGroups.length === 0) return null
                    return (
                      <div className="flex flex-col">
                        {catGroups.map(([name, total]) => (
                          <div key={name} className="flex justify-between items-center py-1.5 pr-3 border-b border-[var(--c-0-20)] last:border-b-0">
                            <span className="text-[11px] text-[var(--text-body)]">{name}</span>
                            <span className="text-[11px] font-medium">{fmt(total)}</span>
                          </div>
                        ))}
                        {member.privacy === 'summary' && (
                          <div className="text-[10px] text-[var(--c-0-50)] italic mt-1.5">סיכום לפי קטגוריות - ללא פירוט עסקאות</div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Totals summary and category table removed per user request */}
    </>
  )
}
