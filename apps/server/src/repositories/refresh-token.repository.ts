import { eq, lt, and, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'

const { refreshTokens } = schema

export interface RefreshToken {
  id: string
  userId: string
  tokenHash: string
  userAgent: string | null
  ipAddress: string | null
  expiresAt: Date
  createdAt: Date
}

export interface SessionInfo {
  id: string
  userAgent: string | null
  ipAddress: string | null
  createdAt: Date
  expiresAt: Date
}

export class RefreshTokenRepository {
  async findById(id: string): Promise<RefreshToken | null> {
    const result = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.id, id))
      .limit(1)
    return result[0] ?? null
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const result = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1)
    return result[0] ?? null
  }

  async findByUser(userId: string): Promise<RefreshToken[]> {
    return db.select().from(refreshTokens).where(eq(refreshTokens.userId, userId))
  }

  async listActiveSessions(userId: string): Promise<SessionInfo[]> {
    const now = new Date()
    const results = await db
      .select({
        id: refreshTokens.id,
        userAgent: refreshTokens.userAgent,
        ipAddress: refreshTokens.ipAddress,
        createdAt: refreshTokens.createdAt,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, userId))

    return results.filter((r) => r.expiresAt > now)
  }

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: { userAgent?: string; ipAddress?: string }
  ): Promise<RefreshToken> {
    const id = nanoid()
    const now = new Date()

    await db.insert(refreshTokens).values({
      id,
      userId,
      tokenHash,
      userAgent: metadata?.userAgent ?? null,
      ipAddress: metadata?.ipAddress ?? null,
      expiresAt,
      createdAt: now,
    })

    return {
      id,
      userId,
      tokenHash,
      userAgent: metadata?.userAgent ?? null,
      ipAddress: metadata?.ipAddress ?? null,
      expiresAt,
      createdAt: now,
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(refreshTokens).where(eq(refreshTokens.id, id))
    return result.changes > 0
  }

  async deleteByTokenHash(tokenHash: string): Promise<boolean> {
    const result = await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
    return result.changes > 0
  }

  async deleteByUser(userId: string): Promise<number> {
    const result = await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
    return result.changes
  }

  async deleteOthersByUser(userId: string, keepTokenHash: string): Promise<number> {
    const result = await db
      .delete(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          ne(refreshTokens.tokenHash, keepTokenHash)
        )
      )
    return result.changes
  }

  async deleteExpired(): Promise<number> {
    const result = await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
    return result.changes
  }

  async isValid(tokenHash: string): Promise<boolean> {
    const token = await this.findByTokenHash(tokenHash)
    if (!token) return false
    return token.expiresAt > new Date()
  }
}

export const refreshTokenRepository = new RefreshTokenRepository()
