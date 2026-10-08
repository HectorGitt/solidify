import { useMemo, useState } from 'react'
import { beltCapacity, maxPowerSpeed, tensionFactor } from '@/physics/elements'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { A503 } from '../_shared/cites'
import { ModeTabs, Note, NumberField, PresetGrid, Table, erratum, type Preset } from '../_shared/PanelBits'
import { ARC_TABLE, DEFAULTS, analyse, catalogue, deg, live, rad, useBelts, type BeltParams, type Layout } from './model'

const set = (p: Partial<BeltParams>) => useBelts.getState().set(p)
const base = (p: Partial<BeltParams>) => set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  {
    id: 'crossed',
    label: 'Crossed belt · 7.5 kW',
    note: 'Exams 2015/16 Q2c and 2019/20 (exam and test): leather, d = 250, D = 500 mm, C = 1.25 m, 1000 rpm, f = 0.3, s₁ = 1.7 MPa, t = 6 mm. Expect α = 214.9°, e^(fα) = 3.08, v = 13.1 m/s, ΔT = 572.5 N, b ≈ 92 mm.',
    apply: () => base({ layout: 'crossed', kind: 'flat', d: 0.25, D: 0.5, C: 1.25, rpm: 1000, f1: 0.3, f2: 0.3, s1: 1.7e6, t: 0.006, rho: 970, task: 'width', P: 7500 }),
  },
  {
    id: 'compressor',
    label: 'Compressor · 43.6 kW',
    note: 'Exam 2016/17 Q2b: 10 × 250 mm leather, 300/1500 mm pulleys, 900 rpm, wraps 220°/270° (with an idler), f 0.3/0.25, s = 2 MPa → T₁ = 5 kN. The small pulley governs (3.16 < 3.25). Expect T₂ = 1914 N, P = 43.6 kW.',
    apply: () => base({ layout: 'idler', kind: 'flat', d: 0.3, D: 1.5, C: 2.2, rpm: 900, f1: 0.3, f2: 0.25, b: 0.25, t: 0.01, rho: 970, s1: 2e6, limit: 'stress', task: 'power', wraps: [rad(220), rad(270)], idlerAt: 0.25, idlerPush: 0.35, P: 43600 }),
  },
  {
    id: 'm4',
    label: 'Worked example · 2.7 kN',
    note: 'Worked example: 6 × 200 mm leather, 250/1500 mm, wraps 4/3.5 rad, f 0.3/0.25, 900 rpm, T₁ = 2.7 kN. Here the LARGE pulley governs (e^(0.25·3.5) = 2.40 < 3.32). Computed P ≈ 17.4 kW (no answer given).',
    apply: () => base({ layout: 'idler', kind: 'flat', d: 0.25, D: 1.5, C: 2.2, rpm: 900, f1: 0.3, f2: 0.25, b: 0.2, t: 0.006, rho: 970, limit: 'force', T1max: 2700, task: 'power', wraps: [4, 3.5], idlerAt: 0.3, idlerPush: 0.22, P: 22000 }),
  },
  {
    id: 'fan',
    label: 'Fan · double-ply belt',
    note: 'Exams 2017/18 and 2021/22: 350/1370 mm pulleys at C = 1370 mm, 8 × 250 mm double-ply leather, s = 2.4 MPa, f = 0.35, 880 rpm. Computed α₁ = 136.3°, P ≈ 39 kW (no printed answer).',
    apply: () => base({ layout: 'open', kind: 'flat', d: 0.35, D: 1.37, C: 1.37, rpm: 880, f1: 0.35, f2: 0.35, b: 0.25, t: 0.008, rho: 970, s1: 2.4e6, limit: 'stress', task: 'power', P: 39000 }),
  },
  {
    id: 'vbelts',
    label: 'Multiple V-belts · 26 kW',
    note: 'Exam 2019/20 Q3a: 250/800 mm sheaves, 36° grooves, 140° wrap on the small sheave (C ≈ 804 mm), T₁ = 900 N, m = 0.523 kg/m, 1150 rpm, f = 0.2. e^(fα/sin 18°) = 4.86, v = 15.05 m/s. With mv² kept: T₂ = 279 N, 9.34 kW per belt → 2.78 → 3 belts.',
    errata: 'v-belts',
    apply: () => base({ layout: 'open', kind: 'v', section: 'B', d: 0.25, D: 0.8, C: 0.80405, rpm: 1150, f1: 0.2, f2: 0.2, groove: rad(36), mV: 0.523, T1max: 900, limit: 'force', task: 'power', P: 26000, nBelts: 3 }),
  },
  {
    id: 'fanA',
    label: 'Catalogue · fan, A section',
    note: 'Worked example (exams 2015/16, 2016/17): 7.5 kW, 1500 rpm fan, 18 h/day → SF 1.2, 9 kW; ratio 3, C = 1000 → d = 250, D = 750, L = 3632.5 mm; (D − d)/C = 0.5 → arc factor 0.93. A: (2.70 + 0.18) × 1.17 × 0.93 = 3.13 kW → 3 belts.',
    apply: () => base({ layout: 'open', kind: 'v', section: 'A', d: 0.25, D: 0.75, C: 1.0, rpm: 1500, f1: 0.2, f2: 0.2, groove: rad(36), mV: 0.11, T1max: 400, limit: 'force', task: 'power', P: 9000, nBelts: 3, catRated: 7.5, catSF: 1.2, catBasic: 2.7, catInc: 0.18, catFL: 1.17, catFarc: NaN, outRpm: 500 }),
  },
  {
    id: 'fanB',
    label: 'Catalogue · fan, B section',
    note: 'Same fan with B belts: (6.06 + 0.48) × 1.08 × 0.93 = 6.57 kW → 9/6.57 → 2 belts.',
    flag: 'The worked example prints "basic power = 6.6 kW" but works with 6.06, and divides 9.60 (not 9) by 6.57 — the answer, 2 belts, is unchanged.',
    apply: () => base({ layout: 'open', kind: 'v', section: 'B', d: 0.25, D: 0.75, C: 1.0, rpm: 1500, f1: 0.2, f2: 0.2, groove: rad(36), mV: 0.19, T1max: 700, limit: 'force', task: 'power', P: 9000, nBelts: 2, catRated: 7.5, catSF: 1.2, catBasic: 6.06, catInc: 0.48, catFL: 1.08, catFarc: NaN, outRpm: 500 }),
  },
  {
    id: 'digester',
    label: 'Catalogue · palm-fruit digester',
    note: 'Exams 2017/18 and 2021/22 (exam and test): 3 kW motor at 1500 rpm → 300 rpm worm shaft → 12 : 1 worm gearbox → 25 rpm digester, 8 h/day → SF 1.1, 3.3 kW. d = 85, D = 425 mm, C = 2√((D + d)d) = 416.4 mm, L = 1702.9 mm; A belt (1.21 + 0.18) × 0.99 × 0.80 = 1.10 kW → 3 belts.',
    flag: 'The marking guide reads an arc factor of 0.80 for (D − d)/C = 0.816; the arc-factor table gives 0.87, i.e. 1.20 kW per belt → 2.76 — still 3 belts.',
    apply: () => base({ layout: 'open', kind: 'v', section: 'A', d: 0.085, D: 0.425, C: 0.4164, rpm: 1500, f1: 0.2, f2: 0.2, groove: rad(36), mV: 0.11, T1max: 250, limit: 'force', task: 'power', P: 3300, nBelts: 3, catRated: 3, catSF: 1.1, catBasic: 1.21, catInc: 0.18, catFL: 0.99, catFarc: 0.8, outRpm: 25 }),
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 10, (x, y) => x.rpm2 === y.rpm2 && x.v === y.v)
  const p = useBelts()
  const a = useMemo(() => analyse(p), [p])
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Driver" value={fmt(v.rpm1, 4)} unit="rpm" />
        <Readout label="Driven" value={fmt(v.rpm2, 4)} unit="rpm" tone="info" />
        <Readout label="Belt speed" value={fmt(a.v, 3)} unit="m/s" />
        <Readout label="α small / large" value={`${deg(a.alpha[0]).toFixed(1)}° / ${deg(a.alpha[1]).toFixed(1)}°`} />
        <Readout label="T₁ / T₂" value={`${fmt(a.T1, 4)} / ${fmt(a.T2, 4)}`} unit="N" tone="accent" />
        <Readout label={p.kind === 'v' ? `Power, ${p.nBelts} belts` : 'Power'} value={fmt(a.Ptotal / 1000, 3)} unit="kW" tone="warn" />
      </div>
      <Note>
        Slip + creep shown: {(v.slip * 100).toFixed(1)} % (exaggerated). The marks open up on the tight side and close up on the slack side; the belt creeps back over the
        <b> active arc</b> at the exit of each pulley — {deg(a.active[0]).toFixed(0)}° of {deg(a.alpha[0]).toFixed(0)}° on the small pulley,
        {' '}{deg(a.active[1]).toFixed(0)}° of {deg(a.alpha[1]).toFixed(0)}° on the large.
      </Note>
    </Section>
  )
}

