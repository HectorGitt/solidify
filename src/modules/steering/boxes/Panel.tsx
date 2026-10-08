import { useMemo } from 'react'
import { rad } from '@/physics/joints'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { BALL, ST, TURNS, WORM, curves, kinematics, live, useBoxes } from './model'

function LivePanel() {
  const v = useLive(() => ({ ...live }), 20, (a, b) => a.wheel === b.wheel)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Steering wheel" value={`${v.wheel >= 0 ? '+' : ''}${Math.round(v.wheel)}°`} unit={`${(v.wheel / 360).toFixed(2)} turns`} />
        <Readout label="Nut travel" value={fmt(v.nutX * 1000, 3)} unit="mm" />
        <Readout label="Drop arm (ball)" value={`${v.phiBall.toFixed(1)}°`} tone="accent" />
        <Readout label="Ratio (ball)" value={fmt(v.ratioBall, 3)} unit=": 1" />
        <Readout label="Drop arm (peg)" value={`${v.phiPeg.toFixed(1)}°`} tone="info" />
        <Readout label="Ratio (peg)" value={fmt(v.ratioPeg, 3)} unit=": 1" />
      </div>
    </Section>
  )
}

function Charts() {
  const c = useMemo(() => curves(), [])
  return (
    <Section title="Drop-arm swing and steering ratio">
      <Chart
        data={[c.xs, c.pb, c.pp]}
        series={[
          { label: 'recirculating ball', color: '#9bd17a', width: 2 },
          { label: 'worm and peg', color: '#6fb3e0', width: 2, dash: [5, 4] },
        ]}
        xLabel="Steering-wheel angle (°)"
        yLabel="Drop-arm angle (°)"
        marker={() => [live.wheel, live.phiBall]}
        height={160}
      />
      <div className="h-2" />
      <Chart
        data={[c.xs, c.rb, c.rp]}
        series={[
          { label: 'recirculating ball', color: '#9bd17a', width: 2 },
          { label: 'worm and peg', color: '#6fb3e0', width: 2, dash: [5, 4] },
        ]}
        xLabel="Steering-wheel angle (°)"
        yLabel="Ratio dθ_wheel/dφ"
        marker={() => [live.wheel, live.ratioBall]}
        height={140}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Both boxes swing the drop arm about ±30° for ±{TURNS} turns of the wheel. With the peg sliding in the arm slot the ball box gets slightly lower-geared towards
        full lock; the worm-and-peg box with a constant-lead worm gets higher-geared. Real boxes shape the thread to suit.
      </p>
    </Section>
  )
}

function Maintenance() {
  return (
    <Section title="Maintenance">
      <ul className="space-y-1.5 text-[12px] text-ink/90">
        <li className="flex items-start gap-2">
          <Badge tone="accent">200 h</Badge>
          <span>Remove the level plug and check the steering-box oil. SAE 90 is commonly used.</span>
        </li>
        <li className="flex items-start gap-2">
          <Badge tone="accent">10 h</Badge>
          <span>Grease the steering linkage — nipples on the steering arms, stub axles, track-rod and drag-link ends (sealed joints need less).</span>
        </li>
        <li className="flex items-start gap-2">
          <Badge tone="accent">50 h</Badge>
          <span>Lubricate the front-wheel bearings.</span>
        </li>
      </ul>
    </Section>
  )
}

function BoxWorking() {
  const wheel = useBoxes((s) => s.wheel)
  const w = rad(wheel)
  const k = kinematics(w)
  const steps: WorkingStep[] = [
    {
      label: 'Nut (or peg) travel along the thread',
      tex: 'x = p\\,\\dfrac{\\theta_w}{2\\pi}',
      sub: `= ${n(BALL.lead * 1000, 4)}\\,\\text{mm}\\times\\dfrac{${n(wheel, 4)}^\\circ}{360^\\circ}`,
      result: `= ${n(k.ball.x * 1000, 4)}\\ \\text{mm}`,
      cite: ST('p3: nut B moves on the thread'),
      beyond: true,
    },
    {
      label: 'Recirculating ball: peg F swings rocker arm D',
      tex: '\\tan\\varphi = \\dfrac{x}{r}',
      sub: `= \\dfrac{${n(k.ball.x * 1000, 4)}}{${n(BALL.arm * 1000, 3)}}`,
      result: `\\varphi = ${n((k.ball.phi * 180) / Math.PI, 4)}^\\circ`,
      cite: ST('p3: shaft E rotates about 30°'),
      beyond: true,
    },
    {
      label: 'Worm and peg: peg C follows the thread',
      tex: 'r\\sin\\varphi = p\\,\\dfrac{\\theta_w}{2\\pi}',
      sub: `\\sin\\varphi = \\dfrac{${n(k.peg.x * 1000, 4)}}{${n(WORM.arm * 1000, 3)}}`,
      result: `\\varphi = ${n((k.peg.phi * 180) / Math.PI, 4)}^\\circ`,
      cite: ST('p3–4'),
      beyond: true,
    },
    {
      label: 'Overall steering-box ratio (wheel turns : drop-arm swing)',
      tex: 'i = \\dfrac{\\Delta\\theta_{wheel}}{\\Delta\\varphi_{drop\\ arm}}',
      sub: `= \\dfrac{2\\times${TURNS}\\times360^\\circ}{2\\times30^\\circ}`,
      result: `= ${n((TURNS * 360) / 30, 3)} : 1\\quad(\\text{at centre } ${n(k.ball.ratio, 3)}\\text{ and } ${n(k.peg.ratio, 3)} : 1)`,
      cite: ST('p3'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
      <p className="mt-1.5 text-[11px] leading-snug text-dim">
        Wheel turns, thread lead ({fmt(BALL.lead * 1000, 3)} and {fmt(WORM.lead * 1000, 3)} mm) and arm lengths are typical values chosen to give the usual ±30° drop-arm swing
        — tractor manual steering boxes are commonly around 15–25 : 1.
      </p>
    </Section>
  )
}

export function BoxesPanel() {
  const st = useBoxes()
  return (
    <div>
      <LivePanel />
      <Section title="Steering wheel">
        <Toggle label="Sweep lock to lock" checked={st.sweep} onChange={(sweep) => st.set({ sweep })} />
        <Slider
          label="Wheel angle"
          value={st.wheel}
          min={-TURNS * 360}
          max={TURNS * 360}
          step={5}
          unit="°"
          onChange={(wheel) => st.set({ wheel, sweep: false })}
          hint="Both boxes are driven by the same wheel angle"
        />
      </Section>
      <Charts />
      <Maintenance />
      <BoxWorking />
    </div>
  )
}
