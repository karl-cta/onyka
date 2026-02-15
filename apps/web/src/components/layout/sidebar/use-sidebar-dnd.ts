import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core'
import type { FolderTreeItem } from '@/services/api'
import type { FolderNote } from '@onyka/shared'

export type DragItemType = 'folder' | 'note'

export interface DragItemId {
  type: DragItemType
  id: string
}

export type DropPosition = 'inside' | 'root' | null

export interface DropTarget {
  id: string // folder id or 'root'
  type: DragItemType | 'root'
  position: DropPosition
  parentFolderId: string | null
}

export interface DragState {
  activeItem: DragItemId | null
  dropTarget: DropTarget | null
  isDragging: boolean
}

export const ROOT_DROP_ID = 'sidebar-root-drop-zone'

export function makeDragId(type: DragItemType, id: string): string {
  return `${type}:${id}`
}

export function parseDragId(uniqueId: UniqueIdentifier): DragItemId | null {
  const str = String(uniqueId)

  if (str === ROOT_DROP_ID) {
    return null
  }

  const match = str.match(/^(folder|note):(.+)$/)
  if (!match) return null
  return { type: match[1] as DragItemType, id: match[2] }
}

export function findFolderById(
  folders: FolderTreeItem[],
  id: string
): FolderTreeItem | null {
  for (const folder of folders) {
    if (folder.id === id) return folder
    const found = findFolderById(folder.children, id)
    if (found) return found
  }
  return null
}

export function findNoteById(
  folders: FolderTreeItem[],
  rootNotes: FolderNote[],
  id: string
): { note: FolderNote; folderId: string | null } | null {
  const rootNote = rootNotes.find((n) => n.id === id)
  if (rootNote) return { note: rootNote, folderId: null }

  const search = (
    items: FolderTreeItem[]
  ): { note: FolderNote; folderId: string | null } | null => {
    for (const folder of items) {
      const note = folder.notes.find((n) => n.id === id)
      if (note) return { note, folderId: folder.id }
      const found = search(folder.children)
      if (found) return found
    }
    return null
  }
  return search(folders)
}

/**
 * Check if targetId is a descendant of folderId
 */
export function isDescendant(
  folders: FolderTreeItem[],
  folderId: string,
  targetId: string
): boolean {
  const folder = findFolderById(folders, folderId)
  if (!folder) return false

  const check = (f: FolderTreeItem): boolean => {
    if (f.id === targetId) return true
    return f.children.some(check)
  }
  return folder.children.some(check)
}

/**
 * Get the parent folder ID of an item
 */
export function getParentFolderId(
  folders: FolderTreeItem[],
  rootNotes: FolderNote[],
  item: DragItemId
): string | null {
  if (item.type === 'note') {
    return findNoteById(folders, rootNotes, item.id)?.folderId ?? null
  }

  const findParent = (
    items: FolderTreeItem[],
    parentId: string | null
  ): string | null | undefined => {
    for (const folder of items) {
      if (folder.id === item.id) return parentId
      const found = findParent(folder.children, folder.id)
      if (found !== undefined) return found
    }
    return undefined
  }
  return findParent(folders, null) ?? null
}

/** Sort items alphabetically: folders first, then notes. */
export function sortItemsAlphabetically(
  folders: FolderTreeItem[],
  notes: FolderNote[]
): Array<{ type: DragItemType; id: string; name: string }> {
  const sortedFolders = [...folders]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((f) => ({ type: 'folder' as const, id: f.id, name: f.name }))

  const sortedNotes = [...notes]
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    .map((n) => ({ type: 'note' as const, id: n.id, name: n.title }))

  return [...sortedFolders, ...sortedNotes]
}

export function getItemsAtLevel(
  folders: FolderTreeItem[],
  rootNotes: FolderNote[],
  parentFolderId: string | null
): Array<{ type: DragItemType; id: string; name: string }> {
  if (parentFolderId === null) {
    return sortItemsAlphabetically(folders, rootNotes)
  }

  const parent = findFolderById(folders, parentFolderId)
  if (!parent) return []

  return sortItemsAlphabetically(parent.children, parent.notes)
}

interface UseSidebarDndOptions {
  folderTree: FolderTreeItem[]
  rootNotes: FolderNote[]
  expandedFolders: Set<string>
  /** IDs of currently selected notes (for multi-drag) */
  selectedNoteIds?: string[]
  onExpandFolder: (folderId: string) => void
  onMoveFolder: (folderId: string, newParentId: string | null) => Promise<void>
  onMoveNote: (noteId: string, newFolderId: string | null) => Promise<void>
}

