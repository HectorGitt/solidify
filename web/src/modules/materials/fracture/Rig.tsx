import { useEffect, useMemo, useState } from 'react'
import { TestBench, createRun, instrument, useResetOnChange, useRunDriver } from '@/lab/run'
import * as THREE from 'three'
import { create } from 'zustand'
import { box, extrude, mat4, merge, xform } from '@/geometry'
import { criticalCrack, criticalStress, griffithStress, parisLife, stressIntensity } from '@/physics/strength'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'
import { ForceArrow } from '../../elements/_shared/Arrow'

export const FLOOR = -0.72
const W = 0.8
const H = 0.9

type CrackKind = 'centre' | 'edge'

interface Params {
  kind: CrackKind
  /** MPa, half crack length (or edge crack depth) in mm, MPa√m, MPa */
  sigma: number
  a: number
  KIc: number
  Y: number
  /** the crack as it has grown so far, mm: moved by the test */
  aNow: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { kind: 'centre' as CrackKind, sigma: 200, a: 10, KIc: 50, Y: 500, aNow: 10 }
export const useFracture = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useFracture.getState().set(p)

/** as in the notes: 1 for a through crack in a wide plate, 1.12 at an edge */
const fractureRun = createRun()
const PROCEDURE = { steps: 12, moveSeconds: 0.5, dwellSeconds: 0.15 }
const factor = (k: CrackKind) => (k === 'centre' ? 1 : 1.12)

/** the plate, with a sharp crack cut out of it: its length drawn in proportion, up to half the plate */
function plateShape(kind: CrackKind, aDrawn: number) {
  const s = new THREE.Shape()
  const open = 0.006
  if (kind === 'edge') {
    s.moveTo(-W / 2, -H / 2)
    s.lineTo(W / 2, -H / 2)
    s.lineTo(W / 2, H / 2)
    s.lineTo(-W / 2, H / 2)
    s.lineTo(-W / 2, open)
    s.lineTo(-W / 2 + aDrawn, 0)
    s.lineTo(-W / 2, -open)
    s.closePath()
    return s
  }
  s.moveTo(-W / 2, -H / 2)
  s.lineTo(W / 2, -H / 2)
  s.lineTo(W / 2, H / 2)
  s.lineTo(-W / 2, H / 2)
  s.closePath()
  const c = new THREE.Path()
  c.moveTo(-aDrawn, 0)
  c.lineTo(0, -open)
  c.lineTo(aDrawn, 0)
  c.lineTo(0, open)
  c.closePath()
  s.holes.push(c)
  return s
}

export function Fracture3D() {
  const p = useFracture()
  const aDrawn = Math.max(0.01, Math.min(W * 0.45, (p.aNow / 100) * W * 0.9))
  const K = stressIntensity(factor(p.kind), p.sigma * 1e6, p.aNow / 1000) / 1e6
  /** the crack is grown from its start until it reaches the size this plate can't carry, plus a little */
  const grown = (st: Params, f: number) => st.a + (Math.max(st.a, criticalCrack(factor(st.kind), st.KIc * 1e6, st.sigma * 1e6) * 1000 * 1.001) - st.a) * f
  useResetOnChange(fractureRun, JSON.stringify([p.kind, p.sigma, p.a, p.KIc, p.Y]))
  useRunDriver(
    fractureRun,
    PROCEDURE,
    (f) => {
      const st = useFracture.getState()
      const aNow = grown(st, f)
      if (Math.abs(aNow - st.aNow) >= Math.max(0.02, st.a * 0.01) || f === 1) st.set({ aNow })
    },
    (step, f) => {
      const st = useFracture.getState()
      const a = grown(st, f)
      const k = stressIntensity(factor(st.kind), st.sigma * 1e6, a / 1000) / 1e6
      fractureRun.getState().log([a, instrument(k, 0.005, step)])
      if (k >= st.KIc) fractureRun.getState().fail(`K reached the ${st.KIc} MPa√m toughness with the crack at ${a.toFixed(2)} mm: the plate has fractured.`)
    },
  )
  useEffect(
    () =>
      fractureRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle') || (r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useFracture.getState().set({ aNow: useFracture.getState().a })
      }),
    [],
  )
  const broken = K >= p.KIc
  const geo = useMemo(
    () => ({
      plate: extrude(plateShape(p.kind, aDrawn), 0.02, { curveSegments: 4 }),
      grips: merge(...[-1, 1].map((k) => xform(box(W + 0.06, 0.1, 0.06), mat4.t(0, (k * (H + 0.1)) / 2, 0)))),
      posts: merge(...[-1, 1].map((k) => xform(box(0.05, H + 0.75, 0.05), mat4.t((k * (W + 0.22)) / 2, 0.02, 0)))),
      base: xform(box(W + 0.45, 0.05, 0.4), mat4.t(0, FLOOR + 0.025, 0)),
      head: xform(box(W + 0.34, 0.05, 0.1), mat4.t(0, H / 2 + 0.34, 0)),
      rods: merge(...[-1, 1].map((k) => xform(box(0.04, 0.26, 0.04), mat4.t(0, (k * (H / 2 + 0.2)), 0)))),
    }),
    [p.kind, aDrawn],
  )
  // the plate colours up as K nears its limit
  const dynMat = useMemo(() => createDynamicCutMaterial({ color: '#9aa3ab', cap: '#c8d0d6', hatch: 'steel', metalness: 0.45, roughness: 0.5 }), [])
  const mat = useMemo(() => {
    const u = Math.min(1, K / p.KIc)
    dynMat.material.color.set('#9aa3ab').lerp(new THREE.Color('#d0452c'), u * u)
    return dynMat.material
  }, [K, p.KIc, dynMat])
  const gap = broken ? 0.09 : 0
  return (
    <group>
      <Part id="frame" name="Test frame" role="static" material="paintBlue" info={{ summary: 'Pulls the plate apart.', role: 'The load is applied far from the crack, so it can be treated as a uniform stress σ on the plate.' }} cut={false} explode={[0, 0, -0.3]}>
        <PartMesh geometry={geo.base} />
        <PartMesh geometry={geo.posts} material="chrome" />
        <PartMesh geometry={geo.head} />
        <PartMesh geometry={geo.rods} material="steelDark" />
      </Part>
      <Part id="grips" name="Grips" role="moving" material="steelDark" info={{ summary: 'Hold the plate along its full width.', role: 'They spread the load evenly into the plate.' }} cut>
        <PartMesh geometry={geo.grips} />
      </Part>
      <group position={[0, gap, 0]}>
        <Part id="plate" name="Cracked plate" role="moving" material="aluminium" info={{ summary: 'A plate with one sharp crack.', role: 'The crack concentrates stress at its tip. What matters is K, which combines the stress and the crack’s size: it fails when K reaches the toughness K_Ic.' }} cut>
          <PartMesh geometry={geo.plate} customMaterial={mat} />
        </Part>
      </group>
      <ForceArrow color="#d0631c" spec={() => ({ origin: new THREE.Vector3(0.28, H / 2 + 0.12, 0.05), dir: new THREE.Vector3(0, 1, 0), length: 0.06 + p.sigma * 0.0003, label: `${p.sigma} MPa`, visible: true })} radius={0.009} />
      <ForceArrow color="#d0631c" spec={() => ({ origin: new THREE.Vector3(0.28, -H / 2 - 0.12, 0.05), dir: new THREE.Vector3(0, -1, 0), length: 0.06 + p.sigma * 0.0003, visible: true })} radius={0.009} />
      <PartLabel partId="plate" at={[W / 2 + 0.06, 0.2, 0.04]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'steel', label: 'Tough steel', note: 'K_Ic of 150 MPa√m: at 400 MPa it tolerates a crack of about 45 mm, well beyond what inspection would miss.', apply: () => set({ ...DEFAULTS, sigma: 400, KIc: 150, Y: 800 }) },
  { id: 'alu', label: 'Aerospace aluminium', note: 'K_Ic of about 25 MPa√m: much less tolerant, so cracks are hunted down in service.', apply: () => set({ ...DEFAULTS, sigma: 200, KIc: 25, Y: 450 }) },
  { id: 'glass', label: 'Glass', note: 'K_Ic below 1 MPa√m: a scratch is enough to start a break, which is why a glazier scores it first.', apply: () => set({ ...DEFAULTS, sigma: 30, KIc: 0.8, a: 0.2, aNow: 0.2, Y: 3000 }) },
  { id: 'edge', label: 'Edge crack', note: 'The same crack at an edge has 12 % more K, with Y = 1.12: an edge has less material to hold it closed.', apply: () => set({ ...DEFAULTS, kind: 'edge' }) },
]

