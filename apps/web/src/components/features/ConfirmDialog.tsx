import { createPortal } from 'react-dom'
import { IoCloseOutline, IoTrashOutline, IoWarningOutline } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'

/**
 * Parse a string containing only <strong> tags into React elements.
 * All other HTML is escaped and rendered as plain text.
 */
function renderSafeMessage(text: string): React.ReactNode[] {
  const parts = text.split(/(<strong>.*?<\/strong>)/g)
  return parts.map((part, i) => {
    const match = part.match(/^<strong>(.*?)<\/strong>$/)
    if (match) {
      return <strong key={i} className="font-semibold text-[var(--color-text-primary)]">{match[1]}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  isLoading?: boolean
  children?: React.ReactNode
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  isLoading = false,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const finalConfirmLabel = confirmLabel || t('common.delete')
  const finalCancelLabel = cancelLabel || t('common.cancel')
  if (!isOpen) return null

  const handleConfirm = () => {
    if (!isLoading) {
      onConfirm()
    }
  }

  const iconBgClass =
    variant === 'danger'
      ? 'bg-red-500/10 text-red-500'
      : 'bg-amber-500/10 text-amber-500'

  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : 'bg-amber-500 hover:bg-amber-600 text-white'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm bg-[var(--color-bg-secondary)] rounded-xl shadow-xl border border-[var(--color-border)] animate-scale-in"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
        >
          <IoCloseOutline className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        </button>

        <div className="p-6 text-center">
          <div
            className={`w-12 h-12 rounded-full ${iconBgClass} flex items-center justify-center mx-auto mb-4`}
          >
            {variant === 'danger' ? (
              <IoTrashOutline className="w-5 h-5" />
            ) : (
              <IoWarningOutline className="w-5 h-5" />
            )}
          </div>

          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
            {title}
          </h2>

          <p className="text-sm text-[var(--color-text-secondary)]">
            {renderSafeMessage(message)}
          </p>

          {children}
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-9 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors disabled:opacity-50"
          >
            {finalCancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 h-9 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${confirmBtnClass}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {t('common.loading')}
              </span>
            ) : (
              finalConfirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
