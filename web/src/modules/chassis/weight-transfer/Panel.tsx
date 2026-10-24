import { useMemo, useState } from 'react'
import { SRC, cite } from '@/content/citations'
import { dynamicLoads, requiredPsi, simpleTransfer } from '@/physics/chassis'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { LoadBars, Note, Points, PresetGrid, type Preset } from '../common/bits'
import { DEFAULTS, chassisOf, solve, solveCg, useWT, type ChassisId, type Mode, type WTParams } from './model'

const deg = Math.PI / 180
const EXAM2223 = (where: string) => cite('AEE510', 'WhatsApp Image 2025-07-24 at 11.15.32 (2022/23 final exam)', where)
const kN = (v: number, d = 4) => n(v / 1000, d)

const apply = (p: Partial<WTParams>) => useWT.getState().set({ ...DEFAULTS, ...p })

const PRESETS: Preset[] = [
  {
    id: 'exam',
    label: 'Exam Q2c (2022/23)',
    note: 'W = 28.5 kN, Rf = 9 kN, L = 2083 mm, P = 12 kN horizontal at h = 580 mm. x = Rf·L/W = 657.8 mm; ΔW = P·h/L = 3.34 kN, so front 5.66 kN and rear 22.84 kN.',
    apply: () => apply({ chassis: 'exam', pull: 12, theta: 0, alpha: 0, yd: 0.58, xd: 0.6 }),
  },
  {
    id: 'p66',
    label: '10° slope, no pull',
    note: 'The Farmland tractor standing on a 10° slope with no pull: Vf = 5.92 kN (W = 27.9 kN). The rear spray-tank part of this problem needs the tank data, which is not reproduced here.',
    apply: () => apply({ alpha: 10, pull: 0, theta: 0 }),
  },
  {
    id: 'p68',
    label: '15° slope, ψ′ 0.8',
    note: '15° slope, pull 10° below horizontal, ψ′ = 0.8 (ρ = 0): P = 17.1 kN, Vr = 30.1 kN. Notice that the front-axle equation then gives Vf < 0 — at this pull the front would already have lifted.',
    apply: () => apply({ alpha: 15, pull: 17.1, theta: 10, rho: 0 }),
  },
  {
    id: 'high',
    label: 'Drawbar hitched high',
    note: 'y′ = 0.85 m (the tipping height from the Stability scene) on level ground. The front lifts when P·y′/x reaches Wf, at P = Wf·x/y′ ≈ 17.8 kN.',
    apply: () => apply({ yd: 0.85, pull: 18, theta: 0 }),
  },
  {
    id: 'down',
    label: 'Facing downhill',
    note: 'α = −10°: the slope term changes sign and moves weight forward onto the front axle; the pull still moves weight back.',
    apply: () => apply({ alpha: -10, pull: 8, theta: 5 }),
  },
  {
    id: 'cg',
    label: 'Find the CG (raise front)',
    note: 'Weigh the front axle level (Wf) and raised (W′f); moments about the rear axle give xr and then the CG height yg.',
    apply: () => apply({ mode: 'cg', lift: 1.3 }),
  },
]

function LivePull() {
  const st = useWT()
  const s = solve(st)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Front Vf" value={fmt(s.Vf / 1000, 3)} unit="kN" tone={s.Vf <= 0 ? 'warn' : 'info'} />
        <Readout label="Rear Vr" value={fmt(s.Vr / 1000, 3)} unit="kN" tone="accent" />
        <Readout label="Moved to rear" value={fmt(s.transfer / 1000, 3)} unit="kN" />
        <Readout label="Rear share" value={fmt(s.rearShare * 100, 3)} unit="%" />
        <Readout label="ψ′ needed" value={fmt(s.psi, 3)} tone={s.psi > 0.8 ? 'warn' : 'ink'} />
        <Readout label="Front lifts at" value={fmt(s.Plift / 1000, 3)} unit="kN" />
      </div>
      <div className="mt-2">
        <LoadBars
          max={Math.max(35, (s.Vr / 1000) * 1.1)}
          rows={[
            { label: 'Front axle', value: s.Vf / 1000, stat: s.Wf / 1000, color: '#6fb3e0' },
            { label: 'Rear axle', value: s.Vr / 1000, stat: s.Wr / 1000, color: '#9bd17a' },
          ]}
        />
      </div>
      {s.Vf <= 0 ? <Note tone="warn">Vf ≤ 0: the front wheels have lifted — the tractor can no longer steer and is on the way to a rear overturn.</Note> : null}
      {s.psi > 0.8 ? <Note tone="warn">The tyres would need ψ′ above ≈ 0.8, more than they can usually develop: expect heavy slip.</Note> : null}
    </Section>
  )
}