/** The bench test: hold the stress, and let the crack grow until the plate goes. */
function FractureTest() {
  const p = useFracture()
  const rows = fractureRun((s) => s.rows)
  return (
    <TestBench run={fractureRun} steps={PROCEDURE.steps} title="The test: grow the crack" head={['Crack a (mm)', 'K (MPa√m)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3)]}>
      {rows.length > 1 ? <Chart data={[rows.map((r) => r[0]), rows.map((r) => r[1]), rows.map(() => p.KIc)]} series={[{ label: 'K', color: '#e8794f', width: 2 }, { label: 'Toughness', color: '#6fb3e0', width: 1.5 }]} xLabel="Crack size a (mm)" yLabel="K (MPa√m)" height={120} /> : null}
    </TestBench>
  )
}

export function FracturePanel() {
  const p = useFracture()
  const [preset, setPreset] = useState<string | null>(null)
  const Y = factor(p.kind)
  const K = stressIntensity(Y, p.sigma * 1e6, p.aNow / 1000) / 1e6
  const sc = criticalStress(Y, p.KIc * 1e6, p.aNow / 1000) / 1e6
  const ac = criticalCrack(Y, p.KIc * 1e6, p.sigma * 1e6) * 1000
  const failsBy = K >= p.KIc ? 'broken' : p.sigma >= p.Y ? 'yielding' : 'holding'
  const curve = useMemo(() => {
    const a = Array.from({ length: 120 }, (_, i) => 0.2 + (i / 119) * 79.8)
    return { a, s: a.map((x) => Math.min(p.Y * 1.3, criticalStress(Y, p.KIc * 1e6, x / 1000) / 1e6)), y: a.map(() => p.Y) }
  }, [Y, p.KIc, p.Y])
  const life = p.aNow < ac ? parisLife(1e-11, 3, Y, p.sigma * 1e6, p.aNow / 1000, ac / 1000) : 0
  return (
    <div>
      <FractureTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="K now" value={fmt(K, 3)} unit="MPa√m" tone={K >= p.KIc ? 'warn' : 'accent'} />
          <Readout label="Toughness" value={fmt(p.KIc, 3)} unit="MPa√m" />
          <Readout label="State" value={failsBy} tone={failsBy === 'holding' ? 'accent' : 'warn'} />
          <Readout label="Stress to break" value={fmt(sc, 4)} unit="MPa" tone="info" />
          <Readout label="Crack to break" value={fmt(ac, 3)} unit="mm" tone="info" />
          <Readout label="Cycles left" value={life > 0 ? fmt(life, 3) : '0'} />
        </div>
        <Note>The cycles left assume this stress as the range, with typical steel constants C = 10⁻¹¹ and m = 3 in Paris’ law: a guide, not a prediction for a given part.</Note>
      </Section>
      <Section title="The plate">
        <Segmented<CrackKind> value={p.kind} onChange={(kind) => set({ kind })} options={[{ value: 'centre', label: 'Centre crack' }, { value: 'edge', label: 'Edge crack' }]} />
        <Slider label="Stress" value={p.sigma} min={1} max={1000} step={1} unit="MPa" onChange={(sigma) => set({ sigma })} />
        <Slider label="Starting crack a" value={p.a} min={0.1} max={100} step={0.1} unit="mm" onChange={(a) => set({ a, aNow: a })} />
        <Slider label="Toughness K_Ic" value={p.KIc} min={0.5} max={200} step={0.5} unit="MPa√m" onChange={(KIc) => set({ KIc })} />
        <Slider label="Yield stress" value={p.Y} min={50} max={3000} step={10} unit="MPa" onChange={(v) => set({ Y: v })} />
        <Note>The crack’s length is drawn in proportion, within limits. The plate reddens as K nears K_Ic.</Note>
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Strength against crack size">
        <Chart data={[curve.a, curve.s, curve.y]} series={[{ label: 'Fracture', color: '#e8794f', width: 2 }, { label: 'Yield', color: '#6fb3e0', width: 1.5 }]} xLabel="Crack size a (mm)" yLabel="Stress (MPa)" marker={() => [Math.min(p.aNow, 80), p.sigma]} height={150} />
        <Note>Below the crossing, the plate yields first and behaves as if it had no crack. Above it, the crack decides: a brittle failure below the yield stress.</Note>
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Stress intensity factor', tex: 'K = Y\\sigma\\sqrt{\\pi a}', sub: `=${n(Y, 3)}(${n(p.sigma, 3)})\\sqrt{\\pi(${n(p.a / 1000, 3)})}`, result: `=${n(K, 3)}\\ \\text{MPa}\\sqrt{\\text{m}}` },
            { label: 'Stress it can carry', tex: '\\sigma_c = \\dfrac{K_{Ic}}{Y\\sqrt{\\pi a}}', result: `=${n(sc, 4)}\\ \\text{MPa}` },
            { label: 'Crack it can carry', tex: 'a_c = \\dfrac{1}{\\pi}\\left(\\dfrac{K_{Ic}}{Y\\sigma}\\right)^2', result: `=${n(ac, 3)}\\ \\text{mm}` },
            { label: 'Griffith, for a brittle plate (glass: 70 GPa, 1 J/m²)', tex: '\\sigma_f = \\sqrt{\\dfrac{2E\\gamma}{\\pi a}}', result: `=${n(griffithStress(70e9, 1, p.a / 1000) / 1e6, 3)}\\ \\text{MPa}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Three things govern: stress, crack size and toughness. Fix any two and the third is decided.</li>
          <li>K is a measure of the stress field at the crack tip, not a stress: its units are MPa√m.</li>
          <li>K_Ic needs plane strain: a thick enough specimen. Thin sheet is tougher.</li>
          <li>Design: pick the material, then set an inspection interval from the time a crack takes to reach a_c.</li>
        </ExamList>
      </Section>
    </div>
  )
}
