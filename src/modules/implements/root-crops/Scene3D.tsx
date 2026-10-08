import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, merge, pipe } from '@/geometry'
import { InstancedPartMesh } from '@/modules/traction/tracks/InstancedPartMesh'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { PROFILES, heightAt, stampRun } from '@/render/soil'
import { createTractorPose } from '@/tractor/Tractor'
import { FieldGround, FieldRun, makeSoil, resetSoil, type DriveRun, type StepCtx } from '../_shared/field'
import { bar, plateXY, plateXZ, rod } from '../_shared/geom'
import { Particles, PtoDriveline, wheelGeometry } from '../_appkit/three'
import { C, DIG, ELEV_LEN, HRAISED, HW, MACHINES, PTO_LOCAL, digger, live, useRoots, type Machine } from './model'

const { PI } = Math
export const pose = createTractorPose({ hitchHeight: HW })
const FIELD = { length: 18, width: 4.4, cell: 0.05 }
export const grid = makeSoil(FIELD, 5)
const run: DriveRun = { X: -6.5, lowered: 0, passes: 0 }
const START = -6.5
const END = 5.5
const clock = { elev: 0, pto: 0, wheel: 0, t: 0 }
let lastBladeX = NaN

/* ------------------------------ crop state (field frame) ------------------------------ */

interface Plant {
  x: number
  z: number
  /** 0 standing, 1 on the elevator, 2 dropped */
  st: number
  u: number
  /** resting position once dropped */
  rx: number
  ry: number
  rz: number
  spin: number
}
const crop: { plants: Plant[]; machine: Machine | null } = { plants: [], machine: null }

function plantCrop(m: Machine) {
  const M = MACHINES[m]
  crop.plants = []
  for (const z of M.rows) for (let x = START + 2.4; x < END + 2.2; x += M.spacing) crop.plants.push({ x: x + (Math.random() - 0.5) * 0.04, z: z + (Math.random() - 0.5) * 0.04, st: 0, u: 0, rx: 0, ry: 0, rz: 0, spin: Math.random() * 6.28 })
  crop.machine = m
}

/** Cassava is grown on ridges: shape them whenever the soil is reset. */
function shapeRidges(m: Machine) {
  if (m !== 'cassava') return
  for (const z of MACHINES.cassava.rows) stampRun(grid, grid.x0, grid.x0 + (grid.nx - 1) * grid.cell, z, 0.55, PROFILES.ridge(0.18, 1.0), { mode: 'add', disturb: 0 })
}

/** After the soil is reset: ridges, a fresh crop and no clods. */
function resetField(m: Machine) {
  shapeRidges(m)
  plantCrop(m)
  lastBladeX = NaN
  clods.st.fill(0)
}

/* clods of soil riding the elevator (digger frame) */
const CLODS = 260
const clods = { x: new Float32Array(CLODS), y: new Float32Array(CLODS), z: new Float32Array(CLODS), u: new Float32Array(CLODS), vy: new Float32Array(CLODS), st: new Uint8Array(CLODS), siftAt: new Float32Array(CLODS), next: 0 }

const AM = {
  rc: [C.am('§20 root-crop harvesters, Fig 20.1')],
  gn: [C.am('§20 groundnut digger-shaker')],
  cs: [C.am('§20 cassava digger-elevator')],
}

