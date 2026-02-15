import { useMemo } from 'react'

interface PasswordStrengthIndicatorProps {
  password: string
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong'

interface StrengthResult {
  level: StrengthLevel
  score: number
  label: string
  color: string
}

/**
 * Evaluates password strength based on multiple criteria:
 * - Length >= 12 chars (minimum requirement)
 * - Length >= 16 chars (strong)
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains digit
 * - Contains special character
 */
function evaluatePassword(password: string): StrengthResult {
  let score = 0

  // Length criteria
  if (password.length >= 12) score++
  if (password.length >= 16) score++

  // Character type criteria
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  // Map score to strength level (0-6 points -> 4 levels)
  let level: StrengthLevel
  let label: string
  let color: string

  if (score <= 2) {
    level = 'weak'
    label = 'Faible'
    color = 'var(--color-error)' // red
  } else if (score <= 3) {
    level = 'fair'
    label = 'Moyen'
    color = '#F97316' // orange
  } else if (score <= 4) {
    level = 'good'
    label = 'Bon'
    color = '#EAB308' // yellow
  } else {
    level = 'strong'
    label = 'Fort'
    color = 'var(--color-success)' // green
  }

  return { level, score, label, color }
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => evaluatePassword(password), [password])

  // Don't show anything if password is empty
  if (!password) {
    return null
  }

  // Calculate progress bar width (4 levels = 25% each segment)
  const levelToWidth: Record<StrengthLevel, number> = {
    weak: 25,
    fair: 50,
    good: 75,
    strong: 100,
  }
  const progressWidth = levelToWidth[strength.level]

  return (
    <div className="w-full space-y-1.5">
      {/* Progress bar container */}
      <div className="relative h-1 w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
        {/* Progress bar fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${progressWidth}%`,
            backgroundColor: strength.color,
            boxShadow: `0 0 8px ${strength.color}40`,
          }}
        />
        {/* Segment dividers */}
        <div className="absolute inset-0 flex">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-full w-px bg-[var(--color-bg-secondary)]"
              style={{ marginLeft: `${i * 25}%`, transform: 'translateX(-50%)' }}
            />
          ))}
        </div>
      </div>

      {/* Strength label */}
      <div className="flex justify-end">
        <span
          className="text-xs font-medium transition-colors duration-300"
          style={{ color: strength.color }}
        >
          {strength.label}
        </span>
      </div>
    </div>
  )
}
