import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import {
  AX,
  A_ANN,
  A_CAP,
  CYL,
  LEFT,
  ST,
  STROKE,
  ackermannOuter,
  deg,
  live,
  rightAngle,
  toeAngle,
  turnsLockToLock,
  turningRadius,
  useSteer,
  type Variant,
} from './model'

const PRESETS = [
  {
    id: 'hydro-off',
    label: 'Hydrostatic · engine off',
    note: 'A hydrostatic system has no mechanical link, so it cannot be steered with the engine stopped. Turn the wheel: nothing happens at the front axle.',
    apply: () => useSteer.getState().set({ variant: 'hydrostatic', engineOn: false, auto: true }),
  },
  {
    id: 'assist-off',
    label: 'Power-assisted · engine off',
    note: 'With power assistance the manual linkage is still there, so the tractor can be steered if the hydraulics fail — only with more effort.',
    apply: () => useSteer.getState().set({ variant: 'assisted', engineOn: false, auto: true }),
  },
  {
    id: 'toe',
    label: 'Toe-in 3–6 mm',
    note: 'Front rim distance A is 3–6 mm (⅛–¼ in) less than rear distance B at hub height; set by the track-rod length. The view exaggerates it ×20.',
    apply: () => useSteer.getState().set({ toe: 4.5, showToe: true, auto: false, wheel: 0 }),
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.wheel === b.wheel && a.blocked === b.blocked)
  const inner = Math.abs(v.left) >= Math.abs(v.right) ? v.left : v.right
  const outer = Math.abs(v.left) >= Math.abs(v.right) ? v.right : v.left
  const ideal = ackermannOuter(inner)
  const status = v.blocked ? 'Cannot steer — engine off' : v.atLock ? 'At full lock' : v.qCyl > 0.05 ? 'Turning left' : v.qCyl < -0.05 ? 'Turning right' : 'Neutral (open centre)'
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Steering wheel" value={`${Math.round(v.wheel)}°`} unit={`${fmt(v.wheel / 360, 2)} turns`} />
        <Readout label="Left / right wheel" value={`${fmt(deg(v.left), 3)}° / ${fmt(deg(v.right), 3)}°`} />
        <Readout label="State" value={status} tone={v.blocked ? 'warn' : 'info'} />
        <Readout label="Outer (ideal)" value={`${fmt(deg(outer), 3)}° (${fmt(deg(ideal), 3)}°)`} />
        <Readout label="Turning radius" value={fmt(turningRadius(outer), 3)} unit="m" />
        <Readout label="Flow to cylinder" value={fmt(Math.abs(v.qCyl), 3)} unit="L/min" tone="accent" />
      </div>
    </Section>
  )
}

function AngleChart() {
  const data = useMemo(() => {
    const xs: number[] = []
    const r: number[] = []
    const ideal: number[] = []
    for (let i = 0; i <= 40; i++) {
      const dL = (LEFT.max * i) / 40
      xs.push(deg(dL))
      r.push(deg(rightAngle(dL)))
      ideal.push(deg(ackermannOuter(dL)))
    }
    return { xs, r, ideal }
  }, [])
  return (
    <Section title="Inner vs outer wheel angle">
      <Chart
        data={[data.xs, data.r, data.ideal]}
        series={[
          { label: 'Linkage', color: '#9bd17a', width: 2 },
          { label: 'True Ackermann', color: '#6fb3e0', width: 1.5, dash: [5, 4] },
        ]}
        xLabel="Inner wheel angle (°)"
        yLabel="Outer wheel angle (°)"
        marker={() => (live.left > 0 ? [deg(live.left), deg(live.right)] : [deg(-live.right), deg(-live.left)])}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Ackermann geometry: for no tyre scrub all wheels must turn about one point on the rear-axle line, cot δo − cot δi = t/L.
      </p>
    </Section>
  )
}

