import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { cylinderCycleAngle, strokeAt, type FourStroke } from '@/physics/engine'
import { crankBalance, cylindersOnPower, dominantStroke, firingChart, firingGaps, orderFromFiring, powerOverlap, throwAngles } from '@/physics/engineExtra'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n as num, type WorkingStep } from '@/ui/Working'
import { COUNTS, DIM, LAYOUTS, STROKE_COLOR, currentLayout, cylZ, firingInterval, live, torqueCurve, useMulti, type CylCount } from './model'

const SHORT: Record<FourStroke, string> = { intake: 'I', compression: 'C', power: 'P', exhaust: 'E' }
const LONG: Record<FourStroke, string> = { intake: 'Intake', compression: 'Compression', power: 'Power', exhaust: 'Exhaust' }

interface Preset {
  id: string
  label: string
  n: CylCount
  layout: string
  note: string
}

const PRESETS: Preset[] = [
  { id: 'tb-q12', label: 'Firing chart · 4-cyl 1-3-4-2', n: 4, layout: '1-3-4-2', note: 'Complete the firing chart for 1-3-4-2 given cylinder 1 runs Power → Exhaust → Intake → Compression. Read the other columns off the chart below.' },
  { id: 'l4', label: '4-cyl 1-2-4-3', n: 4, layout: '1-2-4-3', note: 'The other standard four-cylinder order. Same crankshaft (1 & 4, 2 & 3 together) — only the valve and injection timing differ.' },
  { id: 'exam-6', label: 'Exam 21/22 · 6-cyl 1-6-3-5-2-4', n: 6, layout: '1-6-3-5-2-4', note: 'Exam 2021/22 Q3b(iii): firing chart for a six-cylinder engine with firing order 1-6-3-5-2-4. Interval 720°/6 = 120°.' },
  { id: 'exam-letters', label: 'Exam 17/18 · A-D-C-B-F-E', n: 6, layout: '1-4-3-2-6-5', note: 'Exam 2017/18: show the sequence of power strokes for the order A-D-C-B-F-E, i.e. 1-4-3-2-6-5.' },
  { id: 'exam-8', label: 'Exam 22/23 · 8-cyl genset', n: 8, layout: '1-7-5-3-8-6-2-4', note: 'Exam 2022/23 Q2(a): 100 kVA 8-cylinder genset, firing order 1-7-5-3-8-6-2-4 — describe the firing sequence on a chart. Interval 720°/8 = 90°; two cylinders are always on power.' },
]

function LivePanel() {
  const st = useMulti()
  const layout = currentLayout(st.n, st.layout)
  const v = useLive(() => ({ theta: live.theta, last: live.lastFired, since: live.sinceFire }), 15, (a, b) => a.theta === b.theta)
  const order = layout.order
  const idx = order.indexOf(v.last)
  const next = order[(idx + 1) % order.length]
  const onPower = cylindersOnPower(layout.firing, v.theta)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Crank angle" value={`${Math.round(v.theta)}°`} unit="of 720" />
        <Readout label="Last fired" value={`Cyl ${v.last}`} unit={`${Math.round(v.since)}° ago`} tone="warn" />
        <Readout label="Next" value={`Cyl ${next}`} tone="accent" />
        <Readout label="Interval" value={`${fmt(firingInterval(st.n), 3)}°`} unit="720°/n" />
        <Readout label="On power" value={onPower.join(', ') || '—'} tone="warn" />
        <Readout label="Order" value={<span className="text-[12px]">{order.join('-')}</span>} />
      </div>
    </Section>
  )
}

