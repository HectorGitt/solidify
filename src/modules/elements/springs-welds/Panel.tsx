import { useMemo, useState } from 'react'
import { activeCoils, filletParallel, filletTransverse, leafThickness, ropeWinch, shearStressFactor, wahlFactor, wireDiameter } from '@/physics/elements'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { A503 } from '../_shared/cites'
import { ModeTabs, Note, PresetGrid, erratum, type Preset } from '../_shared/PanelBits'
import { DEFAULTS, helicalResult, leafResult, useSW, weldResult, type Mode, type SWParams } from './model'

const set = (p: Partial<SWParams>) => useSW.getState().set(p)
const base = (p: Partial<SWParams>) => set({ ...DEFAULTS, ...p })
const MPa = (x: number) => n(x / 1e6, 4)

export const PRESETS: Preset[] = [
  {
    id: 'mg21',
    label: 'Helical spring · 2021/22',
    note: 'Exam 2021/22 Q4d: 500 N deflects 25 mm, C = 8, τ = 350 MPa, G = 84 GPa → k = 20 N/mm; with K_s = 1.0625: d = 5.56 → 6 mm, D = 48 mm, n = 6.15 active coils.',
    errata: 'wahl',
    apply: () => base({ mode: 'helical', F: 500, d: 0.006, D: 0.048, n: 6.15, G: 84e9, tau: 350e6, factor: 'ks', L0: 0.09 }),
  },
  {
    id: 'mg21-wahl',
    label: 'Same spring · Wahl factor',
    note: 'With the Wahl factor K = (4C − 1)/(4C − 4) + 0.615/C = 1.184 for C = 8: d = 5.87 mm — still a 6 mm wire, now at 330 MPa.',
    apply: () => base({ mode: 'helical', F: 500, d: 0.006, D: 0.048, n: 6.15, G: 84e9, tau: 350e6, factor: 'wahl', L0: 0.09 }),
  },
  {
    id: 'mg17-leaf',
    label: 'Leaf spring · 2017/18',
    note: 'Exam 2017/18 Q4c: 1 m cantilever, 8 graduated + 1 extra full-length leaf, b = 45 mm, 2000 N, 75 mm deflection (E = 200 GPa) → t³ = 1.87×10⁻⁶ m³, t = 12.3 mm; 277 MN/m² in the full leaf without pre-stress, 195 MN/m² pre-stressed.',
    apply: () => base({ mode: 'leaf', lF: 2000, L: 1, b: 0.045, t: 0.0123, ne: 1, ng: 8, E: 200e9, prestressed: false }),
  },
  {
    id: 'mg17-leaf-pre',
    label: 'Leaf spring · pre-stressed',
    note: 'The same spring with the full leaf pre-formed (nip h = 2FL³/(nbt³E)): every leaf carries 6FL/(nbt²) = 195 MN/m² at full load. Drag the load down to see the nip gap open.',
    apply: () => base({ mode: 'leaf', lF: 2000, L: 1, b: 0.045, t: 0.0123, ne: 1, ng: 8, E: 200e9, prestressed: true }),
  },
  {
    id: 'bracket',
    label: 'Bracket · 35 kN at 570 mm',
    note: 'Worked example: C-shaped weld 120/240/120 mm, 35 kN at 570 mm from the c.g. → N_y = 30 mm, J_w = 5.328×10⁻³ m³, f = 0.609 MN/m → w = 0.609/(0.707 × 94) = 9.2 mm, say 10 mm.',
    apply: () => base({ mode: 'weld', weld: 'bracket', V: 35e3, arm: 0.57, wb: 0.12, wd: 0.24, leg: 0.01 }),
  },
  {
    id: 'bar',
    label: 'Ø50 bar · 10 kN at 200 mm',
    note: 'Exams 2015/16 Q6c, 2017/18, 2019/20 and 2021/22: Z_w = πd²/4 = 1.964×10⁻³ m², f_b = M/Z_w = 1.02 MN/m, f_s = 63.7 kN/m, f = 1.022 MN/m → w = f/(0.707 s) = 15.4 mm.',
    apply: () => base({ mode: 'weld', weld: 'bar', V: 10e3, arm: 0.2, barD: 0.05, leg: 0.0154 }),
  },
]

