import { useMemo, useState } from 'react'
import { bendingStress, moment, reactions, shear, shearStress } from '@/physics/beam'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { DEFAULTS, analyse, useBeam, type SectionKind, type SupportKind } from './model'

const set = (p: Parameters<ReturnType<typeof useBeam.getState>['set']>[0]) => useBeam.getState().set(p)

export const PRESETS: Preset[] = [
  {
    id: 'third',
    label: '20 + 40 kN, 6 m span',
    note: 'Loads at 2 m and 4 m. R_A = 26.67 kN, R_B = 33.33 kN; moment 53.33 kN·m under the first load and 66.67 kN·m under the second.',
    apply: () => set({ ...DEFAULTS, L: 6, P1: 20, x1: 2, P2: 40, x2: 4, w: 0, probe: 0.667 }),
  },
  {
    id: 'udl-point',
    label: '1 N/m + 5 N, 40 m span',
    note: 'A uniform 1 N/m with 5 N at 8 m from B: R_A = 21 N, R_B = 24 N.',
    apply: () => set({ ...DEFAULTS, L: 40, P1: 0.005, x1: 32, P2: 0, x2: 20, w: 0.001, probe: 0.5 }),
  },
  {
    id: 'tee',
    label: 'T-section, τ limit 3 MPa',
    note: '150 × 10 flange on a 90 × 10 web, span 1.5 m. The shear limit allows w = 2.79 kN/m; the far fibre then reaches 29.5 MPa in bending.',
    apply: () => set({ ...DEFAULTS, L: 1.5, P1: 0, P2: 0, w: 2.788, section: 'tee', bf: 150, tf: 10, hw: 90, tw: 10, probe: 0.001 }),
  },
  {
    id: 'cantilever',
    label: 'Cantilever, end load',
    note: 'Fully fixed at the wall: the largest moment, −P L, is at the wall, and the deflection at the free end is P L³ / 3 E I.',
    apply: () => set({ ...DEFAULTS, support: 'cantilever', L: 3, P1: 10, x1: 3, P2: 0, x2: 1.5, w: 0, probe: 0.001 }),
  },
]

function Live() {
  const p = useBeam()
  const a = useMemo(() => analyse(p), [p])
  const r = reactions(a.beam)
  const sigma = Math.max(Math.abs(bendingStress(a.peak.Mmax, a.props.depth, a.props)), Math.abs(bendingStress(a.peak.Mmax, 0, a.props)))
  const tau = Math.abs(shearStress(a.peak.Vmax, a.section, a.props.ybar, a.props))
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label={p.support === 'cantilever' ? 'Wall force' : 'Reaction A'} value={fmt(r.Ra / 1e3, 4)} unit="kN" />
        <Readout label={p.support === 'cantilever' ? 'Wall moment' : 'Reaction B'} value={fmt((p.support === 'cantilever' ? r.Ma : r.Rb) / 1e3, 4)} unit={p.support === 'cantilever' ? 'kN·m' : 'kN'} />
        <Readout label="Largest shear" value={fmt(Math.abs(a.peak.Vmax) / 1e3, 4)} unit="kN" />
        <Readout label="Largest moment" value={fmt(Math.abs(a.peak.Mmax) / 1e3, 4)} unit="kN·m" tone="warn" />
        <Readout label="Bending stress" value={fmt(sigma / 1e6, 4)} unit="MPa" tone="accent" />
        <Readout label="Shear stress" value={fmt(tau / 1e6, 4)} unit="MPa" tone="info" />
        <Readout label="Deflection" value={fmt(Math.abs(a.peak.ymax) * 1e3, 3)} unit="mm" />
        <Readout label="Second moment" value={fmt(a.props.I * 1e12, 4)} unit="mm⁴" />
        <Readout label="Neutral axis" value={fmt(a.props.ybar * 1e3, 4)} unit="mm up" />
      </div>
      <Note>The beam’s bend is drawn exaggerated to a visible size. Red is tension, blue compression.</Note>
    </Section>
  )
}

