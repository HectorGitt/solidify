import { useMemo, useState } from 'react'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { ModeTabs, Note, PresetGrid, Table, type Preset } from '../../elements/_shared/PanelBits'
import { P504 } from './cites'
import { DEFAULTS, MASS_BALANCE_1000KG, calculateMillPerformance, live, pombClosure, usePalmOil, type PalmOilParams, type StationId } from './model'

const set = (p: Partial<PalmOilParams>) => usePalmOil.getState().set(p)
const base = (p: Partial<PalmOilParams>) => set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  {
    id: 'pomb',
    label: 'Modern mill · 1000 kg FFB',
    note: 'Mass-balance chart per 1000 kg FFB: empty bunches 234, fruit 666, fibre 180, shell 73, kernels 67, sludge 180, crude palm oil 225 kg → OER 22.5 %, KER 6.7 %.',
    flag: 'The printed balance does not close: 1000 − 234 − 666 = 100 kg is lost in sterilising/threshing (condensate), and the fruit outputs total 725 kg > 666 kg, so about 59 kg of dilution water must be added before clarification.',
    apply: () => base({}),
  },
  {
    id: 'mill-30t',
    label: '30 t/h mill',
    note: 'The same balance scaled to a 30 t FFB/h mill: about 6.75 t/h of crude palm oil and 2 t/h of kernels; fibre and shell fire the co-generation boiler.',
    apply: () => base({ ffbInput: 30000 }),
  },
  {
    id: 'underpressed',
    label: 'Low cone pressure',
    note: 'Cone back-pressure dropped to 30 bar: more oil stays in the press fibre, so the OER falls (loss model is typical mill practice, not from the flow chart).',
    apply: () => base({ conePressure: 30 }),
  },
  {
    id: 'traditional',
    label: 'Traditional route',
    note: 'Heaping, hand stripping, treading ("matching") in a canoe, boiling with water in drums and decanting. Poor sterilisation, digestion and pressing give a low, acidic yield; modelled here by under-cooking and no press or centrifuge.',
    apply: () => base({ steriliserTemp: 100, steriliserTime: 40, digesterTemp: 70, digesterSpeed: 10, conePressure: 25, centrifugeRpm: 3000 }),
  },
]

export const EXAM: Preset[] = [
  {
    id: 'globule',
    label: '50 µm oil globule (Stokes)',
    note: 'Oil globule D = 50 µm, ρ_oil = 900, ρ_water = 1000 kg/m³, µ = 10⁻³ Pa·s. V = gD²Δρ/(18µ) = 1.36 × 10⁻⁴ m/s upward. No bowl radius or speed is given, so the centrifuge result is ×rω²/g.',
    apply: () => base({ oilGlobuleDiaUm: 50, station: 'clarifier' }),
  },
]

function LivePanel() {
  const p = usePalmOil()
  const r = useMemo(() => calculateMillPerformance(p), [p])
  const t = useLive(() => live.time, 4)
  const hours = t / 60 // 1 sim-second shown as 1 plant-minute
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="FFB in" value={fmt(p.ffbInput, 4)} unit="kg/h" />
        <Readout label="Crude palm oil" value={fmt(r.cpoKg, 4)} unit="kg/h" tone="accent" />
        <Readout label="OER" value={fmt(r.oer, 3)} unit="%" tone="warn" />
        <Readout label="Kernels (KER)" value={`${fmt(r.kernelsKg, 3)} · ${fmt(r.ker, 2)} %`} unit="kg/h" />
        <Readout label="Oil losses" value={fmt(r.totalLossKg, 3)} unit="kg/h" />
        <Readout label="Boiler fuel" value={fmt(r.boilerFuelKg, 4)} unit="kg/h" tone="info" />
      </div>
      <Note>
        Plant time {fmt(hours, 3)} h (1 s shown = 1 min): {fmt((p.ffbInput * hours) / 1000, 3)} t FFB processed, {fmt((r.cpoKg * hours) / 1000, 3)} t oil.
        Steam {r.boilerSteamSurplusKg >= 0 ? 'surplus' : 'deficit'} {fmt(Math.abs(r.boilerSteamSurplusKg), 3)} kg/h.
      </Note>
      <div className="mt-2">
        <Table
          head={['Stream', 'kg/h', '% FFB']}
          rows={[
            ['FFB in', fmt(p.ffbInput, 4), '100'],
            ['Condensate (steriliser)', fmt(r.condensateKg, 4), fmt((100 * r.condensateKg) / p.ffbInput, 3)],
            ['Empty bunches', fmt(r.efbKg, 4), fmt((100 * r.efbKg) / p.ffbInput, 3)],
            ['Fruit to digester', fmt(r.fruitsKg, 4), fmt((100 * r.fruitsKg) / p.ffbInput, 3)],
            ['+ dilution water', fmt(r.dilutionKg, 4), fmt((100 * r.dilutionKg) / p.ffbInput, 3)],
            ['Crude palm oil', fmt(r.cpoKg, 4), fmt(r.oer, 3)],
            ['Sludge', fmt(r.sludgeKg, 4), fmt((100 * r.sludgeKg) / p.ffbInput, 3)],
            ['Fibre', fmt(r.fibreKg, 4), fmt((100 * r.fibreKg) / p.ffbInput, 3)],
            ['Shell', fmt(r.shellKg, 4), fmt((100 * r.shellKg) / p.ffbInput, 3)],
            ['Kernels', fmt(r.kernelsKg, 4), fmt(r.ker, 3)],
          ]}
          highlight={5}
        />
      </div>
    </Section>
  )
}

