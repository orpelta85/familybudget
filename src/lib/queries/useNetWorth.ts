import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type LiquidityType = 'liquid' | 'semi_liquid' | 'locked' | 'property'
export type SourceType = 'manual' | 'pension' | 'sinking_fund' | 'apartment'

export interface NetWorthEntry {
  id: number
  user_id: string
  category: string
  type: 'asset' | 'liability'
  amount: number
  liquidity: LiquidityType
  source: SourceType
  source_ref_id: number | null
  tax_note: string | null
  owner: 'personal' | 'shared'
  name: string | null
  return_pct: number | null
  updated_at: string
  created_at: string
}

export interface NetWorthSnapshot {
  id: number
  user_id: string
  snapshot_date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
  liquid_total: number
  created_at: string
}

export function useNetWorthEntries(userId: string | undefined) {
  return useQuery<NetWorthEntry[]>({
    queryKey: ['net_worth_entries', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('net_worth_entries')
        .select('*')
        .eq('user_id', userId!)
        .order('type')
        .order('category')
      if (error) throw error
      return data
    },
  })
}

export function useNetWorthSnapshots(userId: string | undefined) {
  return useQuery<NetWorthSnapshot[]>({
    queryKey: ['net_worth_snapshots', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', userId!)
        .order('snapshot_date')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertNetWorthEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: {
      id?: number
      user_id: string
      category: string
      type: 'asset' | 'liability'
      amount: number
      liquidity?: LiquidityType
      source?: SourceType
      source_ref_id?: number | null
      tax_note?: string | null
      owner?: 'personal' | 'shared'
      name?: string | null
      return_pct?: number | null
    }) => {
      const sb = createClient()
      if (entry.id) {
        const { error } = await sb.from('net_worth_entries').update({
          amount: entry.amount,
          category: entry.category,
          type: entry.type,
          liquidity: entry.liquidity,
          source: entry.source,
          source_ref_id: entry.source_ref_id,
          tax_note: entry.tax_note,
          owner: entry.owner,
          name: entry.name,
          return_pct: entry.return_pct,
          updated_at: new Date().toISOString(),
        }).eq('id', entry.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('net_worth_entries').insert({
          user_id: entry.user_id,
          category: entry.category,
          type: entry.type,
          amount: entry.amount,
          liquidity: entry.liquidity ?? 'liquid',
          source: entry.source ?? 'manual',
          source_ref_id: entry.source_ref_id ?? null,
          tax_note: entry.tax_note ?? null,
          owner: entry.owner ?? 'personal',
          name: entry.name ?? null,
          return_pct: entry.return_pct ?? null,
        })
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['net_worth_entries', vars.user_id] }),
  })
}

export function useDeleteNetWorthEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id }: { id: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('net_worth_entries').delete().eq('id', id)
      if (error) throw error
      return user_id
    },
    onSuccess: (user_id) => qc.invalidateQueries({ queryKey: ['net_worth_entries', user_id] }),
  })
}

export function useSaveSnapshot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (snapshot: Omit<NetWorthSnapshot, 'id' | 'created_at'>) => {
      const sb = createClient()
      const { error } = await sb.from('net_worth_snapshots').upsert(
        snapshot,
        { onConflict: 'user_id,snapshot_date' }
      )
      if (error) {
        // If upsert fails due to no unique constraint, just insert
        const { error: insertErr } = await sb.from('net_worth_snapshots').insert(snapshot)
        if (insertErr) throw insertErr
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['net_worth_snapshots', vars.user_id] }),
  })
}

