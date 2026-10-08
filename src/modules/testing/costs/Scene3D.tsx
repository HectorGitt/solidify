import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, xform } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { C, buildPlan, covered, distAt, live, pointAt, useCosts, workingPass, type PathPoint } from './model'

const { PI, atan2, sin } = Math
/** drawbar pin behind the rear axle, and pin → gang centre of the trailed disk */
const PIN = -TRACTOR.drawbar.x
const LI = 1.9
const LEAD = PIN + LI
const DISC_R = 0.27

const INFO = {
  field: {
    summary: 'Field plot worked in lands.',
    role: 'Passes run the length of the plot; the tractor turns on the headlands at each end. Field efficiency counts the time lost to turning, overlapping, adjustments and filling, against the time the full width would need at full speed.',
  },
  headland: { summary: 'Headlands.', role: 'Turning strips at the ends of the plot. Time spent here (and the lift/lower at each end) produces no work.' },
  strips: { summary: 'Worked strips (disked soil).', role: 'Each pass leaves a strip as wide as the implement. Theoretical capacity assumes the full width W at speed S all the time: C_t = W·S/10 ha/h.' },
  overlap: { summary: 'Overlap — soil worked twice.', role: 'Each pass overlaps the last a little so no strips are missed. The overlapped width is wasted, so the effective width is W(1 − overlap).' },
  disk: {
    summary: 'Trailed tandem disk harrow.',
    role: 'Two front gangs throw soil outward, two rear gangs throw it back in. It is raised for the headland turns. The worked example costs a used 28-ft tandem disk.',
    details: 'Width follows the W slider. Drawn schematically (no transport wheels or folding wings).',
  },
}

/** Tandem disk harrow, local origin at the drawbar pin, extending along −X. */
function diskGeometry(W: number) {
  const half = W / 2
  const tongue = merge(xform(box(1.25, 0.08, 0.08), mat4.t(-0.62, -0.02, 0)), xform(box(0.1, 0.06, 0.12), mat4.t(-0.03, 0, 0)))
  const frame = merge(
    xform(box(0.1, 0.1, W), mat4.t(-1.3, -0.04, 0)),
    xform(box(0.1, 0.1, W), mat4.t(-2.55, -0.04, 0)),
    ...[-1, 0, 1].map((s) => xform(box(1.35, 0.08, 0.08), mat4.t(-1.925, -0.04, s * (half - 0.04)))),
  )
  const disc = xform(lathe([[0, 0], [DISC_R, 0.05], [DISC_R, 0.058], [0, 0.008]], 28), mat4.rx(PI / 2))
  const m = Math.max(2, Math.floor((half - 0.1) / 0.23) + 1)
  const discs: THREE.BufferGeometry[] = []
  for (let i = 0; i < m; i++) discs.push(xform(disc, mat4.t(0, 0, (i - (m - 1) / 2) * 0.23)))
  const shaft = xform(cylinder(0.02, m * 0.23 + 0.05, 10), mat4.rx(PI / 2))
  const hangers = [-1, 1].map((s) => xform(box(0.06, 0.3, 0.04), mat4.t(0, 0.14, (s * (m - 1) * 0.23) / 2)))
  return { tongue, frame, gang: merge(...discs), shaft: merge(shaft, ...hangers), gangLen: m * 0.23 }
}

