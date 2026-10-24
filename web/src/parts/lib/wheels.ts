import * as THREE from 'three'
import { box, cylinder, extrude, lathe, mat4, merge, roundedRect, tube, xform, type V2 } from '@/geometry'
import { hexBolt, loopPath, rim, sprocket, torus, tyre } from '@/geometry/parts'

/**
 * Shared parts library — wheels, tyres, ballast and crawler tracks.
 *
 * WHEEL FRAME (every wheel builder here unless noted): axle along Z, wheel centre at the origin,
 * the OUTER face (dish, hub, wheel nuts) towards +Z. Spin a wheel by rotation.z. For a wheel on
 * the −Z side of a machine, turn the RIM and HUB by π about Y (`toLeft`) so the dish faces outward
 * too, but leave the tyre unturned: a directional R-1 tread must point the same way on both sides.
 *
 * Built on `tyre()` and `rim()` from `@/geometry/parts`. All solids are closed and outward-facing.
 */

const { PI } = Math
/** lathe/tyre frame (axis +Y) → wheel frame (axis +Z, the +Y face becomes the +Z face) */
const toZ = mat4.rx(PI / 2)

/* ================================================================== wheel assemblies */

export type TreadPattern = 'R1' | 'F2' | 'smooth'

export interface WheelSpec {
  /** overall tyre radius */
  radius: number
  /** tyre section width */
  width: number
  /** bead-seat (rim) radius; default 0.58 · radius */
  rimRadius?: number
  /** 'R1' lugged drive tyre (default), 'F2' ribbed steering tyre, 'smooth' turf/caster tyre */
  pattern?: TreadPattern
  /** R-1 lug bars per side; default round(34 · radius) */
  lugs?: number
  /** R-1 lug angle to the axle, degrees (default 45) */
  lugAngleDeg?: number
  /** rim width between the flanges; default 0.9 · width */
  rimWidth?: number
  /** hub (centre boss) radius; default min(0.08, 0.35 · rimRadius) */
  hubR?: number
  /** dish: outward offset of the centre disc; default min(0.04, 0.15 · width) */
  dish?: number
  /** wheel nuts on the hub; default from hubR (10 / 8 / 6 / 4) */
  studs?: number
  /** wheel-nut pitch-circle radius; default 0.77 · hubR */
  studCircle?: number
  /** wheel-nut radius (hex, across corners); default 0.1 · hubR */
  studR?: number
  /** wheel-nut length standing proud of the hub face; default 0.2 · hubR */
  studLen?: number
  /** hub-cap radius (0 = none); default 0.45 · hubR */
  capR?: number
  /** hub-cap height; default 0.36 · hubR */
  capH?: number
}

export type ResolvedWheel = Required<WheelSpec>

/**
 * Farmland rear wheel: 14.9-28 R-1 on a W12-28 rim, 10 wheel nuts. Matches TRACTOR.rear in
 * src/tractor/dims.ts and the shared tractor's rear wheel.
 */
export const FARMLAND_REAR: WheelSpec = {
  radius: 0.66,
  width: 0.378,
  rimRadius: 0.356,
  pattern: 'R1',
  lugs: 23,
  lugAngleDeg: 45,
  rimWidth: 0.378 * 0.86,
  hubR: 0.11,
  dish: 0.07,
  studs: 10,
  studCircle: 0.085,
  studR: 0.011,
  studLen: 0.022,
  capR: 0.05,
  capH: 0.04,
}

/** Farmland front wheel: 7.50-16 F-2 steering tyre, 6 wheel nuts. Matches TRACTOR.front. */
export const FARMLAND_FRONT: WheelSpec = {
  radius: 0.39,
  width: 0.19,
  rimRadius: 0.203,
  pattern: 'F2',
  rimWidth: 0.19 * 0.8,
  hubR: 0.065,
  dish: 0.035,
  studs: 6,
  studCircle: 0.046,
  studR: 0.008,
  studLen: 0.018,
  capR: 0.032,
  capH: 0.03,
}