const INFO = {
  digger: {
    summary: 'Tractor-mounted root-crop digger (three-point linkage, PTO-driven elevator).',
    role: 'A digging blade lifts the whole row — soil, roots and all — onto a rod elevator that shakes the soil out and leaves the crop on the surface.',
    details: 'Common components: digging blade, inclined elevator-shaker, disc coulters, agitators, depth wheels and an overload clutch. Sizes are typical.',
  },
  frame: { summary: 'Main frame and headstock.', role: 'Carries the digging unit on the three-point linkage; it is lifted clear at the headlands.' },
  blade: {
    groundnut: { summary: 'Digging blade (share).', role: 'Runs under the pods and cuts the tap roots, lifting the plants and soil onto the elevator.' },
    cassava: { summary: 'Wedge digging blade.', role: 'A wedge that runs under the ridge, to about 300 mm, loosening the soil and lifting the tubers onto the bar elevator.' },
  },
  coulters: { summary: 'Disc coulters on drums.', role: 'Two side discs slice the ridge sides ahead of the wedge so the slab lifts cleanly without dragging trash.' },
  elevator: { summary: 'Inclined rod (bar) elevator-shaker.', role: 'An endless chain of round rods. It runs faster than the forward speed so the soil is stripped off the roots and falls between the rods; its speed is adjustable by sprocket.' },
  agitators: { summary: 'Agitators.', role: 'Sprockets (elliptical rollers) under the chain that bounce the rods, shaking more soil loose.' },
  depthWheels: { summary: 'Depth wheels.', role: 'Run on the surface and set the working depth; adjusted manually or hydraulically.' },
  clutch: { summary: 'Overload (slip) clutch.', role: 'Slips if a stone or root jams the elevator, protecting the drive.' },
  gearbox: { summary: 'Drive gearbox and chain.', role: 'Takes the PTO drive and drives the elevator’s head sprocket by chain.' },
  inverter: { summary: 'Shaker end and inverter rods.', role: 'The digger-shaker’s last section shakes the plants clean; curved rods turn them over (pods up) into a windrow to dry.' },
  crop: { summary: 'Root crop.', role: 'Roots in the soil ahead; lifted on the elevator; left on the surface behind. A digger-elevator recovers about 85 % of cassava roots.' },
}

/* ------------------------------ geometry ------------------------------ */

