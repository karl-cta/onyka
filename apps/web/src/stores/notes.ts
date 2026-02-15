import { create } from 'zustand'
import type { Note, NoteWithTags, NoteCreateInput, NoteUpdateInput } from '@onyka/shared'
import { notesApi, type SearchResult } from '@/services/api'

// ── Note fetch cache & race-condition guard ────────────────────────
// Module-level: not in Zustand state (nothing subscribes to cache itself).
// Provides instant display for previously-viewed notes + debounced API
// refresh to stay in sync without firing requests on every rapid click.
const noteCache = new Map<string, NoteWithTags>()
const NOTE_CACHE_MAX = 20
let _latestFetchId: string | null = null
let _fetchTimer: ReturnType<typeof setTimeout> | null = null

function cancelPendingFetch() {
  if (_fetchTimer) {
    clearTimeout(_fetchTimer)
    _fetchTimer = null
  }
}

function evictOldest() {
  if (noteCache.size > NOTE_CACHE_MAX) {
    const firstKey = noteCache.keys().next().value
    if (firstKey) noteCache.delete(firstKey)
  }
}
// ────────────────────────────────────────────────────────────────────

interface NotesState {
  notes: Note[]
  currentNote: NoteWithTags | null
  isLoading: boolean
  error: string | null
  searchResults: SearchResult[]
  isSearching: boolean
  selectedNoteIds: string[]
  fetchNotes: (folderId?: string | null) => Promise<void>
  fetchNote: (id: string) => Promise<void>
  createNote: (input: NoteCreateInput) => Promise<Note>
  updateNote: (id: string, input: NoteUpdateInput) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  deleteMultipleNotes: (ids: string[]) => Promise<void>
  search: (query: string) => Promise<void>
  clearSearch: () => void
  setCurrentNote: (note: NoteWithTags | null) => void
  clearError: () => void
  toggleNoteSelection: (id: string) => void
  clearNoteSelection: () => void
  selectNote: (id: string) => void
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  currentNote: null,
  isLoading: false,
  error: null,
  searchResults: [],
  isSearching: false,
  selectedNoteIds: [],

  fetchNotes: async (folderId) => {
    set({ isLoading: true, error: null })
    try {
      const { notes } = await notesApi.list({ folderId })
      set({ notes, isLoading: false })
    } catch {
      set({ error: 'Failed to fetch notes', isLoading: false })
    }
  },

  fetchNote: async (id) => {
    _latestFetchId = id
    cancelPendingFetch()

    // Instant display from cache — no loading spinner
    const cached = noteCache.get(id)
    if (cached) {
      set({ currentNote: cached, isLoading: false, error: null })
    } else {
      set({ isLoading: true, error: null })
    }

    // Debounced API refresh (50ms) — prevents rapid-fire requests
    // while keeping non-cached fetches nearly instant
    _fetchTimer = setTimeout(async () => {
      try {
        const { note } = await notesApi.get(id)
        // Only apply if this is still the note the user wants
        if (_latestFetchId === id) {
          set({ currentNote: note, isLoading: false })
        }
        noteCache.set(id, note)
        evictOldest()
      } catch {
        if (_latestFetchId === id && !cached) {
          set({ error: 'Failed to fetch note', isLoading: false })
        }
      }
    }, 50)
  },

  createNote: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const { note } = await notesApi.create(input)
      set((state) => ({
        notes: [note, ...state.notes],
        isLoading: false,
      }))
      return note
    } catch (err) {
      set({ error: 'Failed to create note', isLoading: false })
      throw err
    }
  },

  updateNote: async (id, input) => {
    try {
      const { note } = await notesApi.update(id, input)
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? note : n)),
        currentNote:
          state.currentNote?.id === id
            ? {
                ...state.currentNote,
                title: note.title,
                updatedAt: note.updatedAt,
              }
            : state.currentNote,
      }))
      // Keep cache in sync
      const cached = noteCache.get(id)
      if (cached) {
        noteCache.set(id, { ...cached, title: note.title, updatedAt: note.updatedAt })
      }
    } catch (err) {
      set({ error: 'Failed to update note' })
      throw err
    }
  },

  deleteNote: async (id) => {
    try {
      await notesApi.delete(id)
      noteCache.delete(id)
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        currentNote: state.currentNote?.id === id ? null : state.currentNote,
        selectedNoteIds: state.selectedNoteIds.filter((nid) => nid !== id),
      }))
    } catch (err) {
      set({ error: 'Failed to delete note' })
      throw err
    }
  },

  deleteMultipleNotes: async (ids) => {
    try {
      await Promise.all(ids.map((id) => notesApi.delete(id)))
      ids.forEach((id) => noteCache.delete(id))
      set((state) => ({
        notes: state.notes.filter((n) => !ids.includes(n.id)),
        currentNote: state.currentNote && ids.includes(state.currentNote.id) ? null : state.currentNote,
        selectedNoteIds: [],
      }))
    } catch (err) {
      set({ error: 'Failed to delete notes' })
      throw err
    }
  },

  search: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false })
      return
    }
    set({ isSearching: true })
    try {
      const { results } = await notesApi.search(query)
      set({ searchResults: results, isSearching: false })
    } catch {
      set({ searchResults: [], isSearching: false })
    }
  },

  clearSearch: () => set({ searchResults: [], isSearching: false }),

  setCurrentNote: (note) => {
    // When deselecting, cancel any in-flight fetch so it doesn't
    // resurrect a note the user navigated away from
    if (!note) {
      _latestFetchId = null
      cancelPendingFetch()
    }
    set({ currentNote: note })
  },

  clearError: () => set({ error: null }),

  toggleNoteSelection: (id) =>
    set((state) => ({
      selectedNoteIds: state.selectedNoteIds.includes(id)
        ? state.selectedNoteIds.filter((nid) => nid !== id)
        : [...state.selectedNoteIds, id],
    })),

  clearNoteSelection: () => set({ selectedNoteIds: [] }),

  selectNote: (id) => set({ selectedNoteIds: [id] }),
}))
