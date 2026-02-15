import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { preloadAllFonts } from '@/utils/fontLoader'
import { useTranslation } from 'react-i18next'
import {
  IoCheckmarkOutline,
  IoSyncOutline,
  IoAlertCircleOutline,
  IoTimeOutline,
  IoPeopleOutline,
  IoEllipsisHorizontal,
  IoRocketOutline,
  IoTrashOutline,
  IoChatbubbleOutline,
  IoTextOutline,
  IoInformationCircleOutline,
  IoCloseOutline,
  IoDownloadOutline,
} from 'react-icons/io5'
import type { NoteWithTags, Tag, NotePage } from '@onyka/shared'
import { useAutoSave } from '@/hooks'
import { useBreakpoint } from '@/hooks/useIsMobile'
import { useCollaboration } from '@/hooks/useCollaboration'
import { FluidEditor } from './FluidEditor'
import { PageTabs } from './PageTabs'
import { ShareDialog, TagInput, NoteComments, ExportDialog } from '@/components/features'
import { ThemeToggle } from '@/components/ui'
import { notesApi, sharesApi, pagesApi } from '@/services/api'
import { useTagsStore } from '@/stores/tags'
import { useFoldersStore } from '@/stores/folders'
import { useThemeStore, EDITOR_FONT_SIZES, EDITOR_FONT_FAMILIES } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { useCommentsStore } from '@/stores/comments'
import { usePagesStore } from '@/stores/pages'
import { WordCounter, countWords } from './WordCounter'
import { FocusTimer } from './FocusTimer'
import { formatNoteDate, formatTimeAgo } from '@/utils/format'

// Module-level cache for collaborator counts — avoids API call on every note switch
const _collabCountCache = new Map<string, number>()

interface NoteEditorProps {
  note: NoteWithTags
  onUpdate: (updates: { title?: string; content?: string }) => Promise<void>
  onDelete?: () => void
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

const STATUS_CONFIG: Record<SaveStatus, { icon: React.ReactNode; textKey: string; className: string }> = {
  saved: {
    icon: <IoCheckmarkOutline className="w-3.5 h-3.5" />,
    textKey: 'editor.saved',
    className: 'text-emerald-500 dark:text-emerald-400',
  },
  saving: {
    icon: <IoSyncOutline className="w-3.5 h-3.5 animate-spin" />,
    textKey: 'editor.saving',
    className: 'text-[var(--color-text-secondary)]',
  },
  unsaved: {
    icon: <IoTimeOutline className="w-3.5 h-3.5" />,
    textKey: 'editor.unsaved',
    className: 'text-[var(--color-text-secondary)]',
  },
  error: {
    icon: <IoAlertCircleOutline className="w-3.5 h-3.5" />,
    textKey: 'editor.save_error',
    className: 'text-[var(--color-error)]',
  },
}

export function NoteEditor({ note, onUpdate, onDelete }: NoteEditorProps) {
  const { t, i18n } = useTranslation()
  const breakpoint = useBreakpoint()
  const isCompact = breakpoint !== 'desktop' // mobile + tablet
  const [localTitle, setLocalTitle] = useState(note.title)
  const [localContent, setLocalContent] = useState(note.content)
  const [localTags, setLocalTags] = useState<Tag[]>(note.tags)
  const [lastModifiedAt, setLastModifiedAt] = useState<Date>(new Date(note.updatedAt))

  const titleInputRef = useRef<HTMLInputElement>(null)
  const isEditingRef = useRef(false)
  const lastSavedRef = useRef({ title: note.title, content: note.content })
  const pendingUpdatesRef = useRef<{ title?: string; content?: string }>({})
  const lastActivePageIdRef = useRef<string | null>(null)
  const savingContentRef = useRef<string | null>(null)
  const localContentRef = useRef(note.content)
  const localTitleRef = useRef(note.title)
  const wordCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showCommentsPanel, setShowCommentsPanel] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [showNoteInfo, setShowNoteInfo] = useState(false)
  const [collaboratorCount, setCollaboratorCount] = useState(0)
  const optionsMenuRef = useRef<HTMLDivElement>(null)

