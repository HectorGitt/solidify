import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, extrude, lathe, merge } from '@/geometry'
import { InstancedPartMesh } from '@/modules/traction/tracks/InstancedPartMesh'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { PROFILES, createSoil, heightAt, pressPrint, roughen, stampRun } from '@/render/soil'
import { FieldGround } from '../_shared/field'
import { bar, plateXY, rod } from '../_shared/geom'
import { Particles } from '../_appkit/three'
import { C, PLOT, STAGES, STRIP_HALF, VEG, live, useClearing, type Method, type Stage, type Vegetation } from './model'

const { PI } = Math
const grid = createSoil(PLOT.x1 - PLOT.x0 + 8, PLOT.z1 - PLOT.z0 + 4, 0.3, PLOT.x0 - 4, PLOT.z0 - 2)
roughen(grid, 0.03, 7)
const LANES = [-9, -3, 3, 9]
const LANE_HALF = 3
const RUN = { x0: PLOT.x0 - 5, x1: PLOT.x1 + 5 }
const WINDROWS = [-30, -10, 10, 30]
const DUR: Record<Stage, number> = { survey: 24, knockdown: 48, windrow: 44, burn: 20, till: 44 }
const CHAIN_Z = [PLOT.z0 + 1, PLOT.z1 - 1]
const CHAIN_BIGHT = 9

/* ------------------------------ trees ------------------------------ */

interface Tree {
  x: number
  z: number
  /** diameter (cm) and height (m) */
  d: number
  h: number
  /** 0 standing, 1 falling, 2 down, 3 windrowed, 4 burnt */
  st: number
  fall: number
  yaw: number
  stump: boolean
  /** displayed x (moved by the rake) and windrow target */
  xd: number
  xw: number
  counted: boolean
  rooted: boolean
}
const trees: Tree[] = []
let treeVeg: Vegetation | null = null

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

function plant(veg: Vegetation) {
  const v = VEG[veg]
  const area = ((PLOT.x1 - PLOT.x0) * (PLOT.z1 - PLOT.z0)) / 10000
  const n = Math.round(v.density * area)
  const r = rng(11 + veg.length)
  trees.length = 0
  for (let i = 0; i < n; i++) {
    // diameters skewed small: most stems are young
    const d = 8 + (v.dMax - 8) * Math.pow(r(), 2.2)
    trees.push({ x: PLOT.x0 + 1 + r() * (PLOT.x1 - PLOT.x0 - 2), z: PLOT.z0 + 0.5 + r() * (PLOT.z1 - PLOT.z0 - 1), d, h: 3 + d * 0.22, st: 0, fall: 0, yaw: 0, stump: false, xd: 0, xw: 0, counted: false, rooted: false })
  }
  treeVeg = veg
  live.total = n
}

function freshSoil() {
  grid.disturbed.fill(0)
  grid.compacted.fill(0)
  roughen(grid, 0.03, 7)
}

/** Can this method knock this tree down? (the chain rides over trees thicker than 45 cm) */
const fells = (m: Method, t: Tree) => (m === 'chain' ? t.d <= 45 : m === 'shear' ? t.d <= 76 : true)

function knock(t: Tree, m: Method, yaw: number) {
  if (t.st !== 0 || !fells(m, t)) return
  t.st = 1
  t.yaw = yaw + (Math.random() - 0.5) * 0.5
  t.stump = m === 'shear'
  t.xd = t.x
  live.down++
  if (!t.stump) pressPrint(grid, t.x, t.z, 0.2 + t.d / 150, 0.2 + t.d / 150, 0.12, 0.5)
}

/** Put the field in the state it has at the start of `stage` (when a stage is chosen directly). */
function setupStage(stage: Stage, m: Method, veg: Vegetation) {
  plant(veg)
  freshSoil()
  live.down = 0
  live.counted = 0
  const k = STAGES.findIndex((s) => s.id === stage)
  if (k >= 2) for (const t of trees) knock(t, m, 0)
  for (const t of trees) if (t.st === 1) (t.st = 2), (t.fall = PI / 2)
  if (k >= 3)
    for (const t of trees)
      if (t.st === 2) {
        t.xw = WINDROWS.find((w) => w >= t.x) ?? WINDROWS[WINDROWS.length - 1]
        t.xd = t.xw + (Math.random() - 0.5) * 1.5
        t.st = 3
      }
  if (k >= 4) {
    for (const t of trees) if (t.st === 3) t.st = 4
    for (const w of WINDROWS) stampRun(grid, w - 1.2, w + 1.2, 0, PLOT.z1, () => 0.01, { mode: 'set', blend: 0.5, disturb: 0.9 })
  }
}

