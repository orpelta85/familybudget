export type BudgetType = 'fixed' | 'variable' | 'sinking' | 'savings'
export type SharedCategory = 'rent' | 'property_tax' | 'electricity' | 'water_gas' | 'building_committee' | 'internet' | 'home_insurance' | 'netflix' | 'spotify' | 'groceries' | 'misc'
export type PoolCategory = 'restaurants' | 'entertainment' | 'travel' | 'shopping' | 'misc'

export interface Profile {
  id: string
  name: string
  partner_name?: string
  monthly_income: number
  apartment_monthly_target: number
  shared_split_pct: number
}

export interface Period {
  id: number
  label: string
  start_date: string
  end_date: string
  year_number: number
  period_number: number
  is_closed: boolean
}

export interface BudgetCategory {
  id: number
  user_id: string
  name: string
  type: BudgetType
  monthly_target: number
  icon?: string
  color?: string
  sort_order?: number
  year: number
}

export interface Income {
  id: number
  period_id: number
  user_id: string
  salary: number
  bonus: number
  other: number
  notes?: string
}

export interface PersonalExpense {
  id: number
  period_id: number
  user_id: string
  category_id: number
  amount: number
  description?: string
  expense_date?: string
  budget_categories?: BudgetCategory
}

export interface SharedExpense {
  id: number
  period_id: number
  category: SharedCategory
  total_amount: number
  my_share: number
  notes?: string
}

export interface SinkingFund {
  id: number
  user_id: string
  name: string
  monthly_allocation: number
  icon?: string
  color?: string
  is_active: boolean
}

export interface SinkingFundTransaction {
  id: number
  fund_id: number
  period_id: number
  amount: number
  description?: string
  transaction_date?: string
}

export interface ApartmentDeposit {
  id: number
  period_id: number
  amount_deposited: number
  notes?: string
}

export interface JointPoolIncome {
  id: number
  period_id: number
  my_contribution: number
  partner_contribution: number
  notes?: string
}

export interface JointPoolExpense {
  id: number
  period_id: number
  category: PoolCategory
  amount: number
  description?: string
  expense_date?: string
}