  const { createTag } = useTagsStore()
  const { fetchFolderTree } = useFoldersStore()
  const { focusMode, toggleFocusMode, editorFontSize, setEditorFontSize, editorFontFamily, setEditorFontFamily } = useThemeStore()
  const { user } = useAuthStore()
  const isOwner = user?.id === note.ownerId
  const { countsByNote, fetchCount } = useCommentsStore()
  const commentCount = countsByNote[note.id] || 0

  const {
    pagesByNote,
    activePageByNote,
    fetchPages,
    createPage,
    updatePage,
    deletePage,
    setActivePage,
    getActivePage,
  } = usePagesStore()

  const pagesForNote = pagesByNote[note.id] // undefined before fetch, [] if no pages
  const pagesLoaded = pagesForNote !== undefined
  const pages = pagesForNote || []
  const activePageId = activePageByNote[note.id] || ''
  const activePage = getActivePage(note.id)

  const [syncedPageState, setSyncedPageState] = useState<{ noteId: string; pageId: string | null }>({
    noteId: note.id,
    pageId: null,
  })
  if (note.id !== syncedPageState.noteId) {
    setSyncedPageState({ noteId: note.id, pageId: null })
  } else if (activePage && activePage.id !== syncedPageState.pageId) {
    setSyncedPageState({ noteId: note.id, pageId: activePage.id })
    setLocalContent(activePage.content)
    localContentRef.current = activePage.content
    lastSavedRef.current = { title: note.title, content: activePage.content }
    lastActivePageIdRef.current = activePage.id
  }

  useEffect(() => {
    fetchPages(note.id)
  }, [note.id, fetchPages])

  useEffect(() => {
    // Skip if count already cached — refreshes when comments panel opens
    if (useCommentsStore.getState().countsByNote[note.id] !== undefined) return
    fetchCount(note.id)
  }, [note.id, fetchCount])

  // Fetch collaborator count with module-level cache
  useEffect(() => {
    if (!isOwner) { setCollaboratorCount(0); return }
    const cached = _collabCountCache.get(note.id)
    if (cached !== undefined) {
      setCollaboratorCount(cached)
      return
    }
    sharesApi.getForResource('note', note.id)
      .then(({ collaborators }) => {
        _collabCountCache.set(note.id, collaborators.length)
        setCollaboratorCount(collaborators.length)
      })
      .catch(() => setCollaboratorCount(0))
  }, [note.id, isOwner])

  // Refresh collaborator count after share dialog closes (user may have changed shares)
  const prevShareDialogRef = useRef(false)
  useEffect(() => {
    if (prevShareDialogRef.current && !showShareDialog && isOwner) {
      sharesApi.getForResource('note', note.id)
        .then(({ collaborators }) => {
          _collabCountCache.set(note.id, collaborators.length)
          setCollaboratorCount(collaborators.length)
        })
        .catch(() => {})
    }
    prevShareDialogRef.current = showShareDialog
  }, [showShareDialog, note.id, isOwner])

  const isRemoteUpdateRef = useRef(false)

  // Only join collaboration room when the note is actually shared:
  // - Non-owners are viewing a shared note → always enable
  // - Owners → enable only when collaborators exist
  const collaborationEnabled = !isOwner || collaboratorCount > 0

