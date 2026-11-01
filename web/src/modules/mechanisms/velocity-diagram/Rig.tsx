import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { TestBench, createRun, instrument, useAutoRun, useRunDriver } from '@/lab/run'
import { fourBarDiagrams, instantaneousCentre, sliderCrankDiagrams, type LinkState } from '@/physics/machinedynamics'
import { crankRange, solve, type FourBar } from '@/physics/fourbar'
import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n } from '@/ui/Working'
import { Note } from '../../elements/_shared/PanelBits'
import { BenchPlate, ExamList, flatBar } from '../_shared/rig'
import { ForceArrow } from '../../elements/_shared/Arrow'

export const FLOOR = -0.36
/** drawn at twice bench size: a metre on the sliders is a metre on the rig's own scale of 2 */
const SCALE = 2
const X0 = -0.16

type Mech = 'four-bar' | 'slider'

interface Params extends FourBar {
  mech: Mech
  /** crank speed, rad/s */
  w: number
  /** crank angle when paused, deg */
  angle: number
  run: boolean
  set: (p: Partial<Params>) => void
  reset: () => void
}

/** lengths in m */
export const DEFAULTS = { mech: 'four-bar' as Mech, frame: 0.16, crank: 0.05, coupler: 0.18, rocker: 0.14, w: 2, angle: 60, run: false }
export const useDiagram = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useDiagram.getState().set(p)

const live: { theta: number; state: LinkState | null; B: [number, number]; C: [number, number] } = { theta: (60 * Math.PI) / 180, state: null, B: [0, 0], C: [0, 0] }

function compute(s: Params, theta: number) {
  if (s.mech === 'slider') {
    const d = sliderCrankDiagrams(s.crank, s.coupler, theta, s.w)
    const th3 = Math.atan2(d.C[1] - d.B[1], d.C[0] - d.B[0])
    return { pose: { B: d.B, C: d.C, theta2: theta, theta3: th3, theta4: 0 }, d }
  }
  const pose = solve(s, theta)
  if (!pose) return null
  return { pose, d: fourBarDiagrams(pose.B, pose.C, [s.frame, 0], s.w) }
}

const diagramRun = createRun()
const PROCEDURE = { steps: 12, moveSeconds: 0.4, dwellSeconds: 0.2 }
const testAngle = { value: 0 }

/** the crank angles the test can reach: a full turn, or as far as the linkage will go */
function sweep(s: Params): [number, number] {
  const r = s.mech === 'slider' ? null : crankRange(s)
  const lo = r && Number.isFinite(r.lo) ? r.lo : 0
  const hi = r && Number.isFinite(r.hi) ? r.hi : lo + 2 * Math.PI
  const span = Math.min(hi - lo, 2 * Math.PI)
  // stop just short of a toggle position, where the speeds run away
  return span < 2 * Math.PI - 1e-6 ? [lo + span * 0.02, lo + span * 0.98] : [lo, lo + span]
}
const angleAt = (s: Params, f: number) => {
  const [a, b] = sweep(s)
  return a + (b - a) * f
}

const v3 = (p: [number, number], k = SCALE) => new THREE.Vector3(p[0] * k + X0, p[1] * k, 0.05)

