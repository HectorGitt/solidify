import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { ERRATA } from '@/content/errata'
import { valveOverlapDeg } from '@/physics/engine'
import { AIR, airStandardCycle, cycleLoop, dualFromPmaxEqualHeat, type CycleKind } from '@/physics/thermo'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DIM, VALVE_TIMING, VS, chargeMass, computeCycle, live, useEngine } from './model'

const STROKE_LABEL = { intake: 'Intake', compression: 'Compression', power: 'Power', exhaust: 'Exhaust' } as const
const STROKE_TONE = { intake: 'info', compression: 'accent', power: 'warn', exhaust: 'warn' } as const

interface Preset {
  id: string
  label: string
  note: string
  apply: () => void
}

const k = AIR.k

const PRESETS: Preset[] = [
  {
    id: 'ex9',
    label: 'Otto · r = 10, 2500 K',
    note: '105 kPa, 295 K → 8902 kPa, 2500 K (r = 10). Expect η = 60.2 %.',
    apply: () => {
      const T2 = 295 * Math.pow(10, k - 1)
      useEngine.getState().set({ cycle: 'otto', r: 10, P1: 105, T1: 295, q: AIR.cv * (2500 - T2) })
    },
  },
  {
    id: 'ex12',
    label: 'Diesel · r = 20',
    note: 'r = 20, 100 kPa, 300 K, 2000 kJ/kg. Expect δ = 3, η = 60.6 %, mep ≈ 1480 kPa.',
    apply: () => useEngine.getState().set({ cycle: 'diesel', r: 20, P1: 100, T1: 300, q: 2000 }),
  },
  {
    id: 'exam-dual',
    label: 'Exam · Dual cycle',
    note: 'In all four past papers: r = 16, 1 bar, 50 °C, Pmax = 70 bar, Qv = Qp.',
    apply: () => {
      const { alpha, delta } = dualFromPmaxEqualHeat(7000, 16, 100, 323)
      const c = airStandardCycle({ kind: 'dual', r: 16, P1: 100, T1: 323, alpha, delta })
      useEngine.getState().set({ cycle: 'dual', r: 16, P1: 100, T1: 323, q: c.qIn, fV: 0.5 })
    },
  },
  {
    id: 'exam-diesel',
    label: 'Exam · Diesel to 1753 K',
    note: 'r = 16, 100 kPa, 288 K, maximum temperature 1753 K.',
    apply: () => {
      const T2 = 288 * Math.pow(16, k - 1)
      useEngine.getState().set({ cycle: 'diesel', r: 16, P1: 100, T1: 288, q: AIR.cp * (1753 - T2) })
    },
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.theta === b.theta && a.P === b.P)
  const rev = v.theta < 360 ? 1 : 2
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Crank angle" value={`${Math.round(v.theta % 360)}°`} unit={`rev ${rev}`} />
        <Readout label="Stroke" value={STROKE_LABEL[v.stroke]} tone={STROKE_TONE[v.stroke]} />
        <Readout label="Volume" value={fmt(v.Vcm3, 3)} unit="cm³" />
        <Readout label="Pressure" value={fmt(v.P / 100, 3)} unit="bar" tone="accent" />
        <Readout label="Temperature" value={fmt(v.T, 3)} unit="K" tone={v.T > 1200 ? 'warn' : 'ink'} />
        <Readout label="Valve lift" value={`${(v.inletLift * 1000).toFixed(1)} / ${(v.exhaustLift * 1000).toFixed(1)}`} unit="mm I/E" />
      </div>
      {v.injecting ? <p className="mt-1.5 text-[11.5px] text-warn">Injecting fuel…</p> : null}
    </Section>
  )
}

