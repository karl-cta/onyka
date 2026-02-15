import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { IoCloseOutline, IoAddOutline, IoPricetagOutline } from 'react-icons/io5'
import type { Tag } from '@onyka/shared'
import { useTagsStore } from '@/stores/tags'

interface TagInputProps {
  selectedTags: Tag[]
  onAddTag: (tagId: string) => void
  onRemoveTag: (tagId: string) => void
  onCreateTag?: (name: string) => Promise<Tag>
}

export function TagInput({ selectedTags, onAddTag, onRemoveTag, onCreateTag }: TagInputProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { tags, fetchTags } = useTagsStore()

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const availableTags = tags.filter(
    (tag) =>
      !selectedTags.some((st) => st.id === tag.id) &&
      tag.name.toLowerCase().includes(query.toLowerCase()) &&
      tag.noteCount > 0
  )

  const exactMatch = tags.some(
    (tag) => tag.name.toLowerCase() === query.toLowerCase() && tag.noteCount > 0
  )

  // Reuse existing tag with no notes instead of creating a duplicate
  const orphanTag = tags.find(
    (tag) =>
      tag.name.toLowerCase() === query.toLowerCase() &&
      tag.noteCount === 0 &&
      !selectedTags.some((st) => st.id === tag.id)
  )

  const handleSelectTag = (tagId: string) => {
    onAddTag(tagId)
    setQuery('')
    setIsOpen(false)
  }

  const handleCreateTag = async () => {
    if (!query.trim()) return

    if (orphanTag) {
      onAddTag(orphanTag.id)
      setQuery('')
      setIsOpen(false)
      return
    }

    if (!onCreateTag) return
    setIsCreating(true)
    try {
      const newTag = await onCreateTag(query.trim())
      onAddTag(newTag.id)
      setQuery('')
      setIsOpen(false)
    } catch (err) {
      console.error('Failed to create tag:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (availableTags.length > 0) {
        handleSelectTag(availableTags[0].id)
      } else if (query.trim() && !exactMatch && onCreateTag) {
        handleCreateTag()
      }
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
    }
    if (e.key === 'Backspace' && !query && selectedTags.length > 0) {
      onRemoveTag(selectedTags[selectedTags.length - 1].id)
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-1.5 px-2 h-[32px] bg-transparent border-b border-transparent focus-within:border-[var(--color-border-subtle)] transition-colors cursor-text overflow-x-auto overflow-y-hidden scrollbar-none"
        onClick={() => inputRef.current?.focus()}
      >
        <IoPricetagOutline className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] flex-shrink-0" />
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="group flex-shrink-0 flex items-center gap-1 px-2 py-0.5 text-sm rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
          >
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemoveTag(tag.id)
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--color-accent)]/30 rounded transition-all"
            >
              <IoCloseOutline className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? t('tags.placeholder') : '+'}
          className="flex-1 min-w-[60px] bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none text-xs"
        />
      </div>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
          {availableTags.length > 0 ? (
            <div className="py-0.5">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleSelectTag(tag.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--color-accent)]/10 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  <span className="text-xs text-[var(--color-text-primary)]">{tag.name}</span>
                  <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
                    {(tag as Tag & { noteCount?: number }).noteCount ?? 0}
                  </span>
                </button>
              ))}
            </div>
          ) : query.trim() && !exactMatch && onCreateTag ? (
            <button
              onClick={handleCreateTag}
              disabled={isCreating}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--color-accent)]/10 transition-colors"
            >
              <IoAddOutline className="w-3 h-3 text-[var(--color-accent)]" />
              <span className="text-xs text-[var(--color-text-primary)]">
                {isCreating ? t('tags.creating') : t('tags.create', { name: query })}
              </span>
            </button>
          ) : (
            <div className="px-2.5 py-1.5 text-xs text-[var(--color-text-tertiary)]">
              {query ? t('tags.no_match') : t('tags.hint')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TagBadge({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/40">
      <IoPricetagOutline className="w-3 h-3" />
      {tag.name}
      {onRemove && (
        <button onClick={onRemove} className="p-0.5 hover:bg-[var(--color-accent)]/20 rounded transition-colors">
          <IoCloseOutline className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}