/* ------------------------------ crawler geometry ------------------------------ */

const TR = { x0: -1.55, x1: 1.55, ys: 0.45, rs: 0.42, yi: 0.4, ri: 0.38, w: 0.5, z: 1.0 }
const TRACK_LEN = 2 * (TR.x1 - TR.x0) + PI * (TR.rs + TR.ri)

/** Point on the track loop (side view) at arc length s, measured from the top of the sprocket going forward. */
function trackPoint(s: number, out: { x: number; y: number; a: number }) {
  const L = TR.x1 - TR.x0
  const top = TR.ys + TR.rs
  s = ((s % TRACK_LEN) + TRACK_LEN) % TRACK_LEN
  if (s < L) {
    out.x = TR.x0 + s
    out.y = top - (s / L) * (TR.rs - TR.ri) - (TR.ys - TR.yi) * (s / L)
    out.a = 0
    return out
  }
  s -= L
  if (s < PI * TR.ri) {
    const a = PI / 2 - s / TR.ri
    out.x = TR.x1 + TR.ri * Math.cos(a)
    out.y = TR.yi + TR.ri * Math.sin(a)
    out.a = a - PI / 2
    return out
  }
  s -= PI * TR.ri
  if (s < L) {
    out.x = TR.x1 - s
    out.y = 0.02
    out.a = PI
    return out
  }
  s -= L
  const a = -PI / 2 - s / TR.rs
  out.x = TR.x0 + TR.rs * Math.cos(a)
  out.y = TR.ys + TR.rs * Math.sin(a)
  out.a = a - PI / 2
  return out
}

function crawlerGeometry() {
  const frame = merge(
    ...[1, -1].flatMap((s) => [
      box(TR.x1 - TR.x0, 0.35, TR.w * 0.6).translate(0, 0.42, s * TR.z),
      cylinder(TR.rs - 0.05, TR.w * 0.7, 24).rotateX(PI / 2).translate(TR.x0, TR.ys, s * TR.z),
      cylinder(TR.ri - 0.05, TR.w * 0.7, 24).rotateX(PI / 2).translate(TR.x1, TR.yi, s * TR.z),
      ...[-0.9, -0.3, 0.3, 0.9].map((x) => cylinder(0.12, TR.w * 0.6, 16).rotateX(PI / 2).translate(x, 0.16, s * TR.z)),
    ]),
  )
  const body = merge(
    box(3.0, 0.4, 1.5).translate(-0.1, 0.85, 0),
    box(1.7, 0.9, 1.3).translate(0.65, 1.45, 0),
    box(0.15, 0.85, 1.25).translate(1.55, 1.4, 0),
    box(1.1, 0.5, 1.6).translate(-0.85, 1.3, 0),
    box(0.5, 0.6, 1.4).translate(-1.4, 1.35, 0),
    cylinder(0.07, 0.8, 12).translate(0.9, 2.2, 0.3),
    // drawbar hook
    box(0.5, 0.12, 0.25).translate(-1.75, 0.6, 0),
  )
  const seat = merge(box(0.5, 0.12, 0.5).translate(-0.85, 1.65, 0), box(0.1, 0.55, 0.5).translate(-1.1, 1.9, 0), cylinder(0.18, 0.04, 20).rotateZ(0.5).translate(-0.45, 2.0, 0))
  const rops = merge(...[[-1.35, 0.72], [-1.35, -0.72], [-0.2, 0.72], [-0.2, -0.72]].map(([x, z]) => box(0.1, 1.55, 0.1).translate(x, 2.3, z)), box(1.35, 0.08, 1.6).translate(-0.78, 3.08, 0))
  const grouser = box(0.05, 0.05, TR.w)
  const shoe = box(0.2, 0.025, TR.w)
  return { frame, body, seat, rops, grouser: merge(grouser.translate(0, 0.035, 0), shoe) }
}

type Attach = 'straight' | 'pusher' | 'rake' | 'shear' | 'none'

