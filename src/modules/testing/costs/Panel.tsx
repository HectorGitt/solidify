import { useMemo, useState, type ReactNode } from 'react'
import { ERRATA } from '@/content/errata'
import { NumberField, PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import {
  ACRE_HA,
  FT,
  IMPLEMENT_CLASS_LABEL,
  MILE_KM,
  TABLE_3,
  capacityAcres,
  capacityHa,
  crf,
  implementSalvagePct,
  machineCosts,
  realRate,
  repairPct,
  tractorSalvagePct,
  type ImplementClass,
  type RepairKey,
  type TractorClass,
} from '@/physics/costs'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, DEFAULTS, ISU_DISK, ISU_TRACTOR, buildPlan, costsOf, live, useCosts, type CostParams } from './model'

const ISU_FLAG = ERRATA.find((e) => e.id === 'isu-operating')!
const money = (cur: string, v: number, d = 2) => `${cur}${v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })}`

const PRESETS: Preset[] = [
  {
    id: 'isu-tractor',
    label: 'Example: 180-hp tractor',
    note: 'List $110,000, bought for $93,500, 15 years × 400 h, 8 % interest − 3 % inflation. Expect ownership $21.87/h, operating $24.69/h, total $46.56/h.',
    flag: ISU_FLAG.correct + ' A figure of $18.09/h is also printed.',
    apply: () => useCosts.getState().set({ ...ISU_TRACTOR, iOn: false, currency: '$' }),
  },
  {
    id: 'isu-disk',
    label: 'Example: used 28-ft disk',
    note: 'Six-year-old tandem disk bought for $11,000 (list $30,000), 600 h on it, kept 8 years at 100 h/yr. Expect $19.59/h for the disk, $66.15/h with the tractor; 28 ft × 6.0 mph × 79 %/8.25 = 16 ac/h → $4.13/acre.',
    flag: 'The worked answer reads the implement salvage table at 13 years (24 %, $7,200), but a 6-year-old disk kept 8 more years is 14 years old (23 %, $6,900). The 13-year value is used to match the worked answer.',
    apply: () =>
      useCosts.getState().set({ ...ISU_TRACTOR, ...ISU_DISK, W: 28 * FT, S: 6 * MILE_KM, feModel: false, FE: 0.79, units: 'imperial', currency: '$', passes: 6, L: 120 }),
  },
  {
    id: 'slasher',
    label: 'Exam: 5-ft slasher',
    note: 'FE 85 %, “8 m/h” (read as 8 mph): C_t = 1.524 m × 12.87 km/h / 10 = 1.96 ha/h; C_e = 0.85 × 1.96 = 1.67 ha/h. Read as 8 km/h: 1.22 and 1.04 ha/h.',
    flag: 'The question’s “8 m/h” is ambiguous (mph or km/h).',
    apply: () => useCosts.getState().set({ W: 5 * FT, S: 8 * MILE_KM, feModel: false, FE: 0.85, units: 'si', overlap: 0.05, passes: 10, L: 60 }),
  },
  {
    id: 'model',
    label: 'Field model: 4 m disk',
    note: 'Field efficiency worked out from the plot: turning time on the headlands, overlap and stops for adjustment, against the time the full width would take at full speed.',
    apply: () => useCosts.getState().set({ W: DEFAULTS.W, S: DEFAULTS.S, overlap: DEFAULTS.overlap, passes: DEFAULTS.passes, L: DEFAULTS.L, turnFixed: DEFAULTS.turnFixed, turnSpeed: DEFAULTS.turnSpeed, otherFrac: DEFAULTS.otherFrac, feModel: true, units: 'si' }),
  },
]

function usePlan() {
  const st = useCosts()
  return useMemo(() => buildPlan(st), [st.W, st.S, st.overlap, st.passes, st.L, st.turnFixed, st.turnSpeed, st.otherFrac]) // eslint-disable-line react-hooks/exhaustive-deps
}

