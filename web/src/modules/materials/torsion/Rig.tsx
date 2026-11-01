import { Html } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { polarSolid, polarTube, shaftStress, shaftTorque, solidShaftForStress, twist } from '@/physics/strength'
import { TestBench, createRun, instrument, slopeThroughOrigin, useAutoRun, useRunDriver } from '@/lab/run'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'

export const FLOOR = -0.42
const along = mat4.rz(Math.PI / 2)
const DRAWN = 1.5
const X0 = -DRAWN / 2

interface Params {
  /** torque, kN·m; length, m; outer and inner diameter, mm; G, GPa */
  T: number
  L: number
  D: number
  d: number
  hollow: boolean
  G: number
  /** the shear stress at which the shaft yields, MPa */
  tauY: number
  /** the share of the full torque on the arm at this moment: moved by the test */
  f: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { T: 25, L: 3, D: 146, d: 125, hollow: true, G: 85, tauY: 150, f: 0 }
export const useTorsion = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useTorsion.getState().set(p)

const torsionRun = createRun()
const PROCEDURE = { steps: 10, moveSeconds: 0.55, dwellSeconds: 0.25 }
const conditionsOf = (p: Params) => JSON.stringify([p.T, p.L, p.D, p.d, p.hollow, p.G, p.tauY])

const analyse = (p: Params, load = p.f) => {
  const D = p.D / 1000
  const d = p.hollow ? p.d / 1000 : 0
  const J = p.hollow ? polarTube(D, d) : polarSolid(D)
  const T = p.T * 1000 * load
  return { J, T, tau: shaftStress(T, D / 2, J), tauIn: shaftStress(T, d / 2, J), theta: twist(T, p.L, p.G * 1e9, J), R: D / 2, r: d / 2 }
}

/** The shaft, with a straight generator line that twists into a helix as the torque comes on. */
export function Torsion3D() {
  const p = useTorsion()
  const full = useMemo(() => analyse(p, 1), [p.T, p.L, p.D, p.d, p.hollow, p.G])
  const k = Math.min(1.6, 0.11 / (p.D / 1000)) // shaft radius is drawn at about 0.08 m, whatever its size
  const Rd = Math.min(0.12, Math.max(0.05, (p.D / 1000) * k * 0.7))
  const rd = p.hollow ? (Rd * p.d) / p.D : 0
  // a twist so small it could not be seen is drawn larger; this is flagged in the panel
  const show = useMemo(() => Math.max(Math.min(1.1, Math.abs(full.theta) * 14), Math.abs(full.theta)), [full.theta])
  const eased = useRef(0)
  const hanger = useRef<THREE.Group>(null)
  const panText = useRef<HTMLDivElement>(null)
  const loadNow = useRef(0)
  useAutoRun(torsionRun, conditionsOf(p))
  useRunDriver(
    torsionRun,
    PROCEDURE,
    (f) => {
      loadNow.current = f
      // the panel follows in 1 % steps; the rig itself follows every frame
      if (Math.abs(f - useTorsion.getState().f) >= 0.01 || f === 1) useTorsion.getState().set({ f })
    },
    (step, f) => {
      const st = useTorsion.getState()
      const here = analyse(st, f)
      // the pointer reads to within 1 %, the strain gauge to within 1.5 %
      torsionRun.getState().log([step, here.T / 1000, instrument((here.theta * 180) / Math.PI, 0.01, step), instrument(here.tau / 1e6, 0.015, step + 40)])
      if (here.tau / 1e6 >= st.tauY) torsionRun.getState().fail(`The surface reached its ${st.tauY} MPa shear yield stress at ${Math.round(f * 100)} % of the torque. The shaft would now twist permanently, so the test stops.`)
    },
  )
  useEffect(
    () =>
      torsionRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle') || (r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) {
          loadNow.current = 0
          useTorsion.getState().set({ f: 0 })
        }
      }),
    [],
  )
  const end = useRef<THREE.Group>(null)
  const line = useRef<THREE.Mesh>(null)
  const lastTwist = useRef(-1)
  const geo = useMemo(
    () => ({
      shaft: xform(p.hollow && rd > 0.001 ? tube(Rd, rd, DRAWN, 56) : cylinder(Rd, DRAWN, 56), along),
      chuck: merge(xform(cylinder(Rd + 0.05, 0.1, 40), mat4.c(mat4.t(X0 - 0.05, 0, 0), along))),
      arm: merge(xform(cylinder(Rd + 0.05, 0.1, 40), mat4.c(mat4.t(0.05, 0, 0), along)), xform(box(0.04, 0.05, 0.62), mat4.t(0.05, 0, 0))),
      wall: xform(box(0.2, 0.7, 0.5), mat4.t(X0 - 0.2, FLOOR + 0.35, 0)),
      stand: merge(xform(box(0.14, -FLOOR - Rd - 0.04, 0.3), mat4.t(-X0 + 0.05, (FLOOR - Rd - 0.04) / 2, 0)), xform(box(2.3, 0.03, 0.7), mat4.t(0, FLOOR + 0.015, 0))),
      pan: merge(xform(cylinder(0.006, 0.26, 10), mat4.t(0, -0.13, 0)), xform(cylinder(0.075, 0.012, 32), mat4.t(0, -0.26, 0))),
      // the scale behind the arm, ticked every 10° of the drawn turn, and the pointer the arm carries
      scale: merge(xform(tube(Rd + 0.2, Rd + 0.15, 0.006, 96), mat4.c(mat4.t(-X0 + 0.135, 0, 0), along))),
      ticks: merge(...Array.from({ length: 36 }, (_, i) => xform(box(0.003, 0.03, 0.004), mat4.c(mat4.t(-X0 + 0.14, 0, 0), mat4.c(mat4.rx((i * Math.PI) / 18), mat4.t(0, Rd + 0.175, 0)))))),
      pointer: xform(box(0.006, Rd + 0.14, 0.012), mat4.t(0.09, (Rd + 0.14) / 2, 0)),
    }),
    [p.hollow, Rd, rd],
  )
  // a disc goes on the pan with each step
  const stepCount = Math.round(p.f * PROCEDURE.steps)
  const discs = useMemo(() => (stepCount ? merge(...Array.from({ length: stepCount }, (_, i) => xform(cylinder(0.065 - (i % 2) * 0.003, 0.016, 28), mat4.t(0, -0.246 + i * 0.017, 0)))) : null), [stepCount])
  /** the line drawn along the shaft: straight at no load, a helix under torque */
  const helix = useMemo(
    () => (angle: number) => {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 40; i++) {
        const u = i / 40
        const t = angle * u
        pts.push(new THREE.Vector3(X0 + u * DRAWN, (Rd + 0.003) * Math.cos(t), (Rd + 0.003) * Math.sin(t)))
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.004, 6)
    },
    [Rd],
  )
  const firstLine = useMemo(() => helix(0), [helix])

  useSimFrame(() => {
    // the arm follows the load the test has reached; a touch of lag, as a real arm settles
    eased.current += (show * loadNow.current - eased.current) * 0.25
    end.current?.rotation.set(eased.current, 0, 0)
    // the weight hangs straight down from the arm's tip, wherever the arm has got to
    hanger.current?.position.set(-X0 + 0.05, -0.29 * Math.sin(eased.current), 0.29 * Math.cos(eased.current))
    if (panText.current) panText.current.textContent = `${(useTorsion.getState().T * loadNow.current).toFixed(1)} kN·m`
    if (line.current && Math.abs(eased.current - lastTwist.current) > 0.003) {
      lastTwist.current = eased.current
      line.current.geometry.dispose()
      line.current.geometry = helix(eased.current)
    }
  })

  return (
    <group>
      <Part id="wall" name="Fixed end" role="static" material="castIron" info={{ summary: 'Holds one end of the shaft from turning.', role: 'The whole torque is carried back into the frame here.' }} cut={false}>
        <PartMesh geometry={geo.wall} />
        <PartMesh geometry={geo.chuck} material="steelDark" />
      </Part>
      <Part id="stand" name="Stand and bearing" role="static" material="paintGrey" info={{ summary: 'Supports the free end.', role: 'Takes its weight, but lets it turn: no torque is lost here.' }} cut={false}>
        <PartMesh geometry={geo.stand} />
      </Part>
      <Part id="shaft" name="Test shaft" role="housing" material="steel" info={{ summary: 'Carries the torque along its length.', role: 'Shear stress grows in a straight line from the centre, so material near the middle does little: which is why hollow shafts save so much weight.' }}>
        <PartMesh geometry={geo.shaft} />
      </Part>
      <mesh ref={line} geometry={firstLine}>
        <meshBasicMaterial color="#d0631c" toneMapped={false} />
      </mesh>
      <group ref={end} position={[-X0, 0, 0]}>
        <Part id="arm" name="Loading arm" role="moving" material="paintOrange" info={{ summary: 'Applies the torque.', role: 'A weight on an arm: torque is force times the arm’s length. The angle it turns through is the twist.' }} cut={false}>
          <PartMesh geometry={geo.arm} />
          <PartMesh geometry={geo.pointer} material="paintBlack" />
        </Part>
      </group>
      <Part id="scale" name="Twist scale" role="static" material="ceramic" info={{ summary: 'Reads the angle.', role: 'The pointer on the arm moves round it. Read once the arm has settled at each step.' }} cut={false}>
        <PartMesh geometry={geo.scale} />
        <PartMesh geometry={geo.ticks} material="paintBlack" />
      </Part>
      <group ref={hanger} position={[-X0 + 0.05, 0, 0.29]}>
        <Part id="weights" name="Weights" role="moving" material="castIron" info={{ summary: 'Hung from the arm.', role: 'Each one adds the same torque, force times the arm’s length, so the test goes up in equal steps.' }} cut={false}>
          <PartMesh geometry={geo.pan} material="steel" />
          {discs ? <PartMesh geometry={discs} /> : null}
        </Part>
        <Html position={[0.12, -0.2, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} center>
          <div ref={panText} className="part-label" style={{ color: '#8a3d12', borderColor: '#8a3d12', whiteSpace: 'nowrap' }} />
        </Html>
      </group>
      <PartLabel partId="shaft" at={[0, Rd + 0.08, 0.05]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'hollow', label: 'Hollow Ø146/125', note: 'External 146 mm, internal 125 mm, 3 m long, 25 kN·m, G = 85 GPa: the shaft twists 2.45°.', apply: () => set({ ...DEFAULTS }) },
  { id: 'design', label: 'Solid, 80 kW at 3 rev/s', note: 'τ ≤ 70 MPa, G = 90 GPa, and peak torque 4 % over the mean. T = 4.41 kN·m, so Ø68.5 mm.', apply: () => set({ ...DEFAULTS, T: (shaftTorque(80e3, 3) * 1.04) / 1000, L: 1, D: 68.5, d: 40, hollow: false, G: 90 }) },
]

/** The bench test: torque goes on in steps, the pointer is read, and G comes from the slope. */
function TorsionTest() {
  const p = useTorsion()
  const rows = torsionRun((s) => s.rows)
  const status = torsionRun((s) => s.status)
  const full = analyse(p, 1)
  const torques = rows.map((r) => r[1])
  const angles = rows.map((r) => r[2])
  const fitted = slopeThroughOrigin(torques, angles)
  const theory = (full.theta * 180) / Math.PI / (full.T / 1000)
  // G = T L / (J θ): from the slope, in kN·m per degree
  const measuredG = fitted > 0 ? (p.G * theory) / fitted : 0
  return (
    <TestBench run={torsionRun} steps={PROCEDURE.steps} head={['Step', 'Torque (kN·m)', 'Twist (°)', 'Stress (MPa)']} format={(r) => [String(r[0]), fmt(r[1], 3), fmt(r[2], 3), fmt(r[3], 3)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[[0, ...torques], [0, ...angles], [0, ...torques.map((t) => t * theory)]]} series={[{ label: 'Readings', color: '#e8794f', width: 2 }, { label: 'Theory', color: '#6fb3e0', width: 1 }]} xLabel="Torque (kN·m)" yLabel="Twist (°)" height={130} />
          {status === 'done' ? (
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              <Readout label="Slope" value={fmt(fitted, 3)} unit="°/kN·m" />
              <Readout label="G from the test" value={fmt(measuredG, 3)} unit="GPa" tone="accent" />
              <Readout label="Against the set G" value={fmt(((measuredG - p.G) / p.G) * 100, 2)} unit="%" tone="info" />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function TorsionPanel() {
  const p = useTorsion()
  const [preset, setPreset] = useState<string | null>('hollow')
  const a = analyse(p)
  const deg = (a.theta * 180) / Math.PI
  const w = analyse(p, 1)
  const wDeg = (w.theta * 180) / Math.PI
  // what a solid shaft would need, for the same torque and the same peak stress
  const fullLoad = analyse(p, 1)
  const solidD = solidShaftForStress(fullLoad.T, fullLoad.tau)
  const areaThis = p.hollow ? (Math.PI * (p.D ** 2 - p.d ** 2)) / 4 : (Math.PI * p.D ** 2) / 4
  const areaSolid = (Math.PI * (solidD * 1000) ** 2) / 4
  const dist = useMemo(() => {
    const rs = Array.from({ length: 81 }, (_, i) => ((i / 80) * p.D) / 2)
    return { rs, t: rs.map((r) => (p.hollow && r < p.d / 2 ? 0 : (fullLoad.tau * (r / (p.D / 2))) / 1e6)) }
  }, [p.D, p.d, p.hollow, fullLoad.tau])
  return (
    <div>
      <TorsionTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Twist" value={fmt(deg, 3)} unit="°" tone="warn" />
          <Readout label="Largest stress" value={fmt(a.tau / 1e6, 4)} unit="MPa" tone="accent" />
          <Readout label="Inner stress" value={p.hollow ? fmt(a.tauIn / 1e6, 4) : '0'} unit="MPa" />
          <Readout label="Polar moment J" value={fmt(a.J * 1e12, 4)} unit="mm⁴" />
          <Readout label="Stiffness" value={fmt(((p.G * 1e9 * a.J) / p.L / 1000) * (Math.PI / 180), 4)} unit="kN·m/°" />
          <Readout label="Steel used" value={fmt((100 * areaThis) / areaSolid, 3)} unit="% of solid" tone="info" />
        </div>
        <Note>The orange line was straight along the shaft. It twists into a helix under load, drawn larger than life for small angles. The readings are true.</Note>
      </Section>
      <Section title="The shaft">
        <Slider label="Full torque T" value={p.T} min={0.1} max={80} step={0.1} unit="kN·m" onChange={(T) => set({ T })} />
        <Slider label="Length" value={p.L} min={0.5} max={8} step={0.1} unit="m" onChange={(L) => set({ L })} />
        <Slider label="Outer diameter" value={p.D} min={30} max={300} step={0.5} unit="mm" onChange={(D) => set({ D, d: Math.min(p.d, D - 5) })} />
        <Toggle label="Hollow" checked={p.hollow} onChange={(hollow) => set({ hollow })} />
        {p.hollow ? <Slider label="Inner diameter" value={p.d} min={5} max={p.D - 5} step={0.5} unit="mm" onChange={(d) => set({ d })} /> : null}
        <Slider label="Shear modulus G" value={p.G} min={20} max={100} step={1} unit="GPa" onChange={(G) => set({ G })} />
        <Slider label="Shear yield stress" value={p.tauY} min={20} max={400} step={5} unit="MPa" onChange={(tauY) => set({ tauY })} />
        <Note>At full torque the surface would reach {fmt(fullLoad.tau / 1e6, 3)} MPa{fullLoad.tau / 1e6 >= p.tauY ? ', past yield: the test will stop before that.' : '.'}</Note>
      </Section>
      <Section title="Worked set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Shear stress across the shaft">
        <Chart data={[dist.rs, dist.t]} series={[{ label: 'τ', color: '#e8794f', width: 2 }]} xLabel="Radius (mm)" yLabel="Shear stress (MPa)" height={135} />
        <Note>τ grows in a straight line with radius. The metal near the centre carries little, so removing it costs little strength and saves a lot of weight.</Note>
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'The torsion equation', tex: '\\dfrac{T}{J} = \\dfrac{\\tau}{r} = \\dfrac{G\\theta}{L}' },
            { label: 'Polar second moment', tex: p.hollow ? 'J = \\dfrac{\\pi}{32}(D^4 - d^4)' : 'J = \\dfrac{\\pi D^4}{32}', result: `=${n(w.J * 1e12, 4)}\\ \\text{mm}^4` },
            { label: 'Largest shear stress', tex: '\\tau = \\dfrac{T r}{J}', sub: `=\\dfrac{${n(p.T, 3)}\\times10^6 (${n(p.D / 2, 3)})}{${n(w.J * 1e12, 4)}}`, result: `=${n(w.tau / 1e6, 4)}\\ \\text{MPa}` },
            { label: 'Twist', tex: '\\theta = \\dfrac{T L}{G J}', sub: `=\\dfrac{${n(p.T, 3)}\\times10^3 (${n(p.L, 3)})}{${n(p.G, 3)}\\times10^9 (${n(w.J * 1e12, 4)}\\times10^{-12})}`, result: `=${n(w.theta, 3)}\\ \\text{rad} = ${n(wDeg, 3)}^\\circ` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Power: P = 2πN T, with N in rev/s. Design for peak torque, not mean.</li>
          <li>A shaft must meet both limits, stress and twist. Size it for each, and take the larger.</li>
          <li>Assumes a uniform circular section where plane sections stay plane, and stress within the elastic limit.</li>
        </ExamList>
      </Section>
    </div>
  )
}
