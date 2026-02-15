import { IoMoonOutline, IoSunnyOutline } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'

interface ThemeToggleProps {
  collapsed?: boolean
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useThemeStore()

  const label = theme === 'dark' ? t('settings.theme_light') : t('settings.theme_dark')

  return (
    <div className={collapsed ? 'relative group/theme' : ''}>
      <button
        onClick={toggleTheme}
        className={`
          group relative flex items-center justify-center
          text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
          transition-all duration-200 ease-out
          ${collapsed
            ? 'p-2'
            : 'w-8 h-8 rounded-xl bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)]'
          }
        `}
        aria-label={label}
        title={collapsed ? undefined : label}
      >
        <div className={`relative ${collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'}`}>
          {/* Sun icon with rotation animation */}
          <IoSunnyOutline
            className={`
              absolute inset-0 w-full h-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
              ${theme === 'dark'
                ? 'opacity-100 rotate-0 scale-100'
                : 'opacity-0 -rotate-180 scale-50'
              }
            `}
          />
          {/* Moon icon with rotation animation */}
          <IoMoonOutline
            className={`
              absolute inset-0 w-full h-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
              ${theme === 'light'
                ? 'opacity-100 rotate-0 scale-100'
                : 'opacity-0 rotate-180 scale-50'
              }
            `}
          />
        </div>
      </button>
      {collapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover/theme:opacity-100 group-hover/theme:scale-100 transition-all duration-200 delay-150">
          {label}
        </div>
      )}
    </div>
  )
}
