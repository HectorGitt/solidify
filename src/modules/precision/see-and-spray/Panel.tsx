import { useMemo, useState } from 'react'
import { Note, PresetGrid, type Preset } from '@/modules/powertrain/common/PanelBits'
import { expected, patchShift } from '@/physics/spotspray'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DEFAULTS, live, specOf, useSeeSpray, type Mode, type SeeSprayParams } from './model'

const set = (p: Partial<SeeSprayParams>) => useSeeSpray.setState({ ...DEFAULTS, ...p, run: useSeeSpray.getState().run + 1 })

const PRESETS: Preset[] = [
  { id: 'spot', label: 'Spot spraying', note: 'A typical weed load: the system finds about 93 % of the weeds and wets a small patch round each. Most of the field gets no chemical at all.', apply: () => set({}) },
  { id: 'blanket', label: 'Blanket spraying', note: 'Every nozzle on: every weed is hit, but so is every square metre of crop and bare soil.', apply: () => set({ mode: 'blanket' }) },
  { id: 'late', label: 'No latency compensation', note: 'The nozzle opens 120 ms after the weed was due: at 12 km/h the patch lands 40 cm behind it. Almost every weed survives.', apply: () => set({ compensate: false }) },
  { id: 'fast', label: 'Too fast for the look-ahead', note: 'At 22 km/h with the cameras only 0.4 m ahead, the controller cannot open the valve in time even when it tries to fire early.', apply: () => set({ speed: 22, lookAhead: 0.4 }) },
  { id: 'weedy', label: 'Very weedy field', note: 'At 3 weeds/m² the patches start to join up. Savings fall towards blanket spraying — spot spraying pays best in clean fields.', apply: () => set({ density: 3 }) },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 6)
  const st = useSeeSpray()
  const saving = v.blanket > 0 ? 1 - v.sprayed / v.blanket : 0
  const control = v.weedsPassed > 0 ? v.killed / v.weedsPassed : 0
  return (
    <Section title="Live" right={<Badge tone={st.mode === 'spot' ? 'accent' : 'info'}>{st.mode === 'spot' ? 'See & spray' : 'Blanket'}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Weeds passed" value={fmt(v.weedsPassed, 4)} />
        <Readout label="Killed" value={fmt(control * 100, 3)} unit="%" tone={control < 0.85 ? 'warn' : 'accent'} />
        <Readout label="Missed" value={fmt(v.missed, 4)} tone={v.missed > 0 ? 'warn' : 'ink'} />
        <Readout label="Area sprayed" value={fmt(v.sprayed, 3)} unit="m²" />
        <Readout label="Blanket would use" value={fmt(v.blanket, 3)} unit="m²" />
        <Readout label="Chemical saved" value={fmt(saving * 100, 3)} unit="%" tone="info" />
        <Readout label="False detections" value={fmt(v.falseFires, 3)} />
        <Readout label="Strip done" value={fmt(v.progress * 100, 3)} unit="%" />
      </div>
      <Note>Yellow squares: weeds the cameras found. Red squares: false detections. Brown weeds were sprayed; bright yellow-green ones were missed.</Note>
    </Section>
  )
}

