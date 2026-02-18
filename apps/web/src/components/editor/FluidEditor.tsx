import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Typography from '@tiptap/extension-typography'
import TextAlign from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useEffect, useCallback, useState, useRef, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSmoothCaret, useIsMobile } from '../../hooks'
import { marked } from 'marked'
import { CustomImage } from './extensions/CustomImage'
import { Columns, Column, type ColumnsLayout } from './extensions/Columns'
import { uploadsApi } from '@/services/api'
import { SLASH_MENU_ITEMS, type SlashMenuItem } from './editorConstants'

/** Serialize a ProseMirror node tree to clean plain text for clipboard export.
 *  Handles lists (bullets, numbers, tasks), blockquotes, headings, code blocks,
 *  tables, and normalizes French guillemets (replaces \u00A0 with regular spaces). */
function serializeNodeToText(node: { type: { name: string }; attrs?: Record<string, unknown>; content?: { forEach: (cb: (child: typeof node, offset: number, index: number) => void) => void; childCount: number }; textContent: string }, depth: number = 0): string {
  const name = node.type.name
  const indent = '  '.repeat(depth)

  // Leaf text — normalize non-breaking spaces
  if (name === 'text') {
    return node.textContent.replace(/\u00A0/g, ' ')
  }

  // Collect children text (used by default case and inline nodes)
  const getInnerText = () => {
    const parts: string[] = []
    node.content?.forEach((child) => {
      parts.push(serializeNodeToText(child, depth))
    })
    return parts.join('')
  }

  switch (name) {
    case 'paragraph':
      return getInnerText() + '\n'

    case 'heading':
      return '#'.repeat((node.attrs?.level as number) || 1) + ' ' + getInnerText() + '\n'

    case 'bulletList': {
      const result: string[] = []
      node.content?.forEach((child) => {
        result.push(indent + '- ' + serializeNodeToText(child, depth + 1).trimStart())
      })
      return result.join('')
    }

    case 'orderedList': {
      const result: string[] = []
      let idx = 1
      node.content?.forEach((child) => {
        result.push(indent + idx + '. ' + serializeNodeToText(child, depth + 1).trimStart())
        idx++
      })
      return result.join('')
    }

    case 'listItem':
      return getInnerText()

    case 'taskList': {
      const result: string[] = []
      node.content?.forEach((child) => {
        const checked = child.attrs?.checked ? 'x' : ' '
        result.push(indent + `[${checked}] ` + serializeNodeToText(child, depth + 1).trimStart())
      })
      return result.join('')
    }

    case 'taskItem':
      return getInnerText()

    case 'blockquote': {
      const text = getInnerText()
      const lines = text.split('\n').filter((l) => l !== '')
      return lines.map((l) => indent + '> ' + l).join('\n') + '\n'
    }

    case 'codeBlock':
      return indent + '```\n' + getInnerText() + indent + '```\n'

    case 'horizontalRule':
      return '---\n'

    case 'table': {
      const rows: string[][] = []
      let isHeader = true
      node.content?.forEach((row) => {
        const cells: string[] = []
        row.content?.forEach((cell) => {
          cells.push(serializeNodeToText(cell, 0).trim())
        })
        rows.push(cells)
        if (isHeader && row.content) {
          // Add separator after header row
          let hasHeaderCell = false
          row.content.forEach((cell) => {
            if (cell.type.name === 'tableHeader') hasHeaderCell = true
          })
          if (hasHeaderCell) {
            rows.push(cells.map(() => '---'))
          }
          isHeader = false
        }
      })
      return rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n') + '\n'
    }

    case 'tableRow':
    case 'tableCell':
    case 'tableHeader':
      return getInnerText()

    case 'hardBreak':
      return '\n'

    case 'image':
      return (node.attrs?.alt as string) || ''

    default:
      return getInnerText()
  }
}

