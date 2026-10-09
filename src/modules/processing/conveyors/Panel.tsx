import { useMemo, useState } from 'react'
import { beltCapacityM3h, bucketElevatorPower, chainConveyorPower, pneumaticDesign, screwCapacityM3h, troughSection } from '@/physics/processing'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { ModeTabs, Note, PresetGrid, Table, type Preset } from '../../elements/_shared/PanelBits'
import { P504 } from './cites'
import { COMPARE, DEFAULTS, DISCHARGE_V, MATERIALS, analyse, deg, rad, useConv, type ConvParams, type Kind } from './model'

const set = (p: Partial<ConvParams>) => useConv.getState().set(p)
const base = (p: Partial<ConvParams>) => set({ ...DEFAULTS, ...p })
const H = (w: string) => P504.hand(`Note 3, ${w}`)

export const PRESETS: Preset[] = [
  {
    id: 'grain-belt',
    label: 'Grain belt · 2.5 m/s',
    note: 'Typical grain belt: 600 mm belt, 20° troughing idlers, 20° surcharge, 2.5 m/s (2.5–2.8 m/s recommended; ≤ 3.5 m/s), 30 m long rising 8°.',
    apply: () => base({ kind: 'belt' }),
  },
  {
    id: 'palm-elevator',
    label: 'Palm fruit · centrifugal elevator',
    note: 'Centrifugal discharge suits fine loose material and palm fruits: fast buckets thrown clear over the head pulley. 20 t/h lifted 15 m.',
    apply: () => base({ kind: 'bucket', discharge: 'centrifugal', bucketV: DISCHARGE_V.centrifugal, bucketQ: 20, bucketH: 15 }),
  },
  {
    id: 'sticky-screw',
    label: 'Sticky meal · ribbon screw',
    note: 'A ribbon flight (gap between flight and shaft) for damp, sticky material; actual capacity 30–50 % of theoretical.',
    apply: () => base({ kind: 'screw', flight: 'ribbon', eff: 0.3, n: 60 }),
  },
  {
    id: 'feed-pneumatic',
    label: 'Feed · suction pneumatic line',
    note: 'Suction (negative) system: fan at the tail, many pick-up points to one cyclone. 1500 m/min ≈ 25 m/s air.',
    apply: () => base({ kind: 'pneumatic', mode: 'suction', airV: 25, airQ: 0.5, staticCm: 30 }),
  },
]

export const EXAM: Preset[] = [
  {
    id: 'pq1-q5',
    label: '2015 Q5 · belt vs screw',
    note: 'Compare belt and screw conveyors. Belt: high capacity, long distance, low power, little damage (no relative motion), high cost; limited incline. Screw: short runs, enclosed, handles damp/sticky/hot material, inclines to 20°, but medium capacity and high damage (material slides on the flight and trough).',
    apply: () => base({ kind: 'screw' }),
  },
  {
    id: 'pq6-bucket',
    label: 'PQ p6 · bucket conveyors',
    note: 'Describe bucket elevators: head, boot and legs; discharge types centrifugal (fast, thrown), positive (slow, buckets inverted), continuous (adjacent buckets, 30–38 m/min, each acts as a chute for the next, ≈ 2× positive capacity) and super-capacity.',
    apply: () => base({ kind: 'bucket', discharge: 'continuous', bucketV: DISCHARGE_V.continuous }),
  },
  {
    id: 'pq6-select',
    label: 'PQ p6 · tubers, oil, tomatoes',
    note: 'Cassava tubers → belt (bulky units, no damage) or slat/apron chain. Groundnut oil → a liquid: pump and pipeline, not a bulk conveyor. Tomatoes → belt (gentle) — screws and chains bruise them.',
    apply: () => base({ kind: 'belt', trough: 0, surcharge: rad(10) }),
  },
  {
    id: 'pq6-chain',
    label: 'PQ p6 · defend chain conveyors',
    note: 'Chain conveyors are simple to design, cheap and need little technical skill; they carry heavy, hot or abrasive loads, wastes and lumps (apron conveyors take palm kernels and cane). Against: noisy, slow and less efficient than belts.',
    apply: () => base({ kind: 'chain' }),
  },
  {
    id: 'pq3-q1',
    label: '2017 Q1 · feed-mill handling',
    note: 'Feed mill: the dust device at "point A" is a cyclone; a pneumatic line (or screw) can bypass the mixers. Pneumatic: any routing, self-cleaning, one moving part — but chokes, needs high power and can damage particles.',
    apply: () => base({ kind: 'pneumatic', mode: 'positive' }),
  },
]

