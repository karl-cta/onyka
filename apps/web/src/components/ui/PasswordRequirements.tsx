import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5'

interface PasswordRequirement {
  key: string
  label: string
  validator: (password: string) => boolean
}

interface PasswordRequirementsProps {
  password: string
}

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const { t } = useTranslation()

  const requirements: PasswordRequirement[] = useMemo(
    () => [
      {
        key: 'length',
        label: t('auth.password_requirements.min_length'),
        validator: (pwd: string) => pwd.length >= 12,
      },
      {
        key: 'uppercase',
        label: t('auth.password_requirements.uppercase'),
        validator: (pwd: string) => /[A-Z]/.test(pwd),
      },
      {
        key: 'lowercase',
        label: t('auth.password_requirements.lowercase'),
        validator: (pwd: string) => /[a-z]/.test(pwd),
      },
      {
        key: 'number',
        label: t('auth.password_requirements.number'),
        validator: (pwd: string) => /[0-9]/.test(pwd),
      },
      {
        key: 'special',
        label: t('auth.password_requirements.special'),
        validator: (pwd: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pwd),
      },
    ],
    [t]
  )

  return (
    <div className="mt-3 pt-2">
      <div className="flex flex-col items-center gap-1.5">
        {requirements.map((req) => {
          const isValid = req.validator(password)
          return (
            <div
              key={req.key}
              className="flex items-center justify-center gap-1.5 text-[11px] leading-none transition-all duration-200"
            >
              <span
                className={`flex-shrink-0 transition-all duration-300 ease-spring ${
                  isValid
                    ? 'text-[var(--color-success)] scale-100'
                    : 'text-[var(--color-text-tertiary)] opacity-70 scale-90'
                }`}
              >
                {isValid ? (
                  <IoCheckmarkCircle className="w-3 h-3" />
                ) : (
                  <IoCloseCircle className="w-3 h-3" />
                )}
              </span>
              <span
                className={`transition-colors duration-200 ${
                  isValid
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-text-tertiary)] opacity-70'
                }`}
              >
                {req.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
