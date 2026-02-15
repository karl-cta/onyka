import { eq, and, isNull, gt, lt } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'

const { passwordResetTokens } = schema

export interface PasswordResetToken {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  createdAt: Date
  usedAt: Date | null
}

export class PasswordResetRepository {
  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const now = new Date()
    const id = nanoid()

    await db.insert(passwordResetTokens).values({
      id,
      userId,
      tokenHash,
      expiresAt,
      createdAt: now,
    })
  }

  async findValidByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const now = new Date()
    const result = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1)

    return result[0] ?? null
  }

  async markAsUsed(id: string): Promise<void> {
    const now = new Date()
    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, id))
  }

  async findActiveByUser(userId: string): Promise<PasswordResetToken | null> {
    const now = new Date()
    const result = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1)

    return result[0] ?? null
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    const now = new Date()
    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)))
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date()
    const result = await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, now))

    return result.changes
  }
}

export const passwordResetRepository = new PasswordResetRepository()
