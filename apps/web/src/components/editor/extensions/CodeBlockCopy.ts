import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

const pluginKey = new PluginKey('codeBlockCopy')

function createCopyButton(view: EditorView, pos: number): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'code-block-copy-wrapper'
  wrapper.contentEditable = 'false'

  const btn = document.createElement('button')
  btn.className = 'code-block-copy'
  btn.type = 'button'
  btn.innerHTML = COPY_ICON
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()

    const node = view.state.doc.nodeAt(pos)
    const text = node?.textContent || ''
    navigator.clipboard.writeText(text).then(() => {
      btn.innerHTML = CHECK_ICON
      btn.classList.add('copied')
      setTimeout(() => {
        btn.innerHTML = COPY_ICON
        btn.classList.remove('copied')
      }, 2000)
    })
  })

  wrapper.appendChild(btn)
  return wrapper
}

/**
 * Adds a copy-to-clipboard button on code blocks using ProseMirror widget decorations.
 * This is a standalone extension — it doesn't replace CodeBlock, just decorates it.
 */
export const CodeBlockCopy = Extension.create({
  name: 'codeBlockCopy',

  addProseMirrorPlugins() {
    const editorView = this.editor.view

    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = []

            state.doc.descendants((node, pos) => {
              if (node.type.name === 'codeBlock') {
                const widget = Decoration.widget(pos + 1, () => createCopyButton(editorView, pos), {
                  side: -1,
                  ignoreSelection: true,
                  key: `copy-${pos}`,
                })
                decorations.push(widget)
              }
            })

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
