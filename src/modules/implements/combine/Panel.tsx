import { useMemo, useState } from 'react'
import { SANDEL, THRESH_REF, combineCapacity, cylinderPeripheralSpeed, threshing } from '@/physics/harvest'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, D, DEFAULTS, RATED_FEED, TANK_T, live, machineState, useCombine, type CombineParams } from './model'

interface Preset {
  id: string
  label: string
  note: string
  params: Partial<CombineParams>
}

const sandelSpeed = combineCapacity(SANDEL).speedKmh

export const PRESETS: Preset[] = [
  {
    id: 'sandel',
    label: 'Exam 2019/20 · SANDEL combine',
    note: '10,000 t a year, 75 % maize, combine working 85 % of 600 h, 15 t/ha, 5.85 m of a 6 m header. The machine runs at the speed these figures imply.',
    params: { exam: { ...SANDEL }, speed: Math.round(sandelSpeed * 100) / 100, widthUsed: 5.85, yield: 15, grainFraction: 0.75, rpm: 890, clearance: 12, fan: 1 },
  },
  { id: 'cracked', label: 'Cracked grain', note: 'Cylinder speed too high and clearance too small: the grain is cracked.', params: { rpm: 1250, clearance: 6, fan: 1 } },
  { id: 'unthreshed', label: 'Unthreshed heads', note: 'The reverse — cylinder too slow, clearance too wide: heads go out over the walkers unthreshed.', params: { rpm: 560, clearance: 24, fan: 1 } },
  { id: 'unclean', label: 'Unclean grain', note: 'Fan speed too low (or poor shaking): chaff stays with the grain and the sieves choke.', params: { rpm: 890, clearance: 12, fan: 0.55 } },
  { id: 'blown', label: 'Grain blown out', note: 'Excessive air blast blows grain out with the chaff.', params: { rpm: 890, clearance: 12, fan: 1.55 } },
  { id: 'overload', label: 'Overloaded', note: 'Driving too fast for the crop: the feed exceeds what the walkers can separate, so grain goes out with the straw — the units must be matched.', params: { speed: 4.6, yield: 6, grainFraction: 0.5 } },
]

function LivePanel() {
  const st = useCombine()
  const ms = machineState(st)
  const v = useLive(() => ({ tank: live.tank, unloading: live.unloading, harvested: live.harvested }), 8, (a, b) => Math.abs(a.tank - b.tank) < 0.01 && a.unloading === b.unloading)
  const tone = (x: number, warn: number) => (x > warn ? 'warn' : 'ink')
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Area capacity" value={fmt(ms.feed.area, 3)} unit="ha/h" tone="accent" />
        <Readout label="Grain feed" value={fmt(ms.feed.grainRate, 3)} unit="t/h" />
        <Readout label="Total feed" value={fmt(ms.feed.totalRate, 3)} unit="t/h" tone={ms.load > 1.1 ? 'warn' : 'ink'} />
        <Readout label="Load" value={`${Math.round(ms.load * 100)}`} unit={`% of ${RATED_FEED} t/h`} tone={ms.load > 1.1 ? 'warn' : 'ink'} />
        <Readout label="Cylinder" value={fmt(ms.vCyl, 3)} unit="m/s" />
        <Readout label="Grain loss" value={fmt(ms.loss.totalLoss, 2)} unit="%" tone={tone(ms.loss.totalLoss, 2)} />
        <Readout label="Cracked" value={fmt(ms.loss.cracked, 2)} unit="%" tone={tone(ms.loss.cracked, 2)} />
        <Readout label="Dockage" value={fmt(ms.loss.dockage, 2)} unit="%" tone={tone(ms.loss.dockage, 2)} />
        <Readout label="Tank" value={`${Math.round((v.tank / TANK_T) * 100)}`} unit={v.unloading ? '% · unloading' : '%'} tone={v.unloading ? 'info' : 'ink'} />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-dim">Tank level runs on a ×60 time-lapse. Orange particles in the straw and chaff streams are lost grain. Loss figures come from an indicative model that follows the standard adjustment trends, not measured values.</p>
    </Section>
  )
}

function Diagnosis() {
  const st = useCombine()
  const { loss, load } = machineState(st)
  const items: string[] = []
  if (loss.cracked > 2) items.push('Cracked grain → cylinder speed too high or concave clearance too small.')
  if (loss.unthreshed > 1.5) items.push('Unthreshed heads → cylinder speed too low or clearance too large.')
  if (loss.dockage > 2) items.push('Unclean grain → fan speed too low (or poor shaking); sieves may choke.')
  if (loss.shoe > 1.5) items.push('Grain in the chaff → excessive air blast.')
  if (load > 1.15) items.push('Grain over the walkers → feed too high for the separating unit; slow down.')
  return (
    <div className={`rounded-md border px-2.5 py-2 text-[11.5px] leading-snug ${items.length ? 'border-warn/50 text-warn/90' : 'border-line-2 text-mute'}`}>
      {items.length ? items.map((t) => <div key={t}>• {t}</div>) : 'Settings are matched to the crop: losses are small.'}
    </div>
  )
}

