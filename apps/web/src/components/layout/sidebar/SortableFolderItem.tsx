import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  IoChevronForward,
  IoEllipsisHorizontal,
  IoCreateOutline,
  IoHappyOutline,
  IoTrashOutline,
  IoDocumentOutline,
  IoFolderOutline,
  IoPeopleOutline,
  IoDownloadOutline,
} from 'react-icons/io5'
import { ShareDialog, ExportDialog } from '@/components/features'
import { IconPicker } from '@/components/ui'
import { getIconByName, isEmoji } from '@/utils/icons'
import { useSharedFolderIds } from '@/stores/shares'
import { SortableNoteItem } from './SortableNoteItem'
import { makeDragId, sortItemsAlphabetically } from './use-sidebar-dnd'
import type { DragItemId, DropTarget } from './use-sidebar-dnd'
import type { FolderTreeItem } from '@/services/api'

interface SortableFolderItemProps {
  folder: FolderTreeItem
  level: number
  expandedFolders: Set<string>
  dropTarget: DropTarget | null
  selectedNoteId: string | null
  selectedNoteIds: string[]
  selectedFolderIds: string[]
  isSelectionMode: boolean
  activeItem: DragItemId | null
  onToggleExpand: (id: string) => void
  onSelectNote: (noteId: string, event?: React.MouseEvent) => void
  onSelectFolder: (folderId: string, event?: React.MouseEvent) => void
  onDeleteNote: (noteId: string, noteName: string) => void
  onRenameNote: (noteId: string, newTitle: string) => void
  onDeleteFolder: (folderId: string, folderName: string) => void
  onRenameFolder: (folderId: string, newName: string) => void
  onChangeFolderIcon: (folderId: string, icon: string) => void
  onCreateNoteInFolder: (folderId: string, title: string) => void
  onCreateFolderInFolder: (parentId: string, name: string) => void
  newNoteId?: string | null
  removingNoteIds?: Set<string>
  newFolderId?: string | null
  removingFolderIds?: Set<string>
  isMobile?: boolean
}