function LiveCg() {
  const st = useWT()
  const c = solveCg(st)
  return (
    <Section title="Live — raise the front">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Level Wf" value={fmt(c.Wf / 1000, 3)} unit="kN" />
        <Readout label="Raised W′f" value={fmt(c.Wf2 / 1000, 3)} unit="kN" tone="info" />
        <Readout label="Tilt β" value={fmt(c.beta / deg, 3)} unit="°" />
        <Readout label="xr" value={fmt(c.xr, 3)} unit="m" />
        <Readout label="x′r" value={fmt(c.xr2, 3)} unit="m" />
        <Readout label="yg" value={fmt(c.yg, 3)} unit="m" tone="accent" />
      </div>
      <Note>The scale readings are simulated from the tractor’s true CG; the working then recovers yg from them exactly as you would in the field.</Note>
    </Section>
  )
}

function LoadChart() {
  const st = useWT()
  const data = useMemo(() => {
    const c = chassisOf(st)
    const xs: number[] = []
    const f: number[] = []
    const r: number[] = []
    const psi: number[] = []
    for (let P = 0; P <= 40; P += 0.5) {
      const d = dynamicLoads(c, P * 1000, st.theta * deg, st.alpha * deg)
      xs.push(P)
      f.push(d.Vf / 1000)
      r.push(d.Vr / 1000)
      psi.push(requiredPsi(c, P * 1000, st.theta * deg, st.alpha * deg, st.rho))
    }
    return { loads: [xs, f, r], psi: [xs, psi] }
  }, [st])
  return (
    <>
      <Section title="Axle loads vs pull">
        <Chart
          data={data.loads}
          series={[
            { label: 'Vf', color: '#6fb3e0', width: 2 },
            { label: 'Vr', color: '#9bd17a', width: 2 },
          ]}
          xLabel="Pull P (kN)"
          yLabel="Load (kN)"
          marker={() => {
            const s = solve(useWT.getState())
            return [useWT.getState().pull, s.Vr / 1000]
          }}
          height={160}
        />
        <Note>The front line reaching zero is the instability point; it falls faster when the drawbar is higher (larger y′) or the pull is angled down with a long overhang x′.</Note>
      </Section>
      <Section title="Tractive coefficient needed">
        <Chart data={data.psi} series={[{ label: 'ψ′', color: '#c792ea', width: 2 }]} xLabel="Pull P (kN)" yLabel="ψ′" yRange={[0, 1.2]} marker={() => [useWT.getState().pull, solve(useWT.getState()).psi]} height={140} />
      </Section>
    </>
  )
}

