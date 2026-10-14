import { useMemo, useState } from 'react'
import { PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { windMode } from '@/physics/water'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Bullets } from '../_shared/fx'
import { BREAK_X, C, DEFAULTS, FIELD, THRESHOLD, live, profile, thresholdOf, uAt, useWind, z0Of, type Cover } from './model'

function LivePanel() {
  const st = useWind()
  const ut = thresholdOf(st)
  const v = useLive(() => ({ ...live }), 6, (a, b) => a.eroding === b.eroding && a.moved === b.moved)
  const lee = uAt(st, BREAK_X + 3 * st.H)
  const erosive = st.u > ut
  return (
    <Section title="Live" right={<Badge tone={erosive ? 'warn' : 'accent'}>{erosive ? 'erosive' : 'non-erosive'}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Wind at 0.3 m" value={fmt(st.u, 3)} unit="m/s" tone="accent" />
        <Readout label="Threshold" value={Number.isFinite(ut) ? fmt(ut, 3) : 'moist'} unit={Number.isFinite(ut) ? 'm/s' : ''} />
        <Readout label="In the lee (3H)" value={st.windbreak ? fmt(lee, 3) : '—'} unit="m/s" tone="info" />
        <Readout label="Field eroding" value={fmt(v.eroding * 100, 3)} unit="%" />
        <Readout label="Mean soil removed" value={fmt(v.moved * 1000, 3)} unit="mm" />
        <Readout label="Protected length" value={st.windbreak ? fmt(12 * st.H, 3) : '—'} unit="m" />
      </div>
    </Section>
  )
}

function Controls() {
  const st = useWind()
  return (
    <Section title="Controls">
      <Slider label="Wind speed at 0.3 m" value={st.u} min={1} max={16} step={0.1} unit="m/s" onChange={(u) => st.set({ u })} />
      <Segmented<Cover>
        value={st.cover}
        onChange={(cover) => st.set({ cover })}
        size="sm"
        options={[
          { value: 'bare', label: 'Bare' },
          { value: 'flat', label: 'Flat residue' },
          { value: 'standing', label: 'Standing stubble' },
        ]}
      />
      <Toggle label="Moist soil" checked={st.moist} onChange={(moist) => st.set({ moist })} />
      <Toggle label="Roughened surface (clods, ridges)" checked={st.rough} onChange={(rough) => st.set({ rough })} />
      <Toggle label="Windbreak" checked={st.windbreak} onChange={(windbreak) => st.set({ windbreak })} />
      {st.windbreak ? <Slider label="Windbreak height H" value={st.H} min={2} max={12} step={0.5} unit="m" onChange={(H) => st.set({ H })} /> : null}
      <Toggle label="Crop strips normal to the wind" checked={st.strips} onChange={(strips) => st.set({ strips })} />
      <p className="mt-1 text-[11px] leading-snug text-dim">The 5 m/s threshold at 0.3 m is standard; how much residue and roughness raise it, and the windbreak’s protected length, are illustrative values.</p>
    </Section>
  )
}

function Presets() {
  const [active, setActive] = useState<string | null>(null)
  const set = useWind.getState().set
  const presets: Preset[] = [
    { id: 'bare', label: 'Dry bare field, strong wind', note: '10 m/s at 0.3 m over loose, dry, bare soil — well above the 5 m/s threshold: all three modes.', apply: () => set({ ...DEFAULTS, u: 10, windbreak: false }) },
    { id: 'calm', label: 'Wind at the threshold', note: 'At or below 5 m/s at 0.3 m a mineral soil is not eroded.', apply: () => set({ ...DEFAULTS, u: 5, windbreak: false }) },
    { id: 'break', label: 'Windbreak', note: 'A three-row shelterbelt slows the wind in its lee; erosion starts again further downwind.', apply: () => set({ ...DEFAULTS, u: 10, windbreak: true }) },
    { id: 'stubble', label: 'Standing stubble', note: 'Standing stalks with flat residue raise the threshold and slow the near-surface wind.', apply: () => set({ ...DEFAULTS, u: 10, windbreak: false, cover: 'standing' }) },
    { id: 'strips', label: 'Strip cropping', note: 'Strips normal to the wind trap saltating grains and shorten the eroding length.', apply: () => set({ ...DEFAULTS, u: 10, windbreak: false, strips: true }) },
    { id: 'moist', label: 'Moist soil', note: 'Moistening (or compacting, or forming stable clods) holds the grains: no movement.', apply: () => set({ ...DEFAULTS, u: 10, windbreak: false, moist: true }) },
  ]
  return (
    <Section title="Exam presets">
      <PresetGrid presets={presets} active={active} onPick={setActive} />
    </Section>
  )
}

function Charts() {
  const st = useWind()
  const prof = useMemo(() => {
    const zs: number[] = []
    const open: number[] = []
    const lee: (number | null)[] = []
    const uLee = uAt(st, BREAK_X + 3 * st.H)
    for (let i = 0; i <= 60; i++) {
      const z = 0.03 * Math.pow(100, i / 60)
      zs.push(z)
      open.push(profile(st, st.u, z))
      lee.push(st.windbreak ? profile(st, uLee, z) : null)
    }
    return { zs, open, lee }
  }, [st])
  const along = useMemo(() => {
    const xs: number[] = []
    const u: number[] = []
    const t: (number | null)[] = []
    const ut = thresholdOf(st)
    for (let x = BREAK_X - 6; x <= FIELD.x1; x += 0.5) {
      xs.push(x - BREAK_X)
      u.push(uAt(st, x))
      t.push(Number.isFinite(ut) ? ut : null)
    }
    return { xs, u, t }
  }, [st])
  return (
    <Section title="Charts">
      <Chart
        data={[prof.zs, prof.open, prof.lee]}
        series={[
          { label: 'Open field', color: '#5ab4ff', width: 2 },
          { label: 'In the lee (3H)', color: '#f08a3c', width: 1.5, dash: [4, 3] },
        ]}
        xLabel="Height (m)"
        yLabel="Wind speed (m/s)"
        logX
        height={160}
      />
      <p className="mt-1 text-[11px] text-dim">Speed rises with the logarithm of height (z₀ = {fmt(z0Of(st) * 1000, 2)} mm). The log-profile form is standard boundary-layer theory.</p>
      <div className="h-2" />
      <Chart
        data={[along.xs, along.u, along.t]}
        series={[
          { label: 'Wind at 0.3 m', color: '#5ab4ff', width: 2 },
          { label: 'Threshold', color: '#e8794f', width: 1.5, dash: [4, 3] },
        ]}
        xLabel="Distance downwind of the windbreak (m)"
        yLabel="m/s"
        height={150}
      />
    </Section>
  )
}

function KeyPoints() {
  return (
    <Section title="Exam: wind erosion key points">
      <Table
        head={['Mode', 'Grain size', 'Motion']}
        rows={[
          ['Suspension', '< 0.05 mm', 'Carried high by turbulence until rain or calm'],
          ['Saltation', '0.05–0.5 mm', 'Short hops; drives the other modes'],
          ['Surface creep', '0.5–1 mm', 'Rolled and pushed; ≈ ⅓ of movement'],
          ['Lag / pavement', '> 1 mm', 'Stays behind'],
        ]}
      />
      <div className="mt-1.5 text-[11.5px] font-medium text-ink/85">Factors</div>
      <Bullets items={['Climate: speed, duration, direction, turbulence, rain, temperature, humidity, freeze–thaw', 'Land surface: slope, field length and orientation, roughness, non-erodibles, residue', 'Land use and management', 'Soil: texture, aggregates, stability, water content, crust, organic matter, CaCO₃']} />
      <div className="mt-1.5 text-[11.5px] font-medium text-ink/85">Control</div>
      <Bullets items={['Windbreaks and shelterbelts', 'Vegetative cover; less fallow cultivation and grazing', 'Minimum tillage at low speed, keeping residue; stubble mulch, no-till, cover crops', 'Strip cropping normal to the wind; shorter fields', 'Roughen the surface; soil stabilisers; perennial grasses']} />
      <p className="mt-1 text-[11px] text-dim">No wind-erosion equation is used here.</p>
    </Section>
  )
}

function WorkingSection() {
  const st = useWind()
  const ut = thresholdOf(st)
  const steps: WorkingStep[] = [
    { label: 'Threshold check', tex: 'u_{0.3} > u_t \\Rightarrow \\text{erosion}', sub: `${n(st.u, 3)}\\ \\text{vs}\\ ${Number.isFinite(ut) ? n(ut, 3) : '\\infty'}\\ \\text{m/s}`, result: st.u > ut ? '\\text{erosive}' : '\\text{non-erosive}', cite: C.we(`s5–6 fluid threshold ≤ ${THRESHOLD} m/s at 0.3 m`) },
    { label: 'Transport mode of a 0.2 mm grain', tex: 'd < 0.05: \\text{suspension};\\ 0.05\\text{–}0.5: \\text{saltation};\\ 0.5\\text{–}1: \\text{creep}', result: `\\text{${windMode(0.2)}}`, cite: C.we('s7–10') },
    { label: 'Log wind profile', tex: 'u(z) = u_{0.3}\\dfrac{\\ln(z/z_0)}{\\ln(0.3/z_0)}', sub: `z = 2\\ \\text{m},\\ z_0 = ${n(z0Of(st), 3)}`, result: `u(2) = ${n(profile(st, st.u, 2), 3)}\\ \\text{m/s}`, cite: C.we('s5 velocity rises with the log of height'), beyond: true },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function Panel() {
  return (
    <div>
      <LivePanel />
      <Controls />
      <Presets />
      <Charts />
      <WorkingSection />
      <KeyPoints />
    </div>
  )
}
