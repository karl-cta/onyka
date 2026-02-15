import { eq, and, isNull, sql, gt, gte, lt, lte, asc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import { decrypt } from '../utils/crypto.js'
import type { Folder, FolderCreateInput, FolderUpdateInput, FolderWithChildren, FolderNote } from '@onyka/shared'

const { folders, notes, noteTags } = schema

export class FolderRepository {
  async findById(id: string): Promise<Folder | null> {
    const result = await db.select().from(folders).where(eq(folders.id, id)).limit(1)
    return result[0] ? this.mapToFolder(result[0]) : null
  }

  async findByOwner(ownerId: string): Promise<Folder[]> {
    const result = await db
      .select()
      .from(folders)
      .where(eq(folders.ownerId, ownerId))
      .orderBy(asc(folders.position), asc(folders.name))

    return result.map(this.mapToFolder)
  }

  async findByParent(ownerId: string, parentId: string | null): Promise<Folder[]> {
    const result = await db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.ownerId, ownerId),
          parentId === null ? isNull(folders.parentId) : eq(folders.parentId, parentId)
        )
      )
      .orderBy(asc(folders.position), asc(folders.name))

    return result.map(this.mapToFolder)
  }

  async findTreeByOwner(ownerId: string): Promise<FolderWithChildren[]> {
    const allFolders = await this.findByOwner(ownerId)

    const allNotes = await db
      .select({
        id: notes.id,
        title: notes.title,
        icon: notes.icon,
        folderId: notes.folderId,

        position: notes.position,
      })
      .from(notes)
      .where(and(eq(notes.ownerId, ownerId), eq(notes.isDeleted, false), eq(notes.isQuickNote, false)))
      .orderBy(asc(notes.position), asc(notes.title))

    const noteIds = allNotes.map((n) => n.id)
    const allNoteTags =
      noteIds.length > 0
        ? await db
            .select({
              noteId: noteTags.noteId,
              tagId: noteTags.tagId,
            })
            .from(noteTags)
        : []

    const tagsByNote = new Map<string, string[]>()
    for (const nt of allNoteTags) {
      if (noteIds.includes(nt.noteId)) {
        if (!tagsByNote.has(nt.noteId)) {
          tagsByNote.set(nt.noteId, [])
        }
        tagsByNote.get(nt.noteId)!.push(nt.tagId)
      }
    }

    const notesByFolder = new Map<string | null, FolderNote[]>()
    for (const note of allNotes) {
      const folderId = note.folderId
      if (!notesByFolder.has(folderId)) {
        notesByFolder.set(folderId, [])
      }
      notesByFolder.get(folderId)!.push({
        id: note.id,
        title: decrypt(note.title),
        icon: note.icon,
        folderId: note.folderId,
        tagIds: tagsByNote.get(note.id) ?? [],

        position: note.position,
      })
    }

    const folderMap = new Map<string, FolderWithChildren>()
    const rootFolders: FolderWithChildren[] = []

    for (const folder of allFolders) {
      const folderNotes = notesByFolder.get(folder.id) ?? []
      folderMap.set(folder.id, {
        ...folder,
        children: [],
        notes: folderNotes,
        noteCount: folderNotes.length,
      })
    }

    // Second pass: build hierarchy
    for (const folder of allFolders) {
      const folderWithChildren = folderMap.get(folder.id)!
      if (folder.parentId === null) {
        rootFolders.push(folderWithChildren)
      } else {
        const parent = folderMap.get(folder.parentId)
        if (parent) {
          parent.children.push(folderWithChildren)
        } else {
          // Orphan folder - add to root
          rootFolders.push(folderWithChildren)
        }
      }
    }

    return rootFolders
  }

  async findRootNotes(ownerId: string): Promise<FolderNote[]> {
    const result = await db
      .select({
        id: notes.id,
        title: notes.title,
        icon: notes.icon,
        folderId: notes.folderId,

        position: notes.position,
      })
      .from(notes)
      .where(and(eq(notes.ownerId, ownerId), eq(notes.isDeleted, false), eq(notes.isQuickNote, false), isNull(notes.folderId)))
      .orderBy(asc(notes.position), asc(notes.title))

    // Get tags for root notes
    const noteIds = result.map((n) => n.id)
    const rootNoteTags =
      noteIds.length > 0
        ? await db
            .select({
              noteId: noteTags.noteId,
              tagId: noteTags.tagId,
            })
            .from(noteTags)
        : []

    // Group tagIds by noteId
    const tagsByNote = new Map<string, string[]>()
    for (const nt of rootNoteTags) {
      if (noteIds.includes(nt.noteId)) {
        if (!tagsByNote.has(nt.noteId)) {
          tagsByNote.set(nt.noteId, [])
        }
        tagsByNote.get(nt.noteId)!.push(nt.tagId)
      }
    }

    return result.map((note) => ({
      id: note.id,
      title: decrypt(note.title),
      icon: note.icon,
      folderId: note.folderId,
      tagIds: tagsByNote.get(note.id) ?? [],
      position: note.position,
    }))
  }

  async create(ownerId: string, input: FolderCreateInput): Promise<Folder> {
    const now = new Date()
    const id = nanoid()
    const icon = input.icon ?? 'Folder'

    // Get the next position for folders at this level
    const siblings = await this.findByParent(ownerId, input.parentId ?? null)
    const nextPosition = siblings.length > 0 ? Math.max(...siblings.map((f) => f.position)) + 1 : 0

    await db.insert(folders).values({
      id,
      name: input.name,
      icon,
      parentId: input.parentId ?? null,
      position: nextPosition,
      ownerId,
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      name: input.name,
      icon,
      parentId: input.parentId ?? null,
      position: nextPosition,
      ownerId,
      createdAt: now,
      updatedAt: now,
    }
  }

  async update(id: string, input: FolderUpdateInput): Promise<Folder | null> {
    const now = new Date()
    const updateData: Record<string, unknown> = { updatedAt: now }

    if (input.name !== undefined) updateData.name = input.name
    if (input.icon !== undefined) updateData.icon = input.icon
    if (input.parentId !== undefined) updateData.parentId = input.parentId
    if (input.position !== undefined) updateData.position = input.position

    await db.update(folders).set(updateData).where(eq(folders.id, id))
    return this.findById(id)
  }

  /**
   * Reorder a folder to a new position within the same parent or move to a different parent
   */
  async reorder(
    folderId: string,
    ownerId: string,
    newParentId: string | null,
    newPosition: number
  ): Promise<Folder | null> {
    const folder = await this.findById(folderId)
    if (!folder || folder.ownerId !== ownerId) return null

    const oldParentId = folder.parentId
    const oldPosition = folder.position
    const now = new Date()

    // If moving to a different parent
    if (oldParentId !== newParentId) {
      // Close the gap in the old parent
      await db
        .update(folders)
        .set({ position: sql`${folders.position} - 1`, updatedAt: now })
        .where(
          and(
            eq(folders.ownerId, ownerId),
            oldParentId === null ? isNull(folders.parentId) : eq(folders.parentId, oldParentId),
            gt(folders.position, oldPosition)
          )
        )

      // Make space in the new parent
      await db
        .update(folders)
        .set({ position: sql`${folders.position} + 1`, updatedAt: now })
        .where(
          and(
            eq(folders.ownerId, ownerId),
            newParentId === null ? isNull(folders.parentId) : eq(folders.parentId, newParentId),
            gte(folders.position, newPosition)
          )
        )

      // Move the folder
      await db
        .update(folders)
        .set({ parentId: newParentId, position: newPosition, updatedAt: now })
        .where(eq(folders.id, folderId))
    } else {
      // Same parent, just reorder
      if (newPosition > oldPosition) {
        // Moving down: shift items between old and new position up
        await db
          .update(folders)
          .set({ position: sql`${folders.position} - 1`, updatedAt: now })
          .where(
            and(
              eq(folders.ownerId, ownerId),
              oldParentId === null ? isNull(folders.parentId) : eq(folders.parentId, oldParentId),
              gt(folders.position, oldPosition),
              lte(folders.position, newPosition)
            )
          )
      } else if (newPosition < oldPosition) {
        // Moving up: shift items between new and old position down
        await db
          .update(folders)
          .set({ position: sql`${folders.position} + 1`, updatedAt: now })
          .where(
            and(
              eq(folders.ownerId, ownerId),
              oldParentId === null ? isNull(folders.parentId) : eq(folders.parentId, oldParentId),
              gte(folders.position, newPosition),
              lt(folders.position, oldPosition)
            )
          )
      }

      // Update the folder's position
      await db
        .update(folders)
        .set({ position: newPosition, updatedAt: now })
        .where(eq(folders.id, folderId))
    }

    return this.findById(folderId)
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(folders).where(eq(folders.id, id))
    return result.changes > 0
  }

  async hasChildren(id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(folders)
      .where(eq(folders.parentId, id))
    return (result[0]?.count ?? 0) > 0
  }

  async hasNotes(id: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(and(eq(notes.folderId, id), eq(notes.isDeleted, false)))
    return (result[0]?.count ?? 0) > 0
  }

  async countAll(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(folders)
    return result[0]?.count ?? 0
  }

  private mapToFolder(row: typeof folders.$inferSelect): Folder {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      parentId: row.parentId,
      position: row.position,
      ownerId: row.ownerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}

export const folderRepository = new FolderRepository()
