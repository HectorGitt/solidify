import { useMemo, useState } from 'react'
import { cabs, isoBoundary, THIRD_OCTAVES, seatTransfer, transmissibility, vibrationLevel } from '@/physics/vibration'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../_shared/ui'
import { C, DEFAULTS, GROUND, T, getCase, live, pick, seatParams, useSeat, type Ground, type SeatState } from './model'

const set = (p: Partial<SeatState>) => useSeat.getState().set(p)

const PRESETS: Preset[] = [
  {
    id: 'rigid',
    label: 'No suspension',
    note: 'Seat bolted to the platform: the operator rides the tractor’s 3–10 Hz bounce and pitch on the cushion alone. Compare the ISO chart with the suspended seat.',
    apply: () => set({ ...DEFAULTS, suspension: false }),
  },
  {
    id: 'good',
    label: 'Well-tuned seat',
    note: 'ω_s = 1.5 Hz, ζ = 0.25: the tractor’s bounce near 3 Hz is at ω_t/ω_s ≈ 2 > 1.414, so T < 1. T = 0.5–0.65 is considered satisfactory.',
    apply: () => set({ ...DEFAULTS }),
  },
  {
    id: 'resonant',
    label: 'Seat tuned to the tractor',
    note: 'ω_s = 3 Hz ≈ ω_t with light damping (ζ = 0.1): ω_t/ω_s ≈ 1, the suspension resonates and makes things worse than no suspension.',
    apply: () => set({ ...DEFAULTS, fs: 3, zs: 0.1 }),
  },
  {
    id: 'stops',
    label: 'Ploughed field, fast',
    note: '15 km/h over ploughed ground with a soft, lightly damped seat: the suspension runs out of stroke and hits its stops — a nonlinearity that makes real seats differ from the linear one-DOF formula.',
    apply: () => set({ ...DEFAULTS, ground: 'ploughed', V: 15, fs: 1.0, zs: 0.1 }),
  },
]

function useS() {
  const s = useSeat()
  return useMemo(() => pick(s), [s])
}

function LivePanel() {
  const st = useS()
  const cs = getCase(st)
  const v = useLive(() => ({ t: live.t, man: live.manRms, floor: live.floorRms, hits: live.hits, stroke: live.stroke }), 10, (a, b) => a.t === b.t)
  const fdp = isoBoundary(cs.worstBand, st.hours)
  const over = cs.allowed < st.hours
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Operator a_z RMS" value={fmt(v.man, 3)} unit="m/s²" tone={over ? 'warn' : 'accent'} />
        <Readout label="Floor RMS" value={fmt(v.floor, 3)} unit="m/s²" />
        <Readout label="Stroke" value={fmt(v.stroke * 1000, 2)} unit="mm" tone={Math.abs(v.stroke) > T.travel ? 'warn' : 'ink'} />
        <Readout label="Steady a_z RMS" value={fmt(cs.manRms, 3)} unit="m/s²" />
        <Readout label="Seat T = a_z/Z̈" value={fmt(cs.manRms / cs.floorRms, 3)} tone={cs.manRms < cs.floorRms ? 'accent' : 'warn'} />
        <Readout label="Stop hits" value={v.hits} tone={v.hits ? 'warn' : 'ink'} />
      </div>
      <p className={`mt-1.5 text-[11.5px] leading-snug ${over ? 'text-warn' : 'text-mute'}`}>
        ISO 2631 fatigue-decreased proficiency: worst band {fmt(cs.worstBand, 3)} Hz — allowed exposure ≈ {cs.allowed >= 24 ? '24 h or more' : `${fmt(cs.allowed, 2)} h`}
        {over ? ` (less than the ${st.hours} h working day)` : ''}. FDP limit at that band for {st.hours} h: {fmt(fdp, 3)} m/s².
      </p>
      <Note>Running RMS uses a 5 s window of the live RK4 solution; “steady” is the exact frequency-domain value.</Note>
    </Section>
  )
}

function Controls() {
  const st = useS()
  return (
    <Section title="Field, operator and seat">
      <Segmented<Ground>
        label="Ground"
        value={st.ground}
        onChange={(ground) => set({ ground })}
        options={(Object.keys(GROUND) as Ground[]).map((g) => ({ value: g, label: GROUND[g].label, title: `${GROUND[g].note} (assumed roughness)` }))}
      />
      <Slider label="Forward speed" value={st.V} min={2} max={20} step={0.5} unit="km/h" onChange={(V) => set({ V })} />
      <Segmented<string>
        label="Operator mass (percentiles)"
        size="sm"
        value={String(st.op)}
        onChange={(v) => set({ op: Number(v) })}
        options={[
          { value: '58', label: '5th · 58 kg' },
          { value: '75', label: '50th · 75 kg' },
          { value: '98', label: '95th · 98 kg' },
        ]}
      />
      <Toggle label="Seat suspension" checked={st.suspension} onChange={(suspension) => set({ suspension })} />
      {st.suspension ? (
        <>
          <Slider label="Seat natural frequency ω_s/2π" value={st.fs} min={0.6} max={5} step={0.05} unit="Hz" onChange={(fs) => set({ fs })} hint="ω_s = √(k₂/M), M = m₁ + m₂" />
          <Slider label="Suspension damping ζ" value={st.zs} min={0} max={1} step={0.01} onChange={(zs) => set({ zs })} />
        </>
      ) : null}
      <Slider label="Exposure per day" value={st.hours} min={1} max={16} step={0.5} unit="h" onChange={(hours) => set({ hours })} />
    </Section>
  )
}

