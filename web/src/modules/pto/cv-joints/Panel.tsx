import { useMemo } from 'react'
import { hookeSpeedRange, rad } from '@/physics/joints'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { HJ2 } from '../shared/cites'
import { CV_CITES, TYPES, curves, live, useCVJ, type CVType } from './model'

function LivePanel() {
  const v = useLive(() => ({ ...live }), 20, (a, b) => a.theta === b.theta)
  const type = useCVJ((s) => s.type)
  const delta = useCVJ((s) => s.delta)
  const twin = TYPES[type].principle === 'twin-hooke'
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Input θ" value={`${Math.round(v.theta)}°`} />
        <Readout label="Input speed" value={fmt(v.omegaIn, 4)} unit="rpm" />
        <Readout label="Output speed" value={fmt(v.omegaOut, 4)} unit="rpm" tone="accent" />
        <Readout label="ω_out / ω_in" value={v.ratio.toFixed(4)} tone="accent" />
        <Readout label={twin ? 'Intermediate' : 'Drive points'} value={twin ? fmt(v.omegaMid, 4) : 'on δ/2 plane'} unit={twin ? 'rpm' : undefined} tone={twin ? 'warn' : 'ink'} />
        <Readout label="1 U-joint: up to" value={`+${fmt((1 / Math.cos(rad(delta)) - 1) * 100, 3)}`} unit="%" />
      </div>
    </Section>
  )
}

function Charts() {
  const type = useCVJ((s) => s.type)
  const delta = useCVJ((s) => s.delta)
  const c = useMemo(() => curves(type, delta), [type, delta])
  return (
    <Section title="Speed over one revolution">
      <Chart
        data={[c.xs, c.out, c.mid, c.single]}
        series={[
          { label: 'output ω_out/ω_in', color: '#9bd17a', width: 2.4 },
          { label: 'intermediate member', color: '#e8794f', width: 1.5 },
          { label: "single Hooke's joint", color: '#6fb3e0', width: 1, dash: [4, 4] },
        ]}
        xLabel="Input angle θ (°)"
        yLabel="Speed ratio"
        marker={() => [live.theta, live.ratio]}
        height={170}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Green: the CV output stays at exactly the input speed. Dashed blue: a single Hooke’s joint at the same angle.{' '}
        {TYPES[type].principle === 'twin-hooke' ? 'Orange: the intermediate member still speeds up and slows down — the second half cancels it.' : ''}
      </p>
    </Section>
  )
}

function Facts() {
  const type = useCVJ((s) => s.type)
  const delta = useCVJ((s) => s.delta)
  const t = TYPES[type]
  const over = delta > t.maxAngle
  return (
    <Section title="This joint">
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <Badge tone={over ? 'warn' : 'accent'}>{over ? `beyond ${t.maxAngle}°` : `≤ ${t.maxAngle}°`}</Badge>
        <Badge tone="info">{t.principle === 'bisecting' ? 'balls in bisecting plane' : t.principle === 'twin-hooke' ? 'twin Hooke principle' : 'rollers in parallel grooves'}</Badge>
      </div>
      <p className="text-[11.5px] leading-snug text-mute">{t.maxNote}.</p>
      <p className="mt-1 text-[11.5px] leading-snug text-mute">
        A single roller-bearing universal joint can be well over 99 % efficient, but a single constant-velocity joint gives only about 40° of articulation — not enough
        for normal field work, so PTO shafts use pairs of Hooke’s joints.
      </p>
    </Section>
  )
}

