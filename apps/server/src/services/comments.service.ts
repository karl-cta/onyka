import { commentRepository } from '../repositories/comment.repository.js'
import { noteRepository } from '../repositories/note.repository.js'
import { shareRepository } from '../repositories/share.repository.js'
import type { CommentWithUser, CommentWithReplies } from '@onyka/shared'

export class CommentsServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'CommentsServiceError'
  }
}

export class CommentsService {
  async getComments(noteId: string, userId: string): Promise<CommentWithReplies[]> {
    await this.verifyAccess(noteId, userId, 'read')
    return commentRepository.findByNoteId(noteId)
  }

  async getCommentCount(noteId: string, userId: string): Promise<number> {
    await this.verifyAccess(noteId, userId, 'read')
    return commentRepository.countByNoteId(noteId)
  }

  async createComment(
    noteId: string,
    userId: string,
    content: string,
    parentId?: string
  ): Promise<CommentWithUser> {
    await this.verifyAccess(noteId, userId, 'read')

    if (!content.trim()) {
      throw new CommentsServiceError('Comment content cannot be empty', 'EMPTY_CONTENT', 400)
    }

    if (parentId) {
      const parentComment = await commentRepository.findById(parentId)
      if (!parentComment) {
        throw new CommentsServiceError('Parent comment not found', 'PARENT_NOT_FOUND', 404)
      }
      if (parentComment.noteId !== noteId) {
        throw new CommentsServiceError('Parent comment belongs to different note', 'INVALID_PARENT', 400)
      }
    }

    const comment = await commentRepository.create(noteId, userId, content.trim(), parentId)
    const commentWithUser = await commentRepository.findByIdWithUser(comment.id)

    if (!commentWithUser) {
      throw new CommentsServiceError('Failed to create comment', 'CREATE_FAILED', 500)
    }

    return commentWithUser
  }

  async updateComment(
    commentId: string,
    userId: string,
    content: string
  ): Promise<CommentWithUser> {
    const comment = await commentRepository.findById(commentId)

    if (!comment) {
      throw new CommentsServiceError('Comment not found', 'COMMENT_NOT_FOUND', 404)
    }

    if (comment.userId !== userId) {
      throw new CommentsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    if (!content.trim()) {
      throw new CommentsServiceError('Comment content cannot be empty', 'EMPTY_CONTENT', 400)
    }

    await commentRepository.update(commentId, content.trim())
    const updatedComment = await commentRepository.findByIdWithUser(commentId)

    if (!updatedComment) {
      throw new CommentsServiceError('Failed to update comment', 'UPDATE_FAILED', 500)
    }

    return updatedComment
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await commentRepository.findById(commentId)

    if (!comment) {
      throw new CommentsServiceError('Comment not found', 'COMMENT_NOT_FOUND', 404)
    }

    const note = await noteRepository.findById(comment.noteId)
    const isAuthor = comment.userId === userId
    const isNoteOwner = note?.ownerId === userId

    if (!isAuthor && !isNoteOwner) {
      throw new CommentsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    await commentRepository.delete(commentId)
  }

  private async verifyAccess(
    noteId: string,
    userId: string,
    requiredPermission: 'read' | 'edit' = 'read'
  ): Promise<void> {
    const note = await noteRepository.findById(noteId)

    if (!note) {
      throw new CommentsServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    // Owner has full access
    if (note.ownerId === userId) {
      return
    }

    // Check shared access
    const hasAccess = await shareRepository.hasAccess(userId, noteId, 'note', requiredPermission)
    if (!hasAccess) {
      throw new CommentsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }
  }
}

export const commentsService = new CommentsService()
