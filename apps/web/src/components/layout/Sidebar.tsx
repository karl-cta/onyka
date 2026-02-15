import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { OnykaLogo } from '@/components/ui/OnykaLogo'
import { useTranslation } from 'react-i18next'
import {
  IoSearchOutline,
  IoFolderOpenOutline,
  IoSettingsOutline,
  IoLogOutOutline,
  IoChevronForward,
  IoChevronBack,
  IoChevronDown,
  IoCloseOutline,
  IoMenuOutline,
  IoAddOutline,
  IoPricetagOutline,
  IoShieldOutline,
} from 'react-icons/io5'
import { Link } from 'react-router-dom'
import { DndContext, DragOverlay, pointerWithin, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { ThemeToggle, AccentColorPicker, SparkIcon } from '@/components/ui'
import { ConfirmDialog, SettingsModal, ProfileEditModal } from '@/components/features'
import { useAuthStore } from '@/stores/auth'
import { useFoldersStore } from '@/stores/folders'
import { useTagsStore } from '@/stores/tags'
import type { TagFilterMode } from '@/stores/tags'
import { useNotesStore } from '@/stores/notes'
import { useThemeStore } from '@/stores/theme'
import { useSparksStore } from '@/stores/sparks'
import { useSharesStore } from '@/stores/shares'
import type { FolderTreeItem } from '@/services/api'
import type { FolderNote } from '@onyka/shared'

import {
  useSidebarDnd,
  SortableFolderItem,
  SortableNoteItem,
  DragOverlayContent,
  SharedWithMeSection,
  SelectionActionBar,
  sortItemsAlphabetically,
  makeDragId,
  ROOT_DROP_ID,
} from './sidebar/index'
import { getAvatarRingClass } from '@/utils/avatar'
import { useIsMobile } from '@/hooks'

function filterNotesByTags(
  notes: FolderNote[],
  selectedTagIds: string[],
  excludedTagIds: string[],
  filterMode: TagFilterMode
): FolderNote[] {
  const hasInclude = selectedTagIds.length > 0
  const hasExclude = excludedTagIds.length > 0
  if (!hasInclude && !hasExclude) return notes
  return notes.filter((note) => {
    // Excluded tags: note must NOT have any of them
    if (hasExclude && excludedTagIds.some((tagId) => note.tagIds.includes(tagId))) {
      return false
    }
    // Included tags
    if (!hasInclude) return true
    if (filterMode === 'and') {
      return selectedTagIds.every((tagId) => note.tagIds.includes(tagId))
    }
    // 'or' mode
    return selectedTagIds.some((tagId) => note.tagIds.includes(tagId))
  })
}

function filterFolderTree(
  folders: FolderTreeItem[],
  selectedTagIds: string[],
  excludedTagIds: string[],
  filterMode: TagFilterMode
): FolderTreeItem[] {
  if (selectedTagIds.length === 0 && excludedTagIds.length === 0) return folders

  return folders
    .map((folder) => {
      const filteredNotes = filterNotesByTags(folder.notes, selectedTagIds, excludedTagIds, filterMode)
      const filteredChildren = filterFolderTree(folder.children, selectedTagIds, excludedTagIds, filterMode)
      const hasMatchingContent = filteredNotes.length > 0 || filteredChildren.length > 0

      if (!hasMatchingContent) return null

      return {
        ...folder,
        notes: filteredNotes,
        children: filteredChildren,
        noteCount: filteredNotes.length,
      }
    })
    .filter((f): f is FolderTreeItem => f !== null)
}

function RootDropZone({ isDragging, isActive }: { isDragging: boolean; isActive: boolean }) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({
    id: ROOT_DROP_ID,
  })

  if (!isDragging) return null

  return (
    <div
      ref={setNodeRef}
      className={`
        mx-2 mt-2 p-3 rounded-lg border-2 border-dashed
        flex items-center justify-center gap-2
        text-sm transition-all duration-200
        ${isActive || isOver
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
          : 'border-[var(--color-border)] text-[var(--color-text-tertiary)]'
        }
      `}
    >
      <IoFolderOpenOutline className="w-4 h-4" />
      <span>{t('sidebar.move_to_root', 'Déplacer à la racine')}</span>
    </div>
  )
}

interface SidebarProps {
  onOpenSearch: () => void
  onSelectNote: (noteId: string) => void
  selectedNoteId: string | null
}

export function MobileHeader({ onOpenSidebar, onOpenSearch }: { onOpenSidebar: () => void; onOpenSearch: () => void }) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 px-3 flex items-center justify-between bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-subtle)]">
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSidebar}
          className="p-2.5 -ml-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-xl transition-all active:scale-95"
          aria-label="Open sidebar menu"
        >
          <IoMenuOutline className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <OnykaLogo className="w-6 h-6 logo-glow" />
          <span className="text-base font-semibold text-[var(--color-text-primary)]">Onyka</span>
        </div>
      </div>

      <button
        onClick={onOpenSearch}
        className="p-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-xl transition-all active:scale-95"
        aria-label="Search"
      >
        <IoSearchOutline className="w-5 h-5" />
      </button>
    </header>
  )
}