function TransmissibilityChart() {
  const st = useS()
  const cs = getCase(st)
  const p = cs.params
  const data = useMemo(() => {
    const f: number[] = []
    const man: number[] = []
    const seat: number[] = []
    const sdof: number[] = []
    const M = p.m1 + p.m2
    const ws = Math.sqrt(p.k2 / M)
    const z = p.c2 / (2 * M * ws)
    for (let i = 0; i <= 300; i++) {
      const hz = 0.3 * Math.pow(30 / 0.3, i / 300)
      const w = 2 * Math.PI * hz
      const t = seatTransfer(p, w)
      f.push(hz)
      man.push(cabs(t.man))
      seat.push(cabs(t.seat))
      sdof.push(transmissibility(w / ws, z))
    }
    return [f, man, seat, sdof]
  }, [p])
  const dominant = THIRD_OCTAVES[cs.bandsFloor.indexOf(Math.max(...cs.bandsFloor))]
  return (
    <Section title="Seat transmissibility">
      <Chart
        data={data}
        series={[
          { label: 'operator / floor', color: '#f5b942', width: 2 },
          { label: 'seat / floor', color: '#6fb3e0', width: 1.5 },
          { label: 'one-DOF formula', color: '#93a59a', width: 1.25, dash: [4, 4] },
        ]}
        xLabel="Frequency (Hz)"
        yLabel="Transmissibility"
        logX
        marker={() => {
          const t = seatTransfer(p, 2 * Math.PI * dominant)
          return [dominant, cabs(t.man)]
        }}
        height={180}
      />
      <Note>
        Gold: two-DOF seat model (operator). Blue: seat pan. Dashed: one-DOF transmissibility with M = m₁ + m₂ on k₂, c₂. The dot sits at the band carrying most floor vibration ({fmt(dominant, 3)} Hz). T &lt; 1 only above √2 × the seat frequency.
      </Note>
    </Section>
  )
}

function IsoChart() {
  const st = useS()
  const cs = getCase(st)
  const data = useMemo(() => {
    const f = THIRD_OCTAVES
    const nz = (a: number[]) => a.map((v) => (v > 1e-4 ? v : null))
    return [f, nz(cs.bandsFloor), nz(cs.bandsMan), f.map((x) => isoBoundary(x, st.hours, 'fdp')), f.map((x) => isoBoundary(x, st.hours, 'exposure')), f.map((x) => isoBoundary(x, st.hours, 'comfort'))]
  }, [cs, st.hours])
  return (
    <Section title="ISO 2631 vertical boundaries">
      <Chart
        data={data}
        series={[
          { label: 'floor', color: '#93a59a', width: 1.5 },
          { label: 'operator', color: '#f5b942', width: 2 },
          { label: `FDP ${st.hours} h`, color: '#e8794f', width: 1.75 },
          { label: 'exposure limit', color: '#e05252', width: 1, dash: [5, 3] },
          { label: 'reduced comfort', color: '#6fb3e0', width: 1, dash: [2, 3] },
        ]}
        xLabel="Centre frequency of 1/3-octave band (Hz)"
        yLabel="a_z RMS (m/s²)"
        logX
        logY
        yRange={[0.003, 10]}
        height={200}
      />
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-mute">
        <span className="text-[#93a59a]">— floor</span>
        <span className="text-[#f5b942]">— operator</span>
        <span className="text-[#e8794f]">— fatigue-decreased proficiency ({st.hours} h)</span>
        <span className="text-[#e05252]">-- exposure limit</span>
        <span className="text-[#6fb3e0]">·· reduced comfort</span>
      </div>
      <Note>
        The fatigue-decreased proficiency (FDP) curves are flat at 4–8 Hz, where people are most sensitive. The exposure limit is FDP × 2 and the reduced-comfort boundary FDP ÷ 3.15. At 4–8 Hz the 16 min FDP level is 1.6 m/s².
      </Note>
    </Section>
  )
}