  const { isConnected, users: collaborators, sendContentChange } = useCollaboration({
    noteId: note.id,
    enabled: collaborationEnabled,
    onContentUpdate: (update) => {
      isRemoteUpdateRef.current = true
      setLocalTitle(update.title)
      setLocalContent(update.content)
      localContentRef.current = update.content
      localTitleRef.current = update.title
      lastSavedRef.current = { title: update.title, content: update.content }
      // Reset after React processes the state update
      setTimeout(() => {
        isRemoteUpdateRef.current = false
      }, 50)
    },
  })
  const [showTypographyMenu, setShowTypographyMenu] = useState(false)
  const typographyMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalTitle(note.title)
    setLocalContent(note.content)
    localContentRef.current = note.content
    localTitleRef.current = note.title
    setLocalTags(note.tags)
    setLastModifiedAt(new Date(note.updatedAt))
    pendingUpdatesRef.current = {}
    isEditingRef.current = false
    lastActivePageIdRef.current = null
    savingContentRef.current = null
    lastSavedRef.current = { title: note.title, content: note.content }
    if (wordCountTimerRef.current) clearTimeout(wordCountTimerRef.current)
    // On mobile, focus title input for new notes so user can start typing immediately
    if (breakpoint === 'mobile' && !note.title) {
      requestAnimationFrame(() => titleInputRef.current?.focus())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  // Sync local content with active page (rollback-safe)
  useEffect(() => {
    if (activePage) {
      const isPageChange = lastActivePageIdRef.current !== activePage.id
      lastActivePageIdRef.current = activePage.id

      if (isPageChange) {
        setLocalContent(activePage.content)
        localContentRef.current = activePage.content
        lastSavedRef.current = { title: note.title, content: activePage.content }
        return
      }

      // Ignore echoed saves, in-flight content, or active edits
      if (activePage.content === lastSavedRef.current.content) return
      if (savingContentRef.current !== null && activePage.content === savingContentRef.current) return
      if (isEditingRef.current) return

      setLocalContent(activePage.content)
      localContentRef.current = activePage.content
      lastSavedRef.current = { title: note.title, content: activePage.content }
    } else {
      if (!pagesLoaded) return

      const isNoteChange = note.content !== lastSavedRef.current.content && !isEditingRef.current
      if (isNoteChange) {
        setLocalContent(note.content)
        localContentRef.current = note.content
        lastSavedRef.current = { title: note.title, content: note.content }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage?.id, activePage?.content, note.content, note.title, pagesLoaded])

  useEffect(() => {
    setLocalTags(note.tags)
  }, [note.tags])

  // Sync title from external changes (e.g. sidebar rename)
  useEffect(() => {
    if (!isEditingRef.current && note.title !== localTitle) {
      setLocalTitle(note.title)
      localTitleRef.current = note.title
      lastSavedRef.current.title = note.title
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.title])

  const handleSave = useCallback(async () => {
    const updates = { ...pendingUpdatesRef.current }
    if (Object.keys(updates).length === 0) return

    const contentToSave = updates.content
    if (contentToSave !== undefined) {
      savingContentRef.current = contentToSave
    }

    try {
      if (updates.title !== undefined) {
        await onUpdate({ title: updates.title })
        lastSavedRef.current.title = updates.title
      }

      if (contentToSave !== undefined && activePage) {
        await updatePage(activePage.id, { content: contentToSave })
        lastSavedRef.current.content = contentToSave
      } else if (contentToSave !== undefined) {
        await onUpdate({ content: contentToSave })
        lastSavedRef.current.content = contentToSave
      }

      pendingUpdatesRef.current = {}
      setLastModifiedAt(new Date())
    } finally {
      if (savingContentRef.current === contentToSave) savingContentRef.current = null
      if (!pendingUpdatesRef.current.content) {
        isEditingRef.current = false
      }
    }
  }, [onUpdate, activePage, updatePage])

  const { status, triggerSave, cancel: cancelAutoSave } = useAutoSave({
    onSave: handleSave,
    delay: 1200,
  })

  const handleTitleChange = (title: string) => {
    setLocalTitle(title)
    localTitleRef.current = title
    isEditingRef.current = true
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, title }
    triggerSave()
  }

  const handleContentChange = useCallback(
    (content: string) => {
      if (isRemoteUpdateRef.current) return
      localContentRef.current = content
      isEditingRef.current = true
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, content }
      sendContentChange(content, localTitleRef.current)
      triggerSave()

      // Debounced state update — avoids re-rendering NoteEditor on every keystroke
      if (wordCountTimerRef.current) clearTimeout(wordCountTimerRef.current)
      wordCountTimerRef.current = setTimeout(() => {
        setLocalContent(content)
      }, 500)
    },
    [triggerSave, sendContentChange]
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target as Node)) {
        setShowOptionsMenu(false)
      }
      if (typographyMenuRef.current && !typographyMenuRef.current.contains(e.target as Node)) {
        setShowTypographyMenu(false)
      }
    }
    if (showOptionsMenu || showTypographyMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOptionsMenu, showTypographyMenu])

  const handleAddTag = async (tagId: string) => {
    const { tags } = useTagsStore.getState()
    const tagToAdd = tags.find((t) => t.id === tagId)
    if (tagToAdd && !localTags.some((t) => t.id === tagId)) {
      try {
        await notesApi.addTag(note.id, tagId)
        setLocalTags((prev) => [...prev, tagToAdd])
        fetchFolderTree()
        useTagsStore.getState().fetchTags()
      } catch (err) {
        console.error('Failed to add tag:', err)
      }
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    try {
      await notesApi.removeTag(note.id, tagId)
      setLocalTags((prev) => prev.filter((t) => t.id !== tagId))
      fetchFolderTree()
      useTagsStore.getState().fetchTags()
    } catch (err) {
      console.error('Failed to remove tag:', err)
    }
  }

  const handleCreateTag = async (name: string): Promise<Tag> => {
    return await createTag({ name })
  }

  const handlePageCreate = async () => {
    // Flush pending content before switching pages
    if (pendingUpdatesRef.current.content && activePage) {
      const contentToSave = pendingUpdatesRef.current.content
      savingContentRef.current = contentToSave
      lastSavedRef.current.content = contentToSave
      pendingUpdatesRef.current = { title: pendingUpdatesRef.current.title }
      updatePage(activePage.id, { content: contentToSave }).finally(() => {
        if (savingContentRef.current === contentToSave) {
          savingContentRef.current = null
        }
      })
    }
    cancelAutoSave()
    isEditingRef.current = false

    // Migrate existing content to Page 1 if no pages yet
    if (pages.length === 0) {
      await createPage(note.id, {
        title: 'Page 1',
        content: localContentRef.current,
      }, false)
    }
    await createPage(note.id, undefined, true)
  }

  const handlePageDelete = async (pageId: string) => {
    await deletePage(note.id, pageId)
  }

  const handlePageRename = async (pageId: string, newTitle: string) => {
    await updatePage(pageId, { title: newTitle })
  }

  const handlePageReorder = async (reorderedPages: NotePage[]) => {
    for (let i = 0; i < reorderedPages.length; i++) {
      if (reorderedPages[i].position !== i) {
        await pagesApi.reorder(reorderedPages[i].id, i)
        await fetchPages(note.id)
        break
      }
    }
  }

  const handlePageChange = (pageId: string) => {
    // Flush pending content before switching
    if (pendingUpdatesRef.current.content && activePage) {
      const contentToSave = pendingUpdatesRef.current.content
      savingContentRef.current = contentToSave
      lastSavedRef.current.content = contentToSave
      pendingUpdatesRef.current = { title: pendingUpdatesRef.current.title }
      updatePage(activePage.id, { content: contentToSave }).finally(() => {
        if (savingContentRef.current === contentToSave) {
          savingContentRef.current = null
        }
      })
    }
    cancelAutoSave()
    isEditingRef.current = false
    setActivePage(note.id, pageId)
  }

  const statusConfig = STATUS_CONFIG[status]

  const displayWordCount = useMemo(() => countWords(localContent), [localContent])

  const currentFontFamily = EDITOR_FONT_FAMILIES.find(f => f.id === editorFontFamily)

  return (
    <div className="flex flex-col h-full relative z-10">
      <header className="px-4 md:px-8 pt-4 pb-2">
        <div className={`flex items-end justify-between ${isCompact ? 'gap-2' : 'gap-4'}`}>
          <div className="flex-1 min-w-0">
            <input
              ref={titleInputRef}
              type="text"
              placeholder={t('editor.untitled')}
              className="w-full text-2xl md:text-[26px] font-bold bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]/30 focus:outline-none tracking-[-0.025em] py-0.5 pl-8 md:pl-0 leading-tight"
              value={localTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
            {!focusMode && (
              <div className="flex items-center gap-2 mt-1.5 pl-8 md:pl-0 text-[11px] text-[var(--color-text-tertiary)] font-medium whitespace-nowrap overflow-hidden">
                <span>{formatNoteDate(note.createdAt, i18n.language)}</span>
                <span className="opacity-30">·</span>
                <span>{displayWordCount} {t('editor.info_words').toLowerCase()}</span>
                {!isCompact && (
                  <>
                    <span className="opacity-30">·</span>
                    <button
                      onClick={handlePageCreate}
                      className="hover:text-[var(--color-text-secondary)] transition-colors"
                      title={t('pages.add')}
                    >
                      + {t('pages.add')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <div
              className={`flex items-center gap-1 px-2 text-[11px] font-medium transition-all duration-300 ${statusConfig.className}`}
            >
              {statusConfig.icon}
            </div>

            {!focusMode && (
              <div className="relative" ref={typographyMenuRef}>
                {!isCompact && (
                  <button
                    onClick={() => { setShowTypographyMenu(!showTypographyMenu); preloadAllFonts() }}
                    className="flex items-center gap-1.5 h-8 px-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-all duration-150"
                    title={t('settings.typography') || 'Typography'}
                  >
                    <IoTextOutline className="w-4 h-4" />
                    <span className="text-[11px] font-medium opacity-70 hidden sm:inline">
                      {currentFontFamily?.name || 'Inter'}
                    </span>
                  </button>
                )}

                {showTypographyMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg py-2 z-50 min-w-[200px]">
                    <div className="px-3 pb-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        {t('settings.font_family')}
                      </span>
                    </div>
                    <div className="px-1.5 pb-2">
                      {EDITOR_FONT_FAMILIES.map(({ id, name, family }) => (
                        <button
                          key={id}
                          onClick={() => setEditorFontFamily(id)}
                          className={`w-full flex items-center gap-2 px-2.5 h-7 text-sm rounded-lg transition-colors ${
                            editorFontFamily === id
                              ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
                          }`}
                          style={{ fontFamily: family }}
                        >
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>

                    <div className="mx-2 my-1 border-t border-[var(--color-border-subtle)]" />

                    <div className="px-3 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        {t('settings.font_size')}
                      </span>
                    </div>
                    <div className="px-1.5 flex gap-1">
                      {EDITOR_FONT_SIZES.map(({ id, size }) => (
                        <button
                          key={id}
                          onClick={() => setEditorFontSize(id)}
                          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-lg transition-colors ${
                            editorFontSize === id
                              ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
                          }`}
                        >
                          <span className="text-xs font-medium">{id}</span>
                          <span className="text-[10px] opacity-60">{size}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {focusMode ? (
              <button
                onClick={toggleFocusMode}
                className="h-8 px-2.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all duration-150"
                title={t('editor.exit_focus')}
              >
                <IoRocketOutline className="w-4 h-4" style={{ transform: 'rotate(180deg)' }} />
              </button>
            ) : !isCompact ? (
              <button
                onClick={toggleFocusMode}
                className="h-8 px-2.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all duration-150"
                title={t('editor.focus_mode')}
              >
                <IoRocketOutline className="w-4 h-4" />
              </button>
            ) : null}

            {focusMode && <div className="ml-1"><ThemeToggle /></div>}

            {!focusMode && !isCompact && (
              <>
                <button
                  onClick={() => setShowCommentsPanel(true)}
                  className="relative h-8 px-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-all duration-150"
                  title={t('comments.title')}
                >
                  <IoChatbubbleOutline className="w-4 h-4" />
                  {commentCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-[10px] font-semibold text-white bg-[var(--color-accent)] rounded-full">
                      {commentCount > 99 ? '99+' : commentCount}
                    </span>
                  )}
                </button>

                {collaborators.length > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <div className="flex -space-x-2">
                      {collaborators.slice(0, 3).map((collab, i) => (
                        <div
                          key={collab.socketId}
                          className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center text-white text-[10px] font-medium border-2 border-[var(--color-bg-primary)]"
                          title={collab.name}
                          style={{ zIndex: 3 - i }}
                        >
                          {collab.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      ))}
                    </div>
                    {collaborators.length > 3 && (
                      <span className="text-xs text-green-600 font-medium">+{collaborators.length - 3}</span>
                    )}
                    <span className="text-xs text-green-600 font-medium">{t('share.permission_badge.edit')}</span>
                  </div>
                )}

                {!isConnected && collaborators.length === 0 && collaboratorCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 rounded-lg text-orange-500 text-xs">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span>{t('share.reconnecting', 'Reconnecting...')}</span>
                  </div>
                )}

                <button
                  onClick={() => setShowShareDialog(true)}
                  className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg transition-all duration-150 ${
                    collaboratorCount > 0
                      ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/15'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5'
                  }`}
                  title={t('share.title')}
                >
                  <IoPeopleOutline className="w-4 h-4" />
                  {collaboratorCount > 0 ? (
                    <span className="text-xs font-medium">{collaboratorCount}</span>
                  ) : (
                    <span className="text-xs font-medium hidden sm:inline">{t('share.title')}</span>
                  )}
                </button>
              </>
            )}

            {!focusMode && (
              <div className="relative" ref={optionsMenuRef}>
                <button
                  onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                  className="h-8 px-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-all duration-150"
                  title={t('common.more_options')}
                >
                  <IoEllipsisHorizontal className="w-4 h-4" />
                </button>

                {showOptionsMenu && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-50">
                    {isCompact && (
                      <>
                        <button
                          onClick={() => {
                            setShowOptionsMenu(false)
                            setShowCommentsPanel(true)
                          }}
                          className="w-full flex items-center gap-2 px-3 h-9 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <IoChatbubbleOutline className="w-4 h-4" />
                          <span>{t('comments.title')}</span>
                          {commentCount > 0 && (
                            <span className="ml-auto text-[10px] font-semibold text-white bg-[var(--color-accent)] rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                              {commentCount > 99 ? '99+' : commentCount}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setShowOptionsMenu(false)
                            setShowShareDialog(true)
                          }}
                          className="w-full flex items-center gap-2 px-3 h-9 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <IoPeopleOutline className="w-4 h-4" />
                          <span>{t('share.title')}</span>
                          {collaboratorCount > 0 && (
                            <span className="ml-auto text-xs font-medium text-[var(--color-accent)]">{collaboratorCount}</span>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setShowOptionsMenu(false)
                            handlePageCreate()
                          }}
                          className="w-full flex items-center gap-2 px-3 h-9 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <IoTextOutline className="w-4 h-4" />
                          <span>{t('pages.add')}</span>
                        </button>
                        <div className="my-1 border-t border-[var(--color-border)]" />
                        <button
                          onClick={() => {
                            setShowOptionsMenu(false)
                            toggleFocusMode()
                          }}
                          className="w-full flex items-center gap-2 px-3 h-9 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <IoRocketOutline className="w-4 h-4" />
                          <span>{t('editor.focus_mode')}</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowOptionsMenu(false)
                            setShowTypographyMenu(true)
                          }}
                          className="w-full flex items-center gap-2 px-3 h-9 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <IoTextOutline className="w-4 h-4" />
                          <span>{currentFontFamily?.name || 'Inter'} · {editorFontSize.toUpperCase()}</span>
                        </button>
                        <div className="my-1 border-t border-[var(--color-border)]" />
                      </>
                    )}
                    <button
                      onClick={() => {
                        setShowOptionsMenu(false)
                        setShowNoteInfo(!showNoteInfo)
                      }}
                      className="w-full flex items-center gap-2 px-3 h-8 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <IoInformationCircleOutline className="w-4 h-4" />
                      <span>{t('editor.note_info')}</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowOptionsMenu(false)
                        setShowExportDialog(true)
                      }}
                      className="w-full flex items-center gap-2 px-3 h-8 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <IoDownloadOutline className="w-4 h-4" />
                      <span>{t('export.title')}</span>
                    </button>

                    {onDelete && (
                      <>
                        <div className="my-1 border-t border-[var(--color-border)]" />
                        <button
                          onClick={() => {
                            setShowOptionsMenu(false)
                            onDelete()
                          }}
                          className="w-full flex items-center gap-2 px-3 h-8 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-error)]/15 hover:text-[var(--color-error)] transition-colors rounded-sm"
                        >
                          <IoTrashOutline className="w-4 h-4" />
                          <span>{t('common.delete')}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {focusMode && (
          <div className="mt-3 flex items-center justify-between">
            <FocusTimer />
            <WordCounter content={localContent} />
          </div>
        )}
      </header>

      <div className="mx-4 md:mx-8 h-px bg-gradient-to-r from-[var(--color-border-subtle)] to-transparent opacity-40" />

      {pages.length > 1 && (
        <PageTabs
          noteId={note.id}
          pages={pages}
          activePageId={activePageId}
          onPageChange={handlePageChange}
          onPageDelete={handlePageDelete}
          onPageRename={handlePageRename}
          onPageReorder={handlePageReorder}
        />
      )}

      <div className="editor-writing-surface flex-1 overflow-auto px-4 md:px-8 pt-3 pb-4">
        <FluidEditor
          key={`${note.id}-${activePageId}`}
          content={localContent}
          onChange={handleContentChange}
          placeholder={t('editor.placeholder')}
        />
      </div>

      {showNoteInfo && (
        <div className="flex justify-end px-6 mb-1">
          <div className="inline-flex items-center gap-3 px-3 py-1.5 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-secondary)]">
            <span>{t('editor.info_created')} <span className="text-[var(--color-text-primary)]">{formatNoteDate(note.createdAt, i18n.language)}</span></span>
            <span className="opacity-30">·</span>
            <span>{t('editor.info_modified')} <span className="text-[var(--color-text-primary)]">{formatNoteDate(lastModifiedAt.toISOString(), i18n.language)}</span></span>
            <span className="opacity-30">·</span>
            <span><span className="text-[var(--color-text-primary)]">{displayWordCount}</span> {t('editor.info_words').toLowerCase()}</span>
            <span className="opacity-30">·</span>
            <span><span className="text-[var(--color-text-primary)]">{pages.length}</span> {t('editor.info_pages').toLowerCase()}</span>
            <span className="opacity-30">·</span>
            <span><span className="text-[var(--color-text-primary)]">{localTags.length}</span> {t('editor.info_tags').toLowerCase()}</span>
            <button
              onClick={() => setShowNoteInfo(false)}
              className="ml-1 p-0.5 hover:bg-[var(--color-bg-secondary)] rounded transition-colors"
            >
              <IoCloseOutline className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 md:px-8 py-1.5">
        <div className="flex-1 min-w-0">
          <TagInput
            selectedTags={localTags}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onCreateTag={handleCreateTag}
          />
        </div>
        {!focusMode && (
          <div className="flex-shrink-0 text-[11px] text-[var(--color-text-tertiary)] pr-2">
            <span className="whitespace-nowrap">{t('editor.modified_ago', { time: formatTimeAgo(lastModifiedAt, t) })}</span>
          </div>
        )}
      </div>

      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        resourceId={note.id}
        resourceType="note"
        resourceTitle={localTitle}
      />

      <NoteComments
        noteId={note.id}
        isOwner={isOwner}
        isOpen={showCommentsPanel}
        onClose={() => setShowCommentsPanel(false)}
      />

      <ExportDialog
        type="note"
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        noteId={note.id}
        title={localTitle}
      />
    </div>
  )
}
