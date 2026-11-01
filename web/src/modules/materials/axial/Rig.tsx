import { useEffect, useMemo, useRef, useState } from 'react'
import { TestBench, createRun, instrument, useAutoRun, useRunDriver } from '@/lab/run'
import * as THREE from 'three'
import { create } from 'zustand'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { circleArea, compositeBar, railGapAt, railStressAt, railsTouchAt, tubeArea } from '@/physics/strength'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'
import { ForceArrow } from '../../elements/_shared/Arrow'

export const FLOOR = -0.42

type Mode = 'rails' | 'composite'

interface Params {
  mode: Mode
  /** rails */
  T: number
  T0: number
  gap: number
  railL: number
  alpha: number
  Er: number
  /** composite, mm, GPa, kN */
  dIn: number
  dOut: number
  EIn: number
  EOut: number
  P: number
  L: number
  /** how far the test has got: moved by the test */
  f: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { mode: 'rails' as Mode, T: 45, T0: 15, gap: 3.2, railL: 18, alpha: 11.7, Er: 207, dIn: 50, dOut: 75, EIn: 200, EOut: 97, P: 300, L: 254, f: 0 }
export const useAxial = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useAxial.getState().set(p)

const axialRun = createRun()
const PROCEDURE = { steps: 10, moveSeconds: 0.55, dwellSeconds: 0.25 }
/** the temperature the test has reached, from the laying temperature to the one set */
const tempNow = (p: Params, f = p.f) => p.T0 + (p.T - p.T0) * f
const rail = (p: Params) => ({ alpha: p.alpha * 1e-6, L: p.railL, gap: p.gap / 1000, T0: p.T0, E: p.Er * 1e9 })

function Rails() {
  const p = useAxial()
  const r = rail(p)
  const T = tempNow(p)
  const stress = railStressAt(r, T)
  const gap = railGapAt(r, T)
  const DRAWN = 0.62
  // the gap is drawn far larger than life, and its ends meet exactly when the real ones do
  const gapDrawn = (gap / Math.max(r.gap * 3, 1e-6)) * 0.22
  const heat = Math.max(0, Math.min(1, (T + 10) / 60))
  const colour = useMemo(() => (heat < 0.5 ? new THREE.Color('#2f6fd0').lerp(new THREE.Color('#9aa3ab'), heat * 2) : new THREE.Color('#9aa3ab').lerp(new THREE.Color('#d0452c'), heat * 2 - 1)), [heat])
  const buckle = stress / 1e6
  const profile = useMemo(() => {
    // a rail section along +x
    return merge(xform(box(DRAWN, 0.022, 0.09), mat4.t(0, -0.05, 0)), xform(box(DRAWN, 0.07, 0.022), mat4.t(0, -0.006, 0)), xform(box(DRAWN, 0.03, 0.06), mat4.t(0, 0.044, 0)))
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: colour, metalness: 0.5, roughness: 0.45 }), [colour])
  const bed = useMemo(() => merge(xform(box(2.0, 0.03, 0.3), mat4.t(0, FLOOR + 0.17, 0)), ...[-0.85, -0.5, -0.17, 0.17, 0.5, 0.85].map((x) => xform(box(0.09, 0.08, 0.5), mat4.t(x, FLOOR + 0.11, 0))), xform(box(2.2, 0.04, 0.7), mat4.t(0, FLOOR + 0.02, 0))), [])
  const y = FLOOR + 0.24
  const offset = DRAWN / 2 + gapDrawn / 2
  return (
    <group>
      <Part id="bed" name="Sleepers and ballast" role="static" material="concrete" info={{ summary: 'Hold the rails down.', role: 'They stop the rails buckling sideways when they are in compression.' }} cut={false}>
        <PartMesh geometry={bed} />
      </Part>
      <group position={[-offset, y, 0]}>
        <Part id="rail-a" name="Rail" role="static" material="steel" info={{ summary: 'Laid with a gap between the lengths.', role: 'Free to grow until the gap closes. After that, the rest of its growth is stopped, which is what makes the stress.' }} cut={false}>
          <PartMesh geometry={profile} customMaterial={mat} />
        </Part>
      </group>
      <group position={[offset, y, 0]}>
        <Part id="rail-b" name="Next rail" role="static" material="steel" info={{ summary: 'The next length of rail.', role: 'It grows too: each rail takes up its own share of the gaps, one per rail.' }} cut={false}>
          <PartMesh geometry={profile} customMaterial={mat} />
        </Part>
      </group>
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (offset + DRAWN + 0.002), y, 0]}>
          <PartMesh geometry={profile} customMaterial={mat} />
        </group>
      ))}
      {buckle > 0 ? (
        <>
          <ForceArrow color="#d0452c" spec={() => ({ origin: new THREE.Vector3(-0.9, y + 0.13, 0), dir: new THREE.Vector3(1, 0, 0), length: Math.min(0.5, 0.1 + buckle * 0.006), label: `${buckle.toFixed(1)} MPa`, visible: true })} />
          <ForceArrow color="#d0452c" spec={() => ({ origin: new THREE.Vector3(0.9, y + 0.13, 0), dir: new THREE.Vector3(-1, 0, 0), length: Math.min(0.5, 0.1 + buckle * 0.006), visible: true })} />
        </>
      ) : null}
      <PartLabel partId="rail-a" at={[-0.5, y + 0.1, 0.05]} />
    </group>
  )
}

