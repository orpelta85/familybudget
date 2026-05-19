'use client'

import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Scale } from 'lucide-react'
import type { SharedExpense } from '@/lib/types'

interface SettlementCardProps {
  expenses: SharedExpense[]
  currentUserId: string
  paidByNameMap: Map<string, string>
}

/**
 * "מי חייב למי" — 50/50 settlement for the selected period.
 *
 * Each shared expense of total T is split 50/50, so each partner should bear T/2.
 * The person in `paid_by` actually paid the full T, so the other side owes them T/2.
 * Net balance = sum over expenses of (T/2) credited to the payer.
 * Expenses with paid_by = null are excluded.
 */
export function SettlementCard({ expenses, currentUserId, paidByNameMap }: SettlementCardProps) {
  const result = useMemo(() => {
    // credit[userId] = how much that person is owed (paid above their 50% share)
    const credit = new Map<string, number>()
    let untaggedCount = 0

    for (const e of expenses) {
      if (!e.paid_by) { untaggedCount++; continue }
      const total = Number(e.total_amount)
      const half = total / 2
      // payer paid `total`, owes `half` → net credited `half`
      credit.set(e.paid_by, (credit.get(e.paid_by) ?? 0) + half)
    }

    return { credit, untaggedCount }
  }, [expenses])

  const { credit, untaggedCount } = result

  // Identify the two parties: current user + the other payer (if any)
  const otherId = useMemo(() => {
    for (const id of credit.keys()) {
      if (id !== currentUserId) return id
    }
    return null
  }, [credit, currentUserId])

  const meName = paidByNameMap.get(currentUserId) ?? 'אני'
  const otherName = otherId ? (paidByNameMap.get(otherId) ?? 'בן/בת הזוג') : 'בן/בת הזוג'

  const myCredit = credit.get(currentUserId) ?? 0
  const otherCredit = otherId ? (credit.get(otherId) ?? 0) : 0
  // Positive net → I paid more → other owes me. Negative → I owe other.
  const net = myCredit - otherCredit
  const amount = Math.abs(net)
  const balanced = amount < 0.5

  const hasData = credit.size > 0

  let message: string
  let tone: 'me' | 'other' | 'balanced'
  if (!hasData) {
    message = 'אין הוצאות משותפות מסומנות במחזור זה'
    tone = 'balanced'
  } else if (balanced) {
    message = 'מאוזן - אף אחד לא חייב לשני'
    tone = 'balanced'
  } else if (net > 0) {
    message = `${otherName} חייב/ת ל${meName} ${formatCurrency(amount)}`
    tone = 'me'
  } else {
    message = `${meName} חייב/ת ל${otherName} ${formatCurrency(amount)}`
    tone = 'other'
  }

  const toneClass =
    tone === 'me' ? 'text-[var(--accent-teal)]'
    : tone === 'other' ? 'text-[var(--accent-orange)]'
    : 'text-[var(--c-0-60)]'

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Scale size={13} className="text-[var(--accent-shared)]" />
        <h2 className="text-[13px] font-semibold m-0">התחשבנות</h2>
      </div>
      <div className={`text-[15px] font-bold ${toneClass}`}>
        {message}
      </div>
      {hasData && !balanced && (
        <div className="text-[11px] text-muted-foreground mt-1.5">
          חישוב חלוקה 50/50 לכל ההוצאות המשותפות במחזור
        </div>
      )}
      {untaggedCount > 0 && (
        <div className="text-[11px] text-[var(--c-0-50)] mt-1.5">
          {untaggedCount} הוצאות ללא סימון מי שילם - לא נכללו בחישוב
        </div>
      )}
    </div>
  )
}
