import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const sourceRects = [
  { x: 0, y: 0, w: 37, h: 15, r: 3.2 },
  { x: 44, y: 0, w: 36, h: 15, r: 3.2 },
  { x: 0, y: 22, w: 15, h: 15, r: 3.2 },
  { x: 22, y: 22, w: 15, h: 15, r: 3.2 },
  { x: 44, y: 22, w: 36, h: 15, r: 3.2 },
  { x: 0, y: 44, w: 37, h: 15, r: 3.2 },
  { x: 44, y: 44, w: 36, h: 15, r: 3.2 },
]

const states = {
  on: [1, 1, 1, 1, 1, 1, 1],
  starting: [0.35, 0.35, 0.35, 1, 0.35, 1, 1],
  off: [0.35, 0.35, 0.35, 0.35, 0.35, 1, 1],
}

const aliases = {
  online: 'on',
  error: 'off',
}

const outDir = new URL('../src-tauri/assets/', import.meta.url)

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  typeBuf.copy(out, 4)
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length)
  return out
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  const row = width * 4
  const raw = Buffer.alloc((row + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (row + 1)] = 0
    rgba.copy(raw, y * (row + 1) + 1, y * row, y * row + row)
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function insideRoundedRect(px, py, rect) {
  const { x, y, w, h, r } = rect
  if (px < x || py < y || px > x + w || py > y + h) return false
  const cx = px < x + r ? x + r : px > x + w - r ? x + w - r : px
  const cy = py < y + r ? y + r : py > y + h - r ? y + h - r : py
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r + 1e-6
}

function render(stateName, scale) {
  const width = 80 * scale
  const height = 59 * scale
  const supersample = 4
  const rgba = Buffer.alloc(width * height * 4)
  const opacities = states[stateName]
  const rects = sourceRects.map((rect, index) => ({
    ...rect,
    x: rect.x * scale,
    y: rect.y * scale,
    w: rect.w * scale,
    h: rect.h * scale,
    r: rect.r * scale,
    alpha: opacities[index],
  }))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let alpha = 0
      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const px = x + (sx + 0.5) / supersample
          const py = y + (sy + 0.5) / supersample
          for (const rect of rects) {
            if (insideRoundedRect(px, py, rect)) {
              alpha += rect.alpha / (supersample * supersample)
              break
            }
          }
        }
      }
      const idx = (y * width + x) * 4
      rgba[idx] = 255
      rgba[idx + 1] = 255
      rgba[idx + 2] = 255
      rgba[idx + 3] = Math.round(Math.min(1, alpha) * 255)
    }
  }

  return encodePng(width, height, rgba)
}

for (const stateName of Object.keys(states)) {
  fs.writeFileSync(path.join(outDir.pathname, `tray_${stateName}.png`), render(stateName, 2))
}

for (const [alias, stateName] of Object.entries(aliases)) {
  fs.writeFileSync(path.join(outDir.pathname, `tray_${alias}.png`), render(stateName, 2))
}