function CompositeBar() {
  const p = useAxial()
  const k = 0.0055
  const g = useMemo(
    () => ({
      core: xform(cylinder((p.dIn / 2) * k, p.L * 0.0028, 40), mat4.t(0, 0, 0)),
      tube: tube((p.dOut / 2) * k, (p.dIn / 2) * k + 0.001, p.L * 0.0028, 56),
      plate: box(0.68, 0.05, 0.68),
      foot: merge(xform(box(0.7, 0.04, 0.7), mat4.t(0, FLOOR + 0.02, 0))),
      post: cylinder(0.05, 0.1, 28),
    }),
    [p.dIn, p.dOut, p.L],
  )
  const h = p.L * 0.0028
  const bottom = -h / 2 - 0.025
  // the plates move apart, far more than life, as the load comes on
  const c = compositeBar({ A1: circleArea(p.dIn / 1000), E1: p.EIn * 1e9, A2: tubeArea(p.dOut / 1000, p.dIn / 1000), E2: p.EOut * 1e9 }, p.P * p.f * 1000, p.L / 1000)
  const lift = Math.min(0.03, c.delta * 60)
  const offset = useRef(0)
  offset.current = lift
  return (
    <group>
      <Part id="core" name="Inner rod" role="moving" material="steel" info={{ summary: 'Steel, in the example.', role: 'The stiffer material takes a larger stress, though it stretches just the same.' }} explode={[0, 0, 0.5]}>
        <PartMesh geometry={g.core} />
      </Part>
      <Part id="tube" name="Outer tube" role="housing" material="brass" info={{ summary: 'Brass, in the example.', role: 'Same strain as the rod, so its stress is lower in the ratio of the moduli.' }} explode={[0, 0, -0.5]}>
        <PartMesh geometry={g.tube} />
      </Part>
      <group position={[0, h / 2 + 0.025 + lift, 0]}>
        <Part id="plate-top" name="Rigid plate" role="moving" material="paintGrey" info={{ summary: 'Joins the two parts.', role: 'Being rigid, it forces both to stretch by the same amount: this is the compatibility condition.' }} cut={false} explode={[0, 0.2, 0]}>
          <PartMesh geometry={g.plate} />
        </Part>
      </group>
      <group position={[0, bottom, 0]}>
        <Part id="plate-bottom" name="Lower plate" role="static" material="paintGrey" info={{ summary: 'The other rigid plate.', role: 'Carries the same pull as the top one.' }} cut={false} explode={[0, -0.2, 0]}>
          <PartMesh geometry={g.plate} />
        </Part>
      </group>
      <ForceArrow color="#d0631c" spec={() => ({ origin: new THREE.Vector3(0, h / 2 + 0.05 + offset.current, 0), dir: new THREE.Vector3(0, 1, 0), length: 0.03 + Math.min(0.2, p.P * p.f * 0.0006), label: `${(p.P * p.f).toFixed(0)} kN`, visible: true })} radius={0.012} />
      <ForceArrow color="#d0631c" spec={() => ({ origin: new THREE.Vector3(0, bottom - 0.025, 0), dir: new THREE.Vector3(0, -1, 0), length: 0.03 + Math.min(0.2, p.P * p.f * 0.0006), visible: true })} radius={0.012} />
      <PartLabel partId="tube" at={[(p.dOut / 2) * k + 0.05, 0.05, 0.05]} />
    </group>
  )
}

