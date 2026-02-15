import { eq, desc, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import type { Comment, CommentWithUser, CommentWithReplies } from '@onyka/shared'

const { noteComments, users } = schema

export class CommentRepository {
  async findById(id: string): Promise<Comment | null> {
    const result = await db.select().from(noteComments).where(eq(noteComments.id, id)).limit(1)
    return result[0] ? this.mapToComment(result[0]) : null
  }

  async findByIdWithUser(id: string): Promise<CommentWithUser | null> {
    const result = await db
      .select({
        comment: noteComments,
        user: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
          avatarColor: users.avatarColor,
        },
      })
      .from(noteComments)
      .innerJoin(users, eq(noteComments.userId, users.id))
      .where(eq(noteComments.id, id))
      .limit(1)

    if (!result[0]) return null

    return {
      ...this.mapToComment(result[0].comment),
      user: {
        id: result[0].user.id,
        username: result[0].user.username,
        name: result[0].user.name,
        avatarUrl: result[0].user.avatarUrl ?? undefined,
        avatarColor: result[0].user.avatarColor,
      },
    }
  }

  async findByNoteId(noteId: string): Promise<CommentWithReplies[]> {
    // Get all comments for the note with user info
    const allComments = await db
      .select({
        comment: noteComments,
        user: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
          avatarColor: users.avatarColor,
        },
      })
      .from(noteComments)
      .innerJoin(users, eq(noteComments.userId, users.id))
      .where(eq(noteComments.noteId, noteId))
      .orderBy(desc(noteComments.createdAt))

    // Build comment tree: separate top-level and replies
    const commentMap = new Map<string, CommentWithReplies>()
    const topLevelComments: CommentWithReplies[] = []

    // First pass: create all comment objects
    for (const row of allComments) {
      const comment: CommentWithReplies = {
        ...this.mapToComment(row.comment),
        user: {
          id: row.user.id,
          username: row.user.username,
          name: row.user.name,
          avatarUrl: row.user.avatarUrl ?? undefined,
          avatarColor: row.user.avatarColor,
        },
        replies: [],
      }
      commentMap.set(comment.id, comment)
    }

    // Second pass: build tree structure
    for (const row of allComments) {
      const comment = commentMap.get(row.comment.id)!
      if (row.comment.parentId) {
        const parent = commentMap.get(row.comment.parentId)
        if (parent) {
          parent.replies.push(comment)
        }
      } else {
        topLevelComments.push(comment)
      }
    }

    // Sort replies by createdAt (oldest first for conversation flow)
    for (const comment of commentMap.values()) {
      comment.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }

    return topLevelComments
  }

  async countByNoteId(noteId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(noteComments)
      .where(eq(noteComments.noteId, noteId))
    return result[0]?.count ?? 0
  }

  async create(
    noteId: string,
    userId: string,
    content: string,
    parentId?: string
  ): Promise<Comment> {
    const id = nanoid()
    const now = new Date()

    await db.insert(noteComments).values({
      id,
      noteId,
      userId,
      parentId: parentId ?? null,
      content: encrypt(content),
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      noteId,
      userId,
      parentId: parentId ?? null,
      content,
      createdAt: now,
      updatedAt: now,
    }
  }

  async update(id: string, content: string): Promise<Comment | null> {
    const now = new Date()
    await db.update(noteComments).set({ content: encrypt(content), updatedAt: now }).where(eq(noteComments.id, id))
    return this.findById(id)
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(noteComments).where(eq(noteComments.id, id))
    return result.changes > 0
  }

  async deleteByNoteId(noteId: string): Promise<number> {
    const result = await db.delete(noteComments).where(eq(noteComments.noteId, noteId))
    return result.changes
  }

  private mapToComment(row: typeof noteComments.$inferSelect): Comment {
    return {
      id: row.id,
      noteId: row.noteId,
      userId: row.userId,
      parentId: row.parentId,
      content: decrypt(row.content),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}

export const commentRepository = new CommentRepository()
