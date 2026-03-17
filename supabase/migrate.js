#!/usr/bin/env node
/**
 * Family Budget — Supabase Migration Runner
 *
 * Usage:
 *   node supabase/migrate.js
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const env = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [k, ...v] = line.split('=')
    if (k && v.length) acc[k.trim()] = v.join('=').trim()
    return acc
  }, {})

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local')
  process.exit(1)
}

if (!SERVICE_ROLE_KEY) {
  console.error(`
❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local

How to get it:
  1. Go to https://supabase.com/dashboard/project/omvszlkasuuoffewlwiv/settings/api
  2. Copy the "service_role" key (under "Project API Keys")
  3. Add this line to your .env.local file:
     SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

Then run this script again.
`)
  process.exit(1)
}

const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')

async function runSQL(sql, label) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql })
    const url = new URL(`https://api.supabase.com/v1/projects/${projectRef}/database/query`)

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ ${label}`)
          resolve(JSON.parse(data))
        } else {
          console.error(`❌ ${label} — HTTP ${res.statusCode}`)
          try { const d = JSON.parse(data); console.error(d.message || data) } catch { console.error(data) }
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  console.log(`\n🚀 Running migrations on project: ${projectRef}\n`)

  const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  const seedSQL = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8')

  // Remove commented blocks from seed (the per-user section)
  const seedCleaned = seedSQL.replace(/\/\*[\s\S]*?\*\//g, '')

  try {
    await runSQL(schemaSQL, 'Schema (tables + RLS policies)')
    await runSQL(seedCleaned, 'Seed data (36 periods)')
    console.log(`
✅ Migration complete!

Next steps:
  1. Sign up in the app at http://localhost:3001
  2. Get your User ID from: Supabase Dashboard → Authentication → Users
  3. Edit supabase/seed.sql — uncomment the bottom section, replace YOUR-USER-ID-HERE
  4. Re-run: node supabase/migrate.js --user-seed
`)
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message)
    console.error('\nAlternative: paste schema.sql and seed.sql manually in:')
    console.error('https://supabase.com/dashboard/project/omvszlkasuuoffewlwiv/sql/new')
    process.exit(1)
  }
}

main()
