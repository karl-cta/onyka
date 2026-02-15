import { useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { IoTrashOutline, IoSquareOutline } from 'react-icons/io5'
import { ToolbarButton, ToolbarDivider } from './ToolbarButton'
import { AlignLeftIcon, AlignCenterIcon, AlignRightIcon } from './editorConstants'
import type { ImageAlignment, ImageBorderStyle } from './extensions/CustomImage'
import { useIsMobile } from '../../hooks/useIsMobile'

interface ImageNodeState {
  pos: number
  attrs: { align: ImageAlignment; width: string | null; borderStyle: ImageBorderStyle }
  rect: { top: number; left: number; width: number } | null
}

interface ImageToolbarProps {
  editor: Editor
  imageNode: ImageNodeState
  containerWidth: number
  onImageNodeChange: (updater: (prev: ImageNodeState | null) => ImageNodeState | null) => void
}

const IMAGE_BORDER_STYLES_CONFIG: { value: ImageBorderStyle; icon: string; labelKey: string }[] = [
  { value: 'none', icon: '○', labelKey: 'editor.border_none' },
  { value: 'simple', icon: '□', labelKey: 'editor.border_simple' },
  { value: 'thick', icon: '▣', labelKey: 'editor.border_thick' },
  { value: 'rounded', icon: '◎', labelKey: 'editor.border_rounded' },
  { value: 'shadow', icon: '◫', labelKey: 'editor.border_shadow' },
  { value: 'polaroid', icon: '▭', labelKey: 'editor.border_polaroid' },
]

export function ImageToolbar({ editor, imageNode, containerWidth, onImageNodeChange }: ImageToolbarProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [showSizeMenu, setShowSizeMenu] = useState(false)
  const [showBorderMenu, setShowBorderMenu] = useState(false)

  const IMAGE_SIZES = [
    { label: '25%', value: '25%' },
    { label: '50%', value: '50%' },
    { label: '75%', value: '75%' },
    { label: '100%', value: '100%' },
    { label: t('editor.image_auto', 'Auto'), value: null },
  ]

  const IMAGE_BORDER_STYLES = IMAGE_BORDER_STYLES_CONFIG.map((s) => ({
    ...s,
    label: t(s.labelKey, s.value.charAt(0).toUpperCase() + s.value.slice(1)),
  }))

  const handleAlign = useCallback(
    (align: ImageAlignment) => {
      editor.chain().focus().setImageAlign(align).run()
      onImageNodeChange((prev) => (prev ? { ...prev, attrs: { ...prev.attrs, align } } : null))
    },
    [editor, onImageNodeChange]
  )

  const handleWidth = useCallback(
    (width: string | null) => {
      if (width) {
        editor.chain().focus().setImageWidth(width).run()
      } else {
        editor.chain().focus().updateAttributes('image', { width: null }).run()
      }
      onImageNodeChange((prev) => (prev ? { ...prev, attrs: { ...prev.attrs, width } } : null))
      setShowSizeMenu(false)
    },
    [editor, onImageNodeChange]
  )

  const handleBorder = useCallback(
    (style: ImageBorderStyle) => {
      editor.chain().focus().setImageBorder(style).run()
      onImageNodeChange((prev) =>
        prev ? { ...prev, attrs: { ...prev.attrs, borderStyle: style } } : null
      )
      setShowBorderMenu(false)
    },
    [editor, onImageNodeChange]
  )

  const handleDelete = useCallback(() => {
    editor.chain().focus().deleteSelection().run()
    onImageNodeChange(() => null)
  }, [editor, onImageNodeChange])

  if (!imageNode.rect) return null

  const toolbarWidth = isMobile ? 200 : 320
  const effectiveContainerWidth = isMobile
    ? Math.min(containerWidth, window.innerWidth)
    : containerWidth
  const imageCenterX = imageNode.rect.left + imageNode.rect.width / 2

  let leftPos = imageCenterX
  let transformX = '-50%'

  if (imageCenterX - toolbarWidth / 2 < 8) {
    leftPos = 8
    transformX = '0'
  } else if (imageCenterX + toolbarWidth / 2 > effectiveContainerWidth - 8) {
    leftPos = effectiveContainerWidth - 8
    transformX = '-100%'
  }

  return (
    <div
      className={`absolute z-50 flex items-center gap-1 px-2 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg backdrop-blur-sm animate-scale-in${isMobile ? ' editor-toolbar-mobile' : ''}`}
      style={{
        top: Math.max(8, imageNode.rect.top - 52),
        left: leftPos,
        transform: `translateX(${transformX})`,
      }}
    >
      <ToolbarButton
        onClick={() => handleAlign('left')}
        active={imageNode.attrs.align === 'left'}
        title={t('editor.image_align_left', 'Align left')}
      >
        <AlignLeftIcon />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => handleAlign('center')}
        active={imageNode.attrs.align === 'center'}
        title={t('editor.image_align_center', 'Align center')}
      >
        <AlignCenterIcon />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => handleAlign('right')}
        active={imageNode.attrs.align === 'right'}
        title={t('editor.image_align_right', 'Align right')}
      >
        <AlignRightIcon />
      </ToolbarButton>

      <ToolbarDivider />

      <div className="relative">
        <button
          onClick={() => setShowSizeMenu(!showSizeMenu)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          {imageNode.attrs.width || t('editor.image_auto', 'Auto')}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2.5 4L5 6.5L7.5 4" />
          </svg>
        </button>
        {showSizeMenu && (
          <div className="absolute top-full left-0 mt-1 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 min-w-20">
            {IMAGE_SIZES.map((size) => (
              <button
                key={size.value || 'auto'}
                onClick={() => handleWidth(size.value)}
                className={`w-full px-3 py-1.5 text-xs text-left transition-colors ${
                  imageNode.attrs.width === size.value
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ToolbarDivider />

      <div className="relative">
        <button
          onClick={() => setShowBorderMenu(!showBorderMenu)}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
            imageNode.attrs.borderStyle !== 'none'
              ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
          }`}
          title={t('editor.image_border', 'Border style')}
        >
          <IoSquareOutline className="w-4 h-4" />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2.5 4L5 6.5L7.5 4" />
          </svg>
        </button>
        {showBorderMenu && (
          <div className="absolute top-full left-0 mt-1 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 min-w-28">
            {IMAGE_BORDER_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => handleBorder(style.value)}
                className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 transition-colors ${
                  imageNode.attrs.borderStyle === style.value
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                }`}
              >
                <span className="w-4 text-center">{style.icon}</span>
                {style.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ToolbarDivider />

      <ToolbarButton
        onClick={handleDelete}
        title={t('editor.image_delete', 'Delete image')}
      >
        <IoTrashOutline className="w-4 h-4 text-red-500" />
      </ToolbarButton>
    </div>
  )
}

export type { ImageNodeState }
