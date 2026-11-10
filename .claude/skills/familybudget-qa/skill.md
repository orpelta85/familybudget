---
name: familybudget-qa
description: >
  QA for the familybudget app at localhost:3001.
  Use ONLY when user explicitly asks: "run QA", "test the app", "בדוק את האפליקציה", "תבדוק הכל".
  Do NOT auto-trigger after every code change - that wastes tokens.
  For small changes, just verify the specific page that changed instead.
disable-model-invocation: true
---
# FamilyBudget QA Agent

Regression testing for the familybudget app at **http://localhost:3001**.

## Cost-saving rules

1. **Default: test ONLY the changed page(s)** - don't run full QA unless explicitly asked
2. **Use snapshots (not screenshots) for validation** - snapshots are text, much cheaper than images
3. **Only take screenshots for the final report** - one per page, viewport only (not fullPage)
4. **Use curl for API-only changes** - no need to open a browser
5. **Skip period persistence test** unless navigation/context code changed
6. **Check console errors once at the end** - not per-page

## Credentials
- Email: `orpelta85@gmail.com`
- Password: `pelta1234`

## Screenshot directory
Save screenshots to: `C:\Users\User\familybudget\qa-screenshots\`

## Pages
1. `/` - Dashboard
2. `/income` - Income
3. `/budget` - Budget
4. `/expenses` - Expenses
5. `/sinking` - Sinking Funds
6. `/apartment` - Apartment
7. `/analytics` - Analytics
8. `/joint` - Joint Pool
9. `/pension` - Pension
10. `/family` - Family Settings

## Quick test (single page)

When testing a specific page after a change:
1. Navigate to the page
2. Wait for content (wait for "טוען..." to disappear or 2s)
3. Take a snapshot - verify key elements exist, no crash
4. Check console for JS errors
5. Take one viewport screenshot
6. Report pass/fail

## Full QA (all pages)

Only when user says "run full QA" or "בדוק הכל":

### Step 0: Setup
- Navigate to `http://localhost:3001`
- If redirected to `/login`, log in with credentials above

### Step 1: For EACH page
1. Navigate to the page URL
2. Wait for content to load (wait for "טוען..." to disappear or 2s)
3. Take a **snapshot** (not screenshot) - verify key elements, no white screen, no crash
4. Take one **viewport** screenshot (not fullPage) saved as `<pagename>.png`

### Step 2: Period persistence test
1. On Dashboard - select a different period
2. Navigate to `/expenses` - verify same period selected
3. Navigate to `/income` - verify same period selected

### Step 3: Mobile responsiveness test (ALWAYS run this)
1. Resize browser to mobile: 390x844 (iPhone 14)
2. Navigate to at least 3 key pages (dashboard, expenses, pension)
3. For each, check:
   - Cards stack vertically (no 2-column grid)
   - No horizontal scroll
   - Text not cut off
   - Bottom Nav visible
   - Sidebar hidden
   - Touch targets >= 36px
4. Take mobile screenshot of dashboard
5. Resize back to desktop (1280x800)

### Step 4: Console check
Check console errors **once** at the end. Ignore Supabase 4xx errors.

### Step 5: Report

## Per-page key elements

**Dashboard** - KPI cards in grid, period selector, forecast section
**Income** - Period selector, income form, save button
**Budget** - Categories with amounts, progress bars
**Expenses** - Personal + shared sections, sinking fund locked rows, add form
**Sinking Funds** - Fund list, add button, monthly/annual amounts
**Apartment** - Progress bar, deposit form, period grid
**Analytics** - Charts, monthly table, year filter buttons
**Joint Pool** - Balance, income form, expense form
**Pension** - KPI cards or empty state, upload button

## Report format

```
## QA Report - [date]

### ✅ Passed
- Page: elements ✓

### ❌ Failed
- Page: issue ✗

### 📱 Mobile Responsiveness
- Page: mobile status (OK / broken grid / text cut off)

### ⚠️ Warnings
- Console errors on: [pages]

### Summary
X/N pages passed. Y/N mobile-ready. [critical issues if any]
```

## Notes
- Supabase 4xx console errors are NORMAL - ignore them
- JS exceptions (TypeError, ReferenceError) ARE failures
- White screen = crash = ❌
- If login fails, stop immediately
