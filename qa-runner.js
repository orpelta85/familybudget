/**
 * FamilyBudget QA Runner
 * Runs automated tests against localhost:3001
 * Usage: node qa-runner.js
 */
// Use MCP's playwright install if local not available
let playwrightModule;
try { playwrightModule = require('playwright'); } catch(e) {
  playwrightModule = require('C:/Users/User/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
}
const { chromium } = playwrightModule;
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';
const SCREENSHOTS_DIR = path.join(__dirname, 'qa-screenshots');
const EMAIL = 'orpelta85@gmail.com';
const PASSWORD = 'pelta1234';
// Use bundled Playwright chromium
const CHROMIUM_PATH = 'C:/Users/User/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';

const PAGES = [
  { name: 'dashboard', path: '/', hasPeriodSelector: true },
  { name: 'income', path: '/income', hasPeriodSelector: true },
  { name: 'budget', path: '/budget', hasPeriodSelector: true },
  { name: 'expenses', path: '/expenses', hasPeriodSelector: true },
  { name: 'sinking', path: '/sinking', hasPeriodSelector: false },
  { name: 'apartment', path: '/apartment', hasPeriodSelector: false },
  { name: 'analytics', path: '/analytics', hasPeriodSelector: true },
  { name: 'pool', path: '/pool', hasPeriodSelector: false },
  { name: 'pension', path: '/pension', hasPeriodSelector: false },
];

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

  // Use page.locator to find inputs
  const emailInput = page.locator('input[type="email"]');
  const passInput = page.locator('input[type="password"]');

  await emailInput.waitFor({ timeout: 10000 });

  // Clear and type slowly to trigger React onChange
  await emailInput.click({ clickCount: 3 });
  await emailInput.type(EMAIL, { delay: 50 });
  await passInput.click({ clickCount: 3 });
  await passInput.type(PASSWORD, { delay: 50 });

  // Click the submit button (not just Enter)
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  // Wait for navigation AWAY from login page (up to 15s)
  try {
    await page.waitForFunction(
      () => !window.location.href.includes('/login') && !window.location.href.includes('/auth'),
      { timeout: 15000 }
    );
    const finalUrl = page.url();
    console.log(`✓ Login successful → ${finalUrl}`);
    return true;
  } catch(e) {
    // Check if there's an error toast
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`✗ Login failed. Current URL: ${page.url()}`);
    console.log(`  Body snippet: ${bodyText.substring(0, 200)}`);
    return false;
  }
}

