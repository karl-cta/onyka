#!/usr/bin/env node

/**
 * Onyka — Full Backup
 *
 * Creates a .tar.gz archive of the entire data/ directory:
 *   - onyka.db          (database — uses SQLite VACUUM INTO for consistency)
 *   - uploads/          (images)
 *   - .encryption-key   (AES-256-GCM key)
 *   - .jwt-secret       (JWT signing key)
 *
 * Usage:
 *   pnpm db:backup                    → backups/onyka-YYYY-MM-DD_HH-MM-SS.tar.gz
 *   pnpm db:backup ./my-backup.tar.gz → custom path
 *
 * Docker:
 *   docker exec onyka node /app/scripts/backup.js
 *   docker cp onyka:/app/data/backups/onyka-*.tar.gz .
 */

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, unlinkSync } from 'fs'
import { resolve, dirname, basename, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function log(msg = '') {
  console.log(`  ${msg}`)
}

/**
 * Resolve the data directory.
 * Priority: DATABASE_URL env var → .env file → auto-detect (root/data or apps/server/data)
 */
async function getDataDir() {
  // 1. Env var (Docker sets DATABASE_URL directly)
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL
    if (dbUrl.startsWith('./') || dbUrl.startsWith('../')) {
      return resolve(process.cwd(), dirname(dbUrl))
    }
    return dirname(dbUrl)
  }

  // 2. .env file (dev mode)
  const envPath = resolve(root, 'apps/server/.env')
  if (existsSync(envPath)) {
    const { readFileSync } = await import('fs')
    const content = readFileSync(envPath, 'utf-8')
    const match = content.match(/^DATABASE_URL=(.+)$/m)
    if (match) {
      const dbUrl = match[1].trim()
      if (dbUrl.startsWith('./') || dbUrl.startsWith('../')) {
        return resolve(root, 'apps/server', dirname(dbUrl))
      }
      return dirname(dbUrl)
    }
  }

  // 3. Auto-detect: check root/data first (prod), then apps/server/data (dev)
  const rootData = resolve(root, 'data')
  if (existsSync(join(rootData, 'onyka.db'))) return rootData

  const serverData = resolve(root, 'apps/server/data')
  if (existsSync(join(serverData, 'onyka.db'))) return serverData

  // Fallback to root/data (will show "not found" error)
  return rootData
}

async function main() {
  console.log('')
  log('╔══════════════════════════════════════╗')
  log('║          Onyka — Backup              ║')
  log('╚══════════════════════════════════════╝')
  console.log('')

  const dataDir = await getDataDir()
  const dbPath = join(dataDir, 'onyka.db')

  if (!existsSync(dbPath)) {
    console.error(`  [ERROR] Database not found: ${dbPath}`)
    console.error('')
    console.error('  Make sure the server has been started at least once.')
    process.exit(1)
  }

  // Create backup directory inside data/ (persists in Docker volumes)
  const backupDir = join(dataDir, 'backups')
  mkdirSync(backupDir, { recursive: true })

  // Timestamp for filenames
  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)

  // Custom path from CLI argument
  const customPath = process.argv[2]
  const archivePath = customPath
    ? resolve(process.cwd(), customPath)
    : join(backupDir, `onyka-${timestamp}.tar.gz`)

  // Step 1: Create a consistent DB snapshot using VACUUM INTO
  const dbSnapshotPath = join(backupDir, `_snapshot-${timestamp}.db`)
  log('Creating database snapshot...')

  try {
    execSync(`sqlite3 "${dbPath}" "VACUUM INTO '${dbSnapshotPath}'"`, { stdio: 'pipe' })
    log('✓ Database snapshot created')
  } catch {
    // Check if sqlite3 is available
    try {
      execSync('which sqlite3', { stdio: 'pipe' })
    } catch {
      console.error('  [ERROR] sqlite3 not found.')
      console.error('')
      console.error('  Install it:')
      console.error('    Ubuntu/Debian : sudo apt install sqlite3')
      console.error('    macOS         : brew install sqlite3')
      console.error('    Alpine/Docker : apk add sqlite')
      process.exit(1)
    }
    console.error('  [ERROR] Database snapshot failed.')
    process.exit(1)
  }

  // Step 2: Build tar.gz archive
  log('Creating archive...')

  // Collect files to archive (relative to dataDir)
  const filesToArchive = []

  // DB snapshot (renamed to onyka.db in the archive)
  filesToArchive.push({ src: dbSnapshotPath, archiveName: 'onyka.db' })

  // Secret files
  for (const secretFile of ['.encryption-key', '.jwt-secret']) {
    const p = join(dataDir, secretFile)
    if (existsSync(p)) {
      filesToArchive.push({ src: p, archiveName: secretFile })
    }
  }

  // Uploads directory
  const uploadsDir = join(dataDir, 'uploads')
  if (existsSync(uploadsDir)) {
    const uploadFiles = readdirSync(uploadsDir).filter(f => {
      const fp = join(uploadsDir, f)
      return statSync(fp).isFile()
    })
    for (const f of uploadFiles) {
      filesToArchive.push({ src: join(uploadsDir, f), archiveName: `uploads/${f}` })
    }
    log(`  ${uploadFiles.length} upload(s) found`)
  }

  // Create a staging directory, copy files, tar it
  const stagingDir = join(backupDir, `_staging-${timestamp}`)
  mkdirSync(stagingDir, { recursive: true })
  mkdirSync(join(stagingDir, 'uploads'), { recursive: true })

  for (const file of filesToArchive) {
    const dest = join(stagingDir, file.archiveName)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(file.src, dest)
  }

  try {
    execSync(`tar -czf "${archivePath}" -C "${stagingDir}" .`, { stdio: 'pipe' })
    log('✓ Archive created')
  } catch (err) {
    console.error(`  [ERROR] tar failed: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  // Cleanup staging + snapshot
  execSync(`rm -rf "${stagingDir}" "${dbSnapshotPath}"`, { stdio: 'pipe' })

  // Stats
  const stats = statSync(archivePath)
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)

  console.log('')
  log(`✓ Backup complete: ${basename(archivePath)} (${sizeMB} MB)`)
  log(`  Path: ${archivePath}`)
  console.log('')
  log('┌─────────────────────────────────────────────────────┐')
  log('│  To restore:                                        │')
  log('│  1. Stop Onyka                                      │')
  log('│  2. Extract the archive into your data/ directory:   │')
  log('│     tar -xzf backup.tar.gz -C /path/to/data/        │')
  log('│  3. Start Onyka                                      │')
  log('└─────────────────────────────────────────────────────┘')
  console.log('')
}

main().catch((err) => {
  console.error(`  [ERROR] ${err.message}`)
  process.exit(1)
})
