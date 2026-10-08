import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, merge } from '@/geometry'
import { FARMLAND_GEARS } from '@/physics/tractor'
import { UPPSALA } from '@/physics/testing'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { REAR_Z } from '@/tractor/geometry'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { boxAt, cyl, dial, eye, needle, rodBetween, tubeAt, wheelZ } from './bits'
import { LiveTag } from './bits3d'
import { C, CYL, DILLON, RUN, dampingTau, fluctuation, live, solveCached, stopRun, useDrawbar } from './model'

const TAU = Math.PI * 2
/** Drawbar pin (tractor frame = world here; the tractor stands still and the track moves). */
const PIN = { x: TRACTOR.drawbar.x, y: TRACTOR.drawbar.y }
const HY = PIN.y
/** Hitch-line stations along −X. */
const X = { pin: PIN.x, meterEnd: PIN.x - 0.42, capFront: -1.25, capRear: -1.95, carFront: -2.05 }
const CAR = { wheelR: 0.42, front: -2.75, rear: -4.85, track: 0.82 }
const DRUM = { r: UPPSALA.drumR, w: 0.55, y: -UPPSALA.drumR }
const TRAIN = { gb1: -1.75, gb2: -2.45, dyno: -3.15, vst: -3.8, motor: -4.4 }
const PIT = { x0: -0.95, x1: 1.75, z0: -4.95, z1: 1.25, floor: -1.8 }

export const pose = createTractorPose({ hitchHeight: 0.6 })

/* ------------------------------ info ------------------------------ */

const INFO = {
  car: {
    summary: 'Nebraska tractor test car (dynamometer car).',
    role: 'Hitched behind the tractor, it loads the drawbar and measures the pull through a hydraulic cylinder. It also measures tractor velocity, wheel slip, engine rpm, fuel use, sound level and the temperatures of intake air, hydraulic fluid, coolant, fuel intake and fuel return.',
    details: 'Body shape and dimensions are estimated.',
  },
  cylinder: {
    summary: 'Hydraulic drawbar cylinder.',
    role: 'Transmits the drawbar force to the car. The pull pressurises the oil behind the piston: p = P/A. A 100 mm bore (typical) gives 2.5 MPa at 20 kN.',
  },
  oil: { summary: 'Oil in the cylinder.', role: 'Its pressure is proportional to the pull, so a pressure transducer reads the force.' },
  piston: { summary: 'Piston and rod.', role: 'The rod eye takes the pull from the hitch line; the motion shown is exaggerated.' },
  valve: {
    summary: 'Throttling valve.',
    role: 'Damps the pressure fluctuations — the advantage of the hydraulic cylinder over a spring dynamometer, whose needle follows every surge in the load.',
  },
  transducer: { summary: 'Pressure transducer.', role: 'Turns the oil pressure into an electrical signal that goes to a recorder and a computer.' },
  recorder: { summary: 'Recorder and computer.', role: 'Log pull, velocity, wheel slip, engine rpm, fuel use, sound level and temperatures during the test.' },
  dillon: {
    summary: 'Spring-type drawbar dynamometer (Dillon dial).',
    role: 'A spring that elongates under tension (or shortens under compression) turns the needle. Suitable for rough measurements only: with the rapid load variations of implements, the actual load at any instant can only be approximated.',
  },
  link: {
    summary: 'Strain-gauge force transducer with digital readout.',
    role: 'Electrical resistance strain gauges on the link sense its strain under the pull; the readout box converts it to force.',
    details: 'Gauge section 40 × 25 mm steel here (typical): 20 kN gives ε ≈ 98 µε.',
  },
  shackle: { summary: 'Plain shackle.', role: 'With the test car’s own cylinder doing the measuring, the hitch line is a plain link.' },
  track: { summary: 'Test track.', role: 'Nebraska drawbar tests are run on a concrete track; switch to soil in Controls to see slip and rolling resistance rise.' },
  drums: {
    summary: 'Concrete-covered drums under the drive wheels.',
    role: 'The rear wheels drive the drums. The concrete surface closely simulates a concrete test track and is unaffected by the weather, so testing can go on all year.',
  },
  gb1: { summary: 'Gearbox 1 : 18.', role: 'Steps up the slow drum speed so the hydraulic dynamometer runs at a useful speed.' },
  gb2: { summary: 'Gearbox 1 : 1–7.7.', role: 'Range gearbox: matches the absorber speed to the tractor gear and travel speed.' },
  dyno: {
    summary: 'Hydraulic dynamometer (absorber).',
    role: 'Absorbs the power as heat in water; its torque rises roughly as n² (capacity ∝ N³D⁵).',
  },
  vst: { summary: 'Variable-speed transmission.', role: 'Couples the electric motor to the drum train.' },
  motor: {
    summary: 'Electric motor.',
    role: 'A motor of this kind can drive the drums, e.g. to turn the tractor wheels for checking the rig.',
  },
  pendulum: {
    summary: 'Pendulum frame.',
    role: 'Carries the gearboxes and absorber and is free to swing about the drum axis, so the whole reaction torque comes onto the scale: T = F·l and P = 2πlFn/60 000.',
  },
  scale: { summary: 'Scale.', role: 'Reads the force F on the pendulum arm l.' },
  restraint: {
    summary: 'Restraint with load link.',
    role: 'Holds the tractor on the drums. Because the tractor is restrained there is no rolling resistance of the front wheels — an obvious disadvantage of the system.',
  },
  floor: { summary: 'Laboratory floor and pit.', role: 'The drums are set in a pit flush with the floor.' },
}

