import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { KGCM2_TO_MPA, motor, pump } from '@/physics/hydraulics'
import { gearPumpDisplacementExact, gearPumpRipple, gearRadii, vaneChamberVolume, vanePumpDisplacementExact } from '@/physics/pumps'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DEFAULTS, GEAR, MG1617, VANE, displacement, live, usePumps, vaneGeom, type PumpParams, type Source } from './model'

const GUIDE_ERRATA =
  'The question gives the displacement as “150 litres/min” and the actual as “120 litres/min”, but the working uses 150 as D in cm³/rev (TT = 18 × 150/2π) and 1800 × 120/1000 = 216 L/min as the actual delivery — i.e. D = 150 cm³/rev, QT = 270 L/min, QA = 216 L/min. The guide also writes ep = ev × ep for ev × eT.'

interface Preset {
  id: string
  label: string
  note: string
  params: Partial<PumpParams>
}

const PRESETS: Preset[] = [
  {
    id: 'guide',
    label: '2016/17 guide · pump',
    note: '1800 rpm, 18 MPa, D = 150 cm³/rev, ηv 0.8, ηT 0.9. Expect TT 429.7, TA 477.5 N·m, Ph 64.8 kW, Ps 90 kW, heat 25.2 kW.',
    params: { source: 'manual', D: 150, rpm: 1800, dp: 18, etaV: 0.8, etaT: 0.9 },
  },
  {
    id: 'tractor',
    label: 'Tractor lift pump',
    note: 'The drawn gear pump at 2000 rpm: 27.8 L/min theoretical, ≈ 27 L/min delivered — typical for a 45 kW (60 hp) tractor. Working against the 150 kg/cm² (14.7 MPa) relief setting it needs about 7 kW.',
    params: { source: 'gear', rpm: 2000, dp: 150 * KGCM2_TO_MPA, etaV: 0.97, etaT: 0.9 },
  },
  {
    id: 'vane-max',
    label: 'Vane pump, full stroke',
    note: 'Ring at its full 6 mm eccentricity: the vane pump displaces 4πReL − 2e·n·t·L. Slide the eccentricity to zero and the delivery falls to nothing — the principle of the variable-displacement pump.',
    params: { source: 'vane', ecc: 0.006, rpm: 1500, dp: 10, etaV: 0.9, etaT: 0.88 },
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.theta === b.theta)
  const ecc = usePumps((s) => s.ecc)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Shaft angle" value={`${Math.round(v.theta)}°`} />
        <Readout label="Gear pump D" value={fmt(gearPumpDisplacementExact(GEAR), 4)} unit="cm³/rev" />
        <Readout label="Vane pump D" value={fmt(vanePumpDisplacementExact(vaneGeom(ecc)), 4)} unit="cm³/rev" />
        <Readout label="Gear delivery" value={fmt(v.ripple * 100, 4)} unit="% of mean" tone="accent" />
        <Readout label="Vane chamber" value={fmt(v.chamber, 3)} unit="cm³" tone="info" />
        <Readout label="Eccentricity" value={fmt(ecc * 1000, 3)} unit="mm" />
      </div>
    </Section>
  )
}

function Calculator() {
  const st = usePumps()
  const D = displacement(st)
  const p = pump(D, st.rpm, st.dp, st.etaV, st.etaT)
  const m = motor(D, p.QT / st.etaV, st.dp, st.etaV, st.etaT)
  return (
    <Section title="Pump vs motor (same D, N and Δp)">
      <table className="w-full font-mono text-[11.5px]">
        <thead className="text-dim">
          <tr>
            <th className="text-left font-normal" />
            <th className="text-right font-normal">pump</th>
            <th className="text-right font-normal">motor</th>
          </tr>
        </thead>
        <tbody className="text-ink/90">
          <tr>
            <td>Q theoretical</td>
            <td className="text-right">{fmt(p.QT, 4)}</td>
            <td className="text-right">{fmt(p.QT, 4)} L/min</td>
          </tr>
          <tr>
            <td>Q actual</td>
            <td className="text-right text-accent">{fmt(p.QA, 4)} &lt;</td>
            <td className="text-right text-info">{fmt(p.QT / st.etaV, 4)} &gt;</td>
          </tr>
          <tr>
            <td>T theoretical</td>
            <td className="text-right">{fmt(p.TT, 4)}</td>
            <td className="text-right">{fmt(p.TT, 4)} N·m</td>
          </tr>
          <tr>
            <td>T actual</td>
            <td className="text-right text-accent">{fmt(p.TA, 4)} &gt;</td>
            <td className="text-right text-info">{fmt(m.TA, 4)} &lt;</td>
          </tr>
          <tr>
            <td>ηv</td>
            <td className="text-right">QA/QT</td>
            <td className="text-right">QT/QA</td>
          </tr>
          <tr>
            <td>ηT</td>
            <td className="text-right">TT/TA</td>
            <td className="text-right">TA/TT</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1.5 text-[11.5px] leading-snug text-mute">
        For a pump the actual delivery is <b>less</b> than theoretical (leakage) and the actual torque <b>more</b> (friction); for a motor the reverse — the same equations with the
        efficiencies reversed.
      </p>
    </Section>
  )
}

