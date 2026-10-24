import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { ALTERNATOR, DYNAMO, batteryHours, batteryVoltage, chargeCurrent, coilSecondaryVoltage, cutInRpm, dwellTime, primaryCurrent, sparksPerMinute, starterRatio } from '@/physics/electrical'
import {
  LEAD_ACID,
  LEAD_ACID_AS_PRINTED,
  SPARK_KV_REQUIRED,
  TYPICAL_IMPULSE,
  batterySG,
  cellOpenCircuitVolts,
  distributorRpm,
  impulseCoupling,
  magnetoKV,
  primaryFlybackVolts,
  reactionBalance,
  secondaryAvailableVolts,
} from '@/physics/engineExtra'
import { useView } from '@/render/view'
import { flyTo } from '@/ui/camera'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Tex } from '@/ui/Tex'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { R_ALT, R_CRANK, R_DYN } from './geometry'
import { CAMERAS, COIL, CUT_FOR, NOSE_MM, PINION_TEETH, RING_TEETH, SUBS, live, plugTipTemp, starterCmd, useIgn, type Sub } from './model'

const btn = (on: boolean) => `rounded-md border px-2 py-1.5 text-left text-[12px] ${on ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`

interface Preset {
  id: string
  label: string
  note: string
  apply: () => void
}

function Presets({ list }: { list: Preset[] }) {
  const [p, setP] = useState<string | null>(null)
  return (
    <Section title="Presets">
      <div className="grid grid-cols-2 gap-1.5">
        {list.map((x) => (
          <button
            key={x.id}
            className={btn(p === x.id)}
            onClick={() => {
              x.apply()
              setP(x.id)
            }}
          >
            {x.label}
          </button>
        ))}
      </div>
      {p ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{list.find((x) => x.id === p)?.note}</p> : null}
    </Section>
  )
}

/* ------------------------------ (a) coil ------------------------------ */

