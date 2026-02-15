import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IoCheckmarkCircle, IoCloseCircle, IoMailOutline } from 'react-icons/io5'
import { emailVerificationApi } from '@/services/api'

type VerificationState = 'verifying' | 'success' | 'error' | 'no-token'

export function VerifyEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<VerificationState>('verifying')
  const [email, setEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setState('no-token')
      return
    }

    const verifyEmail = async () => {
      try {
        const result = await emailVerificationApi.verify(token)
        if (result.verified) {
          setEmail(result.email)
          setState('success')
        } else {
          setState('error')
          setErrorMessage(t('auth.email_verification.invalid_token'))
        }
      } catch (err) {
        setState('error')
        setErrorMessage(
          err instanceof Error ? err.message : t('auth.email_verification.generic_error')
        )
      }
    }

    verifyEmail()
  }, [token, t])

  const handleContinue = () => {
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] px-4">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute w-[600px] h-[400px] left-1/2 -translate-x-1/2 top-1/4 rounded-full opacity-[0.15]"
          style={{
            background: `radial-gradient(ellipse, ${
              state === 'success' ? '#22c55e' : state === 'error' ? '#ef4444' : 'var(--color-accent)'
            } 0%, transparent 70%)`,
            filter: 'blur(100px)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        <div className="mb-6">
          {state === 'verifying' && (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {state === 'success' && (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20">
              <IoCheckmarkCircle className="w-10 h-10 text-green-500" />
            </div>
          )}
          {(state === 'error' || state === 'no-token') && (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20">
              {state === 'no-token' ? (
                <IoMailOutline className="w-10 h-10 text-red-500" />
              ) : (
                <IoCloseCircle className="w-10 h-10 text-red-500" />
              )}
            </div>
          )}
        </div>

        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
          {state === 'verifying' && t('auth.email_verification.verifying_title')}
          {state === 'success' && t('auth.email_verification.success_title')}
          {state === 'error' && t('auth.email_verification.error_title')}
          {state === 'no-token' && t('auth.email_verification.no_token_title')}
        </h1>

        <p className="text-[var(--color-text-secondary)] mb-8">
          {state === 'verifying' && t('auth.email_verification.verifying_description')}
          {state === 'success' && (
            <>
              {t('auth.email_verification.success_description')}
              {email && (
                <span className="block mt-2 text-[var(--color-text-primary)] font-medium">
                  {email}
                </span>
              )}
            </>
          )}
          {state === 'error' && (errorMessage || t('auth.email_verification.error_description'))}
          {state === 'no-token' && t('auth.email_verification.no_token_description')}
        </p>

        {(state === 'success' || state === 'error' || state === 'no-token') && (
          <button
            onClick={handleContinue}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg
              bg-[var(--color-accent)] text-white font-medium
              hover:opacity-90 transition-opacity"
          >
            {state === 'success'
              ? t('auth.email_verification.continue_button')
              : t('auth.email_verification.back_to_login')}
          </button>
        )}
      </div>
    </div>
  )
}
