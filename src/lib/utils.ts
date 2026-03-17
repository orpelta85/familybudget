import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function getCurrentPeriodId(periods: { id: number; start_date: string; end_date: string }[]): number {
  const today = new Date().toISOString().split('T')[0]
  const current = periods.find(p => p.start_date <= today && p.end_date >= today)
  return current?.id ?? periods[0]?.id ?? 1
}
