import { folderRepository } from '../repositories/folder.repository.js'
import { noteRepository } from '../repositories/note.repository.js'
import type { Folder, FolderCreateInput, FolderUpdateInput, FolderWithChildren, FolderNote, FolderReorderInput, NoteReorderInput, Note } from '@onyka/shared'

export class FoldersServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'FoldersServiceError'
  }
}

const MAX_FOLDER_DEPTH = 5

export class FoldersService {
  async create(ownerId: string, input: FolderCreateInput): Promise<Folder> {
    if (input.parentId) {
      const parent = await folderRepository.findById(input.parentId)
      if (!parent) {
        throw new FoldersServiceError('Parent folder not found', 'PARENT_NOT_FOUND', 404)
      }
      if (parent.ownerId !== ownerId) {
        throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
      }

      const parentDepth = await this.getDepth(input.parentId)
      if (parentDepth + 1 > MAX_FOLDER_DEPTH) {
        throw new FoldersServiceError(
          `Maximum folder depth of ${MAX_FOLDER_DEPTH} exceeded`,
          'MAX_DEPTH_EXCEEDED',
          400
        )
      }
    }

    return folderRepository.create(ownerId, input)
  }

  async getById(folderId: string, userId: string): Promise<Folder> {
    const folder = await folderRepository.findById(folderId)

    if (!folder) {
      throw new FoldersServiceError('Folder not found', 'FOLDER_NOT_FOUND', 404)
    }

    if (folder.ownerId !== userId) {
      throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    return folder
  }

  async list(userId: string): Promise<Folder[]> {
    return folderRepository.findByOwner(userId)
  }

  async getTree(userId: string): Promise<FolderWithChildren[]> {
    return folderRepository.findTreeByOwner(userId)
  }

  async getRootNotes(userId: string): Promise<FolderNote[]> {
    return folderRepository.findRootNotes(userId)
  }

  async update(folderId: string, userId: string, input: FolderUpdateInput): Promise<Folder> {
    const folder = await folderRepository.findById(folderId)

    if (!folder) {
      throw new FoldersServiceError('Folder not found', 'FOLDER_NOT_FOUND', 404)
    }

    if (folder.ownerId !== userId) {
      throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    if (input.parentId !== undefined) {
      if (input.parentId === folderId) {
        throw new FoldersServiceError('Cannot move folder into itself', 'CIRCULAR_REFERENCE', 400)
      }

      if (input.parentId !== null) {
        const parent = await folderRepository.findById(input.parentId)
        if (!parent) {
          throw new FoldersServiceError('Parent folder not found', 'PARENT_NOT_FOUND', 404)
        }
        if (parent.ownerId !== userId) {
          throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
        }

        if (await this.isDescendant(input.parentId, folderId)) {
          throw new FoldersServiceError('Cannot move folder into its descendant', 'CIRCULAR_REFERENCE', 400)
        }

        const parentDepth = await this.getDepth(input.parentId)
        const subtreeHeight = await this.getSubtreeHeight(folderId)
        if (parentDepth + 1 + subtreeHeight > MAX_FOLDER_DEPTH) {
          throw new FoldersServiceError(
            `Maximum folder depth of ${MAX_FOLDER_DEPTH} exceeded`,
            'MAX_DEPTH_EXCEEDED',
            400
          )
        }
      }
    }

    const updated = await folderRepository.update(folderId, input)
    return updated!
  }

  async delete(folderId: string, userId: string, cascade = false): Promise<void> {
    const folder = await folderRepository.findById(folderId)

    if (!folder) {
      throw new FoldersServiceError('Folder not found', 'FOLDER_NOT_FOUND', 404)
    }

    if (folder.ownerId !== userId) {
      throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    const hasChildren = await folderRepository.hasChildren(folderId)
    const hasNotes = await folderRepository.hasNotes(folderId)

    if ((hasChildren || hasNotes) && !cascade) {
      throw new FoldersServiceError(
        'Folder is not empty. Use cascade=true to delete contents.',
        'FOLDER_NOT_EMPTY',
        400
      )
    }

    if (cascade) {
      await this.deleteRecursive(folderId, userId)
    } else {
      await folderRepository.delete(folderId)
    }
  }

  async moveNote(noteId: string, folderId: string | null, userId: string): Promise<void> {
    const note = await noteRepository.findById(noteId)

    if (!note) {
      throw new FoldersServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    if (note.ownerId !== userId) {
      throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    if (folderId !== null) {
      const folder = await folderRepository.findById(folderId)
      if (!folder) {
        throw new FoldersServiceError('Folder not found', 'FOLDER_NOT_FOUND', 404)
      }
      if (folder.ownerId !== userId) {
        throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
      }
    }

    await noteRepository.update(noteId, { folderId })
  }

  async reorderFolder(input: FolderReorderInput, userId: string): Promise<Folder> {
    const folder = await folderRepository.findById(input.folderId)

    if (!folder) {
      throw new FoldersServiceError('Folder not found', 'FOLDER_NOT_FOUND', 404)
    }

    if (folder.ownerId !== userId) {
      throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    // Validate new parent if specified
    if (input.newParentId !== null) {
      // Cannot move folder into itself
      if (input.newParentId === input.folderId) {
        throw new FoldersServiceError('Cannot move folder into itself', 'CIRCULAR_REFERENCE', 400)
      }

      const newParent = await folderRepository.findById(input.newParentId)
      if (!newParent) {
        throw new FoldersServiceError('Parent folder not found', 'PARENT_NOT_FOUND', 404)
      }
      if (newParent.ownerId !== userId) {
        throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
      }

      // Cannot move folder into its descendant
      if (await this.isDescendant(input.newParentId, input.folderId)) {
        throw new FoldersServiceError('Cannot move folder into its descendant', 'CIRCULAR_REFERENCE', 400)
      }

      const parentDepth = await this.getDepth(input.newParentId)
      const subtreeHeight = await this.getSubtreeHeight(input.folderId)
      if (parentDepth + 1 + subtreeHeight > MAX_FOLDER_DEPTH) {
        throw new FoldersServiceError(
          `Maximum folder depth of ${MAX_FOLDER_DEPTH} exceeded`,
          'MAX_DEPTH_EXCEEDED',
          400
        )
      }
    }

    const updated = await folderRepository.reorder(
      input.folderId,
      userId,
      input.newParentId,
      input.newPosition
    )

    if (!updated) {
      throw new FoldersServiceError('Failed to reorder folder', 'REORDER_FAILED', 500)
    }

    return updated
  }

  async reorderNote(input: NoteReorderInput, userId: string): Promise<Note> {
    const note = await noteRepository.findById(input.noteId)

    if (!note) {
      throw new FoldersServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    if (note.ownerId !== userId) {
      throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    // Validate new folder if specified
    if (input.newFolderId !== null) {
      const folder = await folderRepository.findById(input.newFolderId)
      if (!folder) {
        throw new FoldersServiceError('Folder not found', 'FOLDER_NOT_FOUND', 404)
      }
      if (folder.ownerId !== userId) {
        throw new FoldersServiceError('Access denied', 'ACCESS_DENIED', 403)
      }
    }

    const updated = await noteRepository.reorder(
      input.noteId,
      userId,
      input.newFolderId,
      input.newPosition
    )

    if (!updated) {
      throw new FoldersServiceError('Failed to reorder note', 'REORDER_FAILED', 500)
    }

    return updated
  }

  private async getDepth(folderId: string): Promise<number> {
    let depth = 1
    let currentId: string | null = folderId
    while (currentId) {
      const folder = await folderRepository.findById(currentId)
      if (!folder || !folder.parentId) break
      depth++
      currentId = folder.parentId
    }
    return depth
  }

  private async getSubtreeHeight(folderId: string): Promise<number> {
    const folder = await folderRepository.findById(folderId)
    if (!folder) return 0
    const children = await folderRepository.findByParent(folder.ownerId, folderId)
    if (children.length === 0) return 0
    const childHeights = await Promise.all(
      children.map((child) => this.getSubtreeHeight(child.id))
    )
    return 1 + Math.max(...childHeights)
  }

  private async isDescendant(potentialDescendantId: string, ancestorId: string): Promise<boolean> {
    const folder = await folderRepository.findById(potentialDescendantId)
    if (!folder) return false
    if (folder.parentId === ancestorId) return true
    if (folder.parentId === null) return false
    return this.isDescendant(folder.parentId, ancestorId)
  }

  private async deleteRecursive(folderId: string, userId: string): Promise<void> {
    const children = await folderRepository.findByParent(userId, folderId)
    for (const child of children) {
      await this.deleteRecursive(child.id, userId)
    }

    const notes = await noteRepository.findByOwner(userId, { folderId })
    for (const note of notes) {
      await noteRepository.softDelete(note.id)
    }

    await folderRepository.delete(folderId)
  }
}

export const foldersService = new FoldersService()