export function Sidebar({ onOpenSearch, onSelectNote, selectedNoteId }: SidebarProps) {
  const { t } = useTranslation()
  const { logout, user } = useAuthStore()
  const {
    createNote,
    deleteNote,
    deleteMultipleNotes,
    updateNote,
    selectedNoteIds,
    toggleNoteSelection,
    clearNoteSelection,
  } = useNotesStore()
  const {
    folderTree,
    rootNotes,
    isLoading: isFoldersLoading,
    fetchFolderTree,
    expandedFolders,
    toggleFolderExpanded,
    createFolder,
    updateFolder,
    deleteFolder,
    deleteMultipleFolders,
    moveNoteToFolder,
    selectedFolderIds,
    toggleFolderSelection,
    clearFolderSelection,
  } = useFoldersStore()
  const { sidebarCollapsed, toggleSidebar, sidebarWidth, setSidebarWidth, tagsCollapsed, toggleTagsCollapsed, tagsSectionHeight, setTagsSectionHeight, mobileSidebarOpen, closeMobileSidebar } = useThemeStore()
  const { openQuickAdd, fetchStats } = useSparksStore()
  const { fetchMyShares } = useSharesStore()
  const isMobile = useIsMobile()

  const [isResizing, setIsResizing] = useState(false)
  const [isResizingTags, setIsResizingTags] = useState(false)
  const { tags, fetchTags, selectedTagIds, excludedTagIds, filterMode, toggleTagSelection, toggleTagExclusion, setFilterMode } = useTagsStore()

  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const { showNewNoteInput, triggerNewNoteInput, closeNewNoteInput } = useFoldersStore()
  const [newNoteName, setNewNoteName] = useState('')

  const newNoteInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node && showNewNoteInput) {
      node.focus()
    }
  }, [showNewNoteInput])

  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const [deleteDialog, setDeleteDialog] = useState<{
    type: 'note' | 'folder' | 'mixed'
    id: string
    name: string
    noteCount?: number
    folderCount?: number
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { newNoteId, setNewNoteId } = useFoldersStore()
  const [removingNoteIds, setRemovingNoteIds] = useState<Set<string>>(new Set())
  const [newFolderId, setNewFolderId] = useState<string | null>(null)
  const [removingFolderIds, setRemovingFolderIds] = useState<Set<string>>(new Set())

  const {
    sensors,
    dragState,
    activeDragData,
    handlers,
  } = useSidebarDnd({
    folderTree,
    rootNotes,
    expandedFolders,
    selectedNoteIds,
    onExpandFolder: (folderId) => {
      if (!expandedFolders.has(folderId)) {
        toggleFolderExpanded(folderId)
      }
    },
    onMoveFolder: async (folderId, newParentId) => {
      await updateFolder(folderId, { parentId: newParentId })
    },
    onMoveNote: moveNoteToFolder,
  })

  const getMultiDragCount = () => {
    if (!dragState.activeItem || dragState.activeItem.type !== 'note') return 0
    const isInSelection = selectedNoteIds.includes(dragState.activeItem.id)
    return isInSelection ? selectedNoteIds.length - 1 : 0
  }

  useEffect(() => {
    fetchFolderTree()
    fetchTags()
    fetchStats()
    fetchMyShares()
  }, [fetchFolderTree, fetchTags, fetchStats, fetchMyShares])

  useEffect(() => {
    if (showNewNoteInput) {
      setNewNoteName('')
    }
  }, [showNewNoteInput])

  const isSelectionMode = selectedNoteIds.length > 0 || selectedFolderIds.length > 0

  const clearAllSelection = () => {
    clearNoteSelection()
    clearFolderSelection()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSelectionMode) {
          clearAllSelection()
        } else if (mobileSidebarOpen) {
          closeMobileSidebar()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileSidebarOpen, isSelectionMode])

  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileSidebarOpen])

  // RAF-throttled resize handler for smooth sidebar drag
  useEffect(() => {
    if (!isResizing) return

    let rafId = 0
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => setSidebarWidth(e.clientX))
    }
    const handleMouseUp = () => {
      cancelAnimationFrame(rafId)
      setIsResizing(false)
      document.body.classList.remove('resize-col')
      document.body.style.userSelect = ''
    }

    document.body.classList.add('resize-col')
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, setSidebarWidth])

  const tagsResizeStart = useRef({ y: 0, height: 0 })

  const handleTagsResizeStart = useCallback((e: React.MouseEvent) => {
    tagsResizeStart.current = { y: e.clientY, height: tagsSectionHeight }
    setIsResizingTags(true)
  }, [tagsSectionHeight])

  useEffect(() => {
    if (!isResizingTags) return

    let rafId = 0
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const delta = tagsResizeStart.current.y - e.clientY
        const newHeight = tagsResizeStart.current.height + delta
        setTagsSectionHeight(newHeight)
      })
    }
    const handleMouseUp = () => {
      cancelAnimationFrame(rafId)
      setIsResizingTags(false)
      document.body.classList.remove('resize-ns')
      document.body.style.userSelect = ''
    }

    document.body.classList.add('resize-ns')
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingTags, setTagsSectionHeight])

  const filteredFolderTree = useMemo(
    () => filterFolderTree(folderTree, selectedTagIds, excludedTagIds, filterMode),
    [folderTree, selectedTagIds, excludedTagIds, filterMode]
  )

  const filteredRootNotes = useMemo(
    () => filterNotesByTags(rootNotes, selectedTagIds, excludedTagIds, filterMode),
    [rootNotes, selectedTagIds, excludedTagIds, filterMode]
  )

  const rootItems = useMemo(() => {
    return sortItemsAlphabetically(filteredFolderTree, filteredRootNotes)
  }, [filteredFolderTree, filteredRootNotes])

  const rootSortableIds = useMemo(() => {
    return rootItems.map(item => makeDragId(item.type, item.id))
  }, [rootItems])

  const handleSelectNote = (noteId: string, event?: React.MouseEvent) => {
    if (event && (event.metaKey || event.ctrlKey)) {
      toggleNoteSelection(noteId)
    } else if (isSelectionMode) {
      toggleNoteSelection(noteId)
    } else {
      clearAllSelection()
      onSelectNote(noteId)
      closeMobileSidebar()
    }
  }

  const handleSelectFolder = (folderId: string, event?: React.MouseEvent) => {
    if (event && (event.metaKey || event.ctrlKey)) {
      toggleFolderSelection(folderId)
    } else if (isSelectionMode) {
      toggleFolderSelection(folderId)
    }
  }

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      const folder = await createFolder(newFolderName.trim(), null)
      if (folder?.id) {
        setNewFolderId(folder.id)
        setTimeout(() => setNewFolderId(null), 1000)
      }
      setNewFolderName('')
      setShowNewFolderInput(false)
    }
  }

  const handleShowNewNoteInput = () => {
    triggerNewNoteInput()
  }

  const handleCreateNote = async () => {
    const title = newNoteName.trim() || t('editor.untitled')
    const note = await createNote({ title, content: '', folderId: null })
    handleSelectNote(note.id)
    setNewNoteId(note.id)
    closeNewNoteInput()
    setNewNoteName('')
    fetchFolderTree()
  }

  const handleCreateNoteInFolder = async (folderId: string, title: string) => {
    const note = await createNote({ title, content: '', folderId })
    handleSelectNote(note.id)
    setNewNoteId(note.id)
    setTimeout(() => setNewNoteId(null), 1000)
    fetchFolderTree()
  }

  const handleCreateFolderInFolder = async (parentId: string, name: string) => {
    const folder = await createFolder(name, parentId)
    if (folder?.id) {
      setNewFolderId(folder.id)
      setTimeout(() => setNewFolderId(null), 1000)
    }
    fetchFolderTree()
  }

  const handleLogout = async () => {
    await logout()
  }

  const handleDeleteNote = async (noteId: string, _noteName: string) => {
    setRemovingNoteIds((prev) => new Set(prev).add(noteId))

    setTimeout(async () => {
      await deleteNote(noteId)
      if (selectedNoteId === noteId) {
        onSelectNote('')
      }
      setRemovingNoteIds((prev) => {
        const next = new Set(prev)
        next.delete(noteId)
        return next
      })
      fetchFolderTree()
      fetchTags()
    }, 250)
  }

  const handleDeleteSelected = () => {
    const noteCount = selectedNoteIds.length
    const folderCount = selectedFolderIds.length
    const total = noteCount + folderCount

    if (total === 0) return

    if (total === 1) {
      if (noteCount === 1) {
        const noteId = selectedNoteIds[0]
        setRemovingNoteIds((prev) => new Set(prev).add(noteId))
        setTimeout(async () => {
          await deleteNote(noteId)
          if (selectedNoteId === noteId) onSelectNote('')
          setRemovingNoteIds((prev) => {
            const next = new Set(prev)
            next.delete(noteId)
            return next
          })
          clearAllSelection()
          fetchFolderTree()
          fetchTags()
        }, 250)
      } else {
        const folderId = selectedFolderIds[0]
        setRemovingFolderIds((prev) => new Set(prev).add(folderId))
        setTimeout(async () => {
          await deleteFolder(folderId, true)
          setRemovingFolderIds((prev) => {
            const next = new Set(prev)
            next.delete(folderId)
            return next
          })
          clearAllSelection()
          fetchFolderTree()
          fetchTags()
        }, 250)
      }
      return
    }

    const notesLabel = noteCount > 1
      ? t('sidebar.selection_notes_plural', { count: noteCount })
      : t('sidebar.selection_notes', { count: noteCount })
    const foldersLabel = folderCount > 1
      ? t('sidebar.selection_folders_plural', { count: folderCount })
      : t('sidebar.selection_folders', { count: folderCount })

    if (noteCount > 0 && folderCount > 0) {
      setDeleteDialog({
        type: 'mixed',
        id: 'multiple',
        name: t('sidebar.selection_mixed', { notes: notesLabel, folders: foldersLabel }),
        noteCount,
        folderCount,
      })
    } else if (noteCount > 0) {
      setDeleteDialog({
        type: 'note',
        id: 'multiple',
        name: notesLabel,
        noteCount,
      })
    } else {
      setDeleteDialog({
        type: 'folder',
        id: 'multiple',
        name: foldersLabel,
        folderCount,
      })
    }
  }

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    setDeleteDialog({ type: 'folder', id: folderId, name: folderName })
  }

  const handleChangeFolderIcon = async (folderId: string, icon: string) => {
    await updateFolder(folderId, { icon })
    fetchFolderTree()
  }

  const handleRenameFolder = async (folderId: string, newName: string) => {
    await updateFolder(folderId, { name: newName })
  }

  const handleRenameNote = async (noteId: string, newTitle: string) => {
    await updateNote(noteId, { title: newTitle })
    fetchFolderTree()
  }

  const handleMoveSelectedToFolder = async (folderId: string | null) => {
    if (selectedNoteIds.length === 0) return

    try {
      await Promise.all(
        selectedNoteIds.map((noteId) => moveNoteToFolder(noteId, folderId))
      )
      clearAllSelection()
      fetchFolderTree()
    } catch (err) {
      console.error('Failed to move notes:', err)
    }
  }

  const confirmDelete = async () => {
    if (!deleteDialog) return
    setIsDeleting(true)

    try {
      if (deleteDialog.type === 'mixed') {
        setRemovingNoteIds(new Set(selectedNoteIds))
        setRemovingFolderIds(new Set(selectedFolderIds))
        setTimeout(async () => {
          await Promise.all([
            deleteMultipleNotes(selectedNoteIds),
            deleteMultipleFolders(selectedFolderIds),
          ])
          if (selectedNoteId && selectedNoteIds.includes(selectedNoteId)) {
            onSelectNote('')
          }
          setRemovingNoteIds(new Set())
          setRemovingFolderIds(new Set())
          clearAllSelection()
          fetchFolderTree()
          fetchTags()
          setDeleteDialog(null)
          setIsDeleting(false)
        }, 250)
        return
      }

      if (deleteDialog.type === 'note') {
        if (deleteDialog.id === 'multiple') {
          setRemovingNoteIds(new Set(selectedNoteIds))
          setTimeout(async () => {
            await deleteMultipleNotes(selectedNoteIds)
            if (selectedNoteId && selectedNoteIds.includes(selectedNoteId)) {
              onSelectNote('')
            }
            setRemovingNoteIds(new Set())
            clearAllSelection()
            fetchFolderTree()
            fetchTags()
            setDeleteDialog(null)
            setIsDeleting(false)
          }, 250)
          return
        } else {
          setRemovingNoteIds((prev) => new Set(prev).add(deleteDialog.id))
          setTimeout(async () => {
            await deleteNote(deleteDialog.id)
            if (selectedNoteId === deleteDialog.id) {
              onSelectNote('')
            }
            setRemovingNoteIds((prev) => {
              const next = new Set(prev)
              next.delete(deleteDialog.id)
              return next
            })
            fetchFolderTree()
            fetchTags()
            setDeleteDialog(null)
            setIsDeleting(false)
          }, 250)
          return
        }
      }

      if (deleteDialog.type === 'folder') {
        if (deleteDialog.id === 'multiple') {
          setRemovingFolderIds(new Set(selectedFolderIds))
          setTimeout(async () => {
            await deleteMultipleFolders(selectedFolderIds)
            setRemovingFolderIds(new Set())
            clearAllSelection()
            fetchFolderTree()
            fetchTags()
            setDeleteDialog(null)
            setIsDeleting(false)
          }, 250)
          return
        } else {
          setRemovingFolderIds((prev) => new Set(prev).add(deleteDialog.id))
          setTimeout(async () => {
            await deleteFolder(deleteDialog.id, true)
            setRemovingFolderIds((prev) => {
              const next = new Set(prev)
              next.delete(deleteDialog.id)
              return next
            })
            fetchFolderTree()
            fetchTags()
            setDeleteDialog(null)
            setIsDeleting(false)
          }, 250)
          return
        }
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 cursor-pointer"
        >
          <OnykaLogo className="w-7 h-7 logo-glow" />
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">
            Onyka
          </h1>
        </button>
        <button
          onClick={() => closeMobileSidebar()}
          className="md:hidden p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
          aria-label={t('common.close')}
        >
          <IoCloseOutline className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={onOpenSearch}
          className="w-full h-9 flex items-center gap-2 px-3 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)] transition-colors border border-[var(--color-border)]"
          aria-label={t('sidebar.search_shortcut')}
        >
          <IoSearchOutline className="w-4 h-4" />
          <span className="flex-1 text-left text-sm">{t('sidebar.search_placeholder')}</span>
          <kbd className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-primary)] text-[var(--color-text-tertiary)]">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="px-3 pb-3 space-y-2">
        <div className="flex gap-2">
          <button onClick={handleShowNewNoteInput} className="fold-button group flex-1">
            <span className="fold-corner" />
            <span className="fold-button-inner">
              <IoAddOutline className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-180" />
              <span>Note</span>
            </span>
          </button>

          <button
            onClick={() => { openQuickAdd(); closeMobileSidebar() }}
            className="spark-button group flex-1"
          >
            <span className="spark-button-bg" />
            <span className="spark-button-inner">
              <span className="spark-icon-wrapper">
                <SparkIcon className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              </span>
              <span>Sparks</span>
            </span>
          </button>
        </div>

        <button
          onClick={() => setShowNewFolderInput(true)}
          className="w-full h-[32px] flex items-center justify-center gap-2 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors border border-[var(--color-border)] text-sm"
        >
          <IoFolderOpenOutline className="w-3.5 h-3.5" />
          <span>{t('sidebar.new_folder')}</span>
        </button>
      </div>

      {showNewNoteInput && (
        <div className="px-3 pb-3">
          <input
            ref={newNoteInputRef}
            type="text"
            value={newNoteName}
            onChange={(e) => setNewNoteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNote()
              if (e.key === 'Escape') {
                closeNewNoteInput()
                setNewNoteName('')
              }
            }}
            onBlur={() => {
              setTimeout(() => {
                if (showNewNoteInput) handleCreateNote()
              }, 150)
            }}
            placeholder={t('editor.untitled')}
            className="w-full h-9 px-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-accent)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
          />
        </div>
      )}

      {showNewFolderInput && (
        <div className="px-3 pb-3">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder()
              if (e.key === 'Escape') {
                setShowNewFolderInput(false)
                setNewFolderName('')
              }
            }}
            onBlur={() => {
              if (!newFolderName.trim()) setShowNewFolderInput(false)
            }}
            placeholder={t('folders.new_folder_placeholder')}
            className="w-full h-9 px-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-accent)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
            autoFocus
          />
        </div>
      )}

      <nav
        className="flex-1 overflow-y-auto px-2 scrollbar-none min-h-0"
        aria-label="File tree"
      >
        {isFoldersLoading && folderTree.length === 0 && rootNotes.length === 0 ? (
          <div className="space-y-1 px-1 py-1 animate-pulse">
            {/* Skeleton folder */}
            <div className="flex items-center gap-2 h-8 px-2 rounded-lg">
              <div className="w-4 h-4 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-3 rounded bg-[var(--color-bg-tertiary)] flex-1 max-w-[60%]" />
            </div>
            {/* Skeleton notes in folder */}
            <div className="pl-6 space-y-1">
              <div className="flex items-center gap-2 h-7 px-2 rounded-lg">
                <div className="w-3.5 h-3.5 rounded bg-[var(--color-bg-tertiary)]" />
                <div className="h-2.5 rounded bg-[var(--color-bg-tertiary)] flex-1 max-w-[70%]" />
              </div>
              <div className="flex items-center gap-2 h-7 px-2 rounded-lg">
                <div className="w-3.5 h-3.5 rounded bg-[var(--color-bg-tertiary)]" />
                <div className="h-2.5 rounded bg-[var(--color-bg-tertiary)] flex-1 max-w-[50%]" />
              </div>
            </div>
            {/* Skeleton folder 2 */}
            <div className="flex items-center gap-2 h-8 px-2 rounded-lg">
              <div className="w-4 h-4 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-3 rounded bg-[var(--color-bg-tertiary)] flex-1 max-w-[45%]" />
            </div>
            {/* Skeleton root notes */}
            <div className="flex items-center gap-2 h-7 px-2 rounded-lg">
              <div className="w-3.5 h-3.5 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-2.5 rounded bg-[var(--color-bg-tertiary)] flex-1 max-w-[55%]" />
            </div>
            <div className="flex items-center gap-2 h-7 px-2 rounded-lg">
              <div className="w-3.5 h-3.5 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-2.5 rounded bg-[var(--color-bg-tertiary)] flex-1 max-w-[65%]" />
            </div>
            <div className="flex items-center gap-2 h-7 px-2 rounded-lg">
              <div className="w-3.5 h-3.5 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-2.5 rounded bg-[var(--color-bg-tertiary)] flex-1 max-w-[40%]" />
            </div>
          </div>
        ) : (
        <>
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handlers.onDragStart}
          onDragOver={handlers.onDragOver}
          onDragEnd={handlers.onDragEnd}
          onDragCancel={handlers.onDragCancel}
        >
          <SortableContext
            items={rootSortableIds}
            strategy={verticalListSortingStrategy}
            id="root-context"
          >
            {rootItems.map((item) => {
              if (item.type === 'folder') {
                const folder = filteredFolderTree.find(f => f.id === item.id)
                if (!folder) return null

                return (
                  <SortableFolderItem
                    key={folder.id}
                    folder={folder}
                    level={0}
                    expandedFolders={expandedFolders}
                    dropTarget={dragState.dropTarget}
                    selectedNoteId={selectedNoteId}
                    selectedNoteIds={selectedNoteIds}
                    selectedFolderIds={selectedFolderIds}
                    isSelectionMode={isSelectionMode}
                    activeItem={dragState.activeItem}
                    onToggleExpand={toggleFolderExpanded}
                    onSelectNote={handleSelectNote}
                    onSelectFolder={handleSelectFolder}
                    onDeleteNote={handleDeleteNote}
                    onRenameNote={handleRenameNote}
                    onDeleteFolder={handleDeleteFolder}
                    onRenameFolder={handleRenameFolder}
                    onChangeFolderIcon={handleChangeFolderIcon}
                    onCreateNoteInFolder={handleCreateNoteInFolder}
                    onCreateFolderInFolder={handleCreateFolderInFolder}
                    newNoteId={newNoteId}
                    removingNoteIds={removingNoteIds}
                    newFolderId={newFolderId}
                    removingFolderIds={removingFolderIds}
                    isMobile={isMobile}
                  />
                )
              } else {
                const note = filteredRootNotes.find(n => n.id === item.id)
                if (!note) return null

                return (
                  <SortableNoteItem
                    key={note.id}
                    note={note}
                    level={0}
                    isSelected={selectedNoteId === note.id}
                    isMultiSelected={selectedNoteIds.includes(note.id)}
                    activeItem={dragState.activeItem}
                    onSelect={(e) => handleSelectNote(note.id, e)}
                    onDelete={() => handleDeleteNote(note.id, note.title)}
                    onRename={(newTitle) => handleRenameNote(note.id, newTitle)}
                    isNew={note.id === newNoteId}
                    isRemoving={removingNoteIds.has(note.id)}
                    isMobile={isMobile}
                  />
                )
              }
            })}
          </SortableContext>

          <RootDropZone
            isDragging={dragState.isDragging}
            isActive={dragState.dropTarget?.position === 'root'}
          />

          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.2, 0, 0, 1)',
            }}
          >
            {activeDragData ? (
              <DragOverlayContent
                item={activeDragData}
                additionalCount={getMultiDragCount()}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        {filteredFolderTree.length === 0 && filteredRootNotes.length === 0 && (
          <div className="p-4 text-center text-sm text-[var(--color-text-tertiary)]">
            {selectedTagIds.length > 0 || excludedTagIds.length > 0
              ? t('sidebar.no_notes_with_tags')
              : t('sidebar.no_notes')}
          </div>
        )}

        </>
        )}
      </nav>

      <SharedWithMeSection
        selectedNoteId={selectedNoteId}
        onSelectNote={(noteId) => {
          onSelectNote(noteId)
          closeMobileSidebar()
        }}
      />

      {tags.filter(t => t.noteCount > 0).length > 0 && (
        <div className="flex-shrink-0 relative">
          {!tagsCollapsed && (
            <div
              onMouseDown={handleTagsResizeStart}
              className={`
                group absolute -top-0.5 left-0 right-0 h-1 cursor-ns-resize z-20
                flex items-center justify-center
                transition-colors duration-200
                ${isResizingTags ? 'bg-[var(--color-accent)]/30' : 'hover:bg-[var(--color-accent)]/20'}
              `}
            >
              <div
                className={`
                  h-0.5 rounded-full transition-all duration-200
                  ${isResizingTags
                    ? 'w-16 bg-[var(--color-accent)]'
                    : 'w-8 bg-[var(--color-border)] group-hover:bg-[var(--color-accent)] group-hover:w-16'
                  }
                `}
              />
            </div>
          )}

          <button
            onClick={toggleTagsCollapsed}
            className={`
              w-full px-3 flex items-center gap-2 transition-all duration-200 group
              rounded-md cursor-pointer
              ${tagsCollapsed
                ? 'py-2 hover:bg-[var(--color-bg-tertiary)]/50'
                : 'py-1.5 hover:bg-[var(--color-bg-tertiary)]/30'
              }
            `}
          >
            <div className={`
              relative flex items-center justify-center w-5 h-5 rounded-md transition-all duration-200
              ${tagsCollapsed
                ? 'bg-[var(--color-accent)]/10 group-hover:bg-[var(--color-accent)]/20'
                : 'bg-transparent group-hover:bg-[var(--color-accent)]/10'
              }
            `}>
              <IoPricetagOutline className={`
                w-3.5 h-3.5 transition-all duration-200
                ${tagsCollapsed
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)]'
                }
              `} />
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className={`
                text-[11px] font-semibold uppercase tracking-widest transition-colors duration-200
                ${tagsCollapsed
                  ? 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]'
                }
              `}>
                {t('sidebar.tags')}
              </span>
              <span className={`
                text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-all duration-200
                ${tagsCollapsed
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]'
                }
              `}>
                {tags.filter(t => t.noteCount > 0).length}
              </span>
            </div>

            <IoChevronDown className={`
              w-3.5 h-3.5 transition-all duration-300 ease-spring
              ${tagsCollapsed
                ? 'rotate-180 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)]'
                : 'rotate-0 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)]'
              }
            `} />
          </button>

          <div
            className={`
              overflow-hidden
              ${tagsCollapsed ? 'max-h-0 opacity-0 transition-all duration-300 ease-smooth' : 'opacity-100'}
              ${isResizingTags ? '' : 'transition-all duration-300 ease-smooth'}
            `}
            style={{ maxHeight: tagsCollapsed ? 0 : `${tagsSectionHeight + 8}px` }}
          >
            {(selectedTagIds.length > 1 || excludedTagIds.length > 0 || selectedTagIds.length + excludedTagIds.length > 0) && !tagsCollapsed && (
              <div className="flex items-center gap-1.5 px-3 pb-1.5">
                {selectedTagIds.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setFilterMode(filterMode === 'and' ? 'or' : 'and')
                    }}
                    className={`
                      inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                      transition-all duration-200 ease-out border
                      ${filterMode === 'and'
                        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
                      }
                    `}
                    title={filterMode === 'and' ? t('sidebar.filter_mode_and_hint') : t('sidebar.filter_mode_or_hint')}
                  >
                    {filterMode === 'and' ? t('sidebar.filter_and') : t('sidebar.filter_or')}
                  </button>
                )}
                {(selectedTagIds.length > 0 || excludedTagIds.length > 0) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      useTagsStore.getState().clearTagSelection()
                    }}
                    className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all duration-200"
                  >
                    {t('common.clear')}
                  </button>
                )}
              </div>
            )}
            <div
              className="overflow-y-auto scrollbar-none px-3 pb-2"
              style={{ height: `${tagsSectionHeight}px` }}
            >
              <div className="flex flex-wrap gap-1.5">
                {tags.filter(t => t.noteCount > 0).map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id)
                  const isExcluded = excludedTagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (e.altKey) {
                          toggleTagExclusion(tag.id)
                        } else {
                          toggleTagSelection(tag.id)
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        toggleTagExclusion(tag.id)
                      }}
                      title={isExcluded ? t('sidebar.tag_excluded_hint') : isSelected ? t('sidebar.tag_included_hint') : t('sidebar.tag_default_hint')}
                      className={`
                        inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-xs font-medium
                        transition-all duration-200 ease-out select-none
                        ${isExcluded
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400 line-through shadow-sm shadow-red-500/10'
                          : isSelected
                            ? 'bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/25'
                            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]'
                        }
                      `}
                    >
                      <span className={`
                        w-1.5 h-1.5 rounded-full transition-colors duration-200
                        ${isExcluded ? 'bg-red-500' : isSelected ? 'bg-white/80' : 'bg-[var(--color-accent)]'}
                      `} />
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[var(--color-bg-tertiary)] transition-all duration-200 ease-out group min-w-0 shrink"
            title={t('profile.edit')}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className={`w-8 h-8 flex-shrink-0 rounded-full object-cover shadow-md group-hover:shadow-lg group-hover:shadow-[var(--color-accent)]/25 group-hover:scale-105 transition-all duration-300 ring-2 ${getAvatarRingClass(user.avatarColor)}`}
              />
            ) : (
              <div className={`w-8 h-8 flex-shrink-0 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-primary)] text-sm font-semibold shadow-md group-hover:shadow-lg group-hover:shadow-[var(--color-accent)]/25 group-hover:scale-105 transition-all duration-300 ring-2 ${getAvatarRingClass(user?.avatarColor)}`}>
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <span className="text-sm font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] truncate whitespace-nowrap transition-all duration-300">
              {user?.username || 'User'}
            </span>
          </button>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <ThemeToggle />
            <AccentColorPicker />
            <button
              onClick={() => setShowSettings(true)}
              className="group w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)] transition-all duration-200 ease-out"
              aria-label={t('sidebar.settings')}
              title={t('sidebar.settings')}
            >
              <IoSettingsOutline className="w-[18px] h-[18px] transition-transform duration-500 group-hover:rotate-90" />
            </button>
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="group w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent)]/10 transition-all duration-200 ease-out"
                aria-label={t('admin.title')}
                title={t('admin.title')}
              >
                <IoShieldOutline className="w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-110" />
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="group w-8 h-8 rounded-xl flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)] transition-all duration-200 ease-out"
              aria-label={t('sidebar.logout')}
              title={t('sidebar.logout')}
            >
              <IoLogOutOutline className="w-[18px] h-[18px] transition-all duration-300 group-hover:text-[var(--color-error)] group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* z-45: above header (z-40) but below sidebar (z-50) */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[45] animate-fade-in"
          onClick={() => closeMobileSidebar()}
        />
      )}

      <div
        className={`
          hidden md:block h-full relative z-20
          ${isResizing ? '' : 'transition-[width] duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]'}
          ${sidebarCollapsed ? 'w-16' : ''}
        `}
        style={{ width: sidebarCollapsed ? undefined : `clamp(240px, ${sidebarWidth}px, 420px)` }}
      >
        <div
          className={`
            absolute inset-0 rounded-2xl
            bg-gradient-to-b from-[var(--color-bg-secondary)] via-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)]
            border border-[var(--color-border-subtle)] shadow-lg
            ${isResizing ? '' : 'transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]'}
            ${sidebarCollapsed ? 'shadow-[0_0_30px_-10px_var(--color-accent)]' : ''}
          `}
        />

        {!sidebarCollapsed && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className={`
              absolute top-0 -right-1 w-3 h-full cursor-col-resize z-20
              group flex items-center justify-center
              transition-colors duration-200
              ${isResizing ? 'bg-[var(--color-accent)]/20' : ''}
            `}
          >
            <div
              className={`
                w-0.5 rounded-full transition-all duration-200
                ${isResizing
                  ? 'h-16 bg-[var(--color-accent)]'
                  : 'h-8 bg-[var(--color-border)] group-hover:bg-[var(--color-accent)] group-hover:h-16'
                }
              `}
            />
          </div>
        )}

        <div
          className={`
            absolute inset-0 h-full flex flex-col items-center py-3 z-10
            transition-all duration-500
            ${sidebarCollapsed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
        >
          <div
            className={`
              relative group/expand
              transition-all duration-200
              ${sidebarCollapsed ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}
            `}
            style={{ transitionDelay: sidebarCollapsed ? '200ms' : '0ms' }}
          >
            <button
              onClick={toggleSidebar}
              className="collapsed-icon-btn p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors duration-200"
            >
              <IoChevronForward className="w-5 h-5 collapsed-expand-icon" />
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover/expand:opacity-100 group-hover/expand:scale-100 transition-all duration-200 delay-150">
              {t('sidebar.expand')}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 items-center">
            <div
              className={`
                relative group/search
                transition-all duration-200
                ${sidebarCollapsed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
              `}
              style={{ transitionDelay: sidebarCollapsed ? '250ms' : '0ms' }}
            >
              <button
                onClick={() => { toggleSidebar(); setTimeout(onOpenSearch, 300) }}
                className="collapsed-icon-btn p-2 rounded-xl text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all duration-200"
              >
                <IoSearchOutline className="w-5 h-5" />
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover/search:opacity-100 group-hover/search:scale-100 transition-all duration-200 delay-150">
                {t('sidebar.search_shortcut')}
              </div>
            </div>

            <div
              className={`
                relative group/newnote
                transition-all duration-200
                ${sidebarCollapsed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
              `}
              style={{ transitionDelay: sidebarCollapsed ? '300ms' : '0ms' }}
            >
              <button
                onClick={() => { toggleSidebar(); handleShowNewNoteInput() }}
                className="collapsed-icon-btn p-1.5 text-[var(--color-accent)] transition-colors duration-200"
              >
                <IoAddOutline className="w-6 h-6 collapsed-plus-icon" />
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover/newnote:opacity-100 group-hover/newnote:scale-100 transition-all duration-200 delay-150">
                {t('sidebar.new_note')}
              </div>
            </div>

            <div
              className={`
                relative group/sparks
                transition-all duration-200
                ${sidebarCollapsed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
              `}
              style={{ transitionDelay: sidebarCollapsed ? '350ms' : '0ms' }}
            >
              <button
                onClick={openQuickAdd}
                className="collapsed-icon-btn p-1.5 transition-colors duration-200"
              >
                <span className="collapsed-spark-icon">
                  <SparkIcon className="w-6 h-6 text-[var(--color-accent)]" />
                </span>
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover/sparks:opacity-100 group-hover/sparks:scale-100 transition-all duration-200 delay-150">
                {t('sparks.title')}
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div
              className={`
                w-px h-12 bg-gradient-to-b from-transparent via-[var(--color-border-subtle)] to-transparent
                transition-all duration-500
                ${sidebarCollapsed ? 'opacity-100' : 'opacity-0'}
              `}
              style={{ transitionDelay: sidebarCollapsed ? '400ms' : '0ms' }}
            />
          </div>

          <div className="flex flex-col gap-2 items-center">
            <div
              className={`
                flex flex-col gap-2 items-center
                transition-all duration-300
                ${sidebarCollapsed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
              `}
              style={{ transitionDelay: sidebarCollapsed ? '450ms' : '0ms' }}
            >
              <ThemeToggle collapsed />
              <AccentColorPicker collapsed />
            </div>

            <div
              className={`
                w-5 h-px my-0.5 bg-[var(--color-border-subtle)]
                transition-all duration-300
                ${sidebarCollapsed ? 'opacity-100' : 'opacity-0'}
              `}
              style={{ transitionDelay: sidebarCollapsed ? '500ms' : '0ms' }}
            />

            <div
              className={`
                relative group/settings
                transition-all duration-300
                ${sidebarCollapsed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
              `}
              style={{ transitionDelay: sidebarCollapsed ? '550ms' : '0ms' }}
            >
              <button
                onClick={() => setShowSettings(true)}
                className="collapsed-icon-btn p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors duration-200"
              >
                <IoSettingsOutline className="w-5 h-5 collapsed-settings-icon" />
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover/settings:opacity-100 group-hover/settings:scale-100 transition-all duration-200 delay-150">
                {t('sidebar.settings')}
              </div>
            </div>

            <div
              className={`
                relative group/avatar
                transition-all duration-300
                ${sidebarCollapsed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
              `}
              style={{ transitionDelay: sidebarCollapsed ? '600ms' : '0ms' }}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className={`
                    collapsed-icon-btn w-8 h-8 rounded-full object-cover cursor-pointer ring-2 ${getAvatarRingClass(user.avatarColor)}
                    transition-all duration-300
                  `}
                  onClick={() => setShowProfile(true)}
                />
              ) : (
                <div
                  className={`
                    collapsed-icon-btn w-8 h-8 rounded-full bg-[var(--color-bg-tertiary)] ring-2 ${getAvatarRingClass(user?.avatarColor)}
                    flex items-center justify-center text-[var(--color-text-primary)] text-xs font-semibold cursor-pointer
                    transition-all duration-300
                  `}
                  onClick={() => setShowProfile(true)}
                >
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="
                absolute left-full top-1/2 -translate-y-1/2 ml-3
                px-2.5 py-1 rounded-lg
                bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg
                text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap
                opacity-0 scale-95 pointer-events-none
                group-hover/avatar:opacity-100 group-hover/avatar:scale-100
                transition-all duration-200 delay-150
              ">
                {user?.username || 'User'}
              </div>
            </div>
          </div>
        </div>

        <aside
          className={`
            absolute inset-0 h-full z-10 overflow-hidden
            transition-all duration-600 ease-[cubic-bezier(0.34,1.56,0.64,1)]
            ${sidebarCollapsed
              ? 'opacity-0 translate-x-[-20px] blur-sm pointer-events-none'
              : 'opacity-100 translate-x-0 blur-0 pointer-events-auto'
            }
          `}
        >
          <button
            onClick={toggleSidebar}
            className={`
              group absolute right-3 top-4 z-20 p-2 rounded-xl
              text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10
              transition-all duration-300
              ${sidebarCollapsed ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}
            `}
            title={t('sidebar.collapse')}
          >
            <IoChevronBack className="w-5 h-5" />
            <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-[var(--color-accent)]/30 scale-100 group-hover:scale-110 transition-all duration-300" />
          </button>
          {sidebarContent}
        </aside>
      </div>

      <aside
        className={`
          md:hidden h-full bg-[var(--color-bg-secondary)] rounded-r-2xl border-r border-y border-[var(--color-border-subtle)] shadow-xl
          fixed inset-y-0 left-0 z-50 w-[min(85vw,320px)]
          transform transition-transform duration-300 ease-out
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>

      <SelectionActionBar
        selectedNoteIds={selectedNoteIds}
        selectedFolderIds={selectedFolderIds}
        folderTree={folderTree}
        sidebarWidth={sidebarCollapsed ? 56 : sidebarWidth}
        onMoveToFolder={handleMoveSelectedToFolder}
        onDelete={handleDeleteSelected}
        onClearSelection={clearAllSelection}
      />

      <ConfirmDialog
        isOpen={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
        onConfirm={confirmDelete}
        title={(() => {
          if (!deleteDialog) return ''
          const isMultiple = deleteDialog.id === 'multiple'
          if (deleteDialog.type === 'mixed') return t('notes.delete_title_mixed')
          if (deleteDialog.type === 'folder') {
            return isMultiple ? t('folders.delete_title_plural') : t('folders.delete_title')
          }
          return isMultiple ? t('notes.delete_title_plural') : t('notes.delete_title')
        })()}
        message={(() => {
          if (!deleteDialog) return ''
          const isMultiple = deleteDialog.id === 'multiple'
          if (deleteDialog.type === 'mixed') {
            return t('notes.delete_message_mixed', { name: deleteDialog.name })
          }
          if (deleteDialog.type === 'folder') {
            return isMultiple
              ? t('folders.delete_message_plural', { name: deleteDialog.name })
              : t('folders.delete_message', { name: deleteDialog.name })
          }
          return isMultiple
            ? t('notes.delete_message_plural', { name: deleteDialog.name })
            : t('notes.delete_message', { name: deleteDialog.name })
        })()}
        confirmLabel={t('common.delete')}
        isLoading={isDeleting}
      />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <ProfileEditModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </>
  )
}
