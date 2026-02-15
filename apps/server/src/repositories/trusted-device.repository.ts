import { eq, lt, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'

const { trustedDevices } = schema

export interface TrustedDevice {
  id: string
  userId: string
  tokenHash: string
  userAgent: string | null
  ipAddress: string | null
  label: string | null
  expiresAt: Date
  createdAt: Date
}

export class TrustedDeviceRepository {
  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: { userAgent?: string; ipAddress?: string; label?: string }
  ): Promise<TrustedDevice> {
    const id = nanoid()
    const now = new Date()

    await db.insert(trustedDevices).values({
      id,
      userId,
      tokenHash,
      userAgent: metadata?.userAgent ?? null,
      ipAddress: metadata?.ipAddress ?? null,
      label: metadata?.label ?? null,
      expiresAt,
      createdAt: now,
    })

    return {
      id,
      userId,
      tokenHash,
      userAgent: metadata?.userAgent ?? null,
      ipAddress: metadata?.ipAddress ?? null,
      label: metadata?.label ?? null,
      expiresAt,
      createdAt: now,
    }
  }

  async findValidByTokenHash(tokenHash: string): Promise<TrustedDevice | null> {
    const results = await db
      .select()
      .from(trustedDevices)
      .where(eq(trustedDevices.tokenHash, tokenHash))
      .limit(1)

    const device = results[0]
    if (!device) return null

    // Check expiration
    if (device.expiresAt < new Date()) {
      await this.deleteById(device.id, device.userId)
      return null
    }

    return device
  }

  async findByUser(userId: string): Promise<TrustedDevice[]> {
    return db
      .select()
      .from(trustedDevices)
      .where(eq(trustedDevices.userId, userId))
      .orderBy(trustedDevices.createdAt)
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(trustedDevices)
      .where(and(eq(trustedDevices.id, id), eq(trustedDevices.userId, userId)))

    return result.changes > 0
  }

  async deleteAllByUser(userId: string): Promise<number> {
    const result = await db
      .delete(trustedDevices)
      .where(eq(trustedDevices.userId, userId))

    return result.changes
  }

  async deleteExpired(): Promise<number> {
    const result = await db
      .delete(trustedDevices)
      .where(lt(trustedDevices.expiresAt, new Date()))

    return result.changes
  }
}

export const trustedDeviceRepository = new TrustedDeviceRepository()
