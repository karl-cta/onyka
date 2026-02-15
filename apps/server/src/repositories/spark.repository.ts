import { eq, and, desc, sql, or, isNull, gt, lt } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import type { Spark, SparkCreateInput, ExpirationOption } from '@onyka/shared'

// Table is still 'thoughts' in DB for backwards compatibility
const { thoughts: sparks } = schema

const EXPIRATION_MS: Record<ExpirationOption, number | null> = {
  none: null,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

export class SparkRepository {
  async findById(id: string): Promise<Spark | null> {
    const result = await db.select().from(sparks).where(eq(sparks.id, id)).limit(1)
    return result[0] ? this.mapToSpark(result[0]) : null
  }

  async findActiveByOwner(ownerId: string): Promise<Spark[]> {
    // Get non-expired, non-converted sparks (pinned, permanent, or not yet expired)
    const now = new Date()

    const result = await db
      .select()
      .from(sparks)
      .where(
        and(
          eq(sparks.ownerId, ownerId),
          eq(sparks.isExpired, false),
          isNull(sparks.convertedToNoteId), // Exclude converted sparks
          // Either pinned, no expiration (permanent), or not yet expired
          or(
            eq(sparks.isPinned, true),
            isNull(sparks.expiresAt),
            gt(sparks.expiresAt, now)
          )
        )
      )
      .orderBy(desc(sparks.createdAt))

    return result.map(this.mapToSpark)
  }

  async countPinned(ownerId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(sparks)
      .where(
        and(
          eq(sparks.ownerId, ownerId),
          eq(sparks.isPinned, true),
          eq(sparks.isExpired, false)
        )
      )
    return result[0]?.count ?? 0
  }

  async create(ownerId: string, input: SparkCreateInput): Promise<Spark> {
    const now = new Date()
    const id = nanoid()
    const isPinned = input.isPinned ?? false
    const expiration = input.expiration ?? 'none'

    // Calculate expiration time based on option
    const expirationMs = EXPIRATION_MS[expiration]
    const expiresAt = expirationMs ? new Date(now.getTime() + expirationMs) : null

    await db.insert(sparks).values({
      id,
      ownerId,
      content: encrypt(input.content),
      isPinned,
      createdAt: now,
      expiresAt,
      isExpired: false,
      convertedToNoteId: null,
    })

    return {
      id,
      ownerId,
      content: input.content,
      isPinned,
      createdAt: now,
      expiresAt,
      isExpired: false,
      convertedToNoteId: null,
    }
  }

  async togglePin(id: string, isPinned: boolean): Promise<Spark | null> {
    // Just toggle the pin status, don't modify expiration
    await db
      .update(sparks)
      .set({ isPinned })
      .where(eq(sparks.id, id))

    return this.findById(id)
  }

  async updateContent(id: string, content: string): Promise<Spark | null> {
    await db
      .update(sparks)
      .set({ content: encrypt(content) })
      .where(eq(sparks.id, id))

    return this.findById(id)
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(sparks).where(eq(sparks.id, id))
    return result.changes > 0
  }

  async setConvertedToNote(id: string, noteId: string): Promise<Spark | null> {
    await db
      .update(sparks)
      .set({ convertedToNoteId: noteId })
      .where(eq(sparks.id, id))

    return this.findById(id)
  }

  async markExpired(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    await db
      .update(sparks)
      .set({ isExpired: true })
      .where(
        and(
          sql`${sparks.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`,
          eq(sparks.isExpired, false)
        )
      )
  }

  async findExpiredByOwner(ownerId: string): Promise<Spark[]> {
    const now = new Date()

    // Find sparks that should be marked as expired
    const result = await db
      .select()
      .from(sparks)
      .where(
        and(
          eq(sparks.ownerId, ownerId),
          eq(sparks.isExpired, false),
          eq(sparks.isPinned, false),
          lt(sparks.expiresAt, now)
        )
      )

    return result.map(this.mapToSpark)
  }

  async countAll(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(sparks)
      .where(eq(sparks.isExpired, false))
    return result[0]?.count ?? 0
  }

  private mapToSpark(row: typeof sparks.$inferSelect): Spark {
    return {
      id: row.id,
      ownerId: row.ownerId,
      content: decrypt(row.content),
      isPinned: row.isPinned,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      isExpired: row.isExpired,
      convertedToNoteId: row.convertedToNoteId,
    }
  }
}

export const sparkRepository = new SparkRepository()
