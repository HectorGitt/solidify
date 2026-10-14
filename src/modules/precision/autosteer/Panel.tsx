import { useState } from 'react'
import { FIX, type FixMode } from '@/physics/guidance'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '@/modules/powertrain/common/PanelBits'
import { DEFAULTS, FIELD, HISTORY, live, useAutosteer, type AutosteerParams, type FastForward } from './model'

const MODES = Object.keys(FIX) as FixMode[]
const set = (p: Partial<AutosteerParams>) => useAutosteer.setState({ ...p, run: useAutosteer.getState().run + 1 })

const PRESETS: Preset[] = [
  { id: 'rtk', label: 'RTK, 6 m drill', note: 'Centimetre guidance: adjacent passes meet edge to edge. Almost no red (overlap) and no bare strips (gaps).', apply: () => set({ ...DEFAULTS, fix: 'rtk' }) },
  { id: 'eye', label: 'Driver by eye', note: 'Without guidance the driver aims off the last pass’s edge. Small wanders become overlaps and missed strips; most drivers deliberately overlap to avoid misses.', apply: () => set({ ...DEFAULTS, fix: 'manual' }) },
  { id: 'gps', label: 'Uncorrected GNSS', note: 'The position wanders by a metre over minutes, so each pass is off by a different amount: wide overlaps and gaps. Good for logging where you went, not for steering.', apply: () => set({ ...DEFAULTS, fix: 'gps' }) },
  { id: 'sbas', label: 'SBAS, 12 m sprayer', note: 'Free satellite corrections are close enough for wide implements like a sprayer boom, where a few cm hardly matter.', apply: () => set({ ...DEFAULTS, fix: 'sbas', width: 12, speed: 14 }) },
  { id: 'nervous', label: 'Look-ahead too short', note: 'A 1.5 m look-ahead with a slow steering motor overshoots and weaves. A longer look-ahead is calmer but cuts corners in turns — tuning is a trade-off.', apply: () => set({ ...DEFAULTS, lookahead: 1.5, lag: 0.6 }) },
  { id: 'fast', label: 'Fast, slow motor', note: 'At 18 km/h a lagging steering actuator can’t keep up; the error grows and the tractor swings wide in the turns.', apply: () => set({ ...DEFAULTS, speed: 18, lag: 0.7 }) },
]

