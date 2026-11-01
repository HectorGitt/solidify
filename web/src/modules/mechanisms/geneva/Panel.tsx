import { useMemo, useState } from 'react'
import { genevaAccelerationRatio, genevaAngle, genevaHalfEngagement, genevaLambda, genevaMovingFraction, genevaOutput, genevaStep, genevaVelocityRatio } from '@/physics/linkages'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n as num } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../_shared/rig'
import { deg, live, rad, useGeneva } from './model'

const set = (p: Parameters<ReturnType<typeof useGeneva.getState>['set']>[0]) => useGeneva.getState().set(p)

export const PRESETS: Preset[] = [
  { id: 'six', label: 'Six slots', note: 'The bench unit: 60° a step, taken over 120° of driver rotation.', apply: () => set({ slots: 6 }) },
  { id: 'five', label: 'Five output steps', note: 'The design exercise: 360° / 5 = 72° per step. The centre distance follows from the pin radius, c = a / sin 36°.', apply: () => set({ slots: 5 }) },
  { id: 'four', label: 'Four slots', note: 'Used in cine projectors: a quarter turn per frame, moving for a quarter of the time.', apply: () => set({ slots: 4 }) },
  { id: 'eight', label: 'Eight slots', note: 'Smaller steps and gentler peaks, but the wheel is moving for longer.', apply: () => set({ slots: 8 }) },
]

function Live() {
  const n = useGeneva((s) => s.slots)
  const theta = useLive(() => live.theta, 15)
  const t = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const half = genevaHalfEngagement(n)
  const engaged = t < 2 * half
  const alpha = t - half
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Input angle" value={fmt(deg(t), 3)} unit="°" />
        <Readout label="Output angle" value={fmt(deg(genevaAngle(n, t)), 3)} unit="°" tone="accent" />
        <Readout label="State" value={engaged ? 'moving' : 'locked'} tone={engaged ? 'warn' : 'info'} />
        <Readout label="Step" value={fmt(deg(genevaStep(n)), 3)} unit="°" />
        <Readout label="Moving for" value={fmt(genevaMovingFraction(n) * 100, 3)} unit="%" />
        <Readout label="Speed ratio" value={engaged ? fmt(genevaVelocityRatio(n, alpha), 3) : '0'} />
      </div>
    </Section>
  )
}

function Charts() {
  const n = useGeneva((s) => s.slots)
  const data = useMemo(() => {
    const half = genevaHalfEngagement(n)
    const angles = Array.from({ length: 181 }, (_, i) => i)
    const engaged = (a: number) => rad(a) <= 2 * half
    return {
      angles,
      out: angles.map((a) => deg(genevaAngle(n, rad(a)))),
      v: angles.map((a) => (engaged(a) ? genevaVelocityRatio(n, rad(a) - half) : 0)),
      acc: angles.map((a) => (engaged(a) ? genevaAccelerationRatio(n, rad(a) - half) : 0)),
    }
  }, [n])
  return (
    <Section title="Output characteristics">
      <Chart data={[data.angles, data.out]} series={[{ label: 'Output', color: '#6fb3e0', width: 2 }]} xLabel="Input angle (°)" yLabel="Output angle (°)" height={140} />
      <Chart data={[data.angles, data.v]} series={[{ label: 'ω₂/ω₁', color: '#9bd17a', width: 2 }]} xLabel="Input angle (°)" yLabel="Output speed ÷ input speed" height={125} />
      <Chart data={[data.angles, data.acc]} series={[{ label: 'α₂/ω₁²', color: '#e8794f', width: 2 }]} xLabel="Input angle (°)" yLabel="Output acceleration ÷ ω₁²" height={125} />
      <Note>The speed starts from zero, which softens engagement. The acceleration does jump at entry and exit, though: the wheel’s limit at high speed.</Note>
    </Section>
  )
}

function Readings() {
  const n = useGeneva((s) => s.slots)
  const rows = Array.from({ length: 13 }, (_, i) => i * 15).map((a) => [`${a}°`, `${fmt(deg(genevaAngle(n, rad(a))), 3)}°`])
  return (
    <Section title="Experiment: input every 15°">
      <Table head={['Input', 'Output']} rows={rows} />
    </Section>
  )
}

export function GenevaPanel() {
  const n = useGeneva((s) => s.slots)
  const rpm = useGeneva((s) => s.rpm)
  const [preset, setPreset] = useState<string | null>('six')
  const k = genevaLambda(n)
  const half = deg(genevaHalfEngagement(n))
  return (
    <div>
      <Live />
      <Section title="The unit">
        <Slider label="Number of slots" value={n} min={3} max={12} step={1} onChange={(slots) => set({ slots })} />
        <Slider label="Input speed" value={rpm} min={2} max={60} step={1} unit="rpm" onChange={(v) => set({ rpm: v })} />
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <Readings />
      <Section title="Working">
        <Working
          steps={[
            { label: 'Output per step', tex: '\\beta = \\dfrac{360^\\circ}{n}', sub: `=\\dfrac{360}{${n}}`, result: `=${num(360 / n, 3)}^\\circ` },
            { label: 'Input while engaged', tex: '2\\alpha_0 = 180^\\circ - \\dfrac{360^\\circ}{n}', result: `=${num(2 * half, 3)}^\\circ` },
            { label: 'Pin radius over centre distance', tex: '\\lambda = \\dfrac{a}{c} = \\sin\\dfrac{\\pi}{n}', result: `=${num(k, 3)}` },
            { label: 'Output angle while engaged', tex: '\\tan\\beta = \\dfrac{\\lambda\\sin\\alpha}{1 - \\lambda\\cos\\alpha}', sub: `\\alpha = ${num(half / 2, 3)}^\\circ:\\ \\beta = ${num(deg(genevaOutput(n, rad(half / 2))), 3)}^\\circ` },
            { label: 'Peak output speed, at the line of centres', tex: '\\dfrac{\\omega_2}{\\omega_1} = \\dfrac{\\lambda}{1 - \\lambda}', result: `=${num(k / (1 - k), 3)}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Used where motion must stop and start: packaging lines for filling and labelling, cine projectors between frames.</li>
          <li>The pin enters tangentially to the slot, so the wheel starts from rest and the shock of engagement is small.</li>
          <li>Closing one slot makes a Geneva stop, which limits the turns: used in watches to prevent overwinding.</li>
          <li>To design for five steps: 360°/5 = 72°, choose the pin radius, then c = a / sin 36°.</li>
        </ExamList>
      </Section>
    </div>
  )
}
