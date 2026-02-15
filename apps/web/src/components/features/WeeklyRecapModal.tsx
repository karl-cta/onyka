import { useEffect } from 'react'
import {
  IoCloseOutline,
  IoFlameOutline,
  IoPencilOutline,
  IoDocumentTextOutline,
  IoSparklesOutline,
  IoCalendarOutline,
  IoTrendingUpOutline,
  IoTimeOutline,
} from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import type { WeeklyRecap } from '@onyka/shared'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface WeeklyRecapModalProps {
  isOpen: boolean
  recap: WeeklyRecap
  onDismiss: () => void
}

export function WeeklyRecapModal({ isOpen, recap, onDismiss }: WeeklyRecapModalProps) {
  const { t, i18n } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onDismiss()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onDismiss])

  const formatWeekRange = (weekStart: string, weekEnd: string): string => {
    const start = new Date(weekStart)
    const end = new Date(weekEnd)
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US'

    const startStr = start.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })

    return `${startStr} - ${endStr}`
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const formatFocusTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}min`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onDismiss}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('recap.title')}
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative px-6 pt-6 pb-8 bg-gradient-to-br from-[var(--color-accent)]/20 via-[var(--color-accent)]/10 to-transparent">
            <button
              onClick={onDismiss}
              aria-label={t('common.close')}
              className="absolute top-4 right-4 p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50 transition-colors"
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-[var(--color-accent)]/20">
                <IoSparklesOutline className="w-6 h-6 text-[var(--color-accent)]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                  {t('recap.title')}
                </h2>
                <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                  <IoCalendarOutline className="w-3.5 h-3.5" />
                  {formatWeekRange(recap.weekStart, recap.weekEnd)}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 -mt-4">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2 text-[var(--color-text-tertiary)]">
                  <IoPencilOutline className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {t('recap.words_written')}
                  </span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {formatNumber(recap.wordsWritten)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2 text-[var(--color-text-tertiary)]">
                  <IoDocumentTextOutline className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {t('recap.notes_created')}
                  </span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {recap.notesCreated}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-2 text-[var(--color-text-tertiary)]">
                  <IoTrendingUpOutline className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {t('recap.notes_edited')}
                  </span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {recap.notesEdited}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  recap.currentStreak >= 7
                    ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30'
                    : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)]'
                }`}
              >
                <div
                  className={`flex items-center gap-2 mb-2 ${
                    recap.currentStreak >= 7
                      ? 'text-[var(--color-accent)]'
                      : 'text-[var(--color-text-tertiary)]'
                  }`}
                >
                  <IoFlameOutline className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {t('recap.streak')}
                  </span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {recap.currentStreak}
                  <span className="text-sm font-normal text-[var(--color-text-tertiary)] ml-1">
                    {t('stats.days')}
                  </span>
                </div>
              </div>
            </div>

            {recap.focusMinutes > 0 && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] mb-6">
                <div className="flex items-center gap-2 text-[var(--color-text-tertiary)]">
                  <IoTimeOutline className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {t('recap.focus_time')}
                  </span>
                </div>
                <div className="text-lg font-bold text-[var(--color-text-primary)] ml-auto">
                  {formatFocusTime(recap.focusMinutes)}
                </div>
              </div>
            )}

            <div className="text-center p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {recap.wordsWritten > 0 || recap.notesCreated > 0
                  ? t('recap.congrats_message')
                  : t('recap.keep_going_message')}
              </p>
            </div>

            <button
              onClick={onDismiss}
              className="w-full mt-4 px-4 py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              {t('recap.dismiss')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
