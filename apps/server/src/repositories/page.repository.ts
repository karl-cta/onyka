import { eq, and, asc, gt, gte, lt, lte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import type { NotePage, NotePageCreateInput, NotePageUpdateInput } from '@onyka/shared'

const { notePages } = schema

export class PageRepository {
  async findById(id: string): Promise<NotePage | null> {
    const result = await db
      .select()
      .from(notePages)
      .where(eq(notePages.id, id))
      .limit(1)
    return result[0] ? this.mapToPage(result[0]) : null
  }

  async findByNoteId(noteId: string, includeDeleted = false): Promise<NotePage[]> {
    const conditions = [eq(notePages.noteId, noteId)]
    if (!includeDeleted) {
      conditions.push(eq(notePages.isDeleted, false))
    }

    const result = await db
      .select()
      .from(notePages)
      .where(and(...conditions))
      .orderBy(asc(notePages.position))

    return result.map(this.mapToPage)
  }

  async create(noteId: string, input: NotePageCreateInput): Promise<NotePage> {
    const id = nanoid()
    const now = new Date()
    const position = input.position ?? (await this.getNextPosition(noteId))

    const plainTitle = input.title ?? 'New Page'
    const plainContent = input.content ?? ''

    await db.insert(notePages).values({
      id,
      noteId,
      title: encrypt(plainTitle),
      content: encrypt(plainContent),
      mode: 'text',
      position,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      noteId,
      title: plainTitle,
      content: plainContent,
      position,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
  }

  async update(id: string, input: NotePageUpdateInput): Promise<NotePage | null> {
    const now = new Date()
    const updateData: Record<string, unknown> = { updatedAt: now }

    if (input.title !== undefined) updateData.title = encrypt(input.title)
    if (input.content !== undefined) updateData.content = encrypt(input.content)

    await db.update(notePages).set(updateData).where(eq(notePages.id, id))
    return this.findById(id)
  }

  async softDelete(id: string): Promise<boolean> {
    const now = new Date()
    const result = await db
      .update(notePages)
      .set({ isDeleted: true, deletedAt: now, updatedAt: now })
      .where(eq(notePages.id, id))
    return result.changes > 0
  }

  async permanentDelete(id: string): Promise<boolean> {
    const result = await db.delete(notePages).where(eq(notePages.id, id))
    return result.changes > 0
  }

  async reorder(pageId: string, noteId: string, newPosition: number): Promise<NotePage | null> {
    const page = await this.findById(pageId)
    if (!page || page.noteId !== noteId) return null

    const oldPosition = page.position
    const now = new Date()

    if (newPosition > oldPosition) {
      // Moving down: shift pages between old and new position up
      await db
        .update(notePages)
        .set({ position: sql`${notePages.position} - 1`, updatedAt: now })
        .where(
          and(
            eq(notePages.noteId, noteId),
            eq(notePages.isDeleted, false),
            gt(notePages.position, oldPosition),
            lte(notePages.position, newPosition)
          )
        )
    } else if (newPosition < oldPosition) {
      // Moving up: shift pages between new and old position down
      await db
        .update(notePages)
        .set({ position: sql`${notePages.position} + 1`, updatedAt: now })
        .where(
          and(
            eq(notePages.noteId, noteId),
            eq(notePages.isDeleted, false),
            gte(notePages.position, newPosition),
            lt(notePages.position, oldPosition)
          )
        )
    }

    // Update the page's position
    await db
      .update(notePages)
      .set({ position: newPosition, updatedAt: now })
      .where(eq(notePages.id, pageId))

    return this.findById(pageId)
  }

  async countByNote(noteId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notePages)
      .where(and(eq(notePages.noteId, noteId), eq(notePages.isDeleted, false)))
    return result[0]?.count ?? 0
  }

  async getNextPosition(noteId: string): Promise<number> {
    const [result] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${notePages.position}), -1)` })
      .from(notePages)
      .where(and(eq(notePages.noteId, noteId), eq(notePages.isDeleted, false)))
    return (result?.maxPos ?? -1) + 1
  }

  private mapToPage(row: typeof notePages.$inferSelect): NotePage {
    return {
      id: row.id,
      noteId: row.noteId,
      title: decrypt(row.title),
      content: decrypt(row.content),
      position: row.position,
      isDeleted: row.isDeleted,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}

export const pageRepository = new PageRepository()
