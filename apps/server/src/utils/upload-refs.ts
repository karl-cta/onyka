const UPLOAD_URL_RE = /\/api\/uploads\/([A-Za-z0-9_-]+\.[A-Za-z0-9]+)/g

export function extractUploadFilenames(html: string | null | undefined): string[] {
  if (!html) return []
  const out = new Set<string>()
  for (const match of html.matchAll(UPLOAD_URL_RE)) {
    out.add(match[1])
  }
  return [...out]
}
