import { useMemo, useState } from 'react'
import { deg, doubleHooke, doubleHookeRange, hitchJointAngles, hookeDrivenSpeed, hookeSpeedRange, hookeVelocityRatio, rad } from '@/physics/joints'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { HJ2 } from '../shared/cites'
import { DEFAULTS, GUIDE_SECOND, TURN_SPAN, curves, effectiveSpec, live, useDC, type Arrangement, type DCParams, type Mode } from './model'

interface Preset {
  id: string
  label: string
  note: string
  params: Partial<DCParams>
}

const PRESETS: Preset[] = [
  {
    id: 'uniform',
    label: 'All three conditions met',
    note: 'One plane, equal 20° angles, intermediate yokes in line: the output turns exactly with the input although the intermediate shaft still swings 939.7–1064 rpm.',
    params: { mode: 'rig', delta1: 20, delta2: 20, equal: true, phase: 0, twist: 0, arrangement: 'W' },
  },
  {
    id: 'phase90',
    label: 'Yokes 90° out of line',
    note: 'The second joint now adds to the fluctuation instead of cancelling it: ω_out/ω_in swings between cos²δ = 0.883 and 1/cos²δ = 1.133.',
    params: { mode: 'rig', delta1: 20, delta2: 20, equal: true, phase: 90, twist: 0 },
  },
  {
    id: 'plane',
    label: 'Shafts not in one plane',
    note: 'Joint 2 bends in a plane twisted 90° about the intermediate shaft. With the yokes still in line this behaves exactly like yokes 90° out of phase.',
    params: { mode: 'rig', delta1: 20, delta2: 20, equal: true, phase: 0, twist: 90 },
  },
  {
    id: 'guide15',
    label: '2017/18 Q4(d) · 20° then 15°',
    note: 'The second shaft is inclined 15° to the first driven shaft. The marking scheme’s tables are below; the chart shows the true combined motion with the yokes in line.',
    params: { mode: 'rig', delta1: 20, delta2: 15, equal: false, phase: 0, twist: 0, arrangement: 'Z', rpm: 1000 },
  },
  {
    id: 'turn-mid',
    label: 'Turning, hitch midway',
    note: 'Implement turned 40° with the hitch pin midway between the joints: both joints take 20°, so the implement still turns uniformly.',
    params: { mode: 'turn', psi: 40, hitch: 0.5 },
  },
  {
    id: 'turn-off',
    label: 'Turning, hitch not midway',
    note: 'Same 40° turn with the hitch pin a quarter of the way back: the angles become unequal and the implement shaft speed fluctuates — what BS 1495 sets out to avoid.',
    params: { mode: 'turn', psi: 40, hitch: 0.25 },
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 20, (a, b) => a.theta === b.theta)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Input θ" value={`${Math.round(v.theta)}°`} />
        <Readout label="Intermediate" value={fmt(v.omegaC, 4)} unit="rpm" tone={v.ratioC >= 1 ? 'warn' : 'info'} />
        <Readout label="Output" value={fmt(v.omegaOut, 4)} unit="rpm" tone="accent" />
        <Readout label="ω_C / ω_A" value={v.ratioC.toFixed(4)} />
        <Readout label="ω_out / ω_A" value={v.ratio.toFixed(4)} tone="accent" />
        <Readout label="Output − input" value={`${v.lag >= 0 ? '+' : ''}${v.lag.toFixed(2)}°`} />
      </div>
    </Section>
  )
}