export function Diagram3D() {
  const p = useDiagram()
  const refs = { crank: useRef<THREE.Group>(null), coupler: useRef<THREE.Group>(null), rocker: useRef<THREE.Group>(null), ic: useRef<THREE.Mesh>(null), slider: useRef<THREE.Group>(null) }
  const theta = useRef(live.theta)
  useAutoRun(diagramRun, JSON.stringify([p.mech, p.frame, p.crank, p.coupler, p.rocker, p.w]))
  useRunDriver(
    diagramRun,
    PROCEDURE,
    (f) => {
      testAngle.value = angleAt(useDiagram.getState(), f)
    },
    (step, f) => {
      const s = useDiagram.getState()
      const a = angleAt(s, f)
      const c = compute(s, a)
      if (c) diagramRun.getState().log([(a * 180) / Math.PI, instrument(Math.hypot(c.d.vC[0], c.d.vC[1]), 0.004, step), instrument(c.d.w3, 0.004, step + 30)])
    },
  )
  const geo = useMemo(
    () => ({
      crank: flatBar(p.crank * SCALE, 0.026, 0.007),
      coupler: flatBar(p.coupler * SCALE, 0.026, 0.007),
      rocker: flatBar(p.rocker * SCALE, 0.026, 0.007),
      frame: flatBar(p.frame * SCALE, 0.026, 0.007),
      pins: merge(xform(cylinder(0.006, 0.05, 16), mat4.c(mat4.t(0, 0, 0.02), mat4.rx(Math.PI / 2)))),
      ball: new THREE.SphereGeometry(0.009, 18, 12),
      block: box(0.11, 0.07, 0.03),
      guide: merge(xform(box(0.9, 0.012, 0.024), mat4.t(0.3, 0.043, 0.02)), xform(box(0.9, 0.012, 0.024), mat4.t(0.3, -0.043, 0.02))),
    }),
    [p.crank, p.coupler, p.rocker, p.frame],
  )

  useSimFrame((dt) => {
    const s = useDiagram.getState()
    const range = s.mech === 'slider' ? null : crankRange(s)
    if (['running', 'paused'].includes(diagramRun.getState().status)) theta.current = testAngle.value
    else if (s.run) theta.current += s.w * dt
    else theta.current = (s.angle * Math.PI) / 180
    if (range && (theta.current < range.lo || theta.current > range.hi)) theta.current = (range.lo + range.hi) / 2
    const c = compute(s, theta.current)
    if (!c) return
    live.theta = theta.current
    live.state = c.d
    live.B = c.pose.B
    live.C = c.pose.C
    refs.crank.current?.rotation.set(0, 0, c.pose.theta2)
    refs.coupler.current?.position.set(c.pose.B[0] * SCALE + X0, c.pose.B[1] * SCALE, 0.03)
    refs.coupler.current?.rotation.set(0, 0, c.pose.theta3)
    refs.rocker.current?.rotation.set(0, 0, c.pose.theta4)
    // the slider's centre lies straight up from it, on the perpendicular to the stroke
    const I = s.mech === 'slider' ? (Math.abs(Math.cos(c.pose.theta2)) > 1e-3 ? ([c.pose.C[0], c.pose.C[0] * Math.tan(c.pose.theta2)] as [number, number]) : null) : instantaneousCentre(c.pose.B, c.pose.C, [s.frame, 0])
    if (refs.slider.current) refs.slider.current.position.set(c.pose.C[0] * SCALE + X0, 0, 0.03)
    if (refs.ic.current) {
      refs.ic.current.visible = !!I && Math.hypot(I[0], I[1]) < 0.6
      if (I) refs.ic.current.position.set(I[0] * SCALE + X0, I[1] * SCALE, 0.05)
    }
  })

  // the arrows scale so that the crank pin's speed is a steady length on screen
  const kv = 0.16 / Math.max(1e-6, p.w * p.crank)
  const arrow = (from: () => [number, number], vec: () => [number, number], k: number, label: string) => () => {
    const f = from()
    const q = vec()
    const len = Math.hypot(q[0], q[1])
    return { origin: v3(f), dir: new THREE.Vector3(q[0], q[1], 0), length: Math.max(0.001, Math.min(0.42, len * k)), label, visible: len > 1e-9 }
  }
  const zero: [number, number] = [0, 0]
  return (
    <group>
      <BenchPlate width={1.15} height={0.86} floor={FLOOR} />
      {p.mech === 'slider' ? (
        <>
          <group position={[X0, 0, 0]}>
            <Part id="guide" name="Guide" role="static" material="steelDark" info={{ summary: 'Holds the slider on its line of stroke.', role: 'It fixes the direction of the slider’s velocity and acceleration: that is the second line on each diagram.' }} cut={false}>
              <PartMesh geometry={geo.guide} />
            </Part>
          </group>
          <group ref={refs.slider}>
            <Part id="slider" name="Slider" role="moving" material="paintBlue" info={{ summary: 'Runs along the guide.', role: 'Its velocity is along the stroke, so the velocity diagram closes on a horizontal line.' }} cut={false}>
              <PartMesh geometry={geo.block} />
            </Part>
          </group>
        </>
      ) : null}
      <group position={[X0, 0, 0.012]} visible={p.mech === 'four-bar'}>
        <Part id="frame" name="Frame" role="static" material="paintGrey" info={{ summary: 'The fixed link, A to D.', role: 'Points on it have no velocity: they are one single point o in the velocity diagram.' }} cut={false}>
          <PartMesh geometry={geo.frame} />
          <PartMesh geometry={geo.pins} material="chrome" />
          <group position={[p.frame * SCALE, 0, 0]}>
            <PartMesh geometry={geo.pins} material="chrome" />
          </group>
        </Part>
      </group>
      <group position={[X0, 0, 0.022]} ref={refs.crank}>
        <Part id="crank" name="Crank" role="moving" material="paintOrange" info={{ summary: 'Turned at steady speed ω₂.', role: 'Its pin’s velocity, ω₂ × AB at right angles to AB, is known. Everything else is worked out from it.' }}>
          <PartMesh geometry={geo.crank} />
        </Part>
      </group>
      <group ref={refs.coupler}>
        <Part id="coupler" name="Coupler" role="moving" material="paintRed" info={{ summary: 'Moves and turns at once.', role: 'At any instant it is turning about its instantaneous centre. C’s velocity relative to B is at right angles to BC.' }}>
          <PartMesh geometry={geo.coupler} />
        </Part>
      </group>
      <group position={[X0 + p.frame * SCALE, 0, 0.022]} ref={refs.rocker} visible={p.mech === 'four-bar'}>
        <Part id="rocker" name="Output lever" role="moving" material="paintBlue" info={{ summary: 'Turns about D.', role: 'C’s velocity is at right angles to DC. Crossing this line with the other locates C in the polygon.' }}>
          <PartMesh geometry={geo.rocker} />
        </Part>
      </group>
      <mesh ref={refs.ic} geometry={geo.ball}>
        <meshBasicMaterial color="#7b3fb0" toneMapped={false} />
      </mesh>
      <ForceArrow color="#d0631c" spec={arrow(() => live.B, () => live.state?.vB ?? zero, kv, 'v_B')} />
      <ForceArrow color="#2f6fd0" spec={arrow(() => live.C, () => live.state?.vC ?? zero, kv, 'v_C')} />
    </group>
  )
}

