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

async function freshToken() {
  if (!supabase) return null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch { return null }
}

export async function getSocket() {
  if (!_rawApiUrl) return null

  const token = await freshToken()

  // Socket déjà instancié : le réutiliser (rafraîchir le token, forcer la reconnexion
  // s'il s'était déconnecté) plutôt que d'empiler une nouvelle instance avec ses
  // propres listeners.
  if (_socket) {
    _socket.auth = { token }
    if (!_socket.connected) _socket.connect()
    return _socket
  }

  _socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    // Pas de `reconnectionAttempts` → illimité (défaut socket.io). Une coupure
    // (redéploiement backend, timeout proxy WebSocket, veille mobile, blip réseau)
    // ne doit PAS tuer le temps réel : sinon le client abandonnait au bout de ~10 s
    // et restait muet (plus de quiz:new / quiz:solved / quiz:expired) jusqu'à un
    // rechargement manuel de la page. Le backoff plafonné évite de marteler le serveur.
  })

  // À chaque tentative de reconnexion, réinjecter un token frais : le token initial
  // peut avoir expiré pendant la coupure → sans ça les events ciblés (room user_<id>,
  // ex. market:sold) seraient perdus après reconnexion.
  _socket.io.on('reconnect_attempt', async () => {
    _socket.auth = { token: await freshToken() }
  })

  _socket.on('connect_error', err => console.warn('[Socket] error:', err.message))
  // Diagnostic : la raison indique l'origine d'une coupure (« transport close » = proxy,
  // « ping timeout » = keepalive, « io server disconnect » = fermeture serveur).
  _socket.on('disconnect', reason => console.warn('[Socket] disconnect:', reason))

  return _socket
}

export function disconnectSocket() {
  _socket?.disconnect()
  _socket = null
}

// Retour d'arrière-plan (surtout mobile : l'OS suspend souvent le WebSocket sans que
// socket.io le détecte tout de suite) → relancer la connexion sans attendre le timeout
// de ping, pour retrouver le temps réel immédiatement.
// ⚠️ Après une longue suspension (iOS), le socket se déclare souvent encore
// « connected » alors que la connexion est morte (zombie, jusqu'à ~45 s de ping
// timeout) : les quiz:new n'arrivent plus et le bandeau reste figé jusqu'à un
// rechargement manuel. → On force un cycle disconnect/connect dans ce cas.
if (typeof document !== 'undefined') {
  let hiddenAt = null
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
    if (!_socket) { hiddenAt = null; return }
    if (!_socket.connected) {
      _socket.connect()
    } else if (hiddenAt && Date.now() - hiddenAt > 45_000) {
      _socket.disconnect()
      _socket.connect()
    }
    hiddenAt = null
  })
}
