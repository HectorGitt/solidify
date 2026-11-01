import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { creepStrain, larsonMiller, larsonMillerLife } from '@/physics/strength'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'

export const FLOOR = -0.82

interface Params {
  /** MPa, °C */
  sigma: number
  T: number
  running: boolean
  /** seconds on screen for a whole test */
  duration: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { sigma: 120, T: 550, running: true, duration: 24 }
export const useCreep = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useCreep.getState().set(p)
const live = { u: 0, broke: false }

/**
 * A representative low-alloy steel: its life from a Larson–Miller line, P = T(20 + log t), with P falling as
 * stress rises. The strain rate is set so the steady stage is typical. Values are illustrative.
 */
export function creepModel(sigma: number, Tc: number) {
  const T = Tc + 273.15
  const P = 26000 - 32 * sigma * 1
  const tR = Math.max(0.2, Math.min(1e7, larsonMillerLife(P, T)))
  const elastic = (sigma * 1e6) / 180e9
  // a fixed share of the rupture strain in the steady stage, so that a shorter life means a higher rate
  const rate = 0.12 / tR
  return { T, P, tR, elastic, rate, primary: 0.012, tau: tR * 0.05 }
}

const strainAt = (m: ReturnType<typeof creepModel>, t: number) => creepStrain(m.elastic, m.primary, m.tau, m.rate, t, m.tR)

export function Creep3D() {
  const p = useCreep()
  const m = useMemo(() => creepModel(p.sigma, p.T), [p.sigma, p.T])
  const u = useRef(0)
  const weights = useRef<THREE.Group>(null)
  const lever = useRef<THREE.Group>(null)
  const piece = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  const last = useRef(`${p.sigma}/${p.T}`)
  const geo = useMemo(
    () => ({
      col: merge(...[-0.48, 0.48].map((x) => xform(cylinder(0.03, 1.6, 22), mat4.t(x, 0, 0)))),
      top: xform(box(1.12, 0.1, 0.24), mat4.t(0, 0.74, 0)),
      base: xform(box(1.2, 0.08, 0.5), mat4.t(0, FLOOR + 0.04, 0)),
      furnace: tube(0.21, 0.14, 0.62, 56),
      furnaceCut: xform(tube(0.14, 0.135, 0.6, 48), mat4.t(0, 0, 0)),
      rodTop: xform(cylinder(0.014, 0.42, 16), mat4.t(0, 0.53, 0)),
      rodBelow: xform(cylinder(0.014, 0.42, 16), mat4.t(0, -0.21, 0)),
      piece: cylinder(0.018, 1, 22),
      pan: merge(xform(box(0.2, 0.02, 0.2), mat4.t(0, -0.42, 0))),
      disc: (i: number) => xform(cylinder(0.09, 0.03, 32), mat4.t(0, -0.45 - i * 0.032, 0)),
    }),
    [],
  )
  const stack = useMemo(() => merge(...Array.from({ length: Math.max(1, Math.round(p.sigma / 40)) }, (_, i) => geo.disc(i))), [p.sigma, geo])

  useSimFrame((dt) => {
    const s = useCreep.getState()
    const key = `${s.sigma}/${s.T}`
    if (key !== last.current) {
      last.current = key
      u.current = 0
      live.broke = false
    }
    if (s.running && !live.broke) u.current = Math.min(1, u.current + dt / s.duration)
    if (u.current >= 1) live.broke = true
    live.u = u.current
    const e = strainAt(m, u.current * m.tR)
    const len = 0.36 * (1 + Math.min(1.5, e * 2.2))
    const top = 0.32
    if (piece.current) {
      piece.current.position.y = top - len / 2
      piece.current.scale.set(1 / Math.sqrt(1 + e * 2.2), len, 1 / Math.sqrt(1 + e * 2.2))
      piece.current.visible = !live.broke
    }
    weights.current?.position.set(0, top - len - (live.broke ? 0.06 : 0), 0)
    if (glow.current) glow.current.opacity = Math.max(0.05, Math.min(0.45, (s.T - 200) / 1100))
  })

  return (
    <group>
      <Part id="frame" name="Creep frame" role="static" material="paintGrey" info={{ summary: 'Holds the specimen up, for months if need be.', role: 'A dead load never lets up, which is why it is the right way to apply a steady stress over a long test.' }} cut={false} explode={[0, 0, -0.3]}>
        <PartMesh geometry={geo.col} material="chrome" />
        <PartMesh geometry={geo.top} />
        <PartMesh geometry={geo.base} />
        <PartMesh geometry={geo.rodTop} material="steelDark" />
      </Part>
      <group position={[0, 0.14, 0]}>
        <Part id="furnace" name="Furnace" role="housing" material="ceramic" info={{ summary: 'Holds the specimen at a steady temperature.', role: 'Creep matters above about 0.4 of the melting point in kelvin. A few degrees’ error changes the life greatly, so control is tight.' }} xray>
          <PartMesh geometry={geo.furnace} />
        </Part>
        <mesh geometry={geo.furnaceCut}>
          <meshBasicMaterial ref={glow} color="#e8561c" transparent opacity={0.3} side={THREE.BackSide} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <Part id="specimen" name="Specimen" role="moving" material="steel" info={{ summary: 'Under a constant load, at a high temperature.', role: 'It slowly stretches even though the stress is well below yield: the metal flows, as atoms diffuse and dislocations climb.' }} cut={false}>
        <mesh ref={piece} geometry={geo.piece} castShadow>
          <meshStandardMaterial color="#c8733a" metalness={0.5} roughness={0.45} />
        </mesh>
      </Part>
      <group ref={weights}>
        <Part id="weights" name="Dead weights" role="moving" material="castIron" info={{ summary: 'Set the load.', role: 'They sink slowly as the specimen creeps. A dial gauge on the rod reads the strain.' }} cut={false}>
          <PartMesh geometry={geo.rodBelow} material="steelDark" />
          <PartMesh geometry={geo.pan} material="steelDark" />
          <PartMesh geometry={stack} />
        </Part>
      </group>
      <group ref={lever} />
      <PartLabel partId="furnace" at={[0.24, 0.3, 0.05]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'std', label: 'Steady service', note: 'A moderate stress and temperature: long primary and secondary stages.', apply: () => set({ ...DEFAULTS }) },
  { id: 'hot', label: '50 °C hotter', note: 'The stress is the same, but life falls many times: temperature is the strongest control on creep.', apply: () => set({ ...DEFAULTS, T: 600 }) },
  { id: 'load', label: 'More stress', note: 'The tertiary stage arrives far sooner, as the necking specimen carries a rising true stress.', apply: () => set({ ...DEFAULTS, sigma: 200 }) },
]

export function CreepPanel() {
  const p = useCreep()
  const [preset, setPreset] = useState<string | null>('std')
  const m = useMemo(() => creepModel(p.sigma, p.T), [p.sigma, p.T])
  const u = useLive(() => live.u, 12)
  const t = u * m.tR
  const e = strainAt(m, t)
  const curve = useMemo(() => {
    const ts = Array.from({ length: 200 }, (_, i) => (i / 199) * m.tR)
    return { hours: ts, e: ts.map((x) => strainAt(m, x) * 100) }
  }, [m])
  const stage = u < 0.08 ? 'primary' : u < 0.75 ? 'secondary' : u < 1 ? 'tertiary' : 'ruptured'
  const lives = useMemo(() => {
    const T = Array.from({ length: 80 }, (_, i) => 400 + i * 4)
    return { T, l: T.map((x) => Math.log10(Math.max(0.1, creepModel(p.sigma, x).tR))) }
  }, [p.sigma])
  return (
    <div>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Time" value={fmt(t, 3)} unit="h" />
          <Readout label="Strain" value={fmt(e * 100, 3)} unit="%" tone="accent" />
          <Readout label="Stage" value={stage} tone={stage === 'ruptured' || stage === 'tertiary' ? 'warn' : 'info'} />
          <Readout label="Life" value={fmt(m.tR, 3)} unit="h" tone="warn" />
          <Readout label="Steady rate" value={fmt(m.rate * 100, 3)} unit="%/h" />
          <Readout label="L–M parameter" value={fmt(larsonMiller(m.T, m.tR), 4)} />
        </div>
        <Note>The test’s months are compressed into seconds. The steel’s numbers are representative, set by a Larson–Miller line: use real data for a real design.</Note>
      </Section>
      <Section title="The test">
        <Slider label="Stress" value={p.sigma} min={20} max={320} step={5} unit="MPa" onChange={(sigma) => set({ sigma })} />
        <Slider label="Temperature" value={p.T} min={400} max={700} step={5} unit="°C" onChange={(T) => set({ T })} />
        <Toggle label="Running" checked={p.running} onChange={(running) => set({ running })} />
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Creep curve">
        <Chart data={[curve.hours, curve.e]} series={[{ label: 'Strain', color: '#e8794f', width: 2 }]} xLabel="Time (hours)" yLabel="Strain (%)" marker={() => { const q = live.u * m.tR; return [q, strainAt(m, q) * 100] }} height={150} />
        <Note>Primary: the rate falls as the metal hardens. Secondary: a long steady rate, used for design. Tertiary: the rate climbs as voids and necking set in, ending in rupture.</Note>
      </Section>
      <Section title="Life against temperature">
        <Chart data={[lives.T, lives.l]} series={[{ label: 'Life', color: '#6fb3e0', width: 2 }]} xLabel="Temperature (°C)" yLabel="log₁₀ hours to rupture" marker={() => [p.T, Math.log10(Math.max(0.1, m.tR))]} height={135} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Steady creep rate, Norton’s law', tex: '\\dot\\varepsilon = A\\sigma^n e^{-Q/RT}' },
            { label: 'Larson–Miller parameter', tex: 'P = T(C + \\log_{10} t),\\quad C \\approx 20', sub: `=${n(m.T, 4)}(20 + \\log_{10}${n(m.tR, 3)})`, result: `=${n(larsonMiller(m.T, m.tR), 5)}` },
            { label: 'Life at another temperature, the same stress', tex: '\\log_{10} t_2 = \\dfrac{T_1}{T_2}(C + \\log_{10} t_1) - C', sub: `T_2 = ${n(m.T + 50, 4)}\\ \\text{K}`, result: `t_2 = ${n(larsonMillerLife(larsonMiller(m.T, m.tR), m.T + 50), 3)}\\ \\text{h}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Creep is slow permanent strain under constant stress at high temperature. It matters above about 0.4 of the melting point in kelvin.</li>
          <li>Use it in design for turbine blades, boilers and steam pipes, sized on the steady rate or rupture life.</li>
          <li>Larson–Miller trades temperature for time: short hot tests predict long cooler lives.</li>
        </ExamList>
      </Section>
    </div>
  )
}
