// Génère icon-192.png et icon-512.png depuis le favicon SVG
// Usage : node scripts/gen-icons.mjs
import { createCanvas } from 'canvas'
import fs from 'fs'
import path from 'path'

const sizes = [192, 512]

for (const size of sizes) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Fond dégradé
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#0f0c29')
  grad.addColorStop(1, '#302b63')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, size * 0.2)
  ctx.fill()

  // Emoji 🗺️
  ctx.font = `${size * 0.55}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🗺️', size / 2, size / 2)

  const buf = canvas.toBuffer('image/png')
  const out = path.join('public', `icon-${size}.png`)
  fs.writeFileSync(out, buf)
  console.log(`✅ ${out} (${buf.length} bytes)`)
}