function Trace() {
  const ver = useLive(() => live.version, 10)
  const data = useMemo(() => [live.traceT.slice(), live.traceFloor.slice(), live.traceMan.slice()], [ver]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Section title="Acceleration, last 4 s">
      <Chart
        data={data}
        series={[
          { label: 'floor', color: '#93a59a', width: 1.25 },
          { label: 'operator', color: '#f5b942', width: 1.75 },
        ]}
        xLabel="Time (s, now = 0)"
        yLabel="a_z (m/s²)"
        height={140}
      />
    </Section>
  )
}

function SeatWorking() {
  const st = useS()
  const cs = getCase(st)
  const p = seatParams(st)
  const M = p.m1 + p.m2
  const ws = Math.sqrt(p.k2 / M)
  const cc = 2 * M * ws
  const z = p.c2 / cc
  const idx = cs.bandsFloor.indexOf(Math.max(...cs.bandsFloor))
  const ft = THIRD_OCTAVES[idx]
  const r = (2 * Math.PI * ft) / ws
  const T14 = transmissibility(r, z)
  const steps: WorkingStep[] = [
    {
      label: 'Seat natural frequency (seat + operator on the suspension spring)',
      tex: '\\omega_s = \\sqrt{k/M},\\quad M = m_1 + m_2',
      sub: `= \\sqrt{${n(p.k2)}/(${n(p.m1)}+${n(p.m2)})}`,
      result: `= ${n(ws)}\\ \\text{rad/s}\\;(${n(ws / (2 * Math.PI), 3)}\\ \\text{Hz})`,
      cite: C.he('eq 17, p19'),
    },
    {
      label: 'Damping ratio',
      tex: '\\zeta = c/c_c,\\quad c_c = 2M\\omega_s',
      sub: `c_c = 2\\times${n(M)}\\times${n(ws)} = ${n(cc)},\\quad \\zeta = ${n(p.c2)}/${n(cc)}`,
      result: `\\zeta = ${n(z, 3)}`,
      cite: C.he('eq 15–16'),
    },
    {
      label: `Transmissibility at the dominant tractor frequency (${fmt(ft, 3)} Hz band)`,
      tex: 'T = \\left[\\dfrac{1+4\\zeta^2(\\omega_t/\\omega_s)^2}{\\left[1-(\\omega_t/\\omega_s)^2\\right]^2+4\\zeta^2(\\omega_t/\\omega_s)^2}\\right]^{0.5}',
      sub: `\\omega_t/\\omega_s = ${n(2 * Math.PI * ft)}/${n(ws)} = ${n(r, 3)}`,
      result: `T = ${n(T14, 3)}${r > Math.SQRT2 ? '\\;(<1:\\ \\text{isolating})' : '\\;(\\text{amplifying: } \\omega_t/\\omega_s < 1.414)'}`,
      cite: C.he('eq 14, Fig 10.10'),
    },
    {
      label: 'Operator acceleration, using the whole spectrum',
      tex: 'a_z = T\\cdot\\ddot Z_{input},\\qquad \\ddot X_{RMS} = \\tfrac{1}{\\sqrt2}\\,\\omega^2 A\\ \\text{per component}',
      sub: `\\ddot Z_{input,RMS} = ${n(cs.floorRms, 3)}\\ \\text{m/s}^2,\\quad a_{z,RMS} = ${n(cs.manRms, 3)}\\ \\text{m/s}^2`,
      result: `\\text{effective } T = ${n(cs.manRms / cs.floorRms, 3)},\\quad VAL = 20\\log(a_z/1) = ${n(vibrationLevel(cs.manRms), 3)}\\ \\text{dB}`,
      cite: C.he('eq 9, 10, 18'),
    },
    {
      label: 'Compare each 1/3-octave band with the ISO 2631 FDP boundary',
      tex: 'a_{band} \\le a_{FDP}(f, t)',
      sub: `\\text{worst band } ${n(cs.worstBand, 3)}\\ \\text{Hz}: ${n(cs.bandsMan[THIRD_OCTAVES.indexOf(cs.worstBand)], 3)}\\ \\text{vs}\\ ${n(isoBoundary(cs.worstBand, st.hours), 3)}\\ \\text{m/s}^2\\ (${st.hours}\\ \\text{h})`,
      result: cs.allowed >= 24 ? '\\text{within the 24 h boundary}' : `t_{allowed} \\approx ${n(cs.allowed, 3)}\\ \\text{h}`,
      cite: C.he('Fig 10.6, p12'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
      <Note>
        Model: tractor body {fmt(T.mass, 4)} kg split between the axles on tyre springs (typical stiffnesses), floor motion at the seat z_input = z_t + Rθ; seat as the two-DOF model with a 25 kg seat
        and a 5 Hz cushion. Ground roughness follows ISO 8608 ({GROUND[st.ground].note}, RMS height {fmt(cs.groundRms * 1000, 3)} mm).
      </Note>
    </Section>
  )
}

export function Panel() {
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <IsoChart />
      <TransmissibilityChart />
      <Trace />
      <SeatWorking />
    </div>
  )
}
