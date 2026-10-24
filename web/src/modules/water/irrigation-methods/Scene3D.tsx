import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, extrude, mat4, merge, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { SoilSurface } from '@/render/SoilSurface'
import { createSoil, roughen, stampRun, type SoilGrid } from '@/render/soil'
import { dripEmitter, gateValve, pipeRun, pumpSet, screenFilter, sprinklerHead, storageTank } from '@/parts/lib/water'
import { Particles, halfBulb, halfEllipseBar, hash, plantsGeometry } from '../_shared/fx'
import { ADV, BORDER, C, DRIP, FIELD, FURROW, SPRINK, SUB, frontX, live, phaseAt, recedeX, sprinklerCatch, useIrr, wetDepth, type IrrParams, type Method } from './model'

const { L, W } = FIELD
const X0 = -L / 2
const NS = 30
const DITCH_X = X0 - 0.55
const FURROWS = Array.from({ length: 23 }, (_, k) => (k - 11) * FURROW.spacing)
const BORDER_RIDGES = [-6.75, -2.25, 2.25, 6.75]
const BASIN_Z = [-4.5, 4.5]
const line = (a: [number, number, number], b: [number, number, number]) => new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b))
const EMITTERS = DRIP.laterals.flatMap((z) => Array.from({ length: 17 }, (_, k) => [DRIP.x0 + k * DRIP.dx, z] as [number, number]))

const INFO = {
  surface: { summary: 'Field surface.', role: 'Darker soil is wetted soil: watch the wetting front advance from the head (left) to the tail.' },
  soil: { summary: 'Soil profile.', role: 'Cut the field to see how deep the water has gone and where it sits relative to the root zone.' },
  wet: { summary: 'Wetted soil (within the root zone).', role: 'Water stored in the root zone — the useful part of the application.' },
  deep: { summary: 'Deep percolation.', role: 'Water that went below the root zone. With a linear head-to-tail profile it occurs at the head when the tail gets enough.', details: 'Shown with the depth profile falling linearly from head to tail, as in the efficiency problems.' },
  root: { summary: 'Bottom of the root zone.', role: 'Water below this line is lost to the crop (deep percolation).' },
  ditch: { summary: 'Head (supply) ditch.', role: 'Field ditch at the high end of the field. Water is turned on here and flows downslope.' },
  water: { summary: 'Surface water.', role: 'Ponded water in basins, the sheet down a border, or the stream in each furrow; it diminishes downslope as it infiltrates.' },
  crop: { summary: 'Crop.', role: 'Row crop on the ridges (furrows) or a close-growing crop (basins, borders).' },
  levees: { summary: 'Levees / ridges.', role: 'Basins: levees (bunds, dikes) around level plots. Borders: parallel earth ridges guiding the sheet of water. Furrows: ridges between the channels.' },
  pump: { summary: 'Pump unit.', role: 'Supplies the pressure for the sprinkler system — high pumping power is one of its drawbacks.' },
  mainline: { summary: 'Mainline.', role: 'Carries water from the pump to the laterals.' },
  laterals: { summary: 'Laterals.', role: 'Portable aluminium pipes laid at the start of the season and left in place (solid set), joined with quick couplers.' },
  heads: { summary: 'Risers and rotating sprinkler heads.', role: 'Each head sprays a circle; neighbouring circles overlap so the field is covered evenly.', details: 'Spacing and wetted radius are illustrative; the only sprinkler numbers in the study guide are a 20 × 20 ft spacing and a 3 gpm nozzle.' },
  control: { summary: 'Control head.', role: 'At the source: pump, screen/filter (small orifices plug), fertiliser injector, vacuum breaker / backflow valve to protect the source, automatic control valve and pressure regulator.' },
  dripMain: { summary: 'Main and manifold.', role: 'Carry filtered water from the control head to the laterals.' },
  dripLat: { summary: 'Plastic laterals with emitters.', role: 'Laterals usually lie on the surface (they can be buried). Emitters discharge 1–8 L/h at 0.15–2 atm.' },
  bulbs: { summary: 'Wetted bulbs.', role: 'Each emitter wets an onion-shaped bulb. Salt accumulates at its edge.' },
  drains: { summary: 'Tile drains / feeder pipes.', role: 'Fed from the supply ditch, they raise and hold the water table below the root zone.' },
  table: { summary: 'Water table.', role: 'Held at a controlled depth; capillarity carries water up into the root zone.' },
  fringe: { summary: 'Capillary fringe.', role: 'Water drawn up from the water table by capillarity. Salts rise with it — the salinity hazard.' },
}

