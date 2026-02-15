import { noteRepository, type NoteFilters } from '../repositories/note.repository.js'
import { shareRepository } from '../repositories/share.repository.js'
import { tagRepository } from '../repositories/tag.repository.js'
import { userRepository } from '../repositories/user.repository.js'
import { searchService, type SearchResult } from './search.service.js'
import { statsService } from './stats.service.js'
import { logger } from '../utils/index.js'
import type { Note, NoteCreateInput, NoteUpdateInput, NoteWithTags, Permission } from '@onyka/shared'

export class NotesServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'NotesServiceError'
  }
}

export class NotesService {
  async create(ownerId: string, input: NoteCreateInput): Promise<Note> {
    const note = await noteRepository.create(ownerId, input)
    searchService.indexNote(note)

    // Track note creation for stats if tracking is enabled (fire and forget)
    void (async () => {
      try {
        const enabled = await userRepository.getTrackingEnabled(ownerId)
        if (enabled) {
          await statsService.trackNoteCreated(ownerId)
        }
      } catch (err) {
        logger.warn('Failed to track note creation', { ownerId, error: err instanceof Error ? err.message : String(err) })
      }
    })()

    return note
  }

  async getById(noteId: string, userId: string): Promise<NoteWithTags> {
    const note = await noteRepository.findByIdWithTags(noteId)

    if (!note) {
      throw new NotesServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    const hasAccess = await this.checkAccess(noteId, note.ownerId, userId, 'read')
    if (!hasAccess) {
      throw new NotesServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    return note
  }

  async list(userId: string, filters: NoteFilters = {}): Promise<Note[]> {
    return noteRepository.findByOwner(userId, filters)
  }

  async update(noteId: string, userId: string, input: NoteUpdateInput): Promise<Note> {
    const note = await noteRepository.findById(noteId)

    if (!note) {
      throw new NotesServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    const hasAccess = await this.checkAccess(noteId, note.ownerId, userId, 'edit')
    if (!hasAccess) {
      throw new NotesServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    // Track words written for stats if tracking is enabled (fire and forget)
    if (input.content !== undefined && input.content !== note.content) {
      const newContent = input.content
      const noteOwnerId = note.ownerId
      void (async () => {
        try {
          const enabled = await userRepository.getTrackingEnabled(noteOwnerId)
          if (enabled) {
            await statsService.trackWordsWritten(noteOwnerId, note.content, newContent)
          }
        } catch (err) {
          logger.warn('Failed to track words written', { ownerId: noteOwnerId, error: err instanceof Error ? err.message : String(err) })
        }
      })()
    }

    const updated = await noteRepository.update(noteId, input)
    if (!updated) {
      throw new NotesServiceError('Failed to update note', 'UPDATE_FAILED', 500)
    }

    searchService.indexNote(updated)
    return updated
  }

  async delete(noteId: string, userId: string): Promise<void> {
    const note = await noteRepository.findById(noteId)

    if (!note) {
      throw new NotesServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    const hasAccess = await this.checkAccess(noteId, note.ownerId, userId, 'admin')
    if (!hasAccess) {
      throw new NotesServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    await noteRepository.softDelete(noteId)
    searchService.removeNoteFromIndex(noteId)
  }

  async restore(noteId: string, userId: string): Promise<Note> {
    const note = await noteRepository.findById(noteId)

    if (!note) {
      throw new NotesServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    const hasAccess = await this.checkAccess(noteId, note.ownerId, userId, 'admin')
    if (!hasAccess) {
      throw new NotesServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    if (!note.isDeleted) {
      throw new NotesServiceError('Note is not deleted', 'NOT_DELETED', 400)
    }

    // Restore and get updated note in one operation
    const restored = await noteRepository.restore(noteId)
    if (!restored) {
      throw new NotesServiceError('Failed to restore note', 'RESTORE_FAILED', 500)
    }

    // Index asynchronously to not block the response
    setImmediate(() => searchService.indexNote(restored))

    return restored
  }

  async permanentDelete(noteId: string, userId: string): Promise<void> {
    const note = await noteRepository.findById(noteId)

    if (!note) {
      throw new NotesServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    const hasAccess = await this.checkAccess(noteId, note.ownerId, userId, 'admin')
    if (!hasAccess) {
      throw new NotesServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    await noteRepository.permanentDelete(noteId)
    searchService.removeNoteFromIndex(noteId)
  }

  async addTag(noteId: string, userId: string, tagId: string): Promise<void> {
    const note = await noteRepository.findById(noteId)

    if (!note) {
      throw new NotesServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    if (note.ownerId !== userId) {
      throw new NotesServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    // Verify tag belongs to the same user
    const tag = await tagRepository.findById(tagId)
    if (!tag || tag.ownerId !== userId) {
      throw new NotesServiceError('Tag not found', 'TAG_NOT_FOUND', 404)
    }

    await noteRepository.addTag(noteId, tagId)
  }

  async removeTag(noteId: string, userId: string, tagId: string): Promise<void> {
    const note = await noteRepository.findById(noteId)

    if (!note) {
      throw new NotesServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    if (note.ownerId !== userId) {
      throw new NotesServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    // Verify tag belongs to the same user
    const tag = await tagRepository.findById(tagId)
    if (!tag || tag.ownerId !== userId) {
      throw new NotesServiceError('Tag not found', 'TAG_NOT_FOUND', 404)
    }

    await noteRepository.removeTag(noteId, tagId)
  }

  async getDeleted(userId: string): Promise<Note[]> {
    return noteRepository.findByOwner(userId, { isDeleted: true })
  }

  async search(query: string, userId: string): Promise<SearchResult[]> {
    return searchService.search(query, userId)
  }

  async reindexSearch(userId: string): Promise<void> {
    const notes = await noteRepository.findByOwner(userId, { isDeleted: false })
    searchService.reindexAll(notes)
  }

  async getSharedWithMe(userId: string): Promise<Note[]> {
    const shares = await shareRepository.findBySharedWith(userId)
    const noteShares = shares.filter((s) => s.resourceType === 'note')

    if (noteShares.length === 0) {
      return []
    }

    const noteIds = noteShares.map((s) => s.resourceId)
    const notes = await noteRepository.findByIds(noteIds)

    return notes.filter((note) => !note.isDeleted)
  }

  async getQuickNotes(userId: string): Promise<Note[]> {
    return noteRepository.findQuickNotes(userId)
  }

  async createQuickNote(ownerId: string): Promise<Note> {
    const note = await noteRepository.create(ownerId, {
      title: '',
      content: '',
      isQuickNote: true,
    })
    searchService.indexNote(note)

    // Track note creation for stats if tracking is enabled (fire and forget)
    void (async () => {
      try {
        const enabled = await userRepository.getTrackingEnabled(ownerId)
        if (enabled) {
          await statsService.trackNoteCreated(ownerId)
        }
      } catch (err) {
        logger.warn('Failed to track quick note creation', { ownerId, error: err instanceof Error ? err.message : String(err) })
      }
    })()

    return note
  }

  private async checkAccess(
    noteId: string,
    ownerId: string,
    userId: string,
    requiredPermission: Permission
  ): Promise<boolean> {
    if (ownerId === userId) {
      return true
    }

    return shareRepository.hasAccess(userId, noteId, 'note', requiredPermission)
  }
}

export const notesService = new NotesService()
