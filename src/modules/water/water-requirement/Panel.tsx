import { useMemo, useState } from 'react'
import { NumberField, PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { augerStorage, blaneyCriddle, christiansen, depthWithLeaching, storedFromMoisture } from '@/physics/water'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, EXAM_EVENT, ILE_IFE, derive, live, useReq } from './model'

const pct = (v: number) => fmt(v * 100, 3)

function LivePanel() {
  const st = useReq()
  const d = useMemo(() => derive(st), [st])
  const v = useLive(() => ({ ...live }), 10, (a, b) => a.day === b.day)
  return (
    <Section title="Live" right={<Badge tone={v.irrigating ? 'accent' : v.avail < 1 - st.depletion + 0.05 ? 'warn' : 'mute'}>{v.irrigating ? 'irrigating' : `day ${fmt(v.day, 3)}`}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="ET" value={fmt(d.etDay, 3)} unit="mm/day" tone="accent" />
        <Readout label="Available water" value={fmt(v.avail * 100, 3)} unit="%" tone="info" />
        <Readout label="Interval" value={fmt(d.interval, 3)} unit="days" />
        <Readout label="E_c" value={pct(d.ev.Ec)} unit="%" />
        <Readout label="E_a" value={pct(d.ev.Ea)} unit="%" />
        <Readout label="E_s" value={pct(d.ev.Es)} unit="%" />
      </div>
    </Section>
  )
}

function EtSection() {
  const st = useReq()
  const d = useMemo(() => derive(st), [st])
  return (
    <Section title="Consumptive use (ET)">
      <Segmented
        value={st.etMethod}
        onChange={(etMethod) => st.set({ etMethod })}
        size="sm"
        options={[
          { value: 'bc', label: 'Blaney–Criddle' },
          { value: 'jh', label: 'Jensen–Haise' },
        ]}
      />
      <Slider label="Mean temperature T" value={st.T} min={5} max={40} step={0.1} unit="°C" onChange={(T) => st.set({ T })} />
      {st.etMethod === 'bc' ? (
        <>
          <Slider label="Daytime hours p (monthly %)" value={st.p} min={6} max={11} step={0.05} unit="%" onChange={(p) => st.set({ p })} />
          <Slider label="Crop coefficient K_cs" value={st.kc} min={0.4} max={1.3} step={0.01} onChange={(kc) => st.set({ kc })} />
          <Toggle label="Adjusted form (× (1.49 − 0.01 RH))" checked={st.adjusted} onChange={(adjusted) => st.set({ adjusted })} />
          {st.adjusted ? <Slider label="Relative humidity" value={st.RH} min={20} max={100} step={1} unit="%" onChange={(RH) => st.set({ RH })} /> : null}
          <div className="grid grid-cols-3 gap-1.5">
            <Readout label="K_t" value={fmt(d.bc.Kt, 3)} />
            <Readout label="f" value={fmt(d.bc.f, 4)} unit="mm" />
            <Readout label="ET" value={fmt(d.bc.ET, 4)} unit="mm/month" tone="accent" />
          </div>
        </>
      ) : (
        <>
          <Slider label="Solar radiation R_s" value={st.Rs} min={200} max={800} step={1} unit="Ly/day" onChange={(Rs) => st.set({ Rs })} />
          <Slider label="Mean max, warmest month" value={st.Tmax} min={15} max={45} step={0.1} unit="°C" onChange={(Tmax) => st.set({ Tmax })} />
          <Slider label="Mean min, warmest month" value={st.Tmin} min={0} max={30} step={0.1} unit="°C" onChange={(Tmin) => st.set({ Tmin })} />
          <Slider label="Elevation E" value={st.E} min={0} max={2500} step={10} unit="m" onChange={(E) => st.set({ E })} />
          <div className="grid grid-cols-3 gap-1.5">
            <Readout label="C_T" value={fmt(d.jh.CT, 3)} />
            <Readout label="T_x" value={fmt(d.jh.Tx, 3)} unit="°C" />
            <Readout label="ET" value={fmt(d.jh.ETmm, 3)} unit="mm/day" tone="accent" />
          </div>
        </>
      )}
      <Slider label="Bucket clock" value={st.speed} min={0.25} max={8} step={0.25} unit="days/s" onChange={(speed) => st.set({ speed })} />
    </Section>
  )
}

function LeachSection() {
  const st = useReq()
  const LR = st.ECi / st.ECd
  return (
    <Section title="Leaching requirement">
      <Slider label="EC of irrigation water EC_i" value={st.ECi} min={0.1} max={5} step={0.05} unit="dS/m" onChange={(ECi) => st.set({ ECi })} />
      <Slider label="Allowed EC of drainage water EC_d" value={st.ECd} min={1} max={20} step={0.1} unit="dS/m" onChange={(ECd) => st.set({ ECd })} />
      <div className="grid grid-cols-2 gap-1.5">
        <Readout label="LR = EC_i/EC_d" value={pct(LR)} unit="%" tone="accent" />
        <Readout label="Apply per 100 mm used" value={fmt(depthWithLeaching(100, Math.min(0.95, LR)), 4)} unit="mm" />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-dim">Assumes adequate drainage, no leaching by rain and no salt taken up by the crop. White grains in the soil are salts flushed downward by the leaching water.</p>
    </Section>
  )
}

function EventSection() {
  const st = useReq()
  const d = useMemo(() => derive(st), [st])
  const ev = d.ev
  return (
    <Section title="Irrigation event and the six efficiencies">
      <Slider label="Diverted at source" value={st.Qsource * 1000} min={20} max={400} step={1} unit="L/s" onChange={(v) => st.set({ Qsource: v / 1000 })} />
      <Slider label="Delivered to field" value={st.Qfield * 1000} min={10} max={400} step={1} unit="L/s" onChange={(v) => st.set({ Qfield: Math.min(v, st.Qsource * 1000) / 1000 })} />
      <Slider label="Irrigation time" value={st.hours} min={1} max={24} step={0.5} unit="h" onChange={(hours) => st.set({ hours })} />
      <Slider label="Field area" value={st.areaHa} min={0.5} max={10} step={0.1} unit="ha" onChange={(areaHa) => st.set({ areaHa })} />
      <Slider label="Runoff" value={st.Qrunoff * 1000} min={0} max={200} step={1} unit="L/s" onChange={(v) => st.set({ Qrunoff: v / 1000 })} />
      <Slider label="Runoff duration" value={st.runoffHours} min={0} max={24} step={0.5} unit="h" onChange={(runoffHours) => st.set({ runoffHours })} />
      <Slider label="Wetting depth at head" value={st.dHead} min={0.3} max={2.5} step={0.05} unit="m" onChange={(dHead) => st.set({ dHead })} />
      <Slider label="Wetting depth at tail" value={st.dTail} min={0.2} max={2.5} step={0.05} unit="m" onChange={(dTail) => st.set({ dTail })} />
      <Slider label="Root zone" value={st.root} min={0.4} max={2.4} step={0.05} unit="m" onChange={(root) => st.set({ root })} />
      <Slider label="Water-holding capacity" value={st.whc} min={5} max={30} step={0.5} unit="cm/m" onChange={(whc) => st.set({ whc })} />
      <Slider label="Depletion at irrigation" value={st.depletion * 100} min={20} max={80} step={5} unit="%" onChange={(v) => st.set({ depletion: v / 100 })} />
      <Slider label="Evaporation during application" value={st.evap * 100} min={0} max={20} step={1} unit="% of W_d" onChange={(v) => st.set({ evap: v / 100 })} hint="Only used for consumptive-use efficiency (illustrative split)." />
      <Table
        head={['Efficiency', 'Definition', 'Value']}
        rows={[
          ['Conveyance E_c', 'W_d / W_i', `${pct(ev.Ec)} %`],
          ['Application E_a', 'W_s / W_d', `${pct(ev.Ea)} %`],
          ['Storage E_s', 'W_s / W_n', `${pct(ev.Es)} %`],
          ['Distribution E_d', '1 − y/d', `${pct(ev.Ed)} %`],
          ['Water use E_u', 'W_u / W_d', `${pct(d.Eu)} %`],
          ['Consumptive use E_cu', 'W_cu / W_d(net)', `${pct(d.Ecu)} %`],
        ]}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Volumes: W_i {fmt(ev.Wi, 4)} m³, W_d {fmt(ev.Wd, 4)} m³, runoff {fmt(ev.runoff, 4)} m³, deep percolation {fmt(ev.deep, 4)} m³, W_s {fmt(ev.Ws, 4)} m³, W_n {fmt(ev.Wn, 4)} m³. W_u counts deep percolation up to the leaching need; E_cu takes W_cu as the refilled deficit and adds deep percolation and evaporation to the net depletion — an illustrative split.
      </p>
    </Section>
  )
}

function Presets() {
  const [active, setActive] = useState<string | null>(null)
  const set = useReq.getState().set
  const presets: Preset[] = [
    { id: 'eff60', label: 'Efficiency problem (60 %)', note: '175 L/s diverted, 105 L/s delivered, 2 ha, 8 h, runoff 50 L/s for 3 h, depth 1.8 → 1.2 m, root zone 1.8 m, WHC 20 cm/m, 60 % depletion. Expect E_c 60 %, E_a 82.1 %, E_s 57.5 %, E_d 90 %.', apply: () => set({ ...EXAM_EVENT }) },
    { id: 'eff50', label: 'Same at 50 % depletion', note: 'The 1995 problem set irrigates at 50 % depletion: W_n = 3600 m³ and E_s = 69 %.', apply: () => set({ ...EXAM_EVENT, depletion: 0.5 }) },
    { id: 'ipp3', label: 'Problem: 0.085 m³/s for 2 h', note: '612 m³ applied, runoff 0.042 m³/s for 1 h = 151 m³, depth 1.68 → 1.0 m over a 1.68 m root zone. Expect E_a 75.3 %, E_d 87.3 %.', apply: () => set({ Qsource: 0.085, Qfield: 0.085, hours: 2, areaHa: 1, Qrunoff: 0.042, runoffHours: 1, dHead: 1.68, dTail: 1.0, root: 1.68 }) },
    { id: 'et', label: 'ET at Ile-Ife, July', note: 'T 21.2 °C, p 8.75 %, K 1.06: K_t 0.899, f 156.5 → ET ≈ 149 mm/month (4.8 mm/day). Adjusted with RH 84 %: ≈ 97 mm/month (3.1 mm/day).', apply: () => set({ ...ILE_IFE, etMethod: 'bc' }) },
    { id: 'etAdj', label: 'Adjusted Blaney–Criddle', note: '× (1.49 − 0.01 × 84) = 0.65 → ≈ 97 mm/month.', apply: () => set({ ...ILE_IFE, etMethod: 'bc', adjusted: true }) },
    { id: 'jh', label: 'Jensen–Haise, same month', note: 'R_s 549 Ly/day, warmest-month mean max/min 30.8/15.6 °C, elevation 540 m.', apply: () => set({ ...ILE_IFE, etMethod: 'jh' }) },
  ]
  return (
    <Section title="Exam presets">
      <PresetGrid presets={presets} active={active} onPick={setActive} />
    </Section>
  )
}

function Charts() {
  const st = useReq()
  const d = useMemo(() => derive(st), [st])
  const et = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let T = 5; T <= 40; T += 0.5) {
      xs.push(T)
      ys.push(blaneyCriddle({ T, p: st.p, kc: st.kc, RH: st.adjusted ? st.RH : undefined }).ET)
    }
    return { xs, ys }
  }, [st.p, st.kc, st.adjusted, st.RH])
  const bucket = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    const trig: number[] = []
    let a = 1
    for (let day = 0; day <= 40; day += 0.25) {
      xs.push(day)
      ys.push(a * 100)
      trig.push((1 - st.depletion) * 100)
      a -= (d.etDay * 0.25) / d.taw
      if (a <= 1 - st.depletion) a = 1
    }
    return { xs, ys, trig }
  }, [d, st.depletion])
  return (
    <Section title="Charts">
      <Chart data={[et.xs, et.ys]} series={[{ label: 'Blaney–Criddle ET', color: '#5ab4ff', width: 2 }]} xLabel="Mean temperature (°C)" yLabel="ET (mm/month)" marker={() => [st.T, d.bc.ET]} height={150} />
      <div className="h-2" />
      <Chart
        data={[bucket.xs, bucket.ys, bucket.trig]}
        series={[
          { label: 'Available water', color: '#5ab4ff', width: 2 },
          { label: 'Irrigation trigger', color: '#e8d06a', width: 1.5, dash: [4, 3] },
        ]}
        xLabel="Days"
        yLabel="Available water (%)"
        marker={() => [live.day % 40, live.avail * 100]}
        height={150}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">ET drains the root-zone reservoir (total available water {fmt(d.taw, 4)} mm); it is refilled every {fmt(d.interval, 3)} days.</p>
    </Section>
  )
}