/** Circular valve-timing diagram with the live crank position (AEE509 L4). */
function TimingWheel() {
  const theta = useLive(() => live.theta, 30)
  const vt = VALVE_TIMING
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
  const ivo = 360 - vt.ivoBTDC
  const ivc = 180 + vt.ivcABDC
  const evo = 180 - vt.evoBBDC
  const evc = vt.evcATDC
  const needle = pt(theta % 360, R + 8)
  const tag = (deg: number, r: number, text: string, anchor: 'start' | 'end' | 'middle' = 'middle') => {
    const [x, y] = pt(deg, r)
    return (
      <text x={x} y={y} fontSize={9} fill="#93a59a" textAnchor={anchor} dominantBaseline="middle" fontFamily="JetBrains Mono, monospace">
        {text}
      </text>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 180 180" width={170} height={170} role="img" aria-label="Valve timing diagram">
        <circle cx={cx} cy={cy} r={R + 14} fill="none" stroke="#27332d" />
        <line x1={cx} y1={cy - R - 18} x2={cx} y2={cy + R + 18} stroke="#34433b" strokeDasharray="2 3" />
        <path d={arc(ivo, ivc, R)} stroke="var(--color-intake)" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.9} />
        <path d={arc(evo, 360 + evc, R - 11)} stroke="var(--color-exhaust)" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.9} />
        <path d={arc(360 - 15, 15, R - 22)} stroke="#e8d06a" strokeWidth={4} fill="none" opacity={0.8} />
        {tag(0, R + 24, 'TDC')}
        {tag(180, R + 24, 'BDC')}
        {tag(ivo, R + 6 - 30, `IVO ${vt.ivoBTDC}°`, 'end')}
        {tag(ivc, R - 30, `IVC ${vt.ivcABDC}°`, 'end')}
        {tag(evo, R - 40, `EVO ${vt.evoBBDC}°`, 'start')}
        {tag(evc, R - 36, `EVC ${vt.evcATDC}°`, 'start')}
        <line x1={cx} y1={cy} x2={needle[0]} y2={needle[1]} stroke="#f5b942" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={3} fill="#f5b942" />
      </svg>
      <div className="space-y-1 text-[11.5px] text-mute">
        <div>
          <span className="mr-1.5 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: 'var(--color-intake)' }} />
          Inlet open {vt.ivoBTDC + 180 + vt.ivcABDC}°
        </div>
        <div>
          <span className="mr-1.5 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: 'var(--color-exhaust)' }} />
          Exhaust open {vt.evoBBDC + 180 + vt.evcATDC}°
        </div>
        <div>
          <span className="mr-1.5 inline-block h-2 w-4 rounded-sm align-middle bg-[#e8d06a]" />
          Injection ≈ 15° BTDC–15° ATDC
        </div>
        <div className="pt-1 text-ink/85">Overlap {valveOverlapDeg(vt)}° around TDC</div>
        <p className="pt-1 text-[10.5px] leading-snug text-dim">Angles are typical for a naturally aspirated tractor diesel.</p>
      </div>
    </div>
  )
}

function useCycle() {
  const cycle = useEngine((s) => s.cycle)
  const r = useEngine((s) => s.r)
  const P1 = useEngine((s) => s.P1)
  const T1 = useEngine((s) => s.T1)
  const q = useEngine((s) => s.q)
  const fV = useEngine((s) => s.fV)
  return useMemo(() => ({ c: computeCycle({ cycle, r, P1, T1, q, fV }), p: { cycle, r, P1, T1, q, fV } }), [cycle, r, P1, T1, q, fV])
}

function Charts() {
  const { c, p } = useCycle()
  const [log, setLog] = useState(false)
  const { V1 } = chargeMass(c, p.r)
  const pv = useMemo(() => {
    const loop = cycleLoop(c, 120)
    const scale = (V1 * 1e6) / c.s1.v
    // gas exchange line at P1 (pumping loop is zero in the air-standard model)
    return { xs: loop.map((pt) => pt.v * scale), ys: loop.map((pt) => pt.P / 100) }
  }, [c, V1])
  const ts = useMemo(() => {
    const loop = cycleLoop(c, 120)
    return { xs: loop.map((pt) => pt.s), ys: loop.map((pt) => pt.T) }
  }, [c])
  const scale = (V1 * 1e6) / c.s1.v
  return (
    <Section
      title="P–V and T–s diagrams"
      right={
        <button className="text-[11px] text-info hover:underline" onClick={() => setLog((l) => !l)}>
          {log ? 'linear' : 'log'} axes
        </button>
      }
    >
      <Chart
        data={[pv.xs, pv.ys]}
        series={[{ label: 'P', color: '#9bd17a', width: 2 }]}
        xLabel="Cylinder volume (cm³)"
        yLabel="Pressure (bar)"
        logX={log}
        logY={log}
        marker={() => (live.Vcm3 > 0 ? [live.Vcm3, live.P / 100] : null)}
        height={180}
      />
      <div className="h-2" />
      <Chart
        data={[ts.xs, ts.ys]}
        series={[{ label: 'T', color: '#6fb3e0', width: 2 }]}
        xLabel="Entropy s − s₁ (kJ/kg·K)"
        yLabel="Temperature (K)"
        marker={() => [live.s, live.T]}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        The dot follows the piston. Air-standard model: compression 1→2 and expansion are isentropic; heat is added at constant volume (Otto), constant
        pressure (Diesel) or both (Dual). Cylinder volume runs {fmt(VS * 1e6 / (p.r - 1), 3)}–{fmt(V1 * 1e6, 4)} cm³ (scale {fmt(scale, 3)} cm³ per m³/kg).
      </p>
    </Section>
  )
}

