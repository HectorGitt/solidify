import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { PTO_STANDARDS, doubleHooke, doubleHookeRange, trailedJoints, wrapPerSecond, type PtoStd } from '@/physics/linkageControl'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { B1, C, driveline, live, usePtoShaft, type HitchMode, type PtoShaftParams } from './model'

const deg = (r: number) => (r * 180) / Math.PI

function LivePanel() {
  const v = useLive(() => ({ ...live }), 12, (a, b) => a.theta === b.theta)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="PTO speed" value={fmt(v.nIn, 4)} unit="rpm" />
        <Readout label="Telescopic shaft" value={fmt(v.nMid, 4)} unit="rpm" />
        <Readout label="Implement input" value={fmt(v.nOut, 4)} unit="rpm" tone="accent" />
        <Readout label="Joint 1 angle β₁" value={fmt(deg(v.beta1), 3)} unit="°" />
        <Readout label="Joint 2 angle β₂" value={fmt(deg(v.beta2), 3)} unit="°" tone={Math.abs(v.beta1 - v.beta2) > 0.02 ? 'warn' : 'ink'} />
        <Readout label="Joint centres" value={fmt(v.length * 1000, 4)} unit="mm" />
        <Readout label="Tube overlap" value={fmt(v.overlap * 1000, 3)} unit="mm" tone={v.overlap < 0.05 ? 'warn' : 'ink'} />
      </div>
    </Section>
  )
}

const PRESETS: { id: string; label: string; note: string; p: Partial<PtoShaftParams> }[] = [
  { id: 'low', label: 'Mounted · working', note: 'Mower down at working height: small, nearly equal joint angles — almost uniform output.', p: { mode: 'mounted', hitch: 0.45, phaseErr: 0 } },
  { id: 'high', label: 'Mounted · lifted high', note: 'Lifting raises both joint angles and changes the shaft length. Large angles shake the drive — disengage the PTO before lifting high.', p: { mode: 'mounted', hitch: 0.85, phaseErr: 0 } },
  { id: 'bs', label: 'Turn · pin midway (BS 1495)', note: 'Pin midway between the joints: in a 50° turn both joint angles are 25°, so the two joints cancel and the implement turns evenly.', p: { mode: 'trailed', gamma: 50, b2: B1, phaseErr: 0 } },
  { id: 'bad', label: 'Turn · pin not midway', note: 'Implement joint 0.5 m behind the pin: the angles become unequal in the turn and the output speed fluctuates.', p: { mode: 'trailed', gamma: 50, b2: 0.5, phaseErr: 0 } },
  { id: 'phase', label: 'Yokes out of line (90°)', note: 'Intermediate yokes twisted 90°: the fluctuations add instead of cancelling, even with equal angles.', p: { mode: 'trailed', gamma: 50, b2: B1, phaseErr: 90 } },
]

function SpeedChart() {
  const st = usePtoShaft()
  const data = useMemo(() => {
    const d = driveline(st)
    const N = PTO_STANDARDS[st.std].rpm
    const xs: number[] = []
    const mid: number[] = []
    const out: number[] = []
    for (let i = 0; i <= 180; i++) {
      const th = (i / 180) * 2 * Math.PI
      const r = doubleHooke(th, d.beta1, d.beta2, (st.phaseErr * Math.PI) / 180)
      xs.push(i * 2)
      mid.push(N * r.rMid)
      out.push(N * r.rOut)
    }
    return [xs, mid, out, xs.map(() => N)]
  }, [st])
  return (
    <Section title="Output-speed fluctuation over one turn">
      <Chart
        data={data}
        series={[
          { label: 'Telescopic shaft (after joint 1)', color: '#6fb3e0', width: 1.5 },
          { label: 'Implement (after joint 2)', color: '#e8794f', width: 2 },
          { label: 'PTO', color: '#93a59a', width: 1, dash: [4, 4] },
        ]}
        xLabel="PTO angle θ (°)"
        yLabel="rpm"
        marker={() => [((deg(live.theta) % 360) + 360) % 360, live.nOut]}
        height={170}
      />
    </Section>
  )
}

function AngleChart() {
  const st = usePtoShaft()
  const data = useMemo(() => {
    const xs: number[] = []
    const a: number[] = []
    const b: number[] = []
    for (let i = 0; i <= 40; i++) {
      const x = st.mode === 'mounted' ? 0.3 + (0.6 * i) / 40 : -60 + 3 * i
      const d = driveline(st.mode === 'mounted' ? { ...st, hitch: x } : { ...st, gamma: x })
      xs.push(st.mode === 'mounted' ? x * 1000 : x)
      a.push(deg(d.beta1))
      b.push(deg(d.beta2))
    }
    return [xs, a, b]
  }, [st])
  return (
    <Section title={st.mode === 'mounted' ? 'Joint angles vs hitch height' : 'Joint angles vs turn (articulation)'}>
      <Chart
        data={data}
        series={[
          { label: 'β₁ (tractor joint)', color: '#6fb3e0', width: 2 },
          { label: 'β₂ (implement joint)', color: '#e8794f', width: 2, dash: [5, 4] },
        ]}
        xLabel={st.mode === 'mounted' ? 'Hitch height (mm)' : 'Articulation γ (°)'}
        yLabel="Joint angle (°)"
        marker={() => [st.mode === 'mounted' ? st.hitch * 1000 : st.gamma, deg(live.beta1)]}
        height={150}
      />
    </Section>
  )
}

