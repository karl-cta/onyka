import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import TurndownService from 'turndown'
import archiver from 'archiver'
import { PassThrough } from 'stream'
import { basename } from 'path'
import { noteRepository } from '../repositories/note.repository.js'
import { folderRepository } from '../repositories/folder.repository.js'
import { pageRepository } from '../repositories/page.repository.js'
import { shareRepository } from '../repositories/share.repository.js'
import type { NoteWithTags, NotePage, FolderWithChildren } from '@onyka/shared'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})

export type ExportFormat = 'md' | 'txt' | 'html'

const MAX_EXPORT_NOTES = 500
const MAX_EXPORT_DEPTH = 10

export class ExportServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'ExportServiceError'
  }
}

interface ExportedFile {
  filename: string
  content: string
  mimeType: string
}

export class ExportService {
  async exportNote(noteId: string, userId: string, format: ExportFormat): Promise<ExportedFile> {
    const note = await noteRepository.findByIdWithTags(noteId)

    if (!note) {
      throw new ExportServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    if (note.ownerId !== userId) {
      const hasAccess = await shareRepository.hasAccess(userId, noteId, 'note', 'read')
      if (!hasAccess) {
        throw new ExportServiceError('Access denied', 'ACCESS_DENIED', 403)
      }
    }

    // Fetch pages — the real content lives there, not in note.content
    const pages = await pageRepository.findByNoteId(noteId)

    const content = this.convertNoteToFormat(note, pages, format)
    const filename = this.sanitizeFilename(note.title || 'untitled') + this.getExtension(format)
    const mimeType = this.getMimeType(format)

    return { filename, content, mimeType }
  }

  async exportFolder(folderId: string, userId: string, format: ExportFormat): Promise<{ stream: PassThrough; filename: string }> {
    const folder = await folderRepository.findById(folderId)
    if (!folder) {
      throw new ExportServiceError('Folder not found', 'FOLDER_NOT_FOUND', 404)
    }
    if (folder.ownerId !== userId) {
      throw new ExportServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    // Get the full folder tree starting from this folder
    const tree = await folderRepository.findTreeByOwner(userId)
    const targetFolder = this.findFolderInTree(tree, folderId)
    if (!targetFolder) {
      throw new ExportServiceError('Folder not found in tree', 'FOLDER_NOT_FOUND', 404)
    }

    const stream = new PassThrough()
    const archive = archiver('zip', { zlib: { level: 9 } })

    archive.on('error', (err) => {
      stream.destroy(err)
    })
    archive.pipe(stream)

    // Recursively add notes from the folder tree
    const counter = { count: 0 }
    await this.addFolderToArchive(archive, targetFolder, '', format, 0, counter)

    await archive.finalize()

    const filename = this.sanitizeFilename(folder.name || 'folder') + '.zip'
    return { stream, filename }
  }

  private findFolderInTree(folders: FolderWithChildren[], targetId: string): FolderWithChildren | null {
    for (const folder of folders) {
      if (folder.id === targetId) return folder
      const found = this.findFolderInTree(folder.children, targetId)
      if (found) return found
    }
    return null
  }

  private async addFolderToArchive(
    archive: archiver.Archiver,
    folder: FolderWithChildren,
    basePath: string,
    format: ExportFormat,
    depth: number = 0,
    counter: { count: number } = { count: 0 }
  ): Promise<void> {
    if (depth > MAX_EXPORT_DEPTH) {
      throw new ExportServiceError(
        `Export depth limit exceeded (max ${MAX_EXPORT_DEPTH} levels)`,
        'EXPORT_TOO_DEEP',
        400
      )
    }

    const folderPath = basePath ? `${basePath}/${this.sanitizeFilename(folder.name)}` : this.sanitizeFilename(folder.name)

    // Add each note in this folder
    for (const folderNote of folder.notes) {
      counter.count++
      if (counter.count > MAX_EXPORT_NOTES) {
        throw new ExportServiceError(
          `Export note limit exceeded (max ${MAX_EXPORT_NOTES} notes)`,
          'EXPORT_TOO_LARGE',
          400
        )
      }

      const note = await noteRepository.findByIdWithTags(folderNote.id)
      if (!note) continue

      const pages = await pageRepository.findByNoteId(note.id)
      const content = this.convertNoteToFormat(note, pages, format)
      const noteFilename = this.sanitizeFilename(note.title || 'untitled') + this.getExtension(format)

      archive.append(content, { name: `${folderPath}/${noteFilename}` })
    }

    // Recurse into sub-folders
    for (const child of folder.children) {
      await this.addFolderToArchive(archive, child, folderPath, format, depth + 1, counter)
    }
  }

  private convertNoteToFormat(note: NoteWithTags, pages: NotePage[], format: ExportFormat): string {
    // Use pages content if available, otherwise fall back to note.content
    const rawContent = pages.length > 0
      ? this.assemblePages(pages)
      : note.content

    switch (format) {
      case 'txt':
        return this.toPlainText(note, rawContent)
      case 'md':
        return this.toMarkdown(note, rawContent)
      case 'html':
        return this.toHtml(note, rawContent)
      default:
        return rawContent
    }
  }

  /**
   * Assemble multiple pages into a single content string.
   * Single page: use its content directly.
   * Multiple pages: separate with page title headers.
   */
  private assemblePages(pages: NotePage[]): string {
    if (pages.length === 1) {
      return pages[0].content
    }

    return pages
      .sort((a, b) => a.position - b.position)
      .map((page) => {
        const header = `<h2>${this.escapeHtml(page.title)}</h2>`
        return `${header}\n${page.content}`
      })
      .join('\n\n')
  }

  private toPlainText(note: NoteWithTags, rawContent: string): string {
    const lines: string[] = []

    if (note.title) {
      lines.push(note.title)
      lines.push('='.repeat(note.title.length))
      lines.push('')
    }

    const plainContent = this.stripHtml(rawContent)
    lines.push(plainContent)

    if (note.tags.length > 0) {
      lines.push('')
      lines.push('---')
      lines.push(`Tags: ${note.tags.map((t) => t.name).join(', ')}`)
    }

    return lines.join('\n')
  }

  private toMarkdown(note: NoteWithTags, rawContent: string): string {
    const lines: string[] = []

    if (note.title) {
      lines.push(`# ${note.title}`)
      lines.push('')
    }

    const markdownContent = this.htmlToMarkdown(rawContent)
    lines.push(markdownContent)

    if (note.tags.length > 0) {
      lines.push('')
      lines.push('---')
      lines.push('')
      lines.push(`**Tags:** ${note.tags.map((t) => `\`${t.name}\``).join(' ')}`)
    }

    return lines.join('\n')
  }

  private toHtml(note: NoteWithTags, rawContent: string): string {
    const markdownContent = this.toMarkdown(note, rawContent)
    const htmlBody = DOMPurify.sanitize(marked.parse(markdownContent) as string)

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(note.title || 'Untitled')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3 { margin-top: 1.5em; }
    code {
      background: #f4f4f4;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 1em 0;
      padding-left: 1em;
      color: #666;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 2em 0;
    }
    ul, ol { padding-left: 2em; }
    li { margin: 0.5em 0; }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`
  }

  private htmlToMarkdown(html: string): string {
    if (!/<[a-z][\s\S]*>/i.test(html)) {
      return html
    }
    return turndown.turndown(html)
  }

  private stripHtml(html: string): string {
    if (!/<[a-z][\s\S]*>/i.test(html)) {
      return html
    }
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
      .replace(/<\/(ul|ol|table|pre)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  private sanitizeFilename(name: string): string {
    return basename(name)
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\.{2,}/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100) || 'untitled'
  }

  private getExtension(format: ExportFormat): string {
    switch (format) {
      case 'md':
        return '.md'
      case 'txt':
        return '.txt'
      case 'html':
        return '.html'
      default:
        return '.txt'
    }
  }

  private getMimeType(format: ExportFormat): string {
    switch (format) {
      case 'md':
        return 'text/markdown'
      case 'txt':
        return 'text/plain'
      case 'html':
        return 'text/html'
      default:
        return 'text/plain'
    }
  }
}

export const exportService = new ExportService()
