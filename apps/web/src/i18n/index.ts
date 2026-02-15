import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr.json'
import en from './locales/en.json'
import type { Language } from '@onyka/shared'

// Get saved language from localStorage or default to English
const savedLanguage = localStorage.getItem('onyka-language') || 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en }
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes
    },
    react: {
      useSuspense: false
    }
  })

// Function to change language and persist locally
export function setLanguage(lang: Language) {
  i18n.changeLanguage(lang)
  localStorage.setItem('onyka-language', lang)
}

// Function to change language and persist to server (for authenticated users)
// Always applies the change locally first, then persists to server as best-effort.
// This ensures the switcher works even on unauthenticated pages (login).
export async function setLanguageWithServer(lang: Language): Promise<boolean> {
  setLanguage(lang)
  try {
    const response = await fetch('/api/auth/language', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang }),
      credentials: 'include',
    })
    return response.ok
  } catch {
    return false
  }
}

// Function to load language from server (for authenticated users)
export async function loadLanguageFromServer(): Promise<Language | null> {
  try {
    const response = await fetch('/api/auth/language', {
      credentials: 'include',
    })
    if (response.ok) {
      const data = await response.json()
      if (data.language) {
        setLanguage(data.language)
        return data.language
      }
    }
    return null
  } catch {
    return null
  }
}

export function getCurrentLanguage(): Language {
  return (i18n.language || 'en') as Language
}

export default i18n
