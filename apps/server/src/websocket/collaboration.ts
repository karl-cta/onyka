/**
 * Real-time collaboration WebSocket handler
 *
 * Handles:
 * - Joining/leaving note rooms
 * - Broadcasting content changes
 * - Cursor/selection sync
 * - Presence (who's editing)
 */

import { Server as SocketServer, Socket } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { parse as parseCookies } from 'cookie'
import { env } from '../config/env.js'
import { sharingService } from '../services/sharing.service.js'
import { tokenService } from '../services/token.service.js'
import { userRepository, shareRepository } from '../repositories/index.js'
import { settingsService } from '../services/settings.service.js'
import { SYSTEM_USERNAME } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'

// Types for collaboration events
interface JoinRoomPayload {
  noteId: string
}

interface LeaveRoomPayload {
  noteId: string
}

interface ContentChangePayload {
  noteId: string
  content: string
  title: string
}

interface CursorPayload {
  noteId: string
  position: { from: number; to: number } | null
}

interface UserPresence {
  id: string
  name: string
  avatarUrl?: string
  cursorPosition?: { from: number; to: number } | null
}

// Room state management
const roomUsers = new Map<string, Map<string, UserPresence>>() // noteId -> Map<socketId, UserPresence>
const socketToRoom = new Map<string, string>() // socketId -> noteId
// Map socketId -> userId for targeted notifications
const socketUserMap = new Map<string, string>()

// Global IO instance for external notifications
let ioInstance: SocketServer | null = null

/**
 * Get the Socket.io instance for external notifications
 */
export function getSocketIO(): SocketServer | null {
  return ioInstance
}

/**
 * Emit an event to all sockets belonging to a specific user.
 * Returns true if at least one socket was found, false otherwise.
 */
export function emitToUser(userId: string, event: string, data: unknown): boolean {
  if (!ioInstance) return false

  let sent = false
  for (const [socketId, uid] of socketUserMap.entries()) {
    if (uid === userId) {
      const socket = ioInstance.sockets.sockets.get(socketId)
      if (socket) {
        socket.emit(event, data)
        sent = true
      }
    }
  }
  return sent
}

// Helpers
function getRoomId(noteId: string): string {
  return `note:${noteId}`
}

async function authenticateSocket(socket: Socket): Promise<{ userId: string; name: string; avatarUrl?: string } | null> {
  try {
    // Check if auth is disabled
    const authDisabled = await settingsService.isAuthDisabled()
    if (authDisabled) {
      const systemUser = await userRepository.findByUsername(SYSTEM_USERNAME)
        ?? await userRepository.findByUsername('default')
      if (systemUser) {
        return {
          userId: systemUser.id,
          name: systemUser.name,
          avatarUrl: systemUser.avatarUrl,
        }
      }
    }

    // Extract token from cookie header
    const cookieHeader = socket.handshake.headers.cookie
    if (!cookieHeader) return null

    // Parse cookies to find access_token
    const cookies = parseCookies(cookieHeader)

    const token = cookies['access_token']
    if (!token) return null

    const payload = await tokenService.verifyAccessToken(token)
    if (!payload) return null

    const user = await userRepository.findById(payload.sub)
    if (!user || user.isDisabled) return null

    return {
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
    }
  } catch {
    return null
  }
}

async function canAccessNote(userId: string, noteId: string): Promise<boolean> {
  const permission = await sharingService.getPermissionLevel(userId, noteId, 'note')
  return permission !== null
}

