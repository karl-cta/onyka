import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IoPencil, IoTrashOutline, IoLockClosed, IoLockOpen } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { NotePage } from '@onyka/shared'

interface PageTabsProps {
  noteId: string
  pages: NotePage[]
  activePageId: string
  onPageChange: (pageId: string) => void
  onPageDelete: (pageId: string) => void
  onPageRename: (pageId: string, newTitle: string) => void
  onPageReorder: (reorderedPages: NotePage[]) => void
  onPageLockToggle: (pageId: string, isLocked: boolean) => void
}

interface ContextMenuState {
  isOpen: boolean
  pageId: string | null
  x: number
  y: number
}

interface SortablePageTabProps {
  page: NotePage
  isActive: boolean
  isEditing: boolean
  editValue: string
  placeholder: string
  onClick: () => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onEditChange: (value: string) => void
  onEditFinish: () => void
  onEditKeyDown: (e: React.KeyboardEvent) => void
}

function SortablePageTab({
  page,
  isActive,
  isEditing,
  editValue,
  placeholder,
  onClick,
  onDoubleClick,
  onContextMenu,
  onEditChange,
  onEditFinish,
  onEditKeyDown,
}: SortablePageTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled: isEditing })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      className={`page-tab ${isActive ? 'active' : ''}`}
      onClick={() => {
        if (!isEditing && !isDragging) onClick()
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      {...(isEditing ? {} : { ...attributes, ...listeners })}
    >
      {isEditing ? (
        <input
          type="text"
          className="page-tab-input"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onEditFinish}
          onKeyDown={onEditKeyDown}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
          placeholder={placeholder}
        />
      ) : (
        <>
          {page.isLocked && <IoLockClosed className="page-tab-lock-icon" aria-hidden />}
          <span className="page-tab-title">{page.title}</span>
        </>
      )}

      {isActive && !isDragging && (
        <motion.div
          layoutId="activePageTab"
          className="page-tab-indicator"
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
    </div>
  )
}

export function PageTabs({
  noteId,
  pages,
  activePageId,
  onPageChange,
  onPageDelete,
  onPageRename,
  onPageReorder,
  onPageLockToggle,
}: PageTabsProps) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    pageId: null,
    x: 0,
    y: 0,
  })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, isOpen: false }))
      }
    }
    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contextMenu.isOpen])

  const handleContextMenu = useCallback((e: React.MouseEvent, pageId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      isOpen: true,
      pageId,
      x: e.clientX,
      y: e.clientY,
    })
  }, [])

  const handleStartEdit = useCallback((pageId: string) => {
    const page = pages.find((p) => p.id === pageId)
    if (page) {
      setEditingId(page.id)
      setEditValue(page.title)
    }
    setContextMenu((prev) => ({ ...prev, isOpen: false }))
  }, [pages])

  const handleFinishEdit = useCallback(
    (pageId: string) => {
      const trimmed = editValue.trim()
      const original = pages.find((p) => p.id === pageId)?.title
      if (trimmed && trimmed !== original) {
        onPageRename(pageId, trimmed)
      }
      setEditingId(null)
      setEditValue('')
    },
    [editValue, pages, onPageRename]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, pageId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleFinishEdit(pageId)
      } else if (e.key === 'Escape') {
        setEditingId(null)
        setEditValue('')
      }
    },
    [handleFinishEdit]
  )

  const handleDelete = useCallback(
    (pageId: string) => {
      setContextMenu((prev) => ({ ...prev, isOpen: false }))
      if (pages.length > 1) {
        onPageDelete(pageId)
      }
    },
    [pages.length, onPageDelete]
  )

  const handleLockToggle = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return
      setContextMenu((prev) => ({ ...prev, isOpen: false }))
      onPageLockToggle(pageId, !page.isLocked)
    },
    [pages, onPageLockToggle]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = pages.findIndex((p) => p.id === active.id)
      const newIndex = pages.findIndex((p) => p.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return

      const reordered = arrayMove(pages, oldIndex, newIndex)
      onPageReorder(reordered)
    },
    [pages, onPageReorder]
  )

  return (
    <>
      <div className="page-tabs-wrapper" key={noteId}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={pages.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-stretch gap-0.5">
              {pages.map((page) => (
                <SortablePageTab
                  key={page.id}
                  page={page}
                  isActive={activePageId === page.id}
                  isEditing={editingId === page.id}
                  editValue={editValue}
                  placeholder={t('pages.untitled')}
                  onClick={() => onPageChange(page.id)}
                  onDoubleClick={() => handleStartEdit(page.id)}
                  onContextMenu={(e) => handleContextMenu(e, page.id)}
                  onEditChange={setEditValue}
                  onEditFinish={() => handleFinishEdit(page.id)}
                  onEditKeyDown={(e) => handleKeyDown(e, page.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <AnimatePresence>
        {contextMenu.isOpen && contextMenu.pageId && (
          <motion.div
            ref={contextMenuRef}
            className="page-context-menu"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000,
            }}
          >
            {(() => {
              const targetPage = pages.find((p) => p.id === contextMenu.pageId)
              const locked = targetPage?.isLocked ?? false
              return (
                <>
                  <button
                    className="page-context-menu-item"
                    onClick={() => handleStartEdit(contextMenu.pageId!)}
                    disabled={locked}
                  >
                    <IoPencil />
                    <span>{t('pages.rename')}</span>
                  </button>
                  <button
                    className="page-context-menu-item"
                    onClick={() => handleLockToggle(contextMenu.pageId!)}
                  >
                    {locked ? <IoLockOpen /> : <IoLockClosed />}
                    <span>{locked ? t('pages.unlock') : t('pages.lock')}</span>
                  </button>
                  {pages.length > 1 && (
                    <button
                      className="page-context-menu-item danger"
                      onClick={() => handleDelete(contextMenu.pageId!)}
                      disabled={locked}
                    >
                      <IoTrashOutline />
                      <span>{t('pages.delete')}</span>
                    </button>
                  )}
                </>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
