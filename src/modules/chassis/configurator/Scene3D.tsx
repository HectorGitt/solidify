import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { FARMLAND_REAR, suitcaseWeight, wheelWeight, wheelWeightStack } from '@/parts/lib/wheels'
import { FieldGround, resetSoil } from '@/modules/implements/_shared/field'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { createSoil, roughen } from '@/render/soil'
import { TRACTOR } from '@/tractor/dims'
import { AXLE_Y } from '@/tractor/geometry'
import { pressTractor } from '@/tractor/ruts'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { SOILS, build, live, test, useConfig } from './model'

const { PI } = Math
export const pose = createTractorPose({ hitchHeight: 0.7 })

const STRIP = { x0: -18, x1: 18, z0: -3.6, z1: 3.6 }
export const grid = createSoil(STRIP.x1 - STRIP.x0, STRIP.z1 - STRIP.z0, 0.05, STRIP.x0, STRIP.z0)
roughen(grid, 0.008, 4)
const START = -13
const END = 12
const CHAIN = 2.2

const INFO = {
  front: { summary: 'Front ballast weights (suitcase weights, ≈ 55 kg each).', role: 'Hung ahead of the front axle: they keep weight on the steering wheels when the pull transfers load to the rear. Too much unloads the rear driving wheels.' },
  rear: { summary: 'Rear wheel weights (cast-iron discs, ≈ 90 kg each).', role: 'Bolted to the rear wheel centres, they add load straight onto the driving wheels: less slip, more grip — but more rolling resistance, fuel and soil compaction.' },
  sledge: { summary: 'Load sledge.', role: 'Stands in for the implement: it resists with the drawbar pull set in the job. Each block is about 5 kN of pull.' },
  chain: { summary: 'Drawbar chain.', role: 'Carries the pull from the drawbar pin to the sledge.' },
}

let cache: { key: string; r: ReturnType<typeof test>; s: number } | null = null
function current() {
  const p = useConfig.getState()
  const key = JSON.stringify(p)
  if (!cache || cache.key !== key) cache = { key, r: test(p), s: build(p).s }
  return cache
}

