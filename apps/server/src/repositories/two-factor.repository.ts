import { eq, lt, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'

const { emailOtpCodes } = schema

export type OtpPurpose = 'login' | 'enable_2fa' | 'disable_2fa'

export interface EmailOtpCode {
  id: string
  userId: string
  code: string
  purpose: OtpPurpose
  expiresAt: Date
  attempts: number
  usedAt: Date | null
  createdAt: Date
}

const MAX_ATTEMPTS = 5

export class TwoFactorRepository {
  /**
   * Create a new OTP code for a user
   * Deletes any existing codes for the same purpose
   */
  async createOtpCode(userId: string, codeHash: string, purpose: OtpPurpose, expiresAt: Date): Promise<void> {
    const now = new Date()
    const id = nanoid()

    await db.delete(emailOtpCodes).where(
      and(eq(emailOtpCodes.userId, userId), eq(emailOtpCodes.purpose, purpose))
    )

    await db.insert(emailOtpCodes).values({
      id,
      userId,
      code: codeHash,
      purpose,
      expiresAt,
      attempts: 0,
      createdAt: now,
    })
  }

  /**
   * Find valid (not expired, not used, attempts < max) OTP code for user and purpose
   */
  async findValidCode(userId: string, purpose: OtpPurpose): Promise<EmailOtpCode | null> {
    const now = new Date()
    const result = await db
      .select()
      .from(emailOtpCodes)
      .where(
        and(
          eq(emailOtpCodes.userId, userId),
          eq(emailOtpCodes.purpose, purpose)
        )
      )
      .limit(1)

    const code = result[0]
    if (!code) return null

    if (code.expiresAt > now && !code.usedAt && code.attempts < MAX_ATTEMPTS) {
      return code
    }

    return null
  }

  /**
   * Increment attempt counter for a code
   */
  async incrementAttempts(codeId: string): Promise<void> {
    const code = await db.select().from(emailOtpCodes).where(eq(emailOtpCodes.id, codeId)).limit(1)
    if (code[0]) {
      await db.update(emailOtpCodes)
        .set({ attempts: code[0].attempts + 1 })
        .where(eq(emailOtpCodes.id, codeId))
    }
  }

  /**
   * Mark a code as used
   */
  async markAsUsed(codeId: string): Promise<void> {
    await db.update(emailOtpCodes)
      .set({ usedAt: new Date() })
      .where(eq(emailOtpCodes.id, codeId))
  }

  /**
   * Invalidate a code (mark as used to prevent further attempts)
   */
  async invalidateCode(codeId: string): Promise<void> {
    await db.update(emailOtpCodes)
      .set({ usedAt: new Date() })
      .where(eq(emailOtpCodes.id, codeId))
  }

  /**
   * Delete all OTP codes for a user
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await db.delete(emailOtpCodes).where(eq(emailOtpCodes.userId, userId))
  }

  /**
   * Delete OTP codes for a user by purpose
   */
  async deleteByUserAndPurpose(userId: string, purpose: OtpPurpose): Promise<void> {
    await db.delete(emailOtpCodes).where(
      and(eq(emailOtpCodes.userId, userId), eq(emailOtpCodes.purpose, purpose))
    )
  }

  /**
   * Cleanup expired codes
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date()
    const result = await db.delete(emailOtpCodes).where(lt(emailOtpCodes.expiresAt, now))
    return result.changes
  }

  /**
   * Check if a recent code exists (for rate limiting)
   * Returns time remaining until new code can be sent (in seconds)
   */
  async getTimeUntilNextCode(userId: string, purpose: OtpPurpose): Promise<number> {
    const result = await db
      .select()
      .from(emailOtpCodes)
      .where(
        and(eq(emailOtpCodes.userId, userId), eq(emailOtpCodes.purpose, purpose))
      )
      .limit(1)

    if (!result[0]) return 0

    const code = result[0]
    const minTimeBetweenCodes = 60 * 1000 // 1 minute
    const timeSinceCreation = Date.now() - code.createdAt.getTime()

    if (timeSinceCreation < minTimeBetweenCodes) {
      return Math.ceil((minTimeBetweenCodes - timeSinceCreation) / 1000)
    }

    return 0
  }
}

export const twoFactorRepository = new TwoFactorRepository()
