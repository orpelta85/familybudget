-- ============================================================
-- Family Budget App — Full Schema
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  partner_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Users can read their own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);

-- ============================================================
-- PERIODS (billing cycles: 11th–10th)
-- ============================================================
create table if not exists periods (
  id serial primary key,
  label text not null,
  start_date date not null,
  end_date date not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table periods enable row level security;
create policy "Periods are readable by all authenticated users" on periods for select using (auth.role() = 'authenticated');

-- ============================================================
-- BUDGET CATEGORIES
-- ============================================================
create table if not exists budget_categories (
  id serial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('fixed','variable','sinking','savings')),
  monthly_target numeric(10,2) not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table budget_categories enable row level security;
create policy "Users can manage their own budget categories" on budget_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- INCOME
-- ============================================================
create table if not exists income (
  id serial primary key,
  period_id integer not null references periods(id),
  user_id uuid not null references profiles(id) on delete cascade,
  salary numeric(10,2) not null default 0,
  bonus numeric(10,2) not null default 0,
  other numeric(10,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (period_id, user_id)
);

alter table income enable row level security;
create policy "Users can manage their own income" on income
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- PERSONAL EXPENSES
-- ============================================================
create table if not exists personal_expenses (
  id serial primary key,
  period_id integer not null references periods(id),
  user_id uuid not null references profiles(id) on delete cascade,
  category_id integer references budget_categories(id),
  amount numeric(10,2) not null,
  description text not null default '',
  expense_date date not null,
  created_at timestamptz not null default now()
);

alter table personal_expenses enable row level security;
create policy "Users can manage their own personal expenses" on personal_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- SHARED EXPENSES (household 50/50)
-- ============================================================
create table if not exists shared_expenses (
  id serial primary key,
  period_id integer not null references periods(id),
  category text not null check (category in (
    'rent','property_tax','electricity','water_gas',
    'building_committee','internet','home_insurance',
    'netflix','spotify','groceries','misc'
  )),
  total_amount numeric(10,2) not null default 0,
  my_share numeric(10,2) generated always as (total_amount * 0.5) stored,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (period_id, category)
);

alter table shared_expenses enable row level security;
create policy "Authenticated users can manage shared expenses" on shared_expenses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- APARTMENT DEPOSITS
-- ============================================================
create table if not exists apartment_deposits (
  id serial primary key,
  period_id integer not null references periods(id),
  amount_deposited numeric(10,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (period_id)
);

alter table apartment_deposits enable row level security;
create policy "Authenticated users can manage apartment deposits" on apartment_deposits
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- SINKING FUNDS
-- ============================================================
create table if not exists sinking_funds (
  id serial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  monthly_allocation numeric(10,2) not null default 0,
  target_amount numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table sinking_funds enable row level security;
create policy "Users can manage their own sinking funds" on sinking_funds
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- SINKING FUND TRANSACTIONS
-- ============================================================
create table if not exists sinking_fund_transactions (
  id serial primary key,
  fund_id integer not null references sinking_funds(id) on delete cascade,
  period_id integer not null references periods(id),
  amount numeric(10,2) not null, -- positive = deposit, negative = withdrawal
  description text,
  transaction_date date not null,
  created_at timestamptz not null default now()
);

alter table sinking_fund_transactions enable row level security;
create policy "Users can manage their sinking fund transactions" on sinking_fund_transactions
  for all using (
    auth.uid() = (select user_id from sinking_funds where id = fund_id)
  ) with check (
    auth.uid() = (select user_id from sinking_funds where id = fund_id)
  );

-- ============================================================
-- JOINT POOL INCOME
-- ============================================================
create table if not exists joint_pool_income (
  id serial primary key,
  period_id integer not null references periods(id),
  my_contribution numeric(10,2) not null default 0,
  partner_contribution numeric(10,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (period_id)
);

alter table joint_pool_income enable row level security;
create policy "Authenticated users can manage joint pool income" on joint_pool_income
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- JOINT POOL EXPENSES
-- ============================================================
create table if not exists joint_pool_expenses (
  id serial primary key,
  period_id integer not null references periods(id),
  category text not null check (category in ('restaurants','entertainment','travel','shopping','misc')),
  amount numeric(10,2) not null,
  description text,
  expense_date date not null,
  created_at timestamptz not null default now()
);

alter table joint_pool_expenses enable row level security;
create policy "Authenticated users can manage joint pool expenses" on joint_pool_expenses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