/** Implement / trailer road wheel (F-2 rib tyre) of the given size. */
export function implementWheel(radius: number, width: number): WheelSpec {
  return { radius, width, pattern: 'F2', rimRadius: radius * 0.58, hubR: radius * 0.18, dish: width * 0.1 }
}

/** Fill in the defaults of a wheel spec. */
export function resolveWheel(s: WheelSpec): ResolvedWheel {
  const rimRadius = s.rimRadius ?? s.radius * 0.58
  const pattern = s.pattern ?? 'R1'
  const hubR = s.hubR ?? Math.min(0.08, rimRadius * 0.35)
  return {
    radius: s.radius,
    width: s.width,
    rimRadius,
    pattern,
    lugs: s.lugs ?? (pattern === 'R1' ? Math.round(s.radius * 34) : 0),
    lugAngleDeg: s.lugAngleDeg ?? 45,
    rimWidth: s.rimWidth ?? s.width * 0.9,
    hubR,
    dish: s.dish ?? Math.min(0.04, s.width * 0.15),
    studs: s.studs ?? (hubR >= 0.09 ? 10 : hubR >= 0.07 ? 8 : hubR >= 0.04 ? 6 : 4),
    studCircle: s.studCircle ?? hubR * 0.77,
    studR: s.studR ?? Math.max(0.004, hubR * 0.1),
    studLen: s.studLen ?? hubR * 0.2,
    capR: s.capR ?? hubR * 0.45,
    capH: s.capH ?? hubR * 0.36,
  }
}

/** Axial position (wheel frame, +Z outward) of the hub's outer face, where the nuts sit. */
export const hubFace = (s: WheelSpec) => resolveWheel(s).dish + 0.02

/** The tyre alone (wheel frame). */
export function wheelTyre(spec: WheelSpec) {
  const s = resolveWheel(spec)
  return xform(tyre({ radius: s.radius, width: s.width, rimRadius: s.rimRadius, pattern: s.pattern, lugs: s.lugs, lugAngleDeg: s.lugAngleDeg }), toZ)
}

/**
 * Rim with its dished centre disc, and the hub hardware (wheel nuts on their pitch circle plus a
 * domed hub cap) on the hub's outer face. Wheel frame.
 */
export function wheelRim(spec: WheelSpec) {
  const s = resolveWheel(spec)
  const rimG = xform(rim(s.rimRadius, s.rimWidth, s.hubR, s.dish), toZ)
  const z0 = s.dish + 0.02
  const nuts = Array.from({ length: s.studs }, (_, i) => {
    const a = (2 * PI * i) / s.studs
    return xform(cylinder(s.studR, s.studLen, 6), mat4.c(mat4.t(s.studCircle * Math.cos(a), s.studCircle * Math.sin(a), z0 + s.studLen / 2), toZ))
  })
  const capProfile: V2[] = [
    [0, z0],
    [s.capR, z0],
    [s.capR * 0.85, z0 + s.capH * 0.7],
    [0, z0 + s.capH],
  ]
  const cap = s.capR > 0 ? [xform(lathe(capProfile, 24), toZ)] : []
  const parts = [...nuts, ...cap]
  return { rim: rimG, hub: parts.length ? merge(...parts) : null }
}

export interface WheelGeo {
  tyre: THREE.BufferGeometry
  rim: THREE.BufferGeometry
  /** wheel nuts + hub cap (null when the spec has none) */
  hub: THREE.BufferGeometry | null
  spec: ResolvedWheel
}

const wheelCache = new Map<string, WheelGeo>()

/**
 * Complete wheel: tyre, rim + disc, and hub hardware, in the wheel frame (axle Z, outer face +Z).
 * Cached per spec: the geometries are shared, so clone before transforming them.
 *
 *   wheel(FARMLAND_REAR)                       // tractor rear wheel
 *   wheel({ radius: 0.3, width: 0.16, pattern: 'smooth' })
 *   wheel(implementWheel(0.28, 0.15))           // implement road wheel
 */
