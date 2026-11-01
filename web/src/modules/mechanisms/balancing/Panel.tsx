import { useMemo, useState } from 'react'
import { TestBench, slopeThroughOrigin } from '@/lab/run'
import { Chart } from '@/ui/Chart'
import { ballsToBalance } from '@/physics/machinedynamics'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../_shared/rig'
import { BALANCE_PROC, DEFAULTS, analyse, balanceRun, deg, useBalance, type Correction } from './model'

const set = (p: Parameters<ReturnType<typeof useBalance.getState>['set']>[0]) => useBalance.getState().set(p)

export const PRESETS: Preset[] = [
  { id: 'ex1', label: 'Worked example', note: '5, 7 and 12 kg at 30, 45 and 25 mm, at 0°, 52° and 220°: out of balance by 0.1266 kg·m at 26°. A 3.16 kg mass at 40 mm, at 206°, balances it.', apply: () => set({ ...DEFAULTS }) },
  {
    id: 'crank',
    label: 'Static but not dynamic',
    note: 'Two equal masses, 180° apart at either end. The force cancels, so it sits still in its bearings when not turning, but it rocks hard at speed.',
    apply: () =>
      set({
        ...DEFAULTS,
        rows: [
          { m: 8, r: 40, angle: 0, z: 150 },
          { m: 8, r: 40, angle: 180, z: 650 },
          { m: 0.001, r: 10, angle: 0, z: 400 },
        ],
      }),
  },
  {
    id: 'crankshaft',
    label: 'Balanced crank throws',
    note: 'A mirror-image arrangement, like a four-cylinder crankshaft: both force and couple cancel with nothing added.',
    apply: () =>
      set({
        ...DEFAULTS,
        rows: [
          { m: 8, r: 40, angle: 0, z: 200 },
          { m: 16, r: 40, angle: 180, z: 400 },
          { m: 8, r: 40, angle: 0, z: 600 },
        ],
      }),
  },
]

/** the mr polygon: each mass’s vector, nose to tail; the gap is the out-of-balance */
function Polygon() {
  const p = useBalance()
  const a = useMemo(() => analyse(p), [p])
  const pts: [number, number][] = [[0, 0]]
  for (const q of [...a.ms, ...a.added]) {
    const [x, y] = pts[pts.length - 1]
    pts.push([x + q.m * q.r * Math.cos(q.angle), y + q.m * q.r * Math.sin(q.angle)])
  }
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6) * 1.25
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2
  const S = (q: [number, number]) => [100 + ((q[0] - cx) / span) * 200, 90 - ((q[1] - cy) / span) * 170]
  const last = pts[pts.length - 1]
  const closed = Math.hypot(last[0], last[1]) < 1e-6
  return (
    <svg viewBox="0 0 200 180" className="mx-auto w-full max-w-[280px]" role="img" aria-label="The m r polygon">
      {pts.slice(0, -1).map((q, i) => {
        const [x1, y1] = S(q)
        const [x2, y2] = S(pts[i + 1])
        const correction = i >= a.ms.length
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={correction ? '#4d7c0f' : '#d0631c'} strokeWidth={2.2} strokeLinecap="round" />
      })}
      {closed ? null : (() => {
        const [x1, y1] = S(last)
        const [x2, y2] = S([0, 0])
        return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2f6fd0" strokeWidth={2} strokeDasharray="5 3" />
      })()}
    </svg>
  )
}