export function useSyncFromExistingData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, familyId }: { userId: string; familyId: string | undefined }) => {
      const sb = createClient()
      const results: { synced: string[] } = { synced: [] }

      // 1. Sync pension products
      const { data: reports } = await sb
        .from('pension_reports')
        .select('id, pension_products(*)')
        .eq('user_id', userId)
        .order('report_date', { ascending: false })
        .limit(1)

      if (reports?.[0]?.pension_products) {
        for (const product of reports[0].pension_products) {
          if (!product.is_active || product.balance <= 0) continue

          let category = 'pension'
          let liquidity: LiquidityType = 'locked'
          let taxNote: string | null = null

          if (product.product_type === 'hishtalmut') {
            category = 'keren_hishtalmut'
            liquidity = 'semi_liquid'
            taxNote = 'פטור ממס אחרי 6 שנים'
          } else if (product.product_type === 'gemel_invest') {
            category = 'gemel'
            liquidity = 'semi_liquid'
            taxNote = '25% מס רווחי הון'
          } else if (product.product_type === 'gemel_tagmulim') {
            category = 'gemel'
            liquidity = 'locked'
            taxNote = 'נזיל בגיל 60'
          } else if (product.product_type === 'pension') {
            category = 'pension'
            liquidity = 'locked'
            taxNote = 'קצבה חודשית בפרישה'
          }

          // Check if entry already exists for this source
          const { data: existing } = await sb
            .from('net_worth_entries')
            .select('id')
            .eq('user_id', userId)
            .eq('source', 'pension')
            .eq('source_ref_id', product.id)
            .limit(1)

          if (existing?.length) {
            await sb.from('net_worth_entries').update({
              amount: product.balance,
              category,
              liquidity,
              tax_note: taxNote,
              name: `${product.product_name} - ${product.company}`,
              updated_at: new Date().toISOString(),
            }).eq('id', existing[0].id)
          } else {
            await sb.from('net_worth_entries').insert({
              user_id: userId,
              category,
              type: 'asset',
              amount: product.balance,
              liquidity,
              source: 'pension',
              source_ref_id: product.id,
              tax_note: taxNote,
              owner: 'personal',
              name: `${product.product_name} - ${product.company}`,
            })
          }
          results.synced.push(`פנסיה: ${product.product_name}`)
        }
      }

      // 2. Sync sinking funds
      const { data: funds } = await sb
        .from('sinking_funds')
        .select('id, name, is_shared')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (funds?.length) {
        for (const fund of funds) {
          const { data: txns } = await sb
            .from('sinking_fund_transactions')
            .select('amount')
            .eq('fund_id', fund.id)

          const balance = (txns ?? []).reduce((s, t) => s + t.amount, 0)
          if (balance <= 0) continue

          const { data: existing } = await sb
            .from('net_worth_entries')
            .select('id')
            .eq('user_id', userId)
            .eq('source', 'sinking_fund')
            .eq('source_ref_id', fund.id)
            .limit(1)

          if (existing?.length) {
            await sb.from('net_worth_entries').update({
              amount: balance,
              name: fund.name,
              owner: fund.is_shared ? 'shared' : 'personal',
              updated_at: new Date().toISOString(),
            }).eq('id', existing[0].id)
          } else {
            await sb.from('net_worth_entries').insert({
              user_id: userId,
              category: 'cash',
              type: 'asset',
              amount: balance,
              liquidity: 'liquid',
              source: 'sinking_fund',
              source_ref_id: fund.id,
              tax_note: null,
              owner: fund.is_shared ? 'shared' : 'personal',
              name: fund.name,
            })
          }
          results.synced.push(`קרן: ${fund.name}`)
        }
      }

      // 3. Sync apartment deposits
      if (familyId) {
        const { data: deposits } = await sb
          .from('apartment_deposits')
          .select('amount_deposited')
          .eq('family_id', familyId)

        const totalSaved = (deposits ?? []).reduce((s, d) => s + d.amount_deposited, 0)
        if (totalSaved > 0) {
          const { data: existing } = await sb
            .from('net_worth_entries')
            .select('id')
            .eq('user_id', userId)
            .eq('source', 'apartment')
            .limit(1)

          if (existing?.length) {
            await sb.from('net_worth_entries').update({
              amount: totalSaved,
              updated_at: new Date().toISOString(),
            }).eq('id', existing[0].id)
          } else {
            await sb.from('net_worth_entries').insert({
              user_id: userId,
              category: 'apartment_savings',
              type: 'asset',
              amount: totalSaved,
              liquidity: 'liquid',
              source: 'apartment',
              source_ref_id: null,
              tax_note: null,
              owner: 'shared',
              name: 'חיסכון לדירה',
            })
          }
          results.synced.push('חיסכון לדירה')
        }
      }

      return results
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['net_worth_entries', vars.userId] }),
  })
}
