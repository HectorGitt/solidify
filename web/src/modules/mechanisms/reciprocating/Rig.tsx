import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { TestBench, createRun, instrument, useResetOnChange, useRunDriver } from '@/lab/run'
import { cylinderBalance, equivalentMasses, reciprocatingForce, rodEnds, rpmToRad } from '@/physics/machinedynamics'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n as num } from '@/ui/Working'
import { Note, Table } from '../../elements/_shared/PanelBits'
import { ExamList } from '../_shared/rig'
import { placeBetween, unitRod } from '../_shared/strut'

export const FLOOR = -0.44
const T = (2 * Math.PI) / 3
export const LAYOUTS = {
  one: { label: '1', name: 'Single', cranks: [0] },
  two: { label: '2', name: 'Twin, 180°', cranks: [0, Math.PI] },
  four: { label: '4', name: 'Flat four', cranks: [0, Math.PI, Math.PI, 0] },
  six: { label: '6', name: 'Straight six', cranks: [0, T, 2 * T, 2 * T, T, 0] },
}
export type Layout = keyof typeof LAYOUTS

interface Params {
  layout: Layout
  /** reciprocating mass per cylinder (kg), crank (mm), rod ÷ crank, speed (rpm) */
  m: number
  r: number
  n: number
  rpm: number
  /** share of the reciprocating mass balanced at the crank */
  c: number
  /** how far the engine has been brought up to speed: moved by the test */
  f: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { layout: 'one' as Layout, m: 2, r: 50, n: 4, rpm: 1500, c: 0, f: 1 }
export const useRecip = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useRecip.getState().set(p)
const live = { theta: 0 }

const recipRun = createRun()
/** sim seconds: the scene runs at 1/50 of real speed */
const PROCEDURE = { steps: 8, moveSeconds: 0.02, dwellSeconds: 0.01 }
const START = 0.2
const rpmAt = (rpm: number, f: number) => rpm * (START + (1 - START) * f)

/** vertical and sideways shaking force at crank angle θ */
function shaking(p: { layout: Layout; m: number; r: number; n: number; rpm: number; c: number }, theta: number) {
  const w = rpmToRad(p.rpm)
  const r = p.r / 1000
  let along = 0
  let primary = 0
  let secondary = 0
  let side = 0
  for (const a of LAYOUTS[p.layout].cranks) {
    const f = reciprocatingForce(p.m, r, p.n, w, theta + a)
    primary += f.primary * (1 - p.c)
    secondary += f.secondary
    along += f.primary * (1 - p.c) + f.secondary
    side += p.c * p.m * r * w * w * Math.sin(theta + a)
  }
  return { along, primary, secondary, side }
}

/** the largest shaking force through a turn, along the stroke and sideways */
function peaks(p: Parameters<typeof shaking>[0]) {
  let along = 0
  let side = 0
  for (let i = 0; i < 72; i++) {
    const f = shaking(p, (i / 72) * 2 * Math.PI)
    along = Math.max(along, Math.abs(f.along))
    side = Math.max(side, Math.abs(f.side))
  }
  return { along, side }
}

export function Recip3D() {
  const p = useRecip()
  useResetOnChange(recipRun, JSON.stringify([p.layout, p.m, p.r, p.n, p.rpm, p.c]))
  useRunDriver(
    recipRun,
    PROCEDURE,
    (f) => {
      if (Math.abs(f - useRecip.getState().f) >= 0.01 || f === 1) useRecip.getState().set({ f })
    },
    (step, f) => {
      const s = useRecip.getState()
      const rpm = rpmAt(s.rpm, f)
      const q = peaks({ ...s, rpm })
      recipRun.getState().log([rpm, instrument(q.along / 1000, 0.008, step), instrument(q.side / 1000, 0.008, step + 30)])
    },
  )
  useEffect(
    () =>
      recipRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle')) useRecip.getState().set({ f: 1 })
        if ((r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useRecip.getState().set({ f: 0 })
      }),
    [],
  )
  const cranks = LAYOUTS[p.layout].cranks
  const N = cranks.length
  const pitch = 0.17
  const rD = 0.08
  const lD = rD * p.n
  const block = useRef<THREE.Group>(null)
  const crank = useRef<THREE.Group>(null)
  const pistons = useRef<(THREE.Group | null)[]>([])
  const rods = useRef<(THREE.Group | null)[]>([])
  const phase = useRef(0)
  const along = mat4.rx(Math.PI / 2)
  const zAt = (i: number) => (i - (N - 1) / 2) * pitch
  const geo = useMemo(() => {
    const webs = cranks.flatMap((a, i) => {
      const z = (i - (N - 1) / 2) * pitch
      const rot = mat4.rz(a)
      return [
        xform(box(0.05, rD + 0.04, 0.02), mat4.c(rot, mat4.t(0, rD / 2, z - 0.04))),
        xform(box(0.05, rD + 0.04, 0.02), mat4.c(rot, mat4.t(0, rD / 2, z + 0.04))),
        xform(cylinder(0.018, 0.08, 20), mat4.c(rot, mat4.c(mat4.t(0, rD, z), along))),
      ]
    })
    const counter = p.c > 0 ? cranks.map((a, i) => xform(cylinder(0.03 + 0.05 * p.c, 0.03, 28), mat4.c(mat4.rz(a), mat4.c(mat4.t(0, -rD * 0.9, (i - (N - 1) / 2) * pitch), along)))) : []
    const liners = Array.from({ length: N }, (_, i) => xform(tube(0.066, 0.058, 0.26, 40), mat4.t(0, rD + lD + 0.01, (i - (N - 1) / 2) * pitch)))
    return {
      shaft: merge(xform(cylinder(0.018, N * pitch + 0.2, 24), along), ...webs),
      counter: counter.length ? merge(...counter) : null,
      liners: merge(...liners),
      casing: merge(xform(box(0.3, 0.05, N * pitch + 0.16), mat4.t(0, -0.17, 0)), xform(box(0.04, 0.2, N * pitch + 0.16), mat4.t(-0.15, -0.07, 0)), xform(box(0.04, 0.2, N * pitch + 0.16), mat4.t(0.15, -0.07, 0))),
      base: xform(box(0.7, 0.03, N * pitch + 0.4), mat4.t(0, FLOOR + 0.015, 0)),
      mounts: merge(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => xform(cylinder(0.03, -0.195 - FLOOR - 0.03, 18), mat4.t(sx * 0.13, (-0.195 + FLOOR + 0.03) / 2, (sz * (N * pitch + 0.1)) / 2))))),
      piston: cylinder(0.056, 0.07, 32),
      rod: unitRod(0.012),
    }
  }, [cranks, N, rD, lD, p.c, along])

  useSimFrame((dt) => {
    const s = useRecip.getState()
    const rpm = rpmAt(s.rpm, s.f)
    phase.current += (rpm * 2 * Math.PI * dt) / 60
    const t = phase.current
    live.theta = t
    crank.current?.rotation.set(0, 0, -t)
    cranks.forEach((a, i) => {
      const q = t + a
      const by = rD * Math.cos(q)
      const bx = rD * Math.sin(q)
      const py = by + Math.sqrt(lD * lD - bx * bx)
      placeBetween(rods.current[i], [bx, by, zAt(i)], [0, py, zAt(i)])
      pistons.current[i]?.position.set(0, py + 0.02, zAt(i))
    })
    const f = shaking({ ...s, rpm }, t)
    const full = Math.max(1, s.m * (s.r / 1000) * rpmToRad(s.rpm) ** 2)
    if (block.current) {
      block.current.position.y = (0.012 * f.along) / (full * 1.3)
      block.current.position.x = (0.012 * f.side) / (full * 1.3)
    }
  })

  return (
    <group>
      <Part id="base" name="Test bed" role="static" material="paintGrey" info={{ summary: 'The engine stands on it.', role: 'What the mounts do not absorb reaches the frame here.' }} cut={false}>
        <PartMesh geometry={geo.base} />
        <PartMesh geometry={geo.mounts} material="rubber" />
      </Part>
      <group ref={block}>
        <Part id="casing" name="Crankcase and liners" role="housing" material="castIron" info={{ summary: 'Mounted on rubber, free to shake.', role: 'The pistons’ inertia forces act on this: any that do not cancel shake the whole engine.' }} xray>
          <PartMesh geometry={geo.casing} />
          <PartMesh geometry={geo.liners} material="aluminium" />
        </Part>
        <group ref={crank}>
          <Part id="crank" name="Crankshaft" role="moving" material="forged" info={{ summary: 'Sets the angle between the pistons.', role: 'The order of the throws decides which forces cancel.' }}>
            <PartMesh geometry={geo.shaft} />
            {geo.counter ? <PartMesh geometry={geo.counter} material="paintGreen" /> : null}
          </Part>
        </group>
        {cranks.map((_, i) => (
          <group key={i}>
            <group ref={(el) => { rods.current[i] = el }}>
              <Part id={`rod-${i}`} name={`Rod ${i + 1}`} role="moving" material="steel" info={{ summary: 'Connecting rod.', role: 'For balancing it is split into a reciprocating part at the small end and a rotating part at the big end.' }}>
                <PartMesh geometry={geo.rod} />
              </Part>
            </group>
            <group ref={(el) => { pistons.current[i] = el }}>
              <Part id={`piston-${i}`} name={`Piston ${i + 1}`} role="moving" material="aluminium" info={{ summary: 'A reciprocating mass.', role: 'Stops and starts twice a turn, so it pulls on the engine with F = m ω² r (cos θ + cos 2θ / n).' }}>
                <PartMesh geometry={geo.piston} />
              </Part>
            </group>
          </group>
        ))}
      </group>
      <PartLabel partId="crank" at={[0.26, 0, 0]} />
    </group>
  )
}

