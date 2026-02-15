/** Listens for real-time share notifications via WebSocket. */

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth'
import { getSharedSocket } from './useSocket'

interface ShareNotification {
  shareId: string
  resourceId: string
  resourceType: 'note' | 'folder' | 'workspace'
  resourceTitle: string
  permission: 'read' | 'edit' | 'admin'
  sharedBy: {
    id: string
    username: string
    name: string
  }
  sharedWithUserId: string
}

interface UseShareNotificationsOptions {
  enabled?: boolean
  onShareReceived?: (notification: ShareNotification) => void
}

export function useShareNotifications({
  enabled = true,
  onShareReceived,
}: UseShareNotificationsOptions = {}): void {
  const { user } = useAuthStore()
  const onShareReceivedRef = useRef(onShareReceived)

  useEffect(() => {
    onShareReceivedRef.current = onShareReceived
  }, [onShareReceived])

  useEffect(() => {
    if (!enabled || !user) return

    const socket = getSharedSocket()

    const handleResourceShared = (notification: ShareNotification) => {
      if (notification.sharedWithUserId === user.id) {
        onShareReceivedRef.current?.(notification)
      }
    }

    socket.on('resource-shared', handleResourceShared)

    return () => {
      socket.off('resource-shared', handleResourceShared)
    }
  }, [enabled, user])
}
