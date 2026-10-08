import { useMemo, useState } from 'react'
import { regressionTraction } from '@/physics/traction'
import {
  BAL_SPLIT,
  LB_KG,
  LIQUID_BALLAST_CHART,
  SLIP_TABLE,
  WEIGHT_GUIDE,
  ballastLb,
  fillAtValveClock,
  liquidHeadPsiPerFt,
  slipFromRevs,
  slipVerdict,
  type Implement,
  type SoilSurface,
} from '@/physics/tyres'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DEFAULTS, HOT_RISE_PSI, L27, MIXES, REAR_FIELD_PSI, SIZES, TT, TTS, derive, live, ntrForSlip, resetTest, useBallast, type BallastParams, type Mix } from './model'

const VERDICT_TONE = { 'remove ballast': 'info', 'proper ballast': 'accent', 'add ballast': 'warn' } as const

const INFLATION_TEXT = {
  under: 'Under-inflated: the sidewalls flex and the tread wears on its sides; the tyre builds up heat and the bead can slip on the rim and tear off the valve.',
  correct: 'Proper inflation: the full tread width carries the load evenly.',
  over: 'Over-inflated: only the centre of the tread touches, so it wears there; the tyre rides hard and an impact can break the cords (X-break). On hard roads, though, run at the maximum pressure to cut tread-bar wiping.',
} as const

function Inflation({ set }: { set: (p: Partial<BallastParams>) => void }) {
  const st = useBallast()
  const d = derive(st)
  const tone = d.inflation === 'correct' ? 'accent' : 'warn'
  return (
    <Section title="Inflation">
      <Slider label="Cold pressure, rear tyres" value={st.psi} min={6} max={30} step={0.5} unit="psi" onChange={(psi) => set({ psi })} hint={`field guide ${fmt(REAR_FIELD_PSI, 3)} psi (0.8 bar)`} />
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="State" value={d.inflation} tone={tone} />
        <Readout label="Hot reading" value={`${fmt(st.psi + HOT_RISE_PSI[0], 3)}–${fmt(st.psi + HOT_RISE_PSI[1], 3)}`} unit="psi — do not bleed" />
        <Readout label="Liquid head at valve" value={fmt(d.headPsi, 2)} unit={`psi (${fmt(d.headFt, 2)} ft)`} tone="info" />
        <Readout label="Contact area" value={fmt(d.patch.area * 1e4, 3)} unit="cm² per tyre" />
        <Readout label="Patch length" value={fmt(d.patch.length * 1000, 3)} unit="mm" />
        <Readout label="Deflection" value={fmt(d.patch.deflection * 1000, 3)} unit="mm" />
      </div>
      <p className={`mt-1.5 text-[11.5px] leading-snug ${tone === 'warn' ? 'text-warn' : 'text-mute'}`}>{INFLATION_TEXT[d.inflation]}</p>
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Check the pressure cold, every 50 h. With liquid ballast use a liquid-type gauge with the valve at the bottom; the liquid above the valve adds about ½ psi per foot of height. Ground pressure is roughly the inflation pressure, so the patch area is the wheel load ÷ pressure; the ±20 % band for under/over and the patch shape are assumed.
      </p>
    </Section>
  )
}