function Charts() {
  const st = useSeeSpray()
  const spec = specOf(st)
  const byDensity = useMemo(() => {
    const xs = [0.05, 0.1, 0.2, 0.4, 0.7, 1, 1.5, 2, 3]
    return [xs, xs.map((d) => expected(spec, d, st.speed, 60, 2).saving * 100)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.recall, st.falses, st.buffer, st.latency, st.compensate, st.lookAhead, st.speed])
  const bySpeed = useMemo(() => {
    const xs = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25]
    return [xs, xs.map((s) => expected(spec, st.density, s, 60, 2).control * 100)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.recall, st.falses, st.buffer, st.latency, st.compensate, st.lookAhead, st.density])
  return (
    <>
      <Section title="Chemical saved against weed density">
        <Chart data={byDensity} series={[{ label: 'saved %', color: '#4fd1ff', width: 2 }]} xLabel="Weeds per m²" yLabel="% saved" marker={() => [st.density, byDensity[1][byDensity[0].findIndex((x) => x >= st.density)] ?? 0]} yRange={[0, 100]} height={150} />
      </Section>
      <Section title="Weed control against speed">
        <Chart data={bySpeed} series={[{ label: 'killed %', color: '#35c48a', width: 2 }]} xLabel="Speed (km/h)" yLabel="% killed" marker={() => [st.speed, bySpeed[1][bySpeed[0].findIndex((x) => x >= st.speed)] ?? 0]} yRange={[0, 100]} height={150} />
        <Note>Control drops once the travel during the system’s latency outgrows the look-ahead and the spray margin.</Note>
      </Section>
    </>
  )
}

export function SeeSprayPanel() {
  const st = useSeeSpray()
  const [preset, setPreset] = useState<string | null>(null)
  const change = (p: Partial<SeeSprayParams>) => {
    setPreset(null)
    st.set(p)
  }
  const spec = specOf(st)
  const v = st.speed / 3.6
  const shift = patchShift(spec, v, 0, 0.04)
  const lead = (spec.lookAhead - spec.buffer - 0.04) / v
  const steps: WorkingStep[] = [
    {
      label: 'Time from first sight to the nozzle',
      tex: 't_{lead} = \\dfrac{L_{ahead} - b - r}{v}',
      sub: `= \\dfrac{${n(spec.lookAhead, 3)} - ${n(spec.buffer, 3)} - 0.04}{${n(v, 3)}}`,
      result: `= ${n(lead * 1000, 3)}\\ \\text{ms}\\ \\ (\\text{latency } ${n(st.latency, 3)}\\ \\text{ms})`,
    },
    {
      label: 'Where the patch lands',
      tex: '\\Delta x = v\\,(t_{uncomp} + \\max(0,\\,t_{lat} - t_{lead}))',
      sub: st.compensate ? '\\text{latency compensated: only a late valve moves it}' : `= ${n(v, 3)}\\times${n(spec.latency, 3)}`,
      result: `\\Delta x = ${n(shift * 100, 3)}\\ \\text{cm}\\ \\ (\\text{margin } \\pm${n(st.buffer, 3)}\\ \\text{cm})`,
    },
    {
      label: 'Chemical saved',
      tex: '\\text{saved} = 1 - \\dfrac{\\text{area wetted}}{\\text{area of the strip}}',
      sub: '\\text{patches round weeds and false detections, overlaps counted once}',
      result: `\\approx ${n(expected(spec, st.density, st.speed, 60, 2).saving * 100, 3)}\\,\\%\\ \\text{at this density}`,
    },
  ]
  return (
    <div>
      <LivePanel />
      <Section title="Sprayer">
        <Segmented<Mode> value={st.mode} onChange={(mode) => change({ mode })} size="sm" options={[{ value: 'spot', label: 'See & spray' }, { value: 'blanket', label: 'Blanket' }]} />
        <Slider label="Speed" value={st.speed} min={4} max={25} step={0.5} unit="km/h" onChange={(speed) => change({ speed })} />
        <Slider label="Weed density" value={st.density} min={0.05} max={3} step={0.05} unit="/m²" onChange={(density) => change({ density })} />
      </Section>
      <Section title="Vision and timing">
        <Slider label="Detection rate" value={st.recall} min={0.6} max={1} step={0.01} onChange={(recall) => change({ recall })} hint="Share of weeds the cameras find" />
        <Slider label="False detections" value={st.falses} min={0} max={20} step={0.5} unit="/100 m²" onChange={(falses) => change({ falses })} />
        <Slider label="Latency" value={st.latency} min={20} max={300} step={5} unit="ms" onChange={(latency) => change({ latency })} hint="Image processing + valve opening" />
        <Slider label="Camera look-ahead" value={st.lookAhead} min={0.3} max={1.5} step={0.05} unit="m" onChange={(lookAhead) => change({ lookAhead })} />
        <Slider label="Spray margin" value={st.buffer} min={2} max={20} step={1} unit="cm" onChange={(buffer) => change({ buffer })} hint="Each side of the weed: bigger is safer but uses more" />
        <Toggle label="Fire early to cancel the latency" checked={st.compensate} onChange={(compensate) => change({ compensate })} />
      </Section>
      <Section title="Try">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <Section title="Working">
        <Working steps={steps} />
      </Section>
    </div>
  )
}
