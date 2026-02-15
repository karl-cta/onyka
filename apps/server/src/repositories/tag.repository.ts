import { eq, and, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import type { Tag, TagCreateInput, TagUpdateInput } from '@onyka/shared'

export class UniqueConstraintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UniqueConstraintError'
  }
}

const { tags, noteTags, notes } = schema

export interface TagWithCount extends Tag {
  noteCount: number
}

export class TagRepository {
  async findById(id: string): Promise<Tag | null> {
    const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1)
    return result[0] ?? null
  }

  async findByName(ownerId: string, name: string): Promise<Tag | null> {
    const result = await db
      .select()
      .from(tags)
      .where(and(eq(tags.ownerId, ownerId), eq(tags.name, name)))
      .limit(1)
    return result[0] ?? null
  }

  async findByOwner(ownerId: string): Promise<Tag[]> {
    const result = await db
      .select()
      .from(tags)
      .where(eq(tags.ownerId, ownerId))
      .orderBy(tags.name)
    return result
  }

  async findByOwnerWithCounts(ownerId: string): Promise<TagWithCount[]> {
    // Join with notes table to exclude soft-deleted notes from the count
    const result = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
        ownerId: tags.ownerId,
        noteCount: sql<number>`count(${notes.id})`,
      })
      .from(tags)
      .leftJoin(noteTags, eq(tags.id, noteTags.tagId))
      .leftJoin(
        notes,
        and(eq(noteTags.noteId, notes.id), eq(notes.isDeleted, false))
      )
      .where(eq(tags.ownerId, ownerId))
      .groupBy(tags.id)
      .orderBy(tags.name)

    return result
  }

  async create(ownerId: string, input: TagCreateInput): Promise<Tag> {
    const id = nanoid()

    try {
      await db.insert(tags).values({
        id,
        name: input.name,
        color: input.color ?? '#3B82F6',
        ownerId,
      })
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new UniqueConstraintError('Tag with this name already exists')
      }
      throw error
    }

    return {
      id,
      name: input.name,
      color: input.color ?? '#3B82F6',
      ownerId,
    }
  }

  async update(id: string, input: TagUpdateInput): Promise<Tag | null> {
    const updateData: Record<string, unknown> = {}

    if (input.name !== undefined) updateData.name = input.name
    if (input.color !== undefined) updateData.color = input.color

    if (Object.keys(updateData).length === 0) {
      return this.findById(id)
    }

    try {
      await db.update(tags).set(updateData).where(eq(tags.id, id))
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new UniqueConstraintError('Tag with this name already exists')
      }
      throw error
    }
    return this.findById(id)
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(tags).where(eq(tags.id, id))
    return result.changes > 0
  }

  async getNoteCount(id: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(noteTags)
      .where(eq(noteTags.tagId, id))
    return result[0]?.count ?? 0
  }
}

export const tagRepository = new TagRepository()
