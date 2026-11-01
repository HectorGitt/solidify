import { useMemo, useState } from 'react'
import { hartnell, porter, porterAlphaAfterLift, radToRpm, rpmToRad, sensitivity } from '@/physics/machinedynamics'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../_shared/rig'
import { DEFAULTS, controllingCurve, deg, equilibrium, rad, speedRange, useGov, type Kind } from './model'

const set = (p: Parameters<ReturnType<typeof useGov.getState>['set']>[0]) => useGov.getState().set(p)

export const PRESETS: Preset[] = [
  { id: 'watt', label: 'Watt, 2.5 kg balls', note: 'The simplest form: height depends only on speed, h = g/ω². At low speeds it moves a long way, but at high speeds the change in height is too small to be any use.', apply: () => set({ ...DEFAULTS, kind: 'watt', m: 2.5, rpm: 75, arm: 300 }) },
  { id: 'porter', label: 'Porter example', note: 'Arms 200 mm, 30° at the lowest, offset 36 mm, balls 3 kg, load 20 kg, 36 mm of lift: from 170.6 rpm to 185.5 rpm, sensitivity 0.084.', apply: () => set({ ...DEFAULTS, kind: 'porter' }) },
  { id: 'hartnell', label: 'Hartnell example', note: 'Balls 2.5 kg, arms 150 and 90 mm, r₀ 120 mm at 300 rpm. An 8 % speed rise over 12 mm of sleeve needs a 987 N initial load and a 29.7 N/mm spring.', apply: () => set({ ...DEFAULTS, kind: 'hartnell', m: 2.5, rpm: 300 }) },
]

function GovWorking() {
  const p = useGov()
  if (p.kind === 'watt') {
    const w = rpmToRad(p.rpm)
    return <Working steps={[{ label: 'Height of the governor', tex: 'h = \\dfrac{g}{\\omega^2}', sub: `=\\dfrac{9.81}{(${n(w, 4)})^2}`, result: `=${n((9.81 / (w * w)) * 1000, 4)}\\ \\text{mm}` }]} />
  }
  if (p.kind === 'porter') {
    const low = porter(p.m, p.M, p.arm / 1000, p.offset / 1000, rad(30))
    const a2 = porterAlphaAfterLift(p.arm / 1000, rad(30), 0.036)
    const high = porter(p.m, p.M, p.arm / 1000, p.offset / 1000, a2)
    const n1 = radToRpm(low.w)
    const n2 = radToRpm(high.w)
    return (
      <Working
        steps={[
          { label: 'Ball radius at 30°', tex: 'r = c + l\\sin\\alpha', sub: `=${n(p.offset, 3)} + ${n(p.arm, 3)}\\sin 30^\\circ`, result: `=${n(low.r * 1000, 4)}\\ \\text{mm}` },
          { label: 'Controlling force, lowest', tex: 'F = (m + M) g \\tan\\alpha', sub: `=(${n(p.m, 3)} + ${n(p.M, 3)})(9.81)\\tan 30^\\circ`, result: `=${n(low.controllingForce, 4)}\\ \\text{N}` },
          { label: 'Speed, lowest', tex: 'F = m\\omega^2 r', result: `N_1 = ${n(n1, 4)}\\ \\text{rpm}` },
          { label: 'Angle after 36 mm of lift', tex: '\\cos\\alpha_2 = \\cos\\alpha_1 - \\dfrac{\\text{lift}}{2l}', result: `\\alpha_2 = ${n(deg(a2), 4)}^\\circ` },
          { label: 'Speed, uppermost', tex: 'F = (m+M)g\\tan\\alpha_2 = m\\omega^2 r_2', result: `N_2 = ${n(n2, 4)}\\ \\text{rpm}` },
          { label: 'Sensitivity', tex: '\\dfrac{N_2 - N_1}{\\bar N}', result: `=${n(sensitivity(n1, n2), 3)}` },
        ]}
      />
    )
  }
  const h = hartnell(p.m, p.a / 1000, p.b / 1000, p.r0 / 1000, p.n0, 0.08, 0.012)
  return (
    <Working
      steps={[
        { label: 'Force on a ball at N₀', tex: 'F_1 = m\\omega^2 r_0', result: `=${n(h.F1, 4)}\\ \\text{N}` },
        { label: 'Initial spring load', tex: 'S_1 = 2 F_1\\dfrac{a}{b}', sub: `=2(${n(h.F1, 4)})\\dfrac{${n(p.a, 3)}}{${n(p.b, 3)}}`, result: `=${n(h.S1, 4)}\\ \\text{N}` },
        { label: 'Radius after 12 mm of sleeve', tex: 'r_2 = r_0 + x\\dfrac{a}{b}', result: `=${n(h.r2 * 1000, 4)}\\ \\text{mm}` },
        { label: 'Force at 8 % more speed', tex: 'F_2 = m(1.08\\,\\omega)^2 r_2', result: `=${n(h.F2, 4)}\\ \\text{N}` },
        { label: 'Stiffness', tex: 'k = \\dfrac{S_2 - S_1}{x}', sub: `=\\dfrac{${n(h.S2, 4)} - ${n(h.S1, 4)}}{12}`, result: `=${n(h.k / 1000, 3)}\\ \\text{N/mm}` },
      ]}
    />
  )
}

