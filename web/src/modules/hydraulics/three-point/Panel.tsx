import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { FARMLAND, staticRear } from '@/physics/chassis'
import { draftLineY } from '@/physics/linkageControl'
import { linkageRange, solveLinkage, phiForHitchHeight } from '@/tractor/linkage'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, CATS, analyse, deg, equilibriumHeight, geomFor, hRange, live, rad, surfaceHeight, useThreePoint, type Cat, type HoldMode, type Stage } from './model'
import { PLOUGH, PLOUGH_WIDTH } from './plough'

const STAGE: Record<Stage, string> = {
  raised: 'Out of work (raised)',
  penetration: 'Penetrating — pulled in',
  equilibrium: 'Free-link equilibrium',
  restrained: 'Restrained working',
  lifting: 'Draft line below V — lifts out',
  parallel: 'Links parallel — V at infinity',
}
const TONE: Record<Stage, 'accent' | 'info' | 'warn' | 'ink'> = { raised: 'ink', penetration: 'accent', equilibrium: 'info', restrained: 'accent', lifting: 'warn', parallel: 'warn' }

function LivePanel() {
  const v = useLive(() => ({ ...live }), 12, (a, b) => a.h === b.h && a.stage === b.stage && a.e === b.e)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <div className="col-span-3">
          <Readout label="Stage" value={STAGE[v.stage]} tone={TONE[v.stage]} />
        </div>
        <Readout label="Hitch height" value={fmt(v.h * 1000, 3)} unit="mm" />
        <Readout label="Working depth" value={fmt(Math.max(0, v.depth) * 1000, 3)} unit="mm" tone="accent" />
        <Readout label="Lift-arm angle β" value={fmt(deg(v.beta), 3)} unit="°" />
        <Readout label="V ahead of axle" value={v.V ? fmt(v.V.x, 3) : '∞'} unit="m" />
        <Readout label="V height" value={v.V ? fmt(v.V.y, 3) : '—'} unit="m" tone={v.V && v.V.y < 0 ? 'warn' : 'info'} />
        <Readout label="Draft line above V" value={v.e === null ? '—' : fmt(v.e * 1000, 3)} unit="mm" tone={v.e !== null && v.e < 0 ? 'warn' : 'accent'} />
        <Readout label="Soil force S" value={fmt(v.S / 1000, 3)} unit="kN" />
        <Readout label="Lift-rod tension" value={fmt(v.T / 1000, 3)} unit="kN" />
        <Readout label="Top link" value={`${fmt(Math.abs(v.Ctop) / 1000, 2)} ${v.Ctop >= 0 ? 'C' : 'T'}`} unit="kN" />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-dim">Blue: lower-link line. Yellow: top-link line. They meet at V (red). Orange: line of the soil force S.</p>
    </Section>
  )
}

function StagePresets() {
  const [sel, setSel] = useState<string | null>(null)
  const set = useThreePoint((s) => s.set)
  const base = { top: 0.55, theta: 10, k: 50, cat: 'II' as Cat }
  const presets = [
    {
      id: 'a',
      label: '(a) Penetration',
      note: 'Hydraulics in float, plough just touching the soil. V is low and well behind the soil-force line, which passes above it: the plough is pulled in. Watch it sink and V rise until the line passes through V.',
      apply: () => {
        set({ ...base, mode: 'float', h: surfaceHeight(base) - 0.004, jump: Date.now() })
      },
    },
    {
      id: 'b',
      label: '(b) Free-link equilibrium',
      note: 'The plough has found its own depth: the soil-force line passes through V, so there is no moment about V and the links carry no lift force from the soil.',
      apply: () => {
        set({ ...base, mode: 'float', h: equilibriumHeight(base) ?? 0.35, jump: Date.now() })
      },
    },
    {
      id: 'c',
      label: '(c) Restrained working',
      note: 'The lift arms hold the plough shallower than its free depth. The line passes above V — the plough still wants to go in — and the lift rods are in tension restraining it.',
      apply: () => {
        const h = (equilibriumHeight(base) ?? 0.35) + 0.05
        set({ ...base, mode: 'hold', h, jump: Date.now() })
      },
    },
    {
      id: 'd',
      label: 'Long top link: V below ground',
      note: 'With the top link wound out to 0.80 m the lines meet below the ground at the start of penetration. The free depth is now far too deep — the hydraulics must restrain the plough.',
      apply: () => {
        const p = { ...base, top: 0.8 }
        set({ ...p, mode: 'float', h: surfaceHeight(p) - 0.004, jump: Date.now() })
      },
    },
  ]
  return (
    <Section title="Working stages">
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              p.apply()
              setSel(p.id)
            }}
            className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${sel === p.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {sel ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{presets.find((p) => p.id === sel)?.note}</p> : null}
    </Section>
  )
}