function diggerGeometry(m: Machine) {
  const { tipX, bladeX1, bladeRise, W, elevF, elevR, frameY } = DIG
  const hw = W / 2
  const blade =
    m === 'cassava'
      ? merge(
          plateXZ([[tipX, 0], [bladeX1, hw * 0.75], [bladeX1 - 0.05, hw * 0.75], [bladeX1 - 0.05, -hw * 0.75], [bladeX1, -hw * 0.75]], 0.016, 0.01),
          bar([tipX, 0.0, 0], [bladeX1, bladeRise, 0], 0.08, 0.03),
          plateXY([[bladeX1 + 0.02, 0], [bladeX1 - 0.05, 0], [bladeX1 - 0.05, bladeRise + 0.1], [bladeX1 + 0.08, bladeRise + 0.05]], 0.02, hw * 0.75),
          plateXY([[bladeX1 + 0.02, 0], [bladeX1 - 0.05, 0], [bladeX1 - 0.05, bladeRise + 0.1], [bladeX1 + 0.08, bladeRise + 0.05]], 0.02, -hw * 0.75 - 0.02),
        )
      : merge(...[-1, 1].map((s) => bar([tipX, 0.0, (s * hw) / 2], [bladeX1, bladeRise, (s * hw) / 2], hw, 0.016)))
  // the blade is pitched: rotate the plate parts so the rear is raised (bar() already slopes)
  const sideFrames = [1, -1].map((s) => plateXY([[elevF[0] + 0.05, elevF[1] - 0.08], [elevR[0] - 0.05, elevR[1] - 0.08], [elevR[0] - 0.05, elevR[1] + 0.14], [elevF[0] + 0.05, elevF[1] + 0.14]], 0.012, s > 0 ? hw + 0.02 : -hw - 0.032))
  const elevFrame = merge(...sideFrames, rod([elevR[0] + 0.05, elevR[1], hw + 0.05], [elevR[0] + 0.05, elevR[1], -hw - 0.05], 0.025, 12), rod([elevF[0], elevF[1], hw + 0.05], [elevF[0], elevF[1], -hw - 0.05], 0.02, 12))
  const frame = merge(
    rod([0, HW, 0.43], [0, HW, -0.43], 0.02, 12),
    bar([0, HW, 0.38], [0.02, HW + 0.61, 0.04], 0.06, 0.014),
    bar([0, HW, -0.38], [0.02, HW + 0.61, -0.04], 0.06, 0.014),
    bar([0, HW + 0.1, 0.4], [-1.95, frameY, hw + 0.12], 0.08, 0.08),
    bar([0, HW + 0.1, -0.4], [-1.95, frameY, -hw - 0.12], 0.08, 0.08),
    bar([0.02, HW + 0.6, 0], [-1.2, frameY + 0.05, 0], 0.06, 0.06),
    bar([-0.6, frameY, hw + 0.12], [-0.6, frameY, -hw - 0.12], 0.08, 0.08),
    bar([-1.95, frameY, hw + 0.12], [-1.95, frameY, -hw - 0.12], 0.08, 0.08),
    // hangers down to the digging unit and the depth-wheel arms
    ...[1, -1].flatMap((s) => [
      bar([-0.6, frameY, s * (hw + 0.1)], [bladeX1, 0.25, s * (hw + 0.05)], 0.05, 0.04),
      bar([-1.95, frameY, s * (hw + 0.1)], [elevR[0], elevR[1] + 0.05, s * (hw + 0.05)], 0.05, 0.04),
      bar([-0.6, frameY, s * (hw + 0.12)], [DIG.wheelX, DIG.wheelR, s * DIG.wheelZ], 0.05, 0.05),
    ]),
  )
  const rodGeo = cylinder(0.011, W - 0.02, 8).rotateX(PI / 2)
  const agitator = merge(...[-0.3, 0.3].map((z) => lathe([[0, -0.012], [0.07, -0.012], [0.07, 0.012], [0, 0.012]], 6).rotateX(PI / 2).scale(1, 1.5, 1).translate(0, 0, z)), cylinder(0.015, W, 10).rotateX(PI / 2))
  const disc = merge(cylinder(DIG.discR, 0.008, 40).rotateX(PI / 2), cylinder(0.08, 0.1, 16).rotateX(PI / 2))
  const gearbox = merge(box(0.22, 0.2, 0.2).translate(-0.55, frameY + 0.18, 0), rod([-0.66, frameY + 0.18, 0], [-1.98, frameY + 0.05, hw + 0.12], 0.012, 6), box(1.4, 0.06, 0.03).translate(-1.3, frameY + 0.12, hw + 0.14))
  const clutch = merge(cylinder(0.08, 0.04, 24).rotateZ(PI / 2), cylinder(0.05, 0.05, 6).rotateZ(PI / 2).translate(0.05, 0, 0))
  const inverter = merge(...[-0.4, -0.15, 0.15, 0.4].map((z) => pipe(new THREE.CatmullRomCurve3([new THREE.Vector3(elevR[0] - 0.02, elevR[1] + 0.02, z), new THREE.Vector3(elevR[0] - 0.35, elevR[1] + 0.15, z), new THREE.Vector3(elevR[0] - 0.6, elevR[1] - 0.1, z * 0.8), new THREE.Vector3(elevR[0] - 0.7, elevR[1] - 0.4, z * 0.6)]), 0.01, 0, 24, 6)))
  const wheel = wheelGeometry(DIG.wheelR, 0.16)
  return { blade, elevFrame, frame, rodGeo, agitator, disc, gearbox, clutch, inverter, wheel }
}