export function Configurator3D() {
  const st = useConfig()
  const s = build(st).s
  const tractor = useRef<THREE.Group>(null)
  const sledge = useRef<THREE.Group>(null)
  const chain = useRef<THREE.Mesh>(null)
  const drive = useRef({ x: START, printAcc: 0 })

  const weights = useMemo(() => {
    const nf = Math.min(18, Math.round(st.front / 55))
    const nr = Math.min(8, Math.round(st.rear / 2 / 90))
    // suitcase weights hang side by side across the nose; wheel weights stack on the rear wheel discs
    const slab = suitcaseWeight({ length: 0.45, height: 0.3, thickness: 0.05 })
    const slabs: THREE.BufferGeometry[] = []
    for (let i = 0; i < nf; i++) slabs.push(xform(slab, mat4.t(2.305, 0.62, (i - (nf - 1) / 2) * 0.052)))
    const disc = wheelWeight({ t: 0.04 })
    const discs: THREE.BufferGeometry[] = []
    for (const z of wheelWeightStack(FARMLAND_REAR, nr, 0.04))
      for (const side of [1, -1]) discs.push(xform(disc, mat4.t(0, AXLE_Y, side * (TRACTOR.rear.track / 2 + z))))
    return { front: slabs.length ? merge(...slabs) : null, rear: discs.length ? merge(...discs) : null }
  }, [st.front, st.rear])

  const sledgeGeo = useMemo(() => {
    const blocks = Math.max(1, Math.min(14, Math.round(st.pull / 5)))
    const parts: THREE.BufferGeometry[] = [xform(box(2.0, 0.12, 1.3), mat4.t(0, 0.1, 0))]
    for (let i = 0; i < blocks; i++) parts.push(xform(box(0.55, 0.22, 1.1), mat4.t(-0.6 + (i % 3) * 0.6, 0.27 + Math.floor(i / 3) * 0.23, 0)))
    const runners = merge(...[0.55, -0.55].map((z) => xform(box(2.3, 0.06, 0.1), mat4.t(0, 0.03, z))))
    return { body: merge(...parts), runners }
  }, [st.pull])
  const chainGeo = useMemo(() => cylinder(0.02, 1, 8).rotateZ(PI / 2), [])

  useSimFrame((dt) => {
    if (dt <= 0) return
    const { r, s } = current()
    const p = useConfig.getState()
    const d = drive.current
    const v = r.ok ? r.speed / 3.6 : 0
    d.x += v * dt
    if (d.x > END) {
      d.x = START
      live.laps++
      resetSoil(grid, 4 + (live.laps % 5))
    }
    live.x = d.x
    tractor.current?.position.set(d.x, 0, 0)
    // wheels turn faster than the ground speed by the slip; with the wheels spinning they turn on the spot
    const wheelV = r.ok ? v / Math.max(0.3, 1 - r.slip) : r.spin ? 1.2 : 0
    pose.rearAngle += (wheelV * dt) / (TRACTOR.rear.rolling * s)
    pose.frontAngle += (v * dt) / (TRACTOR.front.radius * s)
    pose.engineAngle += (dt * 2 * PI * (r.rpm || (r.spin ? 2300 : 0))) / 60
    pose.steer = 0
    pose.effects = { load: r.ok ? r.load : r.spin ? 0.9 : 0, rpm: r.ok ? r.rpm : r.spin ? 2300 : 0, ratedRpm: 2250, speed: Math.max(v, r.spin ? 1 : 0), slip: r.spin ? 0.7 : r.slip, dust: SOILS[p.soil].dust }
    // ruts
    d.printAcc += Math.max(v, r.spin ? 0.3 : 0) * dt
    if (d.printAcc > 0.1) {
      d.printAcc = 0
      pressTractor(grid, d.x, 0, 0, { rear: r.rut, front: r.rut * 0.45 }, r.spin ? 0.7 : r.slip, s)
    }
    // sledge on its chain behind the drawbar
    const pinX = d.x + TRACTOR.drawbar.x * s
    const sx = pinX - CHAIN * s - 1.0
    sledge.current?.position.set(sx, 0, 0)
    if (chain.current) {
      const a = new THREE.Vector3(pinX, TRACTOR.drawbar.y * s, 0)
      const b = new THREE.Vector3(sx + 1.0, 0.18, 0)
      chain.current.position.copy(a).add(b).multiplyScalar(0.5)
      chain.current.scale.set(a.distanceTo(b), 1, 1)
      chain.current.rotation.set(0, 0, Math.atan2(a.y - b.y, a.x - b.x))
    }
  })

  return (
    <group>
      <group ref={tractor} position={[START, 0, 0]}>
        <group scale={s}>
          <Tractor pose={pose} labels={false} cab={st.engine !== 'small'} paint={st.engine === 'large' ? 'paintGreen' : st.engine === 'medium' ? 'paintBlue' : 'paintRed'} />
          {weights.front ? (
            <Part id="ballast-front" name="Front ballast" role="static" material="paintBlack" cut={false} info={INFO.front}>
              <PartMesh geometry={weights.front} />
            </Part>
          ) : null}
          {weights.rear ? (
            <Part id="ballast-rear" name="Rear wheel weights" role="static" material="castIron" cut={false} info={INFO.rear}>
              <PartMesh geometry={weights.rear} />
            </Part>
          ) : null}
        </group>
        {weights.front ? <PartLabel partId="ballast-front" at={[2.4 * s, 1.2 * s, 0]} /> : null}
        {weights.rear ? <PartLabel partId="ballast-rear" at={[0, 1.5 * s, (TRACTOR.rear.track / 2 + 0.4) * s]} /> : null}
      </group>
      <Part id="chain" name="Drawbar chain" role="static" material="steelDark" cut={false} info={INFO.chain}>
        <PartMesh ref={chain} geometry={chainGeo} />
      </Part>
      <group ref={sledge}>
        <Part id="sledge" name="Load sledge" role="static" material="paintYellow" cut={false} info={INFO.sledge}>
          <PartMesh geometry={sledgeGeo.body} />
          <PartMesh geometry={sledgeGeo.runners} material="steel" />
        </Part>
        <PartLabel partId="sledge" at={[0, 1.4, 0]} />
      </group>
      <Part id="test-strip" name="Test strip" role="static" material="soil" cut={false} info={{ summary: 'Test strip of the chosen soil.', role: 'Records every pass: rut depth follows the wheel load, the soil strength and the slip.' }}>
        <FieldGround grid={grid} margin={16} />
      </Part>
    </group>
  )
}

export function resetScene() {
  live.x = START
  live.laps = 0
  cache = null
  resetSoil(grid, 4)
}
