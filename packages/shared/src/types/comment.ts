export interface Comment {
  id: string
  noteId: string
  userId: string
  parentId: string | null
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface CommentWithUser extends Comment {
  user: {
    id: string
    username: string
    name: string
    avatarUrl?: string
    avatarColor?: string
  }
}

export interface CommentWithReplies extends CommentWithUser {
  replies: CommentWithUser[]
}

export interface CommentCreateInput {
  noteId: string
  content: string
  parentId?: string
}

export interface CommentUpdateInput {
  content: string
}

export interface CommentsResponse {
  comments: CommentWithReplies[]
}

export interface CommentResponse {
  comment: CommentWithUser
}

export interface CommentCountResponse {
  count: number
}