export function wheel(spec: WheelSpec): WheelGeo {
  const s = resolveWheel(spec)
  const key = JSON.stringify(s)
  let w = wheelCache.get(key)
  if (!w) {
    const r = wheelRim(s)
    w = { tyre: wheelTyre(s), rim: r.rim, hub: r.hub, spec: s }
    wheelCache.set(key, w)
  }
  return w
}

/** Turn a rim or hub (wheel frame) to face −Z, for a wheel on the machine's −Z side. */
export const toLeft = (g: THREE.BufferGeometry) => xform(g, mat4.ry(PI))

/** Tyre valve stem, radial along +X through the rim well at the mid-plane. Same in the lathe and wheel frames. */
export function valveStem(rimRadius: number, r = 0.006, length = 0.05) {
  return xform(cylinder(r, length, 12), mat4.c(mat4.t(rimRadius - 0.03, 0, 0), mat4.rz(-PI / 2)))
}

/** Centre-to-centre spacing of dual wheels (inner to outer wheel), with a gap of 0.15 · width. */
export const dualSpacing = (spec: WheelSpec, gap = 0.15 * spec.width) => spec.width + gap

/**
 * Wheel-centre stations across a machine (Z): [+t/2, −t/2], or with duals
 * [+t/2, +t/2 + spacing, −t/2, −t/2 − spacing].
 */
export function wheelStations(track: number, spec: WheelSpec, duals = false) {
  const h = track / 2
  if (!duals) return [h, -h]
  const d = dualSpacing(spec)
  return [h, h + d, -h, -h - d]
}

/* ================================================================== ballast */

export interface WheelWeightSpec {
  /** outer radius (default 0.3 m: fits inside a 28 in rim) */
  r?: number
  /** centre bore, clearing the hub and its wheel nuts (default 0.11) */
  bore?: number
  /** thickness (default 0.05) */
  t?: number
}

/**
 * Cast-iron rear-wheel weight: a disc bored for the hub, with a hand-hold slot. Wheel frame,
 * centred on z = 0 (faces at ±t/2); stack them outward along +Z on the wheel centre.
 * About 40–90 kg each in real life; 2–3 per wheel is usual.
 */
export function wheelWeight(spec: WheelWeightSpec = {}) {
  const r = spec.r ?? 0.3
  const bore = spec.bore ?? 0.11
  const t = spec.t ?? 0.05
  const s = new THREE.Shape()
  s.absarc(0, 0, r, 0, 2 * PI, false)
  const h = new THREE.Path()
  h.absarc(0, 0, bore, 0, 2 * PI, true)
  s.holes.push(h)
  // hand-hold slot between the bore and the rim
  const slotW = r * 0.5
  const slotH = Math.max(0.02, (r - bore) * 0.22)
  const yc = bore + (r - bore) * 0.62
  s.holes.push(new THREE.Path(roundedRect(slotW, slotH, slotH * 0.49, 0, yc).getPoints(6).reverse()))
  return xform(extrude(s, t, { curveSegments: 40 }), mat4.t(0, 0, -t / 2))
}

/**
 * Wheel-frame z of the centres of n wheel weights of thickness t stacked on a wheel's centre
 * disc, from the dish face outward (+Z).
 */
export function wheelWeightStack(wheelSpec: WheelSpec, n: number, t = 0.05, gap = 0.003) {
  const s = resolveWheel(wheelSpec)
  return Array.from({ length: n }, (_, i) => s.dish + 0.012 + t / 2 + i * (t + gap))
}

export interface SuitcaseWeightSpec {
  /** length fore–aft (X), default 0.55 */
  length?: number
  /** height (Y), default 0.3 */
  height?: number
  /** thickness (Z), default 0.05 */
  thickness?: number
}