function SlipTest() {
  const v = useLive(() => ({ revs: live.revs, dist: live.dist, circ: live.circ, slip: live.slip }), 15, (a, b) => a.revs === b.revs && a.slip === b.slip && a.circ === b.circ)
  const r1 = v.dist / v.circ
  const done = v.revs >= 10 - 1e-6
  const slip = done ? slipFromRevs(r1, 10) : v.slip
  const W = 300
  const scale = (W - 20) / (10 * v.circ)
  return (
    <Section title="Chalk-mark slip test" right={<button className="text-[11px] text-info hover:underline" onClick={resetTest}>restart</button>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Loaded revs R₂" value={fmt(v.revs, 3)} unit="/ 10" />
        <Readout label="No-load revs R₁" value={fmt(r1, 3)} unit="same distance" tone="info" />
        <Readout label="Slip" value={fmt(slip * 100, 3)} unit="%" tone={VERDICT_TONE[slipVerdict(slip)]} />
      </div>
      <svg viewBox={`0 0 ${W} 54`} className="mt-2 w-full" role="img" aria-label="Chalk marks on the ground: loaded revolutions against the no-slip distance">
        <line x1={10} y1={18} x2={W - 10} y2={18} stroke="#34433b" />
        <line x1={10} y1={40} x2={W - 10} y2={40} stroke="#34433b" />
        {Array.from({ length: 11 }, (_, k) => (
          <g key={k}>
            <line x1={10 + k * v.circ * scale} y1={12} x2={10 + k * v.circ * scale} y2={24} stroke="#93a59a" strokeWidth={1} />
            {k <= Math.floor(v.revs + 1e-9) ? <line x1={10 + k * v.circ * (1 - v.slip) * scale} y1={34} x2={10 + k * v.circ * (1 - v.slip) * scale} y2={46} stroke="#f2d13a" strokeWidth={2} /> : null}
          </g>
        ))}
        <text x={W - 10} y={9} fontSize={8} textAnchor="end" fill="#93a59a">no slip: 10 revs = {fmt(10 * v.circ, 3)} m</text>
        <text x={W - 10} y={53} fontSize={8} textAnchor="end" fill="#f2d13a">loaded: {fmt(v.dist, 3)} m</text>
      </svg>
      <p className="mt-1 text-[11.5px] leading-snug text-mute">
        {done ? `${fmt(r1, 3)} no-load revolutions cover the distance of 10 loaded ones: ${slipVerdict(slip)}.` : 'Mark the ground where the chalk mark comes down, count ten revolutions under load and mark again; then back the tractor over the same distance without load and count again.'} % slip = (R₂ − R₁)/R₂.
      </p>
      <table className="mt-1.5 w-full text-center text-[11px]">
        <thead className="text-dim">
          <tr>
            <th className="font-normal">R₁ revs</th>
            {SLIP_TABLE.map(([r]) => (
              <th key={r} className="font-normal">{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="text-mute">
            <td className="text-dim">% slip</td>
            {SLIP_TABLE.map(([r, pct]) => {
              const on = Math.abs(slip * 100 - pct) < 2.5
              return (
                <td key={r} className={on ? 'rounded bg-accent/20 text-ink' : pct < 10 ? 'text-info' : pct > 15 ? 'text-warn' : 'text-accent'}>
                  {pct}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[10.5px] text-dim">Blue: remove ballast · green: proper (10–15 %) · orange: add ballast.</p>
    </Section>
  )
}

function Charts() {
  const st = useBallast()
  const d = derive(st)
  const te = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let s = 0.01; s <= 0.4001; s += 0.005) {
      xs.push(s * 100)
      ys.push(regressionTraction(s).TE * 100)
    }
    return { xs, ys }
  }, [])
  const guide = useMemo(() => {
    const g = WEIGHT_GUIDE[st.implement]
    const xs: number[] = []
    for (let v = 2; v <= 7.0001; v += 0.1) xs.push(v)
    const at = (c: [number, number][], v: number) => {
      let i = 0
      while (i < c.length - 2 && v > c[i + 1][0]) i++
      const [x0, y0] = c[i]
      const [x1, y1] = c[i + 1]
      return y0 + ((y1 - y0) * (v - x0)) / (x1 - x0)
    }
    return { xs, low: xs.map((v) => at(g.low, v)), mid: xs.map((v) => at(g.mid, v)), high: xs.map((v) => at(g.high, v)), fig: g.fig }
  }, [st.implement])
  return (
    <>
      <Section title="Tractive efficiency vs slip">
        <Chart data={[te.xs, te.ys]} series={[{ label: 'TE', color: '#9bd17a', width: 2 }]} xLabel="Wheel slip (%)" yLabel="Tractive efficiency (%)" height={150} marker={() => [Math.min(40, d.slip * 100), regressionTraction(Math.min(0.4, d.slip)).TE * 100]} />
        <p className="mt-1 text-[11px] leading-snug text-dim">Zoz & Grisso’s regression: efficiency peaks near 10 % slip; drawbar horsepower falls off quickly below 10 % and gradually above 15 % slip.</p>
      </Section>
      <Section title="Tractor weight guide">
        <Chart
          data={[guide.xs, guide.low, guide.mid, guide.high]}
          series={[
            { label: 'firm low', color: '#6fb3e0', width: 1.5 },
            { label: 'firm/tilled', color: '#9bd17a', width: 1.5 },
            { label: 'tilled high', color: '#e8a24f', width: 1.5 },
          ]}
          xLabel="Advertised travel speed (mph)"
          yLabel="lb rear weight / PTO hp"
          height={160}
          marker={() => [st.mph, d.rearLb / st.ptoHp]}
        />
        <p className="mt-1 text-[11px] leading-snug text-dim">Firm soil lies between the blue and green curves, tilled soil between green and orange; the band gives ≈15 % slip. The dot is this tractor: {fmt(d.rearLb / st.ptoHp, 3)} lb/hp. Curves digitised from standard weight-guide charts.</p>
      </Section>
    </>
  )
}

function BallastWorking() {
  const st = useBallast()
  const d = derive(st)
  const chart = LIQUID_BALLAST_CHART.find((r) => r.size === st.size)
  const steps: WorkingStep[] = [
    {
      label: 'Wheel slip from the chalk-mark test',
      tex: '\\%\\,\\text{slip} = \\frac{R_2 - R_1}{R_2}',
      sub: `= \\frac{10 - ${n(10 * (1 - d.slip), 3)}}{10}`,
      result: `= ${n(d.slip * 100, 3)}\\,\\%\\;(${d.verdict})`,
      cite: TT('p10'),
    },
    {
      label: 'Liquid ballast in one tyre',
      tex: 'm = V_w(1 + c),\\quad V_w = f\\,V_{cavity}',
      sub: `V_w = ${n(st.fill, 3)}\\times${n(d.liquid.cavityL, 4)}\\,\\text{L},\\; c = ${n(MIXES[st.mix].cacl2, 3)}\\,\\text{kg CaCl}_2/\\text{L}`,
      result: `m = ${n(d.liquid.massKg, 4)}\\,\\text{kg}\\;(${n(d.liquid.gal, 3)}\\,\\text{US gal})`,
      cite: TTS('p15'),
    },
    {
      label: 'Chart check (both tyres, 75 %)',
      tex: '\\text{lb} = \\text{gal}\\times(8.34 + 3.5)',
      sub: chart ? `= ${chart.gal}\\times11.84` : '\\text{(size not in the chart)}',
      result: chart ? `= ${n(ballastLb(chart.gal), 4)}\\,\\text{lb}\\;(\\text{chart } ${chart.lb})` : '',
      cite: TT('p13'),
    },
    {
      label: 'Rear axle weight',
      tex: 'W_r = W_{base} + 2m_{liquid} + 2n(40\\,\\text{kg})',
      sub: `= ${st.baseRear} + 2(${n(d.liquid.massKg, 4)}) + ${d.castKg}`,
      result: `= ${n(d.rearKg, 4)}\\,\\text{kg} = ${n(d.rearLb, 4)}\\,\\text{lb}`,
      cite: TTS('p15'),
    },
    {
      label: 'Weight guide',
      tex: 'W_r = \\text{PTO hp}\\times\\text{lb/hp}',
      sub: `= ${st.ptoHp}\\times(${n(d.guide.lo, 3)}\\text{ to }${n(d.guide.hi, 3)})`,
      result: `= ${n(d.rangeLb.lo, 4)}\\text{ to }${n(d.rangeLb.hi, 4)}\\,\\text{lb}`,
      cite: TT('p11 — 120 × 84 = 10,100; 120 × 100 = 12,000'),
      errata: st.ptoHp === 90 ? 'The notes print 90 × 84 = 7,550 lb; it is 7,560 lb.' : undefined,
    },
    {
      label: 'Front ballast (2WD, stability)',
      tex: `W_f = ${st.implement === 'towed' ? '\\tfrac13' : '\\tfrac12'}\\,W_r`,
      sub: `= ${st.implement === 'towed' ? '\\tfrac13' : '\\tfrac12'}\\times${n(d.rearKg, 4)}`,
      result: `= ${n(d.frontNeedKg, 4)}\\,\\text{kg}\\;\\Rightarrow\\;\\text{add }${n(d.frontAddKg, 3)}\\,\\text{kg}`,
      cite: TT('p10'),
    },
    {
      label: 'Slip needed for the pull (net traction ratio)',
      tex: '\\text{NTR} = \\frac{P}{W_r} = 0.664\\left(1 - e^{-0.098\\,s\\%}\\right)',
      sub: `\\text{NTR} = \\frac{${n(st.pull, 3)}\\,\\text{kN}}{${n((d.rearKg * 9.81) / 1000, 4)}\\,\\text{kN}} = ${n(d.ntr, 3)}`,
      result: `s = -\\frac{\\ln(1 - \\text{NTR}/0.664)}{0.098} = ${n(d.slip * 100, 3)}\\,\\%`,
      cite: L27('p18, Fig 17 (worked regression)'),
    },
    {
      label: 'Gauge correction with the valve at the top',
      tex: '\\Delta p = \\rho g h',
      sub: `\\rho = ${n(1000 * (1 + MIXES[st.mix].cacl2), 4)}\\,\\text{kg/m}^3`,
      result: `= ${n(liquidHeadPsiPerFt(1 + MIXES[st.mix].cacl2), 3)}\\,\\text{psi per ft}\\;(\\text{rule of thumb: “about ½ lb”})`,
      cite: TT('p7'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function BallastPanel() {
  const st = useBallast()
  const d = derive(st)
  const [preset, setPreset] = useState<string | null>(null)
  const forSlip = (s: number) => () => {
    const dd = derive(useBallast.getState())
    useBallast.getState().set({ pull: Math.round(((ntrForSlip(s) * dd.rearKg * 9.81) / 1000) * 100) / 100 })
    resetTest()
  }
  const presets: { id: string; label: string; note: string; apply: () => void }[] = [
    { id: 'p11', label: '120 hp, 5.3 mph', note: 'Semi-integral plough, firm soil, 4th gear 5.3 mph: 84–100 lb/hp → 10,100–12,000 lb rear weight (120 × 84 = 10,080).', apply: () => useBallast.getState().set({ ptoHp: 120, mph: 5.3, implement: 'semi-integral', soil: 'firm' }) },
    { id: 'p11q', label: '¾ load (90 hp)', note: '90 × 84 = 7,560 lb to 90 × 100 = 9,000 lb: ¾ load needs ¾ of the rear weight.', apply: () => useBallast.getState().set({ ptoHp: 90, mph: 5.3, implement: 'semi-integral', soil: 'firm' }) },
    { id: 's9', label: 'Slip test: 9 revs', note: '9 no-load revolutions for 10 loaded → 10 % slip: proper ballast.', apply: forSlip(0.1) },
    { id: 's85', label: 'Slip test: 8½ revs', note: '8½ → 15 % slip: still proper, at the top of the band.', apply: forSlip(0.15) },
    { id: 's8', label: 'Slip test: 8 revs', note: 'Fewer than 8½ revolutions: weight should be added (20 % slip).', apply: forSlip(0.2) },
    { id: 's95', label: 'Slip test: 9½ revs', note: 'More than 9 revolutions: remove weight (5 % slip — tyres "geared to the ground").', apply: forSlip(0.05) },
    { id: 'c184', label: '18.4-38 chart', note: '18.4-38 (8-ply) carries 11,940 lb (two tyres) and takes 188 gal = 2,226 lb at 75 %.', apply: () => useBallast.getState().set({ size: '18.4-38', fill: 0.75, mix: 'tt' }) },
    { id: 'c245', label: '24.5-32 chart', note: '24.5-32 carries 17,800 lb and takes 292 gal = 3,458 lb at 75 %.', apply: () => useBallast.getState().set({ size: '24.5-32', fill: 0.75, mix: 'tt' }) },
    { id: 'under', label: 'Under-inflated, 7 psi', note: 'Sidewalls flex, the tread wears on its sides and the tyre heats up. The contact patch grows.', apply: () => useBallast.getState().set({ psi: 7 }) },
    { id: 'over', label: 'Over-inflated, 24 psi', note: 'Only the tread centre touches: centre wear and a hard ride; impact breaks become likely.', apply: () => useBallast.getState().set({ psi: 24 }) },
    { id: 'bell', label: '13.6/12-36 · 1 kg/5 L', note: '75 % water ballast in a 13.6/12-36 ≈ 190 kg (420 lb), 1 kg chemical per 5 L.', apply: () => useBallast.getState().set({ size: '13.6/12-36', fill: 0.75, mix: 'bell' }) },
  ]
  const set = (p: Partial<BallastParams>) => {
    setPreset(null)
    st.set(p)
  }
  const inRange = d.rearLb >= d.rangeLb.lo && d.rearLb <= d.rangeLb.hi
  return (
    <div>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Rear axle" value={fmt(d.rearKg, 4)} unit={`kg · ${fmt(d.rearLb, 3)} lb`} tone="accent" />
          <Readout label="Guide" value={`${fmt(d.rangeLb.lo / 1000, 3)}–${fmt(d.rangeLb.hi / 1000, 3)}`} unit="×1000 lb" tone={inRange ? 'accent' : 'warn'} />
          <Readout label="Slip" value={fmt(d.slip * 100, 3)} unit="%" tone={VERDICT_TONE[d.verdict]} />
          <Readout label="Liquid / tyre" value={fmt(d.liquid.massKg, 3)} unit="kg" tone="info" />
          <Readout label="Cast iron" value={d.castKg} unit="kg (axle)" />
          <Readout label="Front to add" value={fmt(d.frontAddKg, 3)} unit="kg" />
        </div>
        <p className="mt-1.5 text-[11.5px] leading-snug text-mute">
          {d.verdict === 'add ballast' ? 'Too little weight: the tyres spin and the tread marks are wiped out.' : d.verdict === 'remove ballast' ? 'Too much weight: sharp marks, no slip — the tyres are “geared to the ground”, soil is compacted and rolling resistance rises.' : 'Proper weight: 10–15 % slip; the soil between the cleats is shifted but the pattern shows.'}
        </p>
      </Section>
      <SlipTest />
      <Section title="Liquid ballast">
        <Segmented<(typeof SIZES)[number]> label="Drive tyre" value={st.size} onChange={(size) => set({ size })} options={SIZES.map((s) => ({ value: s, label: s }))} size="sm" />
        <Slider label="Fill" value={st.fill * 100} min={0} max={100} step={1} unit="%" onChange={(v) => set({ fill: v / 100 })} hint="75 % = water up to the valve with the valve at the top" />
        <div className="-mt-1 mb-2 flex flex-wrap gap-1">
          {[
            ['Valve at 12 o’clock', () => set({ fill: fillAtValveClock(d.size, 12) })],
            ['Valve at 10 o’clock', () => set({ fill: fillAtValveClock(d.size, 10) })],
            ['100 % (wrong)', () => set({ fill: 1 })],
          ].map(([label, fn]) => (
            <button key={label as string} onClick={fn as () => void} className="rounded border border-line-2 px-1.5 py-0.5 text-[11px] text-mute hover:text-ink">
              {label as string}
            </button>
          ))}
        </div>
        {st.fill > 0.8 ? <p className="-mt-1 mb-2 text-[11.5px] leading-snug text-warn">Over-filled: water cannot be compressed, so the tyre cannot absorb shocks and has little bruise resistance.</p> : null}
        <p className="-mt-1 mb-2 text-[11px] leading-snug text-dim">Draining a full tyre to its valve at 12 o’clock leaves {fmt(fillAtValveClock(d.size, 12) * 100, 2)} % — the usual “75 percent or valve level”. A valve at 10 o’clock gives only {fmt(fillAtValveClock(d.size, 10) * 100, 2)} % with this cavity model (≈75 % is often quoted).</p>
        <Segmented<Mix> label="Mixture" value={st.mix} onChange={(mix) => set({ mix })} options={(Object.keys(MIXES) as Mix[]).map((k) => ({ value: k, label: MIXES[k].label }))} size="sm" />
        <p className="-mt-1 mb-2 text-[11.5px] leading-snug text-mute">{MIXES[st.mix].text}</p>
        <Slider label="Cast-iron weights per wheel" value={st.weights} min={0} max={3} step={1} unit="× 40 kg" onChange={(weights) => set({ weights })} />
      </Section>
      <Inflation set={set} />
      <Section title="Tractor & work">
        <Slider label="Drawbar pull" value={st.pull} min={5} max={40} step={0.25} unit="kN" onChange={(pull) => set({ pull })} />
        <Slider label="Travel speed" value={st.mph} min={2} max={7} step={0.1} unit="mph" onChange={(mph) => set({ mph })} />
        <Slider label="PTO power" value={st.ptoHp} min={30} max={200} step={1} unit="hp" onChange={(ptoHp) => set({ ptoHp })} />
        <Slider label="Unballasted rear axle" value={st.baseRear} min={1000} max={8000} step={50} unit="kg" onChange={(baseRear) => set({ baseRear })} />
        <Slider label="Unballasted front axle" value={st.baseFront} min={500} max={4000} step={50} unit="kg" onChange={(baseFront) => set({ baseFront })} />
        <Segmented<Implement> label="Implement" value={st.implement} onChange={(implement) => set({ implement })} options={[{ value: 'integral', label: 'Integral' }, { value: 'semi-integral', label: 'Semi-integral' }, { value: 'towed', label: 'Towed' }]} size="sm" />
        <Segmented<SoilSurface> label="Soil surface" value={st.soil} onChange={(soil) => set({ soil })} options={[{ value: 'firm', label: 'Firm' }, { value: 'tilled', label: 'Tilled / loose' }]} size="sm" />
        <p className="text-[11px] leading-snug text-dim">More weight is needed on loose soil, for towed implements, at low speed and at high power; ¾ load needs ¾ the rear weight. Limit ballast to the tyre and tractor capacity — use larger tyres or duals beyond it.</p>
      </Section>
      <Section title="Exam presets">
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map((p) => (
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
        {preset ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{presets.find((p) => p.id === preset)?.note}</p> : null}
      </Section>
      <Charts />
      <Section title="Weight split">
        <table className="w-full text-[11.5px] text-mute">
          <thead className="text-dim">
            <tr>
              <th className="text-left font-normal">Tractor</th>
              <th className="font-normal">Light load F/R</th>
              <th className="font-normal">Heavy load F/R</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(BAL_SPLIT) as (keyof typeof BAL_SPLIT)[]).map((k) => (
              <tr key={k} className="border-t border-line text-center">
                <td className="text-left text-ink/85">{k}</td>
                <td>{BAL_SPLIT[k].light.join(' / ')} %</td>
                <td>{BAL_SPLIT[k].heavy.join(' / ')} %</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[11px] leading-snug text-dim">Generally 40 % front / 60 % rear is recommended. This tractor: {fmt((100 * (st.baseFront + d.frontAddKg)) / (st.baseFront + d.frontAddKg + d.rearKg), 3)} % front after front ballast at {st.implement === 'towed' ? '⅓' : '½'} of the rear weight.</p>
      </Section>
      <Section title="Liquid ballast chart">
        <table className="w-full text-[11px] text-mute">
          <thead className="text-dim">
            <tr>
              <th className="text-left font-normal">Size</th>
              <th className="font-normal">Ply</th>
              <th className="font-normal">Capacity lb (2)</th>
              <th className="font-normal">gal</th>
              <th className="font-normal">lb liquid</th>
            </tr>
          </thead>
          <tbody>
            {LIQUID_BALLAST_CHART.map((r) => (
              <tr key={r.size + r.ply} className={`border-t border-line text-center ${r.size === st.size ? 'text-ink' : ''}`}>
                <td className="text-left">{r.size}</td>
                <td>{r.ply}</td>
                <td>{r.capacityLb.toLocaleString('en-GB')}</td>
                <td>{r.gal}</td>
                <td>{r.lb.toLocaleString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[11px] leading-snug text-dim">Water + 3½ lb CaCl₂/gal, filled to valve level. Capacity is for two tyres; the volumes also match two tyres (this model gives {fmt(2 * derive({ ...DEFAULTS, size: '18.4-38' }).liquid.gal, 3)} gal for a pair of 18.4-38s). {fmt(d.liquid.massKg / LB_KG, 3)} lb per {st.size} tyre now.</p>
      </Section>
      <BallastWorking />
    </div>
  )
}
