import { Edges, Line } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { box, mat4, xform } from '@/geometry'
import { TestBench, createRun, useResetOnChange, useRunDriver } from '@/lab/run'
import { apparentLength, trueLength } from '@/physics/drawing'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'
import { Tag, type Pt } from '../../thermal/_shared/plant'

export const FLOOR = -0.8
const S = 0.01
const BACK = 1

interface Params {
  /** the block: width, height, depth, mm */
  dx: number
  dy: number
  dz: number
  /** how far the viewing plane has swung round: moved by the test */
  f: number
  set: (q: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { dx: 80, dy: 50, dz: 60, f: 1 }
export const useLine = create<Params>((set) => ({ ...DEFAULTS, set: (q) => set(q), reset: () => set(DEFAULTS) }))
const set = (q: Partial<Params>) => useLine.getState().set(q)

const lineRun = createRun()
const PROCEDURE = { steps: 10, moveSeconds: 0.5, dwellSeconds: 0.25 }
const angleOf = (p: Params, f = p.f) => trueLength(p.dx, p.dy, p.dz).bearing * f

export function Line3D() {
  const p = useLine()
  useResetOnChange(lineRun, JSON.stringify([p.dx, p.dy, p.dz]))
  useRunDriver(
    lineRun,
    PROCEDURE,
    (f) => {
      if (Math.abs(f - useLine.getState().f) >= 0.005 || f === 1) useLine.getState().set({ f })
    },
    (_step, f) => {
      const st = useLine.getState()
      const a = angleOf(st, f)
      lineRun.getState().log([a, apparentLength(st.dx, st.dy, st.dz, a)])
    },
  )
  useEffect(
    () =>
      lineRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle')) useLine.getState().set({ f: 1 })
        if ((r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useLine.getState().set({ f: 0 })
      }),
    [],
  )
  const w = p.dx * S
  const h = p.dy * S
  const d = p.dz * S
  const geo = useMemo(
    () => ({
      block: box(w, h, d),
      sheet: box(2.6, 1.7, 0.008),
      ground: xform(box(3, 0.01, 3), mat4.t(0, FLOOR + 0.005, 0)),
    }),
    [w, h, d],
  )
  const a = (angleOf(p) * Math.PI) / 180
  const A: Pt = [-w / 2, -h / 2, -d / 2]
  const B: Pt = [w / 2, h / 2, d / 2]
  // the viewing plane: vertical, turned a about the vertical axis and standing BACK behind the line
  const nx = -Math.sin(a)
  const nz = Math.cos(a)
  const onSheet = (q: Pt): Pt => {
    const dist = q[0] * nx + q[2] * nz + BACK
    return [q[0] - nx * dist, q[1], q[2] - nz * dist]
  }
  const A2 = onSheet(A)
  const B2 = onSheet(B)
  const seen = apparentLength(p.dx, p.dy, p.dz, angleOf(p))
  const t = trueLength(p.dx, p.dy, p.dz)
  const planA: Pt = [A[0], FLOOR + 0.012, A[2]]
  const planB: Pt = [B[0], FLOOR + 0.012, B[2]]
  const done = p.f >= 0.999
  return (
    <group>
      <Part id="ground" name="Horizontal plane" role="static" material="concrete" info={{ summary: 'The plan view is drawn on this.', role: 'Looked at from above, the line shows its plan length: shorter than the true length, unless the line is level.' }} cut={false}>
        <PartMesh geometry={geo.ground} />
      </Part>
      <Part id="block" name="Block" role="housing" material="glass" info={{ summary: 'Gives the line its three sizes.', role: 'The line runs corner to corner, so each principal view shows only a face diagonal. None of them shows the true length.' }}>
        <PartMesh geometry={geo.block} />
        <mesh geometry={geo.block}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color="#39424a" />
        </mesh>
      </Part>
      <Line points={[A, B]} color="#c0391f" lineWidth={4} />
      <Line points={[planA, planB]} color="#2d7a1f" lineWidth={3} />
      <Line points={[A, planA]} color="#2d7a1f" lineWidth={1} dashed dashSize={0.04} gapSize={0.03} />
      <Line points={[B, planB]} color="#2d7a1f" lineWidth={1} dashed dashSize={0.04} gapSize={0.03} />
      <group position={[-nx * BACK, 0, -nz * BACK]} rotation={[0, -a, 0]}>
        <Part id="sheet" name="Viewing plane" role="moving" material="glass" info={{ summary: 'An auxiliary plane, which can turn about the vertical.', role: 'Parallel to the plan view of the line, it shows the true length. This is the first auxiliary elevation, projected from the plan.' }} cut={false}>
          <PartMesh geometry={geo.sheet} />
        </Part>
      </group>
      <Line points={[A2, B2]} color={done ? '#c0391f' : '#2267b5'} lineWidth={4} />
      <Line points={[A, A2]} color="#2267b5" lineWidth={1} dashed dashSize={0.04} gapSize={0.03} />
      <Line points={[B, B2]} color="#2267b5" lineWidth={1} dashed dashSize={0.04} gapSize={0.03} />
      <Tag at={[(A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2 + 0.16, (A2[2] + B2[2]) / 2]} tone={done ? '#c0391f' : '#2267b5'}>{`${seen.toFixed(1)} mm${done ? ', true length' : ''}`}</Tag>
      <Tag at={[0, FLOOR + 0.1, d / 2 + 0.3]} tone="#2d7a1f">{`plan ${t.plan.toFixed(1)} mm`}</Tag>
      <PartLabel partId="block" at={[w / 2 + 0.1, h / 2 + 0.1, 0]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'block', label: 'Corner to corner', note: 'An 80 × 50 × 60 block. Each principal view shows a face diagonal, and the true length is longer than all three.', apply: () => set({ ...DEFAULTS }) },
  { id: 'flat', label: 'A nearly level line', note: 'With little height, the plan is almost the true length already.', apply: () => set({ ...DEFAULTS, dy: 10 }) },
  { id: 'tall', label: 'A steep line', note: 'With a lot of height, the plan is short and the elevation does most of the work.', apply: () => set({ ...DEFAULTS, dx: 30, dy: 100, dz: 30 }) },
]

/** First-angle views laid out as on a drawing: elevation above plan, auxiliary elevation projected from the plan. */
function Sheet({ p }: { p: Params }) {
  const k = 0.75
  const t = trueLength(p.dx, p.dy, p.dz)
  const b = (t.bearing * Math.PI) / 180
  const ox = 14
  const eY = 12 + p.dy * k
  const pY = eY + 16
  const X = (x: number) => ox + x * k
  const planPts = (x: number, z: number): [number, number] => [X(x), pY + (p.dz - z) * k]
  const [ax, ay] = planPts(0, 0)
  const [bx, by] = planPts(p.dx, p.dz)
  // the auxiliary sits off the plan line, square to it, with the block's height as the offset
  const ux = Math.cos(b)
  const uy = -Math.sin(b)
  const nx = -uy
  const ny = ux
  const off = 26
  const a0: [number, number] = [ax + nx * off, ay + ny * off]
  const a1: [number, number] = [bx + nx * (off + p.dy * k), by + ny * (off + p.dy * k)]
  const W = Math.max(ox + p.dx * k, a1[0], a0[0]) + 16
  const H = Math.max(pY + p.dz * k, a1[1], a0[1]) + 16
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" style={{ maxHeight: 240 }} role="img" aria-label="Elevation, plan and auxiliary view of the line">
      <rect x={ox} y={12} width={p.dx * k} height={p.dy * k} fill="none" stroke="currentColor" opacity={0.5} />
      <line x1={ox} y1={eY} x2={ox + p.dx * k} y2={12} stroke="#2267b5" strokeWidth={1.5} />
      <rect x={ox} y={pY} width={p.dx * k} height={p.dz * k} fill="none" stroke="currentColor" opacity={0.5} />
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#2d7a1f" strokeWidth={1.5} />
      <line x1={ax} y1={ay} x2={a0[0]} y2={a0[1]} stroke="currentColor" strokeDasharray="2 2" opacity={0.5} />
      <line x1={bx} y1={by} x2={a1[0]} y2={a1[1]} stroke="currentColor" strokeDasharray="2 2" opacity={0.5} />
      <line x1={a0[0]} y1={a0[1]} x2={a1[0]} y2={a1[1]} stroke="#c0391f" strokeWidth={2} />
      <text x={ox} y={9} fontSize={7} fill="currentColor">Elevation</text>
      <text x={ox} y={pY - 3} fontSize={7} fill="currentColor">Plan</text>
      <text x={(a0[0] + a1[0]) / 2 + 4} y={(a0[1] + a1[1]) / 2 + 3} fontSize={7} fill="#c0391f">True length</text>
    </svg>
  )
}

/** The bench test: swing the viewing plane round until it is parallel to the plan view. */
function LineTest() {
  const rows = lineRun((s) => s.rows)
  return (
    <TestBench run={lineRun} steps={PROCEDURE.steps} title="The test: swing the viewing plane" head={['Plane turned (°)', 'Length seen (mm)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 4)]}>
      {rows.length > 1 ? <Chart data={[rows.map((r) => r[0]), rows.map((r) => r[1])]} series={[{ label: 'Seen', color: '#e8794f', width: 2 }]} xLabel="Plane turned (°)" yLabel="Length seen (mm)" height={110} /> : null}
    </TestBench>
  )
}

export function LinePanel() {
  const p = useLine()
  const [preset, setPreset] = useState<string | null>('block')
  const t = trueLength(p.dx, p.dy, p.dz)
  return (
    <div>
      <LineTest />
      <Section title="The views">
        <Sheet p={p} />
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          <Readout label="Elevation" value={fmt(t.front, 4)} unit="mm" />
          <Readout label="Plan" value={fmt(t.plan, 4)} unit="mm" />
          <Readout label="End view" value={fmt(t.end, 4)} unit="mm" />
          <Readout label="True length" value={fmt(t.length, 4)} unit="mm" tone="accent" />
          <Readout label="To horizontal" value={fmt(t.toHorizontal, 3)} unit="°" tone="info" />
          <Readout label="To frontal" value={fmt(t.toFrontal, 3)} unit="°" tone="info" />
        </div>
      </Section>
      <Section title="The block">
        <Slider label="Width" value={p.dx} min={10} max={120} step={1} unit="mm" onChange={(dx) => set({ dx })} />
        <Slider label="Height" value={p.dy} min={10} max={120} step={1} unit="mm" onChange={(dy) => set({ dy })} />
        <Slider label="Depth" value={p.dz} min={10} max={120} step={1} unit="mm" onChange={(dz) => set({ dz })} />
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Plan length', tex: 'L_p = \\sqrt{x^2 + z^2}', sub: `=\\sqrt{${n(p.dx, 3)}^2 + ${n(p.dz, 3)}^2}`, result: `=${n(t.plan, 4)}\\ \\text{mm}` },
            { label: 'Right-angled triangle: plan and height', tex: 'L = \\sqrt{L_p^2 + y^2}', sub: `=\\sqrt{${n(t.plan, 4)}^2 + ${n(p.dy, 3)}^2}`, result: `=${n(t.length, 4)}\\ \\text{mm}` },
            { label: 'Slope to the horizontal', tex: '\\sin\\theta = y/L', result: `\\theta = ${n(t.toHorizontal, 3)}^\\circ` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>A line shows its true length only on a plane parallel to it. View it square on.</li>
          <li>An auxiliary elevation is projected from a plan, and an auxiliary plan from an elevation.</li>
          <li>Heights in an auxiliary elevation are measured from the reference line, and transferred from the other elevation.</li>
          <li>The true length is the hypotenuse: one side is the plan length, the other the difference in height.</li>
        </ExamList>
      </Section>
    </div>
  )
}
