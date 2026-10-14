import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, extrude, lathe, mat4, merge, pipe, xform, type V2 } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { pipeRun, wellCasing, wellPumpHead, wellScreen } from '@/parts/lib/water'
import { Particles, hash } from '../_shared/fx'
import { C, live, useWells, wellOf, type WellParams } from './model'

/** Aquifer drawn to a display scale: R → DR metres across, H → HD metres up (labels give real values). */
const DR = 24
const ROUT = DR + 4
const HD = 12
const RWD = 0.35
const STEPS = 20
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

const INFO = {
  unsat: { summary: 'Unsaturated zone.', role: 'Soil water, intermediate water and the capillary fringe above the water table.' },
  sat: { summary: 'Saturated aquifer (unconfined).', role: 'Gravity (water-table) aquifer: the well penetrates the water table and the water is not under pressure. Pumping draws an inverted cone of depression; R is where the drawdown is zero.', details: 'Gravel and sand are good aquifers (specific yield 22–25 %, high permeability).' },
  confAq: { summary: 'Confined (artesian) aquifer.', role: 'Pervious stratum between impervious beds, under pressure: the level in a well rises above the bottom of the confining bed. It stays saturated while pumped — only the pressure (piezometric) surface falls.' },
  confining: { summary: 'Confining bed (clay).', role: 'Impervious stratum above the aquifer.' },
  base: { summary: 'Impervious base.', role: 'Lower boundary of the aquifer (clay, dense rock).' },
  piezo: { summary: 'Piezometric surface.', role: 'Level water would rise to in wells tapping the confined aquifer; it is drawn down into a cone round the pumped well.' },
  well: { summary: 'Pumped well.', role: 'Casing with a screen in the aquifer. Q = πK(H² − h_w²)/ln(R/r_w) (gravity well) or Q = 2πKd(H − h_w)/ln(R/r_w) (artesian well).', details: 'The level just outside the casing is a little higher than inside (well loss / seepage face).' },
  obs: { summary: 'Observation wells.', role: 'Drawdowns s₁, s₂ at r₁, r₂ give K = Q ln(r₂/r₁)/[π(h₂² − h₁²)] and the transmissibility T = KH.' },
  pump: { summary: 'Pump and discharge.', role: 'Delivers Q; the cone grows until the inflow at R balances it (steady state).' },
  dam: { summary: 'Embankment (earth dam).', role: 'Built of impervious fill across the valley; protected against waves, burrowing animals and livestock.' },
  pond: { summary: 'Pond storage.', role: 'Storage = needs ÷ (1 − losses): 40–60 % of the total may go to seepage, evaporation (≈ 0.7 × pan) and other non-usable losses. The level falls through the season as water is used.' },
  spill: { summary: 'Principal spillway.', role: 'Riser and barrel through the dam pass normal excess flow; an emergency spillway around the end of the dam passes floods.' },
  emergency: { summary: 'Emergency (flood) spillway.', role: 'Vegetated channel round the end of the dam for large floods.' },
  drain: { summary: 'Drain pipe.', role: 'Lets a large pond be emptied for repairs.' },
  sediment: { summary: 'Sediment pool.', role: 'Allowance for sediment; diverting surface water away reduces it.' },
  seep: { summary: 'Seepage line.', role: 'Phreatic line through the embankment.' },
}

function profiles(p: WellParams, k: number) {
  const w = wellOf(p)
  const sy = HD / p.H
  const pts: V2[] = []
  const N = 28
  for (let i = 0; i <= N; i++) {
    const r = p.rw * Math.pow(p.R / p.rw, i / N)
    const rd = RWD + ((r - p.rw) * (DR - RWD)) / (p.R - p.rw)
    const h = p.H - (p.pumping ? k : 0) * (p.H - w.head(r))
    pts.push([rd, h * sy])
  }
  return pts
}

