interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
  title?: string
}

export function ToolbarButton({ onClick, active, children, title }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-all duration-150 ${
        active
          ? 'bg-[var(--color-accent)] text-white'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
      }`}
    >
      {children}
    </button>
  )
}

export function ToolbarDivider() {
  return <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
}
