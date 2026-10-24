import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { FARMLAND, instabilityPsi, maxSlopes } from '@/physics/chassis'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, Points, PresetGrid, type Preset } from '../common/bits'
import { DEFAULTS, HFS, P616, PSI_616, live, solve, useStab, type HitchPoint, type Mode, type StabParams } from './model'

const deg = Math.PI / 180
const apply = (p: Partial<StabParams>) => useStab.getState().set({ ...DEFAULTS, ...p })

const PRESETS: Preset[] = [
  { id: 'db', label: 'Normal drawbar, y′ 0.45 m', note: 'h = 0.45/0.765 = 0.59: the overturn condition needs ψ′ = 1.2 on level ground before the front lifts — far more than the soil gives, so the tyres slip first. Safe.', apply: () => apply({ mode: 'rear', hitchPoint: 'drawbar' }) },
  { id: 'p616', label: 'Raised drawbar · y′ 0.86 m', note: 'Soil A = 0.076 m², c = 2 kPa, φ = 32° gives ψ′ = (Ac + W tanφ)/W = 0.63. The drawbar height at which the tractor tips before the soil shears is y′ = W·xr/(Ac + W tanφ) = 0.85 m. Raise it a little more and it rears.', apply: () => apply({ mode: 'rear', hitchPoint: 'custom', yd: 0.87 }) },
  { id: 'top', label: 'Towing from the top-link pin', note: 'Hitching a chain to the top-link point (≈ 0.9 m high) gives h ≈ 1.2: the front lifts at a pull the tyres easily develop. Never tow from the top link or the axle.', apply: () => apply({ mode: 'rear', hitchPoint: 'toplink' }) },
  { id: 'uphill', label: 'High hitch up a 10° slope', note: 'On a slope the margin shrinks: ψ′ = tanα + (tanαs − tanα)/h falls as α rises.', apply: () => apply({ mode: 'rear', hitchPoint: 'custom', yd: 0.7, alpha: 10 }) },
  { id: 'climb', label: 'Slope limits', note: 'Climbing with ψ′ = 0.63 on firm soil (ρ = 0.05): the steepest slope the rear-drive tractor can climb is far below the static overturn slope αs.', apply: () => apply({ mode: 'slope', alpha: 15 }) },
  { id: 'side', label: 'Side slope', note: 'Static side tipping for a rigid 1.42 m track and 0.765 m CG height: tanβ = 0.71/0.765. An indicative estimate; a pivoting front axle and any motion make the real limit much lower.', apply: () => apply({ mode: 'side', beta: 20 }) },
]

function LivePanel() {
  const st = useStab()
  const s = solve(st)
  const ph = useLive(() => live.phase, 10)
  return (
    <Section title="Live">
      {st.mode === 'rear' ? (
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="h = y′/(r + yg)" value={fmt(s.h, 3)} tone={s.h >= 0.7 ? 'warn' : 'ink'} />
          <Readout label="tan αs" value={fmt(s.tas, 3)} />
          <Readout label="ψ′ to rear" value={fmt(s.psiInst, 3)} tone="info" />
          <Readout label="ψ′ soil gives" value={fmt(st.psiMax, 3)} />
          <Readout label="Front lifts at" value={fmt(s.Plift / 1000, 3)} unit="kN" />
          <Readout label="Outcome" value={s.rears ? 'rears over' : 'tyres slip'} tone={s.rears ? 'warn' : 'accent'} />
        </div>
      ) : st.mode === 'slope' ? (
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Max uphill" value={fmt(s.slopes.up / deg, 3)} unit="°" tone="accent" />
          <Readout label="Max downhill" value={fmt(s.slopes.down / deg, 3)} unit="°" tone="info" />
          <Readout label="Static overturn αs" value={fmt(s.alphaS / deg, 3)} unit="°" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Side slope" value={fmt(st.beta, 3)} unit="°" />
          <Readout label="Static tip angle" value={fmt(Math.atan(s.sideTan) / deg, 3)} unit="°" tone="info" />
          <Readout label="State" value={s.sideTips ? 'overturns' : 'stable'} tone={s.sideTips ? 'warn' : 'accent'} />
        </div>
      )}
      {st.mode === 'rear' ? <Note tone={ph === 'rearing' || ph === 'over' ? 'warn' : 'dim'}>The pull on the anchored load rises until the tyres slip (ψ′ reaches {fmt(st.psiMax, 2)}) or the front lifts (Vf = 0) — whichever comes first. Now: {ph}.</Note> : null}
    </Section>
  )
}