function LivePanel() {
  const p = useSW()
  if (p.mode === 'helical') {
    const r = helicalResult(p)
    return (
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Index C" value={fmt(r.C, 3)} />
          <Readout label={p.factor === 'wahl' ? 'Wahl K' : 'K_s'} value={fmt(r.K, 4)} />
          <Readout label="Stiffness" value={fmt(r.k / 1000, 3)} unit="N/mm" />
          <Readout label="Deflection" value={fmt(r.y * 1000, 3)} unit="mm" tone="info" />
          <Readout label="Shear stress" value={fmt(r.tau / 1e6, 3)} unit="MPa" tone={r.tau > p.tau ? 'warn' : 'accent'} />
          <Readout label="Solid length" value={fmt(r.solid * 1000, 3)} unit="mm" tone={r.bottomed ? 'warn' : 'ink'} />
        </div>
        {r.bottomed ? <Note tone="warn">The spring has closed solid: F at solid = {fmt(r.Fsolid, 3)} N.</Note> : null}
      </Section>
    )
  }
  if (p.mode === 'leaf') {
    const r = leafResult(p)
    return (
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Leaves" value={`${p.ne} + ${p.ng}`} />
          <Readout label="Deflection" value={fmt(r.y * 1000, 3)} unit="mm" tone="info" />
          <Readout label="Nip gap h" value={fmt(r.h * 1000, 3)} unit="mm" />
          <Readout label="Full leaf s_e" value={fmt(r.se / 1e6, 3)} unit="MPa" tone={p.prestressed ? 'ink' : 'warn'} />
          <Readout label="Graduated s_g" value={fmt(r.sg / 1e6, 3)} unit="MPa" />
          <Readout label="Pre-stressed s" value={fmt(r.s / 1e6, 3)} unit="MPa" tone={p.prestressed ? 'accent' : 'ink'} />
        </div>
      </Section>
    )
  }
  const r = weldResult(p)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Force per length f" value={fmt(r.f / 1e6, 3)} unit="MN/m" tone="accent" />
        <Readout label="Leg needed" value={fmt(r.w * 1000, 3)} unit="mm" tone="info" />
        <Readout label="Throat stress" value={fmt(r.sActual / 1e6, 3)} unit="MPa" tone={r.sActual > p.s ? 'warn' : 'ink'} />
      </div>
    </Section>
  )
}

