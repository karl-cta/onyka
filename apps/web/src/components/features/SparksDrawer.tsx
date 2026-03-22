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
import type { Spark, ExpirationOption } from '@onyka/shared'

const EXPIRATION_OPTIONS: { value: ExpirationOption; labelKey: string }[] = [
  { value: 'none', labelKey: 'sparks.expiration_options.none' },
  { value: '1h', labelKey: 'sparks.expiration_options.1h' },
  { value: '24h', labelKey: 'sparks.expiration_options.24h' },
  { value: '7d', labelKey: 'sparks.expiration_options.7d' },
  { value: '30d', labelKey: 'sparks.expiration_options.30d' },
]

const MAX_PINNED = 5

interface SparkCardProps {
  spark: Spark
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onConvert: (spark: Spark) => void
  onEdit: (id: string, content: string) => void
  onChangeExpiration: (id: string, expiration: ExpirationOption) => void
  canPin: boolean
  isRemoving?: boolean
  isNew?: boolean
  isMobile?: boolean
}

function SparkCard({ spark, onTogglePin, onDelete, onConvert, onEdit, onChangeExpiration, canPin, isRemoving, isNew, isMobile }: SparkCardProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(spark.content)
  const [showExpMenu, setShowExpMenu] = useState(false)
  const [expMenuPos, setExpMenuPos] = useState({ top: 0, left: 0 })
  const expBtnRef = useRef<HTMLButtonElement>(null)
  const expMenuRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  // Close expiration menu on click outside
  useEffect(() => {
    if (!showExpMenu) return
    const handleClick = (e: MouseEvent) => {
      if (expBtnRef.current?.contains(e.target as Node)) return
      if (expMenuRef.current?.contains(e.target as Node)) return
      setShowExpMenu(false)
    }
    const tid = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', handleClick) }
  }, [showExpMenu])

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
    if (e.key === 'Escape') handleCancelEdit()
  }

  const timeAgo = formatTimeAgo(spark.createdAt, t)
  const expiresIn = spark.expiresAt ? formatTimeLeft(spark.expiresAt, t) : null

  return (
    <div
      className={`
        group relative rounded-xl transition-all duration-200
        bg-[var(--color-bg-elevated)] border border-[var(--color-border)]
        hover:border-[var(--color-border-strong,var(--color-border))]
        hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)]
        ${isRemoving ? 'animate-spark-exit' : ''}
        ${isNew ? 'spark-card-new' : ''}
      `}
    >
      {/* Content */}
      <div className="px-4 pt-3.5 pb-3">
        {isEditing ? (
          <div className="space-y-2.5">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-[var(--color-bg-primary)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none focus:outline-none ring-1 ring-[var(--color-accent)]/40 focus:ring-[var(--color-accent)] min-h-[56px] transition-shadow leading-relaxed"
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
            className="text-[13px] text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed cursor-pointer"
            onClick={handleStartEdit}
          >
            {spark.content}
          </p>
        )}
      </div>

      {/* Footer — metadata left, actions right */}
      {!isEditing && (
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              {timeAgo}
            </span>
            {expiresIn && !spark.isPinned && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <IoTimerOutline className="w-3 h-3" />
                {expiresIn}
              </span>
            )}
          </div>

          <div className={`flex items-center gap-0.5 transition-opacity duration-150 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              onClick={handleStartEdit}
              className={`${isMobile ? 'p-2' : 'p-1.5'} rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors`}
              title={t('sparks.edit')}
              aria-label={t('sparks.edit')}
            >
              <IoPencilOutline className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onConvert(spark)}
              className={`${isMobile ? 'p-2' : 'p-1.5'} rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors`}
              title={t('sparks.convert_to_note')}
              aria-label={t('sparks.convert_to_note')}
            >
              <IoDocumentTextOutline className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => { onTogglePin(spark.id) }}
              disabled={!spark.isPinned && !canPin}
              className={`
                ${isMobile ? 'p-2' : 'p-1.5'} rounded-md transition-colors
                ${spark.isPinned
                  ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
                  : canPin
                    ? 'text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
                    : 'text-[var(--color-text-tertiary)] cursor-not-allowed opacity-40'
                }
              `}
              title={spark.isPinned ? t('sparks.unpin') : canPin ? t('sparks.pin') : t('sparks.max_pins_reached')}
              aria-label={spark.isPinned ? t('sparks.unpin') : canPin ? t('sparks.pin') : t('sparks.max_pins_reached')}
            >
              {spark.isPinned ? (
                <IoPinSharp className="w-3.5 h-3.5" />
              ) : (
                <IoPinOutline className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              ref={expBtnRef}
              onClick={() => {
                if (!showExpMenu && expBtnRef.current) {
                  const rect = expBtnRef.current.getBoundingClientRect()
                  setExpMenuPos({
                    top: rect.top - 4,
                    left: rect.right,
                  })
                }
                setShowExpMenu(!showExpMenu)
              }}
              className={`${isMobile ? 'p-2' : 'p-1.5'} rounded-md transition-colors ${
                spark.expiresAt
                  ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
              title={t('sparks.expiration')}
              aria-label={t('sparks.expiration')}
            >
              <IoTimerOutline className="w-3.5 h-3.5" />
            </button>
            {showExpMenu && createPortal(
              <div
                ref={expMenuRef}
                className="fixed py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-2xl z-[200] min-w-[130px]"
                style={{
                  top: expMenuPos.top,
                  left: expMenuPos.left + 8,
                  transform: 'translateY(-100%)',
                }}
              >
                {EXPIRATION_OPTIONS.map((opt) => {
                  const isActive = opt.value === 'none' ? !spark.expiresAt : false
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        onChangeExpiration(spark.id, opt.value)
                        setShowExpMenu(false)
                      }}
                      className={`block w-full text-left px-3.5 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                        isActive ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  )
                })}
              </div>,
              document.body
            )}

            <button
              onClick={() => onDelete(spark.id)}
              className={`${isMobile ? 'p-2' : 'p-1.5'} rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors`}
              title={t('sparks.delete')}
              aria-label={t('sparks.delete')}
            >
              <IoTrashOutline className="w-3.5 h-3.5" />
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
    createSpark,
    updateSpark,
    togglePin,
    deleteSpark,
    convertToNote,
    clearError,
    closeDrawer,
  } = useSparksStore()
  const { fetchFolderTree, folderTree } = useFoldersStore()

  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [newSparkIds, setNewSparkIds] = useState<Set<string>>(new Set())
  const [composeContent, setComposeContent] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const composeRef = useRef<HTMLTextAreaElement>(null)
  const [convertModal, setConvertModal] = useState<{
    isOpen: boolean
    spark: Spark | null
  }>({ isOpen: false, spark: null })

  useEffect(() => {
    if (!isDrawerOpen) {
      setConvertModal({ isOpen: false, spark: null })
      setComposeContent('')
      setNewSparkIds(new Set())
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

  const handleCompose = useCallback(async () => {
    if (!composeContent.trim() || isComposing) return
    setIsComposing(true)
    try {
      const spark = await createSpark(composeContent.trim())
      setComposeContent('')
      if (composeRef.current) {
        composeRef.current.style.height = 'auto'
      }
      // Mark as new for entrance animation
      setNewSparkIds(prev => new Set(prev).add(spark.id))
      setTimeout(() => {
        setNewSparkIds(prev => {
          const next = new Set(prev)
          next.delete(spark.id)
          return next
        })
      }, 400)
    } finally {
      setIsComposing(false)
    }
  }, [composeContent, isComposing, createSpark])

  const handleComposeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleCompose()
      }
    },
    [handleCompose]
  )

  const handleEdit = useCallback(async (id: string, newContent: string) => {
    try {
      await updateSpark(id, { content: newContent })
    } catch {
      // Error handled in store
    }
  }, [updateSpark])

  const handleChangeExpiration = useCallback(async (id: string, expiration: ExpirationOption) => {
    try {
      await updateSpark(id, { expiration })
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

  const renderSection = (sparks: Spark[], label: string, icon: React.ReactNode) => {
    if (sparks.length === 0) return null
    return (
      <div>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3 px-0.5">
          {icon}
          <span>{label}</span>
        </div>
        <div className="space-y-2">
          {sparks.map((spark) => (
            <SparkCard
              key={spark.id}
              spark={spark}
              onTogglePin={handleTogglePin}
              onDelete={handleDelete}
              onConvert={handleOpenConvertModal}
              onEdit={handleEdit}
              onChangeExpiration={handleChangeExpiration}
              canPin={canPin}
              isRemoving={removingIds.has(spark.id)}
              isNew={newSparkIds.has(spark.id)}
              isMobile={isMobile}
            />
          ))}
        </div>
      </div>
    )
  }

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
          className="pointer-events-auto flex flex-col overflow-hidden w-full max-w-[500px] max-h-[70vh] rounded-2xl spark-panel spark-drawer-enter"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2.5">
              <SparkIcon className="w-[18px] h-[18px] text-[var(--color-accent)]" />
              <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                {t('sparks.title')}
              </h2>
              {allSparks.length > 0 && (
                <span className="text-xs text-[var(--color-text-tertiary)] tabular-nums">
                  {allSparks.length}
                </span>
              )}
            </div>
            <button
              onClick={closeDrawer}
              aria-label={t('common.close')}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <IoCloseOutline className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Inline compose */}
          <div className="px-5 pb-4">
            <div className="flex items-end gap-2">
              <textarea
                ref={composeRef}
                value={composeContent}
                onChange={(e) => {
                  setComposeContent(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`
                }}
                onKeyDown={handleComposeKeyDown}
                placeholder={t('sparks.input_placeholder')}
                className="flex-1 min-w-0 bg-[var(--color-bg-primary)] rounded-xl px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] resize-none focus:outline-none border border-[var(--color-border)] focus:border-[var(--color-accent)]/40 min-h-[38px] max-h-[80px] leading-relaxed transition-colors"
                rows={1}
                maxLength={2000}
              />
              <button
                onClick={handleCompose}
                disabled={!composeContent.trim() || isComposing}
                className={`h-[38px] w-[38px] flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-150 ${
                  composeContent.trim()
                    ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-sm active:scale-95'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                }`}
                title={t('sparks.send')}
                aria-label={t('sparks.send')}
              >
                <SparkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-5 mb-3 p-2.5 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} aria-label={t('common.close')} className="p-1 hover:bg-[var(--color-error)]/20 rounded">
                <IoCloseOutline className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="mx-5 border-t border-[var(--color-border)]" />

          {/* Spark list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-none min-h-0">
            {isLoading && allSparks.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : allSparks.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                  <SparkIcon className="w-6 h-6 text-[var(--color-text-tertiary)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  {t('sparks.empty_title')}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] max-w-[240px] mx-auto leading-relaxed">
                  {t('sparks.empty_message')}
                </p>
              </div>
            ) : (
              <>
                {renderSection(
                  pinned,
                  `${t('sparks.pinned_section')} ${pinned.length}/${MAX_PINNED}`,
                  <IoPinSharp className="w-3 h-3 text-[var(--color-accent)]" />
                )}
                {renderSection(
                  temporary,
                  t('sparks.expires'),
                  <IoTimerOutline className="w-3 h-3 text-amber-500" />
                )}
                {renderSection(
                  permanent,
                  t('sparks.sparks_section'),
                  <SparkIcon className="w-3 h-3" />
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
