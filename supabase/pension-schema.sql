-- ============================================================
-- Pension Module Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Pension Reports — one row per monthly upload
create table if not exists pension_reports (
  id serial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  report_date date not null,
  advisor_name text not null default '',
  total_savings numeric(12,2) not null default 0,
  ytd_return numeric(5,2) not null default 0,
  total_monthly_deposits numeric(10,2) not null default 0,
  insurance_premium numeric(10,2) not null default 0,
  estimated_pension numeric(10,2) not null default 0,
  disability_coverage numeric(10,2) not null default 0,
  survivors_pension numeric(10,2) not null default 0,
  death_coverage numeric(10,2) not null default 0,
  summary_json jsonb not null default '{}',
  file_name text,
  uploaded_at timestamptz not null default now(),
  unique (user_id, report_date)
);

alter table pension_reports enable row level security;
create policy "Users can manage their own pension reports" on pension_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Pension Products — one row per product per report
create table if not exists pension_products (
  id serial primary key,
  report_id integer not null references pension_reports(id) on delete cascade,
  product_number integer not null default 1,
  product_type text not null check (product_type in (
    'pension','hishtalmut','gemel_tagmulim','gemel_invest','health_insurance'
  )),
  product_name text not null,
  company text not null,
  account_number text,
  balance numeric(12,2) not null default 0,
  is_active boolean not null default true,
  mgmt_fee_deposits numeric(5,2) not null default 0,
  mgmt_fee_accumulation numeric(5,2) not null default 0,
  monthly_deposit numeric(10,2) not null default 0,
  monthly_employee numeric(10,2) not null default 0,
  monthly_employer numeric(10,2) not null default 0,
  monthly_severance numeric(10,2) not null default 0,
  salary_basis numeric(10,2) not null default 0,
  start_date date,
  investment_tracks jsonb not null default '[]',
  deposit_history jsonb not null default '[]',
  extra_data jsonb not null default '{}'
);

alter table pension_products enable row level security;
create policy "Users can view their pension products" on pension_products
  for all using (
    exists (select 1 from pension_reports where id = report_id and user_id = auth.uid())
  ) with check (
    exists (select 1 from pension_reports where id = report_id and user_id = auth.uid())
  );

-- Health Insurance Coverages — per report
create table if not exists pension_health_coverages (
  id serial primary key,
  report_id integer not null references pension_reports(id) on delete cascade,
  coverage_name text not null,
  main_insured numeric(10,2) not null default 0,
  spouse numeric(10,2) not null default 0,
  child1 numeric(10,2) not null default 0,
  child2 numeric(10,2) not null default 0,
  child3 numeric(10,2) not null default 0,
  child4 numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0
);

alter table pension_health_coverages enable row level security;
create policy "Users can view their health coverages" on pension_health_coverages
  for all using (
    exists (select 1 from pension_reports where id = report_id and user_id = auth.uid())
  ) with check (
    exists (select 1 from pension_reports where id = report_id and user_id = auth.uid())
  );