/** The bench test: bring the shaft up to speed in steps, reading the shaking. */
function BalanceTest() {
  const p = useBalance()
  const rows = balanceRun((s) => s.rows)
  const status = balanceRun((s) => s.status)
  const a = useMemo(() => analyse(p), [p])
  const w2 = rows.map((r) => ((r[0] * 2 * Math.PI) / 60) ** 2)
  const found = slopeThroughOrigin(w2, rows.map((r) => r[1]))
  return (
    <TestBench run={balanceRun} steps={BALANCE_PROC.steps} title="The test: bring it up to speed" head={['Speed (rpm)', 'Bearing force (N)', 'Couple (N·m)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[rows.map((r) => r[0]), rows.map((r) => r[1]), rows.map((r) => r[2])]} series={[{ label: 'Force', color: '#e8794f', width: 2 }, { label: 'Couple', color: '#6fb3e0', width: 1.5 }]} xLabel="Speed (rpm)" yLabel="N, N·m" height={120} />
          {status === 'done' ? (
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              <Readout label="m r from the test" value={fmt(found, 3)} unit="kg·m" tone="accent" />
              <Readout label="m r on the rig" value={fmt(a.leftMr, 3)} unit="kg·m" />
            </div>
          ) : null}
          {status === 'done' ? <Note>Force grows with the square of the speed: twice the speed, four times the force.</Note> : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function BalancingPanel() {
  const p = useBalance()
  const [preset, setPreset] = useState<string | null>('ex1')
  const a = useMemo(() => analyse(p), [p])
  const w = (p.rpm * 2 * Math.PI) / 60
  const raw = a.ms.reduce(
    (s, q) => {
      s.x += q.m * q.r * Math.cos(q.angle)
      s.y += q.m * q.r * Math.sin(q.angle)
      return s
    },
    { x: 0, y: 0 },
  )
  return (
    <div>
      <BalanceTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Left: m r" value={fmt(a.leftMr, 3)} unit="kg·m" tone="warn" />
          <Readout label="Bearing force" value={fmt(a.leftMr * w * w, 3)} unit="N" tone="accent" />
          <Readout label="Left: couple" value={fmt(a.couple * w * w, 3)} unit="N·m" tone="info" />
        </div>
      </Section>
      <Section title="Correction">
        <Segmented<Correction>
          value={p.correction}
          onChange={(correction) => set({ correction })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'static', label: 'One mass' },
            { value: 'dynamic', label: 'Two planes' },
          ]}
        />
        <Slider label="Shaft speed" value={p.rpm} min={30} max={600} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Slider label="Correction radius" value={p.rb} min={20} max={80} step={5} unit="mm" onChange={(rb) => set({ rb })} />
        <Note>One mass cancels the force but not the couple. Watch the plate stop shaking, yet keep rocking.</Note>
      </Section>
      <Section title="The m r polygon">
        <Polygon />
        <Note>Orange: the masses, nose to tail. Green: the correction. Blue dashed: what is left. A closed polygon means the force is balanced.</Note>
      </Section>
      <Section title="The masses">
        {p.rows.map((r, i) => (
          <div key={i} className="mb-2 border-b border-line pb-1">
            <div className="mb-1 text-[11.5px] font-medium text-ink/90">Block {i + 1}</div>
            <Slider label="Mass" value={r.m} min={0} max={20} step={0.5} unit="kg" onChange={(m) => useBalance.getState().setRow(i, { m })} />
            <Slider label="Radius" value={r.r} min={10} max={80} step={5} unit="mm" onChange={(v) => useBalance.getState().setRow(i, { r: v })} />
            <Slider label="Angle" value={r.angle} min={0} max={360} step={1} unit="°" onChange={(angle) => useBalance.getState().setRow(i, { angle })} />
            <Slider label="Along the shaft" value={r.z} min={100} max={700} step={25} unit="mm" onChange={(z) => useBalance.getState().setRow(i, { z })} />
          </div>
        ))}
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Experiment: balls to lift each disc">
        <Table
          head={['Block', 'm r (kg·m)', 'Balls to 90°']}
          rows={p.rows.map((r, i) => [String(i + 1), fmt((r.m * r.r) / 1000, 3), r.m > 0.01 ? fmt(ballsToBalance((r.m * r.r) / 1000, 0.002, 0.05), 3) : '–'])}
        />
        <Note>Balls of 2 g on a 50 mm pulley. Hang balls until the disc’s block turns through 90° on the protractor, tapping the shaft to overcome bearing friction. A bigger disc takes more balls. The rig’s own disc sizes differ, so this table gives its proportion, not the bench’s counts.</Note>
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Resolve along x', tex: '\\sum m r\\cos\\theta', result: `=${n(raw.x, 4)}\\ \\text{kg·m}` },
            { label: 'Resolve along y', tex: '\\sum m r\\sin\\theta', result: `=${n(raw.y, 4)}\\ \\text{kg·m}` },
            { label: 'Out-of-balance', tex: 'm_b r_b = \\sqrt{(\\sum m r\\cos\\theta)^2 + (\\sum m r\\sin\\theta)^2}', result: `=${n(a.single.mbrb, 4)}\\ \\text{kg·m}` },
            { label: 'Balancing mass, opposite it', tex: 'm_b = \\dfrac{m_b r_b}{r_b}', sub: `=\\dfrac{${n(a.single.mbrb, 4)}}{${n(p.rb / 1000, 3)}}`, result: `=${n(a.single.mb, 3)}\\ \\text{kg at } ${n(deg(a.single.angle), 4)}^\\circ` },
            { label: 'Force on the bearings, unbalanced', tex: 'F = m r \\omega^2', sub: `=${n(a.single.mbrb, 4)}(${n(w, 4)})^2`, result: `=${n(a.single.mbrb * w * w, 4)}\\ \\text{N}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Static balance: the centre of mass lies on the axis, so ΣF = 0. Dynamic balance adds no resultant couple: ΣM = 0 as well.</li>
          <li>A dynamically balanced shaft is always statically balanced; the reverse is false.</li>
          <li>Inertia forces should not reach the bearings: they vary with time, cause vibration, noise and fatigue, and grow with ω².</li>
          <li>Masses in different planes need correcting in at least two planes.</li>
        </ExamList>
      </Section>
    </div>
  )
}
