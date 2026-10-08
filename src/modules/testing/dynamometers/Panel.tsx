import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { ENGINE_HIGH_IDLE, ENGINE_MIN_RPM, PTO_DRIVE_EFFICIENCY, engineTorque, maxEnginePower } from '@/physics/dynamometer'
import { DYNO_ESSENTIALS, DYNO_FACTS, OECD_COMPULSORY, OECD_OPTIONAL, TEST_HISTORY, airDensityRatio, capacityRatio, torquePower } from '@/physics/testing'
import { flyTo } from '@/ui/camera'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, KIND_LABEL, PTO_ENGINE_RPM, PTO_RATIO, SPEC, correction, live, loadAtEngine, loadForSpeed, solve, useDyno, type DynoKind } from './model'

export const POSE_BED = { position: [1.35, 1.25, 2.05] as [number, number, number], target: [-0.2, 0.55, 0] as [number, number, number] }
export const POSE_PTO = { position: [1.9, 2.3, 3.9] as [number, number, number], target: [-1.0, 0.75, 0] as [number, number, number] }

function pick(kind: DynoKind) {
  const s = useDyno.getState()
  if (kind !== s.kind) flyTo(kind === 'pto' ? POSE_PTO : POSE_BED)
  s.set({ kind })
}

const PRESETS: Preset[] = [
  {
    id: 'rated',
    label: 'Rated: 2250 rpm, 142 N·m',
    note: 'Farmland engine at the top of its full-load curve: P = 2π(2250)(142)/60 000 = 33.5 kW — the maximum (quoted as 33.6 kW).',
    apply: () => {
      const k = useDyno.getState().kind
      useDyno.getState().set({ load: loadForSpeed(k, 2244) })
    },
  },
  {
    id: 'lug',
    label: 'Lugging near max torque',
    note: 'Load pulled the engine down to ≈ 1350 rpm, close to the 173 N·m peak at 1300 rpm. Below the peak the engine torque falls with speed: with a Prony brake (flat torque) the engine would then stall — the brake’s “difficult speed control”.',
    apply: () => {
      const k = useDyno.getState().kind
      useDyno.getState().set({ load: loadForSpeed(k, 1350) })
    },
  },
  {
    id: 'idle',
    label: 'No load: high idle',
    note: 'Load released: the governor holds the engine at high idle, 2390 rpm, T = 0. With a Prony brake, losing the load suddenly lets the engine “run away” up to this speed.',
    apply: () => useDyno.getState().set({ load: 0 }),
  },
  {
    id: 'pto',
    label: 'PTO test at 540 rpm',
    note: `Shop dynamometer on the PTO. 540 rpm PTO at ${PTO_ENGINE_RPM} engine rpm (typical ratio ${PTO_RATIO.toFixed(2)} : 1); PTO power ≈ 0.85 × flywheel power.`,
    apply: () => {
      pick('pto')
      useDyno.getState().set({ load: loadForSpeed('pto', PTO_ENGINE_RPM) })
    },
  },
  {
    id: 'hot',
    label: 'Hot, high site: correct it',
    note: '94 kPa and 35 °C: thinner air means less power is observed. fa = (99/94)(308/298)^0.7 ≈ 1.077 restores it to the 99 kPa, 25 °C standard.',
    apply: () => useDyno.getState().set({ BPo: 94, ToC: 35, nExp: 0.7, std: 'notes' }),
  },
  {
    id: 'guide',
    label: 'Sea-level standard',
    note: 'Corrected power defined at sea-level pressure 1.013×10⁵ Pa, 15.5 °C and zero vapour pressure.',
    apply: () => useDyno.getState().set({ std: 'guide' }),
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 12, (a, b) => a.n === b.n && a.F === b.F)
  const p = useDyno()
  const sol = useMemo(() => solve(p), [p])
  const corr = correction(p, v.P)
  const tone = sol.stalled ? 'warn' : sol.stable ? 'accent' : 'warn'
  return (
    <Section title="Live" right={<Badge tone={sol.stalled ? 'danger' : sol.stable ? 'accent' : 'warn'}>{sol.stalled ? 'stalled' : sol.stable ? 'stable point' : 'unstable'}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Engine speed" value={fmt(v.n, 4)} unit="rpm" tone={tone} />
        <Readout label="Engine torque" value={fmt(v.T, 3)} unit="N·m" />
        <Readout label="Brake power" value={fmt(v.P, 3)} unit="kW" tone="accent" />
        <Readout label={p.kind === 'pto' ? 'PTO speed' : 'Dyno speed'} value={fmt(v.nDyno, 4)} unit="rpm" />
        <Readout label="Scale force F" value={fmt(v.F, 4)} unit="N" tone="info" />
        <Readout label="Corrected Pbs" value={fmt(p.kind === 'pto' ? corr.Pbs * PTO_DRIVE_EFFICIENCY : corr.Pbs, 3)} unit="kW" />
      </div>
      {p.kind === 'hydraulic' || p.kind === 'pto' ? (
        <p className="mt-1.5 text-[11px] text-dim">
          Water {fmt(p.waterIn, 3)} → {fmt(v.waterOut, 3)} °C at {fmt(p.waterFlow, 2)} kg/s (energy balance ΔT = P/ṁc_p).
        </p>
      ) : null}
      {p.kind === 'pto' ? <p className="mt-1 text-[11px] text-dim">PTO power {fmt(v.P * PTO_DRIVE_EFFICIENCY, 3)} kW ≈ 0.85 × flywheel power.</p> : null}
    </Section>
  )
}

function Facts({ kind }: { kind: DynoKind }) {
  const f = DYNO_FACTS[kind]
  return (
    <div className="mt-1 space-y-1 rounded-md border border-line bg-panel-2/60 px-2.5 py-2 text-[11.5px] leading-snug">
      <div className="text-ink/90">
        {f.name}
      </div>
      <div>
        <span className="text-dim">Control: </span>
        {f.control}
      </div>
      <div>
        <span className="text-dim">Measure: </span>
        {f.measure}
      </div>
      <div>
        <span className="text-dim">Dissipate: </span>
        {f.dissipate}
      </div>
      <div>
        <span className="text-dim">Accuracy: </span>
        {f.accuracy}
      </div>
      <div className="text-mute">{f.note}</div>
    </div>
  )
}

function Curves() {
  const kind = useDyno((s) => s.kind)
  const load = useDyno((s) => s.load)
  const data = useMemo(() => {
    const xs: number[] = []
    const te: number[] = []
    const tl: number[] = []
    const pe: number[] = []
    const pl: number[] = []
    for (let r = ENGINE_MIN_RPM; r <= ENGINE_HIGH_IDLE; r += 10) {
      xs.push(r)
      const T = engineTorque(r)
      const L = Math.min(260, loadAtEngine(kind, load, r))
      te.push(T)
      tl.push(L)
      pe.push(torquePower(T, r))
      pl.push(Math.min(45, torquePower(L, r)))
    }
    return { xs, te, tl, pe, pl }
  }, [kind, load])
  const mx = maxEnginePower()
  return (
    <Section title="Engine and absorber curves">
      <Chart
        data={[data.xs, data.te, data.tl]}
        series={[
          { label: 'Engine (full throttle)', color: '#9bd17a', width: 2 },
          { label: 'Absorber at this load', color: '#f08a3c', width: 1.5, dash: [5, 4] },
        ]}
        xLabel="Engine speed (rpm)"
        yLabel="Torque (N·m)"
        yRange={[0, 260]}
        marker={() => (live.n > 0 ? [live.n, live.T] : null)}
        height={170}
      />
      <div className="h-2" />
      <Chart
        data={[data.xs, data.pe, data.pl]}
        series={[
          { label: 'Engine power', color: '#6fb3e0', width: 2 },
          { label: 'Absorbed power', color: '#f08a3c', width: 1.5, dash: [5, 4] },
        ]}
        xLabel="Engine speed (rpm)"
        yLabel="Power (kW)"
        yRange={[0, 45]}
        marker={() => (live.n > 0 ? [live.n, live.P] : null)}
        height={150}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        The running point is where the absorber curve (dashed) crosses the engine curve. It is stable when the absorber torque rises faster with speed than the engine’s:
        the hydraulic (T ∝ n²) and DC (T ∝ n) machines hold speed well; the Prony brake’s flat torque does not. Maximum power {fmt(mx.P, 3)} kW at {fmt(mx.n, 4)} rpm. Eddy-current and DC curve shapes show standard behaviour.
      </p>
    </Section>
  )
}

function Correction() {
  const p = useDyno()
  const P = useLive(() => live.P, 8)
  const c = correction(p, P)
  return (
    <Section title="Atmospheric correction">
      <Segmented
        value={p.std}
        onChange={(std) => p.set({ std })}
        options={[
          { value: 'notes', label: '99 kPa, 25 °C', title: 'Standard air, 99 kPa and 25 °C' },
          { value: 'guide', label: '101.3 kPa, 15.5 °C', title: 'Sea-level standard air, zero vapour pressure' },
        ]}
        size="sm"
      />
      <Slider label="Observed pressure BPo" value={p.BPo} min={80} max={105} step={0.5} unit="kPa" onChange={(BPo) => p.set({ BPo })} />
      <Slider label="Observed air temperature" value={p.ToC} min={0} max={45} step={0.5} unit="°C" onChange={(ToC) => p.set({ ToC })} />
      <Slider label="Exponent n" value={p.nExp} min={0.3} max={1.5} step={0.05} onChange={(nExp) => p.set({ nExp })} hint="0.7 (ISO 1585, NA diesel), 0.5 (SAE J1349, SI)" />
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="ρs/ρo" value={fmt(airDensityRatio(p.BPo, p.ToC + 273.15, c.std.BP, c.std.T), 4)} />
        <Readout label="fa" value={fmt(c.fa, 4)} tone="accent" />
        <Readout label="Pbs = fa·Pbo" value={fmt(c.Pbs, 3)} unit="kW" />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Air density limits how much fuel can be burnt, so power is corrected to standard air. Strictly the correction applies to indicated power (Pbs + Pf = fa(Pbo + Pf)); friction power is unaffected, giving Pbs = fa·Pbo + Pf(fa − 1), and the small last
        term is usually dropped.
      </p>
    </Section>
  )
}

function Capacity() {
  const [nr, setNr] = useState(1.5)
  const [dr, setDr] = useState(1.2)
  return (
    <Section title="Hydraulic capacity ∝ N³D⁵">
      <Slider label="Speed ratio N/N₀" value={nr} min={0.5} max={2} step={0.05} onChange={setNr} />
      <Slider label="Rotor diameter ratio D/D₀" value={dr} min={0.5} max={1.6} step={0.02} onChange={setDr} />
      <Readout label="Absorbing capacity ×" value={fmt(capacityRatio(nr, 1, dr, 1), 3)} tone="accent" />
      <p className="mt-1 text-[11px] text-dim">An air (fan) brake absorbs ∝ rpm³ too, but with errors up to 20 %.</p>
    </Section>
  )
}

function Standards() {
  return (
    <Section title="Accuracy, essentials and test codes">
      <Table
        head={['Dynamometer', 'Accuracy']}
        rows={[
          ['Prony brake', 'below hydraulic'],
          ['Hydraulic', '≈ 0.5 % error'],
          ['DC cradle', 'within 0.25 %'],
          ['Air (fan) brake', 'up to 20 % error'],
          ['Shop-type (PTO)', 'below laboratory units'],
          ['Eddy-current', 'not stated'],
        ]}
      />
      <p className="mt-2 text-[11.5px] text-ink/85">Every engine dynamometer needs:</p>
      <ol className="ml-4 list-decimal text-[11.5px] text-mute">
        {DYNO_ESSENTIALS.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ol>
      <p className="mt-2 text-[11.5px] text-ink/85">OECD compulsory tests</p>
      <ol className="ml-4 list-decimal text-[11.5px] text-mute">
        {OECD_COMPULSORY.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ol>
      <p className="mt-1.5 text-[11.5px] text-ink/85">At the manufacturer’s option</p>
      <ol className="ml-4 list-decimal text-[11.5px] text-mute">
        {OECD_OPTIONAL.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ol>
      <p className="mt-1.5 text-[11.5px] text-ink/85">Nebraska and test-code milestones</p>
      <ul className="text-[11.5px] text-mute">
        {TEST_HISTORY.map(([y, t]) => (
          <li key={y}>
            <span className="font-mono text-dim">{y}</span> — {t}
          </li>
        ))}
      </ul>
    </Section>
  )
}

function DynoWorking() {
  const p = useDyno()
  const sol = useMemo(() => solve(p), [p])
  const corr = correction(p, sol.P)
  const steps: WorkingStep[] = []
  const nd = sol.nDyno
  steps.push({
    label: 'Torque from the arm',
    tex: 'T = F\\,l',
    sub: `= ${n(sol.F, 4)}\\,\\text{N}\\times${n(p.arm, 3)}\\,\\text{m}`,
    result: `= ${n(sol.Tdyno, 4)}\\ \\text{N·m}`,
    cite: C.prony,
  })
  steps.push({
    label: 'Brake power from the scale',
    tex: 'P = \\dfrac{2\\pi\\,l\\,F\\,n}{60\\,000}',
    sub: `= \\dfrac{2\\pi(${n(p.arm, 3)})(${n(sol.F, 4)})(${n(nd, 4)})}{60\\,000}`,
    result: `= ${n(sol.Pdyno, 4)}\\ \\text{kW}`,
    cite: p.kind === 'dc' ? C.dc : C.prony,
  })
  steps.push({
    label: 'Same power from torque',
    tex: 'P = \\dfrac{2\\pi\\,n\\,T}{60\\,000}',
    sub: `= \\dfrac{2\\pi(${n(nd, 4)})(${n(sol.Tdyno, 4)})}{60\\,000}`,
    result: `= ${n(torquePower(sol.Tdyno, nd), 4)}\\ \\text{kW}`,
    cite: C.prony,
  })
  if (p.kind === 'pto')
    steps.push({
      label: 'PTO power and flywheel power',
      tex: 'P_{PTO} \\approx 0.85\\,P_{flywheel},\\quad n_{PTO} = n_e / i',
      sub: `i = ${n(PTO_RATIO, 3)},\\; P_{flywheel} = 2\\pi(${n(sol.n, 4)})(${n(sol.T, 4)})/60\\,000`,
      result: `P_{flywheel} = ${n(sol.P, 4)}\\ \\text{kW},\\quad P_{PTO} = ${n(sol.Pdyno, 4)}\\ \\text{kW}`,
      cite: SRC.l27('eq 29'),
    })
  steps.push({
    label: 'Air density ratio (ideal gas)',
    tex: '\\dfrac{\\rho_s}{\\rho_o} = \\dfrac{BP_s}{BP_o}\\,\\dfrac{T_o}{T_s}',
    sub: `= \\dfrac{${n(corr.std.BP, 4)}}{${n(p.BPo, 4)}}\\cdot\\dfrac{${n(p.ToC + 273.15, 5)}}{${n(corr.std.T, 5)}}`,
    result: `= ${n(airDensityRatio(p.BPo, p.ToC + 273.15, corr.std.BP, corr.std.T), 4)}`,
    cite: C.correction,
  })
  steps.push({
    label: 'Correction factor and corrected power',
    tex: 'f_a = \\dfrac{BP_s}{BP_o}\\left(\\dfrac{T_o}{T_s}\\right)^{n},\\quad P_{bs} = f_a P_{bo}',
    sub: `n = ${n(p.nExp, 3)},\\; P_{bo} = ${n(sol.P, 4)}\\ \\text{kW}`,
    result: `f_a = ${n(corr.fa, 4)},\\quad P_{bs} = ${n(corr.Pbs, 4)}\\ \\text{kW}`,
    cite: C.correction,
  })
  if (p.kind === 'hydraulic' || p.kind === 'pto')
    steps.push({
      label: 'Water temperature rise',
      tex: '\\Delta T = \\dfrac{P}{\\dot m\\,c_p}',
      sub: `= \\dfrac{${n(sol.Pdyno, 4)}}{${n(p.waterFlow, 3)}\\times4.18}`,
      result: `= ${n(sol.Pdyno / (4.18 * p.waterFlow), 3)}\\ \\text{K}`,
      beyond: true,
    })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function Panel() {
  const p = useDyno()
  const [preset, setPreset] = useState<string | null>(null)
  const spec = SPEC[p.kind]
  return (
    <div>
      <LivePanel />
      <Section title="Dynamometer">
        <Segmented<DynoKind>
          value={p.kind}
          onChange={(k) => {
            setPreset(null)
            pick(k)
          }}
          options={(['prony', 'hydraulic', 'eddy', 'dc', 'pto'] as DynoKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          size="sm"
        />
        <Slider
          label={p.kind === 'prony' ? 'Handwheel (block clamp)' : p.kind === 'eddy' || p.kind === 'dc' ? 'Field excitation' : 'Water (needle valves)'}
          value={p.load}
          min={0}
          max={1}
          step={0.005}
          onChange={(load) => {
            setPreset(null)
            p.set({ load })
          }}
        />
        <Slider label="Torque arm l" value={p.arm} min={p.kind === 'dc' ? 0.38 : 0.32} max={1.4} step={0.01} unit="m" onChange={(arm) => p.set({ arm })} hint="Longer arm → smaller scale force for the same torque" />
        {p.kind === 'hydraulic' || p.kind === 'pto' ? (
          <Slider label="Water flow" value={p.waterFlow} min={0.1} max={1.5} step={0.05} unit="kg/s" onChange={(waterFlow) => p.set({ waterFlow })} />
        ) : null}
        <p className="text-[11px] text-dim">
          Absorber size: {fmt(spec.Tmax, 3)} N·m at {spec.nRef} rpm full load (typical, chosen to stall the test engine).
        </p>
        <Facts kind={p.kind} />
      </Section>
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Curves />
      <Correction />
      <Capacity />
      <DynoWorking />
      <Standards />
    </div>
  )
}
