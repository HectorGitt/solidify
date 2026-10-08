import { useMemo, useState } from 'react'
import { overlapPattern, ratePerHa, spinnerCalibLength, spinnerRateFromRefill } from '@/physics/application'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../_appkit/ui'
import { BC, C, DEFAULTS, GATE_FULL, MS, MS_LOAD_H, broadcaster, live, manure, useSpreader, type SpreaderParams } from './model'

const S = () => useSpreader.getState()
const apply = (p: Partial<SpreaderParams>) => S().set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  {
    id: 'cal',
    label: 'Spinner calibration',
    note: 'Measure the effective width W (8 m), drive 400/W = 50 m (0.04 ha), refill the hopper and weigh the refill: 6 kg × 25 = 150 kg/ha.',
    apply: () => apply({ machine: 'broadcaster', calW: 8, calRefill: 6, bout: 8 }),
  },
  {
    id: 'speed',
    label: 'Double the speed',
    note: 'Same gate, twice the forward speed: the same kilograms per second spread over twice the area, so the rate per hectare halves. Rate depends on gate opening, forward speed and disc speed.',
    apply: () => apply({ machine: 'broadcaster', speed: 12, gate: 0.4 }),
  },
  {
    id: 'slow-disc',
    label: 'Slow disc',
    note: 'A slower disc throws the granules a shorter distance: the spread width shrinks below the usual 6–9 m, and the bout width must shrink with it or strips are missed.',
    apply: () => apply({ machine: 'broadcaster', discRpm: 250, bout: 8 }),
  },
  {
    id: 'manure',
    label: 'Manure, ground drive',
    note: 'Ground-driven apron: the pawl strokes once per wheel turn, so the apron speed — and the ground covered — both rise with forward speed. The rate per hectare stays the same at any speed.',
    apply: () => apply({ machine: 'manure', drive: 'ground', teeth: 2, speed: 6 }),
  },
  {
    id: 'manure-pto',
    label: 'Manure, PTO drive',
    note: 'PTO-driven apron: the apron runs at a fixed speed, so driving faster spreads the same flow thinner, like the broadcaster.',
    apply: () => apply({ machine: 'manure', drive: 'pto', teeth: 2, speed: 6 }),
  },
  {
    id: 'heavy',
    label: 'More teeth per stroke',
    note: 'The rate lever makes the pawl take more teeth each stroke: the apron, and the rate, rise in proportion.',
    apply: () => apply({ machine: 'manure', drive: 'ground', teeth: 4, speed: 6 }),
  },
]

function LiveBroadcaster() {
  const st = useSpreader()
  const b = broadcaster(st)
  const hop = useLive(() => live.hopper, 6)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Rate" value={fmt(b.rate, 3)} unit="kg/ha" tone="accent" />
        <Readout label="Gate flow" value={fmt(b.mdot, 3)} unit="kg/s" />
        <Readout label="Spread width" value={fmt(b.width, 2)} unit="m" tone={b.width < st.bout ? 'warn' : 'ink'} />
        <Readout label="Disc tip" value={fmt(b.tip, 3)} unit="m/s" />
        <Readout label="Exit speed" value={fmt(b.exit.v, 3)} unit="m/s" />
        <Readout label="Hopper" value={`${Math.round(hop * 100)}`} unit="%" />
      </div>
      <Note>Granules leave the vanes at about √2 × the tip speed and are slowed by air drag; the pattern falls off towards the edges, so passes are overlapped. The hopper level runs on a ×20 time-lapse.</Note>
    </Section>
  )
}

function LiveManure() {
  const st = useSpreader()
  const m = manure(st)
  const load = useLive(() => live.load, 6)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Rate" value={fmt(m.tHa, 3)} unit="t/ha" tone="accent" />
        <Readout label="Apron" value={fmt(m.u * 60, 3)} unit="m/min" />
        <Readout label="Feed" value={fmt(m.mdot, 3)} unit="kg/s" />
        <Readout label="Wheel" value={fmt(m.nW, 3)} unit="rpm" />
        <Readout label="Lower beater" value={fmt(m.beater, 3)} unit="rpm" />
        <Readout label="Load lasts" value={fmt(m.emptyDist, 3)} unit="m" />
      </div>
      <Note>
        Load {Math.round(load * 100)} % ({fmt(MS.load / 1000, 3)} t full, ×10 time-lapse). The lower beater turns opposite to the wheels at about 6½ × wheel speed.
      </Note>
    </Section>
  )
}

