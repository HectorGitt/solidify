import { useMemo, useState } from 'react'
import { SRC, cite } from '@/content/citations'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DEFAULTS, FINAL, ROLLING_R, STUBS, TYPE_INFO, Z, live, ptoRatio, ratedEngineRpm, steadySpeeds, usePto, type GearSel, type Pedal, type PtoParams, type PtoStd, type PtoType } from './model'

const EXAM510 = cite('AEE510', 'WhatsApp Image 2025-07-24 at 11.15.32 (2022/23 final)', 'Q3(c) shaft power')

interface Preset {
  id: string
  label: string
  note: string
  params: Partial<PtoParams>
}

const PRESETS: Preset[] = [
  {
    id: 'live-half',
    label: 'Live PTO · half pedal',
    note: 'Stop the tractor at a blockage without stopping the baler: half pedal releases the transmission plate only. Press fully to stop the PTO as well.',
    params: { type: 'live', pedal: 'half', gear: 'F', lever: true },
  },
  {
    id: 'trans-stop',
    label: 'Transmission PTO · clutch in',
    note: 'One clutch drives both: press it to change gear and the implement stops too — the problem live and independent PTOs solve.',
    params: { type: 'transmission', pedal: 'down', gear: 'F', lever: true },
  },
  {
    id: 'ipto-move',
    label: 'Independent · engage on the move',
    note: 'Driving with the clutch pedal up, switch the independent PTO clutch on and off with its own control. The pedal does not affect it.',
    params: { type: 'independent', pedal: 'up', gear: 'F', lever: false },
  },
  {
    id: 'ground-rev',
    label: 'Ground-speed · reverse',
    note: 'The PTO turns in proportion to the wheels — a powered trailer axle keeps pace with the tractor — and runs backwards when the tractor reverses.',
    params: { type: 'ground', pedal: 'up', gear: 'R', lever: true },
  },
  {
    id: 'rated540',
    label: '540 rpm baler',
    note: 'Set the engine to the speed that gives exactly 540 rpm at the stub for this gear train.',
    params: { type: 'independent', std: '540', lever: true, rpm: Math.round(ratedEngineRpm('540')) },
  },
  {
    id: 'exam-power',
    label: 'Shaft power · P = 2πNT/60',
    note: 'Shaft power at 2000 rpm and 65 N·m: 13.6 kW. The Working shows the torque the same power needs at a 540 or a 1000 rpm stub.',
    params: { type: 'independent', std: '1000', lever: true, rpm: 2000 },
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.pto === b.pto && a.out === b.out && a.engine === b.engine)
  const type = usePto((s) => s.type)
  const running = Math.abs(v.pto) > 5
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Engine" value={fmt(v.engine, 4)} unit="rpm" />
        <Readout label="Gearbox input" value={fmt(v.trans, 3)} unit="rpm" />
        <Readout label="Travel" value={fmt(v.travel, 2)} unit="km/h" tone={Math.abs(v.travel) > 0.05 ? 'accent' : 'ink'} />
        <Readout label="PTO stub" value={fmt(v.pto, 3)} unit="rpm" tone={running ? 'warn' : 'info'} />
        <Readout label="PTO" value={running ? (v.pto > 0 ? 'running ↻' : 'reversed ↺') : 'stopped'} tone={running ? 'warn' : 'info'} />
        {type === 'ground' ? <Readout label="PTO per metre" value={fmt(v.perMetre, 3)} unit="rev/m" /> : <Readout label="Wheel" value={fmt(v.wheel, 3)} unit="rpm" />}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-dim">
        ↻ = clockwise viewed from the rear, the standard PTO rotation. Wheel and travel speed assume a {FINAL} : 1 hub reduction (not drawn) and the Farmland tractor’s {ROLLING_R} m rolling radius.
      </p>
    </Section>
  )
}

const TYPES: PtoType[] = ['transmission', 'live', 'independent', 'ground']
const PEDALS: Pedal[] = ['up', 'half', 'down']

