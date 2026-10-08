import { useMemo, useState } from 'react'
import { contactPatch, inflationState, PSI_PER_BAR } from '@/physics/tyres'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { BUILDS, DUTIES, L27, SIZE_PRESETS, TREADS, TREAD_CODES, TT, TTS, derive, useTyre, type Build, type Duty, type Tread } from './model'


const STATE_TEXT = {
  under: { label: 'Under-inflated', tone: 'warn' as const, text: 'Flexes too much and heats up; the SIDES of the tread wear.' },
  correct: { label: 'Correct', tone: 'accent' as const, text: 'Full tread contact, proper traction and flotation.' },
  over: { label: 'Over-inflated', tone: 'warn' as const, text: 'Only the crown touches; the CENTRE of the tread wears and impacts break cords.' },
}

const FAILURES: [string, string][] = [
  ['Fabric breaks', 'Impact on an object, worse at high speed or high pressure: an "X" or diagonal break that can run bead to bead.'],
  ['Freezing', 'Water ballast froze and expanded — always use antifreeze (CaCl₂) solution.'],
  ['Furrow-tyre buckle', 'Tractor tilt folds the furrow tyre, worse when under-inflated; put 4 psi more in the furrow tyre.'],
  ['Spinning wear', 'Too little weight or too much pressure: bars cut and worn on their leading edge.'],
  ['Stubble wear, cuts', 'Corn stubble and sharp objects; bevel out small lug cuts, repair cuts that reach the cords promptly.'],
  ['Weather checks', 'Small sidewall cracks from high pressure, sunlight and ozone — usually cosmetic.'],
  ['Valve torn off', 'The bead slipped on the rim: low pressure, poor seating or too much mounting soap.'],
]

