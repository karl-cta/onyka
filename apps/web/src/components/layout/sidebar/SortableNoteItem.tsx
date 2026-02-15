import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import {
  IoEllipsisHorizontal,
  IoCreateOutline,
  IoTrashOutline,
  IoPeopleOutline,
  IoFolderOutline,
  IoArrowBackOutline,
  IoDocumentOutline,
} from 'react-icons/io5'
import { ShareDialog } from '@/components/features'
import { useFoldersStore } from '@/stores/folders'
import { makeDragId } from './use-sidebar-dnd'
import type { DragItemId } from './use-sidebar-dnd'
import type { FolderNote } from '@onyka/shared'
import type { FolderTreeItem } from '@/services/api'

function flattenFolders(
  folders: FolderTreeItem[],
  level = 0
): Array<{ id: string; name: string; level: number }> {
  const result: Array<{ id: string; name: string; level: number }> = []
  for (const folder of folders) {
    result.push({ id: folder.id, name: folder.name, level })
    result.push(...flattenFolders(folder.children, level + 1))
  }
  return result
}

interface SortableNoteItemProps {
  note: FolderNote
  level: number
  isSelected: boolean
  isMultiSelected: boolean
  activeItem: DragItemId | null
  onSelect: (e: React.MouseEvent) => void
  onDelete: () => void
  onRename: (newTitle: string) => void
  isNew?: boolean
  isRemoving?: boolean
  isMobile?: boolean
}

export function SortableNoteItem({
  note,
  level,
  isSelected,
  isMultiSelected,
  activeItem,
  onSelect,
  onDelete,
  onRename,
  isNew,
  isRemoving,
  isMobile,
}: SortableNoteItemProps) {
  const { t } = useTranslation()
  const { folderTree, moveNoteToFolder, fetchFolderTree } = useFoldersStore()
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(note.title)
  const [showParticles, setShowParticles] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const flatFolders = useMemo(() => flattenFolders(folderTree), [folderTree])

  const dragId = makeDragId('note', note.id)

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: dragId,
    data: { type: 'note', id: note.id, note },
  })

  const isBeingDragged = activeItem?.type === 'note' && activeItem.id === note.id

  // Disable transform; the drag overlay handles visual feedback
  const style = {
    transform: undefined,
    transition: undefined,
  }

  const paddingLeft = level * 16 + 8

  useEffect(() => {
    if (isRemoving) setShowParticles(true)
  }, [isRemoving])

  useEffect(() => {
    const handleCloseOtherMenus = () => {
      setMenuPosition(null)
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
    setShowMoveMenu(false)
  }

  const handleMoveToFolder = async (folderId: string | null) => {
    await moveNoteToFolder(note.id, folderId)
    fetchFolderTree()
    closeMenu()
  }

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    closeMenu()
    setRenameValue(note.title)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleConfirmRename = () => {
    if (renameValue.trim() && renameValue !== note.title) {
      onRename(renameValue.trim())
    }
    setIsRenaming(false)
  }

  if (isRenaming) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-2 px-2.5 py-0.5 rounded-lg overflow-hidden"
      >
        <div style={{ width: `${paddingLeft}px` }} className="flex-shrink-0" />
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
      style={{ ...style, paddingLeft: `${paddingLeft}px` }}
      data-drag-id={dragId}
      {...(isMobile ? {} : { ...attributes, ...listeners })}
      onClick={isRemoving ? undefined : onSelect}
      onContextMenu={(e) => {
        e.preventDefault()
        if (!isRemoving) openMenu(e.clientX, e.clientY)
      }}
      className={`
        group flex items-center gap-2 px-2.5 py-0.5 rounded-lg relative
        cursor-pointer select-none ${isMobile ? 'touch-manipulation' : 'touch-none'}
        transition-all duration-150 ease-out
        ${isRemoving ? 'animate-item-exit pointer-events-none' : ''}
        ${isDragging || isBeingDragged
          ? 'opacity-0 pointer-events-none'
          : isMultiSelected
            ? 'bg-[var(--color-accent)]/15 text-[var(--color-text-primary)] ring-1 ring-[var(--color-accent)]/30'
            : isSelected
              ? 'bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80 hover:text-[var(--color-text-primary)]'
        }
        ${isNew ? 'animate-item-success' : ''}
      `}
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

      {(isSelected || isMultiSelected) && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full bg-[var(--color-accent)]"
          style={{ left: level > 0 ? `${(level - 1) * 16 + 17}px` : '0px' }}
        />
      )}

      <span className={`truncate text-sm flex-1 ${isSelected ? 'font-medium' : ''}`}>
        {note.title || t('editor.untitled')}
      </span>

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
        <IoEllipsisHorizontal className="w-3.5 h-3.5" />
      </button>

      {menuPosition && createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg py-1.5 min-w-[160px] animate-scale-in"
            style={{ top: menuPosition.y, left: menuPosition.x }}
          >
            {showMoveMenu ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMoveMenu(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <IoArrowBackOutline className="w-4 h-4" />
                  {t('sidebar.move_to_folder')}
                </button>
                <div className="my-1 border-t border-[var(--color-border-subtle)]" />
                <div className="max-h-[200px] overflow-y-auto scrollbar-none">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveToFolder(null) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <IoDocumentOutline className="w-4 h-4 opacity-60" />
                    {t('sidebar.move_to_root')}
                  </button>
                  {flatFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={(e) => { e.stopPropagation(); handleMoveToFolder(folder.id) }}
                      className="w-full flex items-center gap-2.5 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                      style={{ paddingLeft: `${12 + folder.level * 12}px`, paddingRight: 12 }}
                    >
                      <IoFolderOutline className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartRename}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <IoCreateOutline className="w-4 h-4" />
                  {t('notes.rename')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMoveMenu(true)
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <IoFolderOutline className="w-4 h-4" />
                  {t('sidebar.move_to_folder')}
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

                <div className="my-1 border-t border-[var(--color-border-subtle)]" />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                    closeMenu()
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-error)]/15 hover:text-[var(--color-error)] rounded-sm transition-colors"
                >
                  <IoTrashOutline className="w-4 h-4" />
                  {t('common.delete')}
                </button>
              </>
            )}
          </div>,
        document.body
      )}

      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        resourceId={note.id}
        resourceType="note"
        resourceTitle={note.title}
      />
    </div>
  )
}