/** Detect if plain text looks like markdown (headings, lists, code blocks, tables, etc.) */
function looksLikeMarkdown(text: string): boolean {
  const lines = text.split('\n')
  let mdScore = 0
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) mdScore += 2           // headings
    if (/^```/.test(line)) mdScore += 2                // code fences
    if (/^[-*+]\s/.test(line)) mdScore += 1            // unordered list
    if (/^\d+\.\s/.test(line)) mdScore += 1            // ordered list
    if (/^>\s/.test(line)) mdScore += 1                // blockquote
    if (/\|.+\|/.test(line)) mdScore += 1              // table row
    if (/^-{3,}$/.test(line.trim())) mdScore += 1      // horizontal rule
    if (/\*\*.+\*\*/.test(line)) mdScore += 1          // bold
    if (/\[.+\]\(.+\)/.test(line)) mdScore += 1        // links
    if (/!\[.*\]\(.+\)/.test(line)) mdScore += 1       // images
  }
  return mdScore >= 2
}

/** Clean marked HTML for TipTap */
function cleanMarkdownHtml(html: string): string {
  let cleaned = html
    .replace(/\s*<\/?thead>\s*/g, '')
    .replace(/\s*<\/?tbody>\s*/g, '')
    .replace(/<h([1-6])\s+id="[^"]*">/g, '<h$1>')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<code([^>]*)>([\s\S]*?)\n<\/code>/g, '<code$1>$2</code>')

  // Wrap bare cell content in <p> (TipTap needs block nodes)
  cleaned = cleaned.replace(/<(td|th)>((?:(?!<\/?(?:p|h[1-6]|ul|ol|blockquote|pre)[ >])[\s\S])*?)<\/\1>/g,
    '<$1><p>$2</p></$1>')

  return cleaned
}
import { EditorBubbleMenu } from './EditorBubbleMenu'
import { SlashMenu } from './SlashMenu'
import { ImageToolbar, type ImageNodeState } from './ImageToolbar'
import { ColumnsToolbar, type ColumnsNodeState } from './ColumnsToolbar'
import { TableToolbar, type TableNodeState } from './TableToolbar'

interface FluidEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export const FluidEditor = memo(function FluidEditor({ content, onChange, placeholder = 'Start writing...' }: FluidEditorProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 })
  const [slashFilter, setSlashFilter] = useState('')
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [selectedImageNode, setSelectedImageNode] = useState<ImageNodeState | null>(null)
  const [activeColumnsNode, setActiveColumnsNode] = useState<ColumnsNodeState | null>(null)
  const [activeTableNode, setActiveTableNode] = useState<TableNodeState | null>(null)

  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  const isDirtyRef = useRef(false)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track local editing state to prevent external updates from overwriting
  const isLocalChangeRef = useRef(false)
  const lastExternalContentRef = useRef(content)
  const lastLocalEditTimeRef = useRef<number>(0)
  const EDIT_GRACE_PERIOD = 2000

  const debouncedOnChange = useCallback(() => {
    isDirtyRef.current = true
    isLocalChangeRef.current = true
    lastLocalEditTimeRef.current = Date.now()

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    debounceTimeoutRef.current = setTimeout(() => {
      if (isDirtyRef.current && editorRef.current) {
        const html = editorRef.current.getHTML()
        lastExternalContentRef.current = html
        isDirtyRef.current = false
        onChange(html)
      }
    }, 150)
  }, [onChange])

  const handleImageUpload = useCallback(async (file: File, editorInstance: ReturnType<typeof useEditor>) => {
    if (!editorInstance) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      console.warn('Invalid image type:', file.type)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      console.warn('Image too large:', file.size)
      return
    }

    setIsUploadingImage(true)

    try {
      const { upload } = await uploadsApi.upload(file)
      editorInstance
        .chain()
        .focus()
        .setImage({ src: upload.url, alt: upload.originalName })
        .run()
    } catch (err) {
      console.error('Failed to upload image:', err)
    } finally {
      setIsUploadingImage(false)
    }
  }, [])

  const editor = useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    autofocus: isMobile ? false : 'end',
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          validate: (href) => /^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('mailto:') || href.startsWith('tel:'),
          HTMLAttributes: {
            class: 'text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 hover:decoration-[var(--color-accent)] transition-colors cursor-pointer',
          },
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList.configure({
        HTMLAttributes: { class: 'task-list' },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'task-item' },
      }),
      Typography.configure({
        emDash: '\u2014',
        ellipsis: '\u2026',
        openDoubleQuote: '\u00AB\u00A0',
        closeDoubleQuote: '\u00A0\u00BB',
        openSingleQuote: '\u2018',
        closeSingleQuote: '\u2019',
      }),
      TextAlign.extend({
        addKeyboardShortcuts() {
          return {
            'Mod-Shift-l': () => this.editor.commands.setTextAlign('left'),
            'Mod-Shift-e': () => this.editor.commands.setTextAlign('center'),
            'Alt-Shift-r': () => this.editor.commands.setTextAlign('right'),
          }
        },
      }).configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
        defaultAlignment: 'left',
      }),
      CustomImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: 'editor-image' },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'editor-table' },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Columns,
      Column,
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'fluid-editor-content focus:outline-none',
      },
      clipboardTextSerializer: (slice) => {
        const texts: string[] = []
        slice.content.forEach((node) => {
          texts.push(serializeNodeToText(node as Parameters<typeof serializeNodeToText>[0]))
        })
        return texts.join('').replace(/\n{3,}/g, '\n\n').trimEnd()
      },
      // Mobile/tablet: virtual keyboards fire handleTextInput, not handleKeyDown for '/'
      handleTextInput: (view, from, _to, text) => {
        if (text === '/' && !showSlashMenu) {
          const textBefore = view.state.doc.textBetween(Math.max(0, from - 1), from, '')
          const isAfterColon = textBefore === ':'
          const isAfterSlash = textBefore === '/'
          const isInWord = textBefore && /[a-zA-Z0-9]/.test(textBefore)
          const isValidContext = from === 1 || textBefore === '' || /\s/.test(textBefore)

          if (isAfterColon || isAfterSlash || isInWord || !isValidContext) {
            return false
          }

          const coords = view.coordsAtPos(from)
          const editorRect = view.dom.getBoundingClientRect()
          setSlashMenuPosition({
            top: coords.bottom - editorRect.top + 8,
            left: coords.left - editorRect.left,
          })
          setShowSlashMenu(true)
          setSlashFilter('')
          setSelectedSlashIndex(0)
          return false
        }

        // While slash menu is open, capture typed characters as filter
        if (showSlashMenu && text.length === 1 && text !== '/') {
          setSlashFilter((f) => f + text)
          setSelectedSlashIndex(0)
        }

        return false
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/' && !showSlashMenu) {
          const { from } = view.state.selection
          const textBefore = view.state.doc.textBetween(Math.max(0, from - 1), from, '')

          const isAfterColon = textBefore === ':'
          const isAfterSlash = textBefore === '/'
          const isInWord = textBefore && /[a-zA-Z0-9]/.test(textBefore)
          const isValidContext = from === 1 || textBefore === '' || /\s/.test(textBefore)

          if (isAfterColon || isAfterSlash || isInWord || !isValidContext) {
            return false
          }

          const coords = view.coordsAtPos(from)
          const editorRect = view.dom.getBoundingClientRect()
          setSlashMenuPosition({
            top: coords.bottom - editorRect.top + 8,
            left: coords.left - editorRect.left,
          })
          setShowSlashMenu(true)
          setSlashFilter('')
          setSelectedSlashIndex(0)
          return false
        }

        if (event.key === 'Tab') {
          const { $from } = view.state.selection

          // In a table: Tab navigates between cells
          let inTable = false
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === 'table') {
              inTable = true
              break
            }
          }
          if (inTable) {
            // Let TipTap's Table extension handle Tab natively
            return false
          }

          event.preventDefault()

          const isInListItem = $from.parent.type.name === 'listItem' ||
            $from.parent.type.name === 'taskItem' ||
            $from.node(-1)?.type.name === 'listItem' ||
            $from.node(-1)?.type.name === 'taskItem'

          if (isInListItem) {
            return false
          }

          if (!event.shiftKey) {
            const tr = view.state.tr.insertText('    ')
            view.dispatch(tr)
          }
          return true
        }

        if (showSlashMenu) {
          const filteredItems = SLASH_MENU_ITEMS.filter(
            (item) =>
              t(item.labelKey).toLowerCase().includes(slashFilter.toLowerCase()) ||
              t(item.descKey).toLowerCase().includes(slashFilter.toLowerCase())
          )

          if (event.key === 'Escape') {
            setShowSlashMenu(false)
            return true
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelectedSlashIndex((i) => (i + 1) % filteredItems.length)
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelectedSlashIndex((i) => (i - 1 + filteredItems.length) % filteredItems.length)
            return true
          }
          if (event.key === 'Enter' && filteredItems.length > 0) {
            event.preventDefault()
            executeSlashCommand(filteredItems[selectedSlashIndex])
            return true
          }
          if (event.key === 'Backspace' && slashFilter === '') {
            setShowSlashMenu(false)
            return false
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
            setSlashFilter((f) => f + event.key)
            setSelectedSlashIndex(0)
          }
          if (event.key === 'Backspace' && slashFilter.length > 0) {
            setSlashFilter((f) => f.slice(0, -1))
            setSelectedSlashIndex(0)
          }
        }

        return false
      },
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false

        // Handle image paste
        const items = clipboardData.items
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (file) {
              const uploadImage = async () => {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
                if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) return

                setIsUploadingImage(true)
                try {
                  const { upload } = await uploadsApi.upload(file)
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      view.state.schema.nodes.image.create({
                        src: upload.url,
                        alt: upload.originalName,
                      })
                    )
                  )
                } catch (err) {
                  console.error('Failed to upload pasted image:', err)
                } finally {
                  setIsUploadingImage(false)
                }
              }
              uploadImage()
              return true
            }
          }
        }

        // Handle markdown paste: if no HTML is present and plain text looks like markdown
        const html = clipboardData.getData('text/html')
        const plainText = clipboardData.getData('text/plain')
        if (!html && plainText && looksLikeMarkdown(plainText)) {
          event.preventDefault()
          const rawHtml = marked.parse(plainText, { async: false }) as string
          const convertedHtml = cleanMarkdownHtml(rawHtml)
          editorRef.current?.commands.insertContent(convertedHtml)
          return true
        }

        return false
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false

        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false

        const imageFiles = Array.from(files).filter((file) =>
          ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
        )

        if (imageFiles.length === 0) return false

        event.preventDefault()

        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })

        if (!coordinates) return false

        const uploadImages = async () => {
          setIsUploadingImage(true)
          try {
            for (const file of imageFiles) {
              if (file.size > 5 * 1024 * 1024) continue

              const { upload } = await uploadsApi.upload(file)
              const node = view.state.schema.nodes.image.create({
                src: upload.url,
                alt: upload.originalName,
              })
              const tr = view.state.tr.insert(coordinates.pos, node)
              view.dispatch(tr)
            }
          } catch (err) {
            console.error('Failed to upload dropped image:', err)
          } finally {
            setIsUploadingImage(false)
          }
        }
        uploadImages()
        return true
      },
    },
    onUpdate: () => {
      debouncedOnChange()
    },
    onSelectionUpdate: ({ editor }) => {
      const { selection } = editor.state
      const node = editor.state.doc.nodeAt(selection.from)

      if (node?.type.name === 'image') {
        const domNode = editor.view.nodeDOM(selection.from)
        let imageElement: HTMLElement | null = null

        if (domNode instanceof HTMLElement) {
          imageElement = domNode.tagName === 'IMG'
            ? domNode
            : domNode.querySelector('img')
        } else if (domNode instanceof HTMLImageElement) {
          imageElement = domNode
        }

        let rect: { top: number; left: number; width: number } | null = null
        if (imageElement && containerRef.current) {
          const imgRect = imageElement.getBoundingClientRect()
          const containerRect = containerRef.current.getBoundingClientRect()
          rect = {
            top: imgRect.top - containerRect.top,
            left: imgRect.left - containerRect.left,
            width: imgRect.width,
          }
        }

        setSelectedImageNode({
          pos: selection.from,
          attrs: {
            align: node.attrs.align || 'center',
            width: node.attrs.width || null,
            borderStyle: node.attrs.borderStyle || 'none',
          },
          rect,
        })
      } else {
        setSelectedImageNode(null)
      }

      const { $from } = selection

      // Detect table
      let tableDepth = -1
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === 'table') {
          tableDepth = depth
          break
        }
      }

      if (tableDepth !== -1) {
        const tablePos = $from.before(tableDepth)
        const tableDom = editor.view.nodeDOM(tablePos)

        let rect: { top: number; left: number; width: number } | null = null
        if (tableDom instanceof HTMLElement && containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect()
          // Use the cursor position to place the toolbar near the selection
          const cursorCoords = editor.view.coordsAtPos(selection.from)
          const tableRect = tableDom.getBoundingClientRect()
          rect = {
            top: tableRect.top - containerRect.top,
            left: cursorCoords.left - containerRect.left,
            width: 0, // no offset — toolbar centers on cursor X
          }
        }

        setActiveTableNode({ rect })
      } else {
        setActiveTableNode(null)
      }

      let columnsDepth = -1
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type.name === 'columns') {
          columnsDepth = depth
          break
        }
      }

      if (columnsDepth !== -1) {
        const columnsNode = $from.node(columnsDepth)
        const columnsPos = $from.before(columnsDepth)
        const domNode = editor.view.nodeDOM(columnsPos)

        let rect: { top: number; left: number; width: number } | null = null
        if (domNode instanceof HTMLElement && containerRef.current) {
          const domRect = domNode.getBoundingClientRect()
          const containerRect = containerRef.current.getBoundingClientRect()
          rect = {
            top: domRect.top - containerRect.top,
            left: domRect.left - containerRect.left,
            width: domRect.width,
          }
        }

        setActiveColumnsNode({
          pos: columnsPos,
          layout: (columnsNode.attrs.layout as ColumnsLayout) || '1-1',
          rect,
        })
      } else {
        setActiveColumnsNode(null)
      }
    },
  })

  // Keep ref in sync for deferred getHTML() inside debounce
  editorRef.current = editor

  const executeSlashCommand = useCallback((item: SlashMenuItem) => {
    if (!editor) return

    const { from } = editor.state.selection
    editor.chain().focus().deleteRange({ from: from - 1 - slashFilter.length, to: from }).run()

    const chain = editor.chain().focus()
    switch (item.command) {
      case 'setParagraph':
        chain.setParagraph().run()
        break
      case 'setHeading':
        chain.setHeading(item.args as { level: 1 | 2 | 3 }).run()
        break
      case 'toggleBulletList':
        chain.toggleBulletList().run()
        break
      case 'toggleOrderedList':
        chain.toggleOrderedList().run()
        break
      case 'toggleTaskList':
        chain.toggleTaskList().run()
        break
      case 'toggleBlockquote':
        chain.toggleBlockquote().run()
        break
      case 'toggleCodeBlock':
        chain.toggleCodeBlock().run()
        break
      case 'setHorizontalRule':
        chain.setHorizontalRule().run()
        break
      case 'insertImage':
        fileInputRef.current?.click()
        break
      case 'insertTable':
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        break
      case 'setColumns':
        chain.setColumns().run()
        break
    }

    setShowSlashMenu(false)
    setSlashFilter('')
  }, [editor, slashFilter])

  useEffect(() => {
    if (!editor) return

    const timeSinceLastEdit = Date.now() - lastLocalEditTimeRef.current
    const isInGracePeriod = timeSinceLastEdit < EDIT_GRACE_PERIOD

    if (isDirtyRef.current || (isLocalChangeRef.current && isInGracePeriod)) {
      return
    }

    if (isLocalChangeRef.current && !isInGracePeriod) {
      isLocalChangeRef.current = false
    }

    if (content !== lastExternalContentRef.current) {
      lastExternalContentRef.current = content
      const { from, to } = editor.state.selection
      editor.commands.setContent(content || '', { emitUpdate: false })
      const docSize = editor.state.doc.content.size
      if (docSize > 0) {
        try {
          const safeFrom = Math.max(1, Math.min(from, docSize))
          const safeTo = Math.max(1, Math.min(to, docSize))
          editor.commands.setTextSelection({ from: safeFrom, to: safeTo })
        } catch {
          // Position invalid — fallback to start
          editor.commands.focus('start')
        }
      }
    }
  }, [content, editor])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setShowSlashMenu(false)
      }
    }
    if (showSlashMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showSlashMenu])

  const { containerRef } = useSmoothCaret(editor, true)

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && editor) {
        handleImageUpload(file, editor)
      }
      e.target.value = ''
    },
    [editor, handleImageUpload]
  )

  const filteredSlashItems = showSlashMenu
    ? SLASH_MENU_ITEMS.filter(
        (item) =>
          t(item.labelKey).toLowerCase().includes(slashFilter.toLowerCase()) ||
          t(item.descKey).toLowerCase().includes(slashFilter.toLowerCase())
      )
    : []

  if (!editor) {
    return null
  }

  return (
    <div ref={containerRef} className="fluid-editor relative smooth-caret">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {isUploadingImage && (
        <div className="absolute top-2 right-2 z-50 flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg">
          <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            {t('editor.uploading_image', 'Uploading...')}
          </span>
        </div>
      )}

      {activeTableNode && activeTableNode.rect && (
        <TableToolbar
          editor={editor}
          tableNode={activeTableNode}
        />
      )}

      {activeColumnsNode && activeColumnsNode.rect && (
        <ColumnsToolbar
          editor={editor}
          columnsNode={activeColumnsNode}
          onColumnsNodeChange={setActiveColumnsNode}
        />
      )}

      {selectedImageNode && selectedImageNode.rect && (
        <ImageToolbar
          editor={editor}
          imageNode={selectedImageNode}
          containerWidth={containerRef.current?.offsetWidth || 800}
          onImageNodeChange={setSelectedImageNode}
        />
      )}

      <EditorBubbleMenu editor={editor} />

      {showSlashMenu && (
        <SlashMenu
          items={filteredSlashItems}
          selectedIndex={selectedSlashIndex}
          position={slashMenuPosition}
          filter={slashFilter}
          onSelect={executeSlashCommand}
          menuRef={slashMenuRef}
        />
      )}

      <EditorContent editor={editor} className="h-full" />
    </div>
  )
})
