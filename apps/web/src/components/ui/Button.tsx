import { forwardRef, memo, type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  isLoading?: boolean
}

export const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = clsx(
      'group relative inline-flex items-center justify-center font-medium rounded-lg',
      'transition-all duration-200 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-[var(--color-bg-primary)]',
      'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
      'active:scale-[0.98]'
    )

    const variants = {
      primary: clsx(
        'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]',
        'text-white',
        'shadow-sm hover:shadow-md'
      ),
      secondary: clsx(
        'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]',
        'border border-[var(--color-border)]',
        'hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]'
      ),
      ghost: clsx(
        'bg-transparent text-[var(--color-text-secondary)]',
        'hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
      ),
      danger: clsx(
        'bg-[var(--color-error)] hover:bg-red-600',
        'text-white',
        'shadow-sm hover:shadow-md'
      ),
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm gap-1.5',
      md: 'h-9 px-4 text-sm gap-2',
      lg: 'h-10 px-5 text-sm gap-2',
      icon: 'h-9 w-9',
    }

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : null}
        <span className="relative z-10 flex items-center gap-inherit">{children}</span>
      </button>
    )
  }
))

Button.displayName = 'Button'