function CoilPanel() {
  const st = useIgn()
  const v = useLive(() => ({ crank: live.crank, rotor: live.rotor, closed: live.closed, I: live.current, cyl: live.sparkCyl, kv: live.kv }), 15, (a, b) => a.crank === b.crank)
  const tDwell = dwellTime(st.rpm, 4, 0.6)
  const Ib = primaryCurrent(tDwell, st.volts, COIL.R, COIL.L)
  const e1 = primaryFlybackVolts(Ib, COIL.L, COIL.C)
  const kv = secondaryAvailableVolts(Ib, COIL.L, COIL.C, st.n1, st.n2, COIL.coupling) / 1000
  const curveData = useMemo(() => {
    const xs: number[] = []
    const y: number[] = []
    for (let r = 300; r <= 5000; r += 50) {
      xs.push(r)
      y.push(secondaryAvailableVolts(primaryCurrent(dwellTime(r, 4, 0.6), st.volts, COIL.R, COIL.L), COIL.L, COIL.C, st.n1, st.n2, COIL.coupling) / 1000)
    }
    return [xs, y, xs.map(() => SPARK_KV_REQUIRED[0]), xs.map(() => SPARK_KV_REQUIRED[1])]
  }, [st.volts, st.n1, st.n2])
  const steps: WorkingStep[] = [
    { label: 'Turns ratio of the coil', tex: '\\dfrac{N_2}{N_1}', sub: `= \\dfrac{${n(st.n2, 5)}}{${n(st.n1, 3)}}`, result: `= ${n(st.n2 / st.n1, 3)}`, cite: SRC.l4_509('primary 200–300 turns, secondary ≈21 000 turns') },
    {
      label: 'Battery voltage simply stepped up — not enough',
      tex: 'V_2 = V_1\\dfrac{N_2}{N_1}',
      sub: `= ${st.volts}\\times${n(st.n2 / st.n1, 3)}`,
      result: `= ${n(coilSecondaryVoltage(st.volts, st.n1, st.n2), 4)}\\ \\text{V} \\ll 10\\text{–}15\\ \\text{kV needed}`,
      cite: SRC.tb509('p27: 10–15 kV to jump the gap'),
    },
    {
      label: 'Primary current when the points open (dwell 60 % of 90° cam)',
      tex: 'i = \\dfrac{V}{R}\\left(1-e^{-tR/L}\\right),\\quad t = 0.6\\,\\dfrac{60}{N\\,n_{cyl}/2}',
      sub: `t = ${n(tDwell * 1000, 3)}\\ \\text{ms},\\; R = ${COIL.R}\\,\\Omega,\\; L = ${COIL.L * 1000}\\ \\text{mH}`,
      result: `i = ${n(Ib, 3)}\\ \\text{A}`,
      cite: SRC.beyond('RL circuit'),
      beyond: true,
    },
    {
      label: 'Collapse of the field: primary self-induced voltage, limited by the condenser',
      tex: 'e_1 = i\\sqrt{L/C}',
      sub: `= ${n(Ib, 3)}\\sqrt{${COIL.L}/${COIL.C}}`,
      result: `= ${n(e1, 3)}\\ \\text{V}`,
      cite: SRC.beyond('LC ringing'),
      beyond: true,
    },
    {
      label: 'Secondary voltage available (mutual induction)',
      tex: 'V_2 \\approx \\eta\\, e_1\\dfrac{N_2}{N_1}',
      sub: `= ${COIL.coupling}\\times${n(e1, 3)}\\times${n(st.n2 / st.n1, 3)}`,
      result: `= ${n(kv, 3)}\\ \\text{kV}\\;${kv >= SPARK_KV_REQUIRED[1] ? '> 15\\ \\text{kV ✓}' : '\\text{— marginal}'}`,
      cite: SRC.tb509('§5.2.1'),
      beyond: true,
    },
    {
      label: 'Sparks, distributor speed and timing',
      tex: '\\text{sparks/min} = \\dfrac{N\\,n_{cyl}}{2},\\quad N_{dist} = \\dfrac{N}{2},\\quad t_{adv} = \\dfrac{\\theta_{adv}}{6N}',
      sub: `N = ${st.rpm},\\; n_{cyl} = 4,\\; \\theta_{adv} = ${st.advance}^\\circ`,
      result: `${n(sparksPerMinute(st.rpm, 4), 4)}\\ \\text{/min},\\; ${n(distributorRpm(st.rpm), 4)}\\ \\text{rpm},\\; ${n((st.advance / (6 * st.rpm)) * 1000, 3)}\\ \\text{ms before TDC}`,
      cite: SRC.tb509('§5.5 ≈25° BTDC'),
    },
  ]
  return (
    <>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Crank" value={`${Math.round(v.crank)}°`} unit="of 720" />
          <Readout label="Rotor" value={`${Math.round(v.rotor)}°`} unit="½ speed" />
          <Readout label="Points" value={v.closed ? 'Closed' : 'Open'} tone={v.closed ? 'info' : 'warn'} />
          <Readout label="Primary i" value={fmt(v.I, 2)} unit="A" tone="info" />
          <Readout label="Sparking" value={v.cyl ? `Plug ${v.cyl}` : '—'} tone="warn" />
          <Readout label="HT available" value={fmt(v.kv, 3)} unit="kV" tone="accent" />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-dim">Firing order 1-3-4-2. Blue particles: primary (LT) current while the points are closed; white: the HT pulse to the plug that fires.</p>
      </Section>
      <Section title="Controls">
        <Slider label="Engine speed" value={st.rpm} min={300} max={3000} step={10} unit="rpm" onChange={(rpm) => st.set({ rpm })} />
        <Slider label="Spark advance" value={st.advance} min={0} max={40} step={1} unit="° BTDC" onChange={(advance) => st.set({ advance })} />
        <Segmented<string> label="Battery" value={String(st.volts)} onChange={(v2) => st.set({ volts: Number(v2) as 6 | 12 })} options={[{ value: '6', label: '6 V' }, { value: '12', label: '12 V' }]} />
        <Slider label="Primary turns N₁" value={st.n1} min={200} max={300} step={5} onChange={(n1) => st.set({ n1 })} hint="200–300 turns of 20 SWG" />
        <Slider label="Secondary turns N₂" value={st.n2} min={15000} max={25000} step={500} digits={5} onChange={(n2) => st.set({ n2 })} hint="About 21 000 turns of 40 SWG" />
      </Section>
      <Presets
        list={[
          { id: 'l4', label: 'Standard coil data', note: '12 V battery; primary 200–300 turns of 20 SWG; secondary ≈21 000 turns of 40 SWG; 4-corner breaker cam for 4 cylinders.', apply: () => st.set({ volts: 12, n1: 250, n2: 21000 }) },
          { id: 'timing', label: 'Timing · 25° BTDC', note: 'When the engine is running the spark is made to occur about 25° before TDC to give time for the mixture to burn. Slow motion.', apply: () => st.set({ advance: 25, rpm: 600 }) },
          { id: '6v', label: '6 V system', note: 'Older tractors used 6 V. Half the primary current → less HT, especially at speed.', apply: () => st.set({ volts: 6 }) },
          { id: 'fast', label: 'High speed', note: 'At high speed the points are closed for less time, the primary current has less time to build up and the available voltage falls.', apply: () => st.set({ rpm: 3000 }) },
        ]}
      />
      <Section title="Available HT vs speed" right={<Badge tone="info" title="RL / LC coil model — standard theory">indicative</Badge>}>
        <Chart
          data={curveData}
          series={[
            { label: 'Available', color: '#e8794f', width: 2 },
            { label: '10 kV', color: '#93a59a', width: 1, dash: [4, 3] },
            { label: '15 kV', color: '#93a59a', width: 1, dash: [4, 3] },
          ]}
          xLabel="Engine speed (rpm)"
          yLabel="Secondary (kV)"
          marker={() => [useIgn.getState().rpm, live.kv]}
          height={150}
        />
        <p className="mt-1 text-[11px] text-dim">Dashed: the 10–15 kV a spark needs.</p>
      </Section>
      <Section title="Working">
        <Working steps={steps} />
      </Section>
    </>
  )
}