/**
 * Front "suitcase" weight (≈ 40–55 kg): a slab with a hook notch at the rear top that hangs it on
 * the front weight bracket, and a hand-hold at the front. Frame: centred on the origin, length
 * along X (handle towards +X), height Y, thickness Z — hang a row of them side by side along Z.
 */
export function suitcaseWeight(spec: SuitcaseWeightSpec = {}) {
  const L = spec.length ?? 0.55
  const H = spec.height ?? 0.3
  const T = spec.thickness ?? 0.05
  const x0 = -L / 2
  const x1 = L / 2
  const y0 = -H / 2
  const y1 = H / 2
  const n = Math.min(0.06, L * 0.12) // hook notch
  const s = new THREE.Shape()
  s.moveTo(x0, y0)
  s.lineTo(x1, y0)
  s.lineTo(x1, y1 - H * 0.25)
  s.lineTo(x1 - H * 0.25, y1)
  s.lineTo(x0 + 2 * n, y1)
  s.lineTo(x0 + 2 * n, y1 - n)
  s.lineTo(x0 + n, y1 - n)
  s.lineTo(x0 + n, y1)
  s.lineTo(x0, y1)
  s.lineTo(x0, y0)
  const hw = Math.min(0.11, L * 0.2)
  const hh = H * 0.28
  s.holes.push(new THREE.Path(roundedRect(hw, hh, Math.min(hw, hh) * 0.45, x1 - hw / 2 - L * 0.12, y1 - hh / 2 - H * 0.2).getPoints(6).reverse()))
  return xform(extrude(s, T, { curveSegments: 6 }), mat4.t(0, 0, -T / 2))
}

/* ================================================================== crawler tracks */

export type ShoeType = 'standard' | 'open' | 'snow' | 'multi' | 'rubber'
export type ChainType = 'flush' | 'interlocking'

/** Track chain and running-gear sizes. Defaults: a typical 50–60 kW crawler (traction/tracks). */
export interface TrackSpec {
  /** chain pitch, bushing to bushing */
  pitch: number
  /** hunting-tooth sprocket: odd tooth count, every other tooth drives a bushing */
  teeth: number
  /** half link height: the rails run this far inside the pitch line */
  rail: number
  linkT: number
  /** half the distance between the two link rails */
  gauge: number
  bushingR: number
  bushingIn: number
  pinR: number
  shoeW: number
  plateT: number
  /** front idler pitch radius */
  idlerR: number
  rollerR: number
  carrierR: number
}

export const CRAWLER_TRACK: TrackSpec = {
  pitch: 0.171,
  teeth: 25,
  rail: 0.05,
  linkT: 0.03,
  gauge: 0.12,
  bushingR: 0.03,
  bushingIn: 0.022,
  pinR: 0.0205,
  shoeW: 0.4,
  plateT: 0.014,
  idlerR: 0.33,
  rollerR: 0.09,
  carrierR: 0.075,
}

/** Sprocket pitch radius: the arc between driven bushings (2 teeth) equals the pitch, R = p·z/(4π). */
export const trackSprocketRadius = (t: TrackSpec = CRAWLER_TRACK) => (t.pitch * t.teeth) / (4 * PI)

/*
 * LINK FRAME (links, bushings, pins, shoes, bolts): x along the chain from the bushing joint
 * (x = −p/2) to the pin joint (x = +p/2), y outward (shoe side), z across the track, centred.
 */

/** Offset ("cranked") link pair: inner halves round the bushing, outer halves round the pin. */
export function trackLink(t: TrackSpec = CRAWLER_TRACK) {
  const p = t.pitch
  const h = 2 * t.rail
  const half = (x0: number, x1: number, z: number) => xform(extrude(roundedRect(x1 - x0, h, 0.035 * (h / 0.1), (x0 + x1) / 2, 0), t.linkT, { curveSegments: 4 }), mat4.t(0, 0, z))
  const zi = t.gauge - t.linkT / 2
  const zo = t.gauge + t.linkT / 2
  const ov = 0.04 * (p / 0.171)
  return merge(half(-p / 2 - ov, 0.004, zi), half(-p / 2 - ov, 0.004, -zi), half(-0.004, p / 2 + ov, zo), half(-0.004, p / 2 + ov, -zo))
}