function CycleWorking() {
  const { c, p } = useCycle()
  const rpm = useEngine((s) => s.rpm)
  const g = c.input.gas
  const steps: WorkingStep[] = []
  const Vs = VS * 1e6
  const Vc = Vs / (p.r - 1)
  steps.push({
    label: 'Swept volume (piston displacement)',
    tex: 'V_s = \\tfrac{\\pi}{4}D^2L',
    sub: `= \\tfrac{\\pi}{4}(${DIM.bore * 1000}\\,\\text{mm})^2(${DIM.stroke * 1000}\\,\\text{mm})`,
    result: `= ${n(Vs, 4)}\\ \\text{cm}^3`,
    cite: SRC.tb509('p9'),
  })
  steps.push({
    label: 'Clearance volume for the compression ratio',
    tex: 'r = \\dfrac{V_s+V_c}{V_c}\\;\\Rightarrow\\; V_c = \\dfrac{V_s}{r-1}',
    sub: `= \\dfrac{${n(Vs, 4)}}{${n(p.r, 3)}-1}`,
    result: `= ${n(Vc, 4)}\\ \\text{cm}^3`,
    cite: SRC.tb509('p9'),
  })
  steps.push({
    label: 'End of compression (isentropic 1→2)',
    tex: 'T_2 = T_1 r^{k-1},\\quad P_2 = P_1 r^{k}',
    sub: `T_2 = ${n(p.T1, 4)}\\,(${n(p.r, 3)})^{${k - 1}},\\; P_2 = ${n(p.P1, 4)}\\,(${n(p.r, 3)})^{${k}}`,
    result: `T_2 = ${n(c.s2.T, 4)}\\ \\text{K},\\quad P_2 = ${n(c.s2.P, 4)}\\ \\text{kPa}`,
    cite: SRC.thermo509('p3'),
  })
  if (p.cycle === 'otto') {
    steps.push({
      label: 'Heat added at constant volume (2→3)',
      tex: 'q_{in} = c_v(T_3-T_2)\\;\\Rightarrow\\; T_3 = T_2 + q_{in}/c_v',
      sub: `= ${n(c.s2.T, 4)} + ${n(p.q, 4)}/${g.cv}`,
      result: `T_3 = ${n(c.s3.T, 4)}\\ \\text{K},\\; P_3 = ${n(c.s3.P, 4)}\\ \\text{kPa}`,
      cite: SRC.thermo509('p3'),
    })
    steps.push({
      label: 'Air-standard efficiency',
      tex: '\\eta = 1-\\dfrac{1}{r^{k-1}}',
      sub: `= 1-\\dfrac{1}{(${n(p.r, 3)})^{0.4}}`,
      result: `= ${n(c.etaFormula * 100, 4)}\\,\\%`,
      cite: SRC.thermo509('p3'),
    })
  } else if (p.cycle === 'diesel') {
    steps.push({
      label: 'Heat added at constant pressure (2→3)',
      tex: 'q_{in} = c_p(T_3-T_2),\\quad \\delta = \\dfrac{V_3}{V_2} = \\dfrac{T_3}{T_2}',
      sub: `T_3 = ${n(c.s2.T, 4)} + ${n(p.q, 4)}/${g.cp}`,
      result: `T_3 = ${n(c.s4.T, 4)}\\ \\text{K},\\quad \\delta = ${n(c.input.delta, 4)}`,
      cite: SRC.thermo509('p4'),
    })
    steps.push({
      label: 'Air-standard efficiency',
      tex: '\\eta = 1-\\dfrac{1}{r^{k-1}}\\left[\\dfrac{\\delta^{k}-1}{k(\\delta-1)}\\right]',
      sub: `= 1-\\dfrac{1}{(${n(p.r, 3)})^{0.4}}\\left[\\dfrac{${n(c.input.delta, 4)}^{1.4}-1}{1.4(${n(c.input.delta, 4)}-1)}\\right]`,
      result: `= ${n(c.etaFormula * 100, 4)}\\,\\%\\quad\\text{bracket} = ${n((Math.pow(c.input.delta, k) - 1) / (k * (c.input.delta - 1)), 4)} > 1`,
      cite: SRC.thermo509('p4–5'),
      errata: ERRATA.find((e) => e.id === 'diesel-factor')!.correct,
    })
  } else {
    steps.push({
      label: 'Heat added at constant volume then constant pressure',
      tex: 'T_3 = T_2+\\dfrac{f\\,q}{c_v},\\quad T_4 = T_3+\\dfrac{(1-f)\\,q}{c_p},\\quad \\alpha=\\dfrac{P_3}{P_2},\\;\\delta=\\dfrac{V_4}{V_3}',
      sub: `f = ${n(p.fV, 3)},\\; q = ${n(p.q, 4)}`,
      result: `T_3 = ${n(c.s3.T, 4)},\\; T_4 = ${n(c.s4.T, 4)}\\ \\text{K};\\;\\alpha = ${n(c.input.alpha, 4)},\\;\\delta = ${n(c.input.delta, 4)}`,
      cite: SRC.thermo509('p6'),
    })
    steps.push({
      label: 'Air-standard efficiency',
      tex: '\\eta = 1-\\dfrac{1}{r^{k-1}}\\left[\\dfrac{\\alpha\\delta^{k}-1}{(\\alpha-1)+\\alpha k(\\delta-1)}\\right]',
      sub: `\\alpha = ${n(c.input.alpha, 4)},\\ \\delta = ${n(c.input.delta, 4)},\\ r = ${n(p.r, 3)}`,
      result: `= ${n(c.etaFormula * 100, 4)}\\,\\%`,
      cite: SRC.thermo509('p6'),
    })
  }
  steps.push({
    label: 'Heat rejected, net work and mean effective pressure',
    tex: 'q_{out}=c_v(T_{5}-T_1),\\; w=q_{in}-q_{out},\\; \\text{mep}=\\dfrac{w}{v_1-v_2}',
    sub: `w = ${n(c.qIn, 4)}-${n(c.qOut, 4)},\\; v_1-v_2 = ${n(c.s1.v - c.s2.v, 4)}\\ \\text{m}^3/\\text{kg}`,
    result: `w = ${n(c.wNet, 4)}\\ \\text{kJ/kg},\\quad \\text{mep} = ${n(c.mep, 4)}\\ \\text{kPa}`,
    cite: SRC.misc509('p9, eq 2.4'),
  })
  const ip = (c.mep * 1000 * VS * rpm) / (60 * 2)
  steps.push({
    label: 'Indicated power (one cylinder, four-stroke)',
    tex: 'IP = \\dfrac{p_m L A N k}{60\\,n}',
    sub: `= \\dfrac{${n(c.mep * 1000, 4)}\\times${n(VS, 4)}\\times${rpm}\\times1}{60\\times2}`,
    result: `= ${n(ip / 1000, 4)}\\ \\text{kW}\\quad(\\text{ideal})`,
    cite: SRC.tests502('p3, eq 1'),
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function EnginePanel() {
  const st = useEngine()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Parameters<typeof st.set>[0]) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Cycle model">
        <Segmented<CycleKind>
          value={st.cycle}
          onChange={(cycle) => set({ cycle })}
          options={[
            { value: 'otto', label: 'Otto', title: 'Constant-volume heat addition (SI engines)' },
            { value: 'diesel', label: 'Diesel', title: 'Constant-pressure heat addition (CI engines)' },
            { value: 'dual', label: 'Dual', title: 'Part constant volume, part constant pressure' },
          ]}
        />
        <Slider label="Compression ratio r" value={st.r} min={6} max={24} step={0.1} onChange={(r) => set({ r })} hint="Changes the clearance volume — watch the head gasket thickness" />
        <Slider label="Heat added q" value={st.q} min={200} max={3000} step={10} unit="kJ/kg" onChange={(q) => set({ q })} />
        {st.cycle === 'dual' ? <Slider label="Fraction at constant volume" value={st.fV} min={0} max={1} step={0.01} onChange={(fV) => set({ fV })} /> : null}
        <Slider label="Inlet pressure P₁" value={st.P1} min={70} max={130} step={1} unit="kPa" onChange={(P1) => set({ P1 })} />
        <Slider label="Inlet temperature T₁" value={st.T1} min={270} max={380} step={1} unit="K" onChange={(T1) => set({ T1 })} />
        <Slider label="Engine speed" value={st.rpm} min={400} max={2800} step={10} unit="rpm" onChange={(rpm) => st.set({ rpm })} />
        <Toggle label="Show air, exhaust and fuel flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        {st.cycle === 'otto' ? (
          <p className="text-[11px] leading-snug text-dim">The Otto cycle models spark-ignition engines. The hardware shown stays a diesel; compare the cycles on the diagrams.</p>
        ) : null}
      </Section>
      <Section title="Exam presets">
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
        {preset === 'ex9' ? <p className="mt-1 text-[11px] leading-snug text-warn/90">{ERRATA.find((e) => e.id === 'otto-cv')?.correct}</p> : null}
      </Section>
      <Charts />
      <Section title="Valve timing">
        <TimingWheel />
      </Section>
      <CycleWorking />
    </div>
  )
}
