/**
 * Render the Nexoria Arc Testnet walkthrough to public/nexoria-demo.mp4.
 *
 *   npm run demo:video
 *
 * Paints the dark Nexoria UI into 1280×720 frames at 30fps and encodes H.264
 * with ffmpeg. Resolution is 720p. Set FFMPEG if the binary is not on PATH
 * and not at ~/.cache/nexoria-demo/ffmpeg.
 *
 *   node scripts/render-demo-video.mjs --at 12.5
 *   node scripts/render-demo-video.mjs --max 2
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'

const W = 1280
const H = 720
const FPS = 30
const FADE = 0.45

const BG = [2, 6, 23, 255]
const CARD = [15, 23, 42, 255]
const INSET = [2, 6, 23, 255]
const WHITE = [248, 250, 252, 255]
const TEXT = [226, 232, 240, 255]
const MUTED = [100, 116, 139, 255]
const FAINT = [148, 163, 184, 255]
const SLATE = [203, 213, 225, 255]
const CYAN = [34, 211, 238, 255]
const CYAN_D = [6, 182, 212, 255]
const INDIGO = [99, 102, 241, 255]
const PURPLE = [168, 85, 247, 255]
const FUCHSIA = [232, 121, 249, 255]
const EMERALD = [52, 211, 153, 255]
const AMBER = [251, 191, 36, 255]
const ROSE = [251, 113, 133, 255]
const ORANGE = [251, 146, 60, 255]
const INK = [2, 6, 23, 255]

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ]
}

const LINE = mix(BG, WHITE, 0.08)
const LINE_CARD = mix(CARD, WHITE, 0.1)
const EMERALD_BG = mix(CARD, [6, 78, 59], 0.55)
const AMBER_BG = mix(CARD, [120, 53, 15], 0.45)
const ROSE_BG = mix(CARD, [136, 19, 55], 0.42)

function makeAddr(prefix, suffix) {
  const zeros = 40 - prefix.length - suffix.length
  if (zeros < 0) throw new Error(`Address is too long: ${prefix}…${suffix}`)
  const hex = `${prefix}${'0'.repeat(zeros)}${suffix}`
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) throw new Error(`Bad address ${hex}`)
  return `0x${hex}`
}

const WALLET = makeAddr('111a8c4e91b2d0f7a6e5', '1a8e')
const WALLET2 = makeAddr('2222b91c0a4e77d1f308', '22c2')
const OFFICE = makeAddr('0ff1ce5e7a9011223344', 'dd11')
const FRESH = makeAddr('9a31c0ffee1234567890', 'b712')
const FREELANCER = makeAddr('a11ce', 'f4e1')
const SPENDER = makeAddr('94a2b1d0', 'c317')
const MEMO_CONTRACT = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505'
if (!/^0x[0-9a-fA-F]{40}$/.test(MEMO_CONTRACT)) throw new Error('Memo contract address is not 20 bytes')

function short(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

const fonts = loadFonts()

function loadFonts() {
  const pick = (paths) => {
    for (const path of paths) {
      if (existsSync(path)) return opentype.parse(readFileSync(path))
    }
    throw new Error(`Missing a font. Looked in ${paths.join(', ')}`)
  }
  const loaded = {
    regular: pick(['/system/fonts/SourceSansPro-Regular.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']),
    semi: pick(['/system/fonts/SourceSansPro-SemiBold.ttf', '/system/fonts/SourceSansPro-Bold.ttf']),
    bold: pick(['/system/fonts/SourceSansPro-Bold.ttf', '/system/fonts/DroidSans-Bold.ttf']),
    mono: pick(['/system/fonts/DroidSansMono.ttf', '/system/fonts/CutiveMono.ttf']),
  }
  let id = 1
  for (const font of Object.values(loaded)) font.__id = id++
  return loaded
}

const glyphCache = new Map()

function flatten(path, steps) {
  const contours = []
  let current = null
  let sx = 0
  let sy = 0
  let cx = 0
  let cy = 0
  for (const cmd of path.commands) {
    if (cmd.type === 'M') {
      if (current && current.length > 1) contours.push(current)
      current = [[cmd.x, cmd.y]]
      sx = cmd.x
      sy = cmd.y
      cx = sx
      cy = sy
    } else if (cmd.type === 'L') {
      current.push([cmd.x, cmd.y])
      cx = cmd.x
      cy = cmd.y
    } else if (cmd.type === 'Q' || cmd.type === 'C') {
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps
        const u = 1 - t
        if (cmd.type === 'Q') {
          current.push([
            u * u * cx + 2 * u * t * cmd.x1 + t * t * cmd.x,
            u * u * cy + 2 * u * t * cmd.y1 + t * t * cmd.y,
          ])
        } else {
          current.push([
            u * u * u * cx + 3 * u * u * t * cmd.x1 + 3 * u * t * t * cmd.x2 + t * t * t * cmd.x,
            u * u * u * cy + 3 * u * u * t * cmd.y1 + 3 * u * t * t * cmd.y2 + t * t * t * cmd.y,
          ])
        }
      }
      cx = cmd.x
      cy = cmd.y
    } else if (cmd.type === 'Z') {
      if (cx !== sx || cy !== sy) current.push([sx, sy])
      cx = sx
      cy = sy
    }
  }
  if (current && current.length > 1) contours.push(current)
  return contours
}

function rasterGlyph(font, ch, size) {
  const advance = font.getAdvanceWidth(ch, size)
  if (ch === ' ' || !font.hasChar(ch)) return { alpha: null, w: 0, h: 0, ox: 0, oy: 0, advance }
  const path = font.getPath(ch, 0, 0, size)
  const box = path.getBoundingBox()
  if (!Number.isFinite(box.x1) || box.x2 <= box.x1 || box.y2 <= box.y1) {
    return { alpha: null, w: 0, h: 0, ox: 0, oy: 0, advance }
  }
  const pad = 1
  const x0 = Math.floor(box.x1) - pad
  const y0 = Math.floor(box.y1) - pad
  const w = Math.max(1, Math.ceil(box.x2) + pad - x0)
  const h = Math.max(1, Math.ceil(box.y2) + pad - y0)
  if (w > 500 || h > 500) return { alpha: null, w: 0, h: 0, ox: 0, oy: 0, advance }
  const steps = Math.max(6, Math.ceil(size / 3))
  const contours = flatten(path, steps)
  const ss = 3
  const sw = w * ss
  const sh = h * ss
  const mask = new Uint8Array(sw * sh)
  for (let sy = 0; sy < sh; sy += 1) {
    const gy = y0 + (sy + 0.5) / ss
    const hits = []
    for (const contour of contours) {
      for (let i = 0; i < contour.length - 1; i += 1) {
        const yA = contour[i][1]
        const yB = contour[i + 1][1]
        if (yA === yB) continue
        if (gy < Math.min(yA, yB) || gy >= Math.max(yA, yB)) continue
        const xA = contour[i][0]
        const xB = contour[i + 1][0]
        hits.push({ x: xA + ((gy - yA) * (xB - xA)) / (yB - yA), dir: yB > yA ? 1 : -1 })
      }
    }
    if (hits.length === 0) continue
    hits.sort((a, b) => a.x - b.x || a.dir - b.dir)
    let wind = 0
    let from = 0
    for (const hit of hits) {
      const x = (hit.x - x0) * ss
      if (wind !== 0) {
        const start = Math.max(0, Math.floor(Math.min(from, x)))
        const end = Math.min(sw, Math.ceil(Math.max(from, x)))
        for (let sx = start; sx < end; sx += 1) mask[sy * sw + sx] = 1
      }
      wind += hit.dir
      from = x
    }
  }
  const alpha = new Uint8Array(w * h)
  const samples = ss * ss
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let covered = 0
      const origin = (y * ss) * sw + x * ss
      for (let dy = 0; dy < ss; dy += 1) {
        const row = origin + dy * sw
        for (let dx = 0; dx < ss; dx += 1) covered += mask[row + dx]
      }
      alpha[y * w + x] = Math.round((covered * 255) / samples)
    }
  }
  return { alpha, w, h, ox: x0, oy: y0, advance }
}

function glyphOf(font, ch, size) {
  const key = `${font.__id}:${size}:${ch}`
  let glyph = glyphCache.get(key)
  if (!glyph) {
    const face = font.hasChar(ch) ? font : fonts.regular
    glyph = rasterGlyph(face, ch, size)
    if (!font.hasChar(ch)) glyph = { ...glyph, advance: font.getAdvanceWidth('0', size) || size * 0.6 }
    glyphCache.set(key, glyph)
  }
  return glyph
}

function measure(font, size, text, tracking = 0) {
  let width = 0
  for (let i = 0; i < text.length; i += 1) {
    width += glyphOf(font, text[i], size).advance + (i === text.length - 1 ? 0 : tracking)
  }
  return width
}

class Canvas {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.data = Buffer.alloc(w * h * 4)
    this.u32 = new Uint32Array(this.data.buffer, this.data.byteOffset, w * h)
  }

  clear(color) {
    this.fillRect(0, 0, this.w, this.h, color)
  }

  fillRect(x, y, w, h, color) {
    let x0 = Math.round(x)
    let y0 = Math.round(y)
    let x1 = Math.round(x + w)
    let y1 = Math.round(y + h)
    if (x0 < 0) x0 = 0
    if (y0 < 0) y0 = 0
    if (x1 > this.w) x1 = this.w
    if (y1 > this.h) y1 = this.h
    if (x1 <= x0 || y1 <= y0) return
    const width = x1 - x0
    const alpha = color[3]
    if (alpha >= 255) {
      const pixel = (255 << 24) | (color[2] << 16) | (color[1] << 8) | color[0]
      const start = y0 * this.w + x0
      for (let i = 0; i < width; i += 1) this.u32[start + i] = pixel
      for (let row = 1; row < y1 - y0; row += 1) {
        this.u32.copyWithin(start + row * this.w, start, start + width)
      }
      return
    }
    const sa = alpha / 255
    const inv = 1 - sa
    for (let yy = y0; yy < y1; yy += 1) {
      let index = (yy * this.w + x0) * 4
      for (let i = 0; i < width; i += 1) {
        this.data[index] = color[0] * sa + this.data[index] * inv
        this.data[index + 1] = color[1] * sa + this.data[index + 1] * inv
        this.data[index + 2] = color[2] * sa + this.data[index + 2] * inv
        this.data[index + 3] = 255
        index += 4
      }
    }
  }

  blendAt(x, y, color, coverage) {
    if (coverage <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const sa = Math.max(0, Math.min(255, Math.round(coverage * color[3])))
    if (sa <= 0) return
    const index = (y * this.w + x) * 4
    const inv = 255 - sa
    this.data[index] = (color[0] * sa + this.data[index] * inv) / 255
    this.data[index + 1] = (color[1] * sa + this.data[index + 1] * inv) / 255
    this.data[index + 2] = (color[2] * sa + this.data[index + 2] * inv) / 255
    this.data[index + 3] = 255
  }

  rrect(x, y, w, h, radius, fill, stroke) {
    const x0 = Math.round(x)
    const y0 = Math.round(y)
    const width = Math.round(w)
    const height = Math.round(h)
    if (width <= 0 || height <= 0) return
    if (stroke) this.roundFill(x0 - 1, y0 - 1, width + 2, height + 2, radius + 1, stroke)
    if (fill) this.roundFill(x0, y0, width, height, radius, fill)
  }

  roundFill(x, y, w, h, radius, color) {
    const r = Math.max(0, Math.min(radius, Math.floor(w / 2), Math.floor(h / 2)))
    if (r <= 0) {
      this.fillRect(x, y, w, h, color)
      return
    }
    this.fillRect(x + r, y, w - 2 * r, h, color)
    this.fillRect(x, y + r, r, h - 2 * r, color)
    this.fillRect(x + w - r, y + r, r, h - 2 * r, color)
    this.corner(x + r, y + r, r, 0, color)
    this.corner(x + w - r, y + r, r, 1, color)
    this.corner(x + w - r, y + h - r, r, 2, color)
    this.corner(x + r, y + h - r, r, 3, color)
  }

  corner(cx, cy, r, quad, color) {
    const x0 = quad === 1 || quad === 2 ? Math.floor(cx) : Math.floor(cx - r)
    const y0 = quad === 2 || quad === 3 ? Math.floor(cy) : Math.floor(cy - r)
    const x1 = quad === 1 || quad === 2 ? Math.ceil(cx + r) : Math.ceil(cx)
    const y1 = quad === 2 || quad === 3 ? Math.ceil(cy + r) : Math.ceil(cy)
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        let coverage = 0
        if (distance <= r - 0.75) coverage = 1
        else if (distance < r + 0.75) coverage = (r + 0.75 - distance) / 1.5
        if (coverage > 0) this.blendAt(x, y, color, coverage)
      }
    }
  }

  circle(cx, cy, r, color) {
    const x0 = Math.floor(cx - r)
    const y0 = Math.floor(cy - r)
    const x1 = Math.ceil(cx + r)
    const y1 = Math.ceil(cy + r)
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        let coverage = 0
        if (distance <= r - 0.8) coverage = 1
        else if (distance < r + 0.8) coverage = (r + 0.8 - distance) / 1.6
        if (coverage > 0) this.blendAt(x, y, color, coverage)
      }
    }
  }

  ring(cx, cy, r, thickness, color, hole) {
    this.circle(cx, cy, r, color)
    this.circle(cx, cy, Math.max(0, r - thickness), hole)
  }

  text(value, x, y, { font = fonts.regular, size = 16, color = TEXT, align = 'left', tracking = 0 } = {}) {
    const text = String(value)
    const width = measure(font, size, text, tracking)
    let pen = x
    if (align === 'center') pen = x - width / 2
    else if (align === 'right') pen = x - width
    const baseline = y + size * 0.8
    for (let i = 0; i < text.length; i += 1) {
      const glyph = glyphOf(font, text[i], size)
      if (glyph.alpha) this.blit(glyph, Math.round(pen), baseline, color)
      pen += glyph.advance + (i === text.length - 1 ? 0 : tracking)
    }
    return width
  }

  blit(glyph, pen, baseline, color) {
    const dx = pen + glyph.ox
    const dy = Math.round(baseline + glyph.oy)
    const alpha = glyph.alpha
    const ca = color[3] ?? 255
    for (let y = 0; y < glyph.h; y += 1) {
      const py = dy + y
      if (py < 0 || py >= this.h) continue
      for (let x = 0; x < glyph.w; x += 1) {
        const px = dx + x
        if (px < 0 || px >= this.w) continue
        const coverage = alpha[y * glyph.w + x]
        if (!coverage) continue
        const sa = Math.round((coverage * ca) / 255)
        if (sa <= 0) continue
        const index = (py * this.w + px) * 4
        const inv = 255 - sa
        this.data[index] = (color[0] * sa + this.data[index] * inv) / 255
        this.data[index + 1] = (color[1] * sa + this.data[index + 1] * inv) / 255
        this.data[index + 2] = (color[2] * sa + this.data[index + 2] * inv) / 255
        this.data[index + 3] = 255
      }
    }
  }

  blend(other, amount) {
    const a = Math.max(0, Math.min(1, amount))
    const b = 1 - a
    const dst = this.data
    const src = other.data
    for (let i = 0; i < dst.length; i += 4) {
      dst[i] = dst[i] * b + src[i] * a
      dst[i + 1] = dst[i + 1] * b + src[i + 1] * a
      dst[i + 2] = dst[i + 2] * b + src[i + 2] * a
    }
  }
}

function fillPoly(c, points, color) {
  if (points.length < 3) return
  let minY = Infinity
  let maxY = -Infinity
  for (const [, y] of points) {
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const closed = points.concat([points[0]])
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += 1) {
    const gy = y + 0.5
    const xs = []
    for (let i = 0; i < closed.length - 1; i += 1) {
      const [x1, y1] = closed[i]
      const [x2, y2] = closed[i + 1]
      if (y1 === y2 || gy < Math.min(y1, y2) || gy >= Math.max(y1, y2)) continue
      xs.push(x1 + ((gy - y1) * (x2 - x1)) / (y2 - y1))
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.ceil(xs[i])
      const x1 = Math.floor(xs[i + 1])
      if (x1 >= x0) c.fillRect(x0, y, x1 - x0 + 1, 1, color)
    }
  }
}

function icon(c, name, x, y, color, hole) {
  if (name === 'arrow') {
    c.fillRect(x, y + 7, 10, 2, color)
    fillPoly(c, [[x + 8, y + 3], [x + 15, y + 8], [x + 8, y + 13]], color)
  } else if (name === 'users') {
    c.circle(x + 6, y + 6, 3, color)
    c.circle(x + 11, y + 7, 2.4, color)
    c.rrect(x + 2, y + 11, 8, 4, 2, color)
    c.rrect(x + 9, y + 12, 6, 3, 2, color)
  } else if (name === 'clock') {
    c.ring(x + 8, y + 8, 7, 1.6, color, hole)
    c.fillRect(x + 7, y + 4, 1.6, 5, color)
    c.fillRect(x + 8, y + 7, 4, 1.6, color)
  } else if (name === 'memo') {
    c.rrect(x + 1, y + 2, 13, 9, 2, color)
    fillPoly(c, [[x + 4, y + 10], [x + 8, y + 10], [x + 5, y + 14]], color)
  } else if (name === 'gear') {
    c.ring(x + 8, y + 8, 6.5, 2.2, color, hole)
    c.circle(x + 8, y + 8, 1.6, color)
  } else if (name === 'zap') {
    fillPoly(c, [[x + 9, y], [x + 3, y + 9], [x + 8, y + 9], [x + 6, y + 16], [x + 13, y + 6], [x + 8, y + 6]], color)
  } else if (name === 'drop') {
    fillPoly(c, [[x + 6, y], [x + 1, y + 8], [x + 6, y + 13], [x + 11, y + 8]], color)
  }
}

let frameTime = 0

function pulse() {
  return 0.55 + 0.45 * Math.sin(frameTime * 6)
}

function ease(t) {
  const p = Math.max(0, Math.min(1, t))
  return 1 - (1 - p) ** 3
}

function money(value, places = 6) {
  return value.toFixed(places)
}

function phaseAt(t, parts) {
  let cursor = 0
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]
    if (t < cursor + part.dur || i === parts.length - 1) {
      const local = Math.max(0, Math.min(part.dur, t - cursor))
      return { id: part.id, local, p: part.dur === 0 ? 1 : local / part.dur }
    }
    cursor += part.dur
  }
  return { id: parts[0].id, local: 0, p: 0 }
}

function logo(c, x, y) {
  c.rrect(x, y, 28, 28, 8, mix(BG, CYAN_D, 0.25), CYAN)
  c.rrect(x + 8, y + 8, 12, 12, 3, CYAN)
  c.fillRect(x + 11, y + 11, 6, 2, INK)
  c.fillRect(x + 13, y + 11, 2, 6, INK)
}

function header(c) {
  c.fillRect(0, 0, W, 64, BG)
  c.fillRect(0, 63, W, 1, LINE)
  logo(c, 24, 18)
  c.text('NEXORIA', 64, 22, { font: fonts.bold, size: 18, color: WHITE, tracking: 2.4 })
  const networkW = measure(fonts.mono, 12, 'Arc Testnet') + 22
  c.rrect(196, 18, networkW, 28, 14, INSET, mix(BG, CYAN, 0.45))
  c.text('Arc Testnet', 207, 24, { font: fonts.mono, size: 12, color: CYAN })
  c.text('5042002', 196 + networkW + 12, 24, { font: fonts.mono, size: 12, color: FAINT })
  c.text('rpc.testnet.arc.io', 196 + networkW + 92, 24, { font: fonts.mono, size: 12, color: MUTED })

  const walletLabel = short(WALLET)
  const walletW = measure(fonts.mono, 14, walletLabel) + 28
  const downloadLabel = 'Download Demo Video'
  const downloadW = measure(fonts.semi, 12, downloadLabel) + 28
  const right = W - 24
  c.rrect(right - walletW, 16, walletW, 32, 10, INSET, mix(BG, CYAN, 0.45))
  c.text(walletLabel, right - walletW + 14, 24, { font: fonts.mono, size: 14, color: CYAN })
  const downloadX = right - walletW - 12 - downloadW
  c.rrect(downloadX, 16, downloadW, 32, 10, INSET, LINE)
  c.text(downloadLabel, downloadX + 14, 24, { font: fonts.semi, size: 12, color: SLATE })
}

function sceneLabel(c, label) {
  c.text(label, 28, 686, { font: fonts.mono, size: 12, color: MUTED, tracking: 0.8 })
  c.text('ARC TESTNET', W - 28, 686, { font: fonts.mono, size: 12, color: MUTED, align: 'right', tracking: 0.8 })
}

function progress(c, time, total) {
  c.fillRect(0, H - 4, W, 4, [8, 15, 32, 255])
  c.fillRect(0, H - 4, Math.max(0, Math.round((W * time) / total)), 4, CYAN)
}

function moduleButton(c, x, y, title, subtitle, name, active, accent) {
  const hole = active ? CARD : [10, 16, 30, 255]
  c.rrect(x, y, 300, 58, 12, hole, active ? accent : LINE)
  c.rrect(x + 12, y + 14, 30, 30, 8, mix(hole, accent, active ? 0.22 : 0.1))
  icon(c, name, x + 19, y + 21, active ? accent : FAINT, mix(hole, accent, active ? 0.22 : 0.1))
  c.text(title, x + 54, y + 10, { font: fonts.semi, size: 15, color: active ? WHITE : SLATE })
  c.text(subtitle, x + 54, y + 30, { font: fonts.mono, size: 10, color: MUTED, tracking: 0.6 })
}

function shell(c, active, label) {
  c.clear(BG)
  header(c)
  c.text('COMMAND MODULES', 28, 78, { font: fonts.mono, size: 11, color: MUTED, tracking: 1.4 })
  const items = [
    ['payments', 'Batch payments', 'USDC AND EURC', 'arrow', CYAN],
    ['payroll', 'Payroll', 'ONE BATCH TRANSFER', 'users', INDIGO],
    ['schedule', 'Scheduled payments', 'SIGN WHEN DUE', 'clock', ORANGE],
    ['memo', 'On-chain memo', 'PUBLIC MESSAGE', 'memo', FUCHSIA],
    ['utilities', 'Utilities', 'LEDGER, CONTACTS, ALLOWANCE', 'gear', PURPLE],
  ]
  items.forEach((item, index) => {
    moduleButton(c, 28, 100 + index * 66, item[1], item[2], item[3], item[0] === active, item[4])
  })
  c.rrect(28, 438, 300, 228, 16, CARD, LINE_CARD)
  c.text('CONNECTED', 46, 454, { font: fonts.mono, size: 11, color: CYAN, tracking: 1.2 })
  c.text(short(WALLET), 46, 474, { font: fonts.mono, size: 16, color: WHITE })
  stat(c, 46, 514, 264, 'USDC', '220.633194', CYAN)
  stat(c, 46, 546, 264, 'EURC', '144.101897', FUCHSIA)
  c.fillRect(46, 584, 264, 1, LINE_CARD)
  c.text('Fee ceiling, 65,000 gas', 46, 596, { font: fonts.mono, size: 11, color: MUTED })
  c.text('0.002925 USDC', 46, 616, { font: fonts.mono, size: 16, color: WHITE })
  sceneLabel(c, label)
}

function stat(c, x, y, w, label, value, color) {
  c.text(label, x, y, { font: fonts.mono, size: 13, color })
  c.text(value, x + w, y, { font: fonts.mono, size: 13, color: WHITE, align: 'right' })
}

function field(c, x, y, w, label, value, hot = false) {
  c.text(label, x, y, { font: fonts.mono, size: 11, color: MUTED, tracking: 0.4 })
  c.rrect(x, y + 16, w, 40, 8, INSET, hot ? CYAN : LINE_CARD)
  c.text(value, x + 12, y + 26, { font: fonts.mono, size: 15, color: WHITE })
}

function button(c, x, y, w, h, label, bg, fg, hot = false, size = 15) {
  const stroke = hot ? mix(bg, WHITE, 0.2 + 0.45 * pulse()) : null
  c.rrect(x, y, w, h, 10, bg, stroke)
  c.text(label, x + w / 2, y + Math.max(0, (h - size) / 2) - 1, { font: fonts.semi, size, color: fg, align: 'center' })
}

function wrapText(c, value, x, y, maxWidth, opt, lineHeight) {
  const words = String(value).split(' ')
  let line = ''
  let cursor = y
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(opt.font || fonts.regular, opt.size || 16, next, opt.tracking || 0) > maxWidth) {
      c.text(line, x, cursor, opt)
      cursor += lineHeight
      line = word
    } else {
      line = next
    }
  }
  if (line) c.text(line, x, cursor, opt)
  return cursor
}

function terminal(c, x, y, w, h, lines) {
  c.rrect(x, y, w, h, 16, [0, 0, 0, 255], mix(BG, CYAN, 0.35))
  c.rrect(x + 1, y + 1, w - 2, 28, 12, [15, 23, 42, 255])
  c.fillRect(x + 1, y + 21, w - 2, 8, [15, 23, 42, 255])
  c.text('SYSTEM TERMINAL', x + 16, y + 8, { font: fonts.mono, size: 11, color: FAINT, tracking: 1.1 })
  const visible = lines.slice(-Math.max(1, Math.floor((h - 44) / 20)))
  visible.forEach((line, index) => {
    const color = line.kind === 'success' ? EMERALD : line.kind === 'process' ? CYAN : line.kind === 'warn' ? AMBER : SLATE
    c.text(`[${line.time}]  ${line.text}`, x + 16, y + 40 + index * 20, { font: fonts.mono, size: 13, color })
  })
}

function guardCard(c, x, y, w, level, withAction) {
  const palette = {
    known: { bg: EMERALD_BG, fg: EMERALD, dot: EMERALD, title: 'Known standard wallet', body: 'This address is a wallet and it is already in your ledger.' },
    fresh: { bg: AMBER_BG, fg: AMBER, dot: AMBER, title: 'New standard wallet', body: 'First-time interaction. This address is a wallet and it is not in your ledger.' },
    contract: { bg: ROSE_BG, fg: ROSE, dot: ROSE, title: 'Smart contract address', body: 'Sending tokens directly to a contract can lose them if the contract cannot receive that token.' },
    check: { bg: mix(CARD, CYAN_D, 0.18), fg: CYAN, dot: CYAN, title: 'Checking recipient…', body: 'Send Guard is reading bytecode and the local ledger.' },
  }[level]
  const height = withAction ? 150 : 108
  c.rrect(x, y, w, height, 12, palette.bg, palette.fg)
  c.circle(x + 18, y + 20, 5, palette.dot)
  c.text('SEND GUARD', x + 32, y + 12, { font: fonts.mono, size: 11, color: FAINT, tracking: 1.2 })
  c.text(palette.title, x + 16, y + 34, { font: fonts.semi, size: 16, color: palette.fg })
  wrapText(c, palette.body, x + 16, y + 58, w - 32, { font: fonts.regular, size: 13, color: SLATE }, 18)
  return { ...palette, height }
}

function drawTelemetry(c, t) {
  c.clear(BG)
  header(c)
  c.rrect(24, 84, 1232, 448, 18, CARD, LINE)
  c.text('USDC BALANCE', 52, 108, { font: fonts.mono, size: 12, color: CYAN, tracking: 1.6 })
  icon(c, 'zap', 168, 110, CYAN, CARD)
  c.text('Asset telemetry', 52, 132, { font: fonts.bold, size: 40, color: WHITE })
  c.text('Live balances on Arc Testnet. Transfers use 6-decimal USDC and EURC.', 52, 186, { font: fonts.regular, size: 16, color: FAINT })
  c.text('Gas is reserved from the same USDC balance, with a 20 gwei fee floor.', 52, 210, { font: fonts.regular, size: 16, color: FAINT })

  const shownUsdc = 220.633194 * ease(t / 1.15)
  const shownEurc = 144.101897 * ease(t / 1.15)
  c.rrect(760, 112, 460, 236, 14, INSET, LINE_CARD)
  c.circle(784, 140, 5, t > 0.2 ? EMERALD : MUTED)
  c.text('LIVE', 796, 130, { font: fonts.mono, size: 12, color: EMERALD, tracking: 1 })
  stat(c, 784, 168, 412, 'USDC', money(shownUsdc), CYAN)
  stat(c, 784, 204, 412, 'EURC', money(shownEurc), FUCHSIA)
  c.fillRect(784, 246, 412, 1, LINE_CARD)
  c.text('Fee ceiling, 65,000 gas', 784, 262, { font: fonts.mono, size: 13, color: MUTED })
  c.text('0.002925 USDC', 784, 286, { font: fonts.mono, size: 22, color: WHITE })

  const chips = [
    ['Chain ID 5042002', false],
    ['rpc.testnet.arc.io', false],
    ['Testnet faucet', true],
  ]
  let chipX = 52
  for (const [label, hot] of chips) {
    const width = measure(fonts.semi, 14, label) + (hot ? 36 : 28)
    c.rrect(chipX, 258, width, 36, 10, hot ? mix(CARD, CYAN_D, 0.2) : INSET, hot ? CYAN : LINE_CARD)
    if (hot) icon(c, 'drop', chipX + 12, 269, CYAN, mix(CARD, CYAN_D, 0.2))
    c.text(label, chipX + (hot ? 28 : 14), 266, { font: fonts.semi, size: 14, color: hot ? CYAN : SLATE })
    chipX += width + 10
  }
  c.text(`Wallet ${short(WALLET)}  ·  chain 5042002  ·  USDC pays gas`, 52, 312, { font: fonts.mono, size: 13, color: MUTED })

  c.text('COMMAND MODULES', 52, 360, { font: fonts.mono, size: 11, color: MUTED, tracking: 1.2 })
  const mods = [
    ['Batch payments', 'USDC AND EURC', CYAN],
    ['Payroll', 'ONE BATCH', INDIGO],
    ['Scheduled', 'SIGN WHEN DUE', ORANGE],
    ['On-chain memo', 'PUBLIC MESSAGE', FUCHSIA],
  ]
  mods.forEach((item, index) => {
    const x = 52 + index * 292
    c.rrect(x, 382, 278, 64, 12, INSET, LINE_CARD)
    c.text(item[0], x + 16, 394, { font: fonts.semi, size: 15, color: WHITE })
    c.text(item[1], x + 16, 416, { font: fonts.mono, size: 11, color: item[2], tracking: 0.6 })
  })

  terminal(c, 24, 548, 1232, 124, [
    { time: '18:03:58', text: 'Wallet connected.', kind: 'success' },
    { time: '18:03:58', text: 'Arc Testnet · chain 5042002 · rpc.testnet.arc.io', kind: 'process' },
    { time: '18:03:59', text: 'USDC 220.633194 · EURC 144.101897', kind: 'info' },
    { time: '18:03:59', text: 'Fee ceiling, 65,000 gas = 0.002925 USDC', kind: 'info' },
  ].slice(0, 1 + Math.min(3, Math.floor(t / 0.35))))
  sceneLabel(c, '01    ASSET TELEMETRY')
}

function drawPayments(c, t) {
  const phase = phaseAt(t, [
    { id: 'pick', dur: 2.5 },
    { id: 'green', dur: 2.7 },
    { id: 'yellow', dur: 2.9 },
    { id: 'red', dur: 2.85 },
    { id: 'confirm', dur: 2.8 },
  ])
  shell(c, 'payments', '02    BATCH PAYMENTS  ·  SEND GUARD')
  c.rrect(348, 80, 908, 444, 18, CARD, LINE)
  c.text('Batch payments', 372, 98, { font: fonts.bold, size: 24, color: WHITE })
  c.text('Enter the recipient and the amount. Send Guard checks the address before the transfer.', 372, 132, { font: fonts.regular, size: 14, color: FAINT })

  const recipient = {
    pick: 'wallet 2',
    green: WALLET2,
    yellow: FRESH,
    red: MEMO_CONTRACT,
    confirm: WALLET2,
  }[phase.id]
  const amount = phase.id === 'confirm' ? '2' : phase.id === 'pick' ? '' : '2'
  field(c, 372, 164, 640, 'Recipient address', recipient, phase.id === 'pick')
  button(c, 1024, 180, 200, 40, 'Select contact', mix(CARD, PURPLE, 0.15), [216, 180, 254, 255], phase.id === 'pick')
  if (phase.id !== 'pick') {
    const name = phase.id === 'yellow' ? 'Unsaved address' : phase.id === 'red' ? 'Memo contract' : 'wallet 2'
    c.text(name, 372, 222, { font: fonts.mono, size: 12, color: MUTED })
  }
  field(c, 372, 242, 852, 'Amount', amount || '0.00', phase.id === 'confirm')

  const needsAck = (phase.id === 'yellow' || phase.id === 'red') && phase.local >= 0.35
  if (phase.id === 'pick') {
    c.rrect(372, 300, 852, 132, 12, INSET, LINE_CARD)
    const rows = [
      ['wallet 2', WALLET2, true],
      ['Office Rent', OFFICE, false],
    ]
    rows.forEach((row, index) => {
      const y = 312 + index * 56
      if (row[2]) c.rrect(384, y - 6, 828, 50, 8, mix(INSET, CYAN_D, 0.16), CYAN)
      c.text(row[0], 400, y, { font: fonts.semi, size: 15, color: WHITE })
      c.text(row[1], 400, y + 20, { font: fonts.mono, size: 12, color: MUTED })
    })
  } else {
    const level = { green: 'known', yellow: 'fresh', red: 'contract', confirm: 'known' }[phase.id]
    const shown = phase.local < 0.35 && phase.id !== 'confirm' ? 'check' : level
    const palette = guardCard(c, 372, 300, 852, shown, needsAck)
    if (needsAck) {
      const bg = phase.id === 'red' ? ROSE : AMBER
      const fg = phase.id === 'red' ? WHITE : INK
      button(c, 388, 300 + palette.height - 44, 820, 32, 'Acknowledge & Proceed', bg, fg, true, 14)
    }
  }

  const canSend = phase.id === 'green' || phase.id === 'confirm'
  button(c, 372, 468, 414, 40, 'Send USDC', canSend ? CYAN_D : mix(CARD, CYAN_D, 0.35), canSend ? INK : mix(INK, CYAN, 0.4), phase.id === 'confirm')
  button(c, 810, 468, 414, 40, 'Send EURC', canSend ? INDIGO : mix(CARD, INDIGO, 0.35), canSend ? WHITE : mix(WHITE, INDIGO, 0.45), false)

  const logs = [
    { time: '18:04:01', text: 'Wallet connected.', kind: 'success' },
    { time: '18:04:06', text: 'Contact selected · wallet 2.', kind: 'info' },
  ]
  if (phase.id === 'green' || phase.id === 'yellow' || phase.id === 'red' || phase.id === 'confirm') {
    logs.push({ time: '18:04:08', text: 'Send Guard · known standard wallet.', kind: 'success' })
  }
  if (phase.id === 'yellow' || phase.id === 'red' || phase.id === 'confirm') {
    logs.push({ time: '18:04:11', text: 'Send Guard · new standard wallet. Acknowledge & Proceed.', kind: 'warn' })
  }
  if (phase.id === 'red' || phase.id === 'confirm') {
    logs.push({ time: '18:04:14', text: 'Send Guard · smart contract address.', kind: 'warn' })
  }
  if (phase.id === 'confirm' && phase.local > 0.35) {
    logs.push({ time: '18:04:18', text: 'USDC payment confirmed. Gas ceiling 0.002925 USDC.', kind: 'success' })
  }
  terminal(c, 348, 536, 908, 136, logs)
}

function drawPayroll(c, t) {
  const phase = phaseAt(t, [
    { id: 'upload', dur: 2.4 },
    { id: 'loaded', dur: 3.35 },
    { id: 'sent', dur: 3.4 },
  ])
  shell(c, 'payroll', '03    PAYROLL  ·  CSV BULK UPLOAD')
  c.rrect(348, 80, 908, 444, 18, CARD, LINE)
  c.text('Payroll', 372, 96, { font: fonts.bold, size: 24, color: WHITE })
  field(c, 372, 136, 410, 'AMOUNT WHEN A LINE OMITS ONE', '2', false)
  field(c, 800, 136, 424, 'ASSET', 'USDC', false)
  c.text('RECIPIENTS', 372, 204, { font: fonts.mono, size: 11, color: MUTED, tracking: 0.8 })
  button(c, 1040, 196, 184, 28, 'Select contact', mix(CARD, PURPLE, 0.16), [216, 180, 254, 255], phase.id !== 'upload')

  const tools = [
    ['Upload CSV', phase.id === 'upload'],
    ['Download sample CSV', false],
  ]
  let toolX = 372
  for (const [label, hot] of tools) {
    const width = measure(fonts.semi, 13, label) + 24
    c.rrect(toolX, 230, width, 30, 8, hot ? mix(CARD, PURPLE, 0.2) : INSET, hot ? PURPLE : LINE_CARD)
    c.text(label, toolX + 12, 236, { font: fonts.semi, size: 13, color: hot ? [216, 180, 254, 255] : SLATE })
    toolX += width + 8
  }

  if (phase.id === 'upload') {
    c.text('Each row needs an address or an exact contact name, then an amount.', 372, 272, { font: fonts.regular, size: 13, color: FAINT })
    c.rrect(372, 298, 852, 150, 10, INSET, LINE_CARD)
    c.text('address,amount', 388, 314, { font: fonts.mono, size: 14, color: MUTED })
    c.text('Office Rent,25.5', 388, 338, { font: fonts.mono, size: 14, color: FAINT })
    c.text('wallet 2,2', 388, 362, { font: fonts.mono, size: 14, color: FAINT })
  } else {
    c.rrect(372, 270, 852, 36, 8, EMERALD_BG, EMERALD)
    c.text('3 recipients loaded from the CSV. Review the list, then send payroll.', 386, 278, { font: fonts.regular, size: 13, color: EMERALD })
    c.rrect(372, 316, 852, 112, 10, INSET, LINE_CARD)
    const rows = [
      ['Office Rent', OFFICE, '25.500000'],
      ['wallet 2', WALLET2, '2.000000'],
      ['Freelancer', FREELANCER, '15.000000'],
    ]
    rows.forEach((row, index) => {
      const y = 324 + index * 34
      c.text(row[0], 388, y, { font: fonts.semi, size: 14, color: WHITE })
      c.text(short(row[1]), 560, y, { font: fonts.mono, size: 13, color: MUTED })
      c.text(`${row[2]} USDC`, 1180, y, { font: fonts.mono, size: 13, color: CYAN, align: 'right' })
    })
    c.text('3 recipients, 42.500000 USDC', 372, 438, { font: fonts.mono, size: 13, color: FAINT })
  }
  button(c, 372, 468, 852, 42, 'Send payroll', phase.id === 'sent' ? INDIGO : mix(CARD, INDIGO, 0.45), WHITE, phase.id === 'sent')

  const logs = [{ time: '18:05:01', text: 'Payroll module open.', kind: 'info' }]
  if (phase.id !== 'upload') logs.push({ time: '18:05:04', text: 'Loaded 3 payroll recipients from CSV.', kind: 'process' })
  if (phase.id === 'loaded' || phase.id === 'sent') logs.push({ time: '18:05:05', text: 'Contact wallet 2 is on the list.', kind: 'info' })
  if (phase.id === 'sent') logs.push({ time: '18:05:08', text: 'Payroll confirmed. Gas ceiling 0.002925 USDC.', kind: 'success' })
  terminal(c, 348, 536, 908, 136, logs)
}

function drawSchedule(c, t) {
  const phase = phaseAt(t, [
    { id: 'schedule', dur: 4.55 },
    { id: 'memo', dur: 4.6 },
  ])
  if (phase.id === 'schedule') {
    shell(c, 'schedule', '04    SCHEDULED PAYMENTS  ·  SIGN WHEN DUE')
    c.rrect(348, 80, 908, 444, 18, CARD, LINE)
    c.text('Scheduled payments', 372, 96, { font: fonts.bold, size: 24, color: WHITE })
    c.text('The timer only marks a payment ready. Nothing is signed until you press send.', 372, 132, { font: fonts.regular, size: 14, color: FAINT })
    field(c, 372, 164, 410, 'AMOUNT', '2', false)
    field(c, 800, 164, 424, 'ASSET', 'USDC', false)
    field(c, 372, 230, 852, 'RECIPIENT', `${short(WALLET2)}   wallet 2`, false)
    field(c, 372, 296, 852, 'DELAY IN MINUTES', '60', phase.local < 1.2)
    button(c, 372, 368, 852, 42, 'Queue payment', ORANGE, WHITE, phase.local < 1.5)
    if (phase.local > 1.45) {
      c.rrect(372, 424, 852, 78, 12, mix(CARD, ORANGE, 0.14), ORANGE)
      c.text(`Send 2.000000 USDC to ${short(WALLET2)}`, 390, 438, { font: fonts.mono, size: 14, color: ORANGE })
      c.text('pending', 1188, 438, { font: fonts.mono, size: 13, color: AMBER, align: 'right' })
      c.text('Sign when due  ·  queued for 60 minutes  ·  Arc Testnet', 390, 464, { font: fonts.mono, size: 12, color: FAINT })
    }
    const logs = [{ time: '18:06:01', text: 'Scheduled payments open.', kind: 'info' }]
    if (phase.local > 1.45) logs.push({ time: '18:06:04', text: 'Task queued for Arc Testnet. It will wait for your signature.', kind: 'process' })
    terminal(c, 348, 536, 908, 136, logs)
    return
  }

  shell(c, 'memo', '04    ON-CHAIN MEMO  ·  PUBLIC MESSAGE')
  c.rrect(348, 80, 908, 444, 18, CARD, LINE)
  c.text('On-chain memo', 372, 96, { font: fonts.bold, size: 24, color: WHITE })
  c.text('The text is public. It rides on a zero-value USDC transfer. The only USDC spent is gas.', 372, 132, { font: fonts.regular, size: 14, color: FAINT })
  field(c, 372, 166, 852, 'RECIPIENT', `${OFFICE}    Office Rent`, false)
  const full = 'October rent settled on Arc.'
  const typed = full.slice(0, Math.max(1, Math.ceil(full.length * ease(phase.local / 1.3))))
  const cursor = Math.floor(phase.local * 2) % 2 === 0 ? '|' : ''
  field(c, 372, 236, 852, 'MESSAGE', `${typed}${phase.local < 1.35 ? cursor : ''}`, phase.local < 1.35)
  c.rrect(372, 310, 852, 48, 10, mix(CARD, FUCHSIA, 0.12), FUCHSIA)
  c.text('Public on Arc. Anyone who reads the transaction can read this memo.', 388, 324, { font: fonts.regular, size: 14, color: [245, 208, 254, 255] })
  button(c, 372, 376, 852, 44, 'Publish memo', FUCHSIA, INK, phase.local > 1.5)
  if (phase.local > 2.4) {
    c.text('Memo confirmed · 0 USDC moved · gas 0.002925 USDC', 372, 436, { font: fonts.mono, size: 13, color: EMERALD })
  }
  const logs = [
    { time: '18:06:20', text: 'On-chain memo open. Message is public calldata.', kind: 'info' },
  ]
  if (phase.local > 1.4) logs.push({ time: '18:06:28', text: 'Memo text · October rent settled on Arc.', kind: 'process' })
  if (phase.local > 2.4) logs.push({ time: '18:06:32', text: 'Memo confirmed. Gas ceiling 0.002925 USDC.', kind: 'success' })
  terminal(c, 348, 536, 908, 136, logs)
}

function tab(c, x, y, label, active) {
  c.rrect(x, y, 200, 34, 8, active ? PURPLE : INSET, active ? PURPLE : LINE_CARD)
  c.text(label, x + 100, y + 8, { font: fonts.semi, size: 13, color: active ? WHITE : MUTED, align: 'center' })
}

function drawUtilities(c, t) {
  const phase = phaseAt(t, [
    { id: 'ledger', dur: 2.7 },
    { id: 'contacts', dur: 2.65 },
    { id: 'allowance', dur: 2.8 },
    { id: 'token', dur: 2.6 },
  ])
  const titles = {
    ledger: '05    LEDGER  ·  EXPORT CSV',
    contacts: '05    CONTACTS  ·  ADDRESS BOOK',
    allowance: '05    ALLOWANCE  ·  REVOKE TO ZERO',
    token: '05    TOKEN  ·  FIXED SUPPLY',
  }
  shell(c, 'utilities', titles[phase.id])
  c.rrect(348, 80, 908, 576, 18, CARD, LINE)
  c.text('Utilities', 372, 98, { font: fonts.bold, size: 24, color: WHITE })
  const tabs = ['Ledger', 'Contacts', 'Allowance', 'Token']
  tabs.forEach((label, index) => {
    tab(c, 372 + index * 212, 140, label, label.toLowerCase() === phase.id)
  })

  if (phase.id === 'ledger') {
    button(c, 1036, 188, 188, 32, 'Export CSV', mix(CARD, PURPLE, 0.18), [216, 180, 254, 255], true)
    const rows = [
      ['Sent 2.000000 USDC', `${short(WALLET2)}  ·  2026-10-14 18:04:11 UTC`, 'View'],
      ['Sent 42.500000 USDC', 'Payroll batch  ·  2026-10-14 18:05:08 UTC', 'View'],
    ]
    rows.forEach((row, index) => {
      const y = 240 + index * 78
      c.rrect(372, y, 852, 68, 10, INSET, index === 0 ? CYAN : LINE_CARD)
      c.text(row[0], 390, y + 12, { font: fonts.semi, size: 16, color: WHITE })
      c.text(row[1], 390, y + 36, { font: fonts.mono, size: 12, color: MUTED })
      c.text(row[2], 1196, y + 22, { font: fonts.semi, size: 14, color: CYAN, align: 'right' })
    })
    c.text('Export CSV writes Date, Amount, Token, and Recipient Address in UTC.', 372, 412, { font: fonts.regular, size: 14, color: FAINT })
    if (phase.local > 1.4) {
      c.rrect(372, 450, 852, 44, 10, EMERALD_BG, EMERALD)
      c.text('nexoria-ledger-111a8c-2026-10-14.csv  ·  2 receipts', 388, 462, { font: fonts.mono, size: 14, color: EMERALD })
    }
  } else if (phase.id === 'contacts') {
    c.text('Named EVM addresses for this wallet. Batch payments and Payroll can pick them.', 372, 190, { font: fonts.regular, size: 14, color: FAINT })
    const rows = [
      ['Office Rent', OFFICE],
      ['wallet 2', WALLET2],
    ]
    rows.forEach((row, index) => {
      const y = 230 + index * 92
      c.rrect(372, y, 852, 80, 12, INSET, index === 1 ? CYAN : LINE_CARD)
      c.text(row[0], 390, y + 14, { font: fonts.semi, size: 18, color: WHITE })
      c.text(row[1], 390, y + 42, { font: fonts.mono, size: 14, color: MUTED })
      button(c, 1048, y + 22, 70, 32, 'Edit', INSET, [216, 180, 254, 255])
      button(c, 1126, y + 22, 80, 32, 'Delete', INSET, ROSE)
    })
  } else if (phase.id === 'allowance') {
    c.text('Active USDC and EURC approvals on Arc Testnet. Revoke sets the allowance to zero.', 372, 188, { font: fonts.regular, size: 14, color: FAINT })
    const revoked = phase.local > 1.7
    const rows = [
      ['USDC SPENDER', SPENDER, revoked ? '0.000000 USDC' : 'Unlimited USDC', revoked],
      ['EURC SPENDER', MEMO_CONTRACT, '500.000000 EURC', false],
    ]
    rows.forEach((row, index) => {
      const y = 230 + index * 120
      c.rrect(372, y, 852, 108, 12, INSET, LINE_CARD)
      c.text(row[0], 390, y + 12, { font: fonts.mono, size: 11, color: MUTED, tracking: 0.8 })
      c.text(row[1], 390, y + 32, { font: fonts.mono, size: 13, color: SLATE })
      c.text('APPROVED AMOUNT', 390, y + 58, { font: fonts.mono, size: 11, color: MUTED, tracking: 0.8 })
      c.text(row[2], 390, y + 76, { font: fonts.mono, size: 14, color: row[3] ? EMERALD : CYAN })
      const label = index === 0 ? (phase.local > 1.15 && phase.local <= 1.7 ? 'Revoking…' : revoked ? 'Revoked' : 'Revoke') : 'Revoke'
      button(c, 1064, y + 36, 140, 36, label, index === 0 && !revoked ? ROSE : mix(CARD, ROSE, 0.25), WHITE, index === 0 && !revoked)
    })
  } else {
    c.text('Deploys FixedSupplyToken. The whole supply is minted once. There is no admin and no second mint.', 372, 190, { font: fonts.regular, size: 14, color: FAINT })
    field(c, 372, 230, 410, 'NAME', 'Nexoria Credit', false)
    field(c, 800, 230, 424, 'SYMBOL', 'NX', false)
    field(c, 372, 300, 852, 'WHOLE TOKEN SUPPLY', '1000000', false)
    c.text('Constructor mints 1,000,000 tokens in 18 decimals to this wallet. Deployment gas is USDC.', 372, 372, { font: fonts.regular, size: 14, color: FAINT })
    button(c, 372, 420, 852, 46, 'Deploy token', PURPLE, WHITE, true)
    c.text('Separate from USDC and EURC. Arc Testnet · chain 5042002.', 372, 484, { font: fonts.mono, size: 13, color: MUTED })
  }
}

function drawOutro(c) {
  c.clear(BG)
  c.fillRect(0, 0, W, 4, CYAN)
  c.text('ARC TESTNET   ·   CHAIN ID 5042002   ·   rpc.testnet.arc.io', W / 2, 168, {
    font: fonts.mono, size: 14, color: CYAN, align: 'center', tracking: 0.8,
  })
  c.text('NEXORIA', W / 2, 230, { font: fonts.bold, size: 72, color: WHITE, align: 'center', tracking: 6 })
  c.text('Nexoria — Arc Mainnet-Ready Business Suite', W / 2, 330, {
    font: fonts.semi, size: 26, color: SLATE, align: 'center',
  })
  const repo = 'github.com/Ayan1816/nexoria'
  const repoW = measure(fonts.mono, 18, repo) + 48
  c.rrect((W - repoW) / 2, 400, repoW, 48, 24, INSET, mix(BG, CYAN, 0.5))
  c.text(repo, W / 2, 414, { font: fonts.mono, size: 18, color: CYAN, align: 'center' })
  const chips = ['USDC gas', 'EURC payroll', 'Non-custodial', 'Send Guard']
  let x = (W - (chips.length * 180 + 30)) / 2
  for (const label of chips) {
    c.rrect(x, 488, 170, 36, 18, CARD, LINE)
    c.text(label, x + 85, 496, { font: fonts.semi, size: 14, color: SLATE, align: 'center' })
    x += 190
  }
  c.text('Wallet 0x111a…1a8e   ·   USDC 220.633194   ·   EURC 144.101897', W / 2, 560, {
    font: fonts.mono, size: 14, color: MUTED, align: 'center',
  })
}

const scenes = [
  { draw: drawTelemetry, dur: 8.6 },
  { draw: drawPayments, dur: 14.2 },
  { draw: drawPayroll, dur: 9.6 },
  { draw: drawSchedule, dur: 9.6 },
  { draw: drawUtilities, dur: 11.2 },
  { draw: drawOutro, dur: 6 },
]
const TOTAL = scenes.reduce((sum, scene) => sum + scene.dur, 0)

function paint(time, target, scratch, black) {
  frameTime = time
  let start = 0
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i]
    const end = start + scene.dur
    if (time < end || i === scenes.length - 1) {
      const local = Math.max(0, time - start)
      const last = i === scenes.length - 1
      const cut = last ? scene.dur : scene.dur - FADE
      if (!last && local > cut) {
        scene.draw(target, cut)
        scenes[i + 1].draw(scratch, 0)
        target.blend(scratch, (local - cut) / FADE)
      } else {
        scene.draw(target, Math.min(local, cut))
      }
      if (time < 0.4) {
        black.clear(BG)
        target.blend(black, 1 - time / 0.4)
      }
      progress(target, Math.min(time, TOTAL), TOTAL)
      return
    }
    start = end
  }
}

function findFfmpeg() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG
  const cached = `${homedir()}/.cache/nexoria-demo/ffmpeg`
  if (existsSync(cached)) return cached
  return 'ffmpeg'
}

function runFfmpeg(ff, args, stdinFrames) {
  return new Promise((resolve, reject) => {
    const child = spawn(ff, args, { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > 8000) stderr = stderr.slice(-8000)
    })
    child.on('error', reject)
    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') reject(error)
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}\n${stderr}`))
    })
    stdinFrames(child.stdin).then(() => child.stdin.end(), (error) => {
      child.kill('SIGTERM')
      reject(error)
    })
  })
}

async function writeFrame(stdin, buffer) {
  if (!stdin.write(buffer)) await new Promise((resolve) => stdin.once('drain', resolve))
}

async function main() {
  const args = process.argv.slice(2)
  const atIndex = args.indexOf('--at')
  const maxIndex = args.indexOf('--max')
  const at = atIndex >= 0 ? Number(args[atIndex + 1]) : null
  const maxSeconds = maxIndex >= 0 ? Number(args[maxIndex + 1]) : null
  const ff = findFfmpeg()
  const outPath = fileURLToPath(new URL('../public/nexoria-demo.mp4', import.meta.url))
  const frame = new Canvas(W, H)
  const scratch = new Canvas(W, H)
  const black = new Canvas(W, H)

  if (at != null) {
    paint(at, frame, scratch, black)
    const previewDir = `${homedir()}/.cache/nexoria-demo`
    const png = `${previewDir}/frame-${String(at).replace('.', '_')}.png`
    await runFfmpeg(ff, ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', 'pipe:0', '-frames:v', '1', png], async (stdin) => {
      await writeFrame(stdin, frame.data)
    })
    console.log(png)
    return
  }

  const seconds = maxSeconds == null ? TOTAL : Math.min(TOTAL, maxSeconds)
  const frames = Math.round(seconds * FPS)
  const partPath = `${outPath}.encoding.mp4`
  const started = Date.now()
  await runFfmpeg(ff, [
    '-y',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    '-s', `${W}x${H}`,
    '-r', String(FPS),
    '-i', 'pipe:0',
    '-an',
    '-f', 'mp4',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-crf', '17',
    '-preset', 'veryfast',
    '-tag:v', 'avc1',
    '-movflags', '+faststart',
    partPath,
  ], async (stdin) => {
    for (let index = 0; index < frames; index += 1) {
      paint(index / FPS, frame, scratch, black)
      await writeFrame(stdin, frame.data)
      if (index % FPS === 0) {
        const elapsed = ((Date.now() - started) / 1000).toFixed(1)
        console.log(`frame ${index}/${frames}  ${elapsed}s`)
      }
    }
  })
  renameSync(partPath, outPath)
  const size = statSync(outPath).size
  if (size < 10000) {
    unlinkSync(outPath)
    throw new Error('Encoded video is empty')
  }
  console.log(`wrote ${outPath} (${size} bytes, ${seconds.toFixed(2)}s, ${W}x${H} @ ${FPS}fps)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
