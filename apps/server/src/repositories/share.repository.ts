import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import type { Share, ShareWithUser, Permission, ResourceType, ShareCreateInput } from '@onyka/shared'

const { shares, users } = schema

export class ShareRepository {
  async findById(id: string): Promise<Share | null> {
    const result = await db.select().from(shares).where(eq(shares.id, id)).limit(1)
    return result[0] ? this.mapToShare(result[0]) : null
  }

  async findByIdWithUser(id: string): Promise<ShareWithUser | null> {
    const result = await db
      .select({
        share: shares,
        sharedWith: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
          avatarColor: users.avatarColor,
        },
      })
      .from(shares)
      .innerJoin(users, eq(shares.sharedWithId, users.id))
      .where(eq(shares.id, id))
      .limit(1)

    if (!result[0]) return null

    return {
      ...this.mapToShare(result[0].share),
      sharedWith: {
        id: result[0].sharedWith.id,
        username: result[0].sharedWith.username,
        name: result[0].sharedWith.name,
        avatarUrl: result[0].sharedWith.avatarUrl ?? undefined,
        avatarColor: result[0].sharedWith.avatarColor,
      },
    }
  }

  async findByResource(resourceId: string, resourceType: ResourceType): Promise<ShareWithUser[]> {
    const result = await db
      .select({
        share: shares,
        sharedWith: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
          avatarColor: users.avatarColor,
        },
      })
      .from(shares)
      .innerJoin(users, eq(shares.sharedWithId, users.id))
      .where(and(eq(shares.resourceId, resourceId), eq(shares.resourceType, resourceType)))

    return result.map((r) => ({
      ...this.mapToShare(r.share),
      sharedWith: {
        id: r.sharedWith.id,
        username: r.sharedWith.username,
        name: r.sharedWith.name,
        avatarUrl: r.sharedWith.avatarUrl ?? undefined,
        avatarColor: r.sharedWith.avatarColor,
      },
    }))
  }

  async findBySharedWith(userId: string): Promise<Share[]> {
    const result = await db
      .select()
      .from(shares)
      .where(eq(shares.sharedWithId, userId))
    return result.map(this.mapToShare)
  }

  async findBySharedWithWithOwner(userId: string): Promise<(Share & { owner: { id: string; username: string; name: string; avatarUrl?: string; avatarColor?: string } })[]> {
    const result = await db
      .select({
        share: shares,
        owner: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
          avatarColor: users.avatarColor,
        },
      })
      .from(shares)
      .innerJoin(users, eq(shares.ownerId, users.id))
      .where(eq(shares.sharedWithId, userId))

    return result.map((r) => ({
      ...this.mapToShare(r.share),
      owner: {
        id: r.owner.id,
        username: r.owner.username,
        name: r.owner.name,
        avatarUrl: r.owner.avatarUrl ?? undefined,
        avatarColor: r.owner.avatarColor,
      },
    }))
  }

  async findByOwner(ownerId: string): Promise<Share[]> {
    const result = await db.select().from(shares).where(eq(shares.ownerId, ownerId))
    return result.map(this.mapToShare)
  }

  async findExisting(
    resourceId: string,
    resourceType: ResourceType,
    sharedWithId: string
  ): Promise<Share | null> {
    const result = await db
      .select()
      .from(shares)
      .where(
        and(
          eq(shares.resourceId, resourceId),
          eq(shares.resourceType, resourceType),
          eq(shares.sharedWithId, sharedWithId)
        )
      )
      .limit(1)
    return result[0] ? this.mapToShare(result[0]) : null
  }

  async create(
    ownerId: string,
    sharedWithId: string,
    input: Omit<ShareCreateInput, 'username'>
  ): Promise<Share> {
    const id = nanoid()
    const now = new Date()

    await db.insert(shares).values({
      id,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      ownerId,
      sharedWithId,
      permission: input.permission,
      createdAt: now,
    })

    return {
      id,
      resourceId: input.resourceId,
      resourceType: input.resourceType as ResourceType,
      ownerId,
      sharedWithId,
      permission: input.permission as Permission,
      createdAt: now,
    }
  }

  async updatePermission(id: string, permission: Permission): Promise<Share | null> {
    await db.update(shares).set({ permission }).where(eq(shares.id, id))
    return this.findById(id)
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(shares).where(eq(shares.id, id))
    return result.changes > 0
  }

  async deleteByResource(resourceId: string, resourceType: ResourceType): Promise<number> {
    const result = await db
      .delete(shares)
      .where(and(eq(shares.resourceId, resourceId), eq(shares.resourceType, resourceType)))
    return result.changes
  }

  async hasAccess(
    userId: string,
    resourceId: string,
    resourceType: ResourceType,
    requiredPermission: Permission = 'read'
  ): Promise<boolean> {
    const permissionLevels: Record<Permission, number> = {
      read: 1,
      edit: 2,
      admin: 3,
    }

    const result = await db
      .select({ permission: shares.permission })
      .from(shares)
      .where(
        and(
          eq(shares.resourceId, resourceId),
          eq(shares.resourceType, resourceType),
          eq(shares.sharedWithId, userId)
        )
      )
      .limit(1)

    if (!result[0]) return false

    return (
      permissionLevels[result[0].permission as Permission] >=
      permissionLevels[requiredPermission]
    )
  }

  /** Used to authorize image access for shared notes. */
  async hasAnyShareFromOwner(userId: string, ownerId: string): Promise<boolean> {
    const result = await db
      .select({ id: shares.id })
      .from(shares)
      .where(and(eq(shares.ownerId, ownerId), eq(shares.sharedWithId, userId)))
      .limit(1)
    return result.length > 0
  }

  private mapToShare(row: typeof shares.$inferSelect): Share {
    return {
      id: row.id,
      resourceId: row.resourceId,
      resourceType: row.resourceType as ResourceType,
      ownerId: row.ownerId,
      sharedWithId: row.sharedWithId,
      permission: row.permission as Permission,
      createdAt: row.createdAt,
    }
  }
}

export const shareRepository = new ShareRepository()