function Controls() {
  const p = useBelts()
  const isV = p.kind === 'v'
  return (
    <Section title="Drive">
      <ModeTabs<Layout | 'v'>
        value={isV ? 'v' : p.layout}
        onChange={(m) => (m === 'v' ? set({ kind: 'v', layout: 'open', wraps: null }) : set({ kind: 'flat', layout: m, wraps: null }))}
        options={[
          { value: 'open', label: 'Open flat' },
          { value: 'crossed', label: 'Crossed flat' },
          { value: 'idler', label: 'With idler' },
          { value: 'v', label: 'V-belts' },
        ]}
      />
      <div className="h-2" />
      <Slider label="Small (driver) pulley d" value={p.d * 1000} min={60} max={500} step={5} unit="mm" onChange={(x) => set({ d: x / 1000, wraps: null })} />
      <Slider label="Large (driven) pulley D" value={p.D * 1000} min={Math.max(80, p.d * 1000)} max={1600} step={5} unit="mm" onChange={(x) => set({ D: x / 1000, wraps: null })} />
      <Slider label="Centre distance C" value={p.C * 1000} min={Math.ceil(((p.d + p.D) / 2) * 1000 + 60)} max={3000} step={5} unit="mm" onChange={(x) => set({ C: x / 1000, wraps: null })} />
      <Slider label="Driver speed N₁" value={p.rpm} min={100} max={3000} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
      {p.layout === 'idler' && !isV ? (
        <>
          <Slider label="Idler along slack span" value={p.idlerAt} min={0.1} max={0.9} step={0.01} onChange={(idlerAt) => set({ idlerAt, wraps: null })} />
          <Slider label="Idler push-in" value={p.idlerPush * 1000} min={0} max={Math.round(p.D * 400)} step={2} unit="mm" onChange={(x) => set({ idlerPush: x / 1000, wraps: null })} />
        </>
      ) : null}
      <Slider label="Friction f (small / large)" value={p.f1} min={0.1} max={0.6} step={0.01} onChange={(f) => set({ f1: f, f2: f })} />
      {isV ? (
        <>
          <Segmented value={p.section} onChange={(section) => set({ section })} options={(['Z', 'A', 'B'] as const).map((s) => ({ value: s, label: `${s} section` }))} />
          <Slider label="Groove angle θ" value={deg(p.groove)} min={30} max={44} step={1} unit="°" onChange={(x) => set({ groove: rad(x) })} />
          <Slider label="Number of belts" value={p.nBelts} min={1} max={6} step={1} onChange={(nBelts) => set({ nBelts })} />
          <Slider label="Mass per metre m" value={p.mV} min={0.05} max={0.8} step={0.001} unit="kg/m" onChange={(mV) => set({ mV })} />
          <Slider label="Max tension T₁ per belt" value={p.T1max} min={100} max={2000} step={10} unit="N" onChange={(T1max) => set({ T1max })} />
        </>
      ) : (
        <>
          <Segmented
            value={p.task}
            onChange={(task) => set({ task })}
            options={[
              { value: 'width', label: 'Find width for P' },
              { value: 'power', label: 'Find power' },
            ]}
          />
          {p.task === 'width' ? (
            <Slider label="Power to transmit P" value={p.P / 1000} min={0.5} max={60} step={0.1} unit="kW" onChange={(x) => set({ P: x * 1000 })} />
          ) : (
            <>
              <Slider label="Belt width b" value={p.b * 1000} min={25} max={400} step={1} unit="mm" onChange={(x) => set({ b: x / 1000 })} />
              <Segmented
                value={p.limit}
                onChange={(limit) => set({ limit })}
                options={[
                  { value: 'stress', label: 'T₁ = s₁bt' },
                  { value: 'force', label: 'T₁ given' },
                ]}
              />
              {p.limit === 'force' ? <Slider label="Max tension T₁" value={p.T1max} min={200} max={8000} step={10} unit="N" onChange={(T1max) => set({ T1max })} /> : null}
            </>
          )}
          <Slider label="Thickness t" value={p.t * 1000} min={3} max={12} step={0.5} unit="mm" onChange={(x) => set({ t: x / 1000 })} />
          <Slider label="Allowable stress s₁" value={p.s1 / 1e6} min={1} max={3.5} step={0.05} unit="MPa" onChange={(x) => set({ s1: x * 1e6 })} hint="Leather 2–3.45 MPa, rubber 1–1.7 MPa" />
          <Segmented
            value={p.rho === 1250 ? 'rubber' : 'leather'}
            onChange={(m) => set({ rho: m === 'rubber' ? 1250 : 970 })}
            options={[
              { value: 'leather', label: 'Leather 970 kg/m³' },
              { value: 'rubber', label: 'Rubber 1250 kg/m³' },
            ]}
          />
        </>
      )}
      {p.wraps ? (
        <Note tone="info">
          Wraps {deg(p.wraps[0]).toFixed(0)}° / {deg(p.wraps[1]).toFixed(0)}° are set directly; the idler is drawn only to show where they come from.
          <button className="ml-1 text-info underline" onClick={() => set({ wraps: null })}>
            use the drawn geometry
          </button>
        </Note>
      ) : null}
      <Slider label="Creep shown (exaggerated)" value={p.creep * 100} min={0} max={10} step={0.5} unit="%" onChange={(x) => set({ creep: x / 100 })} hint="Creep is real but only ~1–2 %" />
    </Section>
  )
}

