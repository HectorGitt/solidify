import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, Points, PresetGrid, type Preset } from '../../chassis/common/bits'
import { AXLE, BOX, C, DEFAULTS, RIM_R, axleFor, idealOuter, live, rodForToeMM, solveSteer, toeVerdict, useSteer, type SteerParams } from './model'

const deg = (r: number) => (r * 180) / Math.PI
const apply = (p: Partial<SteerParams>) => useSteer.getState().set({ ...DEFAULTS, ...p })

const PRESETS: Preset[] = [
  { id: 'centre', label: 'Straight ahead, toe-in set', note: 'Wheel centred. The track rod is set so A is about 4.5 mm less than B (target 3–6 mm, ⅛–¼ in).', apply: () => apply({ sweep: false, wheel: 0 }) },
  { id: 'left', label: 'Half lock left', note: 'Turn the wheel 200°: the drop arm swings 200/15 ≈ 13°, the drag link pulls the steering arm and the track rod turns the other wheel. The inner wheel turns more than the outer.', apply: () => apply({ sweep: false, wheel: 200 }) },
  { id: 'wide', label: 'Track widened 80 mm, rod NOT reset', note: 'Widening the telescopic axle without resetting the track rod pulls the wheels into heavy toe-out. The track rod must be reset whenever the track width is changed.', apply: () => apply({ sweep: false, wheel: 0, trackMM: 80, rodReset: false, exaggerate: false }) },
  { id: 'reset', label: 'Track widened 80 mm, rod reset', note: 'The track rod lengthened by the same 80 mm: toe-in is back inside 3–6 mm.', apply: () => apply({ sweep: false, wheel: 0, trackMM: 80, rodReset: true }) },
  { id: 'out', label: 'Rod 3 mm too short', note: 'A track rod shortened 3 mm from nominal (behind the axle) turns the wheel fronts outward: toe-out, A > B. Tyres scrub and the steering wanders.', apply: () => apply({ sweep: false, wheel: 0, rodMM: -3, exaggerate: true }) },
]

function LivePanel() {
  const v = useLive(() => {
    const s = live.s
    return s ? { w: live.wheel, a: deg(s.alpha), i: deg(s.inner), o: deg(s.outer), id: deg(s.ideal), R: s.radii.rearMid } : null
  }, 15, (a, b) => !!a && !!b && a.w === b.w && a.i === b.i)
  if (!v) return null
  const err = Math.abs(v.o) > 0.5 ? v.o - v.id : 0
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Steering wheel" value={`${fmt(v.w, 3)}°`} unit={`${fmt(v.w / 360, 2)} turns`} />
        <Readout label="Drop arm" value={`${fmt(v.a, 3)}°`} unit={`÷ ${BOX.ratio}`} tone="info" />
        <Readout label="Turn radius" value={Number.isFinite(v.R) && v.R < 200 ? fmt(v.R, 3) : '∞'} unit="m (rear centre)" />
        <Readout label="Inner wheel" value={`${fmt(v.i, 3)}°`} tone="accent" />
        <Readout label="Outer wheel" value={`${fmt(v.o, 3)}°`} tone="accent" />
        <Readout label="Ackermann outer" value={`${fmt(v.id, 3)}°`} unit={`error ${fmt(err, 2)}°`} tone={Math.abs(err) > 3 ? 'warn' : 'ink'} />
      </div>
      <Note>Positive angles turn the wheel fronts to the left. The inner wheel must turn more than the outer so both roll about one centre; the inward-angled track-rod arms do this (Ackermann geometry).</Note>
    </Section>
  )
}

function ToeCheck() {
  const st = useSteer()
  const s0 = solveSteer({ ...st, wheel: 0 })
  const diff = (s0.B - s0.A) * 1000
  const v = toeVerdict(diff)
  const { ax } = axleFor(st)
  return (
    <Section title="Toe-in check">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="A (front)" value={fmt(s0.A * 1000, 5)} unit="mm" />
        <Readout label="B (rear)" value={fmt(s0.B * 1000, 5)} unit="mm" />
        <Readout label="B − A" value={fmt(diff, 3)} unit="mm" tone={v.tone} />
      </div>
      <p className={`mt-1 text-[11.5px] ${v.tone === 'warn' ? 'text-warn' : 'text-accent'}`}>{v.text}</p>
      <button
        className="mt-1.5 rounded border border-line-2 px-2 py-0.5 text-[11.5px] text-mute hover:text-ink"
        onClick={() => useSteer.getState().set({ rodReset: true, rodMM: Math.round(rodForToeMM(4.5, ax) * 100) / 100 })}
      >
        Adjust the track rod for 4.5 mm toe-in
      </button>
      <Note>Measured between the rims at hub height, in front of (A) and behind (B) the axle, with the wheels straight ahead. Set by turning the track rod in its threaded ends (one left-hand thread) and locking the clamp bolts. Some 4WD tractors use no toe-in.</Note>
    </Section>
  )
}