function Charts() {
  const st = useStab()
  const data = useMemo(() => {
    const xs: number[] = []
    const rows: number[][] = [[], [], [], [], []]
    const as = solve(st).alphaS / deg
    for (let p = 0.05; p <= 1.0001; p += 0.025) {
      xs.push(p)
      rows[0].push(maxSlopes(FARMLAND, p, 0.025).up / deg)
      rows[1].push(maxSlopes(FARMLAND, p, 0.1).up / deg)
      rows[2].push(maxSlopes(FARMLAND, p, 0.025).down / deg)
      rows[3].push(maxSlopes(FARMLAND, p, 0.1).down / deg)
      rows[4].push(as)
    }
    const ta: number[] = []
    const hs = [0.6, 0.7, 0.8, solve(st).h]
    const inst: number[][] = hs.map(() => [])
    const tas = solve(st).tas
    for (let t = 0; t <= 0.6001; t += 0.02) {
      ta.push(t)
      hs.forEach((h, i) => inst[i].push(instabilityPsi(t, tas, h)))
    }
    return { slopes: [xs, ...rows], inst: [ta, ...inst], hNow: hs[3] }
  }, [st])
  return (
    <>
      <Section title="Slope limits vs tractive coefficient">
        <Chart
          data={data.slopes}
          series={[
            { label: 'up ρ 0.025', color: '#e8794f', width: 2 },
            { label: 'up ρ 0.1', color: '#e8794f', dash: [4, 3] },
            { label: 'down ρ 0.025', color: '#6fb3e0', width: 2 },
            { label: 'down ρ 0.1', color: '#6fb3e0', dash: [4, 3] },
            { label: 'αs', color: '#93a59a', dash: [2, 3] },
          ]}
          xLabel="ψ′"
          yLabel="slope (deg)"
          yRange={[0, 40]}
          marker={() => {
            const p = useStab.getState()
            return [p.psiMax, solve(p).slopes.up / deg]
          }}
          height={170}
        />
        <Note>ρ = 0.025 bitumen, 0.05 firm soil, 0.1 ploughed soil. Downhill the limit is braking on the rear wheels while weight moves forward.</Note>
      </Section>
      <Section title="Impending rear overturn">
        <Chart
          data={data.inst}
          series={[
            { label: 'h 0.6', color: '#9bd17a', width: 2 },
            { label: 'h 0.7', color: '#f5b942', width: 2 },
            { label: 'h 0.8', color: '#e8794f', width: 2 },
            { label: `h ${data.hNow.toFixed(2)} (now)`, color: '#c792ea', dash: [4, 3] },
          ]}
          xLabel="tan α"
          yLabel="ψ′ at Vf = 0"
          yRange={[0, 1.6]}
          marker={() => {
            const p = useStab.getState()
            return [Math.tan(p.alpha * deg), p.psiMax]
          }}
          height={160}
        />
        <Note>If the soil can give a ψ′ above the line (marker above your curve), the front lifts before the tyres slip. Higher hitches (larger h) bring the line down.</Note>
      </Section>
    </>
  )
}