function attachmentGeometry(a: Attach) {
  const W = 3.2
  const arms = [1, -1].flatMap((s) => [bar([-0.2, 0.42, s * 1.0], [1.95, 0.45, s * 1.1], 0.12, 0.12), rod([0.8, 1.6, s * 0.5], [1.85, 1.0, s * 0.6], 0.06, 12)])
  if (a === 'none') return { blade: merge(box(0.3, 0.3, 0.3).translate(1.75, 0.6, 0)), extra: null as THREE.BufferGeometry | null }
  if (a === 'shear') {
    // V-plan blade, angled; stinger on the leading point splits the tree
    const pts: [number, number][] = [[0, 0], [0.1, 0], [0.1, 0.9], [0, 0.9]]
    const half = (s: number) => {
      const g = extrude(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), W / 2 + 0.2)
      g.rotateY(s * (PI / 2 - 0.55))
      return g.translate(2.6, 0.05, 0)
    }
    const stinger = merge(lathe([[0, 0], [0.12, 0.05], [0.04, 0.9], [0, 0.95]], 6).rotateZ(-PI / 2).translate(2.6, 0.35, 0))
    return { blade: merge(half(1), half(-1), box(0.6, 0.06, 0.4).translate(2.4, 0.05, 0), ...arms), extra: stinger }
  }
  // curved mouldboard blade
  const prof: [number, number][] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    prof.push([2.1 - 0.25 * Math.sin(t * PI * 0.9), 0.05 + 1.15 * t])
  }
  for (let i = 10; i >= 0; i--) prof.push([prof[i][0] - 0.06, prof[i][1]])
  const mould = plateXY(prof, a === 'rake' ? 0.05 : W, 0).translate(0, 0, a === 'rake' ? 0 : -W / 2)
  if (a === 'rake') {
    // slatted rake: vertical curved teeth, soil falls through
    const teeth: THREE.BufferGeometry[] = []
    for (let z = -W / 2; z <= W / 2 + 1e-6; z += 0.27) teeth.push(plateXY(prof.map(([x, y]) => [x + 0.1, y] as [number, number]), 0.05, z - 0.025), plateXY([[2.15, 0.05], [2.45, -0.1], [2.15, 0.15]], 0.05, z - 0.025))
    return { blade: merge(...teeth, box(0.08, 0.1, W + 0.1).translate(1.95, 0.75, 0), box(0.08, 0.1, W + 0.1).translate(1.92, 1.15, 0), ...arms), extra: null }
  }
  const blade = merge(mould, ...arms)
  if (a === 'pusher') {
    const tines: THREE.BufferGeometry[] = []
    for (let z = -W / 2 + 0.1; z <= W / 2; z += 0.4) tines.push(plateXY([[2.05, 0.08], [2.45, -0.05], [2.05, 0.3]], 0.06, z - 0.03))
    const pusher = merge(bar([1.9, 1.2, 0.9], [2.6, 3.4, 0.4], 0.12, 0.12), bar([1.9, 1.2, -0.9], [2.6, 3.4, -0.4], 0.12, 0.12), bar([2.6, 3.4, 0.9], [2.6, 3.4, -0.9], 0.14, 0.14), bar([0.9, 1.9, 0], [2.5, 3.3, 0], 0.1, 0.1))
    return { blade: merge(blade, ...tines), extra: pusher }
  }
  return { blade, extra: null }
}

function rootPloughGeometry() {
  const frame = merge(bar([0, 0.6, 0], [-1.6, 0.9, 0], 0.14, 0.14), bar([-1.6, 0.9, 1.3], [-1.6, 0.9, -1.3], 0.14, 0.14), ...[1, -1].map((s) => bar([-0.2, 0.6, 0], [-1.6, 0.9, s * 1.2], 0.1, 0.1)))
  const standards = merge(...[1, -1].map((s) => plateXY([[-1.45, 0.85], [-1.75, 0.85], [-1.9, -0.4], [-1.6, -0.4]], 0.05, s * 1.0 - 0.025)))
  // horizontal V blade undercutting the roots, with lifting fins
  const blade = merge(...[1, -1].map((s) => bar([-1.6, -0.4, 0], [-2.2, -0.36, s * 1.4], 0.25, 0.03)), ...[-0.9, -0.3, 0.3, 0.9].map((z) => plateXY([[-1.85, -0.38], [-2.0, -0.38], [-2.05, -0.25]], 0.02, z)))
  return { frame, standards, blade }
}

/* ------------------------------ crawler component ------------------------------ */