/** a polygon of vectors from a common pole */
function Polygon({ title, paths }: { title: string; paths: { from: [number, number]; to: [number, number]; color: string; label: string; dash?: boolean }[] }) {
  const xs = paths.flatMap((q) => [q.from[0], q.to[0]])
  const ys = paths.flatMap((q) => [q.from[1], q.to[1]])
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9) * 1.3
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2
  const S = (q: [number, number]) => [90 + ((q[0] - cx) / span) * 170, 85 - ((q[1] - cy) / span) * 170] as const
  return (
    <div>
      <div className="mb-0.5 text-[11.5px] font-medium text-ink/90">{title}</div>
      <svg viewBox="0 0 180 170" className="w-full" role="img" aria-label={title}>
        {paths.map((q, i) => {
          const [x1, y1] = S(q.from)
          const [x2, y2] = S(q.to)
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={q.color} strokeWidth={2} strokeLinecap="round" strokeDasharray={q.dash ? '4 3' : undefined} />
              <text x={(x1 + x2) / 2 + 3} y={(y1 + y2) / 2 - 2} fontSize={8.5} fill={q.color}>
                {q.label}
              </text>
            </g>
          )
        })}
        {(() => {
          const [x, y] = S([0, 0])
          return <circle cx={x} cy={y} r={2.6} fill="#3f4a52" />
        })()}
      </svg>
    </div>
  )
}

