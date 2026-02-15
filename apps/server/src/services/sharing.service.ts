import { shareRepository } from '../repositories/share.repository.js'
import { userRepository } from '../repositories/user.repository.js'
import { noteRepository } from '../repositories/note.repository.js'
import { folderRepository } from '../repositories/folder.repository.js'
import type {
  Share,
  ShareWithUser,
  ShareCreateInput,
  Permission,
  ResourceType,
} from '@onyka/shared'

export class SharingServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'SharingServiceError'
  }
}

export class SharingService {
  async share(userId: string, input: ShareCreateInput): Promise<ShareWithUser> {
    const targetUser = await userRepository.findByUsername(input.username)
    if (!targetUser) {
      throw new SharingServiceError('User not found', 'USER_NOT_FOUND', 404)
    }

    if (targetUser.id === userId) {
      throw new SharingServiceError('Cannot share with yourself', 'SELF_SHARE', 400)
    }

    await this.verifyOwnershipOrAdmin(userId, input.resourceId, input.resourceType)

    // Resolve the real owner of the resource (may differ from userId if user is admin)
    const realOwnerId = await this.getResourceOwnerId(input.resourceId, input.resourceType) ?? userId

    const existing = await shareRepository.findExisting(
      input.resourceId,
      input.resourceType,
      targetUser.id
    )

    if (existing) {
      const updated = await shareRepository.updatePermission(existing.id, input.permission)
      const shareWithUser = await shareRepository.findByIdWithUser(updated!.id)
      return shareWithUser!
    }

    const share = await shareRepository.create(realOwnerId, targetUser.id, {
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      permission: input.permission,
    })

    return {
      ...share,
      sharedWith: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        avatarUrl: targetUser.avatarUrl,
      },
    }
  }

  async getSharesForResource(
    userId: string,
    resourceId: string,
    resourceType: ResourceType
  ): Promise<ShareWithUser[]> {
    await this.verifyOwnershipOrAdmin(userId, resourceId, resourceType)
    return shareRepository.findByResource(resourceId, resourceType)
  }

  async getSharedWithMe(userId: string): Promise<(Share & { owner: { id: string; username: string; name: string; avatarUrl?: string; avatarColor?: string } })[]> {
    return shareRepository.findBySharedWithWithOwner(userId)
  }

  async getMyShares(userId: string): Promise<Share[]> {
    return shareRepository.findByOwner(userId)
  }

  async updatePermission(
    shareId: string,
    userId: string,
    newPermission: Permission
  ): Promise<Share> {
    const share = await shareRepository.findById(shareId)

    if (!share) {
      throw new SharingServiceError('Share not found', 'SHARE_NOT_FOUND', 404)
    }

    await this.verifyOwnershipOrAdmin(userId, share.resourceId, share.resourceType)

    const updated = await shareRepository.updatePermission(shareId, newPermission)
    return updated!
  }

  async revoke(shareId: string, userId: string): Promise<void> {
    const share = await shareRepository.findById(shareId)

    if (!share) {
      throw new SharingServiceError('Share not found', 'SHARE_NOT_FOUND', 404)
    }

    await this.verifyOwnershipOrAdmin(userId, share.resourceId, share.resourceType)

    await shareRepository.delete(shareId)
  }

  async revokeAllForResource(
    userId: string,
    resourceId: string,
    resourceType: ResourceType
  ): Promise<number> {
    await this.verifyOwnershipOrAdmin(userId, resourceId, resourceType)
    return shareRepository.deleteByResource(resourceId, resourceType)
  }

  async checkAccess(
    userId: string,
    resourceId: string,
    resourceType: ResourceType,
    requiredPermission: Permission = 'read'
  ): Promise<boolean> {
    const isOwner = await this.isOwner(userId, resourceId, resourceType)
    if (isOwner) return true

    return shareRepository.hasAccess(userId, resourceId, resourceType, requiredPermission)
  }

  async getPermissionLevel(
    userId: string,
    resourceId: string,
    resourceType: ResourceType
  ): Promise<Permission | 'owner' | null> {
    const isOwner = await this.isOwner(userId, resourceId, resourceType)
    if (isOwner) return 'owner'

    const shares = await shareRepository.findBySharedWith(userId)
    const share = shares.find(
      (s) => s.resourceId === resourceId && s.resourceType === resourceType
    )

    return share?.permission ?? null
  }

  private async verifyOwnershipOrAdmin(
    userId: string,
    resourceId: string,
    resourceType: ResourceType
  ): Promise<void> {
    const isOwner = await this.isOwner(userId, resourceId, resourceType)
    if (isOwner) return

    const hasAdmin = await shareRepository.hasAccess(userId, resourceId, resourceType, 'admin')
    if (!hasAdmin) {
      throw new SharingServiceError('Access denied', 'ACCESS_DENIED', 403)
    }
  }

  private async getResourceOwnerId(
    resourceId: string,
    resourceType: ResourceType
  ): Promise<string | null> {
    switch (resourceType) {
      case 'note': {
        const note = await noteRepository.findById(resourceId)
        return note?.ownerId ?? null
      }
      case 'folder': {
        const folder = await folderRepository.findById(resourceId)
        return folder?.ownerId ?? null
      }
      case 'workspace':
        return resourceId
      default:
        return null
    }
  }

  private async isOwner(
    userId: string,
    resourceId: string,
    resourceType: ResourceType
  ): Promise<boolean> {
    switch (resourceType) {
      case 'note': {
        const note = await noteRepository.findById(resourceId)
        return note?.ownerId === userId
      }
      case 'folder': {
        const folder = await folderRepository.findById(resourceId)
        return folder?.ownerId === userId
      }
      case 'workspace': {
        return resourceId === userId
      }
      default:
        return false
    }
  }
}

export const sharingService = new SharingService()
