import { useMemo, useState } from 'react'
import { TestBench } from '@/lab/run'
import { deadCentres, quickReturnRatio, sliderAcceleration, sliderDisplacement, sliderVelocity, stroke, yokeAcceleration, yokeDisplacement, yokeVelocity } from '@/physics/linkages'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n as num, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../_shared/rig'
import { DEFAULTS, SLIDER_PROC, deg, live, rad, sliderRun, useSlider, type Mode } from './model'

const set = (p: Parameters<ReturnType<typeof useSlider.getState>['set']>[0]) => useSlider.getState().set(p)

export const PRESETS: Preset[] = [
  { id: 'yoke', label: 'Scotch yoke', note: 'A pin in a slot. x = r(1 − cos θ) exactly: the only one of these mechanisms that gives true simple harmonic motion.', apply: () => set({ ...DEFAULTS, mode: 'yoke' }) },
  { id: 'n4', label: 'Rod 4 × crank', note: 'A typical engine proportion. The slider is past half stroke at θ = 90°.', apply: () => set({ ...DEFAULTS, n: 4 }) },
  { id: 'n8', label: 'Rod 8 × crank', note: 'A longer rod comes much nearer the true sine.', apply: () => set({ ...DEFAULTS, n: 8 }) },
  { id: 'n2', label: 'Rod 2 × crank', note: 'A short rod: a strong second harmonic, and a large acceleration at the outer dead centre.', apply: () => set({ ...DEFAULTS, n: 2 }) },
  { id: 'offset', label: '25 mm offset', note: 'The line of stroke off the crank centre: a longer stroke, and out and back no longer take the same time.', apply: () => set({ ...DEFAULTS, n: 4, e: 25 }) },
]

const motion = (p: { mode: Mode; r: number; n: number; e: number }, w: number) => {
  const m = { r: p.r, l: p.n * p.r, e: p.e }
  const t0 = p.mode === 'yoke' ? 0 : deadCentres(m).tdc
  return {
    x: (t: number) => (p.mode === 'yoke' ? yokeDisplacement(p.r, t) : sliderDisplacement(m, t + t0)),
    v: (t: number) => (p.mode === 'yoke' ? yokeVelocity(p.r, w, t) : sliderVelocity(m, w, t + t0)),
    a: (t: number) => (p.mode === 'yoke' ? yokeAcceleration(p.r, w, t) : sliderAcceleration(m, w, t + t0)),
    stroke: p.mode === 'yoke' ? 2 * p.r : stroke(m),
    t0,
  }
}

function Live() {
  const p = useSlider()
  const w = (p.rpm * 2 * Math.PI) / 60
  const f = motion(p, w)
  const theta = useLive(() => live.theta, 15) - f.t0
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Crank angle" value={fmt(((deg(theta) % 360) + 360) % 360, 3)} unit="°" />
        <Readout label="Displacement" value={fmt(f.x(theta), 3)} unit="mm" tone="accent" />
        <Readout label="Stroke" value={fmt(f.stroke, 3)} unit="mm" />
        <Readout label="Velocity" value={fmt(f.v(theta), 3)} unit="mm/s" tone="info" />
        <Readout label="Acceleration" value={fmt(f.a(theta), 3)} unit="mm/s²" tone="warn" />
        {p.mode === 'slider' ? <Readout label="Out ÷ back time" value={fmt(quickReturnRatio({ r: p.r, l: p.n * p.r, e: p.e }), 3)} /> : <Readout label="Motion" value="true SHM" />}
      </div>
    </Section>
  )
}

function Charts() {
  const p = useSlider()
  const w = (p.rpm * 2 * Math.PI) / 60
  const data = useMemo(() => {
    const f = motion(p, w)
    const angles = Array.from({ length: 181 }, (_, i) => i * 2)
    const pure = (a: number) => p.r * (1 - Math.cos(rad(a)))
    return { angles, x: angles.map((a) => f.x(rad(a))), pure: angles.map(pure), v: angles.map((a) => f.v(rad(a))), acc: angles.map((a) => f.a(rad(a))), t0: f.t0 }
  }, [p, w])
  const at = () => (((deg(live.theta - data.t0) % 360) + 360) % 360)
  const f = motion(p, w)
  return (
    <Section title="Through a revolution">
      <Chart data={[data.angles, data.x, data.pure]} series={[{ label: 'Displacement', color: '#6fb3e0', width: 2 }, { label: 'Pure sine', color: '#e8e8e8', width: 1 }]} xLabel="Crank angle (°)" yLabel="x (mm)" marker={() => [at(), f.x(live.theta - data.t0)]} height={140} />
      <Chart data={[data.angles, data.v]} series={[{ label: 'Velocity', color: '#9bd17a', width: 2 }]} xLabel="Crank angle (°)" yLabel="v (mm/s)" marker={() => [at(), f.v(live.theta - data.t0)]} height={125} />
      <Chart data={[data.angles, data.acc]} series={[{ label: 'Acceleration', color: '#e8794f', width: 2 }]} xLabel="Crank angle (°)" yLabel="a (mm/s²)" marker={() => [at(), f.a(live.theta - data.t0)]} height={125} />
      <Note>Each curve is the slope of the one above: the graphical differentiation the experiment asks for.</Note>
    </Section>
  )
}

