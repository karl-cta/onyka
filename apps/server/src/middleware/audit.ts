import type { Request } from 'express'
import { auditLogRepository } from '../repositories/audit-log.repository.js'
import type { AuditActionType } from '../db/schema.js'

export async function createAuditLog(
  req: Request,
  action: AuditActionType,
  options?: {
    targetType?: 'user' | 'system' | 'settings'
    targetId?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  if (!req.user || !req.userId) {
    return
  }

  try {
    await auditLogRepository.create({
      adminId: req.userId,
      action,
      targetType: options?.targetType,
      targetId: options?.targetId,
      metadata: options?.metadata,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('User-Agent'),
    })
  } catch (error) {
    // Non-blocking: audit failure shouldn't fail the request
    console.error('Failed to create audit log:', error)
  }
}