function Live() {
  const p = useConv()
  const a = useMemo(() => analyse(p), [p])
  const R = (label: string, v: number, d: number, unit: string, tone?: 'accent' | 'warn' | 'info') => <Readout label={label} value={fmt(v, d)} unit={unit} tone={tone} />
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        {p.kind === 'belt' ? (
          <>
            {R('Load area A + As', (a.tr.area) * 1e4, 3, 'cm²')}
            {R('Capacity', a.beltM3h, 3, 'm³/h', 'info')}
            {R('Mass flow', (a.beltQ * 3600) / 1000, 3, 't/h')}
            {R('Lift H', a.beltH, 3, 'm')}
            {R('Power', a.beltP.total / 1000, 3, 'kW', 'warn')}
            {R('Belt speed', p.v * 60, 3, 'm/min', 'accent')}
          </>
        ) : p.kind === 'chain' ? (
          <>
            {R('Material W', a.W, 3, 'N/m')}
            {R('Capacity', (a.chainQ * 3600) / 1000, 3, 't/h', 'info')}
            {R('Chain speed', p.chainV * 60, 3, 'm/min', 'accent')}
            {R('Chain term', a.chainP.chain / 1000, 3, 'kW')}
            {R('Material term', a.chainP.material / 1000, 3, 'kW')}
            {R('Power', a.chainP.total / 1000, 3, 'kW', 'warn')}
          </>
        ) : p.kind === 'screw' ? (
          <>
            {R('Pitch p', a.pitch * 1000, 3, 'mm')}
            {R('Volume / rev', a.volRev * 1000, 3, 'L')}
            {R('Theoretical', a.screwTheory, 3, 'm³/h')}
            {R('Actual', a.screwActual, 3, 'm³/h', 'info')}
            {R('Axial speed', a.screwAxial * 60, 3, 'm/min', 'accent')}
            {R('Power (× SF)', a.screwP.total / 1000, 3, 'kW', 'warn')}
          </>
        ) : p.kind === 'bucket' ? (
          <>
            {R('Mass flow Q', a.bucketQ, 3, 'kg/s')}
            {R('Lift H', p.bucketH, 3, 'm')}
            {R('Power', a.bucketP.total / 1000, 3, 'kW', 'warn')}
            {R('Bucket speed', p.bucketV * 60, 3, 'm/min', 'accent')}
            {R('v²/(gR)', a.headK, 3, '', 'info')}
            <Readout label="Leaves bucket" value={a.headK >= 1 ? 'before top' : `${a.releaseDeg.toFixed(0)}° past top`} />
          </>
        ) : (
          <>
            {R('Air velocity', p.airV * 60, 4, 'm/min', 'accent')}
            {R('Pipe area', a.pn.A * 1e4, 3, 'cm²')}
            {R('Pipe Ø', a.pn.D * 1000, 3, 'mm', 'info')}
            {R('Static H', a.pn.P * p.E / p.airQ, 4, 'Pa')}
            {R('Fan power', a.pn.P / 1000, 3, 'kW', 'warn')}
            <Readout label="Class" value={p.staticCm < 35 ? 'low pressure' : 'high pressure'} />
          </>
        )}
      </div>
    </Section>
  )
}