function plantGeometry(m: Machine) {
  if (m === 'cassava') {
    const stem = merge(cylinder(0.018, 0.45, 8).translate(0, 0.2, 0), cylinder(0.012, 0.25, 6).rotateZ(0.5).translate(0.06, 0.45, 0))
    const tubers: THREE.BufferGeometry[] = []
    for (let k = 0; k < 4; k++) {
      const t = lathe([[0, 0], [0.025, 0.04], [0.04, 0.14], [0.03, 0.28], [0, 0.34]], 10)
      t.rotateZ(PI * 0.62 + (k % 2) * 0.12)
      t.rotateY((k / 4) * 2 * PI)
      t.translate(0, -0.03, 0)
      tubers.push(t)
    }
    return { top: stem, root: merge(...tubers) }
  }
  const leaves: THREE.BufferGeometry[] = []
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 2 * PI
    leaves.push(new THREE.IcosahedronGeometry(0.06, 0).translate(0.07 * Math.cos(a), 0.1 + 0.03 * (k % 2), 0.07 * Math.sin(a)))
  }
  leaves.push(new THREE.IcosahedronGeometry(0.07, 0).translate(0, 0.16, 0))
  const pods: THREE.BufferGeometry[] = []
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * 2 * PI
    const pd = lathe([[0, -0.018], [0.009, -0.012], [0.008, 0], [0.009, 0.012], [0, 0.018]], 6)
    pd.rotateZ(PI / 2).translate(0.05 * Math.cos(a), -0.06 - 0.03 * (k % 3), 0.05 * Math.sin(a))
    pods.push(pd)
  }
  pods.push(cylinder(0.006, 0.12, 5).translate(0, -0.05, 0))
  return { top: merge(...leaves.map((g) => g.toNonIndexed())), root: merge(...pods) }
}

/* ------------------------------ digger ------------------------------ */

const NRODS = 44

