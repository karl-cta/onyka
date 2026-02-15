import { useState, useCallback, useRef, useEffect } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import {
  IoColorPaletteOutline,
  IoLinkOutline,
  IoListOutline,
  IoCheckboxOutline,
  IoCodeOutline,
  IoChatbubbleOutline,
  IoCloseOutline,
} from 'react-icons/io5'
import { ToolbarButton, ToolbarDivider } from './ToolbarButton'
import { COLORS, HIGHLIGHT_COLORS, AlignLeftIcon, AlignCenterIcon, AlignRightIcon } from './editorConstants'
import { useIsMobile } from '../../hooks/useIsMobile'

interface EditorBubbleMenuProps {
  editor: Editor
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)

  const bubbleMenuRef = useRef<HTMLDivElement>(null)
  const setMenuRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      ;(bubbleMenuRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      // Smooth repositioning when alignment/format changes move the selection
      el.style.transition = 'left 150ms cubic-bezier(0.16, 1, 0.3, 1), top 150ms cubic-bezier(0.16, 1, 0.3, 1)'
    }
  }, [])

  const setLink = useCallback(() => {
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  const openLinkInput = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href || ''
    setLinkUrl(previousUrl)
    setShowLinkInput(true)
  }, [editor])

  // Reset sub-menus when selection changes (prevents stale picker state on re-select)
  useEffect(() => {
    const handleSelectionUpdate = () => {
      setShowColorPicker(false)
      setShowHighlightPicker(false)
    }
    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => { editor.off('selectionUpdate', handleSelectionUpdate) }
  }, [editor])

  // Hide smooth caret when a picker is open (caret is in a separate stacking context)
  useEffect(() => {
    if (!editor.isEditable || editor.isDestroyed) return
    const container = editor.view.dom.closest('.smooth-caret') as HTMLElement | null
    if (!container) return
    const carets = container.querySelectorAll<HTMLElement>('.smooth-caret-cursor')
    carets.forEach(el => {
      el.style.visibility = (showColorPicker || showHighlightPicker) ? 'hidden' : ''
    })
  }, [showColorPicker, showHighlightPicker, editor])

  return (
    <BubbleMenu
      ref={setMenuRef}
      editor={editor}
      shouldShow={({ editor }) => {
        const { selection } = editor.state
        if (selection.empty) return false

        const node = editor.state.doc.nodeAt(selection.from)
        if (node?.type.name === 'image') return false

        // Hide bubble menu inside code blocks (they have their own editing)
        if (editor.isActive('codeBlock')) return false

        // Hide bubble menu when inside a table (TableToolbar handles it)
        const { $from } = selection
        for (let depth = $from.depth; depth > 0; depth--) {
          const nodeName = $from.node(depth).type.name
          if (nodeName === 'table') return false
        }

        return true
      }}
      updateDelay={100}
      options={{
        placement: 'top',
        flip: { fallbackPlacements: ['bottom'] },
        offset: 8,
      }}
      className={`flex items-center gap-0.5 px-2 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg backdrop-blur-sm animate-scale-in${isMobile ? ' bubble-menu-mobile' : ''}`}
    >
      {showLinkInput ? (
        <div className="flex items-center gap-2">
          <input
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setLink()}
            className={`px-2 py-1 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] ${isMobile ? 'w-36' : 'w-48'}`}
            autoFocus
          />
          <button
            onClick={setLink}
            className="px-2 py-1 text-sm font-medium bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setShowLinkInput(false)}
            className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title={t('editor.bold_shortcut')}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[13px] font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title={t('editor.italic_shortcut')}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[13px] font-semibold italic">I</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title={t('editor.underline_shortcut')}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[13px] font-medium underline underline-offset-2">U</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title={t('editor.strikethrough')}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[13px] font-medium line-through">S</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title={t('editor.code')}
          >
            <IoCodeOutline className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <div className="relative">
            <ToolbarButton
              onClick={() => {
                setShowHighlightPicker(!showHighlightPicker)
                setShowColorPicker(false)
              }}
              active={editor.isActive('highlight')}
              title={t('editor.highlight')}
            >
              <IoColorPaletteOutline className="w-4 h-4" />
            </ToolbarButton>
            {showHighlightPicker && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => setShowHighlightPicker(false)} />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl flex gap-1.5 z-50 animate-fade-in">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => {
                        if (color.value) {
                          editor.chain().focus().toggleHighlight({ color: color.value }).run()
                        } else {
                          editor.chain().focus().unsetHighlight().run()
                        }
                        setShowHighlightPicker(false)
                      }}
                      className="w-7 h-7 rounded-lg border-2 border-transparent hover:border-[var(--color-accent)] hover:scale-110 transition-all"
                      style={{ backgroundColor: color.value || 'var(--color-bg-tertiary)' }}
                      title={color.name}
                    >
                      {!color.value && <IoCloseOutline className="w-4 h-4 mx-auto text-[var(--color-text-tertiary)]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <ToolbarButton
              onClick={() => {
                setShowColorPicker(!showColorPicker)
                setShowHighlightPicker(false)
              }}
              active={editor.isActive('textStyle')}
              title={t('editor.text_color')}
            >
              <span className="w-4 h-4 flex items-center justify-center text-[13px] font-bold">A</span>
            </ToolbarButton>
            {showColorPicker && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => setShowColorPicker(false)} />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl flex gap-1.5 z-50 animate-fade-in">
                  {COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => {
                        if (color.value) {
                          editor.chain().focus().setColor(color.value).run()
                        } else {
                          editor.chain().focus().unsetColor().run()
                        }
                        setShowColorPicker(false)
                      }}
                      className="w-7 h-7 rounded-lg border-2 border-transparent hover:border-[var(--color-accent)] hover:scale-110 transition-all flex items-center justify-center"
                      style={{ backgroundColor: color.value || 'var(--color-bg-tertiary)' }}
                      title={color.name}
                    >
                      {!color.value && <IoCloseOutline className="w-4 h-4 text-[var(--color-text-tertiary)]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <ToolbarButton
            onClick={openLinkInput}
            active={editor.isActive('link')}
            title={t('editor.add_link')}
          >
            <IoLinkOutline className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title={t('editor.heading1')}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[11px] font-bold">H1</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title={t('editor.heading2')}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[11px] font-bold">H2</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title={t('editor.heading3')}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[11px] font-bold">H3</span>
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title={t('editor.bullet_list')}
          >
            <IoListOutline className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title={t('editor.numbered_list')}
          >
            <span className="w-4 h-4 flex items-center justify-center text-[11px] font-medium">1.</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive('taskList')}
            title={t('editor.todo_list')}
          >
            <IoCheckboxOutline className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title={t('editor.quote')}
          >
            <IoChatbubbleOutline className="w-4 h-4" />
          </ToolbarButton>

          {!isMobile && (
            <>
              <ToolbarDivider />

              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                active={editor.isActive({ textAlign: 'left' })}
                title={t('editor.align_left')}
              >
                <AlignLeftIcon />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                active={editor.isActive({ textAlign: 'center' })}
                title={t('editor.align_center')}
              >
                <AlignCenterIcon />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                active={editor.isActive({ textAlign: 'right' })}
                title={t('editor.align_right')}
              >
                <AlignRightIcon />
              </ToolbarButton>
            </>
          )}
        </>
      )}
    </BubbleMenu>
  )
}
