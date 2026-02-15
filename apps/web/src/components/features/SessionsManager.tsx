import { useState, useEffect } from 'react'
import {
  IoDesktopOutline,
  IoPhonePortraitOutline,
  IoTabletPortraitOutline,
  IoCloseOutline,
  IoCheckmarkCircle,
  IoWarningOutline,
  IoReloadOutline,
  IoTrashOutline,
} from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/Toast'
import { sessionsApi, type Session } from '@/services/api'

interface SessionsManagerProps {
  onSessionRevoked?: () => void
}

function parseUserAgent(userAgent: string): {
  browser: string
  os: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
} {
  const ua = userAgent.toLowerCase()

  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet'
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile'
  }

  let browser = 'Unknown Browser'
  if (ua.includes('firefox')) {
    browser = 'Firefox'
  } else if (ua.includes('edg')) {
    browser = 'Edge'
  } else if (ua.includes('chrome')) {
    browser = 'Chrome'
  } else if (ua.includes('safari')) {
    browser = 'Safari'
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera'
  }

  let os = 'Unknown OS'
  if (ua.includes('windows')) {
    os = 'Windows'
  } else if (ua.includes('mac os') || ua.includes('macos')) {
    os = 'macOS'
  } else if (ua.includes('linux')) {
    os = 'Linux'
  } else if (ua.includes('android')) {
    os = 'Android'
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS'
  }

  return { browser, os, deviceType }
}

function DeviceIcon({
  deviceType,
  className,
}: {
  deviceType: 'desktop' | 'mobile' | 'tablet'
  className?: string
}) {
  switch (deviceType) {
    case 'mobile':
      return <IoPhonePortraitOutline className={className} />
    case 'tablet':
      return <IoTabletPortraitOutline className={className} />
    default:
      return <IoDesktopOutline className={className} />
  }
}

export function SessionsManager({ onSessionRevoked }: SessionsManagerProps) {
  const { t, i18n } = useTranslation()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false)
  const [isRevokingAll, setIsRevokingAll] = useState(false)

  useEffect(() => {
    loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSessions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await sessionsApi.list()
      setSessions(response.sessions)
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setError(t('sessions.load_error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId)
    try {
      await sessionsApi.revoke(sessionId)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      toast.success(t('sessions.revoked'))
      onSessionRevoked?.()
    } catch (err) {
      console.error('Failed to revoke session:', err)
      toast.error(t('sessions.revoke_error'))
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAllOthers = async () => {
    setIsRevokingAll(true)
    try {
      await sessionsApi.revokeAllOthers()
      setSessions((prev) => prev.filter((s) => s.isCurrent))
      setShowRevokeAllConfirm(false)
      toast.success(t('sessions.all_revoked'))
      onSessionRevoked?.()
    } catch (err) {
      console.error('Failed to revoke all sessions:', err)
      toast.error(t('sessions.revoke_all_error'))
    } finally {
      setIsRevokingAll(false)
    }
  }

  const formatDate = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) {
      return t('sessions.just_now')
    } else if (diffMins < 60) {
      return t('sessions.minutes_ago', { n: diffMins })
    } else if (diffHours < 24) {
      return t('sessions.hours_ago', { n: diffHours })
    } else if (diffDays < 7) {
      return t('sessions.days_ago', { n: diffDays })
    } else {
      return d.toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    }
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent)
  const currentSession = sessions.find((s) => s.isCurrent)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <IoReloadOutline className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <IoWarningOutline className="w-8 h-8 text-[var(--color-error)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
        <button
          onClick={loadSessions}
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-tertiary)]">{t('sessions.description')}</p>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {currentSession && (
          <SessionItem
            session={currentSession}
            formatDate={formatDate}
            isRevoking={false}
            onRevoke={() => {}}
            isCurrent
          />
        )}

        {otherSessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            formatDate={formatDate}
            isRevoking={revokingId === session.id}
            onRevoke={() => handleRevokeSession(session.id)}
          />
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-6 text-[var(--color-text-tertiary)] text-sm">
          {t('sessions.no_sessions')}
        </div>
      )}

      {otherSessions.length > 0 && (
        <button
          onClick={() => setShowRevokeAllConfirm(true)}
          className="w-full py-2 rounded-lg text-sm font-medium text-[var(--color-error)] bg-[var(--color-error)]/10 hover:bg-[var(--color-error)]/15 transition-colors flex items-center justify-center gap-2"
        >
          <IoTrashOutline className="w-4 h-4" />
          {t('sessions.revoke_all_others')}
        </button>
      )}

      {showRevokeAllConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={() => setShowRevokeAllConfirm(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-xl w-full max-w-sm p-6 pointer-events-auto animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-[var(--color-error)]/10">
                  <IoWarningOutline className="w-5 h-5 text-[var(--color-error)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                    {t('sessions.revoke_all_title')}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t('sessions.revoke_all_message', { count: otherSessions.length })}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRevokeAllConfirm(false)}
                  disabled={isRevokingAll}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-elevated)] transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleRevokeAllOthers}
                  disabled={isRevokingAll}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--color-error)] text-white font-medium hover:bg-[var(--color-error)]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRevokingAll ? (
                    <>
                      <IoReloadOutline className="w-4 h-4 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      <IoTrashOutline className="w-4 h-4" />
                      {t('sessions.revoke_all_confirm')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface SessionItemProps {
  session: Session
  formatDate: (date: Date | string) => string
  isRevoking: boolean
  onRevoke: () => void
  isCurrent?: boolean
}

function SessionItem({
  session,
  formatDate,
  isRevoking,
  onRevoke,
  isCurrent,
}: SessionItemProps) {
  const { t } = useTranslation()
  const hasUserAgent = session.userAgent && session.userAgent.length > 0
  const { browser, os, deviceType } = parseUserAgent(session.userAgent || '')
  const displayName = hasUserAgent ? `${browser} on ${os}` : t('sessions.unknown_device', 'Session')

  return (
    <div
      className={`relative p-3 rounded-xl border transition-all ${
        isCurrent
          ? 'bg-[var(--color-accent)]/5 border-[var(--color-accent)]/30'
          : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-[var(--color-border-hover)]'
      } ${isRevoking ? 'opacity-50 animate-pulse' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            isCurrent
              ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
          }`}
        >
          <DeviceIcon deviceType={deviceType} className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-[var(--color-text-primary)] truncate">
              {displayName}
            </span>
            {isCurrent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-accent)] text-white uppercase tracking-wide">
                <IoCheckmarkCircle className="w-3 h-3" />
                {t('sessions.current')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-tertiary)]">
            <span>{formatDate(session.createdAt)}</span>
            {session.ipAddress && (
              <>
                <span className="w-1 h-1 rounded-full bg-[var(--color-text-tertiary)]" />
                <span>{session.ipAddress}</span>
              </>
            )}
          </div>
        </div>

        {!isCurrent && (
          <button
            onClick={onRevoke}
            disabled={isRevoking}
            className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors disabled:opacity-50"
            title={t('sessions.revoke')}
          >
            <IoCloseOutline className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
