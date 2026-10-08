import { useMemo, useState } from 'react'
import { bandRatio, differentialBandForce, differentialSelfLocking, discOuterRadius, dissipationCoefficient, heatDissipated, shoeLeverForce } from '@/physics/elements'
import { Chart } from '@/ui/Chart'
import { flyTo } from '@/ui/camera'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { A503 } from '../_shared/cites'
import { ModeTabs, Note, PresetGrid, erratum, type Preset } from '../_shared/PanelBits'
import { DEFAULTS, bandResult, coneResult, deg, discResult, rad, shoeResult, useCB, type CBParams, type Mode } from './model'

const set = (p: Partial<CBParams>) => useCB.getState().set(p)

export const MODE_CAMERA: Record<Mode, { position: [number, number, number]; target: [number, number, number] }> = {
  disc: { position: [0.1, -0.29, 0.24], target: [0.012, -0.37, 0] },
  cone: { position: [0.13, -0.27, 0.3], target: [0.02, -0.37, 0] },
  shoe: { position: [0.35, 0.25, 1.55], target: [0.07, 0.0, 0] },
  band: { position: [0.15, 0.08, 1.0], target: [0.04, -0.08, 0] },
}

export function setMode(mode: Mode) {
  set({ mode, rpm: mode === 'shoe' ? 500 : mode === 'band' ? 900 : 300 })
  flyTo(MODE_CAMERA[mode])
}

const go = (mode: Mode, p: Partial<CBParams>) => {
  set({ ...DEFAULTS, mode, ...p })
  flyTo(MODE_CAMERA[mode])
}

export const PRESETS: Preset[] = [
  {
    id: 'mg16',
    label: 'Disc · 9 discs, 16 N·m',
    note: 'Exam 2016/17 Q5d: 5 steel + 4 bronze → n = 8; 16 N·m; Dᵢ = 50 mm; f = 0.1; p = 350 kPa → torque per pair 2 N·m → Dₒ ≈ 70 mm, F ≈ 667 N.',
    flag: 'The guide takes F = T/(f R_f n) with R_f = 30 mm (the mean radius) → 667 N; with the uniform-pressure R_f = 30.3 mm that it used to find Dₒ, F = pπ(Rₒ² − Rᵢ²) = 660 N.',
    apply: () => go('disc', { nSteel: 5, nBronze: 4, Ri: 0.025, Ro: 0.035, fd: 0.1, p: 350e3, theory: 'pressure' }),
  },
  {
    id: 'wear',
    label: 'Disc · uniform wear, 4 kN',
    note: 'Worked example: F = 4000 N on Rᵢ = 50, Rₒ = 100 mm → p_max = F/2πRᵢ(Rₒ − Rᵢ) = 254.6 kPa at Rᵢ, p_min = 127.3 kPa at Rₒ, average 169.8 kPa.',
    apply: () => go('disc', { nSteel: 2, nBronze: 1, Ri: 0.05, Ro: 0.1, fd: 0.3, p: 4000 / (Math.PI * (0.1 ** 2 - 0.05 ** 2)), theory: 'wear' }),
  },
  {
    id: 'cone',
    label: 'Cone clutch',
    note: 'T = Ff R_f / sin α. The values here are illustrative.',
    errata: 'cone-clutch',
    apply: () => go('cone', { F: 1500, fc: 0.3, alpha: rad(12.5), cRo: 0.06, cRi: 0.05, theory: 'wear' }),
  },
  {
    id: 'shoe',
    label: 'Shoe brake · 225 N·m',
    note: 'Exams 2015/16 Q5c, 2017/18 and 2019/20 Q6b: R = 360 mm, 225 N·m at 500 rpm, f = 0.3 → N = 2083 N, fN = 625 N, F = 805 N (cw) / 861 N (ccw), self-locking for c ≥ 1.2 m, H_g = 11.8 kW.',
    apply: () => go('shoe', { T: 225, fs: 0.3, R: 0.36, a: 0.36, b: 0.9, c: 0.04, dir: 'cw', rpm: 500 }),
  },
  {
    id: 'band',
    label: 'Band brake · 280°',
    note: 'Worked example: 280° wrap, Ø450 drum, 170 N·m at 900 rpm, f = 0.2 → e^(fα) = 2.665, F₁ = 1210 N, F₂ = 455 N. (Lever arms a, b are not given; 80 and 500 mm are assumed for the drawing.)',
    apply: () => go('band', { Tb: 170, fb: 0.2, wrap: rad(280), rb: 0.225, rpm: 900 }),
  },
]

