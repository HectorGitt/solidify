import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, helixSpring, lathe, mat4, merge, tube, xform } from '@/geometry'
import { TestBench, createRun, instrument, useAutoRun, useRunDriver } from '@/lab/run'
import { rankine, steamDome, steamSat } from '@/physics/plantcycles'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'
import { Dial, Tag, pipeCurve, pipeGeo, type Pt } from '../_shared/plant'

export const FLOOR = -0.72

interface Params {
  /** bar, bar, °C, %, kg/s */
  pb: number
  pc: number
  T: number
  etaT: number
  m: number
  /** how far the boiler has been raised: moved by the test */
  f: number
  set: (q: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { pb: 40, pc: 0.04, T: 400, etaT: 100, m: 10, f: 0 }
export const useSteam = create<Params>((set) => ({ ...DEFAULTS, set: (q) => set(q), reset: () => set(DEFAULTS) }))
const set = (q: Partial<Params>) => useSteam.getState().set(q)

const steamRun = createRun()
const PROCEDURE = { steps: 8, moveSeconds: 0.7, dwellSeconds: 0.3 }

/** the boiler is raised from a fifth of its working pressure */
const pNow = (s: Params, f = s.f) => s.pb * (0.2 + 0.8 * f)
const cycleAt = (s: Params, f = s.f) => rankine({ pb: pNow(s, f), pc: s.pc, T: s.T, etaT: s.etaT / 100 })

const STEAM: Pt[] = [[-0.82, 0.62, 0], [-0.82, 0.72, 0], [-0.1, 0.72, 0], [-0.1, 0.42, 0], [-0.08, 0.3, 0]]
const EXHAUST: Pt[] = [[0.3, 0.02, 0], [0.3, -0.12, 0]]
const CONDENSATE: Pt[] = [[0.1, -0.56, 0.1], [-0.3, -0.56, 0.1]]
const FEED: Pt[] = [[-0.42, -0.5, 0.1], [-0.55, -0.5, 0.1], [-0.55, -0.54, 0.34], [-0.82, -0.54, 0.34], [-0.82, -0.3, 0.2]]

export function Steam3D() {
  const s = useSteam()
  useAutoRun(steamRun, JSON.stringify([s.pb, s.pc, s.T, s.etaT, s.m]))
  useRunDriver(
    steamRun,
    PROCEDURE,
    (f) => {
      if (Math.abs(f - useSteam.getState().f) >= 0.008 || f === 1) useSteam.getState().set({ f })
    },
    (step, f) => {
      const st = useSteam.getState()
      const c = cycleAt(st, f)
      const power = instrument(st.m * c.net, 0.006, step)
      steamRun.getState().log([pNow(st, f), instrument(c.T3, 0.002, step + 20), instrument(c.x4, 0.002, step + 40), power, (power / (st.m * c.qIn)) * 100])
    },
  )
  useEffect(
    () =>
      steamRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle') || (r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useSteam.getState().set({ f: 0 })
      }),
    [],
  )
  const geo = useMemo(() => {
    const across = mat4.rz(Math.PI / 2)
    const casing: [number, number][] = [[0.11, -0.3], [0.2, -0.3], [0.2, -0.28], [0.31, 0.28], [0.31, 0.3], [0.1, 0.3]]
    return {
      base: xform(box(3, 0.04, 1.1), mat4.t(0.15, FLOOR + 0.02, 0)),
      furnace: merge(xform(box(0.62, 0.7, 0.04), mat4.t(-0.82, -0.32, -0.3)), xform(box(0.04, 0.7, 0.62), mat4.t(-1.13, -0.32, 0)), xform(box(0.04, 0.7, 0.62), mat4.t(-0.51, -0.32, 0)), xform(box(0.66, 0.05, 0.62), mat4.t(-0.82, 0.05, 0))),
      stack: xform(tube(0.07, 0.06, 0.62, 30), mat4.t(-1.05, 0.38, -0.2)),
      drum: xform(cylinder(0.17, 0.62, 48), mat4.c(mat4.t(-0.82, 0.4, 0), across)),
      risers: merge(...[-0.98, -0.82, -0.66].map((x) => xform(cylinder(0.018, 0.5, 14), mat4.t(x, -0.08, 0.12)))),
      sight: xform(cylinder(0.014, 0.2, 14), mat4.t(-0.5, 0.42, 0.14)),
      superheater: xform(helixSpring(0.09, 0.012, 0.42, 6, false), mat4.c(mat4.t(-0.82, -0.2, -0.1), across)),
      flame: merge(...[-0.98, -0.82, -0.66].map((x) => xform(lathe([[0.0001, 0], [0.055, 0.03], [0.035, 0.14], [0.0001, 0.26]], 18), mat4.t(x, -0.62, 0)))),
      casing: xform(lathe(casing, 64), mat4.c(mat4.t(0.14, 0.15, 0), mat4.rz(-Math.PI / 2))),
      rotor: merge(xform(cylinder(0.04, 1.28, 28), mat4.c(mat4.t(0.42, 0, 0), across)), ...Array.from({ length: 6 }, (_, i) => xform(cylinder(0.11 + i * 0.027, 0.02, 40), mat4.c(mat4.t(-0.1 + i * 0.1, 0, 0), across)))),
      mark: xform(box(0.012, 0.03, 0.16), mat4.t(0.42, 0.045, 0)),
      generator: xform(cylinder(0.2, 0.42, 48), mat4.c(mat4.t(0.84, 0.15, 0), across)),
      genFeet: xform(box(0.5, 0.74, 0.34), mat4.t(0.84, -0.33, 0)),
      turbineFoot: merge(xform(box(0.06, 0.45, 0.4), mat4.t(-0.12, -0.12, 0)), xform(box(0.06, 0.2, 0.4), mat4.t(0.48, 0.0, -0.1))),
      condenser: xform(tube(0.2, 0.185, 0.72, 56), mat4.c(mat4.t(0.3, -0.32, 0), across)),
      condEnds: merge(...[-0.06, 0.66].map((x) => xform(cylinder(0.205, 0.02, 56), mat4.c(mat4.t(x, -0.32, 0), across)))),
      tubes: merge(...[[0, 0], [0.09, 0], [-0.09, 0], [0.045, 0.08], [-0.045, 0.08], [0.045, -0.08], [-0.045, -0.08]].map(([y, z]) => xform(cylinder(0.018, 0.7, 12), mat4.c(mat4.t(0.3, -0.32 + y, z), across)))),
      water: merge(pipeGeo([[-0.28, -0.32, -0.42], [-0.28, -0.32, 0], [-0.06, -0.32, 0]], 0.03), pipeGeo([[0.66, -0.32, 0], [1.3, -0.32, 0], [1.3, -0.32, -0.42]], 0.03)),
      well: xform(box(0.28, 0.1, 0.2), mat4.t(0.22, -0.56, 0.1)),
      pump: merge(xform(cylinder(0.08, 0.06, 32), mat4.c(mat4.t(-0.36, -0.5, 0.1), mat4.rx(Math.PI / 2))), xform(box(0.14, 0.14, 0.14), mat4.t(-0.36, -0.62, 0.1))),
      impeller: xform(box(0.11, 0.018, 0.018), mat4.t(0, 0, 0)),
      steam: pipeGeo(STEAM, 0.028),
      exhaust: pipeGeo(EXHAUST, 0.05),
      condensate: pipeGeo(CONDENSATE, 0.018),
      feed: pipeGeo(FEED, 0.018),
    }
  }, [])
  const glow = useMemo(() => createDynamicCutMaterial({ color: '#ff8a2b', roughness: 0.8, metalness: 0, emissive: '#ff6a1a', emissiveIntensity: 1.5 }), [])
  const curves = useMemo(() => ({ steam: pipeCurve(STEAM), ex: pipeCurve(EXHAUST), cond: pipeCurve(CONDENSATE), feed: pipeCurve(FEED), cool: pipeCurve([[-0.28, -0.32, -0.42], [-0.28, -0.32, 0], [0.3, -0.32, 0.0], [0.66, -0.32, 0], [1.3, -0.32, 0], [1.3, -0.32, -0.42]]) }), [])
  const rotor = useRef<THREE.Group>(null)
  const imp = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Group>(null)
  const on = () => (steamRun.getState().status === 'idle' ? 0 : 1)
  useSimFrame((dt, t) => {
    const st = useSteam.getState()
    const k = on() * (0.25 + 0.75 * st.f)
    if (rotor.current) rotor.current.rotation.x += dt * 26 * k
    if (imp.current) imp.current.rotation.z += dt * 18 * k
    if (flame.current) flame.current.scale.y = (0.45 + 0.75 * k) * (1 + 0.1 * Math.sin(t * 19) + 0.06 * Math.sin(t * 31))
  })
  const c = cycleAt(s)
  return (
    <group>
      <Part id="base" name="Foundation" role="static" material="concrete" info={{ summary: 'Holds the plant in line.', role: 'The turbine and generator share a shaft, so they must not shift, even as the casing heats up and grows.' }} cut={false}>
        <PartMesh geometry={geo.base} />
        <PartMesh geometry={geo.turbineFoot} material="steelDark" />
      </Part>
      <Part id="furnace" name="Furnace" role="housing" material="paintGrey" info={{ summary: 'Burns the fuel.', role: 'Its heat becomes qᵢₙ = h₃ − h₂. Its front is left open here to show the flames and tubes.' }} cut={false}>
        <PartMesh geometry={geo.furnace} />
        <PartMesh geometry={geo.stack} material="steelDark" />
        <group ref={flame} position={[0, -0.62, 0]}>
          <PartMesh geometry={geo.flame} customMaterial={glow.material} position={[0, 0.62, 0]} />
        </group>
      </Part>
      <Part id="drum" name="Boiler drum and risers" role="static" material="steel" info={{ summary: 'Water boils in the tubes and separates in the drum.', role: 'The pressure here fixes the boiling temperature. The sight glass shows the water level, and the gauge shows the pressure.' }} cut={false}>
        <PartMesh geometry={geo.drum} />
        <PartMesh geometry={geo.risers} material="steelDark" />
        <PartMesh geometry={geo.sight} material="glass" />
        <Dial at={[-0.82, 0.4, 0.18]} share={pNow(s) / 180} />
      </Part>
      <Part id="superheater" name="Superheater" role="static" material="copper" info={{ summary: 'Heats the dry steam above its boiling temperature.', role: 'Superheat means more work per kilogram, and exhaust steam that is drier, which saves the last turbine blades from erosion.' }} cut={false}>
        <PartMesh geometry={geo.superheater} />
      </Part>
      <Part id="turbine" name="Turbine casing" role="housing" material="steel" info={{ summary: 'Contains the steam as it expands.', role: 'It grows toward the exhaust because steam’s volume grows enormously as its pressure falls.' }}>
        <PartMesh geometry={geo.casing} />
      </Part>
      <group position={[0, 0.15, 0]} ref={rotor}>
        <Part id="rotor" name="Rotor and shaft" role="moving" material="steelDark" info={{ summary: 'Turns the steam’s drop in enthalpy into shaft work.', role: 'Stages grow along the shaft to pass the swelling volume of steam. Work out is h₃ − h₄ per kilogram.' }}>
          <PartMesh geometry={geo.rotor} />
          <PartMesh geometry={geo.mark} material="paintRed" />
        </Part>
      </group>
      <Part id="generator" name="Generator" role="static" material="paintBlue" info={{ summary: 'Turns shaft power into electricity.', role: 'The load on it sets how much steam the governor lets through.' }} cut={false}>
        <PartMesh geometry={geo.generator} />
        <PartMesh geometry={geo.genFeet} material="steelDark" />
      </Part>
      <Part id="condenser" name="Condenser" role="housing" material="steel" info={{ summary: 'Turns the exhaust back to water, under a strong vacuum.', role: 'Its low pressure gives a low saturation temperature, so the turbine expands further. Most of the fuel’s heat leaves here, in the cooling water.' }}>
        <PartMesh geometry={geo.condenser} />
        <PartMesh geometry={geo.condEnds} material="steelDark" />
        <PartMesh geometry={geo.tubes} material="copper" />
        <PartMesh geometry={geo.well} material="steelDark" />
      </Part>
      <Part id="pump" name="Feed pump" role="moving" material="paintGreen" info={{ summary: 'Returns the water to the boiler, against its full pressure.', role: 'A very small work, because water is almost incompressible: v(p₂ − p₁). This is the great advantage of condensing before pumping.' }} cut={false}>
        <PartMesh geometry={geo.pump} />
        <group position={[-0.36, -0.5, 0.135]} ref={imp}>
          <PartMesh geometry={geo.impeller} material="paintRed" />
        </group>
      </Part>
      <Part id="lines" name="Steam and water lines" role="static" material="galvanised" info={{ summary: 'Close the loop.', role: 'The same water goes round again and again, so it can be kept very pure. Only the cooling water and the fuel are used up.' }} cut={false}>
        <PartMesh geometry={geo.steam} material="steelMatte" />
        <PartMesh geometry={geo.exhaust} material="steelMatte" />
        <PartMesh geometry={geo.condensate} />
        <PartMesh geometry={geo.feed} />
        <PartMesh geometry={geo.water} material="paintBlue" />
      </Part>
      <Flow curve={curves.steam} count={36} radius={0.024} color="#e0442a" speed={0.7} spread={0.002} intensity={on} />
      <Flow curve={curves.ex} count={10} radius={0.03} color="#c9d6df" speed={0.8} spread={0.01} intensity={on} />
      <Flow curve={curves.cond} count={12} radius={0.015} color="#3a8be0" speed={0.5} spread={0.002} intensity={on} />
      <Flow curve={curves.feed} count={24} radius={0.015} color="#2f6fd0" speed={0.5} spread={0.002} intensity={on} />
      <Flow curve={curves.cool} count={50} radius={0.02} color="#7fd0e8" speed={0.35} spread={0.004} intensity={on} />
      <Tag at={[-0.82, 0.86, 0.1]} tone="#c0391f">{`${pNow(s).toFixed(1)} bar · ${c.T3.toFixed(0)} °C`}</Tag>
      <Tag at={[0.3, -0.06, 0.34]}>{`dryness ${c.x4.toFixed(3)}`}</Tag>
      <Tag at={[0.84, 0.44, 0]} tone="#2d7a1f">{`${((s.m * c.net * (on() ? 1 : 0)) / 1000).toFixed(2)} MW`}</Tag>
      <Tag at={[0.3, -0.62, 0.34]} tone="#2267b5">{`${s.pc} bar · ${c.cond.T.toFixed(0)} °C`}</Tag>
      <PartLabel partId="superheater" at={[-0.82, -0.05, 0.3]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'std', label: 'Plain plant', note: '40 bar, 400 °C, to 0.04 bar, ideal turbine: dryness about 0.79, efficiency about 37 %.', apply: () => set({ ...DEFAULTS }) },
  { id: 'real', label: 'A real turbine', note: 'The same plant at 85 % turbine efficiency. Less work, and the friction reheats the steam, so the exhaust is drier.', apply: () => set({ ...DEFAULTS, etaT: 85 }) },
  { id: 'high', label: 'Higher pressure', note: '100 bar at the same 400 °C: more efficient, but the exhaust gets too wet for the last blades. Keep dryness above about 0.88.', apply: () => set({ ...DEFAULTS, pb: 100 }) },
  { id: 'super', label: 'More superheat', note: '100 bar and 560 °C: better efficiency and drier exhaust together. The limit is what the metal can stand.', apply: () => set({ ...DEFAULTS, pb: 100, T: 560 }) },
  { id: 'vac', label: 'Poor vacuum', note: 'Condenser at 0.2 bar: the turbine cannot expand as far, and a large share of the work is lost.', apply: () => set({ ...DEFAULTS, pc: 0.2 }) },
]

/** The cycle on temperature against entropy, with the saturation dome behind it. */
function TsDiagram({ s }: { s: Params }) {
  const c = cycleAt(s)
  const dome = useMemo(steamDome, [])
  const W = 300
  const H = 150
  const X = (v: number) => 28 + (v / 9.2) * (W - 34)
  const Y = (v: number) => H - 18 - (v / 650) * (H - 26)
  const dry = (p: number) => {
    const q = steamSat(p)
    return [q.sf, q.sg, q.T] as const
  }
  const [sf1, , T1] = dry(s.pc)
  const [sfB, sgB, TB] = dry(pNow(s))
  const s4 = sf1 + (c.xIdeal * (steamSat(s.pc).sg - sf1))
  const s4real = sf1 + c.x4 * (steamSat(s.pc).sg - sf1)
  const path: [number, number][] = [[sf1, T1], [sfB, TB], [sgB, TB], [c.s3, c.T3], [s4real, T1], [sf1, T1]]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label="Temperature against entropy for the cycle">
      <line x1={28} y1={H - 18} x2={W - 4} y2={H - 18} stroke="currentColor" opacity={0.4} />
      <line x1={28} y1={6} x2={28} y2={H - 18} stroke="currentColor" opacity={0.4} />
      <text x={W / 2} y={H - 4} fontSize={9} fill="currentColor" textAnchor="middle">Entropy (kJ/kg K)</text>
      <text x={10} y={H / 2} fontSize={9} fill="currentColor" textAnchor="middle" transform={`rotate(-90 10 ${H / 2})`}>T (°C)</text>
      <polyline fill="none" stroke="#6fb3e0" strokeWidth={1.5} points={dome.s.map((v, i) => `${X(v)},${Y(dome.T[i])}`).join(' ')} />
      <polyline fill="none" stroke="#e8794f" strokeWidth={2} points={path.map(([a, b]) => `${X(a)},${Y(b)}`).join(' ')} />
      {s.etaT < 100 ? <line x1={X(c.s3)} y1={Y(c.T3)} x2={X(s4)} y2={Y(T1)} stroke="#e8794f" strokeDasharray="3 3" opacity={0.6} /> : null}
    </svg>
  )
}

