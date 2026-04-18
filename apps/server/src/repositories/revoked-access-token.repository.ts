import { and, eq, gt, lt } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

const { revokedAccessTokens } = schema

export class RevokedAccessTokenRepository {
  async add(jti: string, expiresAt: Date): Promise<void> {
    await db
      .insert(revokedAccessTokens)
      .values({ jti, expiresAt, createdAt: new Date() })
      .onConflictDoNothing()
  }

  async isRevoked(jti: string): Promise<boolean> {
    const result = await db
      .select({ jti: revokedAccessTokens.jti })
      .from(revokedAccessTokens)
      .where(and(eq(revokedAccessTokens.jti, jti), gt(revokedAccessTokens.expiresAt, new Date())))
      .limit(1)
    return result.length > 0
  }

  async deleteExpired(): Promise<number> {
    const result = await db
      .delete(revokedAccessTokens)
      .where(lt(revokedAccessTokens.expiresAt, new Date()))
    return result.changes
  }
}

export const revokedAccessTokenRepository = new RevokedAccessTokenRepository()