function PathChart() {
  const top = useThreePoint((s) => s.top)
  const cat = useThreePoint((s) => s.cat)
  const data = useMemo(() => {
    const g = geomFor(top, cat)
    const r = linkageRange(g)
    const xs: number[] = []
    const hy: number[] = []
    const hx: number[] = []
    for (let i = 0; i <= 60; i++) {
      const p = solveLinkage(r.lo + ((r.hi - r.lo) * i) / 60, g)
      xs.push(deg(p.beta))
      hy.push(p.L.y * 1000)
      hx.push(-p.L.x * 1000)
    }
    const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b])
    return [idx.map((i) => xs[i]), idx.map((i) => hy[i]), idx.map((i) => hx[i])]
  }, [top, cat])
  return (
    <Section title="Hitch-point path vs lift-arm angle">
      <Chart
        data={data}
        series={[
          { label: 'Hitch height', color: '#6fb3e0', width: 2 },
          { label: 'Hitch behind axle', color: '#9bd17a', width: 1.5, dash: [5, 4] },
        ]}
        xLabel="Lift-arm angle β (°)"
        yLabel="mm"
        marker={() => [deg(live.beta), live.h * 1000]}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">The lower hitch points rise on an arc about the lower-link pivots; the lift arms swing through a smaller angle than the links.</p>
    </Section>
  )
}

function VChart() {
  const cat = useThreePoint((s) => s.cat)
  const h = useLive(() => Math.round(live.h * 200) / 200, 4)
  const data = useMemo(() => {
    const xs: number[] = []
    const vy: (number | null)[] = []
    const vx: (number | null)[] = []
    for (let t = 0.4; t <= 0.9001; t += 0.01) {
      const g = geomFor(t, cat)
      const p = solveLinkage(phiForHitchHeight(h, g), g)
      xs.push(t * 1000)
      const ok = p.valid && p.V && Math.abs(p.V.x) < 8 && Math.abs(p.V.y) < 4
      vy.push(ok ? p.V!.y : null)
      vx.push(ok ? p.V!.x : null)
    }
    return [xs, vy, vx]
  }, [cat, h])
  return (
    <Section title="V vs top-link length (at this hitch height)">
      <Chart
        data={data}
        series={[
          { label: 'V height', color: '#ff5b5b', width: 2 },
          { label: 'V ahead of axle', color: '#f5b942', width: 1.5, dash: [5, 4] },
        ]}
        xLabel="Top-link length (mm)"
        yLabel="m"
        marker={() => (live.V ? [useThreePoint.getState().top * 1000, live.V.y] : null)}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">Lengthening the top link tips the mast back; near the surface this drops V and helps the plough penetrate.</p>
    </Section>
  )
}