/** The bench test: readings every 15°, plotted against a true sine as they come in. */
function Readings() {
  const rows = sliderRun((s) => s.rows)
  const status = sliderRun((s) => s.status)
  const a = rows.map((r) => r[0])
  const worst = rows.reduce((m, r) => Math.max(m, Math.abs(r[1] - r[2])), 0)
  return (
    <TestBench run={sliderRun} steps={SLIDER_PROC.steps} title="The test: read the scale every 15°" head={['θ (°)', 'x (mm)', 'Pure sine', 'Departure']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3), fmt(r[1] - r[2], 2)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[a, rows.map((r) => r[1]), rows.map((r) => r[2])]} series={[{ label: 'Readings', color: '#e8794f', width: 2 }, { label: 'Pure sine', color: '#6fb3e0', width: 1 }]} xLabel="Crank angle (°)" yLabel="x (mm)" height={125} />
          {status === 'done' ? (
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <Readout label="Stroke read" value={fmt(Math.max(...rows.map((r) => r[1])), 3)} unit="mm" tone="accent" />
              <Readout label="Largest departure" value={fmt(worst, 3)} unit="mm" tone="info" />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

function SliderWorking() {
  const p = useSlider()
  const steps: WorkingStep[] = []
  if (p.mode === 'yoke') {
    steps.push(
      { label: 'Displacement', tex: 'x = r - r\\cos\\theta', sub: `\\text{at } 90^\\circ:\\ ${num(p.r, 3)} - 0`, result: `=${num(p.r, 3)}\\ \\text{mm}` },
      { label: 'Velocity and acceleration', tex: 'V = r\\omega\\sin\\theta,\\quad A = r\\omega^2\\cos\\theta' },
    )
  } else {
    const x90 = p.r * (p.n + 1 - Math.sqrt(p.n * p.n - 1))
    steps.push(
      { label: 'Displacement, no offset', tex: 'x = r\\left(n + 1 - \\cos\\theta - \\sqrt{n^2 - \\sin^2\\theta}\\right)' },
      { label: 'Why half stroke is not at 90°', tex: 'x_{90^\\circ} = r\\left(n + 1 - \\sqrt{n^2 - 1}\\right)', sub: `=${num(p.r, 3)}\\left(${num(p.n, 3)} + 1 - \\sqrt{${num(p.n * p.n, 3)} - 1}\\right)`, result: `=${num(x90, 3)}\\ \\text{mm}`, errata: 'A worked report simplifies this to zero; the rod’s swing in fact takes the slider past half stroke.' },
      { label: 'Velocity', tex: 'V \\approx \\omega r\\left(\\sin\\theta + \\dfrac{\\sin 2\\theta}{2n}\\right)' },
      { label: 'Acceleration', tex: 'A \\approx \\omega^2 r\\left(\\cos\\theta + \\dfrac{\\cos 2\\theta}{n}\\right)' },
    )
  }
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function SliderPanel() {
  const p = useSlider()
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <Readings />
      <Live />
      <Section title="The mechanism">
        <Segmented<Mode>
          value={p.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'slider', label: 'Slider-crank' },
            { value: 'yoke', label: 'Scotch yoke' },
          ]}
        />
        <Slider label="Crank radius r" value={p.r} min={10} max={40} step={1} unit="mm" onChange={(r) => set({ r })} />
        {p.mode === 'slider' ? (
          <>
            <Slider label="Rod ÷ crank, n" value={p.n} min={2} max={10} step={0.5} onChange={(n) => set({ n, e: Math.min(p.e, 0.9 * (n - 1) * p.r) })} />
            <Slider label="Line of stroke offset" value={p.e} min={0} max={40} step={1} unit="mm" onChange={(e) => set({ e: Math.min(e, 0.9 * (p.n - 1) * p.r) })} />
          </>
        ) : null}
        <Slider label="Crank speed" value={p.rpm} min={2} max={60} step={1} unit="rpm" onChange={(rpm) => set({ rpm })} />
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <SliderWorking />
      <Section title="Exam points">
        <ExamList>
          <li>Velocity is greatest near θ = 90° and 270°, zero at the dead centres; acceleration is greatest at the dead centres.</li>
          <li>With a slider-crank, the second harmonic adds at the outer dead centre and subtracts at the inner one: A = ω²r(1 ± 1/n).</li>
          <li>In a single-cylinder engine that second harmonic is felt as an unbalanced inertia force at twice engine speed.</li>
          <li>The slider is not half way at θ = 90°, because the rod is still inclined there.</li>
        </ExamList>
      </Section>
    </div>
  )
}
