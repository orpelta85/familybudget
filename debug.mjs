const { chromium } = await import('C:/Users/User/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.js')

const browser = await chromium.launch({
  executablePath: 'C:\\Users\\User\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe',
  headless: true,
})

const ctx = await browser.newContext()
const page = await ctx.newPage()

const errors = []
page.on('console', msg => {
  if (msg.type() === 'error') errors.push('[console.error] ' + msg.text())
})
page.on('pageerror', err => {
  errors.push('[pageerror] ' + err.message + '\n' + err.stack)
})

try {
  await page.goto('https://familybudget-blush.vercel.app/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.fill('input[type="email"]', 'orpelta85@gmail.com')
  await page.fill('input[type="password"]', 'pelta1234')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(5000)

  process.stdout.write('URL: ' + page.url() + '\n')
  process.stdout.write('ERRORS:\n' + (errors.join('\n') || 'none') + '\n')

  const body = await page.evaluate(() => document.body.innerText.slice(0, 500))
  process.stdout.write('BODY: ' + body + '\n')
} catch(e) {
  process.stdout.write('CAUGHT: ' + e.message + '\n')
  process.stdout.write('ERRORS:\n' + (errors.join('\n') || 'none') + '\n')
}

await browser.close()
