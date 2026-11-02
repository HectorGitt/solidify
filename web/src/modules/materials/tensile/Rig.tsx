import { useEffect, useMemo, useRef } from 'react'
import { TestBench, createRun, instrument, slopeThroughOrigin, useResetOnChange, useRunDriver } from '@/lab/run'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, xform } from '@/geometry'
import { TEST_MATERIALS, circleArea, percentElongation, percentReduction, stressAt, toughness } from '@/physics/strength'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n } from '@/ui/Working'
import { Note } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'

export const FLOOR = -0.72
const GAUGE_DRAWN = 0.28

interface Params {
  material: string
  /** gauge length and diameter, mm */
  L0: number
  d: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { material: 'mild', L0: 50, d: 12 }
export const useTensile = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useTensile.getState().set(p)
const live = { u: 0, broken: false }
const tensileRun = createRun()
const PROCEDURE = { steps: 28, moveSeconds: 0.42, dwellSeconds: 0.1 }
/** how far the two halves spring apart at the break */
const SNAP = 0.05
const matOf = (id: string) => TEST_MATERIALS.find((m) => m.id === id) ?? TEST_MATERIALS[0]

/** the test runs through a stretched strain scale, so the small elastic part still takes a visible time */
function strainAt(m: (typeof TEST_MATERIALS)[number], u: number) {
  const eY = m.yield / m.E
  if (u < 0.28) return (u / 0.28) * eY
  return eY + ((u - 0.28) / 0.72) * (m.eF - eY)
}

/** the specimen's profile: the gauge length thinning, and a neck forming after the ultimate stress */
function specimen(radius: number, stretch: number, neck: number, broken: boolean) {
  const L = GAUGE_DRAWN * (1 + stretch)
  const grip = 0.1
  const uniform = radius / Math.sqrt(1 + stretch)
  const profile: [number, number][] = []
  const R = radius * 1.7
  const halfGauge = L / 2
  profile.push([0, -halfGauge - 0.07 - grip])
  profile.push([R, -halfGauge - 0.07 - grip])
  profile.push([R, -halfGauge - 0.07])
  const N = 40
  for (let i = 0; i <= N; i++) {
    const y = -halfGauge - 0.03 + ((L + 0.06) * i) / N
    const q = y / (L * 0.16)
    const dip = neck * Math.exp(-q * q)
    let r = uniform * (1 - dip * 0.55)
    if (Math.abs(y) > halfGauge) r = uniform + (R - uniform) * Math.min(1, (Math.abs(y) - halfGauge) / 0.04)
    profile.push([r, y])
  }
  profile.push([R, halfGauge + 0.07])
  profile.push([R, halfGauge + 0.07 + grip])
  profile.push([0, halfGauge + 0.07 + grip])
  const round = (pts: [number, number][]) => lathe(pts.map(([r, y]) => [Math.max(0.0004, r), y] as [number, number]), 40)
  if (!broken) return round(profile)
  // two pieces, the upper one lifted with the crosshead
  const waist = Math.min(...profile.filter(([, y]) => Math.abs(y) < L / 2).map(([r]) => r))
  const lower = profile.filter(([, y]) => y < -0.002)
  const upper = profile.filter(([, y]) => y > 0.002)
  return merge(round([...lower, [waist, 0], [0, 0]]), xform(round([[0, 0], [waist, 0], ...upper]), mat4.t(0, SNAP, 0)))
}

export function Tensile3D() {
  const p = useTensile()
  const m = matOf(p.material)
  const crosshead = useRef<THREE.Group>(null)
  const piece = useRef<THREE.Mesh>(null)
  const lastBuilt = useRef(-1)
  const radius = 0.018 + (p.d - 6) * 0.0012

  const frame = useMemo(() => {
    const col = (x: number) => xform(cylinder(0.035, 1.5, 28), mat4.t(x, 0, 0))
    const screw = (x: number) => xform(cylinder(0.018, 1.46, 16), mat4.t(x, 0, 0.1))
    return {
      cols: merge(col(-0.42), col(0.42)),
      top: xform(box(1.05, 0.12, 0.26), mat4.t(0, 0.72, 0.03)),
      base: xform(box(1.25, 0.2, 0.42), mat4.t(0, FLOOR + 0.1, 0.03)),
      lowerGrip: xform(box(0.26, 0.09, 0.14), mat4.t(0, -0.42, 0)),
      upperHead: merge(xform(box(0.92, 0.1, 0.2), mat4.t(0, 0, 0.02)), xform(box(0.26, 0.09, 0.14), mat4.t(0, -0.08, 0))),
      screws: merge(screw(-0.36), screw(0.36)),
      stem: xform(cylinder(0.03, 0.2, 18), mat4.t(0, -0.56, 0)),
    }
  }, [])
  const startGeo = useMemo(() => specimen(radius, 0, 0, false), [radius])
  const specMat = useMemo(
    () =>
      createDynamicCutMaterial({
        color: m.ductile ? '#aeb6bc' : '#6a6f73',
        cap: m.ductile ? '#c8d0d6' : '#9aa3a8',
        hatch: m.ductile ? 'steel' : 'castIron',
        metalness: 0.7,
        roughness: 0.35,
      }).material,
    [m.ductile],
  )
  useResetOnChange(tensileRun, JSON.stringify([p.material, p.d, p.L0]))
  useRunDriver(
    tensileRun,
    PROCEDURE,
    (f) => {
      live.u = f
    },
    (step, f) => {
      const st = useTensile.getState()
      const mt = matOf(st.material)
      const e = Math.min(strainAt(mt, f), mt.eF * 0.99999)
      const area = circleArea(st.d / 1000)
      const force = (stressAt(mt, e) * area) / 1000
      tensileRun.getState().log([instrument(force, 0.003, step), e * st.L0, e * 100, instrument(stressAt(mt, e) / 1e6, 0.003, step)])
      if (f >= 1) {
        live.broken = true
        lastBuilt.current = -1
        tensileRun.getState().finish(mt.ductile ? 'Broken, after necking: a ductile, cup-and-cone fracture.' : 'Broken, with no warning and hardly any stretch: a brittle fracture.')
      }
    },
  )
  useEffect(
    () =>
      tensileRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle') || (r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) {
          live.u = 0
          live.broken = false
          lastBuilt.current = -1
        }
      }),
    [],
  )
  useSimFrame(() => {
    const s = useTensile.getState()
    const mt = matOf(s.material)
    const e = strainAt(mt, live.u)
    // the whole strain is drawn to scale at the plastic end; the elastic part is too small to see true
    const visual = Math.max(e, 0.0005) * (mt.eF > 0.05 ? 1.1 : 12)
    const neck = mt.ductile ? Math.max(0, (e - mt.eU) / (mt.eF - mt.eU)) : 0
    const key = Math.round(live.u * 240)
    if (piece.current && key !== lastBuilt.current) {
      lastBuilt.current = key
      piece.current.geometry.dispose()
      piece.current.geometry = specimen(radius, visual, neck, live.broken)
    }
    const gauge = GAUGE_DRAWN * (1 + visual)
    const bottom = -0.42 + 0.01
    crosshead.current?.position.set(0, bottom + 0.34 + gauge + 0.09 + (live.broken ? SNAP : 0), 0)
    if (piece.current) piece.current.position.y = bottom + 0.17 + gauge / 2
  })
  const lowerY = -0.42

  return (
    <group>
      <Part id="frame" name="Machine frame" role="static" material="paintBlue" info={{ summary: 'A stiff two-column frame.', role: 'It takes the whole test force back round the specimen, and must stretch far less than the specimen does.' }} cut={false} explode={[0, 0, -0.3]}>
        <PartMesh geometry={frame.cols} material="chrome" />
        <PartMesh geometry={frame.top} />
        <PartMesh geometry={frame.base} />
        <PartMesh geometry={frame.screws} material="steelDark" />
        <PartMesh geometry={frame.stem} material="steel" />
      </Part>
      <Part id="lower-grip" name="Lower grip" role="static" material="steelDark" info={{ summary: 'Holds one end of the specimen.', role: 'Grips by the shoulders, so that the break happens in the gauge length.' }}>
        <PartMesh geometry={frame.lowerGrip} />
      </Part>
      <group ref={crosshead} position={[0, lowerY + 0.8, 0]}>
        <Part id="crosshead" name="Moving crosshead" role="moving" material="paintGrey" info={{ summary: 'Driven up the screws at a steady rate.', role: 'It sets the strain; the load cell reads the force the specimen pushes back with.' }} cut>
          <PartMesh geometry={frame.upperHead} />
        </Part>
      </group>
      <Part id="specimen" name="Test specimen" role="moving" material={m.ductile ? 'steel' : 'castIron'} info={{ summary: 'A round bar with a marked gauge length.', role: 'The stress is load over the original area, and the strain is extension over the original gauge length.' }} cut>
        <mesh ref={piece} geometry={startGeo} material={specMat} position={[0, lowerY + 0.3, 0]} castShadow />
      </Part>
      <PartLabel partId="specimen" at={[0.1, 0.05, 0.05]} />
      <PartLabel partId="crosshead" at={[0.52, 0.2, 0.08]} />
    </group>
  )
}

