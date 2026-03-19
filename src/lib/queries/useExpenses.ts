import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { PersonalExpense, BudgetCategory } from '@/lib/types'

export function usePersonalExpenses(periodId: number | undefined, userId: string | undefined) {
  return useQuery<PersonalExpense[]>({
    queryKey: ['personal_expenses', periodId, userId],
    enabled: !!periodId && !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('personal_expenses')
        .select('*, budget_categories(*)')
        .eq('period_id', periodId!)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useBudgetCategories(userId: string | undefined) {
  return useQuery<BudgetCategory[]>({
    queryKey: ['budget_categories', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('budget_categories')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useAllPersonalExpenses(userId: string | undefined) {
  return useQuery<PersonalExpense[]>({
    queryKey: ['all_personal_expenses', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('personal_expenses')
        .select('*, budget_categories(*)')
        .eq('user_id', userId!)
        .order('period_id')
      if (error) throw error
      return data
    },
  })
}

export function useUpdateCategoryTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, monthly_target, user_id }: { id: number; monthly_target: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('budget_categories').update({ monthly_target }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['budget_categories', vars.user_id] }),
  })
}

export function useAddExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expense: Omit<PersonalExpense, 'id' | 'budget_categories'>) => {
      const sb = createClient()
      const { data, error } = await sb
        .from('personal_expenses')
        .insert(expense)
        .select('*, budget_categories(*)')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['personal_expenses', vars.period_id, vars.user_id] })
    },
  })
}

export function useDeleteAllPeriodExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ period_id, user_id }: { period_id: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('personal_expenses').delete().eq('period_id', period_id).eq('user_id', user_id)
      if (error) throw error
      return { period_id, user_id }
    },
    onSuccess: ({ period_id, user_id }) => {
      qc.invalidateQueries({ queryKey: ['personal_expenses', period_id, user_id] })
    },
  })
}

export function useAddBudgetCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cat: { user_id: string; name: string; type: string; monthly_target: number; sort_order: number }) => {
      const sb = createClient()
      const { data, error } = await sb
        .from('budget_categories')
        .insert(cat)
        .select('*')
        .single()
      if (error) throw error
      return data as BudgetCategory
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['budget_categories', vars.user_id] }),
  })
}

export function usePaginatedPersonalExpenses(
  userId: string | undefined,
  page: number = 0,
  limit: number = 50,
) {
  return useQuery<{ data: PersonalExpense[]; total: number }>({
    queryKey: ['personal_expenses_paginated', userId, page, limit],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const from = page * limit
      const to = from + limit - 1
      const { data, error, count } = await sb
        .from('personal_expenses')
        .select('*, budget_categories(*)', { count: 'exact' })
        .eq('user_id', userId!)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: data ?? [], total: count ?? 0 }
    },
  })
}

// ── Category Rules (auto-categorization) ──────────────────────────────────

interface CategoryRule {
  id: number
  user_id: string
  merchant_pattern: string
  category_id: number
  fund_name: string | null
}

export function useCategoryRules(userId: string | undefined) {
  return useQuery<CategoryRule[]>({
    queryKey: ['category_rules', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('category_rules')
        .select('*')
        .eq('user_id', userId!)
      if (error) throw error
      return data
    },
  })
}

export function useSaveCategoryRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rule: { user_id: string; merchant_pattern: string; category_id: number; fund_name?: string }) => {
      const sb = createClient()
      const { error } = await sb
        .from('category_rules')
        .upsert(rule, { onConflict: 'user_id,merchant_pattern' })
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['category_rules', vars.user_id] }),
  })
}

/** Fuzzy match: checks if merchant name contains the pattern (case-insensitive, ignores extra spaces) */
export function findMatchingRule(merchantName: string, rules: CategoryRule[]): CategoryRule | undefined {
  const normalized = merchantName.trim().toLowerCase().replace(/\s+/g, ' ')
  // Try exact match first
  const exact = rules.find(r => normalized === r.merchant_pattern.trim().toLowerCase())
  if (exact) return exact
  // Try substring match — pattern inside merchant name
  const partial = rules.find(r => {
    const pattern = r.merchant_pattern.trim().toLowerCase()
    return pattern.length >= 3 && normalized.includes(pattern)
  })
  if (partial) return partial
  // Try merchant inside pattern (if merchant is shorter)
  const reverse = rules.find(r => {
    const pattern = r.merchant_pattern.trim().toLowerCase()
    return normalized.length >= 3 && pattern.includes(normalized)
  })
  return reverse
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, period_id, user_id }: { id: number; period_id: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('personal_expenses').delete().eq('id', id)
      if (error) throw error
      return { period_id, user_id }
    },
    onSuccess: ({ period_id, user_id }) => {
      qc.invalidateQueries({ queryKey: ['personal_expenses', period_id, user_id] })
    },
  })
}
