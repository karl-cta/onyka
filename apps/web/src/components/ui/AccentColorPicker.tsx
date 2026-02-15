import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IoCheckmarkOutline, IoColorPaletteOutline } from 'react-icons/io5'
import { useThemeStore, ACCENT_COLORS } from '@/stores/theme'

interface AccentColorPickerProps {
  collapsed?: boolean
}

export function AccentColorPicker({ collapsed = false }: AccentColorPickerProps) {
  const { accentColor, setAccentColor, theme } = useThemeStore()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const clickedInContainer = containerRef.current?.contains(target)
      const clickedInPortal = portalRef.current?.contains(target)
      if (!clickedInContainer && !clickedInPortal) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Calculate popover position for both modes
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const popoverHeight = 280 // Approximate height of the popover
      const popoverWidth = 232

      let top: number
      let left: number

      if (collapsed) {
        // Collapsed mode: open to the right, centered vertically
        top = rect.top + rect.height / 2 - popoverHeight / 2
        left = rect.right + 8

        // If it would go off right edge, position to the left of button
        if (left + popoverWidth > window.innerWidth - 16) {
          left = rect.left - popoverWidth - 8
        }
      } else {
        // Expanded mode: open upward from button
        top = rect.top - popoverHeight - 8
        left = rect.left

        // If it would go off the left edge, align to left edge of viewport
        if (left < 16) left = 16

        // If it would go off the right edge, adjust
        if (left + popoverWidth > window.innerWidth - 16) {
          left = window.innerWidth - popoverWidth - 16
        }

        // If it would go above viewport, position below button instead
        if (top < 16) {
          top = rect.bottom + 8
        }
      }

      // Ensure it doesn't go above viewport
      if (top < 16) top = 16

      // Ensure it doesn't go below viewport
      if (top + popoverHeight > window.innerHeight - 16) {
        top = window.innerHeight - popoverHeight - 16
      }

      setPopoverPosition({ top, left })
    }
  }, [isOpen, collapsed])

  const currentColor = ACCENT_COLORS.find((c) => c.id === accentColor)
  const currentHex = currentColor ? (theme === 'dark' ? currentColor.dark : currentColor.light) : '#D97706'

  // 3 rows of 5 colors
  const colorRows = [
    ACCENT_COLORS.slice(0, 5),
    ACCENT_COLORS.slice(5, 10),
    ACCENT_COLORS.slice(10, 15),
  ]

  const popoverContent = (
    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-2xl shadow-xl p-5 w-[232px]">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-[var(--color-border-subtle)]">
        <div
          className="w-3.5 h-3.5 rounded-full shadow-inner"
          style={{ background: currentHex }}
        />
        <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
          Couleur du thème
        </span>
      </div>

      {/* Color Grid - 3 rows x 5 columns */}
      <div className="space-y-3">
        {colorRows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-3">
            {row.map((color) => {
              const isSelected = accentColor === color.id
              const colorHex = theme === 'dark' ? color.dark : color.light
              return (
                <button
                  key={color.id}
                  onClick={() => setAccentColor(color.id)}
                  className={`group relative w-8 h-8 rounded-lg transition-all duration-200 ${
                    isSelected
                      ? 'ring-[1.5px] ring-[var(--color-text-primary)] ring-offset-[3px] ring-offset-[var(--color-bg-elevated)] shadow-md'
                      : 'hover:scale-110 hover:shadow-md hover:z-10'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${colorHex} 0%, ${adjustColor(colorHex, -20)} 100%)`
                  }}
                  title={color.name}
                >
                  {/* Shine effect */}
                  <div className="absolute inset-0 rounded-lg overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <IoCheckmarkOutline className="w-3.5 h-3.5 text-white drop-shadow-md" />
                    </div>
                  )}

                  {/* Hover tooltip */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[10px] font-medium text-[var(--color-text-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    {color.name}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[var(--color-bg-primary)] border-r border-b border-[var(--color-border)] rotate-45" />
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Current selection footer */}
      <div className="mt-5 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
        <span className="text-[9px] text-[var(--color-text-tertiary)] uppercase tracking-wider font-medium">
          Actif
        </span>
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-full shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${currentHex} 0%, ${adjustColor(currentHex, -20)} 100%)`
            }}
          />
          <span className="text-[11px] font-medium text-[var(--color-text-primary)]">
            {currentColor?.name}
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <div className={`relative ${collapsed ? 'group/accent' : ''}`} ref={containerRef}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          group relative flex items-center justify-center
          text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
          transition-all duration-200 ease-out
          ${collapsed
            ? 'p-2'
            : 'w-8 h-8 rounded-xl bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)]'
          }
        `}
        aria-label="Choose accent color"
        title={collapsed ? undefined : 'Couleur du thème'}
      >
        <IoColorPaletteOutline className={`${collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'} transition-transform duration-300 group-hover:rotate-12`} />
      </button>
      {collapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover/accent:opacity-100 group-hover/accent:scale-100 transition-all duration-200 delay-150">
          Couleur du thème
        </div>
      )}

      {/* Popover - always uses portal to avoid z-index issues */}
      {isOpen && createPortal(
        <div
          ref={portalRef}
          className={`fixed z-[9999] ${collapsed ? 'animate-scale-in' : 'animate-slide-up'}`}
          style={{ top: popoverPosition.top, left: popoverPosition.left }}
        >
          {popoverContent}
        </div>,
        document.body
      )}
    </div>
  )
}

// Helper function to darken/lighten a hex color
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
