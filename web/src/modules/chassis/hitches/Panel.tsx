import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { walkingHandleForce } from '@/physics/chassis'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { LoadBars, Note, Points, PresetGrid, Table, Truth, type Preset } from '../common/bits'
import { CH, DEFAULTS, HITCH_LABEL, WALKER, WTH_A, WTH_B, loadsFor, solve, useHitch, type Hitch, type HitchParams } from './model'

const deg = Math.PI / 180
const kN = (v: number, d = 4) => n(v / 1000, d)
const HITCHES: Hitch[] = ['trailed', 'semi', 'mounted', 'wth']
const apply = (p: Partial<HitchParams>) => useHitch.getState().set({ ...DEFAULTS, ...p })

const PRESETS: Preset[] = [
  { id: 'tine', label: 'Tine cultivator, θ 20°', note: 'A typical downward-acting soil force on tines: the mounted hitch moves the most weight onto the rear axle.', apply: () => apply({ hitch: 'mounted', theta: 20 }) },
  { id: 'flat', label: 'Horizontal force, θ 0°', note: 'With no vertical component the mounted implement’s depth z works against it; the trailed and semi-mounted hitches (force at drawbar height) transfer more.', apply: () => apply({ hitch: 'mounted', theta: 0 }) },
  { id: 'deep', label: 'Deep working, z 0.35 m', note: 'Working deeper lowers the line of the soil force: the rear-gain condition needs a larger θ before the mounted hitch adds weight to the rear.', apply: () => apply({ hitch: 'mounted', theta: 10, z: 0.35 }) },
  { id: 'semi', label: 'Semi-mounted plough', note: 'Semi-mounted: pinned to the lower links, castor wheel a = 2 m behind; part of the vertical soil force reaches the tractor.', apply: () => apply({ hitch: 'semi', theta: 20 }) },
  { id: 'wth', label: 'Weight-transfer hitch', note: 'W′ = 6 kN trailer, lift force F = 3 kN at c = 0.4 m. The chain moves implement weight onto the tractor rear axle.', apply: () => apply({ hitch: 'wth' }) },
]

function LivePanel() {
  const st = useHitch()
  const s = solve(st)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Front Vf" value={fmt(s.sel.Vf / 1000, 3)} unit="kN" tone={s.sel.Vf <= 0 ? 'warn' : 'info'} />
        <Readout label="Rear Vr" value={fmt(s.sel.Vr / 1000, 3)} unit="kN" tone="accent" />
        <Readout label="tan θ" value={fmt(s.tanTheta, 3)} />
        <Readout label="Rear gain" value={fmt(s.sel.gainRear / 1000, 3)} unit="kN" />
        <Readout label="Front loss" value={fmt(s.sel.lossFront / 1000, 3)} unit="kN" />
        <Readout label="S cos θ / S sin θ" value={`${fmt((st.S * Math.cos(st.theta * deg)), 3)} / ${fmt(st.S * Math.sin(st.theta * deg), 3)}`} unit="kN" />
      </div>
      <div className="mt-2">
        <LoadBars
          max={30}
          rows={[
            { label: 'Front axle', value: s.sel.Vf / 1000, stat: s.Wf / 1000, color: '#6fb3e0' },
            { label: 'Rear axle', value: s.sel.Vr / 1000, stat: s.Wr / 1000, color: '#9bd17a' },
          ]}
        />
      </div>
    </Section>
  )
}

function Comparison() {
  const st = useHitch()
  const s = solve(st)
  return (
    <Section title="Same soil force, four hitches">
      <Table
        head={['Hitch', 'ΔVr kN', 'ΔVf kN', 'Vr kN']}
        highlight={HITCHES.indexOf(st.hitch)}
        rows={HITCHES.map((h) => [HITCH_LABEL[h], fmt(s.all[h].gainRear / 1000, 3), fmt(-s.all[h].lossFront / 1000, 3), fmt(s.all[h].Vr / 1000, 4)])}
      />
      <div className="mt-2 space-y-1">
        {s.conditions.map((c) => (
          <div key={c.eq} className="flex items-center justify-between gap-2 text-[11.5px]">
            <span className="text-ink/85">
              {c.what}
              <span className="block font-mono text-[10.5px] text-mute">tan θ &gt; {fmt(c.lim, 3)}</span>
            </span>
            <span className="flex shrink-0 gap-1">
              <Truth ok={c.stated}>{c.stated ? 'rule: true' : 'rule: false'}</Truth>
              <Truth ok={c.actual}>{c.actual ? 'loads: true' : 'loads: false'}</Truth>
            </span>
          </div>
        ))}
      </div>
      <Note>
        “rule” applies the quoted tan θ condition; “loads” compares the axle loads directly. The two always agree for the mounted conditions. For semi-mounted vs trailed the load equations give a semi-mounted gain over trailed of [S sin θ (a − b) + S cos θ (z + y′)](x + x′)/(a·x), which is positive for any downward soil force, so the quoted condition for that case does not follow from the semi-mounted load equation.
      </Note>
    </Section>
  )
}