function Controls() {
  const p = useSW()
  return (
    <Section title="Element">
      <ModeTabs<Mode>
        value={p.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'helical', label: 'Helical spring' },
          { value: 'leaf', label: 'Leaf spring' },
          { value: 'weld', label: 'Welded joints' },
        ]}
      />
      <div className="h-2" />
      {p.mode === 'helical' ? (
        <>
          <Slider label="Axial load F" value={p.F} min={0} max={1200} step={5} unit="N" onChange={(F) => set({ F })} />
          <Slider label="Wire diameter d" value={p.d * 1000} min={2} max={12} step={0.1} unit="mm" onChange={(x) => set({ d: x / 1000 })} />
          <Slider label="Mean coil diameter D" value={p.D * 1000} min={Math.max(12, p.d * 3000)} max={100} step={0.5} unit="mm" onChange={(x) => set({ D: x / 1000 })} />
          <Slider label="Active coils n" value={p.n} min={2} max={15} step={0.05} onChange={(nn) => set({ n: nn })} />
          <Slider label="Free length" value={p.L0 * 1000} min={40} max={200} step={1} unit="mm" onChange={(x) => set({ L0: x / 1000 })} />
          <Slider label="Allowable shear τ" value={p.tau / 1e6} min={200} max={800} step={5} unit="MPa" onChange={(x) => set({ tau: x * 1e6 })} />
          <Segmented
            value={p.factor}
            onChange={(factor) => set({ factor })}
            options={[
              { value: 'wahl', label: 'Wahl K' },
              { value: 'ks', label: 'K_s = 1 + 0.5/C' },
            ]}
          />
        </>
      ) : null}
      {p.mode === 'leaf' ? (
        <>
          <Slider label="Load at the tip F" value={p.lF} min={0} max={4000} step={10} unit="N" onChange={(lF) => set({ lF })} />
          <Slider label="Cantilever length L" value={p.L * 1000} min={400} max={1000} step={10} unit="mm" onChange={(x) => set({ L: x / 1000 })} />
          <Slider label="Leaf width b" value={p.b * 1000} min={30} max={100} step={1} unit="mm" onChange={(x) => set({ b: x / 1000 })} />
          <Slider label="Leaf thickness t" value={p.t * 1000} min={5} max={20} step={0.1} unit="mm" onChange={(x) => set({ t: x / 1000 })} />
          <Slider label="Extra full-length leaves n_e" value={p.ne} min={1} max={4} step={1} onChange={(ne) => set({ ne })} />
          <Slider label="Graduated leaves n_g" value={p.ng} min={2} max={12} step={1} onChange={(ng) => set({ ng })} />
          <Toggle label="Full leaves pre-stressed (nip)" checked={p.prestressed} onChange={(prestressed) => set({ prestressed })} />
        </>
      ) : null}
      {p.mode === 'weld' ? (
        <>
          <Segmented
            value={p.weld}
            onChange={(weld) => set(weld === 'bar' ? { weld, V: 10e3, arm: 0.2, leg: 0.0154 } : { weld, V: 35e3, arm: 0.57, leg: 0.01 })}
            options={[
              { value: 'bar', label: 'Round bar to plate' },
              { value: 'bracket', label: 'Eccentric bracket' },
            ]}
          />
          <Slider label="Load V" value={p.V / 1000} min={1} max={60} step={0.5} unit="kN" onChange={(x) => set({ V: x * 1000 })} />
          <Slider label={p.weld === 'bar' ? 'Arm from the plate e' : 'Arm from the weld c.g. e'} value={p.arm * 1000} min={50} max={800} step={5} unit="mm" onChange={(x) => set({ arm: x / 1000 })} />
          {p.weld === 'bar' ? (
            <Slider label="Bar diameter d" value={p.barD * 1000} min={20} max={100} step={1} unit="mm" onChange={(x) => set({ barD: x / 1000 })} />
          ) : (
            <>
              <Slider label="Flange welds b" value={p.wb * 1000} min={50} max={200} step={5} unit="mm" onChange={(x) => set({ wb: x / 1000 })} />
              <Slider label="Web weld d" value={p.wd * 1000} min={100} max={400} step={5} unit="mm" onChange={(x) => set({ wd: x / 1000 })} />
            </>
          )}
          <Slider label="Leg size w (drawn)" value={p.leg * 1000} min={3} max={25} step={0.1} unit="mm" onChange={(x) => set({ leg: x / 1000 })} />
          <Slider label="Allowable stress s" value={p.s / 1e6} min={50} max={150} step={1} unit="MN/m²" onChange={(x) => set({ s: x * 1e6 })} hint="AWS: 94 MN/m² (13 600 psi)" />
        </>
      ) : null}
    </Section>
  )
}

function HelicalWorking() {
  const p = useSW()
  const r = helicalResult(p)
  const y = p.F / Math.max(1, r.k)
  const dReq = wireDiameter(p.F, r.C, p.tau, r.K)
  const steps: WorkingStep[] = [
    { label: 'Spring index', tex: 'C=D/d', sub: `=${n(p.D * 1000, 4)}/${n(p.d * 1000, 3)}`, result: `=${n(r.C, 4)}`, cite: A503.m(10, 'slide 12') },
    p.factor === 'wahl'
      ? { label: 'Wahl factor', tex: 'K=\\dfrac{4C-1}{4C-4}+\\dfrac{0.615}{C}', sub: `=\\dfrac{4(${n(r.C, 4)})-1}{4(${n(r.C, 4)})-4}+\\dfrac{0.615}{${n(r.C, 4)}}`, result: `=${n(r.Kw, 4)}`, cite: A503.m(10, 'slide 12') }
      : { label: 'Shear-stress factor used by the guide', tex: 'K_s=1+\\dfrac{0.5}{C}', sub: `=1+\\dfrac{0.5}{${n(r.C, 4)}}`, result: `=${n(r.Ks, 4)}\\quad(\\text{Wahl } K=${n(r.Kw, 4)})`, cite: A503.mg21('Q4d'), errata: erratum('wahl') },
    { label: 'Shear stress in the wire', tex: 's_s=K\\dfrac{8FD}{\\pi d^3}', sub: `=${n(r.K, 4)}\\dfrac{8(${n(p.F, 4)})(${n(p.D, 4)})}{\\pi(${n(p.d, 4)})^3}`, result: `=${MPa(r.tau)}\\ \\text{MPa}\\ ${r.tau > p.tau ? '>' : '\\le'}\\ ${MPa(p.tau)}`, cite: A503.m(10, 'slide 12') },
    { label: 'Deflection and stiffness', tex: 'y=\\dfrac{8FD^3n}{d^4G},\\quad k=F/y', sub: `y=\\dfrac{8(${n(p.F, 4)})(${n(p.D, 4)})^3(${n(p.n, 3)})}{(${n(p.d, 4)})^4(${n(p.G, 3)})}`, result: `y=${n(y * 1000, 4)}\\ \\text{mm},\\ k=${n(r.k / 1000, 4)}\\ \\text{N/mm}`, cite: A503.m(10, 'slide 13') },
    { label: 'Design: wire size for the allowable stress', tex: 'd=\\sqrt{\\dfrac{8KFC}{\\pi\\tau}}', sub: `=\\sqrt{\\dfrac{8(${n(r.K, 4)})(${n(p.F, 4)})(${n(r.C, 4)})}{\\pi(${n(p.tau, 3)})}}`, result: `=${n(dReq * 1000, 3)}\\ \\text{mm}\\ \\to\\ \\text{next size up}`, cite: A503.mg21('Q4d') },
    { label: 'Design: active coils for the deflection', tex: 'n=\\dfrac{y\\,d\\,G}{8FC^3}', sub: `=\\dfrac{${n(y, 4)}(${n(p.d, 4)})(${n(p.G, 3)})}{8(${n(p.F, 4)})(${n(r.C, 4)})^3}`, result: `=${n(activeCoils(y, p.F, r.C, p.d, p.G), 4)}`, cite: A503.mg21('Q4d') },
  ]
  return <Working steps={steps} />
}

