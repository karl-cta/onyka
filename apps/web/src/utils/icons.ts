import type { IconType } from 'react-icons'
import { ioniconsMap, getIonIconByName as getIonIcon } from '@/components/ui/Icon'
import { IoDocumentTextOutline } from 'react-icons/io5'

export function isEmoji(str: string): boolean {
  if (!str) return false
  return /\p{Emoji}/u.test(str) && !/^[a-zA-Z0-9]+$/.test(str)
}

export function getIconByName(name: string): IconType {
  return ioniconsMap[name] || IoDocumentTextOutline
}

export function getIonIconByName(name: string): IconType {
  return getIonIcon(name)
}

export { ioniconsMap }

export const NOTE_ICONS = [
  // Documents & Files
  'FileText', 'File', 'Files', 'Notebook', 'BookOpen', 'Book', 'Bookmark', 'BookMarked',
  'ScrollText', 'Newspaper', 'StickyNote', 'FileEdit', 'FilePlus', 'FileCheck',
  // Stars & Favorites
  'Star', 'Heart', 'Sparkles', 'Gem', 'Crown', 'Diamond',
  // Ideas & Creativity
  'Lightbulb', 'Zap', 'Flame', 'Rocket', 'Wand2', 'Brain', 'Puzzle',
  // Goals & Achievement
  'Target', 'Flag', 'Award', 'Trophy', 'Medal', 'BadgeCheck', 'CircleCheck',
  // Time & Calendar
  'Calendar', 'CalendarDays', 'Clock', 'AlarmClock', 'Timer', 'Hourglass', 'History',
  // Tasks & Lists
  'CheckSquare', 'ListTodo', 'List', 'ListChecks', 'ClipboardList', 'ClipboardCheck',
  // Layout & Organization
  'Columns', 'LayoutGrid', 'Grid3X3', 'Kanban', 'Layers', 'FolderOpen', 'Archive',
  // Tech & Code
  'Code', 'Terminal', 'Braces', 'Database', 'Server', 'Cpu', 'Binary', 'Bug',
  // Art & Design
  'Palette', 'Brush', 'PenTool', 'Pencil', 'Edit3', 'Highlighter', 'Eraser',
  // Media
  'Music', 'Headphones', 'Camera', 'Image', 'Film', 'Video', 'Mic', 'Play',
  // Location & Travel
  'MapPin', 'Globe', 'Compass', 'Navigation', 'Map', 'Plane', 'Car', 'Bike',
  // Places & Buildings
  'Home', 'Building', 'Building2', 'Store', 'Warehouse', 'Church', 'School',
  // Work & Business
  'Briefcase', 'GraduationCap', 'Users', 'User', 'UserCircle', 'Contact',
  // Food & Lifestyle
  'Coffee', 'UtensilsCrossed', 'ShoppingCart', 'Gift', 'Cake', 'Wine', 'Pizza',
  // Nature & Weather
  'Sun', 'Moon', 'Cloud', 'Umbrella', 'Leaf', 'Flower', 'TreePine', 'Mountain',
  // Health & Fitness
  'Activity', 'Dumbbell', 'HeartPulse', 'Pill', 'Stethoscope',
  // Communication
  'Mail', 'MessageSquare', 'Phone', 'Send', 'AtSign', 'Link',
  // Finance
  'Wallet', 'CreditCard', 'DollarSign', 'PiggyBank', 'Receipt', 'Calculator',
  // Misc
  'Key', 'Lock', 'Shield', 'Eye', 'Search', 'Settings', 'Tool', 'Wrench',
  'Package', 'Box', 'Truck', 'Bell', 'Pin', 'Paperclip', 'Scissors'
]

export const FOLDER_ICONS = [
  'Folder', 'FolderOpen', 'Archive', 'Briefcase', 'Book', 'Bookmark',
  'Star', 'Heart', 'Flag', 'Home', 'Code', 'Music', 'Image', 'Film',
  'Globe', 'Users', 'Settings', 'Lock', 'Shield', 'Lightbulb', 'Rocket',
  'Calendar', 'Clock', 'Mail', 'Package', 'Layers', 'Grid3X3'
]
