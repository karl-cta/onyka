import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import {
  IoTrashOutline,
  IoRemoveOutline,
} from 'react-icons/io5'
import { ToolbarButton, ToolbarDivider } from './ToolbarButton'
import { useIsMobile } from '../../hooks/useIsMobile'

export interface TableNodeState {
  rect: { top: number; left: number; width: number } | null
}

interface TableToolbarProps {
  editor: Editor
  tableNode: TableNodeState
}

const AddRowBeforeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="5" width="14" height="10" rx="1.5" />
    <line x1="1" y1="10" x2="15" y2="10" />
    <line x1="8" y1="5" x2="8" y2="15" />
    <line x1="8" y1="1" x2="8" y2="4" />
    <line x1="6.5" y1="2.5" x2="9.5" y2="2.5" />
  </svg>
)

const AddRowAfterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="1" width="14" height="10" rx="1.5" />
    <line x1="1" y1="6" x2="15" y2="6" />
    <line x1="8" y1="1" x2="8" y2="11" />
    <line x1="8" y1="12" x2="8" y2="15" />
    <line x1="6.5" y1="13.5" x2="9.5" y2="13.5" />
  </svg>
)

const AddColBeforeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="5" y="1" width="10" height="14" rx="1.5" />
    <line x1="10" y1="1" x2="10" y2="15" />
    <line x1="5" y1="8" x2="15" y2="8" />
    <line x1="1" y1="8" x2="4" y2="8" />
    <line x1="2.5" y1="6.5" x2="2.5" y2="9.5" />
  </svg>
)

const AddColAfterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="1" width="10" height="14" rx="1.5" />
    <line x1="6" y1="1" x2="6" y2="15" />
    <line x1="1" y1="8" x2="11" y2="8" />
    <line x1="12" y1="8" x2="15" y2="8" />
    <line x1="13.5" y1="6.5" x2="13.5" y2="9.5" />
  </svg>
)

export function TableToolbar({ editor, tableNode }: TableToolbarProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  if (!tableNode.rect) return null

  // Clamp left so toolbar doesn't overflow behind sidebar or off-screen
  const toolbarWidth = isMobile ? 200 : 320 // wraps on mobile, narrower effective width
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
  const rawLeft = tableNode.rect.left + tableNode.rect.width / 2
  const clampedLeft = Math.min(
    Math.max(toolbarWidth / 2 + 4, rawLeft),
    viewportWidth - toolbarWidth / 2 - 4
  )

  return (
    <div
      className={`absolute z-50 flex items-center gap-0.5 px-2 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg backdrop-blur-sm animate-scale-in${isMobile ? ' editor-toolbar-mobile' : ''}`}
      style={{
        top: Math.max(4, tableNode.rect.top - 44),
        left: clampedLeft,
        transform: 'translateX(-50%)',
      }}
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().addRowBefore().run()}
        title={t('editor.table_add_row_before', 'Add row above')}
      >
        <AddRowBeforeIcon />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().addRowAfter().run()}
        title={t('editor.table_add_row_after', 'Add row below')}
      >
        <AddRowAfterIcon />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        title={t('editor.table_add_col_before', 'Add column left')}
      >
        <AddColBeforeIcon />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        title={t('editor.table_add_col_after', 'Add column right')}
      >
        <AddColAfterIcon />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={() => editor.chain().focus().deleteRow().run()}
        title={t('editor.table_delete_row', 'Delete row')}
      >
        <IoRemoveOutline className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().deleteColumn().run()}
        title={t('editor.table_delete_col', 'Delete column')}
      >
        <IoRemoveOutline className="w-4 h-4 rotate-90" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        active={false}
        title={t('editor.table_toggle_header', 'Toggle header row')}
      >
        <span className="text-[11px] font-bold">H</span>
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={() => editor.chain().focus().deleteTable().run()}
        title={t('editor.table_delete', 'Delete table')}
      >
        <IoTrashOutline className="w-4 h-4 text-red-500" />
      </ToolbarButton>
    </div>
  )
}