function LeafWorking() {
  const p = useSW()
  const r = leafResult(p)
  const D = `${n(p.b, 3)}(${n(p.t, 3)})^2(3\\times${p.ne}+2\\times${p.ng})`
  const steps: WorkingStep[] = [
    { label: 'Thickness for the deflection (design)', tex: 't^3=\\dfrac{12FL^3}{byE(3n_e+2n_g)}', sub: `y=${n(r.y * 1000, 4)}\\ \\text{mm}:\\ t=\\sqrt[3]{\\dfrac{12(${p.lF})(${p.L})^3}{${n(p.b, 3)}(${n(r.y, 4)})(${n(p.E, 3)})(${3 * p.ne + 2 * p.ng})}}`, result: `t=${n(leafThickness(p.lF, p.L, p.b, r.y, p.E, p.ne, p.ng) * 1000, 3)}\\ \\text{mm}`, cite: A503.m(10, 'slide 9') },
    { label: 'Full-length leaves, no pre-stress', tex: 's_e=\\dfrac{18FL}{bt^2(3n_e+2n_g)}', sub: `=\\dfrac{18(${p.lF})(${p.L})}{${D}}`, result: `=${MPa(r.se)}\\ \\text{MN/m}^2`, cite: A503.m(10, 'slide 7') },
    { label: 'Graduated leaves', tex: 's_g=\\dfrac{12FL}{bt^2(3n_e+2n_g)}=\\tfrac23 s_e', sub: `=\\tfrac23(${MPa(r.se)})`, result: `=${MPa(r.sg)}\\ \\text{MN/m}^2`, cite: A503.m(10, 'slide 8') },
    { label: 'Pre-stressed: equal stress in every leaf', tex: 's=\\dfrac{6FL}{nbt^2}', sub: `=\\dfrac{6(${p.lF})(${p.L})}{${r.n}(${n(p.b, 3)})(${n(p.t, 3)})^2}`, result: `=${MPa(r.s)}\\ \\text{MN/m}^2`, cite: A503.m(10, 'slide 10') },
    { label: 'Nip (gap) to pre-form in the full leaves', tex: 'h=\\dfrac{2FL^3}{nbt^3E}', sub: `=\\dfrac{2(${p.lF})(${p.L})^3}{${r.n}(${n(p.b, 3)})(${n(p.t, 3)})^3(${n(p.E, 3)})}`, result: `=${n(r.h * 1000, 4)}\\ \\text{mm}`, cite: A503.m(10, 'slide 11') },
  ]
  return <Working steps={steps} />
}

