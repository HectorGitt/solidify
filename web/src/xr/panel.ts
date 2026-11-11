import type { Mirrored } from './mirror'

/**
 * The panel beside the rig in the headset, drawn on a canvas: the rig's buttons, the part last touched, its
 * own controls (sliders, choices, switches) and readings. Drawing returns where everything is, so a touch
 * or pinch at a point on the panel can be turned into the control under it.
 */
export const PANEL_W = 800
export const PANEL_H = 1120
/** metres across, in the room */
export const PANEL_M = 0.36

export type Hit =
  | { kind: 'button'; id: string; x: number; y: number; w: number; h: number }
  | { kind: 'slider'; id: string; x: number; y: number; w: number; h: number; min: number; max: number; step: number }
  | { kind: 'option'; id: string; value: string; x: number; y: number; w: number; h: number }
  | { kind: 'toggle'; id: string; checked: boolean; x: number; y: number; w: number; h: number }
  | { kind: 'page'; dir: -1 | 1; x: number; y: number; w: number; h: number }

export interface PanelButton {
  id: string
  label: string
  on?: boolean
  /** the main action of its row */
  primary?: boolean
}

export interface PanelModel {
  title: string
  hint: string | null
  buttons: PanelButton[][]
  part: { name: string; summary?: string } | null
  controls: [string, Mirrored][]
  readouts: [string, Mirrored & { kind: 'readout' }][]
  page: number
  hover: string | null
}

const C = {
  bg: 'rgba(12,15,16,0.94)',
  card: '#151a1b',
  card2: '#1d2324',
  line: 'rgba(255,255,255,0.09)',
  ink: '#f5f7f2',
  mute: '#a3aaa0',
  dim: '#737b70',
  accent: '#c6f24e',
  accentInk: '#0b1003',
  warn: '#fbbf24',
  info: '#38bdf8',
}
const SANS = 'Sora, system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

function lines(g: CanvasRenderingContext2D, text: string, maxW: number, max: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (g.measureText(t).width <= maxW || !cur) cur = t
    else {
      out.push(cur)
      cur = w
    }
  }
  if (cur) out.push(cur)
  if (out.length > max) {
    out.length = max
    let last = out[max - 1]
    while (last.length > 1 && g.measureText(`${last}…`).width > maxW) last = last.slice(0, -1)
    out[max - 1] = `${last}…`
  }
  return out
}

function fit(g: CanvasRenderingContext2D, text: string, maxW: number) {
  if (g.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && g.measureText(`${t}…`).width > maxW) t = t.slice(0, -1)
  return `${t}…`
}

export function fmtNum(v: number, digits = 3) {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(2)
  if (digits < 1) return Math.round(v).toLocaleString('en-GB')
  return Number(v.toPrecision(digits)).toLocaleString('en-GB', { maximumFractionDigits: 6 })
}

const controlHeight = (m: Mirrored) => (m.kind === 'slider' ? 96 : m.kind === 'segmented' ? (m.label ? 118 : 76) : 72)

/** how many controls fit on each page */
export function paginate(controls: Mirrored[], room: number) {
  const pages: number[] = []
  let used = 0
  let count = 0
  for (const m of controls) {
    const h = controlHeight(m)
    if (count > 0 && used + h > room) {
      pages.push(count)
      used = 0
      count = 0
    }
    used += h
    count++
  }
  if (count || !pages.length) pages.push(count)
  return pages
}