function PtoWorking() {
  const st = usePtoShaft()
  const d = driveline(st)
  const N = PTO_STANDARDS[st.std].rpm
  const one = doubleHookeRange(d.beta1, 0)
  const two = doubleHookeRange(d.beta1, d.beta2, (st.phaseErr * Math.PI) / 180)
  const g = (st.gamma * Math.PI) / 180
  const tj = trailedJoints(B1, st.b2, g)
  const steps: WorkingStep[] = [
    {
      label: 'PTO standard',
      tex: 'N = 540\\ \\text{rpm (6 splines, Ø35 mm)}\\ \\text{or}\\ 1000\\ \\text{rpm (21 splines, Ø44 mm)}',
      result: `\\text{set: } ${PTO_STANDARDS[st.std].rpm}\\ \\text{rpm}`,
      cite: C.std[0],
    },
    {
      label: 'One Hooke’s joint: output speed',
      tex: '\\dfrac{\\omega_B}{\\omega_A} = \\dfrac{\\cos\\beta}{1 - \\sin^2\\beta\\cos^2\\theta},\\quad \\omega_A\\cos\\beta \\le \\omega_B \\le \\dfrac{\\omega_A}{\\cos\\beta}',
      sub: `\\beta_1 = ${n(deg(d.beta1), 3)}^\\circ`,
      result: `${n(N * one.lo, 4)} \\le N_B \\le ${n(N * one.hi, 4)}\\ \\text{rpm}`,
      cite: SRC.hj502('velocity ratio'),
    },
    {
      label: 'Two joints: equal angles, coplanar, yokes in line → uniform',
      tex: '\\beta_1 = \\beta_2,\\ \\text{intermediate yokes in line} \\Rightarrow \\omega_{out} = \\omega_{in}',
      sub: `\\beta_1 = ${n(deg(d.beta1), 3)}^\\circ,\\ \\beta_2 = ${n(deg(d.beta2), 3)}^\\circ,\\ \\text{yoke twist } ${n(st.phaseErr, 3)}^\\circ`,
      result: `${n(N * two.lo, 4)} \\le N_{out} \\le ${n(N * two.hi, 4)}\\ \\text{rpm}`,
      cite: C.uj[0],
    },
    {
      label: 'BS 1495: hitch pin midway between the joints',
      tex: 'b_1 = b_2 \\Rightarrow \\beta_1 = \\beta_2 = \\gamma/2',
      sub: `b_1 = ${n(B1, 3)},\\ b_2 = ${n(st.b2, 3)}\\ \\text{m},\\ \\gamma = ${n(st.gamma, 3)}^\\circ`,
      result: `\\beta_1 = ${n(deg(tj.beta1), 3)}^\\circ,\\ \\beta_2 = ${n(deg(tj.beta2), 3)}^\\circ`,
      cite: C.uj[0],
    },
    {
      label: 'Why guard it: string wrapped per second',
      tex: 'l = \\pi D N / 60',
      sub: `= \\pi\\times0.075\\times${N}/60`,
      result: `= ${n(wrapPerSecond(0.075, N), 3)}\\ \\text{m/s}\\ (${n(wrapPerSecond(0.075, N) / 0.3048, 2)}\\ \\text{ft/s; about 7 ft in 1 s at 540 rpm})`,
      cite: C.guard[1],
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function PtoShaftPanel() {
  const st = usePtoShaft()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<PtoShaftParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Hitch">
        <Segmented<HitchMode>
          value={st.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'mounted', label: 'Mounted mower (3-point)' },
            { value: 'trailed', label: 'Trailed machine (drawbar)' },
          ]}
        />
        {st.mode === 'mounted' ? (
          <Slider label="Hitch height" value={st.hitch} min={0.3} max={0.9} step={0.005} unit="m" digits={3} onChange={(hitch) => set({ hitch })} />
        ) : (
          <>
            <Slider label="Turn (articulation γ)" value={st.gamma} min={-60} max={60} step={1} unit="°" onChange={(gamma) => set({ gamma })} />
            <Slider label="Implement joint behind pin b₂" value={st.b2} min={0.1} max={0.6} step={0.01} unit="m" digits={3} onChange={(b2) => set({ b2 })} hint={`Midway (BS 1495): b₂ = b₁ = ${fmt(B1, 2)} m`} />
          </>
        )}
        <Segmented<PtoStd> label="PTO standard" value={st.std} onChange={(std) => set({ std })} options={[{ value: '540', label: '540 rpm · 6 spl' }, { value: '1000', label: '1000 rpm · 21 spl' }]} />
        <Slider label="Twist between intermediate yokes" value={st.phaseErr} min={0} max={90} step={1} unit="°" onChange={(phaseErr) => set({ phaseErr })} />
        <Toggle label="Guards" checked={st.guards} onChange={(guards) => st.set({ guards })} />
      </Section>
      <Section title="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                st.set(p.p)
                setPreset(p.id)
              }}
              className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${preset === p.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{PRESETS.find((p) => p.id === preset)?.note}</p> : null}
      </Section>
      <SpeedChart />
      <AngleChart />
      <PtoWorking />
      <Section title="Guards & safety">
        <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] leading-snug text-mute">
          <li>Tractor master shield over the stub must support 114 kg (250 lb).</li>
          <li>Guard the shaft up to the implement’s first bearing; guard cones and tubes ride on plastic bearing bushes.</li>
          <li>A 540 rpm shaft wraps 7 ft of hood string in one second — never step over a turning shaft.</li>
        </ul>
      </Section>
    </div>
  )
}
