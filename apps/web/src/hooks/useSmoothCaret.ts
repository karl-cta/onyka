import { useEffect, useRef, useCallback } from 'react'
import type { Editor } from '@tiptap/react'

interface CaretPosition {
  top: number
  left: number
  height: number
}

export function useSmoothCaret(editor: Editor | null, enabled: boolean) {
  const caretRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingRef = useRef(false)
  const rafIdRef = useRef<number | null>(null)

  const updateCaretPosition = useCallback(() => {
    if (!editor || !caretRef.current || !containerRef.current || !enabled) return

    const { view } = editor
    const { state } = view
    const { selection } = state

    if (!selection.empty) {
      caretRef.current.style.opacity = '0'
      return
    }

    try {
      const coords = view.coordsAtPos(selection.from)
      const containerRect = containerRef.current.getBoundingClientRect()

      const position: CaretPosition = {
        left: coords.left - containerRect.left,
        top: coords.top - containerRect.top,
        height: coords.bottom - coords.top,
      }

      caretRef.current.style.left = `${position.left}px`
      caretRef.current.style.top = `${position.top}px`
      caretRef.current.style.height = `${position.height}px`
      caretRef.current.style.opacity = '1'

      isTypingRef.current = true
      caretRef.current.classList.remove('blink')
      // Force reset animation state so next blink starts clean
      caretRef.current.style.animation = 'none'
      // Trigger reflow to flush the animation reset
      void caretRef.current.offsetHeight
      caretRef.current.style.animation = ''

      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current)
      }

      blinkTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false
        if (caretRef.current) {
          caretRef.current.classList.add('blink')
        }
      }, 500)
    } catch {
      if (caretRef.current) {
        caretRef.current.style.opacity = '0'
      }
    }
  }, [editor, enabled])

  useEffect(() => {
    if (!editor || !enabled) return

    const cancelPending = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }

    const scheduleUpdate = () => {
      cancelPending()
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        updateCaretPosition()
      })
    }

    // Double rAF: lets the browser reflow new node dimensions before measuring
    const scheduleUpdateAfterReflow = () => {
      cancelPending()
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          updateCaretPosition()
        })
      })
    }

    const handleSelectionUpdate = () => {
      scheduleUpdate()
    }

    const handleTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) {
        scheduleUpdateAfterReflow()
      } else {
        scheduleUpdate()
      }
    }

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('transaction', handleTransaction)
    editor.on('focus', handleSelectionUpdate)
    editor.on('blur', () => {
      if (caretRef.current) {
        caretRef.current.style.opacity = '0'
      }
    })

    // Reposition caret when CSS variables change (font size/family)
    const mutationObserver = new MutationObserver(() => {
      scheduleUpdateAfterReflow()
    })
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    })

    handleSelectionUpdate()

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.off('transaction', handleTransaction)
      cancelPending()
      mutationObserver.disconnect()
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current)
      }
    }
  }, [editor, enabled, updateCaretPosition])

  useEffect(() => {
    if (!enabled || !containerRef.current) return

    const caret = document.createElement('div')
    caret.className = 'smooth-caret-cursor'
    caret.style.opacity = '0'
    containerRef.current.appendChild(caret)
    caretRef.current = caret

    return () => {
      if (caret.parentNode) {
        caret.parentNode.removeChild(caret)
      }
      caretRef.current = null
    }
  }, [enabled])

  return { containerRef }
}
