import { useMemo, useState } from 'react'
import { PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { PERMISSIBLE, manningV, permissibleVelocity, sectionFromArea, type Shape } from '@/physics/water'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, DEFAULTS, channelOf, live, sectionAt, useWaterway } from './model'

function useChannel() {
  const st = useWaterway()
  const ch = useMemo(() => channelOf(st), [st])
  return { st, ch }
}

function LivePanel() {
  const { st, ch } = useChannel()
  const v = useLive(() => ({ ...live }), 8, (a, b) => a.v === b.v && a.d === b.d)
  const vmax = st.mode === 'design' ? st.v : null
  return (
    <Section title="Live" right={!ch.ok ? <Badge tone="danger">no b &gt; 0 solution</Badge> : vmax !== null && v.v > vmax + 1e-3 ? <Badge tone="warn">above permissible</Badge> : <Badge tone="accent">stable</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Flow depth" value={fmt(v.d, 3)} unit="m" />
        <Readout label="Velocity" value={fmt(v.v, 3)} unit="m/s" tone="accent" />
        <Readout label="Discharge" value={fmt(v.q, 3)} unit="m³/s" />
        {ch.shape === 'trapezoidal' ? <Readout label="Bottom width b" value={fmt(ch.b, 3)} unit="m" tone="info" /> : <Readout label="Side slope Z" value={ch.shape === 'parabolic' ? '—' : fmt(ch.Z, 3)} />}
        <Readout label="Design depth D" value={fmt(ch.D, 3)} unit="m" tone="info" />
        <Readout label="Top width T" value={fmt(ch.T, 3)} unit="m" tone="info" />
      </div>
    </Section>
  )
}

function Controls() {
  const { st } = useChannel()
  const [cover, setCover] = useState(0)
  const [erodible, setErodible] = useState(false)
  const vp = permissibleVelocity(cover, st.s, erodible)
  return (
    <Section title="Channel">
      <Segmented<Shape>
        value={st.shape}
        onChange={(shape) => st.set({ shape })}
        size="sm"
        options={[
          { value: 'parabolic', label: 'Parabolic' },
          { value: 'trapezoidal', label: 'Trapezoidal' },
          { value: 'triangular', label: 'Triangular' },
        ]}
      />
      <Segmented
        value={st.mode}
        onChange={(mode) => st.set({ mode })}
        size="sm"
        options={[
          { value: 'design', label: 'Design for Q at v' },
          { value: 'check', label: 'Velocity of a given section' },
        ]}
      />
      {st.mode === 'design' ? (
        <>
          <Slider label="Design flow Q" value={st.Q} min={0.2} max={12} step={0.01} unit="m³/s" onChange={(Q) => st.set({ Q })} />
          <Slider label="Permissible velocity" value={st.v} min={0.5} max={2.5} step={0.05} unit="m/s" onChange={(v) => st.set({ v })} />
        </>
      ) : (
        <>
          <Slider label="Flow area a" value={st.a} min={0.3} max={8} step={0.01} unit="m²" onChange={(a) => st.set({ a })} />
          <Slider label="Flow depth d" value={st.d} min={0.1} max={1.2} step={0.01} unit="m" onChange={(d) => st.set({ d })} />
        </>
      )}
      <Slider label="Slope s" value={st.s} min={0.5} max={12} step={0.1} unit="%" onChange={(s) => st.set({ s })} />
      <Slider label="Manning n" value={st.n} min={0.025} max={0.1} step={0.001} onChange={(nn) => st.set({ n: nn })} />
      {st.shape !== 'parabolic' && !(st.mode === 'check' && st.shape === 'triangular') ? <Slider label="Side slope Z (horizontal : 1)" value={st.Z} min={1} max={10} step={0.5} onChange={(Z) => st.set({ Z })} /> : null}
      <Slider label="Flow now (fraction of capacity)" value={st.flowFrac * 100} min={0} max={100} step={1} unit="%" onChange={(v) => st.set({ flowFrac: v / 100 })} />
      <div className="mt-2 text-[11.5px] text-ink/85">Permissible velocity (Table 7.2)</div>
      <select value={cover} onChange={(e) => setCover(Number(e.target.value))} className="mb-1 w-full rounded border border-line-2 bg-panel-2 px-1 py-0.5 text-[12px] text-ink">
        {PERMISSIBLE.map((r, i) => (
          <option key={i} value={i}>
            {r.cover}
          </option>
        ))}
      </select>
      <Toggle label="Easily eroded soil" checked={erodible} onChange={setErodible} />
      <div className="flex items-center gap-2 text-[11.5px] text-mute">
        {vp ? (
          <>
            <span>
              {fmt(vp, 3)} m/s at {fmt(st.s, 3)} % slope
            </span>
            <button className="rounded border border-line-2 px-1.5 py-0.5 text-ink/85 hover:border-accent/50" onClick={() => st.set({ v: vp, mode: 'design' })}>
              use
            </button>
          </>
        ) : (
          <span>Not recommended on this slope</span>
        )}
      </div>
    </Section>
  )
}

function Presets() {
  const [active, setActive] = useState<string | null>(null)
  const set = useWaterway.getState().set
  const presets: Preset[] = [
    { id: 's1q2b', label: 'Trapezoid, 5.67 m³/s', note: 's = 3 %, v = 1.75 m/s, n = 0.055, Z = 4: a = 3.24 m², R = 0.414 m, p = 7.82 m; 4.246d² − 7.822d + 3.24 = 0 → d = 0.63, b = 2.64, D = 0.73, t = 7.67, T = 8.47 m.', apply: () => set({ ...DEFAULTS }) },
    { id: 's2q5d', label: 'Trapezoid, 7.26 m³/s', note: 'v = 1.15 m/s: a = 6.31 m², R = 0.221 m, p = 28.6 m → d = 0.23, b = 26.7, D = 0.33, t = 28.6, T = 29.4 m — very wide and shallow.', apply: () => set({ ...DEFAULTS, Q: 7.26, v: 1.15 }) },
    { id: 's1q2c-t', label: 'a = 2.55 m², d = 0.4 m: trapezoid', note: 's = 3.5 %, n = 0.04, Z = 4: b = 4.78 m, R = 0.316 m → v = 2.17 m/s.', apply: () => set({ ...DEFAULTS, mode: 'check', shape: 'trapezoidal', a: 2.55, d: 0.4, s: 3.5, n: 0.04 }) },
    { id: 's1q2c-p', label: 'Same, parabolic', note: 't = 9.56 m, R = 0.265 m → v = 1.93 m/s.', apply: () => set({ ...DEFAULTS, mode: 'check', shape: 'parabolic', a: 2.55, d: 0.4, s: 3.5, n: 0.04 }) },
    { id: 's2q3d-p', label: 'a = 1.86 m², d = 0.3 m: parabola', note: 's = 4 %, n = 0.04: parabolic R = 0.199 m → v = 1.71 m/s; triangular (Z = 20.7) 1.41 m/s; trapezoidal 4:1 (b = 5.0 m) 1.98 m/s.', apply: () => set({ ...DEFAULTS, mode: 'check', shape: 'parabolic', a: 1.86, d: 0.3, s: 4, n: 0.04 }) },
    { id: 's2q3d-v', label: 'Same, triangular', note: 'Z = a/d² = 20.7, R = 0.150 m → v = 1.41 m/s.', apply: () => set({ ...DEFAULTS, mode: 'check', shape: 'triangular', a: 1.86, d: 0.3, s: 4, n: 0.04 }) },
  ]
  return (
    <Section title="Exam presets">
      <PresetGrid presets={presets} active={active} onPick={setActive} />
    </Section>
  )
}

function Compare() {
  const { st } = useChannel()
  if (st.mode !== 'check') return null
  const rows = (['parabolic', 'trapezoidal', 'triangular'] as Shape[]).map((sh) => {
    const sec = sectionFromArea(sh, st.a, st.d, st.Z)
    return [sh, fmt(sec.R, 3), fmt(manningV(sec.R, st.s / 100, st.n), 3)]
  })
  return (
    <Section title="Same area and depth, three shapes">
      <Table head={['Shape', 'R (m)', 'v (m/s)']} rows={rows} />
      <p className="mt-1 text-[11px] text-dim">For the same area and depth the shape with the larger hydraulic radius runs faster. The triangle needs very flat sides to hold the area at that depth.</p>
    </Section>
  )
}

function Charts() {
  const { st, ch } = useChannel()
  const data = useMemo(() => {
    const xs: number[] = []
    const q: number[] = []
    const v: number[] = []
    for (let i = 1; i <= 50; i++) {
      const y = (ch.D * i) / 50
      const sec = sectionAt(ch, y)
      const vv = manningV(sec.R, st.s / 100, st.n)
      xs.push(y)
      q.push(sec.a * vv)
      v.push(vv)
    }
    return { xs, q, v }
  }, [ch, st.s, st.n])
  return (
    <Section title="Rating curve">
      <Chart
        key={ch.shape}
        data={[data.xs, data.q, data.v]}
        series={[
          { label: 'Discharge (m³/s)', color: '#5ab4ff', width: 2 },
          { label: 'Velocity (m/s)', color: '#f5b942', width: 1.5, dash: [4, 3] },
        ]}
        xLabel="Flow depth (m)"
        yLabel="q, v"
        marker={() => [live.d, live.q]}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">With grass, n itself falls as the depth rises (blades bend and are submerged); here n is held constant. Size the bottom width for stability with short grass and the depth for capacity with long grass, then add 0.1 m freeboard.</p>
    </Section>
  )
}

function WorkingSection() {
  const { st, ch } = useChannel()
  const sq = Math.sqrt(ch.Z * ch.Z + 1)
  const steps: WorkingStep[] = []
  if (st.mode === 'design') {
    steps.push(
      { label: 'Flow area', tex: 'a = \\dfrac{Q}{v}', sub: `= \\dfrac{${n(st.Q, 4)}}{${n(st.v, 3)}}`, result: `= ${n(st.Q / st.v, 4)}\\ \\text{m}^2`, cite: C.vw('Eq. 7.2 continuity') },
      { label: 'Hydraulic radius from Manning', tex: 'R = \\left(\\dfrac{vn}{\\sqrt{s}}\\right)^{1.5}', sub: `= \\left(\\dfrac{${n(st.v, 3)}\\times${n(st.n, 3)}}{\\sqrt{${n(st.s / 100, 3)}}}\\right)^{1.5}`, result: `= ${n(ch.Rreq, 4)}\\ \\text{m}`, cite: C.vw('Eq. 7.1 Manning') },
    )
    if (ch.shape === 'trapezoidal')
      steps.push(
        { label: 'Wetted perimeter', tex: 'p = \\dfrac{a}{R}', sub: `= \\dfrac{${n(ch.a, 4)}}{${n(ch.R, 4)}}`, result: `= ${n(ch.p, 4)}\\ \\text{m}`, cite: C.vw('Fig. 7.1') },
        { label: 'Solve for d (b = p − 2d√(Z²+1))', tex: '(2\\sqrt{Z^2+1} - Z)d^2 - pd + a = 0', sub: `${n(2 * sq - ch.Z, 4)}d^2 - ${n(ch.p, 4)}d + ${n(ch.a, 4)} = 0`, result: `d = ${n(ch.d, 3)}\\ \\text{m},\\ b = ${n(ch.b, 3)}\\ \\text{m}`, cite: C.s1('Q2b') },
        { label: 'Top widths', tex: 'D = d + 0.1,\\ t = b + 2Zd,\\ T = b + 2ZD', sub: `D = ${n(ch.D, 3)},\\ t = ${n(ch.b, 3)} + 2(${n(ch.Z, 2)})(${n(ch.d, 3)})`, result: `t = ${n(ch.t, 3)}\\ \\text{m},\\ T = ${n(ch.T, 3)}\\ \\text{m}`, cite: C.vw('Fig. 7.1') },
      )
    else if (ch.shape === 'parabolic')
      steps.push({ label: 'Parabola', tex: 'R = \\dfrac{t^2d}{1.5t^2 + 4d^2},\\ t = \\dfrac{1.5a}{d},\\ T = t\\sqrt{D/d}', sub: `d \\approx 1.5R \\text{ then iterate}`, result: `d = ${n(ch.d, 3)},\\ t = ${n(ch.t, 3)},\\ D = ${n(ch.D, 3)},\\ T = ${n(ch.T, 3)}\\ \\text{m}`, cite: C.vw('Ex. 7.2') })
    else steps.push({ label: 'Triangle', tex: 'a = Zd^2,\\ R = \\dfrac{Zd}{2\\sqrt{Z^2+1}}', sub: `d = \\sqrt{${n(ch.a, 4)}/${n(ch.Z, 3)}} = ${n(ch.d, 3)}`, result: `R = ${n(ch.R, 3)}\\ \\text{m},\\ v = ${n(ch.v, 3)}\\ \\text{m/s}`, cite: C.vw('Fig. 7.1') })
  } else {
    steps.push({ label: `Section (${ch.shape})`, tex: ch.shape === 'trapezoidal' ? 'b = \\dfrac{a - Zd^2}{d},\\ p = b + 2d\\sqrt{Z^2+1}' : ch.shape === 'parabolic' ? 't = \\dfrac{1.5a}{d},\\ p = t + \\dfrac{8d^2}{3t}' : 'Z = \\dfrac{a}{d^2},\\ p = 2d\\sqrt{Z^2+1}', sub: `a = ${n(ch.a, 4)},\\ d = ${n(ch.d, 3)}`, result: `p = ${n(ch.p, 4)}\\ \\text{m},\\ R = ${n(ch.R, 4)}\\ \\text{m}`, cite: C.vw('Fig. 7.1') }, { label: 'Manning velocity', tex: 'v = \\dfrac{R^{2/3}s^{1/2}}{n}', sub: `= \\dfrac{${n(ch.R, 4)}^{2/3}\\times${n(st.s / 100, 3)}^{1/2}}{${n(st.n, 3)}}`, result: `= ${n(ch.v, 3)}\\ \\text{m/s}`, cite: C.s1('Q2c'), })
  }
  steps.push({ label: 'Proof of the trapezoid formulas', tex: 'a = bd + 2\\cdot\\tfrac12 d(Zd) = bd + Zd^2,\\quad p = b + 2\\sqrt{d^2 + (Zd)^2} = b + 2d\\sqrt{Z^2+1}', cite: C.s2('Q3 proof') })
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
      <Compare />
      <Charts />
      <WorkingSection />
    </div>
  )
}
