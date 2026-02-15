export const COLORS = [
  { name: 'Default', value: null },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
] as const

export const HIGHLIGHT_COLORS = [
  { name: 'None', value: null },
  { name: 'Yellow', value: '#fde047' },
  { name: 'Green', value: '#86efac' },
  { name: 'Blue', value: '#93c5fd' },
  { name: 'Purple', value: '#c4b5fd' },
  { name: 'Pink', value: '#f9a8d4' },
  { name: 'Orange', value: '#fdba74' },
] as const

export interface SlashMenuItem {
  id: string
  labelKey: string
  descKey: string
  icon: React.ComponentType<{ className?: string }>
  command: string
  args?: Record<string, unknown>
}

import {
  IoListOutline,
  IoCheckboxOutline,
  IoCodeOutline,
  IoChatbubbleOutline,
  IoRemoveOutline,
  IoImageOutline,
  IoGridOutline,
} from 'react-icons/io5'

const TextIcon = () => <span className="text-sm font-medium">¶</span>
const H1Icon = () => <span className="text-sm font-bold">H1</span>
const H2Icon = () => <span className="text-sm font-bold">H2</span>
const H3Icon = () => <span className="text-sm font-bold">H3</span>
const OLIcon = () => <span className="text-sm font-medium">1.</span>

export const ColumnsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="2" width="6" height="12" rx="1" />
    <rect x="9" y="2" width="6" height="12" rx="1" />
  </svg>
)

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  { id: 'paragraph', labelKey: 'editor.text', descKey: 'editor.slash_menu.text_desc', icon: TextIcon, command: 'setParagraph' },
  { id: 'h1', labelKey: 'editor.heading1', descKey: 'editor.slash_menu.heading1_desc', icon: H1Icon, command: 'setHeading', args: { level: 1 } },
  { id: 'h2', labelKey: 'editor.heading2', descKey: 'editor.slash_menu.heading2_desc', icon: H2Icon, command: 'setHeading', args: { level: 2 } },
  { id: 'h3', labelKey: 'editor.heading3', descKey: 'editor.slash_menu.heading3_desc', icon: H3Icon, command: 'setHeading', args: { level: 3 } },
  { id: 'bulletList', labelKey: 'editor.bullet_list', descKey: 'editor.slash_menu.bullet_list_desc', icon: IoListOutline, command: 'toggleBulletList' },
  { id: 'orderedList', labelKey: 'editor.numbered_list', descKey: 'editor.slash_menu.numbered_list_desc', icon: OLIcon, command: 'toggleOrderedList' },
  { id: 'taskList', labelKey: 'editor.todo_list', descKey: 'editor.slash_menu.todo_list_desc', icon: IoCheckboxOutline, command: 'toggleTaskList' },
  { id: 'blockquote', labelKey: 'editor.quote', descKey: 'editor.slash_menu.quote_desc', icon: IoChatbubbleOutline, command: 'toggleBlockquote' },
  { id: 'codeBlock', labelKey: 'editor.code_block', descKey: 'editor.slash_menu.code_block_desc', icon: IoCodeOutline, command: 'toggleCodeBlock' },
  { id: 'horizontalRule', labelKey: 'editor.divider', descKey: 'editor.slash_menu.divider_desc', icon: IoRemoveOutline, command: 'setHorizontalRule' },
  { id: 'image', labelKey: 'editor.image', descKey: 'editor.slash_menu.image_desc', icon: IoImageOutline, command: 'insertImage' },
  { id: 'table', labelKey: 'editor.table', descKey: 'editor.slash_menu.table_desc', icon: IoGridOutline, command: 'insertTable' },
  { id: 'columns', labelKey: 'editor.columns', descKey: 'editor.slash_menu.columns_desc', icon: ColumnsIcon, command: 'setColumns' },
]

export const AlignLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="1" y1="3" x2="15" y2="3" />
    <line x1="1" y1="8" x2="10" y2="8" />
    <line x1="1" y1="13" x2="15" y2="13" />
  </svg>
)
export const AlignCenterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="1" y1="3" x2="15" y2="3" />
    <line x1="3.5" y1="8" x2="12.5" y2="8" />
    <line x1="1" y1="13" x2="15" y2="13" />
  </svg>
)
export const AlignRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="1" y1="3" x2="15" y2="3" />
    <line x1="6" y1="8" x2="15" y2="8" />
    <line x1="1" y1="13" x2="15" y2="13" />
  </svg>
)

export const Layout11Icon = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="1" y="1" width="8" height="12" rx="1" />
    <rect x="11" y="1" width="8" height="12" rx="1" />
  </svg>
)
export const Layout12Icon = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="1" y="1" width="5.5" height="12" rx="1" />
    <rect x="8.5" y="1" width="10.5" height="12" rx="1" />
  </svg>
)
export const Layout21Icon = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="1" y="1" width="10.5" height="12" rx="1" />
    <rect x="13.5" y="1" width="5.5" height="12" rx="1" />
  </svg>
)
