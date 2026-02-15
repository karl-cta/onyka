import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IoFolderOutline,
  IoTrashOutline,
  IoClose,
  IoDocumentOutline,
} from 'react-icons/io5'
import type { FolderTreeItem } from '@/services/api'

interface SelectionActionBarProps {
  selectedNoteIds: string[]
  selectedFolderIds: string[]
  folderTree: FolderTreeItem[]
  sidebarWidth: number
  onMoveToFolder: (folderId: string | null) => void
  onDelete: () => void
  onClearSelection: () => void
}

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

export function SelectionActionBar({
  selectedNoteIds,
  selectedFolderIds,
  folderTree,
  sidebarWidth,
  onMoveToFolder,
  onDelete,
  onClearSelection,
}: SelectionActionBarProps) {
  const { t } = useTranslation()
  const [showFolderDropdown, setShowFolderDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const noteCount = selectedNoteIds.length
  const folderCount = selectedFolderIds.length
  const totalSelected = noteCount + folderCount
  const isVisible = totalSelected > 0

  const canMoveToFolder = noteCount > 0 && folderCount === 0

  const flatFolders = flattenFolders(folderTree)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowFolderDropdown(false)
      }
    }

    if (showFolderDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFolderDropdown])

  // Dismiss selection when clicking outside sidebar, action bar, dropdowns, and modals
  useEffect(() => {
    if (!isVisible) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (barRef.current?.contains(target)) return
      const sidebar = document.querySelector('aside, nav[aria-label="File tree"]')
      if (sidebar?.contains(target)) return
      if (target.closest('[data-note-item], [data-folder-item]')) return
      if (dropdownRef.current?.contains(target)) return
      if (target.closest('[role="dialog"], .fixed.inset-0')) return
      onClearSelection()
    }

    // Delay to avoid triggering on the click that initiated selection
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible, onClearSelection])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFolderDropdown) {
        setShowFolderDropdown(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showFolderDropdown])

  const getSelectionLabel = () => {
    if (noteCount > 0 && folderCount > 0) {
      return `${noteCount + folderCount}`
    }
    return `${totalSelected}`
  }

  const leftPosition = sidebarWidth + 24

  const content = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={barRef}
          initial={{ x: -20, opacity: 0, scale: 0.95 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: -20, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed top-1/2 -translate-y-1/2 z-50 hidden md:block"
          style={{ left: `${leftPosition}px` }}
        >
          <div
            className="
              flex flex-col items-center gap-1 p-2
              bg-[var(--color-bg-elevated)] backdrop-blur-xl
              rounded-2xl shadow-lg shadow-black/20
              border border-[var(--color-border)]
            "
          >
            <div className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 mb-1">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-accent)]">
                <span className="text-xs font-bold text-white">
                  {getSelectionLabel()}
                </span>
              </div>
            </div>

            <div className="w-6 h-px bg-[var(--color-border)]" />

            {canMoveToFolder && (
              <div className="relative">
                <button
                  ref={buttonRef}
                  onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                  className={`
                    flex items-center justify-center w-9 h-9 rounded-xl
                    text-[var(--color-text-secondary)]
                    hover:text-[var(--color-accent)]
                    hover:bg-[var(--color-accent)]/10
                    transition-all duration-150
                    ${showFolderDropdown ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : ''}
                  `}
                  title={t('sidebar.move_to_folder')}
                >
                  <IoFolderOutline className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {showFolderDropdown && (
                    <motion.div
                      ref={dropdownRef}
                      initial={{ opacity: 0, x: -8, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="
                        absolute left-full top-0 ml-2 min-w-[180px] max-h-[280px]
                        overflow-y-auto scrollbar-none
                        bg-[var(--color-bg-elevated)] backdrop-blur-xl
                        rounded-xl shadow-xl shadow-black/20
                        border border-[var(--color-border)]
                        py-1
                      "
                    >
                      <button
                        onClick={() => {
                          onMoveToFolder(null)
                          setShowFolderDropdown(false)
                        }}
                        className="
                          w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                          text-[var(--color-text-secondary)]
                          hover:text-[var(--color-text-primary)]
                          hover:bg-[var(--color-bg-tertiary)]
                          transition-colors
                        "
                      >
                        <IoDocumentOutline className="w-4 h-4 opacity-60" />
                        <span>{t('sidebar.move_to_root', 'Racine')}</span>
                      </button>

                      {flatFolders.length > 0 && (
                        <div className="h-px bg-[var(--color-border)] my-1" />
                      )}

                      {flatFolders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => {
                            onMoveToFolder(folder.id)
                            setShowFolderDropdown(false)
                          }}
                          className="
                            w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                            text-[var(--color-text-secondary)]
                            hover:text-[var(--color-text-primary)]
                            hover:bg-[var(--color-bg-tertiary)]
                            transition-colors
                          "
                          style={{ paddingLeft: `${12 + folder.level * 12}px` }}
                        >
                          <IoFolderOutline className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                          <span className="truncate">{folder.name}</span>
                        </button>
                      ))}

                      {flatFolders.length === 0 && (
                        <div className="px-3 py-2 text-sm text-[var(--color-text-tertiary)]">
                          {t('sidebar.no_folders', 'Aucun dossier')}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              onClick={onDelete}
              className="
                flex items-center justify-center w-9 h-9 rounded-xl
                text-[var(--color-text-secondary)]
                hover:text-[var(--color-error)]
                hover:bg-[var(--color-error)]/10
                transition-all duration-150
              "
              title={t('common.delete')}
            >
              <IoTrashOutline className="w-5 h-5" />
            </button>

            <div className="w-6 h-px bg-[var(--color-border)]" />

            <button
              onClick={onClearSelection}
              className="
                flex items-center justify-center w-9 h-9 rounded-xl
                text-[var(--color-text-tertiary)]
                hover:text-[var(--color-text-primary)]
                hover:bg-[var(--color-bg-tertiary)]
                transition-all duration-150
              "
              title={`${t('common.close')} (Esc)`}
            >
              <IoClose className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}