function Digger() {
  const machine = useRoots((s) => s.machine)
  const g = useMemo(() => diggerGeometry(machine), [machine])
  const unit = useRef<THREE.Group>(null)
  const rods = useRef<THREE.InstancedMesh>(null)
  const discs = useRef<(THREE.Group | null)[]>([])
  const wheels = useRef<(THREE.Group | null)[]>([])
  const agit = useRef<THREE.Group>(null)
  const clutch = useRef<THREE.Group>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const dir = useMemo(() => new THREE.Vector2(DIG.elevR[0] - DIG.elevF[0], DIG.elevR[1] - DIG.elevF[1]).normalize(), [])

  useSimFrame(() => {
    const st = useRoots.getState()
    unit.current?.position.set(0, -st.depth, 0)
    for (const d of discs.current) d?.rotation.set(0, 0, -clock.wheel * (DIG.wheelR / DIG.discR))
    for (const w of wheels.current) w?.rotation.set(0, 0, -clock.wheel)
    agit.current?.rotation.set(0, 0, clock.elev * 6)
    clutch.current?.rotation.set(clock.pto, 0, 0)
    if (rods.current) {
      const loop = 2 * ELEV_LEN + 0.24
      for (let k = 0; k < NRODS; k++) {
        let s = (k / NRODS) * loop + clock.elev
        s = ((s % loop) + loop) % loop
        let x: number
        let y: number
        if (s < ELEV_LEN) {
          x = DIG.elevF[0] + dir.x * s
          y = DIG.elevF[1] + dir.y * s
          // agitators bounce the middle of the top run
          if (st.agitators && s > ELEV_LEN * 0.3 && s < ELEV_LEN * 0.7) y += 0.02 * Math.abs(Math.sin(clock.elev * 18 + k))
        } else if (s < ELEV_LEN + 0.12) {
          x = DIG.elevR[0]
          y = DIG.elevR[1] - (s - ELEV_LEN)
        } else if (s < 2 * ELEV_LEN + 0.12) {
          const q = s - ELEV_LEN - 0.12
          x = DIG.elevR[0] - dir.x * q
          y = DIG.elevR[1] - 0.12 - dir.y * q
        } else {
          x = DIG.elevF[0]
          y = DIG.elevF[1] - 0.12 + (s - 2 * ELEV_LEN - 0.12)
        }
        m.makeTranslation(x, y + 0.01, 0)
        rods.current.setMatrixAt(k, m)
      }
      rods.current.instanceMatrix.needsUpdate = true
    }
  })

  const mid = [(DIG.elevF[0] + DIG.elevR[0]) / 2, (DIG.elevF[1] + DIG.elevR[1]) / 2 - 0.05] as const
  return (
    <group position={[0, -HW, 0]}>
      <Part id="digger" name={MACHINES[machine].label} role="housing" material="paintOrange" info={INFO.digger} cites={AM.rc} beyondNotes>
        <Part id="frame" name="Frame and headstock" role="static" material="paintOrange" info={INFO.frame} cites={AM.rc}>
          <PartMesh geometry={g.frame} />
        </Part>
        <Part id="depth-wheels" name="Depth wheels" role="moving" material="rubber" info={INFO.depthWheels} cites={AM.rc}>
          {[1, -1].map((s, i) => (
            <group key={s} position={[DIG.wheelX, DIG.wheelR, s * DIG.wheelZ]} ref={(el) => {
              wheels.current[i] = el
            }}>
              <PartMesh geometry={g.wheel.tyre} />
              <PartMesh geometry={g.wheel.rim} material="paintGrey" />
            </group>
          ))}
        </Part>
        <Part id="drive" name="Drive gearbox and chain" role="housing" material="castIron" info={INFO.gearbox} beyondNotes>
          <PartMesh geometry={g.gearbox} />
          <Part id="overload-clutch" name="Overload clutch" role="moving" material="steel" info={INFO.clutch} cites={AM.rc}>
            <group ref={clutch} position={[-0.42, DIG.frameY + 0.18, 0]}>
              <PartMesh geometry={g.clutch} />
            </group>
          </Part>
        </Part>
        <PtoDriveline id="pto-shaft" from={PTO_LOCAL} to={[-0.38, DIG.frameY + 0.18, 0]} angle={() => clock.pto} />
        <group ref={unit}>
          <Part id="blade" name={machine === 'cassava' ? 'Wedge blade' : 'Digging blade'} role="static" material="forged" info={INFO.blade[machine]} cites={machine === 'cassava' ? AM.cs : AM.gn} explode={[0.3, -0.2, 0]}>
            <PartMesh geometry={g.blade} />
          </Part>
          {machine === 'cassava' && (
            <Part id="coulters" name="Disc coulters" role="moving" material="steel" info={INFO.coulters} cites={AM.cs} explode={[0, 0, 0.3]}>
              {[1, -1].map((s, i) => (
                <group key={s} position={[DIG.discX, DIG.discR - 0.02, s * DIG.discZ]} ref={(el) => {
                  discs.current[i] = el
                }}>
                  <PartMesh geometry={g.disc} />
                </group>
              ))}
            </Part>
          )}
          <Part id="elevator" name="Rod elevator" role="moving" material="steel" info={INFO.elevator} cites={AM.rc} explode={[0, 0.35, 0]}>
            <InstancedPartMesh ref={rods} geometry={g.rodGeo} count={NRODS} />
            <Part id="elevator-frame" name="Elevator side frames" role="static" material="paintOrange">
              <PartMesh geometry={g.elevFrame} />
            </Part>
          </Part>
          <Part id="agitators" name="Agitators" role="moving" material="steelDark" info={INFO.agitators} cites={AM.rc}>
            <group ref={agit} position={[mid[0], mid[1], 0]}>
              <PartMesh geometry={g.agitator} />
            </group>
          </Part>
          {machine === 'groundnut' && (
            <Part id="inverter" name="Shaker end and inverter" role="static" material="steel" info={INFO.inverter} cites={AM.gn}>
              <PartMesh geometry={g.inverter} />
            </Part>
          )}
        </group>
      </Part>
    </group>
  )
}

/* ------------------------------ crop and clods ------------------------------ */

