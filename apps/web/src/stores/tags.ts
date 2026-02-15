import { create } from 'zustand'
import type { Tag, TagCreateInput, TagUpdateInput } from '@onyka/shared'
import { tagsApi, type TagWithCount } from '@/services/api'

export type TagFilterMode = 'and' | 'or'

interface TagsState {
  tags: TagWithCount[]
  selectedTagIds: string[]
  excludedTagIds: string[]
  filterMode: TagFilterMode
  isLoading: boolean
  error: string | null
  fetchTags: () => Promise<void>
  createTag: (input: TagCreateInput) => Promise<Tag>
  updateTag: (id: string, input: TagUpdateInput) => Promise<void>
  deleteTag: (id: string) => Promise<void>
  toggleTagSelection: (id: string) => void
  toggleTagExclusion: (id: string) => void
  setFilterMode: (mode: TagFilterMode) => void
  clearTagSelection: () => void
  clearError: () => void
}

export const useTagsStore = create<TagsState>((set) => ({
  tags: [],
  selectedTagIds: [],
  excludedTagIds: [],
  filterMode: 'and',
  isLoading: false,
  error: null,

  fetchTags: async () => {
    set({ isLoading: true, error: null })
    try {
      const { tags } = await tagsApi.list(true)
      const tagsWithNotes = new Set(tags.filter(t => t.noteCount > 0).map(t => t.id))
      set((state) => ({
        tags,
        selectedTagIds: state.selectedTagIds.filter(id => tagsWithNotes.has(id)),
        excludedTagIds: state.excludedTagIds.filter(id => tagsWithNotes.has(id)),
        isLoading: false,
      }))
    } catch {
      set({ error: 'Failed to fetch tags', isLoading: false })
    }
  },

  createTag: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const { tag } = await tagsApi.create(input)
      set((state) => ({
        tags: [...state.tags, { ...tag, noteCount: 0 }],
        isLoading: false,
      }))
      return tag
    } catch (err) {
      set({ error: 'Failed to create tag', isLoading: false })
      throw err
    }
  },

  updateTag: async (id, input) => {
    try {
      const { tag } = await tagsApi.update(id, input)
      set((state) => ({
        tags: state.tags.map((t) =>
          t.id === id ? { ...tag, noteCount: t.noteCount } : t
        ),
      }))
    } catch (err) {
      set({ error: 'Failed to update tag' })
      throw err
    }
  },

  deleteTag: async (id) => {
    try {
      await tagsApi.delete(id)
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
        selectedTagIds: state.selectedTagIds.filter((tid) => tid !== id),
        excludedTagIds: state.excludedTagIds.filter((tid) => tid !== id),
      }))
    } catch (err) {
      set({ error: 'Failed to delete tag' })
      throw err
    }
  },

  toggleTagSelection: (id) =>
    set((state) => {
      // If the tag is currently excluded, move it to included
      const wasExcluded = state.excludedTagIds.includes(id)
      if (wasExcluded) {
        return {
          excludedTagIds: state.excludedTagIds.filter((tid) => tid !== id),
          selectedTagIds: [...state.selectedTagIds, id],
        }
      }
      return {
        selectedTagIds: state.selectedTagIds.includes(id)
          ? state.selectedTagIds.filter((tid) => tid !== id)
          : [...state.selectedTagIds, id],
      }
    }),

  toggleTagExclusion: (id) =>
    set((state) => {
      // If the tag is currently included, move it to excluded
      const wasSelected = state.selectedTagIds.includes(id)
      if (wasSelected) {
        return {
          selectedTagIds: state.selectedTagIds.filter((tid) => tid !== id),
          excludedTagIds: [...state.excludedTagIds, id],
        }
      }
      return {
        excludedTagIds: state.excludedTagIds.includes(id)
          ? state.excludedTagIds.filter((tid) => tid !== id)
          : [...state.excludedTagIds, id],
      }
    }),

  setFilterMode: (mode) => set({ filterMode: mode }),

  clearTagSelection: () => set({ selectedTagIds: [], excludedTagIds: [] }),

  clearError: () => set({ error: null }),
}))
