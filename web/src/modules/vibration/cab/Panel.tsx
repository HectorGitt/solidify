import { useMemo, useState } from 'react'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../_shared/ui'
import { ANTHRO, C, CAB_HEIGHT, CONTROLS, DEFAULTS, INTERVAL_COLOR, NOISE, OSHA_TABLE, P0, STATION_LABEL, addLevels, dueAt, headroom, noiseAtEar, oshaHours, pressureFor, spl, useCab, type CabParams, type Interval, type Percentile, type Station } from './model'
import { mannequinPose } from './Scene3D'

const apply = (p: Partial<CabParams>) => useCab.getState().set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  { id: 'open', label: 'Open station, 96 dB(A)', note: 'Without a cab the operator hears about 96 dB(A): OSHA allows only about 3½ h a day at that level, so an 8 h day is a dose of about 2.3 × the limit.', apply: () => apply({ station: 'open' }) },
  { id: 'cab', label: 'Cab, 88 dB(A)', note: 'A cab brings the ear level down to about 88 dB(A), inside the 90 dB(A) / 8 h limit — still above the 80 dB(A) design target.', apply: () => apply({ station: 'cab' }) },
  { id: 'two', label: 'Two 80 dB sources', note: 'Levels add as energies, not decibels: two 80 dB sources give 10 log(2 × 10⁸) = 83 dB, not 160 dB. See the Working.', apply: () => apply({ station: 'cab', second: 0 }) },
  { id: '95th', label: '95th percentile in the cab', note: 'The tallest operator (sitting height 97 cm) needs the 185 cm cab height for headroom.', apply: () => apply({ station: 'cab', percentile: 95 }) },
  { id: '5th', label: '5th percentile reach', note: 'The smallest operator (162 cm) must still reach the pedals and the wheel: watch the knee and elbow.', apply: () => apply({ station: 'rops', percentile: 5 }) },
  { id: 'service', label: 'Maintenance · 250 h service', note: 'At 250 h: engine oil and filter, breather, steering box, clutch free play, brakes, fuel water trap, fan belt and radiator core — plus the 10 h and 50 h checks.', apply: () => apply({ interval: 250 }) },
]

function NoisePanel() {
  const st = useCab()
  const z = noiseAtEar(st)
  return (
    <Section title="Live — noise at the operator’s ear">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Level" value={fmt(z.L, 3)} unit="dB(A)" tone={z.L > 90 ? 'warn' : 'accent'} />
        <Readout label="OSHA allows" value={fmt(z.allowed, 3)} unit="h/day" />
        <Readout label="Dose" value={fmt(z.dose * 100, 3)} unit="%" tone={z.dose > 1 ? 'warn' : 'ink'} />
      </div>
      <Note>
        {STATION_LABEL[st.station]}: {z.base} dB(A) measured; target {NOISE.target} dB(A), {fmt(z.overTarget, 2)} dB over. Nebraska tests have recorded the sound level at the operator’s ear in dB(A) since 1971.
      </Note>
    </Section>
  )
}

function ErgoPanel() {
  const st = useCab()
  const a = ANTHRO[st.percentile]
  const h = headroom(st.percentile, st.station)
  const m = mannequinPose(st.percentile)
  return (
    <Section title="Operator fit">
      <Segmented<`${Percentile}`> value={`${st.percentile}`} options={(['5', '50', '95'] as const).map((p) => ({ value: p, label: `${p}th percentile` }))} onChange={(p) => st.set({ percentile: Number(p) as Percentile })} size="sm" />
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Stature" value={fmt(a.height * 100, 3)} unit="cm" />
        <Readout label="Sitting height" value={fmt(a.sitting * 100, 3)} unit="cm" />
        <Readout label="Mass" value={a.mass} unit="kg" />
        <Readout label="Headroom" value={Number.isFinite(h.clearance) ? fmt(h.clearance * 100, 3) : '—'} unit={Number.isFinite(h.clearance) ? 'cm' : 'no roof'} tone={h.clearance < 0.05 ? 'warn' : 'ink'} />
        <Readout label="Reaches wheel" value={m.reachesWheel ? 'yes' : 'no'} tone={m.reachesWheel ? 'ink' : 'warn'} />
        <Readout label="Reaches pedals" value={m.reachesPedal ? 'yes' : 'no'} tone={m.reachesPedal ? 'ink' : 'warn'} />
      </div>
      <Note>Cab height should be {CAB_HEIGHT * 100} cm so the 95th-percentile operator fits; the instrument panel sits about 71 cm away, tilted no more than 45°. Limb lengths are assumed standard body proportions.</Note>
    </Section>
  )
}

function ControlsTable() {
  return (
    <Section title="Controls and instruments">
      <Table head={['#', 'Control', 'Worked by']} rows={CONTROLS.map((c, i) => [i + 1, c.name, c.limb])} />
      <Note>A typical set of 21 numbered controls and instruments. The clutch is worked by the left foot; gauges are grouped (SAE J209) and marked with ASAE S304 symbols.</Note>
    </Section>
  )
}

