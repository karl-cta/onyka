import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { env } from '../config/env.js'
import * as schema from './schema.js'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const dbPath = env.DATABASE_URL.replace('file:', '')
const dbDir = dirname(dbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(dbPath)

sqlite.pragma('journal_mode = WAL')

// Recreate FTS table if it was created with the old contentless schema (content='')
// which prevents reading back UNINDEXED columns (note_id, owner_id return NULL)
const ftsInfo = sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'notes_fts'").get() as { sql: string } | undefined
let ftsNeedsReindex = false
if (ftsInfo && ftsInfo.sql?.includes("content=''")) {
  sqlite.exec('DROP TABLE notes_fts')
  ftsNeedsReindex = true
}

sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    content,
    note_id UNINDEXED,
    owner_id UNINDEXED,
    tokenize='porter unicode61'
  )
`)

export const db = drizzle(sqlite, { schema })

export const rawDb: DatabaseType = sqlite

export { schema }

export { ftsNeedsReindex }
