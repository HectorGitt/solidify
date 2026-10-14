import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, mat4, merge, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { SoilSurface } from '@/render/SoilSurface'
import { createSoil, roughen } from '@/render/soil'
import { Particles, hash, plantsGeometry, treeGeometry } from '../_shared/fx'
import { BREAK_X, C, FIELD, STRIPS, inStrip, intensity, live, profile, uAt, useWind } from './model'

const L = FIELD.x1 - FIELD.x0
const W = FIELD.w
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

const INFO = {
  field: { summary: 'Bare field.', role: 'Wind erosion is detachment, transport and deposition by wind once the wind force exceeds the soil’s threshold. Loose, fine, dry soil on a smooth bare surface is most at risk.' },
  block: { summary: 'Soil.', role: 'Cut along the wind to see where soil has been removed and where it is deposited.' },
  windbreak: { summary: 'Windbreak / shelterbelt.', role: 'Rows of trees, shrubs or tall grass reduce the wind near the ground in their lee; grains drop out where the wind slows.', details: 'The protected-zone length used here (about 12 heights) is a typical textbook value, not from the notes.' },
  suspension: { summary: 'Suspension (< 0.05 mm).', role: 'Fine dust carried high by turbulence until rain or calm brings it down.' },
  saltation: { summary: 'Saltation (0.05–0.5 mm).', role: 'Grains lifted, carried a short way and dropped in low hops; their impacts drive the other two modes. Over 93 % of movement is within 1 m of the surface.' },
  creep: { summary: 'Surface creep (0.5–1 mm).', role: 'Larger grains rolled and pushed along by saltation impacts — about a third of the movement. Grains over 1 mm stay as a lag (desert pavement).' },
  wind: { summary: 'Wind.', role: 'Turbulent except in a thin laminar layer at the surface; speed rises with the log of height, and that gradient sets the shear on the surface.' },
  strips: { summary: 'Crop strips normal to the wind.', role: 'Strip cropping across the wind traps saltating grains and shortens the eroding field length.' },
  residue: { summary: 'Crop residue.', role: 'Standing stalks plus coarse flat residue work best: they raise the threshold velocity and erosion falls with residue.' },
}

