import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/** Strip HTML tags and return plain text */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

/** Count words from HTML content */
export function countWords(html: string): number {
  const text = stripHtml(html)
  return text ? text.split(/\s+/).length : 0
}

interface WordCounterProps {
  content: string
}

export function WordCounter({ content }: WordCounterProps) {
  const { t } = useTranslation()

  const { words, characters } = useMemo(() => {
    const text = stripHtml(content)
    const words = text ? text.split(/\s+/).length : 0
    const characters = text.length
    return { words, characters }
  }, [content])

  return (
    <div className="flex items-center gap-4 text-xs text-[var(--color-text-tertiary)]">
      <span>{t('editor.words', { count: words })}</span>
      <span>{t('editor.characters', { count: characters })}</span>
    </div>
  )
}
