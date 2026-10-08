import * as THREE from 'three'
import { finalize, merge, type V2 } from '@/geometry'
import { rim } from '@/geometry/parts'
import type { TyreSize } from '@/physics/tyres'
import { BUILDS, TREADS, type Build, type Tread } from './model'
import { latheSector } from './sector'

/**
 * Tyre cutaway geometry in the LATHE frame (axis +Y, φ as in THREE.LatheGeometry:
 * x = r sin φ, z = r cos φ). The scene turns it so the axle lies along world Z.
 * All dimensions in metres, from the decoded size code.
 */
const { PI } = Math
const D2R = PI / 180

/** Peel window: outer layers are cut back progressively from φ = 200° (top-rear in the view). */
export const PEEL_START = 200 * D2R
const PEEL_OUTER_END = 305 * D2R

export interface LayerGeo {
  id: string
  name: string
  kind: 'tread' | 'belt' | 'ply' | 'liner'
  index: number
  geo: THREE.BufferGeometry
  cords?: THREE.BufferGeometry
  phi0: number
}

export interface TyreGeo {
  R: number
  W: number
  rimR: number
  layers: LayerGeo[]
  lugs: THREE.BufferGeometry | null
  beads: THREE.BufferGeometry
  rim: THREE.BufferGeometry
  valve: THREE.BufferGeometry
  lugH: number
  /** half section width used for the carcass, and the axial position of the beads */
  hw: number
  beadY: number
  /** inner surface of the liner, (r, axial y) from bead to bead — the air/liquid cavity wall */
  cavity: V2[]
}

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

export interface BuildOpts {
  /** override the ply count (Fig 3: a 2-ply tyre uses fewer, larger cords than a 4-ply) */
  plies?: number
  /** tyre mounted the wrong way round: chevron points against the rotation */
  reversed?: boolean
}