const INFO = {
  crawler: { summary: 'Crawler tractor (track-laying), with ROPS.', role: 'The prime mover for clearing: tracks give high pull at low speed on soft or rough ground.', details: 'Sizes are typical of a medium crawler.' },
  straight: { summary: 'Bulldozer blade on push arms.', role: 'Knocks vegetation over and pushes it — but takes the topsoil with it; in land forming it hauls soil up to about 25 m.' },
  pusher: { summary: 'Tree pusher: rake-toothed blade with a high pusher frame.', role: 'The frame meets the trunk high up, adding leverage to push trees over and uproot them; the teeth catch the roots.' },
  rake: { summary: 'Clearing rake (slatted, toothed blade).', role: 'Gathers debris into windrows while the soil falls through the slats, so less topsoil is moved. Best in sandy soils.' },
  shear: { summary: 'Shear blade with stinger.', role: 'A sharp angled blade cuts trees at ground level; the stinger (a wedge) splits big trees first. Hydraulic scissor shears cut softwood up to 76 cm.' },
  chain: { summary: 'Anchor chain.', role: 'A heavy chain slung between two crawlers — one along the edge, one through the bush. Its bight drags over the trees and pulls them down. Effective for trees up to 45 cm diameter and 2500 stems/ha.' },
  plough: { summary: 'Root plough.', role: 'A horizontal V-blade on two standards undercuts roots at 20–50 cm depth and shatters surface crusts; the fins lift the roots towards the surface.' },
  trees: { summary: 'Bush and trees.', role: 'Stem diameters from regrowth to forest size. Trees thicker than 45 cm stand up to the chain.' },
  stumps: { summary: 'Stumps.', role: 'Left by the shear blade, to decompose or be shattered later by root ploughing.' },
  strip: { summary: 'Tree-count strip: 100 m line, 5 m each side = 0.1 ha.', role: 'Stems counted in the strip × 10 gives stems per hectare — the density that decides the method.' },
  fire: { summary: 'Burning windrows.', role: 'Dried debris is burnt and the remains removed before tillage.' },
  soil: { summary: 'Field soil.', role: 'Agricultural clearing works to about 30 cm and must preserve the topsoil. Track prints, root pits and scraped topsoil show here.' },
}
const CITE = {
  machines: [C.bush('p2–4, Figs 1–2'), C.am('§11 land clearing')],
  chain: [C.am('§11.3.5 chaining'), C.bush('p2 knock down by chaining')],
  rake: [C.am('§11 rake'), C.bush('p2 windrow')],
  plough: [C.am('§11 root plough'), C.bush('p2 till')],
}

interface Pose {
  x: number
  z: number
  yaw: number
  /** track phase (distance run) and the last print position */
  phase: number
  lx: number
  lz: number
  acc: number
}

function Crawler({ id, attach, pose, children }: { id: string; attach: Attach; pose: Pose; children?: ReactNode }) {
  const g = useMemo(crawlerGeometry, [])
  const a = useMemo(() => attachmentGeometry(attach), [attach])
  const root = useRef<THREE.Group>(null)
  const shoes = useRef<THREE.InstancedMesh>(null)
  const N = 34
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => ({ x: 0, y: 0, a: 0 }), [])
  useSimFrame(() => {
    if (root.current) {
      root.current.position.set(pose.x, heightAt(grid, pose.x, pose.z), pose.z)
      root.current.rotation.set(0, pose.yaw, 0)
    }
    if (shoes.current) {
      let k = 0
      for (const s of [1, -1])
        for (let i = 0; i < N; i++) {
          trackPoint((i / N) * TRACK_LEN - pose.phase, q)
          m.makeRotationZ(q.a).setPosition(q.x, q.y, s * TR.z)
          shoes.current.setMatrixAt(k++, m)
        }
      shoes.current.instanceMatrix.needsUpdate = true
    }
  })
  const bladeName = { straight: 'Bulldozer blade', pusher: 'Tree pusher', rake: 'Clearing rake', shear: 'Shear blade', none: 'Front weight' }[attach]
  const bladeInfo = attach === 'none' ? { summary: 'Front weight.', role: 'Balances the pull of the chain.' } : INFO[attach]
  return (
    <group ref={root}>
      <Part id={id} name="Crawler tractor" role="housing" material="paintYellow" info={INFO.crawler} cites={CITE.machines} beyondNotes>
        <PartMesh geometry={g.body} />
        <Part id={`${id}-tracks`} name="Tracks and track frames" role="moving" material="steelDark" info={{ summary: 'Track frames, sprocket, idler, rollers and shoes.', role: 'The sprocket at the rear drives the track; grousers on the shoes bite into the ground.' }}>
          <PartMesh geometry={g.frame} />
          <InstancedPartMesh ref={shoes} geometry={g.grouser} count={2 * N} />
        </Part>
        <Part id={`${id}-rops`} name="ROPS and seat" role="static" material="paintBlack" info={{ summary: 'Roll-over protective structure and seat.', role: 'Protects the operator from falling branches and in a roll-over.' }} cut={false}>
          <PartMesh geometry={g.rops} />
          <PartMesh geometry={g.seat} material="plastic" />
        </Part>
        <Part id={`${id}-blade`} name={bladeName} role="static" material={attach === 'shear' ? 'steelDark' : 'paintYellow'} info={bladeInfo} cites={CITE.machines} explode={[0.6, 0, 0]}>
          <PartMesh geometry={a.blade} />
          {a.extra && <PartMesh geometry={a.extra} material={attach === 'shear' ? 'forged' : 'paintYellow'} />}
        </Part>
        {children}
      </Part>
    </group>
  )
}

