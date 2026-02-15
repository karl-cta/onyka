/**
 * Encrypt existing plaintext content in the database.
 *
 * Usage: ENCRYPTION_KEY=<hex> pnpm db:encrypt
 *
 * This script is idempotent — rows already prefixed with `enc:v1:` are skipped.
 * After encryption, it rebuilds the FTS5 index with decrypted content.
 */

// Import env first — it initialises the encryption key
import '../config/env'

import { rawDb } from '../db/index.js'
import { encrypt, decrypt, isEncryptionEnabled } from '../utils/crypto.js'

interface Row {
  id: string
  [key: string]: string
}

const PREFIX = 'enc:v1:'

function encryptTable(table: string, fields: string[]): number {
  let count = 0

  // Build a WHERE clause: any field NOT starting with enc:v1: (or NULL)
  const conditions = fields.map((f) => `("${f}" IS NOT NULL AND "${f}" != '' AND "${f}" NOT LIKE 'enc:v1:%')`).join(' OR ')
  const rows = rawDb.prepare(`SELECT id, ${fields.map((f) => `"${f}"`).join(', ')} FROM "${table}" WHERE ${conditions}`).all() as Row[]

  if (rows.length === 0) {
    console.log(`  ${table}: nothing to encrypt`)
    return 0
  }

  const updateStmts = fields.map((f) =>
    rawDb.prepare(`UPDATE "${table}" SET "${f}" = ? WHERE id = ?`)
  )

  const transaction = rawDb.transaction(() => {
    for (const row of rows) {
      for (let i = 0; i < fields.length; i++) {
        const value = row[fields[i]]
        if (value && !value.startsWith(PREFIX)) {
          updateStmts[i].run(encrypt(value), row.id)
        }
      }
      count++
    }
  })

  transaction()
  console.log(`  ${table}: ${count} rows encrypted`)
  return count
}

function rebuildFtsIndex(): void {
  // Read all non-deleted notes and rebuild FTS with decrypted content
  const notes = rawDb.prepare(`
    SELECT id, title, content, mode, owner_id FROM notes WHERE is_deleted = 0
  `).all() as Array<{ id: string; title: string; content: string; mode: string; owner_id: string }>

  rawDb.exec('DELETE FROM notes_fts')

  const insertStmt = rawDb.prepare(`
    INSERT INTO notes_fts (title, content, note_id, owner_id)
    VALUES (?, ?, ?, ?)
  `)

  const transaction = rawDb.transaction(() => {
    for (const note of notes) {
      const title = decrypt(note.title)
      const content = decrypt(note.content)
      const textContent = content

      insertStmt.run(title, textContent, note.id, note.owner_id)
    }
  })

  transaction()
  console.log(`  notes_fts: rebuilt with ${notes.length} entries`)
}

// --- Main ---

if (!isEncryptionEnabled()) {
  console.error('\x1b[31mError: ENCRYPTION_KEY is not set. Cannot encrypt.\x1b[0m')
  console.error('Set ENCRYPTION_KEY in your .env file or environment.')
  process.exit(1)
}

console.log('\nEncrypting existing data...\n')

let total = 0
total += encryptTable('notes', ['title', 'content'])
total += encryptTable('note_pages', ['title', 'content'])
total += encryptTable('note_comments', ['content'])
total += encryptTable('thoughts', ['content'])

console.log('')

if (total > 0) {
  console.log('Rebuilding FTS index...\n')
  rebuildFtsIndex()
}

console.log(`\n\x1b[32mDone.\x1b[0m ${total} rows encrypted.\n`)