export function Axial3D() {
  const mode = useAxial((s) => s.mode)
  const p = useAxial()
  useAutoRun(axialRun, JSON.stringify([p.mode, p.T, p.T0, p.gap, p.railL, p.alpha, p.Er, p.dIn, p.dOut, p.EIn, p.EOut, p.P, p.L]))
  useRunDriver(
    axialRun,
    PROCEDURE,
    (f) => {
      if (Math.abs(f - useAxial.getState().f) >= 0.01 || f === 1) useAxial.getState().set({ f })
    },
    (step, f) => {
      const st = useAxial.getState()
      if (st.mode === 'rails') {
        const r = rail(st)
        const T = tempNow(st, f)
        axialRun.getState().log([T, instrument(railGapAt(r, T) * 1000, 0.01, step), instrument(railStressAt(r, T) / 1e6, 0.015, step + 30)])
      } else {
        const c = compositeBar({ A1: circleArea(st.dIn / 1000), E1: st.EIn * 1e9, A2: tubeArea(st.dOut / 1000, st.dIn / 1000), E2: st.EOut * 1e9 }, st.P * f * 1000, st.L / 1000)
        axialRun.getState().log([st.P * f, instrument(c.s1 / 1e6, 0.012, step), instrument(c.s2 / 1e6, 0.012, step + 30), instrument(c.delta * 1000, 0.01, step + 60)])
      }
    },
  )
  useEffect(
    () =>
      axialRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle') || (r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useAxial.getState().set({ f: 0 })
      }),
    [],
  )
  return mode === 'rails' ? <Rails /> : <CompositeBar />
}

const PRESETS: Preset[] = [
  { id: 'rails', label: 'Crane rails', note: '18 m rails laid 3.2 mm apart at 15 °C: they touch at 30.2 °C; the gap is 8.47 mm at −10 °C; at 45 °C the stress is 35.9 MPa in compression.', apply: () => set({ ...DEFAULTS, T: 45 }) },
  { id: 'cold', label: 'Rails at −10 °C', note: 'The same rails on a cold night: the gaps open wider, so the fishplates must allow for this.', apply: () => set({ ...DEFAULTS, T: -10 }) },
  { id: 'pole', label: 'Flag pole', note: 'A 5 m aluminium pole, 20 °C to −5 °C, with α = 23×10⁻⁶ /°C, shortens by 2.875 mm. Nothing holds it, so there is no stress at all.', apply: () => set({ ...DEFAULTS, railL: 5, alpha: 23, T0: 20, T: -5, Er: 70, gap: 50 }) },
  { id: 'composite', label: 'Steel rod in brass tube', note: 'Ø50 steel in a 50/75 brass tube, 254 mm long, 300 kN: 95.1 MPa in the steel, 46.1 MPa in the brass, and 0.121 mm of stretch.', apply: () => set({ ...DEFAULTS, mode: 'composite' }) },
]

/** The bench test: warm the rails, or pull the bar, in steps. */
function AxialTest() {
  const mode = useAxial((s) => s.mode)
  const rows = axialRun((s) => s.rows)
  const rails = mode === 'rails'
  return (
    <TestBench
      run={axialRun}
      steps={PROCEDURE.steps}
      title={rails ? 'The test: warm the rails' : 'The test: pull the bar'}
      head={rails ? ['Temp (°C)', 'Gap (mm)', 'Stress (MPa)'] : ['Pull (kN)', 'Rod (MPa)', 'Tube (MPa)', 'Stretch (mm)']}
      format={(r) => (rails ? [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3)] : [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3), fmt(r[3], 3)])}
    >
      {rows.length > 1 && rows[0].length === (rails ? 3 : 4) ? (
        rails ? (
          <Chart data={[rows.map((r) => r[0]), rows.map((r) => r[1]), rows.map((r) => r[2])]} series={[{ label: 'Gap (mm)', color: '#6fb3e0', width: 2 }, { label: 'Stress (MPa)', color: '#e8794f', width: 2 }]} xLabel="Temperature (°C)" yLabel="mm, MPa" height={120} />
        ) : (
          <Chart data={[rows.map((r) => r[0]), rows.map((r) => r[1]), rows.map((r) => r[2])]} series={[{ label: 'Rod', color: '#e8794f', width: 2 }, { label: 'Tube', color: '#6fb3e0', width: 2 }]} xLabel="Pull (kN)" yLabel="Stress (MPa)" height={120} />
        )
      ) : null}
    </TestBench>
  )
}