/* ------------------------------ scene ------------------------------ */

const P1: Pose = { x: RUN.x0, z: LANES[0], yaw: 0, phase: 0, lx: RUN.x0, lz: LANES[0], acc: 0 }
const P2: Pose = { x: RUN.x0, z: CHAIN_Z[1], yaw: 0, phase: 0, lx: RUN.x0, lz: CHAIN_Z[1], acc: 0 }
const marker = { x: PLOT.x0 }
let lastStamp = NaN
const FIRE = 360
const fire = { x: new Float32Array(FIRE), y: new Float32Array(FIRE), z: new Float32Array(FIRE), age: new Float32Array(FIRE), life: new Float32Array(FIRE), next: 0 }

/** Position of the single machine along its lanes at progress p. */
function lanePose(p: number, pose: Pose) {
  const n = LANES.length
  const u = Math.min(0.99999, p) * n
  const i = Math.floor(u)
  const f = u - i
  const fwd = i % 2 === 0
  pose.z = LANES[i]
  pose.x = fwd ? RUN.x0 + (RUN.x1 - RUN.x0) * f : RUN.x1 - (RUN.x1 - RUN.x0) * f
  pose.yaw = fwd ? 0 : PI
  return fwd ? 1 : -1
}

function chainPoint(t: number, out: THREE.Vector3) {
  // quadratic Bézier in plan from crawler A's hook through the bight to crawler B's hook
  const ax = P1.x - 1.9
  const bx = P2.x - 1.9
  const cx = (ax + bx) / 2 - CHAIN_BIGHT * 2
  const x = (1 - t) * (1 - t) * ax + 2 * t * (1 - t) * cx + t * t * bx
  const z = (1 - t) * (1 - t) * P1.z + 2 * t * (1 - t) * 0 + t * t * P2.z
  out.set(x, 0.25 + 0.35 * Math.abs(1 - 2 * t) ** 3, z)
  return out
}

