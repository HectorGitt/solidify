import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { brakePlacement, type FinalDriveLayout } from '@/physics/drives'
import { groundSpeedKmh } from '@/physics/transmission'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../common/PanelBits'
import { CROWN_RATIO, DEFAULTS, EPI, LAYOUTS, SPUR, chain, live, useFinal } from './model'

const set = (p: Partial<typeof DEFAULTS>) => useFinal.getState().set(p)
/** Rolling radius of a 14.9-28 rear tyre (Farmland tractor, AEE502). */
const ROLL_R = 0.635

const PRESETS: Preset[] = [
  { id: 'bottom', label: 'Bottom gear', note: 'Engine 2000 rpm, gearbox 5.2 : 1 in bottom gear: three reductions take it to ≈ 20 rpm at the wheels — about 100 : 1 overall.', apply: () => set({ ...DEFAULTS, gearbox: 5.2 }) },
  { id: 'spur', label: 'Spur reduction', note: 'Brake on the outer end of the fast differential shaft; a small spur pinion drives a large gear on the wheel axle.', apply: () => set({ ...DEFAULTS, layout: 'spur' }) },
  { id: 'epi', label: 'Outboard epicyclic', note: 'Brake inboard near the differential; an epicyclic unit at the outer end of each axle housing.', apply: () => set({ ...DEFAULTS, layout: 'epicyclic' }) },
  { id: 'mf', label: 'MF 2000 axle', note: 'Hydraulic diff lock, one large oil-immersed brake disc and the epicyclic, all at the inboard end of the trumpet housing.', apply: () => set({ ...DEFAULTS, layout: 'mf2000' }) },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 12, (a, b) => a.hub === b.hub && a.shaft === b.shaft)
  const st = useFinal()
  const rows = chain(st)
  const wheelT = rows[2].torque
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Engine" value={fmt(st.engineRpm, 4)} unit="rpm" />
        <Readout label="Bevel pinion" value={fmt(v.pinion, 4)} unit="rpm" />
        <Readout label="Half shaft" value={fmt(v.shaft, 4)} unit="rpm" tone="info" />
        <Readout label="Wheel" value={fmt(Math.abs(v.hub), 3)} unit="rpm" tone="accent" />
        <Readout label="Wheel torque" value={fmt(wheelT / 1000, 3)} unit="kN·m" tone="accent" />
        <Readout label="Ground speed" value={fmt(groundSpeedKmh(Math.abs(v.hub), ROLL_R), 3)} unit="km/h" />
      </div>
      {st.braking ? <Note tone="warn">Brake applied: the half shaft is held, so the whole axle stops (clutch out).</Note> : null}
    </Section>
  )
}

function StageChart() {
  const st = useFinal()
  const data = useMemo(() => {
    const rows = chain(st)
    return [[0, 1, 2, 3], [st.engineRpm, ...rows.map((r) => r.rpm)], [st.engineTorque, ...rows.map((r) => r.torque)]]
  }, [st])
  return (
    <Section title="Speed falls, torque rises">
      <Chart
        data={data}
        series={[
          { label: 'speed (rpm)', color: '#6fb3e0', width: 2, points: true },
          { label: 'torque (N·m)', color: '#f5b942', width: 2, points: true },
        ]}
        xLabel="0 engine · 1 gearbox · 2 crown wheel · 3 final drive"
        yLabel="rpm (blue)  |  N·m (gold)"
        logY
        height={170}
      />
      <Note>Log scale. Speed is divided and torque multiplied (less ≈ 2 % per gear pair) at each of the three reductions.</Note>
    </Section>
  )
}