function PatternChart() {
  const discRpm = useSpreader((s) => s.discRpm)
  const bout = useSpreader((s) => s.bout)
  const data = useMemo(() => {
    const b = broadcaster({ ...DEFAULTS, discRpm, bout })
    const o = overlapPattern(b.pat.zs, b.pat.ys, bout)
    const xs = b.pat.zs
    const at = (z: number) => {
      const i = Math.round(((z - o.zs[0]) / (o.zs[o.zs.length - 1] - o.zs[0])) * (o.zs.length - 1))
      return z >= o.zs[0] && z <= o.zs[o.zs.length - 1] ? o.ys[i] / bout : null
    }
    return [xs, b.pat.ys, xs.map(at)]
  }, [discRpm, bout])
  return (
    <Section title="Spread pattern across the bout">
      <Chart
        data={data}
        series={[
          { label: 'Single pass (per kg)', color: '#e8794f', width: 2 },
          { label: 'Overlapped at bout width', color: '#9bd17a', width: 2 },
        ]}
        xLabel="Lateral distance (m)"
        yLabel="Deposit (1/m)"
        height={160}
      />
      <Note>Back-and-forth passes at the bout width add the tails of neighbouring passes into an even layer. Trajectories use a drag model.</Note>
    </Section>
  )
}

function RateSpeedChart() {
  const teeth = useSpreader((s) => s.teeth)
  const data = useMemo(() => {
    const st = { ...DEFAULTS, teeth }
    const xs: number[] = []
    const g: number[] = []
    const p: number[] = []
    for (let s = 2; s <= 12; s += 0.25) {
      xs.push(s)
      g.push(manure({ ...st, speed: s, drive: 'ground' }).tHa)
      p.push(manure({ ...st, speed: s, drive: 'pto' }).tHa)
    }
    return [xs, g, p]
  }, [teeth])
  return (
    <Section title="Rate against forward speed">
      <Chart
        data={data}
        series={[
          { label: 'Ground-driven apron', color: '#9bd17a', width: 2 },
          { label: 'PTO-driven apron', color: '#6fb3e0', width: 2 },
        ]}
        xLabel="Forward speed (km/h)"
        yLabel="t/ha"
        marker={() => {
          const s = useSpreader.getState()
          return [s.speed, manure(s).tHa]
        }}
        height={160}
      />
    </Section>
  )
}

function BroadcastWorking() {
  const st = useSpreader()
  const b = broadcaster(st)
  const L = spinnerCalibLength(st.calW)
  const steps: WorkingStep[] = [
    {
      label: 'Gate flow onto the disc',
      tex: '\\dot m = k_g\\,a',
      sub: `= ${n(GATE_FULL, 3)}\\,\\text{kg/s}\\times${n(st.gate, 3)}${st.agitator ? '' : '\\times0.7\\ (\\text{bridging, no agitator})'}`,
      result: `= ${n(b.mdot, 3)}\\ \\text{kg/s}`,
      cite: C.am('§14.4.1 — rate depends on gate opening'),
      beyond: true,
    },
    {
      label: 'Application rate',
      tex: 'Q = \\dfrac{10\\,000\\,\\dot m}{B\\,v}',
      sub: `= \\dfrac{10\\,000\\times${n(b.mdot, 3)}}{${n(st.bout, 3)}\\times${n(b.v, 3)}}`,
      result: `= ${n(b.rate, 4)}\\ \\text{kg/ha}`,
      cite: C.am('§14.4.1 — gate, forward speed, disc speed'),
    },
    {
      label: 'Disc tip and exit speed (frictionless vane)',
      tex: 'v_e = \\omega\\sqrt{2R^2 - r_0^2}',
      sub: `= ${n((2 * Math.PI * st.discRpm) / 60, 4)}\\sqrt{2(${n(BC.R, 3)})^2-(${n(BC.r0, 3)})^2}`,
      result: `= ${n(b.exit.v, 3)}\\ \\text{m/s}`,
      beyond: true,
    },
    {
      label: 'Calibration run for 0.04 ha',
      tex: 'L = \\dfrac{400}{W}',
      sub: `= \\dfrac{400}{${n(st.calW, 3)}}`,
      result: `= ${n(L, 4)}\\ \\text{m}`,
      cite: C.am('§14.7 calibration of spinner'),
    },
    {
      label: 'Rate from the refill',
      tex: 'Q = 25\\,m_{\\text{refill}}',
      sub: `= 25\\times${n(st.calRefill, 3)}\\,\\text{kg}`,
      result: `= ${n(spinnerRateFromRefill(st.calRefill), 4)}\\ \\text{kg/ha}\\quad(=${n(ratePerHa(st.calRefill, 0.04), 4)})`,
      cite: C.am('§14.7'),
    },
  ]
  return (
    <Section title="Working — broadcaster">
      <div className="grid grid-cols-2 gap-x-3">
        <Slider label="Effective width W" value={st.calW} min={4} max={12} step={0.5} unit="m" onChange={(calW) => st.set({ calW })} />
        <Slider label="Refill weighed" value={st.calRefill} min={1} max={20} step={0.5} unit="kg" onChange={(calRefill) => st.set({ calRefill })} />
      </div>
      <Working steps={steps} />
    </Section>
  )
}