/** Bushing in the inner link halves; interlocking bushings reach into counterbores of the outer links. */
export function trackBushing(chain: ChainType = 'interlocking', t: TrackSpec = CRAWLER_TRACK) {
  const len = 2 * t.gauge + (chain === 'interlocking' ? 2 * 0.012 : 0)
  return xform(tube(t.bushingR, t.bushingIn, len, 24), mat4.c(mat4.t(-t.pitch / 2, 0, 0), toZ))
}

/** Track pin, pressed into the outer link halves. */
export function trackPin(t: TrackSpec = CRAWLER_TRACK) {
  return xform(cylinder(t.pinR, 2 * (t.gauge + t.linkT) + 0.012, 16), mat4.c(mat4.t(t.pitch / 2, 0, 0), toZ))
}

/** Master pin with its head and snap ring: the one pin driven out to split the track. */
export function trackMasterPin(t: TrackSpec = CRAWLER_TRACK) {
  const p = t.pitch
  const L = 2 * (t.gauge + t.linkT) + 0.03
  const pin = xform(cylinder(t.pinR, L, 20), mat4.c(mat4.t(p / 2, 0, 0.009), toZ))
  const head = xform(cylinder(t.pinR + 0.008, 0.01, 20), mat4.c(mat4.t(p / 2, 0, -(t.gauge + t.linkT) - 0.006), toZ))
  const ring = xform(torus(t.pinR + 0.002, 0.003, 8, 24), mat4.t(p / 2, 0, t.gauge + t.linkT + 0.012))
  return merge(pin, head, ring)
}

const GROUSER: Record<ShoeType, number> = { standard: 0.04, open: 0.04, snow: 0.028, multi: 0.015, rubber: 0 }

/** Track shoe of the given type, bolted to the outer face of the links (link frame). */
export function trackShoe(type: ShoeType = 'standard', t: TrackSpec = CRAWLER_TRACK) {
  const L = t.pitch * 0.97
  const W = t.shoeW
  const y0 = t.rail
  const T = type === 'rubber' ? 0.03 : t.plateT
  const s = new THREE.Shape()
  s.moveTo(-L / 2, -W / 2)
  s.lineTo(L / 2, -W / 2)
  s.lineTo(L / 2, W / 2)
  s.lineTo(-L / 2, W / 2)
  s.lineTo(-L / 2, -W / 2)
  const hole = (cx: number, cz: number, hx: number, hz: number, round: boolean) => {
    const hp = new THREE.Path()
    if (round) hp.absellipse(cx, cz, hx, hz, 0, 2 * PI, true, 0)
    else {
      hp.moveTo(cx - hx, cz - hz)
      hp.lineTo(cx - hx, cz + hz)
      hp.lineTo(cx + hx, cz + hz)
      hp.lineTo(cx + hx, cz - hz)
      hp.lineTo(cx - hx, cz - hz)
    }
    s.holes.push(hp)
  }
  if (type === 'open') hole(-0.012, 0, 0.032, 0.055, true)
  if (type === 'snow') hole(-0.012, 0, 0.022, 0.07, true)
  if (type === 'multi') {
    hole(0, 0.05, 0.012, 0.022, false)
    hole(0, -0.05, 0.012, 0.022, false)
  }
  // extrude along Z, then lay the plate in the x–z plane with its thickness along +y
  const plate = xform(extrude(s, T, { curveSegments: 16 }), mat4.c(mat4.t(0, y0 + T / 2, 0), mat4.rx(PI / 2)))
  const parts = [plate]
  const grouser = (x: number, hgt: number, w = 0.02) => parts.push(xform(box(w, hgt, W), mat4.t(x, y0 + T + hgt / 2 - 0.001, 0)))
  if (type === 'standard') grouser(0.045, GROUSER.standard)
  if (type === 'open') grouser(0.06, GROUSER.open, 0.018)
  if (type === 'snow') grouser(0.06, GROUSER.snow, 0.016)
  if (type === 'multi') {
    grouser(-0.055, GROUSER.multi, 0.016)
    grouser(0.03, GROUSER.multi, 0.016)
    grouser(0.07, GROUSER.multi, 0.012)
  }
  return merge(...parts)
}

