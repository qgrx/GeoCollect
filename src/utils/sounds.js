// Sons générés via Web Audio API — aucun fichier externe requis
// Le contexte est créé en lazy sur le premier appel, après un geste utilisateur

let _ctx = null
let _unlocked = false

// Déverrouiller l'audio sur le premier geste utilisateur
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (_unlocked) return
    _unlocked = true
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return }
    }
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {})
  }
  window.addEventListener('click',   unlock, { once: false, passive: true })
  window.addEventListener('keydown',  unlock, { once: false, passive: true })
  window.addEventListener('touchstart', unlock, { once: false, passive: true })
}

function play(fn) {
  // Ne jouer que si l'audio a été déverrouillé par un geste utilisateur
  if (!_unlocked || !_ctx) return
  try {
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {})
    fn(_ctx)
  } catch { /* silencieux */ }
}

export function soundCorrect() {
  play(ctx => {
    const t = ctx.currentTime
    ;[523, 659, 784, 1047].forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq
      o.type = 'sine'
      g.gain.setValueAtTime(0, t + i * 0.1)
      g.gain.linearRampToValueAtTime(0.18, t + i * 0.1 + 0.02)
      g.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.15)
      o.start(t + i * 0.1)
      o.stop(t + i * 0.1 + 0.2)
    })
  })
}

export function soundWrong() {
  play(ctx => {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(220, t)
    o.frequency.linearRampToValueAtTime(110, t + 0.3)
    g.gain.setValueAtTime(0.15, t)
    g.gain.linearRampToValueAtTime(0, t + 0.3)
    o.start(t); o.stop(t + 0.35)
  })
}

export function soundCountdownUrgent() {
  play(ctx => {
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'square'
    o.frequency.value = 880
    g.gain.setValueAtTime(0.08, t)
    g.gain.linearRampToValueAtTime(0, t + 0.06)
    o.start(t); o.stop(t + 0.08)
  })
}

export function soundMarketSale() {
  play(ctx => {
    const t = ctx.currentTime
    ;[392, 523, 659].forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0, t + i * 0.08)
      g.gain.linearRampToValueAtTime(0.12, t + i * 0.08 + 0.02)
      g.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.12)
      o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.15)
    })
  })
}

export function soundQuizNew() {
  play(ctx => {
    const t = ctx.currentTime
    ;[330, 392, 494, 659].forEach((freq, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'triangle'
      o.frequency.value = freq
      g.gain.setValueAtTime(0, t + i * 0.07)
      g.gain.linearRampToValueAtTime(0.1, t + i * 0.07 + 0.03)
      g.gain.linearRampToValueAtTime(0, t + i * 0.07 + 0.1)
      o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.12)
    })
  })
}
