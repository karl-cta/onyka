export type Permission = 'read' | 'edit' | 'admin'
export type ResourceType = 'note' | 'folder' | 'workspace'

export interface Share {
  id: string
  resourceId: string
  resourceType: ResourceType
  ownerId: string
  sharedWithId: string
  permission: Permission
  createdAt: Date
}

export interface ShareWithUser extends Share {
  sharedWith: {
    id: string
    username: string
    name: string
    avatarUrl?: string
    avatarColor?: string
  }
}

export interface ShareWithOwner extends Share {
  owner: {
    id: string
    username: string
    name: string
    avatarUrl?: string
    avatarColor?: string
  }
}

export interface ShareCreateInput {
  resourceId: string
  resourceType: ResourceType
  username: string
  permission: Permission
}

export interface Collaborator {
  id: string
  username: string
  name: string
  avatarUrl?: string
  avatarColor?: string
  permission: Permission
}