export function useSidebarDnd({
  folderTree,
  rootNotes,
  expandedFolders,
  selectedNoteIds = [],
  onExpandFolder,
  onMoveFolder,
  onMoveNote,
}: UseSidebarDndOptions) {

  const [dragState, setDragState] = useState<DragState>({
    activeItem: null,
    dropTarget: null,
    isDragging: false,
  })

  const autoExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHoveredFolder = useRef<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    if (dragState.isDragging) {
      document.body.style.cursor = 'grabbing'
      return () => {
        document.body.style.cursor = ''
      }
    }
  }, [dragState.isDragging])

  useEffect(() => {
    return () => {
      if (autoExpandTimer.current) {
        clearTimeout(autoExpandTimer.current)
      }
    }
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const parsed = parseDragId(event.active.id)
    if (parsed) {
      setDragState({
        activeItem: parsed,
        dropTarget: null,
        isDragging: true,
      })
    }
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event

      if (!over) {
        setDragState((prev) => ({ ...prev, dropTarget: null }))
        if (autoExpandTimer.current) {
          clearTimeout(autoExpandTimer.current)
          autoExpandTimer.current = null
        }
        lastHoveredFolder.current = null
        return
      }

      const activeItem = parseDragId(active.id)
      if (!activeItem) return

      if (String(over.id) === ROOT_DROP_ID) {
        if (autoExpandTimer.current) {
          clearTimeout(autoExpandTimer.current)
          autoExpandTimer.current = null
        }
        lastHoveredFolder.current = null

        const activeParentId = getParentFolderId(folderTree, rootNotes, activeItem)

        // Only show root drop target if item is not already at root
        if (activeParentId !== null) {
          setDragState((prev) => ({
            ...prev,
            dropTarget: {
              id: 'root',
              type: 'root',
              position: 'root',
              parentFolderId: null,
            },
          }))
        } else {
          setDragState((prev) => ({ ...prev, dropTarget: null }))
        }
        return
      }

      const overItem = parseDragId(over.id)
      if (!overItem) return

      if (activeItem.type === overItem.type && activeItem.id === overItem.id) {
        return
      }

      if (overItem.type !== 'folder') {
        if (autoExpandTimer.current) {
          clearTimeout(autoExpandTimer.current)
          autoExpandTimer.current = null
        }
        lastHoveredFolder.current = null
        setDragState((prev) => ({ ...prev, dropTarget: null }))
        return
      }

      if (activeItem.type === 'folder') {
        if (
          activeItem.id === overItem.id ||
          isDescendant(folderTree, activeItem.id, overItem.id)
        ) {
          setDragState((prev) => ({ ...prev, dropTarget: null }))
          return
        }
      }

      const activeParentId = getParentFolderId(folderTree, rootNotes, activeItem)

      // Skip if item is already in the target folder
      if (activeParentId === overItem.id) {
        setDragState((prev) => ({ ...prev, dropTarget: null }))
        return
      }

      // Auto-expand closed folders after 500ms hover
      if (
        !expandedFolders.has(overItem.id) &&
        lastHoveredFolder.current !== overItem.id
      ) {
        lastHoveredFolder.current = overItem.id
        if (autoExpandTimer.current) {
          clearTimeout(autoExpandTimer.current)
        }
        autoExpandTimer.current = setTimeout(() => {
          onExpandFolder(overItem.id)
        }, 500)
      }

      setDragState((prev) => ({
        ...prev,
        dropTarget: {
          id: overItem.id,
          type: overItem.type,
          position: 'inside',
          parentFolderId: getParentFolderId(folderTree, rootNotes, overItem),
        },
      }))
    },
    [folderTree, rootNotes, expandedFolders, onExpandFolder]
  )

  const handleDragEnd = useCallback(
    async (_event: DragEndEvent) => {
      const { activeItem, dropTarget } = dragState

      if (autoExpandTimer.current) {
        clearTimeout(autoExpandTimer.current)
        autoExpandTimer.current = null
      }
      lastHoveredFolder.current = null

      setDragState({
        activeItem: null,
        dropTarget: null,
        isDragging: false,
      })

      if (!activeItem || !dropTarget) return

      try {
        const isNoteInSelection =
          activeItem.type === 'note' && selectedNoteIds.includes(activeItem.id)
        const notesToMove = isNoteInSelection ? selectedNoteIds : [activeItem.id]

        if (dropTarget.position === 'root') {
          if (activeItem.type === 'folder') {
            await onMoveFolder(activeItem.id, null)
          } else {
            await Promise.all(notesToMove.map((noteId) => onMoveNote(noteId, null)))
          }
          return
        }

        if (dropTarget.position === 'inside' && dropTarget.type === 'folder') {
          if (activeItem.type === 'folder') {
            if (
              activeItem.id === dropTarget.id ||
              isDescendant(folderTree, activeItem.id, dropTarget.id)
            ) {
              return
            }
          }

          if (activeItem.type === 'folder') {
            await onMoveFolder(activeItem.id, dropTarget.id)
          } else {
            await Promise.all(notesToMove.map((noteId) => onMoveNote(noteId, dropTarget.id)))
          }
        }
      } catch (err) {
        console.error('Drag & drop error:', err)
      }
    },
    [dragState, folderTree, selectedNoteIds, onMoveFolder, onMoveNote]
  )

  const handleDragCancel = useCallback(() => {
    if (autoExpandTimer.current) {
      clearTimeout(autoExpandTimer.current)
      autoExpandTimer.current = null
    }
    lastHoveredFolder.current = null

    setDragState({
      activeItem: null,
      dropTarget: null,
      isDragging: false,
    })
  }, [])

  const activeDragData = useMemo(() => {
    if (!dragState.activeItem) return null

    if (dragState.activeItem.type === 'folder') {
      const folder = findFolderById(folderTree, dragState.activeItem.id)
      return folder ? { type: 'folder' as const, data: folder } : null
    }

    const result = findNoteById(
      folderTree,
      rootNotes,
      dragState.activeItem.id
    )
    return result ? { type: 'note' as const, data: result.note } : null
  }, [folderTree, rootNotes, dragState.activeItem])

  return {
    sensors,
    dragState,
    activeDragData,
    handlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
  }
}