/** Soil heightfield for the method (levees, border ridges or furrows). */
function buildGrid(method: Method): SoilGrid {
  const g = createSoil(L, W, FIELD.cell, X0, -W / 2)
  roughen(g, 0.008, 3)
  if (method === 'furrow') {
    const s = FURROW.spacing
    stampRun(g, X0, -X0, 0, W / 2, (dz) => FURROW.ridge * 0.5 * (1 - Math.cos((2 * Math.PI * dz) / s)), { disturb: 0, mode: 'add' })
  } else if (method === 'border') {
    const edges = [-W / 2, ...BORDER_RIDGES, W / 2]
    for (const zc of edges) stampRun(g, X0, -X0, zc, 0.45, (dz) => BORDER.ridge * Math.cos((dz / 0.9) * Math.PI) ** 2, { disturb: 0, mode: 'max' })
  } else if (method === 'basin') {
    for (const zc of [-W / 2, ...BASIN_Z, W / 2]) stampRun(g, X0, -X0, zc, 0.45, (dz) => 0.2 * Math.cos((dz / 0.9) * Math.PI) ** 2, { disturb: 0, mode: 'max' })
    // levees across the field (runs along Z): set directly
    for (const xc of [X0, 0, -X0])
      for (let k = 0; k < g.nz; k++)
        for (let i = 0; i < g.nx; i++) {
          const dx = g.x0 + i * g.cell - xc
          if (Math.abs(dx) < 0.45) g.height[k * g.nx + i] = Math.max(g.height[k * g.nx + i], 0.2 * Math.cos((dx / 0.9) * Math.PI) ** 2)
        }
  }
  g.version++
  return g
}

/** Wetness 0…1 of the surface at (x, z) for phase u. */
function surfaceWet(p: IrrParams, x: number, z: number, h: number, u: number) {
  switch (p.method) {
    case 'basin':
      return h > 0.1 ? 0.25 * Math.min(1, u / 0.2) : Math.min(1, u / 0.15)
    case 'border':
      return x < frontX(u) ? (h > 0.1 ? 0.35 : 1) : 0
    case 'furrow': {
      if (x > frontX(u)) return 0
      const d = Math.abs(z - Math.round(z / FURROW.spacing) * FURROW.spacing)
      const k = wetDepth(p, x, u) / Math.max(0.05, p.dHead)
      return d < 0.08 + 0.1 * k ? 1 : 0
    }
    case 'sprinkler':
      return Math.min(1, sprinklerCatch(x, z, p.wetRadius) * Math.min(1, u / 0.5))
    case 'drip': {
      const rs = 0.32 * Math.sqrt(Math.min(1, u))
      const zl = DRIP.laterals.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a))
      const xe = DRIP.x0 + Math.round((x - DRIP.x0) / DRIP.dx) * DRIP.dx
      if (xe < DRIP.x0 - 0.01 || xe > DRIP.x0 + 16 * DRIP.dx + 0.01) return 0
      return Math.hypot(x - xe, z - zl) < rs ? 1 : 0
    }
    case 'sub':
      return 0.15 * Math.min(1, u)
  }
}

/** Depth wetted along the section line z = 0 (for the slices). */
function sliceDepth(p: IrrParams, x: number, u: number) {
  if (p.method === 'sprinkler') return 0.75 * sprinklerCatch(x, 0, p.wetRadius) * Math.sqrt(Math.min(1, u / 0.6))
  return wetDepth(p, x, u)
}