function Conditions() {
  const st = useDC()
  const spec = effectiveSpec(st)
  const r = doubleHookeRange(spec)
  const ok = [
    { label: 'All three shafts in one plane', pass: Math.abs(spec.twist ?? 0) < 1e-6 },
    { label: 'Equal joint angles', pass: Math.abs(spec.delta1 - spec.delta2) < 1e-6 },
    { label: 'Intermediate yokes in line', pass: Math.abs(Math.sin(spec.phase)) < 1e-6 },
  ]
  return (
    <Section title="Conditions for uniform output">
      <ul className="space-y-1 text-[12px]">
        {ok.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            <Badge tone={c.pass ? 'accent' : 'warn'}>{c.pass ? 'yes' : 'no'}</Badge>
            <span className="text-ink/90">{c.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[11.5px] leading-snug text-mute">
        Output speed range {fmt(r.min, 5)}–{fmt(r.max, 5)} × input ({r.fluctuation < 1e-6 ? 'uniform' : `${fmt(r.fluctuation * 100, 3)} % fluctuation`}). Joint angles δ₁ = {fmt(deg(spec.delta1), 3)}°,
        δ₂ = {fmt(deg(spec.delta2), 3)}°.
      </p>
      <p className="mt-1 text-[11px] leading-snug text-dim">
        A plane twist γ acts exactly like a yoke phase error of γ, so out-of-plane shafts can be corrected by re-phasing the yokes — but the simple rule is to keep everything in one plane.
      </p>
    </Section>
  )
}

function TurnPlan() {
  const psi = useDC((s) => s.psi)
  const hitch = useDC((s) => s.hitch)
  const a = TURN_SPAN * hitch
  const h = hitchJointAngles(a, TURN_SPAN - a, rad(psi))
  const S = 150
  const ox = 30
  const oy = 70
  const P = (x: number, z: number) => [ox + x * S, oy - z * S] as const
  const H = P(a, 0)
  const J2 = P(a + (TURN_SPAN - a) * Math.cos(rad(psi)), -(TURN_SPAN - a) * Math.sin(rad(psi)))
  const imp = P(a + 1.0 * Math.cos(rad(psi)), -1.0 * Math.sin(rad(psi)))
  return (
    <svg viewBox="0 0 220 150" width="100%" height={150} role="img" aria-label="Plan view of the PTO shaft in a turn">
      <rect x={0} y={oy - 30} width={ox} height={60} fill="#2f6b3a" opacity={0.6} rx={3} />
      <text x={4} y={oy - 34} fontSize={9} fill="#93a59a">tractor</text>
      <line x1={ox} y1={oy} x2={H[0]} y2={H[1]} stroke="#93a59a" strokeDasharray="3 3" />
      <line x1={H[0]} y1={H[1]} x2={imp[0]} y2={imp[1]} stroke="#d9a21b" strokeWidth={3} opacity={0.7} />
      <line x1={ox} y1={oy} x2={J2[0]} y2={J2[1]} stroke="#e6eaee" strokeWidth={3} />
      <circle cx={ox} cy={oy} r={4} fill="#f5b942" />
      <circle cx={J2[0]} cy={J2[1]} r={4} fill="#f5b942" />
      <circle cx={H[0]} cy={H[1]} r={3} fill="#e8794f" />
      <text x={H[0] + 4} y={H[1] - 5} fontSize={9} fill="#e8794f">hitch</text>
      <text x={ox + 6} y={oy + 14} fontSize={9} fill="#f5b942">δ₁ {deg(h.delta1).toFixed(1)}°</text>
      <text x={J2[0] + 6} y={J2[1] + 4} fontSize={9} fill="#f5b942">δ₂ {deg(h.delta2).toFixed(1)}°</text>
      <text x={imp[0] - 40} y={imp[1] + 14} fontSize={9} fill="#d9a21b">implement</text>
    </svg>
  )
}

function Charts() {
  const st = useDC()
  const spec = useMemo(() => effectiveSpec(st), [st])
  const c = useMemo(() => curves(spec), [spec])
  return (
    <Section title="Speeds over one revolution">
      <Chart
        data={[c.xs, c.c, c.o]}
        series={[
          { label: 'intermediate ω_C/ω_A', color: '#6fb3e0', width: 1.5, dash: [5, 4] },
          { label: 'output ω_out/ω_A', color: '#9bd17a', width: 2.2 },
        ]}
        xLabel="Input angle θ (°)"
        yLabel="Speed ratio"
        marker={() => [live.theta, live.ratio]}
        height={180}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Dashed: the intermediate shaft (joint 1 alone). Solid: the output after joint 2. When the conditions hold, the second joint slows the output exactly as much as the first sped up the
        intermediate shaft — the speed lost or gained by one half equals that gained or lost by the second half.
      </p>
    </Section>
  )
}

const THETAS = [10, 20, 30, 40, 50, 60, 70, 80, 90]

function GuideTable() {
  const [row, setRow] = useState(0)
  const [wb, guide] = GUIDE_SECOND[row]
  return (
    <Section title="Marking-scheme tables: second joint at 15°">
      <Segmented<string>
        size="sm"
        value={String(row)}
        onChange={(v) => setRow(Number(v))}
        options={GUIDE_SECOND.map(([w], i) => ({ value: String(i), label: `${w}`, title: `ω_B = ${w} rpm taken as a steady input` }))}
      />
      <table className="w-full font-mono text-[11.5px]">
        <thead className="text-dim">
          <tr>
            <th className="text-left font-normal">θ</th>
            <th className="text-right font-normal">scheme</th>
            <th className="text-right font-normal">ω_B·ratio(15°)</th>
            <th className="text-right font-normal">true output</th>
          </tr>
        </thead>
        <tbody>
          {THETAS.map((t, i) => {
            const method = hookeDrivenSpeed(wb, rad(15), rad(t))
            const truth = 1000 * doubleHooke({ delta1: rad(20), delta2: rad(15), phase: 0 }, rad(t)).ratio
            return (
              <tr key={t} className="text-ink/90">
                <td>{t}°</td>
                <td className="text-right text-mute">{guide[i]}</td>
                <td className="text-right text-accent">{method.toFixed(1)}</td>
                <td className="text-right">{truth.toFixed(1)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] leading-snug text-mute">
        The scheme takes ω_B = {wb} rpm as a steady input and re-uses θ for the second joint; the middle column reproduces its numbers. Strictly the intermediate shaft is not steady and joint 2 is
        driven by the intermediate shaft’s angle: the right-hand column is the true output of the 20° + 15° pair at 1000 rpm with the yokes in line (a 15° second joint can only partly cancel a
        20° first one).
      </p>
    </Section>
  )
}

function DCWorking() {
  const st = useDC()
  const spec = effectiveSpec(st)
  const th = rad(30)
  const d = doubleHooke(spec, th)
  const r1 = hookeSpeedRange(st.rpm, spec.delta1)
  const thetaC = d.thetaC
  const q = Math.PI / 2 + spec.phase - (spec.twist ?? 0)
  const steps: WorkingStep[] = [
    {
      label: 'Joint 1 (θ = 30°): intermediate shaft speed',
      tex: '\\dfrac{\\omega_C}{\\omega_A} = \\dfrac{\\cos\\delta_1}{1-\\sin^2\\delta_1\\cos^2\\theta}',
      sub: `= \\dfrac{\\cos ${n(deg(spec.delta1), 3)}^\\circ}{1-\\sin^2 ${n(deg(spec.delta1), 3)}^\\circ\\cos^2 30^\\circ}`,
      result: `= ${n(d.ratioC, 5)}\\;(\\omega_C\\text{ swings } ${n(r1.min, 5)}\\text{–}${n(r1.max, 5)}\\ \\text{rpm})`,
      cite: HJ2('§26.2.2'),
    },
    {
      label: 'Angle turned by the intermediate shaft',
      tex: '\\tan\\theta_C = \\dfrac{\\tan\\theta}{\\cos\\delta_1}',
      sub: `= \\dfrac{\\tan 30^\\circ}{\\cos ${n(deg(spec.delta1), 3)}^\\circ}`,
      result: `\\theta_C = ${n(deg(thetaC), 5)}^\\circ`,
      cite: HJ2('Fig 26.10'),
    },
    {
      label: 'Joint 2 is driven a quarter turn (+ yoke phase − plane twist) later',
      tex: '\\dfrac{\\omega_{out}}{\\omega_C} = \\dfrac{\\cos\\delta_2}{1-\\sin^2\\delta_2\\cos^2(\\theta_C+90^\\circ+\\phi-\\gamma)}',
      sub: `\\theta_C + 90^\\circ + \\phi - \\gamma = ${n(deg(thetaC + q), 5)}^\\circ`,
      result: `= ${n(d.ratio / d.ratioC, 5)}`,
      cite: HJ2('§26.2.3, Fig 26.13'),
      beyond: !!(spec.twist || spec.phase),
    },
    {
      label: 'Overall',
      tex: '\\dfrac{\\omega_{out}}{\\omega_A} = \\dfrac{\\omega_C}{\\omega_A}\\cdot\\dfrac{\\omega_{out}}{\\omega_C}',
      sub: `= ${n(d.ratioC, 5)}\\times${n(d.ratio / d.ratioC, 5)}`,
      result: `= ${n(d.ratio, 6)}\\quad(\\omega_{out} = ${n(st.rpm * d.ratio, 5)}\\ \\text{rpm})`,
      cite: HJ2('§26.2.3 velocity ratio'),
    },
    {
      label: 'With δ₁ = δ₂ and the yokes in line the two ratios cancel',
      tex: '\\tan\\alpha_A = \\tan\\Phi_C\\cos\\theta,\\ \\tan\\alpha_B = \\tan\\Phi_C\\cos\\theta\\;\\Rightarrow\\;\\alpha_A=\\alpha_B,\\ \\dfrac{\\omega_B}{\\omega_A}=1',
      cite: HJ2('§26.2.3, Fig 26.14 (book notation)'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
      <p className="mt-1.5 text-[11px] leading-snug text-dim">Single-joint ratio at the same θ for comparison: {hookeVelocityRatio(spec.delta1, th).toFixed(5)}.</p>
    </Section>
  )
}

export function DoubleCardanPanel() {
  const st = useDC()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<DCParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Layout">
        <Segmented<Mode>
          value={st.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'rig', label: 'Test rig', title: 'Set the angles, phase and plane directly' },
            { value: 'turn', label: 'Tractor turning', title: 'PTO shaft to a trailed implement in a turn' },
          ]}
        />
        {st.mode === 'rig' ? (
          <>
            <Segmented<Arrangement>
              size="sm"
              value={st.arrangement}
              onChange={(arrangement) => set({ arrangement })}
              options={[
                { value: 'W', label: 'W (shafts meet)', title: 'Input and output shafts intersect — as on a tractor in a turn' },
                { value: 'Z', label: 'Z (parallel offset)', title: 'Input and output shafts parallel but offset — a propeller shaft' },
              ]}
            />
            <Toggle label="Equal joint angles" checked={st.equal} onChange={(equal) => set({ equal })} />
            <Slider label="Joint 1 angle δ₁" value={st.delta1} min={0} max={35} step={0.5} unit="°" onChange={(delta1) => set({ delta1 })} />
            <Slider label="Joint 2 angle δ₂" value={st.delta2} min={0} max={35} step={0.5} unit="°" onChange={(delta2) => set({ delta2 })} />
            <Slider label="Intermediate yoke phase φ" value={st.phase} min={0} max={90} step={1} unit="°" onChange={(phase) => set({ phase })} hint="0° = yokes in line" />
            <Slider label="Plane twist γ of joint 2" value={st.twist} min={0} max={90} step={1} unit="°" onChange={(twist) => set({ twist })} hint="0° = all shafts in one plane" />
          </>
        ) : (
          <>
            <Slider label="Implement angle ψ (turn)" value={st.psi} min={0} max={60} step={1} unit="°" onChange={(psi) => set({ psi })} />
            <Slider label="Hitch position a/(a+b)" value={st.hitch} min={0.1} max={0.9} step={0.01} onChange={(hitch) => set({ hitch })} hint="0.5 = hitch pin midway between the joints" />
            <TurnPlan />
          </>
        )}
        <Slider label="Input speed" value={st.rpm} min={100} max={1500} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
      </Section>
      <Conditions />
      <Section title="Exam presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                st.set({ ...DEFAULTS, ...p.params })
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
      <Charts />
      <GuideTable />
      <DCWorking />
    </div>
  )
}
