/**
 * Avatar utility functions and constants
 */

// Map of avatar color IDs to Tailwind ring classes
export const AVATAR_RING_COLORS: Record<string, string> = {
  blue: 'ring-blue-500',
  indigo: 'ring-indigo-500',
  violet: 'ring-violet-500',
  pink: 'ring-pink-500',
  red: 'ring-red-500',
  orange: 'ring-orange-500',
  amber: 'ring-amber-500',
  green: 'ring-green-500',
  teal: 'ring-teal-500',
  cyan: 'ring-cyan-500',
}

/**
 * Get the ring class for an avatar color
 * @param colorId - The color ID (e.g., 'blue', 'green')
 * @returns The Tailwind ring class
 */
export function getAvatarRingClass(colorId?: string): string {
  return AVATAR_RING_COLORS[colorId || 'blue'] || 'ring-blue-500'
}
