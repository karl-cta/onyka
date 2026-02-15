import { useTranslation } from 'react-i18next'
import { IoDocumentsOutline } from 'react-icons/io5'
import { getIconByName, isEmoji } from '@/utils/icons'
import type { FolderTreeItem } from '@/services/api'
import type { FolderNote } from '@onyka/shared'

interface DragOverlayContentProps {
  item: {
    type: 'folder' | 'note'
    data: FolderTreeItem | FolderNote
  }
  /** Number of additional items being dragged (for multi-drag) */
  additionalCount?: number
}

function renderIconOrEmoji(iconValue: string, className: string) {
  if (isEmoji(iconValue)) {
    return <span className={`${className} flex items-center justify-center text-base leading-none`}>{iconValue}</span>
  }
  const Icon = getIconByName(iconValue)
  return <Icon className={className} />
}

export function DragOverlayContent({ item, additionalCount = 0 }: DragOverlayContentProps) {
  const { t } = useTranslation()
  const isMultiDrag = additionalCount > 0
  const totalCount = additionalCount + 1

  if (isMultiDrag) {
    return (
      <div className="relative">
        <div className="absolute top-1 left-1 w-full h-full rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] opacity-60" />
        <div className="absolute top-0.5 left-0.5 w-full h-full rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] opacity-80" />

        <div className="relative drag-overlay-item flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-accent)]/30 shadow-xl">
          <IoDocumentsOutline className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('sidebar.dragging_multiple', { count: totalCount })}
          </span>
          <span className="text-xs font-semibold text-white bg-[var(--color-accent)] px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {totalCount}
          </span>
        </div>
      </div>
    )
  }

  if (item.type === 'folder') {
    const folder = item.data as FolderTreeItem
    const iconValue = folder.icon || 'Folder'

    return (
      <div className="drag-overlay-item flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-accent)]/30 shadow-xl">
        {renderIconOrEmoji(iconValue, 'w-4 h-4 text-[var(--color-accent)]')}
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {folder.name}
        </span>
        {folder.noteCount > 0 && (
          <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 rounded">
            {folder.noteCount}
          </span>
        )}
      </div>
    )
  }

  const note = item.data as FolderNote

  return (
    <div className="drag-overlay-item flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-accent)]/30 shadow-xl">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">
        {note.title || t('editor.untitled')}
      </span>
    </div>
  )
}