function Crop() {
  const machine = useRoots((s) => s.machine)
  const g = useMemo(() => plantGeometry(machine), [machine])
  const MAX = 160
  const tops = useRef<THREE.InstancedMesh>(null)
  const roots = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  useSimFrame(() => {
    const t = tops.current
    const r = roots.current
    if (!t || !r) return
    if (crop.machine !== machine) plantCrop(machine)
    const st = useRoots.getState()
    const n = Math.min(MAX, crop.plants.length)
    const hx = run.X + (pose.linkage?.L.x ?? -1.05)
    const yOff = (pose.linkage?.L.y ?? HW) - HW - st.depth
    const dir = { x: DIG.elevR[0] - DIG.elevF[0], y: DIG.elevR[1] - DIG.elevF[1] }
    for (let i = 0; i < n; i++) {
      const p = crop.plants[i]
      if (p.st === 0) {
        const h = heightAt(grid, p.x, p.z)
        o.position.set(p.x, h, p.z)
        o.rotation.set(0, p.spin, 0)
      } else if (p.st === 1) {
        const u = Math.min(1, p.u)
        o.position.set(hx + DIG.elevF[0] + dir.x * u, yOff + DIG.elevF[1] + dir.y * u + 0.12, p.z * 0.8)
        o.rotation.set(machine === 'groundnut' ? -u * 0.6 : 0, p.spin, machine === 'cassava' ? -0.5 : 0)
      } else {
        o.position.set(p.rx, p.ry, p.rz)
        o.rotation.set(machine === 'groundnut' ? PI : 0, p.spin, machine === 'cassava' ? PI / 2 : 0)
      }
      o.updateMatrix()
      t.setMatrixAt(i, o.matrix)
      r.setMatrixAt(i, o.matrix)
    }
    t.count = n
    r.count = n
    t.instanceMatrix.needsUpdate = true
    r.instanceMatrix.needsUpdate = true
  })
  return (
    <Part id="crop" name={machine === 'cassava' ? 'Cassava plants' : 'Groundnut plants'} role="static" material="crop" cut={false} info={INFO.crop} cites={AM.rc}>
      <InstancedPartMesh ref={tops} geometry={g.top} count={MAX} material={machine === 'cassava' ? 'wood' : 'crop'} />
      <Part id="roots" name={machine === 'cassava' ? 'Cassava roots' : 'Groundnut pods'} role="static" material={machine === 'cassava' ? 'leather' : 'straw'} info={INFO.crop} cites={AM.rc}>
        <InstancedPartMesh ref={roots} geometry={g.root} count={MAX} />
      </Part>
    </Part>
  )
}

/* ------------------------------ scene ------------------------------ */