export function GovernorPanel() {
  const p = useGov()
  const [preset, setPreset] = useState<string | null>('porter')
  const s = equilibrium(p)
  const range = speedRange(p)
  const curve = useMemo(() => controllingCurve(p), [p])
  return (
    <div>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Ball radius" value={fmt(s.r, 4)} unit="mm" />
          <Readout label="Sleeve lift" value={fmt(s.lift, 3)} unit="mm" tone="accent" />
          <Readout label="Controlling force" value={fmt(s.F, 4)} unit="N" tone="warn" />
          <Readout label="Lowest speed" value={fmt(range.lo, 4)} unit="rpm" />
          <Readout label="Highest speed" value={fmt(range.hi, 4)} unit="rpm" />
          <Readout label="Sensitivity" value={fmt(sensitivity(range.lo, range.hi), 3)} tone="info" />
        </div>
        {s.atStop ? <Note tone="warn">Outside the working range: the sleeve is on its stop.</Note> : null}
      </Section>
      <Section title="The governor">
        <Segmented<Kind>
          value={p.kind}
          onChange={(kind) => set({ kind, rpm: kind === 'watt' ? 75 : kind === 'porter' ? 178 : 300, m: kind === 'hartnell' ? 2.5 : kind === 'watt' ? 2.5 : 3, arm: kind === 'watt' ? 300 : 200 })}
          options={[
            { value: 'watt', label: 'Watt' },
            { value: 'porter', label: 'Porter' },
            { value: 'hartnell', label: 'Hartnell' },
          ]}
        />
        <Slider label="Spindle speed" value={p.rpm} min={Math.max(10, range.lo * 0.8)} max={range.hi * 1.15} step={1} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Slider label="Ball mass" value={p.m} min={0.5} max={10} step={0.5} unit="kg" onChange={(m) => set({ m })} />
        {p.kind === 'porter' ? <Slider label="Central load" value={p.M} min={0} max={60} step={1} unit="kg" onChange={(M) => set({ M })} /> : null}
        {p.kind === 'hartnell' ? <Slider label="Spring stiffness" value={p.k} min={5} max={80} step={0.1} unit="N/mm" onChange={(k) => set({ k })} /> : null}
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Controlling force">
        <Chart data={[curve.rs, curve.Fs]} series={[{ label: 'F', color: '#e8794f', width: 2 }]} xLabel="Ball radius (mm)" yLabel="Force per ball (N)" marker={() => [s.r, s.F]} height={140} />
        <Note>Stable if the line, produced back, cuts the force axis below the origin: F/r must grow with r. If F/r is constant the governor is isochronous: it floats between its stops at one speed.</Note>
      </Section>
      <Section title="Working">
        <GovWorking />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>A governor controls mean speed over many cycles, by changing the fuel supply as load changes. A flywheel only smooths speed within a cycle.</li>
          <li>Stable: one equilibrium speed for each ball radius, with speed rising as the radius rises.</li>
          <li>Isochronous: the same speed at all radii, so the range is zero. Hunting: it over-corrects, and the speed swings about the mean.</li>
          <li>Sensitive: the sleeve moves a long way for a small change in speed.</li>
        </ExamList>
      </Section>
    </div>
  )
}
