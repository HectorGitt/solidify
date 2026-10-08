import { useMemo, useState } from 'react'
import { huntingSprocketRadius, RECOMMENDED_SAG, slackFromSag, trackGroundPressure, UNDERCARRIAGE_COST } from '@/physics/tyres'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DIM, MISALIGN, RS, SHOES, TT, live, trackState, useTracks, type ChainType, type Misalign, type ShoeType } from './model'

const STATE_TONE = { 'too tight': 'warn', correct: 'accent', 'too loose': 'warn' } as const
const EFFECTS = {
  'too tight': 'Great friction between pins and bushings as the links hinge round sprocket and idler: fast wear of pins, bushings, links, sprocket and idler, lost horsepower, very hot running — pins and bushings can fuse — and damage to final-drive hubs, bearings and gears.',
  correct: 'About 1 in of sag halfway between carrier roller and front idler: maximum service life.',
  'too loose': 'The track fails to stay aligned and tends to come off in turns (wearing idler flanges, roller flanges and sprocket sides), whips at speed (impact loads on the carrier roller), and lets the sprocket jump teeth, especially in reverse.',
}

const TIPS = [
  'Avoid reckless operation over rough, rocky ground.',
  'Don’t spin the tracks — apply loads gradually.',
  'Slow down, especially over rough terrain; avoid high-speed reverse.',
  'Stay off concrete and other hard surfaces when possible.',
  'Keep roller guards in place, especially in rock.',
  'Clean out packed mud; check tension more often in mud, snow or sand.',
  'Don’t park across a slope (strains roller seals); in frost park on a hard surface.',
  'Check track-bolt tightness and inspect the track regularly.',
]

function LivePanel() {
  const adjust = useTracks((s) => s.adjust)
  const speed = useTracks((s) => s.speed)
  const ts = useMemo(() => trackState(adjust), [adjust])
  const v = useLive(() => ({ rev: live.sprocketRev, eng: live.toothEngaged }), 10, (a, b) => a.rev === b.rev && a.eng === b.eng)
  const rpm = ((speed / 3.6) / (2 * Math.PI * RS)) * 60
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Sag (front span)" value={fmt(ts.sag2 * 1000, 3)} unit={`mm · ${fmt(ts.sag2 / 0.0254, 2)} in`} tone="accent" />
        <Readout label="Tension" value={ts.state} tone={STATE_TONE[ts.state]} />
        <Readout label="Strand pull" value={Number.isFinite(ts.tension) ? fmt(ts.tension / 1000, 3) : '≫'} unit="kN" />
        <Readout label="Sprocket" value={fmt(rpm, 3)} unit="rpm" />
        <Readout label="Revolution" value={v.rev + 1} />
        <Readout label="Tooth 0 drives" value={v.eng ? 'yes' : 'no'} tone={v.eng ? 'info' : 'ink'} unit="this rev" />
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{EFFECTS[ts.state]}</p>
      {ts.springComp > 0 ? <p className="mt-1 text-[11.5px] leading-snug text-warn">The chain is drawn straight: the extra {fmt(ts.springComp * 1000, 2)} mm of adjuster travel is compressing the recoil spring instead of moving the idler.</p> : null}
    </Section>
  )
}

function SagChart() {
  const adjust = useTracks((s) => s.adjust)
  const data = useMemo(() => {
    const xs: number[] = []
    const sag: number[] = []
    for (let a = -40; a <= 6.0001; a += 0.5) {
      xs.push(a)
      sag.push(trackState(a).sag2 * 1000)
    }
    return { xs, sag, ref: xs.map(() => RECOMMENDED_SAG * 1000) }
  }, [])
  return (
    <Section title="Sag vs adjuster travel">
      <Chart data={[data.xs, data.sag, data.ref]} series={[{ label: 'sag', color: '#9bd17a', width: 2 }, { label: '1 in', color: '#93a59a', dash: [4, 4] }]} xLabel="Idler travel from setting (mm, + = grease in)" yLabel="Sag (mm)" height={160} marker={() => [adjust, trackState(adjust).sag2 * 1000]} />
      <p className="mt-1 text-[11px] leading-snug text-dim">Sag is very sensitive: the whole 1 in of sag needs only ≈{fmt(trackState(0).slack * 1000, 2)} mm of spare chain, so a few strokes of the grease gun change it a lot. Parabolic strand model (indicative).</p>
    </Section>
  )
}

function CostCalc() {
  const [price, setPrice] = useState(120)
  const [service, setService] = useState(10)
  return (
    <Section title="Undercarriage cost">
      <Slider label="Crawler purchase price" value={price} min={20} max={400} step={5} unit="k$" onChange={setPrice} />
      <Slider label="Annual service cost" value={service} min={1} max={60} step={0.5} unit="k$/yr" onChange={setService} />
      <div className="grid grid-cols-2 gap-1.5">
        <Readout label="Undercarriage share" value={fmt(price * UNDERCARRIAGE_COST.purchase, 3)} unit="k$ (20 %)" />
        <Readout label="Its service cost" value={fmt(service * UNDERCARRIAGE_COST.service, 3)} unit="k$/yr (50 %)" tone="warn" />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-dim">The track and undercarriage may be 20 % of a crawler’s purchase cost and 50 % of its service cost — hence the care in operation and adjustment.</p>
    </Section>
  )
}

