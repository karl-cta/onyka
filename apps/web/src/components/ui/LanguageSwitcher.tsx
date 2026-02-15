import { useTranslation } from 'react-i18next'
import { setLanguageWithServer, getCurrentLanguage } from '@/i18n'
import type { Language } from '@onyka/shared'

interface LanguageSwitcherProps {
  collapsed?: boolean
}

export function LanguageSwitcher({ collapsed = false }: LanguageSwitcherProps) {
  useTranslation()
  const currentLang = getCurrentLanguage()

  const toggleLanguage = () => {
    const newLang: Language = currentLang === 'fr' ? 'en' : 'fr'
    setLanguageWithServer(newLang)
  }

  const label = currentLang === 'fr' ? 'English' : 'Français'

  return (
    <button
      onClick={toggleLanguage}
      className={`
        group relative flex items-center justify-center
        transition-all duration-200 ease-out
        ${collapsed
          ? 'p-2'
          : 'w-8 h-8 rounded-xl bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)]'
        }
      `}
      aria-label={label}
      title={label}
    >
      <div className={`relative ${collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'} flex items-center justify-center`}>
        {/* French flag with rotation transition */}
        <span
          className={`
            absolute inset-0 flex items-center justify-center leading-none
            transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
            ${collapsed ? 'text-[17px]' : 'text-[15px]'}
            ${currentLang === 'fr'
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 -rotate-180 scale-50'
            }
          `}
          aria-hidden={currentLang !== 'fr'}
        >🇫🇷</span>
        {/* English flag with rotation transition */}
        <span
          className={`
            absolute inset-0 flex items-center justify-center leading-none
            transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
            ${collapsed ? 'text-[17px]' : 'text-[15px]'}
            ${currentLang === 'en'
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 rotate-180 scale-50'
            }
          `}
          aria-hidden={currentLang !== 'en'}
        >🇬🇧</span>
      </div>
    </button>
  )
}
