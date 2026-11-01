import { useEffect, useMemo, useState } from 'react'
import { TestBench, createRun, instrument, slopeThroughOrigin, useAutoRun, useRunDriver } from '@/lab/run'
import * as THREE from 'three'
import { create } from 'zustand'
import { box, lathe, mat4, merge, xform } from '@/geometry'
import { axialStress, cylinderStrains, hoopStress, isThinWall, sphereStress, trescaEquivalent, vonMisesEquivalent } from '@/physics/strength'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'
import { ForceArrow } from '../../elements/_shared/Arrow'

export const FLOOR = -0.5

interface Params {
  /** MPa, mm, mm, GPa, –, MPa, mm */
  p: number
  r: number
  t: number
  E: number
  nu: number
  Y: number
  length: number
  /** the share of the full pressure in the vessel now: moved by the test */
  f: number
  set: (q: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { p: 2, r: 500, t: 10, E: 200, nu: 0.3, Y: 250, length: 1500, f: 0 }
export const useVessel = create<Params>((set) => ({ ...DEFAULTS, set: (q) => set(q), reset: () => set(DEFAULTS) }))
const set = (q: Partial<Params>) => useVessel.getState().set(q)

const vesselRun = createRun()
const PROCEDURE = { steps: 10, moveSeconds: 0.5, dwellSeconds: 0.25 }

const analyse = (s: Params, load = s.f) => {
  const p = s.p * 1e6 * load
  const r = s.r / 1000
  const t = s.t / 1000
  const h = hoopStress(p, r, t)
  const a = axialStress(p, r, t)
  return { h, a, sph: sphereStress(p, r, t), thin: isThinWall(r, t), e: cylinderStrains(p, r, t, s.E * 1e9, s.nu), tresca: trescaEquivalent(h, a, 0), mises: vonMisesEquivalent(h, a, 0) }
}

export function Vessel3D() {
  const s = useVessel()
  const a = useMemo(() => analyse(s), [s])
  const fullA = useMemo(() => analyse(s, 1), [s.p, s.r, s.t, s.E, s.nu])
  useAutoRun(vesselRun, JSON.stringify([s.p, s.r, s.t, s.E, s.nu, s.Y]))
  useRunDriver(
    vesselRun,
    PROCEDURE,
    (f) => {
      if (Math.abs(f - useVessel.getState().f) >= 0.01 || f === 1) useVessel.getState().set({ f })
    },
    (step, f) => {
      const st = useVessel.getState()
      const q = analyse(st, f)
      vesselRun.getState().log([st.p * f, instrument(q.e.hoop * 1e6, 0.01, step), instrument(q.e.axial * 1e6, 0.015, step + 30)])
      if (q.tresca / 1e6 >= st.Y) vesselRun.getState().fail(`The wall reached its ${st.Y} MPa yield stress at ${(st.p * f).toFixed(1)} MPa of pressure. The test stops before the vessel bulges.`)
    },
  )
  useEffect(
    () =>
      vesselRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle') || (r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useVessel.getState().set({ f: 0 })
      }),
    [],
  )
  const R = 0.3
  const wall = Math.max(0.006, Math.min(0.09, (s.t / s.r) * R))
  const L = 0.74
  const geo = useMemo(() => {
    const prof: [number, number][] = []
    const N = 24
    const inner = R - wall
    // up the outside, over the dome to the axis, and back down the inside: one closed section
    for (let i = 0; i <= N; i++) {
      const q = (i / N) * (Math.PI / 2)
      prof.push([Math.max(0.0001, R * Math.sin(q)), -L / 2 - R * Math.cos(q)])
    }
    for (let i = 0; i <= N; i++) {
      const q = (i / N) * (Math.PI / 2)
      prof.push([Math.max(0.0001, R * Math.cos(q)), L / 2 + R * Math.sin(q)])
    }
    for (let i = 0; i <= N; i++) {
      const q = (i / N) * (Math.PI / 2)
      prof.push([Math.max(0.0001, inner * Math.sin(q)), L / 2 + inner * Math.cos(q)])
    }
    for (let i = 0; i <= N; i++) {
      const q = (i / N) * (Math.PI / 2)
      prof.push([Math.max(0.0001, inner * Math.cos(q)), -L / 2 - inner * Math.sin(q)])
    }
    const contents = inner - 0.002
    const fluidProf: [number, number][] = []
    for (let i = 0; i <= N; i++) {
      const q = (i / N) * (Math.PI / 2)
      fluidProf.push([Math.max(0.0001, contents * Math.sin(q)), -L / 2 - contents * Math.cos(q)])
    }
    for (let i = 0; i <= N; i++) {
      const q = (i / N) * (Math.PI / 2)
      fluidProf.push([Math.max(0.0001, contents * Math.cos(q)), L / 2 + contents * Math.sin(q)])
    }
    return {
      shell: xform(lathe(prof, 72), mat4.rz(-Math.PI / 2)),
      fluid: xform(lathe(fluidProf, 72), mat4.rz(-Math.PI / 2)),
      saddles: merge(...[-0.34, 0.34].map((x) => xform(box(0.09, 0.2, 0.42), mat4.t(x, -R - 0.09, 0)))),
      base: xform(box(1.6, 0.03, 0.6), mat4.t(0, FLOOR + 0.015, 0)),
    }
  }, [wall])
  const peak = Math.max(fullA.h, 1)
  const hoopLen = 0.02 + (a.h / peak) * 0.36
  const axLen = 0.02 + (a.a / peak) * 0.36
  return (
    <group position={[0, 0.03, 0]}>
      <Part id="base" name="Saddles" role="static" material="paintGrey" info={{ summary: 'Hold the vessel.', role: 'They add local stresses of their own, which the thin-wall equations do not cover.' }} cut={false}>
        <PartMesh geometry={geo.base} />
        <PartMesh geometry={geo.saddles} material="steelDark" />
      </Part>
      <Part id="shell" name="Vessel shell" role="housing" material="steel" info={{ summary: 'A thin wall, closed at both ends.', role: 'The pressure pushes out on the wall, and the wall carries it as a membrane stress: nearly uniform through the wall when it is thin.' }}>
        <PartMesh geometry={geo.shell} />
      </Part>
      <Part id="fluid" name="Contents under pressure" role="fluid" material="coolant" info={{ summary: 'Pushes equally in all directions.', role: 'Fill it with water, not gas, when pressure testing: a liquid stores little energy if the shell should fail.' }} xray>
        <PartMesh geometry={geo.fluid} />
      </Part>
      <ForceArrow color="#d0452c" spec={() => ({ origin: new THREE.Vector3(0.12, R + 0.003, 0), dir: new THREE.Vector3(0, 0, -1), length: hoopLen, label: `hoop ${(a.h / 1e6).toFixed(0)} MPa`, visible: true })} radius={0.009} />
      <ForceArrow color="#2f6fd0" spec={() => ({ origin: new THREE.Vector3(0.12, R + 0.003, 0), dir: new THREE.Vector3(1, 0, 0), length: axLen, label: `axial ${(a.a / 1e6).toFixed(0)} MPa`, visible: true })} radius={0.009} />
      <PartLabel partId="shell" at={[-0.42, R + 0.05, 0]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'thin', label: 'Thin cylinder', note: '2 MPa, radius 500 mm, wall 10 mm: 100 MPa hoop, 50 MPa axial.', apply: () => set({ ...DEFAULTS }) },
  { id: 'gas', label: 'Gas cylinder', note: 'A much higher pressure in a smaller vessel, with radius to wall still above 10.', apply: () => set({ ...DEFAULTS, p: 12, r: 150, t: 12 }) },
  { id: 'thick', label: 'Too thick', note: 'Radius only 5 times the wall: the stress is no longer even through the wall, and these simple equations start to be wrong.', apply: () => set({ ...DEFAULTS, p: 40, r: 100, t: 20 }) },
]

/** The bench test: pump it up in steps and read the two gauges; E and Poisson’s ratio come from the slopes. */
function VesselTest() {
  const s = useVessel()
  const rows = vesselRun((q) => q.rows)
  const status = vesselRun((q) => q.status)
  const ps = rows.map((r) => r[0])
  const hoop = slopeThroughOrigin(ps, rows.map((r) => r[1]))
  const axial = slopeThroughOrigin(ps, rows.map((r) => r[2]))
  // εh/εa = (2 − ν)/(1 − 2ν), and εh = (p r / 2 t E)(2 − ν)
  const k = axial !== 0 ? hoop / axial : 0
  const nu = k ? (2 - k) / (1 - 2 * k) : 0
  const E = hoop > 0 ? (((s.r / (2 * s.t)) * (2 - nu)) / (hoop * 1e-6)) / 1000 : 0
  return (
    <TestBench run={vesselRun} steps={PROCEDURE.steps} title="The test: pump it up" head={['Pressure (MPa)', 'Hoop (µε)', 'Axial (µε)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[[0, ...ps], [0, ...rows.map((r) => r[1])], [0, ...rows.map((r) => r[2])]]} series={[{ label: 'Hoop', color: '#e8794f', width: 2 }, { label: 'Axial', color: '#6fb3e0', width: 2 }]} xLabel="Pressure (MPa)" yLabel="Strain (µε)" height={120} />
          {status === 'done' ? (
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              <Readout label="E from the test" value={fmt(E, 3)} unit="GPa" tone="accent" />
              <Readout label="Poisson’s ratio" value={fmt(nu, 2)} tone="info" />
              <Readout label="Hoop ÷ axial" value={fmt(k, 3)} />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function VesselPanel() {
  const s = useVessel()
  const [preset, setPreset] = useState<string | null>('thin')
  const a = analyse(s)
  const full = analyse(s, 1)
  const volume = Math.PI * (s.r / 1000) ** 2 * (s.length / 1000)
  return (
    <div>
      <VesselTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Hoop stress" value={fmt(a.h / 1e6, 4)} unit="MPa" tone="warn" />
          <Readout label="Axial stress" value={fmt(a.a / 1e6, 4)} unit="MPa" tone="info" />
          <Readout label="In a sphere" value={fmt(a.sph / 1e6, 4)} unit="MPa" />
          <Readout label="Hoop strain" value={fmt(a.e.hoop * 1e6, 4)} unit="µε" />
          <Readout label="Axial strain" value={fmt(a.e.axial * 1e6, 4)} unit="µε" />
          <Readout label="Volume gain" value={fmt(a.e.volumetric * volume * 1e6, 3)} unit="cm³" />
          <Readout label="Largest shear" value={fmt(a.tresca / 2 / 1e6, 4)} unit="MPa" />
          <Readout label="Von Mises" value={fmt(a.mises / 1e6, 4)} unit="MPa" />
          <Readout label="Safety factor" value={fmt((s.Y * 1e6) / full.tresca, 3)} tone={(s.Y * 1e6) / full.tresca > 1.5 ? 'accent' : 'warn'} />
        </div>
        {a.thin ? null : <Note tone="warn">Radius under 10 times the wall: thin-wall results no longer hold, and the true peak hoop stress is higher.</Note>}
      </Section>
      <Section title="The vessel">
        <Slider label="Full pressure" value={s.p} min={0.1} max={50} step={0.1} unit="MPa" onChange={(p) => set({ p })} />
        <Slider label="Radius" value={s.r} min={50} max={1500} step={10} unit="mm" onChange={(r) => set({ r })} />
        <Slider label="Wall" value={s.t} min={2} max={60} step={1} unit="mm" onChange={(t) => set({ t })} />
        <Slider label="Length" value={s.length} min={200} max={6000} step={100} unit="mm" onChange={(length) => set({ length })} />
        <Slider label="Yield stress" value={s.Y} min={100} max={800} step={10} unit="MPa" onChange={(Y) => set({ Y })} />
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Hoop stress: cut lengthwise', tex: '\\sigma_h(2tL) = p(2rL) \\Rightarrow \\sigma_h = \\dfrac{p r}{t}', sub: `=\\dfrac{${n(s.p, 3)}(${n(s.r, 3)})}{${n(s.t, 3)}}`, result: `=${n(full.h / 1e6, 4)}\\ \\text{MPa}` },
            { label: 'Axial stress: cut across', tex: '\\sigma_a(2\\pi r t) = p(\\pi r^2) \\Rightarrow \\sigma_a = \\dfrac{p r}{2t}', result: `=${n(full.a / 1e6, 4)}\\ \\text{MPa}` },
            { label: 'Hoop strain', tex: '\\varepsilon_h = \\dfrac{1}{E}(\\sigma_h - \\nu\\sigma_a) = \\dfrac{pr}{2tE}(2-\\nu)', result: `=${n(full.e.hoop * 1e6, 4)}\\ \\mu\\varepsilon` },
            { label: 'Axial strain', tex: '\\varepsilon_a = \\dfrac{1}{E}(\\sigma_a - \\nu\\sigma_h) = \\dfrac{pr}{2tE}(1-2\\nu)', result: `=${n(full.e.axial * 1e6, 4)}\\ \\mu\\varepsilon` },
            { label: 'Change in volume', tex: '\\dfrac{\\Delta V}{V} = 2\\varepsilon_h + \\varepsilon_a = \\dfrac{pr}{2tE}(5 - 4\\nu)', result: `=${n(full.e.volumetric * 1e6, 4)}\\ \\mu\\varepsilon` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Thin-wall analysis applies when r/t ≥ 10. Hoop stress is twice axial, which is why a sausage splits lengthwise.</li>
          <li>A sphere carries pr/2t in all directions: half the cylinder’s hoop stress, so it can have half the wall.</li>
          <li>In a thin-walled vessel’s plane, hoop and axial are principal stresses.</li>
        </ExamList>
      </Section>
    </div>
  )
}