function FiringChart({ transpose }: { transpose: boolean }) {
  const st = useMulti()
  const layout = currentLayout(st.n, st.layout)
  const step = firingInterval(st.n) >= 180 ? 180 : firingInterval(st.n)
  const rows = useMemo(() => firingChart(layout.firing, step), [layout, step])
  const theta = useLive(() => live.theta, 20)
  const cur = Math.floor(theta / step) % rows.length
  const cyls = Array.from({ length: st.n }, (_, i) => i + 1)
  const cell = (r: number, c: number) => {
    const segs = rows[r].cells[c]
    const dom = dominantStroke(segs)
    const bg =
      segs.length === 1
        ? STROKE_COLOR[dom]
        : `linear-gradient(${transpose ? 90 : 180}deg, ${segs.map((s) => `${STROKE_COLOR[s.stroke]} ${(((s.from - rows[r].from) / step) * 100).toFixed(0)}% ${(((s.to - rows[r].from) / step) * 100).toFixed(0)}%`).join(', ')})`
    const fires = rows[r].fires.includes(c + 1)
    return (
      <td key={`${r}-${c}`} className="border border-line px-0.5 py-1 text-center" style={{ background: bg, opacity: r === cur ? 1 : 0.55, outline: r === cur && fires ? '2px solid #fff1c9' : undefined }} title={segs.map((s) => `${LONG[s.stroke]} ${Math.round(s.from)}–${Math.round(s.to)}°`).join(' then ')}>
        <span className="font-mono text-[11px] font-semibold text-[#0c110f]">{segs.map((s) => SHORT[s.stroke]).join('/')}</span>
      </td>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="border border-line px-1 py-0.5 text-left font-medium text-mute">{transpose ? 'Cyl' : 'Crank travel'}</th>
            {transpose
              ? rows.map((r, i) => (
                  <th key={i} className={`border border-line px-0.5 py-0.5 font-mono font-normal ${i === cur ? 'text-accent' : 'text-mute'}`}>
                    {Math.round(r.to)}°
                  </th>
                ))
              : cyls.map((c) => (
                  <th key={c} className="border border-line px-0.5 py-0.5 font-medium text-ink/90">
                    {c}
                  </th>
                ))}
          </tr>
        </thead>
        <tbody>
          {transpose
            ? cyls.map((c) => (
                <tr key={c}>
                  <td className="border border-line px-1 font-medium text-ink/90">{c}</td>
                  {rows.map((_, r) => cell(r, c - 1))}
                </tr>
              ))
            : rows.map((row, r) => (
                <tr key={r}>
                  <td className={`border border-line px-1 font-mono ${r === cur ? 'text-accent' : 'text-mute'}`}>
                    {Math.round(row.from)}–{Math.round(row.to)}°
                  </td>
                  {cyls.map((c) => cell(r, c - 1))}
                </tr>
              ))}
        </tbody>
      </table>
      <div className="mt-1.5 flex flex-wrap gap-2 text-[10.5px] text-mute">
        {(['power', 'exhaust', 'intake', 'compression'] as FourStroke[]).map((s) => (
          <span key={s}>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: STROKE_COLOR[s] }} />
            {SHORT[s]} = {LONG[s]}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Standard firing-chart layout (cylinder 1 on power for the first 180°). Rows are {step}° of crank travel; a split cell means the cylinder changes stroke part-way through
        that interval. The highlighted row follows the crank; an outlined cell is a cylinder firing in that interval.
      </p>
    </div>
  )
}

function TorqueChart() {
  const st = useMulti()
  const layout = currentLayout(st.n, st.layout)
  const tc = useMemo(() => torqueCurve(layout, 2), [layout])
  const data = useMemo(() => [tc.xs, tc.total, tc.first, tc.xs.map(() => tc.mean)], [tc])
  const idx = (th: number) => Math.min(tc.xs.length - 1, Math.round(th / 2))
  return (
    <Section title="Crankshaft torque (gas forces)" right={<Badge tone="info" title="Air-standard Diesel cycle, r = 16; inertia ignored">indicative</Badge>}>
      <Chart
        data={data}
        series={[
          { label: 'All cylinders', color: '#e8794f', width: 2 },
          { label: 'Cylinder 1', color: '#6fb3e0', width: 1.25, dash: [4, 3] },
          { label: 'Mean', color: '#9bd17a', width: 1, dash: [2, 3] },
        ]}
        xLabel="Crank angle (deg)"
        yLabel="Torque (N·m)"
        xRange={[0, 720]}
        marker={() => [live.theta, tc.total[idx(live.theta)]]}
        height={170}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Orange: the sum of every cylinder’s gas torque; blue dashed: cylinder 1 alone. More cylinders give more frequent, overlapping power strokes and a smoother torque — an even flow of power.
        Swing {fmt(tc.max - tc.min, 3)} N·m about a mean of {fmt(tc.mean, 3)} N·m.
      </p>
    </Section>
  )
}

function Balance() {
  const st = useMulti()
  const layout = currentLayout(st.n, st.layout)
  const b = useMemo(() => crankBalance(throwAngles(layout.firing), Array.from({ length: st.n }, (_, i) => cylZ(i + 1, st.n)), DIM.pitch), [layout, st.n])
  const tag = (v: number) => (v < 1e-6 ? <span className="text-accent">balanced</span> : <span className="text-warn">{fmt(v, 2)}</span>)
  const throws = throwAngles(layout.firing)
  return (
    <Section title="Throws & balance" right={<Badge tone="info" title="Inertia balance of the crank — standard theory">indicative</Badge>}>
      <div className="mb-1.5 flex flex-wrap gap-1 text-[11px]">
        {throws.map((t, i) => (
          <span key={i} className="rounded border border-line-2 px-1.5 py-px font-mono text-ink/85">
            {i + 1}: {Math.round(t)}°
          </span>
        ))}
      </div>
      <table className="w-full text-[11.5px] text-ink/85">
        <tbody>
          <tr>
            <td className="py-0.5 text-mute">Primary force</td>
            <td className="text-right font-mono">{tag(b.primaryForce)}</td>
            <td className="pl-3 text-mute">Primary couple</td>
            <td className="text-right font-mono">{tag(b.primaryCouple)}</td>
          </tr>
          <tr>
            <td className="py-0.5 text-mute">Secondary force</td>
            <td className="text-right font-mono">{tag(b.secondaryForce)}</td>
            <td className="pl-3 text-mute">Secondary couple</td>
            <td className="text-right font-mono">{tag(b.secondaryCouple)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Throw angle = firing angle mod 360°: cylinders that fire 360° apart share a throw. A proper firing order reduces engine vibration and maintains engine balance. {layout.note ?? ''}
      </p>
    </Section>
  )
}

function FiringWorking() {
  const st = useMulti()
  const layout = currentLayout(st.n, st.layout)
  const fi = firingInterval(st.n)
  const gaps = firingGaps(layout.firing)
  const even = gaps.every((g) => Math.abs(g - fi) < 1e-9)
  const ov = powerOverlap(layout.firing)
  const steps: WorkingStep[] = [
    {
      label: 'Firing interval (four-stroke)',
      tex: '\\theta_f = \\dfrac{720^\\circ}{n}',
      sub: `= \\dfrac{720^\\circ}{${st.n}}`,
      result: `= ${num(fi, 4)}^\\circ`,
      cite: SRC.tb509('p11'),
    },
    {
      label: 'Crank angle at which each cylinder starts its power stroke',
      tex: '\\varphi_k = (k-1)\\,\\theta_f\\quad\\text{for the }k\\text{-th cylinder in the firing order}',
      sub: orderFromFiring(layout.firing)
        .map((c) => `${c}\\!:\\,${num(layout.firing[c - 1], 3)}^\\circ`)
        .join(',\\;'),
      result: even ? `\\text{even firing, every } ${num(fi, 3)}^\\circ` : `\\text{gaps } ${gaps.map((g) => num(g, 3) + '^\\circ').join(', ')}\\;(\\text{uneven})`,
      cite: SRC.tb509('§2.6.4'),
    },
    {
      label: 'Stroke of cylinder c at crank angle θ',
      tex: '\\psi_c = (\\theta - \\varphi_c + 360^\\circ) \\bmod 720^\\circ:\\; 0\\text{–}180\\,I,\\;180\\text{–}360\\,C,\\;360\\text{–}540\\,P,\\;540\\text{–}720\\,E',
      sub: `\\theta = 0^\\circ:\\; ${layout.firing.map((f, i) => `${i + 1}\\,${SHORT[strokeAt(cylinderCycleAngle(0.01, f))]}`).join(',\\;')}`,
      result: `\\text{cylinders on power at once: } ${ov.min === ov.max ? ov.min : `${ov.min}\\text{–}${ov.max}`}`,
      cite: SRC.tb509('Table 2.3'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function MultiPanel() {
  const st = useMulti()
  const [preset, setPreset] = useState<string | null>(null)
  const [transpose, setTranspose] = useState(false)
  const layouts = LAYOUTS[st.n]
  const layout = currentLayout(st.n, st.layout)
  return (
    <div>
      <LivePanel />
      <Section title="Engine">
        <Segmented<string>
          label="Cylinders"
          value={String(st.n)}
          onChange={(v) => {
            setPreset(null)
            st.set({ n: Number(v) as CylCount })
          }}
          options={COUNTS.map((c) => ({ value: String(c), label: String(c) }))}
        />
        <div className="mb-1 text-[12.5px] text-ink/90">Firing order</div>
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          {layouts.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setPreset(null)
                st.set({ layout: l.id })
              }}
              className={`rounded-md border px-2 py-1 text-left text-[12px] ${layout.id === l.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
            >
              <div className="font-mono">{l.label}</div>
              <div className="flex items-center gap-1 text-[10.5px] text-dim">
                {l.source}
                {l.beyond ? <Badge tone="info">indicative</Badge> : null}
              </div>
            </button>
          ))}
        </div>
        <Slider label="Engine speed" value={st.rpm} min={100} max={2400} step={10} unit="rpm" onChange={(rpm) => st.set({ rpm })} />
        <Toggle label="Show cylinder gas (coloured by stroke)" checked={st.gas} onChange={(gas) => st.set({ gas })} />
      </Section>
      <Section title="Exam presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                st.set({ n: p.n, layout: p.layout })
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
      <Section
        title="Firing chart"
        right={
          <button className="text-[11px] text-info hover:underline" onClick={() => setTranspose((t) => !t)}>
            {transpose ? 'rows = crank travel' : 'rows = cylinders'}
          </button>
        }
      >
        <FiringChart transpose={transpose} />
      </Section>
      <TorqueChart />
      <Balance />
      <FiringWorking />
    </div>
  )
}
