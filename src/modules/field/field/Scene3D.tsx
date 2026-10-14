import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { merge, pipe } from '@/geometry'
import { FieldGround, Level, makeSoil, mirror, resetSoil } from '@/modules/implements/_shared/field'
import { aFrameMast, bar, discGang, plateXY, plateXZ } from '@/parts/lib/implements'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { PROFILES, stampRun } from '@/render/soil'
import { pressTractor, rutDepths } from '@/tractor/ruts'
import { TRACTOR } from '@/tractor/dims'
import { farmlandEffects } from '@/tractor/effects'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { C, FIELD, IMPLEMENTS, lanePlan, live, operating, pointAt, useField, type FieldParams, type ImplementId } from './model'

const { PI } = Math
export const pose = createTractorPose({ hitchHeight: 0.6 })
export const grid = makeSoil({ ...FIELD, cell: 0.08 }, 9)
const RAISED = 0.85
const drive = { s: 0, lastToolX: NaN, lastLane: -1, printAcc: 0, plan: lanePlan(IMPLEMENTS.plough.W), planFor: 'plough' as ImplementId, loops: 0 }

/** Cache of the two operating points (working / raised) for the current settings. */
let cache: { key: string; work: ReturnType<typeof operating>; raised: ReturnType<typeof operating> } | null = null
function points(st: FieldParams) {
  const key = `${st.implement}|${st.gear}|${st.throttle}|${st.depth}|${st.unitDraft}|${st.CI}`
  if (!cache || cache.key !== key) cache = { key, work: operating(st, true), raised: operating(st, false) }
  return cache
}

const SM = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/* ------------------------------ simple implements (digger frame: y = 0 at the ground when working) ------------------------------ */

const INFO: Record<Exclude<ImplementId, 'none'>, { summary: string; role: string; details?: string }> = {
  plough: { summary: 'Three-bottom mouldboard plough (simplified).', role: 'Each bottom’s share cuts a furrow slice and the mouldboard lifts and inverts it into the previous furrow. Draft = unit draft × furrow cross-section.', details: 'A simple stand-in; the full plough is in Implements › Mouldboard plough.' },
  disc: { summary: 'Tandem disc harrow (simplified).', role: 'Front gangs throw soil out, rear gangs throw it back, leaving a level tilth. Gang angle sets the bite.', details: 'Draft per metre is a typical value.' },
  cultivator: { summary: 'Tine cultivator (simplified).', role: 'Spring tines with shovels stir the soil and pull out weeds without inverting it.', details: 'Draft per tine is a typical value.' },
  ridger: { summary: 'Three-row ridger (simplified).', role: 'Double-mouldboard bodies throw soil both ways into ridges for root crops.', details: 'Draft per body is a typical value.' },
}

function headstock(hw: number) {
  return [aFrameMast({ at: [0, hw, 0] })]
}

function implementGeometry(id: Exclude<ImplementId, 'none'>) {
  const spec = IMPLEMENTS[id]
  const hw = spec.hw
  const frame: THREE.BufferGeometry[] = [...headstock(hw)]
  const tools: THREE.BufferGeometry[] = []
  const spin: { at: [number, number, number]; yaw: number; geo: THREE.BufferGeometry }[] = []
  if (id === 'plough') {
    frame.push(bar([-0.1, hw + 0.1, 0.35], [-1.75, 0.65, -0.45], 0.1, 0.1), bar([0.02, hw + 0.6, 0], [-0.9, 0.7, 0], 0.06, 0.06))
    for (let j = 0; j < 3; j++) {
      const x = -0.6 - 0.55 * j
      const z = 0.35 - 0.35 * j
      frame.push(bar([x, 0.66, z], [x - 0.12, 0.08, z], 0.04, 0.1))
      tools.push(
        plateXZ([[x + 0.18, z + 0.02], [x - 0.15, z + 0.03], [x - 0.15, z - 0.2]], 0.012, 0.0),
        plateXY([[x - 0.15, 0], [x - 0.5, 0], [x - 0.5, 0.18], [x - 0.15, 0.12]], 0.012, z + 0.02),
        ...[0, 1, 2, 3].map((k) => bar([x + 0.05 - k * 0.06, 0.03 + k * 0.08, z - 0.05 - k * 0.04], [x - 0.35 - k * 0.04, 0.12 + k * 0.1, z - 0.25 - k * 0.06], 0.08, 0.012)),
      )
    }
  } else if (id === 'disc') {
    frame.push(bar([0, hw + 0.05, 0], [-1.8, 0.55, 0], 0.1, 0.1), bar([-0.4, 0.55, 1.25], [-0.4, 0.55, -1.25], 0.1, 0.1), bar([-1.4, 0.55, 1.25], [-1.4, 0.55, -1.25], 0.1, 0.1))
    const gang = () => discGang()
    for (const [x, s, a] of [[-0.45, 1, 0.3], [-0.45, -1, -0.3], [-1.45, 1, -0.3], [-1.45, -1, 0.3]] as const) spin.push({ at: [x, 0.17, s * 0.62], yaw: a, geo: gang() })
  } else if (id === 'cultivator') {
    frame.push(bar([0, hw + 0.05, 0], [-1.3, 0.62, 0], 0.08, 0.08), bar([-0.5, 0.62, 1.3], [-0.5, 0.62, -1.3], 0.08, 0.08), bar([-1.1, 0.62, 1.3], [-1.1, 0.62, -1.3], 0.08, 0.08))
    for (let k = 0; k < 9; k++) {
      const z = -1.12 + k * 0.28
      const x = k % 2 ? -1.1 : -0.5
      const tine = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.6, z), new THREE.Vector3(x - 0.22, 0.48, z), new THREE.Vector3(x - 0.12, 0.25, z), new THREE.Vector3(x + 0.05, 0.03, z)])
      tools.push(pipe(tine, 0.014, 0, 24, 6), plateXY([[x + 0.12, 0], [x - 0.02, -0.01], [x, 0.08]], 0.05, z - 0.025))
    }
  } else {
    frame.push(bar([0, hw + 0.05, 0], [-0.9, 0.62, 0], 0.08, 0.08), bar([-0.75, 0.62, 1.2], [-0.75, 0.62, -1.2], 0.1, 0.1))
    for (const z of [-0.75, 0, 0.75]) {
      frame.push(bar([-0.75, 0.62, z], [-0.85, 0.1, z], 0.04, 0.1))
      for (const s of [1, -1]) tools.push(plateXY([[-0.6, 0], [-1.25, 0], [-1.25, 0.32], [-0.75, 0.1]], 0.012, z), bar([-0.62, 0.02, z], [-1.2, 0.25, z + s * 0.28], 0.25, 0.012))
    }
  }
  return { frame: merge(...frame), tools: tools.length ? merge(...tools) : null, spin }
}