function SizeInput() {
  const code = useTyre((s) => s.code)
  const set = useTyre((s) => s.set)
  const [text, setText] = useState(code)
  const [shown, setShown] = useState(code)
  if (shown !== code) {
    setShown(code)
    setText(code)
  }
  const d = derive({ ...useTyre.getState(), code: text })
  return (
    <div className="mb-2.5">
      <div className="mb-1 text-[12.5px] text-ink/90">Size code on the sidewall</div>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          if (derive({ ...useTyre.getState(), code: e.target.value }).valid) set({ code: e.target.value.trim().toUpperCase() })
        }}
        spellCheck={false}
        className={`w-full rounded-md border bg-panel-2 px-2 py-1 font-mono text-[13px] text-ink outline-none ${d.valid ? 'border-line-2 focus:border-accent' : 'border-warn/70'}`}
        aria-label="Tyre size code"
      />
      {!d.valid ? <p className="mt-1 text-[11px] text-warn">Not a size code — try 18.4-38, 12.4/11-28, 20.8R42 or 710/70R38.</p> : null}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {SIZE_PRESETS.map((p) => (
          <button key={p.code} title={p.note} onClick={() => set({ code: p.code })} className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${code === p.code ? 'border-accent text-ink' : 'border-line-2 text-mute hover:text-ink'}`}>
            {p.code}
          </button>
        ))}
      </div>
    </div>
  )
}

function Decoded() {
  const st = useTyre()
  const { size, patch, state, rec } = derive(st)
  const plies = st.build === 'bias' ? st.plies : BUILDS[st.build].plies
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Section width" value={fmt(size.widthIn, 3)} unit={`in · ${fmt(size.widthMm, 3)} mm`} />
        <Readout label="Rim diameter" value={fmt(size.rimIn, 3)} unit="in" />
        <Readout label="Overall dia." value={fmt(size.overallDiaMm / 1000, 3)} unit="m" tone="accent" />
        <Readout label="Construction" value={size.construction === 'radial' ? 'Radial (R)' : 'Bias (–)'} />
        <Readout label="Plies / rating" value={`${plies} / 4`} unit="ply" />
        <Readout label="Pressure" value={`${fmt(st.pressure, 2)}`} unit={`bar · ${fmt(st.pressure * PSI_PER_BAR, 2)} psi`} />
        <Readout label="Contact area" value={fmt(patch.area * 1e4, 3)} unit="cm²" tone="info" />
        <Readout label="Deflection" value={fmt(patch.deflection * 1000, 3)} unit="mm" />
        <Readout label="Inflation" value={STATE_TEXT[state].label} tone={STATE_TEXT[state].tone} />
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-mute">
        {STATE_TEXT[state].text} Guide pressure for {DUTIES[st.duty].label.toLowerCase()}: {rec} bar.
      </p>
      {size.oldWidthIn ? <p className="mt-1 text-[11px] leading-snug text-dim">Dual sizing: {size.widthIn.toFixed(1)} in is the new (wide-rim) width, {size.oldWidthIn} in the old size.</p> : null}
      {size.aspectAssumed ? <p className="mt-1 text-[11px] leading-snug text-dim">Inch codes give no section height; a typical h/b = 0.85 is assumed for the 3D proportions.</p> : null}
    </Section>
  )
}

function PressureChart() {
  const st = useTyre()
  const { size } = derive(st)
  const data = useMemo(() => {
    const xs: number[] = []
    const area: number[] = []
    const defl: number[] = []
    for (let p = 0.4; p <= 3.0001; p += 0.05) {
      const s = inflationState(p, DUTIES[st.duty].bar)
      const c = contactPatch(st.load * 1000, p * 1e5, size, s)
      xs.push(p)
      area.push(c.area * 1e4)
      defl.push(c.deflection * 1000)
    }
    return { xs, area, defl }
  }, [st.load, st.duty, size])
  return (
    <Section title="Contact area vs pressure">
      <Chart data={[data.xs, data.area]} series={[{ label: 'A', color: '#6fb3e0', width: 2 }]} xLabel="Inflation pressure (bar)" yLabel="Contact area (cm²)" height={150} marker={() => [st.pressure, (st.load * 1000) / (st.pressure * 1e5) * 1e4]} />
      <p className="mt-1 text-[11px] leading-snug text-dim">A = W/p: ground pressure is roughly the inflation pressure, so halving the pressure doubles the footprint — which is why low field pressures give flotation and traction, and why radials at correct pressure beat over-inflated tyres (e.g. a 710/70R38 at 41 kPa vs 193 kPa).</p>
    </Section>
  )
}

function TyreWorking() {
  const st = useTyre()
  const { size, patch, rec } = derive(st)
  const h = size.sectionHeightMm
  const steps: WorkingStep[] = [
    {
      label: 'Decode the size code',
      tex: size.system === 'metric' ? '\\text{width/aspect R rim}' : '\\text{section width (in)} - \\text{rim diameter (in)}',
      sub: `${size.code}:\\; b = ${n(size.widthIn, 3)}\\,\\text{in} = ${n(size.widthMm, 4)}\\,\\text{mm},\\; d_{rim} = ${size.rimIn}\\,\\text{in} = ${n(size.rimMm, 4)}\\,\\text{mm}`,
      result: size.construction === 'radial' ? '\\text{“R” = radial}' : '\\text{“–” = bias (cross-ply)}',
      cite: TT('p5, Fig 7'),
    },
    {
      label: 'Section height and overall diameter',
      tex: 'h = \\tfrac{h}{b}\\,b,\\quad D = d_{rim} + 2h',
      sub: `h = ${n(size.aspect, 3)}\\times${n(size.widthMm, 4)},\\; D = ${n(size.rimMm, 4)} + 2(${n(h, 4)})`,
      result: `h = ${n(h, 4)}\\,\\text{mm},\\; D = ${n(size.overallDiaMm, 4)}\\,\\text{mm}`,
      cite: size.aspectAssumed ? undefined : L27('p32 — 710/70R38'),
      beyond: size.aspectAssumed,
    },
    {
      label: 'Rolling circumference (no slip)',
      tex: '\\text{distance per rev} = \\pi D',
      sub: `= \\pi\\times${n(size.overallDiaMm / 1000, 4)}`,
      result: `= ${n((Math.PI * size.overallDiaMm) / 1000, 4)}\\,\\text{m}`,
      cite: L27('p10, eq 4'),
    },
    {
      label: 'Pressure units',
      tex: 'p_{psi} = 14.5\\,p_{bar}',
      sub: `= 14.5\\times${n(st.pressure, 3)}\\quad(\\text{guide } ${rec}\\,\\text{bar})`,
      result: `= ${n(st.pressure * PSI_PER_BAR, 3)}\\,\\text{psi}`,
      cite: TTS('p14'),
      errata: 'The notes say "one bar is equivalent to 14.7 psi"; 14.7 psi is one atmosphere = 1.013 bar. 1 bar = 14.5 psi.',
    },
    {
      label: 'Contact area (ground pressure ≈ tyre pressure)',
      tex: 'A = \\dfrac{W}{p}',
      sub: `= \\dfrac{${n(st.load * 1000, 4)}\\,\\text{N}}{${n(st.pressure * 1e5, 4)}\\,\\text{Pa}}`,
      result: `= ${n(patch.area, 3)}\\,\\text{m}^2`,
      cite: L27('p39'),
    },
    {
      label: 'Footprint length and deflection',
      tex: 'l = \\dfrac{A}{0.8\\,w},\\quad \\delta = \\dfrac{l^2}{8R}',
      sub: `w = ${n(patch.width, 3)}\\,\\text{m},\\; R = ${n(size.overallDiaMm / 2000, 3)}\\,\\text{m}`,
      result: `l = ${n(patch.length, 3)}\\,\\text{m},\\; \\delta = ${n(patch.deflection * 1000, 3)}\\,\\text{mm}`,
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function TyrePanel() {
  const st = useTyre()
  const [preset, setPreset] = useState<string | null>(null)
  const presets: { id: string; label: string; note: string; apply: () => void }[] = [
    { id: 'p24', label: '24.5-32 decoded', note: '24.5 in section width on its recommended rim, 32 in rim.', apply: () => st.set({ code: '24.5-32' }) },
    { id: 'dual', label: '12.4/11-28 dual size', note: 'New width 12.4 in on a wide rim; the old 11-28 measured 11.9 in on a 10 in rim.', apply: () => st.set({ code: '12.4/11-28' }) },
    { id: 'rearf', label: 'Rear field 0.8 bar', note: 'Rear tyres: field 0.8 bar (12 psi), road 1.0 bar (15 psi).', apply: () => st.set({ duty: 'rear-field', pressure: 0.8 }) },
    { id: 'loader', label: 'Front loader 2.7 bar', note: 'Front tyres: field 1.7, road 2.1, loader 2.7 bar. A loader needs the heavier six-ply front tyre.', apply: () => st.set({ code: '7.50-16', duty: 'front-loader', pressure: 2.7, tread: 'F2', load: 12 }) },
    { id: 'l27lo', label: '710/70R38 at 41 kPa', note: 'A correctly inflated radial.', apply: () => st.set({ code: '710/70R38', build: 'radial', pressure: 0.41, duty: 'rear-field', load: 30 }) },
    { id: 'l27hi', label: '710/70R38 at 193 kPa', note: 'The same tyre over-inflated — footprint shrinks to a crown strip.', apply: () => st.set({ code: '710/70R38', build: 'radial', pressure: 1.93, duty: 'rear-field', load: 30 }) },
  ]
  return (
    <div>
      <Decoded />
      <Section title="Size & construction">
        <SizeInput />
        <Segmented<Build>
          label="Ply construction"
          value={st.build}
          onChange={(build) => st.set({ build })}
          options={(['bias', 'belted', 'radial'] as Build[]).map((b) => ({ value: b, label: BUILDS[b].label, title: BUILDS[b].text }))}
        />
        <p className="-mt-1 mb-2 text-[11.5px] leading-snug text-mute">{BUILDS[st.build].text}</p>
        {st.build === 'bias' ? (
          <>
            <Segmented<'2' | '4'> label="4-ply rating built as…" value={String(st.plies) as '2' | '4'} onChange={(v) => st.set({ plies: Number(v) as 2 | 4 })} options={[{ value: '4', label: '4 plies' }, { value: '2', label: '2 plies, larger cords' }]} size="sm" />
            <p className="-mt-1 mb-2 text-[11px] leading-snug text-dim">Ply rating tells the strength, not necessarily the number of plies: a 4-ply-rated tyre may have 2 plies of larger cords. Older usage defines ply rating as the number of fabric layers.</p>
          </>
        ) : null}
        <Toggle label="Peel back the layers" checked={st.peel} onChange={(peel) => st.set({ peel })} />
        <Toggle label="Tube-type (tube + flap)" checked={st.tube} onChange={(tube) => st.set({ tube })} hint="Tubeless tyres use an inner liner instead" />
      </Section>
      <Section title="Tread">
        <Segmented<Tread> value={st.tread} onChange={(tread) => st.set({ tread })} options={(['R1', 'R2', 'R3', 'F2'] as Tread[]).map((t) => ({ value: t, label: TREADS[t].label.split(' ')[0], title: TREADS[t].label }))} />
        <p className="-mt-1 mb-2 text-[11.5px] leading-snug text-mute">{TREADS[st.tread].text}</p>
        <Toggle label="Mount the tyre reversed" checked={st.reversed} onChange={(reversed) => st.set({ reversed })} hint="Directional arrow and chevron point backwards" />
        {st.reversed ? <p className="-mt-1 mb-2 text-[11.5px] leading-snug text-warn">Reversed: the bars are damaged under heavy pull. Only ground-driven implements (planters, spreaders) run the V reversed.</p> : null}
        <table className="w-full text-[11px] text-mute">
          <tbody>
            {TREAD_CODES.map((g) => (
              <tr key={g.group} className="border-t border-line align-top">
                <td className="py-1 pr-2 text-ink/80">{g.group}</td>
                <td className="py-1">{g.codes.map(([c, t]) => (t ? `${c} ${t}` : c)).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[10.5px] text-dim">Standard industry codes. R-2 may carry “O” (open) or “C” (closed) tread.</p>
      </Section>
      <Section title="Inflation">
        <Segmented<Duty> value={st.duty} onChange={(duty) => st.set({ duty, pressure: DUTIES[duty].bar })} options={(Object.keys(DUTIES) as Duty[]).map((k) => ({ value: k, label: DUTIES[k].label.replace(' · ', ' ') }))} size="sm" />
        <Slider label="Inflation pressure" value={st.pressure} min={0.3} max={3} step={0.05} unit="bar" onChange={(pressure) => st.set({ pressure })} hint="Watch the section and the footprint change" />
        <Slider label="Wheel load W" value={st.load} min={4} max={40} step={0.5} unit="kN" onChange={(load) => st.set({ load })} />
        <p className="text-[11px] leading-snug text-dim">Check and inflate cold (hot tyres read 4–6 psi higher — never bleed them). With liquid ballast use a liquid-type gauge with the valve at the bottom.</p>
      </Section>
      <Section title="Exam presets">
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                p.apply()
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
      <PressureChart />
      <Section title="Tyre failures">
        <ul className="space-y-1 text-[11.5px] leading-snug text-mute">
          {FAILURES.map(([t, d]) => (
            <li key={t}>
              <span className="text-ink/85">{t}.</span> {d}
            </li>
          ))}
        </ul>
      </Section>
      <TyreWorking />
    </div>
  )
}