/** Which PTO types keep running at each pedal position — computed from the drive model. */
function StopTable() {
  const rpm = usePto((s) => s.rpm)
  const std = usePto((s) => s.std)
  const rows = useMemo(
    () =>
      TYPES.map((type) => ({
        type,
        cells: PEDALS.map((pedal) => {
          const s = steadySpeeds({ ...DEFAULTS, type, pedal, rpm, std, gear: 'F', lever: true })
          return { pto: Math.abs(s.pto) > 1, wheels: Math.abs(s.crown) > 1 }
        }),
      })),
    [rpm, std],
  )
  const cur = usePto((s) => s.type)
  return (
    <Section title="What stops when the clutch is pressed?">
      <table className="w-full text-[11.5px]">
        <thead className="text-dim">
          <tr>
            <th className="text-left font-normal">PTO type</th>
            <th className="text-center font-normal">pedal up</th>
            <th className="text-center font-normal">half</th>
            <th className="text-center font-normal">full</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.type} className={r.type === cur ? 'text-ink' : 'text-ink/70'}>
              <td className="py-0.5">{TYPE_INFO[r.type].label}</td>
              {r.cells.map((c, i) => (
                <td key={i} className="text-center font-mono">
                  <span className={c.wheels ? 'text-accent' : 'text-dim'}>W</span> <span className={c.pto ? 'text-warn' : 'text-dim'}>{c.pto ? 'PTO' : '—'}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] leading-snug text-dim">
        In first gear with the PTO lever on. <span className="text-accent">W</span> = wheels driven, <span className="text-warn">PTO</span> = PTO running. Only the live PTO
        uses the half-pedal position (two-stage clutch); the others have a single-stage clutch, so any travel releases it.
      </p>
    </Section>
  )
}

function SpeedChart() {
  const rpm = usePto((s) => s.rpm)
  const data = useMemo(() => {
    const xs: number[] = []
    for (let e = 600; e <= 2400; e += 50) xs.push(e)
    return [xs, xs.map((e) => e * ptoRatio('540')), xs.map((e) => e * ptoRatio('1000')), xs.map(() => 540), xs.map(() => 1000)]
  }, [])
  return (
    <Section title="PTO speed vs engine speed">
      <Chart
        data={data}
        series={[
          { label: '540 train', color: '#9bd17a', width: 2 },
          { label: '1000 train', color: '#6fb3e0', width: 2 },
          { label: '540', color: '#93a59a', width: 1, dash: [4, 4] },
          { label: '1000', color: '#93a59a', width: 1, dash: [4, 4] },
        ]}
        xLabel="Engine speed (rpm)"
        yLabel="PTO speed (rpm)"
        marker={() => [live.engine || rpm, Math.abs(live.pto)]}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Standard speed is reached at {Math.round(ratedEngineRpm('540'))} rpm (540) and {Math.round(ratedEngineRpm('1000'))} rpm (1000) engine speed in this train. Tractors
        mark the "PTO speed" on the tachometer.
      </p>
    </Section>
  )
}

function PtoWorking() {
  const rpm = usePto((s) => s.rpm)
  const std = usePto((s) => s.std)
  const [a, b] = std === '540' ? Z.pto540 : Z.pto1000
  const r = ptoRatio(std)
  const P = (2 * Math.PI * 2000 * 65) / 60
  const steps: WorkingStep[] = [
    {
      label: 'Engine to PTO speed through the gear train',
      tex: 'n_{PTO} = n_e\\,\\dfrac{z_1}{z_2}\\cdot\\dfrac{z_3}{z_4}',
      sub: `= ${n(rpm, 4)}\\times\\dfrac{${Z.ptoIn[0]}}{${Z.ptoIn[1]}}\\times\\dfrac{${a}}{${b}}`,
      result: `= ${n(rpm * r, 4)}\\ \\text{rpm}`,
      cite: SRC.top510('p3–4: D·N = d·n, train ratio = Π drivers / Π followers'),
    },
    {
      label: `Engine speed for the standard ${STUBS[std].rpm} rpm`,
      tex: 'n_e = \\dfrac{n_{PTO}}{\\text{ratio}}',
      sub: `= \\dfrac{${STUBS[std].rpm}}{${n(r, 4)}}`,
      result: `= ${n(ratedEngineRpm(std), 4)}\\ \\text{rpm}`,
      cite: SRC.tts510('p10 540 / 1000 rpm'),
    },
    {
      label: 'Shaft power (example: 2000 rpm, 65 N·m)',
      tex: 'P = \\dfrac{2\\pi N T}{60}',
      sub: '= \\dfrac{2\\pi(2000)(65)}{60}',
      result: `= ${n(P / 1000, 3)}\\ \\text{kW}`,
      cite: EXAM510,
    },
    {
      label: 'Torque the same power needs at each PTO speed',
      tex: 'T = \\dfrac{60P}{2\\pi N}',
      sub: `T_{540} = \\dfrac{60(${n(P, 4)})}{2\\pi(540)},\\quad T_{1000} = \\dfrac{60(${n(P, 4)})}{2\\pi(1000)}`,
      result: `T_{540} = ${n((60 * P) / (2 * Math.PI * 540), 4)}\\ \\text{N·m},\\quad T_{1000} = ${n((60 * P) / (2 * Math.PI * 1000), 4)}\\ \\text{N·m}`,
      cite: SRC.tts510('p10'),
      beyond: true,
    },
    {
      label: 'Stub dimensions',
      tex: '\\text{540: 6 splines, } \\varnothing 35\\ \\text{mm};\\quad \\text{1000: 21 splines}',
      result: `\\text{drawn: } ${STUBS[std].splines}\\ \\text{splines, } \\varnothing ${n(STUBS[std].od * 1000, 2)}\\ \\text{mm}`,
      cite: SRC.tts510('p10'),
      errata:
        std === '540'
          ? undefined
          : 'The notes give the 1000 rpm shaft as 21 splines, 44 mm (1¾ in). In ISO 500 / ASABE S203 the 21-spline shaft is 35 mm (1⅜ in); the 44–45 mm (1¾ in) 1000 rpm shaft has 20 splines.',
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function PtoPanel() {
  const st = usePto()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<PtoParams>) => {
    setPreset(null)
    st.set(p)
  }
  const info = TYPE_INFO[st.type]
  return (
    <div>
      <LivePanel />
      <Section title="PTO drive">
        <Segmented<PtoType>
          value={st.type}
          onChange={(type) => set({ type })}
          size="sm"
          options={[
            { value: 'transmission', label: 'Transmission', title: TYPE_INFO.transmission.short },
            { value: 'live', label: 'Live', title: TYPE_INFO.live.short },
            { value: 'independent', label: 'Independent', title: TYPE_INFO.independent.short },
            { value: 'ground', label: 'Ground', title: TYPE_INFO.ground.short },
          ]}
        />
        <p className="-mt-1 mb-2 text-[11.5px] leading-snug text-mute">
          {info.short} <span className="text-ink/85">{info.stops}</span>
        </p>
        <Segmented<Pedal>
          label="Clutch pedal"
          value={st.pedal}
          onChange={(pedal) => set({ pedal })}
          options={[
            { value: 'up', label: 'Up (engaged)' },
            { value: 'half', label: 'Half', title: 'First stage of a two-stage clutch' },
            { value: 'down', label: 'Fully down' },
          ]}
        />
        <Segmented<GearSel>
          label="Gear"
          value={st.gear}
          onChange={(gear) => set({ gear })}
          options={[
            { value: 'F', label: 'Forward' },
            { value: 'N', label: 'Neutral' },
            { value: 'R', label: 'Reverse' },
          ]}
        />
        <Toggle
          label={st.type === 'independent' ? 'Independent PTO clutch on' : 'PTO lever engaged'}
          checked={st.lever}
          onChange={(lever) => set({ lever })}
          hint={st.type === 'independent' ? 'Hydraulic wet clutch with its own control' : 'Dog clutch: engage with the tractor clutch pressed'}
        />
        <Segmented<PtoStd>
          label="PTO standard (stub)"
          value={st.std}
          onChange={(std) => set({ std })}
          size="sm"
          options={[
            { value: '540', label: '540 · 6 × Ø35' },
            { value: '1000', label: '1000 · 21 × Ø35' },
            { value: '1000L', label: '1000 · 20 × Ø45' },
          ]}
        />
        <p className="-mt-1 mb-2 text-[11px] leading-snug text-dim">
          {STUBS[st.std].note} {STUBS[st.std].beyond ? <Badge tone="info">indicative</Badge> : null}
        </p>
        <Slider label="Engine speed" value={st.rpm} min={600} max={2400} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Toggle label="Show power flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
      </Section>
      <Section title="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                st.set({ ...DEFAULTS, ...p.params })
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
      <StopTable />
      <SpeedChart />
      <PtoWorking />
    </div>
  )
}
