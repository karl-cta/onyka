import { tagRepository, type TagWithCount, UniqueConstraintError } from '../repositories/tag.repository.js'
import type { Tag, TagCreateInput, TagUpdateInput } from '@onyka/shared'

export class TagsServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'TagsServiceError'
  }
}

export class TagsService {
  async create(ownerId: string, input: TagCreateInput): Promise<Tag> {
    const existing = await tagRepository.findByName(ownerId, input.name)
    if (existing) {
      throw new TagsServiceError('Tag with this name already exists', 'TAG_EXISTS', 409)
    }

    try {
      return await tagRepository.create(ownerId, input)
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new TagsServiceError('Tag with this name already exists', 'TAG_EXISTS', 409)
      }
      throw error
    }
  }

  async getById(tagId: string, userId: string): Promise<Tag> {
    const tag = await tagRepository.findById(tagId)

    if (!tag) {
      throw new TagsServiceError('Tag not found', 'TAG_NOT_FOUND', 404)
    }

    if (tag.ownerId !== userId) {
      throw new TagsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    return tag
  }

  async list(userId: string): Promise<Tag[]> {
    return tagRepository.findByOwner(userId)
  }

  async listWithCounts(userId: string): Promise<TagWithCount[]> {
    return tagRepository.findByOwnerWithCounts(userId)
  }

  async update(tagId: string, userId: string, input: TagUpdateInput): Promise<Tag> {
    const tag = await tagRepository.findById(tagId)

    if (!tag) {
      throw new TagsServiceError('Tag not found', 'TAG_NOT_FOUND', 404)
    }

    if (tag.ownerId !== userId) {
      throw new TagsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    if (input.name && input.name !== tag.name) {
      const existing = await tagRepository.findByName(userId, input.name)
      if (existing) {
        throw new TagsServiceError('Tag with this name already exists', 'TAG_EXISTS', 409)
      }
    }

    try {
      const updated = await tagRepository.update(tagId, input)
      return updated!
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new TagsServiceError('Tag with this name already exists', 'TAG_EXISTS', 409)
      }
      throw error
    }
  }

  async delete(tagId: string, userId: string): Promise<void> {
    const tag = await tagRepository.findById(tagId)

    if (!tag) {
      throw new TagsServiceError('Tag not found', 'TAG_NOT_FOUND', 404)
    }

    if (tag.ownerId !== userId) {
      throw new TagsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    await tagRepository.delete(tagId)
  }
}

export const tagsService = new TagsService()