function Controls() {
  const p = usePalmOil()
  return (
    <Section title="Mill">
      <ModeTabs<StationId>
        value={p.station}
        onChange={(station) => set({ station })}
        options={[
          { value: 'all', label: 'Whole line' },
          { value: 'steriliser', label: 'Steriliser' },
          { value: 'thresher', label: 'Thresher' },
          { value: 'digester', label: 'Digester' },
          { value: 'press', label: 'Screw press' },
          { value: 'clarifier', label: 'Clarifier' },
          { value: 'depericarper', label: 'Nut/fibre' },
        ]}
      />
      <div className="h-2" />
      <Slider label="Throughput (FFB)" value={p.ffbInput} min={500} max={60000} step={500} unit="kg/h" onChange={(ffbInput) => set({ ffbInput })} />
      <Slider label="Recoverable oil in FFB (as OER)" value={p.ffbOilContent} min={15} max={28} step={0.1} unit="%" onChange={(ffbOilContent) => set({ ffbOilContent })} />
      <Slider label="Steriliser steam" value={p.steriliserTemp} min={100} max={150} step={1} unit="°C" onChange={(steriliserTemp) => set({ steriliserTemp })} />
      <Slider label="Sterilising time" value={p.steriliserTime} min={30} max={100} step={1} unit="min" onChange={(steriliserTime) => set({ steriliserTime })} />
      <Slider label="Digester temperature" value={p.digesterTemp} min={60} max={98} step={1} unit="°C" onChange={(digesterTemp) => set({ digesterTemp })} />
      <Slider label="Digester speed" value={p.digesterSpeed} min={5} max={35} step={1} unit="rpm" onChange={(digesterSpeed) => set({ digesterSpeed })} />
      <Slider label="Press cone back-pressure" value={p.conePressure} min={20} max={80} step={1} unit="bar" onChange={(conePressure) => set({ conePressure })} hint="More pressure: less oil in the fibre, more broken nuts" />
      <Slider label="Press screw speed" value={p.pressRpm} min={6} max={20} step={1} unit="rpm" onChange={(pressRpm) => set({ pressRpm })} />
      <Slider label="Clarifier temperature" value={p.clarifierTemp} min={60} max={95} step={1} unit="°C" onChange={(clarifierTemp) => set({ clarifierTemp })} />
      <Slider label="Purifier (centrifuge) speed" value={p.centrifugeRpm} min={2000} max={6500} step={100} unit="rpm" onChange={(centrifugeRpm) => set({ centrifugeRpm })} />
      <Slider label="Oil globule size" value={p.oilGlobuleDiaUm} min={10} max={120} step={1} unit="µm" onChange={(oilGlobuleDiaUm) => set({ oilGlobuleDiaUm })} />
      <Slider label="Depericarper air speed" value={p.winnowerAirSpeed} min={2} max={12} step={0.1} unit="m/s" onChange={(winnowerAirSpeed) => set({ winnowerAirSpeed })} />
      <Note>
        Process temperatures, pressures and loss coefficients are typical mill practice; the flow chart gives only the steps and the 1000 kg balance.
      </Note>
    </Section>
  )
}