function LivePanel() {
  const p = useCB()
  if (p.mode === 'disc' || p.mode === 'cone') {
    const r = p.mode === 'disc' ? discResult(p) : coneResult(p)
    return (
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Torque capacity" value={fmt(r.T, 4)} unit="N·m" tone="accent" />
          <Readout label="Power at speed" value={fmt(r.P / 1000, 3)} unit="kW" />
          <Readout label="State" value={p.engage >= 0.98 ? 'Engaged' : p.engage <= 0.02 ? 'Released' : 'Slipping'} tone={p.engage >= 0.98 ? 'accent' : 'warn'} />
        </div>
      </Section>
    )
  }
  if (p.mode === 'shoe') {
    const r = shoeResult(p)
    return (
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Normal N" value={fmt(r.N, 4)} unit="N" tone="info" />
          <Readout label="Friction fN" value={fmt(r.fN, 4)} unit="N" />
          <Readout label="Lever force F" value={r.F > 0 ? fmt(r.F, 4) : 'locks'} unit={r.F > 0 ? 'N' : ''} tone="warn" />
          <Readout label="Heat H_g" value={fmt(r.Hg / 1000, 3)} unit="kW" tone="warn" />
          <Readout label="Rubbing speed" value={fmt(r.V, 3)} unit="m/s" />
          <Readout label="Self-locks at" value={`c ≥ ${fmt(r.selfLock, 3)}`} unit="m" />
        </div>
      </Section>
    )
  }
  const r = bandResult(p)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="F₁ (tight)" value={fmt(r.F1, 4)} unit="N" tone="warn" />
        <Readout label="F₂ (slack)" value={fmt(r.F2, 4)} unit="N" tone="info" />
        <Readout label="e^(fα)" value={fmt(r.k, 4)} />
        <Readout label="Lever force" value={fmt(r.F, 3)} unit="N" tone="accent" />
        <Readout label="Heat H_g" value={fmt(r.Hg / 1000, 3)} unit="kW" />
        <Readout label="Drum speed" value={fmt(p.rpm, 3)} unit="rpm" />
      </div>
    </Section>
  )
}