function Implement({ id, toolRef }: { id: Exclude<ImplementId, 'none'>; toolRef: RefObject<THREE.Group | null> }) {
  const g = useMemo(() => implementGeometry(id), [id])
  const spec = IMPLEMENTS[id]
  const work = useRef<THREE.Group>(null)
  const spins = useRef<(THREE.Group | null)[]>([])
  useSimFrame((dt) => {
    const st = useField.getState()
    work.current?.position.set(0, -st.depth, 0)
    for (const s of spins.current) if (s) s.rotation.z -= (live.V * dt) / 0.25
  })
  return (
    <group position={[0, -spec.hw, 0]}>
      <Part id="implement" name={spec.label} role="static" material="paintBlue" info={INFO[id]} cites={id === 'plough' ? [C.am('§12 plough draft')] : [C.beyond('typical implement drafts')]} beyondNotes={spec.beyond}>
        <PartMesh geometry={g.frame} />
        <group ref={work}>
          {g.tools && (
            <Part id="implement-tools" name={id === 'plough' ? 'Shares, mouldboards and landsides' : id === 'cultivator' ? 'Tines and shovels' : 'Ridging bodies'} role="static" material="steel" info={INFO[id]}>
              <PartMesh geometry={g.tools} />
            </Part>
          )}
          {g.spin.length > 0 && (
            <Part id="implement-gangs" name="Disc gangs" role="moving" material="steel" info={INFO.disc}>
              {g.spin.map((s, i) => (
                <group key={i} position={s.at} rotation={[0, s.yaw, 0]}>
                  <group ref={(el) => {
                    spins.current[i] = el
                  }}>
                    <PartMesh geometry={s.geo} />
                  </group>
                </group>
              ))}
            </Part>
          )}
          <group ref={toolRef} position={[id === 'plough' ? -1.4 : -0.9, 0, 0]} />
        </group>
      </Part>
    </group>
  )
}

/* ------------------------------ soil working ------------------------------ */

function workSoil(id: ImplementId, xa: number, xb: number, z: number, heading: number, depth: number) {
  if (id === 'none') return
  const spec = IMPLEMENTS[id]
  const fwd = Math.cos(heading) > 0
  if (id === 'plough') {
    // throw to the right of travel: right is −z going +X, +z going −X
    const right = fwd ? -1 : 1
    const bw = spec.W / 3
    for (let j = 0; j < 3; j++) {
      const dz = right * (spec.W / 2 - bw / 2 - j * bw)
      const prof = right > 0 ? PROFILES.mouldboard(depth * 0.5, bw) : mirror(PROFILES.mouldboard(depth * 0.5, bw))
      stampRun(grid, xa, xb, z + dz, bw * 1.8, prof, { mode: 'set', blend: 0.7, disturb: 1 })
    }
  } else if (id === 'disc') stampRun(grid, xa, xb, z, spec.W / 2, PROFILES.tilth(depth * 0.25, 0.25), { mode: 'set', blend: 0.6, disturb: 0.9 })
  else if (id === 'cultivator') stampRun(grid, xa, xb, z, spec.W / 2, PROFILES.tilth(depth * 0.15, 0.28), { mode: 'set', blend: 0.5, disturb: 0.75 })
  else for (const dz of [-0.75, 0, 0.75]) stampRun(grid, xa, xb, z + dz, 0.375, PROFILES.ridge(depth, 0.75), { mode: 'set', blend: 0.6, disturb: 1 })
}

