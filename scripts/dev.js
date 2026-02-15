#!/usr/bin/env node

/**
 * Onyka Development Server
 * Auto-setup + clean startup with single URL output
 */

import { spawn, spawnSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const SERVER_DIR = join(ROOT_DIR, 'apps', 'server')
const WEB_DIR = join(ROOT_DIR, 'apps', 'web')
const ENV_FILE = join(SERVER_DIR, '.env')
const DATA_DIR = join(SERVER_DIR, 'data')

// ANSI
const green = (t) => `\x1b[32m${t}\x1b[0m`
const blue = (t) => `\x1b[34m${t}\x1b[0m`
const dim = (t) => `\x1b[2m${t}\x1b[0m`
const clear = '\x1b[2J\x1b[H'

// Auto-setup if needed
if (!existsSync(ENV_FILE)) {
  console.log('')
  console.log(dim('  First run - setting up...'))

  // Create data directory
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  // Generate .env
  const jwtSecret = randomBytes(48).toString('base64url')
  const envContent = `# Onyka Configuration
# Generated automatically - do not commit this file

NODE_ENV=development
PORT=3001
DATABASE_URL=./data/onyka.db
JWT_SECRET=${jwtSecret}
CORS_ORIGIN=http://localhost:5173
`
  writeFileSync(ENV_FILE, envContent)
  console.log(green('  + Environment configured'))
}

// Run migrations
console.log(dim('  Running database migrations...'))
const migrate = spawnSync('npx', ['drizzle-kit', 'migrate'], {
  cwd: SERVER_DIR,
  stdio: 'pipe',
  env: { ...process.env, NODE_ENV: 'development' },
})
if (migrate.status === 0) {
  console.log(green('  + Database ready'))
} else {
  console.log(dim('  (migrations checked)'))
}

let serverReady = false
let webReady = false

function showStatus() {
  if (serverReady && webReady) {
    console.log(clear)
    console.log('')
    console.log(green('  Onyka is running'))
    console.log(dim('  ──────────────────'))
    console.log('')
    console.log('  Open in browser:')
    console.log(blue('  http://localhost:5173'))
    console.log('')
    console.log(dim('  Press Ctrl+C to stop'))
    console.log('')
  }
}

// Start backend with npx
const server = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
  cwd: SERVER_DIR,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' },
})

server.stdout.on('data', (data) => {
  const text = data.toString()
  if (text.includes('Server running') || text.includes('listening') || text.includes('running on')) {
    serverReady = true
    showStatus()
  }
})

server.stderr.on('data', (data) => {
  const text = data.toString()
  // Filter out noise, show real errors
  if (text.includes('Error') || text.includes('error')) {
    console.error(text)
  }
})

// Start frontend with npx
const web = spawn('npx', ['vite'], {
  cwd: WEB_DIR,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' },
})

web.stdout.on('data', (data) => {
  const text = data.toString()
  if (text.includes('Local:') || text.includes('ready in') || text.includes('VITE')) {
    webReady = true
    showStatus()
  }
})

web.stderr.on('data', (data) => {
  const text = data.toString()
  if (text.includes('Error') || text.includes('error')) {
    console.error(text)
  }
})

// Handle exit
function cleanup() {
  server.kill()
  web.kill()
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Initial message
console.log('')
console.log(dim('  Starting Onyka...'))
