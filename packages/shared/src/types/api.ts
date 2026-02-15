export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
  timestamp: string
  path: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface NotesQueryParams extends PaginationParams {
  folderId?: string
  tagIds?: string[]
  search?: string
  includeDeleted?: boolean
}

export interface SearchParams {
  query: string
  folderId?: string
  tagIds?: string[]
}

export type ExportFormat = 'md' | 'txt' | 'html' | 'pdf'
