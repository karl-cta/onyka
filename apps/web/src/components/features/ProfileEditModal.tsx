import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  IoCloseOutline,
  IoLockClosedOutline,
  IoReloadOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoCheckmarkOutline,
  IoChevronDownOutline,
  IoWarningOutline,
  IoShieldCheckmarkOutline,
  IoMailOutline,
  IoKeyOutline,
  IoCameraOutline,
  IoTrashOutline,
  IoPersonOutline,
  IoPhonePortraitOutline,
} from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { authApi, twoFactorApi, usersApi, emailVerificationApi, type TrustedDeviceInfo } from '@/services/api'
import type { ChangeEvent } from 'react'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/components/ui/Toast'
import { SessionsManager } from './SessionsManager'
import { TwoFactorSetupModal } from './TwoFactorSetupModal'
import { ConfirmDialog } from './ConfirmDialog'

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
}

const AVATAR_COLORS = [
  { id: 'blue', gradient: 'from-blue-500 to-blue-600', ring: 'ring-blue-500' },
  { id: 'indigo', gradient: 'from-indigo-500 to-indigo-600', ring: 'ring-indigo-500' },
  { id: 'violet', gradient: 'from-violet-500 to-violet-600', ring: 'ring-violet-500' },
  { id: 'pink', gradient: 'from-pink-500 to-pink-600', ring: 'ring-pink-500' },
  { id: 'red', gradient: 'from-red-500 to-red-600', ring: 'ring-red-500' },
  { id: 'orange', gradient: 'from-orange-500 to-orange-600', ring: 'ring-orange-500' },
  { id: 'amber', gradient: 'from-amber-500 to-amber-600', ring: 'ring-amber-500' },
  { id: 'green', gradient: 'from-green-500 to-green-600', ring: 'ring-green-500' },
  { id: 'teal', gradient: 'from-teal-500 to-teal-600', ring: 'ring-teal-500' },
  { id: 'cyan', gradient: 'from-cyan-500 to-cyan-600', ring: 'ring-cyan-500' },
]