function PullWorking() {
  const st = useWT()
  const s = solve(st)
  const c = s.c
  const al = st.alpha
  const steps: WorkingStep[] = [
    {
      label: 'Static axle loads',
      tex: 'W_f = \\dfrac{W x_r}{x},\\quad W_r = W - W_f',
      sub: `W_f = \\dfrac{${kN(c.W)}\\times${n(c.xr, 4)}}{${n(c.x, 4)}}`,
      result: `W_f = ${kN(s.Wf)},\\ W_r = ${kN(s.Wr)}\\ \\text{kN}`,
      cite: SRC.mac502('eq 6.1; App. II'),
    },
    {
      label: 'Front wheels, with slope and pull',
      tex: 'V_f = W_f\\cos\\alpha - \\dfrac{W\\sin\\alpha\\,(r+y_g)}{x} - \\dfrac{P\\cos\\theta\\,y\'}{x} - \\dfrac{P\\sin\\theta\\,x\'}{x}',
      sub: `= ${kN(s.Wf)}\\cos${n(al, 3)}° - ${kN(s.slopeT)} - ${kN(s.pullT)} - ${kN(s.vertT)}`,
      result: `V_f = ${kN(s.Vf)}\\ \\text{kN}${s.Vf <= 0 ? '\\ \\Rightarrow\\ \\text{unstable}' : ''}`,
      cite: SRC.mac502('eq 6.4'),
    },
    {
      label: 'Rear wheels',
      tex: 'V_r = W_r\\cos\\alpha + \\dfrac{W\\sin\\alpha\\,(r+y_g)}{x} + \\dfrac{P\\cos\\theta\\,y\'}{x} + \\dfrac{P\\sin\\theta\\,(x+x\')}{x}',
      sub: `= ${kN(s.Wr)}\\cos${n(al, 3)}° + ${kN(s.slopeT)} + ${kN(s.pullT)} + ${kN((s.P * Math.sin(s.th) * (c.x + c.xd)) / c.x)}`,
      result: `V_r = ${kN(s.Vr)}\\ \\text{kN}`,
      cite: SRC.mac502('eq 6.5'),
    },
    {
      label: 'Pull that lifts the front (Vf = 0)',
      tex: 'P_{lift} = \\dfrac{W_f x\\cos\\alpha - W\\sin\\alpha\\,(r+y_g)}{y\'\\cos\\theta + x\'\\sin\\theta}',
      result: `P_{lift} = ${kN(s.Plift)}\\ \\text{kN}`,
      cite: SRC.mac502('eq 6.4 with Vf = 0'),
    },
    {
      label: 'Gross tractive coefficient needed',
      tex: "\\psi' = \\dfrac{W\\sin\\alpha + P\\cos\\theta + \\rho\\,(W\\cos\\alpha + P\\sin\\theta)}{V_r}",
      sub: `= \\dfrac{${kN(s.H)}}{${kN(s.Vr)}}`,
      result: `\\psi' = ${n(s.psi, 3)}`,
      cite: SRC.mac502('eq 6.8'),
    },
    {
      label: 'Short form (level, horizontal pull)',
      tex: '\\Delta W = \\dfrac{P\\,h}{L},\\quad R_{f,dyn} = R_f - \\Delta W,\\ R_{r,dyn} = R_r + \\Delta W',
      sub: `\\Delta W = \\dfrac{${n(st.pull, 3)}\\times${n(c.yd * 1000, 4)}}{${n(c.x * 1000, 4)}}`,
      result: `\\Delta W = ${n(simpleTransfer(st.pull, c.yd, c.x), 3)}\\ \\text{kN}`,
      cite: EXAM2223('Q2c; also L27 p22 RWD = RWS + P·Dh/Wb'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

function CgWorking() {
  const st = useWT()
  const c = solveCg(st)
  const steps: WorkingStep[] = [
    {
      label: 'Level: CG distance from the rear axle',
      tex: 'x_r = \\dfrac{W_f\\,x}{W}',
      sub: `= \\dfrac{${kN(c.Wf)}\\times${n(c.c.x, 4)}}{${kN(c.c.W)}}`,
      result: `x_r = ${n(c.xr, 4)}\\ \\text{m}`,
      cite: SRC.mac502('eq 6.1'),
    },
    {
      label: 'Front raised: axle spacing and tilt',
      tex: "\\beta = \\tan^{-1}\\dfrac{r_r - r_f}{x} + \\tan^{-1}\\dfrac{y' - r_r}{x''}",
      sub: `= \\tan^{-1}\\dfrac{${n(c.rr, 3)} - ${n(0.39, 3)}}{${n(c.c.x, 4)}} + \\tan^{-1}\\dfrac{${n(c.yLift, 3)} - ${n(c.rr, 3)}}{${n(c.xpp, 4)}}`,
      result: `\\beta = ${n(c.beta / deg, 4)}°`,
      cite: SRC.mac502('eq 6.3'),
    },
    {
      label: 'Raised: CG distance from the rear axle',
      tex: "x'_r = \\dfrac{W'_f\\,x''}{W}",
      sub: `= \\dfrac{${kN(c.Wf2)}\\times${n(c.xpp, 4)}}{${kN(c.c.W)}}`,
      result: `x'_r = ${n(c.xr2, 4)}\\ \\text{m}`,
      cite: SRC.mac502('eq 6.2'),
    },
    {
      label: 'CG height above the rear axle',
      tex: "y_g = \\dfrac{x_r - x'_r/\\cos\\beta}{\\tan\\beta}",
      sub: `= \\dfrac{${n(c.xr, 4)} - ${n(c.xr2, 4)}/\\cos${n(c.beta / deg, 4)}°}{\\tan${n(c.beta / deg, 4)}°}`,
      result: `y_g = ${n(c.yg, 3)}\\ \\text{m}\\ (\\text{CG } ${n(c.yg + c.rr, 3)}\\ \\text{m above ground})`,
      cite: SRC.mac502('eq 6.3'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function WTPanel() {
  const st = useWT()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<WTParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      {st.mode === 'pull' ? <LivePull /> : <LiveCg />}
      <Section title="Set-up">
        <Segmented<Mode> label="Mode" value={st.mode} onChange={(mode) => set({ mode })} options={[{ value: 'pull', label: 'Drawbar pull' }, { value: 'cg', label: 'Find the CG' }]} />
        <Segmented<ChassisId> label="Tractor" value={st.chassis} onChange={(chassis) => set({ chassis })} options={[{ value: 'farmland', label: 'Farmland' }, { value: 'exam', label: '28.5 kN example' }]} />
        {st.mode === 'pull' ? (
          <>
            <Slider label="Slope α (− = downhill)" value={st.alpha} min={-15} max={25} step={0.5} unit="°" onChange={(alpha) => set({ alpha })} />
            <Slider label="Pull P" value={st.pull} min={0} max={40} step={0.1} unit="kN" onChange={(pull) => set({ pull })} />
            <Slider label="Pull angle θ below horizontal" value={st.theta} min={-10} max={30} step={0.5} unit="°" onChange={(theta) => set({ theta })} />
            <Slider label="Drawbar height y′" value={st.yd} min={0.3} max={1.0} step={0.01} unit="m" onChange={(yd) => set({ yd })} />
            <Slider label="Drawbar overhang x′" value={st.xd} min={0.3} max={1.0} step={0.01} unit="m" onChange={(xd) => set({ xd })} />
            <Slider label="Rolling resistance ρ" value={st.rho} min={0} max={0.15} step={0.005} onChange={(rho) => set({ rho })} />
          </>
        ) : (
          <Slider label="Front axle raised to y′" value={st.lift} min={0.5} max={1.6} step={0.01} unit="m" onChange={(lift) => set({ lift })} />
        )}
        <Note>
          {st.chassis === 'exam'
            ? 'Example tractor: W = 28.5 kN, Rf = 9 kN and L = 2083 mm are given; r and yg are not, so the Farmland values are used for the slope terms. The 3D model stays the Farmland tractor.'
            : 'Farmland tractor: W = 2850 kg, x = 1.88 m, xr = 0.54 m, yg = 0.13 m, r = 0.635 m, x′ = 0.60 m, y′ = 0.45 m.'}
        </Note>
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      {st.mode === 'pull' ? <LoadChart /> : null}
      <Section title="Exam points">
        <Points
          items={[
            'Pulling moves weight from the front to the rear axle: the horizontal pull acts through y′, the downward component through x′ (and x + x′ on the rear).',
            'Climbing a slope does the same through the CG height r + yg; descending moves weight forward.',
            'Weight transfer helps traction (more Vr) but the front unloads: steering is lost and at Vf = 0 the tractor starts to rear over.',
            'Keep the drawbar low and never hitch above the drawbar (axle, top-link point) — see the Stability scene.',
            'The CG height cannot be found by weighing level; raise one axle and use the change in reading.',
          ]}
        />
      </Section>
      {st.mode === 'pull' ? <PullWorking /> : <CgWorking />}
    </div>
  )
}
