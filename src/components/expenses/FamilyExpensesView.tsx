'use client'

import { User, Users, Inbox } from 'lucide-react'
import type { BudgetCategory, SharedExpense } from '@/lib/types'
import type { FamilyMemberExpenses } from '@/lib/queries/useExpenses'
import { sharedCatLabel } from './SharedExpenseList'

interface FamilyExpensesViewProps {
  familyExpenses: FamilyMemberExpenses[] | undefined
  sharedExp: SharedExpense[] | undefined
  splitFrac: number
  formatCurrency: (n: number) => string
}

export function FamilyExpensesView({
  familyExpenses,
  sharedExp,
  splitFrac,
  formatCurrency: fmt,
}: FamilyExpensesViewProps) {
  const totalShared = (sharedExp ?? []).reduce((s, e) => s + e.total_amount, 0)
  const totalFamilyPersonal = (familyExpenses ?? []).reduce((s, m) => s + m.total, 0)
  const totalAll = totalFamilyPersonal + totalShared

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
      </div>

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
                  {member.expenses.length > 0 && (() => {
                    const catMap = new Map<string, number>()
                    for (const e of member.expenses) {
                      const catName = (e.budget_categories as BudgetCategory)?.name ?? 'כללי'
                      catMap.set(catName, (catMap.get(catName) ?? 0) + e.amount)
                    }
                    const catGroups = [...catMap.entries()].sort((a, b) => b[1] - a[1])
                    return (
                      <div className="flex flex-col">
                        {catGroups.map(([name, total]) => (
                          <div key={name} className="flex justify-between items-center py-1.5 pr-3 border-b border-[var(--c-0-20)] last:border-b-0">
                            <span className="text-[11px] text-[var(--text-body)]">{name}</span>
                            <span className="text-[11px] font-medium">{fmt(total)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Totals summary row ─────────────────────────────────────────── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4 mb-5">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-sm">סה&quot;כ הוצאות משפחתיות</span>
          <span className="text-lg font-bold text-[var(--accent-orange)]">{fmt(totalAll)}</span>
        </div>
        <div className="flex gap-6 mt-2 text-[12px] text-[var(--text-secondary)]">
          <span>משותפות: {fmt(totalShared)}</span>
          <span>אישיות: {fmt(totalFamilyPersonal)}</span>
        </div>
      </div>

      {/* ── Who Spent What — Category x Member Table ──────────────────────── */}
      {(familyExpenses ?? []).length > 1 && (() => {
        const catMemberMap = new Map<string, Map<string, number>>()
        const memberNames = (familyExpenses ?? []).map(m => ({ id: m.user_id, name: m.display_name }))
        for (const member of (familyExpenses ?? [])) {
          for (const e of member.expenses) {
            const catName = (e.budget_categories as BudgetCategory)?.name ?? 'כללי'
            if (!catMemberMap.has(catName)) catMemberMap.set(catName, new Map())
            const memberMap = catMemberMap.get(catName)!
            memberMap.set(member.user_id, (memberMap.get(member.user_id) ?? 0) + e.amount)
          }
        }
        const catRows = [...catMemberMap.entries()]
          .map(([catName, memberMap]) => {
            const total = [...memberMap.values()].reduce((s, v) => s + v, 0)
            return { catName, memberMap, total }
          })
          .sort((a, b) => b.total - a.total)
        const grandTotal = catRows.reduce((s, r) => s + r.total, 0)

        return (
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 mb-5">
            <div className="font-semibold text-sm mb-4">מי הוציא מה - לפי קטגוריה</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--bg-hover)]">
                    <th className="py-2 px-3 text-right text-[var(--text-secondary)] font-medium text-[11px]">קטגוריה</th>
                    {memberNames.map(m => (
                      <th key={m.id} className="py-2 px-3 text-right text-[var(--text-secondary)] font-medium text-[11px]">{m.name}</th>
                    ))}
                    <th className="py-2 px-3 text-right text-[var(--text-secondary)] font-medium text-[11px]">סה&quot;כ</th>
                  </tr>
                </thead>
                <tbody>
                  {catRows.map(row => (
                    <tr key={row.catName} className="border-b border-[var(--c-0-20)]">
                      <td className="py-2 px-3 text-[var(--text-body)] font-medium">{row.catName}</td>
                      {memberNames.map(m => {
                        const val = row.memberMap.get(m.id) ?? 0
                        const pct = row.total > 0 ? Math.round((val / row.total) * 100) : 0
                        return (
                          <td key={m.id} className="py-2 px-3 text-right">
                            <span className="text-[var(--text-heading)]">{val > 0 ? fmt(val) : '-'}</span>
                            {val > 0 && <span className="text-[10px] text-[var(--c-0-50)] mr-1">({pct}%)</span>}
                          </td>
                        )
                      })}
                      <td className="py-2 px-3 text-right font-semibold text-[var(--accent-orange)]">{fmt(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--border-default)]">
                    <td className="py-2.5 px-3 font-bold text-[var(--text-heading)]">סה&quot;כ</td>
                    {memberNames.map(m => {
                      const memberTotal = catRows.reduce((s, r) => s + (r.memberMap.get(m.id) ?? 0), 0)
                      const pct = grandTotal > 0 ? Math.round((memberTotal / grandTotal) * 100) : 0
                      return (
                        <td key={m.id} className="py-2.5 px-3 text-right font-bold text-[var(--accent-blue)]">
                          {fmt(memberTotal)}
                          <span className="text-[10px] text-[var(--c-0-50)] mr-1">({pct}%)</span>
                        </td>
                      )
                    })}
                    <td className="py-2.5 px-3 text-right font-bold text-[var(--accent-orange)]">{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })()}
    </>
  )
}