export function Scene3D() {
  const st = useWells()
  const w = useMemo(() => wellOf(st), [st])
  const sy = HD / st.H
  const confined = st.mode === 'confined'
  const dD = Math.min(HD - 1, st.d * sy)
  const G = confined ? Math.max(HD, dD + 1.5) + 1.2 : HD + 2.5
  const cache = useMemo(() => new Map<number, { sat: THREE.BufferGeometry; unsat: THREE.BufferGeometry }>(), [st.K, st.H, st.sw, st.R, st.rw, st.d, st.mode, st.pumping]) // eslint-disable-line react-hooks/exhaustive-deps
  const getStep = (i: number) => {
    let g = cache.get(i)
    if (g) return g
    const pr = profiles(st, i / STEPS)
    const yw = pr[0][1]
    if (confined) {
      const lower = pr.map(([r, y]) => [r, y - 0.05] as V2)
      const upper = pr.map(([r, y]) => [r, y + 0.05] as V2).reverse()
      g = { sat: lathe([...lower, [ROUT, HD - 0.05], [ROUT, HD + 0.05], [DR, HD + 0.05], ...upper.slice(1)], 48), unsat: lathe([[RWD, yw], [RWD, yw + 0.01]], 4) }
    } else {
      const desc = pr.slice().reverse()
      g = { sat: lathe([[RWD, 0], [ROUT, 0], [ROUT, HD], ...desc], 64), unsat: lathe([...pr, [ROUT, HD], [ROUT, G], [RWD, G]], 64) }
    }
    cache.set(i, g)
    return g
  }
  const satRef = useRef<THREE.Mesh>(null)
  const unsatRef = useRef<THREE.Mesh>(null)
  const wellWater = useRef<THREE.Mesh>(null)
  const obs = useRef<(THREE.Mesh | null)[]>([])
  const clock = useRef({ t: 0, key: '', step: -1, season: 0 })

  const geo = useMemo(() => {
    const base = lathe([[0, -2], [ROUT, -2], [ROUT, 0], [0, 0]], 64)
    const confAq = lathe([[RWD, 0], [ROUT, 0], [ROUT, dD], [RWD, dD]], 64)
    const confining = lathe([[RWD, dD], [ROUT, dD], [ROUT, dD + 1.5], [RWD, dD + 1.5]], 64)
    const top = lathe([[RWD, dD + 1.5], [ROUT, dD + 1.5], [ROUT, G], [RWD, G]], 64)
    const casing = wellCasing({ r: RWD, length: G + 0.6 })
    const screenY = confined ? dD / 2 : HD * 0.3
    const screen = xform(wellScreen({ r: RWD, length: confined ? dD * 0.9 : HD * 0.5 }), mat4.t(0, screenY, 0))
    const pump = xform(wellPumpHead({ w: 1, h: 0.7, motorR: 0.3, motorL: 0.7 }), mat4.t(0, G + 0.6, 0))
    const discharge = new THREE.CatmullRomCurve3([v3(0.5, G + 0.9, 0), v3(2, G + 0.9, 0), v3(3.5, G + 0.5, 0)])
    const dpipe = pipe(discharge, 0.14, 0.11)
    const obsR = [st.r1, st.r2].map((r) => RWD + ((r - st.rw) * (DR - RWD)) / (st.R - st.rw))
    const obsTubes = merge(...obsR.map((r) => xform(wellCasing({ r: 0.16, t: 0.05, length: G + 0.4 }), mat4.t(-r, 0, 0))))
    const unitCyl = xform(cylinder(1, 1, 20), mat4.t(0, 0.5, 0))
    return { base, confAq, confining, top, casing, screen, pump, discharge, dpipe, obsR, obsTubes, unitCyl }
  }, [dD, G, confined, st.r1, st.r2, st.rw, st.R])

  const radial = useMemo(() => {
    const pr = profiles(st, 1)
    return Array.from({ length: 8 }, (_, j) => {
      const a = (j / 8) * Math.PI * 2 + 0.2
      const pts = pr
        .filter((_, i) => i % 4 === 0)
        .reverse()
        .map(([r, y]) => v3(Math.cos(a) * r, confined ? dD * 0.5 : y * 0.5, Math.sin(a) * r))
      return new THREE.CatmullRomCurve3(pts)
    })
  }, [st, confined, dD])

  // pond
  const pondGeo = useMemo(() => {
    const valley = new THREE.Shape([new THREE.Vector2(-22, -2), new THREE.Vector2(22, -2), new THREE.Vector2(22, 6), new THREE.Vector2(18, 6), new THREE.Vector2(0, 0), new THREE.Vector2(-18, 6), new THREE.Vector2(-22, 6)])
    const ground = xform(extrude(valley, 70), mat4.c(mat4.t(-40, 0, 0), mat4.ry(Math.PI / 2)))
    const damShape = new THREE.Shape([new THREE.Vector2(-2, 0), new THREE.Vector2(26, 0), new THREE.Vector2(14, 6.2), new THREE.Vector2(10, 6.2)])
    const dam = xform(extrude(damShape, 40), mat4.t(0, 0, -20))
    const tri = new THREE.Shape([new THREE.Vector2(-3, 1), new THREE.Vector2(0, 0), new THREE.Vector2(3, 1)])
    const water = xform(extrude(tri, 50), mat4.c(mat4.t(-39, 0.01, 0), mat4.ry(Math.PI / 2)))
    const sediment = xform(extrude(tri, 40), mat4.c(mat4.t(-30, 0.005, 0), mat4.ry(Math.PI / 2)))
    const riser = pipeRun({ a: [5, 0, 0], b: [5, 4.5, 0], outer: 0.45, inner: 0.35 })
    const barrel = pipeRun({ a: [5, 0.4, 0], b: [29, 0.4, 0], outer: 0.35, inner: 0.28 })
    const drain = pipeRun({ a: [-1, 0.15, 1.2], b: [29, 0.15, 1.2], outer: 0.15, inner: 0.11 })
    const emergency = xform(box(28, 0.3, 3), mat4.t(12, 5.4, 17))
    const seep = xform(box(17, 0.08, 39.6), mat4.c(mat4.t(17, 2.6, 0), mat4.rz(-0.28)))
    return { ground, dam, water, sediment, riser, barrel, drain, emergency, seep }
  }, [])
  const pondWater = useRef<THREE.Group>(null)

  useSimFrame((dt) => {
    const p = useWells.getState()
    const c = clock.current
    const key = `${p.mode}|${p.pumping}|${p.K}|${p.H}|${p.sw}|${p.R}|${p.rw}|${p.d}`
    if (key !== c.key) {
      c.key = key
      c.t = 0
      c.step = -1
    }
    c.t += dt
    const k = 1 - Math.exp(-c.t / 3)
    const step = Math.min(STEPS, Math.round(k * STEPS))
    if (step !== c.step && p.mode !== 'pond') {
      c.step = step
      const g = getStep(step)
      if (satRef.current) satRef.current.geometry = g.sat
      if (unsatRef.current) unsatRef.current.geometry = g.unsat
    }
    const kk = p.pumping ? k : 0
    const syy = HD / p.H
    if (wellWater.current) wellWater.current.scale.set(RWD - 0.08, Math.max(0.01, (p.H - kk * p.sw) * syy), RWD - 0.08)
    ;[p.r1, p.r2].forEach((r, i) => {
      const m = obs.current[i]
      if (m) m.scale.set(0.1, Math.max(0.01, (p.H - kk * (p.H - w.head(r))) * syy), 0.1)
    })
    live.k = kk
    // pond season: used down to the non-usable fraction, then refilled
    c.season = (c.season + dt / p.season) % 1
    const u = c.season
    const f = u < 0.75 ? 1 - (1 - p.loss) * (u / 0.75) : p.loss + (1 - p.loss) * ((u - 0.75) / 0.25)
    live.vol = f
    if (pondWater.current) {
      const L = 4.8 * Math.sqrt(f)
      pondWater.current.scale.set(1, L, L)
    }
  })

  const evap = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const s = (t * 0.15 + hash(i)) % 1
    const L = 4.8 * Math.sqrt(live.vol)
    out.set(-36 + hash(i + 1) * 40, L + s * 4, (hash(i + 2) - 0.5) * 5 * L)
    return 1 - s
  }

  if (st.mode === 'pond')
    return (
      <group>
        <Part id="valley" name="Valley ground" role="housing" material="soil" info={INFO.dam} cites={[C.wrd('p2–3 on-stream pond: dam across a valley')]}>
          <PartMesh geometry={pondGeo.ground} />
        </Part>
        <Part id="dam" name="Embankment" role="housing" material="soil" info={INFO.dam} cites={[C.wrd('p3 site requirements')]}>
          <PartMesh geometry={pondGeo.dam} />
          <Part id="seepage-line" name="Seepage line" role="fluid" material="coolant" info={INFO.seep}>
            <PartMesh geometry={pondGeo.seep} />
          </Part>
        </Part>
        <Part id="pond-water" name="Stored water" role="fluid" material="water" info={INFO.pond} cites={[C.wrd('p3–4 storage, Table 1')]}>
          <group ref={pondWater}>
            <PartMesh geometry={pondGeo.water} />
          </group>
        </Part>
        <Part id="sediment" name="Sediment pool" role="static" material="soil" info={INFO.sediment} cites={[C.wrd('p3 sedimentation allowance')]}>
          <PartMesh geometry={pondGeo.sediment} scale={[1, 0.8, 0.8]} />
        </Part>
        <Part id="spillway" name="Principal spillway" role="static" material="concrete" info={INFO.spill} cites={[C.wrd('p3 mechanical and flood spillways')]}>
          <PartMesh geometry={pondGeo.riser} />
          <PartMesh geometry={pondGeo.barrel} />
          <Flow curve={new THREE.LineCurve3(v3(5, 0.4, 0), v3(29, 0.4, 0))} count={30} radius={0.2} color="#5ab4ff" speed={0.3} spread={0.1} intensity={() => (live.vol > 0.97 ? 1 : 0)} />
        </Part>
        <Part id="emergency-spillway" name="Emergency spillway" role="static" material="crop" info={INFO.emergency} cites={[C.wrd('p3')]}>
          <PartMesh geometry={pondGeo.emergency} />
        </Part>
        <Part id="drain-pipe" name="Drain pipe" role="static" material="steelDark" info={INFO.drain} cites={[C.wrd('p3 drain pipe on large ponds')]}>
          <PartMesh geometry={pondGeo.drain} />
        </Part>
        <Particles count={120} radius={0.12} color="#e8f4ff" update={evap} opacity={0.4} />
        <PartLabel partId="dam" at={[12, 7.5, -8]} />
        <PartLabel partId="pond-water" at={[-20, 5.5, 0]} />
        <PartLabel partId="spillway" at={[5, 5.5, 0]} />
        <PartLabel partId="emergency-spillway" at={[12, 6.5, 17]} />
        <PartLabel partId="sediment" at={[-25, 1.2, 0]} />
      </group>
    )

  const first = getStep(0)
  return (
    <group>
      <Part id="base" name="Impervious base" role="housing" material="concrete" info={INFO.base} cites={[C.wrd('Fig. 3–4')]}>
        <PartMesh geometry={geo.base} />
      </Part>
      {confined ? (
        <>
          <Part id="aquifer" name="Confined aquifer" role="fluid" material="water" info={INFO.confAq} cites={[C.wrd('p5–6 artesian wells, Fig. 4')]}>
            <PartMesh geometry={geo.confAq} />
          </Part>
          <Part id="confining-bed" name="Confining bed" role="housing" material="soil" info={INFO.confining} cites={[C.wrd('p6 artesian conditions')]}>
            <PartMesh geometry={geo.confining} material="paintGrey" />
          </Part>
          <Part id="overburden" name="Overburden" role="housing" material="soil" info={INFO.unsat} cites={[C.wrd('Fig. 1')]}>
            <PartMesh geometry={geo.top} />
          </Part>
          <Part id="piezometric" name="Piezometric surface" role="static" material="glass" info={INFO.piezo} cites={[C.wrd('Fig. 2, Fig. 4')]} cut={false}>
            <PartMesh ref={satRef} geometry={first.sat} />
          </Part>
        </>
      ) : (
        <>
          <Part id="aquifer" name="Saturated zone" role="fluid" material="water" info={INFO.sat} cites={[C.wrd('p5–6 gravity wells, Fig. 3')]}>
            <PartMesh ref={satRef} geometry={first.sat} />
          </Part>
          <Part id="unsaturated" name="Unsaturated zone" role="housing" material="soil" info={INFO.unsat} cites={[C.wrd('Fig. 1')]}>
            <PartMesh ref={unsatRef} geometry={first.unsat} />
          </Part>
        </>
      )}
      <Part id="well" name="Pumped well" role="static" material="steel" info={INFO.well} cites={[C.wrd('p6–8 well hydraulics'), C.s1('Q3d, Q4c')]} cut={false}>
        <PartMesh geometry={geo.casing} />
        <PartMesh geometry={geo.screen} material="galvanised" />
        <Part id="well-water" name="Water in the well" role="fluid" material="water" info={INFO.well}>
          <PartMesh ref={wellWater} geometry={geo.unitCyl} />
        </Part>
      </Part>
      <Part id="pump" name="Pump and discharge" role="static" material="paintBlue" info={INFO.pump} cites={[C.wrd('p6 cone of depression')]} cut={false}>
        <PartMesh geometry={geo.pump} />
        <PartMesh geometry={geo.dpipe} material="galvanised" />
        <Flow curve={geo.discharge} count={20} radius={0.1} color="#5ab4ff" speed={0.5} spread={0.04} intensity={() => (useWells.getState().pumping ? 1 : 0)} />
      </Part>
      <Part id="obs-wells" name="Observation wells" role="static" material="plastic" info={INFO.obs} cites={[C.s1('Q4d'), C.s2('Q4d')]} cut={false}>
        <PartMesh geometry={geo.obsTubes} />
        {geo.obsR.map((r, i) => (
          <PartMesh key={i} ref={(el) => void (obs.current[i] = el)} geometry={geo.unitCyl} material="water" position={[-r, 0, 0]} />
        ))}
      </Part>
      {radial.map((c, i) => (
        <Flow key={i} curve={c} count={24} radius={0.12} color="#9fd8ff" speed={0.08} spread={0.3} intensity={() => (useWells.getState().pumping ? 1 : 0)} />
      ))}
      <PartLabel partId="well" at={[0, G + 2.6, 0]} />
      <PartLabel partId="aquifer" at={[DR * 0.7, confined ? dD * 0.5 : HD * 0.5, ROUT * 0.5]} />
      <PartLabel partId="obs-wells" at={[-geo.obsR[1], G + 1, 0]} />
      <PartLabel partId="base" at={[ROUT * 0.7, -1, ROUT * 0.5]} />
      {confined ? <PartLabel partId="piezometric" at={[DR * 0.8, HD + 0.6, 0]} /> : <PartLabel partId="unsaturated" at={[DR * 0.7, G - 0.6, ROUT * 0.5]} />}
    </group>
  )
}
