import { eq, and, gte, lte, desc, count } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import type { AuditActionType } from '../db/schema.js'

const { auditLogs, users } = schema

export interface AuditLogEntry {
  id: string
  adminId: string
  adminUsername: string
  action: AuditActionType
  targetType?: 'user' | 'system' | 'settings'
  targetId?: string
  targetUsername?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export interface CreateAuditLogInput {
  adminId: string
  action: AuditActionType
  targetType?: 'user' | 'system' | 'settings'
  targetId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export class AuditLogRepository {
  async create(input: CreateAuditLogInput): Promise<void> {
    const now = new Date()
    const id = nanoid()

    await db.insert(auditLogs).values({
      id,
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: now,
    })
  }

  async findAll(options: {
    page: number
    limit: number
    action?: AuditActionType
    adminId?: string
    targetId?: string
    startDate?: Date
    endDate?: Date
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const { page, limit, action, adminId, targetId, startDate, endDate } = options
    const offset = (page - 1) * limit

    const conditions = []
    if (action) conditions.push(eq(auditLogs.action, action))
    if (adminId) conditions.push(eq(auditLogs.adminId, adminId))
    if (targetId) conditions.push(eq(auditLogs.targetId, targetId))
    if (startDate) conditions.push(gte(auditLogs.createdAt, startDate))
    if (endDate) conditions.push(lte(auditLogs.createdAt, endDate))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          adminId: auditLogs.adminId,
          adminUsername: users.username,
          action: auditLogs.action,
          targetType: auditLogs.targetType,
          targetId: auditLogs.targetId,
          metadata: auditLogs.metadata,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .innerJoin(users, eq(auditLogs.adminId, users.id))
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(auditLogs).where(whereClause),
    ])

    // Get target usernames if targetType is 'user'
    const logsWithTargetUsernames = await Promise.all(
      results.map(async (log) => {
        let targetUsername: string | undefined
        if (log.targetType === 'user' && log.targetId) {
          const targetUser = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, log.targetId))
            .limit(1)
          targetUsername = targetUser[0]?.username
        }

        return {
          id: log.id,
          adminId: log.adminId,
          adminUsername: log.adminUsername,
          action: log.action as AuditActionType,
          targetType: log.targetType ?? undefined,
          targetId: log.targetId ?? undefined,
          metadata: log.metadata ?? undefined,
          ipAddress: log.ipAddress ?? undefined,
          userAgent: log.userAgent ?? undefined,
          targetUsername,
          createdAt: log.createdAt,
        } as AuditLogEntry
      })
    )

    return {
      logs: logsWithTargetUsernames,
      total: countResult[0]?.count ?? 0,
    }
  }
}

export const auditLogRepository = new AuditLogRepository()