function TrackWorking() {
  const adjust = useTracks((s) => s.adjust)
  const mass = useTracks((s) => s.mass)
  const ts = trackState(adjust)
  const span = ts.geo.s2
  const ground = trackGroundPressure(mass * 1000 * 9.81, DIM.shoeW, ts.xi - DIM.xs)
  const steps: WorkingStep[] = [
    {
      label: 'Hunting tooth: bushings per sprocket revolution',
      tex: '\\frac{z}{2} = \\frac{25}{2} = 12.5\\ \\text{bushings}\\;\\Rightarrow\\;\\text{each tooth drives on alternate revolutions}',
      sub: `R = \\frac{p}{2\\sin(2\\pi/z)} = \\frac{${DIM.pitch}}{2\\sin(2\\pi/${DIM.teeth})}`,
      result: `R = ${n(huntingSprocketRadius(DIM.teeth, DIM.pitch) * 1000, 4)}\\ \\text{mm}`,
      cite: TT('p50'),
    },
    {
      label: 'Spare chain in the front span (parabolic strand)',
      tex: '\\Delta L \\approx \\frac{8\\delta^2}{3s}',
      sub: `= \\frac{8(${n(ts.sag2 * 1000, 3)}\\,\\text{mm})^2}{3(${n(span * 1000, 4)}\\,\\text{mm})}`,
      result: `= ${n(slackFromSag(span, ts.sag2) * 1000, 3)}\\ \\text{mm}`,
      beyond: true,
    },
    {
      label: 'Sag guide',
      tex: '\\delta \\approx 1\\ \\text{in} = 25.4\\ \\text{mm, midway carrier roller → front idler}',
      sub: `\\delta = ${n(ts.sag2 * 1000, 3)}\\ \\text{mm} = ${n(ts.sag2 / 0.0254, 3)}\\ \\text{in}`,
      result: `\\text{${ts.state}}`,
      cite: TT('p52, Fig 11; p53, Fig 12'),
    },
    {
      label: 'Static pull in the sagging strand',
      tex: 'T = \\frac{w s^2}{8\\delta}',
      sub: `= \\frac{${n(DIM.wPerM, 4)}\\times${n(span, 3)}^2}{8\\times${n(ts.sag2, 3)}}`,
      result: Number.isFinite(ts.tension) ? `= ${n(ts.tension / 1000, 3)}\\ \\text{kN}` : '\\to\\infty\\ (\\text{strand straight})',
      beyond: true,
    },
    {
      label: 'Mean ground pressure under both tracks',
      tex: 'p = \\frac{W}{2bL}',
      sub: `= \\frac{${n(mass * 9.81, 3)}\\,\\text{kN}}{2(${DIM.shoeW})(${n(ts.xi - DIM.xs, 3)})}`,
      result: `= ${n(ground.pressurePa / 1000, 3)}\\ \\text{kPa}`,
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function TracksPanel() {
  const st = useTracks()
  const [preset, setPreset] = useState<string | null>(null)
  const presets: { id: string; label: string; note: string; p: Partial<typeof st> }[] = [
    { id: 'ok', label: 'Correct: 1 in sag', note: 'About one inch of sag measured with a straight edge halfway between carrier roller and front idler.', p: { adjust: 0, speed: 2.5 } },
    { id: 'tight', label: 'Too tight', note: 'Too much grease in the adjuster: the strand is straight and the recoil spring takes the load.', p: { adjust: 5, speed: 2.5 } },
    { id: 'loose', label: 'Too loose', note: 'Grease released past the setting: deep sag, the track can come off in turns.', p: { adjust: -25, speed: 2.5 } },
    { id: 'whip', label: 'Loose at speed', note: 'A loose track whips at high ground speed, hammering the carrier roller.', p: { adjust: -25, speed: 9 } },
  ]
  return (
    <div>
      <LivePanel />
      <Section title="Track">
        <Slider label="Travel speed" value={st.speed} min={0} max={10} step={0.1} unit="km/h" onChange={(speed) => st.set({ speed })} />
        <Slider label="Adjuster: idler travel" value={st.adjust} min={-40} max={6} step={0.25} unit="mm" onChange={(adjust) => st.set({ adjust })} hint="+ = grease pumped in (tighter), − = grease released through the relief valve (looser)" />
        <Segmented<ShoeType> label="Shoe type" value={st.shoe} onChange={(shoe) => st.set({ shoe })} options={(Object.keys(SHOES) as ShoeType[]).map((k) => ({ value: k, label: SHOES[k].label.split(' ')[0].replace('Multi-grouser', 'Multi'), title: SHOES[k].text }))} size="sm" />
        <p className="-mt-1 mb-2 text-[11.5px] leading-snug text-mute">{SHOES[st.shoe].text}</p>
        <Segmented<ChainType> label="Chain" value={st.chain} onChange={(chain) => st.set({ chain })} options={[{ value: 'flush', label: 'Flush-type' }, { value: 'interlocking', label: 'Interlocking' }]} size="sm" />
        <Segmented<Misalign> label="Front idler" value={st.misalign} onChange={(misalign) => st.set({ misalign })} options={(Object.keys(MISALIGN) as Misalign[]).map((k) => ({ value: k, label: MISALIGN[k].label }))} size="sm" />
        <p className="-mt-1 mb-2 text-[11.5px] leading-snug text-mute">{MISALIGN[st.misalign].text} Check: drive about 100 ft on level ground, stop without touching the steering levers, and compare the clearance between links and idler flanges on both sides.</p>
        <Slider label="Machine mass (ground-pressure working)" value={st.mass} min={3} max={25} step={0.5} unit="t" onChange={(mass) => st.set({ mass })} />
      </Section>
      <Section title="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                st.set(p.p)
                setPreset(p.id)
              }}
              className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${preset === p.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{presets.find((p) => p.id === preset)?.note}</p> : null}
      </Section>
      <SagChart />
      <CostCalc />
      <Section title="Tips for crawler operators">
        <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] leading-snug text-mute">
          {TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Section>
      <TrackWorking />
    </div>
  )
}
