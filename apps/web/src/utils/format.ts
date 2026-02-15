import type { TFunction } from 'i18next'
import i18next from 'i18next'

/**
 * Format a date as a relative time string (e.g., "5 minutes ago", "2 days ago")
 * Uses translation keys from the i18n system
 */
export function formatTimeAgo(date: Date | string, t: TFunction): string {
  const now = new Date()
  const past = new Date(date)
  const diff = now.getTime() - past.getTime()

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return t('sparks.time_ago.now')
  if (minutes < 60) return t('sparks.time_ago.minutes', { n: minutes })
  if (hours < 24) return t('sparks.time_ago.hours', { n: hours })
  if (days === 1) return t('sparks.time_ago.yesterday')
  if (days < 7) return t('sparks.time_ago.days', { n: days })
  if (days < 30) return t('sparks.time_ago.weeks', { n: Math.floor(days / 7) })
  return t('sparks.time_ago.months', { n: Math.floor(days / 30) })
}

/**
 * Format a date as a relative time string with locale-aware fallback for older dates
 * Uses i18next directly to ensure namespace access regardless of component context
 */
export function formatRelativeTime(
  date: Date | string,
  locale: string,
  _t?: TFunction // kept for backwards compatibility but not used
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  // Use i18next directly to access sessions namespace for relative time
  if (diffMins < 1) return i18next.t('sessions.just_now')
  if (diffMins < 60) return i18next.t('sessions.minutes_ago', { n: diffMins })
  if (diffHours < 24) return i18next.t('sessions.hours_ago', { n: diffHours })
  if (diffDays < 7) return i18next.t('sessions.days_ago', { n: diffDays })

  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date as a locale-aware short date (e.g., "25 jan. 2026")
 */
export function formatNoteDate(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get initials from a name (e.g., "John Doe" -> "JD")
 * Returns up to 2 characters
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Format time remaining until a date (e.g., "2 days left", "5 hours left")
 * Used for expiration countdowns
 */
export function formatTimeLeft(expiresAt: Date | null, t: TFunction): string {
  if (!expiresAt) return ''
  const now = new Date()
  const diff = new Date(expiresAt).getTime() - now.getTime()
  if (diff <= 0) return t('sparks.time_left.expired')

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return t('sparks.time_left.days', { n: days })
  if (hours > 0) return t('sparks.time_left.hours', { n: hours })
  return t('sparks.time_left.minutes', { n: minutes })
}