export function Scene3D() {
  const st = useCosts()
  const plan = useMemo(() => buildPlan(st), [st.W, st.S, st.overlap, st.passes, st.L, st.turnFixed, st.turnSpeed, st.otherFrac]) // eslint-disable-line react-hooks/exhaustive-deps
  const disk = useMemo(() => diskGeometry(st.W), [st.W])
  const unit = useMemo(() => box(1, 1, 1), [])
  const pose = useMemo(() => createTractorPose(), [])
  const tractor = useRef<THREE.Group>(null)
  const impl = useRef<THREE.Group>(null)
  const lift = useRef<THREE.Group>(null)
  const gangs = useRef<(THREE.Group | null)[]>([])
  const strips = useRef<(THREE.Mesh | null)[]>([])
  const overlaps = useRef<(THREE.Mesh | null)[]>([])
  const clock = useRef({ t: 0, s: 0, key: '' })
  const P = useMemo(() => ({ a: {} as PathPoint, b: {} as PathPoint }), [])

  // neighbouring passes in z (for the overlap bands)
  const pairs = useMemo(() => {
    const order = plan.zs.map((z, k) => ({ z, k })).sort((a, b) => a.z - b.z)
    return order.slice(1).map((o, i) => [order[i].k, o.k, (order[i].z + o.z) / 2] as const)
  }, [plan])

  const margin = plan.rMax + 6
  const lenX = st.L + 2 * margin
  const lenZ = plan.B + 2 * Math.max(6, st.W)

  useSimFrame((dt) => {
    const p = useCosts.getState()
    const c = clock.current
    const key = `${plan.total}|${plan.length}`
    if (c.key !== key) {
      c.key = key
      c.t = 0
    }
    const prevS = distAt(plan, c.t)
    c.t += dt * p.fastForward
    if (c.t > plan.total + 4) c.t = 0
    const t = c.t
    const sI = distAt(plan, t)
    const ds = Math.max(0, sI - prevS)
    // implement centre on the plan; tractor rear axle LEAD metres further along the path
    const a = pointAt(plan, sI, P.a)
    const b = pointAt(plan, sI + LEAD, P.b)
    const yawT = atan2(-b.dz, b.dx)
    if (tractor.current) {
      tractor.current.position.set(b.x, 0, b.z)
      tractor.current.rotation.set(0, yawT, 0)
    }
    const hx = b.x - PIN * b.dx
    const hz = b.z - PIN * b.dz
    let rel = atan2(-(hz - a.z), hx - a.x) - yawT
    rel = atan2(sin(rel), Math.cos(rel))
    if (impl.current) impl.current.rotation.set(0, rel, 0)
    const k = workingPass(plan, t)
    const target = k >= 0 ? 0 : 0.14
    if (lift.current) lift.current.position.y += (target - lift.current.position.y) * Math.min(1, dt * p.fastForward * 4)
    for (const gr of gangs.current) if (gr && k >= 0) gr.rotation.z -= ds / DISC_R
    pose.rearAngle += ds / TRACTOR.rear.rolling
    pose.frontAngle += ds / TRACTOR.front.radius
    pose.steer = b.r > 0 ? b.steer * Math.min(0.6, Math.atan(TRACTOR.wheelbase / b.r)) : 0
    pose.engineAngle += dt * 2 * PI * 30
    // strips and overlaps
    let area = 0
    for (let i = 0; i < plan.n; i++) {
      const m = strips.current[i]
      const cv = covered(plan, i, t)
      if (!m) continue
      if (!cv || cv[1] - cv[0] < 1e-3) {
        m.visible = false
        continue
      }
      m.visible = true
      m.position.set((cv[0] + cv[1]) / 2, 0.012, plan.zs[i])
      m.scale.set(cv[1] - cv[0], 0.006, p.W)
      area += (cv[1] - cv[0]) * plan.we
    }
    pairs.forEach(([ka, kb, zm], j) => {
      const m = overlaps.current[j]
      if (!m) return
      const ca = covered(plan, ka, t)
      const cb = covered(plan, kb, t)
      const lo = ca && cb ? Math.max(ca[0], cb[0]) : 0
      const hi = ca && cb ? Math.min(ca[1], cb[1]) : 0
      if (!ca || !cb || hi - lo < 1e-3 || p.overlap <= 0) {
        m.visible = false
        return
      }
      m.visible = true
      m.position.set((lo + hi) / 2, 0.0175, zm)
      m.scale.set(hi - lo, 0.003, p.W * p.overlap)
    })
    live.t = t
    live.total = plan.total
    live.area = area
    live.working = k >= 0
    live.pass = k
    live.FEsoFar = t > 1 ? area / (p.W * (p.S / 3.6)) / Math.min(t, plan.total) : 0
  })

  const gangPos: [number, number, number][] = [
    [-1.62, 1, 1],
    [-1.62, -1, -1],
    [-2.27, 1, -1],
    [-2.27, -1, 1],
  ]
  const angle = (18 * PI) / 180
  const zc = disk.gangLen / 2 + 0.06

  const implement = (
    <group ref={impl}>
      <Part id="disk-harrow" name="Tandem disk harrow" role="moving" material="paintYellow" info={INFO.disk} cites={[C.mgmt('p7, used 28-ft tandem disk')]} cut={false}>
        <PartMesh geometry={disk.tongue} />
        <group ref={lift}>
          <PartMesh geometry={disk.frame} />
          {gangPos.map(([x, side, sense], i) => (
            <group key={i} position={[x, 0.28 - TRACTOR.drawbar.y, side * zc]} rotation={[0, sense * angle, 0]}>
              <PartMesh geometry={disk.shaft} material="steelDark" />
              <group
                ref={(el) => {
                  gangs.current[i] = el
                }}
              >
                <PartMesh geometry={disk.gang} material="steel" />
              </group>
            </group>
          ))}
        </group>
      </Part>
    </group>
  )

  return (
    <group>
      <Part id="field" name="Field plot" role="housing" material="straw" info={INFO.field} cites={[C.mgmt('p7–8 field capacity, field efficiency')]} cut={false}>
        <PartMesh geometry={unit} material="crop" position={[0, -0.05, 0]} scale={[lenX + 30, 0.1, lenZ + 30]} receiveShadow />
        <PartMesh geometry={unit} position={[0, 0.004, 0]} scale={[lenX, 0.008, plan.B + 0.4]} receiveShadow />
        <Part id="headlands" name="Headlands" material="paintYellow" info={INFO.headland} cites={[C.mgmt('p7 field efficiency: turning at the ends')]}>
          {[-1, 1].map((s) => (
            <PartMesh key={s} geometry={unit} position={[(s * st.L) / 2, 0.011, 0]} scale={[0.25, 0.004, plan.B + 0.4]} />
          ))}
        </Part>
        <Part id="worked-strips" name="Worked strips" material="soil" info={INFO.strips} cites={[C.mgmt('p7–8 C = W·S·FE/8.25')]}>
          {Array.from({ length: plan.n }, (_, i) => (
            <PartMesh
              key={`${plan.n}-${i}`}
              ref={(el) => {
                strips.current[i] = el
              }}
              geometry={unit}
              visible={false}
            />
          ))}
        </Part>
        <Part id="overlap" name="Overlap (worked twice)" material="paintOrange" info={INFO.overlap} cites={[C.mgmt('p7 overlapping')]}>
          {pairs.map((_, j) => (
            <PartMesh
              key={`${plan.n}-${j}`}
              ref={(el) => {
                overlaps.current[j] = el
              }}
              geometry={unit}
              visible={false}
            />
          ))}
        </Part>
      </Part>
      <group ref={tractor}>
        <Tractor pose={pose} labels={false} linkage={false} internals={false} trailed={implement} />
      </group>
      <PartLabel partId="headlands" at={[st.L / 2, 1.5, plan.B / 2 + 1]} />
      <PartLabel partId="field" at={[-st.L / 4, 1.5, -plan.B / 2 - 2]} />
      <PartLabel partId="worked-strips" at={[0, 1.2, plan.zs[0]]} />
      <PartLabel partId="overlap" at={[st.L / 4, 1.2, 0]} />
    </group>
  )
}
