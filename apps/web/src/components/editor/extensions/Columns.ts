import { Node, mergeAttributes } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export type ColumnsLayout = '1-1' | '1-2' | '2-1'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      /**
       * Insert a two-column layout
       */
      setColumns: (layout?: ColumnsLayout) => ReturnType
      /**
       * Change the layout of existing columns
       */
      setColumnsLayout: (layout: ColumnsLayout) => ReturnType
      /**
       * Remove columns and unwrap content
       */
      unsetColumns: () => ReturnType
    }
  }
}

/** Single column within a Columns container. */
export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column',
        class: 'editor-column',
      }),
      0,
    ]
  },
})

/** Container for two-column layouts. */
export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column column',
  isolating: true,
  defining: true,

  addAttributes() {
    return {
      layout: {
        default: '1-1' as ColumnsLayout,
        parseHTML: (element) => element.getAttribute('data-layout') || '1-1',
        renderHTML: (attributes) => ({
          'data-layout': attributes.layout,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'columns',
        class: `editor-columns editor-columns-${HTMLAttributes['data-layout'] || '1-1'}`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setColumns:
        (layout: ColumnsLayout = '1-1') =>
        ({ commands, state }) => {
          const { selection } = state
          const { $from } = selection

          // Check if already inside columns - don't nest
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === 'columns') {
              return false
            }
          }

          return commands.insertContent({
            type: 'columns',
            attrs: { layout },
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph' }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph' }],
              },
            ],
          })
        },

      setColumnsLayout:
        (layout: ColumnsLayout) =>
        ({ state, tr, dispatch }) => {
          const { selection } = state
          const { $from } = selection

          let columnsDepth = -1
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === 'columns') {
              columnsDepth = depth
              break
            }
          }

          if (columnsDepth === -1) return false

          const columnsPos = $from.before(columnsDepth)

          if (dispatch) {
            tr.setNodeMarkup(columnsPos, undefined, { layout })
            dispatch(tr)
          }

          return true
        },

      unsetColumns:
        () =>
        ({ state, tr, dispatch }) => {
          const { selection } = state
          const { $from } = selection

          let columnsDepth = -1
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === 'columns') {
              columnsDepth = depth
              break
            }
          }

          if (columnsDepth === -1) return false

          const columnsNode = $from.node(columnsDepth)
          const columnsPos = $from.before(columnsDepth)

          const content: ProseMirrorNode[] = []
          columnsNode.forEach((column) => {
            column.forEach((child) => {
              content.push(child)
            })
          })

          if (dispatch) {
            const fragment = state.schema.nodes.doc.create(null, content).content
            tr.replaceWith(columnsPos, columnsPos + columnsNode.nodeSize, fragment)
            dispatch(tr)
          }

          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Backspace at start of first column - unwrap columns
      Backspace: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from, empty } = selection

        if (!empty) return false

        let columnDepth = -1
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === 'column') {
            columnDepth = depth
            break
          }
        }

        if (columnDepth === -1) return false

        const column = $from.node(columnDepth)
        const columnStart = $from.start(columnDepth)
        const isAtStart = $from.pos === columnStart

        if (!isAtStart && $from.parentOffset !== 0) return false

        const columnsDepth = columnDepth - 1
        const columnsNode = $from.node(columnsDepth)
        if (columnsNode.type.name !== 'columns') return false

        const columnIndex = $from.index(columnsDepth)

        if (
          columnIndex === 0 &&
          isAtStart &&
          column.firstChild?.type.name === 'paragraph' &&
          column.firstChild.content.size === 0
        ) {
          return editor.commands.unsetColumns()
        }

        return false
      },

      // Enter on empty paragraph in last column - exit columns
      Enter: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from, empty } = selection

        if (!empty) return false

        let columnDepth = -1
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === 'column') {
            columnDepth = depth
            break
          }
        }

        if (columnDepth === -1) return false

        const columnsDepth = columnDepth - 1
        const columnsNode = $from.node(columnsDepth)
        if (columnsNode.type.name !== 'columns') return false

        const columnIndex = $from.index(columnsDepth)
        if (columnIndex !== 1) return false

        const parent = $from.parent
        if (parent.type.name !== 'paragraph' || parent.content.size > 0) return false

        // Only exit if on the last element in the column
        const column = $from.node(columnDepth)
        const posInColumn = $from.pos - $from.start(columnDepth)
        const isLastInColumn = posInColumn >= column.content.size - parent.nodeSize

        if (!isLastInColumn) return false

        const columnsPos = $from.before(columnsDepth)
        const columnsEnd = columnsPos + columnsNode.nodeSize

        editor
          .chain()
          .insertContentAt(columnsEnd, { type: 'paragraph' })
          .setTextSelection(columnsEnd + 1)
          .run()

        return true
      },

      // Escape - exit columns
      Escape: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from } = selection

        let columnsDepth = -1
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === 'columns') {
            columnsDepth = depth
            break
          }
        }

        if (columnsDepth === -1) return false

        const columnsNode = $from.node(columnsDepth)
        const columnsPos = $from.before(columnsDepth)
        const columnsEnd = columnsPos + columnsNode.nodeSize

        const docSize = state.doc.content.size
        if (columnsEnd >= docSize - 1) {
          editor
            .chain()
            .insertContentAt(columnsEnd, { type: 'paragraph' })
            .setTextSelection(columnsEnd + 1)
            .run()
        } else {
          editor.commands.setTextSelection(columnsEnd + 1)
        }

        return true
      },

      // Arrow down at end of last column - exit columns
      ArrowDown: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from, empty } = selection

        if (!empty) return false

        let columnDepth = -1
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === 'column') {
            columnDepth = depth
            break
          }
        }

        if (columnDepth === -1) return false

        const columnsDepth = columnDepth - 1
        const columnsNode = $from.node(columnsDepth)
        if (columnsNode.type.name !== 'columns') return false

        const columnIndex = $from.index(columnsDepth)
        if (columnIndex !== 1) return false

        const columnEnd = $from.end(columnDepth)

        // Allow some tolerance for being "at the end"
        if ($from.pos < columnEnd - 1) return false

        const columnsPos = $from.before(columnsDepth)
        const columnsEnd = columnsPos + columnsNode.nodeSize

        const docSize = state.doc.content.size
        if (columnsEnd >= docSize - 1) {
          editor
            .chain()
            .insertContentAt(columnsEnd, { type: 'paragraph' })
            .setTextSelection(columnsEnd + 1)
            .run()
        } else {
          editor.commands.setTextSelection(columnsEnd + 1)
        }

        return true
      },
    }
  },
})

export default Columns