function step(dt: number) {
  const st = useClearing.getState()
  if (treeVeg !== st.veg) setupStage(st.stage, st.method, st.veg)
  live.progress = Math.min(1, live.progress + dt / DUR[st.stage])
  const p = live.progress
  if (st.stage === 'survey') {
    marker.x = PLOT.x0 + (PLOT.x1 - PLOT.x0) * p
    for (const t of trees)
      if (!t.counted && Math.abs(t.z) <= STRIP_HALF && t.x <= marker.x) {
        t.counted = true
        live.counted++
      }
  } else if (st.stage === 'knockdown') {
    if (st.method === 'chain') {
      P1.z = CHAIN_Z[0]
      P2.z = CHAIN_Z[1]
      P1.yaw = P2.yaw = 0
      P1.x = P2.x = RUN.x0 - 8 + (RUN.x1 + 20 - RUN.x0) * p
      // trees behind the chain curve are pulled down (forward)
      const pt = new THREE.Vector3()
      for (const t of trees) {
        if (t.st !== 0) continue
        const u = (t.z - P1.z) / (P2.z - P1.z)
        if (u < 0 || u > 1) continue
        chainPoint(u, pt)
        if (pt.x >= t.x) knock(t, 'chain', 0)
      }
    } else {
      const dir = lanePose(p, P1)
      const reach = P1.x + dir * (st.method === 'shear' ? 2.7 : 2.3)
      for (const t of trees) if (t.st === 0 && Math.abs(t.z - P1.z) < LANE_HALF && (dir > 0 ? t.x <= reach : t.x >= reach) && Math.abs(t.x - reach) < 3) knock(t, st.method, dir > 0 ? 0 : PI)
      // a straight dozer blade scrapes the topsoil
      if (st.method === 'dozer' && Number.isFinite(lastStamp) && Math.abs(P1.x - lastStamp) > 0.3) {
        stampRun(grid, lastStamp + dir * 2, P1.x + dir * 2, P1.z, 1.6, () => -0.05, { mode: 'min', disturb: 0.45 })
      }
      lastStamp = P1.x
    }
  } else if (st.stage === 'windrow') {
    const dir = lanePose(p, P1)
    const front = P1.x + dir * 2.4
    for (const t of trees) {
      if ((t.st !== 2 && t.st !== 3) || Math.abs(t.z - P1.z) > LANE_HALF) continue
      if (t.st === 2 && (dir > 0 ? front >= t.x : front <= t.x) && Math.abs(front - t.x) < 2) {
        t.st = 3
        t.xw = dir > 0 ? (WINDROWS.find((w) => w >= t.x) ?? RUN.x1) : ([...WINDROWS].reverse().find((w) => w <= t.x) ?? RUN.x0)
        t.xd = t.x
      }
      if (t.st === 3 && Math.abs(t.xd - t.xw) > 0.01) t.xd = dir > 0 ? Math.min(t.xw, Math.max(t.xd, front)) : Math.max(t.xw, Math.min(t.xd, front))
    }
  } else if (st.stage === 'burn') {
    for (let k = 0; k < Math.min(30, Math.round(dt * 260)); k++) {
      const i = fire.next
      fire.next = (fire.next + 1) % FIRE
      fire.x[i] = WINDROWS[Math.floor(Math.random() * WINDROWS.length)] + (Math.random() - 0.5) * 2
      fire.z[i] = PLOT.z0 + Math.random() * (PLOT.z1 - PLOT.z0)
      fire.y[i] = 0.2
      fire.age[i] = 0
      fire.life[i] = p < 0.85 ? 1 + Math.random() : 0
    }
    if (p > 0.6) for (const t of trees) if (t.st === 3) t.st = 4
    if (p > 0.5 && p < 0.55) for (const w of WINDROWS) stampRun(grid, w - 1.2, w + 1.2, 0, PLOT.z1, () => 0.01, { mode: 'set', blend: 0.3, disturb: 0.9 })
  } else if (st.stage === 'till') {
    const dir = lanePose(p, P1)
    const bladeX = P1.x - dir * 4.0
    if (Number.isFinite(lastStamp) && Math.abs(bladeX - lastStamp) > 0.2) stampRun(grid, lastStamp, bladeX, P1.z, 1.5, PROFILES.tilth(0.02, 0.4), { mode: 'set', blend: 0.6, disturb: 1 })
    lastStamp = bladeX
    for (const t of trees) if (t.stump && !t.rooted && Math.abs(t.z - P1.z) < 1.6 && Math.abs(t.x - bladeX) < 0.6) t.rooted = true
  }
  // falling trees topple over about a second
  for (const t of trees)
    if (t.st === 1) {
      t.fall += dt * (1.2 + t.fall * 2)
      if (t.fall >= PI / 2 - 0.05) (t.fall = PI / 2 - 0.05), (t.st = 2)
    }
  // fire particles rise and fade
  for (let i = 0; i < FIRE; i++)
    if (fire.life[i] > 0) {
      fire.age[i] += dt
      fire.y[i] += dt * (1.5 + fire.age[i])
      if (fire.age[i] > fire.life[i]) fire.life[i] = 0
    }
  // track motion and prints
  for (const P of st.stage === 'knockdown' && st.method === 'chain' ? [P1, P2] : st.stage === 'survey' || st.stage === 'burn' ? [] : [P1]) {
    const d = Math.hypot(P.x - P.lx, P.z - P.lz)
    P.lx = P.x
    P.lz = P.z
    if (d > 5) continue
    P.phase += d
    P.acc += d
    if (P.acc > 0.6) {
      P.acc = 0
      for (const s of [1, -1]) pressPrint(grid, P.x, P.z + s * TR.z, 0.3, TR.w / 2, 0.03, 0.8)
    }
  }
  // auto-advance
  if (p >= 1 && st.auto) {
    const k = STAGES.findIndex((s) => s.id === st.stage)
    if (k < STAGES.length - 1) {
      live.progress = 0
      lastStamp = NaN
      useClearing.getState().set({ stage: STAGES[k + 1].id })
    }
  }
}