/** The bench test: bring the boiler up to pressure and read the plant at each step. */
function SteamTest() {
  const rows = steamRun((q) => q.rows)
  const status = steamRun((q) => q.status)
  const last = rows[rows.length - 1]
  return (
    <TestBench run={steamRun} steps={PROCEDURE.steps} title="The test: raise the boiler" head={['Boiler (bar)', 'Steam (°C)', 'Dryness', 'Power (kW)', 'Eff. (%)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3), fmt(r[3], 4), fmt(r[4], 3)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[rows.map((r) => r[0]), rows.map((r) => r[4])]} series={[{ label: 'Efficiency', color: '#e8794f', width: 2 }]} xLabel="Boiler pressure (bar)" yLabel="Efficiency (%)" height={110} />
          {status === 'done' && last ? (
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              <Readout label="Efficiency found" value={fmt(last[4], 3)} unit="%" tone="accent" />
              <Readout label="Exhaust dryness" value={fmt(last[2], 3)} tone={last[2] < 0.88 ? 'warn' : 'info'} />
              <Readout label="Power" value={fmt(last[3] / 1000, 3)} unit="MW" />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function SteamPanel() {
  const s = useSteam()
  const [preset, setPreset] = useState<string | null>('std')
  const c = cycleAt(s)
  return (
    <div>
      <SteamTest />
      <Section title="Live">
        <TsDiagram s={s} />
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          <Readout label="Turbine" value={fmt(c.turbine, 4)} unit="kJ/kg" tone="accent" />
          <Readout label="Pump" value={fmt(c.pump, 3)} unit="kJ/kg" />
          <Readout label="Heat in" value={fmt(c.qIn, 4)} unit="kJ/kg" tone="warn" />
          <Readout label="Efficiency" value={fmt(c.efficiency * 100, 3)} unit="%" tone="accent" />
          <Readout label="Carnot limit" value={fmt(c.carnot * 100, 3)} unit="%" />
          <Readout label="Work ratio" value={fmt(c.workRatio, 3)} />
          <Readout label="Steam rate" value={fmt(c.steamRate, 3)} unit="kg/kWh" />
          <Readout label="Exhaust dryness" value={fmt(c.x4, 3)} tone={c.x4 < 0.88 ? 'warn' : 'info'} />
          <Readout label="Net power" value={fmt((s.m * c.net) / 1000, 3)} unit="MW" />
        </div>
        {c.x4 < 0.88 ? <Note tone="warn">Exhaust this wet erodes the last stage of blades. Superheat further, or reheat part-way through the expansion.</Note> : null}
      </Section>
      <Section title="The plant">
        <Slider label="Boiler pressure" value={s.pb} min={5} max={170} step={1} unit="bar" onChange={(pb) => set({ pb })} />
        <Slider label="Steam temperature" value={s.T} min={200} max={600} step={5} unit="°C" onChange={(T) => set({ T })} />
        <Slider label="Condenser pressure" value={s.pc} min={0.04} max={1} step={0.01} unit="bar" onChange={(pc) => set({ pc })} />
        <Slider label="Turbine efficiency" value={s.etaT} min={60} max={100} step={1} unit="%" onChange={(etaT) => set({ etaT })} />
        <Slider label="Steam flow" value={s.m} min={1} max={100} step={1} unit="kg/s" onChange={(m) => set({ m })} />
        {s.T <= steamSat(s.pb).T ? <Note tone="warn">{`${s.T} °C is below boiling at ${s.pb} bar, so this plant runs on dry saturated steam at ${steamSat(s.pb).T.toFixed(0)} °C.`}</Note> : null}
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Leaving the condenser', tex: 'h_1 = h_f', result: `=${n(c.h1, 4)}\\ \\text{kJ/kg}` },
            { label: 'Pump work', tex: 'w_p = v_f(p_2 - p_1)', result: `=${n(c.pump, 3)}\\ \\text{kJ/kg}` },
            { label: 'Leaving the superheater', tex: 'h_3', result: `=${n(c.h3, 5)}\\ \\text{kJ/kg}` },
            { label: 'Ideal dryness at exhaust', tex: 's_3 = s_f + x\\,s_{fg}', result: `x = ${n(c.xIdeal, 3)}` },
            { label: 'Turbine work', tex: 'w_t = \\eta_t (h_3 - h_{4s})', result: `=${n(c.turbine, 4)}\\ \\text{kJ/kg}` },
            { label: 'Heat in', tex: 'q = h_3 - h_2', result: `=${n(c.qIn, 4)}\\ \\text{kJ/kg}` },
            { label: 'Efficiency', tex: '\\eta = \\dfrac{w_t - w_p}{q}', result: `=${n(c.efficiency * 100, 3)}\\ \\%` },
            { label: 'Specific steam consumption', tex: '\\dfrac{3600}{w_{net}}', result: `=${n(c.steamRate, 3)}\\ \\text{kg/kWh}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Four parts: boiler (heat in, constant pressure), turbine (work out), condenser (heat out), feed pump (small work in).</li>
          <li>Pumping water takes far less work than compressing steam would: that is why the work ratio is near 1 and the condenser is worth having.</li>
          <li>Efficiency rises with boiler pressure, superheat and condenser vacuum. Pressure alone wets the exhaust; superheat dries it.</li>
          <li>Steam tables give hf and hg against pressure. Find x from the entropy, then h = hf + x hfg.</li>
        </ExamList>
      </Section>
    </div>
  )
}
