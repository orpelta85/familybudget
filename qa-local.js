const { chromium, firefox } = require('/c/Users/User/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright')
const path = require('path')
const fs = require('fs')

const BASE = 'http://localhost:3001'
const SS_DIR = 'C:\Users\User\familybudget\qa-screenshots'
const EMAIL = 'orpelta85@gmail.com'
const PASS = 'pelta1234'

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true })

async function ss(page, name) {
  await page.screenshot({ path: path.join(SS_DIR, name + '.png'), fullPage: true })
}

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (!text.includes('supabase') && !text.includes('400') && !text.includes('401') && !text.includes('403') && !text.includes('404')) {
        errors.push({ page: 'unknown', msg: text })
      }
    }
  })

  const results = {}
  let currentPage = 'init'
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (!text.includes('supabase') && !text.match(/40[0-4]/)) {
        results[currentPage] = results[currentPage] || { passed: [], failed: [] }
        results[currentPage].failed.push('Console error: ' + text.substring(0, 100))
      }
    }
  })

  // Login
  console.log('Navigating to', BASE)
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => page.goto(BASE))
  await page.waitForTimeout(1500)
  
  if (page.url().includes('login') || page.url().includes('auth')) {
    console.log('Login page detected, logging in...')
    await page.fill('input[type="email"], input[name="email"]', EMAIL)
    await page.fill('input[type="password"], input[name="password"]', PASS)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
  }
  
  await ss(page, 'dashboard')
  console.log('Dashboard URL:', page.url())
  
  const pages = [
    { path: '/', name: 'dashboard', checks: ['period-selector', 'kpi-grid'] },
    { path: '/income', name: 'income' },
    { path: '/budget', name: 'budget' },
    { path: '/expenses', name: 'expenses' },
    { path: '/sinking', name: 'sinking' },
    { path: '/apartment', name: 'apartment' },
    { path: '/analytics', name: 'analytics' },
    { path: '/joint', name: 'joint' },
    { path: '/pension', name: 'pension' },
  ]
  
  for (const p of pages) {
    currentPage = p.name
    console.log(`\nTesting ${p.name}...`)
    try {
      await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2000)
      await ss(page, p.name)
      
      const bodyText = await page.evaluate(() => document.body?.innerText || '')
      const hasContent = bodyText.trim().length > 50
      const hasCrash = bodyText.includes('Application error') || bodyText.includes('500') && bodyText.includes('Internal')
      
      results[p.name] = results[p.name] || { passed: [], failed: [] }
      if (hasContent && !hasCrash) results[p.name].passed.push('loads OK')
      else results[p.name].failed.push('white screen or crash')
      
      console.log(`  ${p.name}: content=${hasContent}, crash=${hasCrash}`)
      console.log(`  URL: ${page.url()}`)
      console.log(`  Body snippet: ${bodyText.substring(0, 100).replace(/\n/g, ' ')}`)
    } catch (e) {
      results[p.name] = results[p.name] || { passed: [], failed: [] }
      results[p.name].failed.push('Navigation error: ' + e.message.substring(0, 80))
      console.log(`  ERROR: ${e.message.substring(0, 80)}`)
    }
  }
  
  // Print summary
  console.log('\n\n=== QA SUMMARY ===')
  for (const [name, r] of Object.entries(results)) {
    const status = r.failed.length === 0 ? '✅' : '❌'
    console.log(`${status} ${name}: passed=${r.passed.join(', ')} | failed=${r.failed.join(', ')}`)
  }
  
  await browser.close()
})()