function Controls() {
  const p = useConv()
  return (
    <Section title="Conveyor">
      <ModeTabs<Kind>
        value={p.kind}
        onChange={(kind) => set({ kind })}
        options={[
          { value: 'belt', label: 'Belt' },
          { value: 'chain', label: 'Chain / flight' },
          { value: 'screw', label: 'Screw' },
          { value: 'bucket', label: 'Bucket elevator' },
          { value: 'pneumatic', label: 'Pneumatic' },
        ]}
      />
      <div className="h-2" />
      <Slider label="Bulk density ρ" value={p.rho} min={300} max={1200} step={10} unit="kg/m³" onChange={(rho) => set({ rho })} hint="Grain ≈ 750, ground feed ≈ 500" />
      {p.kind === 'belt' ? (
        <>
          <Slider label="Belt width B" value={p.B * 1000} min={350} max={1200} step={10} unit="mm" onChange={(x) => set({ B: x / 1000 })} />
          <Slider label="Troughing angle β" value={deg(p.trough)} min={0} max={45} step={1} unit="°" onChange={(x) => set({ trough: rad(x) })} />
          <Slider label="Surcharge angle α" value={deg(p.surcharge)} min={0} max={30} step={1} unit="°" onChange={(x) => set({ surcharge: rad(x) })} />
          <Slider label="Clear margin M" value={p.margin * 1000} min={20} max={150} step={5} unit="mm" onChange={(x) => set({ margin: x / 1000 })} />
          <Slider label="Belt speed v" value={p.v} min={0.5} max={4} step={0.05} unit="m/s" onChange={(v) => set({ v })} hint="Grain ≤ 3.5 m/s; 2.5–2.8 recommended" />
          <Slider label="Length L" value={p.L} min={5} max={100} step={1} unit="m" onChange={(L) => set({ L })} />
          <Slider label="Incline" value={deg(p.incline)} min={0} max={20} step={0.5} unit="°" onChange={(x) => set({ incline: rad(x) })} />
          <Slider label="Belt + idler mass" value={p.wBelt} min={10} max={80} step={1} unit="kg/m" onChange={(wBelt) => set({ wBelt })} />
          <Slider label="Idler friction factor" value={p.fIdler} min={0.015} max={0.06} step={0.001} onChange={(fIdler) => set({ fIdler })} />
        </>
      ) : p.kind === 'chain' ? (
        <>
          <Slider label="Chain speed V" value={p.chainV * 60} min={10} max={45} step={1} unit="m/min" onChange={(x) => set({ chainV: x / 60 })} hint="23 m/min (large granules) to 38 m/min (small)" />
          <Slider label="Length L" value={p.chainL} min={3} max={40} step={0.5} unit="m" onChange={(chainL) => set({ chainL })} />
          <Slider label="Lift H" value={p.chainH} min={0} max={5} step={0.1} unit="m" onChange={(chainH) => set({ chainH })} />
          <Slider label="Trough width" value={p.chainW * 1000} min={200} max={600} step={10} unit="mm" onChange={(x) => set({ chainW: x / 1000 })} />
          <Slider label="Material depth" value={p.chainDepth * 1000} min={20} max={250} step={5} unit="mm" onChange={(x) => set({ chainDepth: x / 1000 })} />
          <Slider label="Chain + flights Wc" value={p.Wc} min={30} max={500} step={5} unit="N/m" onChange={(Wc) => set({ Wc })} />
          <Slider label="Chain friction f" value={p.fChain} min={0.1} max={0.5} step={0.01} onChange={(fChain) => set({ fChain })} />
          <Slider label="Material friction Fc" value={p.Fc} min={0.2} max={0.9} step={0.01} onChange={(Fc) => set({ Fc })} />
        </>
      ) : p.kind === 'screw' ? (
        <>
          <Segmented
            value={p.flight}
            onChange={(flight) => set({ flight })}
            options={[
              { value: 'standard', label: 'Standard pitch' },
              { value: 'half', label: '½ pitch' },
              { value: 'ribbon', label: 'Ribbon' },
            ]}
          />
          <Slider label="Screw diameter D" value={p.D * 1000} min={100} max={400} step={5} unit="mm" onChange={(x) => set({ D: x / 1000, d: Math.min(p.d, (x / 1000) * 0.5) })} />
          <Slider label="Shaft diameter d" value={p.d * 1000} min={25} max={Math.round(p.D * 500)} step={1} unit="mm" onChange={(x) => set({ d: x / 1000 })} />
          <Slider label="Speed n" value={p.n} min={10} max={200} step={1} unit="rpm" onChange={(n) => set({ n })} />
          <Slider label="Actual / theoretical" value={p.eff * 100} min={20} max={60} step={1} unit="%" onChange={(x) => set({ eff: x / 100 })} hint="30–50 % in the notes" />
          <Slider label="Length L" value={p.screwL} min={1} max={20} step={0.5} unit="m" onChange={(screwL) => set({ screwL })} />
          <Slider label="Material factor F" value={p.F} min={0.2} max={2.5} step={0.05} onChange={(F) => set({ F })} hint="From the conveyor manual" />
          <Slider label="Safety factor" value={p.sf} min={1.25} max={2} step={0.05} onChange={(sf) => set({ sf })} />
        </>
      ) : p.kind === 'bucket' ? (
        <>
          <Segmented
            value={p.discharge}
            onChange={(discharge) => set({ discharge, bucketV: DISCHARGE_V[discharge] })}
            options={[
              { value: 'centrifugal', label: 'Centrifugal' },
              { value: 'positive', label: 'Positive' },
              { value: 'continuous', label: 'Continuous' },
            ]}
          />
          <Slider label="Bucket speed v" value={p.bucketV} min={0.3} max={4} step={0.05} unit="m/s" onChange={(bucketV) => set({ bucketV })} />
          <Slider label="Head pulley radius R" value={p.headR * 1000} min={150} max={400} step={5} unit="mm" onChange={(x) => set({ headR: x / 1000 })} />
          <Slider label="Capacity Q" value={p.bucketQ} min={1} max={100} step={1} unit="t/h" onChange={(bucketQ) => set({ bucketQ })} />
          <Slider label="Lift H" value={p.bucketH} min={3} max={40} step={0.5} unit="m" onChange={(bucketH) => set({ bucketH })} />
          <Slider label="Allowance" value={p.allowance * 100} min={10} max={15} step={1} unit="%" onChange={(x) => set({ allowance: x / 100 })} />
        </>
      ) : (
        <>
          <Segmented
            value={p.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'positive', label: 'Positive (fan at head)' },
              { value: 'suction', label: 'Suction (fan at tail)' },
            ]}
          />
          <Slider label="Air flow Q" value={p.airQ} min={0.1} max={2} step={0.01} unit="m³/s" onChange={(airQ) => set({ airQ })} />
          <Slider label="Air velocity V" value={p.airV * 60} min={600} max={2400} step={10} unit="m/min" onChange={(x) => set({ airV: x / 60 })} hint="≈ 1500 m/min for most farm jobs" />
          <Slider label="Total static pressure" value={p.staticCm} min={5} max={80} step={1} unit="cm H₂O" onChange={(staticCm) => set({ staticCm })} hint="Low pressure < 35 cm water" />
          <Slider label="System efficiency E" value={p.E * 100} min={20} max={80} step={1} unit="%" onChange={(x) => set({ E: x / 100 })} />
        </>
      )}
    </Section>
  )
}

