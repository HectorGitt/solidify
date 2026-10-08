import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { AXLE_PDE, BALLAST_NUMBERS, BRIXIUS, brixius, gtrFromWeight, peakTractiveEfficiency, speedForWeightPerPower, weightPerPower } from '@/physics/traction'
import { FARMLAND_GEARS, maxPower, operatingPoint, powerEnvelopeSpeed } from '@/physics/tractor'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, Points, PresetGrid, type Preset } from '../../chassis/common/bits'
import { D, DEFAULTS, ETA_R, REAR_TYRE, SOILS, solve, useLab, type Gear, type LabParams, type SlipMode, type Soil, type TyreKind, type View } from './model'

const C = {
  mech: (w: string) => SRC.mech502(w),
  l27: (w: string) => SRC.l27(w),
}
const kN = (v: number, d = 4) => n(v / 1000, d)
const apply = (p: Partial<LabParams>) => useLab.getState().set({ ...DEFAULTS, ...p })
const GEARS: Gear[] = ['3', '5', '7']
const PMAX = maxPower()

const PRESETS: Preset[] = [
  { id: 'ideal3', label: 'Gear 3, ideal', note: 'No slip, no rolling resistance, ηr = 1. At the 173 N·m torque peak the ideal pull is 2qTe/D = 38.31 kN at 2.21 km/h; with no load it runs at 4.07 km/h.', apply: () => apply({ ideal: true, gear: '3', pull: 38.3 }) },
  { id: 'ideal7', label: 'Gear 7, ideal', note: 'Gear 7 (q = 47.3) at no load runs 11.99 km/h. Ideal drawbar power equals engine power.', apply: () => apply({ ideal: true, gear: '7', pull: 0.5 }) },
  { id: 'eta', label: 'ηt check: P 10, R 1 kN, i 10 %', note: 'ηt = (P/(P + R))(1 − i) = (10/11)(0.9) = 0.818.', apply: () => apply({ slipMode: 'manual', pull: 10, rolling: 1, slip: 0.1 }) },
  { id: 'l27', label: 'Tilled soil: CI 860 kPa, radial', note: 'A tilled soil (860 kPa cone index) with the radial-tyre coefficients. Brixius predicts slip and motion resistance from the mobility number.', apply: () => apply({ soil: 'tilled', tyre: 'radial', pull: 12 }) },
  { id: 'spin', label: 'Too much pull: wheels spin', note: 'Ask for more net traction than the soil can give (NTR above the Brixius maximum) and the wheels spin: slip → 100 %, no useful work.', apply: () => apply({ soil: 'soft', pull: 14 }) },
  { id: 'ballast', label: 'Same pull, 600 kg ballast', note: 'Adding weight on the driving wheels lowers slip for the same pull but raises rolling resistance — compare ηt with the previous preset.', apply: () => apply({ soil: 'soft', pull: 14, ballast: 600 }) },
]

function LivePanel() {
  const st = useLab()
  const s = solve(st)
  const kmh = (v: number) => fmt(v * 3.6, 3)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="No-slip speed V₀" value={kmh(s.op.V0)} unit="km/h" />
        <Readout label="Actual speed V" value={s.stalled ? 'stalled' : kmh(s.op.V)} unit="km/h" tone={s.stalled ? 'warn' : 'accent'} />
        <Readout label="Slip i" value={s.spin ? 'spin' : fmt(s.i * 100, 3)} unit="%" tone={s.spin || s.i > 0.2 ? 'warn' : s.i >= 0.08 ? 'accent' : 'info'} />
        <Readout label="Pull P" value={fmt(s.P / 1000, 3)} unit="kN" />
        <Readout label="Rolling R" value={fmt(s.R / 1000, 3)} unit="kN" />
        <Readout label="H = P + R" value={fmt(s.op.H / 1000, 3)} unit="kN" />
        <Readout label="Engine" value={s.stalled ? '—' : fmt(s.op.rpm, 4)} unit={`rpm · ${fmt(s.op.Te, 3)} N·m`} />
        <Readout label="Drawbar power" value={fmt((s.P * s.op.V) / 1000, 3)} unit={`kW of ${fmt(s.op.Qe / 1000, 3)}`} />
        <Readout label="ηt / ηo" value={`${fmt(s.op.etaT * 100, 3)} / ${fmt(s.etaO * 100, 3)}`} unit="%" tone="accent" />
        <Readout label="Front Vf" value={fmt(s.Vf / 1000, 3)} unit="kN" tone={s.Vf <= 0 ? 'warn' : 'ink'} />
        <Readout label="Rear Vr" value={fmt(s.Vr / 1000, 3)} unit="kN" />
        <Readout label="ψ = P/Vr" value={fmt(s.P / s.Vr, 3)} />
      </div>
      {s.stalled ? <Note tone="warn">The engine cannot give the torque H·D/(2qηr): it stalls. Change down a gear or reduce the pull.</Note> : null}
      {s.spin ? <Note tone="warn">The net traction asked for, NTR = (P + Rf)/Vr = {fmt(s.NTR, 3)}, is above what the soil can give: the wheels spin.</Note> : null}
    </Section>
  )
}