function AugerExam() {
  const [depths, setDepths] = useState([0.82, 0.98, 1.1, 1.22, 1.07, 0.9, 0.85, 1.1])
  const [root, setRoot] = useState(1.1)
  const c = christiansen(depths)
  const s = augerStorage(depths, root)
  const [ipp2, setIpp2] = useState({ applied: 76, w0: 18, w1: 24, rho: 1201, depth: 600 })
  const stored = storedFromMoisture(ipp2.w0 / 100, ipp2.w1 / 100, ipp2.rho, ipp2.depth)
  return (
    <Section title="Exam: auger depths and moisture change">
      <p className="mb-1 text-[11.5px] text-ink/85">Depths of penetration found by augering at equal intervals along the run (m):</p>
      <div className="grid grid-cols-4 gap-1">
        {depths.map((v, i) => (
          <input key={i} type="number" step={0.01} value={v} onChange={(e) => setDepths(depths.map((x, j) => (j === i ? Number(e.target.value) : x)))} className="w-full rounded border border-line-2 bg-panel-2 px-1 py-0.5 text-[12px] text-ink" />
        ))}
      </div>
      <NumberField label="Root-zone depth" value={root} step={0.05} unit="m" onChange={setRoot} />
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Mean x̄" value={fmt(c.mean, 4)} unit="m" />
        <Readout label="E_d" value={pct(c.Ed)} unit="%" tone="accent" />
        <Readout label="E_s" value={pct(s.Es)} unit="%" tone="accent" />
      </div>
      <p className="mt-1 text-[11px] text-dim">Expect x̄ = 1.005, Σ|dev| = 0.94, E_d = 88.3 %, stored mean 0.99 m → E_s = 90 %.</p>
      <div className="mt-2" />
      <NumberField label="Depth applied" value={ipp2.applied} step={1} unit="mm" onChange={(applied) => setIpp2({ ...ipp2, applied })} />
      <NumberField label="Moisture before" value={ipp2.w0} step={0.5} unit="% dry wt" onChange={(w0) => setIpp2({ ...ipp2, w0 })} />
      <NumberField label="Moisture after" value={ipp2.w1} step={0.5} unit="% dry wt" onChange={(w1) => setIpp2({ ...ipp2, w1 })} />
      <NumberField label="Dry density" value={ipp2.rho} step={10} unit="kg/m³" onChange={(rho) => setIpp2({ ...ipp2, rho })} />
      <NumberField label="Layer depth" value={ipp2.depth} step={50} unit="mm" onChange={(depth) => setIpp2({ ...ipp2, depth })} />
      <div className="grid grid-cols-2 gap-1.5">
        <Readout label="Stored" value={fmt(stored, 4)} unit="mm" />
        <Readout label="E_a" value={pct(stored / ipp2.applied)} unit="%" tone="accent" />
      </div>
      <p className="mt-1 text-[11px] text-dim">76 mm applied, 18 → 24 % over 0.6 m at 1201 kg/m³: 43.2 mm stored, E_a = 56.9 %.</p>
    </Section>
  )
}