function CVWorking() {
  const type = useCVJ((s) => s.type)
  const delta = useCVJ((s) => s.delta)
  const rpm = useCVJ((s) => s.rpm)
  const r = hookeSpeedRange(rpm, rad(delta))
  const steps: WorkingStep[] = []
  if (TYPES[type].principle === 'twin-hooke') {
    const h = hookeSpeedRange(rpm, rad(delta / 2))
    steps.push(
      {
        label: 'Each half works at half the shaft angle',
        tex: '\\delta_1 = \\delta_2 = \\tfrac{\\delta}{2}',
        sub: `= \\tfrac{${n(delta, 3)}^\\circ}{2}`,
        result: `= ${n(delta / 2, 3)}^\\circ`,
        cite: CV_CITES[type][0],
      },
      {
        label: 'The intermediate member fluctuates like a single joint at δ/2',
        tex: '\\omega_C = \\omega_A/\\cos\\tfrac{\\delta}{2}\\ \\ldots\\ \\omega_A\\cos\\tfrac{\\delta}{2}',
        sub: `= ${n(rpm, 4)}/${n(Math.cos(rad(delta / 2)), 4)}\\ \\ldots\\ ${n(rpm, 4)}\\times${n(Math.cos(rad(delta / 2)), 4)}`,
        result: `= ${n(h.max, 5)}\\ \\ldots\\ ${n(h.min, 5)}\\ \\text{rpm}`,
        cite: HJ2('§26.2.3'),
      },
      {
        label: 'Second half a quarter turn out of phase: the changes cancel',
        tex: '\\dfrac{\\omega_B}{\\omega_A} = \\dfrac{1-\\cos^2\\alpha_B\\sin^2\\theta}{1-\\cos^2\\alpha_A\\sin^2\\theta} = 1\\quad(\\alpha_A=\\alpha_B)',
        result: `\\omega_{out} = ${n(rpm, 4)}\\ \\text{rpm}`,
        cite: HJ2('§26.2.3, Fig 26.14'),
      },
    )
  } else {
    steps.push(
      {
        label: 'Drive members lie on the bisecting (homokinetic) plane',
        tex: '\\text{plane angle} = \\tfrac{\\delta}{2}',
        sub: `= \\tfrac{${n(delta, 3)}^\\circ}{2}`,
        result: `= ${n(delta / 2, 3)}^\\circ`,
        cite: CV_CITES[type][0],
      },
      {
        label: 'Each drive point is the same distance from both shaft axes, so',
        tex: '\\omega_{out}\\,r = \\omega_{in}\\,r\\;\\Rightarrow\\;\\omega_{out} = \\omega_{in}',
        result: `\\omega_{out} = ${n(rpm, 4)}\\ \\text{rpm}`,
        cite: HJ2('§26.2.6 Weiss principle, Fig 26.23'),
      },
    )
  }
  steps.push({
    label: 'For comparison, a single Hooke’s joint at δ would swing',
    tex: '\\omega_A\\cos\\delta\\ \\ldots\\ \\omega_A/\\cos\\delta',
    sub: `= ${n(rpm, 4)}\\times${n(Math.cos(rad(delta)), 4)}\\ \\ldots\\ ${n(rpm, 4)}/${n(Math.cos(rad(delta)), 4)}`,
    result: `= ${n(r.min, 5)}\\ \\ldots\\ ${n(r.max, 5)}\\ \\text{rpm}`,
    cite: HJ2('§26.2.2'),
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function CVPanel() {
  const st = useCVJ()
  return (
    <div>
      <LivePanel />
      <Section title="Joint">
        <Segmented<CVType>
          size="sm"
          value={st.type}
          onChange={(type) => st.set({ type })}
          options={(Object.keys(TYPES) as CVType[]).map((k) => ({ value: k, label: TYPES[k].short, title: TYPES[k].label }))}
        />
        <Slider label="Shaft angle δ" value={st.delta} min={0} max={50} step={0.5} unit="°" onChange={(delta) => st.set({ delta })} />
        <Slider label="Input speed" value={st.rpm} min={60} max={1500} step={10} unit="rpm" onChange={(rpm) => st.set({ rpm })} />
        <p className="text-[11.5px] leading-snug text-mute">{TYPES[st.type].label}</p>
      </Section>
      <Facts />
      <Charts />
      <CVWorking />
    </div>
  )
}
