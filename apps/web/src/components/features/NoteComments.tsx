import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  IoChatbubbleOutline,
  IoSendOutline,
  IoArrowUndoOutline,
  IoTrashOutline,
  IoPencilOutline,
  IoCloseOutline,
  IoReloadOutline,
} from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { useCommentsStore } from '@/stores/comments'
import { useAuthStore } from '@/stores/auth'
import { getInitials, formatRelativeTime } from '@/utils/format'
import { getAvatarRingClass } from '@/utils/avatar'
import type { CommentWithUser } from '@onyka/shared'

interface NoteCommentsProps {
  noteId: string
  isOwner?: boolean
  isOpen: boolean
  onClose: () => void
}

interface CommentItemProps {
  comment: CommentWithUser
  noteId: string
  isOwner: boolean
  isReply?: boolean
}

function CommentItem({ comment, noteId, isOwner, isReply = false }: CommentItemProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const {
    replyingTo,
    editingId,
    setReplyingTo,
    setEditingId,
    updateComment,
    deleteComment,
    addComment,
    isSubmitting,
  } = useCommentsStore()
  const [editContent, setEditContent] = useState(comment.content)
  const [replyContent, setReplyContent] = useState('')

  const isAuthor = user?.id === comment.userId
  const canDelete = isAuthor || isOwner
  const isEditing = editingId === comment.id
  const isReplying = replyingTo === comment.id

  const handleEdit = async () => {
    if (!editContent.trim() || isSubmitting) return
    await updateComment(comment.id, editContent.trim())
  }

  const handleDelete = async () => {
    if (confirm(t('comments.delete_confirm'))) {
      await deleteComment(noteId, comment.id)
    }
  }

  const handleReply = async () => {
    if (!replyContent.trim() || isSubmitting) return
    await addComment(noteId, replyContent.trim(), comment.id)
    setReplyContent('')
  }

  return (
    <div className={`${isReply ? 'ml-10 mt-2' : ''}`}>
      <div className="flex gap-3 group">
        <div className="flex-shrink-0">
          {comment.user.avatarUrl ? (
            <img
              src={comment.user.avatarUrl}
              alt={comment.user.username}
              className={`${isReply ? 'w-7 h-7' : 'w-9 h-9'} rounded-full object-cover ring-2 ${getAvatarRingClass(comment.user.avatarColor)}`}
            />
          ) : (
            <div className={`${isReply ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'} rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-primary)] font-medium ring-2 ${getAvatarRingClass(comment.user.avatarColor)}`}>
              {getInitials(comment.user.username)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`${isReply ? 'text-xs' : 'text-sm'} font-medium text-[var(--color-text-primary)]`}>
              {comment.user.username}
            </span>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {formatRelativeTime(comment.createdAt, i18n.language, t)}
            </span>
          </div>

          {isEditing ? (
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-[var(--color-bg-tertiary)] ring-1 ring-[var(--color-accent)]/40 rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-[var(--color-accent)] transition-shadow"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEdit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
              <button
                onClick={handleEdit}
                disabled={isSubmitting || !editContent.trim()}
                className="p-1.5 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {isSubmitting ? <IoReloadOutline className="w-4 h-4 animate-spin" /> : <IoSendOutline className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  setEditingId(null)
                  setEditContent(comment.content)
                }}
                className="p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg"
              >
                <IoCloseOutline className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <p className={`${isReply ? 'text-xs' : 'text-sm'} text-[var(--color-text-secondary)] break-words`}>
                {comment.content}
              </p>

              <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isReply && (
                  <button
                    onClick={() => setReplyingTo(isReplying ? null : comment.id)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                      isReplying
                        ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                    }`}
                  >
                    <IoArrowUndoOutline className="w-3 h-3" />
                  </button>
                )}
                {isAuthor && (
                  <button
                    onClick={() => {
                      setEditingId(comment.id)
                      setEditContent(comment.content)
                    }}
                    className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
                  >
                    <IoPencilOutline className="w-3 h-3" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded transition-colors"
                  >
                    <IoTrashOutline className="w-3 h-3" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {isReplying && (
        <div className="ml-12 mt-2 flex gap-2">
          <input
            type="text"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={t('comments.reply_placeholder', { name: comment.user.username })}
            className="flex-1 px-3 py-1.5 bg-[var(--color-bg-tertiary)] ring-1 ring-[var(--color-accent)]/40 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] text-sm focus:outline-none focus:ring-[var(--color-accent)] transition-shadow"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && replyContent.trim()) handleReply()
              if (e.key === 'Escape') setReplyingTo(null)
            }}
          />
          <button
            onClick={handleReply}
            disabled={isSubmitting || !replyContent.trim()}
            className="p-1.5 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {isSubmitting ? <IoReloadOutline className="w-4 h-4 animate-spin" /> : <IoSendOutline className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  )
}

export function NoteComments({ noteId, isOwner = false, isOpen, onClose }: NoteCommentsProps) {
  const { t } = useTranslation()
  const [newComment, setNewComment] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    commentsByNote,
    countsByNote,
    isLoading,
    isSubmitting,
    error,
    fetchComments,
    addComment,
    clearError,
  } = useCommentsStore()

  const comments = commentsByNote[noteId] || []
  const count = countsByNote[noteId] || 0

  useEffect(() => {
    if (isOpen && noteId) {
      fetchComments(noteId)
    }
  }, [isOpen, noteId, fetchComments])

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments.length, isOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || isSubmitting) return
    await addComment(noteId, newComment.trim())
    setNewComment('')
  }

  return createPortal(
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-80 bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center gap-2">
            <IoChatbubbleOutline className="w-5 h-5 text-[var(--color-accent)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)]">
              {t('comments.title')}
            </h2>
            {count > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium">
                {count}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
          >
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </header>

        {error && (
          <div className="mx-4 mt-3 p-2 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-lg flex items-center justify-between">
            <span className="text-xs text-[var(--color-error)]">{error}</span>
            <button onClick={clearError} className="p-0.5 hover:bg-[var(--color-error)]/20 rounded">
              <IoCloseOutline className="w-3 h-3 text-[var(--color-error)]" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <IoReloadOutline className="w-6 h-6 animate-spin text-[var(--color-accent)]" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-3">
                <IoChatbubbleOutline className="w-6 h-6 text-[var(--color-text-tertiary)] opacity-50" />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t('comments.empty')}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                {t('comments.empty_hint')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id}>
                  <CommentItem
                    comment={comment}
                    noteId={noteId}
                    isOwner={isOwner}
                  />
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {comment.replies.map((reply) => (
                        <CommentItem
                          key={reply.id}
                          comment={reply}
                          noteId={noteId}
                          isOwner={isOwner}
                          isReply
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t('comments.placeholder')}
              className="flex-1 px-3 py-2 bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-accent)]/40 rounded-xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] text-sm focus:outline-none focus:ring-[var(--color-accent)] transition-shadow"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="p-2 bg-[var(--color-accent)] text-white rounded-xl hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <IoReloadOutline className="w-5 h-5 animate-spin" />
              ) : (
                <IoSendOutline className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </>,
    document.body
  )
}
