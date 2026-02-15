import { forwardRef, memo, type InputHTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightElement?: ReactNode
}

export const Input = memo(forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightElement, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium mb-1.5 text-[var(--color-text-primary)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={clsx(
              'w-full h-9 text-sm rounded-lg text-[var(--color-text-primary)]',
              'placeholder:text-[var(--color-text-tertiary)]',
              'border transition-all duration-200 ease-out',
              'bg-[var(--color-bg-tertiary)]',
              // Focus states
              'focus:outline-none focus:bg-[var(--color-bg-secondary)]',
              'focus:border-[var(--color-accent)]',
              // Hover state (when not focused)
              'hover:border-[var(--color-border-strong)]',
              // Error state
              error
                ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
                : 'border-[var(--color-border)]',
              // Padding based on icons
              leftIcon ? 'pl-10 pr-3' : 'px-3',
              rightElement ? 'pr-10' : '',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 transition-opacity duration-200">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-[var(--color-error)] flex items-center gap-1.5 animate-in">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">{hint}</p>
        )}
      </div>
    )
  }
))

Input.displayName = 'Input'
