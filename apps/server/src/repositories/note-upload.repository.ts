import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { decrypt } from '../utils/crypto.js'
import { extractUploadFilenames } from '../utils/upload-refs.js'

const { noteUploads, notes, notePages } = schema

export class NoteUploadRepository {
  async syncFromNoteContent(noteId: string, noteContent: string): Promise<void> {
    const filenames = new Set(extractUploadFilenames(noteContent))

    const pageRows = await db
      .select({ content: notePages.content })
      .from(notePages)
      .where(and(eq(notePages.noteId, noteId), eq(notePages.isDeleted, false)))

    for (const row of pageRows) {
      try {
        for (const f of extractUploadFilenames(decrypt(row.content))) filenames.add(f)
      } catch {
        // skip undecryptable page content
      }
    }

    await this.write(noteId, [...filenames])
  }

  async syncFromPage(noteId: string): Promise<void> {
    const [noteRow] = await db
      .select({ content: notes.content })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1)

    if (!noteRow) return
    let noteContent = ''
    try {
      noteContent = decrypt(noteRow.content)
    } catch {
      noteContent = ''
    }
    await this.syncFromNoteContent(noteId, noteContent)
  }

  private async write(noteId: string, filenames: string[]): Promise<void> {
    const existing = await db
      .select({ filename: noteUploads.filename })
      .from(noteUploads)
      .where(eq(noteUploads.noteId, noteId))

    const existingSet = new Set(existing.map((r) => r.filename))
    const nextSet = new Set(filenames)

    const toInsert = filenames.filter((f) => !existingSet.has(f))
    const toDelete = [...existingSet].filter((f) => !nextSet.has(f))

    if (toDelete.length > 0) {
      await db
        .delete(noteUploads)
        .where(and(eq(noteUploads.noteId, noteId), inArray(noteUploads.filename, toDelete)))
    }

    if (toInsert.length > 0) {
      await db
        .insert(noteUploads)
        .values(toInsert.map((filename) => ({ noteId, filename })))
        .onConflictDoNothing()
    }
  }
}

export const noteUploadRepository = new NoteUploadRepository()
