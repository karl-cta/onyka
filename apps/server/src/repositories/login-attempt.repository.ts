import { eq, and, gte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'

const { loginAttempts } = schema

export interface LoginAttempt {
  id: string
  username: string
  ipAddress: string
  success: boolean
  attemptedAt: Date
}

export class LoginAttemptRepository {
  async create(username: string, ipAddress: string, success: boolean): Promise<LoginAttempt> {
    const id = nanoid()
    const now = new Date()

    await db.insert(loginAttempts).values({
      id,
      username: username.toLowerCase(),
      ipAddress,
      success,
      attemptedAt: now,
    })

    return {
      id,
      username: username.toLowerCase(),
      ipAddress,
      success,
      attemptedAt: now,
    }
  }

  async countFailedByUsername(username: string, since: Date): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.username, username.toLowerCase()),
          eq(loginAttempts.success, false),
          gte(loginAttempts.attemptedAt, since)
        )
      )
    return result[0]?.count ?? 0
  }

  async countFailedByIp(ipAddress: string, since: Date): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipAddress, ipAddress),
          eq(loginAttempts.success, false),
          gte(loginAttempts.attemptedAt, since)
        )
      )
    return result[0]?.count ?? 0
  }

  async getLastSuccessful(username: string): Promise<LoginAttempt | null> {
    const result = await db
      .select()
      .from(loginAttempts)
      .where(and(eq(loginAttempts.username, username.toLowerCase()), eq(loginAttempts.success, true)))
      .orderBy(sql`${loginAttempts.attemptedAt} DESC`)
      .limit(1)
    return result[0] ?? null
  }

  async clearByUsername(username: string): Promise<number> {
    const result = await db
      .delete(loginAttempts)
      .where(eq(loginAttempts.username, username.toLowerCase()))
    return result.changes
  }

  async clearOlderThan(date: Date): Promise<number> {
    const result = await db
      .delete(loginAttempts)
      .where(sql`${loginAttempts.attemptedAt} < ${date}`)
    return result.changes
  }

  async getFirstFailedSince(username: string, since: Date): Promise<LoginAttempt | null> {
    const result = await db
      .select()
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.username, username.toLowerCase()),
          eq(loginAttempts.success, false),
          gte(loginAttempts.attemptedAt, since)
        )
      )
      .orderBy(sql`${loginAttempts.attemptedAt} ASC`)
      .limit(1)
    return result[0] ?? null
  }

  async getFirstFailedByIpSince(ipAddress: string, since: Date): Promise<LoginAttempt | null> {
    const result = await db
      .select()
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ipAddress, ipAddress),
          eq(loginAttempts.success, false),
          gte(loginAttempts.attemptedAt, since)
        )
      )
      .orderBy(sql`${loginAttempts.attemptedAt} ASC`)
      .limit(1)
    return result[0] ?? null
  }
}

export const loginAttemptRepository = new LoginAttemptRepository()