/** The bench test: bring the engine up to speed in steps, reading the force on the bed. */
function RecipTest() {
  const rows = recipRun((s) => s.rows)
  const status = recipRun((s) => s.status)
  const first = rows[0]
  const last = rows[rows.length - 1]
  return (
    <TestBench run={recipRun} steps={PROCEDURE.steps} title="The test: bring it up to speed" head={['Speed (rpm)', 'Along (kN)', 'Sideways (kN)']} format={(r) => [fmt(r[0], 4), fmt(r[1], 3), fmt(r[2], 3)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[rows.map((r) => r[0]), rows.map((r) => r[1]), rows.map((r) => r[2])]} series={[{ label: 'Along', color: '#e8794f', width: 2 }, { label: 'Sideways', color: '#9bd17a', width: 2 }]} xLabel="Speed (rpm)" yLabel="Peak force (kN)" height={110} />
          {status === 'done' && first && last ? (
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              <Readout label="Force at speed" value={fmt(last[1], 3)} unit="kN" tone="accent" />
              <Readout label="Force grew" value={first[1] > 1e-6 ? fmt(last[1] / first[1], 3) : '0'} unit="times" tone="info" />
              <Readout label="Speed² grew" value={fmt((last[0] / first[0]) ** 2, 3)} unit="times" />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function RecipPanel() {
  const p = useRecip()
  const [ex] = useState({ m: 16, I: 320000, a: 200 })
  const theta = useLive(() => live.theta, 15)
  const now = shaking(p, theta)
  const data = useMemo(() => {
    const a = Array.from({ length: 181 }, (_, i) => i * 2)
    const f = a.map((d) => shaking(p, (d * Math.PI) / 180))
    return { a, pr: f.map((x) => x.primary / 1000), se: f.map((x) => x.secondary / 1000), side: f.map((x) => x.side / 1000) }
  }, [p])
  const b = cylinderBalance(LAYOUTS[p.layout].cranks)
  const w = rpmToRad(p.rpm)
  const unit = p.m * (p.r / 1000) * w * w
  const e = equivalentMasses(ex.m, ex.I, ex.a)
  const rod = rodEnds(ex.m, 350, ex.a)
  return (
    <div>
      <RecipTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Primary now" value={fmt(now.primary / 1000, 3)} unit="kN" tone="info" />
          <Readout label="Secondary now" value={fmt(now.secondary / 1000, 3)} unit="kN" tone="warn" />
          <Readout label="Sideways now" value={fmt(now.side / 1000, 3)} unit="kN" />
        </div>
      </Section>
      <Section title="The engine">
        <Segmented<Layout> value={p.layout} onChange={(layout) => set({ layout })} options={(Object.keys(LAYOUTS) as Layout[]).map((k) => ({ value: k, label: LAYOUTS[k].name }))} />
        <Slider label="Reciprocating mass" value={p.m} min={0.2} max={8} step={0.1} unit="kg" onChange={(m) => set({ m })} />
        <Slider label="Crank radius" value={p.r} min={20} max={100} step={1} unit="mm" onChange={(r) => set({ r })} />
        <Slider label="Rod ÷ crank, n" value={p.n} min={2.5} max={8} step={0.5} onChange={(n) => set({ n })} />
        <Slider label="Engine speed" value={p.rpm} min={60} max={3000} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Slider label="Balanced at the crank" value={p.c * 100} min={0} max={100} step={5} unit="%" onChange={(v) => set({ c: v / 100 })} />
        <Note>A counterweight cancels that share of the primary force along the stroke, but puts the same amount in sideways. It cannot touch the secondary.</Note>
      </Section>
      <Section title="Which forces cancel">
        <Table
          head={['Engine', 'Primary', 'Secondary']}
          rows={(Object.keys(LAYOUTS) as Layout[]).map((k) => {
            const q = cylinderBalance(LAYOUTS[k].cranks)
            return [LAYOUTS[k].name, q.primary < 1e-6 ? 'balanced' : `${fmt(q.primary, 2)} × m r ω²`, q.secondary < 1e-6 ? 'balanced' : `${fmt(q.secondary, 2)} × m r ω²/n`]
          })}
        />
        <Note>
          This engine: primary {fmt((b.primary * unit) / 1000, 3)} kN, secondary {fmt((b.secondary * unit) / p.n / 1000, 3)} kN at most, before any couples. Moments between the cylinders are balanced separately.
        </Note>
      </Section>
      <Section title="Through a turn">
        <Chart data={[data.a, data.pr, data.se, data.side]} series={[{ label: 'Primary', color: '#6fb3e0', width: 2 }, { label: 'Secondary', color: '#e8794f', width: 2 }, { label: 'Sideways', color: '#9bd17a', width: 1.5 }]} xLabel="Crank angle (°)" yLabel="Force (kN)" height={160} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Primary, at crank speed', tex: 'F_p = m\\omega^2 r\\cos\\theta', sub: `\\text{peak} = ${num(p.m, 3)}(${num(w, 4)})^2(${num(p.r / 1000, 3)})`, result: `=${num(unit / 1000, 4)}\\ \\text{kN}` },
            { label: 'Secondary, at twice crank speed', tex: 'F_s = m\\omega^2 r\\dfrac{\\cos 2\\theta}{n}', result: `\\text{peak} = ${num(unit / p.n / 1000, 4)}\\ \\text{kN}` },
            { label: 'Equivalent rod: second point mass', tex: 'b = \\dfrac{k^2}{a} = \\dfrac{I}{m a}', sub: `=\\dfrac{${num(ex.I, 6)}}{${num(ex.m, 3)}(${num(ex.a, 3)})}`, result: `=${num(e.b, 4)}\\ \\text{mm}` },
            { label: 'The two masses', tex: 'm_1 + m_2 = m,\\quad m_1 a = m_2 b', result: `m_1 = ${num(e.m1, 4)},\\ m_2 = ${num(e.m2, 4)}\\ \\text{kg}` },
            { label: 'Rough split, by the ends of a 350 mm rod', tex: 'm_{\\text{rec}} = m\\dfrac{l-a}{l}', result: `=${num(rod.reciprocating, 4)}\\ \\text{kg}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>A single cylinder cannot be completely balanced: only part of the primary force can be traded for a sideways force.</li>
          <li>Secondary forces run at 2ω. Lanchester’s counter-rotating shafts at ω or 2ω can cancel them.</li>
          <li>Primary is balanced if Σcos θᵢ = Σsin θᵢ = 0; secondary if Σcos 2θᵢ = Σsin 2θᵢ = 0.</li>
          <li>A dynamically equivalent system: the same total mass, the same centre of gravity, and the same inertia.</li>
        </ExamList>
      </Section>
    </div>
  )
}