/* ------------------------------ ground marks ------------------------------ */

function TrackMarks({ visible }: { visible: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const N = 32
  const L = 16
  const geo = useMemo(() => new THREE.BoxGeometry(0.08, 0.004, 3.2), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8d2b8', roughness: 0.9 }), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useSimFrame(() => {
    const m = ref.current
    if (!m) return
    m.visible = visible
    const off = live.dist % (L / N)
    for (let i = 0; i < N; i++) {
      dummy.position.set(7 - (i * L) / N - off, 0.002, 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, N]} />
}

/* ------------------------------ the test car and hitch line ------------------------------ */

function HitchLine() {
  const meter = useDrawbar((s) => s.meter)
  const dialNeedle = useRef<THREE.Group>(null)
  const g = useMemo(() => {
    const x0 = X.pin
    const x1 = X.meterEnd
    const mid = (x0 + x1) / 2
    return {
      link: merge(cyl('x', 0.035, 0.2, mid, HY), eye(x0 - 0.02, HY, -0.08, 0.03, 0.03), eye(x1 + 0.02, HY, 0.08, 0.03, 0.03), cyl('y', 0.012, 0.06, mid, HY + 0.05)),
      cable: rodBetween([mid, HY + 0.08, 0], [mid - 0.3, 0.9, 0.2], 0.006),
      readout: boxAt(0.32, 0.18, 0.2, mid - 0.45, 0.98, 0.25),
      readoutFace: boxAt(0.14, 0.05, 0.004, mid - 0.45, 1.0, 0.352),
      dialBody: dial(0.15, 0.08),
      shackles: merge(eye(x0 - 0.02, HY, -0.11, 0.03, 0.035), eye(x1 + 0.02, HY, 0.11, 0.03, 0.035)),
      plain: merge(rodBetween([x0, HY, 0], [x1, HY, 0], 0.022), eye(x0 - 0.02, HY, -0.06, 0.03, 0.03), eye(x1 + 0.02, HY, 0.06, 0.03, 0.03)),
      needle: needle(0.12),
      pin: cyl('z', 0.018, 0.14, x0, HY),
    }
  }, [])
  useSimFrame(() => {
    // Dillon: 0–100 kN over 0.9 turn, clockwise from the top
    if (dialNeedle.current) dialNeedle.current.rotation.z = -(Math.max(0, live.Pread) / DILLON.fullScale) * 0.9 * TAU
  })
  const mid = (X.pin + X.meterEnd) / 2
  return (
    <Part id="hitch-line" name="Hitch line" role="static" material="forged" info={{ summary: 'Hitch line from the drawbar pin to the test car.', role: 'Whatever drawbar dynamometer is fitted here carries the full pull P.' }} cites={[C.spring, C.gauge]}>
      <PartMesh geometry={g.pin} material="chrome" />
      {meter === 'link' ? (
        <Part id="link" name="Strain-gauge link & readout" material="steel" info={INFO.link} cites={[C.gauge]} cut={false}>
          <PartMesh geometry={g.link} />
          <PartMesh geometry={g.cable} material="rubber" />
          <PartMesh geometry={g.readout} material="paintGrey" />
          <PartMesh geometry={g.readoutFace} material="plastic" />
        </Part>
      ) : meter === 'dillon' ? (
        <Part id="dillon" name="Dillon spring dial" material="aluminium" info={INFO.dillon} cites={[C.spring]} cut={false}>
          <PartMesh geometry={g.shackles} material="forged" />
          <group position={[mid, HY + 0.02, 0.05]}>
            <PartMesh geometry={g.dialBody} />
            <group ref={dialNeedle} position={[0, 0, 0.045]}>
              <PartMesh geometry={g.needle} material="paintRed" />
            </group>
          </group>
        </Part>
      ) : (
        <Part id="shackle" name="Plain shackle" material="forged" info={INFO.shackle} cites={[C.car]}>
          <PartMesh geometry={g.plain} />
        </Part>
      )}
    </Part>
  )
}

function TestCar() {
  const rod = useRef<THREE.Group>(null)
  const oil = useRef<THREE.Mesh>(null)
  const wheels = useRef<(THREE.Group | null)[]>([])
  const g = useMemo(() => {
    const zc = CAR.track
    const w = wheelZ(CAR.wheelR, 0.26, 'F2')
    const bodyX0 = -5.45
    const bodyX1 = X.carFront - 0.05
    const lower = boxAt(bodyX1 - bodyX0, 0.36, 1.7, (bodyX0 + bodyX1) / 2, 1.12)
    const upper = boxAt(2.7, 1.0, 1.6, -4.15, 1.73)
    const nose = boxAt(0.55, 0.5, 1.6, -2.55, 1.48)
    const glass = merge(boxAt(0.04, 0.6, 1.3, -2.79, 1.82), boxAt(1.0, 0.55, 0.02, -3.45, 1.82, 0.805), boxAt(1.0, 0.55, 0.02, -3.45, 1.82, -0.805), boxAt(0.8, 0.55, 0.02, -4.7, 1.82, 0.805), boxAt(0.8, 0.55, 0.02, -4.7, 1.82, -0.805))
    const frame = merge(boxAt(3.5, 0.12, 0.12, -3.95, 0.52, 0.5), boxAt(3.5, 0.12, 0.12, -3.95, 0.52, -0.5), boxAt(0.3, 0.3, 1.1, X.carFront - 0.08, HY + 0.02))
    const rack = merge(boxAt(1.6, 0.05, 1.4, -4.2, 2.26), boxAt(0.9, 0.3, 0.7, -4.4, 2.43, 0.2), boxAt(0.5, 0.22, 0.5, -3.7, 2.39, -0.3))
    const len = X.capFront - X.capRear
    const barrel = tubeAt('x', 0.075, CYL.bore / 2, len, (X.capFront + X.capRear) / 2, HY)
    const rearCap = cyl('x', 0.075, 0.04, X.capRear - 0.02, HY)
    const frontCap = tubeAt('x', 0.075, CYL.rod / 2 + 0.002, 0.04, X.capFront + 0.02, HY)
    const trunnion = merge(boxAt(0.1, 0.16, 0.2, X.capRear - 0.07, HY), boxAt(0.04, 0.24, 0.24, X.carFront + 0.02, HY))
    const rodGeo = merge(cyl('x', CYL.rod / 2, 0.62, -0.31, 0), eye(0.02, 0, -0.08, 0.035, 0.032))
    const piston = cyl('x', CYL.bore / 2 - 0.001, 0.05, -0.62, 0)
    const oilGeo = tubeAt('x', CYL.bore / 2 - 0.0015, CYL.rod / 2 + 0.001, 1, 0.5, 0, 0)
    // hydraulic line: rear port → throttling valve → transducer, then cable to the recorder
    const port: [number, number, number] = [X.capRear + 0.06, HY + 0.075, 0]
    const vPos: [number, number, number] = [X.capRear + 0.02, HY + 0.32, 0]
    const line = merge(rodBetween(port, [port[0], vPos[1] - 0.05, 0], 0.008), rodBetween([vPos[0], vPos[1] + 0.05, 0], [vPos[0], vPos[1] + 0.2, 0], 0.008))
    const valve = merge(boxAt(0.09, 0.1, 0.09, ...vPos), cyl('z', 0.02, 0.08, vPos[0], vPos[1], 0.08), cyl('z', 0.035, 0.015, vPos[0], vPos[1], 0.125))
    const tPos: [number, number, number] = [vPos[0], vPos[1] + 0.27, 0]
    const transducer = merge(cyl('y', 0.025, 0.08, ...tPos), cyl('y', 0.012, 0.04, tPos[0], tPos[1] + 0.06, 0))
    const cable = rodBetween([tPos[0], tPos[1] + 0.08, 0], [-2.95, 1.35, 0.1], 0.006)
    const recorder = merge(boxAt(0.5, 0.35, 0.7, -3.2, 1.42, 0.15), boxAt(0.04, 0.22, 0.34, -2.94, 1.47, 0.15))
    const signal = new THREE.LineCurve3(new THREE.Vector3(tPos[0], tPos[1] + 0.1, 0), new THREE.Vector3(-2.95, 1.35, 0.1))
    return { signal, w, zc, lower, upper, nose, glass, frame, rack, barrel, rearCap, frontCap, trunnion, rodGeo, piston, oilGeo, line, valve, transducer, cable, recorder }
  }, [])

  useSimFrame(() => {
    // rod and piston pulled forward by the load: 12 mm per 50 kN (exaggerated oil and hose compliance)
    const dx = (Math.max(0, live.Pinst) / 50000) * 0.012
    const xEye = X.meterEnd - 0.02 + dx
    rod.current?.position.set(xEye, HY, 0)
    // pressurised oil fills the annulus between the piston (rod side) and the front cap
    const pistonFront = xEye - 0.62 + 0.025
    if (oil.current) {
      oil.current.position.set(pistonFront, HY, 0)
      oil.current.scale.set(Math.max(0.005, X.capFront - pistonFront), 1, 1)
    }
    const a = live.dist / CAR.wheelR
    for (const w of wheels.current) if (w) w.rotation.z = -a
  })

  return (
    <Part id="test-car" name="Nebraska test car" role="housing" material="paintGrey" info={INFO.car} cites={[C.car]}>
      <Part id="car-body" name="Car body & frame" role="housing" material="paintGrey" cut={false} info={INFO.car} cites={[C.car]}>
        <PartMesh geometry={g.lower} />
        <PartMesh geometry={g.upper} />
        <PartMesh geometry={g.nose} />
        <PartMesh geometry={g.glass} material="glass" />
        <PartMesh geometry={g.frame} material="paintBlack" />
        <PartMesh geometry={g.rack} material="aluminium" />
      </Part>
      <Part id="car-wheels" name="Car wheels" role="moving" material="rubber" info={{ summary: 'Test-car wheels.', role: 'Roll at the true ground speed V; counting their turns over a measured distance gives V and, against the tractor wheel turns, the tractor wheel slip.' }} cites={[C.car]}>
        {[CAR.front, CAR.rear].flatMap((x, i) =>
          [1, -1].map((s, j) => (
            <group key={`${x}${s}`} position={[x, CAR.wheelR, s * g.zc]}>
              <group
                ref={(el) => {
                  wheels.current[i * 2 + j] = el
                }}
              >
                <group rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                  <PartMesh geometry={g.w.tyre} />
                  <PartMesh geometry={g.w.rim} material="paintGrey" />
                </group>
              </group>
            </group>
          )),
        )}
      </Part>
      <Part id="drawbar-cylinder" name="Hydraulic drawbar cylinder" role="housing" material="steelDark" info={INFO.cylinder} cites={[C.car]} explode={[0, 0, 0.5]}>
        <PartMesh geometry={g.barrel} />
        <PartMesh geometry={g.rearCap} />
        <PartMesh geometry={g.frontCap} />
        <PartMesh geometry={g.trunnion} material="paintBlack" />
        <group ref={rod} position={[X.meterEnd - 0.02, HY, 0]}>
          <Part id="piston-rod" name="Piston & rod" role="moving" material="chrome" info={INFO.piston} cites={[C.car]}>
            <PartMesh geometry={g.rodGeo} />
            <PartMesh geometry={g.piston} material="steel" />
          </Part>
        </group>
        <Part id="cyl-oil" name="Pressurised oil" role="fluid" material="hydraulicOil" info={INFO.oil} cites={[C.car]}>
          <PartMesh ref={oil} geometry={g.oilGeo} />
        </Part>
      </Part>
      <Part id="throttling-valve" name="Throttling valve" role="static" material="brass" info={INFO.valve} cites={[C.car]} explode={[0, 0.2, 0.3]}>
        <PartMesh geometry={g.line} material="steel" />
        <PartMesh geometry={g.valve} />
      </Part>
      <Part id="transducer" name="Pressure transducer" role="static" material="steel" info={INFO.transducer} cites={[C.car]} cut={false} explode={[0, 0.3, 0.3]}>
        <PartMesh geometry={g.transducer} />
        <PartMesh geometry={g.cable} material="rubber" />
      </Part>
      <Part id="recorder" name="Recorder & computer" role="static" material="paintBlack" info={INFO.recorder} cites={[C.car]} cut={false}>
        <PartMesh geometry={g.recorder} />
      </Part>
      <Flow
        curve={g.signal}
        count={14}
        radius={0.008}
        color="#7fd3ff"
        speed={1.2}
        spread={0.001}
        intensity={() => Math.min(1, live.Pread / 20000)}
      />
    </Part>
  )
}

/* ------------------------------ Uppsala chassis dynamometer ------------------------------ */

function ChassisDyno() {
  const drum = useRef<THREE.Group>(null)
  const s1 = useRef<THREE.Group>(null)
  const s2 = useRef<THREE.Group>(null)
  const s3 = useRef<THREE.Group>(null)
  const rotor = useRef<THREE.Group>(null)
  const scaleNeedle = useRef<THREE.Group>(null)
  const ang = useRef({ drum: 0, s1: 0, s2: 0 })
  const g = useMemo(() => {
    const yA = DRUM.y
    const t = 0.25
    const slabs = merge(
      boxAt(8.5, t, 3.0, 0.25, -t / 2, PIT.z1 + 1.5),
      boxAt(8.5, t, 1.5, 0.25, -t / 2, PIT.z0 - 0.75),
      boxAt(PIT.x0 + 4, t, PIT.z1 - PIT.z0, (PIT.x0 - 4) / 2, -t / 2, (PIT.z0 + PIT.z1) / 2),
      boxAt(4.5 - PIT.x1, t, PIT.z1 - PIT.z0, (PIT.x1 + 4.5) / 2, -t / 2, (PIT.z0 + PIT.z1) / 2),
    )
    const d = PIT.floor
    const wall = (x0: number, x1: number, z0: number, z1: number) => boxAt(x1 - x0, -t - d, z1 - z0, (x0 + x1) / 2, (d - t) / 2, (z0 + z1) / 2)
    const pit = merge(
      boxAt(PIT.x1 - PIT.x0 + 0.4, 0.2, PIT.z1 - PIT.z0 + 0.4, (PIT.x0 + PIT.x1) / 2, d - 0.1, (PIT.z0 + PIT.z1) / 2),
      wall(PIT.x0 - 0.2, PIT.x0, PIT.z0, PIT.z1),
      wall(PIT.x1, PIT.x1 + 0.2, PIT.z0, PIT.z1),
      wall(PIT.x0 - 0.2, PIT.x1 + 0.2, PIT.z1, PIT.z1 + 0.2),
      wall(PIT.x0 - 0.2, PIT.x1 + 0.2, PIT.z0 - 0.2, PIT.z0),
    )
    const drums = merge(cyl('z', DRUM.r, DRUM.w, 0, 0, REAR_Z, 64), cyl('z', DRUM.r, DRUM.w, 0, 0, -REAR_Z, 64), cyl('z', 0.06, REAR_Z * 2 + 0.6, 0, 0, 0), ...[0, 1, 2, 3, 4, 5].map((i) => boxAt(0.05, 0.05, DRUM.w + 0.02, DRUM.r * 0.7 * Math.cos((i * TAU) / 6), DRUM.r * 0.7 * Math.sin((i * TAU) / 6), REAR_Z)))
    const drumSkin = merge(tubeAt('z', DRUM.r + 0.012, DRUM.r, DRUM.w, 0, 0, REAR_Z, 64), tubeAt('z', DRUM.r + 0.012, DRUM.r, DRUM.w, 0, 0, -REAR_Z, 64))
    const pedestal = (z: number) => boxAt(0.3, yA - 0.06 - PIT.floor, 0.25, 0, (yA - 0.06 + PIT.floor) / 2, z)
    const pedestals = merge(pedestal(REAR_Z + 0.42), pedestal(0), pedestal(-REAR_Z - 0.42))
    const shaft = (z0: number, z1: number) => merge(cyl('z', 0.045, Math.abs(z1 - z0), 0, 0, (z0 + z1) / 2), cyl('z', 0.09, 0.03, 0, 0, z1 + 0.03), ...[0, 1, 2, 3].map((i) => cyl('z', 0.012, 0.04, 0.065 * Math.cos((i * TAU) / 4), 0.065 * Math.sin((i * TAU) / 4), z1 + 0.05)))
    const gb1 = merge(boxAt(0.55, 0.7, 0.42, 0.1, yA - 0.1, TRAIN.gb1), cyl('z', 0.12, 0.46, 0, yA, TRAIN.gb1), boxAt(0.6, 0.05, 0.5, 0.1, yA - 0.47, TRAIN.gb1))
    const gb2 = merge(boxAt(0.5, 0.55, 0.42, 0, yA, TRAIN.gb2), boxAt(0.14, 0.12, 0.12, 0, yA + 0.32, TRAIN.gb2), boxAt(0.55, 0.05, 0.5, 0, yA - 0.3, TRAIN.gb2))
    const dynoCase = merge(tubeAt('z', 0.34, 0.27, 0.42, 0, yA, TRAIN.dyno, 48), tubeAt('z', 0.34, 0.06, 0.04, 0, yA, TRAIN.dyno + 0.23, 48), tubeAt('z', 0.34, 0.06, 0.04, 0, yA, TRAIN.dyno - 0.23, 48), boxAt(0.5, 0.06, 0.5, 0, yA - 0.37, TRAIN.dyno))
    const rotorGeo = merge(cyl('z', 0.23, 0.06, 0, 0, 0.09), cyl('z', 0.23, 0.06, 0, 0, -0.09), cyl('z', 0.08, 0.12, 0, 0, 0), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => boxAt(0.02, 0.18, 0.24, 0.13 * Math.cos((i * TAU) / 8), 0.13 * Math.sin((i * TAU) / 8), 0).rotateZ(0)))
    const water = cyl('z', 0.265, 0.38, 0, yA, TRAIN.dyno, 40)
    const vst = merge(boxAt(0.42, 0.42, 0.38, 0, yA, TRAIN.vst), boxAt(0.46, 0.05, 0.44, 0, yA - 0.235, TRAIN.vst))
    const motor = merge(cyl('z', 0.24, 0.5, 0, yA, TRAIN.motor, 40), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => boxAt(0.02, 0.03, 0.46, 0.25 * Math.cos((i * TAU) / 10), yA + 0.25 * Math.sin((i * TAU) / 10), TRAIN.motor)), boxAt(0.4, 0.06, 0.4, 0, yA - 0.27, TRAIN.motor))
    // pendulum frame: two beams under the machinery, hung from bearings on the drum axis
    const fy = -1.3
    const zA = -1.3
    const zB = -4.75
    const frame = merge(
      boxAt(0.1, 0.12, zA - zB, 0.3, fy, (zA + zB) / 2),
      boxAt(0.1, 0.12, zA - zB, -0.3, fy, (zA + zB) / 2),
      ...[zA, TRAIN.gb1, TRAIN.gb2, TRAIN.dyno, TRAIN.vst, TRAIN.motor, zB].map((z) => boxAt(0.7, 0.08, 0.08, 0, fy + 0.02, z)),
      boxAt(0.08, yA - fy, 0.08, 0, (yA + fy) / 2, zA),
      boxAt(0.08, yA - fy, 0.08, 0, (yA + fy) / 2, zB),
      cyl('z', 0.08, 0.12, 0, yA, zA),
      cyl('z', 0.08, 0.12, 0, yA, zB),
      boxAt(UPPSALA.arm, 0.08, 0.08, UPPSALA.arm / 2, fy + 0.02, TRAIN.gb2),
      // supports from the frame up to the machines
      ...[TRAIN.gb1, TRAIN.gb2, TRAIN.dyno, TRAIN.vst, TRAIN.motor].map((z) => boxAt(0.08, yA - 0.3 - fy, 0.08, -0.22, (yA - 0.3 + fy) / 2, z)),
      ...[TRAIN.gb1, TRAIN.gb2, TRAIN.dyno, TRAIN.vst, TRAIN.motor].map((z) => boxAt(0.08, yA - 0.3 - fy, 0.08, 0.22, (yA - 0.3 + fy) / 2, z)),
    )
    const scaleRod = rodBetween([UPPSALA.arm, fy + 0.06, TRAIN.gb2], [UPPSALA.arm, 0.6, TRAIN.gb2], 0.015)
    const column = merge(boxAt(0.12, 0.62, 0.12, UPPSALA.arm, 0.31 + 0.3, TRAIN.gb2 - 0.05))
    const scaleDial = dial(0.16, 0.1)
    const anchor = merge(boxAt(0.25, 0.7, 0.35, -2.5, 0.35, 0), cyl('z', 0.03, 0.4, -2.45, HY, 0))
    const chain = merge(rodBetween([X.pin, HY, 0], [X.meterEnd, HY, 0], 0.012), rodBetween([X.meterEnd - 0.3, HY, 0], [-2.45, HY, 0], 0.012))
    const restraintLink = merge(cyl('x', 0.035, 0.2, X.meterEnd - 0.15, HY), eye(X.meterEnd, HY, -0.06, 0.03, 0.03), eye(X.meterEnd - 0.3, HY, 0.06, 0.03, 0.03))
    const pipeIn = new THREE.CatmullRomCurve3([new THREE.Vector3(PIT.x1, -0.6, TRAIN.dyno + 0.1), new THREE.Vector3(0.8, -0.3, TRAIN.dyno + 0.1), new THREE.Vector3(0.2, -0.15, TRAIN.dyno + 0.1), new THREE.Vector3(0.05, yA + 0.32, TRAIN.dyno + 0.1)])
    const pipeOut = new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, yA - 0.32, TRAIN.dyno - 0.1), new THREE.Vector3(0.4, -1.4, TRAIN.dyno - 0.1), new THREE.Vector3(1.0, -1.5, TRAIN.dyno - 0.1), new THREE.Vector3(PIT.x1, -1.2, TRAIN.dyno - 0.1)])
    const pipes = merge(...[pipeIn, pipeOut].map((c) => new THREE.TubeGeometry(c, 32, 0.035, 10, false)).map((t) => t.toNonIndexed()))
    return { slabs, pit, drums, drumSkin, pedestals, shaftDrum: shaft(REAR_Z + 0.5, TRAIN.gb1 + 0.25), shaft1: shaft(TRAIN.gb1 - 0.25, TRAIN.gb2 + 0.25), shaft2: shaft(TRAIN.gb2 - 0.25, TRAIN.vst + 0.2), gb1, gb2, dynoCase, rotorGeo, water, vst, motor, frame, scaleRod, column, scaleDial, anchor, chain, restraintLink, pipeIn, pipeOut, pipes, needleG: needle(0.13) }
  }, [])

  useSimFrame((dt) => {
    const d = solveCached(useDrawbar.getState()).dyno
    if (!d) return
    const a = ang.current
    a.drum += ((d.nDrum * TAU) / 60) * dt
    a.s1 += ((d.nDrum * UPPSALA.step1 * TAU) / 60) * dt
    a.s2 += ((d.nAbsorber * TAU) / 60) * dt
    drum.current?.rotation.set(0, 0, a.drum)
    s1.current?.rotation.set(0, 0, a.s1)
    s2.current?.rotation.set(0, 0, a.s2)
    s3.current?.rotation.set(0, 0, a.s2)
    rotor.current?.rotation.set(0, 0, a.s2)
    // scale: 0–12 kN over 0.9 turn
    if (scaleNeedle.current) scaleNeedle.current.rotation.z = -(d.scaleF / 12000) * 0.9 * TAU
  })

  const yA = DRUM.y
  return (
    <group>
      <Part id="floor" name="Floor & pit" role="housing" material="concrete" info={INFO.floor} cites={[C.chassis]}>
        <PartMesh geometry={g.slabs} receiveShadow />
        <PartMesh geometry={g.pit} receiveShadow />
        <PartMesh geometry={g.pedestals} material="castIron" />
      </Part>
      <Part id="drums" name="Concrete-covered drums" role="moving" material="steelDark" info={INFO.drums} cites={[C.chassis]}>
        <group ref={drum} position={[0, yA, 0]}>
          <PartMesh geometry={g.drums} />
          <PartMesh geometry={g.drumSkin} material="concrete" />
          <PartMesh geometry={g.shaftDrum} material="steel" />
        </group>
      </Part>
      <Part id="dyno-train" name="Drum drive train" role="housing" material="castIron" info={{ summary: 'Drive train from the drums to the absorber (Fig 15.10).', role: 'Drums → gearbox 1:18 → gearbox 1:1–7.7 → hydraulic dynamometer, with a variable-speed transmission and electric motor at the end of the line.' }} cites={[C.chassis]}>
        <Part id="train-shafts" name="Shafts & couplings" role="moving" material="steel" info={{ summary: 'Line shafts and flange couplings.', role: 'Turn at the drum speed, 18 × drum speed, and the absorber speed in turn.' }} cites={[C.chassis]}>
          <group ref={s1} position={[0, yA, 0]}>
            <PartMesh geometry={g.shaft1} />
          </group>
          <group ref={s2} position={[0, yA, 0]}>
            <PartMesh geometry={g.shaft2} />
          </group>
        </Part>
        <Part id="gearbox-18" name="Gearbox 1 : 18" material="castIron" info={INFO.gb1} cites={[C.chassis]} explode={[0.4, 0, 0]}>
          <PartMesh geometry={g.gb1} />
        </Part>
        <Part id="gearbox-range" name="Gearbox 1 : 1–7.7" material="paintGreen" info={INFO.gb2} cites={[C.chassis]} explode={[0.5, 0, 0]}>
          <PartMesh geometry={g.gb2} />
        </Part>
        <Part id="hydraulic-dyno" name="Hydraulic dynamometer" material="paintBlue" info={INFO.dyno} cites={[C.chassis, C.hydDyno]} explode={[0.6, 0, 0]}>
          <PartMesh geometry={g.dynoCase} />
          <Part id="dyno-water" name="Water in the absorber" role="fluid" material="water" info={{ summary: 'Working water.', role: 'Sheared between rotor and casing; carries the absorbed power away as heat.' }} cites={[C.hydDyno]}>
            <PartMesh geometry={g.water} />
          </Part>
          <Part id="dyno-rotor" name="Absorber rotor" role="moving" material="bronze" info={{ summary: 'Absorber rotor.', role: 'Turns at the absorber speed; water friction between rotor and casing resists it.' }} cites={[C.hydDyno]}>
            <group ref={rotor} position={[0, yA, TRAIN.dyno]}>
              <PartMesh geometry={g.rotorGeo} />
            </group>
          </Part>
          <Part id="dyno-pipes" name="Water pipes" role="static" material="galvanised" cut={false} info={{ summary: 'Cooling-water supply and return.', role: 'Fresh water in, heated water out.' }}>
            <PartMesh geometry={g.pipes} />
          </Part>
        </Part>
        <Part id="vst" name="Variable-speed transmission" material="paintGrey" info={INFO.vst} cites={[C.chassis]} explode={[0.6, 0, 0]}>
          <PartMesh geometry={g.vst} />
        </Part>
        <Part id="motor" name="Electric motor" material="paintGrey" info={INFO.motor} cites={[C.chassis]} beyondNotes explode={[0.6, 0, 0]}>
          <PartMesh geometry={g.motor} />
        </Part>
      </Part>
      <Part id="pendulum-frame" name="Pendulum frame" role="static" material="paintYellow" info={INFO.pendulum} cites={[C.chassis, SRC.tests502('p5, eq 3')]}>
        <PartMesh geometry={g.frame} />
      </Part>
      <Part id="scale" name="Scale" role="static" material="steel" info={INFO.scale} cites={[C.chassis]} cut={false}>
        <PartMesh geometry={g.scaleRod} />
        <PartMesh geometry={g.column} material="paintGrey" />
        <group position={[UPPSALA.arm, 1.08, TRAIN.gb2]}>
          <PartMesh geometry={g.scaleDial} material="aluminium" />
          <group ref={scaleNeedle} position={[0, 0, 0.055]}>
            <PartMesh geometry={g.needleG} material="paintRed" />
          </group>
        </group>
      </Part>
      <Part id="restraint" name="Restraint & load link" role="static" material="galvanised" info={INFO.restraint} cites={[C.chassis]} cut={false}>
        <PartMesh geometry={g.chain} />
        <PartMesh geometry={g.restraintLink} material="steel" />
        <PartMesh geometry={g.anchor} material="concrete" />
      </Part>
      <Flow curve={g.pipeIn} count={30} radius={0.018} color="#4aa3ff" speed={0.5} spread={0.01} intensity={() => Math.min(1, (solveCached(useDrawbar.getState()).dyno?.Pd ?? 0) / 15000)} />
      <Flow curve={g.pipeOut} count={30} radius={0.018} color="#ff8a5c" speed={0.5} spread={0.01} intensity={() => Math.min(1, (solveCached(useDrawbar.getState()).dyno?.Pd ?? 0) / 15000)} />
    </group>
  )
}