function WeldWorking() {
  const p = useSW()
  const r = weldResult(p)
  const steps: WorkingStep[] = []
  if (r.kind === 'bar') {
    steps.push({ label: 'Bending moment at the weld', tex: 'M=Ve', sub: `=${n(p.V, 4)}(${n(p.arm, 3)})`, result: `=${n(r.M, 4)}\\ \\text{N·m}`, cite: A503.mg15('Q6c') })
    steps.push({ label: 'Weld as a line: section modulus', tex: 'Z_w=\\dfrac{\\pi d^2}{4}', sub: `=\\dfrac{\\pi(${n(p.barD, 3)})^2}{4}`, result: `=${n(r.Zw, 4)}\\ \\text{m}^2`, cite: A503.m(11, 'slides 23–28') })
    steps.push({ label: 'Bending and shear per unit length', tex: 'f_b=\\dfrac{M}{Z_w},\\quad f_s=\\dfrac{V}{\\pi d}', sub: `f_b=\\dfrac{${n(r.M, 4)}}{${n(r.Zw, 4)}},\\ f_s=\\dfrac{${n(p.V, 4)}}{\\pi(${n(p.barD, 3)})}`, result: `f_b=${n(r.fb, 4)},\\ f_s=${n(r.fs, 4)}\\ \\text{N/m}`, cite: A503.mg17('Q5c') })
    steps.push({ label: 'Resultant and leg size', tex: 'f=\\sqrt{f_b^2+f_s^2},\\quad w=\\dfrac{f}{0.707\\,s}', sub: `f=${n(r.f, 4)}\\ \\text{N/m},\\ w=\\dfrac{${n(r.f, 4)}}{0.707(${n(p.s, 3)})}`, result: `w=${n(r.w * 1000, 3)}\\ \\text{mm}`, cite: A503.mg21('Q5c') })
  } else {
    steps.push({ label: 'Centre of gravity of the weld group', tex: 'N_y=\\dfrac{b^2}{2b+d}', sub: `=\\dfrac{${n(p.wb * 1000, 3)}^2}{2(${n(p.wb * 1000, 3)})+${n(p.wd * 1000, 3)}}`, result: `=${n(r.Ny * 1000, 4)}\\ \\text{mm}`, cite: A503.m(11, 'Example 1') })
    steps.push({ label: 'Direct shear, uniform over the weld', tex: 'f=\\dfrac{V}{L_w}', sub: `=\\dfrac{${n(p.V, 4)}}{${n(r.Lw, 3)}}`, result: `=${n(r.fv0 / 1e3, 4)}\\ \\text{kN/m}`, cite: A503.m(11, 'Example 1') })
    steps.push({ label: 'Polar moment of the weld line', tex: 'J_w=\\dfrac{(2b+d)^3}{12}-\\dfrac{b^2(b+d)^2}{2b+d}', sub: `b=${n(p.wb, 3)},\\ d=${n(p.wd, 3)}`, result: `=${n(r.Jw, 4)}\\ \\text{m}^3`, cite: A503.m(11, 'Example 1') })
    steps.push({ label: 'Twisting couple at the flange tip', tex: 'T=Ve,\\quad f_h=\\dfrac{Tc_v}{J_w},\\ f_v=\\dfrac{Tc_h}{J_w}', sub: `T=${n(r.T, 4)}\\ \\text{N·m},\\ c_v=${n((p.wd / 2) * 1000, 3)},\\ c_h=${n((p.wb - r.Ny) * 1000, 3)}\\ \\text{mm}`, result: `f_h=${n(r.fh / 1e6, 4)},\\ f_v=${n(r.fvT / 1e6, 4)}\\ \\text{MN/m}`, cite: A503.m(11, 'Example 1') })
    steps.push({ label: 'Resultant and leg size (parallel allowable)', tex: 'f=\\sqrt{f_h^2+(f+f_v)^2},\\quad w=\\dfrac{f}{0.707\\,s}', sub: `=\\sqrt{${n(r.fh / 1e6, 3)}^2+(${n(r.fv0 / 1e6, 3)}+${n(r.fvT / 1e6, 3)})^2}`, result: `f=${n(r.f / 1e6, 4)}\\ \\text{MN/m}\\Rightarrow w=${n(r.w * 1000, 3)}\\ \\text{mm}`, cite: A503.m(11, 'Example 1') })
  }
  steps.push({ label: 'Fillet strength per metre of weld (leg w)', tex: 'F_\\parallel=0.707\\,swL,\\quad F_\\perp=\\dfrac{s\\,wL}{(\\cos67.5^\\circ+\\sin67.5^\\circ)\\sin67.5^\\circ}=0.828\\,swL', sub: `w=${n(p.leg * 1000, 3)}\\ \\text{mm},\\ s=${n(p.s / 1e6, 3)}\\ \\text{MN/m}^2`, result: `F_\\parallel=${n(filletParallel(p.s, p.leg, 1) / 1e3, 4)},\\ F_\\perp=${n(filletTransverse(p.s, p.leg, 1) / 1e3, 4)}\\ \\text{kN/m}`, cite: A503.m(11, 'slides 18–21') })
  return <Working steps={steps} />
}