/** The bench test: step the crank round, reading the output's speed at each position. */
function DiagramTest() {
  const rows = diagramRun((s) => s.rows)
  const status = diagramRun((s) => s.status)
  const speeds = rows.map((r) => r[1])
  return (
    <TestBench run={diagramRun} steps={PROCEDURE.steps} title="The test: step the crank round" head={['Crank (°)', 'Output point (m/s)', 'Coupler (rad/s)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[rows.map((r) => r[0]), speeds]} series={[{ label: 'Output point', color: '#2f6fd0', width: 2 }]} xLabel="Crank angle (°)" yLabel="Speed (m/s)" height={110} />
          {status === 'done' ? (
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <Readout label="Fastest" value={fmt(Math.max(...speeds), 3)} unit="m/s" tone="accent" />
              <Readout label="Slowest" value={fmt(Math.min(...speeds), 3)} unit="m/s" tone="info" />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function DiagramPanel() {
  const p = useDiagram()
  const state = useLive(() => live.state, 12)
  const theta = useLive(() => live.theta, 12)
  if (!state) return <Section title="Live">Setting up…</Section>
  const add = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]]
  const O: [number, number] = [0, 0]
  const speed = (v: [number, number]) => Math.hypot(v[0], v[1])
  return (
    <div>
      <DiagramTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Crank pin" value={fmt(speed(state.vB), 3)} unit="m/s" tone="warn" />
          <Readout label={p.mech === 'slider' ? 'Slider' : 'Pin C'} value={fmt(speed(state.vC), 3)} unit="m/s" tone="info" />
          <Readout label="C relative to B" value={fmt(speed(state.vCB), 3)} unit="m/s" />
          <Readout label="Coupler speed" value={fmt(state.w3, 3)} unit="rad/s" />
          {p.mech === 'slider' ? <Readout label="Slider accel." value={fmt(state.aC[0], 3)} unit="m/s²" tone="accent" /> : <Readout label="Output speed" value={fmt(state.w4, 3)} unit="rad/s" tone="accent" />}
          {p.mech === 'slider' ? <Readout label="Rod accel." value={fmt(state.a3, 3)} unit="rad/s²" /> : <Readout label="Output accel." value={fmt(state.a4, 3)} unit="rad/s²" />}
        </div>
      </Section>
      <Section title="The diagrams, live">
        <div className="grid grid-cols-2 gap-2">
          <Polygon
            title="Velocity"
            paths={[
              { from: O, to: state.vB, color: '#d0631c', label: 'ob' },
              { from: state.vB, to: state.vC, color: '#a0271f', label: 'bc' },
              { from: O, to: state.vC, color: '#2f6fd0', label: 'oc' },
            ]}
          />
          <Polygon
            title="Acceleration"
            paths={[
              { from: O, to: state.aB, color: '#d0631c', label: "b'" },
              { from: state.aB, to: add(state.aB, state.aCBn), color: '#a0271f', label: 'n', dash: true },
              { from: add(state.aB, state.aCBn), to: state.aC, color: '#a0271f', label: 't' },
              { from: O, to: state.aCn, color: '#2f6fd0', label: 'n', dash: true },
              { from: state.aCn, to: state.aC, color: '#2f6fd0', label: 't' },
            ]}
          />
        </div>
        <Note>The polygons are the vector equations drawn out: both routes to C meet at the same point, so they always close. Dashed lines are the centripetal parts, known from the speeds; solid are the tangential parts, at right angles to their links.</Note>
      </Section>
      <Section title="The mechanism">
        <Segmented<Mech> value={p.mech} onChange={(mech) => set({ mech, crank: mech === 'slider' ? 0.05 : p.crank, coupler: mech === 'slider' ? 0.2 : p.coupler })} options={[{ value: 'four-bar', label: 'Four-bar' }, { value: 'slider', label: 'Slider-crank' }]} />
        <Toggle label="Run the crank" checked={p.run} onChange={(run) => set({ run })} />
        {p.run ? null : <Slider label="Crank angle" value={p.angle} min={0} max={360} step={1} unit="°" onChange={(angle) => set({ angle })} />}
        <Slider label="Crank speed ω₂" value={p.w} min={0.5} max={40} step={0.5} unit="rad/s" onChange={(w) => set({ w })} />
        {p.mech === 'slider' ? null : <Slider label="Frame" value={p.frame * 1000} min={80} max={200} step={5} unit="mm" onChange={(v) => set({ frame: v / 1000 })} />}
        <Slider label="Crank" value={p.crank * 1000} min={25} max={90} step={5} unit="mm" onChange={(v) => set({ crank: v / 1000 })} />
        <Slider label={p.mech === 'slider' ? 'Connecting rod' : 'Coupler'} value={p.coupler * 1000} min={80} max={220} step={5} unit="mm" onChange={(v) => set({ coupler: v / 1000 })} />
        {p.mech === 'slider' ? null : <Slider label="Output lever" value={p.rocker * 1000} min={60} max={200} step={5} unit="mm" onChange={(v) => set({ rocker: v / 1000 })} />}
        <Note>The purple dot is the coupler’s instantaneous centre, where the crank and output lever lines cross. It is off the plate when they are nearly parallel.</Note>
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Start from what is known', tex: 'v_B = \\omega_2 \\times AB', sub: `=${n(p.w, 3)}(${n(p.crank, 3)})`, result: `=${n(speed(state.vB), 3)}\\ \\text{m/s}` },
            { label: 'Relative velocity equation', tex: '\\vec v_C = \\vec v_B + \\vec v_{C/B},\\quad v_{C/B}\\perp BC,\\ v_C\\perp DC', result: `v_C = ${n(speed(state.vC), 3)}\\ \\text{m/s}` },
            { label: 'Angular velocities', tex: '\\omega_3 = \\dfrac{v_{C/B}}{BC},\\quad \\omega_4 = \\dfrac{v_C}{DC}', result: `\\omega_3 = ${n(state.w3, 3)},\\ \\omega_4 = ${n(state.w4, 3)}\\ \\text{rad/s}` },
            { label: 'Acceleration of C', tex: '\\vec a_C = \\vec a_B + \\vec a^{\\,n}_{C/B} + \\vec a^{\\,t}_{C/B} = \\vec a^{\\,n}_C + \\vec a^{\\,t}_C', sub: `a^n = \\omega^2 r`, result: `a_C = ${n(speed(state.aC), 3)}\\ \\text{m/s}^2` },
            { label: 'Angular accelerations', tex: '\\alpha = \\dfrac{a^t}{r}', result: `\\alpha_3 = ${n(state.a3, 3)},\\ \\alpha_4 = ${n(state.a4, 3)}\\ \\text{rad/s}^2` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>The velocity of a point relative to another on the same link is at right angles to the line joining them.</li>
          <li>Acceleration has two parts: centripetal ω²r towards the centre, and tangential αr across the link.</li>
          <li>The instantaneous centre has no velocity at that instant. Each point’s velocity is ω × its distance from it.</li>
          <li>Crank at {fmt(((((theta * 180) / Math.PI) % 360) + 360) % 360, 3)}° now. Try the angle where the output lever momentarily stops: its speed line runs through o.</li>
        </ExamList>
      </Section>
    </div>
  )
}