export function TensilePanel() {
  const p = useTensile()
  const m = matOf(p.material)
  const u = useLive(() => live.u, 15)
  const e = strainAt(m, u)
  const s = stressAt(m, e)
  const A = circleArea(p.d / 1000)
  const broke = u >= 1
  const rows = tensileRun((q) => q.rows)
  const status = tensileRun((q) => q.status)
  const strains = rows.map((r) => r[2])
  const stresses = rows.map((r) => r[3])
  // Young's modulus from the straight part: the readings up to the yield strain
  const eY = (m.yield / m.E) * 100
  const straight = rows.filter((r) => r[2] <= eY * 0.98)
  const foundE = slopeThroughOrigin(straight.map((r) => r[2] / 100), straight.map((r) => r[3])) / 1000
  const elastic = rows.filter((r) => r[2] <= eY * 1.6)
  const Af = m.ductile ? A * 0.45 : A * 0.99
  const Lf = p.L0 * (1 + m.eF)
  return (
    <div>
      <TestBench run={tensileRun} steps={PROCEDURE.steps} title="The test: pull it to failure" head={['Force (kN)', 'Ext. (mm)', 'Strain (%)', 'Stress (MPa)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3), fmt(r[3], 3)]}>
        {rows.length > 1 ? (
          <>
            <Chart data={[strains, stresses]} series={[{ label: 'Stress', color: '#e8794f', width: 2 }]} xLabel="Strain (%)" yLabel="Stress (MPa)" height={135} />
            {elastic.length > 2 ? <Chart data={[elastic.map((r) => r[2]), elastic.map((r) => r[3])]} series={[{ label: 'Straight part', color: '#6fb3e0', width: 2 }]} xLabel="Strain (%), close up" yLabel="Stress (MPa)" height={105} /> : null}
            {status === 'done' ? (
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                <Readout label="E from the test" value={fmt(foundE, 3)} unit="GPa" tone="accent" />
                <Readout label="Ultimate found" value={fmt(Math.max(...stresses), 3)} unit="MPa" tone="warn" />
                <Readout label="Elongation found" value={fmt(strains[strains.length - 1], 3)} unit="%" tone="info" />
              </div>
            ) : null}
          </>
        ) : null}
      </TestBench>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Force" value={fmt((s * A) / 1000, 4)} unit="kN" tone="warn" />
          <Readout label="Stress" value={fmt(s / 1e6, 4)} unit="MPa" tone="accent" />
          <Readout label="Strain" value={fmt(e * 100, 3)} unit="%" tone="info" />
          <Readout label="Extension" value={fmt(e * p.L0, 3)} unit="mm" />
          <Readout label="State" value={broke ? 'broken' : e <= m.yield / m.E ? 'elastic' : e <= m.eU ? 'plastic' : 'necking'} />
          <Readout label="Young’s modulus" value={fmt(m.E / 1e9, 3)} unit="GPa" />
        </div>
      </Section>
      <Section title="The test">
        <div className="grid grid-cols-2 gap-1">
          {TEST_MATERIALS.map((x) => (
            <button
              key={x.id}
              onClick={() => set({ material: x.id })}
              className={`rounded-md border px-2 py-1 text-left text-[11.5px] ${x.id === p.material ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/85 hover:border-accent/50'}`}
            >
              {x.name}
            </button>
          ))}
        </div>
        {status === 'idle' ? <Slider label="Pull by hand" value={u * 100} min={0} max={100} step={0.5} unit="%" onChange={(v) => { live.u = v / 100; live.broken = v >= 100 }} /> : null}
        <Slider label="Specimen diameter" value={p.d} min={6} max={20} step={1} unit="mm" onChange={(d) => set({ d })} />
        <Slider label="Gauge length" value={p.L0} min={25} max={200} step={5} unit="mm" onChange={(L0) => set({ L0 })} />
        <Note>The extension is drawn exaggerated, more so for brittle materials. The curves are typical shapes for each material, not one specific test.</Note>
      </Section>
      <Section title="Typical figures for this material">
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          <Readout label="Yield" value={fmt(m.yield / 1e6, 3)} unit="MPa" />
          <Readout label="Ultimate" value={fmt(m.uts / 1e6, 3)} unit="MPa" tone="warn" />
          <Readout label="Fracture" value={fmt(m.fracture / 1e6, 3)} unit="MPa" />
          <Readout label="Elongation" value={fmt(percentElongation(p.L0, Lf), 3)} unit="%" />
          <Readout label="Area reduction" value={fmt(percentReduction(A, Af), 3)} unit="%" />
          <Readout label="Toughness" value={fmt(toughness(m) / 1e6, 3)} unit="MJ/m³" tone="info" />
        </div>
        <Note>A brittle material has a small area under its curve. It gives no warning: it breaks as soon as its strength is reached.</Note>
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Direct stress, on the original area', tex: '\\sigma = \\dfrac{P}{A}', sub: `=\\dfrac{${n((s * A) / 1000, 4)}\\times10^3}{${n(A * 1e6, 4)}}`, result: `=${n(s / 1e6, 4)}\\ \\text{MPa}` },
            { label: 'Strain', tex: '\\varepsilon = \\dfrac{\\delta}{L}', sub: `=\\dfrac{${n(e * p.L0, 3)}}{${n(p.L0, 3)}}`, result: `=${n(e, 3)}` },
            { label: 'Young’s modulus, on the straight part', tex: 'E = \\dfrac{\\sigma}{\\varepsilon}', result: `=${n(m.E / 1e9, 3)}\\ \\text{GPa}` },
            { label: 'Ductility', tex: '\\%\\text{ elongation} = \\dfrac{L_f - L_0}{L_0}\\times 100', result: `=${n(percentElongation(p.L0, Lf), 3)}\\ \\%` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Three forms: σ = P/A (analysis), P = σA (load capacity), A = P/σ (design). A 50 mm square bar under 400 kN carries 160 MPa.</li>
          <li>On the curve: proportional limit, elastic limit, yield points, ultimate stress, fracture.</li>
          <li>Ductile materials stretch and neck, and are usually over 5 % elongation. Brittle ones, such as cast iron and concrete, break with little strain and are far stronger in compression.</li>
          <li>Engineering stress falls after the ultimate stress only because it is based on the original area: true stress keeps rising.</li>
        </ExamList>
      </Section>
    </div>
  )
}
