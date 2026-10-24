import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import {
  deg,
  hookeAcceleration,
  hookeDrivenSpeed,
  hookeInertiaTorque,
  hookeMaxPositionError,
  hookeSpeedRange,
  hookeVelocityRatio,
  inertiaFromWeight,
  rad,
  rpmToRad,
} from '@/physics/joints'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { HJ2 } from '../shared/cites'
import { DEFAULTS, GUIDE_SECOND, GUIDE_TABLE, curves, live, useHooke, type HookeParams } from './model'

interface Preset {
  id: string
  label: string
  note: string
  params: Partial<HookeParams>
}

const PRESETS: Preset[] = [
  {
    id: 'q4d',
    label: '2017/18 Q4(d) · 20°, 1000 rpm',
    note: 'Driven speed for θ = 10°…90°. Marking scheme: 1060, 1048, 1030, 1009, 987, 968, 953, 943, 940 rpm. Compare with the table below.',
    params: { delta: 20, rpm: 1000 },
  },
  {
    id: 'ex263',
    label: 'Inertia torque · 147 N at 45°',
    note: '20°, 1000 rpm, driven mass 147 N with k = 0.25 m, at 45°. Worked answer: 939.7–1064 rpm, α_B = −1365 rad/s², 1278.4 N·m driven, 1276.2 N·m at the driver.',
    params: { delta: 20, rpm: 1000, weight: 147, k: 0.25, thetaProbe: 45 },
  },
  {
    id: 'dunn45',
    label: 'Velocity ratio · φ = 45°',
    note: 'Plot ω₂/ω₁ against θ for a 45° joint. Maximum √2 = 1.414 when cos θ = 1; minimum 1/√2 = 0.707 when cos θ = 0.',
    params: { delta: 45 },
  },
  {
    id: 'culpin40',
    label: '40° position error',
    note: '10° gives only a small fluctuation; at 40° the output can be up to 15° out of position. Watch the lag chart: ±7.6°.',
    params: { delta: 40 },
  },
  {
    id: 'fig269',
    label: '30° speed curve',
    note: 'A 30° joint at 1000 rpm swings between about 850 and 1150 rpm (exact 866–1155 rpm).',
    params: { delta: 30, rpm: 1000 },
  },
]

const EX263_ERRATA =
  'The book rounds sin²20° to 0.1175 (it is 0.1170) and writes 1 − 0.0583 as 0.9413 (it is 0.9415). Correct values: α_B = −1360 rad/s², inertia torque 1273.6 N·m, torque at the driver 1271.1 N·m.'

function LivePanel() {
  const v = useLive(() => ({ ...live }), 20, (a, b) => a.theta === b.theta)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Driver θ" value={`${Math.round(v.theta)}°`} />
        <Readout label="Driven θ_B" value={`${Math.round(v.thetaB)}°`} />
        <Readout label="θ_B − θ" value={`${v.lag >= 0 ? '+' : ''}${v.lag.toFixed(1)}°`} tone={v.lag >= 0 ? 'accent' : 'info'} />
        <Readout label="ω_B / ω_A" value={v.ratio.toFixed(4)} tone="accent" />
        <Readout label="Driven speed" value={fmt(v.omegaB, 4)} unit="rpm" tone={v.ratio >= 1 ? 'warn' : 'info'} />
        <Readout label="α_B" value={fmt(v.alphaB, 3)} unit="rad/s²" />
        <Readout label="Inertia torque I·α_B" value={fmt(v.torque, 4)} unit="N·m" tone="warn" />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-dim">
        The red marks on the driving disc and the driven flywheel line up every quarter turn and drift apart in between: the driven shaft leads, then lags.
      </p>
    </Section>
  )
}

function useParams() {
  const delta = useHooke((s) => s.delta)
  const rpm = useHooke((s) => s.rpm)
  const weight = useHooke((s) => s.weight)
  const k = useHooke((s) => s.k)
  const thetaProbe = useHooke((s) => s.thetaProbe)
  return { delta, rpm, weight, k, thetaProbe }
}

