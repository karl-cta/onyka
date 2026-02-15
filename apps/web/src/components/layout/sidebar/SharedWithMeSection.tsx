import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  IoPeopleOutline,
  IoChevronDown,
  IoEllipsisHorizontal,
  IoCreateOutline,
} from 'react-icons/io5'
import { ShareDialog } from '@/components/features'
import { useSharesStore, type SharedNote } from '@/stores/shares'
import { useThemeStore } from '@/stores/theme'
import { notesApi } from '@/services/api'
import { getAvatarRingClass } from '@/utils/avatar'

interface SharedWithMeSectionProps {
  selectedNoteId: string | null
  onSelectNote: (noteId: string) => void
}

const PERMISSION_COLORS: Record<string, string> = {
  read: 'bg-blue-500/20 text-blue-400',
  edit: 'bg-green-500/20 text-green-400',
  admin: 'bg-purple-500/20 text-purple-400',
}

function SharedNoteItem({
  note,
  isSelected,
  onSelect,
  onNoteUpdated,
}: {
  note: SharedNote
  isSelected: boolean
  onSelect: () => void
  onNoteUpdated: () => void
}) {
  const { t } = useTranslation()
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(note.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const canEdit = note.permission === 'edit' || note.permission === 'admin'
  const canShare = note.permission === 'admin'

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
  }

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    closeMenu()
    setRenameValue(note.title)
    setIsRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleConfirmRename = async () => {
    if (renameValue.trim() && renameValue !== note.title) {
      await notesApi.update(note.id, { title: renameValue.trim() })
      onNoteUpdated()
    }
    setIsRenaming(false)
  }

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-lg overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={() => void handleConfirmRename()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleConfirmRename()
            if (e.key === 'Escape') setIsRenaming(false)
          }}
          className="flex-1 min-w-0 px-2 py-0.5 text-[12px] bg-[var(--color-bg-tertiary)] border border-[var(--color-accent)] rounded-md text-[var(--color-text-primary)] focus:outline-none"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )
  }

  return (
    <div
      onClick={onSelect}
      onContextMenu={(e) => {
        if (!canEdit) return
        e.preventDefault()
        openMenu(e.clientX, e.clientY)
      }}
      className={`
        group w-full flex items-center gap-2 px-2.5 py-1 rounded-lg relative
        text-left transition-all duration-150 ease-out cursor-pointer
        ${isSelected
          ? 'bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80 hover:text-[var(--color-text-primary)]'
        }
      `}
    >
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-[var(--color-accent)]" />
      )}

      <span className={`truncate text-[12px] flex-1 ${isSelected ? 'font-medium' : ''}`}>
        {note.title || t('editor.untitled')}
      </span>

      <span className={`text-[9px] px-1.5 py-px rounded font-medium leading-tight ${PERMISSION_COLORS[note.permission]}`}>
        {t(`share.permission_badge.${note.permission}`)}
      </span>

      {canEdit && (
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
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--color-bg-elevated)] transition-opacity"
        >
          <IoEllipsisHorizontal className="w-3 h-3" />
        </button>
      )}

      {menuPosition && canEdit && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg py-1.5 min-w-[140px] animate-scale-in"
          style={{ top: menuPosition.y, left: menuPosition.x }}
        >
          <button
            onClick={handleStartRename}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <IoCreateOutline className="w-4 h-4" />
            {t('notes.rename')}
          </button>
          {canShare && (
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
          )}
        </div>,
        document.body
      )}

      {canShare && (
        <ShareDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          resourceId={note.id}
          resourceType="note"
          resourceTitle={note.title}
        />
      )}
    </div>
  )
}

