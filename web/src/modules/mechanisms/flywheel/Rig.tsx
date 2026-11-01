import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { TestBench, createRun, instrument, useAutoRun, useRunDriver } from '@/lab/run'
import { energyFluctuation, flywheelInertia, radToRpm, requiredInertia, rpmToRad, speedFluctuation, turningStats, type TurningKind } from '@/physics/machinedynamics'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../_shared/rig'
import { placeBetween, unitRod } from '../_shared/strut'

export const FLOOR = -0.5
const deg = (r: number) => (r * 180) / Math.PI

interface FlyParams {
  kind: TurningKind
  /** peak moment, N·m */
  Tp: number
  /** mean speed, rpm */
  rpm: number
  /** flywheel mass, kg, and radius of gyration, m */
  m: number
  k: number
  set: (p: Partial<FlyParams>) => void
  reset: () => void
}

export const DEFAULTS = { kind: 'four-stroke' as TurningKind, Tp: 600, rpm: 300, m: 80, k: 0.32 }

export const useFly = create<FlyParams>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<FlyParams>) => useFly.getState().set(p)

const live = { theta: 0, w: 0 }

const flyRun = createRun()
/** sim seconds: the scene runs at a quarter of real speed */
const PROCEDURE = { steps: 16, moveSeconds: 0.06, dwellSeconds: 0.03 }

function speedOf(st: ReturnType<typeof turningStats>, I: number, w: number, theta: number) {
  const i = ((theta % st.period) + st.period) % st.period
  const f = (i / st.period) * (st.E.length - 1)
  const e = st.E[Math.floor(f)]
  const mid = (st.hiE + st.loE) / 2
  return Math.sqrt(Math.max(0.01, w * w + (2 * (e - mid)) / I))
}

