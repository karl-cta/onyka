import { userRepository, noteRepository, folderRepository, sparkRepository } from '../repositories/index.js'
import { tokenService } from './token.service.js'
import { searchService } from './search.service.js'
import type { AdminUserInfo, AdminSystemStats } from '@onyka/shared'
import { AdminError } from '../middleware/admin.js'

/**
 * Partially mask an email address for display
 * e.g., john@example.com -> j***@e***.com
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email

  const maskedLocal = local.length > 1 ? local[0] + '***' : local
  const [domainName, ...tld] = domain.split('.')
  const maskedDomain = domainName.length > 1 ? domainName[0] + '***' : domainName
  const tldPart = tld.length > 0 ? '.' + tld.join('.') : ''

  return `${maskedLocal}@${maskedDomain}${tldPart}`
}

export class AdminService {
  /**
   * List users with metadata only (no content access)
   */
  async listUsers(options: {
    page: number
    limit: number
    search?: string
    status?: 'active' | 'disabled' | 'all'
  }): Promise<{ users: AdminUserInfo[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page, limit } = options
    const safeLimit = Math.min(limit, 100)

    const { users, total } = await userRepository.findAllForAdmin({
      page,
      limit: safeLimit,
      search: options.search,
      status: options.status,
    })

    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        const notesCount = await userRepository.getNotesCount(user.id)
        return {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email ? maskEmail(user.email) : undefined,
          emailVerified: user.emailVerified,
          avatarUrl: user.avatarUrl ?? undefined,
          avatarColor: user.avatarColor,
          role: user.role as 'user' | 'admin',
          isDisabled: user.isDisabled,
          disabledAt: user.disabledAt ?? undefined,
          disabledReason: user.disabledReason ?? undefined,
          notesCount,
          twoFactorEnabled: user.twoFactorEnabled,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt ?? undefined,
        }
      })
    )

    return {
      users: usersWithCounts,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    }
  }

  /**
   * Disable a user account
   */
  async disableUser(targetId: string, adminId: string, reason?: string): Promise<void> {
    const target = await userRepository.findById(targetId)
    if (!target) {
      throw new AdminError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (targetId === adminId) {
      throw new AdminError('Cannot disable your own account', 'CANNOT_DISABLE_SELF')
    }

    await userRepository.setDisabled(targetId, true, reason)
    await tokenService.revokeAllUserTokens(targetId)
  }

  /**
   * Enable a user account
   */
  async enableUser(targetId: string): Promise<void> {
    const target = await userRepository.findById(targetId)
    if (!target) {
      throw new AdminError('User not found', 'USER_NOT_FOUND', 404)
    }

    await userRepository.setDisabled(targetId, false)
  }

  /**
   * Delete a user account completely (cascade delete)
   */
  async deleteUser(targetId: string, adminId: string): Promise<void> {
    const target = await userRepository.findById(targetId)
    if (!target) {
      throw new AdminError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (targetId === adminId) {
      throw new AdminError('Cannot delete your own account', 'CANNOT_DELETE_SELF')
    }

    await userRepository.delete(targetId)
  }

  /**
   * Change a user's role
   */
  async changeUserRole(targetId: string, adminId: string, newRole: 'user' | 'admin'): Promise<void> {
    const target = await userRepository.findById(targetId)
    if (!target) {
      throw new AdminError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (targetId === adminId && newRole === 'user') {
      throw new AdminError('Cannot demote your own account', 'CANNOT_DEMOTE_SELF')
    }

    await userRepository.setRole(targetId, newRole)
  }

  /**
   * Change a user's username (admin only)
   */
  async changeUsername(targetId: string, newUsername: string): Promise<void> {
    const target = await userRepository.findById(targetId)
    if (!target) {
      throw new AdminError('User not found', 'USER_NOT_FOUND', 404)
    }

    const existing = await userRepository.findByUsername(newUsername)
    if (existing && existing.id !== targetId) {
      throw new AdminError('Username already taken', 'USERNAME_EXISTS', 409)
    }

    await userRepository.update(targetId, { username: newUsername })
  }

  /**
   * Rebuild the full-text search index for all notes
   */
  async reindexSearch(): Promise<{ indexedCount: number }> {
    const notes = await noteRepository.findAll()
    searchService.reindexAll(notes)
    return { indexedCount: notes.length }
  }

  /**
   * Get system-wide statistics
   */
  async getSystemStats(): Promise<AdminSystemStats> {
    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      adminCount,
      usersWithEmail,
      usersWith2FA,
      totalNotes,
      totalSparks,
      totalFolders,
    ] = await Promise.all([
      userRepository.countAll(),
      userRepository.countNotDisabled(),
      userRepository.countDisabled(),
      userRepository.countAdmins(),
      userRepository.countWithEmail(),
      userRepository.countWith2FA(),
      noteRepository.countAll(),
      sparkRepository.countAll(),
      folderRepository.countAll(),
    ])

    return {
      totalUsers,
      activeUsers,
      disabledUsers,
      adminCount,
      usersWithEmail,
      usersWith2FA,
      totalNotes,
      totalSparks,
      totalFolders,
      storageUsedBytes: 0,
    }
  }
}

export const adminService = new AdminService()
