/**
 * Génère tout le jeu d'icônes de marque depuis UNE source vectorielle :
 * `assets/logo-pin.svg` (jumeau de src/components/Logo.jsx).
 *
 *   node scripts/gen-icons.mjs
 *
 * À lancer À LA MAIN quand le logo change — les sorties sont commitées dans
 * public/. Volontairement hors du build : les icônes ne dépendent d'aucune
 * donnée et n'ont aucune raison d'être régénérées à chaque déploiement.
 *
 * Pourquoi ce script existe : le favicon historique faisait 32×40 (non carré,
 * donc ignoré par Google) et l'og:image était un SVG représentant un emoji —
 * or aucune plateforme sociale n'accepte le SVG. D'où : du PNG carré partout.
 */
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT   = fileURLToPath(new URL('..', import.meta.url))
const PUBLIC = path.join(ROOT, 'public')
const FONT   = path.join(ROOT, 'assets', 'fonts', 'FredokaOne-Regular.ttf')

// Palette de marque (miroir de manifest.json / Logo.jsx)
const BG_FROM = '#0f0c29'
const BG_TO   = '#302b63'
const GOLD    = '#f9ca24'

const PIN_W = 32   // viewBox de assets/logo-pin.svg
const PIN_H = 40

// ─── Source vectorielle ───────────────────────────────────────────────────────
const pinFile = await fs.readFile(path.join(ROOT, 'assets', 'logo-pin.svg'), 'utf8')
// Contenu interne du <svg>, pour pouvoir le replacer dans une autre composition.
const pinInner = pinFile.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()

/**
 * Carré de marque : pin centré, sur fond dégradé ou détouré.
 * @param size    côté en px
 * @param radius  arrondi, en fraction du côté (0 = angles vifs)
 * @param cover   part de la hauteur occupée par le pin (zone de sécurité maskable)
 * @param bg      false = fond transparent (favicons : le pin doit se poser sur la
 *                barre d'onglets, pas y coller une pastille bleue)
 */
function squareSvg(size, { radius = 0.2, cover = 0.74, bg = true } = {}) {
  const pinH  = size * cover
  const scale = pinH / PIN_H
  const pinW  = PIN_W * scale
  const dx    = (size - pinW) / 2
  const dy    = (size - pinH) / 2
  const r     = size * radius
  const plate = bg
    ? `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${BG_FROM}"/><stop offset="100%" stop-color="${BG_TO}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  ${plate}
  <g transform="translate(${dx.toFixed(3)} ${dy.toFixed(3)}) scale(${scale.toFixed(5)})">
${pinInner}
  </g>
</svg>`
}

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

async function write(name, buf) {
  await fs.writeFile(path.join(PUBLIC, name), buf)
  console.log(`✅ public/${name} — ${(buf.length / 1024).toFixed(1)} kB`)
}

// ─── Favicons ─────────────────────────────────────────────────────────────────
// Carrés (exigence de Google pour l'afficher dans ses résultats) mais DÉTOURÉS :
// la pastille bleue se voyait comme un carré posé dans l'onglet. Le pin occupe
// donc presque toute la hauteur, sans marge à réserver.
const FAVICON = { bg: false, cover: 0.94 }
await write('favicon.svg', Buffer.from(squareSvg(48, FAVICON)))
for (const size of [48, 96, 192]) {
  await write(`favicon-${size}.png`, await png(squareSvg(size, FAVICON), size))
}

// ─── PWA + iOS ────────────────────────────────────────────────────────────────
// apple-touch-icon : angles vifs et fond opaque, iOS appliquant son propre masque
// (une icône transparente y ressort sur fond noir).
await write('apple-touch-icon.png', await png(squareSvg(180, { radius: 0 }), 180))
await write('icon-192.png', await png(squareSvg(192), 192))
await write('icon-512.png', await png(squareSvg(512), 512))
// Maskable : le système rogne jusqu'à 20 % de chaque bord, d'où un pin plus petit.
await write('icon-maskable-512.png', await png(squareSvg(512, { radius: 0, cover: 0.56 }), 512))

// ─── Image de partage social (Open Graph / Twitter) ───────────────────────────
const OG_W = 1200
const OG_H = 630

/** Rasterise un texte avec la vraie police de marque (Pango + fichier TTF). */
async function label(text, ptSize, color) {
  return sharp({
    text: {
      text: `<span foreground="${color}">${text}</span>`,
      font: `Fredoka One ${ptSize}`,
      fontfile: FONT,
      rgba: true,
      dpi: 300,
    },
  }).png().toBuffer()
}

const ogBg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${OG_W}" y2="${OG_H}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${BG_FROM}"/><stop offset="100%" stop-color="${BG_TO}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="34%" r="46%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#bg)"/>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#glow)"/>
</svg>`

const OG_PIN_TOP = 70
const OG_PIN_H   = 270
const ogPin = await sharp(Buffer.from(pinFile), { density: 768 })
  .resize({ height: OG_PIN_H })
  .png()
  .toBuffer()

const wordmark = await label('geocoins', 32, GOLD)
const domain   = await label('geocoins.io', 11, '#b9a7ff')

const [pinMeta, wmMeta, dmMeta] = await Promise.all(
  [ogPin, wordmark, domain].map(b => sharp(b).metadata()),
)

// Pile verticale centrée : les recadrages sociaux (jusqu'au 2:1) rognent les bords.
const centered = (buf, meta, top) => ({ input: buf, top, left: Math.round((OG_W - meta.width) / 2) })
const wmTop = OG_PIN_TOP + OG_PIN_H + 24
const dmTop = wmTop + wmMeta.height + 22

// Pas d'option `density` ici : le SVG porte déjà width/height en pixels, et toute
// densité ≠ 72 le redimensionnerait — les positions ci-dessus seraient fausses.
await write('og-image.png', await sharp(Buffer.from(ogBg))
  .composite([
    centered(ogPin,    pinMeta, OG_PIN_TOP),
    centered(wordmark, wmMeta,  wmTop),
    centered(domain,   dmMeta,  dmTop),
  ])
  .png({ compressionLevel: 9 })
  .toBuffer())

console.log('\nTerminé. Pense à committer public/.')