function ThreePointWorking() {
  const st = useThreePoint()
  const h = useLive(() => Math.round(live.h * 1000) / 1000, 4)
  const a = analyse(st, h, st.mode)
  const g = geomFor(st.top, st.cat)
  const lk = a.pose
  const th = rad(st.theta)
  const yAt = lk.V ? draftLineY(a.P, th, lk.V.x) : NaN
  const steps: WorkingStep[] = [
    {
      label: 'Lower link: hitch point L for the hitch height',
      tex: '\\varphi = \\sin^{-1}\\dfrac{y_A - h}{l},\\quad L = (x_A - l\\cos\\varphi,\\ h)',
      sub: `\\varphi = \\sin^{-1}\\dfrac{${n(g.A.y, 3)} - ${n(h, 3)}}{${n(g.lower, 3)}}`,
      result: `\\varphi = ${n(deg(a.phi), 3)}^\\circ,\\ L = (${n(lk.L.x, 3)},\\ ${n(lk.L.y, 3)})\\ \\text{m}`,
      cite: C.fig64[0],
    },
    {
      label: 'Close the four-bar: mast top U',
      tex: '|U - L| = m,\\quad |U - B| = t',
      sub: `m = ${n(g.mast, 3)},\\ t = ${n(g.top, 3)},\\ B = (${n(g.B.x, 3)},\\ ${n(g.B.y, 3)})`,
      result: `U = (${n(lk.U.x, 3)},\\ ${n(lk.U.y, 3)}),\\ \\text{mast tilt } ${n(deg(lk.mastTilt), 2)}^\\circ`,
      cite: C.fig64[1],
    },
    {
      label: 'Virtual hitch point: intersection of lines AL and BU',
      tex: 'V = A + s\\,(L - A),\\quad s = \\dfrac{(B - A)\\times(U - B)}{(L - A)\\times(U - B)}',
      sub: lk.V ? `A = (${n(g.A.x, 3)},\\ ${n(g.A.y, 3)})` : '\\text{lines parallel}',
      result: lk.V ? `V = (${n(lk.V.x, 3)},\\ ${n(lk.V.y, 3)})\\ \\text{m}` : 'V \\to \\infty',
      cite: C.fig65[0],
    },
    {
      label: 'Where does the soil-force line pass V?',
      tex: 'y_S(x_V) = y_P + (x_V - x_P)\\tan\\theta,\\quad e = y_S - y_V',
      sub: lk.V ? `= ${n(a.P.y, 3)} + (${n(lk.V.x, 3)} - (${n(a.P.x, 3)}))\\tan ${n(st.theta, 3)}^\\circ` : '',
      result: lk.V ? `e = ${n(yAt - lk.V.y, 3)}\\ \\text{m}\\ \\Rightarrow\\ \\text{${a.e === null ? '' : a.pullIn ? 'above V: pulled in' : 'below V: lifts out'}}` : '',
      cite: C.fig65[0],
    },
    {
      label: 'Soil force (plough draft) for the depth',
      tex: 'S\\cos\\theta = k\\,w\\,d',
      sub: `= ${n(st.k, 3)}\\,\\text{kN/m}^2\\times${n(PLOUGH_WIDTH, 3)}\\times${n(Math.max(0, a.depth), 3)}`,
      result: `S = ${n(a.S / 1000, 3)}\\ \\text{kN}`,
      cite: SRC.beyond('specific draft of a mouldboard plough'),
      beyond: true,
    },
    {
      label: 'Moment about V and the restraint in the lift rods',
      tex: 'M_V = S\\cos\\theta\\;e,\\qquad T = \\dfrac{\\sum F\\cdot\\partial P/\\partial\\varphi}{\\partial \\ell_{rod}/\\partial\\varphi}',
      sub: `M_V = ${n((a.S * Math.cos(th) * (a.e ?? 0)) / 1000, 3)}\\ \\text{kN·m (soil force only)};\\ W_{plough} = ${n(a.weight / 1000, 3)}\\,\\text{kN}`,
      result: `T = ${n(a.T / 1000, 3)}\\ \\text{kN (both rods, with the weight)}`,
      cite: SRC.beyond('virtual work on the four-bar linkage'),
      beyond: true,
    },
    {
      label: 'Rear-axle load with a mounted implement',
      tex: "V_r = W_r + \\dfrac{S\\sin\\theta\\,(x + x' + b)}{x} - \\dfrac{S\\cos\\theta\\,z}{x}",
      sub: `W_r = ${n(staticRear(FARMLAND) / 1000, 3)},\\ x = ${n(FARMLAND.x, 3)},\\ x' = ${n(-lk.L.x, 3)},\\ b = ${n(lk.L.x - a.P.x, 3)},\\ z = ${n(lk.L.y - a.P.y, 3)}`,
      result: `V_r = ${n(a.Vr / 1000, 4)}\\ \\text{kN},\\ V_f = ${n(a.Vf / 1000, 4)}\\ \\text{kN}`,
      cite: C.mounted[0],
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function ThreePointPanel() {
  const st = useThreePoint()
  const r = hRange(geomFor(st.top, st.cat))
  return (
    <div>
      <LivePanel />
      <Section title="Hydraulics">
        <Segmented<HoldMode>
          value={st.mode}
          onChange={(mode) => (mode === 'hold' ? st.set({ mode, h: live.h }) : st.set({ mode }))}
          options={[
            { value: 'hold', label: 'Hold (arms locked)', title: 'The ram holds the lift arms at the set height' },
            { value: 'float', label: 'Float (free-link)', title: 'Lift arms free: the soil force sets the depth' },
          ]}
        />
        {st.mode === 'hold' ? (
          <Slider label="Hitch height (lift arms)" value={st.h} min={r.lo} max={r.hi} step={0.005} unit="m" digits={3} onChange={(h) => st.set({ h })} />
        ) : (
          <p className="mt-1 text-[11.5px] text-mute">Free-link: the plough moves until the soil-force line passes through V.</p>
        )}
      </Section>
      <Section title="Linkage">
        <Slider label="Top-link length (turnbuckle)" value={st.top} min={0.45} max={0.85} step={0.005} unit="m" digits={3} onChange={(top) => st.set({ top })} />
        <Segmented<Cat> label="Category" value={st.cat} onChange={(cat) => st.set({ cat })} options={(Object.keys(CATS) as Cat[]).map((c) => ({ value: c, label: CATS[c].label }))} />
        <Toggle label="Automatic coupler" checked={st.coupler} onChange={(coupler) => st.set({ coupler })} />
        <Toggle label="Show V construction" checked={st.construct} onChange={(construct) => st.set({ construct })} />
      </Section>
      <Section title="Soil force">
        <Slider label="Angle θ below horizontal" value={st.theta} min={0} max={25} step={0.5} unit="°" onChange={(theta) => st.set({ theta })} />
        <Slider label="Specific soil resistance k" value={st.k} min={20} max={100} step={1} unit="kN/m²" onChange={(k) => st.set({ k })} hint="Typical 30–90 kN/m²" />
      </Section>
      <StagePresets />
      <PathChart />
      <VChart />
      <ThreePointWorking />
      <Section title="Care of the linkage">
        <ul className="list-disc space-y-0.5 pl-4 text-[11.5px] leading-snug text-mute">
          <li>Grease the linkage and levelling box weekly; do not oil the lower-arm balls.</li>
          <li>Attach the left lower arm, then the right (adjustable) arm, then the top link.</li>
          <li>Lower the implement to the ground before parking.</li>
          <li>Never tow from the top-link point — the tractor can overturn backwards.</li>
        </ul>
        <p className="mt-1 text-[10.5px] text-dim">Plough drawn: {PLOUGH.bodies.length} × {PLOUGH.furrow * 1000} mm, {PLOUGH.mass} kg.</p>
      </Section>
    </div>
  )
}