/** Height of the shoe's outer face (grouser tips) above the chain pitch line. */
export function shoeReach(type: ShoeType = 'standard', t: TrackSpec = CRAWLER_TRACK) {
  return t.rail + (type === 'rubber' ? 0.03 : t.plateT + GROUSER[type])
}

/** Shoe bolt: hex head on the shoe face (y = 0), shank down −y into the link. */
export function shoeBolt() {
  return hexBolt(0.016, 0.045)
}

/** (x, z) of the four shoe bolts in the link frame. */
export function shoeBoltOffsets(t: TrackSpec = CRAWLER_TRACK): [number, number][] {
  return [
    [-0.035, t.gauge],
    [0.035, t.gauge],
    [-0.035, -t.gauge],
    [0.035, -t.gauge],
  ]
}

/** Drive sprocket: hunting-tooth rim at half the chain pitch, centre disc, hub and flange. Axis Z, centred. */
export function trackSprocket(t: TrackSpec = CRAWLER_TRACK) {
  const RS = trackSprocketRadius(t)
  const k = t.pitch / 0.171
  const chord = 2 * RS * Math.sin(PI / t.teeth)
  const rimG = sprocket(t.teeth, chord, 2 * t.bushingR, 0.07 * k, 0.1 * k)
  const hubProfile: V2[] = [
    [0.06, -0.12],
    [0.16, -0.12],
    [0.16, -0.035],
    [0.105, -0.035],
    [0.105, 0.035],
    [0.16, 0.035],
    [0.16, 0.09],
    [0.06, 0.09],
  ]
  const hub = xform(lathe(hubProfile.map(([r, y]) => [r * k, y * k] as V2), 48), toZ)
  const disc = xform(tube(RS - 0.04 * k, 0.1 * k, 0.03 * k, 64), toZ)
  return merge(rimG, hub, disc)
}

/** Front idler: treads under the two link rails and a centre flange between the links. Axis Z, centred. */
export function trackIdler(t: TrackSpec = CRAWLER_TRACK, idlerR = t.idlerR) {
  const Rt = idlerR - t.rail
  const g = t.gauge
  const k = t.pitch / 0.171
  const prof: V2[] = [
    [0.05 * k, -0.2 * k],
    [0.12 * k, -0.2 * k],
    [0.12 * k, -g - 0.04],
    [Rt, -g - 0.035],
    [Rt, -0.085 * k],
    [Rt + 0.013 * k, -0.075 * k],
    [Rt + 0.013 * k, 0.075 * k],
    [Rt, 0.085 * k],
    [Rt, g + 0.035],
    [0.12 * k, g + 0.04],
    [0.12 * k, 0.2 * k],
    [0.05 * k, 0.2 * k],
  ]
  // lathe profile is (r, y): flip to CCW
  return xform(lathe(prof.map(([r, y]) => [r, -y] as V2).reverse(), 72), toZ)
}

/** Flanged track (or carrier) roller of rail radius r, running on the link rails. Axis Z, centred. */
export function trackRoller(r: number, t: TrackSpec = CRAWLER_TRACK) {
  const g = t.gauge
  const f = r + 0.025
  const prof: V2[] = [
    [0.03, -g - 0.075],
    [0.055, -g - 0.075],
    [0.055, -g - 0.045],
    [f, -g - 0.045],
    [f, -g - 0.03],
    [r, -g - 0.022],
    [r, -g + 0.04],
    [r - 0.012, -g + 0.05],
    [r - 0.012, g - 0.05],
    [r, g - 0.04],
    [r, g + 0.022],
    [f, g + 0.03],
    [f, g + 0.045],
    [0.055, g + 0.045],
    [0.055, g + 0.075],
    [0.03, g + 0.075],
  ]
  return xform(lathe(prof.map(([rr, y]) => [rr, -y] as V2).reverse(), 48), toZ)
}