export function SortableFolderItem({
  folder,
  level,
  expandedFolders,
  dropTarget,
  selectedNoteId,
  selectedNoteIds,
  selectedFolderIds,
  isSelectionMode,
  activeItem,
  onToggleExpand,
  onSelectNote,
  onSelectFolder,
  onDeleteNote,
  onRenameNote,
  onDeleteFolder,
  onRenameFolder,
  onChangeFolderIcon,
  onCreateNoteInFolder,
  onCreateFolderInFolder,
  newNoteId,
  removingNoteIds,
  newFolderId,
  removingFolderIds,
  isMobile,
}: SortableFolderItemProps) {
  const { t } = useTranslation()
  const sharedFolderIds = useSharedFolderIds()
  const isFolderShared = sharedFolderIds.has(folder.id)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [showParticles, setShowParticles] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(folder.name)
  const [showNewNoteInput, setShowNewNoteInput] = useState(false)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const newItemInputRef = useRef<HTMLInputElement>(null)

  const dragId = makeDragId('folder', folder.id)

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: dragId,
    data: { type: 'folder', id: folder.id, folder, acceptsDrop: true },
  })

  const isExpanded = expandedFolders.has(folder.id)
  const isRemoving = removingFolderIds?.has(folder.id)
  const isNew = folder.id === newFolderId
  const isBeingDragged = activeItem?.type === 'folder' && activeItem.id === folder.id

  // Disable transform; the drag overlay handles visual feedback
  const style = {
    transform: undefined,
    transition: undefined,
  }
  const hasContent = folder.children.length > 0 || folder.notes.length > 0
  const isMultiSelected = selectedFolderIds.includes(folder.id)

  const isDropTarget = dropTarget?.id === folder.id && dropTarget?.type === 'folder'
  const showDropInto = isDropTarget && dropTarget?.position === 'inside'

  const paddingLeft = level * 16 + 8

  const sortedChildren = useMemo(() => {
    return sortItemsAlphabetically(folder.children, folder.notes)
  }, [folder.children, folder.notes])

  const childSortableIds = useMemo(() => {
    return sortedChildren.map((item) => makeDragId(item.type, item.id))
  }, [sortedChildren])

  useEffect(() => {
    if (isRemoving) setShowParticles(true)
  }, [isRemoving])

  useEffect(() => {
    const handleCloseOtherMenus = () => {
      setMenuPosition(null)
      setShowIconPicker(false)
    }
    window.addEventListener('close-context-menus', handleCloseOtherMenus)
    return () => window.removeEventListener('close-context-menus', handleCloseOtherMenus)
  }, [])

  useEffect(() => {
    if (!menuPosition) return
    const handleOutsideMouseDown = (e: MouseEvent) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return
      closeMenu()
    }
    window.addEventListener('mousedown', handleOutsideMouseDown, true)
    return () => window.removeEventListener('mousedown', handleOutsideMouseDown, true)
  }, [menuPosition])

  const openMenu = (x: number, y: number) => {
    window.dispatchEvent(new CustomEvent('close-context-menus'))
    const menuWidth = 160
    const menuHeight = 150
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10)
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10)
    setTimeout(() => setMenuPosition({ x: adjustedX, y: adjustedY }), 0)
  }

  const closeMenu = () => {
    setMenuPosition(null)
    setShowIconPicker(false)
  }

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    closeMenu()
    setRenameValue(folder.name)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleConfirmRename = () => {
    if (renameValue.trim() && renameValue !== folder.name) {
      onRenameFolder(folder.id, renameValue.trim())
    }
    setIsRenaming(false)
  }

  const handleStartNewNote = () => {
    closeMenu()
    setNewItemName('')
    setShowNewNoteInput(true)
    if (!expandedFolders.has(folder.id)) {
      onToggleExpand(folder.id)
    }
    setTimeout(() => newItemInputRef.current?.focus(), 50)
  }

  const handleStartNewFolder = () => {
    closeMenu()
    setNewItemName('')
    setShowNewFolderInput(true)
    if (!expandedFolders.has(folder.id)) {
      onToggleExpand(folder.id)
    }
    setTimeout(() => newItemInputRef.current?.focus(), 50)
  }

  const handleConfirmNewNote = () => {
    const title = newItemName.trim() || t('editor.untitled')
    onCreateNoteInFolder(folder.id, title)
    setShowNewNoteInput(false)
    setNewItemName('')
  }

  const handleConfirmNewFolder = () => {
    const name = newItemName.trim() || t('sidebar.new_folder')
    onCreateFolderInFolder(folder.id, name)
    setShowNewFolderInput(false)
    setNewItemName('')
  }

  const handleCancelNewItem = () => {
    setShowNewNoteInput(false)
    setShowNewFolderInput(false)
    setNewItemName('')
  }

  const checkHasSelectedNote = (f: FolderTreeItem): boolean => {
    if (f.notes.some((n) => n.id === selectedNoteId)) return true
    return f.children.some((child) => checkHasSelectedNote(child))
  }
  const hasSelectedNote = checkHasSelectedNote(folder)

  const handleClick = (e: React.MouseEvent) => {
    if (isRemoving) return

    if (e.metaKey || e.ctrlKey) {
      onSelectFolder(folder.id, e)
      return
    }

    if (isSelectionMode) {
      onSelectFolder(folder.id, e)
      return
    }

    onToggleExpand(folder.id)
  }

  const folderIconValue = folder.icon || 'Folder'
  const folderIsEmoji = isEmoji(folderIconValue)
  const FolderIcon = folderIsEmoji ? null : getIconByName(folderIconValue)

  const renderFolderIcon = (className: string) => {
    if (folderIsEmoji) {
      return (
        <span className={`${className} flex items-center justify-center text-base leading-none`}>
          {folderIconValue}
        </span>
      )
    }
    return FolderIcon ? <FolderIcon className={className} /> : null
  }

  if (isRenaming) {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-2 py-1 rounded-lg overflow-hidden">
        <div style={{ width: `${paddingLeft - 8}px` }} className="flex-shrink-0" />
        <IoChevronForward
          className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''} text-[var(--color-text-tertiary)]`}
        />
        {renderFolderIcon('w-4 h-4 flex-shrink-0 text-[var(--color-accent)]')}
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleConfirmRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirmRename()
            if (e.key === 'Escape') setIsRenaming(false)
          }}
          className="flex-1 min-w-0 px-2 py-1 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-accent)] rounded-lg text-[var(--color-text-primary)] focus:outline-none"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        rounded-lg transition-all duration-200
        ${showDropInto
          ? 'bg-[var(--color-accent)]/10 ring-2 ring-[var(--color-accent)] ring-inset'
          : ''
        }
      `}
    >
      <div
        data-drag-id={dragId}
        {...(isMobile ? {} : { ...attributes, ...listeners })}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          if (!isRemoving) openMenu(e.clientX, e.clientY)
        }}
        className={`
          group flex items-center gap-1 px-2 py-0.5 rounded-lg relative
          cursor-pointer select-none ${isMobile ? 'touch-manipulation' : 'touch-none'}
          transition-all duration-150 ease-out
          ${isRemoving ? 'animate-item-exit pointer-events-none' : ''}
          ${isDragging || isBeingDragged
            ? 'opacity-0 pointer-events-none'
            : showDropInto
              ? 'bg-[var(--color-accent)]/15'
              : isMultiSelected
                ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/30'
                : hasSelectedNote
                  ? 'bg-[var(--color-accent)]/6'
                  : 'hover:bg-[var(--color-bg-tertiary)]/80 hover:text-[var(--color-text-primary)]'
          }
          ${isNew ? 'animate-item-success' : ''}
        `}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {showParticles && (
          <div className="item-particles">
            <div className="particle particle-1" />
            <div className="particle particle-2" />
            <div className="particle particle-3" />
            <div className="particle particle-4" />
            <div className="particle particle-5" />
            <div className="particle particle-6" />
          </div>
        )}

        {isMultiSelected && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-[var(--color-accent)]" />
        )}

        <IoChevronForward
          className={`
            w-4 h-4 transition-transform duration-200 flex-shrink-0
            ${isExpanded ? 'rotate-90' : ''}
            ${!hasContent ? 'invisible' : ''}
            ${hasSelectedNote ? 'text-[var(--color-accent)]/60' : 'text-[var(--color-text-tertiary)]'}
          `}
        />

        {renderFolderIcon(
          `w-4 h-4 flex-shrink-0 transition-colors ${hasSelectedNote ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]'}`
        )}

        <span
          className={`flex-1 truncate text-sm transition-colors ${
            hasSelectedNote ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
          }`}
        >
          {folder.name}
        </span>

        {isFolderShared && (
          <IoPeopleOutline className="w-3 h-3 text-[var(--color-accent)] opacity-60 flex-shrink-0" />
        )}

        <button
          ref={menuButtonRef}
          onClick={(e) => {
            e.stopPropagation()
            if (menuPosition) {
              closeMenu()
            } else {
              const rect = e.currentTarget.getBoundingClientRect()
              openMenu(rect.right - 140, rect.bottom + 4)
            }
          }}
          className={`rounded transition-opacity ${
            isMobile ? 'opacity-60 p-2 -mr-1' : 'opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg-elevated)] p-1'
          }`}
        >
          <IoEllipsisHorizontal className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
        </button>

        {menuPosition &&
          createPortal(
              <div
                ref={menuRef}
                className="fixed z-[9999] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg py-1.5 min-w-[160px] animate-scale-in"
                style={{ top: menuPosition.y, left: menuPosition.x }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleStartNewNote()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <IoDocumentOutline className="w-4 h-4" />
                  {t('sidebar.new_note')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleStartNewFolder()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <IoFolderOutline className="w-4 h-4" />
                  {t('sidebar.new_folder')}
                </button>
                <div className="my-1 border-t border-[var(--color-border-subtle)]" />
                <button
                  onClick={handleStartRename}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <IoCreateOutline className="w-4 h-4" />
                  {t('common.rename')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuPosition(null)
                    setShowIconPicker(true)
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <IoHappyOutline className="w-4 h-4" />
                  {t('notes.change_icon')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeMenu()
                    setShowShareDialog(true)
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <IoPeopleOutline className="w-4 h-4" />
                  {t('share.title')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeMenu()
                    setShowExportDialog(true)
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <IoDownloadOutline className="w-4 h-4" />
                  {t('export.title')}
                </button>
                <div className="my-1 border-t border-[var(--color-border-subtle)]" />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteFolder(folder.id, folder.name)
                    closeMenu()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-error)]/15 hover:text-[var(--color-error)] rounded-sm transition-colors"
                >
                  <IoTrashOutline className="w-4 h-4" />
                  {t('common.delete')}
                </button>
              </div>,
            document.body
          )}

        {showIconPicker && (
          <IconPicker
            selectedIcon={folder.icon || 'Folder'}
            onSelectIcon={(icon) => {
              onChangeFolderIcon(folder.id, icon)
              setTimeout(() => setShowIconPicker(false), 10)
            }}
            onClose={() => setTimeout(() => setShowIconPicker(false), 10)}
            triggerRef={menuButtonRef}
          />
        )}

        <ShareDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          resourceId={folder.id}
          resourceType="folder"
          resourceTitle={folder.name}
        />

        <ExportDialog
          type="folder"
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          folderId={folder.id}
          title={folder.name}
        />
      </div>

      {isExpanded && (hasContent || showNewNoteInput || showNewFolderInput) && (
        <div
          className={`relative ml-2 animate-folder-expand ${hasSelectedNote ? 'bg-[var(--color-accent)]/[0.03]' : ''}`}
        >
          <div
            className="absolute top-0 bottom-2 w-px bg-[var(--color-border)]"
            style={{ left: `${paddingLeft + 7}px` }}
          />

          {(showNewNoteInput || showNewFolderInput) && (
            <div
              className="flex items-center gap-2 px-2 py-1 rounded-lg animate-item-success"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
            >
              {showNewNoteInput ? (
                <IoDocumentOutline className="w-4 h-4 flex-shrink-0 text-[var(--color-accent)]" />
              ) : (
                <IoFolderOutline className="w-4 h-4 flex-shrink-0 text-[var(--color-accent)]" />
              )}
              <input
                ref={newItemInputRef}
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onBlur={() => {
                  if (showNewNoteInput) handleConfirmNewNote()
                  else handleConfirmNewFolder()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (showNewNoteInput) handleConfirmNewNote()
                    else handleConfirmNewFolder()
                  }
                  if (e.key === 'Escape') handleCancelNewItem()
                }}
                placeholder={showNewNoteInput ? t('editor.untitled') : t('sidebar.new_folder')}
                className="flex-1 min-w-0 px-2 py-1 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-accent)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <SortableContext items={childSortableIds} strategy={verticalListSortingStrategy} id={`folder-${folder.id}`}>
            {sortedChildren.map((item) => {
              if (item.type === 'folder') {
                const child = folder.children.find((c) => c.id === item.id)
                if (!child) return null
                return (
                  <SortableFolderItem
                    key={child.id}
                    folder={child}
                    level={level + 1}
                    expandedFolders={expandedFolders}
                    dropTarget={dropTarget}
                    selectedNoteId={selectedNoteId}
                    selectedNoteIds={selectedNoteIds}
                    selectedFolderIds={selectedFolderIds}
                    isSelectionMode={isSelectionMode}
                    activeItem={activeItem}
                    onToggleExpand={onToggleExpand}
                    onSelectNote={onSelectNote}
                    onSelectFolder={onSelectFolder}
                    onDeleteNote={onDeleteNote}
                    onRenameNote={onRenameNote}
                    onDeleteFolder={onDeleteFolder}
                    onRenameFolder={onRenameFolder}
                    onChangeFolderIcon={onChangeFolderIcon}
                    onCreateNoteInFolder={onCreateNoteInFolder}
                    onCreateFolderInFolder={onCreateFolderInFolder}
                    newNoteId={newNoteId}
                    removingNoteIds={removingNoteIds}
                    newFolderId={newFolderId}
                    removingFolderIds={removingFolderIds}
                    isMobile={isMobile}
                  />
                )
              } else {
                const note = folder.notes.find((n) => n.id === item.id)
                if (!note) return null
                return (
                  <SortableNoteItem
                    key={note.id}
                    note={note}
                    level={level + 1}
                    isSelected={selectedNoteId === note.id}
                    isMultiSelected={selectedNoteIds.includes(note.id)}
                    activeItem={activeItem}
                    onSelect={(e) => onSelectNote(note.id, e)}
                    onDelete={() => onDeleteNote(note.id, note.title)}
                    onRename={(newTitle) => onRenameNote(note.id, newTitle)}
                    isNew={note.id === newNoteId}
                    isRemoving={removingNoteIds?.has(note.id)}
                    isMobile={isMobile}
                  />
                )
              }
            })}
          </SortableContext>
        </div>
      )}
    </div>
  )
}
