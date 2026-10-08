import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { airDensity, indicatedFromBrake, indicatedThermalEfficiency } from '@/physics/engine'
import { PETROIL, petroilOil, petroilPercent, petroilRatio, portDurations, twoStrokeState, volumetricEfficiencyFromAir } from '@/physics/engineExtra'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { CASE_LABEL, CRANKCASE_CR, DIM, GAS, PHASE_LABEL, PORTS, SC, SPARK_BTDC, TIMING, TRAPPED_CR, VC, VS, live, useTwoStroke, type PetroilMix } from './model'

const MIX: Record<PetroilMix, { ratio: number; label: string; src: string }> = {
  '16': { ratio: PETROIL.tbLarger, label: '16 : 1', src: 'Larger engines — 16 : 1' },
  '24': { ratio: PETROIL.tbSmaller, label: '24 : 1', src: 'Smaller engines — 24 : 1' },
  '2pc': { ratio: petroilRatio(2), label: '2 %', src: '2 % oil in the petrol' },
  '3pc': { ratio: petroilRatio(3), label: '3 %', src: '3 % oil in the petrol' },
}

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.theta === b.theta)
  const pct = (f: number) => `${Math.round(f * 100)}%`
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Crank angle" value={`${Math.round(v.theta)}°`} unit="ATDC" />
        <Readout label="Above piston" value={<span className="text-[12px]">{PHASE_LABEL[v.phase]}</span>} tone="warn" />
        <Readout label="Below piston" value={<span className="text-[12px]">{CASE_LABEL[v.casePhase]}</span>} tone="info" />
        <Readout label="Cylinder p" value={fmt(v.pCyl / 100, 3)} unit="bar" tone="accent" />
        <Readout label="Crankcase p" value={fmt(v.pCase / 100, 3)} unit="bar" tone="info" />
        <Readout label="Ports E / T / I" value={<span className="text-[12px]">{`${pct(v.exhaust)} ${pct(v.transfer)} ${pct(v.inlet)}`}</span>} />
      </div>
      {v.spark ? <p className="mt-1.5 text-[11.5px] text-warn">Spark — {SPARK_BTDC}° before TDC</p> : null}
    </Section>
  )
}

/** Circular port-timing diagram, angles computed from the port heights. */
function PortWheel() {
  const theta = useLive(() => live.theta, 30)
  const t = TIMING
  const R = 70
  const cx = 90
  const cy = 90
  const pt = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const arc = (from: number, to: number, r: number) => {
    let sweep = to - from
    while (sweep < 0) sweep += 360
    const [x0, y0] = pt(from, r)
    const [x1, y1] = pt(from + sweep, r)
    return `M ${x0} ${y0} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`
  }
  const tag = (deg: number, r: number, text: string, anchor: 'start' | 'end' | 'middle' = 'middle') => {
    const [x, y] = pt(deg, r)
    return (
      <text x={x} y={y} fontSize={8.5} fill="#93a59a" textAnchor={anchor} dominantBaseline="middle" fontFamily="JetBrains Mono, monospace">
        {text}
      </text>
    )
  }
  const needle = pt(theta, R + 8)
  const d = portDurations(t)
  const sp = 360 - SPARK_BTDC
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 180 180" width={170} height={170} role="img" aria-label="Port timing diagram">
        <circle cx={cx} cy={cy} r={R + 14} fill="none" stroke="#27332d" />
        <line x1={cx} y1={cy - R - 18} x2={cx} y2={cy + R + 18} stroke="#34433b" strokeDasharray="2 3" />
        <path d={arc(t.eo, t.ec, R)} stroke="var(--color-exhaust)" strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d={arc(t.to, t.tc, R - 11)} stroke="#9fe0d0" strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d={arc(t.io, t.ic, R - 11)} stroke="var(--color-intake)" strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d={arc(sp - 1.5, sp + 1.5, R - 22)} stroke="#f5e27a" strokeWidth={6} fill="none" />
        {tag(0, R + 24, 'TDC')}
        {tag(180, R + 24, 'BDC')}
        {tag(t.eo, R - 22, `EO ${Math.round(t.eo)}`, 'end')}
        {tag(t.ec, R - 22, `EC ${Math.round(t.ec)}`, 'start')}
        {tag(t.to, R - 36, `TO ${Math.round(t.to)}`, 'end')}
        {tag(t.tc, R - 36, `TC ${Math.round(t.tc)}`, 'start')}
        {tag(t.io, R - 30, `IO ${Math.round(t.io)}`, 'start')}
        {tag(t.ic, R - 30, `IC ${Math.round(t.ic)}`, 'end')}
        <line x1={cx} y1={cy} x2={needle[0]} y2={needle[1]} stroke="#f5b942" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={3} fill="#f5b942" />
      </svg>
      <div className="space-y-1 text-[11.5px] text-mute">
        <div>
          <span className="mr-1.5 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: 'var(--color-exhaust)' }} />
          Exhaust {Math.round(d.exhaust)}°
        </div>
        <div>
          <span className="mr-1.5 inline-block h-2 w-4 rounded-sm align-middle bg-[#9fe0d0]" />
          Transfer {Math.round(d.transfer)}°
        </div>
        <div>
          <span className="mr-1.5 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: 'var(--color-intake)' }} />
          Inlet {Math.round(d.inlet)}°
        </div>
        <div>
          <span className="mr-1.5 inline-block h-2 w-4 rounded-sm align-middle bg-[#f5e27a]" />
          Spark {SPARK_BTDC}° BTDC
        </div>
        <div className="pt-1 text-ink/85">Blow-down lead {Math.round(d.blowdown)}°</div>
        <div className="flex items-center gap-1 pt-0.5">
          <Badge tone="info" title="Port heights are typical values; angles computed from them">indicative</Badge>
        </div>
      </div>
    </div>
  )
}

