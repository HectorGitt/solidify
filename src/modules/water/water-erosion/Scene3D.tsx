import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, mat4, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { SoilSurface } from '@/render/SoilSurface'
import { createSoil, roughen, type SoilGrid } from '@/render/soil'
import { Particles, hash, plantsGeometry } from '../_shared/fx'
import { C, live, terraceOf, useErosion, type ErosionParams } from './model'

/** Field frame (inside the tilted group): X downslope 30 m, Z across 16 m, surface at y ≈ 0. */
const FL = 30
const FW = 16
const X0 = -FL / 2
const TERR_X = [-6, 4]
const RILLS = [-6.2, -3.9, -1.3, 1.6, 4.4, 6.6]
const GULLY_Z = -1.5
const OUTLET_Z = FW / 2 - 1

const INFO = {
  field: { summary: 'Sloping field.', role: 'Erosion is detachment plus transport. Darker soil marks where soil has been removed.' },
  block: { summary: 'Soil profile.', role: 'Cut to see the depth of rills, the gully and the terrace channel.' },
  rain: { summary: 'Rain.', role: 'Raindrop impact detaches soil (splash). Erosivity R = EI30: storm kinetic energy × the maximum 30-minute intensity, summed over the year.' },
  splash: { summary: 'Splash.', role: 'On sloping land (and with wind-driven rain) more soil is splashed downhill or downwind. Cover and mulch absorb the impact.' },
  runoff: { summary: 'Runoff.', role: 'Sheet flow removes a thin uniform layer (sheet and interrill erosion); flow concentrating in small channels cuts rills; rills that grow too large to remove by tillage become gullies.' },
  terrace: { summary: 'Diversion terraces.', role: 'Broad channels and embankments across the slope intercept runoff and carry it at a safe velocity to a protected outlet. They shorten the slope length, stop gullies and settle sediment.', details: 'Channel sized like a waterway: a = Q/v, Zd² + bd − a = 0, s = (vn/R^(2/3))².' },
  outlet: { summary: 'Grassed outlet.', role: 'Protected outlet (a grassed waterway) receiving the terrace flow.' },
  crop: { summary: 'Crop strips.', role: 'Strip cropping: dense strips on the contour trap sediment from the tilled strips (P = 0.25). C-factor reflects the crop cover.' },
}

function heightsFor(g: SoilGrid, p: ErosionParams, k: number, base: Float32Array) {
  const terr = p.practice === 'terrace' || p.practice === 'terraceUnderground'
  const contour = p.practice === 'contour' || p.practice === 'strip'
  const tr = terraceOf(p)
  let eroded = 0
  for (let j = 0; j < g.nz; j++) {
    const z = g.z0 + j * g.cell
    for (let i = 0; i < g.nx; i++) {
      const x = g.x0 + i * g.cell
      let h = base[j * g.nx + i]
      let cut = 0
      // distance downslope since the last terrace (slope length reset)
      const xs = terr ? x - Math.max(X0, ...TERR_X.filter((t) => t < x)) : x - X0
      const conc = Math.min(1, xs / 18) * (contour ? 0.35 : 1) * (terr ? 0.5 : 1)
      if (p.stage !== 'splash') cut += 0.02 * k * (0.3 + conc)
      if (p.stage === 'rill' || p.stage === 'gully')
        for (const zr of RILLS) {
          const zc = zr + 0.4 * Math.sin(x * 0.45 + zr)
          const dz = Math.abs(z - zc)
          const w = 0.12 + 0.12 * conc
          if (dz < w) cut += 0.14 * k * conc * Math.cos((dz / w) * (Math.PI / 2))
        }
      if (p.stage === 'gully' && !terr) {
        const head = FL / 2 - k * 20
        if (x > head) {
          const zc = GULLY_Z + 0.6 * Math.sin(x * 0.3)
          const dz = Math.abs(z - zc)
          const dep = Math.min(1.1, (x - head) * 0.12) * k
          const w = 0.6 + dep
          if (dz < w) cut = Math.max(cut, dep * (dz < 0.35 * w ? 1 : (w - dz) / (0.65 * w)))
        }
      }
      if (contour) h += 0.05 * Math.max(0, Math.cos((x / 0.75) * Math.PI * 2))
      if (terr)
        for (const xt of TERR_X) {
          const dc = x - (xt - 1.4)
          const ch = Math.abs(dc) < tr.T / 2 ? -Math.min(tr.D, Math.max(0, (tr.T / 2 - Math.abs(dc)) / p.tZ)) : 0
          const ridge = Math.abs(x - (xt + 1.6)) < 1.6 ? 0.45 * Math.cos(((x - (xt + 1.6)) / 3.2) * Math.PI) ** 2 : 0
          h += ch + ridge
        }
      h -= cut
      g.height[j * g.nx + i] = h
      g.disturbed[j * g.nx + i] = Math.min(1, cut * 8)
      eroded += cut
    }
  }
  g.version++
  return (eroded * g.cell * g.cell) / (FL * FW)
}