function LossChart() {
  const clearance = useCombine((s) => s.clearance)
  const fan = useCombine((s) => s.fan)
  const data = useMemo(() => {
    const xs: number[] = []
    const cr: number[] = []
    const un: number[] = []
    const tot: number[] = []
    for (let rpm = 450; rpm <= 1400; rpm += 10) {
      const r = threshing({ speed: cylinderPeripheralSpeed(2 * D.cyl.r, rpm), clearance, fan, load: 1 })
      xs.push(rpm)
      cr.push(r.cracked)
      un.push(r.unthreshed)
      tot.push(r.totalLoss)
    }
    return [xs, cr, un, tot]
  }, [clearance, fan])
  return (
    <Section title="Cylinder speed and grain damage">
      <Chart
        data={data}
        series={[
          { label: 'Cracked %', color: '#e8794f', width: 2 },
          { label: 'Unthreshed %', color: '#6fb3e0', width: 2 },
          { label: 'Total loss %', color: '#9bd17a', width: 1.5, dash: [4, 3] },
        ]}
        xLabel="Cylinder speed (rpm)"
        yLabel="% of grain"
        marker={() => {
          const s = useCombine.getState()
          return [s.rpm, threshing({ speed: cylinderPeripheralSpeed(2 * D.cyl.r, s.rpm), clearance: s.clearance, fan: s.fan, load: 1 }).cracked]
        }}
        height={170}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        There is an optimum: too fast cracks grain, too slow leaves heads unthreshed. Closing the concave moves both curves to lower speeds. Curves are illustrative (reference {THRESH_REF.speed} m/s at {THRESH_REF.clearance} mm).
      </p>
    </Section>
  )
}