function SpeedPull() {
  const st = useLab()
  const data = useMemo(() => {
    const xs: number[] = []
    const ys: (number | null)[][] = [[], [], [], [], [], [], []]
    for (let P = 0.25; P <= 40.001; P += 0.25) {
      xs.push(P)
      GEARS.forEach((g, k) => {
        const q = FARMLAND_GEARS[Number(g)]
        const id = operatingPoint(P * 1000, 0, 0, q, D, 1)
        ys[k].push(id.stalled ? null : id.V0 * 3.6)
        const s = solve({ ...st, gear: g, pull: P, ideal: false })
        ys[3 + k].push(s.stalled || s.spin ? null : s.op.V * 3.6)
      })
      ys[6].push(Math.min(25, powerEnvelopeSpeed(P, PMAX)))
    }
    return [xs, ...ys]
  }, [st])
  return (
    <Section title="Speed–pull chart">
      <Chart
        data={data}
        series={[
          { label: 'gear 3 ideal', color: '#9bd17a', width: 1, dash: [4, 3] },
          { label: 'gear 5 ideal', color: '#f5b942', width: 1, dash: [4, 3] },
          { label: 'gear 7 ideal', color: '#6fb3e0', width: 1, dash: [4, 3] },
          { label: 'gear 3', color: '#9bd17a', width: 2 },
          { label: 'gear 5', color: '#f5b942', width: 2 },
          { label: 'gear 7', color: '#6fb3e0', width: 2 },
          { label: `${fmt(PMAX, 3)} kW`, color: '#93a59a', width: 1 },
        ]}
        xLabel="Drawbar pull P (kN)"
        yLabel="Travel speed (km/h)"
        marker={() => {
          const s = solve(useLab.getState())
          return s.stalled ? null : [s.P / 1000, s.op.V * 3.6]
        }}
        height={190}
      />
      <Note>
        Dashed: the ideal analysis — speed set by engine speed and ratio, pull by engine torque and ratio; each gear ends where the governor cuts the torque. Solid: with slip and rolling resistance on {SOILS[st.soil].label.toLowerCase()} soil (Brixius), ending where the wheels spin. Grey: the constant-power hyperbola a stepless transmission would follow.
      </Note>
    </Section>
  )
}

