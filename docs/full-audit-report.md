# Family Plan -- Full Audit Report

**Date:** 2026-03-21
**Auditor:** Elite Project Manager (Claude Opus 4.6)
**Codebase:** c:\Users\User\familybudget
**Live URL:** https://familybudget-blush.vercel.app/
**Supabase project:** omvszlkasuuoffewlwiv

---

## Table of Contents

1. [Critical / Must Fix Before Launch](#1-critical--must-fix-before-launch)
2. [Code Quality](#2-code-quality)
3. [Security](#3-security)
4. [UI/UX Design](#4-uiux-design)
5. [Financial Accuracy](#5-financial-accuracy)
6. [Data Integrity](#6-data-integrity)
7. [Performance](#7-performance)
8. [Accessibility](#8-accessibility)
9. [Business Readiness](#9-business-readiness)
10. [Quick Wins](#10-quick-wins)
11. [Nice to Have](#11-nice-to-have)

---

## 1. Critical / Must Fix Before Launch

### CRIT-1: Hardcoded Test Password in Admin Page
- **Severity:** CRITICAL
- **File:** `src/app/admin/page.tsx:592`
- **Description:** The password `Test123456!` is hardcoded in plain text in the client-side admin page. Even though the admin page is gated by email check, this password is included in the JavaScript bundle shipped to ALL users. Anyone who inspects the bundle can see it.
- **Impact:** All test accounts can be compromised. If any real user shares that password pattern, they are at risk.
- **Recommendation:** Move impersonation to a server-side mechanism (e.g., admin API route that issues a session token via service role), or remove test-account impersonation entirely from production.

### CRIT-2: `admin_usage_logs` Table Has No RLS
- **Severity:** HIGH
- **File:** Database table `admin_usage_logs`
- **Description:** RLS is disabled (`rowsecurity: false`). Any authenticated user with the anon key can read/write this table directly.
- **Recommendation:** Enable RLS and add a policy restricting access to admin only, or remove the table if unused (it appears to have no references in code).

### CRIT-3: API Admin Routes Partially Excluded from Middleware
- **Severity:** HIGH
- **File:** `src/middleware.ts:66`
- **Description:** The middleware matcher `api/(?!admin)` correctly runs middleware on `/api/admin/*` routes. However, the admin API routes themselves use `requireAdmin()` (server-side auth check), which is good. But the middleware admin check at line 53 only checks the `/admin` page path, not `/api/admin` API paths. The API routes protect themselves via `requireAdmin()`, so this is not a vulnerability -- but it's an inconsistency that could cause confusion.
- **Recommendation:** Document that admin API protection is handled by `requireAdmin()`, not middleware.

### CRIT-4: No Password Strength Validation on Signup
- **Severity:** HIGH
- **File:** `src/app/login/page.tsx`
- **Description:** The signup form sends the password directly to Supabase with no client-side validation for minimum length, complexity, etc. Supabase has a default minimum of 6 characters, but users could set very weak passwords.
- **Recommendation:** Add client-side password strength validation (minimum 8 chars, at least one number).

### CRIT-5: `family_members` INSERT Policy Has No Restriction
- **Severity:** HIGH
- **File:** Database RLS policy "Users can join a family"
- **Description:** The INSERT policy on `family_members` has `qual: null` -- meaning any authenticated user can insert ANY row into `family_members`, potentially joining any family without an invite code.
- **Recommendation:** Add a WITH CHECK clause that validates the user can only insert rows where `user_id = auth.uid()`. Ideally, also validate the invite code at the RLS level or restrict inserts to go through the API only.

### CRIT-6: `mortgages`, `net_worth_entries/snapshots` INSERT Policies Have No Restriction
- **Severity:** MEDIUM
- **File:** Database RLS policies
- **Description:** INSERT policies on `mortgages`, `net_worth_entries`, `net_worth_snapshots`, and `mortgage_tracks` have `qual: null` (no restriction on who can insert). A malicious user could insert records with another user's `user_id`.
- **Recommendation:** Add `WITH CHECK (auth.uid() = user_id)` to all INSERT policies.

---

## 2. Code Quality

### CQ-1: Hooks Called After Early Returns (React Rules Violation)
- **Severity:** LOW
- **Files:** Multiple pages
- **Description:** Most pages follow the correct pattern of calling all hooks before the `if (loading || !user) return <Skeleton>` guard. This was done correctly across the codebase. The `useMemo` calls are also placed before early returns. Good job.
- **Status:** PASS

### CQ-2: 52 Empty `catch` Blocks
- **Severity:** MEDIUM
- **Files:** 19 files across the codebase
- **Description:** Pattern `catch { toast.error(...) }` is used 52 times. While the toast provides user feedback, the actual error is silently swallowed -- no `console.error` for debugging in production.
- **Recommendation:** Add `console.error(e)` inside catch blocks for debugging, or at minimum log to an error tracking service.

### CQ-3: 3 `eslint-disable` Comments
- **Severity:** LOW
- **Files:** `useGenerateAlerts.ts:191`, `advisor/page.tsx:67`, `net-worth/page.tsx:177`
- **Description:** All three disable `react-hooks/exhaustive-deps`. The advisor page one is questionable -- `generateTips()` is called inside a useEffect but the function is defined outside and references state.
- **Recommendation:** Refactor `generateTips` in advisor page to be a proper dependency or use `useCallback`.

### CQ-4: No TypeScript `any` Usage
- **Severity:** N/A
- **Description:** Zero instances of `: any` found in the codebase. Excellent TypeScript discipline.
- **Status:** PASS

### CQ-5: Inconsistent Query Key Patterns
- **Severity:** LOW
- **Description:** Most query keys follow the pattern `['entity_name', id1, id2]`, but some use different conventions:
  - `['all_personal_expenses', userId]` vs `['personal_expenses', periodId, userId]`
  - `['family_all_income', memberIds]` -- the `memberIds` array as a key dependency could cause unnecessary refetches if the array reference changes.
- **Recommendation:** Ensure `memberIds` arrays are memoized (they are, via `useMemo` -- good). Consider standardizing key naming.

### CQ-6: `createClient()` Used Directly in Page Components for Mutations
- **Severity:** MEDIUM
- **Files:** `sinking/page.tsx:74`, `joint/page.tsx:73`, `family/page.tsx:39-79`
- **Description:** Some pages create a Supabase client and run raw queries directly (e.g., `sb.from('sinking_fund_transactions').delete().in(...)`) instead of using React Query mutations. This bypasses cache invalidation patterns and is inconsistent with the query hook approach used elsewhere.
- **Recommendation:** Move these operations into mutation hooks in the respective query files.

### CQ-7: Large Page Components (God Components)
- **Severity:** MEDIUM
- **Files:** `expenses/page.tsx` (23K+ tokens), `page.tsx` (dashboard, 13K+ tokens)
- **Description:** The expenses page and dashboard are extremely large single-file components with complex state management, modals, and logic all in one file.
- **Recommendation:** Extract modals, form sections, and sub-views into separate components.

### CQ-8: Setup Page Claims "21 Categories" but Creates 15
- **Severity:** LOW
- **File:** `src/app/setup/page.tsx:39` vs `src/app/api/setup/route.ts`
- **Description:** The setup page UI says "21 categories" but the API route `STARTER_CATEGORIES` array has exactly 15 entries.
- **Recommendation:** Fix the display text to say "15 categories".

---

## 3. Security

### SEC-1: Hardcoded Admin Email
- **Severity:** MEDIUM
- **Files:** `middleware.ts:54`, `admin-server.ts:4`, `ImpersonationBanner.tsx:9`
- **Description:** Admin email `orpelta85@gmail.com` is hardcoded in three places. This is fine for a solo project but won't scale.
- **Recommendation:** Move to an environment variable or a database `admin_users` table.

### SEC-2: API Routes Authentication Status
- **Severity:** N/A (PASS)
- **Description:** All API routes properly check `getAuthUser()` or `requireAdmin()`:
  - `/api/admin/*` -- all 4 routes use `requireAdmin()`
  - `/api/family/*` -- all 5 routes use `getAuthUser()`
  - `/api/pension/*` -- uses `getAuthUser()`
  - `/api/setup` -- uses `getAuthUser()` + verifies `authUser.id === userId`
  - `/api/has-setup` -- uses `getAuthUser()` + verifies `authUser.id === userId`
  - `/api/reports/annual` -- uses `getAuthUser()`
  - `/api/alerts/monthly-summary` -- uses `getAuthUser()`
- **Status:** PASS

### SEC-3: RLS Policies Comprehensive Coverage
- **Severity:** N/A (MOSTLY PASS)
- **Description:** 34 out of 35 tables have RLS enabled. Only `admin_usage_logs` lacks RLS (see CRIT-2). All user-facing tables have proper `auth.uid() = user_id` or family-based policies. Nested tables (goal_deposits, kid_activities, mortgage_tracks, pension_products) use subquery-based policies checking parent ownership.
- **Issues:** INSERT policies on several tables lack `WITH CHECK` clauses (see CRIT-5, CRIT-6).

### SEC-4: No CSRF Protection Needed
- **Severity:** N/A
- **Description:** Supabase auth uses JWTs in cookies with `SameSite` attributes. Next.js API routes don't need additional CSRF tokens.
- **Status:** PASS

### SEC-5: No Rate Limiting on Most API Routes
- **Severity:** MEDIUM
- **Description:** Only `/api/family/join` GET has rate limiting (5 requests/IP/minute). Other routes like `/api/setup` POST, `/api/pension` POST (file upload), and admin routes have no rate limiting.
- **Recommendation:** Add rate limiting to `/api/setup` and `/api/pension` at minimum. Consider using Vercel's edge middleware rate limiting.

### SEC-6: `.env.local` Properly Gitignored
- **Severity:** N/A
- **Description:** `.gitignore` includes `.env.local`. No secrets found committed in source code (besides the test password in CRIT-1).
- **Status:** PASS

### SEC-7: Service Role Key Usage
- **Severity:** LOW
- **File:** `src/lib/supabase/server.ts`
- **Description:** `createServiceClient()` uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. This is used in all API routes. While necessary for cross-user queries (family data, admin), it means API route logic is the sole defense against unauthorized data access for those queries.
- **Recommendation:** Ensure every API route that uses `createServiceClient()` has proper authorization checks (currently they do).

---

## 4. UI/UX Design

### UX-1: Design Token Consistency
- **Severity:** LOW
- **Description:** The codebase defines a comprehensive design token system in `globals.css` (accent-blue, accent-green, etc.) and also has Shadcn/UI CSS variables. However, many page components still use hardcoded oklch values like `oklch(0.65_0.18_250)` instead of `text-primary` or `text-accent-blue`. This makes theme changes difficult.
- **Recommendation:** Replace hardcoded oklch values with design token CSS variables or Tailwind utility classes that reference the tokens.

### UX-2: Loading States
- **Severity:** N/A (PASS)
- **Description:** All pages use `<TableSkeleton>` or `<DashboardSkeleton>` components for loading states. Charts use `<ChartSkeleton>`. Good coverage.
- **Status:** PASS

### UX-3: Empty States
- **Severity:** LOW
- **Description:** Several pages use `<Inbox>` icon with text for empty states (budget, expenses, sinking). The codebase has a `NashufEmptyState` component (mascot), but it's not used on most pages.
- **Recommendation:** Use the mascot empty state consistently across all pages for a more polished feel.

### UX-4: Mobile Responsiveness
- **Severity:** MEDIUM
- **Description:** The CSS includes responsive breakpoints: `grid-2` and `grid-3` collapse to single column on mobile (`max-width: 768px`). KPI grids use `auto-fit`. Bottom navigation exists for mobile. However, some specific elements may have issues:
  - Inline currency inputs with `₪` positioning may overlap on small screens
  - The import grid (`grid-import-row`) uses fixed pixel widths that won't work on mobile
- **Recommendation:** Test all pages on 375px width. Fix the import grid for mobile.

### UX-5: RTL Compliance
- **Severity:** LOW
- **Description:** HTML is properly set to `dir="rtl"` and `lang="he"`. The `₪` symbol is placed correctly (after the number, as per Hebrew convention). Some inputs use `direction: ltr` for number entry, which is correct.
- **Minor issue:** The income input has `₪` positioned with `right-3` (absolute), which in RTL means it's on the logical "start" side -- correct for Hebrew.
- **Status:** MOSTLY PASS

### UX-6: Consistent Card Styling
- **Severity:** LOW
- **Description:** Cards use two patterns:
  1. Shadcn: `bg-card border border-border rounded-xl` (dashboard, budget KPIs)
  2. Hardcoded: `bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl` (income, most forms)
  These produce the same visual result since `--card` = `oklch(0.16 0.01 250)`, but the inconsistency makes maintenance harder.
- **Recommendation:** Use Shadcn tokens everywhere.

---

## 5. Financial Accuracy

### FIN-1: Budget Calculation Logic
- **Severity:** N/A (PASS)
- **File:** `src/app/budget/page.tsx`
- **Description:** The budget page correctly:
  - Separates fixed vs variable expenses
  - Maps shared expenses to fixed budget categories via `SHARED_TO_FIXED` mapping
  - Calculates remaining = income - fixed - variable actual
  - Shows per-category utilization percentages
  - Handles family income aggregation

### FIN-2: Split Logic (Shared/Personal)
- **Severity:** LOW
- **File:** `src/app/page.tsx:133`
- **Description:** The dashboard calculates `totalShared` using `e.my_share ?? e.total_amount * splitFrac`. This fallback logic is correct -- if `my_share` is stored, use it; otherwise calculate from split fraction. However, the budget page always uses `total_amount` for shared expenses (full family budget view), which is the intended behavior.
- **Status:** PASS

### FIN-3: Sinking Fund Balance Calculation
- **Severity:** LOW
- **File:** `src/app/sinking/page.tsx:85-89`
- **Description:** Balance is calculated as `deposits - withdrawals` by filtering positive/negative amounts. This is correct but slightly redundant -- could just sum all transactions since negative amounts already represent withdrawals.
- **Status:** PASS (functionally correct)

### FIN-4: Mortgage Amortization Math
- **Severity:** N/A (PASS)
- **File:** `src/app/mortgage/page.tsx:52-65`
- **Description:** The `computePayoff` function correctly implements standard amortization: each month applies interest, then subtracts payment. Has a `maxMonths` safety limit of 600. Returns total interest paid.
- **Status:** PASS

### FIN-5: Debt Payoff Calculations (Snowball/Avalanche)
- **Severity:** N/A (PASS)
- **File:** `src/app/debts/page.tsx:37-103`
- **Description:** Correctly implements both strategies:
  - Snowball: sorts by balance ascending
  - Avalanche: sorts by interest rate descending
  - Properly rolls over freed minimum payments to next target debt
  - Has 600-month safety cap
  - Reorders history columns back to original order for display
- **Status:** PASS

### FIN-6: Child Benefit Calculation
- **Severity:** MEDIUM
- **File:** `src/app/kids/page.tsx:28-36`
- **Description:** `calcChildBenefit` uses fixed amounts (173 for kid 1, 219 for kids 2-4, 173 for 5+). These are Bituach Leumi rates but may be outdated. The rates change periodically.
- **Recommendation:** Add a comment noting these rates are as of a specific date, or make them configurable.

### FIN-7: Bituach Leumi Savings Constant
- **Severity:** LOW
- **File:** `src/app/kids/page.tsx:47`
- **Description:** `BITUACH_LEUMI_SAVINGS = 58` is hardcoded. This government savings amount per child may change.
- **Recommendation:** Same as FIN-6 -- document the date or make configurable.

---

## 6. Data Integrity

### DI-1: No Orphaned Records
- **Severity:** N/A (PASS)
- **Description:** SQL verification confirmed zero orphaned records across all checked relationships:
  - 0 personal_expenses without user
  - 0 income without user
  - 0 budget_categories without user
  - 0 family_members without user
  - 0 goal_deposits without goal
  - 0 sinking_txns without fund
  - 0 mortgage_tracks without mortgage
- **Status:** PASS

### DI-2: 3 Potential Duplicate Expenses
- **Severity:** LOW
- **Description:** Found 3 groups of expenses with identical (user_id, period_id, category_id, amount, expense_date). These could be legitimate (e.g., two grocery trips on the same day for the same amount) or accidental duplicates.
- **Recommendation:** Add a UI indicator or dedup check when adding expenses with identical attributes.

### DI-3: Inconsistent Category Counts
- **Severity:** MEDIUM
- **Description:** Category counts per user vary:
  - 1 user has 40 categories (user `a17b9aee`) -- possibly a bug from multiple setup runs
  - 2 real users have 15 (correct)
  - 7 test users have 12-14 (not the standard 15)
- **Recommendation:** Investigate the user with 40 categories -- likely duplicate setup runs. Add a unique constraint on `(user_id, name, year)` to prevent duplicates.

### DI-4: Family and Period Counts
- **Severity:** N/A (PASS)
- **Description:** 8 families, 16 profiles, 36 periods -- all look reasonable for the current state of the app.
- **Status:** PASS

### DI-5: `apartment_goal` and `apartment_deposits` Tables Appear Unused
- **Severity:** LOW
- **Description:** No references to `apartment_goal` or `apartment_deposits` in the codebase (the apartment page redirects to goals). These tables have RLS enabled but are dead weight.
- **Recommendation:** Remove these tables in a future migration, or document they're deprecated.

---

## 7. Performance

### PERF-1: Dynamic Imports for Heavy Libraries
- **Severity:** N/A (PASS)
- **Description:** All chart components use `next/dynamic` with `ssr: false`:
  - `ExpenseDonut`, `IncomeTrendChart`, `AnalyticsCharts`, `ForecastChart`, `TrendChart`, `AdminGrowthChart`
  - XLSX import in budget export uses dynamic `import('xlsx')`
- **Status:** PASS

### PERF-2: `useMemo` Usage
- **Severity:** N/A (PASS)
- **Description:** 59 instances of `useMemo`/`useCallback` across page components. Key expensive computations are memoized:
  - Family member ID arrays
  - Filtered/sorted data
  - Trend calculations
  - Year-over-year computations
- **Status:** PASS

### PERF-3: React Query Configuration
- **Severity:** LOW
- **Description:** Global staleTime is 60 seconds, retry is 1. Specific overrides:
  - Periods: `staleTime: Infinity` (correct -- periods rarely change)
  - User: `staleTime: 5 minutes`
  - Profile: `staleTime: 10 minutes`
  - Family: `staleTime: 5 minutes`
- **Observation:** The `useAllPersonalExpenses` and `useAllIncome` queries fetch ALL data with no pagination. For power users with years of data, this could become slow.
- **Recommendation:** Consider pagination or limiting to recent 24 periods for "all" queries.

### PERF-4: Dashboard Fetches Too Many Queries
- **Severity:** MEDIUM
- **File:** `src/app/page.tsx`
- **Description:** The dashboard page triggers ~15 separate queries on load (income, expenses, shared, all income, all expenses, all shared, goals, deposits, pension, categories, funds, sinking tx, net worth, alerts, family summary). While React Query caches them, the initial load is heavy.
- **Recommendation:** Consider a server-side dashboard summary API route that aggregates the key KPI numbers in one query.

### PERF-5: Admin Stats Route Scalability
- **Severity:** MEDIUM
- **File:** `src/app/api/admin/stats/route.ts:17`
- **Description:** `listUsers({ perPage: 1000 })` fetches all users from Supabase Auth in one call. The admin users route also fetches ALL personal expenses just to count them per user. This will not scale beyond ~1000 users.
- **Recommendation:** Use SQL aggregation queries instead of loading all data into memory.

---

## 8. Accessibility

### A11Y-1: aria-labels Present on Interactive Elements
- **Severity:** N/A (PARTIAL PASS)
- **Description:** Found 62 `aria-label` instances across 20 files. Coverage includes:
  - Icon-only buttons in expenses, goals, mortgage, insurance pages
  - Delete/edit/close buttons
  - Navigation elements
- **Gaps:** Some icon-only buttons lack aria-labels (e.g., reset buttons in income page, some toggle buttons).
- **Recommendation:** Audit all `<button>` elements that only contain an icon and add aria-labels.

### A11Y-2: Keyboard Navigation
- **Severity:** MEDIUM
- **Description:** The app uses native `<button>` and `<input>` elements which are keyboard-focusable by default. However:
  - Budget category targets use `<span onClick>` for inline editing -- not keyboard accessible
  - Period selector pills use `<button>` (good)
  - Modal close buttons use `<button>` (good)
- **Recommendation:** Replace `<span onClick>` with `<button>` or add `role="button"` + `tabIndex={0}` + `onKeyDown`.

### A11Y-3: Color Contrast
- **Severity:** MEDIUM
- **Description:** The dark theme uses muted colors. Some text elements may have insufficient contrast:
  - `oklch(0.50_0.01_250)` text on `oklch(0.16_0.01_250)` background -- borderline
  - `oklch(0.55_0.01_250)` muted text -- may not meet WCAG AA 4.5:1 ratio
- **Recommendation:** Run a contrast checker on the key text/background combinations. Boost muted text to at least `oklch(0.60...)`.

### A11Y-4: Focus Indicators
- **Severity:** LOW
- **Description:** The global CSS sets `outline-ring/50` which provides focus rings. Custom buttons with explicit classes may override this.
- **Recommendation:** Verify focus visibility on all interactive elements in the browser.

---

## 9. Business Readiness

### BIZ-1: No Onboarding Flow for New Users
- **Severity:** HIGH
- **Description:** The setup page creates starter categories and funds with a single button click. There's no guided tour, no explanation of features, no step to enter actual income or invite family members. New users land on the dashboard with all zeros and may feel lost.
- **Recommendation:** Add a multi-step onboarding wizard: (1) Enter your name, (2) Enter income, (3) Customize categories, (4) Invite partner, (5) Dashboard tour.

### BIZ-2: No Terms of Service / Privacy Policy
- **Severity:** HIGH
- **Description:** The app handles sensitive financial data. There are no ToS or privacy policy pages, and no consent checkbox on signup.
- **Recommendation:** Must-have for any app handling financial data. Create ToS and Privacy Policy pages, add consent checkbox to signup.

### BIZ-3: No Pricing/Plans Page
- **Severity:** MEDIUM
- **Description:** The `user_plans` table exists with `free/premium/family/business` tiers, and the admin can set plans. But there's no user-facing pricing page or upgrade flow.
- **Recommendation:** Build a pricing page if you plan to monetize, or remove the plans infrastructure if the app will be free.

### BIZ-4: No Email Verification Enforcement
- **Severity:** MEDIUM
- **Description:** Users can sign up and Supabase sends a confirmation email, but the app doesn't explicitly block unverified users from using features.
- **Recommendation:** Add a check for email verification status before allowing full app access.

### BIZ-5: No Data Export (GDPR-like)
- **Severity:** MEDIUM
- **Description:** The budget page has an Excel export, but there's no way for users to export ALL their data or delete their account.
- **Recommendation:** Add a "Download my data" and "Delete my account" option in a settings/profile page.

### BIZ-6: No Error Boundary Beyond Root
- **Severity:** LOW
- **File:** `src/app/error.tsx` exists
- **Description:** There's a root error boundary, but individual pages don't have error boundaries. A crash in the mortgage amortization calculation could break the entire page.
- **Recommendation:** Add error boundaries around complex calculation sections.

### BIZ-7: PWA Support
- **Severity:** N/A (PASS)
- **Description:** The app has `manifest.json`, `PwaRegister` component, apple-touch-icon, and theme-color meta tag. Good mobile installability.
- **Status:** PASS

---

## 10. Quick Wins (30 minutes or less each)

| # | Task | Severity | File |
|---|------|----------|------|
| QW-1 | Fix "21 categories" text to "15 categories" in setup page | LOW | `setup/page.tsx:39` |
| QW-2 | Add `console.error(e)` to all empty catch blocks | MEDIUM | 19 files |
| QW-3 | Enable RLS on `admin_usage_logs` table | HIGH | Database migration |
| QW-4 | Add `WITH CHECK (auth.uid() = user_id)` to INSERT policies on `family_members`, `mortgages`, `net_worth_entries`, `net_worth_snapshots`, `mortgage_tracks` | HIGH | Database migration |
| QW-5 | Replace hardcoded oklch values with design tokens in income/budget pages | LOW | income, budget pages |
| QW-6 | Add aria-labels to remaining icon-only buttons | MEDIUM | Various pages |
| QW-7 | Use NashufEmptyState consistently for empty states | LOW | Multiple pages |
| QW-8 | Add password min-length validation to login form | HIGH | `login/page.tsx` |

---

## 11. Nice to Have (Future Improvements)

| # | Task | Impact |
|---|------|--------|
| NH-1 | Guided onboarding wizard for new users | HIGH |
| NH-2 | Settings page with profile edit, data export, account deletion | HIGH |
| NH-3 | Break down dashboard and expenses pages into smaller components | MEDIUM |
| NH-4 | Dashboard summary API route to reduce query count on load | MEDIUM |
| NH-5 | Pagination for "all expenses" and "all income" queries | MEDIUM |
| NH-6 | Terms of Service and Privacy Policy pages | HIGH |
| NH-7 | Admin route to clean up duplicate categories (user with 40) | LOW |
| NH-8 | Remove deprecated `apartment_goal` and `apartment_deposits` tables | LOW |
| NH-9 | Move admin impersonation to server-side token mechanism | HIGH |
| NH-10 | Add error boundaries per page section | LOW |
| NH-11 | Rate limiting on `/api/setup` and `/api/pension` routes | MEDIUM |
| NH-12 | Make child benefit / Bituach Leumi amounts configurable | LOW |

---

## Summary Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Code Quality | 8/10 | Clean TS, good patterns, needs component extraction |
| Security | 6/10 | Critical: hardcoded password, weak RLS INSERT policies |
| UI/UX Design | 8/10 | Consistent dark theme, good skeletons, token inconsistency |
| Financial Accuracy | 9/10 | All calculations verified correct |
| Data Integrity | 9/10 | Clean, minor dupes and category count anomaly |
| Performance | 7/10 | Good dynamic imports, dashboard over-fetches |
| Accessibility | 5/10 | Basic coverage, needs keyboard nav and contrast fixes |
| Business Readiness | 4/10 | Missing ToS, onboarding, account management |

**Overall:** The app is technically solid with excellent financial logic and a polished visual design. The two blockers for real-user launch are (1) the security issues (hardcoded password, weak INSERT policies) and (2) the business/legal requirements (ToS, privacy policy, proper onboarding).