/* ------------------------------ (b) magneto ------------------------------ */

function MagnetoPanel() {
  const st = useIgn()
  const v = useLive(() => ({ d: live.drive, r: live.mrotor, ph: live.phase, sp: live.spring, kv: live.mkv }), 15, (a, b) => a.d === b.d)
  const data = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let d = 0; d <= 360; d += 1) {
      xs.push(d)
      ys.push(impulseCoupling(d, st.crankRpm).rotorDeg)
    }
    return [xs, ys, xs]
  }, [st.crankRpm])
  const factor = (TYPICAL_IMPULSE.windupDeg + TYPICAL_IMPULSE.snapDeg) / TYPICAL_IMPULSE.snapDeg
  const steps: WorkingStep[] = [
    { label: 'Sparks per magneto revolution', tex: '\\text{field reverses every } 180^\\circ \\Rightarrow 2\\ \\text{sparks/rev}', cite: SRC.tb509('p28 every half revolution') },
    {
      label: 'Without the impulse coupling — slow cranking',
      tex: 'V \\propto N_{magneto}',
      sub: `N = ${st.crankRpm}\\ \\text{rpm}`,
      result: `\\approx ${n(magnetoKV(st.crankRpm), 3)}\\ \\text{kV}${magnetoKV(st.crankRpm) < 10 ? '\\;(< 10\\ \\text{kV: no spark})' : ''}`,
      cite: SRC.tb509('p28: will not produce the hot spark when turning slowly'),
      beyond: true,
    },
    {
      label: 'With the impulse coupling — spring flings the rotor',
      tex: 'N_{snap} = N\\,\\dfrac{\\theta_{wind}+\\theta_{snap}}{\\theta_{snap}}',
      sub: `= ${st.crankRpm}\\times\\dfrac{${TYPICAL_IMPULSE.windupDeg}+${TYPICAL_IMPULSE.snapDeg}}{${TYPICAL_IMPULSE.snapDeg}}`,
      result: `= ${n(st.crankRpm * factor, 4)}\\ \\text{rpm} \\Rightarrow \\approx ${n(magnetoKV(st.crankRpm * factor), 3)}\\ \\text{kV}`,
      cite: SRC.tb509('§5.2.2 impulse coupling, Fig 5.3'),
      beyond: true,
    },
  ]
  return (
    <>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Drive hub" value={`${Math.round(v.d)}°`} />
          <Readout label="Magneto rotor" value={`${Math.round(v.r)}°`} />
          <Readout label="Coupling" value={<span className="text-[12px]">{v.ph}</span>} tone="warn" />
          <Readout label="Spring wound" value={`${Math.round(v.sp)}°`} tone="info" />
          <Readout label="Last spark" value={fmt(v.kv, 3)} unit="kV" tone="accent" />
          <Readout label="Sparks / rev" value="2" />
        </div>
      </Section>
      <Section title="Controls">
        <Slider label="Drive (cranking) speed" value={st.crankRpm} min={30} max={600} step={5} unit="rpm" onChange={(crankRpm) => st.set({ crankRpm })} hint={`Pawls held clear above ${TYPICAL_IMPULSE.releaseRpm} rpm (typical)`} />
      </Section>
      <Presets
        list={[
          { id: 'crank', label: 'Hand cranking · 100 rpm', note: 'Spring wind-up while pawl 1 or 2 is held by the stop pin; pawl kicked off — impulse action; wind-up again. Watch the rotor stop, then snap forward.', apply: () => st.set({ crankRpm: 100 }) },
          { id: 'run', label: 'Running · 600 rpm', note: 'At running speed the pawls are held clear of the stop pin and the coupling drives the magneto solidly; the magneto now turns fast enough to make its own hot spark.', apply: () => st.set({ crankRpm: 600 }) },
        ]}
      />
      <Section title="Rotor angle vs drive angle" right={<Badge tone="info">indicative</Badge>}>
        <Chart
          data={data}
          series={[
            { label: 'Rotor', color: '#e8794f', width: 2 },
            { label: 'Solid drive', color: '#93a59a', width: 1, dash: [4, 3] },
          ]}
          xLabel="Drive hub angle (deg)"
          yLabel="Rotor angle (deg)"
          xRange={[0, 360]}
          marker={() => [live.drive, live.mrotor]}
          height={150}
        />
      </Section>
      <Section title="Working">
        <Working steps={steps} />
      </Section>
    </>
  )
}