function Trees() {
  const g = useMemo(() => ({ trunk: lathe([[0, 0], [1, 0], [0.75, 1], [0, 1]], 8), crown: new THREE.IcosahedronGeometry(1, 1), stump: cylinder(1, 1, 8).translate(0, 0.5, 0), ring: lathe([[0.9, 0], [1.1, 0], [1.1, 0.04], [0.9, 0.04]], 16) }), [])
  const MAX = 700
  const trunk = useRef<THREE.InstancedMesh>(null)
  const crown = useRef<THREE.InstancedMesh>(null)
  const stump = useRef<THREE.InstancedMesh>(null)
  const ring = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => ({ base: new THREE.Matrix4(), m: new THREE.Matrix4(), s: new THREE.Matrix4(), s2: new THREE.Matrix4(), o: new THREE.Object3D() }), [])
  useSimFrame(() => {
    const T = trunk.current
    const Cr = crown.current
    const S = stump.current
    const R = ring.current
    if (!T || !Cr || !S || !R) return
    const st = useClearing.getState()
    const burn = st.stage === 'burn' ? live.progress : 0
    let n = 0
    let ns = 0
    let nr = 0
    const { o, base, m, s, s2 } = tmp
    for (const t of trees) {
      if (n >= MAX) break
      const r = t.d / 200
      const y0 = heightAt(grid, t.x, t.z)
      if (t.st === 4) continue
      if (t.st <= 2) {
        o.position.set(t.x, t.stump ? y0 + 0.35 : y0, t.z)
        o.rotation.set(0, t.yaw, -t.fall)
      } else {
        o.position.set(t.xd, y0 + 0.25, t.z)
        o.rotation.set(0, t.yaw + t.z * 3, -PI / 2 + 0.05)
      }
      o.scale.setScalar(t.st === 3 ? Math.max(0.05, 1 - burn * 1.4) : 1)
      o.updateMatrix()
      base.copy(o.matrix)
      m.copy(base).multiply(s.makeScale(r, t.h * 0.75, r))
      T.setMatrixAt(n, m)
      const cr = 0.6 + t.h * 0.14
      m.copy(base).multiply(s.makeTranslation(0, t.h * 0.8, 0)).multiply(s2.makeScale(cr, cr * 0.75, cr))
      Cr.setMatrixAt(n, m)
      n++
      if (t.stump && !t.rooted && ns < MAX) {
        m.makeScale(r * 1.05, 0.38, r * 1.05).setPosition(t.x, y0, t.z)
        S.setMatrixAt(ns++, m)
      }
      if (t.counted && st.stage === 'survey' && nr < MAX) {
        const rr = 0.25 + r
        m.makeScale(rr, 1, rr).setPosition(t.x, y0 + 0.02, t.z)
        R.setMatrixAt(nr++, m)
      }
    }
    T.count = n
    Cr.count = n
    S.count = ns
    R.count = nr
    for (const im of [T, Cr, S, R]) im.instanceMatrix.needsUpdate = true
  })
  return (
    <Part id="trees" name="Bush and trees" role="static" material="wood" cut={false} info={INFO.trees} cites={[C.am('§11.3.5 — up to 45 cm and 2500 stems/ha'), C.bush('p3 vegetation type and density')]}>
      <InstancedPartMesh ref={trunk} geometry={g.trunk} count={MAX} />
      <Part id="crowns" name="Tree crowns" role="static" material="crop" info={INFO.trees}>
        <InstancedPartMesh ref={crown} geometry={g.crown} count={MAX} />
      </Part>
      <Part id="stumps" name="Stumps" role="static" material="wood" info={INFO.stumps} cites={[C.bush('p1–2 clearing patterns')]}>
        <InstancedPartMesh ref={stump} geometry={g.stump} count={MAX} />
      </Part>
      <Part id="count-marks" name="Counted stems" role="static" material="paintYellow" info={INFO.strip} cites={[C.am('§11.2.2 tree count')]}>
        <InstancedPartMesh ref={ring} geometry={g.ring} count={MAX} />
      </Part>
    </Part>
  )
}

function Chain() {
  const N = 90
  const links = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => lathe([[0.07, -0.02], [0.1, -0.02], [0.1, 0.02], [0.07, 0.02]], 10).scale(1.4, 1, 1), [])
  const o = useMemo(() => new THREE.Object3D(), [])
  const a = useMemo(() => new THREE.Vector3(), [])
  const b = useMemo(() => new THREE.Vector3(), [])
  useSimFrame(() => {
    const L = links.current
    if (!L) return
    for (let i = 0; i < N; i++) {
      chainPoint(i / (N - 1), a)
      chainPoint(Math.min(1, (i + 1) / (N - 1)), b)
      o.position.copy(a)
      o.lookAt(b)
      o.rotateY(PI / 2)
      if (i % 2) o.rotateX(PI / 2)
      o.scale.setScalar(1.6)
      o.updateMatrix()
      L.setMatrixAt(i, o.matrix)
    }
    L.instanceMatrix.needsUpdate = true
  })
  return (
    <Part id="anchor-chain" name="Anchor chain" role="moving" material="steelDark" info={INFO.chain} cites={CITE.chain}>
      <InstancedPartMesh ref={links} geometry={geo} count={N} />
    </Part>
  )
}

