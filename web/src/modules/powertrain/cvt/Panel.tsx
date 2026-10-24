import { useMemo, useState } from 'react'
import { CVT, TRACTOR, enginePower, groundSpeed, leverForRatio, outputRatio, powerFlow, swash } from '@/physics/cvt'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PowerLegend, PresetGrid, type Preset } from '../common/PanelBits'
import { DEFAULTS, live, radToRpm, rpmToRad, useCvt, type CvtParams, type Range } from './model'

const set = (p: Partial<CvtParams>) => useCvt.getState().set(p)

const PRESETS: Preset[] = [
  {
    id: 'standstill',
    label: 'Active standstill',
    note: 'Speed 0 with the engine running and no clutch: the pump swashplate is upright, so it moves no oil, the motor cannot turn and it holds the tractor. The ring just spins free. Loop pressure is whatever the motor needs to hold the load.',
    apply: () => set({ ...DEFAULTS, target: 0, pull: 15 }),
  },
  {
    id: 'plough',
    label: 'Heavy draft, 7 km/h',
    note: 'Low speed, big pull: most of the power still goes through the oil, so efficiency is lower — and the pressure is high. This is where the transmission works hardest.',
    apply: () => set({ ...DEFAULTS, target: 7, pull: 55, rpm: 1900 }),
  },
  {
    id: 'mech',
    label: 'Pure gear point',
    note: 'Top of the field range: the motor swashplate is flat, the ring and pump stop, and every watt goes through gears. The most efficient point of the range (≈ 97 % here).',
    apply: () => set({ ...DEFAULTS, target: 30, pull: 10, rpm: 2100 }),
  },
  {
    id: 'road',
    label: 'Road, 50 km/h at low rpm',
    note: 'Road range at 1500 rpm: the ratio, not the engine speed, sets the travel speed, so the engine can run slow and save fuel. Engine-speed limited: top speed at 1500 rpm is 60 × 1500/2100 ≈ 43 km/h, so the tractor tops out below 50.',
    apply: () => set({ ...DEFAULTS, range: 'road', target: 50, pull: 0, rpm: 1500 }),
  },
  {
    id: 'reverse',
    label: 'Reverse shuttle',
    note: 'Swing the pump past zero and the output turns backwards — no reverse gear. The gear branch now runs backwards: power circulates round the loop (hydraulic share above 100 %), which is why reverse is less efficient.',
    apply: () => set({ ...DEFAULTS, target: -8, pull: 5 }),
  },
  {
    id: 'limit',
    label: 'Engine overload',
    note: 'Ask for 20 km/h with a 70 kN pull: that needs more than the engine’s 200 kW. Instead of stalling, the controller lowers the ratio until the engine can cope — the tractor slows down.',
    apply: () => set({ ...DEFAULTS, target: 20, pull: 70, rpm: 2100 }),
  },
]

function phaseText(L: number) {
  if (L < -0.01) return 'Reverse: pump swung back'
  if (L < 0.01) return 'Active standstill'
  if (L <= 1) return 'Phase 1: pump swinging out'
  if (L < 1.99) return 'Phase 2: motor swinging back'
  return 'Pure gear drive'
}