function Charts() {
  const p = useBelts()
  const a = useMemo(() => analyse(p), [p])
  const pv = useMemo(() => {
    const vmax = Math.max(40, a.v * 1.6)
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i <= 80; i++) {
      const v = (vmax * i) / 80
      xs.push(v)
      ys.push(Math.max(0, beltCapacity(a.T1, a.m, v, a.kg).P / 1000))
    }
    return { xs, ys }
  }, [a])
  const ka = useMemo(() => {
    const xs: number[] = []
    const flat: number[] = []
    const vee: number[] = []
    for (let d = 90; d <= 300; d += 3) {
      xs.push(d)
      flat.push(tensionFactor(p.f1, rad(d)))
      vee.push(tensionFactor(p.f1, rad(d), p.groove))
    }
    return { xs, flat, vee }
  }, [p.f1, p.groove])
  const vStar = maxPowerSpeed(a.T1, a.m)
  return (
    <Section title="Charts">
      <Chart data={[pv.xs, pv.ys]} series={[{ label: 'P', color: '#9bd17a', width: 2 }]} xLabel="Belt speed v (m/s)" yLabel="Power per belt (kW)" marker={() => [a.v, a.Pbelt / 1000]} height={160} />
      <Note>
        At fixed T₁, P = (T₁ − mv²)(1 − 1/k)v peaks where mv² = T₁/3, v* = {fmt(vStar, 3)} m/s — centrifugal tension eats the capacity at high speed.
      </Note>
      <div className="h-2" />
      <Chart
        data={[ka.xs, ka.flat, ka.vee]}
        series={[
          { label: 'flat', color: '#6fb3e0', width: 2 },
          { label: 'V', color: '#e8794f', width: 2 },
        ]}
        xLabel="Angle of wrap α (°)"
        yLabel="T₁/T₂ factor"
        logY
        marker={() => [deg(a.alpha[a.gov]), a.kg]}
        height={150}
      />
      <Note>Blue: flat belt e^(fα). Orange: V-belt e^(fα/sin(θ/2)) — the wedge multiplies the friction by 1/sin(θ/2) = {fmt(1 / Math.sin(p.groove / 2), 3)}.</Note>
    </Section>
  )
}

