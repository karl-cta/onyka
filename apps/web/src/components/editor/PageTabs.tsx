import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { IoPencil, IoTrashOutline } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import type { NotePage } from '@onyka/shared'

interface PageTabsProps {
  noteId: string
  pages: NotePage[]
  activePageId: string
  onPageChange: (pageId: string) => void
  onPageDelete: (pageId: string) => void
  onPageRename: (pageId: string, newTitle: string) => void
  onPageReorder: (reorderedPages: NotePage[]) => void
}

interface ContextMenuState {
  isOpen: boolean
  pageId: string | null
  x: number
  y: number
}

export function PageTabs({
  pages,
  activePageId,
  onPageChange,
  onPageDelete,
  onPageRename,
  onPageReorder,
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

  return (
    <>
      <div className="page-tabs-wrapper">
        <Reorder.Group
          axis="x"
          values={pages}
          onReorder={onPageReorder}
          className="flex items-stretch gap-0.5"
        >
          <AnimatePresence mode="popLayout">
            {pages.map((page, index) => (
              <Reorder.Item
                key={page.id}
                value={page}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, delay: index * 0.02 }}
                className={`page-tab ${activePageId === page.id ? 'active' : ''}`}
                onClick={() => {
                  if (editingId !== page.id) {
                    onPageChange(page.id)
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, page.id)}
                onDoubleClick={() => handleStartEdit(page.id)}
                whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-md)' }}
              >
                {editingId === page.id ? (
                  <input
                    type="text"
                    className="page-tab-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFinishEdit(page.id)}
                    onKeyDown={(e) => handleKeyDown(e, page.id)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    placeholder={t('pages.untitled')}
                  />
                ) : (
                  <span className="page-tab-title">{page.title}</span>
                )}

                {/* Accent indicator — animated between tabs */}
                {activePageId === page.id && (
                  <motion.div
                    layoutId="activePageTab"
                    className="page-tab-indicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>

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
            <button
              className="page-context-menu-item"
              onClick={() => handleStartEdit(contextMenu.pageId!)}
            >
              <IoPencil />
              <span>{t('pages.rename')}</span>
            </button>
            {pages.length > 1 && (
              <button
                className="page-context-menu-item danger"
                onClick={() => handleDelete(contextMenu.pageId!)}
              >
                <IoTrashOutline />
                <span>{t('pages.delete')}</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

