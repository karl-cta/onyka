import { create } from 'zustand'
import type { Note, ShareWithUser, ShareWithOwner, Permission } from '@onyka/shared'
import { notesApi, sharesApi } from '@/services/api'

export interface SharedNote extends Note {
  sharedBy: {
    id: string
    username: string
    name: string
    avatarUrl?: string
    avatarColor?: string
  }
  permission: Permission
}

interface SharesState {
  sharedWithMe: SharedNote[]
  isLoadingSharedWithMe: boolean
  myShares: ShareWithUser[]
  isLoadingMyShares: boolean
  sharedFolderIds: Set<string>
  fetchSharedWithMe: () => Promise<void>
  fetchMyShares: () => Promise<void>
  refreshAll: () => Promise<void>
}

/** Returns a Set of folder IDs that the current user has shared with others */
export const useSharedFolderIds = () =>
  useSharesStore((state) => state.sharedFolderIds)

export const useSharesStore = create<SharesState>((set, get) => ({
  sharedWithMe: [],
  isLoadingSharedWithMe: false,

  myShares: [],
  isLoadingMyShares: false,
  sharedFolderIds: new Set<string>(),

  fetchSharedWithMe: async () => {
    set({ isLoadingSharedWithMe: true })
    try {
      const [notesResult, sharesResult] = await Promise.all([
        notesApi.sharedWithMe(),
        sharesApi.sharedWithMe(),
      ])

      const { notes } = notesResult
      const { shares } = sharesResult

      const sharedNotes: SharedNote[] = notes.map(note => {
        const share = shares.find((s: ShareWithOwner) => s.resourceId === note.id)
        return {
          ...note,
          sharedBy: share?.owner ?? {
            id: '',
            username: 'Unknown',
            name: 'Unknown',
          },
          permission: share?.permission ?? 'read',
        }
      })

      set({ sharedWithMe: sharedNotes, isLoadingSharedWithMe: false })
    } catch (err) {
      console.error('Failed to fetch shared notes:', err)
      set({ isLoadingSharedWithMe: false })
    }
  },

  fetchMyShares: async () => {
    set({ isLoadingMyShares: true })
    try {
      const { shares } = await sharesApi.list()
      const folderIds = new Set<string>()
      for (const share of shares) {
        if (share.resourceType === 'folder') {
          folderIds.add(share.resourceId)
        }
      }
      set({ myShares: shares, sharedFolderIds: folderIds, isLoadingMyShares: false })
    } catch (err) {
      console.error('Failed to fetch my shares:', err)
      set({ isLoadingMyShares: false })
    }
  },

  refreshAll: async () => {
    await Promise.all([
      get().fetchSharedWithMe(),
      get().fetchMyShares(),
    ])
  },
}))