export function drawPanel(g: CanvasRenderingContext2D, m: PanelModel): { hits: Hit[]; pages: number } {
  const hits: Hit[] = []
  const W = PANEL_W
  const pad = 30
  g.clearRect(0, 0, W, PANEL_H)
  rr(g, 0, 0, W, PANEL_H, 36)
  g.fillStyle = C.bg
  g.fill()
  g.strokeStyle = C.line
  g.lineWidth = 2
  g.stroke()

  // title
  let y = pad
  g.textBaseline = 'top'
  g.fillStyle = C.accent
  g.font = `600 19px ${SANS}`
  g.fillText('SOLIDIFY LAB', pad, y)
  y += 32
  g.fillStyle = C.ink
  g.font = `600 34px ${SANS}`
  for (const l of lines(g, m.title, W - pad * 2, 2)) {
    g.fillText(l, pad, y)
    y += 42
  }
  y += 8

  // buttons
  for (const row of m.buttons) {
    const gap = 12
    const bw = (W - pad * 2 - gap * (row.length - 1)) / row.length
    row.forEach((b, i) => {
      const x = pad + i * (bw + gap)
      const hov = m.hover === `button:${b.id}`
      rr(g, x, y, bw, 70, 18)
      g.fillStyle = b.primary || b.on ? C.accent : hov ? C.card2 : C.card
      g.fill()
      if (!(b.primary || b.on)) {
        g.strokeStyle = hov ? C.accent : C.line
        g.lineWidth = 2
        g.stroke()
      }
      g.fillStyle = b.primary || b.on ? C.accentInk : C.ink
      // a long label ("Cut: Through the middle") is set smaller before it is cut short
      let px = 22
      g.font = `600 ${px}px ${SANS}`
      while (px > 16 && g.measureText(b.label).width > bw - 16) g.font = `600 ${(px -= 1)}px ${SANS}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(fit(g, b.label, bw - 16), x + bw / 2, y + 36)
      g.textAlign = 'left'
      g.textBaseline = 'top'
      hits.push({ kind: 'button', id: b.id, x, y, w: bw, h: 70 })
    })
    y += 82
  }

  // what to do now (placing), or the part last touched
  if (m.hint) {
    rr(g, pad, y, W - pad * 2, 64, 18)
    g.fillStyle = 'rgba(198,242,78,0.12)'
    g.fill()
    g.fillStyle = C.accent
    g.font = `500 22px ${SANS}`
    g.textBaseline = 'middle'
    g.fillText(fit(g, m.hint, W - pad * 2 - 32), pad + 18, y + 33)
    g.textBaseline = 'top'
    y += 78
  } else if (m.part) {
    g.font = `400 20px ${SANS}`
    const sum = m.part.summary ? lines(g, m.part.summary, W - pad * 2 - 36, 2) : []
    const h = 58 + sum.length * 27
    rr(g, pad, y, W - pad * 2, h, 18)
    g.fillStyle = C.card
    g.fill()
    g.fillStyle = C.ink
    g.font = `600 24px ${SANS}`
    g.fillText(fit(g, m.part.name, W - pad * 2 - 36), pad + 18, y + 16)
    g.fillStyle = C.mute
    g.font = `400 20px ${SANS}`
    sum.forEach((l, i) => g.fillText(l, pad + 18, y + 52 + i * 27))
    y += h + 14
  }

  // readings at the bottom: up to six, two columns
  const rd = m.readouts.slice(0, 6)
  const rdRows = Math.ceil(rd.length / 2)
  const rdTop = PANEL_H - pad - rdRows * 96 - (rd.length ? 40 : 0)
  if (rd.length) {
    g.fillStyle = C.mute
    g.font = `600 18px ${SANS}`
    g.fillText('READINGS', pad, rdTop)
    const cw = (W - pad * 2 - 12) / 2
    rd.forEach(([, r], i) => {
      const x = pad + (i % 2) * (cw + 12)
      const ry = rdTop + 36 + Math.floor(i / 2) * 96
      rr(g, x, ry, cw, 84, 16)
      g.fillStyle = C.card
      g.fill()
      g.fillStyle = C.dim
      g.font = `500 16px ${SANS}`
      g.fillText(fit(g, r.label.toUpperCase(), cw - 28), x + 14, ry + 12)
      g.fillStyle = r.tone === 'accent' ? C.accent : r.tone === 'warn' ? C.warn : r.tone === 'info' ? C.info : C.ink
      g.font = `600 28px ${MONO}`
      const v = fit(g, r.value, cw - 28 - (r.unit ? 60 : 0))
      g.fillText(v, x + 14, ry + 40)
      if (r.unit) {
        const vw = g.measureText(v).width
        g.fillStyle = C.mute
        g.font = `400 18px ${MONO}`
        g.fillText(fit(g, r.unit, cw - 40 - vw), x + 22 + vw, ry + 49)
      }
    })
  }

  // the rig's own controls, a page at a time
  const top = y + 44
  const room = rdTop - 16 - top
  const pages = paginate(
    m.controls.map(([, c]) => c),
    room,
  )
  const page = Math.min(m.page, pages.length - 1)
  const start = pages.slice(0, page).reduce((a, b) => a + b, 0)
  const shown = m.controls.slice(start, start + pages[page])
  if (m.controls.length) {
    g.fillStyle = C.mute
    g.font = `600 18px ${SANS}`
    g.fillText('CONTROLS', pad, y + 6)
    if (pages.length > 1) {
      g.textAlign = 'right'
      g.fillText(`${page + 1} / ${pages.length}`, W - pad - 132, y + 6)
      g.textAlign = 'left'
      for (const [dir, x] of [
        [-1, W - pad - 116],
        [1, W - pad - 54],
      ] as const) {
        const hov = m.hover === `page:${dir}`
        rr(g, x, y - 6, 54, 40, 12)
        g.fillStyle = hov ? C.card2 : C.card
        g.fill()
        g.fillStyle = C.ink
        g.font = `600 24px ${SANS}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(dir < 0 ? '‹' : '›', x + 27, y + 14)
        g.textAlign = 'left'
        g.textBaseline = 'top'
        hits.push({ kind: 'page', dir, x, y: y - 6, w: 54, h: 40 })
      }
    }
  }
  let cy = top
  for (const [id, c] of shown) {
    const hov = m.hover?.endsWith(id) ?? false
    if (c.kind === 'slider') {
      g.fillStyle = C.ink
      g.font = `500 22px ${SANS}`
      const val = `${fmtNum(c.value, c.digits)}${c.unit ? ` ${c.unit}` : ''}`
      g.font = `600 22px ${MONO}`
      const vw = g.measureText(val).width
      g.fillStyle = C.accent
      g.textAlign = 'right'
      g.fillText(val, W - pad, cy)
      g.textAlign = 'left'
      g.fillStyle = C.ink
      g.font = `500 22px ${SANS}`
      g.fillText(fit(g, c.label, W - pad * 2 - vw - 20), pad, cy)
      const ty = cy + 50
      const f = Math.max(0, Math.min(1, (c.value - c.min) / (c.max - c.min || 1)))
      const tw = W - pad * 2
      rr(g, pad, ty - 7, tw, 14, 7)
      g.fillStyle = C.card2
      g.fill()
      rr(g, pad, ty - 7, Math.max(14, tw * f), 14, 7)
      g.fillStyle = C.accent
      g.fill()
      g.beginPath()
      g.arc(pad + tw * f, ty, hov ? 22 : 18, 0, Math.PI * 2)
      g.fillStyle = C.ink
      g.fill()
      // generous: the whole row is the slider, so a fingertip need not land on the thin track
      hits.push({ kind: 'slider', id, x: pad, y: cy, w: tw, h: 88, min: c.min, max: c.max, step: c.step })
    } else if (c.kind === 'segmented') {
      let oy = cy
      if (c.label) {
        g.fillStyle = C.ink
        g.font = `500 22px ${SANS}`
        g.fillText(fit(g, c.label, W - pad * 2), pad, cy)
        oy += 38
      }
      const n = c.options.length
      const ow = (W - pad * 2 - 8 * (n - 1)) / n
      c.options.forEach((o, i) => {
        const x = pad + i * (ow + 8)
        const sel = o.value === c.value
        const h = m.hover === `option:${id}:${o.value}`
        rr(g, x, oy, ow, 60, 14)
        g.fillStyle = sel ? C.ink : h ? C.card2 : C.card
        g.fill()
        g.fillStyle = sel ? C.bg : C.ink
        g.font = `${sel ? 600 : 500} 20px ${SANS}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(fit(g, o.label, ow - 12), x + ow / 2, oy + 31)
        g.textAlign = 'left'
        g.textBaseline = 'top'
        hits.push({ kind: 'option', id, value: o.value, x, y: oy, w: ow, h: 60 })
      })
    } else if (c.kind === 'toggle') {
      g.fillStyle = C.ink
      g.font = `500 22px ${SANS}`
      g.textBaseline = 'middle'
      g.fillText(fit(g, c.label, W - pad * 2 - 110), pad, cy + 28)
      g.textBaseline = 'top'
      const x = W - pad - 92
      rr(g, x, cy + 6, 92, 46, 23)
      g.fillStyle = c.checked ? C.accent : C.card2
      g.fill()
      g.beginPath()
      g.arc(c.checked ? x + 69 : x + 23, cy + 29, hov ? 19 : 17, 0, Math.PI * 2)
      g.fillStyle = c.checked ? C.accentInk : C.ink
      g.fill()
      hits.push({ kind: 'toggle', id, checked: c.checked, x: pad, y: cy, w: W - pad * 2, h: 60 })
    }
    cy += controlHeight(c)
  }
  return { hits, pages: pages.length }
}

export const hitAt = (hits: Hit[], x: number, y: number) => hits.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) ?? null

export const hitKey = (h: Hit | null) =>
  !h ? null : h.kind === 'button' ? `button:${h.id}` : h.kind === 'page' ? `page:${h.dir}` : h.kind === 'option' ? `option:${h.id}:${h.value}` : `${h.kind}:${h.id}`