export function Scene3D() {
  const st = useIrr()
  const method = st.method
  const grid = useMemo(() => buildGrid(method), [method])
  const surfaceMethod = method === 'basin' || method === 'border' || method === 'furrow'
  const slices = method === 'basin' || method === 'border' || method === 'sprinkler'
  const geo = useMemo(() => {
    const unitDown = xform(box(1, 1, 1), mat4.t(0.5, -0.5, 0))
    const ditchShape = new THREE.Shape([
      new THREE.Vector2(-0.5, 0.2),
      new THREE.Vector2(-0.5, -0.5),
      new THREE.Vector2(0.5, -0.5),
      new THREE.Vector2(0.5, 0.2),
      new THREE.Vector2(0.4, 0.2),
      new THREE.Vector2(0.4, -0.4),
      new THREE.Vector2(-0.4, -0.4),
      new THREE.Vector2(-0.4, 0.2),
    ])
    const ditch = xform(extrude(ditchShape, W + 1), mat4.t(DITCH_X, 0, -(W + 1) / 2))
    const ditchWater = xform(box(0.8, 0.35, W + 0.9), mat4.t(DITCH_X, -0.22, 0))
    const furrowWater = merge(...FURROWS.map((z) => xform(box(1, 0.05, 0.16), mat4.t(0.5, 0.03, z))))
    const strips = [-4.5, 0, 4.5, -7.9, 7.9].map((zc, i) => xform(box(1, 0.04, i < 3 ? 3.7 : 1.5), mat4.t(0.5, 0.03, zc)))
    const borderWater = merge(...strips)
    const basinWater = merge(
      ...[-7.5, 7.5].flatMap((xc) => [
        [-6.75, 4.1],
        [0, 8.2],
        [6.75, 4.1],
      ].map(([zc, w]) => xform(box(14.2, 1, w), mat4.t(xc, 0.5, zc)))),
    )
    const rowZ = method === 'furrow' ? FURROWS.slice(0, -1).map((z) => z + FURROW.spacing / 2) : Array.from({ length: 11 }, (_, k) => -7.5 + k * 1.5)
    const pts: [number, number][] = []
    for (const z of rowZ) for (let x = X0 + 0.6; x < -X0 - 0.3; x += method === 'furrow' ? 0.9 : 1.2) pts.push([x, z])
    const crop = plantsGeometry(pts, method === 'drip' ? 0.9 : 0.6, 0.14, method === 'furrow' ? FURROW.ridge : 0.02)
    return { unitDown, ditch, ditchWater, furrowWater, borderWater, basinWater, crop, bar: halfEllipseBar(), bulb: halfBulb(), root: box(L, 0.025, W) }
  }, [method])

  const sprinklerGeo = useMemo(() => {
    const main = pipeRun({ a: [X0 - 1.5, 0.12, -8.5], b: [SPRINK.xs[SPRINK.xs.length - 1], 0.12, -8.5], outer: 0.07, inner: 0.06 })
    const lats = merge(...SPRINK.xs.map((x) => pipeRun({ a: [x, 0.1, -8.5], b: [x, 0.1, 6.3], outer: 0.045, inner: 0.038 })))
    const risers = merge(...SPRINK.xs.flatMap((x) => SPRINK.zs.map((z) => xform(cylinder(0.02, SPRINK.riser, 10), mat4.t(x, SPRINK.riser / 2, z)))))
    const head = sprinklerHead()
    const ps = pumpSet({ motorR: 0.22, motorL: 0.7, pumpR: 0.22 })
    const pump = xform(ps.geometry, mat4.t(X0 - 2.3, 0, -8.5))
    return { main, lats, risers, head, pump }
  }, [])

  const dripGeo = useMemo(() => {
    const main = pipeRun({ a: [X0 + 1, 0.05, -8.4], b: [X0 + 1, 0.05, 6.4], outer: 0.04, inner: 0.032 })
    const lats = merge(...DRIP.laterals.map((z) => pipeRun({ a: [X0 + 1, 0.03, z], b: [DRIP.x0 + 16 * DRIP.dx + 0.4, 0.03, z], outer: 0.012, inner: 0.009 })))
    const emitter = dripEmitter()
    const emitters = merge(...EMITTERS.map(([x, z]) => xform(emitter, mat4.t(x, 0.03, z))))
    const filter = xform(screenFilter({ r: 0.18, h: 0.8 }), mat4.t(X0 - 1.2, 0, -8.4))
    const tank = xform(storageTank({ r: 0.3, h: 0.9, roofRise: 0.08, ring: false, segments: 20 }), mat4.t(X0 - 1.2, 0, -7.4))
    const valve = xform(gateValve({ size: 0.18 }), mat4.t(X0 - 0.3, 0.2, -8.4))
    const ps = pumpSet({ motorR: 0.16, motorL: 0.5, pumpR: 0.16 })
    const pump = xform(ps.geometry, mat4.t(X0 - 2.5, 0, -8.4))
    const pipes = pipeRun({ a: [X0 - 2.6, 0.2, -8.4], b: [X0 + 1, 0.2, -8.4], outer: 0.04, inner: 0.032 })
    return { main, lats, emitters, filter, tank, valve, pump, pipes }
  }, [])

  const subGeo = useMemo(() => merge(...SUB.drains.map((z) => pipeRun({ a: [X0 - 0.5, -SUB.depth, z], b: [-X0, -SUB.depth, z], outer: 0.06, inner: 0.05 }))), [])

  // refs
  const upper = useRef<(THREE.Mesh | null)[]>([])
  const lower = useRef<(THREE.Mesh | null)[]>([])
  const bars = useRef<(THREE.Mesh | null)[]>([])
  const bulbs = useRef<(THREE.Mesh | null)[]>([])
  const heads = useRef<(THREE.Group | null)[]>([])
  const sheet = useRef<THREE.Group>(null)
  const basinW = useRef<THREE.Group>(null)
  const table = useRef<THREE.Mesh>(null)
  const fringe = useRef<THREE.Mesh>(null)
  const clock = useRef({ t: 0, lastU: -1, method: '' as string })

  useSimFrame((dt) => {
    const p = useIrr.getState()
    const c = clock.current
    if (c.method !== p.method) {
      c.method = p.method
      c.t = 0
      c.lastU = -1
    }
    c.t += dt
    const u = phaseAt(c.t, p.cycle)
    const uu = Math.min(1, u)
    // surface paint (throttled)
    if (Math.abs(u - c.lastU) > 0.006 || u < c.lastU) {
      c.lastU = u
      let wet = 0
      for (let k = 0; k < grid.nz; k++) {
        const z = grid.z0 + k * grid.cell
        for (let i = 0; i < grid.nx; i++) {
          const j = k * grid.nx + i
          const w = surfaceWet(p, grid.x0 + i * grid.cell, z, grid.height[j], u)
          grid.disturbed[j] = w
          if (w > 0.5) wet++
        }
      }
      grid.version++
      live.wetFrac = wet / (grid.nx * grid.nz)
    }
    // subsurface slices
    if (slices) {
      for (let s = 0; s < NS; s++) {
        const x = X0 + ((s + 0.5) * L) / NS
        const d = sliceDepth(p, x, u)
        const a = upper.current[s]
        const b = lower.current[s]
        const du = Math.min(d, p.root)
        if (a) {
          a.visible = du > 0.005
          a.scale.set(L / NS, Math.max(0.001, du), W - 0.1)
        }
        if (b) {
          b.visible = d > p.root + 0.005
          b.position.y = -p.root
          b.scale.set(L / NS, Math.max(0.001, d - p.root), W - 0.1)
        }
      }
    }
    const fx = frontX(u)
    const rx = recedeX(u)
    if (method === 'furrow') {
      const len = fx - X0
      const xm = X0 + len / 2
      const d = wetDepth(p, xm, u)
      const half = 0.08 + 0.22 * d
      bars.current.forEach((m) => {
        if (!m) return
        m.visible = len > 0.05 && d > 0.01
        m.scale.set(Math.max(0.01, len), Math.max(0.01, d), Math.max(0.01, half))
      })
    }
    if (sheet.current) {
      const on = u < 1 && fx > rx + 0.05
      sheet.current.visible = on
      sheet.current.position.x = rx
      sheet.current.scale.x = Math.max(0.01, fx - rx)
    }
    if (basinW.current) {
      const level = u < 0.25 ? 0.15 * (u / 0.25) : Math.max(0, 0.15 * (1 - (u - 0.25) / 0.6))
      basinW.current.visible = level > 0.003
      basinW.current.scale.y = Math.max(0.001, level)
    }
    if (method === 'drip') {
      const k = Math.sqrt(uu)
      bulbs.current.forEach((m) => m?.scale.set(0.45 * k + 0.01, 0.85 * k + 0.01, 0.45 * k + 0.01))
    }
    if (method === 'sprinkler') heads.current.forEach((g, i) => g && (g.rotation.y += dt * (0.8 + 0.1 * hash(i)) * (u < 1 ? 1 : 0)))
    if (method === 'sub') {
      const wt = -2.3 + 1.2 * Math.min(1, u / 0.7)
      if (table.current) table.current.scale.y = wt + FIELD.soilDepth
      if (fringe.current) {
        fringe.current.position.y = wt
        fringe.current.scale.y = 0.55 * Math.min(1, u / 0.5) + 0.01
      }
    }
    live.u = u
    live.front = Math.max(0, Math.min(L, fx - X0))
    live.dHeadNow = sliceDepth(p, X0 + 0.25, u)
    live.dTailNow = sliceDepth(p, -X0 - 0.25, u)
    live.flowing = u < ADV.cutoff
  })

  // particles
  const flowK = () => (live.flowing ? 1 : 0)
  const ditchCurve = useMemo(() => line([DITCH_X, -0.1, -W / 2], [DITCH_X, -0.1, W / 2]), [])
  const surfParticles = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const u = live.u
    const fx = frontX(u)
    const rx = recedeX(u)
    if (u >= 1 || fx - rx < 0.1) return 0
    const r = hash(i)
    const s = (t * (0.18 + 0.1 * r) + r) % 1
    if (method === 'furrow') {
      const z = FURROWS[i % FURROWS.length]
      out.set(rx + s * (fx - rx), 0.07, z)
    } else if (method === 'border') {
      out.set(rx + s * (fx - rx), 0.07, -6 + 12 * hash(i + 99))
    } else {
      if (u > 0.3) return 0
      out.set(X0 + 0.5 + s * 14, 0.15, -8 + 16 * hash(i + 7))
    }
    return 1
  }
  const sprayParticles = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    if (live.u >= 1) return 0
    const h = i % 15
    const g = heads.current[h]
    const hx = SPRINK.xs[Math.floor(h / 3)]
    const hz = SPRINK.zs[h % 3]
    const s = (t * 0.6 + hash(i)) % 1
    const ang = (g?.rotation.y ?? 0) - s * 0.25
    const R = useIrr.getState().wetRadius * (0.85 + 0.15 * hash(i + 3))
    out.set(hx + Math.cos(ang) * s * R, SPRINK.riser + 0.1 + 4 * 1.2 * s * (1 - s) - s * 0.9, hz - Math.sin(ang) * s * R)
    return 0.7 + 0.3 * (1 - s)
  }
  const dripParticles = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    if (live.u >= 1) return 0
    const [x, z] = EMITTERS[i]
    const s = (t * 0.9 + hash(i)) % 1
    out.set(x, 0.05 - s * 0.05, z)
    return s < 0.8 ? 1 : 0
  }
  const capillary = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const u = live.u
    if (u < 0.2) return 0
    const wt = -2.3 + 1.2 * Math.min(1, u / 0.7)
    const s = (t * 0.25 + hash(i)) % 1
    out.set(X0 + 1 + hash(i + 1) * (L - 2), wt + s * 0.6, -0.15 + hash(i + 2) * 0.3)
    return 1 - s
  }

  return (
    <group>
      <Part id="field" name="Irrigated field" role="housing" material="soil" info={INFO.soil} cites={[C.ipp('p5–11')]}>
        <Part id="surface" name="Field surface" info={INFO.surface} cites={[C.ipp('p5–6')]} cut={false}>
          <SoilSurface grid={grid} color="#a7865f" tilled="#4a3322" depth={0.012} />
        </Part>
        <Part id="soil-profile" name="Soil profile" material="soil" info={INFO.soil} cites={[C.sg('p4 soil-water states')]}>
          <PartMesh geometry={geo.unitDown} position={[X0, -0.012, 0]} scale={[L, FIELD.soilDepth - 0.012, W]} />
        </Part>
        <Part id="root-zone" name="Root-zone depth" role="static" material="paintYellow" info={INFO.root} cites={[C.ipp('p3–5 root zone'), C.s1('Q3c root zone 1.8 m')]}>
          <PartMesh geometry={geo.root} position={[0, -st.root, 0]} />
        </Part>
        {slices ? (
          <>
            <Part id="wetted-zone" name="Wetted root zone" role="fluid" material="water" info={INFO.wet} cites={[C.ipp('p3–5 W_s'), C.s1('Q3c')]}>
              {Array.from({ length: NS }, (_, s) => (
                <PartMesh key={s} ref={(el) => void (upper.current[s] = el)} geometry={geo.unitDown} position={[X0 + (s * L) / NS, -0.013, 0]} visible={false} />
              ))}
            </Part>
            <Part id="deep-percolation" name="Deep percolation" role="fluid" material="coolant" info={INFO.deep} cites={[C.ipp('p3–5 application efficiency')]}>
              {Array.from({ length: NS }, (_, s) => (
                <PartMesh key={s} ref={(el) => void (lower.current[s] = el)} geometry={geo.unitDown} position={[X0 + (s * L) / NS, -st.root, 0]} visible={false} />
              ))}
            </Part>
          </>
        ) : null}
        {method === 'furrow' ? (
          <Part id="wetted-zone" name="Wetting bulbs under the furrows" role="fluid" material="water" info={{ ...INFO.wet, details: 'Bulbs spread laterally and downward from each furrow until they meet between furrows.' }} cites={[C.ipp('p5–6 furrows')]}>
            {FURROWS.map((z, k) => (
              <PartMesh key={k} ref={(el) => void (bars.current[k] = el)} geometry={geo.bar} position={[X0, 0.005, z]} visible={false} />
            ))}
          </Part>
        ) : null}
        {method === 'drip' ? (
          <Part id="wetted-zone" name="Wetted bulbs" role="fluid" material="water" info={INFO.bulbs} cites={[C.ipp('p6–7 drip; salt at the edge of the wetted zone')]}>
            {EMITTERS.map(([x, z], k) => (
              <PartMesh key={k} ref={(el) => void (bulbs.current[k] = el)} geometry={geo.bulb} position={[x, 0.0, z]} scale={0.01} />
            ))}
          </Part>
        ) : null}
        {method === 'sub' ? (
          <>
            <Part id="water-table" name="Controlled water table" role="fluid" material="water" info={INFO.table} cites={[C.ipp('p9–10 water-table control')]}>
              <PartMesh ref={table} geometry={geo.unitDown} position={[X0, -FIELD.soilDepth, 0]} rotation={[Math.PI, 0, 0]} scale={[L, 0.3, W - 0.1]} />
            </Part>
            <Part id="capillary-fringe" name="Capillary fringe" role="fluid" material="coolant" info={INFO.fringe} cites={[C.ipp('p9–10')]}>
              <PartMesh ref={fringe} geometry={geo.unitDown} position={[X0, -2.3, 0]} rotation={[Math.PI, 0, 0]} scale={[L, 0.01, W - 0.12]} />
            </Part>
            <Part id="tile-drains" name="Tile drains (feeders)" role="static" material="ceramic" info={INFO.drains} cites={[C.ipp('p9–10 ditches, mole or tile drains')]}>
              <PartMesh geometry={subGeo} />
            </Part>
            <Particles count={160} radius={0.035} color="#8fd3ff" update={capillary} />
            {SUB.drains.map((z) => (
              <Flow key={z} curve={line([X0 - 0.5, -SUB.depth, z], [-X0, -SUB.depth, z])} count={30} radius={0.04} color="#5ab4ff" speed={0.12} spread={0.03} intensity={() => (live.u < 0.8 ? 1 : 0.3)} />
            ))}
          </>
        ) : null}
      </Part>

      <Part id="crop" name="Crop" role="static" material="crop" info={INFO.crop} cites={[C.ipp('p1 purposes of irrigation')]} cut={false}>
        <PartMesh geometry={geo.crop} />
      </Part>

      {surfaceMethod || method === 'sub' ? (
        <Part id="head-ditch" name={method === 'sub' ? 'Supply ditch' : 'Head ditch'} role="housing" material="concrete" info={INFO.ditch} cites={[C.ipp('p5 water turned on at the high point')]}>
          <PartMesh geometry={geo.ditch} />
          <Part id="ditch-water" name="Ditch water" role="fluid" material="water" info={INFO.water}>
            <PartMesh geometry={geo.ditchWater} />
          </Part>
          <Flow curve={ditchCurve} count={60} radius={0.07} color="#5ab4ff" speed={0.15} spread={0.4} intensity={() => (method === 'sub' ? 0.6 : flowK())} />
        </Part>
      ) : null}

      {surfaceMethod ? (
        <Part id="surface-water" name={method === 'basin' ? 'Ponded water' : method === 'border' ? 'Sheet of water' : 'Furrow streams'} role="fluid" material="water" info={INFO.water} cites={[C.ipp('p5–6')]} cut={false}>
          {method === 'basin' ? (
            <group ref={basinW}>
              <PartMesh geometry={geo.basinWater} />
            </group>
          ) : (
            <group ref={sheet}>
              <PartMesh geometry={method === 'furrow' ? geo.furrowWater : geo.borderWater} />
            </group>
          )}
          <Particles count={method === 'furrow' ? 230 : 160} radius={0.05} color="#7cc4ff" update={surfParticles} />
        </Part>
      ) : null}

      {method === 'sprinkler' ? (
        <Part id="sprinkler-system" name="Solid-set sprinkler system" role="static" material="aluminium" info={INFO.laterals} cites={[C.ipp('p7–9, Fig. 2')]} cut={false}>
          <Part id="pump" name="Pump unit" material="paintBlue" info={INFO.pump} cites={[C.ipp('p7 parts of a sprinkler system')]}>
            <PartMesh geometry={sprinklerGeo.pump} />
          </Part>
          <Part id="mainline" name="Mainline" info={INFO.mainline} cites={[C.ipp('p7')]}>
            <PartMesh geometry={sprinklerGeo.main} />
          </Part>
          <Part id="laterals" name="Laterals" info={INFO.laterals} cites={[C.ipp('p8 solid set')]}>
            <PartMesh geometry={sprinklerGeo.lats} />
          </Part>
          <Part id="heads" name="Risers and heads" material="brass" info={INFO.heads} cites={[C.ipp('p7 risers, sprinkler heads'), C.sg('Ex 2')]} beyondNotes>
            <PartMesh geometry={sprinklerGeo.risers} material="galvanised" />
            {SPRINK.xs.flatMap((x) =>
              SPRINK.zs.map((z, j) => {
                const k = SPRINK.xs.indexOf(x) * 3 + j
                return (
                  <group key={k} ref={(el) => void (heads.current[k] = el)} position={[x, SPRINK.riser, z]} rotation={[0, hash(k) * 6.28, 0]}>
                    <PartMesh geometry={sprinklerGeo.head} />
                  </group>
                )
              }),
            )}
          </Part>
          <Flow curve={line([X0 - 1.5, 0.12, -8.5], [12, 0.12, -8.5])} count={50} radius={0.06} color="#5ab4ff" speed={0.25} spread={0.02} intensity={() => (live.u < 1 ? 1 : 0)} />
          {SPRINK.xs.map((x) => (
            <Flow key={x} curve={line([x, 0.1, -8.5], [x, 0.1, 6.3])} count={24} radius={0.04} color="#5ab4ff" speed={0.3} spread={0.01} intensity={() => (live.u < 1 ? 1 : 0)} />
          ))}
          <Particles count={15 * 16} radius={0.06} color="#bfe6ff" update={sprayParticles} opacity={0.75} />
        </Part>
      ) : null}

      {method === 'drip' ? (
        <Part id="drip-system" name="Drip (trickle) system" role="static" material="plastic" info={INFO.dripLat} cites={[C.ipp('p6–7, Fig. 1'), C.sg('p5–9')]} cut={false}>
          <Part id="control-head" name="Control head" material="paintBlue" info={INFO.control} cites={[C.ipp('p7 components 1–6')]}>
            <PartMesh geometry={dripGeo.pump} material="paintGreen" />
            <PartMesh geometry={dripGeo.filter} />
            <PartMesh geometry={dripGeo.tank} material="paintGrey" />
            <PartMesh geometry={dripGeo.valve} material="brass" />
            <PartMesh geometry={dripGeo.pipes} />
          </Part>
          <Part id="drip-main" name="Main / manifold" info={INFO.dripMain} cites={[C.ipp('Fig. 1')]}>
            <PartMesh geometry={dripGeo.main} />
          </Part>
          <Part id="drip-laterals" name="Laterals and emitters" info={INFO.dripLat} cites={[C.ipp('p6 emitters 1–8 L/h at 0.15–2 atm')]}>
            <PartMesh geometry={dripGeo.lats} />
            <PartMesh geometry={dripGeo.emitters} material="nylon" />
          </Part>
          <Flow curve={line([X0 + 1, 0.05, -8.4], [X0 + 1, 0.05, 6.4])} count={30} radius={0.035} color="#5ab4ff" speed={0.25} spread={0.01} intensity={() => (live.u < 1 ? 1 : 0)} />
          {DRIP.laterals.map((z) => (
            <Flow key={z} curve={line([X0 + 1, 0.03, z], [DRIP.x0 + 16 * DRIP.dx, 0.03, z])} count={30} radius={0.014} color="#5ab4ff" speed={0.15} spread={0.002} intensity={() => (live.u < 1 ? 1 : 0)} />
          ))}
          <Particles count={EMITTERS.length} radius={0.025} color="#9fd8ff" update={dripParticles} />
        </Part>
      ) : null}

      <PartLabel partId="soil-profile" at={[X0 + 3, -1.4, W / 2 + 0.3]} />
      <PartLabel partId="root-zone" at={[-X0 - 3, -st.root, W / 2 + 0.3]} />
      {method !== 'sub' ? <PartLabel partId="wetted-zone" at={[X0 + 6, -0.6, 0.3]} /> : null}
      <PartLabel partId="crop" at={[4, 1.2, -4]} />
      {surfaceMethod ? <PartLabel partId="surface-water" at={[-6, 0.8, 1.5]} /> : null}
      {surfaceMethod || method === 'sub' ? <PartLabel partId="head-ditch" at={[DITCH_X, 0.9, -6]} /> : null}
      {slices ? <PartLabel partId="deep-percolation" at={[X0 + 2, -st.root - 0.3, 0.3]} /> : null}
      {method === 'sprinkler' ? (
        <>
          <PartLabel partId="heads" at={[0, SPRINK.riser + 0.6, 0]} />
          <PartLabel partId="laterals" at={[6, 0.6, -4]} />
          <PartLabel partId="pump" at={[X0 - 2, 1, -8.5]} />
        </>
      ) : null}
      {method === 'drip' ? (
        <>
          <PartLabel partId="control-head" at={[X0 - 1.2, 1.3, -8]} />
          <PartLabel partId="drip-laterals" at={[2, 0.5, 3]} />
        </>
      ) : null}
      {method === 'sub' ? (
        <>
          <PartLabel partId="tile-drains" at={[0, -SUB.depth, 2]} />
          <PartLabel partId="water-table" at={[6, -1.2, 0.3]} />
        </>
      ) : null}
    </group>
  )
}