/* ------------------------------ (c) plugs ------------------------------ */

function PlugPanel() {
  const st = useIgn()
  const tHot = plugTipTemp(st.load, NOSE_MM.hot)
  const tCold = plugTipTemp(st.load, NOSE_MM.cold)
  const status = (t: number) => (t < 450 ? 'fouls (too cold)' : t > 850 ? 'pre-ignition risk' : 'self-cleaning ✓')
  const tone = (t: number) => (t < 450 || t > 850 ? 'warn' : 'accent') as 'warn' | 'accent'
  return (
    <>
      <Section title="Controls">
        <Slider label="Engine load" value={st.load} min={0} max={1} step={0.01} onChange={(load) => st.set({ load })} hint="0 = light, 1 = heavy" />
        <Toggle label="Feeler gauge in the hot plug’s gap" checked={st.gauge} onChange={(gauge) => st.set({ gauge })} />
      </Section>
      <Section title="Heat range" right={<Badge tone="info" title="Indicative tip-temperature model">indicative</Badge>}>
        <div className="grid grid-cols-2 gap-1.5">
          <Readout label="Hot plug tip" value={fmt(tHot, 3)} unit="°C" tone={tone(tHot)} />
          <Readout label="Cold plug tip" value={fmt(tCold, 3)} unit="°C" tone={tone(tCold)} />
          <Readout label="Hot plug" value={<span className="text-[12px]">{status(tHot)}</span>} />
          <Readout label="Cold plug" value={<span className="text-[12px]">{status(tCold)}</span>} />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-dim">
          A hot plug has a longer porcelain nose ({NOSE_MM.hot} mm here), which prevents the escape of heat — used on engines working under lighter loads; cold plugs ({NOSE_MM.cold} mm) are
          preferred for heavier loads. The orange particles show the heat path from the tip to the shell.
        </p>
      </Section>
      <Section title="Spark plug">
        <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] text-ink/85">
          <li>Heat-resistant porcelain insulator housing two electrodes separated by an air gap.</li>
          <li>Parts: terminal nut, insulator, shell, insulated (centre) electrode, earthed electrode, spark gap.</li>
          <li>
            Gap set with a feeler gauge, usually about <b>0.6 mm</b>.
          </li>
          <li>Keep plugs and distributor points clean and the gaps at the recommended values.</li>
        </ul>
      </Section>
    </>
  )
}