function WorkingSection() {
  const st = useReq()
  const d = useMemo(() => derive(st), [st])
  const ev = d.ev
  const steps: WorkingStep[] = [
    st.etMethod === 'bc'
      ? {
          label: 'Blaney–Criddle (SCS)',
          tex: `ET = K_{cs}K_t\\,p(0.46T + 8.13)${st.adjusted ? '\\,(1.49 - 0.01RH)' : ''},\\quad K_t = 0.0311T + 0.24`,
          sub: `= ${n(st.kc, 3)}\\times${n(d.bc.Kt, 3)}\\times${n(st.p, 3)}(0.46\\times${n(st.T, 3)} + 8.13)${st.adjusted ? `\\times${n(d.bc.adj, 3)}` : ''}`,
          result: `= ${n(d.bc.ET, 4)}\\ \\text{mm/month} \\approx ${n(d.etDay, 3)}\\ \\text{mm/day}`,
          cite: C.ipp('p1–2; p12 Problem 1'),
        }
      : {
          label: 'Jensen–Haise',
          tex: 'ET = C_T(T - T_x)R_s,\\ C_T = \\dfrac{1}{C_1 + 7.6C_H},\\ C_H = \\dfrac{50}{e_2 - e_1},\\ C_1 = 38 - \\dfrac{2E}{305},\\ T_x = -2.5 - 0.14(e_2 - e_1) - \\dfrac{E}{550}',
          sub: `e_2 = ${n(d.jh.e2, 3)},\\ e_1 = ${n(d.jh.e1, 3)}\\ \\text{mb};\\ C_T = ${n(d.jh.CT, 3)},\\ T_x = ${n(d.jh.Tx, 3)};\\ ${n(d.jh.CT, 3)}(${n(st.T, 3)} + ${n(-d.jh.Tx, 3)})\\times${n(st.Rs, 3)}`,
          result: `= ${n(d.jh.ETly, 4)}\\ \\text{Ly/day} \\times \\dfrac{10}{${n(d.jh.L, 4)}} = ${n(d.jh.ETmm, 3)}\\ \\text{mm/day}`,
          cite: C.ipp('p2 Jensen–Haise and unit conversion'),
        },
    { label: 'Conveyance efficiency', tex: 'E_c = \\dfrac{W_d}{W_i}', sub: `= \\dfrac{${n(st.Qfield, 3)}}{${n(st.Qsource, 3)}}`, result: `= ${pct(ev.Ec)}\\,\\%`, cite: C.ipp('p3') },
    { label: 'Application efficiency', tex: 'W_d = Qt,\\ W_s = W_d - \\text{runoff} - \\text{deep percolation},\\ E_a = \\dfrac{W_s}{W_d}', sub: `W_d = ${n(st.Qfield, 3)}\\times${n(st.hours * 3600, 5)} = ${n(ev.Wd, 5)};\\ W_s = ${n(ev.Wd, 5)} - ${n(ev.runoff, 4)} - ${n(ev.deep, 4)}`, result: `= ${n(ev.Ws, 5)}\\ \\text{m}^3,\\ E_a = ${pct(ev.Ea)}\\,\\%`, cite: C.s1('Q3c') },
    { label: 'Storage efficiency', tex: 'W_n = \\text{WHC}\\times D_{root}\\times\\text{depletion}\\times A,\\ E_s = \\dfrac{W_s}{W_n}', sub: `= ${n(st.whc / 100, 3)}\\times${n(st.root, 3)}\\times${n(st.depletion, 3)}\\times${n(st.areaHa * 1e4, 5)} = ${n(ev.Wn, 5)}`, result: `E_s = ${pct(ev.Es)}\\,\\%`, cite: C.ipp('p4 E_s; p12 #5') },
    { label: 'Distribution efficiency (linear profile)', tex: 'E_d = 1 - \\dfrac{y}{d},\\ y = \\dfrac{\\text{range}}{4},\\ d = \\bar{x}', sub: `y = \\dfrac{${n(Math.abs(st.dHead - st.dTail), 3)}}{4} = ${n(ev.dist.y, 3)},\\ \\bar{x} = ${n(ev.dist.mean, 3)}`, result: `E_d = ${pct(ev.Ed)}\\,\\%`, cite: C.ipp('p4 Christiansen') },
    { label: 'Leaching requirement', tex: 'LR = \\dfrac{D_d}{D_i} = \\dfrac{EC_i}{EC_d}', sub: `= \\dfrac{${n(st.ECi, 3)}}{${n(st.ECd, 3)}}`, result: `= ${pct(d.LR)}\\,\\%`, cite: C.ipp('p3') },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function Panel() {
  return (
    <div>
      <LivePanel />
      <EtSection />
      <EventSection />
      <LeachSection />
      <Presets />
      <Charts />
      <WorkingSection />
      <AugerExam />
    </div>
  )
}


