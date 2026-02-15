/**
 * Dynamic font loader — loads only the font the user has selected.
 * Instead of importing all 48 font CSS files at boot (11 families × 4 weights = ~6 MB of font files),
 * we load on demand. This massively reduces initial load time on mobile.
 */

const loadedFonts = new Set<string>()

// Map font IDs to their @fontsource import functions
// Each entry loads all 4 weights (400, 500, 600, 700) for the font
const FONT_IMPORTS: Record<string, () => Promise<void>> = {
  'courier-prime': async () => {
    await Promise.all([
      import('@fontsource/courier-prime/400.css'),
      import('@fontsource/courier-prime/700.css'),
    ])
  },
  'crimson-pro': async () => {
    await Promise.all([
      import('@fontsource/crimson-pro/400.css'),
      import('@fontsource/crimson-pro/500.css'),
      import('@fontsource/crimson-pro/600.css'),
      import('@fontsource/crimson-pro/700.css'),
    ])
  },
  'eb-garamond': async () => {
    await Promise.all([
      import('@fontsource/eb-garamond/400.css'),
      import('@fontsource/eb-garamond/500.css'),
      import('@fontsource/eb-garamond/600.css'),
      import('@fontsource/eb-garamond/700.css'),
    ])
  },
  'fira-code': async () => {
    await Promise.all([
      import('@fontsource/fira-code/400.css'),
      import('@fontsource/fira-code/500.css'),
    ])
  },
  'ibm-plex-serif': async () => {
    await Promise.all([
      import('@fontsource/ibm-plex-serif/400.css'),
      import('@fontsource/ibm-plex-serif/500.css'),
      import('@fontsource/ibm-plex-serif/600.css'),
      import('@fontsource/ibm-plex-serif/700.css'),
    ])
  },
  'inter': async () => {
    await Promise.all([
      import('@fontsource/inter/400.css'),
      import('@fontsource/inter/500.css'),
      import('@fontsource/inter/600.css'),
      import('@fontsource/inter/700.css'),
    ])
  },
  'lexend': async () => {
    await Promise.all([
      import('@fontsource/lexend/400.css'),
      import('@fontsource/lexend/500.css'),
      import('@fontsource/lexend/600.css'),
      import('@fontsource/lexend/700.css'),
    ])
  },
  'montserrat': async () => {
    await Promise.all([
      import('@fontsource/montserrat/400.css'),
      import('@fontsource/montserrat/500.css'),
      import('@fontsource/montserrat/600.css'),
      import('@fontsource/montserrat/700.css'),
    ])
  },
  'nunito': async () => {
    await Promise.all([
      import('@fontsource/nunito/400.css'),
      import('@fontsource/nunito/500.css'),
      import('@fontsource/nunito/600.css'),
      import('@fontsource/nunito/700.css'),
    ])
  },
  'plus-jakarta-sans': async () => {
    await Promise.all([
      import('@fontsource/plus-jakarta-sans/400.css'),
      import('@fontsource/plus-jakarta-sans/500.css'),
      import('@fontsource/plus-jakarta-sans/600.css'),
      import('@fontsource/plus-jakarta-sans/700.css'),
    ])
  },
  'space-grotesk': async () => {
    await Promise.all([
      import('@fontsource/space-grotesk/400.css'),
      import('@fontsource/space-grotesk/500.css'),
      import('@fontsource/space-grotesk/600.css'),
      import('@fontsource/space-grotesk/700.css'),
    ])
  },
}

/**
 * Dynamically load a font by its ID.
 * Noop if the font is already loaded or doesn't need loading (e.g. 'georgia' is a system font).
 */
export async function loadFont(fontId: string): Promise<void> {
  // Georgia is a system font, no loading needed
  if (fontId === 'georgia') return

  // Already loaded
  if (loadedFonts.has(fontId)) return

  const loader = FONT_IMPORTS[fontId]
  if (!loader) return

  // Mark as loaded immediately to prevent duplicate requests
  loadedFonts.add(fontId)

  try {
    await loader()
  } catch {
    // If loading fails, allow retry
    loadedFonts.delete(fontId)
  }
}

/**
 * Preload all available fonts (for the font picker).
 * Called lazily when the user opens the font selector.
 */
export function preloadAllFonts(): void {
  for (const fontId of Object.keys(FONT_IMPORTS)) {
    loadFont(fontId)
  }
}