/* ------------------------------ the scene ------------------------------ */

export function Scene3D() {
  const mode = useDrawbar((s) => s.mode)
  const surface = useDrawbar((s) => s.surface)
  const gear = useDrawbar((s) => s.gear)
  const t = useRef(0)
  const track = useMemo(() => {
    const gg = box(16, 0.2, 4)
    gg.translate(-1, -0.1, 0)
    return gg
  }, [])

  useSimFrame((dt) => {
    const st = useDrawbar.getState()
    const pt = solveCached(st)
    t.current += dt
    // pull: implement-like surges on the track; steady on the rig
    const P = st.mode === 'car' && pt.P > 0 ? pt.P * (1 + fluctuation(t.current)) : pt.P
    live.Pinst = P
    const tau = st.mode === 'dyno' ? 0.3 : st.meter === 'cylinder' ? dampingTau(st.damping) : st.meter === 'link' ? 0.05 : 0.015
    live.Pread += (P - live.Pread) * Math.min(1, dt / tau)
    live.dist += pt.V * dt
    live.wheelRevs += (pt.V0 / (Math.PI * 1.26)) * dt
    pose.rearAngle += (pt.V0 / TRACTOR.rear.rolling) * dt
    if (st.mode === 'car') pose.frontAngle += (pt.V / TRACTOR.front.radius) * dt

    // automated test run (TESTS p1: pull vs speed in one gear at open throttle)
    const run = live.run
    if (run.active && st.mode === 'car') {
      run.t += dt
      if (run.t >= RUN.settle) {
        run.t = 0
        if (pt.stalled || pt.spinning || pt.slip > RUN.slipLimit) {
          stopRun(pt.stalled ? 'engine stalled' : `slip passed ${RUN.slipLimit * 100} %`)
        } else {
          run.points.push({ P: pt.P, V: pt.V, slip: pt.slip, rpm: pt.rpm, Pd: pt.Pd, fuelLh: pt.fuel.Lh })
          run.version++
          st.set({ pull: Math.round(st.pull + RUN.stepkN) })
        }
      }
    }
  })

  const q = FARMLAND_GEARS[gear]
  return (
    <group>
      <Tractor pose={pose} labels={false} internals gearRatio={(q * 9) / 37} drawbar linkage />
      {mode === 'car' ? (
        <>
          <Part id="track" name={surface === 'concrete' ? 'Concrete test track' : 'Soil test strip'} role="static" material={surface === 'concrete' ? 'concrete' : 'soil'} info={INFO.track} cites={[C.car, C.l27('p37, concrete')]}>
            <PartMesh geometry={track} receiveShadow />
          </Part>
          <TrackMarks visible />
          <HitchLine />
          <TestCar />
          <LiveTag position={[(X.pin + X.meterEnd) / 2, 1.05, 0]} get={() => ({ text: `${(live.Pread / 1000).toFixed(1)} kN` })} />
          <PartLabel partId="test-car" at={[-4.2, 2.75, 0.4]} />
          <PartLabel partId="drawbar-cylinder" at={[-1.6, 0.25, 0.3]} />
          <PartLabel partId="throttling-valve" at={[-1.85, 0.85, 0.3]} />
          <PartLabel partId="transducer" at={[-1.85, 1.2, 0.2]} />
          <PartLabel partId="recorder" at={[-3.2, 1.8, 0.5]} />
          <PartLabel partId="hitch-line" at={[-0.8, 0.2, 0.3]} />
          <PartLabel partId="tractor-rear-wheels" at={[0, 1.4, REAR_Z + 0.25]} />
        </>
      ) : (
        <>
          <ChassisDyno />
          <LiveTag position={[UPPSALA.arm, 1.42, TRAIN.gb2]} get={() => {
            const d = solveCached(useDrawbar.getState()).dyno
            return d ? { text: `F = ${(d.scaleF / 1000).toFixed(2)} kN`, warn: d.stalled } : null
          }} />
          <PartLabel partId="drums" at={[0.5, -0.1, REAR_Z + 0.5]} />
          <PartLabel partId="gearbox-18" at={[0.5, -0.4, TRAIN.gb1]} />
          <PartLabel partId="gearbox-range" at={[0.45, -0.2, TRAIN.gb2]} />
          <PartLabel partId="hydraulic-dyno" at={[0.5, -0.1, TRAIN.dyno]} />
          <PartLabel partId="vst" at={[0.4, -0.3, TRAIN.vst]} />
          <PartLabel partId="motor" at={[0.4, -0.25, TRAIN.motor]} />
          <PartLabel partId="pendulum-frame" at={[0.6, -1.35, -4.2]} />
          <PartLabel partId="scale" at={[UPPSALA.arm + 0.3, 1.2, TRAIN.gb2]} />
          <PartLabel partId="restraint" at={[-1.9, 0.75, 0]} />
        </>
      )}
    </group>
  )
}