export function buildTyre(size: TyreSize, build: Build, tread: Tread, peel: boolean, opts: BuildOpts = {}): TyreGeo {
  const R = size.overallDiaMm / 2000
  const W = size.widthMm / 1000
  const r0 = size.rimMm / 2000
  const h = R - r0
  const spec = BUILDS[build]
  const lugH = 0.1 * h * TREADS[tread].lugScale
  const treadT = 0.018 + 0.02 * h
  const sideT = 0.007
  const np = opts.plies ?? spec.plies
  const heavy = Math.sqrt(spec.plies / np)
  const plyT = 0.0032 * heavy
  const beltT = 0.0028
  const linerT = 0.003
  const nb = spec.belts
  const Rc = R - lugH - treadT - nb * beltT
  const hw = (W / 2) * 0.95

  // carcass reference curve = outer surface of the outermost ply (super-ellipse section)
  const hc = Rc - r0
  const rc = r0 + 0.35 * hc
  const a = 0.65 * hc
  const p = 2.6
  const sp = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / p)
  const rAt = (t: number) => rc + a * sp(Math.cos(t))
  const beadR = r0 + 0.032
  let tc = PI / 2
  while (rAt(tc) > beadR && tc < PI) tc += 0.001
  const N = 64
  const ts: number[] = []
  for (let i = 0; i <= N; i++) ts.push(-tc + (2 * tc * i) / N)
  const C = ts.map((t) => new THREE.Vector2(rAt(t), hw * sp(Math.sin(t))))
  const Nm = C.map((_, i) => {
    const a0 = C[Math.max(0, i - 1)]
    const a1 = C[Math.min(N, i + 1)]
    const d = a1.clone().sub(a0).normalize()
    return new THREE.Vector2(d.y, -d.x)
  })
  const crown = C.map((c) => smooth((c.x - (r0 + 0.72 * hc)) / (0.2 * hc)))
  // cumulative arc length along the section
  const S = [0]
  for (let i = 1; i <= N; i++) S.push(S[i - 1] + C[i].distanceTo(C[i - 1]))

  /** closed band between offsets lo(i) and hi(i) over sample range [i0, i1] */
  const band = (lo: (i: number) => number, hi: (i: number) => number, i0 = 0, i1 = N, stride = 1): V2[] => {
    const idx: number[] = []
    for (let i = i0; i < i1; i += stride) idx.push(i)
    idx.push(i1)
    const pts: V2[] = []
    for (const i of idx) pts.push([C[i].x + Nm[i].x * hi(i), C[i].y + Nm[i].y * hi(i)])
    for (const i of idx.slice().reverse()) pts.push([C[i].x + Nm[i].x * lo(i), C[i].y + Nm[i].y * lo(i)])
    // ensure counter-clockwise in (r, y)
    let area = 0
    for (let k = 0; k < pts.length; k++) {
      const [x0, y0] = pts[k]
      const [x1, y1] = pts[(k + 1) % pts.length]
      area += x0 * y1 - x1 * y0
    }
    return area < 0 ? pts.reverse() : pts
  }

  // crown sample range for belts
  let ib0 = 0
  while (ib0 < N && crown[ib0] < 0.02) ib0++
  let ib1 = N
  while (ib1 > 0 && crown[ib1] < 0.02) ib1--
  const beltOff = (i: number) => nb * beltT * crown[i]

  type Spec = { id: string; name: string; kind: LayerGeo['kind']; index: number; prof: V2[]; outer: (i: number) => number; range: [number, number]; angle?: number }
  const specs: Spec[] = []
  specs.push({
    id: 'tread-rubber',
    name: 'Tread & sidewall rubber',
    kind: 'tread',
    index: 0,
    prof: band(beltOff, (i) => beltOff(i) + sideT + (treadT - sideT) * crown[i]),
    outer: (i) => beltOff(i) + sideT + (treadT - sideT) * crown[i],
    range: [0, N],
  })
  for (let j = nb - 1; j >= 0; j--) {
    const lo = (i: number) => j * beltT * crown[i]
    const hi = (i: number) => (j + 1) * beltT * crown[i]
    specs.push({
      id: `belt-${j + 1}`,
      name: `Belt ${j + 1}`,
      kind: 'belt',
      index: j,
      prof: band(lo, (i) => Math.max(hi(i), lo(i) + 1e-4), ib0, ib1, 2),
      outer: hi,
      range: [ib0, ib1],
      angle: (j % 2 === 0 ? 1 : -1) * spec.beltAngle,
    })
  }
  for (let k = np - 1; k >= 0; k--) {
    const hi = -(np - 1 - k) * plyT
    specs.push({
      id: `ply-${k + 1}`,
      name: `Body ply ${k + 1}`,
      kind: 'ply',
      index: k,
      prof: band(() => hi - plyT, () => hi, 0, N, 2),
      outer: () => hi,
      range: [0, N],
      angle: spec.plyAngle === 90 ? 90 : (k % 2 === 0 ? 1 : -1) * spec.plyAngle,
    })
  }
  specs.push({ id: 'liner', name: 'Inner liner', kind: 'liner', index: 0, prof: band(() => -np * plyT - linerT, () => -np * plyT, 0, N, 2), outer: () => -np * plyT, range: [0, N] })

  // peel: gap ends step down from the outermost layer to the liner (which is whole)
  const count = specs.length
  const step = Math.min(18 * D2R, (PEEL_OUTER_END - PEEL_START) / Math.max(1, count - 1))
  const gapEnd = specs.map((_, k) => (k === count - 1 ? PEEL_START : PEEL_OUTER_END - k * step))

  const layers: LayerGeo[] = specs.map((s, k) => {
    const phi0 = peel ? gapEnd[k] : 0
    const len = peel ? 2 * PI - (gapEnd[k] - PEEL_START) : 2 * PI
    const geo = latheSector(s.prof, phi0, len, 96)
    let cords: THREE.BufferGeometry | undefined
    if (peel && s.angle !== undefined && k > 0) {
      const exposedTo = gapEnd[k - 1]
      cords = cordRibbons(C, Nm, S, s.outer, s.range, phi0, exposedTo, s.angle, Rc, s.kind === 'belt' ? 0.012 : 0.014 * heavy)
    }
    return { id: s.id, name: s.name, kind: s.kind, index: s.index, geo, cords, phi0 }
  })

  // beads: steel-wire bundles at the toe of the carcass
  const beadProfile = (y: number): V2[] =>
    Array.from({ length: 16 }, (_, i) => {
      const t = (2 * PI * i) / 16
      return [r0 + 0.017 + 0.012 * Math.cos(t), y + 0.012 * Math.sin(t)]
    })
  const yb = C[0].y + 0.004
  const beads = merge(latheSector(beadProfile(yb), 0, 2 * PI, 72), latheSector(beadProfile(-yb), 0, 2 * PI, 72))

  const rimGeo = rim(r0, 2 * (Math.abs(yb) - 0.022), 0.16, 0.06)
  const valve = finalize(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 12).translate(0, r0 - 0.03, 0).rotateZ(-PI / 2))

  const outerPhi0 = layers[0].phi0
  const outerLen = peel ? 2 * PI - (PEEL_OUTER_END - PEEL_START) : 2 * PI
  const Rt = R - lugH
  const lugs = lugGeometry(tread, Rt, hw, lugH, outerPhi0, outerLen, opts.reversed ?? false)
  const inner = -np * plyT - linerT
  const cavity: V2[] = C.map((c, i) => [c.x + Nm[i].x * inner, c.y + Nm[i].y * inner])
  return { R, W, rimR: r0, layers, lugs, beads, rim: rimGeo, valve, lugH, hw, beadY: Math.abs(yb), cavity }
}

