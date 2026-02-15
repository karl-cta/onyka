import type { User } from './user.js'

export interface AdminUserInfo {
  id: string
  username: string
  name: string
  email?: string // Partially masked
  emailVerified: boolean
  avatarUrl?: string
  avatarColor?: string
  role: User['role']
  isDisabled: boolean
  disabledAt?: Date
  disabledReason?: string
  notesCount: number
  twoFactorEnabled: boolean
  createdAt: Date
  lastLoginAt?: Date
}

export interface DisableUserInput {
  reason?: string
}

export interface AdminSystemStats {
  totalUsers: number
  activeUsers: number
  disabledUsers: number
  adminCount: number
  usersWithEmail: number
  usersWith2FA: number
  totalNotes: number
  totalSparks: number
  totalFolders: number
  storageUsedBytes: number
}

export interface AuditLog {
  id: string
  adminId: string
  adminUsername: string
  action: AuditAction
  targetType?: 'user' | 'system' | 'settings'
  targetId?: string
  targetUsername?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export type AuditAction =
  | 'USER_LISTED'
  | 'USER_VIEWED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_DELETED'
  | 'USER_ROLE_CHANGED'
  | 'SETTINGS_UPDATED'
  | 'AUDIT_LOGS_VIEWED'
  | 'ADMIN_LOGIN'

export interface AuditLogQueryParams {
  page?: number
  limit?: number
  action?: AuditAction
  adminId?: string
  targetId?: string
  startDate?: string
  endDate?: string
}

export interface AdminUsersResponse {
  users: AdminUserInfo[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface AuditLogsResponse {
  logs: AuditLog[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
