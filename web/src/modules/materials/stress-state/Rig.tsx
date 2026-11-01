import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box } from '@/geometry'
import { principal, principalStrains, rosette, rotateStress, stressFromStrain, trescaEquivalent, vonMisesEquivalent, type Plane } from '@/physics/strength'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'
import { ForceArrow } from '../../elements/_shared/Arrow'

export const FLOOR = -0.42
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const SIZE = 0.3

type Mode = 'stress' | 'rosette'

interface Params {
  mode: Mode
  /** MPa */
  sx: number
  sy: number
  txy: number
  /** the element's turn, deg */
  theta: number
  yieldS: number
  /** gauges, microstrain, and rosette kind */
  ea: number
  eb: number
  ec: number
  delta: boolean
  E: number
  nu: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { mode: 'stress' as Mode, sx: 80, sy: -40, txy: 25, theta: 0, yieldS: 250, ea: 500, eb: 250, ec: -200, delta: false, E: 200, nu: 0.3 }
export const useStressState = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useStressState.getState().set(p)

/** the plane stress on the rig, in MPa: set directly, or from the gauges */
function planeOf(p: Params): Plane {
  if (p.mode === 'stress') return { sx: p.sx, sy: p.sy, txy: p.txy }
  const angles: [number, number, number] = p.delta ? [0, rad(60), rad(120)] : [0, rad(45), rad(90)]
  const r = rosette([p.ea * 1e-6, p.eb * 1e-6, p.ec * 1e-6], angles)
  return stressFromStrain(r.ex, r.ey, r.gxy, p.E * 1e3, p.nu)
}

export function Stress3D() {
  const p = useStressState()
  const el = useRef<THREE.Group>(null)
  const geo = useMemo(() => ({ cube: box(SIZE, SIZE, 0.05), base: box(0.5, 0.03, 0.4), post: box(0.04, -FLOOR - SIZE / 2, 0.04), gauge: box(0.09, 0.016, 0.006) }), [])
  const plane = planeOf(p)
  const q0 = principal(plane)
  const peak = Math.max(1, q0.tauMax + Math.abs(q0.centre))
  useSimFrame(() => {
    el.current?.rotation.set(0, 0, rad(p.theta))
  })
  const H = SIZE / 2
  const len = (v: number) => 0.06 + (Math.abs(v) / peak) * 0.3
  const dir = (a: number) => new THREE.Vector3(Math.cos(a), Math.sin(a), 0)
  /** a normal or shear arrow on one of the four faces */
  const spec = (side: 1 | -1, axis: 0 | 90, kind: 'n' | 't') => () => {
    const a = rad(p.theta + axis)
    const q = rotateStress(plane, rad(p.theta))
    const normal = axis === 0 ? q.sn : q.st
    const shear = q.tn
    const out = dir(a).multiplyScalar(side)
    if (kind === 'n') {
      const tension = normal >= 0
      const tip = out.clone().multiplyScalar(H)
      const l = len(normal)
      return { origin: tension ? tip : tip.clone().add(out.clone().multiplyScalar(l)), dir: tension ? out : out.clone().negate(), length: l, label: side === 1 ? normal.toFixed(0) : undefined, visible: Math.abs(normal) > 0.5 }
    }
    // positive shear: up the +x face, right along the +y face, and the reverse on the far faces
    const along = (axis === 0 ? dir(a + Math.PI / 2) : dir(a - Math.PI / 2)).multiplyScalar(side * Math.sign(shear || 1))
    const l = len(shear) * 0.8
    const centre = out.clone().multiplyScalar(H + 0.018)
    return { origin: centre.clone().sub(along.clone().multiplyScalar(l / 2)), dir: along, length: l, label: side === 1 && axis === 0 ? `τ ${Math.abs(shear).toFixed(0)}` : undefined, visible: Math.abs(shear) > 0.5 }
  }
  const gauges = p.delta ? [0, 60, 120] : [0, 45, 90]
  return (
    <group>
      <Part id="stand" name="Stand" role="static" material="paintGrey" info={{ summary: 'Holds the element up to view.', role: 'The element is a tiny square of material, enlarged to show the stresses on its faces.' }} cut={false}>
        <group position={[0, FLOOR + 0.015, 0]}>
          <PartMesh geometry={geo.base} />
        </group>
        <group position={[0, (FLOOR - SIZE / 2) / 2, -0.05]}>
          <PartMesh geometry={geo.post} />
        </group>
      </Part>
      <group ref={el}>
        <Part id="element" name="Stress element" role="moving" material="aluminium" info={{ summary: 'One point in the material.', role: 'Turn it, and the stresses on its faces change, though the state of stress at the point does not. Three numbers describe it fully.' }} cut={false}>
          <PartMesh geometry={geo.cube} />
        </Part>
        {p.mode === 'rosette'
          ? gauges.map((a) => (
              <group key={a} rotation={[0, 0, rad(a)]} position={[0, 0, 0.03]}>
                <group position={[0.07, 0, 0]}>
                  <Part id={`gauge-${a}`} name={`Gauge at ${a}°`} role="static" material="copper" info={{ summary: 'A foil strain gauge.', role: 'Reads the strain along its own line. Three in different directions fix all three strains at the point.' }} cut={false}>
                    <PartMesh geometry={geo.gauge} />
                  </Part>
                </group>
              </group>
            ))
          : null}
      </group>
      {([[1, 0], [-1, 0], [1, 90], [-1, 90]] as [1 | -1, 0 | 90][]).flatMap(([s, ax]) => [
        <ForceArrow key={`n${s}${ax}`} color="#d0452c" spec={spec(s, ax, 'n')} radius={0.007} />,
        <ForceArrow key={`t${s}${ax}`} color="#2f6fd0" spec={spec(s, ax, 't')} radius={0.005} />,
      ])}
      <PartLabel partId="element" at={[0, -H - 0.06, 0.05]} />
    </group>
  )
}

/** Mohr's circle: σ across, τ drawn downward positive, so a turn of the element runs the same way round */
function Mohr({ plane, theta }: { plane: Plane; theta: number }) {
  const q = principal(plane)
  const R = q.tauMax
  const span = Math.max(Math.abs(q.s1), Math.abs(q.s2), R * 1.2, 1) * 1.2
  const X = (s: number) => 150 + (s / span) * 130
  const Y = (t: number) => 100 + (t / span) * 130
  const rot = rotateStress(plane, theta)
  const A = [X(rot.sn), Y(rot.tn)]
  const B = [X(rot.st), Y(-rot.tn)]
  return (
    <svg viewBox="0 0 300 200" className="w-full" role="img" aria-label="Mohr's circle">
      <line x1={10} y1={100} x2={290} y2={100} stroke="#7a8590" strokeWidth={1} />
      <line x1={X(0)} y1={8} x2={X(0)} y2={192} stroke="#7a8590" strokeWidth={1} />
      <text x={282} y={94} fontSize={9} fill="#5b6670">σ</text>
      <text x={X(0) + 3} y={15} fontSize={9} fill="#5b6670">τ</text>
      <circle cx={X(q.centre)} cy={100} r={(R / span) * 130} fill="#d0631c22" stroke="#d0631c" strokeWidth={1.6} />
      <line x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke="#3f4a52" strokeWidth={1.2} />
      <circle cx={A[0]} cy={A[1]} r={3.4} fill="#d0452c" />
      <circle cx={B[0]} cy={B[1]} r={3.4} fill="#2f6fd0" />
      <circle cx={X(q.s1)} cy={100} r={2.6} fill="#3f4a52" />
      <circle cx={X(q.s2)} cy={100} r={2.6} fill="#3f4a52" />
      <text x={X(q.s1) + 3} y={113} fontSize={9} fill="#3f4a52">σ₁</text>
      <text x={X(q.s2) - 13} y={113} fontSize={9} fill="#3f4a52">σ₂</text>
    </svg>
  )
}

/** the safe region for plane stress: von Mises’ ellipse and Tresca’s hexagon */
function YieldEnvelope({ s1, s2, Y }: { s1: number; s2: number; Y: number }) {
  const span = Math.max(Y * 1.35, Math.abs(s1) * 1.1, Math.abs(s2) * 1.1)
  const X = (v: number) => 100 + (v / span) * 90
  const Z = (v: number) => 100 - (v / span) * 90
  // s1² − s1 s2 + s2² = Y²: along the diagonals its semi-axes are Y√2 and Y√(2/3)
  const ell: string[] = []
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * 2 * Math.PI
    const u = Y * Math.SQRT2 * Math.cos(t)
    const v = Y * Math.sqrt(2 / 3) * Math.sin(t)
    ell.push(`${X((u - v) / Math.SQRT2)},${Z((u + v) / Math.SQRT2)}`)
  }
  const hex = [[Y, 0], [Y, Y], [0, Y], [-Y, 0], [-Y, -Y], [0, -Y]].map(([a, b]) => `${X(a)},${Z(b)}`).join(' ')
  return (
    <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[250px]" role="img" aria-label="Yield envelope">
      <line x1={5} y1={100} x2={195} y2={100} stroke="#7a8590" />
      <line x1={100} y1={5} x2={100} y2={195} stroke="#7a8590" />
      <polygon points={hex} fill="#4d7c0f18" stroke="#4d7c0f" strokeWidth={1.5} />
      <polygon points={ell.join(' ')} fill="none" stroke="#2f6fd0" strokeWidth={1.5} />
      <circle cx={X(s1)} cy={Z(s2)} r={3.6} fill="#d0452c" />
      <text x={186} y={95} fontSize={9} fill="#5b6670">σ₁</text>
      <text x={104} y={13} fontSize={9} fill="#5b6670">σ₂</text>
    </svg>
  )
}