export function Scene3D() {
  const st = useErosion()
  const grid = useMemo(() => {
    const g = createSoil(FL, FW, 0.12, X0, -FW / 2)
    roughen(g, 0.012, 7)
    return g
  }, [])
  const base = useMemo(() => grid.height.slice(), [grid])
  const theta = Math.atan(st.sPct / 100)
  const terr = st.practice === 'terrace' || st.practice === 'terraceUnderground'
  const tr = terraceOf(st)
  const geo = useMemo(() => {
    const unitDown = xform(box(1, 1, 1), mat4.t(0, -0.5, 0))
    const pts: [number, number][] = []
    if (st.practice === 'strip') for (let x = X0 + 0.4; x < -X0; x += 0.5) if (Math.floor((x - X0) / 5) % 2 === 0) for (let z = -FW / 2 + 0.3; z < FW / 2; z += 0.5) pts.push([x, z])
    const crop = pts.length ? plantsGeometry(pts, 0.45, 0.12, 0.02) : null
    const outlet = plantsGeometry(
      Array.from({ length: 160 }, (_, i) => [X0 + 0.3 + hash(i) * (FL - 0.6), OUTLET_Z + 0.2 + hash(i + 9) * 1.4] as [number, number]),
      0.3,
      0.08,
      0.0,
    )
    return { unitDown, crop, outlet }
  }, [st.practice])
  const clock = useRef({ t: 0, key: '', last: -1 })

  useSimFrame((dt) => {
    const p = useErosion.getState()
    const c = clock.current
    const key = `${p.stage}|${p.practice}|${p.tb}|${p.tZ}|${p.tQ}|${p.tv}`
    if (key !== c.key) {
      c.key = key
      c.t = 0
      c.last = -1
    }
    c.t += dt * p.speed
    const k = Math.min(1, c.t / 25)
    if (Math.abs(k - c.last) > 0.01) {
      c.last = k
      live.eroded = heightsFor(grid, p, k, base)
    }
    live.progress = k
  })

  // particles (field frame)
  const rain = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const s = (t * 0.9 + hash(i)) % 1
    out.set(X0 + hash(i + 1) * FL, 8 * (1 - s), -FW / 2 + hash(i + 2) * FW)
    return 1
  }
  const splash = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const cyc = Math.floor(t * 1.5 + hash(i))
    const s = (t * 1.5 + hash(i)) % 1
    const x0 = X0 + hash(cyc * 31 + (i >> 3)) * FL
    const z0 = -FW / 2 + hash(cyc * 17 + (i >> 3) + 5) * FW
    const ang = (i % 8) * (Math.PI / 4)
    const r = 0.25 * s
    const bias = Math.cos(ang) > 0 ? 1 + 4 * (st.sPct / 100) * 3 : 1 - 4 * (st.sPct / 100) * 2
    out.set(x0 + Math.cos(ang) * r * bias, 0.02 + 0.6 * s * (1 - s), z0 + Math.sin(ang) * r)
    return 1 - s * 0.5
  }
  const sheet = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const st2 = useErosion.getState().stage
    if (st2 === 'splash') return 0
    const s = (t * 0.12 + hash(i)) % 1
    let z = -FW / 2 + hash(i + 3) * FW
    if ((st2 === 'rill' || st2 === 'gully') && i % 3 !== 0) {
      const zr = RILLS[i % RILLS.length]
      const x = X0 + s * FL
      z = zr + 0.4 * Math.sin(x * 0.45 + zr)
    }
    const x = X0 + s * FL
    out.set(x, 0.04, z)
    return 1
  }
  const terraceFlows = useMemo(
    () => TERR_X.map((xt) => new THREE.CatmullRomCurve3([new THREE.Vector3(xt - 1.4, -tr.D + tr.d * 0.6, -FW / 2), new THREE.Vector3(xt - 1.4, -tr.D + tr.d * 0.6, OUTLET_Z), new THREE.Vector3(xt + 3, -0.1, OUTLET_Z + 0.8)])),
    [tr.D, tr.d],
  )

  return (
    <group>
      <group rotation={[0, 0, -theta]}>
        <Part id="field" name="Sloping field" role="housing" material="soil" info={INFO.field} cites={[C.csb('p1–4 erosion types'), C.ce('Fig. 1.1')]}>
          <Part id="surface" name="Field surface" info={INFO.field} cut={false}>
            <SoilSurface grid={grid} color="#8a6a48" tilled="#3c2a1c" depth={0.02} />
          </Part>
          <Part id="soil-block" name="Soil profile" info={INFO.block} cites={[C.csb('p3 detachability and transportability')]}>
            <PartMesh geometry={geo.unitDown} position={[0, -1.3, 0]} scale={[FL, 1.6, FW]} />
          </Part>
        </Part>
        <Part id="rain" name="Rain" role="fluid" material="water" info={INFO.rain} cites={[C.csb('p2, p4 R = EI30')]} cut={false}>
          <Particles count={260} radius={0.025} color="#9fd8ff" update={rain} stretch={4} opacity={0.7} />
        </Part>
        <Part id="splash" name="Splash" role="fluid" material="soil" info={INFO.splash} cites={[C.csb('p2 Fig. 2.1')]} cut={false}>
          <Particles count={240} radius={0.02} color="#7a5a3c" update={splash} emissive={0.05} />
        </Part>
        <Part id="runoff" name="Runoff" role="fluid" material="water" info={INFO.runoff} cites={[C.csb('p1–3 sheet, interrill, rill, gully')]} cut={false}>
          <Particles count={260} radius={0.045} color="#a88a62" update={sheet} emissive={0.1} />
        </Part>
        {terr ? (
          <>
            <Part id="terraces" name="Diversion terraces" role="static" material="soil" info={INFO.terrace} cites={[C.csb('p6–7 terraces'), C.s1('Q1c')]} cut={false}>
              {terraceFlows.map((c, i) => (
                <Flow key={i} curve={c} count={50} radius={0.06} color="#5ab4ff" speed={0.12} spread={0.2} intensity={() => 1} />
              ))}
            </Part>
            <Part id="outlet" name="Grassed outlet" role="static" material="crop" info={INFO.outlet} cites={[C.vw('book p134')]} cut={false}>
              <PartMesh geometry={geo.outlet} />
            </Part>
          </>
        ) : null}
        {geo.crop ? (
          <Part id="crop-strips" name="Crop strips" role="static" material="crop" info={INFO.crop} cites={[C.csb('p7, p10 strip cropping')]} cut={false}>
            <PartMesh geometry={geo.crop} />
          </Part>
        ) : null}
        <PartLabel partId="soil-block" at={[X0 + 2, -1, FW / 2]} />
        <PartLabel partId="runoff" at={[6, 0.6, RILLS[2]]} />
        <PartLabel partId="rain" at={[X0 + 4, 5, -4]} />
        {terr ? <PartLabel partId="terraces" at={[TERR_X[1], 1, -3]} /> : null}
        {terr ? <PartLabel partId="outlet" at={[0, 0.8, OUTLET_Z + 1]} /> : null}
      </group>
    </group>
  )
}
