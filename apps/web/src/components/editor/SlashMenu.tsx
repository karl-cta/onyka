import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { SlashMenuItem } from './editorConstants'

interface SlashMenuProps {
  items: SlashMenuItem[]
  selectedIndex: number
  position: { top: number; left: number }
  filter: string
  onSelect: (item: SlashMenuItem) => void
  menuRef: React.RefObject<HTMLDivElement | null>
}

export function SlashMenu({ items, selectedIndex, position, filter, onSelect, menuRef }: SlashMenuProps) {
  const { t } = useTranslation()
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  useEffect(() => {
    if (items[selectedIndex]) {
      const el = itemRefs.current.get(items[selectedIndex].id)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex, items])

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden animate-scale-in"
      style={{ top: position.top, left: Math.min(position.left, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 304) }}
    >
      <div className="px-3 py-2 border-b border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-medium">
          {filter ? `${t('editor.slash_menu.searching')}: ${filter}` : t('editor.slash_menu.insert_block')}
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {items.length > 0 ? (
          items.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.id, el)
                  else itemRefs.current.delete(item.id)
                }}
                onClick={() => onSelect(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  index === selectedIndex
                    ? 'bg-[var(--color-accent)]/20'
                    : 'bg-[var(--color-bg-tertiary)]'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t(item.labelKey)}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{t(item.descKey)}</p>
                </div>
              </button>
            )
          })
        ) : (
          <p className="px-3 py-4 text-sm text-[var(--color-text-tertiary)] text-center">
            {t('editor.slash_menu.no_results')}
          </p>
        )}
      </div>
    </div>
  )
}