/** Short ribbons tracing cords on a layer's outer surface over φ ∈ [phiA, phiB]. */
function cordRibbons(
  C: THREE.Vector2[],
  Nm: THREE.Vector2[],
  S: number[],
  outer: (i: number) => number,
  range: [number, number],
  phiA: number,
  phiB: number,
  angleDeg: number,
  Rref: number,
  spacing: number,
) {
  const s0 = S[range[0]]
  const s1 = S[range[1]]
  const u0 = phiA * Rref
  const u1 = phiB * Rref
  const al = angleDeg * D2R
  const d = new THREE.Vector2(Math.cos(al), Math.sin(al))
  const nrm = new THREE.Vector2(-d.y, d.x)
  const corners = [new THREE.Vector2(u0, s0), new THREE.Vector2(u1, s0), new THREE.Vector2(u0, s1), new THREE.Vector2(u1, s1)].map((c) => c.dot(nrm))
  const cMin = Math.min(...corners)
  const cMax = Math.max(...corners)
  const pos: number[] = []
  const sec = (s: number) => {
    // section point + outward normal at arc length s (linear interpolation)
    let i = range[0]
    while (i < range[1] - 1 && S[i + 1] < s) i++
    const f = Math.max(0, Math.min(1, (s - S[i]) / Math.max(1e-9, S[i + 1] - S[i])))
    const off = outer(i) * (1 - f) + outer(i + 1) * f + 0.0007
    const n = Nm[i].clone().lerp(Nm[i + 1], f).normalize()
    const c = C[i].clone().lerp(C[i + 1], f)
    return { r: c.x + n.x * off, y: c.y + n.y * off, nr: n.x, ny: n.y }
  }
  const at = (u: number, s: number) => {
    const phi = u / Rref
    const q = sec(s)
    return {
      p: new THREE.Vector3(q.r * Math.sin(phi), q.y, q.r * Math.cos(phi)),
      n: new THREE.Vector3(q.nr * Math.sin(phi), q.ny, q.nr * Math.cos(phi)),
    }
  }
  const w = 0.0018
  for (let c = cMin + spacing / 2; c < cMax; c += spacing) {
    // line: P(λ) = c·nrm + λ·d, clipped to the (u, s) rectangle
    let lo = -Infinity
    let hi = Infinity
    const base = nrm.clone().multiplyScalar(c)
    for (const [b, dd, mn, mx] of [
      [base.x, d.x, u0, u1],
      [base.y, d.y, s0, s1],
    ]) {
      if (Math.abs(dd) < 1e-9) {
        if (b < mn || b > mx) lo = Infinity
        continue
      }
      const l0 = (mn - b) / dd
      const l1 = (mx - b) / dd
      lo = Math.max(lo, Math.min(l0, l1))
      hi = Math.min(hi, Math.max(l0, l1))
    }
    if (!(hi > lo)) continue
    const m = Math.max(2, Math.ceil((hi - lo) / 0.045))
    let prev = at(base.x + d.x * lo, base.y + d.y * lo)
    for (let k = 1; k <= m; k++) {
      const l = lo + ((hi - lo) * k) / m
      const cur = at(base.x + d.x * l, base.y + d.y * l)
      const t = cur.p.clone().sub(prev.p)
      const side = t.clone().cross(prev.n).normalize().multiplyScalar(w)
      const a1 = prev.p.clone().add(side)
      const a2 = prev.p.clone().sub(side)
      const b1 = cur.p.clone().add(side)
      const b2 = cur.p.clone().sub(side)
      pos.push(a1.x, a1.y, a1.z, a2.x, a2.y, a2.z, b1.x, b1.y, b1.z, a2.x, a2.y, a2.z, b2.x, b2.y, b2.z, b1.x, b1.y, b1.z)
      prev = cur
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Tread lugs for the chosen class, only where the tread rubber is present. */
function lugGeometry(tread: Tread, Rt: number, hw: number, lugH: number, phi0: number, len: number, reversed: boolean) {
  const inRange = (phi: number) => {
    let d = (((phi - phi0) % (2 * PI)) + 2 * PI) % (2 * PI)
    if (len >= 2 * PI - 1e-6) d = 0
    return d <= len
  }
  const parts: THREE.BufferGeometry[] = []
  const axial = new THREE.Vector3(0, 1, 0)
  const place = (theta: number, side: number, angDeg: number, length: number, width: number, height: number, yc: number) => {
    const radial = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta))
    const tang = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta))
    const ang = angDeg * D2R
    const d = axial.clone().multiplyScalar(side * Math.cos(ang)).addScaledVector(tang, (reversed ? -1 : 1) * Math.sin(ang)).normalize()
    const z = d.clone().cross(radial).normalize()
    const centre = radial.clone().multiplyScalar(Rt + 0.325 * height).addScaledVector(axial, yc)
    const b = new THREE.BoxGeometry(length, height * 1.35, width)
    b.applyMatrix4(new THREE.Matrix4().makeBasis(d, radial, z).setPosition(centre))
    parts.push(finalize(b))
  }
  if (tread === 'F2') {
    // single circumferential rib (sector band)
    const prof: V2[] = [
      [Rt - 0.006, -0.03],
      [Rt + lugH, -0.018],
      [Rt + lugH, 0.018],
      [Rt - 0.006, 0.03],
    ]
    return latheSector(prof, phi0, len, 160)
  }
  if (tread === 'R3') {
    const n = Math.round((2 * PI * Rt) / 0.09)
    for (let i = 0; i < n; i++) {
      for (const [k, yc] of [
        [0, -hw * 0.55],
        [1, 0],
        [0, hw * 0.55],
      ] as const) {
        const theta = (2 * PI * (i + 0.5 * k)) / n
        if (!inRange(theta)) continue
        place(theta, 1, 0, hw * 0.42, 0.045, lugH, yc)
      }
    }
    return parts.length ? merge(...parts) : null
  }
  // R-1 / R-2 chevron bars
  const n = Math.round((2 * PI * Rt) / (tread === 'R2' ? 0.26 : 0.2))
  const ang = 45
  const length = (hw * 0.95) / Math.cos(ang * D2R)
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const theta = (2 * PI * i) / n + (side > 0 ? PI / n : 0)
      if (!inRange(theta - 0.06) || !inRange(theta + 0.06)) continue
      place(theta, side, ang, length, tread === 'R2' ? 0.055 : 0.045, lugH, side * hw * 0.48)
    }
  }
  return parts.length ? merge(...parts) : null
}