function Charts() {
  const p = usePalmOil()
  const r = useMemo(() => calculateMillPerformance(p), [p])
  const steps = useMemo(() => {
    const xs = [0, 1, 2, 3, 4, 5]
    const s = r.scale || 1
    // main stream mass after each step, per 1000 kg FFB
    const main = [1000, 1000 - r.condensateKg / s, r.fruitsKg / s, (r.fruitsKg + r.dilutionKg) / s, (r.cpoKg + r.sludgeKg) / s, r.cpoKg / s]
    return { xs, main }
  }, [r])
  const press = useMemo(() => {
    const xs: number[] = []
    const oer: number[] = []
    const brk: number[] = []
    for (let b = 20; b <= 80; b += 2) {
      const q = calculateMillPerformance({ ...p, conePressure: b })
      xs.push(b)
      oer.push(q.oer)
      brk.push(q.nutBreakagePct)
    }
    return { xs, oer, brk }
  }, [p])
  return (
    <Section title="Charts">
      <Chart data={[steps.xs, steps.main]} series={[{ label: 'main stream', color: '#e8a33d', width: 2 }]} xLabel="Step: FFB → sterilised → fruit → + water → press liquor → CPO" yLabel="kg per 1000 kg FFB" height={150} />
      <div className="h-2" />
      <Chart
        data={[press.xs, press.oer, press.brk]}
        series={[
          { label: 'OER %', color: '#9bd17a', width: 2 },
          { label: 'nuts broken %', color: '#e8794f', width: 2, dash: [4, 3] },
        ]}
        xLabel="Press cone back-pressure (bar)"
        yLabel="%"
        marker={() => [p.conePressure, r.oer]}
        height={150}
      />
      <Note>Higher back-pressure squeezes more oil from the fibre but cracks more nuts, which spoils the kernel stream (typical behaviour, beyond the flow chart).</Note>
    </Section>
  )
}

function CalcWorking() {
  const p = usePalmOil()
  const r = useMemo(() => calculateMillPerformance(p), [p])
  const c = pombClosure()
  const m = MASS_BALANCE_1000KG
  const steps: WorkingStep[] = [
    {
      label: 'Steriliser and thresher balance',
      tex: 'm_{loss}=FFB-EFB-\\text{fruit}',
      sub: `=${m.ffb}-${m.efb}-${m.fruits}`,
      result: `=${c.sterLoss}\\ \\text{kg per tonne (condensate, inferred)}`,
      cite: P504.pomb('per 1000 kg FFB'),
      errata: 'The chart prints no steriliser loss; 100 kg per tonne is implied.',
    },
    {
      label: 'Fruit balance — dilution water',
      tex: 'W=(CPO+sludge+fibre+shell+kernel)-\\text{fruit}',
      sub: `=(${m.cpo}+${m.sludge}+${m.fibre}+${m.shell}+${m.kernels})-${m.fruits}`,
      result: `=${c.dilution}\\ \\text{kg per tonne}`,
      cite: P504.pomb('per 1000 kg FFB'),
      errata: 'The printed outputs from the fruit (725 kg) exceed the fruit (666 kg); the balance closes only if ≈ 59 kg of dilution water is added.',
    },
    {
      label: 'Oil and kernel extraction rates',
      tex: 'OER=\\dfrac{CPO}{FFB},\\quad KER=\\dfrac{kernels}{FFB}',
      sub: `=\\dfrac{${n(r.cpoKg, 4)}}{${n(p.ffbInput, 4)}},\\ \\dfrac{${n(r.kernelsKg, 4)}}{${n(p.ffbInput, 4)}}`,
      result: `OER=${n(r.oer, 3)}\\,\\%,\\ KER=${n(r.ker, 3)}\\,\\%`,
      cite: P504.pomb('CPO 225 kg, kernels 67 kg'),
    },
    {
      label: 'Oil globule rising in the clarifier (Stokes)',
      tex: 'V=\\dfrac{gD^2(\\rho_w-\\rho_o)}{18\\mu}',
      sub: `=\\dfrac{9.81(${n(p.oilGlobuleDiaUm * 1e-6, 3)})^2(1000-900)}{18(10^{-3})}\\ \\text{at 20 °C}`,
      result: `=${n(r.vStokesGravityPq * ((p.oilGlobuleDiaUm / 50) ** 2), 3)}\\ \\text{m/s};\\ \\text{at }${p.clarifierTemp}^\\circ\\text{C: }${n(r.vStokesGravityActual, 3)}\\ \\text{m/s}`,
      cite: P504.sep('eqs 11–12'),
    },
    {
      label: 'Centrifugal purifier',
      tex: 'U=\\dfrac{D^2 r\\omega^2(\\rho_w-\\rho_o)}{18\\mu},\\quad \\dfrac{r\\omega^2}{g}',
      sub: `r=0.16\\ \\text{m},\\ \\omega=2\\pi(${p.centrifugeRpm})/60`,
      result: `rω^2/g=${n(r.separationFactor, 4)},\\ U=${n(r.vStokesCentrifugal, 3)}\\ \\text{m/s}`,
      cite: P504.sep('eq 18'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function PalmOilPanel() {
  const [preset, setPreset] = useState<string | null>('pomb')
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={EXAM} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <CalcWorking />
    </div>
  )
}
