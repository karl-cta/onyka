import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IoCloseOutline, IoPinOutline, IoPinSharp, IoTrashOutline, IoDocumentTextOutline, IoPencilOutline, IoCheckmarkOutline, IoTimerOutline } from 'react-icons/io5'
import { SparkIcon } from '@/components/ui'
import { useSparksStore } from '@/stores/sparks'
import { useFoldersStore } from '@/stores/folders'
import { useIsMobile } from '@/hooks'
import { ConvertToNoteModal } from './ConvertToNoteModal'
import { formatTimeAgo, formatTimeLeft } from '@/utils/format'
import type { Spark } from '@onyka/shared'

const MAX_PINNED = 5

interface SparkCardProps {
  spark: Spark
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onConvert: (spark: Spark) => void
  onEdit: (id: string, content: string) => void
  canPin: boolean
  isRemoving?: boolean
  isMobile?: boolean
}

function SparkCard({ spark, onTogglePin, onDelete, onConvert, onEdit, canPin, isRemoving, isMobile }: SparkCardProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(spark.content)
  const [showParticles, setShowParticles] = useState(false)
  const [pinAnimating, setPinAnimating] = useState<'pin' | 'unpin' | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    setEditContent(spark.content)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setEditContent(spark.content)
    setIsEditing(false)
  }

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent.trim() !== spark.content) {
      onEdit(spark.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    }
    if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const timeAgo = formatTimeAgo(spark.createdAt, t)
  const expiresIn = spark.expiresAt ? formatTimeLeft(spark.expiresAt, t) : null

  const handlePinClick = () => {
    setPinAnimating(spark.isPinned ? 'unpin' : 'pin')
    onTogglePin(spark.id)
    setTimeout(() => setPinAnimating(null), 600)
  }

  const handleDeleteClick = () => {
    setShowParticles(true)
    onDelete(spark.id)
  }

  return (
    <div
      className={`
        group relative px-4 py-3 rounded-xl border spark-card-hover
        bg-[var(--color-bg-elevated)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50
        ${isRemoving ? 'animate-spark-exit' : ''}
      `}
    >
      {showParticles && (
        <div className="spark-particles">
          <div className="particle particle-1" />
          <div className="particle particle-2" />
          <div className="particle particle-3" />
          <div className="particle particle-4" />
          <div className="particle particle-5" />
          <div className="particle particle-6" />
        </div>
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-[var(--color-bg-primary)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none focus:outline-none ring-1 ring-[var(--color-accent)]/40 focus:ring-[var(--color-accent)] min-h-[60px] transition-shadow"
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editContent.trim()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
                >
                  <IoCheckmarkOutline className="w-3.5 h-3.5" />
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed cursor-pointer hover:text-[var(--color-accent)] transition-colors"
              onClick={handleStartEdit}
              title={t('sparks.click_to_edit')}
            >
              {spark.content}
            </p>
          )}
        </div>
      </div>

      {!isEditing && (
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {timeAgo}
            </span>
            {spark.isPinned && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-white text-xs font-semibold shadow-sm">
                <IoPinSharp className="w-3 h-3" />
                {t('sparks.pinned')}
              </span>
            )}
            {expiresIn && !spark.isPinned && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-medium">
                <IoTimerOutline className="w-3 h-3" />
                {expiresIn}
              </span>
            )}
          </div>

          <div className={`flex items-center gap-0.5 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              onClick={handleStartEdit}
              className={`${isMobile ? 'p-2.5' : 'p-1.5'} rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors`}
              title={t('sparks.edit')}
              aria-label={t('sparks.edit')}
            >
              <IoPencilOutline className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
            </button>

            <button
              onClick={() => onConvert(spark)}
              className={`${isMobile ? 'p-2.5' : 'p-1.5'} rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all active:scale-95`}
              title={t('sparks.convert_to_note')}
              aria-label={t('sparks.convert_to_note')}
            >
              <IoDocumentTextOutline className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} transition-transform`} />
            </button>

            <button
              onClick={handlePinClick}
              disabled={!spark.isPinned && !canPin}
              className={`
                ${isMobile ? 'p-2.5' : 'p-1.5'} rounded-md transition-all
                ${spark.isPinned
                  ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
                  : canPin
                    ? 'text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
                    : 'text-[var(--color-text-tertiary)] cursor-not-allowed opacity-50'
                }
              `}
              title={spark.isPinned ? t('sparks.unpin') : canPin ? t('sparks.pin') : t('sparks.max_pins_reached')}
              aria-label={spark.isPinned ? t('sparks.unpin') : canPin ? t('sparks.pin') : t('sparks.max_pins_reached')}
            >
              {spark.isPinned ? (
                <IoPinSharp className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} transition-transform ${pinAnimating === 'pin' ? 'animate-pin-bounce' : ''} ${pinAnimating === 'unpin' ? 'animate-pin-deactivate' : ''}`} />
              ) : (
                <IoPinOutline className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} transition-transform ${pinAnimating === 'pin' ? 'animate-pin-bounce' : ''} ${pinAnimating === 'unpin' ? 'animate-pin-deactivate' : ''}`} />
              )}
            </button>

            <button
              onClick={handleDeleteClick}
              className={`${isMobile ? 'p-2.5' : 'p-1.5'} rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-all active:scale-90`}
              title={t('sparks.delete')}
              aria-label={t('sparks.delete')}
            >
              <IoTrashOutline className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} transition-transform`} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SparksDrawer() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const panelRef = useRef<HTMLDivElement>(null)

  const {
    pinned,
    temporary,
    permanent,
    isLoading,
    error,
    isDrawerOpen,
    fetchSparks,
    updateSpark,
    togglePin,
    deleteSpark,
    convertToNote,
    clearError,
    closeDrawer,
  } = useSparksStore()
  const { fetchFolderTree, folderTree } = useFoldersStore()

  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [convertModal, setConvertModal] = useState<{
    isOpen: boolean
    spark: Spark | null
  }>({ isOpen: false, spark: null })

  useEffect(() => {
    if (!isDrawerOpen) {
      setConvertModal({ isOpen: false, spark: null })
    }
  }, [isDrawerOpen])

  useEffect(() => {
    if (isDrawerOpen) {
      fetchSparks()
      fetchFolderTree()
    }
  }, [isDrawerOpen, fetchSparks, fetchFolderTree])

  useEffect(() => {
    if (!isDrawerOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !convertModal.isOpen) {
        closeDrawer()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isDrawerOpen, closeDrawer, convertModal.isOpen])

  const canPin = pinned.length < MAX_PINNED
  const allSparks = [...pinned, ...temporary, ...permanent]

  const handleEdit = useCallback(async (id: string, newContent: string) => {
    try {
      await updateSpark(id, newContent)
    } catch {
      // Error handled in store
    }
  }, [updateSpark])

  const handleTogglePin = useCallback(async (id: string) => {
    try {
      await togglePin(id)
    } catch {
      // Error handled in store
    }
  }, [togglePin])

  const handleDelete = useCallback(async (id: string) => {
    setRemovingIds((prev) => new Set(prev).add(id))
    setTimeout(async () => {
      try {
        await deleteSpark(id)
      } finally {
        setRemovingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    }, 250)
  }, [deleteSpark])

  const handleOpenConvertModal = useCallback((spark: Spark) => {
    setConvertModal({ isOpen: true, spark })
  }, [])

  const handleConvert = useCallback(
    async (options: { title: string; folderId: string | null }) => {
      if (!convertModal.spark) return
      try {
        await convertToNote(convertModal.spark.id, options)
        setConvertModal({ isOpen: false, spark: null })
        await fetchFolderTree()
      } catch {
        // Error handled in store
      }
    },
    [convertModal.spark, convertToNote, fetchFolderTree]
  )

  if (!isDrawerOpen) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={closeDrawer}
      />

      {/* Centering container */}
      <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
        {/* Panel */}
        <div
          ref={panelRef}
          className="pointer-events-auto flex flex-col overflow-hidden w-full max-w-[520px] max-h-[75vh] rounded-2xl spark-panel animate-spark-drawer-open"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] spark-panel-header">
            <div className="flex items-center gap-3">
              <div className="spark-header-icon">
                <SparkIcon className="w-5 h-5 text-[var(--color-accent)]" animated />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {t('sparks.title')}
                </h2>
                {allSparks.length > 0 && (
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {allSparks.length} {allSparks.length === 1 ? 'spark' : 'sparks'}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={closeDrawer}
              aria-label={t('common.close')}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mt-3 p-2.5 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)] text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} aria-label={t('common.close')} className="p-1 hover:bg-[var(--color-error)]/20 rounded">
                <IoCloseOutline className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Spark list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none min-h-0">
            {isLoading && allSparks.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-3 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : allSparks.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5 flex items-center justify-center animate-spark-float-idle">
                  <SparkIcon className="w-8 h-8 text-[var(--color-accent)]" />
                </div>
                <p className="text-base font-medium text-[var(--color-text-primary)] mb-2 animate-fade-in">
                  {t('sparks.empty_title')}
                </p>
                <p className="text-sm text-[var(--color-text-tertiary)] max-w-[280px] mx-auto animate-fade-in" style={{ animationDelay: '0.1s' }}>
                  {t('sparks.empty_message')}
                </p>
              </div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider px-1">
                      <IoPinSharp className="w-3.5 h-3.5" />
                      {t('sparks.pinned_section')} ({pinned.length}/{MAX_PINNED})
                    </div>
                    {pinned.map((spark) => (
                      <SparkCard
                        key={spark.id}
                        spark={spark}
                        onTogglePin={handleTogglePin}
                        onDelete={handleDelete}
                        onConvert={handleOpenConvertModal}
                        onEdit={handleEdit}
                        canPin={canPin}
                        isRemoving={removingIds.has(spark.id)}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                )}

                {temporary.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1">
                      <IoTimerOutline className="w-3.5 h-3.5" />
                      {t('sparks.expires')}
                    </div>
                    {temporary.map((spark) => (
                      <SparkCard
                        key={spark.id}
                        spark={spark}
                        onTogglePin={handleTogglePin}
                        onDelete={handleDelete}
                        onConvert={handleOpenConvertModal}
                        onEdit={handleEdit}
                        canPin={canPin}
                        isRemoving={removingIds.has(spark.id)}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                )}

                {permanent.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider px-1">
                      <SparkIcon className="w-3.5 h-3.5" />
                      {t('sparks.sparks_section')}
                    </div>
                    {permanent.map((spark) => (
                      <SparkCard
                        key={spark.id}
                        spark={spark}
                        onTogglePin={handleTogglePin}
                        onDelete={handleDelete}
                        onConvert={handleOpenConvertModal}
                        onEdit={handleEdit}
                        canPin={canPin}
                        isRemoving={removingIds.has(spark.id)}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ConvertToNoteModal
        isOpen={convertModal.isOpen}
        spark={convertModal.spark}
        folders={folderTree}
        onClose={() => setConvertModal({ isOpen: false, spark: null })}
        onConvert={handleConvert}
      />
    </>,
    document.body
  )
}
