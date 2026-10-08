import { useState } from 'react'
import { SRC } from '@/content/citations'
import { frictionRadiusUniformWear } from '@/physics/clutch'
import { balancedPressures, brakePlacement, hydraulicBrake, turningBrakeSpeeds } from '@/physics/drives'
import { ballRampBrake, expandingShoeBrake } from '@/physics/transmission'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../common/PanelBits'
import { DEFAULTS, DISC, HYD, SHOE, SHOE_LEVER, WET, brakeTorque, live, pedalTravel, useBrakes, type BrakeType } from './model'

const set = (p: Partial<typeof DEFAULTS>) => useBrakes.getState().set(p)
const deg = (r: number) => (r * 180) / Math.PI

const PRESETS: Preset[] = [
  { id: 'road', label: 'Road stop (latched)', note: 'Pedals latched: pressing either applies both brakes equally through the balancing valve — essential at road speed.', apply: () => set({ ...DEFAULTS, latched: true, left: 0.8, right: 0 }) },
  { id: 'turn', label: 'Turning brake (left)', note: 'Pedals unlatched, left pedal only: the left wheel stops and the differential drives the right wheel at twice cage speed — the tractor pivots tightly to the left.', apply: () => set({ ...DEFAULTS, latched: false, left: 0.8, right: 0 }) },
  { id: 'shoe', label: 'Expanding shoe brake', note: 'Internal expanding shoes with the standard shoe-brake formulas: the leading shoe gives more torque than the trailing shoe for the same cam force.', apply: () => set({ ...DEFAULTS, type: 'shoe', left: 0.7 }) },
  { id: 'wet', label: 'Wet multi-plate', note: 'Four sintered discs, eight friction surfaces, hydraulic piston: T = n·μ·F·R.', apply: () => set({ ...DEFAULTS, type: 'wet', left: 0.5 }) },
]

function LivePanel() {
  const shaft = useLive(() => live.shaft, 12)
  const st = useBrakes()
  const b = brakeTorque(st)
  const tr = pedalTravel(st)
  const turning = !st.latched && (tr.left > 0.3) !== (tr.right > 0.3)
  const wheels = turningBrakeSpeeds(st.shaftRpm / st.finalRatio, tr.left > 0.3, tr.right > 0.3)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Brake shaft" value={fmt(shaft, 3)} unit="rpm" tone="info" />
        <Readout label="Line pressure" value={fmt(b.pressure / 1e6, 3)} unit="MPa" />
        <Readout label="Brake torque" value={fmt(b.T, 4)} unit="N·m" tone="accent" />
        <Readout label="Clamp / shoe force" value={fmt(b.F / 1000, 3)} unit="kN" />
        <Readout label="= at the wheel" value={fmt((b.T * st.finalRatio) / 1000, 3)} unit="kN·m" />
        <Readout label="Pedals" value={st.latched ? 'latched' : 'independent'} tone={st.latched ? 'ink' : 'warn'} />
      </div>
      {turning ? (
        <Note tone="warn">
          Turning brake: wheels at {fmt(wheels.left, 3)} (L) and {fmt(wheels.right, 3)} (R) rpm — the braked wheel stops, the other runs at twice cage speed.
        </Note>
      ) : null}
    </Section>
  )
}

