/**
 * Client Socket.io — connexion au backend temps réel.
 * Si VITE_API_URL n'est pas défini, retourne un socket mock
 * qui n'émet/reçoit rien (le quiz reste en mode countdown local).
 */
import { io } from 'socket.io-client'
import { supabase } from '../lib/supabase.js'

const _rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const API_URL    = _rawApiUrl || 'http://localhost:3001'

let _socket = null

export async function getSocket() {
  if (!_rawApiUrl) return null
  if (_socket?.connected) return _socket

  // Récupérer le token pour authentifier la connexion WebSocket
  let token = null
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token || null
  }

  _socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  })

  _socket.on('connect_error', err => console.warn('[Socket] error:', err.message))

  return _socket
}

export function disconnectSocket() {
  _socket?.disconnect()
  _socket = null
}