function PressureChart() {
  const data = useMemo(() => {
    const xs: number[] = []
    const cyl: number[] = []
    const cc: number[] = []
    for (let th = 0; th <= 360; th += 2) {
      const s = twoStrokeState(th, SC, PORTS, GAS)
      xs.push(th)
      cyl.push(s.pCyl / 100)
      cc.push(s.pCase / 100)
    }
    return [xs, cyl, cc]
  }, [])
  const [log, setLog] = useState(true)
  return (
    <Section
      title="Pressure above & below the piston"
      right={
        <span className="flex items-center gap-2">
          <Badge tone="info" title="Indicative air-standard model">indicative</Badge>
          <button className="text-[11px] text-info hover:underline" onClick={() => setLog((l) => !l)}>
            {log ? 'linear' : 'log'}
          </button>
        </span>
      }
    >
      <Chart
        data={data}
        series={[
          { label: 'Cylinder', color: '#e8794f', width: 2 },
          { label: 'Crankcase', color: '#7cc4ea', width: 2 },
        ]}
        xLabel="Crank angle after TDC (deg)"
        yLabel="Pressure (bar abs)"
        xRange={[0, 360]}
        logY={log}
        marker={() => [live.theta, live.pCyl / 100]}
        height={170}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Orange: cylinder (compression after the exhaust closes, combustion at TDC, expansion, blow-down). Blue: crankcase — pre-compressed to ≈{fmt(twoStrokeState(TIMING.to - 0.5, SC, PORTS, GAS).pCase / 100, 3)} bar
        just before the transfer opens, and below atmospheric (suction) just before the inlet opens.
      </p>
    </Section>
  )
}

const TABLE: [string, string, string][] = [
  ['Power stroke', 'One every two revolutions', 'One every revolution'],
  ['Inlet / outlet', 'Inlet and exhaust valves', 'Ports instead of valves'],
  ['Crankcase', 'Not airtight', 'Fully closed and airtight'],
  ['Compression', 'Top of the piston only', 'Both sides of the piston'],
  ['Flywheel', 'Large', 'Comparatively small'],
  ['Combustion', 'Full', 'Partial'],
  ['Weight per hp', 'High', 'Comparatively low'],
  ['Volumetric efficiency', 'Higher — more time for induction', 'Lower — less time for induction'],
  ['Cooling & lubrication', 'Usually liquid cooled; separate lube system', 'Usually air cooled; petroil lubrication'],
  ['Wear', 'Less', 'Faster'],
  ['Thermal efficiency', 'Higher at normal loads', 'Lower at normal loads'],
]

