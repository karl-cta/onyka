import '../config/env'

import { rawDb } from '../db/index.js'
import { decrypt } from '../utils/crypto.js'
import { extractUploadFilenames } from '../utils/upload-refs.js'

interface Row {
  id: string
  noteId?: string
  content: string
}

function safeDecrypt(value: string): string {
  try {
    return decrypt(value)
  } catch {
    return ''
  }
}

function collect(noteId: string, content: string, refs: Map<string, Set<string>>): void {
  for (const filename of extractUploadFilenames(content)) {
    if (!refs.has(noteId)) refs.set(noteId, new Set())
    refs.get(noteId)!.add(filename)
  }
}

function backfill(): void {
  const refs = new Map<string, Set<string>>()

  const notes = rawDb.prepare('SELECT id, content FROM notes').all() as Row[]
  for (const row of notes) collect(row.id, safeDecrypt(row.content), refs)

  const pages = rawDb
    .prepare('SELECT id, note_id as noteId, content FROM note_pages WHERE is_deleted = 0')
    .all() as Row[]
  for (const row of pages) collect(row.noteId!, safeDecrypt(row.content), refs)

  const validFilenames = new Set(
    (rawDb.prepare('SELECT filename FROM uploads').all() as { filename: string }[]).map(
      (r) => r.filename
    )
  )

  const insert = rawDb.prepare(
    'INSERT OR IGNORE INTO note_uploads (note_id, filename) VALUES (?, ?)'
  )

  let inserted = 0
  rawDb.exec('BEGIN')
  try {
    for (const [noteId, filenames] of refs) {
      for (const filename of filenames) {
        if (!validFilenames.has(filename)) continue
        const result = insert.run(noteId, filename)
        if (result.changes > 0) inserted++
      }
    }
    rawDb.exec('COMMIT')
  } catch (err) {
    rawDb.exec('ROLLBACK')
    throw err
  }

  console.log(`Backfill complete: ${inserted} references written across ${refs.size} notes.`)
}

backfill()
