import { pageRepository } from '../repositories/page.repository.js'
import { noteRepository } from '../repositories/note.repository.js'
import { shareRepository } from '../repositories/share.repository.js'
import { userRepository } from '../repositories/user.repository.js'
import { statsService } from './stats.service.js'
import { logger } from '../utils/index.js'
import type { NotePage, NotePageCreateInput, NotePageUpdateInput } from '@onyka/shared'

export class PagesServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PagesServiceError'
  }
}

export class PagesService {
  async getPages(noteId: string, userId: string): Promise<NotePage[]> {
    await this.verifyNoteAccess(noteId, userId, 'read')
    return pageRepository.findByNoteId(noteId)
  }

  async getPage(pageId: string, userId: string): Promise<NotePage> {
    const page = await pageRepository.findById(pageId)
    if (!page) {
      throw new PagesServiceError('Page not found', 'PAGE_NOT_FOUND', 404)
    }

    await this.verifyNoteAccess(page.noteId, userId, 'read')
    return page
  }

  async createPage(noteId: string, userId: string, input: NotePageCreateInput): Promise<NotePage> {
    await this.verifyNoteAccess(noteId, userId, 'edit')

    const pageCount = await pageRepository.countByNote(noteId)
    const title = input.title ?? `Page ${pageCount + 1}`

    return pageRepository.create(noteId, { ...input, title })
  }

  async updatePage(pageId: string, userId: string, input: NotePageUpdateInput): Promise<NotePage> {
    const page = await pageRepository.findById(pageId)
    if (!page) {
      throw new PagesServiceError('Page not found', 'PAGE_NOT_FOUND', 404)
    }

    const note = await this.verifyNoteAccess(page.noteId, userId, 'edit')

    // Track words written for stats if tracking is enabled (fire and forget)
    if (input.content !== undefined && input.content !== page.content && note) {
      const newContent = input.content
      const noteOwnerId = note.ownerId
      const oldContent = page.content
      void (async () => {
        try {
          const enabled = await userRepository.getTrackingEnabled(noteOwnerId)
          if (enabled) {
            await statsService.trackWordsWritten(noteOwnerId, oldContent, newContent)
          }
        } catch (err) {
          logger.warn('Failed to track words written (page)', { ownerId: noteOwnerId, pageId, error: err instanceof Error ? err.message : String(err) })
        }
      })()
    }

    const updated = await pageRepository.update(pageId, input)
    if (!updated) {
      throw new PagesServiceError('Failed to update page', 'UPDATE_FAILED', 500)
    }

    return updated
  }

  async deletePage(pageId: string, userId: string): Promise<void> {
    const page = await pageRepository.findById(pageId)
    if (!page) {
      throw new PagesServiceError('Page not found', 'PAGE_NOT_FOUND', 404)
    }

    await this.verifyNoteAccess(page.noteId, userId, 'edit')

    // Prevent deleting the last page
    const pageCount = await pageRepository.countByNote(page.noteId)
    if (pageCount <= 1) {
      throw new PagesServiceError('Cannot delete the last page', 'CANNOT_DELETE_LAST_PAGE', 400)
    }

    await pageRepository.softDelete(pageId)
  }

  async reorderPage(pageId: string, userId: string, newPosition: number): Promise<NotePage> {
    const page = await pageRepository.findById(pageId)
    if (!page) {
      throw new PagesServiceError('Page not found', 'PAGE_NOT_FOUND', 404)
    }

    await this.verifyNoteAccess(page.noteId, userId, 'edit')

    const reordered = await pageRepository.reorder(pageId, page.noteId, newPosition)
    if (!reordered) {
      throw new PagesServiceError('Failed to reorder page', 'REORDER_FAILED', 500)
    }

    return reordered
  }

  // Helper for migration: create initial page for existing note
  async createInitialPage(
    noteId: string,
    title: string,
    content: string
  ): Promise<NotePage> {
    return pageRepository.create(noteId, {
      title: title || 'Page 1',
      content,
      position: 0,
    })
  }

  private async verifyNoteAccess(
    noteId: string,
    userId: string,
    requiredPermission: 'read' | 'edit'
  ): Promise<{ ownerId: string }> {
    const note = await noteRepository.findById(noteId)

    if (!note) {
      throw new PagesServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    // Owner has full access
    if (note.ownerId === userId) {
      return { ownerId: note.ownerId }
    }

    // Check shared access
    const hasAccess = await shareRepository.hasAccess(userId, noteId, 'note', requiredPermission)
    if (!hasAccess) {
      throw new PagesServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    return { ownerId: note.ownerId }
  }
}

export const pagesService = new PagesService()
