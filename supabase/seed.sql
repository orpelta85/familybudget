-- ============================================================
-- Family Budget App — Seed Data
-- Run AFTER schema.sql
-- ============================================================

-- ============================================================
-- 36 PERIODS  (Year 1: 2025, Year 2: 2026, Year 3: 2027)
-- Each cycle: 11th of month → 10th of next month
-- ============================================================
insert into periods (label, start_date, end_date, is_closed, year_number) values
  -- Year 1 – 2025
  ('מחזור 1 — פברואר 2025',  '2025-01-11', '2025-02-10', true,  1),
  ('מחזור 2 — מרץ 2025',     '2025-02-11', '2025-03-10', true,  1),
  ('מחזור 3 — אפריל 2025',   '2025-03-11', '2025-04-10', true,  1),
  ('מחזור 4 — מאי 2025',     '2025-04-11', '2025-05-10', false, 1),
  ('מחזור 5 — יוני 2025',    '2025-05-11', '2025-06-10', false, 1),
  ('מחזור 6 — יולי 2025',    '2025-06-11', '2025-07-10', false, 1),
  ('מחזור 7 — אוגוסט 2025',  '2025-07-11', '2025-08-10', false, 1),
  ('מחזור 8 — ספטמבר 2025',  '2025-08-11', '2025-09-10', false, 1),
  ('מחזור 9 — אוקטובר 2025', '2025-09-11', '2025-10-10', false, 1),
  ('מחזור 10 — נובמבר 2025', '2025-10-11', '2025-11-10', false, 1),
  ('מחזור 11 — דצמבר 2025',  '2025-11-11', '2025-12-10', false, 1),
  ('מחזור 12 — ינואר 2026',  '2025-12-11', '2026-01-10', false, 1),
  -- Year 2 – 2026
  ('מחזור 13 — פברואר 2026', '2026-01-11', '2026-02-10', false, 2),
  ('מחזור 14 — מרץ 2026',    '2026-02-11', '2026-03-10', false, 2),
  ('מחזור 15 — אפריל 2026',  '2026-03-11', '2026-04-10', false, 2),
  ('מחזור 16 — מאי 2026',    '2026-04-11', '2026-05-10', false, 2),
  ('מחזור 17 — יוני 2026',   '2026-05-11', '2026-06-10', false, 2),
  ('מחזור 18 — יולי 2026',   '2026-06-11', '2026-07-10', false, 2),
  ('מחזור 19 — אוגוסט 2026', '2026-07-11', '2026-08-10', false, 2),
  ('מחזור 20 — ספטמבר 2026', '2026-08-11', '2026-09-10', false, 2),
  ('מחזור 21 — אוקטובר 2026','2026-09-11', '2026-10-10', false, 2),
  ('מחזור 22 — נובמבר 2026', '2026-10-11', '2026-11-10', false, 2),
  ('מחזור 23 — דצמבר 2026',  '2026-11-11', '2026-12-10', false, 2),
  ('מחזור 24 — ינואר 2027',  '2026-12-11', '2027-01-10', false, 2),
  -- Year 3 – 2027
  ('מחזור 25 — פברואר 2027', '2027-01-11', '2027-02-10', false, 3),
  ('מחזור 26 — מרץ 2027',    '2027-02-11', '2027-03-10', false, 3),
  ('מחזור 27 — אפריל 2027',  '2027-03-11', '2027-04-10', false, 3),
  ('מחזור 28 — מאי 2027',    '2027-04-11', '2027-05-10', false, 3),
  ('מחזור 29 — יוני 2027',   '2027-05-11', '2027-06-10', false, 3),
  ('מחזור 30 — יולי 2027',   '2027-06-11', '2027-07-10', false, 3),
  ('מחזור 31 — אוגוסט 2027', '2027-07-11', '2027-08-10', false, 3),
  ('מחזור 32 — ספטמבר 2027', '2027-08-11', '2027-09-10', false, 3),
  ('מחזור 33 — אוקטובר 2027','2027-09-11', '2027-10-10', false, 3),
  ('מחזור 34 — נובמבר 2027', '2027-10-11', '2027-11-10', false, 3),
  ('מחזור 35 — דצמבר 2027',  '2027-11-11', '2027-12-10', false, 3),
  ('מחזור 36 — ינואר 2028',  '2027-12-11', '2028-01-10', false, 3)
