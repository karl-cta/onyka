import { eq, and, isNull, count } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'

const { recoveryCodes } = schema

export class RecoveryCodeRepository {
  async create(userId: string, codeHash: string): Promise<void> {
    const now = new Date()
    const id = nanoid()

    await db.insert(recoveryCodes).values({
      id,
      userId,
      codeHash,
      createdAt: now,
    })
  }

  async createMany(userId: string, codeHashes: string[]): Promise<void> {
    const now = new Date()

    await db.insert(recoveryCodes).values(
      codeHashes.map((codeHash) => ({
        id: nanoid(),
        userId,
        codeHash,
        createdAt: now,
      }))
    )
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId))
  }

  async findUnusedByHash(userId: string, codeHash: string): Promise<{ id: string } | null> {
    const result = await db
      .select({ id: recoveryCodes.id })
      .from(recoveryCodes)
      .where(
        and(
          eq(recoveryCodes.userId, userId),
          eq(recoveryCodes.codeHash, codeHash),
          isNull(recoveryCodes.usedAt)
        )
      )
      .limit(1)

    return result[0] ?? null
  }

  async markAsUsed(id: string): Promise<void> {
    const now = new Date()
    await db
      .update(recoveryCodes)
      .set({ usedAt: now })
      .where(eq(recoveryCodes.id, id))
  }

  async countRemaining(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(recoveryCodes)
      .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)))

    return result[0]?.count ?? 0
  }

  async getCreatedAt(userId: string): Promise<Date | null> {
    const result = await db
      .select({ createdAt: recoveryCodes.createdAt })
      .from(recoveryCodes)
      .where(eq(recoveryCodes.userId, userId))
      .limit(1)

    return result[0]?.createdAt ?? null
  }
}

export const recoveryCodeRepository = new RecoveryCodeRepository()