function TractionCurves() {
  const st = useLab()
  const s = solve(st)
  const k = BRIXIUS[st.tyre]
  const data = useMemo(() => {
    const xs: number[] = []
    const te: number[] = []
    const trr: number[] = []
    const mrr: number[] = []
    for (let sl = 0.005; sl <= 0.5; sl += 0.005) {
      const r = brixius(s.BnR, sl, k)
      if (r.NTR < 0) continue
      xs.push(r.NTR)
      te.push(r.TE)
      trr.push(sl)
      mrr.push(r.MRR)
    }
    return [xs, te, trr, mrr]
  }, [s.BnR, k])
  const peak = peakTractiveEfficiency(s.BnR, k)
  return (
    <Section title="Traction curves vs NTR">
      <Chart
        data={data}
        series={[
          { label: 'TE', color: '#9bd17a', width: 2 },
          { label: 'TRR (slip)', color: '#e8794f', width: 2 },
          { label: 'MRR', color: '#c792ea', width: 1.5 },
        ]}
        xLabel="Net traction ratio NTR = NT/Wd"
        yLabel="Ratio"
        marker={() => {
          const p = useLab.getState()
          const v = solve(p)
          return v.spin || p.ideal || p.slipMode === 'manual' ? null : [v.NTR, v.br.TE]
        }}
        yRange={[0, 1]}
        height={170}
      />
      <Note>
        Rear-wheel mobility number Bn = {fmt(s.BnR, 3)}. Peak TE {fmt(peak.TE * 100, 3)} % at NTR {fmt(peak.NTR, 2)}, slip {fmt(peak.slip * 100, 2)} % — for tyres TE typically peaks near NTR 0.4, and MRR is typically 0.05–0.15.
      </Note>
    </Section>
  )
}

function Ballasting() {
  const st = useLab()
  const s = solve(st)
  const VtKmh = s.op.V0 * 3.6
  const axlekW = (s.op.Qe * s.etaR) / 1000
  const massKg = s.c.W / 9.81
  const need = weightPerPower(BALLAST_NUMBERS.axle, VtKmh)
  const gtr = gtrFromWeight(massKg, VtKmh, axlekW)
  return (
    <Section title="Ballast for the speed">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Axle power" value={fmt(axlekW, 3)} unit="kW" />
        <Readout label="Needed (GTR 0.54)" value={fmt(need, 3)} unit="kg per axle kW" tone="info" />
        <Readout label="This tractor" value={fmt(massKg / axlekW, 3)} unit="kg per axle kW" tone={Math.abs(massKg / axlekW - need) / need < 0.15 ? 'accent' : 'warn'} />
      </div>
      <Note>
        W·Vt/P = k/GTR with k = 383 (kg/kW, km/h): the ballast number 709 at the optimum GTR 0.54. At {fmt(VtKmh, 3)} km/h this tractor works at GTR ≈ {fmt(gtr, 2)}. Slower speeds need heavier tractors. Axle power ≈ 0.96 × PTO power ≈ 0.96 × 0.85 × flywheel power. 2WD axle power-delivery efficiency on concrete / good / medium / poor soil: {AXLE_PDE['2WD'].join(' / ')}.
      </Note>
    </Section>
  )
}