on conflict do nothing;

-- ============================================================
-- NOTE: Budget categories are per-user.
-- Run the categories seed AFTER signing up in the app.
-- Replace 'YOUR-USER-ID-HERE' with your actual Supabase auth user ID.
-- Find it in: Supabase Dashboard → Authentication → Users → your email → User UID
-- ============================================================

-- UNCOMMENT AND FILL IN YOUR USER ID:
/*
insert into profiles (id, display_name) values
  ('YOUR-USER-ID-HERE', 'אורי')
on conflict do nothing;

insert into budget_categories (user_id, name, type, monthly_target, sort_order) values
  -- Fixed expenses
  ('YOUR-USER-ID-HERE', 'שכירות (חלקי)', 'fixed', 2500, 1),
  ('YOUR-USER-ID-HERE', 'ארנונה (חלקי)', 'fixed', 150, 2),
  ('YOUR-USER-ID-HERE', 'חשמל (חלקי)', 'fixed', 100, 3),
  ('YOUR-USER-ID-HERE', 'מים+גז (חלקי)', 'fixed', 75, 4),
  ('YOUR-USER-ID-HERE', 'ועד בית (חלקי)', 'fixed', 125, 5),
  ('YOUR-USER-ID-HERE', 'אינטרנט (חלקי)', 'fixed', 50, 6),
  ('YOUR-USER-ID-HERE', 'ביטוח דירה (חלקי)', 'fixed', 60, 7),
  ('YOUR-USER-ID-HERE', 'נטפליקס (חלקי)', 'fixed', 30, 8),
  ('YOUR-USER-ID-HERE', 'ספוטיפיי (חלקי)', 'fixed', 25, 9),
  -- Variable expenses
  ('YOUR-USER-ID-HERE', 'מכולת (חלקי)', 'variable', 600, 10),
  ('YOUR-USER-ID-HERE', 'הוצאות אישיות', 'variable', 1500, 11),
  ('YOUR-USER-ID-HERE', 'בגדים', 'variable', 300, 12),
  ('YOUR-USER-ID-HERE', 'בריאות', 'variable', 200, 13),
  ('YOUR-USER-ID-HERE', 'תחבורה', 'variable', 400, 14),
  ('YOUR-USER-ID-HERE', 'ספורט', 'variable', 200, 15),
  ('YOUR-USER-ID-HERE', 'שונות', 'variable', 200, 16),
  -- Sinking funds
  ('YOUR-USER-ID-HERE', 'קרן חירום', 'sinking', 500, 17),
  ('YOUR-USER-ID-HERE', 'חופשה', 'sinking', 400, 18),
  ('YOUR-USER-ID-HERE', 'רכב', 'sinking', 300, 19),
  -- Savings
  ('YOUR-USER-ID-HERE', 'דירה', 'savings', 3500, 20),
  ('YOUR-USER-ID-HERE', 'השקעות', 'savings', 500, 21)
on conflict do nothing;

insert into sinking_funds (user_id, name, monthly_allocation, target_amount) values
  ('YOUR-USER-ID-HERE', 'קרן חירום', 500, 20000),
  ('YOUR-USER-ID-HERE', 'חופשה', 400, 8000),
  ('YOUR-USER-ID-HERE', 'רכב — תחזוקה', 300, 5000),
  ('YOUR-USER-ID-HERE', 'אלקטרוניקה', 150, 3000),
  ('YOUR-USER-ID-HERE', 'מתנות', 100, 1200)
on conflict do nothing;
*/
