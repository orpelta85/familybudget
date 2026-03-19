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
  family_id: string
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
  yearly_target: number
  is_shared: boolean
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
  family_id: string
  period_id: number
  amount_deposited: number
  notes?: string
}

export interface JointPoolIncome {
  id: number
  family_id: string
  period_id: number
  my_contribution: number
  partner_contribution: number
  notes?: string
}

export interface JointPoolExpense {
  id: number
  family_id: string
  period_id: number
  category: PoolCategory
  amount: number
  description?: string
  expense_date?: string
}

// Family types
export interface Family {
  id: string
  name: string
  created_by: string
  invite_code: string
  created_at: string
}

export interface FamilyMember {
  id: number
  family_id: string
  user_id: string
  role: 'admin' | 'member'
  show_personal_to_family: boolean
  joined_at: string
}

// Pension types
export type PensionProductType = 'pension' | 'hishtalmut' | 'gemel_tagmulim' | 'gemel_invest' | 'health_insurance'

export interface PensionProduct {
  id: number
  report_id: number
  product_number: number
  product_type: PensionProductType
  product_name: string
  company: string
  account_number: string
  balance: number
  is_active: boolean
  mgmt_fee_deposits: number
  mgmt_fee_accumulation: number
  monthly_deposit: number
  monthly_employee: number
  monthly_employer: number
  monthly_severance: number
  salary_basis: number
  start_date: string | null
  investment_tracks: Array<{ name: string; percentage: number }>
  deposit_history: Array<{ date: string; salary: number; employer: number; employee: number; severance: number; total: number }>
  extra_data: Record<string, unknown>
}

export interface PensionHealthCoverage {
  id: number
  report_id: number
  coverage_name: string
  main_insured: number
  spouse: number
  child1: number
  child2: number
  child3: number
  child4: number
  total: number
}

export interface PensionReport {
  id: number
  user_id: string
  report_date: string
  advisor_name: string
  total_savings: number
  ytd_return: number
  total_monthly_deposits: number
  insurance_premium: number
  estimated_pension: number
  disability_coverage: number
  survivors_pension: number
  death_coverage: number
  summary_json: Record<string, unknown>
  file_name: string | null
  uploaded_at: string
  pension_products: PensionProduct[]
  pension_health_coverages: PensionHealthCoverage[]
}
