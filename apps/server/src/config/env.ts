import { config } from 'dotenv'
import { existsSync, appendFileSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { initEncryption } from '../utils/crypto.js'

const __envFilename = fileURLToPath(import.meta.url)
const __envDirname = dirname(__envFilename)
const serverEnvPath = resolve(__envDirname, '../../.env')
const cwdEnvPath = join(process.cwd(), '.env')
const envPath = existsSync(serverEnvPath) ? serverEnvPath : cwdEnvPath
const envExists = existsSync(envPath)

if (envExists) {
  config({ path: envPath })
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string().default('./data/onyka.db'),

  // JWT_SECRET is optional — auto-generated and persisted if not provided
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().default(30),

  // Comma-separated origins: "https://app.example.com,https://admin.example.com"
  CORS_ORIGIN: z.string().default('http://localhost:5173').transform((val, ctx) => {
    const origins = val.split(',').map((o) => o.trim()).filter(Boolean)
    for (const origin of origins) {
      try {
        const url = new URL(origin)
        if (!['http:', 'https:'].includes(url.protocol)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `CORS_ORIGIN "${origin}" must use http or https protocol` })
        }
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `CORS_ORIGIN "${origin}" is not a valid URL` })
      }
    }
    return origins.length === 1 ? origins[0] : origins
  }),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(200),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(10),
  VERSION_RETENTION_DAYS: z.coerce.number().default(30),
  MAX_VERSIONS_PER_NOTE: z.coerce.number().default(100),

  // See: https://expressjs.com/en/guide/behind-proxies.html
  TRUST_PROXY: z.union([
    z.literal('true').transform(() => true),
    z.literal('1').transform(() => 1),
    z.literal('loopback').transform(() => 'loopback' as const),
    z.string().min(1),
  ]).optional(),

  ADMIN_USERNAME: z.string().min(3).max(30).optional(),
  ADMIN_EMAIL: z.string().email().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Onyka <noreply@onyka.app>'),
  SMTP_SECURE: z.coerce.boolean().default(false),

  ENCRYPTION_KEY: z.string()
    .length(64, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    .regex(/^[0-9a-fA-F]+$/, 'ENCRYPTION_KEY must be hex')
    .optional(),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
}).superRefine((data, ctx) => {
  const smtpFields = { SMTP_HOST: data.SMTP_HOST, SMTP_USER: data.SMTP_USER, SMTP_PASS: data.SMTP_PASS }
  const defined = Object.entries(smtpFields).filter(([, v]) => v !== undefined)
  const missing = Object.entries(smtpFields).filter(([, v]) => v === undefined)

  if (defined.length > 0 && missing.length > 0) {
    for (const [field] of missing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} is required when SMTP is configured (${defined.map(([k]) => k).join(', ')} already set)`,
      })
    }
  }
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors

  console.error('')
  console.error('\x1b[31m  Configuration Error\x1b[0m')
  console.error('\x1b[2m  ──────────────────────\x1b[0m')
  console.error('')

  for (const [field, messages] of Object.entries(errors)) {
    console.error(`  \x1b[31m${field}\x1b[0m: ${messages?.join(', ')}`)
  }

  console.error('')

  if (!envExists) {
    console.error('  \x1b[33mNo .env file found.\x1b[0m')
    console.error('')
    console.error('  Run setup first:')
    console.error('  \x1b[34m$ pnpm run setup\x1b[0m')
    console.error('')
  } else {
    console.error('  Check your .env file at:')
    console.error(`  \x1b[2m${envPath}\x1b[0m`)
    console.error('')
  }

  process.exit(1)
}

export const env = parsed.data

// ---------------------------------------------------------------------------
// Data directory — single source of truth for all persisted files
// ---------------------------------------------------------------------------
const dataDir = resolve(dirname(env.DATABASE_URL))
mkdirSync(dataDir, { recursive: true })

/**
 * Load or auto-generate a secret key, persisting it to the data directory.
 * Pattern: check env → check data file → generate and save.
 */
function resolveSecret(opts: {
  name: string
  currentValue: string | undefined
  fileName: string
  generate: () => string
  validate?: (v: string) => boolean
}): string {
  const filePath = join(dataDir, opts.fileName)

  // 1. Already set via env var or .env file
  if (opts.currentValue && (!opts.validate || opts.validate(opts.currentValue))) {
    return opts.currentValue
  }

  // 2. Load from data directory (survives Docker rebuilds)
  if (existsSync(filePath)) {
    const saved = readFileSync(filePath, 'utf-8').trim()
    if (saved.length > 0 && (!opts.validate || opts.validate(saved))) {
      console.log(`\x1b[32m✓ ${opts.name} loaded from data directory\x1b[0m`)
      return saved
    }
  }

  // 3. Generate a new one
  const generated = opts.generate()

  // Persist to data directory
  try {
    writeFileSync(filePath, generated + '\n', { mode: 0o600 })
    console.log(`\x1b[32m✓ ${opts.name} auto-generated and saved to data directory\x1b[0m`)
  } catch (err) {
    console.error(`\x1b[31m✗ ${opts.name} generated but could NOT be persisted!\x1b[0m`)
    console.error(`  Path: ${filePath}`)
    console.error(`  Error: ${err instanceof Error ? err.message : err}`)
  }

  // Also append to .env if it exists (dev convenience)
  if (envExists) {
    const envContent = readFileSync(envPath, 'utf-8')
    if (!envContent.includes(`${opts.name}=`)) {
      appendFileSync(envPath, `\n# Auto-generated — DO NOT LOSE THIS KEY\n${opts.name}=${generated}\n`)
    }
  }

  return generated
}

// --- JWT_SECRET ---
env.JWT_SECRET = resolveSecret({
  name: 'JWT_SECRET',
  currentValue: env.JWT_SECRET,
  fileName: '.jwt-secret',
  generate: () => randomBytes(48).toString('base64url'),
  validate: (v) => v.length >= 32,
})

// --- ENCRYPTION_KEY ---
env.ENCRYPTION_KEY = resolveSecret({
  name: 'ENCRYPTION_KEY',
  currentValue: env.ENCRYPTION_KEY,
  fileName: '.encryption-key',
  generate: () => randomBytes(32).toString('hex'),
  validate: (v) => v.length === 64 && /^[0-9a-fA-F]+$/.test(v),
})

initEncryption(env.ENCRYPTION_KEY)

// ---------------------------------------------------------------------------
// Startup banner — data location & backup reminder
// ---------------------------------------------------------------------------
export function printStartupBanner(): void {
  const absDataDir = resolve(dataDir)
  console.log('')
  console.log('\x1b[36m  ╔══════════════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m  \x1b[1mOnyka\x1b[0m                                          \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ╠══════════════════════════════════════════════════╣\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m                                                  \x1b[36m║\x1b[0m')
  console.log(`\x1b[36m  ║\x1b[0m  Data:  \x1b[33m${absDataDir.padEnd(40)}\x1b[0m\x1b[36m║\x1b[0m`)
  console.log('\x1b[36m  ║\x1b[0m                                                  \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m  This folder contains everything:                \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m    onyka.db         your notes & settings        \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m    uploads/          your images                 \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m    .encryption-key   decrypts your data          \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m    .jwt-secret       signs auth tokens           \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m                                                  \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m  \x1b[33mBack up this folder. Without .encryption-key,\x1b[0m   \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m  \x1b[33mencrypted notes are PERMANENTLY lost.\x1b[0m          \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ║\x1b[0m                                                  \x1b[36m║\x1b[0m')
  console.log('\x1b[36m  ╚══════════════════════════════════════════════════╝\x1b[0m')
  console.log('')
}