export function setupCollaborationSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    path: '/socket.io',
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  // Store global instance for external notifications
  ioInstance = io

  io.on('connection', async (socket) => {
    // Authenticate user
    const user = await authenticateSocket(socket)
    if (!user) {
      logger.warn('[WebSocket] Auth failed for socket', { socketId: socket.id })
      socket.emit('auth-error', { message: 'Authentication required' })
      socket.disconnect()
      return
    }

    // Store userId on socket for targeted notifications
    socketUserMap.set(socket.id, user.userId)

    // Join a note room
    socket.on('join-room', async (payload: JoinRoomPayload) => {
      const { noteId } = payload

      // Verify access permission
      const hasAccess = await canAccessNote(user.userId, noteId)
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' })
        return
      }

      // Defense in depth: only create a collaboration room if the note
      // is actually shared with someone. Unshared notes don't need rooms.
      const noteShares = await shareRepository.findByResource(noteId, 'note')
      if (noteShares.length === 0) {
        return
      }

      const roomId = getRoomId(noteId)

      // Leave previous room if any
      const previousRoom = socketToRoom.get(socket.id)
      if (previousRoom) {
        socket.leave(getRoomId(previousRoom))
        const roomState = roomUsers.get(previousRoom)
        if (roomState) {
          roomState.delete(socket.id)
          socket.to(getRoomId(previousRoom)).emit('user-left', { socketId: socket.id })
          if (roomState.size === 0) {
            roomUsers.delete(previousRoom)
          }
        }
      }

      // Join new room
      socket.join(roomId)
      socketToRoom.set(socket.id, noteId)

      // Add to room state
      if (!roomUsers.has(noteId)) {
        roomUsers.set(noteId, new Map())
      }
      const presence: UserPresence = {
        id: user.userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      }
      roomUsers.get(noteId)!.set(socket.id, presence)

      // Send current users in room
      const currentUsers = Array.from(roomUsers.get(noteId)!.entries()).map(([sid, p]) => ({
        socketId: sid,
        ...p,
      }))
      socket.emit('room-joined', { noteId, users: currentUsers })

      // Notify others
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        ...presence,
      })

      logger.info('[WebSocket] User joined room', { user: user.name, noteId, usersInRoom: currentUsers.length })
    })

    // Leave a note room
    socket.on('leave-room', (payload: LeaveRoomPayload) => {
      const { noteId } = payload
      const roomId = getRoomId(noteId)

      socket.leave(roomId)
      socketToRoom.delete(socket.id)

      const roomState = roomUsers.get(noteId)
      if (roomState) {
        roomState.delete(socket.id)
        socket.to(roomId).emit('user-left', { socketId: socket.id })
        // Clean up empty rooms to prevent memory leaks
        if (roomState.size === 0) {
          roomUsers.delete(noteId)
        }
      }
    })

    // Content change - broadcast to others in the room (last-write-wins)
    socket.on('content-change', async (payload: ContentChangePayload) => {
      const { noteId, content, title } = payload

      // Verify access
      const hasAccess = await canAccessNote(user.userId, noteId)
      if (!hasAccess) return

      // Verify the user has edit permission
      const permission = await sharingService.getPermissionLevel(user.userId, noteId, 'note')
      if (permission !== 'owner' && permission !== 'edit' && permission !== 'admin') {
        return
      }

      const roomId = getRoomId(noteId)

      // Broadcast to other users in the room
      socket.to(roomId).emit('content-update', {
        noteId,
        content,
        title,
        fromUser: {
          id: user.userId,
          name: user.name,
        },
      })
    })

    // Cursor position update
    socket.on('cursor-update', (payload: CursorPayload) => {
      const { noteId, position } = payload
      const roomId = getRoomId(noteId)

      // Update presence
      const roomState = roomUsers.get(noteId)
      if (roomState) {
        const presence = roomState.get(socket.id)
        if (presence) {
          presence.cursorPosition = position
        }
      }

      // Broadcast to others
      socket.to(roomId).emit('cursor-moved', {
        socketId: socket.id,
        userId: user.userId,
        name: user.name,
        position,
      })
    })

    // Disconnect handler
    socket.on('disconnect', () => {
      socketUserMap.delete(socket.id)
      const noteId = socketToRoom.get(socket.id)
      if (noteId) {
        const roomId = getRoomId(noteId)
        const roomState = roomUsers.get(noteId)
        if (roomState) {
          roomState.delete(socket.id)
          socket.to(roomId).emit('user-left', { socketId: socket.id })
          // Clean up empty rooms to prevent memory leaks
          if (roomState.size === 0) {
            roomUsers.delete(noteId)
          }
        }
        socketToRoom.delete(socket.id)
      }
    })
  })

  return io
}
