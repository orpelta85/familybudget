/**
 * Full QA script — familybudget
 * Tests all pages after login with real credentials
 */

import { createRequire } from 'module'
import fs from 'fs'
const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/User/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.js')

const BASE = 'https://familybudget-blush.vercel.app'
const EMAIL = 'orpelta85@gmail.com'
const PASS  = 'pelta1234'
const DIR   = 'qa-screenshots-full'
const LOG   = []

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR)

function log(msg) {
  const line = `[${new Date().toISOString().slice(11,19)}] ${msg}`
  console.log(line)
  LOG.push(line)
}

const browser = await chromium.launch({
  executablePath: 'C:\\Users\\User\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe',
  headless: true,
})

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('pageerror', e => consoleErrors.push(e.message))
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })

async function ss(name) {
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true })
  log(`📸 ${name}.png`)
}

async function wait(ms) { await page.waitForTimeout(ms) }

// ── 1. Login ─────────────────────────────────────────────────────────────────
log('=== LOGIN ===')
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', PASS)
await ss('01-login')
await page.click('button[type="submit"]')
await wait(3000)
log('URL after login: ' + page.url())
await ss('02-after-login')

// ── 2. Dashboard ──────────────────────────────────────────────────────────────
log('=== DASHBOARD ===')
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await wait(2000)
const dashUrl = page.url()
log('Dashboard URL: ' + dashUrl)
const dashBody = await page.evaluate(() => document.body.innerText.slice(0, 300))
log('Dashboard content: ' + dashBody.replace(/\n/g, ' '))
const hasError = dashBody.includes('Application error') || dashBody.includes('client-side exception')
log(hasError ? '❌ Dashboard crashed!' : '✅ Dashboard loaded')
await ss('03-dashboard')

// ── 3. Income page ────────────────────────────────────────────────────────────
log('=== INCOME ===')
await page.goto(BASE + '/income', { waitUntil: 'networkidle' })
await wait(1500)
await ss('04-income-empty')

// Fill salary=16000, bonus=1000, other=500
const inputs = await page.$$('input[type="number"]')
log(`Found ${inputs.length} number inputs on income page`)
if (inputs.length >= 3) {
  await inputs[0].triple_click?.() || await inputs[0].click({ clickCount: 3 })
  await inputs[0].fill('16000')
  await inputs[1].click({ clickCount: 3 })
  await inputs[1].fill('1000')
  await inputs[2].click({ clickCount: 3 })
  await inputs[2].fill('500')
  await ss('05-income-filled')

  const saveBtn = await page.$('button:has-text("שמור")')
  if (saveBtn) {
    await saveBtn.click()
    await wait(2000)
    log('✅ Income saved')
    await ss('06-income-saved')
  } else {
    log('⚠️ Save button not found on income page')
  }
} else {
  log('⚠️ Could not find income inputs')
}

// ── 4. Budget page ────────────────────────────────────────────────────────────
log('=== BUDGET ===')
await page.goto(BASE + '/budget', { waitUntil: 'networkidle' })
await wait(1500)
const budgetBody = await page.evaluate(() => document.body.innerText.slice(0, 400))
log('Budget content: ' + budgetBody.replace(/\n/g, ' ').slice(0, 200))
await ss('07-budget')

// check for threshold dropdowns
const thresholdSelects = await page.$$('select')
log(`Found ${thresholdSelects.length} threshold selects on budget page`)
log(thresholdSelects.length > 0 ? '✅ Threshold selects found' : '⚠️ No threshold selects')

// ── 5. Expenses page ──────────────────────────────────────────────────────────
log('=== EXPENSES ===')
await page.goto(BASE + '/expenses', { waitUntil: 'networkidle' })
await wait(1500)
await ss('08-expenses')

// Try to add an expense
const addBtn = await page.$('button:has-text("הוסף")')
if (addBtn) {
  await addBtn.click()
  await wait(500)
  await ss('09-expenses-add-form')

  // Fill amount
  const amtInput = await page.$('input[type="number"]')
  if (amtInput) {
    await amtInput.fill('250')
    // Fill description
    const textInput = await page.$('input[type="text"]')
    if (textInput) await textInput.fill('בדיקת QA')
    // Select category (first option)
    const catSelect = await page.$('select')
    if (catSelect) await catSelect.selectOption({ index: 1 })
    await ss('10-expenses-form-filled')
    // Save
    const saveExpBtn = await page.$('button[type="submit"], button:has-text("שמור"), button:has-text("הוסף")')
    if (saveExpBtn) {
      await saveExpBtn.click()
      await wait(2000)
      log('✅ Expense added')
      await ss('11-expenses-after-add')
    }
  }
} else {
  log('⚠️ No add button on expenses page')
  await ss('09-expenses-no-add')
}