export function AxialPanel() {
  const p = useAxial()
  const [preset, setPreset] = useState<string | null>(null)
  const r = rail(p)
  const curve = useMemo(() => {
    const T = Array.from({ length: 141 }, (_, i) => -40 + i * 0.75 + 0)
    return { T, g: T.map((t) => railGapAt(r, t) * 1000), s: T.map((t) => railStressAt(r, t) / 1e6) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.alpha, p.railL, p.gap, p.T0, p.Er])
  const c = compositeBar({ A1: circleArea(p.dIn / 1000), E1: p.EIn * 1e9, A2: tubeArea(p.dOut / 1000, p.dIn / 1000), E2: p.EOut * 1e9 }, p.P * 1000, p.L / 1000)
  const touch = railsTouchAt(r)
  return (
    <div>
      <AxialTest />
      {p.mode === 'rails' ? (
        <Section title="Live">
          <div className="grid grid-cols-3 gap-1.5">
            <Readout label="Temperature" value={fmt(tempNow(p), 3)} unit="°C" />
            <Readout label="Gap" value={fmt(railGapAt(r, tempNow(p)) * 1000, 3)} unit="mm" tone="accent" />
            <Readout label="Touch at" value={fmt(touch, 3)} unit="°C" />
            <Readout label="Stress" value={fmt(railStressAt(r, tempNow(p)) / 1e6, 3)} unit="MPa" tone="warn" />
          </div>
        </Section>
      ) : (
        <Section title="Live">
          <div className="grid grid-cols-3 gap-1.5">
            <Readout label="Inner stress" value={fmt(c.s1 / 1e6, 4)} unit="MPa" tone="warn" />
            <Readout label="Outer stress" value={fmt(c.s2 / 1e6, 4)} unit="MPa" tone="info" />
            <Readout label="Stretch" value={fmt(c.delta * 1000, 3)} unit="mm" tone="accent" />
            <Readout label="Inner load" value={fmt(c.P1 / 1000, 4)} unit="kN" />
            <Readout label="Outer load" value={fmt(c.P2 / 1000, 4)} unit="kN" />
            <Readout label="Strain" value={fmt(c.strain, 3)} />
          </div>
        </Section>
      )}
      <Section title="The problem">
        <Segmented<Mode>
          value={p.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'rails', label: 'Thermal: rails' },
            { value: 'composite', label: 'Composite bar' },
          ]}
        />
        {p.mode === 'rails' ? (
          <>
            <Slider label="Warm to" value={p.T} min={-30} max={60} step={1} unit="°C" onChange={(T) => set({ T })} />
            <Slider label="Laid at" value={p.T0} min={-10} max={40} step={1} unit="°C" onChange={(T0) => set({ T0 })} />
            <Slider label="Gap when laid" value={p.gap} min={0} max={50} step={0.1} unit="mm" onChange={(gap) => set({ gap })} />
            <Slider label="Length of each rail" value={p.railL} min={1} max={30} step={1} unit="m" onChange={(railL) => set({ railL })} />
            <Slider label="Expansion α" value={p.alpha} min={5} max={30} step={0.1} unit="×10⁻⁶/°C" onChange={(alpha) => set({ alpha })} />
            <Slider label="Young’s modulus" value={p.Er} min={50} max={220} step={1} unit="GPa" onChange={(Er) => set({ Er })} />
            <Note>The colour runs from blue when cold to red when hot. The gap is drawn much wider than life.</Note>
          </>
        ) : (
          <>
            <Slider label="Full pull P" value={p.P} min={10} max={1000} step={10} unit="kN" onChange={(P) => set({ P })} />
            <Slider label="Length" value={p.L} min={100} max={400} step={2} unit="mm" onChange={(L) => set({ L })} />
            <Slider label="Rod diameter" value={p.dIn} min={20} max={80} step={1} unit="mm" onChange={(dIn) => set({ dIn, dOut: Math.max(p.dOut, dIn + 5) })} />
            <Slider label="Tube outer diameter" value={p.dOut} min={p.dIn + 5} max={120} step={1} unit="mm" onChange={(dOut) => set({ dOut })} />
            <Slider label="Rod E" value={p.EIn} min={50} max={220} step={1} unit="GPa" onChange={(EIn) => set({ EIn })} />
            <Slider label="Tube E" value={p.EOut} min={50} max={220} step={1} unit="GPa" onChange={(EOut) => set({ EOut })} />
          </>
        )}
      </Section>
      <Section title="Worked set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      {p.mode === 'rails' ? (
        <Section title="Against temperature">
          <Chart data={[curve.T, curve.g]} series={[{ label: 'Gap', color: '#6fb3e0', width: 2 }]} xLabel="Temperature (°C)" yLabel="Gap (mm)" marker={() => [tempNow(p), railGapAt(r, tempNow(p)) * 1000]} height={125} />
          <Chart data={[curve.T, curve.s]} series={[{ label: 'Stress', color: '#e8794f', width: 2 }]} xLabel="Temperature (°C)" yLabel="Compressive stress (MPa)" marker={() => [tempNow(p), railStressAt(r, tempNow(p)) / 1e6]} height={125} />
          <Note>Until the gap closes there is no stress at all. Stress only comes when the growth is stopped.</Note>
        </Section>
      ) : null}
      <Section title="Working">
        <Working
          steps={
            p.mode === 'rails'
              ? [
                  { label: 'Temperature at which the ends meet', tex: 'T = T_0 + \\dfrac{\\text{gap}}{\\alpha L}', sub: `=${n(p.T0, 3)} + \\dfrac{${n(p.gap / 1000, 3)}}{${n(p.alpha, 3)}\\times10^{-6}(${n(p.railL, 3)})}`, result: `=${n(touch, 3)}\\ ^\\circ\\text{C}` },
                  { label: 'Gap now', tex: '\\text{gap} = \\text{gap}_0 - \\alpha L (T - T_0)', result: `=${n(railGapAt(r, p.T) * 1000, 3)}\\ \\text{mm}` },
                  { label: 'Stress once touching', tex: '\\sigma = E\\alpha (T - T_{\\text{touch}})', result: `=${n(railStressAt(r, p.T) / 1e6, 3)}\\ \\text{MPa}` },
                ]
              : [
                  { label: 'Equilibrium', tex: 'P = \\sigma_1 A_1 + \\sigma_2 A_2' },
                  { label: 'Compatibility: the same strain', tex: '\\dfrac{\\sigma_1}{E_1} = \\dfrac{\\sigma_2}{E_2}' },
                  { label: 'So, the common strain', tex: '\\varepsilon = \\dfrac{P}{A_1E_1 + A_2E_2}', result: `=${n(c.strain, 3)}` },
                  { label: 'Stress in each', tex: '\\sigma = E\\varepsilon', result: `\\sigma_1 = ${n(c.s1 / 1e6, 4)},\\ \\sigma_2 = ${n(c.s2 / 1e6, 4)}\\ \\text{MPa}` },
                  { label: 'Stretch', tex: '\\delta = \\varepsilon L', result: `=${n(c.delta * 1000, 3)}\\ \\text{mm}` },
                ]
          }
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>A free body changes length with temperature, δ = α L ΔT, with no stress. A restrained one gets σ = E α ΔT, with no length change.</li>
          <li>Thermal stress does not depend on the bar’s length or area.</li>
          <li>A composite bar needs two equations: equilibrium, and compatibility of strain.</li>
          <li>The stiffer material takes the higher stress.</li>
        </ExamList>
      </Section>
    </div>
  )
}