export interface TrackLoopOpts {
  /** sprocket centre x (rear) and idler centre x (front) */
  xs: number
  xi: number
  /** height of the bottom strand's pitch line above the frame origin (default: grouser tips on y = 0) */
  yb?: number
  /** number of bottom track rollers (default 5) */
  rollers?: number
  shoe?: ShoeType
  chain?: ChainType
  spec?: TrackSpec
}

/**
 * A static crawler track side built from the real parts: a chain of links, bushings, pins and
 * shoes wrapped round a rear drive sprocket and a front idler, with track rollers on the bottom
 * strand. Side view in XY (+X forward, Y up), track centred on z = 0. For animated tracks, place
 * the link-frame parts by instancing instead (see traction/tracks).
 */
export function trackLoop(o: TrackLoopOpts) {
  const t = o.spec ?? CRAWLER_TRACK
  const shoe = o.shoe ?? 'standard'
  const yb = o.yb ?? shoeReach(shoe, t)
  const RS = trackSprocketRadius(t)
  const cs = new THREE.Vector2(o.xs, yb + RS)
  const ci = new THREE.Vector2(o.xi, yb + t.idlerR)
  const { path } = loopPath(cs, RS, ci, t.idlerR)
  const L = path.getLength()
  const N = Math.max(8, Math.round(L / t.pitch))
  // the link frame needs a clockwise walk (outward = left-hand normal): reverse a CCW loop
  let area = 0
  const pts = path.getSpacedPoints(64)
  for (let i = 0; i < pts.length - 1; i++) area += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y
  const wrap = (u: number) => ((u % 1) + 1) % 1
  const at = (u: number) => path.getPointAt(area > 0 ? wrap(1 - u) : wrap(u))
  const link = trackLink(t)
  const bush = trackBushing(o.chain ?? 'interlocking', t)
  const pin = trackPin(t)
  const shoeG = trackShoe(shoe, t)
  const chain: THREE.BufferGeometry[] = []
  const shoes: THREE.BufferGeometry[] = []
  const m = new THREE.Matrix4()
  const z = new THREE.Vector3(0, 0, 1)
  for (let k = 0; k < N; k++) {
    const A = at(k / N)
    const B = at((k + 1) / N)
    const tg = new THREE.Vector3(B.x - A.x, B.y - A.y, 0).normalize()
    const n = new THREE.Vector3(-tg.y, tg.x, 0)
    m.makeBasis(tg, n, z).setPosition((A.x + B.x) / 2, (A.y + B.y) / 2, 0)
    chain.push(link.clone().applyMatrix4(m), bush.clone().applyMatrix4(m), pin.clone().applyMatrix4(m))
    shoes.push(shoeG.clone().applyMatrix4(m))
  }
  const nr = o.rollers ?? 5
  const rollerY = yb + t.rail + t.rollerR
  const x0 = o.xs + RS * 0.9
  const x1 = o.xi - t.idlerR * 0.9
  const roller = trackRoller(t.rollerR, t)
  const rollers = Array.from({ length: nr }, (_, i) => xform(roller, mat4.t(x0 + ((x1 - x0) * (i + 0.5)) / nr, rollerY, 0)))
  return {
    /** links + bushings + pins */
    chain: merge(...chain),
    shoes: merge(...shoes),
    sprocket: xform(trackSprocket(t), mat4.t(cs.x, cs.y, 0)),
    idler: xform(trackIdler(t), mat4.t(ci.x, ci.y, 0)),
    rollers: merge(...rollers),
    /** height of the upper strand's grouser tips */
    top: Math.max(cs.y + RS, ci.y + t.idlerR) + shoeReach(shoe, t),
  }
}
