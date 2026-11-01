import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, helixSpring, mat4, merge, xform } from '@/geometry'
import { TestBench, createRun, instrument, useAutoRun, useRunDriver } from '@/lab/run'
import { AMMONIA, R134A } from '@/physics/fluidtables'
import { refrigeration } from '@/physics/plantcycles'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'
import { Dial, Tag, pipeCurve, pipeGeo, type Pt } from '../_shared/plant'

export const FLOOR = -0.72
type Fluid = 'ammonia' | 'r134a'
const TABLE = { ammonia: AMMONIA, r134a: R134A }
/** a ton of refrigeration, kW */
const TON = 3.517

interface Params {
  fluid: Fluid
  /** °C: the evaporator's target, and the condenser */
  Te: number
  Tc: number
  /** kg/min */
  m: number
  wet: boolean
  /** how far the pull-down has got: moved by the test */
  f: number
  set: (q: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { fluid: 'ammonia' as Fluid, Te: -15, Tc: 30, m: 3, wet: true, f: 0 }
export const useFridge = create<Params>((set) => ({ ...DEFAULTS, set: (q) => set(q), reset: () => set(DEFAULTS) }))
const set = (q: Partial<Params>) => useFridge.getState().set(q)

const fridgeRun = createRun()
const PROCEDURE = { steps: 10, moveSeconds: 0.6, dwellSeconds: 0.3 }

/** the evaporator starts just under the condenser's temperature and is pulled down to its target */
const startTe = (p: Params) => Math.min(p.Tc - 5, 15)
const TeNow = (p: Params, f = p.f) => startTe(p) + (Math.min(p.Te, startTe(p)) - startTe(p)) * f
const cycleAt = (p: Params, f = p.f) => refrigeration(TABLE[p.fluid], TeNow(p, f), p.Tc, p.wet)

// the circuit: compressor out, along the top through the condenser, down to the valve, into the cold room, back to the compressor
const DISCHARGE: Pt[] = [[0.1, -0.28, 0], [0.1, 0.02, 0], [0.62, 0.02, 0], [0.62, 0.1, 0]]
const LIQUID: Pt[] = [[1.12, -0.1, 0], [1.12, -0.5, 0.28], [0.32, -0.5, 0.28], [-0.1, -0.5, 0.28], [-0.1, 0.55, 0.28], [-0.2, 0.55, 0.28]]
const WET: Pt[] = [[-0.3, 0.55, 0.28], [-0.5, 0.55, 0.28], [-0.5, 0.48, 0.1]]
const SUCTION: Pt[] = [[-0.5, 0.1, 0.1], [-0.1, -0.05, -0.28], [-0.1, -0.42, -0.28], [0.02, -0.42, -0.1]]

export function Fridge3D() {
  const p = useFridge()
  useAutoRun(fridgeRun, JSON.stringify([p.fluid, p.Te, p.Tc, p.m, p.wet]))
  useRunDriver(
    fridgeRun,
    PROCEDURE,
    (f) => {
      if (Math.abs(f - useFridge.getState().f) >= 0.008 || f === 1) useFridge.getState().set({ f })
    },
    (step, f) => {
      const st = useFridge.getState()
      const c = cycleAt(st, f)
      fridgeRun.getState().log([TeNow(st, f), instrument(c.lo.p, 0.005, step), instrument(c.hi.p, 0.003, step + 20), instrument(c.effect, 0.004, step + 40), instrument(c.work, 0.008, step + 60), 0])
      const rows = fridgeRun.getState().rows
      const last = rows[rows.length - 1]
      last[5] = last[3] / last[4]
    },
  )
  useEffect(
    () =>
      fridgeRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle') || (r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useFridge.getState().set({ f: 0 })
      }),
    [],
  )
  const geo = useMemo(() => {
    const flat = mat4.rx(Math.PI / 2)
    const fins = (n: number, x0: number, dx: number, w: number, h: number, d: number, y: number, z: number) => merge(...Array.from({ length: n }, (_, i) => xform(box(w, h, d), mat4.t(x0 + i * dx, y, z))))
    return {
      base: xform(box(2.5, 0.04, 1), mat4.t(0.15, FLOOR + 0.02, 0)),
      room: merge(xform(box(0.84, 1.1, 0.04), mat4.t(-0.68, 0.05, -0.28)), xform(box(0.84, 0.04, 0.6), mat4.t(-0.68, -0.48, 0)), xform(box(0.84, 0.04, 0.6), mat4.t(-0.68, 0.58, 0)), xform(box(0.04, 1.1, 0.6), mat4.t(-1.08, 0.05, 0)), xform(box(0.04, 1.1, 0.6), mat4.t(-0.28, 0.05, 0))),
      legs: merge(...[-0.98, -0.38].flatMap((x) => [-0.2, 0.2].map((z) => xform(box(0.05, 0.21, 0.05), mat4.t(x, -0.6, z))))),
      crates: merge(xform(box(0.28, 0.2, 0.28), mat4.t(-0.82, -0.36, 0)), xform(box(0.28, 0.2, 0.28), mat4.t(-0.52, -0.36, 0)), xform(box(0.24, 0.16, 0.24), mat4.t(-0.68, -0.18, 0))),
      evapCoil: xform(helixSpring(0.085, 0.012, 0.5, 7, false), mat4.c(mat4.t(-0.68, 0.28, 0.1), mat4.rz(Math.PI / 2))),
      evapFins: fins(13, -0.92, 0.04, 0.006, 0.24, 0.24, 0.28, 0.1),
      compressor: merge(xform(cylinder(0.17, 0.3, 48), mat4.t(0.05, -0.47, 0)), xform(cylinder(0.14, 0.04, 40), mat4.t(0.05, -0.3, 0)), xform(box(0.5, 0.04, 0.34), mat4.t(0.05, -0.64, 0))),
      flywheel: xform(cylinder(0.11, 0.03, 40), flat),
      spoke: xform(box(0.2, 0.025, 0.035), mat4.t(0, 0, 0)),
      condCoil: xform(helixSpring(0.085, 0.012, 0.56, 8, false), mat4.c(mat4.t(0.88, 0.1, 0), mat4.rz(Math.PI / 2))),
      condFins: fins(15, 0.6, 0.04, 0.006, 0.28, 0.28, 0.1, 0),
      condFrame: merge(xform(box(0.04, 0.82, 0.04), mat4.t(0.58, -0.31, 0.16)), xform(box(0.04, 0.82, 0.04), mat4.t(0.58, -0.31, -0.16)), xform(box(0.04, 0.82, 0.04), mat4.t(1.18, -0.31, 0.16)), xform(box(0.04, 0.82, 0.04), mat4.t(1.18, -0.31, -0.16))),
      blade: merge(...[0, 1, 2].map((i) => xform(box(0.2, 0.04, 0.008), mat4.c(mat4.ry(0), mat4.rz((i * 2 * Math.PI) / 3), mat4.t(0.1, 0, 0))))),
      receiver: xform(cylinder(0.055, 0.34, 28), mat4.c(mat4.t(0.7, -0.5, 0.28), mat4.rz(Math.PI / 2))),
      valve: merge(xform(box(0.1, 0.09, 0.09), mat4.t(-0.25, 0.55, 0.28)), xform(cylinder(0.018, 0.09, 12), mat4.t(-0.25, 0.63, 0.28)), xform(cylinder(0.04, 0.012, 20), mat4.t(-0.25, 0.68, 0.28))),
      discharge: pipeGeo(DISCHARGE),
      liquid: pipeGeo(LIQUID),
      wet: pipeGeo(WET),
      suction: pipeGeo(SUCTION),
    }
  }, [])
  const frost = useMemo(() => createDynamicCutMaterial({ color: '#b9c0c4', roughness: 0.6, metalness: 0.2 }), [])
  const curves = useMemo(() => ({ d: pipeCurve(DISCHARGE), l: pipeCurve(LIQUID), w: pipeCurve(WET), s: pipeCurve(SUCTION) }), [])
  const fly = useRef<THREE.Group>(null)
  const fans = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const white = useMemo(() => new THREE.Color('#f4f8fb'), [])
  const bare = useMemo(() => new THREE.Color('#b9c0c4'), [])
  const running = () => (fridgeRun.getState().status === 'idle' ? 0 : 1)
  useSimFrame((dt) => {
    const k = running()
    if (fly.current) fly.current.rotation.z -= dt * 16 * k
    for (const q of fans) if (q.current) q.current.rotation.x += dt * 12 * k
    // frost builds as the coil falls below freezing
    const T = TeNow(useFridge.getState())
    frost.material.color.copy(bare).lerp(white, Math.max(0, Math.min(1, -T / 12)))
    frost.capColor.copy(frost.material.color)
  })
  const c = cycleAt(p)
  const roomT = TeNow(p) + 8
  const top = TABLE[p.fluid].sat[TABLE[p.fluid].sat.length - 1][1]
  return (
    <group>
      <Part id="base" name="Bedplate" role="static" material="paintGrey" info={{ summary: 'Carries the whole plant.', role: 'Compressors shake: it is usually mounted on anti-vibration feet, with flexible lines at the compressor.' }} cut={false}>
        <PartMesh geometry={geo.base} />
        <PartMesh geometry={geo.legs} material="steelDark" />
        <PartMesh geometry={geo.condFrame} material="steelDark" />
      </Part>
      <Part id="room" name="Cold room" role="housing" material="paintBlue" info={{ summary: 'The insulated space being cooled.', role: 'The load is what leaks through its walls, plus what is stored inside as it cools. Its front is open here so that the coil can be seen.' }} cut={false}>
        <PartMesh geometry={geo.room} />
        <PartMesh geometry={geo.crates} material="wood" />
      </Part>
      <Part id="evaporator" name="Evaporator" role="static" material="copper" info={{ summary: 'Refrigerant boils here at low pressure.', role: 'It takes its latent heat from the room: this is the refrigerating effect, h₁ − h₄. Below 0 °C the fins frost over, and frost insulates, so they need defrosting.' }} cut={false}>
        <PartMesh geometry={geo.evapCoil} />
        <PartMesh geometry={geo.evapFins} customMaterial={frost.material} />
      </Part>
      <Part id="compressor" name="Compressor" role="moving" material="paintBlack" info={{ summary: 'Raises the vapour’s pressure, and so its saturation temperature.', role: 'This is the work put in, h₂ − h₁. The pressure lift must put the condensing temperature above the air or water that will cool it.' }} cut={false}>
        <PartMesh geometry={geo.compressor} />
        <group position={[0.05, -0.47, 0.2]} ref={fly}>
          <PartMesh geometry={geo.flywheel} material="steelDark" />
          <PartMesh geometry={geo.spoke} position={[0, 0, 0.022]} material="paintRed" />
        </group>
      </Part>
      <Part id="condenser" name="Condenser" role="static" material="copper" info={{ summary: 'Hot vapour gives up its heat and condenses.', role: 'It rejects the room’s heat and the compressor’s work together: h₂ − h₃ = effect + work.' }} cut={false}>
        <PartMesh geometry={geo.condCoil} />
        <PartMesh geometry={geo.condFins} material="aluminium" />
        <group position={[0.54, 0.1, 0]} ref={fans[0]}>
          <group rotation={[0, Math.PI / 2, 0]}>
            <PartMesh geometry={geo.blade} material="steelDark" />
          </group>
        </group>
      </Part>
      <Part id="receiver" name="Receiver" role="static" material="steel" info={{ summary: 'Stores the condensed liquid.', role: 'It keeps a steady supply of liquid available for the expansion valve, whatever the load.' }} cut={false}>
        <PartMesh geometry={geo.receiver} />
      </Part>
      <Part id="valve" name="Expansion valve" role="static" material="brass" info={{ summary: 'Drops the pressure, with no work and no heat.', role: 'A throttle: enthalpy is the same each side, h₃ = h₄. Some liquid flashes to vapour, which cools the rest to evaporator temperature.' }} cut={false}>
        <PartMesh geometry={geo.valve} />
      </Part>
      <Part id="lines" name="Refrigerant lines" role="static" material="copper" info={{ summary: 'High pressure from the compressor to the valve; low pressure from the valve back again.', role: 'Hot discharge, warm liquid, cold wet mixture and cool suction vapour: the four legs of the cycle.' }} cut={false}>
        <PartMesh geometry={geo.discharge} />
        <PartMesh geometry={geo.liquid} />
        <PartMesh geometry={geo.wet} />
        <PartMesh geometry={geo.suction} />
      </Part>
      <Flow curve={curves.d} count={22} radius={0.02} color="#e0442a" speed={0.7} spread={0.002} intensity={running} />
      <Flow curve={curves.l} count={50} radius={0.018} color="#f0a13c" speed={0.3} spread={0.002} intensity={running} />
      <Flow curve={curves.w} count={12} radius={0.02} color="#3a8be0" speed={0.8} spread={0.002} intensity={running} />
      <Flow curve={curves.s} count={22} radius={0.02} color="#8fc7f5" speed={0.7} spread={0.002} intensity={running} />
      <Part id="gauges" name="Pressure gauges" role="static" material="steelDark" info={{ summary: 'Low side and high side.', role: 'A service engineer’s first reading. Each pressure fixes a saturation temperature, which tells you the evaporator and condenser temperatures directly.' }} cut={false}>
        <Dial at={[0.3, -0.12, 0.05]} share={c.lo.p / Math.max(1, c.hi.p)} />
        <Dial at={[0.48, -0.12, 0.05]} share={c.hi.p / top} />
      </Part>
      <Tag at={[0.3, 0.0, 0.05]} tone="#2267b5">{`${c.lo.p.toFixed(2)} bar`}</Tag>
      <Tag at={[0.48, -0.24, 0.05]} tone="#c0391f">{`${c.hi.p.toFixed(1)} bar`}</Tag>
      <Tag at={[-0.68, 0.72, 0]}>{`room ${roomT.toFixed(1)} °C · coil ${TeNow(p).toFixed(1)} °C`}</Tag>
      <Tag at={[0.3, 0.1, -0.05]} tone="#c0391f">{`${c.T2.toFixed(0)} °C`}</Tag>
      <PartLabel partId="compressor" at={[0.05, -0.2, 0.25]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'nh3', label: 'Ammonia, −15 to 30 °C', note: 'Wet compression ending dry saturated: dryness 0.889 at the compressor inlet, refrigerating effect near 958 kJ/kg, work near 188 kJ/kg, COP about 5.1.', apply: () => set({ ...DEFAULTS }) },
  { id: 'nh3d', label: 'Same, dry compression', note: 'Saturated vapour at the inlet instead. The discharge is now much hotter, and the COP a little lower, but no liquid can reach the compressor: this is what real plants do.', apply: () => set({ ...DEFAULTS, wet: false }) },
  { id: 'fridge', label: 'Household fridge', note: 'R134a, an evaporator at −15 °C and a condenser at 40 °C in a warm kitchen.', apply: () => set({ ...DEFAULTS, fluid: 'r134a', wet: false, Te: -15, Tc: 40, m: 0.3 }) },
  { id: 'store', label: 'Vegetable store', note: 'A coil at 0 °C needs no frost-free deep cooling: a much smaller lift, so a much higher COP.', apply: () => set({ ...DEFAULTS, wet: false, Te: 0, Tc: 35 }) },
  { id: 'freezer', label: 'Blast freezer', note: 'A −35 °C coil: the lift is large, the pressure low and the COP poor. Large plants stage the compression.', apply: () => set({ ...DEFAULTS, wet: false, Te: -35, Tc: 35 }) },
]

/** The bench test: start the plant and read the gauges as the room pulls down. */
function FridgeTest() {
  const rows = fridgeRun((s) => s.rows)
  const status = fridgeRun((s) => s.status)
  const last = rows[rows.length - 1]
  return (
    <TestBench run={fridgeRun} steps={PROCEDURE.steps} title="The test: pull the room down" head={['Coil (°C)', 'Low (bar)', 'High (bar)', 'Effect', 'Work', 'COP']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3), fmt(r[3], 4), fmt(r[4], 3), fmt(r[5], 3)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[[...rows].reverse().map((r) => r[0]), [...rows].reverse().map((r) => r[5])]} series={[{ label: 'COP', color: '#e8794f', width: 2 }]} xLabel="Evaporator temperature (°C)" yLabel="COP" height={120} />
          {status === 'done' && last ? (
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              <Readout label="COP at the end" value={fmt(last[5], 3)} tone="accent" />
              <Readout label="COP at the start" value={fmt(rows[0][5], 3)} />
              <Readout label="Lift" value={fmt(last[2] / last[1], 3)} unit="ratio" tone="info" />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function FridgePanel() {
  const p = useFridge()
  const [preset, setPreset] = useState<string | null>('nh3')
  const c = cycleAt(p)
  const kg = p.m / 60
  const capacity = kg * c.effect
  return (
    <div>
      <FridgeTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Effect" value={fmt(c.effect, 4)} unit="kJ/kg" tone="info" />
          <Readout label="Work" value={fmt(c.work, 4)} unit="kJ/kg" tone="warn" />
          <Readout label="COP" value={fmt(c.cop, 3)} tone="accent" />
          <Readout label="Carnot COP" value={fmt(c.carnot, 3)} />
          <Readout label="Capacity" value={fmt(capacity, 3)} unit="kW" />
          <Readout label="Tons" value={fmt(capacity / TON, 3)} unit="TR" />
          <Readout label="Compressor" value={fmt(kg * c.work, 3)} unit="kW" />
          <Readout label="Rejected" value={fmt(kg * c.rejected, 3)} unit="kW" />
          <Readout label="Discharge" value={fmt(c.T2, 3)} unit="°C" />
        </div>
      </Section>
      <Section title="The plant">
        <Segmented<Fluid> value={p.fluid} onChange={(fluid) => set({ fluid })} options={[{ value: 'ammonia', label: 'Ammonia' }, { value: 'r134a', label: 'R134a' }]} />
        <Slider label="Evaporator target" value={p.Te} min={-38} max={10} step={1} unit="°C" onChange={(Te) => set({ Te })} />
        <Slider label="Condenser" value={p.Tc} min={20} max={55} step={1} unit="°C" onChange={(Tc) => set({ Tc })} />
        <Slider label="Refrigerant flow" value={p.m} min={0.1} max={30} step={0.1} unit="kg/min" onChange={(m) => set({ m })} />
        <Toggle label="Wet compression" checked={p.wet} onChange={(wet) => set({ wet })} hint="ends dry saturated at the condenser pressure" />
        {p.wet ? <Note tone="warn">Liquid in a compressor can damage it. Real plants let the vapour reach saturation or a little beyond before it enters.</Note> : null}
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            ...(p.wet ? [{ label: 'Dryness at inlet: same entropy as state 2', tex: 's_{g2} = s_{f1} + x_1 s_{fg1}', result: `x_1 = ${n(c.x1, 3)}` }] : []),
            { label: 'State 1', tex: p.wet ? 'h_1 = h_f + x_1 h_{fg}' : 'h_1 = h_g', result: `=${n(c.h1, 5)}\\ \\text{kJ/kg}` },
            { label: 'State 2, after the compressor', tex: 's_2 = s_1', result: `h_2 = ${n(c.h2, 5)}\\ \\text{kJ/kg}` },
            { label: 'Across the valve', tex: 'h_4 = h_3 = h_f', result: `=${n(c.h3, 5)}\\ \\text{kJ/kg}` },
            { label: 'Refrigerating effect', tex: 'q_e = h_1 - h_4', result: `=${n(c.effect, 4)}\\ \\text{kJ/kg}` },
            { label: 'Work', tex: 'w = h_2 - h_1', result: `=${n(c.work, 4)}\\ \\text{kJ/kg}` },
            { label: 'COP', tex: '\\text{COP} = \\dfrac{q_e}{w}', result: `=${n(c.cop, 3)}` },
            { label: 'Tons', tex: '\\dfrac{\\dot m\\, q_e}{3.517}', result: `=${n(capacity / TON, 3)}\\ \\text{TR}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Four parts: evaporator, compressor, condenser, expansion valve. The valve is a throttle, so h₃ = h₄.</li>
          <li>COP = effect ÷ work. It falls as the lift between evaporator and condenser grows, so don’t run colder than needed.</li>
          <li>One ton of refrigeration is 3.517 kW: melting a ton of ice in a day.</li>
          <li>Heat rejected = refrigerating effect + compressor work.</li>
        </ExamList>
      </Section>
    </div>
  )
}
