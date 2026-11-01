import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, xform } from '@/geometry'
import { allowedAmplitude, basquinLife, basquinStress, cycleStresses, minerDamage, type MeanLine } from '@/physics/strength'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n } from '@/ui/Working'
import { Note } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'

export const FLOOR = -0.52
const along = mat4.rz(Math.PI / 2)

interface Params {
  /** MPa */
  amp: number
  mean: number
  Su: number
  Se: number
  Sy: number
  line: MeanLine
  rpm: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { amp: 300, mean: 0, Su: 600, Se: 250, Sy: 400, line: 'goodman' as MeanLine, rpm: 40 }
export const useFatigue = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useFatigue.getState().set(p)
const live = { theta: 0, turns: 0 }

/** the amplitude that would have the same life with no mean stress */
const equivalentAmp = (p: Params) => {
  const allowed = allowedAmplitude(p.line, 1, p.Su, p.Sy, p.mean)
  return allowed > 0 ? p.amp / allowed : Infinity
}

export function Fatigue3D() {
  const shaft = useRef<THREE.Group>(null)
  const dot = useRef<THREE.Mesh>(null)
  const R = 0.05
  const geo = useMemo(
    () => ({
      // a waisted specimen: the waist is where it will break
      piece: xform(lathe(([[0.0001, -0.42], [R, -0.42], [R, -0.1], [0.032, 0], [R, 0.1], [R, 0.42], [0.0001, 0.42]] as [number, number][]), 48), along),
      bearings: merge(...[-0.48, 0.48].map((x) => merge(xform(box(0.1, 0.14, 0.2), mat4.t(x, -0.02, 0)), xform(box(0.06, 0.4, 0.06), mat4.t(x, -0.27, 0))))),
      base: xform(box(1.5, 0.04, 0.5), mat4.t(0, FLOOR + 0.02, 0)),
      motor: xform(cylinder(0.08, 0.2, 32), mat4.c(mat4.t(-0.68, -0.02, 0), along)),
      motorStand: xform(box(0.2, 0.42, 0.14), mat4.t(-0.68, -0.31, 0)),
      hanger: merge(...[-0.22, 0.22].map((x) => xform(cylinder(0.006, 0.26, 10), mat4.t(x, -0.15, 0))), xform(box(0.5, 0.012, 0.03), mat4.t(0, -0.28, 0))),
      weights: merge(...Array.from({ length: 4 }, (_, i) => xform(cylinder(0.07, 0.022, 32), mat4.t(0, -0.3 - i * 0.024, 0)))),
      dot: new THREE.SphereGeometry(0.008, 16, 12),
    }),
    [],
  )
  useSimFrame((dt) => {
    const s = useFatigue.getState()
    const w = (s.rpm * 2 * Math.PI) / 60
    live.theta += w * dt
    live.turns += (s.rpm / 60) * dt
    shaft.current?.rotation.set(live.theta, 0, 0)
    if (dot.current) {
      // a point on the waist's surface, going from tension at the bottom to compression at the top
      const a = live.theta
      dot.current.position.set(0, -0.02 - 0.034 * Math.cos(a), -0.034 * Math.sin(a))
      const c = dot.current.material as THREE.MeshBasicMaterial
      c.color.set(Math.cos(a) > 0 ? '#d0452c' : '#2f6fd0')
    }
  })
  return (
    <group>
      <Part id="base" name="Machine base" role="static" material="paintGrey" info={{ summary: 'Carries the bearings.', role: 'Everything but the load is held fixed. The load stays still as the specimen turns beneath it.' }} cut={false}>
        <PartMesh geometry={geo.base} />
        <PartMesh geometry={geo.bearings} material="castIron" />
        <PartMesh geometry={geo.motor} material="paintBlue" />
        <PartMesh geometry={geo.motorStand} material="paintBlue" />
      </Part>
      <group ref={shaft} position={[0, -0.02, 0]}>
        <Part id="specimen" name="Test specimen" role="moving" material="chrome" info={{ summary: 'A polished, waisted bar.', role: 'Bent one way all the time while it spins, so each point on its surface swings between tension and compression once per turn.' }}>
          <PartMesh geometry={geo.piece} />
        </Part>
      </group>
      <mesh ref={dot} geometry={geo.dot}>
        <meshBasicMaterial color="#d0452c" toneMapped={false} />
      </mesh>
      <Part id="load" name="Dead weight" role="static" material="castIron" info={{ summary: 'Hangs from bearings on the bar.', role: 'A steady load that bends the bar in the same direction, however it turns. The stress is set by the amount of weight.' }} cut={false}>
        <PartMesh geometry={geo.hanger} material="steel" />
        <PartMesh geometry={geo.weights} />
      </Part>
      <PartLabel partId="specimen" at={[0.28, 0.1, 0.05]} />
    </group>
  )
}

export function FatiguePanel() {
  const p = useFatigue()
  const eq = equivalentAmp(p)
  const life = basquinLife(eq, p.Su, p.Se)
  const allowed = allowedAmplitude(p.line, p.Se, p.Su, p.Sy, p.mean)
  const c = cycleStresses(p.mean + p.amp, p.mean - p.amp)
  const turns = useLive(() => live.turns, 8)
  const sn = useMemo(() => {
    const N = Array.from({ length: 100 }, (_, i) => 10 ** (3 + (i / 99) * 5))
    return { N, S: N.map((x) => basquinStress(x, p.Su, p.Se)) }
  }, [p.Su, p.Se])
  const gm = useMemo(() => {
    const m = Array.from({ length: 80 }, (_, i) => (i / 79) * p.Su)
    return { m, g: m.map((x) => Math.max(0, allowedAmplitude('goodman', p.Se, p.Su, p.Sy, x))), ge: m.map((x) => Math.max(0, allowedAmplitude('gerber', p.Se, p.Su, p.Sy, x))), so: m.map((x) => Math.max(0, allowedAmplitude('soderberg', p.Se, p.Su, p.Sy, x))) }
  }, [p.Su, p.Se, p.Sy])
  const lifeText = life === Infinity ? 'infinite' : eq >= 0.9 * p.Su ? 'under 10³' : fmt(life, 3)
  return (
    <div>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Life" value={lifeText} unit={life === Infinity ? '' : 'cycles'} tone={life === Infinity ? 'accent' : 'warn'} />
          <Readout label="Allowed swing" value={fmt(allowed, 3)} unit="MPa" />
          <Readout label="Safety factor" value={fmt(allowed / Math.max(p.amp, 1e-6), 3)} tone={allowed > p.amp ? 'accent' : 'warn'} />
          <Readout label="Stress ratio R" value={fmt(c.R, 3)} />
          <Readout label="Largest stress" value={fmt(p.mean + p.amp, 3)} unit="MPa" />
          <Readout label="Turns here" value={fmt(turns, 3)} />
        </div>
        <Note>A real test runs at thousands of rpm for days. The dot on the waist goes red in tension and blue in compression, once each turn.</Note>
      </Section>
      <Section title="The test">
        <Slider label="Stress swing, amplitude" value={p.amp} min={0} max={Math.round(p.Su)} step={5} unit="MPa" onChange={(amp) => set({ amp })} />
        <Slider label="Mean stress" value={p.mean} min={0} max={Math.round(p.Su)} step={5} unit="MPa" onChange={(mean) => set({ mean })} />
        <Slider label="Ultimate strength" value={p.Su} min={200} max={1500} step={10} unit="MPa" onChange={(Su) => set({ Su, Se: Math.min(p.Se, Su * 0.7) })} />
        <Slider label="Endurance limit" value={p.Se} min={50} max={p.Su * 0.7} step={5} unit="MPa" onChange={(Se) => set({ Se })} />
        <Slider label="Yield stress" value={p.Sy} min={100} max={p.Su} step={10} unit="MPa" onChange={(Sy) => set({ Sy })} />
        <Slider label="Spin" value={p.rpm} min={5} max={120} step={5} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <div className="mb-1 mt-2 text-[12.5px] font-medium text-ink/90">Mean-stress rule</div>
        <Segmented<MeanLine> value={p.line} onChange={(line) => set({ line })} options={[{ value: 'goodman', label: 'Goodman' }, { value: 'gerber', label: 'Gerber' }, { value: 'soderberg', label: 'Soderberg' }]} />
      </Section>
      <Section title="S–N curve">
        <Chart data={[sn.N.map((x) => Math.log10(x)), sn.S]} series={[{ label: 'S', color: '#e8794f', width: 2 }]} xLabel="log₁₀ cycles to failure" yLabel="Stress amplitude (MPa)" marker={() => [life === Infinity ? 8 : Math.max(3, Math.min(8, Math.log10(life))), Math.min(eq, p.Su)]} height={140} />
        <Note>Below the endurance limit, steels last indefinitely. Aluminium has no such limit, and a stress quoted at a set number of cycles is used instead. The curve is a straight line from 0.9 Su at 10³ cycles to Se at 10⁶, a usual estimate.</Note>
      </Section>
      <Section title="Mean-stress diagram">
        <Chart data={[gm.m, gm.g, gm.ge, gm.so]} series={[{ label: 'Goodman', color: '#e8794f', width: 2 }, { label: 'Gerber', color: '#6fb3e0', width: 1.5 }, { label: 'Soderberg', color: '#9bd17a', width: 1.5 }]} xLabel="Mean stress (MPa)" yLabel="Allowed amplitude (MPa)" marker={() => [p.mean, p.amp]} height={150} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Stress cycle', tex: '\\sigma_a = \\dfrac{\\sigma_{\\max}-\\sigma_{\\min}}{2},\\quad \\sigma_m = \\dfrac{\\sigma_{\\max}+\\sigma_{\\min}}{2}', result: `=${n(c.amplitude, 3)},\\ ${n(c.mean, 3)}\\ \\text{MPa}` },
            { label: 'Goodman line', tex: '\\dfrac{\\sigma_a}{S_e} + \\dfrac{\\sigma_m}{S_u} = 1', result: `\\sigma_a = ${n(allowedAmplitude('goodman', p.Se, p.Su, p.Sy, p.mean), 3)}\\ \\text{MPa}` },
            { label: 'Gerber parabola', tex: '\\dfrac{\\sigma_a}{S_e} + \\left(\\dfrac{\\sigma_m}{S_u}\\right)^2 = 1', result: `\\sigma_a = ${n(allowedAmplitude('gerber', p.Se, p.Su, p.Sy, p.mean), 3)}\\ \\text{MPa}` },
            { label: 'Soderberg line', tex: '\\dfrac{\\sigma_a}{S_e} + \\dfrac{\\sigma_m}{S_y} = 1', result: `\\sigma_a = ${n(allowedAmplitude('soderberg', p.Se, p.Su, p.Sy, p.mean), 3)}\\ \\text{MPa}` },
            { label: 'Damage from mixed cycles, Miner', tex: '\\sum \\dfrac{n_i}{N_i} = 1 \\text{ at failure}', sub: '\\dfrac{10^4}{10^5} + \\dfrac{5\\times10^4}{10^6}', result: `=${n(minerDamage([[1e4, 1e5], [5e4, 1e6]]), 3)}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Fatigue fails parts below their static strength, without warning, starting at a surface or a stress raiser.</li>
          <li>Three stages: crack starts, crack grows, sudden final fracture. Beach marks show the second stage on the break.</li>
          <li>R = σmin/σmax. Fully reversed stress has R = −1 and no mean.</li>
          <li>Polish, shot-peen and avoid sharp corners. A tensile mean stress shortens life.</li>
        </ExamList>
      </Section>
    </div>
  )
}