function Loads() {
  const p = useBeam()
  return (
    <Section title="Beam and loads">
      <Segmented<SupportKind>
        label="Supports"
        value={p.support}
        onChange={(support) => set({ support })}
        options={[
          { value: 'simple', label: 'Simply supported' },
          { value: 'cantilever', label: 'Cantilever' },
        ]}
      />
      <Slider label="Span L" value={p.L} min={1} max={40} step={0.5} unit="m" onChange={(L) => set({ L, x1: Math.min(p.x1, L), x2: Math.min(p.x2, L) })} />
      <Slider label="Load 1" value={p.P1} min={0} max={100} step={1} unit="kN" onChange={(P1) => set({ P1 })} />
      <Slider label="Load 1 at" value={p.x1} min={0} max={p.L} step={0.1} unit="m" onChange={(x1) => set({ x1 })} />
      <Slider label="Load 2" value={p.P2} min={0} max={100} step={1} unit="kN" onChange={(P2) => set({ P2 })} />
      <Slider label="Load 2 at" value={p.x2} min={0} max={p.L} step={0.1} unit="m" onChange={(x2) => set({ x2 })} />
      <Slider label="Uniform load w" value={p.w} min={0} max={40} step={0.5} unit="kN/m" onChange={(w) => set({ w })} />
      <Toggle label="Colour by bending stress" checked={p.stress} onChange={(stress) => set({ stress })} />
      <Toggle label="Shear and moment diagrams on the rig" checked={p.diagrams} onChange={(diagrams) => set({ diagrams })} />
    </Section>
  )
}

function SectionControls() {
  const p = useBeam()
  const rectangular = p.section === 'rect'
  return (
    <Section title="Cross-section">
      <Segmented<SectionKind>
        value={p.section}
        onChange={(section) => set({ section })}
        options={[
          { value: 'rect', label: 'Rectangle' },
          { value: 'tee', label: 'T' },
          { value: 'eye', label: 'I' },
        ]}
      />
      <Slider label={rectangular ? 'Width b' : 'Flange width'} value={p.bf} min={20} max={300} step={5} unit="mm" onChange={(bf) => set({ bf })} />
      {rectangular ? null : <Slider label="Flange thickness" value={p.tf} min={5} max={40} step={1} unit="mm" onChange={(tf) => set({ tf })} />}
      <Slider label={rectangular ? 'Depth d' : 'Web depth'} value={p.hw} min={20} max={500} step={5} unit="mm" onChange={(hw) => set({ hw })} />
      {rectangular ? null : <Slider label="Web thickness" value={p.tw} min={4} max={40} step={1} unit="mm" onChange={(tw) => set({ tw })} />}
      <Slider label="Young’s modulus E" value={p.E} min={5} max={220} step={5} unit="GPa" onChange={(E) => set({ E })} />
    </Section>
  )
}

function Diagrams() {
  const p = useBeam()
  const a = useMemo(() => analyse(p), [p])
  return (
    <Section title="Along the beam">
      <Chart data={[a.c.x, a.c.V.map((v) => v / 1e3)]} series={[{ label: 'V', color: '#6fb3e0', width: 2 }]} xLabel="x (m)" yLabel="Shear force (kN)" height={125} />
      <Chart data={[a.c.x, a.c.M.map((v) => v / 1e3)]} series={[{ label: 'M', color: '#e8794f', width: 2 }]} xLabel="x (m)" yLabel="Bending moment (kN·m)" height={125} />
      <Chart data={[a.c.x, a.c.y.map((v) => v * 1e3)]} series={[{ label: 'y', color: '#9bd17a', width: 2 }]} xLabel="x (m)" yLabel="Deflection (mm)" height={125} />
      <Note>The moment’s slope is the shear, so the moment peaks where the shear crosses zero.</Note>
    </Section>
  )
}

