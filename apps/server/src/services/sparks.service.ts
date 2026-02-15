import { sparkRepository } from '../repositories/spark.repository.js'
import { noteRepository } from '../repositories/note.repository.js'
import { folderRepository } from '../repositories/folder.repository.js'
import type { Spark, SparkCreateInput, SparkStats, SparksList } from '@onyka/shared'

const MAX_PINNED_SPARKS = 5

export class SparksServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'SparksServiceError'
  }
}

export class SparksService {
  async list(userId: string): Promise<SparksList> {
    // First, mark any expired sparks as expired
    await this.markExpiredSparks(userId)

    // Get all active sparks
    const sparks = await sparkRepository.findActiveByOwner(userId)

    // Separate by type
    const pinned = sparks.filter((s) => s.isPinned)
    const temporary = sparks.filter((s) => !s.isPinned && s.expiresAt !== null)
    const permanent = sparks.filter((s) => !s.isPinned && s.expiresAt === null)

    return { pinned, temporary, permanent }
  }

  async create(userId: string, input: SparkCreateInput): Promise<Spark> {
    // Validate content
    if (!input.content || input.content.trim().length === 0) {
      throw new SparksServiceError('Content is required', 'CONTENT_REQUIRED')
    }

    if (input.content.length > 2000) {
      throw new SparksServiceError('Content must be less than 2000 characters', 'CONTENT_TOO_LONG')
    }

    // Check pin limit if trying to create a pinned spark
    if (input.isPinned) {
      const pinnedCount = await sparkRepository.countPinned(userId)
      if (pinnedCount >= MAX_PINNED_SPARKS) {
        throw new SparksServiceError(
          `Maximum of ${MAX_PINNED_SPARKS} pinned sparks allowed`,
          'MAX_PINS_REACHED'
        )
      }
    }

    // Calculate expiration
    const expiration = input.expiration || 'none'
    return sparkRepository.create(userId, {
      content: input.content.trim(),
      isPinned: input.isPinned,
      expiration,
    })
  }

  async togglePin(sparkId: string, userId: string): Promise<Spark> {
    const spark = await sparkRepository.findById(sparkId)

    if (!spark) {
      throw new SparksServiceError('Spark not found', 'SPARK_NOT_FOUND', 404)
    }

    if (spark.ownerId !== userId) {
      throw new SparksServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    // If unpinning, just do it
    if (spark.isPinned) {
      const updated = await sparkRepository.togglePin(sparkId, false)
      if (!updated) {
        throw new SparksServiceError('Failed to update spark', 'UPDATE_FAILED', 500)
      }
      return updated
    }

    // If pinning, check the limit
    const pinnedCount = await sparkRepository.countPinned(userId)
    if (pinnedCount >= MAX_PINNED_SPARKS) {
      throw new SparksServiceError(
        `Maximum of ${MAX_PINNED_SPARKS} pinned sparks allowed`,
        'MAX_PINS_REACHED'
      )
    }

    const updated = await sparkRepository.togglePin(sparkId, true)
    if (!updated) {
      throw new SparksServiceError('Failed to update spark', 'UPDATE_FAILED', 500)
    }
    return updated
  }

  async update(sparkId: string, userId: string, content: string): Promise<Spark> {
    const spark = await sparkRepository.findById(sparkId)

    if (!spark) {
      throw new SparksServiceError('Spark not found', 'SPARK_NOT_FOUND', 404)
    }

    if (spark.ownerId !== userId) {
      throw new SparksServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      throw new SparksServiceError('Content is required', 'CONTENT_REQUIRED')
    }

    if (content.length > 2000) {
      throw new SparksServiceError('Content must be less than 2000 characters', 'CONTENT_TOO_LONG')
    }

    const updated = await sparkRepository.updateContent(sparkId, content.trim())
    if (!updated) {
      throw new SparksServiceError('Failed to update spark', 'UPDATE_FAILED', 500)
    }

    return updated
  }

  async delete(sparkId: string, userId: string): Promise<void> {
    const spark = await sparkRepository.findById(sparkId)

    if (!spark) {
      throw new SparksServiceError('Spark not found', 'SPARK_NOT_FOUND', 404)
    }

    if (spark.ownerId !== userId) {
      throw new SparksServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    await sparkRepository.delete(sparkId)
  }

  async convertToNote(
    sparkId: string,
    userId: string,
    options: { title?: string; folderId?: string | null }
  ): Promise<{ spark: Spark; noteId: string }> {
    const spark = await sparkRepository.findById(sparkId)

    if (!spark) {
      throw new SparksServiceError('Spark not found', 'SPARK_NOT_FOUND', 404)
    }

    if (spark.ownerId !== userId) {
      throw new SparksServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    if (spark.convertedToNoteId) {
      throw new SparksServiceError('Spark already converted to a note', 'ALREADY_CONVERTED')
    }

    // Verify folder ownership if folderId is provided
    if (options.folderId) {
      const folder = await folderRepository.findById(options.folderId)
      if (!folder || folder.ownerId !== userId) {
        throw new SparksServiceError('Folder not found', 'FOLDER_NOT_FOUND', 404)
      }
    }

    // Create the note with spark content
    const title = options.title || spark.content.slice(0, 50) + (spark.content.length > 50 ? '...' : '')
    const note = await noteRepository.create(userId, {
      title,
      content: spark.content,
      folderId: options.folderId ?? null,
    })

    // Mark the spark as converted
    const updatedSpark = await sparkRepository.setConvertedToNote(sparkId, note.id)
    if (!updatedSpark) {
      throw new SparksServiceError('Failed to update spark', 'UPDATE_FAILED', 500)
    }

    return { spark: updatedSpark, noteId: note.id }
  }

  async getStats(userId: string): Promise<SparkStats> {
    // Mark expired sparks first
    await this.markExpiredSparks(userId)

    const sparks = await sparkRepository.findActiveByOwner(userId)
    const pinnedCount = sparks.filter((s) => s.isPinned).length
    const temporaryCount = sparks.filter((s) => !s.isPinned && s.expiresAt !== null).length

    return {
      pinnedCount,
      temporaryCount,
      totalCount: sparks.length,
    }
  }

  private async markExpiredSparks(userId: string): Promise<void> {
    const expiredSparks = await sparkRepository.findExpiredByOwner(userId)
    if (expiredSparks.length > 0) {
      await sparkRepository.markExpired(expiredSparks.map((s) => s.id))
    }
  }
}

export const sparksService = new SparksService()
