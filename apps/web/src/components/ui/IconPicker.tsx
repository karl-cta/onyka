import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { getIconByName, NOTE_ICONS } from '@/utils/icons'

const EMOJI_CATEGORIES = {
  recent: [] as string[],
  smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😎', '🤓', '🧐', '🤔', '😴'],
  gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👋', '🖐️', '✋', '👏', '🙌', '🤝', '💪', '✍️', '🙏'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💖', '💗', '💘', '💝'],
  objects: ['📝', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '📎', '📌', '📍', '✏️', '✒️', '🖊️', '🖋️', '📁', '📂', '🗂️', '📅', '📆', '🗓️', '📇', '🗃️', '🗄️', '📋', '📈', '📉', '📊'],
  tech: ['💻', '🖥️', '⌨️', '🖱️', '💾', '💿', '📱', '📲', '☎️', '📞', '📟', '📠', '🔋', '🔌', '💡', '🔦', '🔧', '🔨', '⚙️', '🔩', '🛠️'],
  nature: ['🌸', '🌺', '🌻', '🌼', '🌷', '🌹', '🌵', '🌲', '🌳', '🌴', '🍀', '🍁', '🍂', '🍃', '🌿', '☘️', '🌱', '🌾', '🌊', '🔥', '⭐', '🌟', '✨', '💫', '☀️', '🌙', '⚡', '❄️', '🌈'],
  food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥝', '🥑', '🍕', '🍔', '🍟', '🌮', '🍣', '🍜', '🍩', '🍪', '🎂', '🍰', '☕', '🍵', '🥤', '🍷', '🍺'],
  activities: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🏓', '🎯', '🎮', '🎲', '🎭', '🎨', '🎬', '🎤', '🎧', '🎵', '🎶', '🎹', '🎸', '🎺', '🎻', '🥁'],
  travel: ['🚗', '🚕', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '✈️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚢', '🏠', '🏡', '🏢', '🏣', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '⛪', '🕌', '🗽', '🗼', '🏰'],
  symbols: ['✅', '❌', '❓', '❗', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '▶️', '⏸️', '⏹️', '⏺️', '⏭️', '⏮️', '🔀', '🔁', '🔂', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱'],
  flags: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🇫🇷', '🇺🇸', '🇬🇧', '🇩🇪', '🇪🇸', '🇮🇹', '🇯🇵', '🇰🇷', '🇨🇳', '🇧🇷', '🇨🇦', '🇦🇺'],
}

const EMOJI_CATEGORY_LABELS: Record<string, string> = {
  recent: '🕐 Récents',
  smileys: '😀 Smileys',
  gestures: '👋 Gestes',
  hearts: '❤️ Coeurs',
  objects: '📝 Objets',
  tech: '💻 Tech',
  nature: '🌿 Nature',
  food: '🍕 Food',
  activities: '🎮 Activités',
  travel: '✈️ Voyage',
  symbols: '✅ Symboles',
  flags: '🏳️ Drapeaux',
}

const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat()

const RECENT_EMOJIS_KEY = 'onyka-recent-emojis'
const MAX_RECENT_EMOJIS = 20

function getRecentEmojis(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_EMOJIS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addRecentEmoji(emoji: string) {
  const recent = getRecentEmojis().filter(e => e !== emoji)
  recent.unshift(emoji)
  localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_EMOJIS)))
}

interface IconPickerProps {
  selectedIcon: string
  onSelectIcon: (icon: string) => void
  onClose: () => void
  triggerRef?: React.RefObject<HTMLElement | null>
}

type TabType = 'icons' | 'emojis'

