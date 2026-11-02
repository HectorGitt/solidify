import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, extrude, mat4, merge, tube, xform } from '@/geometry'
import { TestBench, createRun, instrument, useResetOnChange, useRunDriver } from '@/lab/run'
import { camLift, motionLaw, type CamMotion, type CamSegment } from '@/physics/machinedynamics'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../../elements/_shared/PanelBits'
import { BenchPlate, ExamList } from '../_shared/rig'

export const FLOOR = -0.4
/** drawn at three times bench size */
export const MM = 0.003
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

type Follower = 'knife' | 'roller'

interface Params {
  /** mm */
  base: number
  lift: number
  shaft: number
  roller: number
  /** degrees */
  riseEnd: number
  dwellEnd: number
  rise: CamMotion
  fall: CamMotion
  follower: Follower
  rpm: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

/** the past question: lift 32 mm uniformly by 120°, dwell to 180°, fall with SHM by 360°, base 38 mm, shaft Ø24 */
export const DEFAULTS = { base: 38, lift: 32, shaft: 24, roller: 10, riseEnd: 120, dwellEnd: 180, rise: 'uniform' as CamMotion, fall: 'shm' as CamMotion, follower: 'knife' as Follower, rpm: 30 }
export const useCam = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useCam.getState().set(p)
const live = { theta: 0, test: 0 }

const camRun = createRun()
const PROCEDURE = { steps: 12, moveSeconds: 0.45, dwellSeconds: 0.25 }

export type CamInputs = Omit<Params, 'set' | 'reset'>

export const segmentsOf = (p: CamInputs): CamSegment[] => [
  { to: rad(p.riseEnd), lift: p.lift, motion: p.rise },
  { to: rad(Math.max(p.dwellEnd, p.riseEnd + 0.01)), lift: p.lift, motion: 'uniform' },
  { to: 2 * Math.PI, lift: 0, motion: p.fall },
]

/** the cam’s surface at local angle φ, with a knife or roller follower on the +y axis, cam turning clockwise */
export function camShape(p: CamInputs) {
  const segs = segmentsOf(p)
  const N = 360
  const pitch = (th: number) => (p.follower === 'knife' ? p.base : p.base + p.roller) + camLift(segs, th)
  const pts: [number, number][] = []
  for (let i = 0; i < N; i++) {
    const th = (i / N) * 2 * Math.PI
    const r = pitch(th)
    const phi = Math.PI / 2 + th
    const px = r * Math.cos(phi)
    const py = r * Math.sin(phi)
    if (p.follower === 'knife') pts.push([px, py])
    else {
      // the working surface is the pitch curve, offset inward by the roller radius
      const h = 1e-3
      const r2 = pitch(th + h)
      const r1 = pitch(th - h)
      const dx = (r2 * Math.cos(phi + h) - r1 * Math.cos(phi - h)) / (2 * h)
      const dy = (r2 * Math.sin(phi + h) - r1 * Math.sin(phi - h)) / (2 * h)
      const len = Math.hypot(dx, dy) || 1
      // the outward normal is on the right of the anticlockwise travel
      pts.push([px - (p.roller * dy) / len, py + (p.roller * dx) / len])
    }
  }
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x * MM, y * MM) : s.moveTo(x * MM, y * MM)))
  s.closePath()
  const bore = new THREE.Path()
  bore.absarc(0, 0, (p.shaft / 2) * MM, 0, Math.PI * 2, true)
  s.holes.push(bore)
  return s
}