function Charts() {
  const { delta, rpm } = useParams()
  const c = useMemo(() => curves({ delta, rpm }), [delta, rpm])
  const r = hookeSpeedRange(1, rad(delta))
  return (
    <Section title="Over one revolution">
      <Chart
        data={[c.xs, c.ratio, c.xs.map(() => 1)]}
        series={[
          { label: 'ω_B/ω_A', color: '#9bd17a', width: 2 },
          { label: 'input', color: '#93a59a', width: 1, dash: [4, 4] },
        ]}
        xLabel="Driver angle θ (°)"
        yLabel="Velocity ratio ω_B/ω_A"
        marker={() => [live.theta, live.ratio]}
        height={170}
      />
      <p className="mb-2 mt-1 text-[11px] leading-snug text-dim">
        Two peaks per revolution: maximum {r.max.toFixed(4)} = 1/cos δ at 0° and 180°, minimum {r.min.toFixed(4)} = cos δ at 90° and 270°.
      </p>
      <Chart
        data={[c.xs, c.acc]}
        series={[{ label: 'α_B', color: '#e8794f', width: 2 }]}
        xLabel="Driver angle θ (°)"
        yLabel="Driven acceleration α_B (rad/s²)"
        marker={() => [live.theta, live.alphaB]}
        height={150}
      />
      <div className="h-2" />
      <Chart
        data={[c.xs, c.lag]}
        series={[{ label: 'θ_B − θ', color: '#6fb3e0', width: 2 }]}
        xLabel="Driver angle θ (°)"
        yLabel="Position error θ_B − θ (°)"
        marker={() => [live.theta, live.lag]}
        height={130}
      />
    </Section>
  )
}

function Table() {
  const { delta, rpm } = useParams()
  const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90]
  const matches = Math.abs(delta - 20) < 1e-9 && Math.abs(rpm - 1000) < 1e-9
  return (
    <Section title="Speed table (θ = 10°…90°)">
      <table className="w-full font-mono text-[11.5px]">
        <thead className="text-dim">
          <tr>
            <th className="text-left font-normal">θ</th>
            <th className="text-right font-normal">ω_B/ω_A</th>
            <th className="text-right font-normal">ω_B rpm</th>
            {matches ? <th className="text-right font-normal">rounded</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const wb = hookeDrivenSpeed(rpm, rad(delta), rad(t))
            return (
              <tr key={t} className="text-ink/90">
                <td>{t}°</td>
                <td className="text-right">{hookeVelocityRatio(rad(delta), rad(t)).toFixed(4)}</td>
                <td className="text-right text-accent">{wb.toFixed(1)}</td>
                {matches ? <td className="text-right text-mute">{GUIDE_TABLE[i]}</td> : null}
              </tr>
            )
          })}
        </tbody>
      </table>
      {matches ? (
        <div className="mt-2 text-[11px] leading-snug text-mute">
          <p>
            If the driven shaft drives another joint at 15°, a quick estimate takes each ω_B above as a steady input and re-uses
            θ, e.g. from 1060 rpm: {GUIDE_SECOND.join(', ')} rpm.
          </p>
          <p className="mt-1 text-warn/90">
            That shortcut is only approximate: strictly the intermediate shaft is not steady and the second joint sees the intermediate shaft's angle, not θ.
            The Double joints scene works the true combined motion.
          </p>
        </div>
      ) : null}
    </Section>
  )
}