function CalcWorking() {
  const p = useBelts()
  const a = useMemo(() => analyse(p), [p])
  const isV = p.kind === 'v'
  const r = (x: number) => n(x * 1000, 4)
  const steps: WorkingStep[] = []
  if (!a.fromQuestion) {
    if (p.layout === 'crossed' && !isV) {
      steps.push({
        label: 'Angle of wrap, crossed belt',
        tex: '\\alpha_1=\\alpha_2=180^\\circ+2\\sin^{-1}\\dfrac{R+r}{C}',
        sub: `=180^\\circ+2\\sin^{-1}\\dfrac{${r(p.D / 2)}+${r(p.d / 2)}}{${r(p.C)}}`,
        result: `= ${n(deg(a.alpha[0]), 4)}^\\circ = ${n(a.alpha[0], 4)}\\ \\text{rad}`,
        cite: A503.m(4, 'slide 12'),
      })
    } else {
      steps.push({
        label: 'Angles of wrap, open belt',
        tex: '\\sin\\beta=\\dfrac{R-r}{C},\\quad \\alpha_1=180^\\circ-2\\beta,\\ \\alpha_2=180^\\circ+2\\beta',
        sub: `\\beta=\\sin^{-1}\\dfrac{${r(p.D / 2)}-${r(p.d / 2)}}{${r(p.C)}}`,
        result: `\\alpha_1 = ${n(deg(a.alpha[0]), 4)}^\\circ,\\ \\alpha_2 = ${n(deg(a.alpha[1]), 4)}^\\circ`,
        cite: A503.m(4, 'slide 10'),
        errata: erratum('open-belt'),
      })
    }
  }
  steps.push({
    label: 'Tension factor on each pulley — the smaller governs',
    tex: isV ? 'k=e^{f\\alpha/\\sin(\\theta/2)}' : 'k=e^{f\\alpha}',
    sub: isV
      ? `k_1=e^{${p.f1}(${n(a.alpha[0], 4)})/\\sin ${n(deg(p.groove) / 2, 3)}^\\circ},\\ k_2=e^{${p.f2}(${n(a.alpha[1], 4)})/\\sin ${n(deg(p.groove) / 2, 3)}^\\circ}`
      : `k_1=e^{${p.f1}\\times${n(a.alpha[0], 4)}},\\ k_2=e^{${p.f2}\\times${n(a.alpha[1], 4)}}`,
    result: `k_1=${n(a.k[0], 4)},\\ k_2=${n(a.k[1], 4)}\\ \\Rightarrow\\ k=${n(a.kg, 4)}\\ (\\text{${a.gov === 0 ? 'small' : 'large'} pulley})`,
    cite: A503.m(4, 'slides 5–8'),
  })
  steps.push({ label: 'Belt speed', tex: 'v=\\dfrac{\\pi d N}{60}', sub: `=\\dfrac{\\pi(${n(p.d, 4)})(${p.rpm})}{60}`, result: `=${n(a.v, 4)}\\ \\text{m/s}`, cite: A503.m(4, 'slide 2') })
  if (!isV && p.task === 'width' && a.width) {
    const w = a.width
    steps.push({ label: 'Centrifugal stress (m′ = ρ for 1 m² of section)', tex: "m'v^2=\\rho v^2", sub: `=${p.rho}(${n(a.v, 4)})^2`, result: `=${n(w.centrifugalStress, 4)}\\ \\text{Pa}`, cite: A503.m(4, 'slide 3') })
    steps.push({
      label: 'Slack-side stress',
      tex: "\\dfrac{s_1-m'v^2}{s_2-m'v^2}=e^{f\\alpha}\\Rightarrow s_2=m'v^2+\\dfrac{s_1-m'v^2}{e^{f\\alpha}}",
      sub: `=${n(w.centrifugalStress, 4)}+\\dfrac{${n(p.s1, 4)}-${n(w.centrifugalStress, 4)}}{${n(a.kg, 4)}}`,
      result: `s_2=${n(w.s2, 4)}\\ \\text{Pa}`,
      cite: A503.m(4, 'slide 3'),
    })
    steps.push({ label: 'Effective pull', tex: 'T_1-T_2=P/v', sub: `=${n(p.P, 4)}/${n(a.v, 4)}`, result: `=${n(w.dT, 4)}\\ \\text{N}`, cite: A503.m(4, 'slide 4') })
    steps.push({
      label: 'Area and width',
      tex: 'A=\\dfrac{T_1-T_2}{s_1-s_2},\\quad b=A/t',
      sub: `A=\\dfrac{${n(w.dT, 4)}}{${n(p.s1, 4)}-${n(w.s2, 4)}}=${n(w.A, 4)}\\ \\text{m}^2,\\ b=\\dfrac{${n(w.A, 4)}}{${n(p.t, 3)}}`,
      result: `b=${n(w.b * 1000, 4)}\\ \\text{mm}`,
      cite: A503.m(4, 'slide 4'),
    })
  } else {
    steps.push({
      label: 'Mass per metre and centrifugal tension',
      tex: isV ? 'T_c=mv^2' : 'm=bt\\rho,\\quad T_c=mv^2',
      sub: isV ? `=${n(p.mV, 4)}(${n(a.v, 4)})^2` : `m=${n(p.b, 4)}(${n(p.t, 3)})(${p.rho})=${n(a.m, 4)}\\ \\text{kg/m}`,
      result: `T_c=${n(a.Tc, 4)}\\ \\text{N}`,
      cite: A503.m(4, 'slides 5–8'),
    })
    steps.push({
      label: 'Slack-side tension',
      tex: '\\dfrac{T_1-mv^2}{T_2-mv^2}=k\\Rightarrow T_2=mv^2+\\dfrac{T_1-mv^2}{k}',
      sub: `T_1=${!isV && p.limit === 'stress' ? `s_1bt=${n(p.s1, 4)}(${n(p.b, 4)})(${n(p.t, 3)})=` : ''}${n(a.T1, 4)},\\ T_2=${n(a.Tc, 4)}+\\dfrac{${n(a.T1, 4)}-${n(a.Tc, 4)}}{${n(a.kg, 4)}}`,
      result: `T_2=${n(a.T2, 4)}\\ \\text{N}`,
      cite: A503.m(4, 'slide 7'),
    })
    steps.push({ label: isV ? 'Power per belt' : 'Power', tex: 'P=(T_1-T_2)v', sub: `=(${n(a.T1, 4)}-${n(a.T2, 4)})(${n(a.v, 4)})`, result: `=${n(a.Pbelt / 1000, 4)}\\ \\text{kW}`, cite: A503.m(4, 'slide 2') })
    if (isV && a.belts)
      steps.push({
        label: 'Number of belts',
        tex: 'n=\\dfrac{P_{design}}{P_{belt}}',
        sub: `=\\dfrac{${n(p.P / 1000, 4)}}{${n(a.Pbelt / 1000, 4)}}=${n(a.belts.exact, 3)}`,
        result: `\\Rightarrow ${a.belts.n}\\ \\text{belts}`,
        cite: A503.mg19('Q3a'),
        errata: Math.abs(p.mV - 0.523) < 1e-6 && Math.abs(p.T1max - 900) < 1e-6 ? erratum('v-belts') : undefined,
      })
  }
  return (
    <Section title="Working — by calculation">
      <Working steps={steps} />
    </Section>
  )
}

