import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { TestBench, createRun, instrument, useAutoRun, useRunDriver } from '@/lab/run'
import { along, areaFor, endDifferences, lmtd, rate, type Exchanger, type Flow as Arrangement } from '@/physics/heatexchanger'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'
import { Tag, pipeCurve, pipeGeo, tempColor } from '../_shared/plant'

export const FLOOR = -0.62
const HALF = 1
const SEGMENTS = 24

interface Params {
  flow: Arrangement
  Thi: number
  Tci: number
  /** kg/s and kJ/kg K */
  mh: number
  cph: number
  mc: number
  cpc: number
  U: number
  A: number
  /** the cold outlet wanted, for sizing */
  want: number
  /** how far the test has got: moved by the test */
  f: number
  set: (q: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { flow: 'counter' as Arrangement, Thi: 105, Tci: 40, mh: 0.217, cph: 2.2, mc: 0.1, cpc: 4.18, U: 300, A: 2.03, want: 80, f: 0 }
export const useHx = create<Params>((set) => ({ ...DEFAULTS, set: (q) => set(q), reset: () => set(DEFAULTS) }))
const set = (q: Partial<Params>) => useHx.getState().set(q)

const hxRun = createRun()
/** two steps for the flows to establish, then a station at each of nine points along the pipe */
const SETTLING = 2
const STATIONS = 9
const PROCEDURE = { steps: SETTLING + STATIONS, moveSeconds: 0.5, dwellSeconds: 0.25 }

const exchanger = (p: Params): Exchanger => ({ flow: p.flow, Thi: p.Thi, Tci: p.Tci, Ch: p.mh * p.cph * 1000, Cc: p.mc * p.cpc * 1000, U: p.U, A: p.A })
const fillOf = (f: number) => Math.min(1, (f * PROCEDURE.steps) / SETTLING)
/** the probe's place along the pipe, from the hot inlet */
const probeOf = (f: number) => Math.max(0, Math.min(1, (f * PROCEDURE.steps - SETTLING - 1) / (STATIONS - 1)))

export function Exchanger3D() {
  const p = useHx()
  useAutoRun(hxRun, JSON.stringify([p.flow, p.Thi, p.Tci, p.mh, p.cph, p.mc, p.cpc, p.U, p.A]))
  useRunDriver(
    hxRun,
    PROCEDURE,
    (f) => {
      if (Math.abs(f - useHx.getState().f) >= 0.008 || f === 1) useHx.getState().set({ f })
    },
    (step) => {
      if (step <= SETTLING) return
      const st = useHx.getState()
      const s = (step - SETTLING - 1) / (STATIONS - 1)
      const t = along(exchanger(st), s)
      hxRun.getState().log([s * 100, instrument(t.Th, 0.003, step), instrument(t.Tc, 0.003, step + 30)])
    },
  )
  useEffect(
    () =>
      hxRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle') || (r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useHx.getState().set({ f: 0 })
      }),
    [],
  )