function Controls() {
  const p = useCB()
  return (
    <Section title="Device">
      <ModeTabs<Mode>
        value={p.mode}
        onChange={setMode}
        options={[
          { value: 'disc', label: 'Multi-disc clutch' },
          { value: 'cone', label: 'Cone clutch' },
          { value: 'shoe', label: 'Shoe brake' },
          { value: 'band', label: 'Band brake' },
        ]}
      />
      <div className="h-2" />
      {p.mode === 'disc' || p.mode === 'cone' ? (
        <>
          <Slider label="Engagement" value={p.engage} min={0} max={1} step={0.01} onChange={(engage) => set({ engage })} hint="Released → slipping → locked together" />
          <Segmented<'pressure' | 'wear'>
            label="Assumption"
            value={p.theory}
            onChange={(theory) => set({ theory })}
            options={[
              { value: 'pressure', label: 'Uniform pressure (new)' },
              { value: 'wear', label: 'Uniform wear (run in)' },
            ]}
          />
        </>
      ) : null}
      {p.mode === 'disc' ? (
        <>
          <Slider label="Steel plates" value={p.nSteel} min={1} max={8} step={1} onChange={(nSteel) => set({ nSteel })} />
          <Slider label="Bronze plates" value={p.nBronze} min={1} max={8} step={1} onChange={(nBronze) => set({ nBronze })} />
          <Slider label="Inner radius Rᵢ" value={p.Ri * 1000} min={15} max={60} step={0.5} unit="mm" onChange={(v) => set({ Ri: Math.min(v / 1000, p.Ro - 0.004) })} />
          <Slider label="Outer radius Rₒ" value={p.Ro * 1000} min={20} max={110} step={0.5} unit="mm" onChange={(v) => set({ Ro: Math.max(v / 1000, p.Ri + 0.004) })} />
          <Slider label="Coefficient of friction f" value={p.fd} min={0.05} max={0.5} step={0.01} onChange={(fd) => set({ fd })} />
          <Slider label="Average pressure p" value={p.p / 1000} min={50} max={1000} step={5} unit="kPa" onChange={(v) => set({ p: v * 1000 })} />
        </>
      ) : null}
      {p.mode === 'cone' ? (
        <>
          <Slider label="Axial force F" value={p.F} min={100} max={5000} step={50} unit="N" onChange={(F) => set({ F })} />
          <Slider label="Semi-cone angle α" value={deg(p.alpha)} min={8} max={30} step={0.5} unit="°" onChange={(v) => set({ alpha: rad(v) })} />
          <Slider label="Coefficient of friction f" value={p.fc} min={0.1} max={0.5} step={0.01} onChange={(fc) => set({ fc })} />
        </>
      ) : null}
      {p.mode === 'shoe' ? (
        <>
          <Segmented<'cw' | 'ccw'>
            label="Drum rotation"
            value={p.dir}
            onChange={(dir) => set({ dir })}
            options={[
              { value: 'cw', label: 'Clockwise (friction helps)' },
              { value: 'ccw', label: 'Counter-clockwise' },
            ]}
          />
          <Slider label="Braking torque T" value={p.T} min={20} max={600} step={5} unit="N·m" onChange={(T) => set({ T })} />
          <Slider label="Coefficient of friction f" value={p.fs} min={0.1} max={0.6} step={0.01} onChange={(fs) => set({ fs })} />
          <Slider label="Pivot offset c" value={p.c} min={0} max={1.5} step={0.01} unit="m" onChange={(c) => set({ c })} hint="Distance from the pivot to the line of the friction force" />
          <Slider label="Drum speed" value={p.rpm} min={0} max={1500} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        </>
      ) : null}
      {p.mode === 'band' ? (
        <>
          <Slider label="Braking torque T" value={p.Tb} min={20} max={500} step={5} unit="N·m" onChange={(Tb) => set({ Tb })} />
          <Slider label="Angle of wrap α" value={deg(p.wrap)} min={180} max={300} step={1} unit="°" onChange={(v) => set({ wrap: rad(v) })} />
          <Slider label="Coefficient of friction f" value={p.fb} min={0.1} max={0.5} step={0.01} onChange={(fb) => set({ fb })} />
          <Slider label="Drum speed" value={p.rpm} min={0} max={1500} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        </>
      ) : null}
    </Section>
  )
}

function Charts() {
  const p = useCB()
  const disc = useMemo(() => {
    const xs: number[] = []
    const wear: number[] = []
    const pres: number[] = []
    const F = discResult(p).F
    for (let i = 0; i <= 40; i++) {
      const r = p.Ri + ((p.Ro - p.Ri) * i) / 40
      xs.push(r * 1000)
      wear.push(F / (2 * Math.PI * r * (p.Ro - p.Ri)) / 1000)
      pres.push(F / (Math.PI * (p.Ro ** 2 - p.Ri ** 2)) / 1000)
    }
    return [xs, wear, pres]
  }, [p])
  const shoe = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    const N = shoeResult(p).N
    for (let i = 0; i <= 60; i++) {
      const c = (i / 60) * 1.5
      xs.push(c)
      ys.push(shoeLeverForce(N, p.fs, p.a, p.b, c, 'aiding'))
    }
    return [xs, ys]
  }, [p])
  const band = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let a = 90; a <= 360; a += 5) {
      xs.push(a)
      ys.push(bandRatio(p.fb, rad(a)))
    }
    return [xs, ys]
  }, [p.fb])
  if (p.mode === 'disc')
    return (
      <Section title="Pressure across the face">
        <Chart data={disc} series={[{ label: 'uniform wear', color: '#e8794f', width: 2 }, { label: 'uniform pressure', color: '#6fb3e0', width: 1.5, dash: [4, 3] }]} xLabel="Radius r (mm)" yLabel="Pressure (kPa)" height={150} />
        <Note>Uniform wear: p·r is constant, so the pressure is greatest at Rᵢ — a worn clutch carries a little less torque (R_f = (Rₒ + Rᵢ)/2) than a new one.</Note>
      </Section>
    )
  if (p.mode === 'shoe')
    return (
      <Section title="Self-locking">
        <Chart data={shoe} series={[{ label: 'F', color: '#e8794f', width: 2 }]} xLabel="Pivot offset c (m)" yLabel="Lever force F, clockwise (N)" marker={() => [p.c, shoeResult({ ...p, dir: 'cw' }).F]} height={150} />
        <Note>As c grows the friction moment fN·c helps more and F falls; at c = a/f it reaches zero — the brake applies itself (self-locking).</Note>
      </Section>
    )
  if (p.mode === 'band')
    return (
      <Section title="Tension ratio vs wrap">
        <Chart data={band} series={[{ label: 'F₁/F₂', color: '#9bd17a', width: 2 }]} xLabel="Angle of wrap (°)" yLabel="F₁/F₂ = e^(fα)" marker={() => [deg(p.wrap), bandRatio(p.fb, p.wrap)]} height={140} />
      </Section>
    )
  return null
}