function WahlChart() {
  const p = useSW()
  const r = helicalResult(p)
  const data = useMemo(() => {
    const xs: number[] = []
    const w: number[] = []
    const s: number[] = []
    for (let C = 3; C <= 14; C += 0.1) {
      xs.push(C)
      w.push(wahlFactor(C))
      s.push(shearStressFactor(C))
    }
    return [xs, w, s]
  }, [])
  return (
    <>
      <Chart
        data={data}
        series={[
          { label: 'Wahl K', color: '#e8794f', width: 2 },
          { label: 'K_s', color: '#6fb3e0', width: 2, dash: [5, 4] },
        ]}
        xLabel="Spring index C = D/d"
        yLabel="Stress factor"
        marker={() => [r.C, r.K]}
        height={150}
      />
      <Note>Orange: Wahl K, which adds the curvature of the coil to the direct shear; blue dashed: K_s (direct shear only). The gap grows as the coil gets tighter (small C).</Note>
    </>
  )
}

/** Bonus: rope winch / capstan (Module 6; Q17, E18, E21). */
function Winch() {
  const [w, setW] = useState({ pull: 330, f: 0.1, turns: 4, drum: 0.25, rope: 0.025, v: 0.36 })
  const D = w.drum + w.rope
  const r = ropeWinch(w.pull, w.f, w.turns, D, w.v)
  const steps: WorkingStep[] = [
    { label: 'Effective drum diameter', tex: 'D_e=D+d', sub: `=${n(w.drum * 1000, 3)}+${n(w.rope * 1000, 3)}`, result: `=${n(D * 1000, 3)}\\ \\text{mm}`, cite: A503.mg17('Q5a') },
    { label: 'Angle of wrap and capstan ratio', tex: '\\alpha=2\\pi\\times\\text{turns},\\quad T_1/T_2=e^{f\\alpha}', sub: `\\alpha=${n(r.alpha, 4)}\\ \\text{rad},\\ e^{${w.f}(${n(r.alpha, 4)})}`, result: `=${n(r.k, 4)}`, cite: A503.m(6, 'winch') },
    { label: 'Load-side tension and power', tex: 'T_1=T_2e^{f\\alpha},\\quad P=(T_1-T_2)v', sub: `T_1=${w.pull}(${n(r.k, 4)})`, result: `T_1=${n(r.T1, 4)}\\ \\text{N},\\ P=${n(r.P / 1000, 4)}\\ \\text{kW},\\ N=${n(r.rpm, 3)}\\ \\text{rpm}`, cite: A503.mg17('Q5a') },
  ]
  return (
    <Section title="Rope winch (capstan)">
      <Slider label="Hand pull on the slack end T₂" value={w.pull} min={50} max={800} step={5} unit="N" onChange={(pull) => setW({ ...w, pull })} />
      <Slider label="Turns on the drum" value={w.turns} min={1} max={6} step={0.25} onChange={(turns) => setW({ ...w, turns })} />
      <Slider label="Friction f" value={w.f} min={0.05} max={0.4} step={0.01} onChange={(f) => setW({ ...w, f })} />
      <Slider label="Rope speed v" value={w.v} min={0.1} max={1} step={0.01} unit="m/s" onChange={(v) => setW({ ...w, v })} />
      <Working steps={steps} />
      <Note>Ø250 drum + Ø25 rope, 4 turns, f = 0.1 → e^(fα) = 12.35, T₁ ≈ 4.08 kN, P ≈ 1.35 kW (ignoring the tiny mv² term of the 0.3 kg/m rope). Fibre-rope pulleys ≈ 40d, never under 36d.</Note>
    </Section>
  )
}

export function SpringsWeldsPanel() {
  const p = useSW()
  const [preset, setPreset] = useState<string | null>('mg21-wahl')
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      {p.mode === 'helical' ? (
        <Section title="Stress factor">
          <WahlChart />
        </Section>
      ) : null}
      <Section title="Working">
        {p.mode === 'helical' ? <HelicalWorking /> : p.mode === 'leaf' ? <LeafWorking /> : <WeldWorking />}
      </Section>
      <Winch />
    </div>
  )
}
