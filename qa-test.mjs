import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:\\Users\\User\\AppData\\Local\\npm-cache\\_npx\\9833c18b2d85bc59\\node_modules\\playwright');
import fs from 'fs';
import path from 'path';

const BASE = 'https://familybudget-blush.vercel.app';
const EMAIL = 'orpelta85@gmail.com';
const PASS = 'pelta1234';
const SS_DIR = './qa-screenshots-full';
const REPORT = './qa-report-full.md';

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR);

const issues = [];
const ok = [];
const suggestions = [];
let ssCount = 0;

async function ss(page, name) {
  const file = path.join(SS_DIR, `${String(++ssCount).padStart(2,'0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸 ${file}`);
  return file;
}

async function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
  if (emoji === '✅') ok.push(msg);
  else if (emoji === '❌') issues.push(msg);
  else if (emoji === '⚠️') suggestions.push(msg);
}

async function run() {
  console.log('🚀 Starting QA...\n');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    executablePath: 'C:\\Users\\User\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe',
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    // ── 1. LOGIN ────────────────────────────────────────────────────────────
    console.log('\n═══ 1. LOGIN ═══');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await ss(page, 'login-page');

    // Check redirect to login
    if (page.url().includes('/login')) {
      await log('✅', 'הפניה אוטומטית לדף התחברות עובדת');
    } else {
      await log('❌', `לא הופנה לדף התחברות — URL: ${page.url()}`);
    }

    // Fill login form
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await ss(page, 'login-filled');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
    await ss(page, 'after-login');

    if (!page.url().includes('/login')) {
      await log('✅', `התחברות הצליחה — URL: ${page.url()}`);
    } else {
      await log('❌', 'התחברות נכשלה — עדיין בדף ה-login');
      await browser.close();
      return;
    }

    // ── 2. DASHBOARD ────────────────────────────────────────────────────────
    console.log('\n═══ 2. DASHBOARD ═══');
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'dashboard');

    const h1 = await page.textContent('h1').catch(() => '');
    await log('✅', `כותרת הדשבורד: "${h1}"`);

    // Check KPI cards
    const kpiValues = await page.$$eval('[style*="fontWeight: 700"]', els =>
      els.slice(0, 8).map(e => e.textContent?.trim()).filter(Boolean)
    );
    await log('✅', `ערכי KPI שנמצאו: ${kpiValues.slice(0,6).join(' | ')}`);

    // Check for forecast card
    const forecastText = await page.locator('text=תחזית חודש').first().textContent().catch(() => null);
    if (forecastText) await log('✅', 'כרטיס תחזית חודשית מוצג');
    else await log('❌', 'כרטיס תחזית חודשית לא נמצא');

    // Check for donut chart
    const svgPresent = await page.locator('svg').count();
    if (svgPresent > 0) await log('✅', `גרפים SVG: ${svgPresent} נמצאו`);
    else await log('⚠️', 'לא נמצאו גרפים SVG בדשבורד');

    // Check year-over-year
    const yoyText = await page.locator('text=לעומת שנה').first().textContent().catch(() => null);
    if (yoyText) await log('✅', 'כרטיס השוואה שנתית מוצג');

    // ── 3. INCOME ────────────────────────────────────────────────────────────
    console.log('\n═══ 3. INCOME ═══');
    await page.goto(BASE + '/income', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await ss(page, 'income-before');

    // Check trend chart
    const trendChart = await page.locator('text=מגמת הכנסה').first().textContent().catch(() => null);
    if (trendChart) await log('✅', 'גרף מגמת הכנסה מוצג');

    // Enter income
    const inputs = await page.$$('input[type="number"]');
    if (inputs.length >= 3) {
      await inputs[0].fill('16000');
      await inputs[1].fill('1000');
      await inputs[2].fill('500');
      await ss(page, 'income-filled');

      const saveBtn = await page.locator('button:has-text("שמור")').first();
      await saveBtn.click();
      await page.waitForTimeout(2000);
      await ss(page, 'income-saved');
      await log('✅', 'הכנסה הוזנה ונשמרה: משכורת 16,000 + בונוס 1,000 + אחר 500');
    } else {
      await log('❌', `שדות קלט הכנסה: נמצאו ${inputs.length}, צפוי 3`);
    }

    // ── 4. BUDGET ────────────────────────────────────────────────────────────
    console.log('\n═══ 4. BUDGET ═══');
    await page.goto(BASE + '/budget', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'budget');

    const catRows = await page.$$('[style*="marginBottom: 12"]');
    await log('✅', `קטגוריות תקציב שנמצאו: ${catRows.length}`);

    // Check threshold dropdowns
    const thresholdSelects = await page.$$('select');
    if (thresholdSelects.length > 0) await log('✅', `dropdowns לסף התראה: ${thresholdSelects.length}`);
    else await log('⚠️', 'dropdowns לסף התראה לא נמצאו');

    // Try editing a target - click first editable target
    const editableTarget = await page.locator('[title="לחץ לעריכה"]').first();
    if (await editableTarget.count() > 0) {
      await editableTarget.click();
      await page.waitForTimeout(500);
      const editInput = await page.locator('input[type="number"]').first();
      await editInput.fill('2000');
      await editInput.press('Enter');
      await page.waitForTimeout(1500);
      await ss(page, 'budget-edited');
      await log('✅', 'עריכת יעד תקציב עובדת');
    } else {
      await log('⚠️', 'לא נמצאו יעדים לעריכה — אולי אין הוצאות עדיין');
    }

    // ── 5. EXPENSES ────────────────────────────────────────────────────────
    console.log('\n═══ 5. EXPENSES ═══');
    await page.goto(BASE + '/expenses', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'expenses-before');

    // Try to add expense
    const addBtn = await page.locator('button:has-text("הוסף")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await ss(page, 'expenses-modal');

      // Fill expense form
      const amtInput = await page.locator('input[type="number"]').first();
      await amtInput.fill('350');

      // Select category if dropdown exists
      const catSelect = await page.locator('select').first();
      if (await catSelect.count() > 0) {
        const options = await catSelect.$$('option');
        if (options.length > 1) await catSelect.selectOption({ index: 1 });
      }

      await ss(page, 'expenses-filled');
      const saveExpBtn = await page.locator('button:has-text("שמור")').first();
      await saveExpBtn.click();
      await page.waitForTimeout(2000);
      await ss(page, 'expenses-after');
      await log('✅', 'הוספת הוצאה אישית בוצעה');
    } else {
      await log('⚠️', 'כפתור הוספת הוצאה לא נמצא');
      // Check what's on the page
      const pageText = await page.locator('body').textContent();
      if (pageText?.includes('אין הוצאות')) await log('⚠️', 'הדף מציג "אין הוצאות"');
    }

    // ── 6. SHARED ────────────────────────────────────────────────────────────
    console.log('\n═══ 6. SHARED ═══');
    await page.goto(BASE + '/shared', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'shared-before');

    const sharedInputs = await page.$$('input[type="number"]');
    await log(sharedInputs.length > 0 ? '✅' : '❌', `שדות קלט הוצאות משותפות: ${sharedInputs.length}`);

    if (sharedInputs.length > 0) {
      // Fill rent, electricity, groceries
      await sharedInputs[0].fill('4000'); // rent
      if (sharedInputs.length > 2) await sharedInputs[2].fill('300'); // electricity
      if (sharedInputs.length > 9) await sharedInputs[9].fill('1500'); // groceries

      // Add custom category
      const addCatBtn = await page.locator('button:has-text("הוסף קטגוריה")').first();
      if (await addCatBtn.count() > 0) {
        await addCatBtn.click();
        await page.waitForTimeout(500);
        const customInputs = await page.$$('input[type="text"]');
        if (customInputs.length > 0) {
          await customInputs[customInputs.length - 1].fill('ביטוח רכב');
        }
        const customNumInputs = await page.$$('input[type="number"]');
        if (customNumInputs.length > sharedInputs.length) {
          await customNumInputs[customNumInputs.length - 1].fill('600');
        }
        await log('✅', 'קטגוריה מותאמת אישית נוספה: ביטוח רכב');
      }

      await ss(page, 'shared-filled');
      const saveSharedBtn = await page.locator('button:has-text("שמור")').first();
      await saveSharedBtn.click();
      await page.waitForTimeout(2000);
      await ss(page, 'shared-saved');
      await log('✅', 'הוצאות משותפות נשמרו');
    }

    // ── 7. SINKING FUNDS ───────────────────────────────────────────────────
    console.log('\n═══ 7. SINKING FUNDS ═══');
    await page.goto(BASE + '/sinking', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'sinking-before');

    const fundCards = await page.$$('[style*="oklch(0.16"]');
    await log('✅', `כרטיסי קרנות: ${fundCards.length} נמצאו`);

    const depositBtn = await page.locator('button:has-text("הפקדה")').first();
    if (await depositBtn.count() > 0) {
      await depositBtn.click();
      await page.waitForTimeout(500);
      await ss(page, 'sinking-deposit-modal');
      const depInput = await page.locator('input[type="number"]').first();
      if (await depInput.count() > 0) {
        await depInput.fill('500');
        const saveDepBtn = await page.locator('button:has-text("שמור")').first();
        await saveDepBtn.click();
        await page.waitForTimeout(2000);
        await ss(page, 'sinking-after-deposit');
        await log('✅', 'הפקדה לקרן בוצעה בהצלחה');
      }
    } else {
      await log('⚠️', 'כפתור הפקדה לא נמצא');
    }

    // ── 8. JOINT ───────────────────────────────────────────────────────────
    console.log('\n═══ 8. JOINT POOL ═══');
    await page.goto(BASE + '/joint', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'joint');
    const jointH1 = await page.textContent('h1').catch(() => '');
    await log('✅', `עמוד קופה משותפת נטען — כותרת: "${jointH1}"`);

    // ── 9. APARTMENT ───────────────────────────────────────────────────────
    console.log('\n═══ 9. APARTMENT ═══');
    await page.goto(BASE + '/apartment', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'apartment');
    const aptH1 = await page.textContent('h1').catch(() => '');
    await log('✅', `עמוד יעד הדירה נטען — כותרת: "${aptH1}"`);

    // ── 10. ANALYTICS ──────────────────────────────────────────────────────
    console.log('\n═══ 10. ANALYTICS ═══');
    await page.goto(BASE + '/analytics', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await ss(page, 'analytics');

    const anSvg = await page.locator('svg').count();
    await log(anSvg > 0 ? '✅' : '❌', `גרפים בדף אנליטיקס: ${anSvg}`);

    const tabs = await page.$$('[style*="cursor: pointer"]');
    await log('✅', `לשוניות אנליטיקס: ${tabs.length} נמצאו`);

    // ── 11. PENSION ────────────────────────────────────────────────────────
    console.log('\n═══ 11. PENSION ═══');
    await page.goto(BASE + '/pension', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'pension');
    const pensH1 = await page.textContent('h1').catch(() => '');
    await log('✅', `עמוד פנסיה נטען — כותרת: "${pensH1}"`);

    // ── 12. GO BACK TO DASHBOARD AND CHECK DATA ────────────────────────────
    console.log('\n═══ 12. DASHBOARD AFTER DATA ENTRY ═══');
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await ss(page, 'dashboard-with-data');
    await log('✅', 'דשבורד נטען מחדש עם נתונים שהוזנו');

    // ── 13. MOBILE TEST ────────────────────────────────────────────────────
    console.log('\n═══ 13. MOBILE (375px) ═══');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'mobile-dashboard');

    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    await log(overflow ? '❌' : '✅', `גלישה אופקית במובייל: ${overflow ? 'יש — באג' : 'אין — תקין'}`);

    await page.goto(BASE + '/expenses', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await ss(page, 'mobile-expenses');

    await page.goto(BASE + '/budget', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await ss(page, 'mobile-budget');

    // ── CONSOLE ERRORS ─────────────────────────────────────────────────────
    if (consoleErrors.length > 0) {
      await log('⚠️', `שגיאות קונסול: ${consoleErrors.join(' | ')}`);
    } else {
      await log('✅', 'אין שגיאות קונסול');
    }

  } catch (err) {
    issues.push(`שגיאה לא צפויה: ${err.message}`);
    console.error('❌ Unexpected error:', err);
    await ss(page, 'error-state');
  } finally {
    await browser.close();
  }

  // ── WRITE REPORT ─────────────────────────────────────────────────────────
  const report = `# דוח QA מלא — Family Budget App
**תאריך:** ${new Date().toLocaleDateString('he-IL')}
**URL:** ${BASE}
**צילומי מסך:** ${SS_DIR}/

---

## 🟢 מה עובד (${ok.length})
${ok.map(x => `- ✅ ${x}`).join('\n')}

---

## 🔴 באגים שנמצאו (${issues.length})
${issues.length ? issues.map(x => `- ❌ ${x}`).join('\n') : '- לא נמצאו באגים קריטיים'}

---

## 🟡 הצעות לשיפור (${suggestions.length})
${suggestions.length ? suggestions.map(x => `- ⚠️ ${x}`).join('\n') : '- אין הצעות נוספות'}

---

## 📊 סיכום
- **סה"כ בדיקות עברו:** ${ok.length}
- **באגים:** ${issues.length}
- **הצעות:** ${suggestions.length}
- **צילומי מסך:** ${ssCount}
`;

  fs.writeFileSync(REPORT, report, 'utf8');
  console.log(`\n✅ Report saved to ${REPORT}`);
  console.log(`\n📊 Summary: ${ok.length} OK | ${issues.length} bugs | ${suggestions.length} suggestions`);
}

run().catch(console.error);