export function Cam3D() {
  const p = useCam()
  const cam = useRef<THREE.Group>(null)
  const follower = useRef<THREE.Group>(null)
  const roller = useRef<THREE.Group>(null)
  const phase = useRef(0)
  const along = mat4.rx(Math.PI / 2)
  const Z = 0.04
  const geo = useMemo(
    () => ({
      cam: extrude(camShape(p), 0.05, { curveSegments: 8 }),
      shaft: xform(cylinder((p.shaft / 2) * MM, 0.1, 32), along),
      guide: merge(xform(box(0.11, 0.03, 0.05), mat4.t(0, 0, 0))),
      stem: xform(cylinder(0.012, 0.32, 20), mat4.t(0, 0.16, 0)),
      knife: (() => {
        const s = new THREE.Shape()
        s.moveTo(-0.018, 0.03)
        s.lineTo(0.018, 0.03)
        s.lineTo(0, 0)
        s.closePath()
        return extrude(s, 0.03)
      })(),
      wheel: xform(tube((p.roller * MM), 0.006, 0.036, 36), along),
      fork: merge(...[-1, 1].map((k) => xform(box(0.02, p.roller * MM + 0.03, 0.006), mat4.t(0, (p.roller * MM + 0.03) / 2, k * 0.024)))),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.base, p.lift, p.shaft, p.roller, p.riseEnd, p.dwellEnd, p.rise, p.fall, p.follower],
  )

  useResetOnChange(camRun, JSON.stringify([p.base, p.lift, p.roller, p.riseEnd, p.dwellEnd, p.rise, p.fall, p.follower]))
  useRunDriver(
    camRun,
    PROCEDURE,
    (f) => {
      live.test = f * 2 * Math.PI
    },
    (step, f) => {
      camRun.getState().log([f * 360, instrument(camLift(segmentsOf(useCam.getState()), f * 2 * Math.PI), 0.003, step)])
    },
  )

  useSimFrame((dt) => {
    const s = useCam.getState()
    // during the test the cam is turned by hand, a step at a time; otherwise it runs
    const testing = ['running', 'paused'].includes(camRun.getState().status)
    if (testing) phase.current = live.test
    else phase.current += (s.rpm * 2 * Math.PI * dt) / 60
    const t = phase.current
    live.theta = t
    // clockwise, so the point at local angle π/2 + θ comes under the follower
    cam.current?.rotation.set(0, 0, -t)
    const lift = camLift(segmentsOf(s), t)
    const y = (s.base + (s.follower === 'roller' ? s.roller : 0) + lift) * MM
    follower.current?.position.set(0, y, Z)
    roller.current?.rotation.set(0, 0, t * 3)
  })

  const guideY = (p.base + (p.follower === 'roller' ? p.roller : 0) + p.lift) * MM + 0.1
  return (
    <group position={[0, -0.14, 0]}>
      <group position={[0, 0.14, 0]}>
        <BenchPlate width={0.86} height={0.92} floor={FLOOR} />
      </group>
      <group ref={cam} position={[0, 0, Z]}>
        <Part id="cam" name="Plate cam" role="moving" material="steelMatte" info={{ summary: 'Its profile is the motion you want, wrapped round a circle.', role: 'As it turns, the radius under the follower sets the lift. Base circle: the smallest radius. Nose: the largest.' }} explode={[0, 0, 0.1]}>
          <PartMesh geometry={geo.cam} />
          <PartMesh geometry={geo.shaft} material="chrome" />
        </Part>
      </group>
      <group ref={follower}>
        <Part id="follower" name={p.follower === 'knife' ? 'Knife-edge follower' : 'Roller follower'} role="moving" material="paintBlue" info={{ summary: 'Runs up and down in its guide, in line with the shaft.', role: p.follower === 'knife' ? 'Follows any profile exactly, but its point wears quickly and carries little load.' : 'Rolls instead of sliding, so it carries far more load, but it cannot enter a hollow tighter than its own radius.' }} cut={false} explode={[0, 0, 0.14]}>
          {p.follower === 'knife' ? (
            <>
              <PartMesh geometry={geo.knife} />
              <group position={[0, 0.03, 0]}>
                <PartMesh geometry={geo.stem} />
              </group>
            </>
          ) : (
            <>
              <group ref={roller}>
                <PartMesh geometry={geo.wheel} material="chrome" />
              </group>
              <PartMesh geometry={geo.fork} />
              <group position={[0, p.roller * MM + 0.03, 0]}>
                <PartMesh geometry={geo.stem} />
              </group>
            </>
          )}
        </Part>
      </group>
      <group position={[0, guideY, Z]}>
        <Part id="guide" name="Follower guide" role="static" material="steelDark" info={{ summary: 'Holds the follower to a straight line.', role: 'It takes the side thrust. The steeper the cam, the larger that thrust: this is the pressure angle.' }} cut={false}>
          <PartMesh geometry={geo.guide} />
        </Part>
      </group>
      <PartLabel partId="cam" at={[-(p.base * MM) - 0.02, -(p.base * MM) - 0.03, Z + 0.05]} />
      <PartLabel partId="follower" at={[0.06, guideY + 0.03, Z]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'pq', label: 'Past question', note: 'Lift 32 mm with uniform velocity to 120°, dwell to 180°, fall with SHM to 360°. Base radius 38 mm, shaft Ø24 mm, in-line point follower.', apply: () => set({ ...DEFAULTS }) },
  { id: 'smooth', label: 'High-speed cam', note: 'Cycloidal rise and fall: acceleration starts and ends at zero, with no jerk at the joins.', apply: () => set({ ...DEFAULTS, rise: 'cycloidal', fall: 'cycloidal', riseEnd: 150, dwellEnd: 210 }) },
  { id: 'roller', label: 'Roller follower', note: 'The same motion with a 10 mm roller: the working surface sits a roller’s radius inside the pitch curve.', apply: () => set({ ...DEFAULTS, follower: 'roller', rise: 'shm', fall: 'shm' }) },
]

/** The bench test: turn the cam by hand, reading the follower on a dial gauge every 30°. */
function CamTest() {
  const rows = camRun((s) => s.rows)
  const status = camRun((s) => s.status)
  const lifts = rows.map((r) => r[1])
  const rate = rows.slice(1).map((r, i) => Math.abs(r[1] - rows[i][1]) / 30)
  return (
    <TestBench run={camRun} steps={PROCEDURE.steps} title="The test: dial gauge every 30°" head={['Cam (°)', 'Lift (mm)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[rows.map((r) => r[0]), lifts]} series={[{ label: 'Lift', color: '#6fb3e0', width: 2 }]} xLabel="Cam angle (°)" yLabel="Lift (mm)" height={110} />
          {status === 'done' ? (
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <Readout label="Lift found" value={fmt(Math.max(...lifts), 3)} unit="mm" tone="accent" />
              <Readout label="Steepest" value={fmt(Math.max(...rate), 3)} unit="mm/°" tone="info" />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function CamPanel() {
  const p = useCam()
  const [preset, setPreset] = useState<string | null>('pq')
  const segs = segmentsOf(p)
  const w = (p.rpm * 2 * Math.PI) / 60
  const theta = useLive(() => live.theta, 15)
  const data = useMemo(() => {
    const a = Array.from({ length: 361 }, (_, i) => i)
    const h = 1e-3
    const s = (d: number) => camLift(segs, rad(d))
    const v = a.map((d) => ((s(d + h * 57.3) - s(d - h * 57.3)) / (2 * h)) * w)
    const ac = a.map((d) => ((s(d + h * 57.3) - 2 * s(d) + s(d - h * 57.3)) / (h * h)) * w * w)
    const pressure = a.map((d, i) => deg(Math.atan(v[i] / w / (p.base + (p.follower === 'roller' ? p.roller : 0) + s(d)))))
    // clip the spikes of a sudden speed change, which the plot would otherwise be scaled by
    const lim = (x: number) => Math.max(-3e4, Math.min(3e4, x))
    return { a, s: a.map(s), v, ac: ac.map(lim), pressure }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.base, p.lift, p.roller, p.riseEnd, p.dwellEnd, p.rise, p.fall, p.follower, p.rpm])
  const t = (((deg(theta) % 360) + 360) % 360)
  const idx = Math.round(t) % 360
  const maxP = Math.max(...data.pressure.map(Math.abs))
  const rows = Array.from({ length: 13 }, (_, i) => i * 30).map((d) => [`${d}°`, fmt(camLift(segs, rad(d === 360 ? 359.999 : d)), 3), fmt(p.base + (p.follower === 'roller' ? p.roller : 0) + camLift(segs, rad(d === 360 ? 359.999 : d)), 3)])
  return (
    <div>
      <CamTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Cam angle" value={fmt(t, 3)} unit="°" />
          <Readout label="Lift" value={fmt(data.s[idx], 3)} unit="mm" tone="accent" />
          <Readout label="Velocity" value={fmt(data.v[idx], 3)} unit="mm/s" tone="info" />
          <Readout label="Acceleration" value={fmt(data.ac[idx], 3)} unit="mm/s²" tone="warn" />
          <Readout label="Pressure angle" value={fmt(data.pressure[idx], 3)} unit="°" />
          <Readout label="Largest" value={fmt(maxP, 3)} unit="°" tone={maxP > 30 ? 'warn' : 'ink'} />
        </div>
        {maxP > 30 ? <Note tone="warn">Over about 30° the follower presses hard against its guide. A bigger base circle or a longer rise would help.</Note> : null}
      </Section>
      <Section title="The motion">
        <Slider label="Lift" value={p.lift} min={5} max={60} step={1} unit="mm" onChange={(lift) => set({ lift })} />
        <Slider label="Rise ends at" value={p.riseEnd} min={30} max={240} step={5} unit="°" onChange={(riseEnd) => set({ riseEnd, dwellEnd: Math.max(riseEnd, p.dwellEnd) })} />
        <Slider label="Dwell ends at" value={p.dwellEnd} min={p.riseEnd} max={330} step={5} unit="°" onChange={(dwellEnd) => set({ dwellEnd })} />
        <div className="mb-1 mt-2 text-[12.5px] font-medium text-ink/90">Rise</div>
        <Segmented<CamMotion> value={p.rise} onChange={(rise) => set({ rise })} options={[{ value: 'uniform', label: 'Uniform' }, { value: 'shm', label: 'SHM' }, { value: 'parabolic', label: 'Parabolic' }, { value: 'cycloidal', label: 'Cycloidal' }]} />
        <div className="mb-1 mt-2 text-[12.5px] font-medium text-ink/90">Fall</div>
        <Segmented<CamMotion> value={p.fall} onChange={(fall) => set({ fall })} options={[{ value: 'uniform', label: 'Uniform' }, { value: 'shm', label: 'SHM' }, { value: 'parabolic', label: 'Parabolic' }, { value: 'cycloidal', label: 'Cycloidal' }]} />
      </Section>
      <Section title="The cam and follower">
        <Segmented<Follower> value={p.follower} onChange={(follower) => set({ follower })} options={[{ value: 'knife', label: 'Knife edge' }, { value: 'roller', label: 'Roller' }]} />
        <Slider label="Base circle radius" value={p.base} min={20} max={70} step={1} unit="mm" onChange={(base) => set({ base })} />
        <Slider label="Shaft diameter" value={p.shaft} min={10} max={Math.min(36, p.base)} step={1} unit="mm" onChange={(shaft) => set({ shaft })} />
        {p.follower === 'roller' ? <Slider label="Roller radius" value={p.roller} min={4} max={20} step={1} unit="mm" onChange={(roller) => set({ roller })} /> : null}
        <Slider label="Cam speed" value={p.rpm} min={5} max={120} step={5} unit="rpm" onChange={(rpm) => set({ rpm })} />
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Follower displacement diagram">
        <Chart data={[data.a, data.s]} series={[{ label: 'Lift', color: '#6fb3e0', width: 2 }]} xLabel="Cam angle (°)" yLabel="Lift (mm)" marker={() => [t, data.s[Math.round(t) % 360]]} height={135} />
        <Chart data={[data.a, data.v]} series={[{ label: 'Velocity', color: '#9bd17a', width: 2 }]} xLabel="Cam angle (°)" yLabel="Velocity (mm/s)" height={115} />
        <Chart data={[data.a, data.ac]} series={[{ label: 'Acceleration', color: '#e8794f', width: 2 }]} xLabel="Cam angle (°)" yLabel="Acceleration (mm/s²)" height={115} />
        <Note>Uniform velocity looks simple, but at each end the speed jumps, which needs an impossibly large acceleration: shown here as a clipped spike. That is why real cams blend their ends.</Note>
      </Section>
      <Section title="Layout: radius at each 30°">
        <Table head={['Angle', 'Lift (mm)', 'Pitch radius (mm)']} rows={rows} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Uniform velocity rise', tex: 's = h\\dfrac{\\theta}{\\beta}', sub: `\\text{at } 60^\\circ,\\ \\beta = 120^\\circ:\\ 32\\times\\dfrac{60}{120}`, result: `=${n(motionLaw('uniform', 0.5) * 32, 3)}\\ \\text{mm}` },
            { label: 'Simple harmonic', tex: 's = \\dfrac{h}{2}\\left(1 - \\cos\\dfrac{\\pi\\theta}{\\beta}\\right)' },
            { label: 'Cycloidal', tex: 's = h\\left(\\dfrac{\\theta}{\\beta} - \\dfrac{1}{2\\pi}\\sin\\dfrac{2\\pi\\theta}{\\beta}\\right)' },
            { label: 'Pressure angle, in-line follower', tex: '\\tan\\phi = \\dfrac{ds/d\\theta}{r_b + s}' },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>To draw a cam: invert the motion. Hold the cam still, swing the follower round it the opposite way, and mark the lift on each radius.</li>
          <li>Plot the lift on the displacement diagram first, then transfer it at each angle.</li>
          <li>A roller follower’s pitch curve is drawn first; the cam’s surface is a curve inside it, tangent to the roller at each position.</li>
          <li>Dwell: the follower stands still while the cam’s radius stays constant.</li>
        </ExamList>
      </Section>
    </div>
  )
}
