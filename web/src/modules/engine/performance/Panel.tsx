import { useMemo, type ReactNode } from 'react'
import { SRC } from '@/content/citations'
import { scaleForce } from '@/physics/dynamometer'
import { TB_POWER_CHAIN, tbPowerChain } from '@/physics/engineExtra'
import { Badge, Readout, Section, Segmented, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { PRESETS, compute, shares, usePerf, type AirMode, type ClrMode, type FuelMode, type LossMode, type OutMode, type PerfParams } from './model'

function NumField({ label, value, unit, step = 'any', onChange, hint }: { label: ReactNode; value: number; unit?: string; step?: number | 'any'; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="mb-1.5 flex items-center justify-between gap-2 text-[12.5px]" title={hint}>
      <span className="text-ink/90">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v)) onChange(v)
          }}
          className="w-24 rounded border border-line-2 bg-panel-2 px-1.5 py-0.5 text-right font-mono text-[12px] text-accent"
        />
        <span className="w-12 text-[11px] text-mute">{unit}</span>
      </span>
    </label>
  )
}

const CLR: Record<ClrMode, { label: string; unit: string; title: string }> = {
  cr: { label: 'CR', unit: ': 1', title: 'Compression ratio given' },
  cv: { label: 'CV', unit: 'cm³', title: 'Clearance volume per cylinder' },
  pd: { label: 'PD/x', unit: 'x', title: 'CV = PD / x' },
  tcvf: { label: 'TCV/x', unit: 'x', title: 'CV = TCV / x' },
  tcv: { label: 'TCV', unit: 'L', title: 'Total cylinder volume per cylinder' },
}
const OUT: Record<OutMode, { label: string; unit: string }> = { torque: { label: 'Torque', unit: 'N·m' }, bp: { label: 'BP', unit: 'kW' }, bmep: { label: 'bmep', unit: 'kPa' }, fuel: { label: 'ηbth', unit: '' } }
const LOSS: Record<LossMode, { label: string; unit: string }> = { none: { label: '—', unit: '' }, etaM: { label: 'ηm', unit: '' }, imep: { label: 'imep', unit: 'kPa' }, fp: { label: 'FP', unit: 'kW' } }
const FUEL: Record<FuelMode, { label: string; unit: string }> = { none: { label: '—', unit: '' }, rate: { label: 'Rate', unit: 'kg/h' }, fromAir: { label: 'Air ÷ A/F', unit: '' }, etaBth: { label: 'From ηbth', unit: '' } }
const AIRM: Record<AirMode, { label: string; unit: string }> = { none: { label: '—', unit: '' }, etaV: { label: 'ηv', unit: '' }, rate: { label: 'Rate', unit: 'kg/h' }, fromFuel: { label: 'Fuel × A/F', unit: '' } }

function opts<T extends string>(rec: Record<T, { label: string; title?: string }>) {
  return (Object.keys(rec) as T[]).map((k) => ({ value: k, label: rec[k].label, title: rec[k].title }))
}

function useResult() {
  const p = usePerf()
  return { p, r: useMemo(() => compute(p), [p]) }
}

