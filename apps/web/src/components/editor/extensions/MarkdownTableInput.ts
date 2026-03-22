import { Extension, InputRule } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

/**
 * Markdown table shortcut: typing `|col1|col2|col3|` followed by Enter
 * creates a TipTap table with the specified columns as headers.
 *
 * Supports 2-6 columns. The pattern must start and end with `|`.
 */

// Match: |text|text| or |text|text|text| etc. at the start of a line
const TABLE_INPUT_REGEX = /^\|(.+\|){2,6}\s*$/

function parseColumns(match: string): string[] {
  return match
    .split('|')
    .filter((col) => col.trim().length > 0)
    .map((col) => col.trim())
}

export const MarkdownTableInput = Extension.create({
  name: 'markdownTableInput',

  addInputRules() {
    return [
      new InputRule({
        find: TABLE_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const columns = parseColumns(match[0])
          if (columns.length < 2 || columns.length > 6) return

          const { schema, tr } = state

          // Build table: 1 header row with column names + 1 empty body row
          const headerCells = columns.map((col) =>
            schema.nodes.tableHeader.create(null, schema.nodes.paragraph.create(null, col ? schema.text(col) : null))
          )
          const headerRow = schema.nodes.tableRow.create(null, headerCells)

          const bodyCells = columns.map(() =>
            schema.nodes.tableCell.create(null, schema.nodes.paragraph.create())
          )
          const bodyRow = schema.nodes.tableRow.create(null, bodyCells)

          const table = schema.nodes.table.create(null, [headerRow, bodyRow])

          // Replace the typed text with the table
          tr.replaceRangeWith(range.from, range.to, table)

          // Place cursor in the first body cell
          // Table structure: table > row > cell > paragraph
          // After header row, first body cell paragraph is at a predictable offset
          const resolvedPos = tr.doc.resolve(range.from + 1)
          const tableNode = resolvedPos.nodeAfter
          if (tableNode) {
            // Navigate to second row, first cell, first paragraph
            let pos = range.from + 1 // enter table
            // Skip header row
            const headerRowNode = tableNode.child(0)
            pos += headerRowNode.nodeSize
            // Enter body row + first cell + paragraph
            pos += 1 + 1 + 1 // tableRow open + tableCell open + paragraph open
            tr.setSelection(TextSelection.near(tr.doc.resolve(pos)))
          }
        },
      }),
    ]
  },
})