export function SharedWithMeSection({ selectedNoteId, onSelectNote }: SharedWithMeSectionProps) {
  const { t } = useTranslation()
  const { sharedWithMe, isLoadingSharedWithMe, fetchSharedWithMe } = useSharesStore()
  const { sharedCollapsed, toggleSharedCollapsed, sharedSectionHeight, setSharedSectionHeight } = useThemeStore()
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set())
  const [isResizing, setIsResizing] = useState(false)
  const resizeStart = useRef({ y: 0, height: 0 })

  useEffect(() => {
    fetchSharedWithMe()
  }, [fetchSharedWithMe])

  const notesByOwner = sharedWithMe.reduce((acc, note) => {
    const ownerId = note.sharedBy.id
    if (!acc[ownerId]) {
      acc[ownerId] = {
        owner: note.sharedBy,
        notes: [],
      }
    }
    acc[ownerId].notes.push(note)
    return acc
  }, {} as Record<string, { owner: SharedNote['sharedBy']; notes: SharedNote[] }>)

  const ownerGroups = Object.values(notesByOwner)

  useEffect(() => {
    if (ownerGroups.length > 0 && expandedOwners.size === 0) {
      setExpandedOwners(new Set(ownerGroups.map(g => g.owner.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerGroups.length])

  const toggleOwner = (ownerId: string) => {
    setExpandedOwners(prev => {
      const next = new Set(prev)
      if (next.has(ownerId)) {
        next.delete(ownerId)
      } else {
        next.add(ownerId)
      }
      return next
    })
  }

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    resizeStart.current = { y: e.clientY, height: sharedSectionHeight }
    setIsResizing(true)
  }, [sharedSectionHeight])

  useEffect(() => {
    if (!isResizing) return

    let rafId = 0
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const delta = resizeStart.current.y - e.clientY
        const newHeight = resizeStart.current.height + delta
        setSharedSectionHeight(newHeight)
      })
    }
    const handleMouseUp = () => {
      cancelAnimationFrame(rafId)
      setIsResizing(false)
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
  }, [isResizing, setSharedSectionHeight])

  if (!isLoadingSharedWithMe && sharedWithMe.length === 0) {
    return null
  }

  return (
    <div className="flex-shrink-0 relative">
      {!sharedCollapsed && (
        <div
          onMouseDown={handleResizeStart}
          className={`
            group absolute -top-0.5 left-0 right-0 h-1 cursor-ns-resize z-20
            flex items-center justify-center
            transition-colors duration-200
            ${isResizing ? 'bg-[var(--color-accent)]/30' : 'hover:bg-[var(--color-accent)]/20'}
          `}
        >
          <div
            className={`
              h-0.5 rounded-full transition-all duration-200
              ${isResizing
                ? 'w-16 bg-[var(--color-accent)]'
                : 'w-8 bg-[var(--color-border)] group-hover:bg-[var(--color-accent)] group-hover:w-16'
              }
            `}
          />
        </div>
      )}

      <button
        onClick={toggleSharedCollapsed}
        className={`
          w-full px-3 flex items-center gap-2 transition-all duration-200 group
          rounded-md cursor-pointer
          ${sharedCollapsed
            ? 'py-2 hover:bg-[var(--color-bg-tertiary)]/50'
            : 'py-1.5 hover:bg-[var(--color-bg-tertiary)]/30'
          }
        `}
      >
        <div className={`
          relative flex items-center justify-center w-5 h-5 rounded-md transition-all duration-200
          ${sharedCollapsed
            ? 'bg-[var(--color-accent)]/10 group-hover:bg-[var(--color-accent)]/20'
            : 'bg-transparent group-hover:bg-[var(--color-accent)]/10'
          }
        `}>
          <IoPeopleOutline className={`
            w-3.5 h-3.5 transition-all duration-200
            ${sharedCollapsed
              ? 'text-[var(--color-accent)]'
              : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)]'
            }
          `} />
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className={`
            text-[11px] font-semibold uppercase tracking-widest transition-colors duration-200
            ${sharedCollapsed
              ? 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-secondary)]'
            }
          `}>
            {t('share.shared_with_me')}
          </span>
          <span className={`
            text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-all duration-200
            ${sharedCollapsed
              ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]'
            }
          `}>
            {sharedWithMe.length}
          </span>
        </div>

        <IoChevronDown className={`
          w-3.5 h-3.5 transition-all duration-300 ease-spring
          ${sharedCollapsed
            ? 'rotate-180 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)]'
            : 'rotate-0 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)]'
          }
        `} />
      </button>

      <div
        className={`
          overflow-hidden
          ${sharedCollapsed ? 'max-h-0 opacity-0 transition-all duration-300 ease-smooth' : 'opacity-100'}
          ${isResizing ? '' : 'transition-all duration-300 ease-smooth'}
        `}
        style={{ maxHeight: sharedCollapsed ? 0 : `${sharedSectionHeight + 8}px` }}
      >
        <div
          className="overflow-y-auto scrollbar-none px-2 pb-2"
          style={{ height: `${sharedSectionHeight}px` }}
        >
          {isLoadingSharedWithMe ? (
            <div className="px-3 py-3 text-center">
              <div className="w-4 h-4 mx-auto border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-0.5">
              {ownerGroups.map(({ owner, notes }) => (
                <div key={owner.id}>
                  <button
                    onClick={() => toggleOwner(owner.id)}
                    className="w-full flex items-center gap-2 px-1 py-1 text-[11px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors rounded-md hover:bg-[var(--color-bg-tertiary)]/50"
                  >
                    <IoChevronDown className={`
                      w-2.5 h-2.5 transition-transform duration-200
                      ${expandedOwners.has(owner.id) ? 'rotate-0' : '-rotate-90'}
                    `} />
                    {owner.avatarUrl ? (
                      <img
                        src={owner.avatarUrl}
                        alt={owner.username}
                        className={`w-4 h-4 rounded-full object-cover ring-1 ${getAvatarRingClass(owner.avatarColor)}`}
                      />
                    ) : (
                      <div className={`w-4 h-4 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-primary)] text-[9px] font-semibold ring-1 ${getAvatarRingClass(owner.avatarColor)}`}>
                        {owner.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="flex-1 text-left truncate">
                      {owner.username}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                      {notes.length}
                    </span>
                  </button>

                  {expandedOwners.has(owner.id) && (
                    <div className="ml-3 space-y-px">
                      {notes.map(note => (
                        <SharedNoteItem
                          key={note.id}
                          note={note}
                          isSelected={selectedNoteId === note.id}
                          onSelect={() => onSelectNote(note.id)}
                          onNoteUpdated={fetchSharedWithMe}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