/* ------------------------------ scene ------------------------------ */

export function Field3D() {
  const implement = useField((s) => s.implement)
  const internals = useField((s) => s.internals)
  const tractor = useRef<THREE.Group>(null)
  const tool = useRef<THREE.Group>(null)
  const v = useMemo(() => new THREE.Vector3(), [])

  useSimFrame((dt) => {
    if (dt <= 0) return
    const st = useField.getState()
    const spec = IMPLEMENTS[st.implement]
    if (drive.planFor !== st.implement) {
      drive.plan = lanePlan(spec.W)
      drive.planFor = st.implement
      drive.s = 0
      drive.lastToolX = NaN
      resetSoil(grid, 9)
    }
    const pt = pointAt(drive.plan, drive.s)
    const seg = drive.plan.segs[pt.i]
    // lower over the first 2 m of a lane, lift over the last 1.5 m
    const along = pt.u * seg.len
    const lowered = pt.work && st.implement !== 'none' ? SM(along / 2) * SM((seg.len - along) / 1.5) : 0
    const { work, raised } = points(st)
    const op = lowered > 0.5 ? work : raised
    const d = op.pt
    const V = d.stalled || d.spinning ? 0.05 : d.V
    const V0 = d.stalled ? 0 : d.V0
    drive.s += V * dt
    if (drive.s >= drive.plan.total) {
      drive.s -= drive.plan.total
      drive.loops++
      resetSoil(grid, 9 + (drive.loops % 4))
      drive.lastToolX = NaN
    }
    live.rpm = d.rpm
    live.V = V
    live.V0 = V0
    live.slip = d.slip
    live.P = d.P
    live.Pd = d.P * V
    live.Pe = d.Pe
    live.fuel = d.fuel.Lh
    live.etaT = d.etaT
    live.working = lowered > 0.5
    live.stalled = d.stalled
    live.spinning = d.spinning
    live.tTotal += dt
    if (live.working) {
      live.tWork += dt
      live.area += spec.W * V * dt
    }
    // tractor pose
    const p2 = pointAt(drive.plan, drive.s)
    tractor.current?.position.set(p2.x, 0, p2.z)
    tractor.current?.rotation.set(0, p2.h, 0)
    pose.steer = p2.turn ? -p2.turn * Math.min(0.6, Math.atan(TRACTOR.wheelbase / p2.R)) : 0
    pose.rearAngle += (V0 * dt) / TRACTOR.rear.rolling
    pose.frontAngle += (V * dt) / TRACTOR.front.radius
    pose.engineAngle += (dt * 2 * PI * (Number.isFinite(d.rpm) ? d.rpm : 0)) / 60
    pose.hitchHeight = RAISED + (spec.hw - RAISED) * lowered
    pose.effects = farmlandEffects({ Te: d.Te, rpm: d.rpm, V, slip: d.slip, stalled: d.stalled }, 0.85)
    // tyre ruts: depth from the axle loads, the soil strength and the slip
    drive.printAcc += V * dt
    if (drive.printAcc > 0.12) {
      drive.printAcc = 0
      const slip = Number.isFinite(d.slip) ? d.slip : 0
      pressTractor(grid, p2.x, p2.z, p2.h, rutDepths(d.Vr, d.Vf, st.CI * 1000, slip), slip)
    }
    // work the soil behind the tool
    if (tool.current && lowered > 0.6) {
      tool.current.getWorldPosition(v)
      if (drive.lastLane === pt.i && Number.isFinite(drive.lastToolX) && Math.abs(v.x - drive.lastToolX) > 0.05) workSoil(st.implement, drive.lastToolX, v.x, p2.z, p2.h, st.depth)
      if (drive.lastLane !== pt.i || Math.abs(v.x - drive.lastToolX) > 0.05 || !Number.isFinite(drive.lastToolX)) drive.lastToolX = v.x
      drive.lastLane = pt.i
    } else drive.lastToolX = NaN
  })

  return (
    <group>
      <group ref={tractor}>
        <Tractor
          pose={pose}
          internals={internals}
          labels
          gearRatio={3}
          mounted={
            implement !== 'none' ? (
              <Level pose={pose}>
                <Implement id={implement} toolRef={tool} />
              </Level>
            ) : undefined
          }
        />
        {implement !== 'none' && <PartLabel partId="implement" at={[-1.6, 1.0, 0.6]} />}
      </group>
      <Part id="field-soil" name="Field soil" role="static" material="soil" cut={false} info={{ summary: 'Deformable field soil.', role: 'Shows each pass: furrows, tilth or ridges where the implement worked, and tyre prints where the tractor ran.' }} cites={[C.l27('cone index, eq 14')]}>
        <FieldGround grid={grid} margin={20} />
      </Part>
    </group>
  )
}

export function resetScene() {
  drive.s = 0
  drive.lastToolX = NaN
  drive.planFor = 'none'
  cache = null
  resetSoil(grid, 9)
}
