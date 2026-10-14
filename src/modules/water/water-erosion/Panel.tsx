import { useMemo, useState } from 'react'
import { PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { usle, usleSHint } from '@/physics/water'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Bullets } from '../_shared/fx'
import { C, DEFAULTS, PRACTICE_LABEL, TOLERANCE, live, pOf, soilLoss, terraceOf, useErosion, usleK, type Practice, type Stage } from './model'

function LivePanel() {
  const st = useErosion()
  const r = soilLoss(st)
  const v = useLive(() => ({ ...live }), 6, (a, b) => a.progress === b.progress)
  return (
    <Section title="Live" right={<Badge tone={r.A > TOLERANCE ? 'warn' : 'accent'}>{r.A > TOLERANCE ? 'above tolerance' : 'within tolerance'}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Soil loss A" value={fmt(r.A, 3)} unit="Mg/ha/yr" tone="accent" />
        <Readout label="LS" value={fmt(r.LS, 3)} />
        <Readout label="P" value={fmt(pOf(st), 3)} />
        <Readout label="Erosion develops" value={fmt(v.progress * 100, 3)} unit="%" />
        <Readout label="Mean lowering (3D)" value={fmt(v.eroded * 1000, 3)} unit="mm" />
        <Readout label="Tolerance" value={fmt(TOLERANCE, 3)} unit="Mg/ha/yr" />
      </div>
    </Section>
  )
}

function Controls() {
  const st = useErosion()
  return (
    <Section title="Erosion and practice">
      <Segmented<Stage>
        value={st.stage}
        onChange={(stage) => st.set({ stage })}
        size="sm"
        options={[
          { value: 'splash', label: 'Splash' },
          { value: 'sheet', label: 'Sheet' },
          { value: 'rill', label: 'Rill' },
          { value: 'gully', label: 'Gully' },
        ]}
      />
      <select value={st.practice} onChange={(e) => st.set({ practice: e.target.value as Practice })} className="mb-2 w-full rounded border border-line-2 bg-panel-2 px-1 py-0.5 text-[12px] text-ink">
        {(Object.keys(PRACTICE_LABEL) as Practice[]).map((k) => (
          <option key={k} value={k}>
            {PRACTICE_LABEL[k]}
          </option>
        ))}
      </select>
      {st.practice === 'custom' ? <Slider label="P" value={st.Pcustom} min={0.05} max={1} step={0.01} onChange={(Pcustom) => st.set({ Pcustom })} /> : null}
      <Slider label="Rainfall erosivity R" value={st.R} min={20} max={1000} step={1} onChange={(R) => st.set({ R })} />
      <Slider label="Soil erodibility K" value={st.K} min={0.05} max={0.7} step={0.01} onChange={(K) => st.set({ K })} />
      <Slider label="Slope length l" value={st.l} min={5} max={300} step={0.5} unit="m" onChange={(l) => st.set({ l })} />
      <Slider label="Slope s" value={st.sPct} min={0.5} max={20} step={0.1} unit="%" onChange={(sPct) => st.set({ sPct })} />
      <Slider label="Cover factor C" value={st.Cf} min={0.01} max={1} step={0.01} onChange={(Cf) => st.set({ Cf })} />
      <Segmented
        value={st.sForm}
        onChange={(sForm) => st.set({ sForm })}
        size="sm"
        options={[
          { value: 'notes', label: 'S from sin θ (notes)' },
          { value: 'hint', label: 'S = (0.43+0.30s+0.043s²)/6.574' },
        ]}
      />
      <Slider label="Erosion speed" value={st.speed} min={0.25} max={4} step={0.25} unit="×" onChange={(speed) => st.set({ speed })} />
    </Section>
  )
}

function Presets() {
  const [active, setActive] = useState<string | null>(null)
  const set = useErosion.getState().set
  const presets: Preset[] = [
    { id: 's1-contour', label: 'R 135, K 0.47, 6 %: contour', note: 'Slope 2.74/45.66 = 6 %, l = 45.66 m, C = 0.5: m = 0.433, L = 1.37, S = 0.677, LS = 0.93 → A = 14.7 Mg/ha with contouring — above 6.72.', apply: () => set({ ...DEFAULTS }) },
    { id: 's1-strip', label: '… strip cropping', note: 'P = 0.25 → 7.4 Mg/ha: still too high.', apply: () => set({ ...DEFAULTS, practice: 'strip' }) },
    { id: 's1-terr', label: '… terraces', note: 'P = 0.10 → 2.9 Mg/ha: acceptable. Choose terracing.', apply: () => set({ ...DEFAULTS, practice: 'terraceUnderground', stage: 'sheet' }) },
    { id: 's2-a0', label: 'A₀ = 44.8 at C 0.25: contour', note: 'RKLS = 44.8/0.25 = 179.2. Contour (P 0.5) with C = 0.15 → 13.4 Mg/ha; strip crop (0.25) → 6.7; terrace (0.12) → 3.2 Mg/ha, 76 % less than contouring. (The preset sets R so that RKLS = 179.2 on this slope.)', apply: () => { const lsK = usle({ R: 1, K: 0.3, l: 45.66, sPct: 6, C: 1, P: 1 }).A; set({ ...DEFAULTS, K: 0.3, R: 179.2 / lsK, Cf: 0.15, practice: 'contour' }) } },
    { id: 'ps2-2', label: 'K 0.15, 91 m, 10 %, R 750', note: 'C = 0.2, P = 1; compare with the 6.7 Mg/ha target and choose a practice.', apply: () => set({ ...DEFAULTS, R: 750, K: 0.15, l: 91, sPct: 10, Cf: 0.2, practice: 'none' }) },
    { id: 'ps2-3', label: 'Terraced field, 6 %, terraces at 24 m', note: 'K = 0.3, C = 0.2, slope length reset to the 24 m terrace interval (field 183 m long).', apply: () => set({ ...DEFAULTS, R: 750, K: 0.3, l: 24, sPct: 6, Cf: 0.2, practice: 'terrace', stage: 'sheet' }) },
  ]
  return (
    <Section title="Exam presets">
      <PresetGrid presets={presets} active={active} onPick={setActive} />
    </Section>
  )
}

function KCalc() {
  const [k, setK] = useState({ silt: 40, vfs: 10, clay: 20, om: 2, structure: 2, permeability: 3 })
  const r = usleK(k)
  const set = useErosion.getState().set
  return (
    <Section title="Soil erodibility K">
      <Slider label="Silt" value={k.silt} min={0} max={80} step={1} unit="%" onChange={(silt) => setK({ ...k, silt })} />
      <Slider label="Very fine sand" value={k.vfs} min={0} max={40} step={1} unit="%" onChange={(vfs) => setK({ ...k, vfs })} />
      <Slider label="Clay" value={k.clay} min={0} max={60} step={1} unit="%" onChange={(clay) => setK({ ...k, clay })} />
      <Slider label="Organic matter a" value={k.om} min={0} max={6} step={0.1} unit="%" onChange={(om) => setK({ ...k, om })} />
      <Slider label="Structure code b" value={k.structure} min={1} max={4} step={1} onChange={(structure) => setK({ ...k, structure })} />
      <Slider label="Permeability class c" value={k.permeability} min={1} max={6} step={1} onChange={(permeability) => setK({ ...k, permeability })} />
      <div className="flex items-center gap-2">
        <Readout label="M" value={fmt(r.M, 4)} />
        <Readout label="K" value={fmt(r.K, 3)} tone="accent" />
        <button className="rounded border border-line-2 px-1.5 py-0.5 text-[11.5px] text-ink/85 hover:border-accent/50" onClick={() => set({ K: Math.max(0.01, r.K) })}>
          use
        </button>
      </div>
    </Section>
  )
}

function TerraceSection() {
  const st = useErosion()
  const t = terraceOf(st)
  return (
    <Section title="Exam: diversion terrace design">
      <Slider label="Design flow Q" value={st.tQ} min={0.2} max={3} step={0.01} unit="m³/s" onChange={(tQ) => st.set({ tQ })} />
      <Slider label="Velocity v" value={st.tv} min={0.3} max={1.8} step={0.05} unit="m/s" onChange={(tv) => st.set({ tv })} />
      <Slider label="Bottom width b" value={st.tb} min={0.5} max={5} step={0.02} unit="m" onChange={(tb) => st.set({ tb })} />
      <Slider label="Side slope Z" value={st.tZ} min={2} max={8} step={0.5} onChange={(tZ) => st.set({ tZ })} />
      <Slider label="Manning n" value={st.tn} min={0.025} max={0.08} step={0.001} onChange={(tn) => st.set({ tn })} />
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Flow depth d" value={fmt(t.d, 3)} unit="m" tone="accent" />
        <Readout label="Design depth D" value={fmt(t.D, 3)} unit="m" />
        <Readout label="Channel slope" value={fmt(t.s * 100, 3)} unit="%" tone="accent" />
      </div>
      <p className="mt-1 text-[11px] text-dim">0.85 m³/s, 0.9 m/s, b = 2.44 m, Z = 4, n = 0.046: a = 0.944 m², d = 0.269 m, D = 0.369 m, p = 4.66 m, R = 0.203 m → s = 1.44 %. Select a terrace practice to see the channels in 3D.</p>
    </Section>
  )
}

function Charts() {
  const st = useErosion()
  const data = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let l = 5; l <= 300; l += 5) {
      xs.push(l)
      ys.push(soilLoss({ ...st, l }).A)
    }
    return { xs, ys, tol: xs.map(() => TOLERANCE) }
  }, [st])
  const A = soilLoss(st).A
  return (
    <Section title="Soil loss vs slope length">
      <Chart
        data={[data.xs, data.ys, data.tol]}
        series={[
          { label: 'A (Mg/ha/yr)', color: '#c98d22', width: 2 },
          { label: 'Tolerance', color: '#9bd17a', width: 1.5, dash: [4, 3] },
        ]}
        xLabel="Slope length l (m)"
        yLabel="A (Mg/ha/yr)"
        marker={() => [st.l, A]}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">Terraces work partly by cutting the slope length: each interval starts a new l.</p>
    </Section>
  )
}