export function Flywheel3D() {
  const p = useFly()
  const st = useMemo(() => turningStats(p.kind, p.Tp), [p.kind, p.Tp])
  useAutoRun(flyRun, JSON.stringify([p.kind, p.Tp, p.rpm, p.m, p.k]))
  useRunDriver(
    flyRun,
    PROCEDURE,
    () => {},
    (step, f) => {
      const s = useFly.getState()
      const c = turningStats(s.kind, s.Tp)
      const angle = f * c.period
      flyRun.getState().log([deg(angle), instrument(radToRpm(speedOf(c, flywheelInertia(s.m, s.k), rpmToRad(s.rpm), angle)), 0.0002, step)])
    },
  )
  const wheel = useRef<THREE.Group>(null)
  const rod = useRef<THREE.Group>(null)
  const piston = useRef<THREE.Group>(null)
  const theta = useRef(0)
  const R = 0.34
  const crankR = 0.07
  const L = 0.26
  const X = 0.34
  const geo = useMemo(() => {
    const along = mat4.rx(Math.PI / 2)
    const rimW = 0.03 + Math.min(0.09, p.m / 2500)
    const spokes = Array.from({ length: 6 }, (_, i) => xform(box(0.04, R - 0.03, 0.03), mat4.c(mat4.rz((i * Math.PI) / 3), mat4.t(0, (R - 0.03) / 2, 0))))
    return {
      rim: xform(tube(R, R - 0.05, rimW, 96), along),
      spokes: merge(...spokes, xform(cylinder(0.05, 0.08, 40), along)),
      shaft: xform(cylinder(0.02, 0.5, 28), mat4.c(mat4.t(0, 0, 0.04), along)),
      stands: merge(...[-0.13, 0.2].map((z) => merge(xform(box(0.1, -FLOOR - 0.02, 0.05), mat4.t(0, (FLOOR - 0.02) / 2, z)), xform(tube(0.036, 0.02, 0.06, 28), mat4.c(mat4.t(0, 0, z), along))))),
      base: xform(box(1.5, 0.03, 0.5), mat4.t(0.25, FLOOR + 0.015, 0.04)),
      crank: merge(xform(box(crankR + 0.04, 0.05, 0.022), mat4.t(crankR / 2, 0, 0.26)), xform(cylinder(0.014, 0.05, 20), mat4.c(mat4.t(crankR, 0, 0.27), along))),
      cyl: merge(xform(tube(0.074, 0.06, 0.2, 40), mat4.c(mat4.t(X, 0, 0.27), mat4.rz(Math.PI / 2))), xform(box(0.16, -FLOOR - 0.08, 0.08), mat4.t(X, (FLOOR - 0.08) / 2, 0.27))),
      piston: xform(cylinder(0.058, 0.09, 36), mat4.rz(Math.PI / 2)),
      rod: unitRod(0.012),
    }
  }, [p.m])

  useSimFrame((dt) => {
    const s = useFly.getState()
    const I = flywheelInertia(s.m, s.k)
    const w = speedOf(st, I, rpmToRad(s.rpm), theta.current)
    live.w = w
    theta.current += w * dt
    live.theta = theta.current
    wheel.current?.rotation.set(0, 0, -theta.current)
    const a = theta.current
    const b: [number, number, number] = [crankR * Math.cos(a), -crankR * Math.sin(a), 0.27]
    const px = crankR * Math.cos(a) + Math.sqrt(L * L - (crankR * Math.sin(a)) ** 2)
    placeBetween(rod.current, b, [px, 0, 0.27])
    piston.current?.position.set(px + 0.05, 0, 0.27)
  })

  return (
    <group position={[-0.25, 0.02, 0]}>
      <Part id="frame" name="Bedplate and bearings" role="static" material="castIron" info={{ summary: 'Carries the crankshaft.', role: 'The bearings see the wheel’s weight, not its speed variations: those stay in the shaft.' }} cut={false}>
        <PartMesh geometry={geo.base} material="paintGrey" />
        <PartMesh geometry={geo.stands} />
      </Part>
      <Part id="cylinder" name="Cylinder" role="housing" material="aluminium" info={{ summary: 'The source of the uneven turning moment.', role: 'Gas pressure only drives during the expansion stroke, one stroke in four: the other three take energy back.' }}>
        <PartMesh geometry={geo.cyl} />
      </Part>
      <group ref={wheel}>
        <Part id="flywheel" name="Flywheel" role="moving" material="castIron" info={{ summary: 'A heavy rim on the shaft.', role: 'Stores energy when the moment exceeds the mean, and gives it back when it falls short. It limits speed variation within a cycle: it cannot control mean speed.' }} explode={[0, 0, -0.15]}>
          <PartMesh geometry={geo.rim} />
          <PartMesh geometry={geo.spokes} />
          <PartMesh geometry={geo.shaft} material="chrome" />
          <PartMesh geometry={geo.crank} material="steel" />
        </Part>
      </group>
      <group ref={rod}>
        <Part id="rod" name="Connecting rod" role="moving" material="steel" info={{ summary: 'Turns the piston’s push into a moment.', role: 'The moment on the crank depends on its angle, which adds to the variation.' }}>
          <PartMesh geometry={geo.rod} />
        </Part>
      </group>
      <group ref={piston}>
        <Part id="piston" name="Piston" role="moving" material="aluminium" info={{ summary: 'Driven by gas pressure.', role: 'Its force varies through the cycle, which is what makes the turning moment so uneven.' }}>
          <PartMesh geometry={geo.piston} />
        </Part>
      </group>
      <PartLabel partId="flywheel" at={[-0.2, 0.38, -0.06]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'single', label: 'Single cylinder', note: 'One power stroke every two turns. The wheel must carry the engine through the other three.', apply: () => set({ ...DEFAULTS }) },
  { id: 'four', label: 'Four cylinders', note: 'A power stroke every half turn. The same peak moment, far less energy to store, so a much lighter flywheel will do.', apply: () => set({ ...DEFAULTS, kind: 'four-cylinder' }) },
  { id: 'press', label: 'Punch press', note: 'The motor runs steadily; the load arrives in one short stroke. The wheel supplies almost all of that energy, and the motor restores it between strokes.', apply: () => set({ ...DEFAULTS, kind: 'press', Tp: 2000, rpm: 120, m: 400, k: 0.32 }) },
]

/** The bench test: a tachometer read at intervals through one working cycle. */
function FlywheelTest() {
  const rows = flyRun((s) => s.rows)
  const status = flyRun((s) => s.status)
  const speeds = rows.map((r) => r[1])
  const hi = Math.max(...speeds)
  const lo = Math.min(...speeds)
  return (
    <TestBench run={flyRun} steps={PROCEDURE.steps} title="The test: tachometer through a cycle" head={['Crank (°)', 'Speed (rpm)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 5)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[rows.map((r) => r[0]), speeds]} series={[{ label: 'Speed', color: '#e8794f', width: 2 }]} xLabel="Crank angle (°)" yLabel="Speed (rpm)" height={110} />
          {status === 'done' ? (
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              <Readout label="Fastest" value={fmt(hi, 5)} unit="rpm" />
              <Readout label="Slowest" value={fmt(lo, 5)} unit="rpm" />
              <Readout label="Cs from the test" value={fmt(((hi - lo) / ((hi + lo) / 2)) * 100, 3)} unit="%" tone="accent" />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function FlywheelPanel() {
  const p = useFly()
  const [preset, setPreset] = useState<string | null>('single')
  const st = useMemo(() => turningStats(p.kind, p.Tp), [p.kind, p.Tp])
  const I = flywheelInertia(p.m, p.k)
  const w = rpmToRad(p.rpm)
  const Cs = st.dE / (I * w * w)
  const nowRpm = useLive(() => radToRpm(live.w || w), 15)
  const need = requiredInertia(st.dE, w, 0.02)
  const degs = useMemo(() => st.angle.map(deg), [st])
  return (
    <div>
      <FlywheelTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Speed now" value={fmt(nowRpm, 4)} unit="rpm" tone="accent" />
          <Readout label="Mean moment" value={fmt(st.mean, 4)} unit="N·m" />
          <Readout label="Energy to store" value={fmt(st.dE, 4)} unit="J" tone="warn" />
          <Readout label="Inertia I" value={fmt(I, 4)} unit="kg·m²" />
          <Readout label="Fluctuation Cs" value={`${fmt(Cs * 100, 3)}`} unit="%" tone="info" />
          <Readout label="I for 2 %" value={fmt(need, 4)} unit="kg·m²" />
        </div>
      </Section>
      <Section title="The machine">
        <Segmented<TurningKind>
          value={p.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: 'four-stroke', label: 'One cylinder' },
            { value: 'four-cylinder', label: 'Four' },
            { value: 'press', label: 'Press' },
          ]}
        />
        <Slider label="Peak moment" value={p.Tp} min={100} max={3000} step={50} unit="N·m" onChange={(Tp) => set({ Tp })} />
        <Slider label="Mean speed" value={p.rpm} min={60} max={600} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Slider label="Flywheel mass" value={p.m} min={10} max={600} step={10} unit="kg" onChange={(m) => set({ m })} />
        <Slider label="Radius of gyration" value={p.k} min={0.1} max={0.6} step={0.01} unit="m" onChange={(k) => set({ k })} />
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Through a cycle">
        <Chart data={[degs, st.T, st.T.map(() => st.mean)]} series={[{ label: 'Moment', color: '#e8794f', width: 2 }, { label: 'Mean', color: '#e8e8e8', width: 1 }]} xLabel="Crank angle (°)" yLabel="Turning moment (N·m)" height={140} />
        <Chart data={[degs, st.E]} series={[{ label: 'Energy', color: '#9bd17a', width: 2 }]} xLabel="Crank angle (°)" yLabel="Energy stored (J)" height={125} />
        <Note>The area between the moment and its mean is energy going into the wheel, or out of it. The biggest swing of that area is what the wheel must absorb. The diagram is a representative shape, not measured from a particular engine.</Note>
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Inertia', tex: 'I = m k^2', sub: `=${n(p.m, 3)}(${n(p.k, 3)})^2`, result: `=${n(I, 4)}\\ \\text{kg·m}^2` },
            { label: 'Energy fluctuation, from the diagram', tex: '\\Delta E = E_{\\max} - E_{\\min}', result: `=${n(st.dE, 4)}\\ \\text{J}` },
            { label: 'Coefficient of fluctuation of speed', tex: 'C_s = \\dfrac{\\omega_1 - \\omega_2}{\\bar\\omega} = \\dfrac{\\Delta E}{I\\bar\\omega^2}', sub: `=\\dfrac{${n(st.dE, 4)}}{${n(I, 4)}(${n(w, 4)})^2}`, result: `=${n(Cs * 100, 3)}\\ \\%` },
            { label: 'A flywheel between 120 and 118 rpm, 6500 kg, k = 1.8 m', tex: '\\Delta E = \\tfrac12 I(\\omega_1^2 - \\omega_2^2)', result: `=${n(energyFluctuation(flywheelInertia(6500, 1.8), rpmToRad(120), rpmToRad(118)) / 1000, 3)}\\ \\text{kJ},\\ C_s = ${n(speedFluctuation(120, 118) * 100, 3)}\\ \\%` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>A flywheel limits speed variation within a cycle. A governor controls the mean speed over many cycles, as load changes.</li>
          <li>It stores energy as speed: ΔE = I ω̄² Cs. Doubling the mean speed reduces the inertia needed four times.</li>
          <li>Mass at the rim works hardest: I grows with k².</li>
        </ExamList>
      </Section>
    </div>
  )
}