export function ProfileEditModal({ isOpen, onClose }: ProfileEditModalProps) {
  const { t, i18n } = useTranslation()
  const { user, setUser, refreshUser } = useAuthStore()
  const modalRef = useRef<HTMLDivElement>(null)

  const [email, setEmail] = useState(user?.email || '')
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || 'blue')
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showSessionsSection, setShowSessionsSection] = useState(false)
  const [show2FASection, setShow2FASection] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [show2FASetupModal, setShow2FASetupModal] = useState(false)
  const [showDisable2FADialog, setShowDisable2FADialog] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [disable2FAPassword, setDisable2FAPassword] = useState('')
  const [disable2FACode, setDisable2FACode] = useState('')
  const [isDisabling2FA, setIsDisabling2FA] = useState(false)
  const [isSendingDisableCode, setIsSendingDisableCode] = useState(false)
  const [disableCodeSent, setDisableCodeSent] = useState(false)
  const [twoFactorStatus, setTwoFactorStatus] = useState<{
    enabled: boolean
    recoveryCodesRemaining: number
  } | null>(null)
  const [showTrustedDevicesSection, setShowTrustedDevicesSection] = useState(false)
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceInfo[]>([])
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)
  const [isRevokingDevice, setIsRevokingDevice] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && user) {
      setEmail(user.email || '')
      setAvatarColor(user.avatarColor || 'blue')
      setShowPasswordSection(false)
      setShowSessionsSection(false)
      setShow2FASection(false)
      setShowTrustedDevicesSection(false)
      setTrustedDevices([])
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setDisable2FAPassword('')
      setDisable2FACode('')
      setDisableCodeSent(false)
      setError('')
      setEmailError('')
      load2FAStatus()
    }
  }, [isOpen, user])

  const load2FAStatus = async () => {
    try {
      const status = await twoFactorApi.getStatus()
      setTwoFactorStatus({
        enabled: status.enabled,
        recoveryCodesRemaining: status.recoveryCodesRemaining,
      })
    } catch {
      // Non-critical: 2FA status fetch can fail silently
    }
  }

  const loadTrustedDevices = useCallback(async () => {
    setIsLoadingDevices(true)
    try {
      const result = await twoFactorApi.listTrustedDevices()
      setTrustedDevices(result.devices)
    } catch {
      // Non-critical
    } finally {
      setIsLoadingDevices(false)
    }
  }, [])

  const handleRevokeDevice = useCallback(async (deviceId: string) => {
    setIsRevokingDevice(deviceId)
    try {
      await twoFactorApi.revokeTrustedDevice(deviceId)
      setTrustedDevices((prev) => prev.filter((d) => d.id !== deviceId))
      toast.success(t('profile.trusted_devices.revoked'))
    } catch {
      toast.error(t('profile.trusted_devices.revoke_error'))
    } finally {
      setIsRevokingDevice(null)
    }
  }, [t])

  const handleRevokeAllDevices = useCallback(async () => {
    setIsLoadingDevices(true)
    try {
      await twoFactorApi.revokeAllTrustedDevices()
      setTrustedDevices([])
      toast.success(t('profile.trusted_devices.all_revoked'))
    } catch {
      toast.error(t('profile.trusted_devices.revoke_error'))
    } finally {
      setIsLoadingDevices(false)
    }
  }, [t])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !show2FASetupModal && !showDisable2FADialog) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, show2FASetupModal, showDisable2FADialog])

  useEffect(() => {
    if (!isOpen || !modalRef.current) return

    const modal = modalRef.current
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || show2FASetupModal || showDisable2FADialog) return

      const focusableElements = modal.querySelectorAll<HTMLElement>(focusableSelector)
      if (focusableElements.length === 0) return

      const firstEl = focusableElements[0]
      const lastEl = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }

    const timer = setTimeout(() => {
      const firstFocusable = modal.querySelector<HTMLElement>(focusableSelector)
      firstFocusable?.focus()
    }, 100)

    window.addEventListener('keydown', handleTab)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleTab)
    }
  }, [isOpen, show2FASetupModal, showDisable2FADialog])

  const handlePasswordChange = async () => {
    setError('')

    if (!currentPassword) {
      setError(t('profile.wrong_password'))
      return
    }
    if (!newPassword) return
    if (newPassword !== confirmPassword) {
      setError(t('profile.password_mismatch'))
      return
    }
    if (newPassword.length < 12) {
      setError(t('profile.password_min_length'))
      return
    }

    setIsLoading(true)
    try {
      const { user: updatedUser } = await authApi.updateProfile({
        currentPassword,
        newPassword,
      })
      setUser(updatedUser)
      toast.success(t('profile.password_changed'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordSection(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.update_error')
      if (message.includes('incorrect') || message.includes('INVALID_PASSWORD')) {
        setError(t('profile.wrong_password'))
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handle2FAEnabled = useCallback(() => {
    load2FAStatus()
    refreshUser?.()
  }, [refreshUser])

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('profile.avatar_invalid_type'))
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(t('profile.avatar_too_large'))
      return
    }

    setIsUploadingAvatar(true)
    try {
      const { user: updatedUser } = await authApi.uploadAvatar(file)
      setUser(updatedUser)
      toast.success(t('profile.avatar_uploaded'))
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.avatar_upload_error')
      toast.error(message)
    } finally {
      setIsUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user?.avatarUrl) return

    setIsUploadingAvatar(true)
    try {
      const { user: updatedUser } = await authApi.removeAvatar()
      setUser(updatedUser)
      toast.success(t('profile.avatar_removed'))
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.avatar_remove_error')
      toast.error(message)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleAvatarColorChange = async (colorId: string) => {
    setAvatarColor(colorId)
    try {
      const { user: updatedUser } = await usersApi.updatePreferences({ avatarColor: colorId })
      setUser(updatedUser)
    } catch {
      // Color will reset on next open
    }
  }

  const [isSendingEmailVerification, setIsSendingEmailVerification] = useState(false)
  const [emailError, setEmailError] = useState('')

  const hasExistingEmail = !!(user?.email)
  const emailCleared = hasExistingEmail && email.trim() === ''
  const emailChanged = email.trim() !== (user?.email || '') && email.trim() !== ''
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const handleEmailVerification = async () => {
    const trimmed = email.trim()
    setEmailError('')

    if (!trimmed) return
    if (!emailRegex.test(trimmed)) {
      setEmailError(t('auth.errors.email_invalid'))
      return
    }

    setIsSendingEmailVerification(true)
    try {
      const result = await emailVerificationApi.sendVerification(trimmed)
      if (result.sent) {
        toast.success(t('profile.verification_email_sent'))
      } else {
        toast.error(t('profile.verification_email_failed'))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('EMAIL_TAKEN')) {
        setEmailError(t('auth.errors.email_taken'))
      } else {
        toast.error(t('profile.verification_email_failed'))
      }
    } finally {
      setIsSendingEmailVerification(false)
    }
  }

  const handleEmailRemove = async () => {
    setIsSendingEmailVerification(true)
    try {
      const { user: updatedUser } = await emailVerificationApi.remove()
      setUser(updatedUser)
      setEmail('')
      toast.success(t('profile.email_removed'))
    } catch {
      toast.error(t('profile.update_error'))
    } finally {
      setIsSendingEmailVerification(false)
    }
  }

  const handleSendDisableCode = async () => {
    setIsSendingDisableCode(true)
    try {
      const result = await twoFactorApi.sendCode('disable_2fa')
      if (result.sent) {
        setDisableCodeSent(true)
        toast.success(t('profile.two_factor.code_sent'))
      } else {
        toast.error(t('profile.two_factor.send_code_error'))
      }
    } catch {
      toast.error(t('profile.two_factor.send_code_error'))
    } finally {
      setIsSendingDisableCode(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!disable2FAPassword) {
      toast.error(t('profile.wrong_password'))
      return
    }

    if (!disable2FACode || disable2FACode.length !== 6) {
      toast.error(t('profile.two_factor.invalid_code'))
      return
    }

    setIsDisabling2FA(true)
    try {
      await twoFactorApi.disable(disable2FAPassword, disable2FACode)
      setTwoFactorStatus({ enabled: false, recoveryCodesRemaining: 0 })
      setShowDisable2FADialog(false)
      setDisable2FAPassword('')
      setDisable2FACode('')
      setDisableCodeSent(false)
      toast.success(t('profile.two_factor.disabled_success'))
      refreshUser?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('INVALID_PASSWORD')) {
        toast.error(t('profile.wrong_password'))
      } else if (message.includes('INVALID_CODE') || message.includes('INVALID_2FA_CODE')) {
        toast.error(t('profile.two_factor.invalid_code'))
      } else {
        toast.error(t('profile.two_factor.verify_error'))
      }
    } finally {
      setIsDisabling2FA(false)
    }
  }

  const formatDate = (date: Date | string | number | undefined) => {
    if (!date && date !== 0) return '-'
    const d = date instanceof Date ? date : new Date(typeof date === 'number' ? date * 1000 : date)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (!isOpen) return null

  const selectedColor = AVATAR_COLORS.find((c) => c.id === avatarColor) || AVATAR_COLORS[0]
  const is2FAEnabled = twoFactorStatus?.enabled ?? user?.twoFactorEnabled ?? false

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('profile.title')}
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-[460px] max-h-[85vh] overflow-hidden pointer-events-auto animate-scale-in flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] flex-shrink-0">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t('profile.title')}
            </h2>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={isUploadingAvatar}
                      aria-label={t('profile.avatar_uploaded')}
                    />
                    <div className="relative group">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          className={`w-16 h-16 rounded-full object-cover shadow-md ring-2 ${selectedColor.ring}`}
                        />
                      ) : (
                        <div
                          className={`w-16 h-16 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-primary)] text-xl font-bold shadow-md ring-2 ${selectedColor.ring}`}
                        >
                          {user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity">
                        {isUploadingAvatar ? (
                          <IoReloadOutline className="w-5 h-5 text-white animate-spin" />
                        ) : (
                          <IoCameraOutline className="w-5 h-5 text-white" />
                        )}
                      </div>
                    </div>
                  </label>
                  {user?.avatarUrl && !isUploadingAvatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      aria-label={t('profile.remove_avatar')}
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:border-[var(--color-error)] transition-colors"
                    >
                      <IoTrashOutline className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                    @{user?.username}
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {t('profile.member_since')} {formatDate(user?.createdAt)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                  {t('profile.avatar_color')}
                </p>
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t('profile.avatar_color')}>
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      role="radio"
                      aria-checked={avatarColor === color.id}
                      aria-label={color.id}
                      onClick={() => handleAvatarColorChange(color.id)}
                      className={`w-5 h-5 rounded-full bg-gradient-to-br ${color.gradient} transition-all hover:scale-110 ${
                        avatarColor === color.id
                          ? 'ring-2 ring-offset-1 ring-offset-[var(--color-bg-primary)] ring-[var(--color-accent)]'
                          : ''
                      }`}
                    >
                      {avatarColor === color.id && (
                        <IoCheckmarkOutline className="w-3 h-3 text-white m-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--color-border)]">
              <SectionHeader
                icon={<IoPersonOutline className="w-4 h-4" />}
                title={t('profile.section_account')}
              />
              <div className="px-6 pb-5 space-y-2">
                <label
                  htmlFor="profile-email"
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]"
                >
                  <IoMailOutline className="w-3.5 h-3.5" />
                  {t('profile.email')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
                    placeholder={t('profile.email_placeholder')}
                    className={`flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 transition-colors ${
                      emailError
                        ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20'
                        : 'border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-[var(--color-accent)]/20'
                    }`}
                  />
                  {emailChanged && (
                    <button
                      type="button"
                      onClick={handleEmailVerification}
                      disabled={isSendingEmailVerification}
                      className="px-3 py-2 rounded-lg bg-[var(--color-accent)] text-xs text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1.5"
                    >
                      {isSendingEmailVerification ? (
                        <IoReloadOutline className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        t('profile.verify_email')
                      )}
                    </button>
                  )}
                  {emailCleared && (
                    <button
                      type="button"
                      onClick={handleEmailRemove}
                      disabled={isSendingEmailVerification}
                      className="px-3 py-2 rounded-lg border border-[var(--color-error)]/30 text-xs text-[var(--color-error)] font-medium hover:bg-[var(--color-error)]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1.5"
                    >
                      {isSendingEmailVerification ? (
                        <IoReloadOutline className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        t('common.delete')
                      )}
                    </button>
                  )}
                </div>
                {emailError && (
                  <p className="text-[11px] text-[var(--color-error)] flex items-center gap-1">
                    <IoWarningOutline className="w-3 h-3 flex-shrink-0" />
                    {emailError}
                  </p>
                )}
                <p className="text-[10px] text-[var(--color-text-tertiary)] leading-tight">
                  {emailChanged
                    ? t('profile.email_verification_hint')
                    : emailCleared
                      ? t('profile.email_remove_hint')
                      : t('profile.email_optional')}
                </p>
              </div>
            </div>

            <div className="border-t border-[var(--color-border)]">
              <SectionHeader
                icon={<IoShieldCheckmarkOutline className="w-4 h-4" />}
                title={t('profile.section_security')}
              />
              <div className="px-6 pb-5 space-y-2">
                <CollapsibleSection
                  icon={<IoShieldCheckmarkOutline className="w-4 h-4" />}
                  title={t('profile.two_factor.title')}
                  isOpen={show2FASection}
                  onToggle={() => setShow2FASection(!show2FASection)}
                  badge={
                    is2FAEnabled ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">
                        {t('profile.two_factor.enabled')}
                      </span>
                    ) : null
                  }
                >
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {t('profile.two_factor.description')}
                    </p>

                    {is2FAEnabled ? (
                      <>
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                          <IoCheckmarkOutline className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-green-600 dark:text-green-400">
                              {t('profile.two_factor.enabled')}
                            </p>
                            {twoFactorStatus && (
                              <p className="text-[10px] text-green-600/70 dark:text-green-400/70">
                                {t('profile.two_factor.recovery_codes_remaining', {
                                  count: twoFactorStatus.recoveryCodesRemaining,
                                })}
                              </p>
                            )}
                          </div>
                        </div>

                        {twoFactorStatus && twoFactorStatus.recoveryCodesRemaining <= 2 && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <IoWarningOutline className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">
                              {t('profile.two_factor.recovery_warning_desc')}
                            </p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setShowDisable2FADialog(true)}
                          className="w-full py-2 rounded-lg text-xs border border-[var(--color-error)]/30 text-[var(--color-error)] font-medium hover:bg-[var(--color-error)]/10 transition-colors"
                        >
                          {t('profile.two_factor.disable')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShow2FASetupModal(true)}
                        className="w-full py-2 rounded-lg text-xs bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
                      >
                        {t('profile.two_factor.enable')}
                      </button>
                    )}
                  </div>
                </CollapsibleSection>

                {is2FAEnabled && (
                  <CollapsibleSection
                    icon={<IoPhonePortraitOutline className="w-4 h-4" />}
                    title={t('profile.trusted_devices.title')}
                    isOpen={showTrustedDevicesSection}
                    onToggle={() => {
                      const opening = !showTrustedDevicesSection
                      setShowTrustedDevicesSection(opening)
                      if (opening && trustedDevices.length === 0) {
                        loadTrustedDevices()
                      }
                    }}
                  >
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {t('profile.trusted_devices.description')}
                      </p>

                      {isLoadingDevices ? (
                        <div className="flex items-center justify-center py-4">
                          <IoReloadOutline className="w-4 h-4 animate-spin text-[var(--color-text-tertiary)]" />
                        </div>
                      ) : trustedDevices.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-xs text-[var(--color-text-tertiary)]">
                            {t('profile.trusted_devices.none')}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {trustedDevices.map((device) => (
                              <div
                                key={device.id}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                                    {device.label}
                                  </p>
                                  <p className="text-[10px] text-[var(--color-text-tertiary)]">
                                    {t('profile.trusted_devices.expires', {
                                      date: new Date(device.expiresAt).toLocaleDateString(i18n.language),
                                    })}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeDevice(device.id)}
                                  disabled={isRevokingDevice === device.id}
                                  className="ml-2 p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors disabled:opacity-50"
                                  aria-label={t('profile.trusted_devices.revoke')}
                                >
                                  {isRevokingDevice === device.id ? (
                                    <IoReloadOutline className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <IoTrashOutline className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={handleRevokeAllDevices}
                            disabled={isLoadingDevices}
                            className="w-full py-2 rounded-lg text-xs border border-[var(--color-error)]/30 text-[var(--color-error)] font-medium hover:bg-[var(--color-error)]/10 transition-colors disabled:opacity-50"
                          >
                            {t('profile.trusted_devices.revoke_all')}
                          </button>
                        </>
                      )}
                    </div>
                  </CollapsibleSection>
                )}

                <CollapsibleSection
                  icon={<IoLockClosedOutline className="w-4 h-4" />}
                  title={t('profile.change_password')}
                  isOpen={showPasswordSection}
                  onToggle={() => setShowPasswordSection(!showPasswordSection)}
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="profile-current-password"
                        className="text-xs font-medium text-[var(--color-text-secondary)]"
                      >
                        {t('profile.current_password')}
                      </label>
                      <div className="relative">
                        <input
                          id="profile-current-password"
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-9 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          aria-label={showCurrentPassword ? t('auth.hide_password') : t('auth.show_password')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                        >
                          {showCurrentPassword ? (
                            <IoEyeOffOutline className="w-4 h-4" />
                          ) : (
                            <IoEyeOutline className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="profile-new-password"
                        className="text-xs font-medium text-[var(--color-text-secondary)]"
                      >
                        {t('profile.new_password')}
                      </label>
                      <div className="relative">
                        <input
                          id="profile-new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={t('profile.password_placeholder')}
                          className="w-full px-3 py-2 pr-9 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label={showNewPassword ? t('auth.hide_password') : t('auth.show_password')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                        >
                          {showNewPassword ? (
                            <IoEyeOffOutline className="w-4 h-4" />
                          ) : (
                            <IoEyeOutline className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="profile-confirm-password"
                        className="text-xs font-medium text-[var(--color-text-secondary)]"
                      >
                        {t('profile.confirm_password')}
                      </label>
                      <input
                        id="profile-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-colors"
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 text-xs text-[var(--color-error)] bg-[var(--color-error)]/10 px-3 py-2.5 rounded-lg" role="alert">
                        <IoWarningOutline className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handlePasswordChange}
                      disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                      className="w-full py-2 rounded-lg text-xs bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {isLoading ? (
                        <>
                          <IoReloadOutline className="w-3.5 h-3.5 animate-spin" />
                          {t('common.loading')}
                        </>
                      ) : (
                        t('profile.change_password')
                      )}
                    </button>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  icon={<IoKeyOutline className="w-4 h-4" />}
                  title={t('sessions.title')}
                  isOpen={showSessionsSection}
                  onToggle={() => setShowSessionsSection(!showSessionsSection)}
                >
                  <SessionsManager />
                </CollapsibleSection>
              </div>
            </div>

          </div>
        </div>
      </div>

      <TwoFactorSetupModal
        isOpen={show2FASetupModal}
        onClose={() => setShow2FASetupModal(false)}
        onEnabled={handle2FAEnabled}
      />

      <ConfirmDialog
        isOpen={showDisable2FADialog}
        onClose={() => {
          setShowDisable2FADialog(false)
          setDisable2FAPassword('')
          setDisable2FACode('')
          setDisableCodeSent(false)
        }}
        onConfirm={handleDisable2FA}
        title={t('profile.two_factor.disable_title')}
        message={t('profile.two_factor.disable_message')}
        confirmLabel={t('profile.two_factor.disable_confirm')}
        isLoading={isDisabling2FA}
        variant="danger"
      >
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t('profile.current_password')}
            </label>
            <input
              type="password"
              value={disable2FAPassword}
              onChange={(e) => setDisable2FAPassword(e.target.value)}
              placeholder={t('profile.current_password')}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t('profile.two_factor.verification_code')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disable2FACode}
                onChange={(e) =>
                  setDisable2FACode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors font-mono text-center tracking-widest"
              />
              <button
                type="button"
                onClick={handleSendDisableCode}
                disabled={isSendingDisableCode || disableCodeSent}
                className="px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-elevated)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isSendingDisableCode ? (
                  <IoReloadOutline className="w-3.5 h-3.5 animate-spin" />
                ) : disableCodeSent ? (
                  t('profile.two_factor.code_sent_short')
                ) : (
                  t('profile.two_factor.send_code')
                )}
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">
              {t('profile.two_factor.code_will_be_sent')}
            </p>
          </div>
        </div>
      </ConfirmDialog>
    </>,
    document.body
  )
}

interface SectionHeaderProps {
  icon: React.ReactNode
  title: string
}

function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-6 pt-4 pb-3">
      <span className="text-[var(--color-accent)]">{icon}</span>
      <h3 className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
        {title}
      </h3>
    </div>
  )
}

interface CollapsibleSectionProps {
  icon: React.ReactNode
  title: string
  isOpen: boolean
  onToggle: () => void
  badge?: React.ReactNode
  children: React.ReactNode
}

function CollapsibleSection({
  icon,
  title,
  isOpen,
  onToggle,
  badge,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full px-3 py-2.5 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-[var(--color-accent)]">{icon}</span>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{title}</span>
          {badge}
        </span>
        <IoChevronDownOutline
          className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-3 py-3 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] animate-slide-down">
          {children}
        </div>
      )}
    </div>
  )
}