function Charts() {
  const ecc = usePumps((s) => s.ecc)
  const ripple = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * 90
      xs.push(a)
      ys.push(gearPumpRipple(GEAR, (a * Math.PI) / 180) * 100)
    }
    return { xs, ys }
  }, [])
  const chamber = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * 360
      xs.push(a)
      ys.push(vaneChamberVolume(vaneGeom(ecc), (a * Math.PI) / 180) * 1e6)
    }
    return { xs, ys }
  }, [ecc])
  const z = GEAR.teeth
  return (
    <Section title="Inside the pumps">
      <Chart
        data={[ripple.xs, ripple.ys]}
        series={[{ label: 'gear-pump delivery', color: '#e8794f', width: 2 }]}
        xLabel="Drive-shaft angle (°)"
        yLabel="Delivery (% of mean)"
        marker={() => [live.theta % 90, live.ripple * 100]}
        height={140}
      />
      <p className="mb-2 mt-1 text-[11px] leading-snug text-dim">
        The delivery pulses once per tooth ({z} times a revolution): q ∝ r_a² − r² − u², u = distance of the contact point from the pitch point.
      </p>
      <Chart
        data={[chamber.xs, chamber.ys]}
        series={[{ label: 'vane chamber volume', color: '#6fb3e0', width: 2 }]}
        xLabel="Chamber angle from the ring offset (°)"
        yLabel="Chamber volume (cm³)"
        marker={() => [live.vanePhi, live.chamber]}
        height={140}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">Each chamber fills on the inlet side (volume rising) and empties on the outlet side, once per revolution.</p>
    </Section>
  )
}

