import { rawDb } from '../db/index.js'
import type { Note } from '@onyka/shared'

export interface SearchResult {
  id: string
  title: string
  preview: string
  score: number
}

export class SearchService {
  indexNote(note: Note): void {
    this.removeNoteFromIndex(note.id)

    const insertStmt = rawDb.prepare(`
      INSERT INTO notes_fts (title, content, note_id, owner_id)
      VALUES (?, ?, ?, ?)
    `)
    insertStmt.run(note.title, this.extractTextContent(note.content), note.id, note.ownerId)
  }

  removeNoteFromIndex(noteId: string): void {
    const stmt = rawDb.prepare('DELETE FROM notes_fts WHERE note_id = ?')
    stmt.run(noteId)
  }

  search(query: string, userId: string, limit = 20): SearchResult[] {
    const sanitizedQuery = this.sanitizeQuery(query)
    if (!sanitizedQuery) return []

    const stmt = rawDb.prepare(`
      SELECT
        notes_fts.note_id as id,
        notes_fts.title,
        snippet(notes_fts, 1, '<mark>', '</mark>', '...', 32) as preview,
        notes_fts.rank as score
      FROM notes_fts
      JOIN notes ON notes.id = notes_fts.note_id
      WHERE notes_fts MATCH ? AND notes_fts.owner_id = ? AND notes.is_deleted = 0
      ORDER BY notes_fts.rank
      LIMIT ?
    `)

    const results = stmt.all(sanitizedQuery, userId, limit) as {
      id: string
      title: string
      preview: string
      score: number
    }[]

    return results.map((row) => ({
      id: row.id,
      title: row.title,
      preview: row.preview,
      score: row.score,
    }))
  }

  reindexAll(notes: Note[]): void {
    rawDb.exec('DELETE FROM notes_fts')

    const stmt = rawDb.prepare(`
      INSERT INTO notes_fts (title, content, note_id, owner_id)
      VALUES (?, ?, ?, ?)
    `)

    const insertMany = rawDb.transaction((notesToIndex: Note[]) => {
      for (const note of notesToIndex) {
        if (!note.isDeleted) {
          stmt.run(note.title, this.extractTextContent(note.content), note.id, note.ownerId)
        }
      }
    })

    insertMany(notes)
  }

  private extractTextContent(content: string): string {
    if (!content) return ''

    // Remove HTML tags and extract text content
    // 1. Replace block-level tags with spaces (to preserve word boundaries)
    let text = content
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/?(p|div|h[1-6]|li|tr|td|th|blockquote|pre|hr)[^>]*>/gi, ' ')
      // 2. Remove all remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // 3. Decode common HTML entities
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&[a-z]+;/gi, ' ') // Remove other entities
      // 4. Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()

    return text
  }

  private sanitizeQuery(query: string): string {
    return query
      .trim()
      .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => `"${term}"*`)
      .join(' OR ')
  }
}

export const searchService = new SearchService()
