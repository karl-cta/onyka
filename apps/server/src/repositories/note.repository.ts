import { eq, and, isNull, desc, sql, inArray, gt, gte, lt, lte } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import { logger } from '../utils/index.js'
import type { Note, NoteCreateInput, NoteUpdateInput, Tag, NoteWithTags } from '@onyka/shared'

const { notes, noteTags, tags } = schema

export interface NoteFilters {
  folderId?: string | null
  isDeleted?: boolean
  tagIds?: string[]
}

export class NoteRepository {
  async findById(id: string): Promise<Note | null> {
    const result = await db
      .select()
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1)
    return result[0] ? this.mapToNote(result[0]) : null
  }

  async findByIdWithTags(id: string): Promise<NoteWithTags | null> {
    const note = await this.findById(id)
    if (!note) return null

    const noteTags = await this.getTagsForNote(id)
    return { ...note, tags: noteTags }
  }

  async findByOwner(ownerId: string, filters: NoteFilters = {}): Promise<Note[]> {
    const conditions = [
      eq(notes.ownerId, ownerId),
      eq(notes.isDeleted, filters.isDeleted ?? false),
    ]

    if (filters.folderId !== undefined) {
      conditions.push(
        filters.folderId === null
          ? isNull(notes.folderId)
          : eq(notes.folderId, filters.folderId)
      )
    }

    const result = await db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.updatedAt))

    // Filter by tags if specified
    if (filters.tagIds && filters.tagIds.length > 0) {
      const noteIds = result.map((n) => n.id)
      const noteTagRows = await db
        .select({ noteId: noteTags.noteId })
        .from(noteTags)
        .where(
          and(
            inArray(noteTags.noteId, noteIds),
            inArray(noteTags.tagId, filters.tagIds)
          )
        )

      const matchingNoteIds = new Set(noteTagRows.map((r) => r.noteId))
      return result.filter((n) => matchingNoteIds.has(n.id)).map(this.mapToNote)
    }

    return result.map(this.mapToNote)
  }

  async create(ownerId: string, input: NoteCreateInput): Promise<Note> {
    const now = new Date()
    const id = nanoid()
    const folderId = input.folderId ?? null

    // Get next position for notes in this folder
    const position = await this.getNextPosition(ownerId, folderId)

    const plainTitle = input.title ?? 'Untitled'
    const plainContent = input.content ?? ''

    await db.insert(notes).values({
      id,
      title: encrypt(plainTitle),
      content: encrypt(plainContent),
      mode: 'text',
      icon: input.icon ?? 'FileText',
      position,
      isQuickNote: input.isQuickNote ?? false,
      folderId,
      ownerId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      title: plainTitle,
      content: plainContent,
      icon: input.icon ?? 'FileText',
      isQuickNote: input.isQuickNote ?? false,
      folderId,
      ownerId,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
  }

  async update(id: string, input: NoteUpdateInput): Promise<Note | null> {
    const now = new Date()
    const updateData: Record<string, unknown> = { updatedAt: now }

    if (input.title !== undefined) updateData.title = encrypt(input.title)
    if (input.content !== undefined) updateData.content = encrypt(input.content)
    if (input.icon !== undefined) updateData.icon = input.icon
    if (input.isQuickNote !== undefined) updateData.isQuickNote = input.isQuickNote
    if (input.folderId !== undefined) updateData.folderId = input.folderId
    await db.update(notes).set(updateData).where(eq(notes.id, id))
    return this.findById(id)
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date()
    const result = await db
      .update(notes)
      .set({ isDeleted: true, deletedAt: now, updatedAt: now })
      .where(eq(notes.id, id))
    return result.changes > 0
  }

  async restore(id: string): Promise<Note | null> {
    const now = new Date()
    const result = await db
      .update(notes)
      .set({ isDeleted: false, deletedAt: null, updatedAt: now })
      .where(eq(notes.id, id))

    if (result.changes === 0) {
      return null
    }

    // Return the updated note directly (avoid extra findById)
    return this.findById(id)
  }

  async permanentDelete(id: string): Promise<boolean> {
    const result = await db.delete(notes).where(eq(notes.id, id))
    return result.changes > 0
  }

  async addTag(noteId: string, tagId: string): Promise<void> {
    await db.insert(noteTags).values({ noteId, tagId }).onConflictDoNothing()
  }

  async removeTag(noteId: string, tagId: string): Promise<void> {
    await db
      .delete(noteTags)
      .where(and(eq(noteTags.noteId, noteId), eq(noteTags.tagId, tagId)))
  }

  async getTagsForNote(noteId: string): Promise<Tag[]> {
    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        ownerId: tags.ownerId,
      })
      .from(noteTags)
      .innerJoin(tags, eq(noteTags.tagId, tags.id))
      .where(eq(noteTags.noteId, noteId))

    return result
  }

  async countByFolder(folderId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(and(eq(notes.folderId, folderId), eq(notes.isDeleted, false)))
    return result[0]?.count ?? 0
  }

  async findQuickNotes(ownerId: string): Promise<Note[]> {
    const result = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.ownerId, ownerId),
          eq(notes.isQuickNote, true),
          eq(notes.isDeleted, false)
        )
      )
      .orderBy(desc(notes.updatedAt))
    return result.map(this.mapToNote)
  }

  async findByIds(ids: string[]): Promise<Note[]> {
    if (ids.length === 0) return []

    const result = await db
      .select()
      .from(notes)
      .where(inArray(notes.id, ids))
      .orderBy(desc(notes.updatedAt))
    return result.map(this.mapToNote)
  }

  /**
   * Reorder a note to a new position within the same folder or move to a different folder
   */
  async reorder(
    noteId: string,
    ownerId: string,
    newFolderId: string | null,
    newPosition: number
  ): Promise<Note | null> {
    const note = await this.findById(noteId)
    if (!note || note.ownerId !== ownerId) return null

    const oldFolderId = note.folderId

    // Get current position - need to query directly since mapToNote doesn't include it
    const [noteRow] = await db
      .select({ position: notes.position })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1)

    const oldPosition = noteRow?.position ?? 0
    const now = new Date()

    // If moving to a different folder
    if (oldFolderId !== newFolderId) {
      // Close the gap in the old folder
      await db
        .update(notes)
        .set({ position: sql`${notes.position} - 1`, updatedAt: now })
        .where(
          and(
            eq(notes.ownerId, ownerId),
            eq(notes.isDeleted, false),
            oldFolderId === null ? isNull(notes.folderId) : eq(notes.folderId, oldFolderId),
            gt(notes.position, oldPosition)
          )
        )

      // Make space in the new folder
      await db
        .update(notes)
        .set({ position: sql`${notes.position} + 1`, updatedAt: now })
        .where(
          and(
            eq(notes.ownerId, ownerId),
            eq(notes.isDeleted, false),
            newFolderId === null ? isNull(notes.folderId) : eq(notes.folderId, newFolderId),
            gte(notes.position, newPosition)
          )
        )

      // Move the note
      await db
        .update(notes)
        .set({ folderId: newFolderId, position: newPosition, updatedAt: now })
        .where(eq(notes.id, noteId))
    } else {
      // Same folder, just reorder
      if (newPosition > oldPosition) {
        // Moving down: shift items between old and new position up
        await db
          .update(notes)
          .set({ position: sql`${notes.position} - 1`, updatedAt: now })
          .where(
            and(
              eq(notes.ownerId, ownerId),
              eq(notes.isDeleted, false),
              oldFolderId === null ? isNull(notes.folderId) : eq(notes.folderId, oldFolderId),
              gt(notes.position, oldPosition),
              lte(notes.position, newPosition)
            )
          )
      } else if (newPosition < oldPosition) {
        // Moving up: shift items between new and old position down
        await db
          .update(notes)
          .set({ position: sql`${notes.position} + 1`, updatedAt: now })
          .where(
            and(
              eq(notes.ownerId, ownerId),
              eq(notes.isDeleted, false),
              oldFolderId === null ? isNull(notes.folderId) : eq(notes.folderId, oldFolderId),
              gte(notes.position, newPosition),
              lt(notes.position, oldPosition)
            )
          )
      }

      // Update the note's position
      await db
        .update(notes)
        .set({ position: newPosition, updatedAt: now })
        .where(eq(notes.id, noteId))
    }

    return this.findById(noteId)
  }

  /**
   * Get the next available position for notes in a folder
   */
  async getNextPosition(ownerId: string, folderId: string | null): Promise<number> {
    const [result] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${notes.position}), -1)` })
      .from(notes)
      .where(
        and(
          eq(notes.ownerId, ownerId),
          eq(notes.isDeleted, false),
          folderId === null ? isNull(notes.folderId) : eq(notes.folderId, folderId)
        )
      )
    return (result?.maxPos ?? -1) + 1
  }

  async findAll(): Promise<Note[]> {
    const result = await db
      .select()
      .from(notes)
      .where(eq(notes.isDeleted, false))
    return result.map(this.mapToNote)
  }

  async countAll(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(eq(notes.isDeleted, false))
    return result[0]?.count ?? 0
  }

  private mapToNote(row: typeof notes.$inferSelect): Note {
    let title = row.title
    let content = row.content
    try {
      title = decrypt(row.title)
    } catch (err) {
      logger.error('Failed to decrypt note title', err, { noteId: row.id })
      title = '[Decryption error]'
    }
    try {
      content = decrypt(row.content)
    } catch (err) {
      logger.error('Failed to decrypt note content', err, { noteId: row.id })
      content = ''
    }
    return {
      id: row.id,
      title,
      content,
      icon: row.icon,
      isQuickNote: row.isQuickNote,
      folderId: row.folderId,
      ownerId: row.ownerId,
      isDeleted: row.isDeleted,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}

export const noteRepository = new NoteRepository()