function FinalWorking() {
  const st = useFinal()
  const rows = chain(st)
  const iF = LAYOUTS[st.layout].ratio
  const b = brakePlacement(rows[2].torque, iF, 0.35, 0.12, 2)
  const steps: WorkingStep[] = [
    {
      label: '1 · Gearbox',
      tex: 'N_1 = \\dfrac{N_e}{i_g},\\quad T_1 = T_e\\,i_g\\,\\eta^{2}',
      sub: `= \\dfrac{${n(st.engineRpm, 4)}}{${n(st.gearbox, 3)}},\\quad ${n(st.engineTorque, 4)}\\times${n(st.gearbox, 3)}\\times0.98^2`,
      result: `N_1 = ${n(rows[0].rpm, 4)}\\ \\text{rpm},\\ T_1 = ${n(rows[0].torque, 4)}\\ \\text{N·m}`,
      cite: SRC.tts510('p10'),
    },
    {
      label: '2 · Crown wheel & pinion',
      tex: 'i_c = \\dfrac{z_{crown}}{z_{pinion}}',
      sub: `= \\dfrac{47}{11} = ${n(CROWN_RATIO, 4)}`,
      result: `N_2 = ${n(rows[1].rpm, 4)}\\ \\text{rpm},\\ T_2 = ${n(rows[1].torque, 4)}\\ \\text{N·m}`,
      cite: SRC.tts510('p7'),
    },
    {
      label: `3 · Final reduction — ${LAYOUTS[st.layout].label}`,
      tex: st.layout === 'spur' ? 'i_f = \\dfrac{z_{gear}}{z_{pinion}}' : st.layout === 'straight' ? 'i_f = 1' : 'i_f = 1 + \\dfrac{z_{ring}}{z_{sun}}\\ \\ (\\text{ring held})',
      sub: st.layout === 'spur' ? `= \\dfrac{${SPUR.gear}}{${SPUR.pinion}}` : st.layout === 'straight' ? '' : `= 1 + \\dfrac{${EPI.ring}}{${EPI.sun}}`,
      result: `i_f = ${n(iF, 4)},\\ N_w = ${n(rows[2].rpm, 4)}\\ \\text{rpm},\\ T_w = ${n(rows[2].torque, 4)}\\ \\text{N·m}`,
      cite: st.layout === 'mf2000' ? SRC.top510('p10 Fig A2.15') : SRC.tts510('p8–10 Figs 35a/b'),
      beyond: st.layout === 'epicyclic' || st.layout === 'mf2000',
    },
    {
      label: 'Overall reduction',
      tex: 'i = i_g\\,i_c\\,i_f,\\qquad \\eta = 0.98^{\\,pairs}',
      sub: `= ${n(st.gearbox, 3)}\\times${n(CROWN_RATIO, 4)}\\times${n(iF, 4)}`,
      result: `= ${n(rows[2].overall, 4)} : 1,\\quad \\eta = ${n(rows[2].eta, 3)}`,
      cite: SRC.tts510('p1 (> 2000 rpm → ≈ 20 rpm)'),
    },
    {
      label: 'Why the brake sits on the fast shaft',
      tex: 'T_{shaft} = \\dfrac{T_{wheel}}{i_f},\\qquad F = \\dfrac{T}{\\mu\\,r\\,n}',
      sub: `= \\dfrac{${n(rows[2].torque, 4)}}{${n(iF, 4)}}\\quad(\\mu = 0.35,\\ r = 0.12\\ \\text{m},\\ n = 2)`,
      result: `T_{shaft} = ${n(b.torqueOnShaft, 4)}\\ \\text{N·m}:\\ F = ${n(b.forceOnShaft / 1000, 3)}\\ \\text{kN vs } ${n(b.forceOnWheel / 1000, 3)}\\ \\text{kN at the wheel}`,
      cite: SRC.tts510('p11'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function FinalPanel() {
  const st = useFinal()
  const [preset, setPreset] = useState<string | null>(null)
  const change = (p: Partial<typeof DEFAULTS>) => {
    setPreset(null)
    st.set(p)
  }
  const rows = chain(st)
  return (
    <div>
      <LivePanel />
      <Section title="Arrangement">
        <Segmented<FinalDriveLayout>
          value={st.layout}
          size="sm"
          onChange={(layout) => change({ layout })}
          options={(Object.keys(LAYOUTS) as FinalDriveLayout[]).map((k) => ({ value: k, label: k === 'mf2000' ? 'MF A2.15' : k === 'epicyclic' ? 'Epicyclic' : k === 'spur' ? 'Spur' : 'Straight', title: LAYOUTS[k].label }))}
        />
        <Slider label="Gearbox ratio (gear selected)" value={st.gearbox} min={1} max={8} step={0.1} unit=": 1" onChange={(gearbox) => change({ gearbox })} />
        <Slider label="Engine speed" value={st.engineRpm} min={800} max={2400} step={10} unit="rpm" onChange={(engineRpm) => change({ engineRpm })} />
        <Slider label="Engine torque" value={st.engineTorque} min={50} max={400} step={5} unit="N·m" onChange={(engineTorque) => change({ engineTorque })} />
        <Toggle label="Apply the brakes" checked={st.braking} onChange={(braking) => st.set({ braking })} />
      </Section>
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="The three reductions">
        <Table
          head={['Stage', 'i', 'rpm', 'N·m']}
          rows={[['Engine', '—', fmt(st.engineRpm, 4), fmt(st.engineTorque, 3)], ...rows.map((r) => [r.name, fmt(r.ratio, 3), fmt(r.rpm, 3), fmt(r.torque, 4)])]}
          highlight={3}
        />
      </Section>
      <StageChart />
      <Section title="Exam points">
        <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-ink/85">
          <li>Four types of final drive: straight axle, pinion, planetary, chain. All but the straight axle reduce speed.</li>
          <li>Final drives also carry the machine’s weight and take shock loads.</li>
          <li>Torque increases at three points: gearbox, crown wheel & pinion, final reduction.</li>
          <li>Brakes are more effective on a fast, low-torque shaft — between the differential and the final reduction.</li>
        </ul>
      </Section>
      <FinalWorking />
    </div>
  )
}
