/** Shared WebSocket connection singleton used by collaboration and notification hooks. */

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

/** Returns the shared socket, creating it on first call. */
export function getSharedSocket(): Socket {
  if (socket) return socket

  socket = io(window.location.origin, {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket!.id)
  })

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message)
  })

  socket.on('auth-error', () => {
    console.warn('[Socket] Authentication failed')
    // Keep connected: user may re-authenticate and the socket will reconnect
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
  })

  return socket
}

/** Disconnect and destroy the socket (call on logout). */
export function resetSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
