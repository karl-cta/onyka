import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { IoTrashOutline } from 'react-icons/io5'
import { ToolbarButton, ToolbarDivider } from './ToolbarButton'
import { Layout11Icon, Layout12Icon, Layout21Icon } from './editorConstants'
import type { ColumnsLayout } from './extensions/Columns'
import { useIsMobile } from '../../hooks/useIsMobile'

interface ColumnsNodeState {
  pos: number
  layout: ColumnsLayout
  rect: { top: number; left: number; width: number } | null
}

interface ColumnsToolbarProps {
  editor: Editor
  columnsNode: ColumnsNodeState
  onColumnsNodeChange: (updater: (prev: ColumnsNodeState | null) => ColumnsNodeState | null) => void
}

export function ColumnsToolbar({ editor, columnsNode, onColumnsNodeChange }: ColumnsToolbarProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  if (!columnsNode.rect) return null

  // Clamp to viewport on mobile
  const toolbarWidth = 180
  const rawLeft = columnsNode.rect.left + columnsNode.rect.width / 2
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
  const clampedLeft = Math.min(
    Math.max(toolbarWidth / 2 + 4, rawLeft),
    viewportWidth - toolbarWidth / 2 - 4
  )

  return (
    <div
      className={`absolute z-50 flex items-center gap-1 px-2 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg backdrop-blur-sm animate-scale-in${isMobile ? ' editor-toolbar-mobile' : ''}`}
      style={{
        top: Math.max(4, columnsNode.rect.top - 44),
        left: clampedLeft,
        transform: 'translateX(-50%)',
      }}
    >
      <ToolbarButton
        onClick={() => {
          editor.commands.setColumnsLayout('1-1')
          onColumnsNodeChange((prev) => prev ? { ...prev, layout: '1-1' } : null)
        }}
        active={columnsNode.layout === '1-1'}
        title={t('editor.columns_equal', '50 / 50')}
      >
        <Layout11Icon />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          editor.commands.setColumnsLayout('1-2')
          onColumnsNodeChange((prev) => prev ? { ...prev, layout: '1-2' } : null)
        }}
        active={columnsNode.layout === '1-2'}
        title={t('editor.columns_narrow_wide', '33 / 66')}
      >
        <Layout12Icon />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          editor.commands.setColumnsLayout('2-1')
          onColumnsNodeChange((prev) => prev ? { ...prev, layout: '2-1' } : null)
        }}
        active={columnsNode.layout === '2-1'}
        title={t('editor.columns_wide_narrow', '66 / 33')}
      >
        <Layout21Icon />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        onClick={() => editor.commands.unsetColumns()}
        title={t('editor.columns_remove', 'Remove columns')}
      >
        <IoTrashOutline className="w-4 h-4 text-red-500" />
      </ToolbarButton>
    </div>
  )
}

export type { ColumnsNodeState }