function AngleChart() {
  const st = useSteer()
  const data = useMemo(() => {
    const xs: number[] = []
    const lk: number[] = []
    const ak: number[] = []
    for (let w = 0; w <= 420; w += 10) {
      const s = solveSteer({ ...st, wheel: w })
      xs.push(deg(s.inner))
      lk.push(deg(s.outer))
      ak.push(deg(idealOuter(s.inner, axleFor(st).ax)))
    }
    return [xs, lk, ak]
  }, [st])
  return (
    <Section title="Outer vs inner wheel angle">
      <Chart
        data={data}
        series={[
          { label: 'this linkage', color: '#9bd17a', width: 2 },
          { label: 'Ackermann', color: '#93a59a', width: 1.5, dash: [4, 3] },
        ]}
        xLabel="Inner wheel angle (°)"
        yLabel="Outer wheel angle (°)"
        marker={() => (live.s && live.s.inner > 0 ? [deg(live.s.inner), deg(live.s.outer)] : null)}
        height={160}
      />
      <Note>Left turns only (the drag link makes the linkage slightly asymmetric). At small angles the toe-in shows as a constant offset. Ideal: cot δo − cot δi = track / wheelbase.</Note>
    </Section>
  )
}

function SteerWorking() {
  const st = useSteer()
  const s0 = solveSteer({ ...st, wheel: 0 })
  const w = st.sweep ? 200 : st.wheel
  const s = solveSteer({ ...st, wheel: w })
  const { ax } = axleFor(st)
  const t = 2 * ax.zk
  const steps: WorkingStep[] = [
    {
      label: 'Steering box: the wheel turns the drop arm through a small angle',
      tex: '\\alpha = \\dfrac{\\theta_{wheel}}{i_{box}}',
      sub: `= \\dfrac{${n(w, 3)}^\\circ}{${BOX.ratio}}`,
      result: `= ${n(deg(s.alpha), 3)}^\\circ\\quad(\\text{about }\\pm30^\\circ\\text{ at full lock})`,
      cite: C.box[0],
      beyond: true,
    },
    {
      label: 'Toe-in at the rim',
      tex: 'B - A = 2r\\,(\\sin\\delta_+ - \\sin\\delta_-)',
      sub: `= 2(${n(RIM_R * 1000, 3)})\\big(\\sin ${n(deg(s0.dPlus), 3)}^\\circ - \\sin(${n(deg(s0.dMinus), 3)}^\\circ)\\big)`,
      result: `= ${n((s0.B - s0.A) * 1000, 3)}\\ \\text{mm}\\quad(3\\text{–}6\\ \\text{mm})`,
      cite: C.toe[0],
    },
    {
      label: 'Ideal outer angle for the inner angle (Ackermann)',
      tex: '\\cot\\delta_o = \\cot\\delta_i + \\dfrac{t}{l}',
      sub: `= \\cot ${n(deg(s.inner), 3)}^\\circ + \\dfrac{${n(t, 3)}}{${AXLE.wheelbase}}`,
      result: `\\delta_o = ${n(deg(s.ideal), 3)}^\\circ\\quad(\\text{linkage } ${n(deg(s.outer), 3)}^\\circ)`,
      cite: SRC.beyond('Ackermann steering geometry'),
      beyond: true,
    },
    {
      label: 'Turning radius of the rear-axle centre',
      tex: 'R = \\dfrac{l}{\\tan\\delta_o} - \\dfrac{t}{2}',
      sub: `= \\dfrac{${AXLE.wheelbase}}{\\tan ${n(Math.abs(deg(s.outer)), 3)}^\\circ} - ${n(t / 2, 3)}`,
      result: `= ${n(s.radii.rearMid, 3)}\\ \\text{m}`,
      cite: SRC.beyond('turning circle'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function SteeringPanel() {
  const st = useSteer()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<SteerParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Steering">
        <Toggle label="Sweep lock to lock" checked={st.sweep} onChange={(sweep) => set({ sweep })} />
        <Slider label="Steering-wheel angle" value={st.wheel} min={-400} max={400} step={5} unit="°" onChange={(wheel) => set({ wheel, sweep: false })} hint="+ turns left" />
        <Slider label="Track-rod length (from nominal)" value={st.rodMM} min={-6} max={8} step={0.1} unit="mm" onChange={(rodMM) => set({ rodMM })} />
        <Slider label="Track width change" value={st.trackMM} min={-100} max={100} step={10} unit="mm" onChange={(trackMM) => set({ trackMM })} hint="telescopic front axle" />
        <Toggle label="Track rod reset to the new track" checked={st.rodReset} onChange={(rodReset) => set({ rodReset })} />
        <Toggle label="Exaggerate toe on screen (×10)" checked={st.exaggerate} onChange={(exaggerate) => set({ exaggerate })} />
      </Section>
      <ToeCheck />
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <AngleChart />
      <Section title="Exam points">
        <Points
          items={[
            'Three steering types: manual, power-assisted (manual linkage + pump, valve and double-acting ram — still steers if the hydraulics fail) and hydrostatic (no mechanical link; cannot steer with the engine off).',
            'Manual linkage: steering wheel → steering box → drop arm → drag link → steering arm → stub axle; a track rod joins the two steering arms so both wheels move together.',
            'A variant uses two drop arms and two drag links and no track rod.',
            'Toe-in: A is 3–6 mm (⅛–¼ in) less than B at hub height; set by the track-rod length. Reset the track rod whenever the track width is changed.',
            'Service: grease the steering linkage every 10 h, wheel bearings every 50 h; check the box oil (SAE 90) every 200 h.',
          ]}
        />
      </Section>
      <SteerWorking />
    </div>
  )
}