function JointWorking() {
  const { delta, rpm, weight, k, thetaProbe } = useParams()
  const d = rad(delta)
  const th = rad(thetaProbe)
  const w = rpmToRad(rpm)
  const r = hookeSpeedRange(rpm, d)
  const ratio = hookeVelocityRatio(d, th)
  const a = hookeAcceleration(d, th, w)
  const I = inertiaFromWeight(weight, k)
  const t = hookeInertiaTorque(d, th, w, I)
  const isEx = delta === 20 && rpm === 1000 && thetaProbe === 45 && weight === 147 && k === 0.25
  const steps: WorkingStep[] = [
    {
      label: `Velocity ratio at θ = ${thetaProbe}°`,
      tex: '\\dfrac{\\omega_B}{\\omega_A} = \\dfrac{\\cos\\delta}{1-\\sin^2\\delta\\,\\cos^2\\theta}',
      sub: `= \\dfrac{\\cos ${n(delta, 3)}^\\circ}{1-\\sin^2 ${n(delta, 3)}^\\circ\\cos^2 ${n(thetaProbe, 3)}^\\circ} = \\dfrac{${n(Math.cos(d), 4)}}{${n(1 - Math.sin(d) ** 2 * Math.cos(th) ** 2, 4)}}`,
      result: `= ${n(ratio, 5)},\\quad \\omega_B = ${n(rpm * ratio, 5)}\\ \\text{rpm}`,
      cite: SRC.uj502('p2–3'),
    },
    {
      label: 'Maximum and minimum driven speed',
      tex: '(\\omega_B)_{max} = \\dfrac{\\omega_A}{\\cos\\delta}\\ (\\theta = 0^\\circ,180^\\circ),\\quad (\\omega_B)_{min} = \\omega_A\\cos\\delta\\ (\\theta = 90^\\circ,270^\\circ)',
      sub: `= \\dfrac{${n(rpm, 4)}}{${n(Math.cos(d), 4)}},\\quad ${n(rpm, 4)}\\times${n(Math.cos(d), 4)}`,
      result: `= ${n(r.max, 5)}\\ \\text{and}\\ ${n(r.min, 5)}\\ \\text{rpm};\\ \\text{range } ${n(r.range, 4)}\\ \\text{rpm}\\ (${n(r.fluctuation * 100, 3)}\\,\\%)`,
      cite: HJ2('§26.2.2'),
    },
    {
      label: `Driven-shaft acceleration at θ = ${thetaProbe}°`,
      tex: '\\alpha_B = -\\dfrac{\\omega_A^2\\cos\\delta\\,\\sin^2\\delta\\,\\sin 2\\theta}{(1-\\cos^2\\theta\\,\\sin^2\\delta)^2}',
      sub: `= -\\dfrac{(${n(w, 5)})^2(${n(Math.cos(d), 4)})(${n(Math.sin(d) ** 2, 4)})(${n(Math.sin(2 * th), 4)})}{(${n(1 - Math.cos(th) ** 2 * Math.sin(d) ** 2, 4)})^2}`,
      result: `= ${n(a, 5)}\\ \\text{rad/s}^2`,
      cite: HJ2('§26.2.2, Example 26.3'),
      errata: isEx ? EX263_ERRATA : undefined,
    },
    {
      label: 'Inertia torque on the driven shaft and at the driver',
      tex: 'I = \\dfrac{W}{g}k^2,\\quad T_B = I\\alpha_B,\\quad T_A = T_B\\dfrac{\\omega_B}{\\omega_A}',
      sub: `I = \\dfrac{${n(weight, 4)}}{9.81}(${n(k, 3)})^2 = ${n(I, 4)}\\ \\text{kg·m}^2`,
      result: `T_B = ${n(Math.abs(t.TB), 5)}\\ \\text{N·m},\\quad T_A = ${n(Math.abs(t.TA), 5)}\\ \\text{N·m}`,
      cite: HJ2('Example 26.3'),
      errata: isEx ? EX263_ERRATA : undefined,
    },
    {
      label: 'Angular position error (lead / lag of the driven shaft)',
      tex: '\\tan\\theta_B = \\dfrac{\\tan\\theta}{\\cos\\delta},\\quad (\\theta_B-\\theta)_{max}\\ \\text{at}\\ \\tan\\theta = \\sqrt{\\cos\\delta}',
      sub: `\\theta = ${n(deg(Math.atan(Math.sqrt(Math.cos(d)))), 4)}^\\circ`,
      result: `(\\theta_B-\\theta)_{max} = \\pm${n(deg(hookeMaxPositionError(d)), 3)}^\\circ\\ \\ (\\text{swing } ${n(2 * deg(hookeMaxPositionError(d)), 3)}^\\circ)`,
      cite: SRC.top510('p4–5: 40° gives up to 15°'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function HookePanel() {
  const st = useHooke()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<HookeParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Joint">
        <Slider label="Shaft angle δ" value={st.delta} min={0} max={45} step={0.5} unit="°" onChange={(delta) => set({ delta })} hint="Angle between the driving and driven shafts" />
        <Slider label="Driver speed ω_A" value={st.rpm} min={100} max={2000} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Slider label="Working at θ =" value={st.thetaProbe} min={0} max={180} step={1} unit="°" onChange={(thetaProbe) => set({ thetaProbe })} />
        <Slider label="Driven mass weight W" value={st.weight} min={10} max={500} step={1} unit="N" onChange={(weight) => set({ weight })} />
        <Slider label="Radius of gyration k" value={st.k} min={0.05} max={0.5} step={0.01} unit="m" onChange={(k) => set({ k })} />
      </Section>
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
        {preset === 'ex263' ? <p className="mt-1 text-[11px] leading-snug text-warn/90">{EX263_ERRATA}</p> : null}
      </Section>
      <Charts />
      <Table />
      <JointWorking />
    </div>
  )
}
