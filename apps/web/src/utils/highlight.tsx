import { Fragment, type ReactNode } from 'react'

const MARK_RE = /<\/?mark>/gi

export function renderSearchPreview(preview: string): ReactNode {
  const segments = preview.split(MARK_RE)
  if (segments.length === 1) return preview

  return (
    <>
      {segments.map((segment, i) => {
        if (!segment) return null
        return i % 2 === 1 ? (
          <mark key={i}>{segment}</mark>
        ) : (
          <Fragment key={i}>{segment}</Fragment>
        )
      })}
    </>
  )
}