export function Scene3D() {
  const st = useWind()
  const grid = useMemo(() => {
    const g = createSoil(L, W, 0.2, FIELD.x0, -W / 2)
    roughen(g, 0.01, 11)
    return g
  }, [])
  const base = useMemo(() => grid.height.slice(), [grid])
  const q = useRef(new Float32Array(grid.nx))
  const dh = useRef(new Float32Array(grid.nx))

  const geo = useMemo(() => {
    const t = treeGeometry(st.H, st.H * 0.45)
    const trunks: THREE.BufferGeometry[] = []
    const crowns: THREE.BufferGeometry[] = []
    for (let r = 0; r < 3; r++)
      for (let z = -W / 2 - 2; z <= W / 2 + 2; z += 2.4) {
        const zz = z + (r % 2) * 1.2
        const s = r === 1 ? 1 : 0.75
        const m = mat4.c(mat4.t(BREAK_X - 2.4 + r * 2.4, 0, zz), mat4.ry(hash(r * 50 + z) * 6), new THREE.Matrix4().makeScale(s, s, s))
        trunks.push(xform(t.trunk, m))
        crowns.push(xform(t.crown, m))
      }
    const stripPts: [number, number][] = []
    for (const [a, b] of STRIPS) for (let x = a + 0.2; x < b; x += 0.45) for (let z = -W / 2 + 0.3; z < W / 2; z += 0.45) stripPts.push([x, z])
    const residue: [number, number][] = []
    for (let i = 0; i < 700; i++) residue.push([FIELD.x0 + hash(i) * L, -W / 2 + hash(i + 31) * W])
    return {
      trunks: merge(...trunks),
      crowns: merge(...crowns),
      strips: plantsGeometry(stripPts, 0.9, 0.15, 0),
      standing: plantsGeometry(residue, 0.35, 0.03, 0),
      flat: merge(...residue.map(([x, z], i) => xform(box(0.35, 0.02, 0.04), mat4.c(mat4.t(x, 0.02, z), mat4.ry(hash(i + 3) * 6))))),
      unitDown: xform(box(1, 1, 1), mat4.t(0, -0.5, 0)),
    }
  }, [st.H])

  const arrows = useMemo(() => {
    const zs = [0.05, 0.1, 0.2, 0.3, 0.6, 1, 1.6, 2.5]
    const fan = (x: number, u03: number) => merge(...zs.map((z) => xform(box(Math.max(0.05, profile(st, u03, z) * 0.35), 0.04, 0.04), mat4.t(x + Math.max(0.05, profile(st, u03, z) * 0.35) / 2, z, -W / 2 - 1))))
    return { open: fan(BREAK_X - 12, st.u), lee: fan(BREAK_X + 3 * st.H, uAt(st, BREAK_X + 3 * st.H)) }
  }, [st])

  const streams = useMemo(
    () =>
      [0.6, 1.6, 3.2].map((y) => {
        const bump = st.windbreak ? Math.max(0, st.H + 1 - y) : 0
        return new THREE.CatmullRomCurve3([v3(BREAK_X - 14, y, 0), v3(BREAK_X - 4, y + bump * 0.7, 0), v3(BREAK_X, y + bump, 0), v3(BREAK_X + 6 * st.H * 0.5, y + bump * 0.6, 0), v3(FIELD.x1, y, 0)])
      }),
    [st.windbreak, st.H],
  )

  const clock = useRef({ key: '', acc: 0 })
  useSimFrame((dt) => {
    const p = useWind.getState()
    const c = clock.current
    const key = `${p.windbreak}|${p.H}|${p.strips}`
    if (key !== c.key) {
      c.key = key
      grid.height.set(base)
      dh.current.fill(0)
      grid.version++
    }
    // 1-D sediment flux along the wind: picks up where intensity > 0, drops where the wind slows
    c.acc += dt
    if (c.acc < 0.1) return
    const step = c.acc
    c.acc = 0
    const qq = q.current
    let prev = 0
    let eroding = 0
    for (let i = 0; i < grid.nx; i++) {
      const x = grid.x0 + i * grid.cell
      const e = intensity(p, x)
      if (e > 0) eroding++
      const cap = e
      const next = prev + (cap - prev) * Math.min(1, grid.cell * (cap > prev ? 0.25 : 0.6))
      qq[i] = next
      dh.current[i] = Math.max(-0.12, Math.min(0.12, dh.current[i] - (next - prev) * step * 0.02))
      prev = next
    }
    for (let k = 0; k < grid.nz; k++)
      for (let i = 0; i < grid.nx; i++) {
        const j = k * grid.nx + i
        grid.height[j] = base[j] + dh.current[i]
        grid.disturbed[j] = Math.min(1, Math.abs(dh.current[i]) * 15)
      }
    grid.version++
    live.eroding = eroding / grid.nx
    live.moved = dh.current.reduce((a, b) => a + Math.max(0, -b), 0) / grid.nx
  })

  const fluxAt = (x: number) => {
    const i = Math.max(0, Math.min(grid.nx - 1, Math.round((x - grid.x0) / grid.cell)))
    return q.current[i]
  }
  const salt = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const p = useWind.getState()
    const sp = 0.6 + 0.12 * p.u
    const x = FIELD.x0 + ((hash(i) * L + t * sp) % L)
    const f = fluxAt(x)
    if (hash(i + 7) > f * 1.6) return 0
    const hop = 0.7 + 0.5 * hash(i + 2)
    const ph = (x / hop) % 1
    out.set(x, 0.02 + 0.22 * Math.sin(Math.PI * ph) ** 0.8, -W / 2 + hash(i + 3) * W)
    return 1
  }
  const susp = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const p = useWind.getState()
    const sp = 1.2 + 0.25 * p.u
    const s = (hash(i) + (t * sp) / L) % 1
    const x = FIELD.x0 + s * (L + 10)
    const f = fluxAt(Math.min(x, FIELD.x1))
    if (hash(i + 9) > f * 1.4) return 0
    out.set(x, 0.3 + s * 7 * hash(i + 4) + Math.sin(t * 2 + i) * 0.3, -W / 2 + hash(i + 5) * W)
    return 1 - s * 0.5
  }
  const creep = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const p = useWind.getState()
    const x = FIELD.x0 + ((hash(i) * L + t * (0.1 + 0.03 * p.u)) % L)
    const f = fluxAt(x)
    if (hash(i + 11) > f * 1.8 || inStrip(p, x)) return 0
    out.set(x, 0.04, -W / 2 + hash(i + 6) * W)
    return 1
  }

  return (
    <group>
      <Part id="field" name="Field" role="housing" material="soil" info={INFO.field} cites={[C.we('s4–10')]}>
        <Part id="surface" name="Field surface" info={INFO.field} cut={false}>
          <SoilSurface grid={grid} color="#c8a674" tilled="#7d5f3c" depth={0.02} />
        </Part>
        <Part id="soil-block" name="Soil" info={INFO.block} cites={[C.we('s12–17 soil factors')]}>
          <PartMesh geometry={geo.unitDown} position={[FIELD.x0 + L / 2, -0.02, 0]} scale={[L, 1.2, W]} />
        </Part>
      </Part>
      {st.windbreak ? (
        <Part id="windbreak" name="Windbreak (three rows)" role="static" material="wood" info={INFO.windbreak} cites={[C.we('s18–21 windbreaks, Figs. 2–3')]} cut={false} beyondNotes>
          <PartMesh geometry={geo.trunks} />
          <PartMesh geometry={geo.crowns} material="crop" />
        </Part>
      ) : null}
      {st.strips ? (
        <Part id="strips" name="Crop strips" role="static" material="crop" info={INFO.strips} cites={[C.we('s22 strip cropping normal to the wind')]} cut={false}>
          <PartMesh geometry={geo.strips} />
        </Part>
      ) : null}
      {st.cover !== 'bare' ? (
        <Part id="residue" name={st.cover === 'standing' ? 'Standing stubble' : 'Flat residue'} role="static" material="straw" info={INFO.residue} cites={[C.we('s24 residues')]} cut={false}>
          <PartMesh geometry={st.cover === 'standing' ? geo.standing : geo.flat} />
        </Part>
      ) : null}
      <Part id="wind" name="Wind profile" role="static" material="paintBlue" info={INFO.wind} cites={[C.we('s5–6')]} cut={false} beyondNotes>
        <PartMesh geometry={arrows.open} />
        <PartMesh geometry={arrows.lee} material="paintOrange" />
        {streams.map((c, i) => (
          <Flow key={i} curve={c} count={40} radius={0.06} color="#dfeef8" speed={0.04 + 0.006 * st.u} spread={W * 0.9} intensity={() => 1} emissive={0.2} />
        ))}
      </Part>
      <Part id="suspension" name="Suspension" role="fluid" material="soil" info={INFO.suspension} cites={[C.we('s8')]} cut={false}>
        <Particles count={220} radius={0.05} color="#e2cfa6" update={susp} opacity={0.6} emissive={0.2} />
      </Part>
      <Part id="saltation" name="Saltation" role="fluid" material="soil" info={INFO.saltation} cites={[C.we('s9, Fig. 1')]} cut={false}>
        <Particles count={420} radius={0.035} color="#a07c4c" update={salt} emissive={0.1} />
      </Part>
      <Part id="creep" name="Surface creep" role="fluid" material="soil" info={INFO.creep} cites={[C.we('s10')]} cut={false}>
        <Particles count={200} radius={0.06} color="#6b4f30" update={creep} emissive={0.05} />
      </Part>
      {st.windbreak ? <PartLabel partId="windbreak" at={[BREAK_X, st.H + 1, -4]} /> : null}
      <PartLabel partId="saltation" at={[14, 0.8, 3]} />
      <PartLabel partId="suspension" at={[22, 4, 0]} />
      <PartLabel partId="creep" at={[8, 0.4, -6]} />
      <PartLabel partId="wind" at={[BREAK_X - 10, 3, -W / 2 - 1]} />
    </group>
  )
}
