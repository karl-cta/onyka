/** Real-time collaboration hook for live editing, presence, and cursor sync. */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/auth'
import { getSharedSocket } from './useSocket'

interface UserPresence {
  socketId: string
  id: string
  name: string
  avatarUrl?: string
  cursorPosition?: { from: number; to: number } | null
}

interface ContentUpdate {
  noteId: string
  content: string
  title: string
  fromUser: {
    id: string
    name: string
  }
}

interface UseCollaborationOptions {
  noteId: string
  enabled?: boolean
  onContentUpdate?: (update: ContentUpdate) => void
  onUsersChange?: (users: UserPresence[]) => void
}

interface UseCollaborationReturn {
  isConnected: boolean
  users: UserPresence[]
  sendContentChange: (content: string, title: string) => void
  sendCursorUpdate: (position: { from: number; to: number } | null) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }) as T
}

export function useCollaboration({
  noteId,
  enabled = true,
  onContentUpdate,
  onUsersChange,
}: UseCollaborationOptions): UseCollaborationReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [users, setUsers] = useState<UserPresence[]>([])
  const socketRef = useRef<Socket | null>(null)
  const noteIdRef = useRef(noteId)
  const { user } = useAuthStore()

  const onContentUpdateRef = useRef(onContentUpdate)
  const onUsersChangeRef = useRef(onUsersChange)

  useEffect(() => {
    noteIdRef.current = noteId
    onContentUpdateRef.current = onContentUpdate
    onUsersChangeRef.current = onUsersChange
  }, [noteId, onContentUpdate, onUsersChange])

  useEffect(() => {
    if (!enabled || !noteId || !user) return

    const socket = getSharedSocket()
    socketRef.current = socket
    setIsConnected(socket.connected)

    // socket.io queues emits if not yet connected
    socket.emit('join-room', { noteId })

    const handleRoomJoined = (data: { noteId: string; users: UserPresence[] }) => {
      if (data.noteId === noteIdRef.current) {
        const otherUsers = data.users.filter(u => u.id !== user.id)
        setUsers(otherUsers)
        onUsersChangeRef.current?.(otherUsers)
      }
    }

    const handleUserJoined = (userData: UserPresence) => {
      if (userData.id === user.id) return
      setUsers(prev => {
        if (prev.some(u => u.socketId === userData.socketId)) return prev
        const updated = [...prev, userData]
        onUsersChangeRef.current?.(updated)
        return updated
      })
    }

    const handleUserLeft = (data: { socketId: string }) => {
      setUsers(prev => {
        const updated = prev.filter(u => u.socketId !== data.socketId)
        if (updated.length === prev.length) return prev
        onUsersChangeRef.current?.(updated)
        return updated
      })
    }

    const handleContentUpdate = (update: ContentUpdate) => {
      if (update.noteId === noteIdRef.current && update.fromUser.id !== user.id) {
        onContentUpdateRef.current?.(update)
      }
    }

    const handleCursorMoved = debounce((data: { socketId: string; userId: string; name: string; position: { from: number; to: number } | null }) => {
      if (data.userId === user.id) return
      setUsers(prev => {
        const updated = prev.map(u =>
          u.socketId === data.socketId
            ? { ...u, cursorPosition: data.position }
            : u
        )
        onUsersChangeRef.current?.(updated)
        return updated
      })
    }, 50)

    const handleConnect = () => {
      setIsConnected(true)
      socket.emit('join-room', { noteId: noteIdRef.current })
    }
    const handleDisconnect = () => setIsConnected(false)

    socket.on('room-joined', handleRoomJoined)
    socket.on('user-joined', handleUserJoined)
    socket.on('user-left', handleUserLeft)
    socket.on('content-update', handleContentUpdate)
    socket.on('cursor-moved', handleCursorMoved)
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('room-joined', handleRoomJoined)
      socket.off('user-joined', handleUserJoined)
      socket.off('user-left', handleUserLeft)
      socket.off('content-update', handleContentUpdate)
      socket.off('cursor-moved', handleCursorMoved)
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)

      if (socket.connected) {
        socket.emit('leave-room', { noteId })
      }
    }
  }, [noteId, enabled, user])

  const sendContentChangeRef = useRef(
    debounce((content: string, title: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('content-change', {
          noteId: noteIdRef.current,
          content,
          title,
        })
      }
    }, 150)
  )

  const sendContentChange = useCallback((content: string, title: string) => {
    sendContentChangeRef.current(content, title)
  }, [])

  const sendCursorUpdateRef = useRef(
    debounce((position: { from: number; to: number } | null) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('cursor-update', {
          noteId: noteIdRef.current,
          position,
        })
      }
    }, 50)
  )

  const sendCursorUpdate = useCallback((position: { from: number; to: number } | null) => {
    sendCursorUpdateRef.current(position)
  }, [])

  return {
    isConnected,
    users,
    sendContentChange,
    sendCursorUpdate,
  }
}
