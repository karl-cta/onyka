import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'
import { decrypt } from '../utils/crypto.js'
import { extractUploadFilenames } from '../utils/upload-refs.js'

const __migrateDirname = dirname(fileURLToPath(import.meta.url))

const dbPath = env.DATABASE_URL.replace('file:', '')
const dbDir = dirname(dbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(dbPath)

const migrationsFolder = resolve(__migrateDirname, '../../drizzle')

// Create migrations tracking table (compatible with Drizzle's format)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL,
    created_at NUMERIC
  )
`)

// Get all already-applied migration hashes (content-based, not timestamp-based)
const appliedHashes = new Set<string>(
  (sqlite.prepare('SELECT hash FROM __drizzle_migrations').all() as { hash: string }[]).map(
    (r) => r.hash
  )
)

// Read journal
interface JournalEntry {
  idx: number
  when: number
  tag: string
  breakpoints: boolean
}
const journal = JSON.parse(
  readFileSync(resolve(migrationsFolder, 'meta/_journal.json'), 'utf8')
) as { entries: JournalEntry[] }

console.log('Running migrations...')

let applied = 0

for (const entry of journal.entries) {
  const sqlPath = resolve(migrationsFolder, `${entry.tag}.sql`)
  const sqlContent = readFileSync(sqlPath, 'utf8')
  const hash = createHash('sha256').update(sqlContent).digest('hex')

  // Skip if already applied (hash-based check — immune to timestamp ordering issues)
  if (appliedHashes.has(hash)) continue

  const statements = sqlContent
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  try {
    sqlite.exec('BEGIN')

    for (const stmt of statements) {
      try {
        sqlite.exec(stmt)
      } catch (err: unknown) {
        const sqliteErr = err as { code?: string; message?: string }
        // Handle DDL errors for already-applied schema changes gracefully.
        // This covers cases where a migration was applied in a previous deployment
        // but wasn't properly recorded in __drizzle_migrations (e.g. timestamp ordering issues).
        if (
          sqliteErr.code === 'SQLITE_ERROR' &&
          (sqliteErr.message?.includes('duplicate column name') ||
            sqliteErr.message?.includes('already exists'))
        ) {
          console.log(`  Skipping already-applied statement in ${entry.tag}`)
        } else {
          throw err
        }
      }
    }

    // Record migration as applied
    sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(
      hash,
      entry.when
    )

    sqlite.exec('COMMIT')
    console.log(`  Applied: ${entry.tag}`)
    applied++
  } catch (err) {
    sqlite.exec('ROLLBACK')
    console.error(`  Failed: ${entry.tag}`)
    throw err
  }
}

if (applied === 0) {
  console.log('  No new migrations to apply.')
}

backfillNoteUploadsIfNeeded()

console.log('Migrations complete!')
sqlite.close()

function backfillNoteUploadsIfNeeded(): void {
  const tableExists = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='note_uploads'")
    .get()
  if (!tableExists) return

  const uploadCount = (
    sqlite.prepare('SELECT COUNT(*) as c FROM uploads').get() as { c: number }
  ).c
  if (uploadCount === 0) return

  const refCount = (
    sqlite.prepare('SELECT COUNT(*) as c FROM note_uploads').get() as { c: number }
  ).c
  if (refCount > 0) return

  console.log('Backfilling note_uploads references from existing notes...')

  const refs = new Map<string, Set<string>>()
  const safe = (v: string) => { try { return decrypt(v) } catch { return '' } }
  const add = (noteId: string, text: string) => {
    for (const f of extractUploadFilenames(text)) {
      if (!refs.has(noteId)) refs.set(noteId, new Set())
      refs.get(noteId)!.add(f)
    }
  }

  const notesRows = sqlite.prepare('SELECT id, content FROM notes').all() as {
    id: string
    content: string
  }[]
  for (const row of notesRows) add(row.id, safe(row.content))

  const pageRows = sqlite
    .prepare('SELECT note_id, content FROM note_pages WHERE is_deleted = 0')
    .all() as { note_id: string; content: string }[]
  for (const row of pageRows) add(row.note_id, safe(row.content))

  const valid = new Set(
    (sqlite.prepare('SELECT filename FROM uploads').all() as { filename: string }[]).map(
      (r) => r.filename
    )
  )

  const insert = sqlite.prepare(
    'INSERT OR IGNORE INTO note_uploads (note_id, filename) VALUES (?, ?)'
  )

  let written = 0
  sqlite.exec('BEGIN')
  try {
    for (const [noteId, filenames] of refs) {
      for (const filename of filenames) {
        if (!valid.has(filename)) continue
        const r = insert.run(noteId, filename)
        if (r.changes > 0) written++
      }
    }
    sqlite.exec('COMMIT')
  } catch (err) {
    sqlite.exec('ROLLBACK')
    throw err
  }

  console.log(`  Backfill: ${written} references written across ${refs.size} notes.`)
}