/* ------------------------------ (d) starter ------------------------------ */

function StarterPanel() {
  const st = useIgn()
  const v = useLive(() => ({ e: live.engage, m: live.motorRpm, f: live.flyRpm, s: live.stage }), 15, (a, b) => a.e === b.e && a.m === b.m && a.f === b.f && a.s === b.s)
  const ratio = starterRatio(RING_TEETH, PINION_TEETH)
  const steps: WorkingStep[] = [
    { label: 'Gear reduction, pinion to ring gear', tex: 'i = \\dfrac{z_{ring}}{z_{pinion}}', sub: `= \\dfrac{${RING_TEETH}}{${PINION_TEETH}}`, result: `= ${n(ratio, 3)}`, cite: SRC.tb509('§5.6.4 motor drives a small pinion geared to the flywheel') },
    { label: 'Cranking speed', tex: 'N_{engine} = N_{motor}/i', sub: `= 2000/${n(ratio, 3)}`, result: `= ${n(2000 / ratio, 3)}\\ \\text{rpm}`, cite: SRC.beyond('typical starter speed'), beyond: true },
    {
      label: 'Why a starter can drain the battery',
      tex: 't = \\dfrac{C_{Ah}}{I}',
      sub: '= \\dfrac{100\\ \\text{Ah}}{250\\ \\text{A}}',
      result: `= ${n(batteryHours(100, 250) * 60, 3)}\\ \\text{min of continuous cranking}`,
      cite: SRC.tb509('p31 capacity in Ah'),
      beyond: true,
    },
  ]
  return (
    <>
      <Section title="Live">
        <div className="grid grid-cols-2 gap-1.5">
          <Readout label="Stage" value={<span className="text-[12px]">{v.s}</span>} tone="warn" />
          <Readout label="Pinion travel" value={`${Math.round(v.e * 100)}%`} />
          <Readout label="Motor" value={fmt(v.m, 3)} unit="rpm" tone="info" />
          <Readout label="Flywheel" value={fmt(v.f, 3)} unit="rpm" tone="accent" />
        </div>
      </Section>
      <Section title="Controls">
        <div className="grid grid-cols-2 gap-1.5">
          <button className={btn(st.key)} onClick={() => st.set({ key: !st.key })}>
            {st.key ? 'Release key' : 'Turn key to START'}
          </button>
          <button
            className={btn(false)}
            onClick={() => {
              st.set({ key: false })
              starterCmd.stop = true
            }}
          >
            Stop engine
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-snug text-mute">
          Key on: the solenoid pulls its plunger, the lever throws the pinion into mesh, then the main contacts close and the motor cranks the engine. When it fires the flywheel over-runs the pinion
          until you release the key and the pinion is retracted.
        </p>
      </Section>
      <Section title="Working">
        <Working steps={steps} />
      </Section>
    </>
  )
}