function DifferentialBand() {
  const p = useCB()
  const [arm, setArm] = useState({ a: 0.03, b: 0.12, c: 0.4 })
  const r = bandResult(p)
  const F = differentialBandForce(r.F1, r.F2, arm.a, arm.b, arm.c)
  const locks = differentialSelfLocking(arm.a, arm.b, p.fb, p.wrap)
  const steps: WorkingStep[] = [
    { label: 'Moments about the pivot', tex: 'Fc+F_1a-F_2b=0\\;\\Rightarrow\\;F=\\dfrac{F_2b-F_1a}{c}', sub: `=\\dfrac{${n(r.F2, 4)}(${arm.b})-${n(r.F1, 4)}(${arm.a})}{${arm.c}}`, result: `=${n(F, 4)}\\ \\text{N}`, cite: A503.m(9, 'slide 22') },
    { label: 'Self-locking condition', tex: 'b\\le a\\,e^{f\\alpha}', sub: `${arm.b}\\ \\text{vs}\\ ${arm.a}\\times${n(r.k, 4)}=${n(arm.a * r.k, 4)}`, result: locks ? '\\text{self-locking}' : '\\text{not self-locking}', cite: A503.m(9, 'slide 24') },
  ]
  return (
    <Section title="Differential band brake">
      <Slider label="Arm a (tight side)" value={arm.a * 1000} min={5} max={100} step={1} unit="mm" onChange={(v) => setArm({ ...arm, a: v / 1000 })} />
      <Slider label="Arm b (slack side)" value={arm.b * 1000} min={10} max={300} step={1} unit="mm" onChange={(v) => setArm({ ...arm, b: v / 1000 })} />
      <Slider label="Effort arm c" value={arm.c * 1000} min={100} max={800} step={10} unit="mm" onChange={(v) => setArm({ ...arm, c: v / 1000 })} />
      <Working steps={steps} />
      <Note>The tight side’s moment helps to apply the brake (self-energising). Same F₁, F₂ as the simple brake above; arms are free inputs.</Note>
    </Section>
  )
}

