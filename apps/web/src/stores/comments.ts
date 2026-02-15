import { create } from 'zustand'
import type { CommentWithReplies } from '@onyka/shared'
import { commentsApi } from '@/services/api'

interface CommentsState {
  commentsByNote: Record<string, CommentWithReplies[]>
  countsByNote: Record<string, number>
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  expandedNoteId: string | null
  replyingTo: string | null
  editingId: string | null
  fetchComments: (noteId: string) => Promise<void>
  fetchCount: (noteId: string) => Promise<void>
  addComment: (noteId: string, content: string, parentId?: string) => Promise<void>
  updateComment: (commentId: string, content: string) => Promise<void>
  deleteComment: (noteId: string, commentId: string) => Promise<void>
  toggleExpanded: (noteId: string) => void
  setReplyingTo: (commentId: string | null) => void
  setEditingId: (commentId: string | null) => void
  clearError: () => void
  clearNoteComments: (noteId: string) => void
}

export const useCommentsStore = create<CommentsState>((set, get) => ({
  commentsByNote: {},
  countsByNote: {},
  isLoading: false,
  isSubmitting: false,
  error: null,
  expandedNoteId: null,
  replyingTo: null,
  editingId: null,

  fetchComments: async (noteId: string) => {
    set({ isLoading: true, error: null })
    try {
      const { comments } = await commentsApi.list(noteId)
      set((state) => ({
        commentsByNote: { ...state.commentsByNote, [noteId]: comments },
        countsByNote: { ...state.countsByNote, [noteId]: countComments(comments) },
        isLoading: false,
      }))
    } catch {
      set({ error: 'Failed to fetch comments', isLoading: false })
    }
  },

  fetchCount: async (noteId: string) => {
    try {
      const { count } = await commentsApi.count(noteId)
      set((state) => ({
        countsByNote: { ...state.countsByNote, [noteId]: count },
      }))
    } catch {
      // Silently fail - count is non-critical
    }
  },

  addComment: async (noteId: string, content: string, parentId?: string) => {
    set({ isSubmitting: true, error: null })
    try {
      await commentsApi.create(noteId, content, parentId)
      await get().fetchComments(noteId)
      set({ isSubmitting: false, replyingTo: null })
    } catch (err) {
      console.error('Failed to add comment:', err)
      set({ error: 'Failed to add comment', isSubmitting: false })
    }
  },

  updateComment: async (commentId: string, content: string) => {
    const noteId = findNoteIdForComment(get().commentsByNote, commentId)
    if (!noteId) return

    set({ isSubmitting: true, error: null })
    try {
      await commentsApi.update(commentId, content)
      await get().fetchComments(noteId)
      set({ isSubmitting: false, editingId: null })
    } catch {
      set({ error: 'Failed to update comment', isSubmitting: false })
    }
  },

  deleteComment: async (noteId: string, commentId: string) => {
    set({ isSubmitting: true, error: null })
    try {
      await commentsApi.delete(commentId)
      await get().fetchComments(noteId)
      set({ isSubmitting: false })
    } catch {
      set({ error: 'Failed to delete comment', isSubmitting: false })
    }
  },

  toggleExpanded: (noteId: string) => {
    const { expandedNoteId } = get()
    if (expandedNoteId === noteId) {
      set({ expandedNoteId: null })
    } else {
      set({ expandedNoteId: noteId })
      if (!get().commentsByNote[noteId]) {
        get().fetchComments(noteId)
      }
    }
  },

  setReplyingTo: (commentId: string | null) => {
    set({ replyingTo: commentId, editingId: null })
  },

  setEditingId: (commentId: string | null) => {
    set({ editingId: commentId, replyingTo: null })
  },

  clearError: () => set({ error: null }),

  clearNoteComments: (noteId: string) => {
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [noteId]: _removedComments, ...rest } = state.commentsByNote
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [noteId]: _removedCount, ...countRest } = state.countsByNote
      return {
        commentsByNote: rest,
        countsByNote: countRest,
        expandedNoteId: state.expandedNoteId === noteId ? null : state.expandedNoteId,
      }
    })
  },
}))

function countComments(comments: CommentWithReplies[]): number {
  return comments.reduce((acc, comment) => {
    return acc + 1 + (comment.replies?.length || 0)
  }, 0)
}

function findNoteIdForComment(
  commentsByNote: Record<string, CommentWithReplies[]>,
  commentId: string
): string | null {
  for (const [noteId, comments] of Object.entries(commentsByNote)) {
    for (const comment of comments) {
      if (comment.id === commentId) return noteId
      if (comment.replies?.some((r) => r.id === commentId)) return noteId
    }
  }
  return null
}