function Comparison() {
  return (
    <Section title="Four-stroke vs two-stroke">
      <table className="w-full text-[11px] leading-snug">
        <thead>
          <tr className="text-mute">
            <th className="py-0.5 pr-1 text-left font-medium" />
            <th className="py-0.5 pr-1 text-left font-medium">Four-stroke</th>
            <th className="py-0.5 text-left font-medium text-accent">Two-stroke</th>
          </tr>
        </thead>
        <tbody>
          {TABLE.map(([k, a, b]) => (
            <tr key={k} className="border-t border-line align-top">
              <td className="py-1 pr-1 text-mute">{k}</td>
              <td className="py-1 pr-1 text-ink/80">{a}</td>
              <td className="py-1 text-ink">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

function Petroil() {
  const mix = useTwoStroke((s) => s.mix)
  const petrol = useTwoStroke((s) => s.petrol)
  const set = useTwoStroke((s) => s.set)
  const m = MIX[mix]
  const oil = petroilOil(petrol, m.ratio)
  return (
    <Section title="Petroil (mist) lubrication">
      <Segmented<PetroilMix> value={mix} onChange={(v) => set({ mix: v })} options={(Object.keys(MIX) as PetroilMix[]).map((k) => ({ value: k, label: MIX[k].label, title: MIX[k].src }))} />
      <Slider label="Petrol in the can" value={petrol} min={1} max={20} step={0.5} unit="L" onChange={(v) => set({ petrol: v })} />
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Oil to add" value={fmt(oil * 1000, 3)} unit="mL" tone="accent" />
        <Readout label="Ratio" value={`${fmt(m.ratio, 3)} : 1`} />
        <Readout label="Oil / petrol" value={fmt(petroilPercent(m.ratio), 3)} unit="%" />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-dim">
        {m.src}. In the carburettor the volatile petrol vaporises; the denser oil settles as a mist on the crankcase and cylinder walls, bearings and con-rod. The golden particles in the crankcase
        show it. The 16 : 1 and 24 : 1 mixes are much richer in oil than 2–3 % (≈ 50 : 1 – 33 : 1) — use the engine maker’s figure.
      </p>
    </Section>
  )
}

function PortWorking() {
  const t = TIMING
  const d = portDurations(t)
  const steps: WorkingStep[] = [
    {
      label: 'Piston travel from TDC (slider-crank)',
      tex: 'x(\\theta) = r(1-\\cos\\theta) + l - \\sqrt{l^2 - r^2\\sin^2\\theta}',
      sub: `r = ${n(DIM.crankR * 1000, 3)}\\,\\text{mm},\\; l = ${n(DIM.rodL * 1000, 3)}\\,\\text{mm}`,
      cite: SRC.beyond('slider-crank kinematics'),
      beyond: true,
    },
    {
      label: 'Exhaust opens when x reaches the top of the exhaust port',
      tex: 'x(\\theta_{EO}) = h_E \\;\\Rightarrow\\; \\theta_{EC} = 360^\\circ - \\theta_{EO}',
      sub: `h_E = ${n(PORTS.exhaustTop * 1000, 3)}\\,\\text{mm}`,
      result: `\\theta_{EO} = ${n(t.eo, 4)}^\\circ\\text{ ATDC},\\; \\theta_{EC} = ${n(t.ec, 4)}^\\circ`,
      cite: SRC.tb509('Fig 2.4'),
      beyond: true,
    },
    {
      label: 'Transfer port (lower, so it opens later)',
      tex: 'x(\\theta_{TO}) = h_T',
      sub: `h_T = ${n(PORTS.transferTop * 1000, 3)}\\,\\text{mm}`,
      result: `\\theta_{TO} = ${n(t.to, 4)}^\\circ,\\; \\theta_{TC} = ${n(t.tc, 4)}^\\circ;\\;\\text{blow-down } ${n(d.blowdown, 3)}^\\circ`,
      cite: SRC.add509('exhaust and transfer ports uncovered on the down-stroke'),
      beyond: true,
    },
    {
      label: 'Inlet port, uncovered by the skirt near TDC',
      tex: 'x(\\theta) < h_I \\;\\Rightarrow\\; \\text{open from } 360^\\circ-\\theta_{IC}\\text{ to }\\theta_{IC}',
      sub: `h_I = ${n(PORTS.inletTravel * 1000, 3)}\\,\\text{mm}`,
      result: `\\theta_{IO} = ${n(t.io, 4)}^\\circ\\;(${n(360 - t.io, 3)}^\\circ\\text{ BTDC}),\\; \\theta_{IC} = ${n(t.ic, 4)}^\\circ\\text{ ATDC}`,
      cite: SRC.add509('inlet port opens beneath the piston into the crankcase'),
      beyond: true,
    },
    {
      label: 'Compression only starts when the exhaust port is covered',
      tex: 'r_{trapped} = \\dfrac{V_c + V_s\\,h_E/L}{V_c}',
      sub: `V_s = ${n(VS * 1e6, 4)}\\,\\text{cm}^3,\\; V_c = V_s/(r-1) = ${n(VC * 1e6, 4)}\\,\\text{cm}^3`,
      result: `r_{trapped} = ${n(TRAPPED_CR, 3)}\\;\\text{vs geometric } ${DIM.r}\\,;\\;\\text{crankcase CR} \\approx ${CRANKCASE_CR}`,
      cite: SRC.tb509('p9 CR = TCV/CV'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working — port timing">
      <Working steps={steps} />
    </Section>
  )
}

function Ex5Working() {
  const ip = indicatedFromBrake(4.68e3, 0.85)
  const mf = (2.4e-3 * 760) / 3600
  const ith = indicatedThermalEfficiency(ip, mf, 44e6)
  const ma = mf * 3600 * 15
  const rho = airDensity(1e5, 298)
  const ev = volumetricEfficiencyFromAir(ma, rho, 100e-6, 5500, 2)
  const steps: WorkingStep[] = [
    { label: 'Indicated power', tex: 'IP = BP/\\eta_m', sub: '= 4.68/0.85', result: `= ${n(ip / 1000, 4)}\\ \\text{kW}`, cite: SRC.misc509('p6, Ex 5') },
    { label: 'Fuel rate', tex: '\\dot m_f = V\\rho_f', sub: '= 2.4\\times10^{-3}\\times760', result: `= ${n(mf * 3600, 4)}\\ \\text{kg/h}`, cite: SRC.misc509('p6, Ex 5') },
    {
      label: 'Indicated thermal efficiency',
      tex: '\\eta_{ith} = \\dfrac{IP}{\\dot m_f\\,HV}',
      sub: `= \\dfrac{${n(ip / 1000, 4)}\\times3600}{44\\,000\\times${n(mf * 3600, 4)}}`,
      result: `= ${n(ith * 100, 3)}\\,\\%`,
      cite: SRC.misc509('p6, Ex 5'),
    },
    {
      label: 'Air per cycle (one cycle per revolution) at 1 bar, 298 K',
      tex: 'V = \\dfrac{\\dot m_a R T}{p\\,N}',
      sub: `= \\dfrac{${n(ma, 4)}\\times287\\times298}{60\\times5500\\times10^5}`,
      result: `= ${n((ma / 60 / 5500 / rho) * 1e6, 3)}\\ \\text{cm}^3/\\text{cycle}`,
      cite: SRC.misc509('p6, Ex 5'),
    },
    { label: 'Volumetric efficiency', tex: '\\eta_v = V/V_s', sub: `= ${n((ma / 60 / 5500 / rho) * 1e6, 3)}/100`, result: `= ${n(ev, 3)}`, cite: SRC.misc509('p6, Ex 5') },
  ]
  return (
    <Section title="Working — lawn-mower two-stroke example">
      <Working steps={steps} />
    </Section>
  )
}

interface Preset {
  id: string
  label: string
  note: string
  apply: () => void
}

const PRESETS: Preset[] = [
  {
    id: 'ex5',
    label: 'Mower engine example',
    note: 'Two-stroke lawn-mower engine: 4.68 kW brake power, ηm 0.85, 2.4 L/h petrol (760 kg/m³, 44 MJ/kg), A/F 15, 100 cm³ at 5500 rpm. Expect IP 5.506 kW, ηith 24.7 %, ηv 0.709 (see working).',
    apply: () => useTwoStroke.getState().set({ rpm: 5500 }),
  },
  {
    id: 'combustion',
    label: 'Exam · combustion in a petroil engine',
    note: 'Exams 2021/22 Q1a and 2022/23 Q1b(ii): describe the combustion process in a two-stroke. Slowed right down — follow the Live readouts: above the piston, compression → spark → power → exhaust blow-down → transfer; below it, induction → pre-compression → transfer → suction.',
    apply: () => useTwoStroke.getState().set({ rpm: 300, flows: true }),
  },
  {
    id: 'mist',
    label: 'Exam · mist lubrication',
    note: 'Exams 2021/22 Q2b(ii), 2022/23 Q1a(v), 2017/18 Q2d: explain mist lubrication in a petroil engine. Oil travels with the fuel; the golden mist in the crankcase lubricates the bearings, con-rod and cylinder walls.',
    apply: () => useTwoStroke.getState().set({ mist: true, mix: '24', rpm: 600 }),
  },
]

export function TwoStrokePanel() {
  const st = useTwoStroke()
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <LivePanel />
      <Section title="Controls">
        <Slider label="Engine speed" value={st.rpm} min={200} max={6000} step={50} unit="rpm" onChange={(rpm) => st.set({ rpm })} />
        <Toggle label="Show charge and exhaust flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        <Toggle label="Show petroil mist in the crankcase" checked={st.mist} onChange={(mist) => st.set({ mist })} />
      </Section>
      <Section title="Exam presets">
        <div className="grid grid-cols-1 gap-1.5">
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
      <Section title="Port timing (computed from port heights)">
        <PortWheel />
      </Section>
      <PressureChart />
      <Petroil />
      <Comparison />
      <PortWorking />
      <Ex5Working />
    </div>
  )
}