const PRESETS: Preset[] = [
  { id: 'general', label: 'General state', note: '80 and −40 MPa with 25 MPa shear: σ₁ = 85, σ₂ = −45, τmax = 65 MPa.', apply: () => set({ ...DEFAULTS }) },
  { id: 'tension', label: 'Simple tension', note: 'Pull in one direction only. The largest shear is half of it, on planes at 45°: why ductile metals slip at 45°.', apply: () => set({ ...DEFAULTS, sx: 100, sy: 0, txy: 0, theta: 45 }) },
  { id: 'shear', label: 'Pure shear', note: 'The circle is centred on the origin. Turn it 45° and the same state is equal tension and compression: why a twisted chalk stick breaks on a helix.', apply: () => set({ ...DEFAULTS, sx: 0, sy: 0, txy: 60, theta: 45 }) },
  { id: 'gauges', label: 'A rectangular rosette', note: 'Three readings at 0°, 45° and 90°. The shear strain comes from γ = 2ε_b − ε_a − ε_c.', apply: () => set({ ...DEFAULTS, mode: 'rosette' }) },
]

export function StressPanel() {
  const p = useStressState()
  const [preset, setPreset] = useState<string | null>('general')
  const plane = planeOf(p)
  const q = principal(plane)
  const rot = rotateStress(plane, rad(p.theta))
  const angles: [number, number, number] = p.delta ? [0, rad(60), rad(120)] : [0, rad(45), rad(90)]
  const r = rosette([p.ea * 1e-6, p.eb * 1e-6, p.ec * 1e-6], angles)
  const ps = principalStrains(r.ex, r.ey, r.gxy)
  const tresca = trescaEquivalent(q.s1, q.s2, 0)
  const mises = vonMisesEquivalent(q.s1, q.s2, 0)
  const safe = tresca < p.yieldS
  return (
    <div>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="On this face" value={fmt(rot.sn, 3)} unit="MPa" tone="warn" />
          <Readout label="Shear on it" value={fmt(rot.tn, 3)} unit="MPa" tone="info" />
          <Readout label="On the other" value={fmt(rot.st, 3)} unit="MPa" />
          <Readout label="Principal 1" value={fmt(q.s1, 3)} unit="MPa" tone="accent" />
          <Readout label="Principal 2" value={fmt(q.s2, 3)} unit="MPa" tone="accent" />
          <Readout label="Largest shear" value={fmt(q.tauMax, 3)} unit="MPa" />
        </div>
      </Section>
      <Section title="The state of stress">
        <Segmented<Mode>
          value={p.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'stress', label: 'Set the stresses' },
            { value: 'rosette', label: 'Strain gauges' },
          ]}
        />
        {p.mode === 'stress' ? (
          <>
            <Slider label="σx" value={p.sx} min={-200} max={200} step={1} unit="MPa" onChange={(sx) => set({ sx })} />
            <Slider label="σy" value={p.sy} min={-200} max={200} step={1} unit="MPa" onChange={(sy) => set({ sy })} />
            <Slider label="τxy" value={p.txy} min={-150} max={150} step={1} unit="MPa" onChange={(txy) => set({ txy })} />
          </>
        ) : (
          <>
            <Segmented<'rect' | 'delta'> value={p.delta ? 'delta' : 'rect'} onChange={(v) => set({ delta: v === 'delta' })} options={[{ value: 'rect', label: '45° rectangular' }, { value: 'delta', label: '60° delta' }]} />
            <Slider label="Gauge a, 0°" value={p.ea} min={-1500} max={1500} step={5} unit="µε" onChange={(ea) => set({ ea })} />
            <Slider label={`Gauge b, ${p.delta ? 60 : 45}°`} value={p.eb} min={-1500} max={1500} step={5} unit="µε" onChange={(eb) => set({ eb })} />
            <Slider label={`Gauge c, ${p.delta ? 120 : 90}°`} value={p.ec} min={-1500} max={1500} step={5} unit="µε" onChange={(ec) => set({ ec })} />
            <Slider label="Young’s modulus" value={p.E} min={50} max={220} step={5} unit="GPa" onChange={(E) => set({ E })} />
            <div className="grid grid-cols-3 gap-1.5">
              <Readout label="Strain x" value={fmt(r.ex * 1e6, 3)} unit="µε" />
              <Readout label="Strain y" value={fmt(r.ey * 1e6, 3)} unit="µε" />
              <Readout label="Shear strain" value={fmt(r.gxy * 1e6, 3)} unit="µε" />
              <Readout label="Principal 1" value={fmt(ps.e1 * 1e6, 3)} unit="µε" tone="accent" />
              <Readout label="Principal 2" value={fmt(ps.e2 * 1e6, 3)} unit="µε" tone="accent" />
              <Readout label="Largest shear" value={fmt(ps.gMax * 1e6, 3)} unit="µε" />
            </div>
          </>
        )}
        <Slider label="Turn the element, θ" value={p.theta} min={0} max={180} step={1} unit="°" onChange={(theta) => set({ theta })} />
      </Section>
      <Section title="Mohr’s circle">
        <Mohr plane={plane} theta={rad(p.theta)} />
        <Note>A turn of θ on the element is 2θ on the circle. The red dot is this face, the blue the face at right angles. At the top of the circle is the largest shear; on the axis, the principal stresses and no shear.</Note>
      </Section>
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Will it yield?">
        <Slider label="Yield stress" value={p.yieldS} min={50} max={600} step={5} unit="MPa" onChange={(yieldS) => set({ yieldS })} />
        <YieldEnvelope s1={q.s1} s2={q.s2} Y={p.yieldS} />
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Tresca" value={fmt(tresca, 3)} unit="MPa" tone={safe ? 'accent' : 'warn'} />
          <Readout label="Von Mises" value={fmt(mises, 3)} unit="MPa" tone={mises < p.yieldS ? 'accent' : 'warn'} />
          <Readout label="Safety factor" value={fmt(p.yieldS / Math.max(tresca, 1e-6), 3)} />
        </div>
        <Note>The red dot is this state. Green is Tresca’s hexagon, blue von Mises’ ellipse: the hexagon is always inside, so Tresca is the cautious one.</Note>
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'Stress on a turned plane', tex: '\\sigma_n = \\dfrac{\\sigma_x+\\sigma_y}{2} + \\dfrac{\\sigma_x-\\sigma_y}{2}\\cos 2\\theta + \\tau_{xy}\\sin 2\\theta', result: `=${n(rot.sn, 3)}\\ \\text{MPa}` },
            { label: 'Shear on it', tex: '\\tau_n = -\\dfrac{\\sigma_x-\\sigma_y}{2}\\sin 2\\theta + \\tau_{xy}\\cos 2\\theta', result: `=${n(rot.tn, 3)}\\ \\text{MPa}` },
            { label: 'Centre and radius', tex: 'C = \\dfrac{\\sigma_x+\\sigma_y}{2},\\quad R = \\sqrt{\\left(\\dfrac{\\sigma_x-\\sigma_y}{2}\\right)^2 + \\tau_{xy}^2}', result: `C = ${n(q.centre, 3)},\\ R = ${n(q.tauMax, 3)}\\ \\text{MPa}` },
            { label: 'Principal stresses', tex: '\\sigma_{1,2} = C \\pm R', result: `=${n(q.s1, 3)},\\ ${n(q.s2, 3)}\\ \\text{MPa}` },
            { label: 'Principal plane', tex: '\\tan 2\\theta_p = \\dfrac{2\\tau_{xy}}{\\sigma_x-\\sigma_y}', result: `\\theta_p = ${n(deg(q.thetaP), 3)}^\\circ` },
            { label: 'Tresca, the largest difference', tex: '\\sigma_{\\text{eq}} = \\sigma_{\\max} - \\sigma_{\\min}', result: `=${n(tresca, 3)}\\ \\text{MPa}` },
            { label: 'Von Mises', tex: '\\sigma_{\\text{eq}} = \\sqrt{\\tfrac12\\left[(\\sigma_1-\\sigma_2)^2 + (\\sigma_2-\\sigma_3)^2 + (\\sigma_3-\\sigma_1)^2\\right]}', result: `=${n(mises, 3)}\\ \\text{MPa}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>σx + σy is the same on any pair of perpendicular faces: the first invariant.</li>
          <li>Principal planes carry no shear. The largest in-plane shear is on planes 45° from them, and equals half the difference.</li>
          <li>In plane stress the third principal stress is zero: remember it when finding the true largest shear.</li>
          <li>Hydrostatic stress alone does not cause yield, by either criterion.</li>
        </ExamList>
      </Section>
    </div>
  )
}