function LivePanel() {
  const v = useLive(() => ({ xte: live.xte, rms: live.rms, peak: live.peak, steer: live.steer, pass: live.pass, done: live.passesDone, overlap: live.overlap, gap: live.gap, area: live.area, t: live.t, ex: live.errX, ez: live.errZ, fin: live.done }), 8)
  const st = useAutosteer()
  const passLabel = v.fin ? 'field finished' : v.pass >= 0 ? `pass ${v.pass + 1} of ${FIELD.passes}` : 'headland turn'
  return (
    <Section title="Live" right={<Badge tone={st.fix === 'rtk' ? 'accent' : st.fix === 'manual' ? 'mute' : 'info'}>{FIX[st.fix].label}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Cross-track error" value={fmt(v.xte * 100, 3)} unit="cm" tone={Math.abs(v.xte) > 0.1 ? 'warn' : 'accent'} />
        <Readout label="RMS, this pass" value={fmt(v.rms * 100, 3)} unit="cm" />
        <Readout label="Worst, this pass" value={fmt(v.peak * 100, 3)} unit="cm" />
        <Readout label="Steer angle" value={fmt((v.steer * 180) / Math.PI, 2)} unit="°" />
        <Readout label="Position error" value={fmt(Math.hypot(v.ex, v.ez) * 100, 3)} unit="cm" tone="info" />
        <Readout label="Progress" value={passLabel} />
        <Readout label="Overlap" value={fmt(v.overlap * 100, 3)} unit="%" tone={v.overlap > 0.03 ? 'warn' : 'ink'} />
        <Readout label="Missed" value={fmt(v.gap * 100, 3)} unit="%" tone={v.gap > 0.02 ? 'warn' : 'ink'} />
        <Readout label="Area worked" value={fmt(v.area, 3)} unit="ha" />
      </div>
      <Note>Pass accuracy is measured after the first 15 m of each pass (line-in after the turn). Overlap and missed area are measured on the passes finished so far, from where the implement really went. Field time {fmt(v.t / 60, 3)} min.</Note>
    </Section>
  )
}

function XteChart() {
  const data = useLive(
    () => {
      const xs: number[] = []
      const ys: number[] = []
      for (let i = 0; i < live.count; i++) {
        const k = (live.head - live.count + i + HISTORY) % HISTORY
        xs.push(live.histT[k])
        ys.push(live.hist[k])
      }
      if (xs.length < 2) return [[0, 1], [0, 0]]
      return [xs, ys]
    },
    3,
    () => false,
  )
  return (
    <Section title="Cross-track error">
      <Chart data={data} series={[{ label: 'XTE cm', color: '#4fd1ff', width: 1.5 }]} xLabel="Time (s)" yLabel="cm (+ right)" height={150} />
      <Note>Spikes are the headland turns; what matters is how flat the line is along each pass.</Note>
    </Section>
  )
}

function GuidanceWorking() {
  const st = useAutosteer()
  const v = useLive(() => ({ steer: live.steer }), 4)
  const k = (2 * Math.sin(Math.atan(0.3 / st.lookahead))) / st.lookahead
  const steps: WorkingStep[] = [
    {
      label: 'Pure pursuit: curvature to reach the look-ahead point',
      tex: '\\kappa = \\dfrac{2\\,y}{L_d^{2}},\\qquad \\delta = \\arctan(\\kappa\\,l)',
      sub: `L_d = ${n(st.lookahead, 3)}\\ \\text{m},\\ l = ${FIELD.wheelbase}\\ \\text{m};\\ y = 0.3\\ \\text{m}\\ \\Rightarrow\\ \\kappa = ${n(k, 3)}\\ \\text{m}^{-1}`,
      result: `\\delta = ${n((Math.atan(k * FIELD.wheelbase) * 180) / Math.PI, 3)}^\\circ\\ \\text{for 30 cm off-line (now } ${n((v.steer * 180) / Math.PI, 2)}^\\circ)`,
    },
    {
      label: 'Turn radius at a headland',
      tex: 'R = \\dfrac{W}{2},\\quad \\delta = \\arctan\\dfrac{l}{R}',
      sub: `R = ${n(st.width / 2, 3)}\\ \\text{m}`,
      result: `\\delta = ${n((Math.atan(FIELD.wheelbase / (st.width / 2)) * 180) / Math.PI, 3)}^\\circ\\ (\\text{limit } ${n((FIELD.maxSteer * 180) / Math.PI, 3)}^\\circ)`,
    },
    {
      label: 'Cost of overlap',
      tex: '\\text{waste} = \\text{overlap} \\times \\text{area} \\times \\text{input cost}',
      sub: '\\text{e.g. } 8\\,\\% \\times 200\\ \\text{ha} \\times 150\\ \\text{per ha}',
      result: '= 2400\\ \\text{per season, every operation}',
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function AutosteerPanel() {
  const st = useAutosteer()
  const [preset, setPreset] = useState<string | null>(null)
  const change = (p: Partial<AutosteerParams>, restart = false) => {
    setPreset(null)
    if (restart) set(p)
    else st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Positioning">
        <Segmented<FixMode> value={st.fix} onChange={(fix) => change({ fix }, true)} size="sm" options={MODES.map((m) => ({ value: m, label: m === 'manual' ? 'By eye' : m === 'gps' ? 'GNSS' : m.toUpperCase(), title: FIX[m].label }))} />
        <p className="text-[11.5px] leading-snug text-ink/85">
          <b>{FIX[st.fix].label}</b> — pass-to-pass {FIX[st.fix].passToPass}. {FIX[st.fix].note}
        </p>
      </Section>
      <Section title="Controls">
        <Slider label="Speed" value={st.speed} min={4} max={20} step={0.5} unit="km/h" onChange={(speed) => change({ speed })} />
        <Slider label="Implement width" value={st.width} min={4} max={12} step={0.5} unit="m" onChange={(width) => change({ width }, true)} hint="Also the spacing of the guidance lines" />
        <Slider label="Look-ahead distance" value={st.lookahead} min={1} max={12} step={0.5} unit="m" onChange={(lookahead) => change({ lookahead })} hint="Short: tight but nervous. Long: smooth but slow to correct" />
        <Slider label="Steering response" value={st.lag} min={0.05} max={1} step={0.05} unit="s" onChange={(lag) => change({ lag })} hint="Time constant of the steering motor" />
        <div className="flex items-center justify-between text-[12px] text-ink/85">
          <span>Fast-forward</span>
          <Segmented<string> value={String(st.ff)} onChange={(ff) => change({ ff: Number(ff) as FastForward })} size="sm" options={[{ value: '1', label: '1×' }, { value: '5', label: '5×' }, { value: '20', label: '20×' }]} />
        </div>
        <Toggle label="Show satellites" checked={st.sats} onChange={(sats) => change({ sats })} />
        <Toggle label="Show guidance lines" checked={st.lines} onChange={(lines) => change({ lines })} />
        <button onClick={() => useAutosteer.getState().restart()} className="mt-1 w-full rounded-md border border-line-2 px-2 py-1.5 text-[12px] text-ink/85 hover:border-accent/50">
          Restart the field
        </button>
      </Section>
      <Section title="Try">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <XteChart />
      <Section title="Accuracy levels">
        <Table
          head={['', 'pass-to-pass', 'used for']}
          highlight={MODES.indexOf(st.fix)}
          rows={[
            ['By eye', FIX.manual.passToPass, 'everything, before guidance'],
            ['GNSS', FIX.gps.passToPass, 'yield maps, logging'],
            ['SBAS', FIX.sbas.passToPass, 'spraying, spreading'],
            ['RTK', FIX.rtk.passToPass, 'planting, strip-till, CTF'],
          ]}
        />
      </Section>
      <GuidanceWorking />
    </div>
  )
}