function Maintenance() {
  const st = useCab()
  const due = st.interval ? dueAt(st.interval) : []
  return (
    <Section title="Maintenance intervals">
      <Segmented<`${Interval}`>
        value={`${st.interval}`}
        options={(['0', '10', '50', '250', '600'] as const).map((v) => ({ value: v, label: v === '0' ? 'Off' : `${v} h` }))}
        onChange={(v) => st.set({ interval: Number(v) as Interval })}
        size="sm"
      />
      {due.length ? (
        <ul className="mt-1 space-y-0.5 text-[11.5px] leading-snug text-ink/90">
          {due.map((s) => (
            <li key={s.item}>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: INTERVAL_COLOR[s.interval] }} />
              {s.interval} h — {s.item}
            </li>
          ))}
        </ul>
      ) : (
        <Note>Choose an interval to tag the service points on the tractor.</Note>
      )}
      <Note>Steering also needs: grease the linkage every 10 h, wheel bearings every 50 h, check the steering-box oil (SAE 90) every 200 h.</Note>
    </Section>
  )
}

function OshaChart() {
  const data = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let L = 85; L <= 116; L += 0.5) {
      xs.push(L)
      ys.push(oshaHours(L))
    }
    return [xs, ys]
  }, [])
  return (
    <Section title="OSHA permissible exposure">
      <Chart
        data={data}
        series={[{ label: 'Permitted hours per day', color: '#e8794f', width: 2 }]}
        xLabel="Sound level dB(A)"
        yLabel="hours"
        logY
        marker={() => {
          const z = noiseAtEar(useCab.getState())
          return [z.L, z.allowed]
        }}
        height={160}
      />
      <Table head={['dB(A)', 'h/day']} rows={OSHA_TABLE.map(([L, h]) => [L, fmt(h, 3)])} />
      <Note>OSHA allows 90 dB(A) for 8 h down to 115 dB(A) for ¼ h, halving the time for every 5 dB in between.</Note>
    </Section>
  )
}

function NoiseWorking() {
  const st = useCab()
  const z = noiseAtEar(st)
  const P = pressureFor(z.L)
  const steps: WorkingStep[] = [
    {
      label: 'Sound pressure level',
      tex: 'SPL = 20\\log_{10}\\dfrac{P}{P_0},\\quad P_0 = 2\\times10^{-5}\\ \\text{N/m}^2',
      sub: `= 20\\log_{10}\\dfrac{${n(P, 4)}}{${P0}}`,
      result: `= ${n(spl(P), 4)}\\ \\text{dB}`,
      cite: C.he('p6–8, eqs 2–5'),
    },
    {
      label: '+6 dB doubles the sound pressure',
      tex: '\\dfrac{P_2}{P_1} = 10^{6/20}',
      result: `= ${n(10 ** (6 / 20), 4)}`,
      cite: C.he('p8'),
    },
    {
      label: 'Two 80 dB sources',
      tex: 'L = 10\\log_{10}\\left(10^{8}+10^{8}\\right)',
      result: `= ${n(addLevels(80, 80), 4)}\\ \\text{dB}`,
      cite: C.he('p8–9'),
    },
    {
      label: 'Permitted daily exposure (OSHA)',
      tex: 'T = \\dfrac{8}{2^{(L-90)/5}}',
      sub: `= \\dfrac{8}{2^{(${n(z.L, 4)}-90)/5}}`,
      result: `= ${n(z.allowed, 4)}\\ \\text{h}`,
      cite: C.he('p6 — 90 dBA 8 h … 115 dBA ¼ h'),
    },
    {
      label: 'Noise dose for the working day',
      tex: 'D = \\dfrac{t}{T}',
      sub: `= \\dfrac{${n(st.hours, 3)}}{${n(z.allowed, 4)}}`,
      result: `= ${n(z.dose * 100, 4)}\\ \\%`,
      beyond: true,
    },
  ]
  return (
    <Section title="Working — noise">
      <Slider label="Hours on the tractor" value={st.hours} min={1} max={12} step={0.5} unit="h/day" onChange={(hours) => st.set({ hours })} />
      <Slider label="Second source at the station" value={st.second} min={0} max={100} step={1} unit="dB(A)" onChange={(second) => st.set({ second })} hint="0 = none; e.g. a PTO machine running beside the tractor" />
      <Working steps={steps} />
    </Section>
  )
}

export function CabPanel() {
  const st = useCab()
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <Section title="Operator station">
        <Segmented<Station>
          value={st.station}
          options={(['open', 'rops', 'cab'] as Station[]).map((s) => ({ value: s, label: STATION_LABEL[s] }))}
          onChange={(station) => {
            setPreset(null)
            st.set({ station })
          }}
          size="sm"
        />
        <Toggle label="Number the controls" checked={st.numbers} onChange={(numbers) => st.set({ numbers })} />
        <Toggle label="Show engine noise" checked={st.waves} onChange={(waves) => st.set({ waves })} />
      </Section>
      <NoisePanel />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <ErgoPanel />
      <Maintenance />
      <OshaChart />
      <NoiseWorking />
      <ControlsTable />
    </div>
  )
}