  const geo = useMemo(() => {
    const along = mat4.rz(Math.PI / 2)
    const seg = (2 * HALF) / SEGMENTS
    const stand = (x: number) => merge(xform(box(0.08, -FLOOR - 0.13, 0.08), mat4.t(x, (FLOOR - 0.13) / 2, 0)), xform(box(0.3, 0.025, 0.3), mat4.t(x, FLOOR + 0.0125, 0)))
    return {
      shell: xform(tube(0.13, 0.12, 2 * HALF, 72), along),
      inner: xform(tube(0.062, 0.054, 2 * HALF + 0.3, 56), along),
      caps: merge(...[-HALF, HALF].map((x) => xform(tube(0.15, 0.058, 0.03, 56), mat4.c(mat4.t(x, 0, 0), along)))),
      hotSeg: xform(cylinder(0.053, seg, 28), along),
      coldSeg: xform(tube(0.119, 0.063, seg, 40), along),
      stands: merge(stand(-0.7), stand(0.7)),
      ports: merge(...[-0.92, 0.92].map((x) => pipeGeo([[x, -0.12, 0], [x, -0.3, 0], [x, -0.3, -0.3]], 0.024))),
      header: pipeGeo([[-1.15, -0.3, -0.3], [1.15, -0.3, -0.3]], 0.03),
      valve: xform(box(0.09, 0.09, 0.09), mat4.t(0, 0, 0)),
      handle: xform(box(0.14, 0.012, 0.024), mat4.t(0, 0.06, 0)),
      probe: merge(xform(cylinder(0.006, 0.26, 10), mat4.t(0, 0.1, 0)), xform(box(0.05, 0.05, 0.05), mat4.t(0, 0.24, 0))),
      rail: xform(box(2.1, 0.015, 0.03), mat4.t(0, 0.27, 0)),
    }
  }, [])
  const hot = useMemo(() => Array.from({ length: SEGMENTS }, () => createDynamicCutMaterial({ color: '#888', roughness: 0.35, metalness: 0, emissive: '#000', emissiveIntensity: 0.25 })), [])
  const cold = useMemo(() => Array.from({ length: SEGMENTS }, () => createDynamicCutMaterial({ color: '#888', roughness: 0.35, metalness: 0, emissive: '#000', emissiveIntensity: 0.25 })), [])
  const hotCurve = useMemo(() => pipeCurve([[-HALF - 0.1, 0, 0], [HALF + 0.1, 0, 0]]), [])
  const coldCurve = useMemo(() => {
    const line: [number, number, number][] = [[-HALF, 0.09, 0.03], [HALF, 0.09, 0.03]]
    return pipeCurve(p.flow === 'parallel' ? line : [line[1], line[0]])
  }, [p.flow])