/* ------------------------------ (e) charging ------------------------------ */

function ChargingPanel() {
  const st = useIgn()
  const v = useLive(() => ({ soc: live.soc, i: live.chargeA, net: live.netA }), 10, (a, b) => a.soc === b.soc && a.i === b.i)
  const vb = 12.6
  const iD = chargeCurrent((st.rpm * R_CRANK) / R_DYN, vb, DYNAMO)
  const iA = chargeCurrent((st.rpm * R_CRANK) / R_ALT, vb, ALTERNATOR)
  const sg = batterySG(v.soc)
  const data = useMemo(() => {
    const xs: number[] = []
    const d: number[] = []
    const a: number[] = []
    for (let r = 0; r <= 2600; r += 20) {
      xs.push(r)
      d.push(chargeCurrent((r * R_CRANK) / R_DYN, vb, DYNAMO))
      a.push(chargeCurrent((r * R_CRANK) / R_ALT, vb, ALTERNATOR))
    }
    return [xs, d, a]
  }, [])
  const printed = reactionBalance(LEAD_ACID_AS_PRINTED.lhs, LEAD_ACID_AS_PRINTED.rhs)
  const steps: WorkingStep[] = [
    { label: 'Battery voltage', tex: 'V = n_{cells}\\times 2\\ \\text{V}', sub: '= 6\\times2', result: `= ${batteryVoltage(6)}\\ \\text{V}`, cite: SRC.tb509('p31 each cell ≈ 2 V; 12 V for a tractor') },
    { label: 'Capacity in ampere-hours', tex: 't = C/I', sub: '100\\ \\text{Ah}:\\; 100/5,\\; 100/10', result: `= ${batteryHours(100, 5)}\\ \\text{h at 5 A},\\; ${batteryHours(100, 10)}\\ \\text{h at 10 A}`, cite: SRC.tb509('p31') },
    {
      label: 'Discharge reaction',
      tex: '\\text{Pb} + \\text{PbO}_2 + 2\\,\\text{H}_2\\text{SO}_4 \\rightarrow 2\\,\\text{PbSO}_4 + 2\\,\\text{H}_2\\text{O}',
      sub: `\\text{unbalanced: } \\ldots = 2\\text{PbSO}_4 + \\text{H}_2\\text{O}\\;(\\text{H: } ${printed.lhs.H} \\ne ${printed.rhs.H})`,
      result: `\\text{balanced: } ${reactionBalance(LEAD_ACID.lhs, LEAD_ACID.rhs).balanced ? '\\checkmark' : '\\times'}`,
      cite: SRC.tb509('p31'),
      errata: 'The notes print the product as "+ H₂O"; the equation only balances (H 4 = 4, O 10 = 10) with 2H₂O.',
    },
    {
      label: 'Charging begins when the generator EMF exceeds the battery voltage',
      tex: 'N_{cut\\text{-}in} = \\dfrac{V_b}{k_E},\\quad N_{engine} = N_{gen}\\dfrac{D_{gen}}{D_{crank}}',
      sub: `\\text{dynamo } ${n(cutInRpm(vb, DYNAMO), 4)},\\; \\text{alternator } ${n(cutInRpm(vb, ALTERNATOR), 4)}\\ \\text{rpm (generator)}`,
      result: `\\text{engine: } ${n((cutInRpm(vb, DYNAMO) * R_DYN) / R_CRANK, 4)}\\text{ vs } ${n((cutInRpm(vb, ALTERNATOR) * R_ALT) / R_CRANK, 4)}\\ \\text{rpm}`,
      cite: SRC.tb509('§5.6.3 alternator: higher output at lower engine speeds'),
      beyond: true,
    },
  ]
  return (
    <>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Dynamo" value={fmt(iD, 3)} unit="A" tone={st.gen === 'dynamo' ? 'accent' : 'ink'} />
          <Readout label="Alternator" value={fmt(iA, 3)} unit="A" tone={st.gen === 'alternator' ? 'accent' : 'ink'} />
          <Readout label="Net to battery" value={fmt(v.net, 3)} unit="A" tone={v.net >= 0 ? 'info' : 'warn'} />
          <Readout label="State of charge" value={`${Math.round(v.soc * 100)}%`} />
          <Readout label="Electrolyte SG" value={fmt(sg, 3)} tone="info" />
          <Readout label="Battery (open circuit)" value={fmt(6 * cellOpenCircuitVolts(sg), 3)} unit="V" />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-dim">SG 1.27 = fully charged; SG vs charge and the open-circuit voltage are rules of thumb. Battery time runs 600× faster.</p>
      </Section>
      <Section title="Controls">
        <Slider label="Engine speed" value={st.rpm} min={0} max={2600} step={10} unit="rpm" onChange={(rpm) => st.set({ rpm })} />
        <Slider label="Electrical load (lights etc.)" value={st.loadA} min={0} max={40} step={1} unit="A" onChange={(loadA) => st.set({ loadA })} />
        <Segmented<'dynamo' | 'alternator'> label="Generator connected" value={st.gen} onChange={(gen) => st.set({ gen })} options={[{ value: 'dynamo', label: 'Dynamo' }, { value: 'alternator', label: 'Alternator' }]} />
        <button className={btn(false)} onClick={() => (live.soc = 0.3)}>
          Start with a flat battery (30 %)
        </button>
      </Section>
      <Section title="Charging current vs engine speed" right={<Badge tone="info" title="Typical generator characteristics">indicative</Badge>}>
        <Chart
          data={data}
          series={[
            { label: 'Dynamo', color: '#6fb3e0', width: 2 },
            { label: 'Alternator', color: '#9bd17a', width: 2 },
          ]}
          xLabel="Engine speed (rpm)"
          yLabel="Charge current (A)"
          marker={() => [useIgn.getState().rpm, live.chargeA]}
          height={150}
        />
        <p className="mt-1 text-[11px] text-dim">Blue: dynamo (pulley ratio {n(R_CRANK / R_DYN, 3)}); green: alternator ({n(R_CRANK / R_ALT, 3)}). The alternator charges from a lower engine speed.</p>
      </Section>
      <Section title="Working">
        <Working steps={steps} />
      </Section>
    </>
  )
}

