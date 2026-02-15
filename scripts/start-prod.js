#!/usr/bin/env node

import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const serverDist = resolve(root, 'apps/server/dist/index.js')
const webDist = resolve(root, 'apps/web/dist/index.html')

let missing = false

if (!existsSync(serverDist)) {
  console.error('  [ERROR] Server build not found: apps/server/dist/index.js')
  missing = true
}

if (!existsSync(webDist)) {
  console.error('  [ERROR] Frontend build not found: apps/web/dist/index.html')
  missing = true
}

if (missing) {
  console.error('')
  console.error('  Run "pnpm build" first, then try again.')
  process.exit(1)
}

// Run database migrations before starting
console.log('  Running database migrations...')
try {
  execSync('node apps/server/dist/db/migrate.js', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  })
} catch {
  console.error('  [ERROR] Database migration failed.')
  process.exit(1)
}

console.log('  Starting Onyka in production mode...')
console.log('')

execSync('node apps/server/dist/index.js', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
})