  const x = exchanger(p)
  const fill = fillOf(p.f)
  useSimFrame(() => {
    const st = useHx.getState()
    const e = exchanger(st)
    const fl = fillOf(st.f)
    const counter = st.flow === 'counter'
    const lo = Math.min(st.Thi, st.Tci)
    const hi = Math.max(st.Thi, st.Tci)
    for (let i = 0; i < SEGMENTS; i++) {
      const s = (i + 0.5) / SEGMENTS
      const t = along(e, s)
      // each stream has reached only as far as it has run from its own inlet; beyond that the pipe is at the cold supply's temperature
      const hotHere = s <= fl ? t.Th : st.Tci
      const coldHere = (counter ? 1 - s : s) <= fl ? t.Tc : st.Tci
      for (const [mats, T] of [[hot, hotHere], [cold, coldHere]] as const) {
        const m = mats[i]
        tempColor(T, lo, hi, m.material.color)
        m.material.emissive.copy(m.material.color)
        m.capColor.copy(m.material.color)
      }
    }
  })
  const seg = (2 * HALF) / SEGMENTS
  const probe = probeOf(p.f)
  const atProbe = along(x, probe)
  const r = rate(x)
  const counter = p.flow === 'counter'
  return (
    <group>
      <Part id="stands" name="Stands and cold header" role="static" material="paintGrey" info={{ summary: 'Hold the pipe, and bring the cold supply to either end.', role: 'Swapping which valve is open reverses the cold stream without touching the hot one: the same exchanger becomes parallel or counter flow.' }} cut={false}>
        <PartMesh geometry={geo.stands} />
        <PartMesh geometry={geo.header} material="galvanised" />
        <PartMesh geometry={geo.ports} material="galvanised" />
        {[-0.92, 0.92].map((vx) => {
          const open = counter ? vx > 0 : vx < 0
          return (
            <group key={vx} position={[vx, -0.3, -0.16]}>
              <PartMesh geometry={geo.valve} material="brass" />
              <group rotation={[0, open ? 0 : Math.PI / 2, 0]}>
                <PartMesh geometry={geo.handle} material={open ? 'paintGreen' : 'paintRed'} />
              </group>
            </group>
          )
        })}
      </Part>
      <Part id="shell" name="Outer shell" role="housing" material="steel" info={{ summary: 'Carries the cold stream around the inner pipe.', role: 'Lagged in service: every watt lost through it is a watt missing from the energy balance.' }}>
        <PartMesh geometry={geo.shell} />
        <PartMesh geometry={geo.caps} material="steelDark" />
      </Part>
      <Part id="inner" name="Inner tube" role="static" material="copper" info={{ summary: 'The wall the heat crosses.', role: 'Thin, and a good conductor. Most of the resistance is in the films of fluid each side, and fouling adds to it: that is what U sums up.' }}>
        <PartMesh geometry={geo.inner} />
      </Part>
      <Part id="hot" name="Hot stream" role="fluid" info={{ summary: 'Runs down the inner tube, cooling as it goes.', role: 'Its capacity rate m·cp sets how far its temperature falls for each kilowatt given up.' }} cut>
        {hot.map((m, i) => (
          <PartMesh key={i} geometry={geo.hotSeg} customMaterial={m.material} position={[-HALF + (i + 0.5) * seg, 0, 0]} />
        ))}
      </Part>
      <Part id="cold" name="Cold stream" role="fluid" info={{ summary: 'Runs through the space around the tube, warming as it goes.', role: 'In counter flow it leaves beside the hot inlet, so it can leave hotter than the hot stream does.' }} cut>
        {cold.map((m, i) => (
          <PartMesh key={i} geometry={geo.coldSeg} customMaterial={m.material} position={[-HALF + (i + 0.5) * seg, 0, 0]} />
        ))}
      </Part>
      <Flow curve={hotCurve} count={70} radius={0.009} color="#ffb199" speed={0.55} spread={0.05} intensity={() => (useHx.getState().f > 0 ? 1 : 0)} />
      <Flow key={p.flow} curve={coldCurve} count={80} radius={0.008} color="#cfe6ff" speed={0.45} spread={0.03} intensity={() => (useHx.getState().f > 0 ? 1 : 0)} />
      <Part id="probe" name="Travelling thermocouple" role="moving" material="steelDark" info={{ summary: 'Reads both streams at one place along the pipe.', role: 'Moved along station by station, it draws the temperature profile: the picture that separates parallel from counter flow.' }} cut={false}>
        <PartMesh geometry={geo.rail} material="aluminium" />
        <group position={[-HALF + 2 * HALF * probe, 0, 0]}>
          <PartMesh geometry={geo.probe} />
        </group>
      </Part>
      <Tag at={[-HALF - 0.32, 0.12, 0]} tone="#c0391f">{`${p.Thi.toFixed(0)} °C in`}</Tag>
      <Tag at={[HALF + 0.32, 0.12, 0]} tone="#c0391f">{`${(fill >= 1 ? r.Tho : p.Tci).toFixed(1)} °C out`}</Tag>
      <Tag at={[-HALF + 0.08, -0.42, 0]} tone="#2267b5">{counter ? `${(fill >= 1 ? r.Tco : p.Tci).toFixed(1)} °C out` : `${p.Tci.toFixed(0)} °C in`}</Tag>
      <Tag at={[HALF - 0.08, -0.42, 0]} tone="#2267b5">{counter ? `${p.Tci.toFixed(0)} °C in` : `${(fill >= 1 ? r.Tco : p.Tci).toFixed(1)} °C out`}</Tag>
      <Tag at={[-HALF + 2 * HALF * probe, 0.4, 0]}>{`${atProbe.Th.toFixed(1)} / ${atProbe.Tc.toFixed(1)} °C`}</Tag>
      <PartLabel partId="shell" at={[0.35, 0.17, 0.12]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'oil', label: 'Oil heats water', note: 'Water 0.1 kg/s from 40 to 80 °C, with oil from 105 to 70 °C and U = 300: about 2 m² in counter flow.', apply: () => set({ ...DEFAULTS }) },
  { id: 'hot', label: 'Very hot oil', note: 'Oil at 2500 W/K, 360 to 300 °C, and a cold stream from 30 to 200 °C, U = 800: 0.97 m² in parallel, 0.89 m² in counter flow.', apply: () => set({ ...DEFAULTS, Thi: 360, Tci: 30, mh: 1, cph: 2.5, mc: 0.211, cpc: 4.18, U: 800, A: 0.892, want: 200 }) },
  { id: 'cooler', label: 'Oil cooler, 190 kW', note: 'Oil 65.5 to 54.4 °C, water from 26.7 °C rising 11.1 °C, U = 738: 9.85 m² in parallel, 9.3 m² in counter flow. The capacities are equal, so in counter flow the two lines run side by side.', apply: () => set({ ...DEFAULTS, Thi: 65.5, Tci: 26.7, mh: 7.8, cph: 2.2, mc: 4.1, cpc: 4.18, U: 738, A: 9.3, want: 37.8 }) },
  { id: 'cant', label: 'Impossible in parallel', note: 'Hot water 5 kg/min from 85 °C must take a fluid from 27 to 55 °C. The hot water would have to leave at about 46 °C, colder than the 55 °C cold stream beside it. Parallel flow cannot do that, at any area.', apply: () => set({ ...DEFAULTS, flow: 'parallel', Thi: 85, Tci: 27, mh: 0.0833, cph: 4.18, mc: 0.1667, cpc: 2.93, U: 500, A: 1, want: 55 }) },
]

/** The bench test: let the flows settle, then read both streams at stations along the pipe. */
function ExchangerTest() {
  const p = useHx()
  const rows = hxRun((s) => s.rows)
  const status = hxRun((s) => s.status)
  const first = rows[0]
  const last = rows[rows.length - 1]
  const x = exchanger(p)
  let Q = 0
  let foundU = 0
  if (status === 'done' && first && last) {
    const Tho = last[1]
    const Tco = p.flow === 'counter' ? first[2] : last[2]
    Q = x.Cc * (Tco - p.Tci)
    const [a, b] = endDifferences(p.flow, p.Thi, Tho, p.Tci, Tco)
    foundU = Q / (p.A * lmtd(a, b))
  }
  return (
    <TestBench run={hxRun} steps={PROCEDURE.steps} title="The test: read along the pipe" head={['Along (%)', 'Hot (°C)', 'Cold (°C)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 4), fmt(r[2], 4)]}>
      {rows.length > 1 ? (
        <>
          <Chart data={[rows.map((r) => r[0]), rows.map((r) => r[1]), rows.map((r) => r[2])]} series={[{ label: 'Hot', color: '#e8794f', width: 2 }, { label: 'Cold', color: '#6fb3e0', width: 2 }]} xLabel="Along the pipe, from the hot inlet (%)" yLabel="°C" height={130} />
          {status === 'done' ? (
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              <Readout label="Duty found" value={fmt(Q / 1000, 3)} unit="kW" tone="accent" />
              <Readout label="U from the test" value={fmt(foundU, 3)} unit="W/m²K" tone="info" />
              <Readout label="Set U" value={fmt(p.U, 3)} unit="W/m²K" />
            </div>
          ) : null}
        </>
      ) : null}
    </TestBench>
  )
}

export function ExchangerPanel() {
  const p = useHx()
  const [preset, setPreset] = useState<string | null>('oil')
  const x = exchanger(p)
  const r = rate(x)
  const other = rate({ ...x, flow: p.flow === 'counter' ? 'parallel' : 'counter' })
  const dutyWanted = x.Cc * (p.want - p.Tci)
  const hotLeaves = p.Thi - dutyWanted / x.Ch
  const needPar = areaFor('parallel', dutyWanted, p.U, p.Thi, hotLeaves, p.Tci, p.want)
  const needCtr = areaFor('counter', dutyWanted, p.U, p.Thi, hotLeaves, p.Tci, p.want)
  return (
    <div>
      <ExchangerTest />
      <Section title="This exchanger">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Duty" value={fmt(r.Q / 1000, 4)} unit="kW" tone="warn" />
          <Readout label="Hot leaves" value={fmt(r.Tho, 4)} unit="°C" />
          <Readout label="Cold leaves" value={fmt(r.Tco, 4)} unit="°C" />
          <Readout label="LMTD" value={fmt(r.lmtd, 4)} unit="K" tone="info" />
          <Readout label="Effectiveness" value={fmt(r.eff, 3)} tone="accent" />
          <Readout label="NTU" value={fmt(r.ntu, 3)} />
        </div>
        <Note>{`Reversed, the same exchanger would transfer ${fmt(other.Q / 1000, 3)} kW.`}</Note>
      </Section>
      <Section title="The rig">
        <Segmented<Arrangement> value={p.flow} onChange={(flow) => set({ flow })} options={[{ value: 'parallel', label: 'Parallel' }, { value: 'counter', label: 'Counter' }]} />
        <Slider label="Hot inlet" value={p.Thi} min={30} max={400} step={0.5} unit="°C" onChange={(Thi) => set({ Thi })} />
        <Slider label="Cold inlet" value={p.Tci} min={0} max={80} step={0.1} unit="°C" onChange={(Tci) => set({ Tci })} />
        <Slider label="Hot flow" value={p.mh} min={0.02} max={10} step={0.001} unit="kg/s" onChange={(mh) => set({ mh })} />
        <Slider label="Hot specific heat" value={p.cph} min={1} max={5} step={0.01} unit="kJ/kg K" onChange={(cph) => set({ cph })} />
        <Slider label="Cold flow" value={p.mc} min={0.02} max={10} step={0.001} unit="kg/s" onChange={(mc) => set({ mc })} />
        <Slider label="Cold specific heat" value={p.cpc} min={1} max={5} step={0.01} unit="kJ/kg K" onChange={(cpc) => set({ cpc })} />
        <Slider label="Overall coefficient U" value={p.U} min={50} max={1500} step={1} unit="W/m²K" onChange={(U) => set({ U })} />
        <Slider label="Area" value={p.A} min={0.1} max={15} step={0.01} unit="m²" onChange={(A) => set({ A })} />
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Sizing for a duty">
        <Slider label="Cold outlet wanted" value={p.want} min={p.Tci + 1} max={Math.max(p.Thi, p.Tci + 2)} step={0.1} unit="°C" onChange={(want) => set({ want })} />
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Hot must leave" value={fmt(hotLeaves, 4)} unit="°C" />
          <Readout label="Parallel area" value={needPar === null ? 'none' : fmt(needPar, 3)} unit={needPar === null ? '' : 'm²'} tone={needPar === null ? 'warn' : undefined} />
          <Readout label="Counter area" value={needCtr === null ? 'none' : fmt(needCtr, 3)} unit={needCtr === null ? '' : 'm²'} tone={needCtr === null ? 'warn' : 'accent'} />
        </div>
        {needPar === null && needCtr !== null ? <Note tone="warn">Parallel flow cannot do this: both streams would have to end at a temperature where the hot one is colder than the cold one.</Note> : null}
        {needCtr === null ? <Note tone="warn">No arrangement can do this: the streams would have to cross at one end. Raise the hot flow or lower the target.</Note> : null}
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Duty, from the cold stream', tex: 'Q = \\dot m_c c_c (T_{c,o} - T_{c,i})', result: `=${n(r.Q / 1000, 4)}\\ \\text{kW}` },
            { label: 'End differences', tex: p.flow === 'counter' ? '\\Delta T_1 = T_{h,i} - T_{c,o},\\ \\Delta T_2 = T_{h,o} - T_{c,i}' : '\\Delta T_1 = T_{h,i} - T_{c,i},\\ \\Delta T_2 = T_{h,o} - T_{c,o}', result: `=${n(r.dt1, 4)},\\ ${n(r.dt2, 4)}\\ \\text{K}` },
            { label: 'Log-mean difference', tex: '\\Delta T_m = \\dfrac{\\Delta T_1 - \\Delta T_2}{\\ln(\\Delta T_1/\\Delta T_2)}', result: `=${n(r.lmtd, 4)}\\ \\text{K}` },
            { label: 'Check', tex: 'Q = U A\\,\\Delta T_m', sub: `=(${n(p.U, 4)})(${n(p.A, 3)})(${n(r.lmtd, 4)})`, result: `=${n((p.U * p.A * r.lmtd) / 1000, 4)}\\ \\text{kW}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Counter flow has the larger mean difference for the same end temperatures, so it needs less area.</li>
          <li>In parallel flow the cold outlet can never pass the hot outlet. In counter flow it can.</li>
          <li>Use the end differences in the log mean, not the average. The two agree only when the differences are equal.</li>
          <li>With equal capacity rates in counter flow the difference is the same all along, and the log mean is that difference.</li>
        </ExamList>
      </Section>
    </div>
  )
}