function capacityOf(st: CostParams, FEmodel: number) {
  const FE = st.feModel ? FEmodel : st.FE
  return { FE, ha: capacityHa(st.W, st.S, FE), ac: capacityAcres(st.W / FT, st.S / MILE_KM, FE), Ct: capacityHa(st.W, st.S, 1) }
}

function LivePanel() {
  const v = useLive(() => ({ ...live }), 10, (a, b) => a.t === b.t)
  const plan = usePlan()
  const st = useCosts()
  const cap = capacityOf(st, plan.eff.FE)
  const imp = st.units === 'imperial'
  return (
    <Section title="Live" right={<Badge tone={v.working ? 'accent' : 'warn'}>{v.working ? `pass ${v.pass + 1} of ${plan.n}` : v.t >= plan.total ? 'finished' : 'headland / stop'}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Elapsed" value={fmt(v.t / 60, 3)} unit="min" />
        <Readout label="Worked" value={imp ? fmt(v.area / 1e4 / ACRE_HA, 3) : fmt(v.area / 1e4, 3)} unit={imp ? 'ac' : 'ha'} />
        <Readout label="FE so far" value={fmt(v.FEsoFar * 100, 3)} unit="%" tone="info" />
        <Readout label="Field eff. (plot)" value={fmt(plan.eff.FE * 100, 3)} unit="%" tone="accent" />
        <Readout label="Theoretical C_t" value={imp ? fmt(cap.Ct / ACRE_HA, 3) : fmt(cap.Ct, 3)} unit={imp ? 'ac/h' : 'ha/h'} />
        <Readout label="Effective C_e" value={imp ? fmt(cap.ac, 3) : fmt(cap.ha, 3)} unit={imp ? 'ac/h' : 'ha/h'} tone="accent" />
      </div>
      {!st.feModel ? <p className="mt-1 text-[11px] text-dim">Costs use the fixed FE of {fmt(st.FE * 100, 3)} % (preset); the 3D plot shows its own FE.</p> : null}
    </Section>
  )
}

function FieldControls() {
  const st = useCosts()
  const imp = st.units === 'imperial'
  return (
    <Section title="Field and implement">
      <Segmented
        value={st.units}
        onChange={(units) => st.set({ units })}
        options={[
          { value: 'si', label: 'ha, m, km/h' },
          { value: 'imperial', label: 'ac, ft, mph' },
        ]}
        size="sm"
      />
      {imp ? (
        <>
          <Slider label="Width W" value={st.W / FT} min={3} max={40} step={0.5} unit="ft" onChange={(w) => st.set({ W: w * FT })} />
          <Slider label="Speed S" value={st.S / MILE_KM} min={1} max={10} step={0.1} unit="mph" onChange={(s) => st.set({ S: s * MILE_KM })} />
        </>
      ) : (
        <>
          <Slider label="Width W" value={st.W} min={1} max={12} step={0.1} unit="m" onChange={(W) => st.set({ W })} />
          <Slider label="Speed S" value={st.S} min={2} max={16} step={0.1} unit="km/h" onChange={(S) => st.set({ S })} />
        </>
      )}
      <Slider label="Overlap" value={st.overlap * 100} min={0} max={25} step={1} unit="%" onChange={(o) => st.set({ overlap: o / 100 })} />
      <Slider label="Passes" value={st.passes} min={2} max={16} step={2} onChange={(passes) => st.set({ passes })} />
      <Slider label="Pass length" value={st.L} min={20} max={200} step={5} unit="m" onChange={(L) => st.set({ L })} />
      <Slider label="Lift / lower per turn" value={st.turnFixed} min={0} max={30} step={1} unit="s" onChange={(turnFixed) => st.set({ turnFixed })} />
      <Slider label="Turning speed" value={st.turnSpeed * 100} min={20} max={100} step={5} unit="% of S" onChange={(v) => st.set({ turnSpeed: v / 100 })} />
      <Slider label="Adjust / fill stops" value={st.otherFrac * 100} min={0} max={30} step={1} unit="% of work" onChange={(v) => st.set({ otherFrac: v / 100 })} />
      <Toggle label="Use the plot’s field efficiency for costs" checked={st.feModel} onChange={(feModel) => st.set({ feModel })} />
      {!st.feModel ? <Slider label="Field efficiency FE" value={st.FE * 100} min={50} max={100} step={1} unit="%" onChange={(v) => st.set({ FE: v / 100 })} /> : null}
      <Slider label="Fast-forward" value={st.fastForward} min={1} max={20} step={1} unit="×" onChange={(fastForward) => st.set({ fastForward })} />
    </Section>
  )
}

function TimeBars() {
  const plan = usePlan()
  const e = plan.eff
  const parts = [
    { label: 'Working', v: e.work, c: '#9bd17a' },
    { label: 'Turning', v: e.turns, c: '#f08a3c' },
    { label: 'Adjust / fill', v: e.other, c: '#e8d06a' },
  ]
  return (
    <Section title="Where the time goes">
      <div className="flex h-4 w-full overflow-hidden rounded">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.v / e.actual) * 100}%`, background: p.c }} title={`${p.label}: ${fmt(p.v / 60, 3)} min`} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-mute">
        {parts.map((p) => (
          <span key={p.label}>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: p.c }} />
            {p.label} {fmt(p.v / 60, 3)} min
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Theoretical time (full width W at speed S over the area covered) {fmt(e.theoretical / 60, 3)} min ÷ actual {fmt(e.actual / 60, 3)} min = FE {fmt(e.FE * 100, 3)} %. Overlap lowers it too, because the
        effective width is W(1 − overlap) = {fmt(plan.we, 3)} m. Turn radii grow from {fmt(plan.we / 2, 2)} to {fmt(plan.rMax, 3)} m as the land widens.
      </p>
    </Section>
  )
}

function Select<T extends string>({ label, value, options, onChange }: { label: ReactNode; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
      <span className="text-ink/90">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="w-44 rounded border border-line-2 bg-panel-2 px-1 py-0.5 text-[12px] text-ink">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function CostInputs() {
  const st = useCosts()
  const cur = st.currency
  return (
    <Section title="Machines">
      <p className="mb-1 text-[11.5px] text-ink/85">Power unit (tractor)</p>
      <Segmented<TractorClass>
        value={st.tClass}
        onChange={(tClass) => st.set({ tClass })}
        options={[
          { value: '30-79', label: '30–79 hp' },
          { value: '80-149', label: '80–149 hp' },
          { value: '150+', label: '150+ hp' },
        ]}
        size="sm"
      />
      <NumberField label="List price" value={st.tList} step={1000} unit={cur} onChange={(tList) => st.set({ tList })} />
      <NumberField label="Purchase price" value={st.tPurchase} step={1000} unit={cur} onChange={(tPurchase) => st.set({ tPurchase })} />
      <NumberField label="Years kept" value={st.tYears} step={1} unit="yr" onChange={(tYears) => st.set({ tYears: Math.max(1, Math.min(20, tYears)) })} />
      <NumberField label="Annual use" value={st.tHours} step={50} unit="h/yr" onChange={(tHours) => st.set({ tHours: Math.max(10, tHours) })} />
      <NumberField label="Max PTO power" value={st.ptoHp} step={5} unit="hp" onChange={(ptoHp) => st.set({ ptoHp })} />
      <NumberField label="Diesel price" value={st.fuelPrice} step={0.05} unit={`${cur}/gal`} onChange={(fuelPrice) => st.set({ fuelPrice })} />
      <NumberField label="Wage" value={st.wage} step={0.5} unit={`${cur}/h`} onChange={(wage) => st.set({ wage })} />
      <NumberField label="Nominal interest" value={st.nominal * 100} step={0.5} unit="%" onChange={(v) => st.set({ nominal: v / 100 })} />
      <NumberField label="Inflation" value={st.inflation * 100} step={0.5} unit="%" onChange={(v) => st.set({ inflation: v / 100 })} />
      <div className="mt-2" />
      <Toggle label="Implement" checked={st.iOn} onChange={(iOn) => st.set({ iOn })} />
      {st.iOn ? (
        <>
          <Select<ImplementClass> label="Salvage class" value={st.iClass} onChange={(iClass) => st.set({ iClass })} options={(Object.keys(IMPLEMENT_CLASS_LABEL) as ImplementClass[]).map((k) => ({ value: k, label: IMPLEMENT_CLASS_LABEL[k] }))} />
          <Select<RepairKey> label="Repair-cost type" value={st.iRepair} onChange={(iRepair) => st.set({ iRepair })} options={(Object.keys(TABLE_3) as RepairKey[]).map((k) => ({ value: k, label: TABLE_3[k].label }))} />
          <NumberField label="List price" value={st.iList} step={500} unit={cur} onChange={(iList) => st.set({ iList })} />
          <NumberField label="Purchase price" value={st.iPurchase} step={500} unit={cur} onChange={(iPurchase) => st.set({ iPurchase })} />
          <NumberField label="Hours when bought" value={st.iHoursAtPurchase} step={50} unit="h" onChange={(v) => st.set({ iHoursAtPurchase: Math.max(0, v) })} />
          <NumberField label="Years kept" value={st.iYears} step={1} unit="yr" onChange={(iYears) => st.set({ iYears: Math.max(1, Math.min(20, iYears)) })} />
          <NumberField label="Annual use" value={st.iHours} step={10} unit="h/yr" onChange={(iHours) => st.set({ iHours: Math.max(5, iHours) })} />
          <NumberField label="Age when sold" value={st.iEndAge} step={1} unit="yr" onChange={(iEndAge) => st.set({ iEndAge: Math.max(1, Math.min(20, iEndAge)) })} />
        </>
      ) : null}
    </Section>
  )
}

function CostSummary() {
  const st = useCosts()
  const plan = usePlan()
  const c = useMemo(() => costsOf(st), [st])
  const cap = capacityOf(st, plan.eff.FE)
  const cur = st.currency
  const imp = st.units === 'imperial'
  const perArea = c.combined / (imp ? cap.ac : cap.ha)
  const rows: { label: string; v: number; c: string }[] = [
    { label: 'Tractor ownership', v: c.tractor.ownershipHour, c: '#6fb3e0' },
    { label: 'Tractor repairs', v: c.tractor.repairHour, c: '#3f7fb0' },
    { label: 'Fuel + lube', v: c.tractor.fuelHour + c.tractor.lubeHour, c: '#e8d06a' },
    { label: 'Labour', v: c.tractor.labourHour, c: '#c9a24a' },
    ...(st.iOn
      ? [
          { label: 'Implement ownership', v: c.implement.ownershipHour, c: '#9bd17a' },
          { label: 'Implement repairs', v: c.implement.repairHour, c: '#5f9a48' },
        ]
      : []),
  ]
  return (
    <Section title="Cost per hour and per area">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Tractor" value={money(cur, c.tractor.totalHour)} unit="/h" />
        <Readout label="Implement" value={st.iOn ? money(cur, c.implement.totalHour) : '—'} unit="/h" />
        <Readout label="Combined" value={money(cur, c.combined)} unit="/h" tone="accent" />
        <Readout label="Capacity" value={fmt(imp ? cap.ac : cap.ha, 3)} unit={imp ? 'ac/h' : 'ha/h'} />
        <Readout label={imp ? 'Cost per acre' : 'Cost per ha'} value={money(cur, perArea)} tone="accent" />
        <Readout label="FE used" value={fmt(cap.FE * 100, 3)} unit="%" />
      </div>
      <div className="mt-2 flex h-4 w-full overflow-hidden rounded">
        {rows.map((r) => (
          <div key={r.label} style={{ width: `${(r.v / c.combined) * 100}%`, background: r.c }} title={`${r.label}: ${money(cur, r.v)}/h`} />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-mute">
        {rows.map((r) => (
          <span key={r.label}>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: r.c }} />
            {r.label} {money(cur, r.v)}
          </span>
        ))}
      </div>
    </Section>
  )
}

function CostCharts() {
  const st = useCosts()
  const plan = usePlan()
  const cap = capacityOf(st, plan.eff.FE)
  const imp = st.units === 'imperial'
  const area = imp ? cap.ac : cap.ha
  const data = useMemo(() => {
    const xs: number[] = []
    const own: number[] = []
    const rep: number[] = []
    const tot: number[] = []
    const base = costsOf(st)
    const i = realRate(st.nominal, st.inflation)
    for (let h = 25; h <= 800; h += 5) {
      xs.push(h)
      if (st.iOn) {
        const m = machineCosts({ list: st.iList, purchase: st.iPurchase, years: st.iYears, hoursPerYear: h, salvagePct: implementSalvagePct(st.iClass, st.iEndAge), i, repair: st.iRepair, hoursAtPurchase: st.iHoursAtPurchase })
        own.push(m.ownershipHour / area)
        rep.push(m.repairHour / area)
        tot.push((m.totalHour + base.tractor.totalHour) / area)
      } else {
        const m = machineCosts({ list: st.tList, purchase: st.tPurchase, years: st.tYears, hoursPerYear: h, salvagePct: tractorSalvagePct(st.tClass, st.tYears, h), i, repair: 'tractor2wd', ptoHp: st.ptoHp, fuelPrice: st.fuelPrice, wage: st.wage, labourFactor: st.labourFactor })
        own.push(m.ownershipHour / area)
        rep.push(m.repairHour / area)
        tot.push(m.totalHour / area)
      }
    }
    return { xs, own, rep, tot }
  }, [st, area])
  const hNow = st.iOn ? st.iHours : st.tHours
  const now = costsOf(st).combined / area
  const repairKey: RepairKey = st.iOn ? st.iRepair : 'tractor2wd'
  const rc = useMemo(() => {
    const row = TABLE_3[repairKey]
    const max = row.hours[row.hours.length - 1]
    const xs: number[] = []
    const ys: number[] = []
    for (let h = 0; h <= max; h += max / 100) {
      xs.push(h)
      ys.push(repairPct(repairKey, h))
    }
    return { xs, ys, label: row.label }
  }, [repairKey])
  const hEnd = st.iOn ? st.iHoursAtPurchase + st.iHours * st.iYears : st.tHours * st.tYears
  return (
    <Section title="Charts">
      <Chart
        key={`${st.iOn}-${st.units}`}
        data={[data.xs, data.tot, data.own, data.rep]}
        series={[
          { label: 'Total', color: '#f5b942', width: 2 },
          { label: `${st.iOn ? 'Implement' : 'Tractor'} ownership`, color: '#9bd17a', width: 1.5 },
          { label: `${st.iOn ? 'Implement' : 'Tractor'} repairs`, color: '#6fb3e0', width: 1.5, dash: [4, 3] },
        ]}
        xLabel={`${st.iOn ? 'Implement' : 'Tractor'} annual use (h/yr)`}
        yLabel={`Cost (${st.currency}/${imp ? 'acre' : 'ha'})`}
        marker={() => [hNow, now]}
        height={180}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Ownership is fixed per year, so spreading it over more hours cuts the cost per {imp ? 'acre' : 'hectare'}; repairs per hour rise slowly as the machine wears (the repair curve gets steeper). Total includes the tractor’s cost per hour.
      </p>
      <div className="h-2" />
      <Chart
        key={repairKey}
        data={[rc.xs, rc.ys]}
        series={[{ label: rc.label, color: '#e8794f', width: 2 }]}
        xLabel="Accumulated hours"
        yLabel="Repairs (% of list)"
        marker={() => [hEnd, repairPct(repairKey, hEnd)]}
        height={150}
      />
      <p className="mt-1 text-[11px] text-dim">Accumulated repair cost: {rc.label}. The dot is the machine’s accumulated hours when it is sold.</p>
    </Section>
  )
}

function CostWorking() {
  const st = useCosts()
  const plan = usePlan()
  const c = useMemo(() => costsOf(st), [st])
  const cap = capacityOf(st, plan.eff.FE)
  const cur = st.currency.replace('$', '\\$').replace('₦', '\\text{₦}')
  const m = (v: number, d = 2) => `${cur}${v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
  const T = c.tractor
  const I = c.implement
  const steps: WorkingStep[] = [
    {
      label: 'Field capacity (both forms)',
      tex: 'C = \\dfrac{W\\,S\\,FE}{10}\\ \\text{ha/h} = \\dfrac{W_{ft}\\,S_{mph}\\,FE}{8.25}\\ \\text{ac/h}',
      sub: `= \\dfrac{${n(st.W, 3)}\\times${n(st.S, 3)}\\times${n(cap.FE, 3)}}{10} = \\dfrac{${n(st.W / FT, 3)}\\times${n(st.S / MILE_KM, 3)}\\times${n(cap.FE, 3)}}{8.25}`,
      result: `= ${n(cap.ha, 4)}\\ \\text{ha/h} = ${n(cap.ac, 4)}\\ \\text{ac/h}`,
      cite: C.mgmt('p7–8 field capacity'),
    },
    {
      label: 'Tractor salvage and depreciation',
      tex: '\\text{Salvage} = \\text{list}\\times\\%,\\quad D = \\text{purchase} - \\text{salvage}',
      sub: `= ${m(st.tList, 0)}\\times${n(c.tSalvagePct, 3)}\\%,\\; D = ${m(st.tPurchase, 0)} - ${m(T.salvage, 0)}`,
      result: `\\text{Salvage} = ${m(T.salvage, 0)},\\quad D = ${m(T.depreciation, 0)}`,
      cite: C.mgmt('p2–3, Table 1a'),
    },
    {
      label: 'Capital recovery and TIH',
      tex: 'CR = D\\times CRF + \\text{salvage}\\times i,\\quad i = i_{nom} - \\text{inflation},\\quad TIH = 0.01\\times\\text{purchase}',
      sub: `CRF(${st.tYears}\\,\\text{yr}, ${n(c.i * 100, 3)}\\%) = ${T.crf.toFixed(3)};\\; ${m(T.depreciation, 0)}\\times${T.crf.toFixed(3)} + ${m(T.salvage, 0)}\\times${n(c.i, 3)}`,
      result: `CR = ${m(T.capitalRecovery, 0)},\\; TIH = ${m(T.tih, 0)},\\; \\text{ownership} = ${m(T.ownershipYear, 0)}/\\text{yr} = ${m(T.ownershipHour)}/\\text{h}`,
      cite: C.mgmt('p3–4, Table 2'),
    },
    {
      label: 'Tractor repairs',
      tex: '\\text{repairs/h} = \\dfrac{\\%(h_{end})\\times\\text{list}}{h_{end}}',
      sub: `h_{end} = ${st.tHours}\\times${st.tYears} = ${n(T.hoursEnd, 5)}\\ \\text{h},\\; ${n(repairPct('tractor2wd', T.hoursEnd), 3)}\\%\\times${m(st.tList, 0)}`,
      result: `= ${m(T.repairHour)}/\\text{h}`,
      cite: C.mgmt('p4–5, Table 3'),
    },
    {
      label: 'Fuel, lubrication and labour',
      tex: '\\text{fuel} = 0.044\\times hp_{PTO}\\ \\text{gal/h},\\quad \\text{lube} = 0.15\\times\\text{fuel},\\quad \\text{labour} = \\text{wage}\\times1.1',
      sub: `0.044\\times${n(st.ptoHp, 4)} = ${n(T.fuelGal, 3)}\\ \\text{gal/h}\\times${m(st.fuelPrice)}`,
      result: `\\text{fuel } ${m(T.fuelHour)},\\ \\text{lube } ${m(T.lubeHour)},\\ \\text{labour } ${m(T.labourHour)}\\ \\text{per h}`,
      cite: C.mgmt('p6'),
    },
    {
      label: 'Tractor operating and total cost',
      tex: '\\text{operating} = \\text{repairs} + \\text{fuel} + \\text{lube} + \\text{labour},\\quad \\text{total} = \\text{ownership} + \\text{operating}',
      sub: `${m(T.repairHour)} + ${m(T.fuelHour)} + ${m(T.lubeHour)} + ${m(T.labourHour)}`,
      result: `\\text{operating} = ${m(T.operatingHour)}/\\text{h},\\quad \\text{total} = ${m(T.totalHour)}/\\text{h}`,
      cite: C.mgmt('p6'),
      errata: ISU_FLAG.correct,
    },
  ]
  if (st.iOn) {
    steps.push(
      {
        label: 'Implement ownership',
        tex: 'CR = (\\text{purchase} - \\text{salvage})\\,CRF + \\text{salvage}\\times i',
        sub: `\\text{salvage} = ${n(c.iSalvagePct, 3)}\\%\\times${m(st.iList, 0)} = ${m(I.salvage, 0)};\\; (${m(st.iPurchase, 0)} - ${m(I.salvage, 0)})\\times${I.crf.toFixed(3)} + ${m(I.salvage, 0)}\\times${n(c.i, 3)}`,
        result: `CR = ${m(I.capitalRecovery, 0)},\\; TIH = ${m(I.tih, 0)},\\; ${m(I.ownershipYear, 0)}/\\text{yr} \\div ${st.iHours}\\,\\text{h} = ${m(I.ownershipHour)}/\\text{h}`,
        cite: C.mgmt('p7 used machinery'),
      },
      {
        label: 'Implement repairs for a used machine',
        tex: '\\text{repairs/h} = \\dfrac{[\\%(h_{end}) - \\%(h_0)]\\times\\text{list}}{h_{end} - h_0}',
        sub: `h_0 = ${st.iHoursAtPurchase},\\ h_{end} = ${n(I.hoursEnd, 5)};\\ (${n(repairPct(st.iRepair, I.hoursEnd), 3)} - ${n(repairPct(st.iRepair, st.iHoursAtPurchase), 3)})\\%\\times${m(st.iList, 0)}`,
        result: `= ${m(I.repairHour)}/\\text{h};\\quad \\text{implement total} = ${m(I.totalHour)}/\\text{h}`,
        cite: C.mgmt('p7, Table 3'),
      },
    )
  }
  const area = st.units === 'imperial' ? cap.ac : cap.ha
  steps.push({
    label: `Cost per ${st.units === 'imperial' ? 'acre' : 'hectare'}`,
    tex: '\\text{cost per area} = \\dfrac{\\text{total cost per hour}}{\\text{field capacity}}',
    sub: `= \\dfrac{${m(c.combined)}}{${n(area, 4)}}`,
    result: `= ${m(c.combined / area)}\\ \\text{per ${st.units === 'imperial' ? 'acre' : 'ha'}}`,
    cite: C.mgmt('p8'),
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

/** AEE501 exam: area, commodity-throughput and total-throughput capacity of a combine. */
function Throughput() {
  const [q, setQ] = useState({ tons: 10000, grain: 0.75, hours: 600, util: 0.85, yieldT: 15, wEff: 5.85, wFull: 6 })
  const h = q.hours * q.util
  const grainT = q.tons * q.grain
  const ha = grainT / q.yieldT
  const Ce = ha / h
  const Ct = (Ce * q.wFull) / q.wEff
  return (
    <Section title="Exam: throughput capacity (combine)">
      <NumberField label="Crop produced" value={q.tons} step={500} unit="t" onChange={(tons) => setQ({ ...q, tons })} />
      <NumberField label="Grain fraction" value={q.grain} step={0.05} onChange={(grain) => setQ({ ...q, grain })} />
      <NumberField label="Annual use" value={q.hours} step={50} unit="h" onChange={(hours) => setQ({ ...q, hours })} />
      <NumberField label="Fraction actually worked" value={q.util} step={0.05} onChange={(util) => setQ({ ...q, util })} />
      <NumberField label="Grain yield" value={q.yieldT} step={1} unit="t/ha" onChange={(yieldT) => setQ({ ...q, yieldT })} />
      <NumberField label="Header used / full" value={q.wEff} step={0.05} unit="m" onChange={(wEff) => setQ({ ...q, wEff })} />
      <Table
        head={['Capacity', 'Value']}
        rows={[
          ['Working hours', `${fmt(h, 4)} h`],
          ['Commodity throughput', `${fmt(grainT / h, 4)} t/h`],
          ['Total throughput', `${fmt(q.tons / h, 4)} t/h`],
          ['Area harvested', `${fmt(ha, 4)} ha`],
          ['Effective area capacity', `${fmt(Ce, 4)} ha/h`],
          ['Theoretical (full 6 m header)', `${fmt(Ct, 4)} ha/h`],
        ]}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Exam 2019/20. Assumptions (no marking guide): rates are per hour actually worked (85 % of 600 h); “15 t from 1 ha” refers to the grain (maize) fraction; theoretical capacity uses the full header width.
      </p>
    </Section>
  )
}

/** AEE501 exam (2019/20, 2023/24): SANDEL depreciation, used truck and capital recovery. */
function Sandel() {
  const N = (v: number) => `₦${(v / 1e6).toFixed(3)} M`
  const tList = 17e6 / 0.95
  const tSalv10 = (tractorSalvagePct('150+', 10, 600) / 100) * tList
  const vListNow = 3.5e6 / (implementSalvagePct('vehicle', 5) / 100)
  const vNew = vListNow * (1 - 0.075)
  const vLater = (implementSalvagePct('vehicle', 10) / 100) * vListNow
  const f = crf(0.06, 7)
  const cr = (purchase: number, list: number, pct: number) => {
    const s = (pct / 100) * list
    return { s, cr: (purchase - s) * f + s * 0.06 }
  }
  const tr = cr(17e6, tList, tractorSalvagePct('150+', 7, 600))
  const hv = cr(8.5e6, 8.5e6 / 0.95, tractorSalvagePct('combine', 7, 400))
  const pl = cr(1.5e6, 1.5e6 / 0.95, implementSalvagePct('planter', 7))
  return (
    <Section title="Exam: SANDEL Engineering costs">
      <Table
        head={['Item', 'Working', 'Answer']}
        rows={[
          ['Tractor list', '17 M ÷ 0.95', N(tList)],
          ['Salvage after 10 yr', `${tractorSalvagePct('150+', 10, 600)} % (150+ hp, 600 h)`, N(tSalv10)],
          ['Depreciation', '17 M − salvage', N(17e6 - tSalv10)],
          ['Truck list now', `3.5 M ÷ ${implementSalvagePct('vehicle', 5)} % (vehicle, 5 yr)`, N(vListNow)],
          ['New truck with 7.5 % off', 'list × 0.925', N(vNew)],
          ['Truck worth at 10 yr', `${implementSalvagePct('vehicle', 10)} % of list`, N(vLater)],
          ['CRF (7 yr, 6 %)', 'i(1+i)ⁿ / [(1+i)ⁿ − 1]', f.toFixed(3)],
          ['Tractor capital recovery', `salvage ${tractorSalvagePct('150+', 7, 600)} %`, N(tr.cr)],
          ['Harvester capital recovery', `salvage ${fmt(tractorSalvagePct('combine', 7, 400), 3)} % (400 h, interp.)`, N(hv.cr)],
          ['Planter capital recovery', `salvage ${implementSalvagePct('planter', 7)} %`, N(pl.cr)],
        ]}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Exams 2019/20 and 2023/24; no marking guide, so the assumptions are shown: prices quoted are after the 5 % discount; 6 % is used as the interest rate; a 400 h/yr combine is interpolated between the 300 and 500 h columns of the tractor salvage table.
      </p>
    </Section>
  )
}

export function Panel() {
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <LivePanel />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <FieldControls />
      <TimeBars />
      <CostSummary />
      <CostCharts />
      <CostInputs />
      <CostWorking />
      <Throughput />
      <Sandel />
    </div>
  )
}
