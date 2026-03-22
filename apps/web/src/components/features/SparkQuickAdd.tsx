import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IoTimerOutline, IoCheckmarkOutline } from 'react-icons/io5'
import { SparkIcon } from '@/components/ui'
import { useSparksStore } from '@/stores/sparks'
import type { ExpirationOption } from '@onyka/shared'

const EXPIRATION_OPTIONS: { value: ExpirationOption; labelKey: string }[] = [
  { value: 'none', labelKey: 'sparks.expiration_options.none' },
  { value: '1h', labelKey: 'sparks.expiration_options.1h' },
  { value: '24h', labelKey: 'sparks.expiration_options.24h' },
  { value: '7d', labelKey: 'sparks.expiration_options.7d' },
  { value: '30d', labelKey: 'sparks.expiration_options.30d' },
]

type PanelState = 'idle' | 'submitting' | 'success' | 'success-closing' | 'closing'

export function SparkQuickAdd() {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const expirationBtnRef = useRef<HTMLButtonElement>(null)
  const expirationMenuRef = useRef<HTMLDivElement>(null)

  const {
    isQuickAddOpen,
    closeQuickAdd,
    createSpark,
  } = useSparksStore()

  const [content, setContent] = useState('')
  const [panelState, setPanelState] = useState<PanelState>('idle')
  const [expiration, setExpiration] = useState<ExpirationOption>('none')
  const [showExpirationMenu, setShowExpirationMenu] = useState(false)
  const [expirationMenuPos, setExpirationMenuPos] = useState({ bottom: 0, left: 0 })
  // Keep panel mounted during exit animation
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (isQuickAddOpen) {
      setShouldRender(true)
      setPanelState('idle')
    }
  }, [isQuickAddOpen])

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
          gracefulClose()
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuickAddOpen, showExpirationMenu])

  // Reset on close
  useEffect(() => {
    if (!isQuickAddOpen) {
      setContent('')
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

  const gracefulClose = useCallback(() => {
    setPanelState('closing')
    setTimeout(() => {
      closeQuickAdd()
      setShouldRender(false)
      setPanelState('idle')
    }, 200)
  }, [closeQuickAdd])

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || panelState !== 'idle') return

    setPanelState('submitting')
    try {
      await createSpark(content.trim(), {
        expiration: expiration !== 'none' ? expiration : undefined,
      })
      setContent('')
      setPanelState('success')
      // Visible success → graceful exit
      setTimeout(() => {
        setPanelState('success-closing')
        setTimeout(() => {
          closeQuickAdd()
          setShouldRender(false)
          setPanelState('idle')
        }, 250)
      }, 800)
    } catch {
      setPanelState('idle')
    }
  }, [content, panelState, createSpark, expiration, closeQuickAdd])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  if (!shouldRender) return null

  const activeExpiration = EXPIRATION_OPTIONS.find(o => o.value === expiration)
  const isSuccess = panelState === 'success' || panelState === 'success-closing'
  const isClosing = panelState === 'closing' || panelState === 'success-closing'

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
        onClick={() => panelState === 'idle' && gracefulClose()}
      />

      {/* Centering container */}
      <div className="fixed inset-0 z-50 pointer-events-none flex justify-center pt-[20vh] p-4">
        {/* Panel */}
        <div
          ref={panelRef}
          className={`
            pointer-events-auto flex flex-col relative overflow-hidden
            w-full max-w-[460px] h-fit rounded-2xl spark-panel
            transition-all
            ${isClosing
              ? 'spark-quick-add-exit'
              : 'spark-quick-add-enter'
            }
            ${isSuccess ? 'spark-quick-add-success' : ''}
          `}
        >
          {isSuccess ? (
            /* Success state — centered confirmation */
            <div className="flex items-center justify-center gap-2.5 py-6 px-5 spark-success-content">
              <IoCheckmarkOutline className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('sparks.captured')}
              </span>
            </div>
          ) : (
            <>
              {/* Input area */}
              <div className="p-5 pb-4">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('sparks.input_placeholder')}
                  disabled={isClosing}
                  className="w-full bg-transparent text-[15px] leading-relaxed resize-none focus:outline-none min-h-[32px] max-h-[150px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                  rows={1}
                  autoFocus
                  autoComplete="off"
                  enterKeyHint="send"
                  maxLength={2000}
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]">
                <button
                  ref={expirationBtnRef}
                  onClick={() => setShowExpirationMenu(!showExpirationMenu)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
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

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[var(--color-text-tertiary)] hidden sm:inline select-none">
                    {t('sparks.enter_hint')}
                  </span>
                  <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || panelState !== 'idle'}
                    className={`h-8 px-4 flex items-center gap-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      content.trim()
                        ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-sm active:scale-95'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                    }`}
                  >
                    <SparkIcon className="w-3.5 h-3.5" />
                    <span>{t('sparks.send')}</span>
                  </button>
                </div>
              </div>
            </>
          )}
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
              className={`block w-full text-left px-3.5 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors ${
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