function StabWorking() {
  const st = useStab()
  const s = solve(st)
  const c = s.c
  const steps: WorkingStep[] = [
    {
      label: 'Static overturn slope',
      tex: '\\tan\\alpha_s = \\dfrac{x_r}{r + y_g}',
      sub: `= \\dfrac{${c.xr}}{${c.r} + ${c.yg}}`,
      result: `\\tan\\alpha_s = ${n(s.tas, 3)},\\ \\alpha_s = ${n(s.alphaS / deg, 3)}°`,
      cite: SRC.mac502('Ch 6 — αs ≈ 40°, tan 0.6–0.8'),
    },
    {
      label: 'Hitch-height ratio',
      tex: "h = \\dfrac{y'}{r + y_g}",
      sub: `= \\dfrac{${n(c.yd, 3)}}{${n(c.r + c.yg, 3)}}`,
      result: `h = ${n(s.h, 3)}\\ (0.6\\ \\text{typical};\\ 0.7\\text{–}0.8\\ \\text{dangerous})`,
      cite: SRC.mac502('eq 6.35'),
    },
    {
      label: 'Tractive coefficient at impending instability',
      tex: "\\psi' = \\tan\\alpha + \\dfrac{\\tan\\alpha_s - \\tan\\alpha}{h}",
      sub: `= ${n(s.ta, 3)} + \\dfrac{${n(s.tas, 3)} - ${n(s.ta, 3)}}{${n(s.h, 3)}}`,
      result: `\\psi' = ${n(s.psiInst, 3)}\\ ${s.rears ? '< ' : '> '}${n(st.psiMax, 3)}\\ \\Rightarrow\\ \\text{${s.rears ? 'rears over' : 'tyres slip first'}}`,
      cite: SRC.mac502('eq 6.35; worked case tanα 0.3 → 0.72 (h 0.7), 0.67 (h 0.8)'),
    },
    {
      label: 'Drawbar height that tips before the soil shears',
      tex: "y' = \\dfrac{W x_r}{A c + W\\tan\\phi}",
      sub: `= \\dfrac{${n(FARMLAND.W / 1000, 4)}\\times${FARMLAND.xr}}{${P616.A}\\times${P616.c / 1000} + ${n(FARMLAND.W / 1000, 4)}\\tan32°}`,
      result: `y' = ${n(s.yTip, 3)}\\ \\text{m}\\quad(\\psi' = ${n(PSI_616, 3)})`,
      cite: SRC.mac502('Problem 6.16'),
    },
    {
      label: 'Steepest slope climbable / descendable (rear drive)',
      tex: "\\tan\\alpha_u = \\dfrac{\\psi' x_f - \\rho x}{x - \\psi'(r+y_g)},\\quad \\tan\\alpha_d = \\dfrac{\\psi' x_f + \\rho x}{x + \\psi'(r+y_g)}",
      sub: `\\psi' = ${n(st.psiMax, 3)},\\ \\rho = ${n(st.rho, 3)},\\ x_f = ${n(FARMLAND.x - FARMLAND.xr, 3)}`,
      result: `\\alpha_u = ${n(s.slopes.up / deg, 3)}°,\\ \\alpha_d = ${n(s.slopes.down / deg, 3)}°`,
      cite: SRC.mac502('eqs 6.9–6.10'),
    },
    {
      label: 'Side slope, static, rigid axle',
      tex: '\\tan\\beta_{tip} = \\dfrac{T/2}{h_{CG}}',
      sub: `= \\dfrac{1.42/2}{${n(FARMLAND.r + FARMLAND.yg, 3)}}`,
      result: `\\beta_{tip} = ${n(Math.atan(s.sideTan) / deg, 3)}°`,
      cite: SRC.beyond('static lateral overturn; the notes give no rollover equations'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function StabPanel() {
  const st = useStab()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<StabParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Set-up">
        <Segmented<Mode> label="Case" value={st.mode} onChange={(mode) => set({ mode })} options={[{ value: 'rear', label: 'Rear overturn' }, { value: 'slope', label: 'Slope limits' }, { value: 'side', label: 'Side slope' }]} />
        {st.mode === 'rear' ? (
          <>
            <Segmented<HitchPoint> label="Pull from" value={st.hitchPoint} onChange={(hitchPoint) => set({ hitchPoint })} options={[{ value: 'drawbar', label: 'Drawbar 0.45 m' }, { value: 'custom', label: 'Raised drawbar' }, { value: 'toplink', label: 'Top-link pin' }]} />
            {st.hitchPoint === 'custom' ? <Slider label="Drawbar height y′" value={st.yd} min={0.3} max={1.1} step={0.01} unit="m" onChange={(yd) => set({ yd })} /> : null}
            <Slider label="Slope α (uphill)" value={st.alpha} min={0} max={25} step={0.5} unit="°" onChange={(alpha) => set({ alpha })} />
          </>
        ) : null}
        {st.mode === 'slope' ? (
          <>
            <Slider label="Slope α (uphill)" value={st.alpha} min={0} max={40} step={0.5} unit="°" onChange={(alpha) => set({ alpha })} />
            <Slider label="Rolling resistance ρ" value={st.rho} min={0} max={0.15} step={0.005} onChange={(rho) => set({ rho })} />
          </>
        ) : null}
        {st.mode === 'side' ? <Slider label="Side slope β" value={st.beta} min={0} max={50} step={0.5} unit="°" onChange={(beta) => set({ beta })} /> : null}
        {st.mode !== 'side' ? <Slider label="ψ′ the soil can give" value={st.psiMax} min={0.2} max={1.0} step={0.01} onChange={(psiMax) => set({ psiMax })} /> : null}
      </Section>
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <Section title="Overturning and ROPS">
        <Points
          items={[
            <>Overturns cause 52–54 % of on-farm tractor fatalities; 6.9 deaths per 100 000 tractors in 1973–74.</>,
            <>ROPS standards ASAE S383 and S310.2; frames designed by FEM and proved by static or dynamic loading, a crush test, a field upset test and a temperature–material test.</>,
            <>From 1 Sept 1976 ROPS were required on tractors over 20 hp used by hired operators. Wear the seat belt: the frame only protects a driver who stays inside it.</>,
            <>CG height rises with power while the track stays fixed; narrowing rows from 40 to 30 in (wheels 80 → 60 in) cuts sidehill stability and the safe turning radius.</>,
            <>Rear overturn: hitch only to the drawbar, keep it low, never to the axle or top link; start gently with a heavy load. Orchard tractors are built low (often without ROPS).</>,
          ]}
        />
        <Note>Lateral (side) rollover: full tipping models need the tractor’s motion and a pivoting front axle; the side-slope case here is a static rigid-axle estimate and is indicative only.</Note>
      </Section>
      <StabWorking />
    </div>
  )
}

/** Citation helpers used by the scene definition. */
export const STAB_CITES = [SRC.he510('p20–21 ROPS'), HFS('p49–52')]