/* ------------------------------ root ------------------------------ */

export function IgnitionPanel() {
  const sub = useIgn((s) => s.sub)
  const set = useIgn((s) => s.set)
  const choose = (v: Sub) => {
    set({ sub: v })
    flyTo(CAMERAS[v])
    useView.getState().applyPreset(CUT_FOR[v])
    useView.getState().select(null)
  }
  return (
    <div>
      <Section title="Subsystem">
        <Segmented<Sub> value={sub} onChange={choose} options={SUBS.map((s) => ({ value: s.id, label: s.label, title: s.title }))} size="sm" />
        <p className="text-[11.5px] leading-snug text-mute">{SUBS.find((s) => s.id === sub)?.title}</p>
        {sub === 'coil' ? (
          <div className="mt-1 text-[12px] text-ink/85">
            <Tex tex={'\\text{Primary: battery}\\to\\text{ammeter}\\to\\text{switch}\\to N_1\\to\\text{points}\\;\\|\\;\\text{condenser}'} />
          </div>
        ) : null}
      </Section>
      {sub === 'coil' ? <CoilPanel /> : sub === 'magneto' ? <MagnetoPanel /> : sub === 'plug' ? <PlugPanel /> : sub === 'starter' ? <StarterPanel /> : <ChargingPanel />}
    </div>
  )
}