export function RootCrops3D() {
  const machine = useRoots((s) => s.machine)
  const onStep = (c: StepCtx) => {
    const st = useRoots.getState()
    const d = digger(st)
    clock.t += c.dt
    clock.elev += d.ve * c.dt
    clock.pto += (c.dt * 2 * PI * 540) / 60
    clock.wheel += c.dx / DIG.wheelR
    if (crop.machine !== st.machine) plantCrop(st.machine)
    const bladeX = c.hitchX + DIG.tipX
    const working = c.lowered > 0.6
    // loosen the soil behind the blade (ridge levelled for cassava)
    if (working && Number.isFinite(lastBladeX) && bladeX > lastBladeX) {
      const top = st.machine === 'cassava' ? 0.05 : 0.012
      stampRun(grid, lastBladeX - 0.3, bladeX - 0.3, 0, DIG.W / 2, (dz) => top + 0.012 * Math.sin(dz * 40) - 0.02 * (Math.abs(dz) / (DIG.W / 2)) ** 2, { mode: 'set', blend: 0.6, disturb: 1 })
    }
    lastBladeX = bladeX
    // lift plants as the blade reaches them; carry them up the elevator; drop them behind
    const yOff = c.hitchY - HW - st.depth
    for (const p of crop.plants) {
      if (p.st === 0 && working && bladeX >= p.x && Math.abs(p.z) < DIG.W / 2) {
        p.st = 1
        p.u = 0
        live.lifted++
      } else if (p.st === 1) {
        p.u += (d.ve * c.dt) / ELEV_LEN
        if (p.u >= 1) {
          p.st = 2
          p.rx = c.hitchX + DIG.elevR[0] - 0.45 - Math.random() * 0.2
          p.rz = p.z * 0.6 + (Math.random() - 0.5) * 0.1
          p.ry = heightAt(grid, p.rx, p.rz) + (st.machine === 'cassava' ? 0.04 : 0.02)
          live.dropped++
        }
      }
    }
    // clods: born at the blade, ride the rods, sift through (or go off the end)
    if (working) {
      const nNew = Math.min(8, Math.round(d.soil * c.dt * 1.2 + Math.random()))
      for (let k = 0; k < nNew; k++) {
        const i = clods.next
        clods.next = (clods.next + 1) % CLODS
        clods.u[i] = 0
        clods.z[i] = (Math.random() - 0.5) * (DIG.W - 0.1)
        clods.st[i] = 1
        clods.siftAt[i] = Math.random() < d.sift ? Math.random() * 0.9 : 2
      }
    }
    const hx = c.hitchX
    for (let i = 0; i < CLODS; i++) {
      if (clods.st[i] === 1) {
        clods.u[i] += (d.ve * c.dt) / ELEV_LEN
        clods.x[i] = hx + DIG.elevF[0] + (DIG.elevR[0] - DIG.elevF[0]) * clods.u[i]
        clods.y[i] = yOff + DIG.elevF[1] + (DIG.elevR[1] - DIG.elevF[1]) * clods.u[i] + 0.03
        if (clods.u[i] > clods.siftAt[i] || clods.u[i] >= 1) {
          clods.st[i] = 2
          clods.vy[i] = 0
        }
      } else if (clods.st[i] === 2) {
        clods.vy[i] -= 9.81 * c.dt
        clods.y[i] += clods.vy[i] * c.dt
        if (clods.y[i] < heightAt(grid, clods.x[i], clods.z[i])) clods.st[i] = 0
      }
    }
  }
  useEffect(() => {
    resetSoil(grid, 5)
    resetField(machine)
  }, [machine])
  return (
    <group>
      <FieldRun
        grid={grid}
        pose={pose}
        run={run}
        speed={() => useRoots.getState().speed / 3.6}
        start={START}
        end={END}
        hitchWork={() => HW}
        hitchRaised={HRAISED}
        ptoRpm={() => 540}
        onStep={onStep}
        onReset={() => resetField(useRoots.getState().machine)}
        mounted={<Digger />}
      />
      <Part id="field" name="Field soil" role="static" material="soil" cut={false} info={{ summary: 'Deformable field soil.', role: 'Ridged for cassava; loosened and levelled where the digger has passed. Tyre prints show where the tractor ran.' }}>
        <FieldGround grid={grid} />
      </Part>
      <Crop />
      <Particles
        max={CLODS}
        radius={0.02}
        color="#5b4330"
        update={(set) => {
          let c = 0
          for (let i = 0; i < CLODS; i++) if (clods.st[i] !== 0) set(c++, clods.x[i], clods.y[i], clods.z[i])
          return c
        }}
      />
      <MovingLabels />
    </group>
  )
}

/** Labels follow the moving tractor. */
function MovingLabels() {
  const g = useRef<THREE.Group>(null)
  useSimFrame(() => {
    g.current?.position.set(run.X + (pose.linkage?.L.x ?? -1.05), (pose.linkage?.L.y ?? HW) - HW, 0)
  })
  const machine = useRoots((s) => s.machine)
  return (
    <group ref={g}>
      <PartLabel partId="blade" at={[DIG.tipX - 0.2, -0.05, 0.62]} />
      <PartLabel partId="elevator" at={[(DIG.elevF[0] + DIG.elevR[0]) / 2, 0.55, 0.62]} />
      <PartLabel partId="agitators" at={[(DIG.elevF[0] + DIG.elevR[0]) / 2, 0.1, -0.62]} />
      <PartLabel partId="depth-wheels" at={[DIG.wheelX, DIG.wheelR * 2 + 0.1, DIG.wheelZ]} />
      <PartLabel partId="overload-clutch" at={[-0.42, DIG.frameY + 0.38, 0]} />
      {machine === 'cassava' ? <PartLabel partId="coulters" at={[DIG.discX, 0.4, -DIG.discZ - 0.1]} /> : <PartLabel partId="inverter" at={[DIG.elevR[0] - 0.5, DIG.elevR[1], 0.5]} />}
    </group>
  )
}

export function resetScene() {
  run.X = START
  run.passes = 0
  crop.machine = null
  lastBladeX = NaN
  clods.st.fill(0)
}
