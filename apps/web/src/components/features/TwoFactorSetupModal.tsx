import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  IoCloseOutline,
  IoMailOutline,
  IoKeyOutline,
  IoCopyOutline,
  IoCheckmarkOutline,
  IoWarningOutline,
  IoReloadOutline,
  IoArrowForwardOutline,
  IoRefreshOutline,
} from 'react-icons/io5'
import { twoFactorApi } from '@/services/api'
import { toast } from '@/components/ui/Toast'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface TwoFactorSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onEnabled: () => void
}

type Step = 'intro' | 'verify' | 'recovery'

export function TwoFactorSetupModal({ isOpen, onClose, onEnabled }: TwoFactorSetupModalProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const [step, setStep] = useState<Step>('intro')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [, setCodeSent] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (isOpen) {
      setStep('intro')
      setRecoveryCodes([])
      setVerificationCode(['', '', '', '', '', ''])
      setError(null)
      setCopiedCodes(false)
      setCodeSent(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (step === 'verify') {
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [step])

  // 2FA setup modal must NOT close on Escape — user must use the close button
  // to prevent accidental dismissal during sensitive setup flow

  const sendVerificationCode = async () => {
    setIsSendingCode(true)
    setError(null)
    try {
      const response = await twoFactorApi.sendCode('enable_2fa')
      if (response.sent) {
        setCodeSent(true)
        setStep('verify')
        toast.success(t('profile.two_factor.code_sent'))
      } else {
        setError(t('profile.two_factor.send_code_error'))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.two_factor.send_code_error')
      setError(message)
    } finally {
      setIsSendingCode(false)
    }
  }

  const resendCode = async () => {
    setIsSendingCode(true)
    setError(null)
    try {
      const response = await twoFactorApi.sendCode('enable_2fa')
      if (response.sent) {
        toast.success(t('profile.two_factor.code_resent'))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.two_factor.resend_error')
      setError(message)
    } finally {
      setIsSendingCode(false)
    }
  }

  const handleDigitChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newCode = [...verificationCode]
    newCode[index] = digit
    setVerificationCode(newCode)
    setError(null)

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [verificationCode])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!verificationCode[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
        const newCode = [...verificationCode]
        newCode[index - 1] = ''
        setVerificationCode(newCode)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [verificationCode])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData.length > 0) {
      const newCode = [...verificationCode]
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newCode[i] = pastedData[i]
      }
      setVerificationCode(newCode)
      const focusIndex = Math.min(pastedData.length, 5)
      inputRefs.current[focusIndex]?.focus()
    }
  }, [verificationCode])

  const verifyCode = async () => {
    const code = verificationCode.join('')
    if (code.length !== 6) {
      setError(t('profile.two_factor.code_length_error'))
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const response = await twoFactorApi.enable(code)
      setRecoveryCodes(response.recoveryCodes)
      setStep('recovery')
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.two_factor.verify_error')
      setError(message)
      setVerificationCode(['', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } finally {
      setIsLoading(false)
    }
  }

  const copyRecoveryCodes = async () => {
    const codesText = recoveryCodes.join('\n')
    await navigator.clipboard.writeText(codesText)
    setCopiedCodes(true)
    toast.success(t('profile.two_factor.codes_copied'))
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  const downloadRecoveryCodes = () => {
    const codesText = `Onyka Recovery Codes\n${'='.repeat(30)}\n\nSave these codes in a secure place.\nEach code can only be used once.\n\n${recoveryCodes.join('\n')}\n\nGenerated: ${new Date().toISOString()}`
    const blob = new Blob([codesText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'onyka-recovery-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(t('profile.two_factor.codes_downloaded'))
  }

  const finishSetup = () => {
    onEnabled()
    onClose()
    toast.success(t('profile.two_factor.enabled_success'))
  }

  if (!isOpen) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('profile.two_factor.setup_title')}
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden pointer-events-auto animate-scale-in flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center">
                <IoMailOutline className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t('profile.two_factor.setup_title')}
                </h2>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {step === 'intro' && t('profile.two_factor.step_intro_email')}
                  {step === 'verify' && t('profile.two_factor.step_verify')}
                  {step === 'recovery' && t('profile.two_factor.step_recovery')}
                </p>
              </div>
            </div>
            {step !== 'recovery' && (
              <button
                onClick={onClose}
                disabled={isLoading}
                aria-label={t('common.close')}
                className="p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
              >
                <IoCloseOutline className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {step === 'intro' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
                    <IoMailOutline className="w-10 h-10 text-[var(--color-accent)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                    {t('profile.two_factor.intro_title')}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t('profile.two_factor.intro_description_email')}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                    <IoMailOutline className="w-5 h-5 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {t('profile.two_factor.email_step1_title')}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {t('profile.two_factor.email_step1_desc')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
                    <IoKeyOutline className="w-5 h-5 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {t('profile.two_factor.email_step2_title')}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {t('profile.two_factor.email_step2_desc')}
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)]">
                    <IoWarningOutline className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={sendVerificationCode}
                  disabled={isSendingCode}
                  className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSendingCode ? (
                    <>
                      <IoReloadOutline className="w-4 h-4 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      {t('profile.two_factor.send_code')}
                      <IoArrowForwardOutline className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {step === 'verify' && (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t('profile.two_factor.verify_email_instruction')}
                  </p>
                </div>

                <div
                  className="flex justify-center gap-2"
                  onPaste={handlePaste}
                >
                  {verificationCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      disabled={isLoading}
                      className={`
                        w-11 h-14 text-center text-2xl font-mono font-semibold
                        rounded-xl border-2 transition-all duration-200
                        bg-[var(--color-bg-tertiary)]
                        text-[var(--color-text-primary)]
                        focus:outline-none focus:border-[var(--color-accent)]
                        focus:ring-4 focus:ring-[var(--color-accent)]/20
                        disabled:opacity-50
                        ${error
                          ? 'border-[var(--color-error)]'
                          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                        }
                        ${digit ? 'border-[var(--color-accent)]/50' : ''}
                      `}
                    />
                  ))}
                </div>

                {error && (
                  <div className="flex items-center justify-center gap-2 text-[var(--color-error)]">
                    <IoWarningOutline className="w-4 h-4" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div className="text-center">
                  <button
                    onClick={resendCode}
                    disabled={isSendingCode}
                    className="flex items-center gap-1.5 mx-auto text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
                  >
                    <IoRefreshOutline className={`w-4 h-4 ${isSendingCode ? 'animate-spin' : ''}`} />
                    {t('profile.two_factor.resend_code')}
                  </button>
                </div>

                <button
                  onClick={verifyCode}
                  disabled={isLoading || verificationCode.join('').length !== 6}
                  className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <IoReloadOutline className="w-4 h-4 animate-spin" />
                      {t('auth.two_factor.verifying')}
                    </>
                  ) : (
                    t('profile.two_factor.enable_2fa')
                  )}
                </button>
              </div>
            )}

            {step === 'recovery' && (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-3">
                    <IoWarningOutline className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        {t('profile.two_factor.recovery_warning_title')}
                      </p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                        {t('profile.two_factor.recovery_warning_desc')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="grid grid-cols-2 gap-2">
                    {recoveryCodes.map((code, index) => (
                      <div
                        key={index}
                        className="font-mono text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] px-3 py-2 rounded-lg text-center"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={copyRecoveryCodes}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-elevated)] transition-colors flex items-center justify-center gap-2"
                  >
                    {copiedCodes ? (
                      <IoCheckmarkOutline className="w-4 h-4 text-green-500" />
                    ) : (
                      <IoCopyOutline className="w-4 h-4" />
                    )}
                    {t('profile.two_factor.copy_codes')}
                  </button>
                  <button
                    onClick={downloadRecoveryCodes}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-bg-elevated)] transition-colors"
                  >
                    {t('profile.two_factor.download_codes')}
                  </button>
                </div>

                <button
                  onClick={finishSetup}
                  className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-hover)] transition-colors flex items-center justify-center gap-2"
                >
                  <IoCheckmarkOutline className="w-4 h-4" />
                  {t('profile.two_factor.finish_setup')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