async function runQA() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'he-IL',
  });
  const page = await context.newPage();

  const results = { passed: [], failed: [], warnings: [] };
  const consoleErrors = {};

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Only log JS errors, not network 4xx (Supabase auth calls)
      if (!text.match(/40[0-4]/) && !text.includes('Failed to fetch')) {
        const key = new URL(page.url()).pathname;
        if (!consoleErrors[key]) consoleErrors[key] = [];
        consoleErrors[key].push(text);
      }
    }
  });

  // Step 0: Login
  console.log('\nStep 0: Login\n');
  const loggedIn = await login(page);
  if (!loggedIn) {
    results.failed.push({ page: 'LOGIN', error: 'Could not authenticate' });
    await browser.close();
    printReport(results, consoleErrors);
    return;
  }

  // Step 1: Test each page
  console.log('\nStep 1: Test pages\n');
  for (const pg of PAGES) {
    console.log(`Testing ${pg.name}...`);
    try {
      await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2500);

      // Check if we were redirected back to login
      if (page.url().includes('/login')) {
        results.failed.push({ page: pg.name, error: 'Redirected to login (auth lost)' });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${pg.name}.png`), fullPage: true });
        console.log(`  ✗ ${pg.name}: redirected to login`);
        continue;
      }

      // Take screenshot
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${pg.name}.png`), fullPage: true });

      // Check body content
      const bodyText = await page.evaluate(() => document.body?.innerText?.trim() || '');
      const bodyHTML = await page.evaluate(() => document.body?.innerHTML?.length || 0);

      if (bodyHTML < 200) {
        results.failed.push({ page: pg.name, error: 'White screen / no content' });
        console.log(`  ✗ ${pg.name}: white screen`);
        continue;
      }

      // Check for crash overlay
      const crashIndicators = ['Application error', 'Unhandled Runtime Error', 'Internal Server Error', 'digest:'];
      const hasCrash = crashIndicators.some(i => bodyText.includes(i));
      if (hasCrash) {
        results.failed.push({ page: pg.name, error: 'Crash/error overlay detected' });
        console.log(`  ✗ ${pg.name}: crash detected`);
        continue;
      }

      // Check period selector (look for any select or date-related button)
      if (pg.hasPeriodSelector) {
        const selCount = await page.locator('select, [role="combobox"], [data-period]').count();
        if (selCount === 0) {
          results.warnings.push(`${pg.name}: period selector not found`);
        }
      }

      // Dashboard: check grid layout
      if (pg.name === 'dashboard') {
        const gridCheck = await page.evaluate(() => {
          const els = document.querySelectorAll('*');
          for (const el of els) {
            const cs = window.getComputedStyle(el);
            if (cs.display === 'grid' && el.children.length >= 3) return true;
          }
          return false;
        });
        if (!gridCheck) {
          results.warnings.push('Dashboard: KPI cards may not be in grid (check screenshot)');
        }
      }

      // Expenses: check both sections
      if (pg.name === 'expenses') {
        // Look for Hebrew section headers
        const hasPersonal = await page.locator('text=/אישי|הוצאות אישי/').count() > 0;
        const hasShared = await page.locator('text=/משות|הוצאות משות/').count() > 0;
        if (!hasPersonal) results.warnings.push('Expenses: personal section header not found');
        if (!hasShared) results.warnings.push('Expenses: shared section header not found');
      }

      results.passed.push(pg.name);
      console.log(`  ✓ ${pg.name}`);

    } catch (e) {
      results.failed.push({ page: pg.name, error: e.message });
      console.log(`  ✗ ${pg.name}: ${e.message}`);
      try { await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${pg.name}-error.png`) }); } catch(_) {}
    }
  }

  // Step 2: Period persistence test
  console.log('\nStep 2: Period persistence\n');
  results.periodPersistence = await testPeriodPersistence(page);
  console.log(`  ${results.periodPersistence}`);

  await browser.close();
  printReport(results, consoleErrors);
}

async function testPeriodPersistence(page) {
  try {
    // Use hard navigation to dashboard first
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    const selects = page.locator('select');
    const count = await selects.count();
    if (count === 0) return 'skipped — no <select> element found on dashboard';

    const firstSelect = selects.first();
    const options = await firstSelect.locator('option').all();
    if (options.length < 2) return 'skipped — only one period option';

    // Select the FIRST option (index 0) — likely earliest period
    await firstSelect.selectOption({ index: 0 });
    await page.waitForTimeout(500);
    const selectedValue = await firstSelect.inputValue();

    // Use IN-APP navigation (click sidebar link) — this preserves React state (PeriodContext)
    const expensesLink = page.locator('a[href="/expenses"], nav a:has-text("הוצאות")').first();
    const linkCount = await expensesLink.count();
    if (linkCount === 0) {
      // Fallback to hard navigation (will likely fail due to React state reset)
      await page.goto(`${BASE_URL}/expenses`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } else {
      await expensesLink.click();
      await page.waitForTimeout(1500);
    }

    if (page.url().includes('/login')) return 'skipped — auth lost during navigation';

    const expensesSelects = page.locator('select');
    const expCount = await expensesSelects.count();
    if (expCount === 0) return 'skipped — no selector on expenses page';

    const expValue = await expensesSelects.first().inputValue();
    if (expValue === selectedValue) {
      return `✅ PASSES — period "${selectedValue}" persists via client-side navigation`;
    } else {
      return `❌ FAILS — set "${selectedValue}" on dashboard, expenses shows "${expValue}"`;
    }
  } catch(e) {
    return `Error: ${e.message}`;
  }
}

function printReport(results, consoleErrors) {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const line = '='.repeat(60);
  console.log('\n' + line);
  console.log(`## QA Report — ${ts}`);
  console.log(line);

  console.log('\n### ✅ Passed');
  results.passed.length ? results.passed.forEach(p => console.log(`  - ${p}`)) : console.log('  (none)');

  console.log('\n### ❌ Failed');
  results.failed.length ? results.failed.forEach(f => console.log(`  - ${f.page}: ${f.error}`)) : console.log('  (none)');

  console.log('\n### ⚠️  Warnings');
  results.warnings.length ? results.warnings.forEach(w => console.log(`  - ${w}`)) : console.log('  (none)');

  console.log('\n### Console Errors (non-4xx)');
  const ep = Object.keys(consoleErrors);
  ep.length ? ep.forEach(pg => { console.log(`  - ${pg}:`); consoleErrors[pg].forEach(e => console.log(`      ${e.substring(0, 150)}`)); }) : console.log('  (none)');

  console.log('\n### Period Persistence');
  console.log(`  ${results.periodPersistence || 'not tested'}`);

  const total = results.passed.length + results.failed.length;
  console.log(`\n### Summary: ${results.passed.length}/${total} pages passed`);
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`);
  console.log(line + '\n');
}

runQA().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