export function IconPicker({ selectedIcon, onSelectIcon, onClose, triggerRef }: IconPickerProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('icons')
  const [emojiCategory, setEmojiCategory] = useState<string>('recent')
  const [recentEmojis, setRecentEmojis] = useState<string[]>(getRecentEmojis())

  const isEmojiCheck = (str: string) => /\p{Emoji}/u.test(str) && !/^[a-zA-Z]+$/.test(str)

  useEffect(() => {
    if (isEmojiCheck(selectedIcon)) {
      setActiveTab('emojis')
    }
  }, [selectedIcon])

  const getPosition = () => {
    if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const pickerWidth = 320
      const pickerHeight = 400

      let left = rect.right + 8
      let top = rect.top

      if (left + pickerWidth > window.innerWidth - 16) {
        left = rect.left - pickerWidth - 8
      }

      if (top + pickerHeight > window.innerHeight - 16) {
        top = window.innerHeight - pickerHeight - 16
      }

      if (top < 16) top = 16
      if (left < 16) left = 16

      return { top, left }
    }
    return {
      top: window.innerHeight / 2 - 200,
      left: window.innerWidth / 2 - 160
    }
  }

  const position = getPosition()

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleSelectEmoji = (emoji: string) => {
    addRecentEmoji(emoji)
    setRecentEmojis(getRecentEmojis())
    onSelectIcon(emoji)
    onClose()
  }

  const filteredIcons = NOTE_ICONS.filter(name =>
    name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredEmojis = search
    ? ALL_EMOJIS.filter(emoji => emoji.includes(search))
    : emojiCategory === 'recent'
      ? recentEmojis
      : EMOJI_CATEGORIES[emojiCategory as keyof typeof EMOJI_CATEGORIES] || []

  const content = (
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
      />

      <div
        ref={containerRef}
        className="fixed z-[9999] border rounded-xl w-[320px] animate-scale-in overflow-hidden floating-panel"
        style={{ top: position.top, left: position.left }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex border-b border-[var(--color-border)]">
          <button
            onClick={() => setActiveTab('icons')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'icons'
                ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Icônes
          </button>
          <button
            onClick={() => setActiveTab('emojis')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'emojis'
                ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Emojis
          </button>
        </div>

        <div className="p-3">
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeTab === 'icons' ? t('notes.search_icons') : 'Rechercher un emoji...'}
              className="w-full px-3 py-2 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)]"
              autoFocus
            />
          </div>

          {activeTab === 'icons' && (
            <div className="grid grid-cols-8 gap-1 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredIcons.map((iconName) => {
                const Icon = getIconByName(iconName)
                const isSelected = selectedIcon === iconName
                return (
                  <button
                    key={iconName}
                    onClick={() => {
                      onSelectIcon(iconName)
                      onClose()
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                    }`}
                    title={iconName}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}
              {filteredIcons.length === 0 && (
                <p className="col-span-8 text-sm text-[var(--color-text-tertiary)] text-center py-4">
                  {t('editor.no_blocks_found')}
                </p>
              )}
            </div>
          )}

          {activeTab === 'emojis' && (
            <>
              {!search && (
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-none">
                  {Object.keys(EMOJI_CATEGORIES).map((cat) => {
                    // Skip recent if empty
                    if (cat === 'recent' && recentEmojis.length === 0) return null
                    const isActive = emojiCategory === cat
                    return (
                      <button
                        key={cat}
                        onClick={() => setEmojiCategory(cat)}
                        className={`px-2 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                          isActive
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                        }`}
                      >
                        {EMOJI_CATEGORY_LABELS[cat]?.split(' ')[0] || cat}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="grid grid-cols-8 gap-1 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredEmojis.map((emoji, idx) => {
                  const isSelected = selectedIcon === emoji
                  return (
                    <button
                      key={`${emoji}-${idx}`}
                      onClick={() => handleSelectEmoji(emoji)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-accent)] scale-110'
                          : 'hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                    >
                      {emoji}
                    </button>
                  )
                })}
                {filteredEmojis.length === 0 && (
                  <p className="col-span-8 text-sm text-[var(--color-text-tertiary)] text-center py-4">
                    {search ? 'Aucun emoji trouvé' : 'Aucun emoji récent'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )

  return createPortal(content, document.body)
}
