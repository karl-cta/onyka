import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IoListOutline, IoTimerOutline } from 'react-icons/io5'
import { SparkIcon } from '@/components/ui'
import { useSparksStore } from '@/stores/sparks'
import { useIsMobile } from '@/hooks'
import type { ExpirationOption } from '@onyka/shared'

const EXPIRATION_OPTIONS: { value: ExpirationOption; labelKey: string }[] = [
  { value: 'none', labelKey: 'sparks.expiration_options.none' },
  { value: '1h', labelKey: 'sparks.expiration_options.1h' },
  { value: '24h', labelKey: 'sparks.expiration_options.24h' },
  { value: '7d', labelKey: 'sparks.expiration_options.7d' },
  { value: '30d', labelKey: 'sparks.expiration_options.30d' },
]

export function SparkQuickAdd() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const expirationBtnRef = useRef<HTMLButtonElement>(null)
  const expirationMenuRef = useRef<HTMLDivElement>(null)

  const {
    isQuickAddOpen,
    closeQuickAdd,
    createSpark,
    openDrawer,
  } = useSparksStore()

  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [expiration, setExpiration] = useState<ExpirationOption>('none')
  const [showExpirationMenu, setShowExpirationMenu] = useState(false)
  const [expirationMenuPos, setExpirationMenuPos] = useState({ bottom: 0, left: 0 })

  // Auto-focus textarea on open
  useEffect(() => {
    if (isQuickAddOpen && textareaRef.current) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isQuickAddOpen])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [content])

  // Close on Escape
  useEffect(() => {
    if (!isQuickAddOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showExpirationMenu) {
          setShowExpirationMenu(false)
        } else {
          closeQuickAdd()
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isQuickAddOpen, closeQuickAdd, showExpirationMenu])

  // Reset on close
  useEffect(() => {
    if (!isQuickAddOpen) {
      setContent('')
      setShowSuccess(false)
      setExpiration('none')
      setShowExpirationMenu(false)
    }
  }, [isQuickAddOpen])

  // Close expiration menu on click outside
  useEffect(() => {
    if (!showExpirationMenu) return
    const handleClick = (e: MouseEvent) => {
      if (expirationBtnRef.current?.contains(e.target as Node)) return
      if (expirationMenuRef.current?.contains(e.target as Node)) return
      setShowExpirationMenu(false)
    }
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [showExpirationMenu])

  // Position expiration menu
  useEffect(() => {
    if (showExpirationMenu && expirationBtnRef.current) {
      const rect = expirationBtnRef.current.getBoundingClientRect()
      setExpirationMenuPos({
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
      })
    }
  }, [showExpirationMenu])

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await createSpark(content.trim(), {
        expiration: expiration !== 'none' ? expiration : undefined,
      })
      setContent('')
      setExpiration('none')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 800)
      textareaRef.current?.focus()
    } finally {
      setIsSubmitting(false)
    }
  }, [content, isSubmitting, createSpark, expiration])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const handleOpenFullDrawer = useCallback(() => {
    closeQuickAdd()
    openDrawer()
  }, [closeQuickAdd, openDrawer])

  if (!isQuickAddOpen) return null

  const activeExpiration = EXPIRATION_OPTIONS.find(o => o.value === expiration)

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={closeQuickAdd}
      />

      {/* Centering container */}
      <div className="fixed inset-0 z-50 pointer-events-none flex justify-center pt-[22vh] p-4">
        {/* Panel */}
        <div
          ref={panelRef}
          className="pointer-events-auto flex flex-col relative overflow-hidden w-full max-w-[440px] h-fit rounded-2xl spark-panel animate-quick-add-open"
        >
          {/* Success feedback overlay */}
          {showSuccess && (
            <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden z-10">
              <div className="absolute inset-0 bg-[var(--color-accent)]/5 animate-quick-add-flash" />
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--color-accent)] animate-accent-sweep" />
            </div>
          )}

          {/* Input area */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 mt-1.5 ${showSuccess ? 'animate-send-pulse' : ''}`}>
                <SparkIcon className="w-5 h-5 text-[var(--color-accent)]" animated={showSuccess} />
              </div>

              <div className="flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('sparks.input_placeholder')}
                  className="w-full bg-transparent text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] resize-none focus:outline-none min-h-[28px] max-h-[150px] leading-relaxed"
                  rows={1}
                  autoFocus
                  autoComplete="off"
                  enterKeyHint="send"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-1">
              <button
                onClick={handleOpenFullDrawer}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                <IoListOutline className="w-3.5 h-3.5" />
                <span>{t('sparks.title')}</span>
              </button>

              <button
                ref={expirationBtnRef}
                onClick={() => setShowExpirationMenu(!showExpirationMenu)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  expiration !== 'none'
                    ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
                title={t('sparks.expiration')}
              >
                <IoTimerOutline className="w-3.5 h-3.5" />
                {expiration !== 'none' && activeExpiration && (
                  <span>{t(activeExpiration.labelKey)}</span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--color-text-tertiary)] hidden sm:inline">
                {t('sparks.enter_hint')}
              </span>
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || isSubmitting}
                className={`h-8 px-4 flex items-center gap-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  content.trim()
                    ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-sm'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                }`}
              >
                <SparkIcon className="w-3.5 h-3.5" />
                <span>{t('sparks.send')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expiration dropdown (portal) */}
      {showExpirationMenu && createPortal(
        <div
          ref={expirationMenuRef}
          className="fixed py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-2xl z-[200] min-w-[140px]"
          style={{
            bottom: expirationMenuPos.bottom,
            left: expirationMenuPos.left,
          }}
        >
          {EXPIRATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setExpiration(option.value)
                setShowExpirationMenu(false)
              }}
              className={`block w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                expiration === option.value
                  ? 'text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-text-primary)]'
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>,
    document.body
  )
}
