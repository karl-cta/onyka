import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { OnykaLogo } from '@/components/ui/OnykaLogo'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IoCheckmarkOutline, IoEyeOutline, IoEyeOffOutline, IoWarningOutline, IoTimeOutline, IoPersonOutline, IoMailOutline, IoLockClosedOutline } from 'react-icons/io5'
import { ThemeToggle, LanguageSwitcher } from '@/components/ui'
import { PasswordRequirements } from '@/components/ui/PasswordRequirements'
import { TwoFactorModal } from '@/components/features/TwoFactorModal'
import { useAuthStore } from '@/stores/auth'
import { twoFactorApi } from '@/services/api'

/** Formats seconds into MM:SS string. */
function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

type FieldErrorType = 'username' | 'password' | 'confirmPassword' | 'email' | 'global'

interface FieldError {
  field: FieldErrorType
  message: string
}

/** Maps backend error messages to the relevant form field. */
function parseErrorToField(error: string, t: (key: string) => string): FieldError {
  const errorLower = error.toLowerCase()

  // Check combined credentials errors before individual field errors
  if (
    (errorLower.includes('username') && errorLower.includes('password')) ||
    errorLower.includes('credential') ||
    errorLower.includes('identifiant')
  ) {
    return { field: 'global', message: t('auth.errors.credentials_invalid') }
  }

  if (
    errorLower.includes('username') ||
    errorLower.includes('user not found') ||
    errorLower.includes('utilisateur')
  ) {
    if (errorLower.includes('taken') || errorLower.includes('exist') || errorLower.includes('déjà')) {
      return { field: 'username', message: t('auth.errors.username_taken') }
    }
    if (errorLower.includes('required') || errorLower.includes('requis')) {
      return { field: 'username', message: t('auth.errors.username_required') }
    }
    if (errorLower.includes('short') || errorLower.includes('court') || errorLower.includes('minimum')) {
      return { field: 'username', message: t('auth.errors.username_too_short') }
    }
    return { field: 'username', message: t('auth.errors.username_invalid') }
  }

  if (
    errorLower.includes('password') ||
    errorLower.includes('mot de passe')
  ) {
    if (errorLower.includes('required') || errorLower.includes('requis')) {
      return { field: 'password', message: t('auth.errors.password_required') }
    }
    if (errorLower.includes('short') || errorLower.includes('court') || errorLower.includes('minimum')) {
      return { field: 'password', message: t('auth.errors.password_too_short') }
    }
    return { field: 'password', message: t('auth.errors.password_invalid') }
  }

  if (errorLower.includes('email') || errorLower.includes('mail')) {
    if (errorLower.includes('taken') || errorLower.includes('exist') || errorLower.includes('déjà') || errorLower.includes('use')) {
      return { field: 'email', message: t('auth.errors.email_taken') }
    }
    if (errorLower.includes('invalid') || errorLower.includes('invalide')) {
      return { field: 'email', message: t('auth.errors.email_invalid') }
    }
    return { field: 'email', message: t('auth.errors.email_required') }
  }

  return { field: 'global', message: error || t('auth.errors.generic') }
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login, register, isAuthenticated, isLoading: isCheckingAuth, error, clearError, rateLimitInfo, setUser } = useAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [fieldError, setFieldError] = useState<FieldError | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mounted, setMounted] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [show2FAModal, setShow2FAModal] = useState(false)
  const [pending2FACredentials, setPending2FACredentials] = useState<{ userId: string; rememberMe: boolean } | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)

  const ids = useMemo(() => ({
    emailInput: 'login-email-input',
    emailError: 'login-email-error',
    usernameInput: 'login-username-input',
    usernameError: 'login-username-error',
    passwordInput: 'login-password-input',
    passwordError: 'login-password-error',
    confirmPasswordInput: 'login-confirm-password-input',
    confirmPasswordError: 'login-confirm-password-error',
    globalError: 'login-global-error',
    rememberMe: 'login-remember-me',
  }), [])

  useEffect(() => {
    if (!isCheckingAuth) setMounted(true)
  }, [isCheckingAuth])

  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }

    if (rateLimitInfo?.retryAfter && rateLimitInfo.retryAfter > 0) {
      setCountdown(rateLimitInfo.retryAfter)
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current)
              countdownRef.current = null
            }
            clearError()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setCountdown(0)
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [rateLimitInfo?.retryAfter, clearError])

  useEffect(() => {
    if (isAuthenticated && !isRedirecting) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, isRedirecting, navigate])

  useEffect(() => {
    if (error) {
      const parsedError = parseErrorToField(error, t)
      setFieldError(parsedError)
      formRef.current?.classList.add('animate-error-shake')
      setTimeout(() => {
        formRef.current?.classList.remove('animate-error-shake')
      }, 500)
    }
  }, [error, t])

  const clearErrors = useCallback(() => {
    setFieldError(null)
    clearError()
  }, [clearError])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    clearErrors()
    setIsSubmitting(true)
    setIsRedirecting(true)

    if (isRegisterMode && password !== confirmPassword) {
      setFieldError({ field: 'confirmPassword', message: t('auth.password_mismatch') })
      setIsSubmitting(false)
      setIsRedirecting(false)
      return
    }

    try {
      if (isRegisterMode) {
        await register(username, password, email || undefined)
      } else {
        await login(username, password, rememberMe)
      }
      setLoginSuccess(true)
      setTimeout(() => navigate('/', { replace: true }), 600)
    } catch (err: unknown) {
      const error2FA = err as { requires2FA?: boolean; userId?: string } | null
      if (error2FA?.requires2FA && error2FA?.userId) {
        clearError()
        setPending2FACredentials({ userId: error2FA.userId, rememberMe })
        twoFactorApi.sendLoginCode(error2FA.userId).catch(() => {})
        setShow2FAModal(true)
        setIsRedirecting(false)
        return
      }
      setIsRedirecting(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handle2FAVerify = useCallback(async (code: string, isRecoveryCode: boolean, trustDevice: boolean): Promise<boolean> => {
    if (!pending2FACredentials) return false

    try {
      const result = await twoFactorApi.verify(pending2FACredentials.userId, code, isRecoveryCode, pending2FACredentials.rememberMe, trustDevice)
      if (result.user) {
        setUser(result.user)
        setIsRedirecting(true)
        setLoginSuccess(true)
        setTimeout(() => navigate('/', { replace: true }), 600)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [pending2FACredentials, navigate, setUser])

  const handle2FAResendCode = useCallback(async () => {
    if (!pending2FACredentials) return { success: false }
    try {
      const result = await twoFactorApi.sendLoginCode(pending2FACredentials.userId)
      return { success: result.sent }
    } catch (err) {
      const apiErr = err as { rateLimitInfo?: { retryAfter?: number } } | null
      if (apiErr?.rateLimitInfo?.retryAfter) {
        return { success: false, waitSeconds: apiErr.rateLimitInfo.retryAfter }
      }
      return { success: false }
    }
  }, [pending2FACredentials])

  const handle2FAClose = useCallback(() => {
    setShow2FAModal(false)
    setPending2FACredentials(null)
    setIsRedirecting(false)
  }, [])

  const toggleMode = () => {
    const switchingToLogin = isRegisterMode
    setIsRegisterMode(!isRegisterMode)
    setConfirmPassword('')
    clearErrors()
    if (switchingToLogin) {
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }

  const hasFieldError = (field: FieldErrorType): boolean => fieldError?.field === field
  const getFieldErrorMessage = (field: FieldErrorType): string | null => hasFieldError(field) ? fieldError?.message ?? null : null
  const getAriaDescribedBy = (field: FieldErrorType, errorId: string): string | undefined => hasFieldError(field) ? errorId : undefined

  const isLockedOut = countdown > 0
  const showAttemptsWarning = rateLimitInfo?.remainingAttempts !== undefined &&
    rateLimitInfo.remainingAttempts > 0 &&
    rateLimitInfo.remainingAttempts <= 2 &&
    !isLockedOut

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center bg-[var(--color-bg-primary)] px-4 relative overflow-hidden pt-[15vh]">
        <div className="login-ambient-bg" aria-hidden="true">
          <div className="login-ambient-glow-top" />
          <div className="login-ambient-glow-left" />
          <div className="login-ambient-glow-right" />
        </div>

        <div className="relative z-10 w-full max-w-[280px]" aria-busy="true" aria-label={t('common.loading')}>
          <div className="login-glass-card rounded-2xl p-6 pt-8">
            <div className="login-gradient-line" aria-hidden="true" />
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-3 login-skeleton" />
              <div className="h-5 w-16 mx-auto rounded login-skeleton mb-1" />
              <div className="h-4 w-28 mx-auto rounded login-skeleton" />
            </div>

            <div className="space-y-3">
              <div className="h-[72px] w-full rounded-lg login-skeleton" />
              <div className="h-4 w-24 mx-auto rounded login-skeleton" />
              <div className="pt-1">
                <div className="h-11 w-full rounded-lg login-skeleton" />
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="h-4 w-32 rounded login-skeleton" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-[var(--color-bg-primary)] px-4 relative overflow-hidden pt-[15vh]">
      <div className="login-ambient-bg" aria-hidden="true">
        <div className="login-ambient-glow-top" />
        <div className="login-ambient-glow-left" />
        <div className="login-ambient-glow-right" />
      </div>

      <div
        className={`fixed top-5 right-5 z-10 flex items-center gap-2 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <main
        className={`relative z-10 w-full max-w-[280px] transition-all duration-700 ease-smooth ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        } ${loginSuccess ? 'scale-95 opacity-0' : ''}`}
      >
        <div className="login-glass-card rounded-2xl p-6 pt-8">
          <div className="login-gradient-line" aria-hidden="true" />
        <div className="text-center mb-6">
          <div className="relative inline-block mb-3">
            <div
              className={`absolute -inset-2 rounded-full transition-all duration-500 ease-out ${
                isInputFocused && !loginSuccess
                  ? 'opacity-40 scale-100'
                  : 'opacity-0 scale-90'
              }`}
              style={{
                background: `conic-gradient(from 0deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #8b5cf6), var(--color-accent))`,
                filter: 'blur(10px)',
              }}
              aria-hidden="true"
            />

            <div
              className={`absolute inset-0 rounded-full transition-all duration-500 ${
                loginSuccess ? 'opacity-60 scale-150' : isInputFocused ? 'opacity-30' : 'opacity-10'
              }`}
              style={{
                background: loginSuccess ? '#22c55e' : 'var(--color-accent)',
                filter: 'blur(16px)',
              }}
              aria-hidden="true"
            />

            <div
              className={`relative inline-flex items-center justify-center w-20 h-20 rounded-full transition-all duration-500 ${
                loginSuccess ? 'scale-110' : ''
              }`}
            >
              {loginSuccess ? (
                <IoCheckmarkOutline className="w-12 h-12 text-green-500 animate-success-check" aria-hidden="true" />
              ) : (
                <OnykaLogo className="w-full h-full" />
              )}
            </div>

            {loginSuccess && (
              <div className="login-success-particles" aria-hidden="true">
                <div className="login-particle login-particle-1" />
                <div className="login-particle login-particle-2" />
                <div className="login-particle login-particle-3" />
                <div className="login-particle login-particle-4" />
                <div className="login-particle login-particle-5" />
                <div className="login-particle login-particle-6" />
                <div className="login-particle login-particle-7" />
                <div className="login-particle login-particle-8" />
              </div>
            )}
          </div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Onyka
          </h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)] mt-0.5">
            {isRegisterMode ? t('auth.create_tagline') : t('auth.tagline')}
          </p>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div id={ids.globalError} aria-live="polite" aria-atomic="true" className="empty:hidden">
            {isLockedOut && (
              <div
                role="alert"
                className="flex flex-col items-center gap-2 py-3 px-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 animate-fade-in"
              >
                <div className="flex items-center gap-2 text-[var(--color-error)]">
                  <IoTimeOutline className="w-4 h-4 animate-pulse" aria-hidden="true" />
                  <span className="text-xs font-medium">
                    {t('auth.errors.rate_limit_locked')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-lg font-mono font-semibold text-[var(--color-error)] tabular-nums animate-rate-limit-pulse"
                    aria-label={t('auth.errors.rate_limit_countdown', { time: formatCountdown(countdown) })}
                  >
                    {formatCountdown(countdown)}
                  </span>
                </div>
              </div>
            )}

            {showAttemptsWarning && !isLockedOut && (
              <div
                role="alert"
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-fade-in"
              >
                <IoWarningOutline className="w-4 h-4 text-amber-500 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {t('auth.errors.rate_limit_warning', { remaining: rateLimitInfo?.remainingAttempts })}
                </span>
              </div>
            )}

            {hasFieldError('global') && !isLockedOut && !showAttemptsWarning && (
              <p
                role="alert"
                className="text-xs text-center text-[var(--color-error)] py-1 animate-fade-in"
              >
                {getFieldErrorMessage('global')}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <div className="rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-secondary)] divide-y divide-[var(--color-border)] transition-colors duration-200 focus-within:border-[var(--color-text-tertiary)] focus-within:divide-[var(--color-text-tertiary)]">
              <div className="relative flex items-center">
                <IoPersonOutline className="absolute left-3 w-3.5 h-3.5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                <label htmlFor={ids.usernameInput} className="sr-only">
                  {t('auth.username')}
                </label>
                <input
                  ref={firstInputRef}
                  id={ids.usernameInput}
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (hasFieldError('username') || hasFieldError('global')) clearErrors()
                  }}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder={t('auth.username')}
                  required
                  autoComplete="username"
                  minLength={3}
                  aria-invalid={hasFieldError('username')}
                  aria-describedby={getAriaDescribedBy('username', ids.usernameError)}
                  className={`w-full h-9 pl-9 pr-3 text-[13px] bg-transparent border-0
                    text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]
                    focus:outline-none focus:bg-[var(--color-bg-tertiary)]/50
                    focus:placeholder:opacity-0 placeholder:transition-opacity
                    transition-colors duration-150 login-input-smooth-caret
                    ${hasFieldError('username') ? 'bg-[var(--color-error)]/5' : ''}`}
                />
              </div>

              {isRegisterMode && (
                <div className="relative flex items-center">
                  <IoMailOutline className="absolute left-3 w-3.5 h-3.5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                  <label htmlFor={ids.emailInput} className="sr-only">
                    {t('auth.email')}
                  </label>
                  <input
                    id={ids.emailInput}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (hasFieldError('email')) clearErrors()
                    }}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    placeholder={t('auth.email_optional')}
                    autoComplete="email"
                    aria-invalid={hasFieldError('email')}
                    aria-describedby={getAriaDescribedBy('email', ids.emailError)}
                    className={`w-full h-9 pl-9 pr-3 text-[13px] bg-transparent border-0
                      text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]
                      focus:outline-none focus:bg-[var(--color-bg-tertiary)]/50
                      focus:placeholder:opacity-0 placeholder:transition-opacity
                      transition-colors duration-150 login-input-smooth-caret
                      ${hasFieldError('email') ? 'bg-[var(--color-error)]/5' : ''}`}
                  />
                </div>
              )}

              <div className="relative flex items-center">
                <IoLockClosedOutline className="absolute left-3 w-3.5 h-3.5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                <label htmlFor={ids.passwordInput} className="sr-only">
                  {t('auth.password')}
                </label>
                <input
                  id={ids.passwordInput}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (hasFieldError('password') || hasFieldError('global')) clearErrors()
                  }}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder={t('auth.password')}
                  required
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  minLength={isRegisterMode ? 12 : 1}
                  aria-invalid={hasFieldError('password')}
                  aria-describedby={getAriaDescribedBy('password', ids.passwordError)}
                  className={`w-full h-9 pl-9 pr-8 text-[13px] bg-transparent border-0
                    text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]
                    focus:outline-none focus:bg-[var(--color-bg-tertiary)]/50
                    focus:placeholder:opacity-0 placeholder:transition-opacity
                    transition-colors duration-150 login-input-smooth-caret
                    ${hasFieldError('password') ? 'bg-[var(--color-error)]/5' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors duration-150"
                  tabIndex={-1}
                  aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <IoEyeOffOutline className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <IoEyeOutline className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>

              {isRegisterMode && (
                <div className="relative flex items-center">
                  <IoLockClosedOutline className="absolute left-3 w-3.5 h-3.5 text-[var(--color-text-tertiary)]" aria-hidden="true" />
                  <label htmlFor={ids.confirmPasswordInput} className="sr-only">
                    {t('auth.confirm_password')}
                  </label>
                  <input
                    id={ids.confirmPasswordInput}
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (hasFieldError('confirmPassword')) clearErrors()
                    }}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    placeholder={t('auth.confirm_password')}
                    required
                    autoComplete="new-password"
                    aria-invalid={hasFieldError('confirmPassword')}
                    aria-describedby={getAriaDescribedBy('confirmPassword', ids.confirmPasswordError)}
                    className={`w-full h-9 pl-9 pr-3 text-[13px] bg-transparent border-0
                      text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]
                      focus:outline-none focus:bg-[var(--color-bg-tertiary)]/50
                      focus:placeholder:opacity-0 placeholder:transition-opacity
                      transition-colors duration-150 login-input-smooth-caret
                      ${hasFieldError('confirmPassword') ? 'bg-[var(--color-error)]/5' : ''}`}
                  />
                </div>
              )}
            </div>

            {(hasFieldError('username') || hasFieldError('email') || hasFieldError('password') || hasFieldError('confirmPassword')) && (
              <p
                id={hasFieldError('username') ? ids.usernameError : hasFieldError('email') ? ids.emailError : hasFieldError('confirmPassword') ? ids.confirmPasswordError : ids.passwordError}
                role="alert"
                className="text-xs text-center text-[var(--color-error)] mt-1.5 animate-fade-in"
              >
                {getFieldErrorMessage('username') || getFieldErrorMessage('email') || getFieldErrorMessage('password') || getFieldErrorMessage('confirmPassword')}
              </p>
            )}

            {isRegisterMode && <PasswordRequirements password={password} />}
          </div>

          {!isRegisterMode && (
            <div className="flex items-center justify-center gap-2 mt-1">
              <input
                type="checkbox"
                id={ids.rememberMe}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only peer"
              />
              <label
                htmlFor={ids.rememberMe}
                className="flex items-center gap-2 cursor-pointer group select-none"
              >
                <div
                  className={`
                    w-4 h-4 rounded flex items-center justify-center
                    border transition-all duration-200 ease-out
                    ${rememberMe
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-transparent group-hover:border-[var(--color-text-tertiary)]'
                    }
                    peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2
                  `}
                  aria-hidden="true"
                >
                  <IoCheckmarkOutline
                    className={`
                      w-3 h-3 text-white transition-all duration-200 ease-out
                      ${rememberMe ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
                    `}
                  />
                </div>
                <span className="text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors duration-200">
                  {t('auth.remember_me')}
                </span>
              </label>
            </div>
          )}

          <div className="pt-3 flex justify-center">
            <button
              type="submit"
              disabled={isSubmitting || loginSuccess || isLockedOut}
              className={`skew-button ${loginSuccess ? 'success' : ''} ${isSubmitting ? 'loading' : ''} ${isLockedOut ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-busy={isSubmitting}
              aria-disabled={isLockedOut}
            >
              <span>
                {loginSuccess ? (
                  <IoCheckmarkOutline className="w-4 h-4" aria-hidden="true" />
                ) : (
                  isRegisterMode ? t('auth.register_button') : t('auth.login_button')
                )}
              </span>
              {isSubmitting && <span className="sr-only">{t('common.loading')}</span>}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-[13px] text-[var(--color-text-tertiary)]">
          {isRegisterMode ? t('auth.have_account') : t('auth.no_account')}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="text-[var(--color-accent)] hover:underline font-medium transition-colors"
          >
            {isRegisterMode ? t('auth.sign_in') : t('auth.create_one')}
          </button>
        </p>
        </div>
      </main>

      <TwoFactorModal
        isOpen={show2FAModal}
        onClose={handle2FAClose}
        onVerify={handle2FAVerify}
        onResendCode={handle2FAResendCode}
        isLoading={isSubmitting}
      />
    </div>
  )
}