function RootPlough() {
  const g = useMemo(rootPloughGeometry, [])
  return (
    <Part id="root-plough" name="Root plough" role="static" material="paintYellow" info={INFO.plough} cites={CITE.plough} explode={[-0.6, 0, 0]}>
      <group position={[-1.75, 0, 0]}>
        <PartMesh geometry={g.frame} />
        <PartMesh geometry={g.standards} material="forged" />
        <Part id="root-plough-blade" name="Undercutting V-blade and fins" role="static" material="steelDark" info={INFO.plough} cites={CITE.plough}>
          <PartMesh geometry={g.blade} />
        </Part>
      </group>
    </Part>
  )
}

function StripMarks() {
  const unit = useMemo(() => box(1, 1, 1), [])
  const pole = useMemo(() => merge(cylinder(0.04, 2.2, 8).translate(0, 1.1, 0), box(0.5, 0.35, 0.02).translate(0.25, 2.0, 0)), [])
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => ref.current?.position.set(marker.x, heightAt(grid, marker.x, 0), 0))
  return (
    <Part id="count-strip" name="Tree-count strip (100 m × 10 m)" role="static" material="paintYellow" cut={false} info={INFO.strip} cites={[C.am('§11.2.2 tree count')]}>
      {[STRIP_HALF, -STRIP_HALF].map((z) => (
        <PartMesh key={z} geometry={unit} position={[0, 0.06, z]} scale={[PLOT.x1 - PLOT.x0, 0.05, 0.12]} />
      ))}
      {[PLOT.x0, PLOT.x1].map((x) => (
        <PartMesh key={x} geometry={unit} position={[x, 0.06, 0]} scale={[0.12, 0.05, 2 * STRIP_HALF]} />
      ))}
      <group ref={ref}>
        <PartMesh geometry={pole} material="paintRed" />
      </group>
    </Part>
  )
}

export function LandClearing3D() {
  const stage = useClearing((s) => s.stage)
  const method = useClearing((s) => s.method)
  useSimFrame((dt) => {
    if (dt > 0) step(Math.min(dt, 0.1))
  })
  const attach: Attach = stage === 'knockdown' ? (method === 'chain' ? 'none' : method === 'dozer' ? 'pusher' : 'shear') : stage === 'windrow' ? 'rake' : stage === 'till' ? 'straight' : 'straight'
  const showMachine = stage !== 'survey' && stage !== 'burn'
  const chain = stage === 'knockdown' && method === 'chain'
  const fireCol = '#ff8a2a'
  return (
    <group>
      <Part id="soil" name="Field soil" role="static" material="soil" cut={false} info={INFO.soil} cites={[C.bush('p1 — work to about 30 cm, preserve the topsoil')]}>
        <FieldGround grid={grid} margin={30} />
      </Part>
      <Trees />
      {stage === 'survey' && <StripMarks />}
      {showMachine && (
        <Crawler id="crawler" attach={attach} pose={P1}>
          {stage === 'till' && <RootPlough />}
        </Crawler>
      )}
      {chain && (
        <>
          <Crawler id="crawler-b" attach="none" pose={P2} />
          <Chain />
        </>
      )}
      <Particles
        max={FIRE}
        radius={0.35}
        color={fireCol}
        roughness={0.4}
        update={(set) => {
          let c = 0
          for (let i = 0; i < FIRE; i++) if (fire.life[i] > 0) set(c++, fire.x[i], fire.y[i], fire.z[i], Math.max(0.2, 1 - fire.age[i] / fire.life[i]) * 1.5)
          return c
        }}
      />
      {showMachine && <MovingLabel />}
    </group>
  )
}

function MovingLabel() {
  const ref = useRef<THREE.Group>(null)
  const stage = useClearing((s) => s.stage)
  useSimFrame(() => {
    ref.current?.position.set(P1.x, 0, P1.z)
    ref.current?.rotation.set(0, P1.yaw, 0)
  })
  return (
    <group ref={ref}>
      <PartLabel partId="crawler-blade" at={[2.6, 1.6, 1.2]} />
      <PartLabel partId="crawler" at={[-0.4, 3.4, 0]} />
      {stage === 'till' && <PartLabel partId="root-plough" at={[-3.6, 1.2, 1.2]} />}
    </group>
  )
}

/** Reset the field to the start of the chosen stage. */
export function enterStage() {
  const st = useClearing.getState()
  live.progress = 0
  lastStamp = NaN
  fire.life.fill(0)
  setupStage(st.stage, st.method, st.veg)
  if (st.stage === 'knockdown' && st.method === 'chain') P1.x = P2.x = RUN.x0 - 8
  else lanePose(0, P1)
  marker.x = PLOT.x0
}