function Selector() {
  const p = useConv()
  const [mat, setMat] = useState('grain')
  const m = MATERIALS.find((x) => x.id === mat)!
  return (
    <Section title="Selector">
      <div className="mb-1.5 flex flex-wrap gap-1">
        {MATERIALS.map((x) => (
          <button key={x.id} onClick={() => setMat(x.id)} className={`rounded border px-1.5 py-0.5 text-[11.5px] ${mat === x.id ? 'border-accent text-ink' : 'border-line-2 text-ink/70'}`}>
            {x.label}
          </button>
        ))}
      </div>
      <Note tone="info">
        {m.suits.length ? `Suits: ${m.suits.map((k) => COMPARE.find((c) => c.kind === k)!.name).join(', ')}. ` : ''}
        {m.why}
      </Note>
      <div className="mt-2 overflow-x-auto">
        <Table
          head={['', 'Capacity', 'Power', 'Cost', 'Damage', 'Distance', 'Tech']}
          rows={COMPARE.map((c) => [<button key={c.kind} className="text-info hover:underline" onClick={() => set({ kind: c.kind })}>{c.name}</button>, c.cap, c.power, c.cost, c.damage, c.dist, c.tech])}
          highlight={COMPARE.findIndex((c) => c.kind === p.kind)}
        />
      </div>
      <Note>Typical materials — {COMPARE.find((c) => c.kind === p.kind)!.materials}.</Note>
    </Section>
  )
}