function PumpWorking() {
  const st = usePumps()
  const D = displacement(st)
  const p = pump(D, st.rpm, st.dp, st.etaV, st.etaT)
  const isGuide = st.source === 'manual' && st.D === 150 && st.rpm === 1800 && st.dp === 18
  const G = gearRadii(GEAR)
  const steps: WorkingStep[] = []
  if (st.source === 'gear') {
    steps.push({
      label: 'Gear-pump displacement from the gear geometry',
      tex: 'D = 2\\pi b\\left(r_a^2 - r^2 - \\tfrac{p_b^2}{12}\\right),\\ p_b = \\pi m\\cos 20^\\circ',
      sub: `= 2\\pi(${n(GEAR.width * 1000, 3)})\\left(${n(G.ra * 1000, 3)}^2 - ${n(G.r * 1000, 3)}^2 - \\tfrac{${n(G.pb * 1000, 4)}^2}{12}\\right)\\ \\text{mm}^3`,
      result: `= ${n(D, 4)}\\ \\text{cm}^3/\\text{rev}`,
      cite: SRC.beyond('external gear pump displacement'),
      beyond: true,
    })
  } else if (st.source === 'vane') {
    steps.push({
      label: 'Vane-pump displacement from the ring and rotor',
      tex: 'D = 2eL(2\\pi R - n\\,t)',
      sub: `= 2(${n(st.ecc * 1000, 3)})(${n(VANE.width * 1000, 3)})(2\\pi\\times${n(VANE.ringR * 1000, 3)} - ${VANE.vanes}\\times${n(VANE.vaneT * 1000, 2)})\\ \\text{mm}^3`,
      result: `= ${n(D, 4)}\\ \\text{cm}^3/\\text{rev}`,
      cite: SRC.beyond('unbalanced vane pump displacement'),
      beyond: true,
    })
  }
  steps.push(
    {
      label: 'Theoretical delivery',
      tex: 'Q_T = \\dfrac{DN}{1000}',
      sub: `= \\dfrac{${n(D, 4)}\\times${n(st.rpm, 4)}}{1000}`,
      result: `= ${n(p.QT, 4)}\\ \\text{L/min}`,
      cite: MG1617('Q(c)'),
      errata: isGuide ? GUIDE_ERRATA : undefined,
    },
    {
      label: 'Actual delivery (volumetric efficiency)',
      tex: 'Q_A = \\eta_v Q_T',
      sub: `= ${n(st.etaV, 3)}\\times${n(p.QT, 4)}`,
      result: `= ${n(p.QA, 4)}\\ \\text{L/min}`,
      cite: MG1617('Q(c): ev = QA/QT'),
    },
    {
      label: 'Theoretical and actual torque',
      tex: 'T_T = \\dfrac{\\Delta p\\,D}{2\\pi},\\quad T_A = \\dfrac{T_T}{\\eta_T}',
      sub: `= \\dfrac{${n(st.dp, 4)}\\times${n(D, 4)}}{2\\pi},\\quad \\dfrac{T_T}{${n(st.etaT, 3)}}`,
      result: `T_T = ${n(p.TT, 4)},\\quad T_A = ${n(p.TA, 4)}\\ \\text{N·m}`,
      cite: MG1617('Q(c)'),
    },
    {
      label: 'Hydraulic power, shaft power and heat',
      tex: 'P_h = \\dfrac{Q_A\\Delta p}{60},\\quad P_s = \\dfrac{P_h}{\\eta_v\\eta_T},\\quad \\text{heat} = P_s - P_h',
      sub: `= \\dfrac{${n(p.QA, 4)}\\times${n(st.dp, 4)}}{60},\\quad \\dfrac{${n(p.Ph, 4)}}{${n(p.etaO, 3)}}`,
      result: `P_h = ${n(p.Ph, 4)},\\ P_s = ${n(p.Ps, 4)},\\ \\text{heat} = ${n(p.heatLoss, 4)}\\ \\text{kW}`,
      cite: MG1617('Q(c)'),
    },
  )
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function PumpsPanel() {
  const st = usePumps()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<PumpParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Pumps">
        <Slider label="Vane-pump eccentricity e" value={st.ecc * 1000} min={0} max={6} step={0.1} unit="mm" onChange={(v) => set({ ecc: v / 1000 })} hint="Moves the cam ring" />
        <Slider label="Drive speed N" value={st.rpm} min={300} max={3000} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Toggle label="Show oil flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
      </Section>
      <Section title="Calculator">
        <Segmented<Source>
          size="sm"
          value={st.source}
          onChange={(source) => set({ source })}
          options={[
            { value: 'gear', label: 'Gear pump', title: 'Displacement from the drawn gear pump' },
            { value: 'vane', label: 'Vane pump', title: 'Displacement from the drawn vane pump' },
            { value: 'manual', label: 'Given D', title: 'Type in the displacement' },
          ]}
        />
        {st.source === 'manual' ? <Slider label="Displacement D" value={st.D} min={5} max={250} step={0.5} unit="cm³/rev" onChange={(D) => set({ D })} /> : null}
        <Slider label="Pressure rise Δp" value={st.dp} min={1} max={30} step={0.01} unit="MPa" onChange={(dp) => set({ dp })} />
        <Slider label="Volumetric efficiency ηv" value={st.etaV} min={0.5} max={1} step={0.01} onChange={(etaV) => set({ etaV })} />
        <Slider label="Torque (mechanical) efficiency ηT" value={st.etaT} min={0.5} max={1} step={0.01} onChange={(etaT) => set({ etaT })} />
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
        {preset === 'guide' ? <p className="mt-1 text-[11px] leading-snug text-warn/90">{GUIDE_ERRATA}</p> : null}
      </Section>
      <Calculator />
      <Charts />
      <PumpWorking />
    </div>
  )
}