function GainChart() {
  const st = useHitch()
  const data = useMemo(() => {
    const xs: number[] = []
    const ys: number[][] = HITCHES.map(() => [])
    for (let t = 0; t <= 45; t += 1) {
      xs.push(t)
      HITCHES.forEach((h, i) => ys[i].push(loadsFor({ ...st, theta: t }, h).gainRear / 1000))
    }
    return [xs, ...ys]
  }, [st])
  return (
    <Section title="Rear-axle gain vs soil-force angle">
      <Chart
        data={data}
        series={[
          { label: 'trailed', color: '#9bd17a', width: 2 },
          { label: 'semi', color: '#f5b942', width: 2 },
          { label: 'mounted', color: '#e8794f', width: 2 },
          { label: 'WT hitch', color: '#c792ea', width: 2, dash: [4, 3] },
        ]}
        xLabel="θ (deg)"
        yLabel="ΔVr (kN)"
        marker={() => {
          const p = useHitch.getState()
          return [p.theta, solve(p).sel.gainRear / 1000]
        }}
        height={170}
      />
      <Note>The mounted line crosses the others where the mounted-vs-semi and mounted-vs-trailed conditions switch: at small θ the deep soil force works against it.</Note>
    </Section>
  )
}

function HitchWorking() {
  const st = useHitch()
  const s = solve(st)
  const { x, xd, yd } = CH
  const { b, z, a } = st
  const S = st.S * 1000
  const th = st.theta * deg
  const sh = S * Math.cos(th)
  const sv = S * Math.sin(th)
  const L = s.sel
  const steps: WorkingStep[] = []
  if (st.hitch === 'trailed') {
    steps.push({
      label: 'Trailed: only the horizontal pull acts on the tractor',
      tex: "V_r = W_r + \\dfrac{S\\cos\\theta\\,y'}{x},\\quad V_f = W_f - \\dfrac{S\\cos\\theta\\,y'}{x}",
      sub: `V_r = ${kN(s.Wr)} + \\dfrac{${kN(sh)}\\times${yd}}{${x}}`,
      result: `V_r = ${kN(L.Vr)},\\ V_f = ${kN(L.Vf)}\\ \\text{kN}`,
      cite: SRC.mac502('eqs 6.11–6.12'),
    })
  } else if (st.hitch === 'semi') {
    steps.push({
      label: 'Semi-mounted: castor wheel a behind the hitch',
      tex: "V_r = W_r + \\dfrac{S\\sin\\theta\\,(a-b)(x+x')}{a\\,x} + \\dfrac{S\\cos\\theta\\,[a y' + (z+y')(x+x')]}{a\\,x}",
      sub: `= ${kN(s.Wr)} + \\dfrac{${kN(sv)}(${a}-${b})(${x}+${xd})}{${a}\\times${x}} + \\dfrac{${kN(sh)}[${a}\\times${yd} + (${z}+${yd})(${x}+${xd})]}{${a}\\times${x}}`,
      result: `V_r = ${kN(L.Vr)},\\ V_f = ${kN(L.Vf)}\\ \\text{kN}`,
      cite: SRC.mac502('eqs 6.13–6.14'),
    })
  } else if (st.hitch === 'mounted') {
    steps.push(
      {
        label: 'Fully mounted: rear axle',
        tex: "V_r = W_r + \\dfrac{S\\sin\\theta\\,(x+x'+b)}{x} - \\dfrac{S\\cos\\theta\\,z}{x}",
        sub: `= ${kN(s.Wr)} + \\dfrac{${kN(sv)}(${x}+${xd}+${b})}{${x}} - \\dfrac{${kN(sh)}\\times${z}}{${x}}`,
        result: `V_r = ${kN(L.Vr)}\\ \\text{kN}`,
        cite: SRC.mac502('eq 6.15'),
      },
      {
        label: 'Fully mounted: front axle',
        tex: "V_f = W_f - \\dfrac{S\\sin\\theta\\,(x'+b)}{x} + \\dfrac{S\\cos\\theta\\,z}{x}",
        sub: `= ${kN(s.Wf)} - \\dfrac{${kN(sv)}(${xd}+${b})}{${x}} + \\dfrac{${kN(sh)}\\times${z}}{${x}}`,
        result: `V_f = ${kN(L.Vf)}\\ \\text{kN}`,
        cite: SRC.mac502('eq 6.16'),
      },
    )
  } else {
    steps.push(
      {
        label: 'Weight-transfer hitch: static hitch load of the trailer',
        tex: "T = \\dfrac{W'(a-b)}{a}",
        sub: `= \\dfrac{${n(st.Wt, 3)}(${WTH_A}-${WTH_B})}{${WTH_A}}`,
        result: `T = ${kN(L.T)}\\ \\text{kN}`,
        cite: SRC.mac502('Fig 6.15'),
      },
      {
        label: 'Rear axle with pull P = S cos θ and lift force F',
        tex: "V_r = W_r + \\dfrac{W'(a-b)(x+x')}{a x} + \\dfrac{P y'(a+x+x')}{a x} + \\dfrac{F c\\,(a+x+x')}{a x}",
        result: `V_r = ${kN(L.Vr)}\\ \\text{kN}`,
        cite: SRC.mac502('eq 6.30'),
      },
      {
        label: 'Front axle',
        tex: "V_f = W_f - \\dfrac{W'(a-b)x'}{a x} - \\dfrac{P(x'+a)y'}{a x} - \\dfrac{F c\\,(a+x')}{a x}",
        result: `V_f = ${kN(L.Vf)}\\ \\text{kN}`,
        cite: SRC.mac502('eq 6.31'),
      },
    )
  }
  steps.push({
    label: 'Mounted vs trailed',
    tex: "\\tan\\theta > \\dfrac{z + y'}{x + x' + b}",
    sub: `${n(s.tanTheta, 3)} > \\dfrac{${z}+${yd}}{${x}+${xd}+${b}} = ${n(s.conditions[3].lim, 3)}`,
    result: s.conditions[3].stated ? '\\text{true: mounted transfers more}' : '\\text{false: trailed transfers more}',
    cite: SRC.mac502('eqs 6.17–6.21, Tables 6.1–6.2'),
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

function Walker() {
  const [alpha, setAlpha] = useState(0)
  const [P, setP] = useState(0.6)
  const w = walkingHandleForce(WALKER.W, WALKER.xr, WALKER.r, WALKER.yg, WALKER.xh, alpha * deg, P * 1000, 0, WALKER.xd, WALKER.yd)
  return (
    <Section title="Two-wheel walking tractor">
      <Slider label="Slope α" value={alpha} min={-15} max={15} step={0.5} unit="°" onChange={setAlpha} />
      <Slider label="Pull P (horizontal)" value={P} min={0} max={2} step={0.05} unit="kN" onChange={setP} />
      <div className="grid grid-cols-2 gap-1.5">
        <Readout label="U₀ (no pull)" value={fmt(w.U0, 3)} unit="N" />
        <Readout label="Handle force U" value={fmt(w.U, 3)} unit="N" tone={w.U < 0 ? 'warn' : 'accent'} />
      </div>
      <Note>
        U = U₀ − P cos θ·y′/xh − P sin θ·x′/xh. The operator must hold the handles down when U &lt; 0; the adjustable front counterweight moves xr to balance. Balance needs xr = ψ′·y′. Tractor values here are typical, assumed values (W 2.4 kN, xr 0.15 m, handle 1.2 m).
      </Note>
    </Section>
  )
}

export function HitchPanel() {
  const st = useHitch()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<HitchParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Hitch and soil force">
        <Segmented<Hitch> label="Hitch" value={st.hitch} onChange={(hitch) => set({ hitch })} options={HITCHES.map((h) => ({ value: h, label: HITCH_LABEL[h].replace('Weight-transfer hitch', 'WT hitch') }))} />
        <Slider label="Soil force S" value={st.S} min={0} max={20} step={0.5} unit="kN" onChange={(S) => set({ S })} />
        <Slider label="Angle θ below horizontal" value={st.theta} min={0} max={45} step={1} unit="°" onChange={(theta) => set({ theta })} />
        <Slider label="Behind the hitch, b" value={st.b} min={0.5} max={1.8} step={0.05} unit="m" onChange={(b) => set({ b })} />
        <Slider label="Depth below surface, z" value={st.z} min={0} max={0.4} step={0.01} unit="m" onChange={(z) => set({ z })} />
        {st.hitch === 'semi' ? <Slider label="Castor wheel behind hitch, a" value={st.a} min={1.4} max={3} step={0.05} unit="m" onChange={(a) => set({ a })} /> : null}
        {st.hitch === 'wth' ? (
          <>
            <Slider label="Trailer weight W′" value={st.Wt} min={0} max={15} step={0.5} unit="kN" onChange={(Wt) => set({ Wt })} />
            <Slider label="Lift force F" value={st.F} min={0} max={8} step={0.25} unit="kN" onChange={(F) => set({ F })} />
            <Slider label="Lift-force arm c" value={st.c} min={0} max={1} step={0.05} unit="m" onChange={(c) => set({ c })} />
            <Note>Trailer axle a = {WTH_A} m and W′ at b = {WTH_B} m behind the hitch (typical values); pull P = S cos θ.</Note>
          </>
        ) : null}
        <Note>All hitches use the same hitch point x′ = 0.60 m, y′ = 0.45 m (Farmland drawbar), so the comparison is like for like; the 3D linkage balls sit a little further back.</Note>
      </Section>
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Comparison />
      <GainChart />
      <Section title="Exam points">
        <Points
          items={[
            'Attachment modes: towed (single point), mounted (three-point), semi-mounted and frame-mounted.',
            'Trailed: only the horizontal pull reaches the tractor, at drawbar height. Semi-mounted: pivots vertically, rigid in plan; part of the implement weight and soil force is carried. Mounted: the whole soil force is carried.',
            'A downward soil force (θ > 0) on a mounted implement adds weight to the rear axle — the basis of draft control and weight transfer.',
            'The weight-transfer hitch gives a trailed implement some of the mounted implement’s advantage.',
          ]}
        />
      </Section>
      <HitchWorking />
      <Walker />
    </div>
  )
}