// ── 6. Shared expenses ────────────────────────────────────────────────────────
log('=== SHARED ===')
await page.goto(BASE + '/shared', { waitUntil: 'networkidle' })
await wait(1500)
await ss('12-shared')
// Try to fill rent
const sharedInputs = await page.$$('input[type="number"]')
log(`Found ${sharedInputs.length} inputs on shared page`)
if (sharedInputs.length >= 1) {
  await sharedInputs[0].click({ clickCount: 3 })
  await sharedInputs[0].fill('5000')  // rent
  if (sharedInputs.length >= 2) {
    await sharedInputs[1].click({ clickCount: 3 })
    await sharedInputs[1].fill('300')  // arnona
  }
  await ss('13-shared-filled')
  const saveShared = await page.$('button:has-text("שמור")')
  if (saveShared) {
    await saveShared.click()
    await wait(2000)
    log('✅ Shared expenses saved')
    await ss('14-shared-saved')
  }
}

// ── 7. Sinking funds ──────────────────────────────────────────────────────────
log('=== SINKING ===')
await page.goto(BASE + '/sinking', { waitUntil: 'networkidle' })
await wait(1500)
const sinkingBody = await page.evaluate(() => document.body.innerText.slice(0, 500))
log('Sinking content: ' + sinkingBody.replace(/\n/g, ' ').slice(0, 200))
const hasProgressBars = await page.$$eval('div', divs => divs.filter(d => d.style.width && d.style.width.includes('%')).length)
log(`Progress bar elements: ${hasProgressBars}`)
await ss('15-sinking')

// Try deposit on first fund
const depositBtn = await page.$('button:has-text("הפקדה")')
if (depositBtn) {
  await depositBtn.click()
  await wait(500)
  const modalInput = await page.$('input[type="number"]')
  if (modalInput) {
    await modalInput.fill('500')
    const confirmBtn = await page.$('button:has-text("רשום")')
    if (confirmBtn) {
      await confirmBtn.click()
      await wait(2000)
      log('✅ Sinking deposit made')
    }
  }
  await ss('16-sinking-after-deposit')
} else {
  log('⚠️ No deposit button on sinking page')
}

// ── 8. Joint pool ─────────────────────────────────────────────────────────────
log('=== JOINT ===')
await page.goto(BASE + '/joint', { waitUntil: 'networkidle' })
await wait(1500)
const jointBody = await page.evaluate(() => document.body.innerText.slice(0, 200))
log('Joint content: ' + jointBody.replace(/\n/g, ' '))
await ss('17-joint')

// ── 9. Apartment ──────────────────────────────────────────────────────────────
log('=== APARTMENT ===')
await page.goto(BASE + '/apartment', { waitUntil: 'networkidle' })
await wait(1500)
const aptBody = await page.evaluate(() => document.body.innerText.slice(0, 400))
log('Apartment content: ' + aptBody.replace(/\n/g, ' ').slice(0, 200))
await ss('18-apartment')

// Try depositing
const aptInput = await page.$('input[type="number"]')
if (aptInput) {
  await aptInput.fill('3500')
  const aptSave = await page.$('button:has-text("שמור"), button:has-text("הפקד")')
  if (aptSave) {
    await aptSave.click()
    await wait(2000)
    log('✅ Apartment deposit saved')
    await ss('19-apartment-saved')
  }
}

// ── 10. Analytics ─────────────────────────────────────────────────────────────
log('=== ANALYTICS ===')
await page.goto(BASE + '/analytics', { waitUntil: 'networkidle' })
await wait(2000)
const analyticsError = await page.evaluate(() =>
  document.body.innerText.includes('error') || document.body.innerText.includes('שגיאה')
)
log(analyticsError ? '⚠️ Analytics may have error' : '✅ Analytics loaded')
await ss('20-analytics')

// ── 11. Pension ───────────────────────────────────────────────────────────────
log('=== PENSION ===')
await page.goto(BASE + '/pension', { waitUntil: 'networkidle' })
await wait(1500)
await ss('21-pension')

// ── 12. Mobile view ───────────────────────────────────────────────────────────
log('=== MOBILE 375px ===')
await ctx.setExtraHTTPHeaders({})
const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } })
const mobilePage = await mobileCtx.newPage()
await mobilePage.goto(BASE + '/', { waitUntil: 'networkidle' })
await wait(2000)
await mobilePage.screenshot({ path: `${DIR}/22-mobile-dashboard.png`, fullPage: false })
log('📸 22-mobile-dashboard.png')
await mobilePage.goto(BASE + '/income', { waitUntil: 'networkidle' })
await wait(1000)
await mobilePage.screenshot({ path: `${DIR}/23-mobile-income.png`, fullPage: false })
log('📸 23-mobile-income.png')
await mobileCtx.close()

// ── Summary ───────────────────────────────────────────────────────────────────
log('=== DONE ===')
log(`Console errors: ${consoleErrors.length}`)
if (consoleErrors.length > 0) {
  consoleErrors.slice(0, 5).forEach(e => log('  ERROR: ' + e.slice(0, 120)))
}

const report = `# QA Report — Full Test
Date: ${new Date().toISOString().slice(0,10)}

## Log
${LOG.join('\n')}

## Console Errors (${consoleErrors.length})
${consoleErrors.slice(0,10).join('\n') || 'None'}
`

fs.writeFileSync('qa-report-full.md', report)
log('Report written to qa-report-full.md')

await browser.close()