function Results() {
  const { p, r } = useResult()
  const f = (v: number | undefined, d = 4) => (v === undefined ? '—' : fmt(v, d))
  const ase = 1 - 1 / Math.pow(r.CR, 0.4)
  return (
    <Section title="Results">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="PD / cyl" value={fmt(r.PD * 1e6, 5)} unit="cm³" />
        <Readout label="TCV / cyl" value={fmt(r.TCV * 1e6, 5)} unit="cm³" />
        <Readout label="CR" value={fmt(r.CR, 4)} tone="accent" />
        <Readout label="Total Vd" value={fmt(r.Vd * 1e3, 4)} unit="L" />
        <Readout label="CV / cyl" value={fmt(r.CV * 1e6, 5)} unit="cm³" />
        <Readout label="Piston speed" value={fmt(r.meanPistonSpeed, 3)} unit="m/s" tone={r.meanPistonSpeed > 15 ? 'warn' : 'ink'} />
        <Readout label="Brake power" value={f(r.bp && r.bp / 1000)} unit="kW" tone="accent" />
        <Readout label="Torque" value={f(r.torque)} unit="N·m" />
        <Readout label="bmep" value={f(r.bmep && r.bmep / 1000)} unit="kPa" />
        <Readout label="Indicated P" value={f(r.ip && r.ip / 1000)} unit="kW" />
        <Readout label="Friction P" value={f(r.fp && r.fp / 1000)} unit="kW" />
        <Readout label="ηm / imep" value={r.etaM === undefined ? '—' : `${fmt(r.etaM * 100, 3)}%`} unit={r.imep ? `${fmt(r.imep / 1000, 4)} kPa` : ''} />
        <Readout label="Fuel" value={f(r.fuelRate && r.fuelRate * 3600)} unit="kg/h" />
        <Readout label="Air" value={f(r.airRate && r.airRate * 60)} unit="kg/min" />
        <Readout label="ηv · A/F" value={r.etaV === undefined ? '—' : fmt(r.etaV, 3)} unit={r.airFuel ? `A/F ${fmt(r.airFuel, 3)}` : ''} />
        <Readout label="ηbth" value={r.etaBth === undefined ? '—' : `${fmt(r.etaBth * 100, 4)}%`} tone="info" />
        <Readout label="ηith" value={r.etaIth === undefined ? '—' : `${fmt(r.etaIth * 100, 4)}%`} tone="info" />
        <Readout label="bsfc" value={f(r.bsfc, 3)} unit="kg/kWh" />
        <Readout label="ASE (Otto)" value={`${fmt(ase * 100, 3)}%`} />
        <Readout label="Scale force" value={fmt(scaleForce(r.torque ?? 0, p.arm), 4)} unit={`N @ ${p.arm} m`} tone="warn" />
        <Readout label="ρ air" value={fmt(r.rhoAir, 3)} unit="kg/m³" />
      </div>
      {r.missing.length ? (
        <ul className="mt-1.5 list-disc pl-4 text-[11px] text-warn">
          {r.missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
      {r.meanPistonSpeed > 15 ? <p className="mt-1 text-[11px] text-warn">Mean piston speed above the usual 8–15 m/s range.</p> : null}
    </Section>
  )
}

function Presets() {
  const preset = usePerf((s) => s.preset)
  const set = usePerf((s) => s.set)
  const cur = PRESETS.find((x) => x.id === preset)
  return (
    <Section title="Exam presets">
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((x) => (
          <button
            key={x.id}
            onClick={() => set({ ...x.params, preset: x.id })}
            className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${preset === x.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {cur ? (
        <div className="mt-1.5 space-y-1 text-[11.5px] leading-snug">
          <p className="text-mute">{cur.note}</p>
          <p className="text-ink/90">
            <span className="text-dim">Notes’ answer: </span>
            {cur.expect}
          </p>
          {cur.errata ? (
            <p className="text-warn/90">
              <Badge tone="warn">note discrepancy</Badge> {cur.errata}
            </p>
          ) : null}
        </div>
      ) : null}
    </Section>
  )
}

function Inputs() {
  const p = usePerf()
  const s = (patch: Partial<PerfParams>) => p.set(patch)
  return (
    <>
      <Section title="Engine geometry">
        <NumField label="Bore D" value={p.bore} unit="mm" onChange={(bore) => s({ bore, area: 0 })} />
        <NumField label="Stroke L" value={p.stroke} unit="mm" onChange={(stroke) => s({ stroke })} />
        <NumField label="Piston area (0 = from D)" value={p.area} unit="m²" onChange={(area) => s({ area })} hint="Use when the piston area is given instead of the bore" />
        <NumField label="Cylinders" value={p.cylinders} step={1} onChange={(c) => s({ cylinders: Math.max(1, Math.min(16, Math.round(c))) })} />
        <Segmented<string> size="sm" value={String(p.cycle)} onChange={(v) => s({ cycle: Number(v) as 2 | 4 })} options={[{ value: '4', label: 'Four-stroke (n = 2)' }, { value: '2', label: 'Two-stroke (n = 1)' }]} />
        <Segmented<ClrMode> size="sm" label="Clearance given as" value={p.clr} onChange={(clr) => s({ clr })} options={opts(CLR)} />
        <NumField label={CLR[p.clr].title} value={p.clrVal} unit={CLR[p.clr].unit} onChange={(clrVal) => s({ clrVal })} />
      </Section>
      <Section title="Operation & output">
        <NumField label="Speed N" value={p.rpm} unit="rpm" onChange={(rpm) => s({ rpm })} />
        <Segmented<OutMode> size="sm" label="Brake output from" value={p.out} onChange={(out) => s({ out })} options={opts(OUT)} />
        <NumField label={OUT[p.out].label} value={p.outVal} unit={OUT[p.out].unit} onChange={(outVal) => s({ outVal })} />
        <Segmented<LossMode> size="sm" label="Friction from" value={p.loss} onChange={(loss) => s({ loss })} options={opts(LOSS)} />
        {p.loss !== 'none' ? <NumField label={LOSS[p.loss].label} value={p.lossVal} unit={LOSS[p.loss].unit} onChange={(lossVal) => s({ lossVal })} /> : null}
        <NumField label="Dynamometer arm R" value={p.arm} unit="m" onChange={(arm) => s({ arm: Math.max(0.2, Math.min(1, arm)) })} />
      </Section>
      <Section title="Fuel & air">
        <Segmented<FuelMode> size="sm" label="Fuel flow" value={p.fuel} onChange={(fuel) => s({ fuel })} options={opts(FUEL)} />
        {p.fuel === 'rate' || p.fuel === 'etaBth' ? <NumField label={p.fuel === 'rate' ? 'Fuel rate' : 'ηbth'} value={p.fuelVal} unit={FUEL[p.fuel].unit} onChange={(fuelVal) => s({ fuelVal })} /> : null}
        <NumField label="Heating value" value={p.hv} unit="MJ/kg" onChange={(hv) => s({ hv })} hint="HSD 10 550 kcal/kg ≈ 44.2 MJ/kg; petrol 11 100 kcal/kg ≈ 46.5 MJ/kg" />
        <Segmented<AirMode> size="sm" label="Air flow" value={p.air} onChange={(air) => s({ air })} options={opts(AIRM)} />
        {p.air === 'etaV' || p.air === 'rate' ? <NumField label={p.air === 'etaV' ? 'ηv' : 'Air rate'} value={p.airVal} unit={AIRM[p.air].unit} onChange={(airVal) => s({ airVal })} /> : null}
        <NumField label="A/F ratio" value={p.af} hint="SI 12–18, CI 18–70; stoichiometric ≈ 15" onChange={(af) => s({ af })} />
        <NumField label="Ambient p" value={p.pAmb} unit="kPa" onChange={(pAmb) => s({ pAmb })} />
        <NumField label="Ambient T" value={p.TAmb} unit="K" onChange={(TAmb) => s({ TAmb })} />
      </Section>
    </>
  )
}

function HeatBalance() {
  const { p, r } = useResult()
  const sh = shares(p, r)
  const rows: [string, number, string][] = [
    ['Brake power', sh.brake, '#7fc06a'],
    ['Cooling', sh.cooling, '#4fa3d8'],
    ['Exhaust', sh.exhaust, '#e8794f'],
    ['Friction', sh.friction, '#a3a3a3'],
  ]
  const chain = tbPowerChain()
  return (
    <Section title="Heat balance" right={<span className="text-[10.5px] text-dim">{sh.source}</span>}>
      <Segmented<'supp' | 'tb'> size="sm" label="Split of (fuel − IP) between exhaust and cooling" value={p.shares} onChange={(v) => p.set({ shares: v })} options={[{ value: 'supp', label: '40 : 30' }, { value: 'tb', label: '31 : 40' }]} />
      <div className="space-y-1">
        {rows.map(([k, f, c]) => (
          <div key={k} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-20 text-mute">{k}</span>
            <div className="h-3 flex-1 rounded-sm bg-panel-2">
              <div className="h-3 rounded-sm" style={{ width: `${Math.max(0, Math.min(1, f)) * 100}%`, background: c }} />
            </div>
            <span className="w-14 text-right font-mono text-ink/90">{(f * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-dim">
        {sh.source === 'calculated'
          ? 'From the calculation: brake = BP, friction = IP − BP, and the rest of the fuel energy (ṁf·HV − IP) split between exhaust and cooling in the chosen ratio.'
          : 'Needs fuel rate and IP to calculate — showing a typical split. Ribbon widths in 3D follow these numbers.'}
      </p>
      <table className="mt-2 w-full text-[11px] text-ink/85">
        <tbody>
          <tr className="text-mute">
            <td colSpan={2}>Typical tractor losses (per cent of fuel energy)</td>
          </tr>
          <tr>
            <td>Exhaust & other heat</td>
            <td className="text-right font-mono">{TB_POWER_CHAIN.exhaust}</td>
          </tr>
          <tr>
            <td>Cooling water</td>
            <td className="text-right font-mono">{TB_POWER_CHAIN.cooling}</td>
          </tr>
          <tr>
            <td>Engine friction</td>
            <td className="text-right font-mono">{TB_POWER_CHAIN.friction}</td>
          </tr>
          <tr className="border-t border-line">
            <td>Available at the PTO</td>
            <td className="text-right font-mono text-accent">{chain.pto}</td>
          </tr>
          <tr>
            <td>Transmission & traction</td>
            <td className="text-right font-mono">{TB_POWER_CHAIN.transmission}</td>
          </tr>
          <tr>
            <td>Available at the drawbar</td>
            <td className="text-right font-mono text-accent">{chain.drawbar}</td>
          </tr>
        </tbody>
      </table>
    </Section>
  )
}

function PerfWorking() {
  const { p, r } = useResult()
  const nn = p.cycle === 4 ? 2 : 1
  const steps: WorkingStep[] = []
  const A = r.area
  steps.push({
    label: 'Piston displacement (swept volume) per cylinder',
    tex: p.area > 0 ? 'PD = A\\,L' : 'PD = \\tfrac{\\pi}{4}D^2L',
    sub: p.area > 0 ? `= ${n(A, 4)}\\times${n(p.stroke / 1000, 4)}` : `= \\tfrac{\\pi}{4}(${n(p.bore, 4)})^2(${n(p.stroke, 4)})\\ \\text{mm}^3`,
    result: `= ${n(r.PD * 1e9, 6)}\\ \\text{mm}^3 = ${n(r.PD * 1e6, 5)}\\ \\text{cm}^3`,
    cite: SRC.tb509('p9'),
  })
  const cvSub: Record<ClrMode, string> = {
    cr: `CV = \\dfrac{PD}{CR-1} = \\dfrac{${n(r.PD * 1e6, 5)}}{${n(p.clrVal, 4)}-1}`,
    cv: `CV = ${n(p.clrVal, 4)}\\ \\text{cm}^3`,
    pd: `CV = PD/${n(p.clrVal, 3)}`,
    tcvf: `CV = \\tfrac{1}{${n(p.clrVal, 3)}}(PD + CV) \\Rightarrow CV = \\dfrac{PD}{${n(p.clrVal, 3)}-1}`,
    tcv: `CV = TCV - PD = ${n(p.clrVal * 1000, 5)} - ${n(r.PD * 1e6, 5)}\\ \\text{cm}^3`,
  }
  steps.push({
    label: 'Clearance volume, total cylinder volume, compression ratio',
    tex: 'TCV = PD + CV,\\qquad CR = \\dfrac{TCV}{CV}',
    sub: cvSub[p.clr],
    result: `CV = ${n(r.CV * 1e6, 5)}\\ \\text{cm}^3,\\; TCV = ${n(r.TCV * 1e6, 5)}\\ \\text{cm}^3,\\; CR = ${n(r.CR, 4)}`,
    cite: SRC.tb509('p9'),
  })
  steps.push({ label: 'Total swept volume and mean piston speed', tex: 'V_d = k\\,PD,\\qquad S_p = \\dfrac{2LN}{60}', sub: `k = ${p.cylinders},\\; L = ${n(p.stroke / 1000, 4)}\\ \\text{m},\\; N = ${p.rpm}`, result: `V_d = ${n(r.Vd * 1e3, 4)}\\ \\text{L},\\; S_p = ${n(r.meanPistonSpeed, 3)}\\ \\text{m/s}\\;(8\\text{–}15)`, cite: SRC.misc509('p2, p6') })
  if (r.airRate !== undefined) {
    steps.push({
      label: p.air === 'etaV' ? 'Air drawn in (volumetric efficiency)' : p.air === 'fromFuel' ? 'Air from the fuel and A/F' : 'Air measured',
      tex: p.air === 'etaV' ? '\\rho_a = \\dfrac{p}{RT},\\quad \\dot m_a = \\eta_v\\,\\rho_a\\,\\dfrac{V_d N}{n}' : '\\dot m_a = (A/F)\\,\\dot m_f',
      sub: p.air === 'etaV' ? `\\rho_a = \\dfrac{${n(p.pAmb * 1000, 4)}}{287\\times${n(p.TAmb, 3)}} = ${n(r.rhoAir, 3)},\\; \\dfrac{V_dN}{n} = ${n(r.sweptRate * 60, 4)}\\ \\text{m}^3/\\text{min}` : `A/F = ${n(p.af, 3)}`,
      result: `\\dot m_a = ${n(r.airRate * 60, 4)}\\ \\text{kg/min}`,
      cite: SRC.misc509('p5, Ex 4'),
    })
  }
  if (r.fuelRate !== undefined) {
    steps.push({
      label: 'Fuel flow',
      tex: p.fuel === 'fromAir' ? '\\dot m_f = \\dot m_a/(A/F)' : p.fuel === 'etaBth' ? '\\dot m_f = \\dfrac{BP}{\\eta_{bth}\\,HV}' : '\\dot m_f\\ \\text{measured}',
      sub: p.fuel === 'fromAir' ? `= ${n((r.airRate ?? 0) * 60, 4)}/${n(p.af, 3)}` : p.fuel === 'etaBth' ? `= \\dfrac{${n((r.bp ?? 0) / 1000, 4)}}{${n(p.fuelVal, 3)}\\times${n(p.hv * 1000, 5)}}` : `= ${n(p.fuelVal, 4)}\\ \\text{kg/h}`,
      result: `\\dot m_f = ${n(r.fuelRate * 60, 4)}\\ \\text{kg/min} = ${n(r.fuelRate * 3600, 4)}\\ \\text{kg/h}`,
      cite: SRC.misc509('p5, Ex 1, Ex 4'),
    })
  }
  if (r.bp !== undefined) {
    const sub =
      p.out === 'torque'
        ? `= \\dfrac{2\\pi\\times${p.rpm}\\times${n(p.outVal, 4)}}{60}`
        : p.out === 'bp'
          ? `\\text{given}`
          : p.out === 'bmep'
            ? `= \\dfrac{${n(p.outVal * 1000, 4)}\\times${n(p.stroke / 1000, 4)}\\times${n(A, 4)}\\times${p.rpm}\\times${p.cylinders}}{60\\times${nn}}`
            : `= ${n(p.outVal, 3)}\\times${n((r.fuelRate ?? 0) * 60, 4)}\\times${n(p.hv * 1000, 5)}/60`
    steps.push({
      label: 'Brake power',
      tex: p.out === 'torque' ? 'BP = \\dfrac{2\\pi NT}{60}' : p.out === 'bmep' ? 'BP = \\dfrac{p_{mb}\\,L\\,A\\,N\\,k}{60\\,n}' : p.out === 'fuel' ? 'BP = \\eta_{bth}\\,\\dot m_f\\,HV' : 'BP',
      sub,
      result: `BP = ${n(r.bp / 1000, 5)}\\ \\text{kW},\\; T = ${n(r.torque ?? 0, 4)}\\ \\text{N·m}`,
      cite: p.out === 'torque' ? SRC.misc509('p2, Ex 7') : p.out === 'fuel' ? SRC.misc509('p5, Ex 3–4') : SRC.misc509('p6, Ex 6'),
    })
    steps.push({
      label: 'Brake mean effective pressure',
      tex: 'bmep = \\dfrac{BP\\times60\\times n}{L\\,A\\,N\\,k}',
      sub: `= \\dfrac{${n(r.bp, 5)}\\times60\\times${nn}}{${n(p.stroke / 1000, 4)}\\times${n(A, 4)}\\times${p.rpm}\\times${p.cylinders}}`,
      result: `= ${n((r.bmep ?? 0) / 1000, 5)}\\ \\text{kPa}`,
      cite: SRC.misc509('p3, Ex 2, Ex 7'),
    })
  }
  if (r.ip !== undefined && r.bp !== undefined) {
    steps.push({
      label: 'Indicated power, friction power and mechanical efficiency',
      tex: p.loss === 'imep' ? 'IP = \\dfrac{p_{mi}\\,L\\,A\\,N\\,k}{60\\,n},\\; FP = IP - BP,\\; \\eta_m = \\dfrac{BP}{IP}' : p.loss === 'etaM' ? 'IP = \\dfrac{BP}{\\eta_m},\\; FP = IP - BP,\\; imep = \\dfrac{bmep}{\\eta_m}' : 'IP = BP + FP',
      sub: p.loss === 'imep' ? `p_{mi} = ${n(p.lossVal, 5)}\\ \\text{kPa}` : p.loss === 'etaM' ? `\\eta_m = ${n(p.lossVal, 3)}` : `FP = ${n(p.lossVal, 4)}\\ \\text{kW}`,
      result: `IP = ${n(r.ip / 1000, 5)}\\ \\text{kW},\\; FP = ${n((r.fp ?? 0) / 1000, 4)}\\ \\text{kW},\\; \\eta_m = ${n((r.etaM ?? 0) * 100, 3)}\\,\\%,\\; imep = ${n((r.imep ?? 0) / 1000, 5)}\\ \\text{kPa}`,
      cite: SRC.misc509('p2–3, Ex 2'),
    })
  }
  if (r.etaBth !== undefined) {
    steps.push({
      label: 'Thermal efficiencies and specific fuel consumption',
      tex: '\\eta_{bth} = \\dfrac{BP}{\\dot m_f HV},\\; \\eta_{ith} = \\dfrac{IP}{\\dot m_f HV},\\; sfc = \\dfrac{\\dot m_f}{BP}',
      sub: `\\dot m_f HV = ${n((r.fuelPower ?? 0) / 1000, 5)}\\ \\text{kW}`,
      result: `\\eta_{bth} = ${n(r.etaBth * 100, 4)}\\,\\%${r.etaIth !== undefined ? `,\\; \\eta_{ith} = ${n(r.etaIth * 100, 4)}\\,\\%` : ''},\\; sfc = ${n(r.bsfc ?? 0, 3)}\\ \\text{kg/kWh}`,
      cite: SRC.misc509('p3–5, Ex 1, Ex 5, Ex 7'),
    })
  }
  if (r.etaV !== undefined && p.air !== 'etaV') {
    steps.push({ label: 'Volumetric efficiency', tex: '\\eta_v = \\dfrac{\\dot m_a}{\\rho_a V_d N/(60n)}', sub: `= \\dfrac{${n((r.airRate ?? 0) * 60, 4)}}{${n(r.rhoAir, 3)}\\times${n(r.sweptRate * 60, 4)}}`, result: `= ${n(r.etaV, 3)}`, cite: SRC.misc509('p4') })
  }
  const ase = 1 - 1 / Math.pow(r.CR, 0.4)
  steps.push({
    label: 'Air-standard efficiency (Otto) for reference',
    tex: '\\eta_{ASE} = 1 - \\dfrac{1}{r^{k-1}}',
    sub: `= 1 - \\dfrac{1}{${n(r.CR, 4)}^{0.4}}`,
    result: `= ${n(ase * 100, 4)}\\,\\%${r.etaIth !== undefined ? `;\\; \\text{relative efficiency } \\eta_{ith}/\\eta_{ASE} = ${n((r.etaIth / ase) * 100, 3)}\\,\\%` : ''}`,
    cite: SRC.thermo509('p3'),
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function PerformancePanel() {
  return (
    <div>
      <Results />
      <Presets />
      <Inputs />
      <HeatBalance />
      <PerfWorking />
    </div>
  )
}