function CBWorking() {
  const p = useCB()
  const steps: WorkingStep[] = []
  if (p.mode === 'disc') {
    const r = discResult(p)
    steps.push({ label: 'Pairs of friction surfaces', tex: 'n=n_{steel}+n_{bronze}-1', sub: `=${p.nSteel}+${p.nBronze}-1`, result: `=${r.n}`, cite: A503.m(8, 'slide 4') })
    steps.push({ label: 'Axial force', tex: 'F=p\\pi(R_o^2-R_i^2)', sub: `=${n(p.p, 4)}\\pi(${n(p.Ro, 3)}^2-${n(p.Ri, 3)}^2)`, result: `=${n(r.F, 4)}\\ \\text{N}`, cite: A503.m(8, 'slide 5') })
    steps.push(
      p.theory === 'pressure'
        ? { label: 'Friction radius (uniform pressure)', tex: 'R_f=\\tfrac23\\dfrac{R_o^3-R_i^3}{R_o^2-R_i^2}', sub: `=\\tfrac23\\dfrac{${n(p.Ro, 3)}^3-${n(p.Ri, 3)}^3}{${n(p.Ro, 3)}^2-${n(p.Ri, 3)}^2}`, result: `=${n(r.Rf * 1000, 4)}\\ \\text{mm}`, cite: A503.m(8, 'slide 4') }
        : { label: 'Friction radius (uniform wear)', tex: 'R_f=\\dfrac{R_o+R_i}{2}', sub: `=\\dfrac{${n(p.Ro * 1000, 3)}+${n(p.Ri * 1000, 3)}}{2}`, result: `=${n(r.Rf * 1000, 4)}\\ \\text{mm}`, cite: A503.m(8, 'slide 4; derivation MG16 Q5c') },
    )
    steps.push({ label: 'Torque capacity', tex: 'T=F f R_f n', sub: `=${n(r.F, 4)}(${p.fd})(${n(r.Rf, 4)})(${r.n})`, result: `=${n(r.T, 4)}\\ \\text{N·m}`, cite: A503.m(8, 'slide 4') })
    steps.push({ label: 'Power capacity', tex: 'P=T\\,N\\dfrac{2\\pi}{60}', sub: `=${n(r.T, 4)}(${p.rpm})\\dfrac{2\\pi}{60}`, result: `=${n(r.P, 4)}\\ \\text{W}`, cite: A503.m(8, 'slide 5') })
    steps.push({ label: 'Uniform-wear pressure range', tex: 'p=\\dfrac{F}{2\\pi(R_o-R_i)r}', sub: `r=R_i\\ \\text{and}\\ R_o`, result: `p_{max}=${n(r.pMax / 1000, 4)},\\ p_{min}=${n(r.pMin / 1000, 4)}\\ \\text{kPa}`, cite: A503.m(8, 'slide 9') })
    if (Math.abs(p.Ri - 0.025) < 1e-9 && p.nSteel === 5 && p.nBronze === 4) {
      const Ro = discOuterRadius(16, p.p, p.Ri, p.fd, r.n, 'pressure')
      steps.push({ label: 'Outer diameter for 16 N·m', tex: '\\tfrac{16}{8}=2=\\tfrac23\\pi p f(R_o^3-R_i^3)', sub: `p=${n(p.p, 3)},\\ f=${p.fd},\\ R_i=25\\ \\text{mm}`, result: `D_o=${n(Ro * 2000, 4)}\\ \\text{mm}\\approx70\\ \\text{mm}`, cite: A503.mg16('Q5d'), errata: 'The guide then gives F = 666.67 N using R_f = 30 mm; with the uniform-pressure R_f the force is ≈ 660 N.' })
    }
  } else if (p.mode === 'cone') {
    const r = coneResult(p)
    steps.push({ label: 'Friction radius', tex: p.theory === 'pressure' ? 'R_f=\\tfrac23\\dfrac{R_o^3-R_i^3}{R_o^2-R_i^2}' : 'R_m=\\tfrac12(R_o+R_i)', sub: `R_o=${n(p.cRo * 1000, 3)},\\ R_i=${n(p.cRi * 1000, 3)}\\ \\text{mm}`, result: `=${n(r.Rf * 1000, 4)}\\ \\text{mm}`, cite: A503.m(8, 'slides 6–9'), errata: p.theory === 'wear' ? erratum('cone-clutch') : undefined })
    steps.push({ label: 'Normal force on the face', tex: 'F_n=\\dfrac{F}{\\sin\\alpha}', sub: `=\\dfrac{${n(p.F, 4)}}{\\sin ${n(deg(p.alpha), 3)}^\\circ}`, result: `=${n(r.Fn, 4)}\\ \\text{N}`, cite: A503.m(8, 'slide 8') })
    steps.push({ label: 'Torque capacity', tex: 'T=\\dfrac{F f R_f}{\\sin\\alpha}', sub: `=\\dfrac{${n(p.F, 4)}(${p.fc})(${n(r.Rf, 4)})}{\\sin ${n(deg(p.alpha), 3)}^\\circ}`, result: `=${n(r.T, 4)}\\ \\text{N·m}`, cite: A503.m(8, p.theory === 'pressure' ? 'slide 6' : 'slide 9') })
    steps.push({ label: 'Face width', tex: 'b=\\dfrac{R_o-R_i}{\\sin\\alpha}', sub: '', result: `=${n(r.b * 1000, 4)}\\ \\text{mm}`, cite: A503.m(8, 'slide 8') })
  } else if (p.mode === 'shoe') {
    const r = shoeResult(p)
    steps.push({ label: 'Normal force', tex: 'T=fNR\\;\\Rightarrow\\;N=\\dfrac{T}{fR}', sub: `=\\dfrac{${p.T}}{${p.fs}(${p.R})}`, result: `=${n(r.N, 4)}\\ \\text{N},\\ fN=${n(r.fN, 4)}\\ \\text{N}`, cite: A503.m(9, 'Example 1a') })
    steps.push({
      label: p.dir === 'cw' ? 'Lever force, clockwise drum' : 'Lever force, counter-clockwise drum',
      tex: p.dir === 'cw' ? 'Fb=Na-fNc' : 'Fb=Na+fNc',
      sub: `F=\\dfrac{${n(r.N, 4)}(${p.a})${p.dir === 'cw' ? '-' : '+'}${n(r.fN, 4)}(${n(p.c, 3)})}{${p.b}}`,
      result: `=${n(r.F, 4)}\\ \\text{N}${r.F <= 0 ? '\\ (self-locking)' : ''}`,
      cite: A503.m(9, 'Example 1b–c'),
    })
    steps.push({ label: 'Self-locking (clockwise only)', tex: 'a\\le fc\\;\\Rightarrow\\;c\\ge a/f', sub: `=${p.a}/${p.fs}`, result: `c\\ge${n(r.selfLock, 4)}\\ \\text{m}`, cite: A503.m(9, 'Example 1d') })
    steps.push({ label: 'Heat generated', tex: 'H_g=fNV', sub: `=${n(r.fN, 4)}\\times\\dfrac{2\\pi(${p.rpm})}{60}(${p.R})`, result: `=${n(r.Hg / 1000, 4)}\\ \\text{kW}`, cite: A503.m(9, 'Example 1e') })
    const C = dissipationCoefficient(100)
    const Ar = (2 * Math.PI * p.R * 0.1 + 2 * Math.PI * p.R * p.R) * 1
    steps.push({ label: 'Heat a drum can dissipate (Δt = 100 °C)', tex: 'H_d=C\\,\\Delta t\\,A_r', sub: `=${n(C, 3)}(100)(${n(Ar, 3)})`, result: `=${n(heatDissipated(C, 100, Ar) / 1000, 3)}\\ \\text{kW}\\ \\text{(drum faces + rim; illustrative)}`, cite: A503.m(9, 'slide 26'), beyond: true })
  } else {
    const r = bandResult(p)
    steps.push({ label: 'Tension ratio', tex: '\\dfrac{F_1}{F_2}=e^{f\\alpha}', sub: `=e^{${p.fb}(${n(deg(p.wrap), 3)}\\pi/180)}`, result: `=${n(r.k, 4)}`, cite: A503.m(9, 'slide 20') })
    steps.push({ label: 'Torque', tex: 'T=(F_1-F_2)r', sub: `${p.Tb}=(F_1-F_2)(${p.rb})`, result: `F_1=${n(r.F1, 4)}\\ \\text{N},\\ F_2=${n(r.F2, 4)}\\ \\text{N}`, cite: A503.m(9, 'Example 2') })
    steps.push({ label: 'Simple band lever', tex: 'F=\\dfrac{F_2a}{b}', sub: `=\\dfrac{${n(r.F2, 4)}(${p.la})}{${p.lb}}`, result: `=${n(r.F, 4)}\\ \\text{N}`, cite: A503.m(9, 'Fig 15-7') })
  }
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function ClutchBrakePanel() {
  const [preset, setPreset] = useState<string | null>('mg16')
  const mode = useCB((s) => s.mode)
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <CBWorking />
      {mode === 'band' ? <DifferentialBand /> : null}
      <Section title="Clutch vs brake">
        <Note tone="mute">A clutch connects two moving parts (shafts); a brake connects a moving part to the frame and turns its energy into heat. Both depend on the coefficient of friction, the force applied and the friction radius (clutch) or drum radius (brake).</Note>
      </Section>
    </div>
  )
}