function LivePanel() {
  const v = useLive(() => ({ ...live }), 12, (a, b) => a.L === b.L && a.dp === b.dp && a.limited === b.limited)
  const st = useCvt()
  const avail = enginePower(st.rpm)
  return (
    <Section title="Live" right={v.limited && !st.manual ? <Badge tone="warn">Limited by engine power</Badge> : <Badge tone="accent">{phaseText(v.L)}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Ground speed" value={fmt(v.speed, 3)} unit="km/h" tone="accent" />
        <Readout label="Engine" value={fmt(radToRpm(v.engine), 4)} unit="rpm" />
        <Readout label="Output shaft" value={fmt(radToRpm(v.out), 4)} unit="rpm" />
        <Readout label="Pump displacement" value={fmt(v.alpha * 100, 3)} unit="%" tone="info" />
        <Readout label="Motor displacement" value={fmt(v.beta * 100, 3)} unit="%" tone="info" />
        <Readout label="Ring / pump" value={`${fmt(radToRpm(v.ring), 3)} / ${fmt(radToRpm(v.pump), 3)}`} unit="rpm" />
        <Readout label="Through the oil" value={fmt(v.hydShare * 100, 3)} unit="%" tone={v.hydShare > 1 ? 'warn' : 'ink'} />
        <Readout label="Efficiency" value={fmt(v.efficiency * 100, 3)} unit="%" tone={v.efficiency < 0.85 ? 'warn' : 'accent'} />
        <Readout label="Loop pressure" value={fmt(Math.abs(v.dp) / 1e5, 3)} unit="bar" tone={Math.abs(v.dp) > CVT.dpMax ? 'warn' : 'ink'} />
        <Readout label="Engine power" value={`${fmt(v.Pin / 1e3, 3)} / ${fmt(avail / 1e3, 3)}`} unit="kW" />
        <Readout label="Engine torque" value={fmt(v.Te, 3)} unit="N·m" />
        <Readout label="Drawbar power" value={fmt((st.pull * 1e3 * Math.abs(v.speed)) / 3.6 / 1e3, 3)} unit="kW" />
      </div>
      {Math.abs(v.dp) > CVT.dpMax ? <Note tone="warn">Above the {fmt(CVT.dpMax / 1e5, 3)} bar relief setting — a real transmission would cut back the pull here.</Note> : null}
    </Section>
  )
}

/** Efficiency and hydraulic share across the range at the current settings. */
function RangeChart() {
  const st = useCvt()
  const data = useMemo(() => {
    const we = rpmToRad(st.rpm)
    const xs: number[] = []
    const eff: number[] = []
    const share: number[] = []
    for (let L = 0.04; L <= 2.0001; L += 0.02) {
      const { alpha, beta } = swash(L)
      const v = groundSpeed(outputRatio(alpha, beta) * we, st.range)
      const pf = powerFlow(L, we, 500)
      xs.push(v)
      eff.push(pf.efficiency * 100)
      share.push(pf.hydShare * 100)
    }
    return [xs, eff, share]
  }, [st.rpm, st.range])
  return (
    <Section title="Efficiency across the range">
      <Chart
        data={data}
        series={[
          { label: 'efficiency %', color: '#35c48a', width: 2 },
          { label: 'through the oil %', color: '#f5b942', width: 1.5 },
        ]}
        xLabel={`Ground speed (km/h, ${st.range} range, ${st.rpm} rpm)`}
        yLabel="%"
        marker={() => [Math.max(0, live.speed), live.efficiency * 100]}
        yRange={[0, 100]}
        height={170}
      />
      <Note>
        The less power goes through the oil, the higher the efficiency: gears lose ≈ {fmt((1 - CVT.etaMech) * 100, 2)} %, the pump-and-motor pair ≈ {fmt((1 - CVT.etaHyd) * 100, 2)} %. Two ranges let the tractor sit near the pure-gear
        point both in the field and on the road.
      </Note>
    </Section>
  )
}

function CvtWorking() {
  const st = useCvt()
  const v = useLive(() => ({ L: live.L, engine: live.engine }), 4, (a, b) => Math.abs(a.L - b.L) < 0.002)
  const we = rpmToRad(st.rpm)
  const { alpha, beta } = swash(v.L)
  const ratio = outputRatio(alpha, beta)
  const i = st.range === 'field' ? TRACTOR.iField : TRACTOR.iRoad
  const To = ((st.pull * 1e3 + TRACTOR.rr * TRACTOR.mass * 9.81) * TRACTOR.r) / (i * TRACTOR.etaFinal)
  const pf = powerFlow(v.L, we, To)
  const steps: WorkingStep[] = [
    {
      label: 'Planetary speeds (Willis), carrier = engine',
      tex: 'z_s\\,\\omega_o + z_r\\,\\omega_r = (z_s + z_r)\\,\\omega_e',
      sub: `${CVT.zs}\\,\\omega_o + ${CVT.zr}\\,\\omega_r = ${CVT.zs + CVT.zr}\\times${n(we, 4)}`,
      result: `\\omega_o = ${n(pf.out, 4)},\\ \\omega_r = ${n(pf.ring, 4)}\\ \\text{rad/s}`,
    },
    {
      label: 'Oil continuity, pump = motor flow',
      tex: '\\alpha V\\,(k_r\\,\\omega_r) = \\beta V\\,(k_m\\,\\omega_o)',
      sub: `\\alpha = ${n(alpha, 3)},\\ \\beta = ${n(beta, 3)},\\ k_r = ${n(CVT.kr, 3)},\\ k_m = ${n(CVT.km, 3)}`,
      result: `Q = ${n(Math.abs(alpha * CVT.V * pf.pump * 60 * 1000) / (2 * Math.PI), 4)}\\ \\text{L/min}`,
    },
    {
      label: 'Overall ratio',
      tex: '\\dfrac{\\omega_o}{\\omega_e} = \\dfrac{(z_s+z_r)\\,\\alpha k_r}{z_s\\,\\alpha k_r + z_r\\,\\beta k_m}',
      sub: `= \\dfrac{${CVT.zs + CVT.zr}\\times${n(alpha * CVT.kr, 3)}}{${CVT.zs}\\times${n(alpha * CVT.kr, 3)} + ${CVT.zr}\\times${n(beta * CVT.km, 3)}}`,
      result: `= ${n(ratio, 4)}\\quad(0\\ \\text{at}\\ \\alpha = 0,\\ ${n((CVT.zs + CVT.zr) / CVT.zs, 4)}\\ \\text{at}\\ \\beta = 0)`,
    },
    {
      label: 'Torque split at the carrier',
      tex: 'T_s : T_r : T_c = z_s : z_r : (z_s+z_r)',
      sub: `T_o = ${n(To, 4)}\\ \\text{N·m at the output}`,
      result: `T_s = ${n(pf.Ts, 4)},\\ T_r = ${n(pf.Tr, 4)},\\ T_{motor} = ${n(pf.Tmotor, 4)}\\ \\text{N·m}`,
    },
    {
      label: 'Loop pressure',
      tex: '\\Delta p = \\dfrac{2\\pi\\,T_{pump}}{\\alpha V}',
      sub: `= \\dfrac{2\\pi\\times${n(pf.Tpump, 4)}}{${n(alpha, 3)}\\times${n(CVT.V * 1e6, 4)}\\times10^{-6}}`,
      result: `= ${n(Math.abs(pf.dp) / 1e5, 4)}\\ \\text{bar}`,
    },
    {
      label: 'Power through the oil, and efficiency',
      tex: 'h = \\dfrac{T_o - T_s}{T_o},\\quad \\eta = \\dfrac{P_o}{P_o + |P_m|(\\tfrac{1}{\\eta_m}-1) + |P_h|(\\tfrac{1}{\\eta_h}-1)}',
      sub: `h = ${n(pf.hydShare * 100, 3)}\\,\\%,\\ \\eta_m = ${CVT.etaMech},\\ \\eta_h = ${CVT.etaHyd}`,
      result: `\\eta = ${n(pf.efficiency * 100, 3)}\\,\\%`,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function CvtPanel() {
  const st = useCvt()
  const [preset, setPreset] = useState<string | null>(null)
  const change = (p: Partial<CvtParams>) => {
    setPreset(null)
    st.set(p)
  }
  const vmax = st.range === 'field' ? 30 : 60
  return (
    <div>
      <LivePanel />
      <Section title="Drive">
        <Segmented<Range>
          value={st.range}
          onChange={(range) => change({ range, target: Math.min(st.target, range === 'field' ? 30 : 60) })}
          size="sm"
          options={[
            { value: 'field', label: 'Field range (0–30)' },
            { value: 'road', label: 'Road range (0–60)' },
          ]}
        />
        {st.manual ? (
          <Slider label="Drive lever" value={st.lever} min={CVT.leverMin} max={CVT.leverMax} step={0.01} onChange={(lever) => change({ lever })} hint="0–1 swings the pump out, 1–2 swings the motor back, below 0 is reverse" />
        ) : (
          <Slider label="Requested speed" value={st.target} min={-vmax / 3} max={vmax} step={0.5} unit="km/h" onChange={(target) => change({ target })} hint="The controller sets both swashplates to give this speed" />
        )}
        <Slider label="Engine speed" value={st.rpm} min={900} max={2100} step={10} unit="rpm" onChange={(rpm) => change({ rpm })} hint="Travel speed no longer depends on it — only the power available does" />
        <Slider label="Drawbar pull" value={st.pull} min={0} max={80} step={1} unit="kN" onChange={(pull) => change({ pull })} />
        <Toggle label="Move the drive lever myself" checked={st.manual} onChange={(manual) => change({ manual, lever: manual ? Math.min(2, Math.max(CVT.leverMin, leverForRatio(live.out / Math.max(1e-6, live.engine)))) : st.lever })} />
        <Toggle label="Show oil flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        <Toggle label="Colour the power paths" checked={st.powerFlow} onChange={(powerFlow) => st.set({ powerFlow })} />
        {st.powerFlow ? (
          <>
            <PowerLegend />
            <Note>Yellow = the hydraulic branch (ring, gears to pump and motor). Red/blue lines = high/low pressure.</Note>
          </>
        ) : null}
      </Section>
      <Section title="Try">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <RangeChart />
      <CvtWorking />
    </div>
  )
}
