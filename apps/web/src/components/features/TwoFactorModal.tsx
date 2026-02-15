import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { IoMailOutline, IoKeyOutline, IoCheckmarkOutline, IoRefreshOutline } from 'react-icons/io5'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export interface ResendResult {
  success: boolean
  waitSeconds?: number
}

interface TwoFactorModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (code: string, isRecoveryCode: boolean, trustDevice: boolean) => Promise<boolean>
  onResendCode?: () => Promise<ResendResult>
  isLoading?: boolean
  codeSent?: boolean // Whether code was already sent
}

type InputMode = 'email' | 'recovery'

export function TwoFactorModal({ isOpen, onClose, onVerify, onResendCode, isLoading = false }: TwoFactorModalProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const [inputMode, setInputMode] = useState<InputMode>('email')
  const [emailDigits, setEmailDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [recoveryCode, setRecoveryCode] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [shake, setShake] = useState(false)
  const [trustDevice, setTrustDevice] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const recoveryInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setEmailDigits(['', '', '', '', '', ''])
      setRecoveryCode('')
      setError(null)
      setIsSuccess(false)
      setInputMode('email')
      setResendSuccess(false)
      setResendCooldown(0)
      setTrustDevice(false)

      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }, [isOpen])

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputMode === 'email') {
          inputRefs.current[0]?.focus()
        } else {
          recoveryInputRef.current?.focus()
        }
      }, 50)
    }
  }, [inputMode, isOpen])

  // 2FA modal must NOT close on Escape — user must use Cancel button
  // to prevent accidental dismissal and code spam

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  const handleVerification = useCallback(async (code: string, isRecovery: boolean) => {
    setIsVerifying(true)
    setError(null)

    try {
      const success = await onVerify(code, isRecovery, trustDevice)

      if (success) {
        setIsSuccess(true)
        setTimeout(() => {
          onClose()
        }, 600)
      } else {
        setError(t('auth.two_factor.invalid_code'))
        triggerShake()
        if (!isRecovery) {
          setEmailDigits(['', '', '', '', '', ''])
          setTimeout(() => inputRefs.current[0]?.focus(), 100)
        }
      }
    } catch {
      setError(t('auth.two_factor.verification_error'))
      triggerShake()
    } finally {
      setIsVerifying(false)
    }
  }, [onVerify, onClose, t, triggerShake, trustDevice])

  const handleResendCode = useCallback(async () => {
    if (!onResendCode || isResending || resendCooldown > 0) return

    setIsResending(true)
    setError(null)

    try {
      const result = await onResendCode()
      if (result.success) {
        setResendSuccess(true)
        setTimeout(() => setResendSuccess(false), 3000)
      } else if (result.waitSeconds) {
        setResendCooldown(result.waitSeconds)
      } else {
        setError(t('auth.two_factor.resend_error'))
      }
    } catch {
      setError(t('auth.two_factor.resend_error'))
    } finally {
      setIsResending(false)
    }
  }, [onResendCode, isResending, resendCooldown, t])

  const handleDigitChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)

    const newDigits = [...emailDigits]
    newDigits[index] = digit
    setEmailDigits(newDigits)
    setError(null)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (digit && index === 5) {
      const code = [...newDigits.slice(0, 5), digit].join('')
      if (code.length === 6) {
        handleVerification(code, false)
      }
    }
  }, [emailDigits, handleVerification])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)

    if (pastedData.length > 0) {
      const newDigits = [...emailDigits]
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newDigits[i] = pastedData[i]
      }
      setEmailDigits(newDigits)

      const focusIndex = Math.min(pastedData.length, 5)
      inputRefs.current[focusIndex]?.focus()

      if (pastedData.length === 6) {
        handleVerification(pastedData, false)
      }
    }
  }, [emailDigits, handleVerification])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!emailDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newDigits = [...emailDigits]
        newDigits[index - 1] = ''
        setEmailDigits(newDigits)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [emailDigits])

  const handleRecoverySubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (recoveryCode.trim().length > 0) {
      handleVerification(recoveryCode.trim(), true)
    }
  }, [recoveryCode, handleVerification])

  const switchToRecovery = useCallback(() => {
    setInputMode('recovery')
    setError(null)
    setEmailDigits(['', '', '', '', '', ''])
  }, [])

  const switchToEmail = useCallback(() => {
    setInputMode('email')
    setError(null)
    setRecoveryCode('')
  }, [])

  if (!isOpen) return null

  const isProcessing = isVerifying || isLoading

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={(node) => {
            modalRef.current = node
            // Also assign to focusTrapRef
            ;(focusTrapRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          }}
          role="dialog"
          aria-modal="true"
          aria-label={t('auth.two_factor.title')}
          className={`
            bg-[var(--color-bg-primary)] border border-[var(--color-border)]
            rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto
            animate-scale-in overflow-hidden
            ${shake ? 'animate-error-shake' : ''}
            ${isSuccess ? 'scale-95 opacity-0 transition-all duration-300' : ''}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center pt-8 pb-4 px-6">
            <div
              className={`
                w-16 h-16 rounded-2xl flex items-center justify-center mb-4
                transition-all duration-500
                ${isSuccess
                  ? 'bg-green-500 scale-110'
                  : 'bg-[var(--color-accent)]/10'
                }
              `}
            >
              {isSuccess ? (
                <IoCheckmarkOutline className="w-8 h-8 text-white animate-success-check" />
              ) : (
                <IoMailOutline className="w-8 h-8 text-[var(--color-accent)]" />
              )}
            </div>

            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] text-center">
              {t('auth.two_factor.title')}
            </h2>
            <p className="text-sm text-[var(--color-text-tertiary)] text-center mt-2">
              {inputMode === 'email'
                ? t('auth.two_factor.enter_email_code')
                : t('auth.two_factor.enter_recovery')
              }
            </p>
          </div>

          <div className="px-6 pb-6">
            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20"
              >
                <p className="text-sm text-[var(--color-error)] text-center">
                  {error}
                </p>
              </div>
            )}

            {inputMode === 'email' ? (
              <div className="space-y-6">
                <div
                  className="flex justify-center gap-2"
                  onPaste={handlePaste}
                >
                  {emailDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      disabled={isProcessing || isSuccess}
                      aria-label={t('auth.two_factor.digit_label', { n: index + 1 })}
                      className={`
                        w-11 h-14 text-center text-2xl font-mono font-semibold
                        rounded-xl border-2 transition-all duration-200
                        bg-[var(--color-bg-tertiary)]
                        text-[var(--color-text-primary)]
                        placeholder:text-[var(--color-text-tertiary)]
                        focus:outline-none focus:border-[var(--color-accent)]
                        focus:ring-4 focus:ring-[var(--color-accent)]/20
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${error
                          ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20'
                          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                        }
                        ${digit ? 'border-[var(--color-accent)]/50' : ''}
                      `}
                    />
                  ))}
                </div>

                {isProcessing && (
                  <div className="flex justify-center">
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
                      <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                      {t('auth.two_factor.verifying')}
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center gap-2">
                  {onResendCode && (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={isProcessing || isResending || resendCooldown > 0}
                      className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
                    >
                      <IoRefreshOutline className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
                      {resendSuccess
                        ? t('auth.two_factor.code_resent')
                        : resendCooldown > 0
                          ? t('auth.two_factor.resend_wait', { seconds: resendCooldown })
                          : t('auth.two_factor.resend_code')
                      }
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={switchToRecovery}
                    disabled={isProcessing}
                    className="text-sm text-[var(--color-accent)] hover:underline transition-colors disabled:opacity-50"
                  >
                    {t('auth.two_factor.use_recovery')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div className="relative">
                  <IoKeyOutline className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-tertiary)]" />
                  <input
                    ref={recoveryInputRef}
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => {
                      setRecoveryCode(e.target.value)
                      setError(null)
                    }}
                    placeholder={t('auth.two_factor.recovery_placeholder')}
                    disabled={isProcessing || isSuccess}
                    autoComplete="off"
                    className={`
                      w-full h-12 pl-10 pr-4 text-center font-mono
                      rounded-xl border-2 transition-all duration-200
                      bg-[var(--color-bg-tertiary)]
                      text-[var(--color-text-primary)]
                      placeholder:text-[var(--color-text-tertiary)]
                      focus:outline-none focus:border-[var(--color-accent)]
                      focus:ring-4 focus:ring-[var(--color-accent)]/20
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${error
                        ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                      }
                    `}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isProcessing || !recoveryCode.trim() || isSuccess}
                  className={`
                    w-full h-11 rounded-xl font-medium text-white
                    transition-all duration-200
                    ${isProcessing
                      ? 'bg-[var(--color-accent)]/70 cursor-not-allowed'
                      : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:scale-[0.98]'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('auth.two_factor.verifying')}
                    </span>
                  ) : (
                    t('auth.two_factor.verify_button')
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={switchToEmail}
                    disabled={isProcessing}
                    className="text-sm text-[var(--color-accent)] hover:underline transition-colors disabled:opacity-50"
                  >
                    {t('auth.two_factor.use_email_code')}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="px-6 pb-6 space-y-3">
            <label className="flex items-center justify-center gap-2 cursor-pointer group select-none">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                disabled={isProcessing || isSuccess}
                className="sr-only peer"
              />
              <div
                className={`
                  w-4 h-4 rounded flex items-center justify-center
                  border transition-all duration-200 ease-out
                  ${trustDevice
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                    : 'border-[var(--color-border)] bg-transparent group-hover:border-[var(--color-text-tertiary)]'
                  }
                  peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2
                  peer-disabled:opacity-50
                `}
                aria-hidden="true"
              >
                <IoCheckmarkOutline
                  className={`
                    w-3 h-3 text-white transition-all duration-200 ease-out
                    ${trustDevice ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
                  `}
                />
              </div>
              <span className="text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors duration-200">
                {t('auth.two_factor.trust_device')}
              </span>
            </label>

            <p className="text-xs text-[var(--color-text-tertiary)] text-center">
              {inputMode === 'email'
                ? t('auth.two_factor.email_hint')
                : t('auth.two_factor.recovery_hint')
              }
            </p>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="w-full py-2 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