function CapacityWorking() {
  const exam = useCombine((s) => s.exam)
  const setExam = useCombine((s) => s.setExam)
  const c = combineCapacity(exam)
  const pct = (x: number) => n(x * 100, 3)
  const steps: WorkingStep[] = [
    {
      label: 'Hours actually worked',
      tex: 't = \\text{annual use}\\times\\text{fraction worked}',
      sub: `= ${n(exam.annualHours, 4)}\\,\\text{h}\\times${pct(exam.workingFraction)}\\,\\%`,
      result: `= ${n(c.hours, 4)}\\ \\text{h}`,
      cite: C.exam1920('combine question'),
      errata: 'The question first gives the new harvester 400 annual hours, then says it "worked for only 85 % of its 600 hour annual use", and calls the crop cowpea then maize. The capacity part uses 600 h and maize, as asked.',
    },
    {
      label: 'Commodity throughput capacity (product only)',
      tex: 'C_c = \\dfrac{\\text{mass of product}}{t}',
      sub: `= \\dfrac{${pct(exam.productFraction)}\\,\\%\\times${n(exam.totalMass, 5)}\\,\\text{t}}{${n(c.hours, 4)}\\,\\text{h}}`,
      result: `= ${n(c.commodity, 4)}\\ \\text{t/h}`,
      cite: C.exam1920('commodity throughput capacity'),
    },
    {
      label: 'Total throughput capacity (grain + stalk + leaves)',
      tex: 'C_t = \\dfrac{\\text{total mass handled}}{t}',
      sub: `= \\dfrac{${n(exam.totalMass, 5)}\\,\\text{t}}{${n(c.hours, 4)}\\,\\text{h}}`,
      result: `= ${n(c.total, 4)}\\ \\text{t/h}`,
      cite: C.exam1920('total throughput capacity'),
    },
    {
      label: 'Area harvested (15 t of maize per hectare)',
      tex: 'A = \\dfrac{\\text{mass of product}}{\\text{yield}}',
      sub: `= \\dfrac{${n(c.productMass, 5)}\\,\\text{t}}{${n(exam.yieldPerHa, 3)}\\,\\text{t/ha}}`,
      result: `= ${n(c.area, 4)}\\ \\text{ha}`,
      cite: C.exam1920('area capacity'),
    },
    {
      label: 'Effective area capacity',
      tex: 'C_e = \\dfrac{A}{t} = \\dfrac{W_e\\,S}{10}',
      sub: `= \\dfrac{${n(c.area, 4)}}{${n(c.hours, 4)}}`,
      result: `= ${n(c.effectiveArea, 4)}\\ \\text{ha/h}\\quad(S = ${n(c.speedKmh, 3)}\\ \\text{km/h on } W_e = ${n(exam.effectiveWidth, 3)}\\ \\text{m})`,
      cite: C.mgmt('p7–8 field capacity'),
    },
    {
      label: 'Theoretical area capacity (full header width, same speed)',
      tex: 'C_{th} = \\dfrac{W\\,S}{10} = C_e\\,\\dfrac{W}{W_e}',
      sub: `= ${n(c.effectiveArea, 4)}\\times\\dfrac{${n(exam.headerWidth, 3)}}{${n(exam.effectiveWidth, 3)}}`,
      result: `= ${n(c.theoreticalArea, 4)}\\ \\text{ha/h}\\quad(W_e/W = ${n(c.widthEfficiency * 100, 3)}\\,\\%)`,
      cite: C.mgmt('p7–8'),
    },
    {
      label: 'Check: area capacity × total material per hectare',
      tex: 'C_e\\times\\dfrac{\\text{yield}}{\\text{product fraction}} = C_t',
      sub: `${n(c.effectiveArea, 4)}\\times${n(c.totalPerHa, 4)}\\,\\text{t/ha}`,
      result: `= ${n(c.effectiveArea * c.totalPerHa, 4)}\\ \\text{t/h}`,
      cite: C.exam1920('consistency of the data'),
    },
  ]
  return (
    <Section title="Working — capacity">
      <div className="grid grid-cols-2 gap-x-3">
        <Slider label="Crop handled" value={exam.totalMass} min={1000} max={20000} step={100} unit="t" onChange={(totalMass) => setExam({ totalMass })} />
        <Slider label="Product fraction" value={exam.productFraction} min={0.3} max={0.95} step={0.01} onChange={(productFraction) => setExam({ productFraction })} />
        <Slider label="Annual use" value={exam.annualHours} min={100} max={1200} step={10} unit="h" onChange={(annualHours) => setExam({ annualHours })} />
        <Slider label="Fraction worked" value={exam.workingFraction} min={0.4} max={1} step={0.01} onChange={(workingFraction) => setExam({ workingFraction })} />
        <Slider label="Yield" value={exam.yieldPerHa} min={1} max={20} step={0.5} unit="t/ha" onChange={(yieldPerHa) => setExam({ yieldPerHa })} />
        <Slider label="Width used" value={exam.effectiveWidth} min={1} max={exam.headerWidth} step={0.05} unit="m" onChange={(effectiveWidth) => setExam({ effectiveWidth })} />
      </div>
      <Working steps={steps} />
      <p className="mt-2 text-[11px] leading-snug text-dim">
        Area capacity = land per hour; commodity throughput = product per hour; total throughput = all material through the machine per hour. If the 15 t/ha is read as total crop rather than maize, A = 666.7 ha and C<sub>e</sub> = 1.31 ha/h.
      </p>
    </Section>
  )
}

export function CombinePanel() {
  const st = useCombine()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<CombineParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Field and crop">
        <Slider label="Forward speed" value={st.speed} min={0.8} max={6} step={0.05} unit="km/h" onChange={(speed) => set({ speed })} />
        <Slider label="Header width used" value={st.widthUsed} min={2} max={D.header.width} step={0.05} unit="m" onChange={(widthUsed) => set({ widthUsed })} hint="The size of a combine is its cutter-bar width" />
        <Slider label="Grain yield" value={st.yield} min={1} max={16} step={0.5} unit="t/ha" onChange={(y) => set({ yield: y })} />
        <Slider label="Grain fraction of crop mass" value={st.grainFraction} min={0.3} max={0.85} step={0.01} onChange={(grainFraction) => set({ grainFraction })} />
      </Section>
      <Section title="Machine settings">
        <Slider label="Cylinder speed" value={st.rpm} min={450} max={1400} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Slider label="Concave clearance" value={st.clearance} min={4} max={30} step={1} unit="mm" onChange={(clearance) => set({ clearance })} hint="Watch the concave move" />
        <Slider label="Fan speed" value={st.fan} min={0.4} max={1.7} step={0.01} unit="× correct" onChange={(fan) => set({ fan })} />
        <Toggle label="Unload when the tank is full" checked={st.autoUnload} onChange={(autoUnload) => st.set({ autoUnload })} />
        <Toggle label="Show crop, grain, straw and chaff flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        <Diagnosis />
      </Section>
      <Section title="Exam presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                st.set({ ...DEFAULTS, exam: st.exam, ...p.params })
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
      <LossChart />
      <CapacityWorking />
    </div>
  )
}
