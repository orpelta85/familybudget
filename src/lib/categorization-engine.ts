// ── Smart Categorization Engine (Phase 1) ───────────────────────────────────

import type { BudgetCategory } from '@/lib/types'

export interface CategoryRule {
  id: number
  user_id: string
  merchant_pattern: string
  category_id: number | null
  fund_name: string | null
  shared_category: string | null
  is_shared: boolean
  confidence: number
  times_used: number
  source: string
}

export interface GlobalMapping {
  id: number
  merchant_pattern: string
  suggested_category: string
  shared_category: string | null
  is_shared: boolean
  confidence: number
}

export interface MatchResult {
  categoryId?: number
  sharedCategory?: string
  categoryName: string
  isShared: boolean
  confidence: number
  matchSource: 'user-exact' | 'user-fuzzy' | 'global' | 'none'
  ruleId?: number
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function categorizeTransaction(
  description: string,
  userRules: CategoryRule[],
  globalMappings: GlobalMapping[],
  categories: BudgetCategory[],
): MatchResult {
  const norm = normalize(description)
  if (!norm) return { categoryName: '', isShared: false, confidence: 0, matchSource: 'none' }

  // 1. Exact match against user rules
  for (const rule of userRules) {
    const pattern = normalize(rule.merchant_pattern)
    if (norm === pattern) {
      const cat = rule.category_id ? categories.find(c => c.id === rule.category_id) : undefined
      return {
        categoryId: rule.category_id ?? undefined,
        sharedCategory: rule.shared_category ?? undefined,
        categoryName: cat?.name ?? rule.shared_category ?? '',
        isShared: rule.is_shared,
        confidence: Math.min(rule.confidence, 1),
        matchSource: 'user-exact',
        ruleId: rule.id,
      }
    }
  }

  // 2. Substring match against user rules (pattern inside description or description inside pattern)
  for (const rule of userRules) {
    const pattern = normalize(rule.merchant_pattern)
    if (pattern.length >= 3 && (norm.includes(pattern) || pattern.includes(norm))) {
      const cat = rule.category_id ? categories.find(c => c.id === rule.category_id) : undefined
      return {
        categoryId: rule.category_id ?? undefined,
        sharedCategory: rule.shared_category ?? undefined,
        categoryName: cat?.name ?? rule.shared_category ?? '',
        isShared: rule.is_shared,
        confidence: Math.min(rule.confidence * 0.8, 1),
        matchSource: 'user-fuzzy',
        ruleId: rule.id,
      }
    }
  }

  // 3. Exact match against global mappings
  for (const mapping of globalMappings) {
    const pattern = normalize(mapping.merchant_pattern)
    if (norm === pattern) {
      const cat = categories.find(c => normalize(c.name) === normalize(mapping.suggested_category))
      return {
        categoryId: cat?.id,
        sharedCategory: mapping.shared_category ?? undefined,
        categoryName: cat?.name ?? mapping.suggested_category,
        isShared: mapping.is_shared,
        confidence: 0.7,
        matchSource: 'global',
      }
    }
  }

  // 4. Substring match against global mappings
  for (const mapping of globalMappings) {
    const pattern = normalize(mapping.merchant_pattern)
    if (pattern.length >= 3 && (norm.includes(pattern) || pattern.includes(norm))) {
      const cat = categories.find(c => normalize(c.name) === normalize(mapping.suggested_category))
      return {
        categoryId: cat?.id,
        sharedCategory: mapping.shared_category ?? undefined,
        categoryName: cat?.name ?? mapping.suggested_category,
        isShared: mapping.is_shared,
        confidence: 0.5,
        matchSource: 'global',
      }
    }
  }

  // 5. No match
  return { categoryName: '', isShared: false, confidence: 0, matchSource: 'none' }
}
