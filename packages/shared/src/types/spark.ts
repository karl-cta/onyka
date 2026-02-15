export interface Spark {
  id: string
  ownerId: string
  content: string
  isPinned: boolean
  createdAt: Date
  expiresAt: Date | null
  isExpired: boolean
  convertedToNoteId: string | null
}

export type ExpirationOption = 'none' | '1h' | '24h' | '7d' | '30d'

export interface SparkCreateInput {
  content: string
  isPinned?: boolean
  expiration?: ExpirationOption
}

export interface SparkStats {
  pinnedCount: number
  temporaryCount: number
  totalCount: number
}

export interface SparksList {
  pinned: Spark[]
  temporary: Spark[]
  permanent: Spark[]
}