function LabWorking() {
  const st = useLab()
  const s = solve(st)
  const q = s.q
  const steps: WorkingStep[] = [
    {
      label: 'No-slip travel speed',
      tex: 'V_0 = \\dfrac{\\pi D N_e}{q}',
      sub: `= \\dfrac{\\pi(${D})(${n(s.op.rpm, 4)}/60)}{${q}}`,
      result: `= ${n(s.op.V0, 3)}\\ \\text{m/s} = ${n(s.op.V0 * 3.6, 3)}\\ \\text{km/h}`,
      cite: C.mech('p1, eq 2.1'),
    },
    {
      label: 'Weight transfer from the pull (level ground)',
      tex: "V_r = W_r + \\dfrac{P\\,y'}{x}",
      sub: `= ${kN(s.Wr)} + \\dfrac{${kN(s.P)}(0.45)}{1.88}`,
      result: `= ${kN(s.Vr)}\\ \\text{kN}`,
      cite: SRC.mac502('eq 6.5'),
    },
  ]
  if (!st.ideal && st.slipMode === 'brixius') {
    steps.push(
      {
        label: 'Mobility number of a rear tyre',
        tex: 'B_n = \\dfrac{CI\\,b\\,d}{W}\\cdot\\dfrac{1 + 5\\delta/h}{1 + 3b/d}',
        sub: `= \\dfrac{${n(SOILS[st.soil].CI / 1000, 4)}\\text{k}\\times${REAR_TYRE.b}\\times${REAR_TYRE.d}}{${kN(s.Vr / 2)}\\text{k}}\\cdot\\dfrac{1 + 5(${n(REAR_TYRE.delta, 3)})/${REAR_TYRE.h}}{1 + 3(${REAR_TYRE.b})/${REAR_TYRE.d}}`,
        result: `= ${n(s.BnR, 4)}`,
        cite: C.l27('p31, eq 14'),
      },
      {
        label: 'Net traction needed: pull plus front rolling resistance',
        tex: 'NTR = \\dfrac{P + R_f}{V_r}',
        sub: `= \\dfrac{${kN(s.P)} + ${kN(s.Rf)}}{${kN(s.Vr)}}`,
        result: `= ${n(s.NTR, 3)}`,
        cite: C.l27('p10, eq 5'),
      },
      {
        label: 'Slip from the Brixius equations (iterative)',
        tex: 'GTR = 0.88(1-e^{-0.1B_n})(1-e^{-7.5s}) + 0.04,\\quad MRR = \\dfrac{1}{B_n} + 0.04 + \\dfrac{0.5s}{\\sqrt{B_n}}',
        sub: `NTR = GTR - MRR = ${n(s.NTR, 3)}\\ \\Rightarrow\\ s`,
        result: s.spin ? '\\text{no solution: the wheels spin}' : `s = ${n(s.i * 100, 3)}\\,\\%,\\ GTR = ${n(s.br.GTR, 3)},\\ MRR = ${n(s.br.MRR, 3)}`,
        cite: C.l27('p31–32, eqs 15–16, Table 2'),
      },
    )
  }
  steps.push(
    {
      label: 'Wheel force and engine torque',
      tex: 'H = P + R,\\quad T_e = \\dfrac{H D}{2 q\\,\\eta_r}',
      sub: `H = ${kN(s.P)} + ${kN(s.R)},\\ T_e = \\dfrac{${kN(s.op.H)}\\text{k}\\times${D}}{2(${q})(${n(s.etaR, 3)})}`,
      result: s.stalled ? '\\text{above the engine curve: stalls}' : `H = ${kN(s.op.H)}\\ \\text{kN},\\ T_e = ${n(s.op.Te, 4)}\\ \\text{N·m at }${n(s.op.rpm, 4)}\\ \\text{rpm}`,
      cite: C.mech('p3, p7–8'),
    },
    {
      label: 'Actual speed',
      tex: 'V = V_0(1 - i)',
      sub: `= ${n(s.op.V0 * 3.6, 3)}(1 - ${n(s.i, 3)})`,
      result: `= ${n(s.op.V * 3.6, 3)}\\ \\text{km/h}`,
      cite: C.mech('p7'),
    },
    {
      label: 'Power losses',
      tex: '\\text{loss} = H V_0 i + R V',
      sub: `= ${kN(s.op.H)}(${n(s.op.V0, 3)})(${n(s.i, 3)}) + ${kN(s.R)}(${n(s.op.V, 3)})`,
      result: `= ${n(s.op.losses.slipLoss / 1000, 3)} + ${n(s.op.losses.rollingLoss / 1000, 3)} = ${n(s.op.losses.total / 1000, 3)}\\ \\text{kW}`,
      cite: C.mech('p7'),
    },
    {
      label: 'Tractive efficiency',
      tex: '\\eta_t = \\dfrac{P}{P + R}(1 - i)',
      sub: `= \\dfrac{${kN(s.P)}}{${kN(s.P)} + ${kN(s.R)}}(1 - ${n(s.i, 3)})`,
      result: `= ${n(s.op.etaT * 100, 3)}\\,\\%`,
      cite: C.mech('p8'),
    },
    {
      label: 'Overall efficiency',
      tex: '\\eta_o = \\eta_e\\,\\eta_r\\,\\eta_t',
      sub: `= ${st.etaE}\\times${n(s.etaR, 3)}\\times${n(s.op.etaT, 3)}`,
      result: `= ${n(s.etaO * 100, 3)}\\,\\%\\quad(\\eta_r = 0.98^5 = ${n(ETA_R, 3)})`,
      cite: C.mech('p8–9'),
    },
    {
      label: 'Using the ballast numbers (worked example)',
      tex: '\\dfrac{\\text{lb}}{\\text{PTO hp}} = \\dfrac{\\text{ballast number}}{V_t},\\quad V_t = \\dfrac{\\text{ballast number}}{\\text{lb/PTO hp}}',
      sub: '= \\dfrac{670}{5\\ \\text{mph}},\\quad \\dfrac{670}{130}',
      result: `= ${n(weightPerPower(670, 5), 3)}\\ \\text{lb/PTO hp},\\quad ${n(speedForWeightPerPower(670, 130), 3)}\\ \\text{mph}`,
      cite: C.l27('p43, Table 5'),
      errata: 'The notes print 125 lb/PTO hp and 4.8 mph. Those are 625/5 and 625/130 — the John Deere slide-rule number quoted in the same paragraph — not the PTO ballast number 670 used in the example.',
    },
  )
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function LabPanel() {
  const st = useLab()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<LabParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Test">
        <Segmented<View> label="View" value={st.view} onChange={(view) => st.set({ view })} options={[{ value: 'tractor', label: 'Tractor on test' }, { value: 'wheel', label: 'Wheel free body' }]} />
        <Segmented<Gear> label="Gear" value={st.gear} onChange={(gear) => set({ gear })} options={GEARS.map((g) => ({ value: g, label: `${g} (q ${FARMLAND_GEARS[Number(g)]})` }))} />
        <Slider label="Drawbar pull P" value={st.pull} min={0.5} max={40} step={0.25} unit="kN" onChange={(pull) => set({ pull })} />
        <Slider label="Rear ballast" value={st.ballast} min={0} max={1500} step={20} unit="kg" onChange={(ballast) => set({ ballast })} />
        <Toggle label="Ideal analysis (no slip, no rolling resistance, ηr = 1)" checked={st.ideal} onChange={(ideal) => set({ ideal })} />
        {!st.ideal ? (
          <>
            <Segmented<SlipMode> label="Slip and rolling resistance" value={st.slipMode} onChange={(slipMode) => set({ slipMode })} options={[{ value: 'brixius', label: 'From the soil (Brixius)' }, { value: 'manual', label: 'Set by hand' }]} />
            {st.slipMode === 'brixius' ? (
              <>
                <Segmented<Soil> label="Soil" value={st.soil} onChange={(soil) => set({ soil })} options={(Object.keys(SOILS) as Soil[]).map((k) => ({ value: k, label: SOILS[k].label }))} size="sm" />
                <Segmented<TyreKind> label="Tyre coefficients" value={st.tyre} onChange={(tyre) => set({ tyre })} options={[{ value: 'bias', label: 'Bias (original)' }, { value: 'radial', label: 'Radial (proposed)' }]} size="sm" />
                <Note>Cone index 860 kPa is a worked-example value; 1500 and 450 kPa are typical values. The radial row uses the mid values 9.5 and 0.0325 of the published coefficient ranges.</Note>
              </>
            ) : (
              <>
                <Slider label="Wheelslip i" value={st.slip * 100} min={0} max={50} step={0.5} unit="%" onChange={(v) => set({ slip: v / 100 })} />
                <Slider label="Rolling resistance R" value={st.rolling} min={0} max={6} step={0.1} unit="kN" onChange={(rolling) => set({ rolling })} />
              </>
            )}
          </>
        ) : null}
        <Slider label="Engine efficiency ηe" value={st.etaE * 100} min={20} max={40} step={1} unit="%" onChange={(v) => set({ etaE: v / 100 })} hint="diesel maximum ≈ 35 %" />
      </Section>
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <SpeedPull />
      <TractionCurves />
      <Ballasting />
      <Section title="Exam points">
        <Points
          items={[
            'Speed is set by engine speed and the ratio; pull determines engine torque; both depend on the ratio.',
            'Wheelslip i = (V₀ − V)/V₀; travel reduction TRR = 1 − Va/Vt is the same thing.',
            'Tractive efficiency is a force term P/(P + R) times a speed term (1 − i): TE = (NTR/GTR)(1 − TRR).',
            'More weight on the driving wheels lowers slip loss but raises rolling-resistance loss. Ideal slip is 10–15 %.',
            'Brixius: the mobility number combines cone index, tyre size, deflection and load; the solution is iterative.',
          ]}
        />
      </Section>
      <LabWorking />
    </div>
  )
}