function Tables() {
  return (
    <Section title="Exam: factors and control practices">
      <Table
        head={['Practice', 'P']}
        rows={[
          ['Up and down slope', '1.0'],
          ['Contouring', '0.5'],
          ['Strip cropping', '0.25'],
          ['Terraces, graded sod outlets', '0.12 (P_t 0.2)'],
          ['Terraces, underground outlets', '0.10'],
        ]}
      />
      <div className="mt-1.5" />
      <Bullets
        items={[
          'Mechanical: contouring, terraces, waterways, strip cropping, tillage',
          'Soil management: reconsolidation, organic matter, amendments',
          'Crop and vegetation: rotations, cover crops, mulching (≥ 30 % residue), strip cropping',
          'Vegetation intercepts rain, slows flow, restrains soil, aggregates it through roots and transpires',
        ]}
      />
    </Section>
  )
}

function WorkingSection() {
  const st = useErosion()
  const r = soilLoss(st)
  const th = Math.atan(st.sPct / 100)
  const t = terraceOf(st)
  const steps: WorkingStep[] = [
    { label: 'Slope angle and exponent', tex: '\\theta = \\tan^{-1}\\dfrac{s}{100},\\ \\beta = \\dfrac{\\sin\\theta/0.0896}{3(\\sin\\theta)^{0.8} + 0.56},\\ m = \\dfrac{\\beta}{1+\\beta}', sub: `\\theta = ${n((th * 180) / Math.PI, 3)}^\\circ,\\ \\sin\\theta = ${n(Math.sin(th), 3)}`, result: `m = ${n(r.m, 3)}`, cite: C.csb('p5 m') },
    { label: 'Length factor', tex: 'L = (l/22)^m', sub: `= (${n(st.l, 4)}/22)^{${n(r.m, 3)}}`, result: `= ${n(r.L, 3)}`, cite: C.csb('p5 L') },
    st.sForm === 'notes'
      ? { label: 'Slope factor', tex: st.sPct < 9 ? 'S = 10.8\\sin\\theta + 0.03' : 'S = 16.8\\sin\\theta - 0.50', sub: `\\sin\\theta = ${n(Math.sin(th), 3)}`, result: `S = ${n(r.S, 3)}`, cite: C.csb('p5 S') }
      : { label: 'Slope factor (exam hint)', tex: 'S = \\dfrac{0.43 + 0.30s + 0.043s^2}{6.574}', sub: `s = ${n(st.sPct, 3)}`, result: `S = ${n(usleSHint(st.sPct), 3)}`, cite: C.s2('Q1 hint') },
    { label: 'Soil loss', tex: 'A = R\\,K\\,L\\,S\\,C\\,P', sub: `= ${n(st.R, 4)}\\times${n(st.K, 3)}\\times${n(r.L, 3)}\\times${n(r.S, 3)}\\times${n(st.Cf, 3)}\\times${n(pOf(st), 3)}`, result: `= ${n(r.A, 3)}\\ \\text{Mg/ha/yr}`, cite: C.s1('Q1b') },
    { label: 'Diversion terrace depth', tex: 'a = Q/v,\\ Zd^2 + bd - a = 0', sub: `a = ${n(t.a, 4)};\\ ${n(st.tZ, 2)}d^2 + ${n(st.tb, 3)}d - ${n(t.a, 4)} = 0`, result: `d = ${n(t.d, 3)}\\ \\text{m},\\ D = ${n(t.D, 3)}\\ \\text{m}`, cite: C.s1('Q1c') },
    { label: 'Terrace grade', tex: 's = \\left(\\dfrac{vn}{R^{2/3}}\\right)^2,\\ R = \\dfrac{a}{b + 2d\\sqrt{Z^2+1}}', sub: `R = \\dfrac{${n(t.a, 4)}}{${n(t.p, 4)}} = ${n(t.R, 3)}`, result: `s = ${n(t.s * 100, 3)}\\,\\%`, cite: C.vw('Prob. 7.8') },
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
      <KCalc />
      <TerraceSection />
      <Tables />
    </div>
  )
}
