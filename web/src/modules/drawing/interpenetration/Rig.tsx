import { Line } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { box, cylinder, finalize, mat4, xform } from '@/geometry'
import { TestBench, createRun, useResetOnChange, useRunDriver } from '@/lab/run'
import { curvePoint, development, meets, type Junction } from '@/physics/drawing'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'
import { Tag, type Pt } from '../../thermal/_shared/plant'

export const FLOOR = -1.1
const S = 0.01
const END = 150

interface Params extends Junction {
  /** how far round the cutting planes have gone: moved by the test */
  f: number
  set: (q: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { R: 50, r: 30, angle: 90, offset: 0, f: 1 }
export const useJoin = create<Params>((set) => ({ ...DEFAULTS, set: (q) => set(q), reset: () => set(DEFAULTS) }))
const set = (q: Partial<Params>) => useJoin.getState().set(q)

const joinRun = createRun()
const PROCEDURE = { steps: 12, moveSeconds: 0.4, dwellSeconds: 0.2 }

/** the branch's surface, trimmed where it meets the main cylinder */
function branchSurface(j: Junction) {
  const th = (j.angle * Math.PI) / 180
  const a = new THREE.Vector3(Math.sin(th), Math.cos(th), 0)
  const u = new THREE.Vector3(Math.cos(th), -Math.sin(th), 0)
  const N = 72
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= N; i++) {
    const phi = (i / N) * 2 * Math.PI
    const t = curvePoint(j, phi).t
    for (const along of [t, END]) {
      const q = a.clone().multiplyScalar(along).addScaledVector(u, j.r * Math.cos(phi))
      pos.push(q.x * S, q.y * S, (j.r * Math.sin(phi) + j.offset) * S)
    }
    if (i < N) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return finalize(g, Math.PI / 3)
}

export function Join3D() {
  const p = useJoin()
  useResetOnChange(joinRun, JSON.stringify([p.R, p.r, p.angle, p.offset]))
  useRunDriver(
    joinRun,
    PROCEDURE,
    (f) => {
      if (Math.abs(f - useJoin.getState().f) >= 0.004 || f === 1) useJoin.getState().set({ f })
    },
    (step, f) => {
      const st = useJoin.getState()
      const q = curvePoint(st, f * 2 * Math.PI)
      const tidy = (v: number) => Math.round(v * 1000) / 1000
      joinRun.getState().log([step, f * 360, tidy(q.z), tidy(q.x), tidy(q.y), tidy(q.t)])
      if (!meets(st)) joinRun.getState().fail('The branch reaches past the side of the main cylinder, so part of it misses. Reduce the offset or the branch radius.')
    },
  )
  useEffect(
    () =>
      joinRun.subscribe((r, prev) => {
        if ((r.status === 'idle' && prev.status !== 'idle')) useJoin.getState().set({ f: 1 })
        if ((r.status === 'running' && prev.status !== 'running' && r.rows.length === 0)) useJoin.getState().set({ f: 0 })
      }),
    [],
  )
  const geo = useMemo(
    () => ({
      main: cylinder(p.R * S, 2, 96),
      plane: xform(box(3.4, 2.2, 0.006), mat4.t(0.4, 0, 0)),
      foot: xform(box(1.4, 0.05, 1.4), mat4.t(0, FLOOR + 0.025, 0)),
    }),
    [p.R],
  )
  const branch = useMemo(() => branchSurface(p), [p.R, p.r, p.angle, p.offset])
  const skin = useMemo(() => createDynamicCutMaterial({ color: '#d98b3a', roughness: 0.45, metalness: 0.5 }), [])
  const phi = p.f * 2 * Math.PI
  const here = curvePoint(p, phi)
  const curve = useMemo(() => {
    const pts: Pt[] = []
    const N = Math.max(1, Math.round(p.f * 96))
    for (let i = 0; i <= N; i++) {
      const q = curvePoint(p, (i / 96) * 2 * Math.PI)
      // just proud of the surface, so that the line is not lost in it
      pts.push([q.x * S * 1.012, q.y * S, q.z * S * 1.012])
    }
    return pts
  }, [p.f, p.R, p.r, p.angle, p.offset])
  const th = (p.angle * Math.PI) / 180
  const across = p.r * Math.cos(phi)
  const endPt: Pt = [(END * Math.sin(th) + across * Math.cos(th)) * S, (END * Math.cos(th) - across * Math.sin(th)) * S, here.z * S]
  const hit: Pt = [here.x * S, here.y * S, here.z * S]
  return (
    <group>
      <Part id="foot" name="Base" role="static" material="paintGrey" info={{ summary: 'Holds the model upright.', role: 'Only there to stand the cylinders on.' }} cut={false}>
        <PartMesh geometry={geo.foot} />
      </Part>
      <Part id="main" name="Main cylinder" role="static" material="paintBlue" info={{ summary: 'The upright pipe.', role: 'In the plan it is only a circle, so every point on its surface is found straight away: this is what makes the plan the place to start.' }}>
        <PartMesh geometry={geo.main} />
      </Part>
      <Part id="branch" name="Branch cylinder" role="static" info={{ summary: 'The pipe joining from the side.', role: 'Its generators are straight lines along it. Each one ends on the curve, and their lengths give the flat pattern for cutting it from sheet.' }}>
        <PartMesh geometry={branch} customMaterial={skin.material} />
      </Part>
      <group position={[0, 0, here.z * S]}>
        <Part id="plane" name="Cutting plane" role="moving" material="glass" info={{ summary: 'A slice parallel to both axes.', role: 'It cuts each cylinder along straight lines, so it is easy to draw in every view. Where those lines cross is a point on the curve.' }} cut={false}>
          <PartMesh geometry={geo.plane} />
        </Part>
      </group>
      <Line points={[[hit[0], hit[1], hit[2] * 1.01], endPt]} color="#c0391f" lineWidth={2.5} />
      <Line points={[[here.x * S, 1, here.z * S], [here.x * S, -1, here.z * S]]} color="#2267b5" lineWidth={2} />
      <Line points={curve} color="#111" lineWidth={4} />
      <mesh position={hit}>
        <sphereGeometry args={[0.022, 16, 12]} />
        <meshStandardMaterial color="#c0391f" emissive="#c0391f" emissiveIntensity={0.6} />
      </mesh>
      <Tag at={[0.9, 0.95, 0]}>{`${(p.f * 360).toFixed(0)}°, line ${here.t.toFixed(1)} mm from axis`}</Tag>
      <PartLabel partId="main" at={[-p.R * S - 0.1, 0.7, 0]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'tee', label: 'Unequal tee', note: 'A smaller branch at right angles. The curve in the elevation bows toward the main axis.', apply: () => set({ ...DEFAULTS }) },
  { id: 'equal', label: 'Equal tee', note: 'Equal diameters at right angles: the curve seen in elevation collapses to two straight lines at 45°.', apply: () => set({ ...DEFAULTS, r: 50 }) },
  { id: 'angle', label: 'Branch at 60°', note: 'The branch leans over. The generators on the acute side run much further.', apply: () => set({ ...DEFAULTS, angle: 60 }) },
  { id: 'offset', label: 'Offset branch', note: 'The axes no longer meet, so the curve is no longer symmetrical front to back.', apply: () => set({ ...DEFAULTS, offset: 15 }) },
]

/** The drawing, building point by point: elevation, plan and the branch's flat pattern. */
function Sheet({ p }: { p: Params }) {
  const rows = joinRun((s) => s.rows)
  const th = (p.angle * Math.PI) / 180
  const box = 150
  const c = 0.42
  const eX = (x: number) => 72 + x * c
  const eY = (y: number) => 62 - y * c
  const pY = (z: number) => 170 + z * c
  const axis: [number, number] = [Math.sin(th) * box, Math.cos(th) * box]
  const edge = (side: number) => ({ dx: side * p.r * Math.cos(th), dy: -side * p.r * Math.sin(th) })
  const pattern = useMemo(() => development(p, END), [p.R, p.r, p.angle, p.offset])
  const pw = 2 * Math.PI * p.r
  const maxL = Math.max(...pattern.L)
  const dk = Math.min(120 / pw, 80 / maxL)
  return (
    <svg viewBox="0 0 310 235" className="mt-1 w-full" role="img" aria-label="Elevation, plan and flat pattern">
      <text x={2} y={9} fontSize={7} fill="currentColor">Elevation</text>
      <text x={2} y={136} fontSize={7} fill="currentColor">Plan</text>
      <text x={172} y={9} fontSize={7} fill="currentColor">Flat pattern of the branch</text>
      <rect x={eX(-p.R)} y={4} width={2 * p.R * c} height={116} fill="none" stroke="currentColor" opacity={0.5} />
      <circle cx={eX(0)} cy={pY(0)} r={p.R * c} fill="none" stroke="currentColor" opacity={0.5} />
      {[1, -1].map((side) => (
        <line key={side} x1={eX(edge(side).dx)} y1={eY(edge(side).dy)} x2={eX(axis[0] + edge(side).dx)} y2={eY(axis[1] + edge(side).dy)} stroke="currentColor" opacity={0.5} />
      ))}
      {[1, -1].map((side) => (
        <line key={side} x1={eX(0)} y1={pY(p.offset + side * p.r)} x2={eX(Math.sin(th) * box)} y2={pY(p.offset + side * p.r)} stroke="currentColor" opacity={0.5} />
      ))}
      {rows.map((r) => (
        <g key={r[0]}>
          <circle cx={eX(r[3])} cy={eY(r[4])} r={1.6} fill="#c0391f" />
          <circle cx={eX(r[3])} cy={pY(r[2])} r={1.6} fill="#c0391f" />
          <line x1={eX(r[3])} y1={eY(r[4])} x2={eX(r[3])} y2={pY(r[2])} stroke="#2267b5" strokeWidth={0.4} opacity={0.6} />
          <line x1={176 + (r[1] / 360) * pw * dk} y1={120} x2={176 + (r[1] / 360) * pw * dk} y2={120 - (END - r[5]) * dk} stroke="#c0391f" strokeWidth={0.7} />
        </g>
      ))}
      <line x1={176} y1={120} x2={176 + pw * dk} y2={120} stroke="currentColor" opacity={0.5} />
      {['done', 'idle'].includes(joinRun.getState().status) ? (
        <polyline fill="none" stroke="#c0391f" strokeWidth={1.2} points={pattern.s.map((s, i) => `${176 + s * dk},${120 - pattern.L[i] * dk}`).join(' ')} />
      ) : null}
    </svg>
  )
}

/** The bench test: step a cutting plane round the branch, plotting a point each time. */
function JoinTest() {
  return <TestBench run={joinRun} steps={PROCEDURE.steps} title="The test: plot it point by point" head={['Line', 'Round (°)', 'Plane z', 'x', 'y', 'Length']} format={(r) => [fmt(r[0], 2), fmt(r[1], 3), fmt(r[2], 3), fmt(r[3], 3), fmt(r[4], 3), fmt(END - r[5], 4)]} />
}

export function JoinPanel() {
  const p = useJoin()
  const [preset, setPreset] = useState<string | null>('tee')
  const pat = useMemo(() => development(p, END), [p.R, p.r, p.angle, p.offset])
  const ok = meets(p)
  const eg = curvePoint(p, Math.PI / 2)
  return (
    <div>
      <JoinTest />
      <Section title="The drawing">
        <Sheet p={p} />
        {ok ? null : <Note tone="warn">Part of this branch misses the main cylinder: its radius and offset add up to more than the main radius.</Note>}
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          <Readout label="Pattern width" value={fmt(2 * Math.PI * p.r, 4)} unit="mm" tone="accent" />
          <Readout label="Longest line" value={fmt(Math.max(...pat.L), 4)} unit="mm" />
          <Readout label="Shortest line" value={fmt(Math.min(...pat.L), 4)} unit="mm" />
        </div>
      </Section>
      <Section title="The cylinders">
        <Slider label="Main radius" value={p.R} min={20} max={80} step={1} unit="mm" onChange={(R) => set({ R })} />
        <Slider label="Branch radius" value={p.r} min={10} max={80} step={1} unit="mm" onChange={(r) => set({ r })} />
        <Slider label="Angle between axes" value={p.angle} min={40} max={90} step={1} unit="°" onChange={(angle) => set({ angle })} />
        <Slider label="Branch offset" value={p.offset} min={0} max={50} step={1} unit="mm" onChange={(offset) => set({ offset })} />
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Cutting plane for a line round the branch', tex: 'z = r\\sin\\phi + e', sub: `\\phi = 90^\\circ:\\ ${n(p.r, 3)} + ${n(p.offset, 3)}`, result: `=${n(eg.z, 4)}\\ \\text{mm}` },
            { label: 'Across to the main cylinder, from the plan', tex: 'x = \\sqrt{R^2 - z^2}', result: `=${n(eg.x, 4)}\\ \\text{mm}` },
            { label: 'Project to the elevation', tex: 't = \\dfrac{x - r\\cos\\phi\\cos\\theta}{\\sin\\theta}', result: `=${n(eg.t, 4)}\\ \\text{mm}` },
            { label: 'Width of the flat pattern', tex: '2\\pi r', result: `=${n(2 * Math.PI * p.r, 4)}\\ \\text{mm}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Draw the plan and elevation first. Divide the branch’s end circle into equal parts and number them.</li>
          <li>Project each numbered line in the plan to where it meets the main cylinder, then across to the same line in the elevation.</li>
          <li>Join the crossings with a smooth curve. Number them, or the curve will be joined in the wrong order.</li>
          <li>Equal cylinders at right angles give straight lines on the elevation: a mitre.</li>
        </ExamList>
      </Section>
    </div>
  )
}
