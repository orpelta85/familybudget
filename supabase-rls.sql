-- ============================================================
-- RLS Policies — Family Budget App
-- הרץ את זה ב-Supabase → SQL Editor → New Query
-- ============================================================

-- ── 1. Enable RLS on all tables ──────────────────────────────
ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE income                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinking_funds             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinking_fund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_deposits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_pool_income         ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_pool_expenses       ENABLE ROW LEVEL SECURITY;

-- ── 2. Drop existing policies (למניעת קונפליקטים) ────────────
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── 3. profiles — כל משתמש רואה ומעדכן רק את שלו ────────────
CREATE POLICY "profiles: own row"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── 4. periods — כולם קוראים, אף אחד לא כותב (נוצר ב-seed) ──
CREATE POLICY "periods: read only"
  ON periods FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── 5. budget_categories — per user ──────────────────────────
CREATE POLICY "budget_categories: own"
  ON budget_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 6. income — per user ─────────────────────────────────────
CREATE POLICY "income: own"
  ON income FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 7. personal_expenses — per user ──────────────────────────
CREATE POLICY "personal_expenses: own"
  ON personal_expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 8. shared_expenses — כל משתמש מחובר רואה וכותב ──────────
--    (הוצאות משותפות — אורי + שרה ביחד)
CREATE POLICY "shared_expenses: all authenticated"
  ON shared_expenses FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 9. sinking_funds — per user ──────────────────────────────
CREATE POLICY "sinking_funds: own"
  ON sinking_funds FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 10. sinking_fund_transactions — via fund ownership ───────
CREATE POLICY "sinking_transactions: via fund"
  ON sinking_fund_transactions FOR ALL
  USING (
    fund_id IN (
      SELECT id FROM sinking_funds WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    fund_id IN (
      SELECT id FROM sinking_funds WHERE user_id = auth.uid()
    )
  );

-- ── 11. apartment_deposits — משותף לכולם ─────────────────────
CREATE POLICY "apartment_deposits: all authenticated"
  ON apartment_deposits FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 12. joint_pool_income — משותף לכולם ─────────────────────
CREATE POLICY "joint_pool_income: all authenticated"
  ON joint_pool_income FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 13. joint_pool_expenses — משותף לכולם ───────────────────
CREATE POLICY "joint_pool_expenses: all authenticated"
  ON joint_pool_expenses FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── סיום ─────────────────────────────────────────────────────
SELECT 'RLS policies applied successfully ✅' AS result;
