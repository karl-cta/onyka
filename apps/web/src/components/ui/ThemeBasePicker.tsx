import { IoCheckmarkOutline } from 'react-icons/io5'
import { useThemeStore, THEME_BASES } from '@/stores/theme'

export function ThemeBasePicker() {
  const { theme, getCurrentThemeBase, setThemeBase } = useThemeStore()
  const currentThemeBase = getCurrentThemeBase()

  // Filter themes by current mode
  const availableThemes = THEME_BASES.filter((t) => t.mode === theme)

  return (
    <div className="grid grid-cols-5 gap-2">
      {availableThemes.map((themeOption) => {
        const isSelected = currentThemeBase === themeOption.id
        return (
          <button
            key={themeOption.id}
            onClick={() => setThemeBase(themeOption.id)}
            className={`
              group relative flex flex-col rounded-lg overflow-hidden
              transition-all duration-150 ease-out
              ${isSelected
                ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg-primary)]'
                : 'hover:ring-1 hover:ring-[var(--color-border)]'
              }
            `}
          >
            {/* Preview */}
            <div
              className="relative aspect-[4/3] w-full"
              style={{ backgroundColor: themeOption.preview.bg }}
            >
              {/* Mini UI mockup */}
              <div
                className="absolute left-1 top-1 bottom-1 w-2.5 rounded-sm opacity-25"
                style={{ backgroundColor: themeOption.preview.text }}
              />
              <div className="absolute left-5 top-2 right-2 space-y-1">
                <div
                  className="h-1 w-3/4 rounded-full opacity-80"
                  style={{ backgroundColor: themeOption.preview.text }}
                />
                <div
                  className="h-0.5 w-full rounded-full opacity-30"
                  style={{ backgroundColor: themeOption.preview.text }}
                />
                <div
                  className="h-0.5 w-2/3 rounded-full opacity-20"
                  style={{ backgroundColor: themeOption.preview.text }}
                />
              </div>
              {/* Accent dot */}
              <div
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: themeOption.preview.accent }}
              />

              {/* Selected check */}
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: themeOption.preview.accent }}
                  >
                    <IoCheckmarkOutline className="h-3 w-3 text-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Name */}
            <div
              className="py-1.5 text-[11px] font-medium text-center"
              style={{
                backgroundColor: themeOption.preview.bg,
                color: themeOption.preview.text,
                opacity: isSelected ? 1 : 0.7
              }}
            >
              {themeOption.name}
            </div>
          </button>
        )
      })}
    </div>
  )
}