function BrakeWorking() {
  const st = useBrakes()
  const tr = pedalTravel(st)
  const Fp = tr.left * st.pedalForce
  const steps: WorkingStep[] = []
  const hydL = hydraulicBrake(tr.left * st.pedalForce, HYD.pedalRatio, HYD.masterArea, 1)
  const hydR = hydraulicBrake(tr.right * st.pedalForce, HYD.pedalRatio, HYD.masterArea, 1)
  const pr = balancedPressures(hydL.p, hydR.p, st.latched)
  steps.push({
    label: 'Master cylinder pressure (one per pedal)',
    tex: 'p = \\dfrac{F_{pedal}\\,i}{A_m}',
    sub: `= \\dfrac{${n(Fp, 3)}\\times${HYD.pedalRatio}}{${n(HYD.masterArea * 1e6, 3)}\\ \\text{mm}^2}`,
    result: `p_L = ${n(hydL.p / 1e6, 3)},\\ p_R = ${n(hydR.p / 1e6, 3)}\\ \\text{MPa}${st.latched ? `\\ \\to\\ \\text{balanced } ${n(pr.left / 1e6, 3)}` : ''}`,
    cite: SRC.tts510('p13 master cylinder per pedal, balancing valve'),
    beyond: true,
  })
  if (st.type === 'shoe') {
    const F = Fp * SHOE_LEVER
    const r = expandingShoeBrake(F, SHOE)
    steps.push({
      label: 'Moments on each shoe per unit p_max',
      tex: 'M_f = \\dfrac{f w r}{\\sin\\theta_m}\\!\\int\\!\\sin\\theta(r - a\\cos\\theta)d\\theta,\\ \\ M_n = \\dfrac{w r a}{\\sin\\theta_m}\\!\\int\\!\\sin^2\\theta\\,d\\theta',
      sub: `r = ${SHOE.r},\\ w = ${SHOE.w},\\ a = ${SHOE.a},\\ f = ${SHOE.f},\\ \\theta_1 = ${n(deg(SHOE.theta1), 3)}^\\circ,\\ \\theta_2 = ${n(deg(SHOE.theta2), 3)}^\\circ`,
      result: `M_f = ${n(r.perPressure.Mf, 4)}\\,p_m,\\ M_n = ${n(r.perPressure.Mn, 4)}\\,p_m`,
      cite: SRC.m503(9, 'internal expanding shoe'),
    })
    steps.push({
      label: 'Leading (self-energising) and trailing shoe',
      tex: 'p_m = \\dfrac{F c}{M_n - M_f}\\ \\text{(leading)},\\quad p_m\' = \\dfrac{F c}{M_n + M_f}\\ \\text{(trailing)}',
      sub: `F = ${n(Fp, 3)}\\times${SHOE_LEVER} = ${n(F, 4)}\\ \\text{N},\\ c = ${SHOE.c}\\ \\text{m}`,
      result: `p_m = ${n(r.pLead / 1e3, 4)},\\ p_m' = ${n(r.pTrail / 1e3, 4)}\\ \\text{kPa}`,
      cite: SRC.m503(9, 'self-energising shoe'),
    })
    steps.push({
      label: 'Braking torque',
      tex: 'T = \\dfrac{f w r^2(\\cos\\theta_1 - \\cos\\theta_2)}{\\sin\\theta_m}(p_m + p_m\')',
      result: `T = ${n(r.TLead, 4)} + ${n(r.TTrail, 4)} = ${n(r.T, 4)}\\ \\text{N·m}`,
      cite: SRC.m503(9, 'internal expanding shoe torque'),
    })
  } else if (st.type === 'disc') {
    const P = Fp * DISC.linkRatio
    const Rf = frictionRadiusUniformWear(DISC.rOut, DISC.rIn)
    const r = ballRampBrake({ P, rampAngle: DISC.ramp, rBall: DISC.rBall, rFriction: Rf, f: DISC.f, surfaces: DISC.surfaces })
    steps.push({
      label: 'Balls on the ramps: thrust from the link pull',
      tex: 'F_0 = \\dfrac{P}{\\tan\\alpha}',
      sub: `P = ${n(Fp, 3)}\\times${DISC.linkRatio} = ${n(P, 4)}\\ \\text{N},\\ \\alpha = ${n(deg(DISC.ramp), 3)}^\\circ`,
      result: `F_0 = ${n(r.F0, 4)}\\ \\text{N}`,
      cite: SRC.top510('p9 Fig A2.14'),
      beyond: true,
    })
    steps.push({
      label: 'Self-energising: friction drags the expander further round',
      tex: 'F = \\dfrac{P}{\\tan\\alpha - f R_f / r_b}',
      sub: `= \\dfrac{${n(P, 4)}}{${n(Math.tan(DISC.ramp), 3)} - ${DISC.f}\\times${n(Rf, 3)}/${DISC.rBall}}`,
      result: `F = ${n(r.F, 4)}\\ \\text{N}\\ (\\times${n(r.servoFactor, 3)})`,
      cite: SRC.top510('p9: degree set by μ and the ball-seat angle'),
      beyond: true,
    })
    steps.push({
      label: 'Braking torque, four friction faces',
      tex: 'T = n\\,\\mu\\,F\\,R_f,\\quad R_f = \\tfrac{1}{2}(R_o + R_i)',
      sub: `= ${DISC.surfaces}\\times${DISC.f}\\times${n(r.F, 4)}\\times${n(Rf, 3)}`,
      result: `T = ${n(r.T, 4)}\\ \\text{N·m}`,
      cite: SRC.m503(8, 'T = F·f·R_f·n, uniform wear'),
    })
  } else {
    const area = Math.PI * (WET.pistonR1 ** 2 - WET.pistonR0 ** 2)
    const b = brakeTorque(st)
    steps.push({
      label: 'Piston force',
      tex: 'F = p\\,A - F_{return}',
      sub: `= ${n(pr.left / 1e6, 3)}\\ \\text{MPa}\\times${n(area * 1e4, 3)}\\ \\text{cm}^2 - ${WET.returnForce}`,
      result: `F = ${n(b.F / 1000, 4)}\\ \\text{kN}`,
      cite: SRC.top510('p9 wet discs, hydraulically applied'),
      beyond: true,
    })
    steps.push({
      label: 'Torque of the plate pack',
      tex: 'T = n\\,\\mu\\,F\\,R_f',
      sub: `n = 2\\times${WET.discs} = ${2 * WET.discs},\\ \\mu = ${WET.f},\\ R_f = ${n(frictionRadiusUniformWear(WET.rOut, WET.rIn), 3)}\\ \\text{m}`,
      result: `T = ${n(b.T, 4)}\\ \\text{N·m}`,
      cite: SRC.m503(8, 'multi-disc torque, n friction pairs'),
    })
  }
  const T = brakeTorque(st).T
  const pl = brakePlacement(T * st.finalRatio, st.finalRatio, 0.35, 0.1, 2)
  steps.push({
    label: 'Why the brake sits on the fast, low-torque shaft',
    tex: 'T_{shaft} = \\dfrac{T_{wheel}}{i_f}',
    sub: `T_{wheel} = ${n(T, 4)}\\times${n(st.finalRatio, 3)} = ${n(T * st.finalRatio, 4)}\\ \\text{N·m}`,
    result: `\\text{the same brake at the wheel would need } ${n(st.finalRatio, 3)}\\times\\ \\text{the clamp force } (${n(pl.forceOnWheel / 1000, 3)}\\ \\text{vs } ${n(pl.forceOnShaft / 1000, 3)}\\ \\text{kN})`,
    cite: SRC.tts510('p11'),
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function BrakesPanel() {
  const st = useBrakes()
  const [preset, setPreset] = useState<string | null>(null)
  const change = (p: Partial<typeof DEFAULTS>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Brake">
        <Segmented<BrakeType>
          value={st.type}
          onChange={(type) => change({ type })}
          options={[
            { value: 'shoe', label: 'Expanding shoe', title: 'Internal expanding shoes in a drum' },
            { value: 'disc', label: 'Dry disc', title: 'Dry disc brake with ball-ramp expander' },
            { value: 'wet', label: 'Wet multi-plate', title: 'Wet sintered plates running in oil' },
          ]}
          size="sm"
        />
        <Slider label="Left pedal" value={st.left} min={0} max={1} step={0.01} onChange={(left) => change({ left })} />
        <Slider label="Right pedal" value={st.right} min={0} max={1} step={0.01} onChange={(right) => change({ right })} />
        <Toggle label="Pedals latched together" checked={st.latched} onChange={(latched) => change({ latched })} />
        <Slider label="Full pedal force" value={st.pedalForce} min={100} max={600} step={10} unit="N" onChange={(pedalForce) => change({ pedalForce })} />
        <Slider label="Final-reduction ratio (shaft : wheel)" value={st.finalRatio} min={1} max={8} step={0.1} unit=": 1" onChange={(finalRatio) => change({ finalRatio })} />
        <Note>The model shows the left brake. Release the pedals and the shaft runs back up to {st.shaftRpm} rpm.</Note>
      </Section>
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Exam points">
        <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-ink/85">
          <li>Expanding shoe: pedal turns the cam, the shoes spread and grip the drum, springs pull them back.</li>
          <li>Disc brake: greater braking area than a shoe brake of the same size; balls in tapered grooves force the actuating discs apart.</li>
          <li>Wet sintered multi-plate brakes in the axle housings: protected from dirt, very reliable, absorb large energy.</li>
          <li>Independent pedals for turning; latch them for road work. Hydraulic brakes: one master cylinder per pedal, balancing valve when latched.</li>
          <li>A brake is more effective on a fast-moving, low-torque shaft — between the differential and the final reduction.</li>
        </ul>
      </Section>
      <BrakeWorking />
    </div>
  )
}