function Charts() {
  const p = useConv()
  const a = useMemo(() => analyse(p), [p])
  const c = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    const y2: number[] = []
    if (p.kind === 'belt') {
      for (let i = 0; i <= 45; i++) {
        xs.push(i)
        ys.push(beltCapacityM3h(troughSection(p.B, p.margin, rad(i), p.surcharge).area, p.v))
        y2.push(beltCapacityM3h(troughSection(p.B, p.margin, rad(i), 0).area, p.v))
      }
      return { xs, ys, y2, x: 'Troughing angle β (°)', y: 'Capacity (m³/h)', l: ['with surcharge', 'no surcharge'], mk: () => [deg(p.trough), a.beltM3h] as [number, number] }
    }
    if (p.kind === 'chain') {
      for (let L = 2; L <= 40; L++) {
        xs.push(L)
        ys.push(chainConveyorPower(p.chainV, L, p.Wc, p.fChain, a.W, p.Fc, p.chainH).total / 1000)
        y2.push(chainConveyorPower(p.chainV, L, p.Wc, p.fChain, 0, p.Fc, 0).total / 1000)
      }
      return { xs, ys, y2, x: 'Length L (m)', y: 'Power (kW)', l: ['loaded', 'chain only'], mk: () => [p.chainL, a.chainP.total / 1000] as [number, number] }
    }
    if (p.kind === 'screw') {
      for (let r = 10; r <= 200; r += 5) {
        xs.push(r)
        ys.push(screwCapacityM3h(p.D, p.d, a.pitch, r, 1))
        y2.push(screwCapacityM3h(p.D, p.d, a.pitch, r, p.eff))
      }
      return { xs, ys, y2, x: 'Speed n (rpm)', y: 'Capacity (m³/h)', l: ['theoretical', 'actual'], mk: () => [p.n, a.screwActual] as [number, number] }
    }
    if (p.kind === 'bucket') {
      for (let h = 3; h <= 40; h++) {
        xs.push(h)
        ys.push(bucketElevatorPower(a.bucketQ, h, 0.15).total / 1000)
        y2.push(bucketElevatorPower(a.bucketQ, h, 0).total / 1000)
      }
      return { xs, ys, y2, x: 'Lift H (m)', y: 'Power (kW)', l: ['QH + 15 %', 'QH'], mk: () => [p.bucketH, a.bucketP.total / 1000] as [number, number] }
    }
    for (let v = 600; v <= 2400; v += 50) {
      xs.push(v)
      ys.push(pneumaticDesign(p.airQ, v / 60, 1, 1).D * 1000)
      y2.push(NaN)
    }
    return { xs, ys, y2: null, x: 'Air velocity (m/min)', y: 'Pipe diameter (mm)', l: ['D = √(4Q/πV)', ''], mk: () => [p.airV * 60, a.pn.D * 1000] as [number, number] }
  }, [p, a])
  return (
    <Section title="Chart">
      <Chart
        data={c.y2 ? [c.xs, c.ys, c.y2] : [c.xs, c.ys]}
        series={c.y2 ? [{ label: c.l[0], color: '#9bd17a', width: 2 }, { label: c.l[1], color: '#6fb3e0', width: 1.5, dash: [4, 4] }] : [{ label: c.l[0], color: '#9bd17a', width: 2 }]}
        xLabel={c.x}
        yLabel={c.y}
        marker={c.mk}
        height={160}
      />
    </Section>
  )
}