/** σ and τ through the depth, at the green plane on the rig. */
function ThroughTheDepth() {
  const p = useBeam()
  const a = useMemo(() => analyse(p), [p])
  const x = p.probe * p.L
  const M = moment(a.beam, x)
  const V = shear(a.beam, x)
  const data = useMemo(() => {
    const zs: number[] = []
    const N = 120
    for (let i = 0; i <= N; i++) zs.push((a.props.depth * i) / N)
    return {
      zs: zs.map((z) => z * 1e3),
      s: zs.map((z) => bendingStress(M, z, a.props) / 1e6),
      t: zs.map((z) => Math.abs(shearStress(V, a.section, z, a.props)) / 1e6),
    }
  }, [a, M, V])
  return (
    <Section title="Through the depth">
      <Slider label="Section at x" value={p.probe * p.L} min={0} max={p.L} step={p.L / 200} unit="m" onChange={(v) => set({ probe: Math.min(0.999, Math.max(0.001, v / p.L)) })} />
      <div className="grid grid-cols-2 gap-1.5">
        <Readout label="Moment here" value={fmt(M / 1e3, 4)} unit="kN·m" />
        <Readout label="Shear here" value={fmt(V / 1e3, 4)} unit="kN" />
      </div>
      <Chart data={[data.zs, data.s]} series={[{ label: 'σ', color: '#e8794f', width: 2 }]} xLabel="Height above the bottom (mm)" yLabel="Bending stress (MPa)" height={125} />
      <Chart data={[data.zs, data.t]} series={[{ label: 'τ', color: '#6fb3e0', width: 2 }]} xLabel="Height above the bottom (mm)" yLabel="Shear stress (MPa)" height={125} />
      <Note>Bending stress is zero at the neutral axis and largest at the far fibre. Shear does the opposite, and jumps where the width changes.</Note>
    </Section>
  )
}

function BeamWorking() {
  const p = useBeam()
  const a = useMemo(() => analyse(p), [p])
  const r = reactions(a.beam)
  const steps: WorkingStep[] = []
  const far = Math.max(a.props.yTop, a.props.yBottom)
  if (p.support === 'simple') {
    const terms = a.beam.loads.map((l) => (l.kind === 'point' ? `${n(l.P / 1e3, 3)}(${n(l.x, 3)})` : `${n((l.w * (l.x1 - l.x0)) / 1e3, 3)}(${n((l.x0 + l.x1) / 2, 3)})`))
    steps.push({ label: 'Moments about A', tex: 'R_B L = \\sum P_i x_i', sub: `R_B(${n(p.L, 3)}) = ${terms.join(' + ') || '0'}`, result: `R_B = ${n(r.Rb / 1e3, 4)}\\ \\text{kN}` })
    steps.push({ label: 'Vertical forces', tex: 'R_A = \\sum P_i - R_B', result: `R_A = ${n(r.Ra / 1e3, 4)}\\ \\text{kN}` })
  } else {
    steps.push({ label: 'At the wall', tex: 'R = \\sum P_i,\\quad M_w = \\sum P_i x_i', result: `R = ${n(r.Ra / 1e3, 4)}\\ \\text{kN},\\ M_w = ${n(r.Ma / 1e3, 4)}\\ \\text{kN·m}` })
  }
  steps.push(
    { label: 'Neutral axis', tex: '\\bar y = \\dfrac{\\sum A_i y_i}{\\sum A_i}', result: `\\bar y = ${n(a.props.ybar * 1e3, 4)}\\ \\text{mm}` },
    { label: 'Second moment of area', tex: 'I = \\sum \\left(\\dfrac{b h^3}{12} + A d^2\\right)', result: `I = ${n(a.props.I * 1e12, 4)}\\ \\text{mm}^4` },
    { label: 'Largest bending stress', tex: '\\sigma = \\dfrac{M y}{I}', sub: `=\\dfrac{${n(Math.abs(a.peak.Mmax), 4)}\\times${n(far, 3)}}{${n(a.props.I * 1e12, 4)}\\times10^{-12}}`, result: `=${n((Math.abs(a.peak.Mmax) * far) / a.props.I / 1e6, 4)}\\ \\text{MPa}` },
    { label: 'Largest shear stress', tex: '\\tau = \\dfrac{V Q}{I b}', result: `=${n(Math.abs(shearStress(a.peak.Vmax, a.section, a.props.ybar, a.props)) / 1e6, 4)}\\ \\text{MPa}` },
  )
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function BeamPanel() {
  const [preset, setPreset] = useState<string | null>('third')
  return (
    <div>
      <Live />
      <Loads />
      <SectionControls />
      <Section title="Worked set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Diagrams />
      <ThroughTheDepth />
      <BeamWorking />
      <Section title="Exam points">
        <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-ink/85">
          <li>Three classes of beam by supports: simply supported, cantilever, and overhanging.</li>
          <li>The three equilibrium laws: ΣFx = 0, ΣFy = 0, ΣM = 0.</li>
          <li>Theory of bending assumes plane sections stay plane, a linear elastic and uniform material, and bending about a principal axis.</li>
          <li>In slender beams bending stresses are generally much larger than shear stresses.</li>
        </ul>
      </Section>
    </div>
  )
}
