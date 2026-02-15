import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IoCloseOutline, IoChevronDownOutline, IoFolderOutline, IoDocumentTextOutline } from 'react-icons/io5'
import type { Spark } from '@onyka/shared'
import type { FolderTreeItem } from '@/services/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ConvertToNoteModalProps {
  isOpen: boolean
  spark: Spark | null
  folders: FolderTreeItem[]
  onClose: () => void
  onConvert: (options: { title: string; folderId: string | null }) => void
}

function flattenFolders(folders: FolderTreeItem[], depth = 0): { folder: FolderTreeItem; depth: number }[] {
  const result: { folder: FolderTreeItem; depth: number }[] = []
  for (const folder of folders) {
    result.push({ folder, depth })
    if (folder.children.length > 0) {
      result.push(...flattenFolders(folder.children, depth + 1))
    }
  }
  return result
}

export function ConvertToNoteModal({ isOpen, spark, folders, onClose, onConvert }: ConvertToNoteModalProps) {
  const { t } = useTranslation()
  const folderButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const focusTrapRef = useFocusTrap(isOpen)

  const [title, setTitle] = useState('')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [showFolderDropdown, setShowFolderDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (spark) {
      const defaultTitle = spark.content.slice(0, 50) + (spark.content.length > 50 ? '...' : '')
      setTitle(defaultTitle)
    }
  }, [spark])

  useEffect(() => {
    if (!isOpen) {
      setTitle('')
      setFolderId(null)
      setShowFolderDropdown(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFolderDropdown) {
          setShowFolderDropdown(false)
        } else {
          e.stopPropagation()
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose, showFolderDropdown])

  useEffect(() => {
    if (!showFolderDropdown) return

    // Skip the first event to avoid closing immediately when opening
    let isFirstEvent = true

    const handleClick = (e: MouseEvent) => {
      if (isFirstEvent) {
        isFirstEvent = false
        return
      }

      const target = e.target as Node
      if (
        (folderButtonRef.current && folderButtonRef.current.contains(target)) ||
        (dropdownRef.current && dropdownRef.current.contains(target))
      ) {
        return
      }
      setShowFolderDropdown(false)
    }

    document.addEventListener('mousedown', handleClick, true)
    return () => {
      document.removeEventListener('mousedown', handleClick, true)
    }
  }, [showFolderDropdown])

  useEffect(() => {
    if (showFolderDropdown && folderButtonRef.current) {
      const rect = folderButtonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [showFolderDropdown])

  const flatFolders = flattenFolders(folders)

  const selectedFolder = folderId ? flatFolders.find((f) => f.folder.id === folderId)?.folder : null

  const handleSelectFolder = useCallback((id: string | null) => {
    setFolderId(id)
    setShowFolderDropdown(false)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await onConvert({ title: title.trim() || 'Untitled', folderId })
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, title, folderId, onConvert])

  if (!isOpen || !spark) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label={t('sparks.convert_modal_title')} className="relative w-full max-w-lg bg-[var(--color-bg-elevated)] rounded-2xl border border-[var(--color-border)] shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--color-accent)]/10">
              <IoDocumentTextOutline className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {t('sparks.convert_modal_title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {t('sparks.note_title')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
              placeholder={t('editor.untitled')}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {t('sparks.folder')}
            </label>
            <button
              ref={folderButtonRef}
              onClick={() => setShowFolderDropdown(!showFolderDropdown)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] hover:border-[var(--color-border)] transition-colors"
            >
              <span className="flex items-center gap-2">
                <IoFolderOutline className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                {selectedFolder ? selectedFolder.name : t('sparks.no_folder')}
              </span>
              <IoChevronDownOutline className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${showFolderDropdown ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSubmitting ? '...' : t('sparks.convert')}
          </button>
        </div>
      </div>

      {showFolderDropdown && createPortal(
        <div
          ref={dropdownRef}
          className="fixed max-h-48 overflow-y-auto bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-2xl z-[200]"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          <button
            onClick={() => handleSelectFolder(null)}
            className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors ${
              folderId === null ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'text-[var(--color-text-secondary)]'
            }`}
          >
            {t('sparks.no_folder')}
          </button>
          {flatFolders.map(({ folder, depth }) => (
            <button
              key={folder.id}
              onClick={() => handleSelectFolder(folder.id)}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                folderId === folder.id ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'text-[var(--color-text-primary)]'
              }`}
              style={{ paddingLeft: `${16 + depth * 16}px` }}
            >
              <IoFolderOutline className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              {folder.name}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
