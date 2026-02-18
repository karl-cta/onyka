import { useEffect, useRef, useState } from 'react'
import { IoSearchOutline, IoCloseOutline, IoDocumentTextOutline } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { useNotesStore } from '@/stores/notes'

interface SearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelectNote: (noteId: string) => void
}

export function SearchDialog({ isOpen, onClose, onSelectNote }: SearchDialogProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const { searchResults, isSearching, search, clearSearch } = useNotesStore()

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    } else {
      setQuery('')
      clearSearch()
    }
  }, [isOpen, clearSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (isOpen) {
          onClose()
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSelect = (noteId: string) => {
    onSelectNote(noteId)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-4 md:pt-[15vh] px-3 md:px-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl border border-[var(--color-border)] overflow-hidden mt-14 md:mt-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <IoSearchOutline className="w-5 h-5 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <label id="search-dialog-title" className="sr-only">
            {t('search.placeholder')}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            aria-describedby="search-results-status"
            className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded"
              aria-label={t('common.clear')}
            >
              <IoCloseOutline className="w-4 h-4 text-[var(--color-text-secondary)]" />
            </button>
          )}
          <kbd className="text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] px-2 py-1 rounded" aria-hidden="true">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto" role="listbox" aria-label={t('search.results')}>
          <div id="search-results-status" className="sr-only" aria-live="polite">
            {isSearching
              ? t('search.searching')
              : searchResults.length > 0
              ? t('search.results_count', { count: searchResults.length })
              : query
              ? t('search.no_results')
              : ''}
          </div>
          {isSearching ? (
            <div className="p-8 text-center text-[var(--color-text-secondary)]" aria-hidden="true">
              <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="py-2">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result.id)}
                  role="option"
                  aria-selected="false"
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <IoDocumentTextOutline className="w-5 h-5 text-[var(--color-text-secondary)] mt-0.5" aria-hidden="true" />
                  <div className="flex-1 text-left">
                    <div className="text-[var(--color-text-primary)] font-medium">
                      {result.title || t('editor.untitled')}
                    </div>
                    <div
                      className="text-sm text-[var(--color-text-secondary)] line-clamp-2 [&_mark]:bg-amber-300/50 dark:[&_mark]:bg-amber-500/30 [&_mark]:text-inherit dark:[&_mark]:text-amber-200 [&_mark]:font-medium [&_mark]:rounded-sm [&_mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: result.preview.replace(/<(?!\/?mark>)[^>]+>/g, '') }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="p-8 text-center text-[var(--color-text-secondary)]">
              {t('search.no_results')}
            </div>
          ) : (
            <div className="p-8 text-center text-[var(--color-text-secondary)]">
              {t('search.type_to_search')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
