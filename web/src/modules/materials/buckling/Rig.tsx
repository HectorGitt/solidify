import { useEffect, useMemo, useRef, useState } from 'react'
import { TestBench, createRun, instrument, useResetOnChange, useRunDriver } from '@/lab/run'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { END_FACTORS, circleArea, eulerLimitSlenderness, eulerLoad, secondMomentCircle, secondMomentTube, tubeArea, type ColumnEnds } from '@/physics/strength'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'

export const FLOOR = -0.8
const H = 1.3
const TOP = FLOOR + 0.1 + H

interface Params {
  ends: ColumnEnds
  /** m, mm, mm */
  L: number
  D: number
  d: number
  hollow: boolean
  /** GPa, MPa, as a percentage of load */
  E: number
  sigmaP: number
  loadPct: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { ends: 'pinned-pinned' as ColumnEnds, L: 2.5, D: 50, d: 30, hollow: false, E: 200, sigmaP: 210, loadPct: 60 }
export const useColumn = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useColumn.getState().set(p)

const columnRun = createRun()
const PROCEDURE = { steps: 12, moveSeconds: 0.5, dwellSeconds: 0.25 }
/** every real column starts slightly out of straight: about one part in a thousand */
const crookedness = (L: number) => L / 1000
/** the bow under load: the initial crookedness, amplified as the load nears the critical load */
export const bowAt = (L: number, ratio: number) => (crookedness(L) * ratio) / (1 - ratio)
/** Southwell: plot δ against δ/P, and the slope is the critical load, without ever breaking the column */
export function southwell(P: number[], d: number[]) {
  const x = d.map((v, i) => v / P[i])
  const mx = x.reduce((a, b) => a + b, 0) / x.length
  const my = d.reduce((a, b) => a + b, 0) / d.length
  const top = x.reduce((s, v, i) => s + (v - mx) * (d[i] - my), 0)
  const bot = x.reduce((s, v) => s + (v - mx) ** 2, 0)
  return bot > 0 ? top / bot : 0
}

const analyse = (p: Params) => {
  const D = p.D / 1000
  const d = p.hollow ? p.d / 1000 : 0
  const A = p.hollow ? tubeArea(D, d) : circleArea(D)
  const I = p.hollow ? secondMomentTube(D, d) : secondMomentCircle(D)
  const k = Math.sqrt(I / A)
  const Le = END_FACTORS[p.ends] * p.L
  const lambda = Le / k
  const Pe = eulerLoad(p.E * 1e9, I, p.L, p.ends)
  const Pc = p.sigmaP * 1e6 * A
  const valid = lambda >= eulerLimitSlenderness(p.E * 1e9, p.sigmaP * 1e6)
  return { A, I, k, Le, lambda, Pe, Pc, valid, Pcr: Math.min(Pe, Pc), limit: eulerLimitSlenderness(p.E * 1e9, p.sigmaP * 1e6) }
}

/** The bowed shape of the first mode, as a sideways shift at height fraction u. */
export function modeShape(ends: ColumnEnds, u: number) {
  if (ends === 'pinned-pinned') return Math.sin(Math.PI * u)
  if (ends === 'fixed-free') return 1 - Math.cos((Math.PI * u) / 2)
  if (ends === 'fixed-fixed') return 0.5 * (1 - Math.cos(2 * Math.PI * u))
  // fixed at the base, pinned at the top
  // y(0) = y′(0) = y(1) = y″(1) = 0, with k = tan k: y = sin ku − k cos ku − k u + k, scaled to a peak of 1
  const k = 4.4934
  return (Math.sin(k * u) - k * Math.cos(k * u) - k * u + k) / 6.29
}

function columnGeometry(ends: ColumnEnds, radius: number, bow: number, N = 48) {
  const seg = 18
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= N; i++) {
    const u = i / N
    const y = FLOOR + 0.1 + u * H
    const sx = bow * modeShape(ends, u)
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * 2 * Math.PI
      pos.push(sx + radius * Math.cos(a), y, radius * Math.sin(a))
    }
  }
  const w = seg + 1
  for (let i = 0; i < N; i++)
    for (let j = 0; j < seg; j++) {
      const q = i * w + j
      idx.push(q, q + w, q + 1, q + 1, q + w, q + w + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export function Column3D() {
  const p = useColumn()
  const a = useMemo(() => analyse(p), [p])
  useResetOnChange(columnRun, JSON.stringify([p.ends, p.L, p.D, p.d, p.hollow, p.E, p.sigmaP]))
  useRunDriver(
    columnRun,
    PROCEDURE,
    (f) => {
      if (Math.abs(f * 100 - useColumn.getState().loadPct) >= 1 || f === 1) useColumn.getState().set({ loadPct: f * 100 })
    },
    (step, f) => {
      const st = useColumn.getState()
      const q = analyse(st)
      const load = f * q.Pcr
      if (f < 1) {
        columnRun.getState().log([load / 1000, instrument(bowAt(st.L, f) * 1000, 0.01, step)])
        return
      }
      columnRun.getState().fail(q.valid ? `It buckled at ${(load / 1000).toFixed(1)} kN: the bow ran away, far below the ${(q.Pc / 1000).toFixed(0)} kN that would crush it.` : `Too short to buckle: it reached the material’s limit and crushed at ${(load / 1000).toFixed(1)} kN.`)
    },
  )
  useEffect(
    () =>
      columnRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle')) useColumn.getState().set({ loadPct: DEFAULTS.loadPct })
        if ((r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useColumn.getState().set({ loadPct: 0 })
      }),
    [],
  )
  const ratio = (p.loadPct / 100) * 1
  const load = ratio * a.Pcr
  // the bow grows as the load nears the critical load: amplification 1/(1 − P/Pcr), and it buckles beyond
  const buckled = ratio >= 1
  const target = buckled ? 0.2 : Math.min(0.2, (0.012 * ratio) / (1 - ratio))
  const bow = useRef(0)
  const ref = useRef<THREE.Mesh>(null)
  const head = useRef<THREE.Group>(null)
  const radius = Math.min(0.05, Math.max(0.014, 0.03 * (p.D / 50)))
  const last = useRef(-1)
  const mat = useMemo(() => createDynamicCutMaterial({ color: '#9aa3ab', cap: '#c8d0d6', hatch: 'steel', metalness: 0.6, roughness: 0.4 }).material, [])
  const frame = useMemo(
    () => ({
      base: xform(box(1.1, 0.1, 0.6), mat4.t(0, FLOOR + 0.05, 0)),
      posts: merge(...[-0.5, 0.5].map((x) => xform(cylinder(0.03, H + 0.42, 22), mat4.t(x, FLOOR + 0.1 + (H + 0.42) / 2, 0)))),
      top: xform(box(1.15, 0.1, 0.3), mat4.t(0, TOP + 0.34, 0)),
      ram: xform(cylinder(0.05, 0.28, 26), mat4.t(0, TOP + 0.17, 0)),
      plate: xform(box(0.28, 0.03, 0.2), mat4.t(0, TOP + 0.015, 0)),
      foot: xform(box(0.28, 0.03, 0.2), mat4.t(0, FLOOR + 0.115, 0)),
    }),
    [],
  )
  const start = useMemo(() => columnGeometry(p.ends, radius, 0), [p.ends, radius])
  useSimFrame(() => {
    bow.current += (target - bow.current) * 0.05
    if (ref.current && Math.abs(bow.current - last.current) > 0.0005) {
      last.current = bow.current
      ref.current.geometry.dispose()
      ref.current.geometry = columnGeometry(p.ends, radius, bow.current)
    }
    // at the free end of a flagpole column, the head goes with it
    if (head.current) head.current.position.x = p.ends === 'fixed-free' ? bow.current : 0
  })
  void load
  return (
    <group>
      <Part id="frame" name="Loading frame" role="static" material="paintBlue" info={{ summary: 'A stiff press frame.', role: 'Applies a load straight down the column’s axis, with the ends held in the chosen way.' }} cut={false} explode={[0, 0, -0.3]}>
        <PartMesh geometry={frame.base} />
        <PartMesh geometry={frame.posts} material="chrome" />
        <PartMesh geometry={frame.top} />
        <PartMesh geometry={frame.ram} material="steelDark" />
      </Part>
      <Part id="column" name="Column" role="moving" material="steel" info={{ summary: 'A slender strut.', role: 'A long thin one fails by bending sideways, at a load far below what would crush it.' }} cut>
        <mesh ref={ref} geometry={start} material={mat} castShadow />
      </Part>
      <group ref={head}>
        <Part id="ends" name="End fittings" role="static" material="steelDark" info={{ summary: 'Set how the ends are held.', role: 'A fixed end holds its direction as well as its place. Effective length Le is the distance between points of zero moment.' }}>
          <PartMesh geometry={frame.plate} />
          <PartMesh geometry={frame.foot} />
        </Part>
      </group>
      <PartLabel partId="column" at={[0.08, FLOOR + 0.1 + H / 2, 0.05]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'q5', label: 'Ø50 steel, fixed ends', note: 'Proportional limit 210 MPa, E = 200 GPa. Euler is valid down to L = 2.42 m, where the load is 412 kN.', apply: () => set({ ...DEFAULTS, ends: 'fixed-fixed', L: 2.424, D: 50, hollow: false }) },
  { id: 'cast', label: 'Cast iron tube, 6 m', note: 'Ø150 outer, 20 mm wall, fixed at both ends, E = 80 GPa: Euler gives about 1549 kN.', apply: () => set({ ...DEFAULTS, ends: 'fixed-fixed', L: 6, D: 150, d: 110, hollow: true, E: 80, sigmaP: 550 }) },
  { id: 'free', label: 'Flagpole: fixed and free', note: 'The weakest arrangement: effective length twice the real one, so a quarter of the pinned load.', apply: () => set({ ...DEFAULTS, ends: 'fixed-free' }) },
]

/** The bench test: load it in steps, reading the sideways bow at mid-height. */
function ColumnTest() {
  const p = useColumn()
  const a = analyse(p)
  const rows = columnRun((s) => s.rows)
  const status = columnRun((s) => s.status)
  const loads = rows.map((r) => r[0])
  const bows = rows.map((r) => r[1])
  const fit = southwell(loads, bows)
  return (
    <TestBench run={columnRun} steps={PROCEDURE.steps} title="The test: load it until it fails" head={['Load (kN)', 'Bow (mm)']} format={(r) => [fmt(r[0], 4), fmt(r[1], 3)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[[0, ...bows], [0, ...loads]]} series={[{ label: 'Load', color: '#e8794f', width: 2 }]} xLabel="Bow at mid-height (mm)" yLabel="Load (kN)" height={125} />
          {status === 'failed' && a.valid && fit > 0 ? (
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <Readout label="Load from Southwell" value={fmt(fit, 4)} unit="kN" tone="accent" />
              <Readout label="Euler’s load" value={fmt(a.Pe / 1000, 4)} unit="kN" />
            </div>
          ) : null}
          <Note>The bow barely shows at first, then runs away near the limit. Plotting bow against bow ÷ load gives the critical load as a slope, which is how it is found without breaking anything.</Note>
        </>
      ) : null}
    </TestBench>
  )
}

export function ColumnPanel() {
  const p = useColumn()
  const [preset, setPreset] = useState<string | null>(null)
  const a = analyse(p)
  const P = (p.loadPct / 100) * a.Pcr
  const curve = useMemo(() => {
    const L = Array.from({ length: 150 }, (_, i) => 0.2 + (i / 149) * 9.8)
    const f = (x: number) => Math.min(eulerLoad(p.E * 1e9, a.I, x, p.ends), a.Pc) / 1000
    return { L, P: L.map(f), euler: L.map((x) => Math.min(eulerLoad(p.E * 1e9, a.I, x, p.ends) / 1000, a.Pc * 2 / 1000)) }
  }, [p.E, p.ends, a.I, a.Pc])
  return (
    <div>
      <ColumnTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Load" value={fmt(P / 1000, 4)} unit="kN" />
          <Readout label="Buckling load" value={fmt(a.Pe / 1000, 4)} unit="kN" tone="warn" />
          <Readout label="Crushing load" value={fmt(a.Pc / 1000, 4)} unit="kN" />
          <Readout label="Slenderness" value={fmt(a.lambda, 3)} tone="accent" />
          <Readout label="Euler valid from" value={fmt(a.limit, 3)} />
          <Readout label="Fails by" value={a.valid ? 'buckling' : 'crushing'} tone={a.valid ? 'warn' : 'info'} />
        </div>
      </Section>
      <Section title="The column">
        <Segmented<ColumnEnds>
          value={p.ends}
          onChange={(ends) => set({ ends })}
          options={[
            { value: 'pinned-pinned', label: 'Pinned' },
            { value: 'fixed-fixed', label: 'Fixed' },
            { value: 'fixed-pinned', label: 'Fix-pin' },
            { value: 'fixed-free', label: 'Fix-free' },
          ]}
        />
        {columnRun.getState().status === 'idle' ? <Slider label="Load, share of critical" value={p.loadPct} min={0} max={100} step={1} unit="%" onChange={(loadPct) => set({ loadPct })} /> : null}
        <Slider label="Length" value={p.L} min={0.2} max={10} step={0.01} unit="m" onChange={(L) => set({ L })} />
        <Slider label="Outer diameter" value={p.D} min={10} max={300} step={1} unit="mm" onChange={(D) => set({ D, d: Math.min(p.d, D - 4) })} />
        <Toggle label="Hollow" checked={p.hollow} onChange={(hollow) => set({ hollow })} />
        {p.hollow ? <Slider label="Inner diameter" value={p.d} min={2} max={p.D - 4} step={1} unit="mm" onChange={(d) => set({ d })} /> : null}
        <Slider label="Young’s modulus" value={p.E} min={20} max={220} step={1} unit="GPa" onChange={(E) => set({ E })} />
        <Slider label="Proportional limit" value={p.sigmaP} min={50} max={600} step={10} unit="MPa" onChange={(sigmaP) => set({ sigmaP })} />
        <Note>The sideways bow is drawn exaggerated.</Note>
      </Section>
      <Section title="Worked set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Strength against length">
        <Chart data={[curve.L, curve.P]} series={[{ label: 'Failure load', color: '#e8794f', width: 2 }]} xLabel="Length (m)" yLabel="Load (kN)" marker={() => [p.L, a.Pcr / 1000]} height={150} />
        <Note>Short columns crush, at a load set by the material. Long ones buckle, at a load that falls with the square of the length.</Note>
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Effective length', tex: 'L_e = c L', sub: `=${n(END_FACTORS[p.ends], 3)}(${n(p.L, 3)})`, result: `=${n(a.Le, 3)}\\ \\text{m}` },
            { label: 'Radius of gyration', tex: 'k = \\sqrt{I/A}', result: `=${n(a.k * 1000, 3)}\\ \\text{mm}` },
            { label: 'Slenderness ratio', tex: '\\lambda = \\dfrac{L_e}{k}', result: `=${n(a.lambda, 3)}` },
            { label: 'Euler’s load', tex: 'P_e = \\dfrac{\\pi^2 E I}{L_e^2}', sub: `=\\dfrac{\\pi^2(${n(p.E, 3)}\\times10^9)(${n(a.I * 1e12, 4)}\\times10^{-12})}{(${n(a.Le, 3)})^2}`, result: `=${n(a.Pe / 1000, 4)}\\ \\text{kN}` },
            { label: 'Shortest length Euler applies to', tex: '\\lambda_{\\min} = \\pi\\sqrt{E/\\sigma_p}', result: `=${n(a.limit, 3)}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Effective length: pinned both ends, L; fixed both, L/2; fixed and pinned, 0.7 L; fixed and free, 2L.</li>
          <li>Euler assumes a straight, slender, elastic, axially loaded column. Below λ_min it overestimates: use Rankine.</li>
          <li>It buckles about the axis with the smallest I, so a tube is better than a solid bar of the same area.</li>
        </ExamList>
      </Section>
    </div>
  )
}
