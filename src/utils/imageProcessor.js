/**
 * Traitement des images uploadées dans l'admin :
 * - Supprime les métadonnées existantes (re-encodage Canvas)
 * - Redimensionne pour ne pas dépasser les cibles de taille
 * - Injecte des métadonnées PNG personnalisées (chunks tEXt)
 */

// ─── CRC32 pour les chunks PNG ────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// ─── Injection de chunks tEXt dans un PNG ────────────────────────────────────
function injectPngTextChunks(pngBytes, meta) {
  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10]

  // Vérifier la signature PNG
  for (let i = 0; i < 8; i++) {
    if (pngBytes[i] !== PNG_SIG[i]) return pngBytes  // pas un PNG valide
  }

  const enc = new TextEncoder()

  // Construire les chunks tEXt à injecter
  function makeTextChunk(keyword, text) {
    const kw  = enc.encode(keyword)
    const tx  = enc.encode(text)
    const data = new Uint8Array(kw.length + 1 + tx.length)
    data.set(kw)
    data[kw.length] = 0  // séparateur null
    data.set(tx, kw.length + 1)

    const type = enc.encode('tEXt')
    const len  = new Uint8Array(4)
    new DataView(len.buffer).setUint32(0, data.length)
    const crcInput = new Uint8Array(4 + data.length)
    crcInput.set(type); crcInput.set(data, 4)
    const crcVal = new Uint8Array(4)
    new DataView(crcVal.buffer).setUint32(0, crc32(crcInput))

    const chunk = new Uint8Array(4 + 4 + data.length + 4)
    chunk.set(len)
    chunk.set(type, 4)
    chunk.set(data, 8)
    chunk.set(crcVal, 8 + data.length)
    return chunk
  }

  const chunks = [
    makeTextChunk('Author',      'geocoins.com'),
    makeTextChunk('Description', `${meta.name} — ${meta.type} — ${meta.rarity}`),
    makeTextChunk('Copyright',   'geocoins.com'),
    makeTextChunk('Source',      `Geocoins card: ${meta.name}`),
  ]
  const totalExtra = chunks.reduce((s, c) => s + c.length, 0)

  // Trouver la fin du chunk IHDR (offset 8 sig + 4 len + 4 type + 13 data + 4 crc = 33)
  const IHDR_END = 33

  // Assembler : signature + IHDR + nos chunks tEXt + reste
  const result = new Uint8Array(pngBytes.length + totalExtra)
  result.set(pngBytes.slice(0, IHDR_END))
  let offset = IHDR_END
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  result.set(pngBytes.slice(IHDR_END), offset)
  return result
}

// ─── Resize + encode via Canvas ──────────────────────────────────────────────
function resizeOnCanvas(img, maxPx, quality) {
  const ratio  = Math.min(maxPx / img.naturalWidth, maxPx / img.naturalHeight, 1)
  const w = Math.round(img.naturalWidth  * ratio)
  const h = Math.round(img.naturalHeight * ratio)

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  canvas.getContext('2d').drawImage(img, 0, 0, w, h)
  return canvas
}

async function canvasToBase64(canvas, targetKb) {
  // Essayer PNG d'abord
  const pngB64  = canvas.toDataURL('image/png')
  const pngSize = Math.round((pngB64.length * 3) / 4 / 1024)

  if (pngSize <= targetKb) return { b64: pngB64, mime: 'image/png', kb: pngSize }

  // Si trop grand → WebP (supporte la transparence contrairement à JPEG)
  let q = 0.85
  let best = canvas.toDataURL('image/webp', q)
  let bestKb = Math.round((best.length * 3) / 4 / 1024)

  while (bestKb > targetKb && q > 0.3) {
    q = Math.max(0.3, q - 0.1)
    best = canvas.toDataURL('image/webp', q)
    bestKb = Math.round((best.length * 3) / 4 / 1024)
  }
  return { b64: best, mime: 'image/webp', kb: bestKb }
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────
/**
 * @param {File|string} source  Fichier ou data-URL
 * @param {{ name, type, rarity }} meta  Métadonnées de la carte
 * @returns {{ medium: string, small: string, info: object }}
 */
export async function processCardImage(source, meta = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = async () => {
      try {
        // ── Version MEDIUM (max 600px, cible 300kb) ──
        const medCanvas = resizeOnCanvas(img, 600, 0.85)
        const { b64: medB64, mime: medMime, kb: medKb } = await canvasToBase64(medCanvas, 300)

        // Injecter métadonnées dans PNG seulement
        let finalMed = medB64
        if (medMime === 'image/png' && meta.name) {
          const resp     = await fetch(medB64)
          const buf      = new Uint8Array(await resp.arrayBuffer())
          const patched  = injectPngTextChunks(buf, meta)
          let binary = ''
          for (let i = 0; i < patched.byteLength; i++) {
            binary += String.fromCharCode(patched[i])
          }
          finalMed = 'data:image/png;base64,' + btoa(binary)
        }

        // ── Version SMALL (max 120px, cible 30kb) ──
        const smCanvas = resizeOnCanvas(img, 120, 0.70)
        const { b64: smB64, mime: smMime, kb: smKb } = await canvasToBase64(smCanvas, 30)

        let finalSm = smB64
        if (smMime === 'image/png' && meta.name) {
          const resp    = await fetch(smB64)
          const buf     = new Uint8Array(await resp.arrayBuffer())
          const patched = injectPngTextChunks(buf, meta)
          let binary = ''
          for (let i = 0; i < patched.byteLength; i++) {
            binary += String.fromCharCode(patched[i])
          }
          finalSm = 'data:image/png;base64,' + btoa(binary)
        }

        resolve({
          medium: finalMed,
          small:  finalSm,
          info: {
            originalSize: { w: img.naturalWidth, h: img.naturalHeight },
            mediumKb: medKb, mediumMime: medMime,
            smallKb:  smKb,  smallMime:  smMime,
          }
        })
      } catch (e) { reject(e) }
    }

    img.onerror = reject
    img.src = typeof source === 'string' ? source : URL.createObjectURL(source)
  })
}
