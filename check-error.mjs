import { chromium } from 'C:/Users/User/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.js'

const browser = await chromium.launch({
  executablePath: 'C:\\Users\\User\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe',
  headless: true,
})
const page = await browser.newPage()
const errors = []
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message))

// Login
await page.goto('https://familybudget-blush.vercel.app/login', { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', 'orpelta85@gmail.com')
await page.fill('input[type="password"]', 'pelta1234')
await page.click('button[type="submit"]')
await page.waitForTimeout(4000)

console.log('URL after login:', page.url())
console.log('\n=== ERRORS ===')
console.log(errors.join('\n') || 'no errors')

const title = await page.title()
console.log('Title:', title)
const content = await page.content()
const hasAppError = content.includes('Application error') || content.includes('client-side exception')
console.log('Has app error:', hasAppError)

await browser.close()