function ManureWorking() {
  const st = useSpreader()
  const m = manure(st)
  const steps: WorkingStep[] = [
    {
      label: st.drive === 'ground' ? 'Pawl strokes = wheel speed (one stroke per turn)' : 'Pawl strokes from the PTO (540 ÷ 15)',
      tex: st.drive === 'ground' ? 'N = \\dfrac{60\\,v}{2\\pi r}' : 'N = 540/15',
      sub: st.drive === 'ground' ? `= \\dfrac{60\\times${n(m.v, 3)}}{2\\pi\\times${n(MS.wheelR, 3)}}` : undefined,
      result: `= ${n(m.strokes, 4)}\\ \\text{strokes/min}`,
      beyond: true,
    },
    {
      label: 'Apron speed (ratchet and pawl)',
      tex: 'u = \\dfrac{N}{60}\\cdot\\dfrac{t}{T}\\cdot\\pi D',
      sub: `= \\dfrac{${n(m.strokes, 4)}}{60}\\cdot\\dfrac{${st.teeth}}{${MS.ratchetTeeth}}\\cdot\\pi\\times${n(MS.sprocketD, 3)}`,
      result: `= ${n(m.u * 60, 4)}\\ \\text{m/min}`,
      cite: C.am('§14.3.1 — ratchet and pawl'),
      beyond: true,
    },
    {
      label: 'Manure fed to the beaters',
      tex: '\\dot m = \\rho\\,b\\,H\\,u',
      sub: `= ${MS.rho}\\times${n(MS.b, 3)}\\times${n(MS_LOAD_H, 3)}\\times${n(m.u, 4)}`,
      result: `= ${n(m.mdot, 4)}\\ \\text{kg/s}`,
      cite: C.am('§14.3.1 — apron speed determines the volume'),
      beyond: true,
    },
    {
      label: 'Application rate',
      tex: 'Q = \\dfrac{\\dot m}{W\\,v}',
      sub: `= \\dfrac{${n(m.mdot, 4)}}{${n(MS.W, 3)}\\times${n(m.v, 3)}}\\times10`,
      result: `= ${n(m.tHa, 4)}\\ \\text{t/ha}`,
    },
    {
      label: 'Lower beater speed',
      tex: 'n_b \\approx 6.5\\,n_w',
      sub: `= 6.5\\times${n(m.nW, 4)}`,
      result: `= ${n(m.beater, 4)}\\ \\text{rpm}`,
      cite: C.am('§14.3.1 — 6–7 times wheel speed'),
    },
  ]
  return (
    <Section title="Working — manure spreader">
      <Working steps={steps} />
    </Section>
  )
}

export function SpreadersPanel() {
  const st = useSpreader()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<SpreaderParams>) => {
    setPreset(null)
    st.set(p)
  }
  const isB = st.machine === 'broadcaster'
  return (
    <div>
      <Section title="Machine">
        <Segmented
          value={st.machine}
          options={[
            { value: 'broadcaster', label: 'Spinning-disc broadcaster' },
            { value: 'manure', label: 'Manure spreader' },
          ]}
          onChange={(machine) => set({ machine })}
        />
      </Section>
      {isB ? <LiveBroadcaster /> : <LiveManure />}
      <Section title="Controls">
        <Slider label="Forward speed" value={st.speed} min={2} max={14} step={0.5} unit="km/h" onChange={(speed) => set({ speed })} />
        {isB ? (
          <>
            <Slider label="Feed-gate opening" value={st.gate} min={0} max={1} step={0.01} onChange={(gate) => set({ gate })} hint="Watch the shutter slide under the hopper" />
            <Slider label="Disc speed" value={st.discRpm} min={200} max={900} step={10} unit="rpm" onChange={(discRpm) => set({ discRpm })} />
            <Slider label="Bout (driving) width" value={st.bout} min={4} max={12} step={0.5} unit="m" onChange={(bout) => set({ bout })} />
            <Toggle label="Agitator running" checked={st.agitator} onChange={(agitator) => set({ agitator })} hint="Without it the fertilizer bridges over the outlet" />
          </>
        ) : (
          <>
            <Segmented
              label="Apron drive"
              value={st.drive}
              options={[
                { value: 'ground', label: 'Ground wheels' },
                { value: 'pto', label: 'PTO' },
              ]}
              onChange={(drive) => set({ drive })}
            />
            <Slider label="Ratchet teeth per stroke" value={st.teeth} min={1} max={5} step={1} onChange={(teeth) => set({ teeth })} hint="The rate lever" />
          </>
        )}
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      {isB ? <PatternChart /> : <RateSpeedChart />}
      {isB ? <BroadcastWorking /> : <ManureWorking />}
    </div>
  )
}
