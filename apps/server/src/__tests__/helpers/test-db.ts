import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as schema from '../../db/schema.js'

type TestDb = {
  db: BetterSQLite3Database<typeof schema>
  sqlite: DatabaseType
}

const migrationsFolder = fileURLToPath(new URL('../../../drizzle/', import.meta.url))

// Builds the schema from the real migrations, so tests can never drift from production DDL.
export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  const journal = JSON.parse(readFileSync(`${migrationsFolder}meta/_journal.json`, 'utf8')) as {
    entries: { tag: string }[]
  }
  for (const { tag } of journal.entries) {
    const statements = readFileSync(`${migrationsFolder}${tag}.sql`, 'utf8')
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean)
    for (const statement of statements) sqlite.exec(statement)
  }

  return { db: drizzle(sqlite, { schema }), sqlite }
}