function CalcWorking() {
  const p = useConv()
  const a = useMemo(() => analyse(p), [p])
  const steps: WorkingStep[] = []
  if (p.kind === 'belt') {
    steps.push({ label: 'Load area between the rolls (three equal rolls, b = B − 2M)', tex: 'A=\\tfrac{1}{2}(l+l+2l\\cos\\beta)\\,l\\sin\\beta,\\ l=b/3', sub: `l=${n(a.tr.l * 1000, 3)}\\ \\text{mm}`, result: `A=${n(a.tr.A * 1e4, 3)}\\ \\text{cm}^2`, cite: H('Design (preliminary)'), beyond: true })
    steps.push({ label: 'Surcharge area above line AB (circular segment)', tex: 'A_s=R^2(\\alpha-\\sin\\alpha\\cos\\alpha),\\ R=\\dfrac{w}{2\\sin\\alpha}', sub: `w=${n(a.tr.top * 1000, 3)}\\ \\text{mm},\\ \\alpha=${n(deg(p.surcharge), 3)}^\\circ`, result: `A_s=${n(a.tr.As * 1e4, 3)}\\ \\text{cm}^2`, cite: H('Design (preliminary)'), beyond: true })
    steps.push({ label: 'Capacity C = V(A + As)', tex: 'C=(A+A_s)\\,v\\times 60\\ \\ [v\\ \\text{in m/min}]', sub: `=(${n(a.tr.area, 4)})(${n(p.v * 60, 4)})(60)`, result: `=${n(a.beltM3h, 4)}\\ \\text{m}^3/\\text{h} = ${n((a.beltQ * 3600) / 1000, 4)}\\ \\text{t/h}`, cite: H('Belt conveyors; Design (preliminary)') })
    steps.push({ label: 'Power: empty belt + horizontal (load friction) + lift', tex: 'P=f\\,w_b L g v+f\\,Q L g+Q g H', sub: `=${n(a.beltP.empty, 4)}+${n(a.beltP.horizontal, 4)}+${n(a.beltP.lift, 4)}`, result: `=${n(a.beltP.base / 1000, 4)}\\ \\text{kW}${a.beltP.wide ? '\\ (+20\\%\\ \\text{for } B>0.9\\ \\text{m})' : ''} \\Rightarrow ${n(a.beltP.total / 1000, 4)}\\ \\text{kW}`, cite: H('Power to drive belt conveyors') })
  } else if (p.kind === 'chain') {
    steps.push({ label: 'Material weight per metre', tex: 'W=\\rho g\\,(\\text{depth}\\times\\text{width})', sub: `=${p.rho}(9.81)(${n(a.chainArea, 4)})`, result: `=${n(a.W, 4)}\\ \\text{N/m}`, beyond: true })
    steps.push({ label: 'Chain power', tex: 'P=2VLW_cf+W(LF_c+H)V', sub: `=2(${n(p.chainV, 3)})(${p.chainL})(${p.Wc})(${p.fChain})+${n(a.W, 4)}(${p.chainL}\\times${p.Fc}+${p.chainH})(${n(p.chainV, 3)})`, result: `=${n(a.chainP.chain, 4)}+${n(a.chainP.material, 4)}=${n(a.chainP.total / 1000, 4)}\\ \\text{kW}`, cite: H('Steps in determining the proper chain') })
    steps.push({ label: 'Capacity', tex: 'Q=\\dfrac{W}{g}V', sub: `=\\dfrac{${n(a.W, 4)}}{9.81}(${n(p.chainV, 3)})`, result: `=${n(a.chainQ, 4)}\\ \\text{kg/s}=${n((a.chainQ * 3600) / 1000, 4)}\\ \\text{t/h}`, beyond: true })
  } else if (p.kind === 'screw') {
    steps.push({ label: 'Volume per revolution', tex: 'V_r=\\dfrac{\\pi(D^2-d^2)p}{4}', sub: `=\\dfrac{\\pi(${n(p.D, 3)}^2-${n(p.d, 3)}^2)(${n(a.pitch, 3)})}{4}`, result: `=${n(a.volRev, 4)}\\ \\text{m}^3`, cite: H('Theoretical capacity') })
    steps.push({ label: 'Theoretical and actual capacity', tex: 'Q=V_r\\,n\\times 60,\\quad Q_{act}=(0.3\\text{–}0.5)Q', sub: `=${n(a.volRev, 4)}(${p.n})(60)=${n(a.screwTheory, 4)}\\ \\text{m}^3/\\text{h}`, result: `Q_{act}=${n(a.screwActual, 4)}\\ \\text{m}^3/\\text{h}`, cite: H('Theoretical capacity') })
    steps.push({ label: 'Power (ρ bulk density, n in rev/s, × g for watts)', tex: 'P=\\dfrac{\\pi(D^2-d^2)}{4}\\,p\\,\\rho\\,n\\,L\\,F', sub: `=${n(a.volRev, 4)}(${p.rho})(${n(p.n / 60, 4)})(9.81)(${p.screwL})(${p.F})`, result: `=${n(a.screwP.P, 4)}\\ \\text{W}\\times${p.sf}=${n(a.screwP.total / 1000, 4)}\\ \\text{kW}`, cite: H('Power requirement') })
  } else if (p.kind === 'bucket') {
    steps.push({ label: 'Power', tex: 'P=QgH\\,(1+0.10\\text{–}0.15)', sub: `=${n(a.bucketQ, 4)}(9.81)(${p.bucketH})(1+${p.allowance})`, result: `=${n(a.bucketP.total / 1000, 4)}\\ \\text{kW}`, cite: H('Bucket elevators') })
    steps.push({ label: 'Discharge over the head: centrifugal vs gravity', tex: 'K=\\dfrac{v^2}{gR}\\ (>1:\\ \\text{thrown};\\ <1:\\ \\text{falls at }\\cos\\theta=K)', sub: `=\\dfrac{${n(p.bucketV, 3)}^2}{9.81(${n(p.headR, 3)})}`, result: `=${n(a.headK, 3)}`, beyond: true })
  } else {
    steps.push({ label: 'Pipe area and diameter', tex: 'A=Q/V,\\ D=\\sqrt{4A/\\pi}', sub: `A=${n(p.airQ, 3)}/${n(p.airV, 4)}=${n(a.pn.A, 4)}\\ \\text{m}^2`, result: `D=${n(a.pn.D * 1000, 4)}\\ \\text{mm}`, cite: H('Pneumatic Systems Design') })
    steps.push({ label: 'Fan power', tex: 'P=\\dfrac{QH}{E}', sub: `=\\dfrac{${n(p.airQ, 3)}(${n(p.staticCm * 98.1, 4)})}{${p.E}}`, result: `=${n(a.pn.P / 1000, 4)}\\ \\text{kW}`, cite: H('Pneumatic Systems Design') })
  }
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function ConveyorsPanel() {
  const [preset, setPreset] = useState<string | null>('grain-belt')
  const [exam, setExam] = useState<string | null>(null)
  return (
    <div>
      <Live />
      <Controls />
      <Section title="Typical duties">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Selector />
      <Section title="Exam questions">
        <PresetGrid presets={EXAM} active={exam} onPick={setExam} />
      </Section>
      <Charts />
      <CalcWorking />
    </div>
  )
}