function SteerWorking() {
  const st = useSteer()
  const turns = turnsLockToLock(st.D)
  const inner = LEFT.max
  const outer = rightAngle(inner)
  const t = 2 * AX.kpZ
  const steps: WorkingStep[] = []
  if (st.variant === 'hydrostatic') {
    steps.push({
      label: 'Oil sent to the cylinder per steering-wheel turn',
      tex: 'V = D_{meter}\\times n',
      sub: `= ${n(st.D, 3)}\\ \\text{cm}^3/\\text{rev}`,
      result: '\\text{fixed by the gerotor}',
      cite: SRC.beyond('gerotor metering unit'),
      beyond: true,
    })
    steps.push({
      label: 'Cylinder travel per turn (rod side when turning left, full bore when turning right)',
      tex: '\\Delta x = \\dfrac{D}{A_{ann}}\\ \\text{or}\\ \\dfrac{D}{A}',
      sub: `= \\dfrac{${n(st.D, 3)}}{${n(A_ANN * 1e4, 4)}}\\ \\text{or}\\ \\dfrac{${n(st.D, 3)}}{${n(A_CAP * 1e4, 4)}}\\ \\text{cm}`,
      result: `= ${n(st.D / (A_ANN * 1e4), 3)}\\ \\text{or}\\ ${n(st.D / (A_CAP * 1e4), 3)}\\ \\text{cm}`,
      cite: SRC.top510('p11: v = Q/A'),
    })
    steps.push({
      label: 'Turns lock to lock',
      tex: 'N = \\dfrac{\\tfrac12 S A_{ann} + \\tfrac12 S A}{D}',
      sub: `S = ${n(STROKE * 1000, 4)}\\ \\text{mm},\\ A = ${n(A_CAP * 1e4, 4)},\\ A_{ann} = ${n(A_ANN * 1e4, 4)}\\ \\text{cm}^2`,
      result: `N = ${n(turns, 3)}\\ \\text{turns}`,
      cite: SRC.beyond('metering-unit sizing'),
      beyond: true,
    })
  } else {
    steps.push({
      label: 'Manual linkage: wheel angle from the steering-box ratio',
      tex: '\\delta = \\dfrac{\\theta_{wheel}}{i_{box}}',
      sub: `i_{box} = ${n(st.ratio, 3)}:1`,
      result: `\\text{full lock } ${n(deg(LEFT.max), 3)}^\\circ \\Rightarrow ${n((st.ratio * deg(LEFT.max)) / 360, 3)}\\ \\text{turns}`,
      cite: ST('p1–2, p3–4'),
    })
  }
  steps.push({
    label: 'Ackermann condition at full lock',
    tex: '\\cot\\delta_o - \\cot\\delta_i = \\dfrac{t}{L}',
    sub: `t = ${n(t, 3)}\\ \\text{m},\\ L = ${n(AX.wheelbase, 3)}\\ \\text{m},\\ \\delta_i = ${n(deg(inner), 3)}^\\circ`,
    result: `\\delta_o(\\text{ideal}) = ${n(deg(ackermannOuter(inner)), 3)}^\\circ,\\ \\text{linkage } ${n(deg(outer), 3)}^\\circ`,
    cite: SRC.beyond('Ackermann steering geometry'),
    beyond: true,
  })
  steps.push({
    label: 'Toe-in',
    tex: '\\text{toe} = B - A = 3\\text{–}6\\ \\text{mm},\\quad \\alpha = \\tan^{-1}\\dfrac{(B-A)/2}{d_{rim}}',
    sub: `B - A = ${n(st.toe, 3)}\\ \\text{mm},\\ d_{rim} = ${n(2 * AX.rimR * 1000, 4)}\\ \\text{mm}`,
    result: `\\alpha = ${n(deg(toeAngle(st.toe)), 3)}^\\circ\\ \\text{per wheel}`,
    cite: ST('p5, Fig 47'),
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function SteeringPanel() {
  const st = useSteer()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Parameters<typeof st.set>[0]) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="System">
        <Segmented<Variant>
          value={st.variant}
          onChange={(variant) => set({ variant })}
          options={[
            { value: 'hydrostatic', label: 'Hydrostatic', title: 'No mechanical link' },
            { value: 'assisted', label: 'Power-assisted', title: 'Manual linkage + ram' },
          ]}
        />
        <Toggle label="Engine running (pump on)" checked={st.engineOn} onChange={(engineOn) => set({ engineOn })} />
        <Toggle label="Sweep lock to lock" checked={st.auto} onChange={(auto) => set({ auto })} />
        {!st.auto ? <Slider label="Steering-wheel angle" value={st.wheel} min={-900} max={900} step={5} unit="°" onChange={(wheel) => set({ wheel })} hint="+ = left" /> : null}
        <Toggle label="Show oil flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
      </Section>
      <Section title="Sizes">
        {st.variant === 'hydrostatic' ? (
          <Slider label="Metering displacement" value={st.D} min={40} max={200} step={1} unit="cm³/rev" onChange={(D) => set({ D })} />
        ) : (
          <Slider label="Steering-box ratio" value={st.ratio} min={12} max={30} step={0.5} onChange={(ratio) => set({ ratio })} />
        )}
        <Slider label="Pump flow" value={st.Q} min={5} max={40} step={0.5} unit="L/min" onChange={(Q) => set({ Q })} />
        <Slider label="Toe-in (B − A)" value={st.toe} min={0} max={8} step={0.5} unit="mm" onChange={(toe) => set({ toe })} />
        <Toggle label="Exaggerate toe-in ×20" checked={st.showToe} onChange={(showToe) => set({ showToe })} />
        <p className="text-[11px] leading-snug text-dim">
          Cylinder Ø{CYL.bore * 1000} mm, rod Ø{CYL.rod * 1000} mm, stroke {fmt(STROKE * 1000, 3)} mm (typical sizes).
        </p>
      </Section>
      <Section title="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                p.apply()
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
      <AngleChart />
      <SteerWorking />
    </div>
  )
}
