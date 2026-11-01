import { useMemo } from 'react'
import { pendulumInertia, pendulumPeriod, suspensionInertia } from '@/physics/machinedynamics'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, Table } from '../../elements/_shared/PanelBits'
import { ExamList } from '../_shared/rig'
import { blockI, platformI, timings, truePeriod, useInertia, type Mode } from './model'

const set = (p: Parameters<ReturnType<typeof useInertia.getState>['set']>[0]) => useInertia.getState().set(p)

function Experiment() {
  const p = useInertia()
  const T = truePeriod(p)
  const runs = timings(T)
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length
  const devs = runs.map((t) => Math.abs(t - mean))
  const sd = Math.sqrt(runs.reduce((s, t) => s + (t - mean) ** 2, 0) / (runs.length - 1))
  const pendulum = p.mode === 'pendulum'
  const total = p.mPlatform + (p.block ? p.mBlock : 0)
  const measured = pendulum ? pendulumInertia(p.mBar, p.h, mean) : suspensionInertia(total, p.r, p.L, mean)
  const actual = pendulum ? p.mBar * (p.length ** 2 / 12 + p.h ** 2) : platformI(p) + (p.block ? blockI(p) : 0)
  return (
    <>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Period" value={fmt(T, 4)} unit="s" tone="accent" />
          <Readout label="20 swings" value={fmt(20 * T, 4)} unit="s" />
          <Readout label="Inertia measured" value={fmt(measured, 4)} unit="kg·m²" tone="warn" />
        </div>
      </Section>
      <Section title="Experiment: time 20 swings, five times">
        <Table
          head={['Run', '20 T (s)', 'T (s)', '|T − T̄|']}
          rows={runs.map((t, i) => [String(i + 1), fmt(20 * t, 4), fmt(t, 4), fmt(devs[i], 2)])}
        />
        <Note>
          Mean T̄ = {fmt(mean, 4)} s, standard deviation {fmt(sd, 2)} s. Geometry alone gives I = {fmt(actual, 4)} kg·m².
        </Note>
      </Section>
    </>
  )
}

function PeriodChart() {
  const p = useInertia()
  const data = useMemo(() => {
    const k = p.length / Math.sqrt(12)
    const hs = Array.from({ length: 90 }, (_, i) => 0.03 + (i / 89) * 0.67)
    return { hs, T: hs.map((h) => pendulumPeriod(k, h)), k }
  }, [p.length])
  return (
    <Section title="Period against pivot distance">
      <Chart data={[data.hs, data.T]} series={[{ label: 'T', color: '#6fb3e0', width: 2 }]} xLabel="h, pivot to G (m)" yLabel="Period (s)" marker={() => [p.h, pendulumPeriod(data.k, p.h)]} height={140} />
      <Note>The swing is quickest with the pivot one radius of gyration from G: here k = {fmt(data.k, 3)} m.</Note>
    </Section>
  )
}

export function InertiaPanel() {
  const p = useInertia()
  const pendulum = p.mode === 'pendulum'
  const T = truePeriod(p)
  const total = p.mPlatform + (p.block ? p.mBlock : 0)
  return (
    <div>
      <Section title="The method">
        <Segmented<Mode>
          value={p.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'pendulum', label: 'Pendulum' },
            { value: 'bifilar', label: 'Bifilar' },
            { value: 'trifilar', label: 'Trifilar' },
          ]}
        />
      </Section>
      <Experiment />
      <Section title="The rig">
        {pendulum ? (
          <>
            <Slider label="Mass" value={p.mBar} min={1} max={8} step={0.5} unit="kg" onChange={(mBar) => set({ mBar })} />
            <Slider label="Bar length" value={p.length} min={0.6} max={1.7} step={0.05} unit="m" onChange={(length) => set({ length, h: Math.min(p.h, length / 2 - 0.02) })} />
            <Slider label="Pivot to G, h" value={p.h} min={0.04} max={p.length / 2 - 0.02} step={0.02} unit="m" onChange={(h) => set({ h })} />
          </>
        ) : (
          <>
            <Slider label="Wire length L" value={p.L} min={0.2} max={1.2} step={0.01} unit="m" onChange={(L) => set({ L })} />
            <Slider label="Wire radius r" value={p.r} min={0.12} max={0.4} step={0.01} unit="m" onChange={(r) => set({ r })} />
            <Slider label="Platform mass" value={p.mPlatform} min={0.5} max={6} step={0.5} unit="kg" onChange={(mPlatform) => set({ mPlatform })} />
            <Toggle label="Test block on the platform" checked={p.block} onChange={(block) => set({ block })} />
            <Slider label="Block mass" value={p.mBlock} min={0.5} max={8} step={0.5} unit="kg" onChange={(mBlock) => set({ mBlock })} />
            <Slider label="Block radius" value={p.rBlock} min={0.03} max={0.2} step={0.005} unit="m" onChange={(rBlock) => set({ rBlock })} />
          </>
        )}
      </Section>
      {pendulum ? <PeriodChart /> : null}
      <Section title="Working">
        <Working
          steps={
            pendulum
              ? [
                  { label: 'Inertia about the pivot', tex: 'I_O = m g h \\left(\\dfrac{T}{2\\pi}\\right)^2', sub: `=${n(p.mBar, 3)}(9.81)(${n(p.h, 3)})\\left(\\dfrac{${n(T, 4)}}{2\\pi}\\right)^2`, result: `=${n(pendulumInertia(p.mBar, p.h, T), 4)}\\ \\text{kg·m}^2` },
                  { label: 'About the centre of gravity', tex: 'I_G = I_O - m h^2', result: `=${n(pendulumInertia(p.mBar, p.h, T) - p.mBar * p.h * p.h, 4)}\\ \\text{kg·m}^2` },
                ]
              : [
                  { label: 'Inertia of what is on the wires', tex: 'I = \\dfrac{m g r^2}{L}\\left(\\dfrac{T}{2\\pi}\\right)^2', sub: `=\\dfrac{${n(total, 3)}(9.81)(${n(p.r, 3)})^2}{${n(p.L, 3)}}\\left(\\dfrac{${n(T, 4)}}{2\\pi}\\right)^2`, result: `=${n(suspensionInertia(total, p.r, p.L, T), 4)}\\ \\text{kg·m}^2` },
                  { label: 'The body alone', tex: 'I_{\\text{body}} = I_{\\text{platform + body}} - I_{\\text{platform}}' },
                ]
          }
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Mass moment of inertia: Σ m r², in kg·m²: every particle’s mass times its distance from the axis, squared.</li>
          <li>Time 20 swings several times and take the mean, to reduce reaction-time error. Keep the angle small.</li>
          <li>Bodies that cannot be swung directly go on a bifilar or trifilar platform, centre of mass on its axis.</li>
          <li>Trifilar suits flat discs; bifilar suits long bodies. The formula is the same.</li>
        </ExamList>
      </Section>
    </div>
  )
}
