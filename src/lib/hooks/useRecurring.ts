'use client'
import { useState, useEffect } from 'react'

// ── Shared (locked category amounts that repeat each month) ───────────────────
export type LockedSharedItem = {
  category: string   // key like 'rent', 'electricity', or custom id
  label: string
  amount: number
}

export function useRecurringShared(userId: string | undefined) {
  const key = userId ? `recurring_shared_${userId}` : null
  const [items, setItems] = useState<LockedSharedItem[]>([])

  useEffect(() => {
    if (!key) return
    try { setItems(JSON.parse(localStorage.getItem(key) ?? '[]')) } catch { setItems([]) }
  }, [key])

  function save(updated: LockedSharedItem[]) {
    if (key) localStorage.setItem(key, JSON.stringify(updated))
    setItems(updated)
  }

  function lock(item: LockedSharedItem) {
    save([...items.filter(i => i.category !== item.category), item])
  }

  function unlock(category: string) {
    save(items.filter(i => i.category !== category))
  }

  function isLocked(category: string) {
    return items.some(i => i.category === category)
  }

  function getLockedAmount(category: string) {
    return items.find(i => i.category === category)?.amount ?? null
  }

  return { items, lock, unlock, isLocked, getLockedAmount }
}

// ── Personal (locked expense templates that repeat each month) ────────────────
export type LockedPersonalItem = {
  id: string           // `${category_id}_${description}` — stable across periods
  category_id: number
  category_name: string
  amount: number
  description: string
}

export function useRecurringPersonal(userId: string | undefined) {
  const key = userId ? `recurring_personal_${userId}` : null
  const [items, setItems] = useState<LockedPersonalItem[]>([])

  useEffect(() => {
    if (!key) return
    try { setItems(JSON.parse(localStorage.getItem(key) ?? '[]')) } catch { setItems([]) }
  }, [key])

  function save(updated: LockedPersonalItem[]) {
    if (key) localStorage.setItem(key, JSON.stringify(updated))
    setItems(updated)
  }

  function toggle(item: LockedPersonalItem) {
    const exists = items.some(i => i.id === item.id)
    save(exists ? items.filter(i => i.id !== item.id) : [...items, item])
  }

  function isLocked(id: string) {
    return items.some(i => i.id === id)
  }

  return { items, toggle, isLocked }
}

// Unique key for identifying a personal expense — uses DB id for uniqueness
export function personalItemId(category_id: number, description: string, expenseId?: number) {
  if (expenseId) return `${category_id}_${expenseId}`
  return `${category_id}_${(description || '').trim().toLowerCase()}`
}