function Catalogue() {
  const p = useBelts()
  const c = useMemo(() => catalogue(p), [p])
  const [open, setOpen] = useState(true)
  const steps: WorkingStep[] = [
    { label: '(i) Design power', tex: 'P_d=\\text{SF}\\times P', sub: `=${p.catSF}\\times${p.catRated}`, result: `=${n(c.design, 4)}\\ \\text{kW}`, cite: A503.m(2, 'Example 1 (i)') },
    { label: '(iii) Speed ratio', tex: 'i=N_1/N_2=D/d', sub: `=${n(p.D * 1000, 4)}/${n(p.d * 1000, 4)}`, result: `=${n(p.D / p.d, 4)}`, cite: A503.m(2, 'Example 1 (iii)') },
    { label: '(iv) Minimum centre distance', tex: 'C=2\\sqrt{(D+d)d}', sub: `=2\\sqrt{(${n(p.D * 1000, 4)}+${n(p.d * 1000, 4)})(${n(p.d * 1000, 4)})}`, result: `=${n(2 * Math.sqrt((p.D + p.d) * p.d) * 1000, 5)}\\ \\text{mm (set }C=${n(p.C * 1000, 5)})`, cite: A503.m(2, 'Example 1 (iv)') },
    { label: '(vii) Belt length', tex: 'L=2C+1.57(D+d)+\\dfrac{(D-d)^2}{4C}', sub: `=2(${n(p.C * 1000, 5)})+1.57(${n((p.D + p.d) * 1000, 4)})+\\dfrac{(${n((p.D - p.d) * 1000, 4)})^2}{4(${n(p.C * 1000, 5)})}`, result: `=${n(c.L, 5)}\\ \\text{mm}`, cite: A503.m(2, 'Example 1 (vii)') },
    {
      label: '(ix) Arc of contact factor',
      tex: '\\dfrac{D-d}{C}\\ \\to\\ F_{arc}',
      sub: `=${n(c.ratio, 3)}\\ \\ (\\text{arc on small pulley} \\approx ${n(c.arcSmall, 3)}^\\circ)`,
      result: `F_{arc}=${n(c.FarcTable, 3)}\\ (\\text{table})${Number.isFinite(p.catFarc) ? `,\\ \\text{typed } ${p.catFarc}` : ''}`,
      cite: A503.table('Table 5, p F13'),
      errata: Number.isFinite(p.catFarc) && Math.abs(p.catFarc - c.FarcTable) > 0.02 ? `The guide's ${p.catFarc} differs from the table value (${c.FarcTable.toFixed(2)}).` : undefined,
    },
    { label: '(xi) Corrected power per belt', tex: 'P_b=(P_{basic}+P_{inc})F_LF_{arc}', sub: `=(${p.catBasic}+${p.catInc})(${p.catFL})(${n(c.Farc, 3)})`, result: `=${n(c.per, 3)}\\ \\text{kW}`, cite: A503.m(2, 'Example 1 (xi)') },
    { label: '(xii) Number of belts', tex: 'n=P_d/P_b', sub: `=${n(c.design, 4)}/${n(c.per, 3)}=${n(c.n.exact, 3)}`, result: `\\Rightarrow ${c.n.n}\\ \\text{belts}`, cite: A503.m(2, 'Example 1 (xii)') },
  ]
  return (
    <Section
      title="Catalogue selection"
      right={
        <button className="text-[11px] text-info hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? 'hide' : 'show'}
        </button>
      }
    >
      {open ? (
        <>
          <NumberField label="Rated power" value={p.catRated} onChange={(catRated) => set({ catRated })} unit="kW" step={0.1} />
          <NumberField label="Service factor" value={p.catSF} onChange={(catSF) => set({ catSF })} step={0.05} hint="Typically 1.1 for 8 h/day, 1.2 for 18 h/day" />
          <NumberField label="Basic power per belt" value={p.catBasic} onChange={(catBasic) => set({ catBasic })} unit="kW" />
          <NumberField label="Speed-ratio increment" value={p.catInc} onChange={(catInc) => set({ catInc })} unit="kW" />
          <NumberField label="Length factor F_L" value={p.catFL} onChange={(catFL) => set({ catFL })} />
          <Toggle label="Arc factor from table" checked={!Number.isFinite(p.catFarc)} onChange={(on) => set({ catFarc: on ? NaN : Number(catalogue(p).FarcTable.toFixed(2)) })} />
          {Number.isFinite(p.catFarc) ? <NumberField label="Arc factor (typed)" value={p.catFarc} onChange={(catFarc) => set({ catFarc })} /> : null}
          {p.outRpm < 100 ? (
            <Note tone="info">
              Pulley ratio {fmt(p.D / p.d, 3)} gives {fmt((p.rpm * p.d) / p.D, 3)} rpm at the worm shaft; a {fmt((p.rpm * p.d) / p.D / p.outRpm, 3)} : 1 worm gearbox brings it to {p.outRpm} rpm.
            </Note>
          ) : null}
          <div className="h-2" />
          <Working steps={steps} />
          <div className="mt-2">
            <Table head={['(D−d)/C', 'F_arc', '(D−d)/C', 'F_arc']} rows={Array.from({ length: 8 }, (_, i) => [ARC_TABLE[i * 2][0].toFixed(2), ARC_TABLE[i * 2][1].toFixed(2), ARC_TABLE[i * 2 + 14]?.[0].toFixed(2) ?? '', ARC_TABLE[i * 2 + 14]?.[1].toFixed(2) ?? ''])} />
            <Note>Arc-of-contact factors (catalogue extract). Pulley sizes, basic powers and length factors come from the manufacturer’s catalogue tables.</Note>
          </div>
        </>
      ) : null}
    </Section>
  )
}

export function BeltsPanel() {
  const [preset, setPreset] = useState<string | null>('crossed')
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <CalcWorking />
      <Catalogue />
    </div>
  )
}
