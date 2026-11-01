import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { polarSolid, polarTube, shaftStress, shaftTorque, solidShaftForStress, twist } from '@/physics/strength'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { ExamList } from '../../mechanisms/_shared/rig'

export const FLOOR = -0.42
const along = mat4.rz(Math.PI / 2)
const DRAWN = 1.5
const X0 = -DRAWN / 2

interface Params {
  /** torque, kN·m; length, m; outer and inner diameter, mm; G, GPa */
  T: number
  L: number
  D: number
  d: number
  hollow: boolean
  G: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { T: 25, L: 3, D: 146, d: 125, hollow: true, G: 85 }
export const useTorsion = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useTorsion.getState().set(p)

const analyse = (p: Params) => {
  const D = p.D / 1000
  const d = p.hollow ? p.d / 1000 : 0
  const J = p.hollow ? polarTube(D, d) : polarSolid(D)
  const T = p.T * 1000
  return { J, T, tau: shaftStress(T, D / 2, J), tauIn: shaftStress(T, d / 2, J), theta: twist(T, p.L, p.G * 1e9, J), R: D / 2, r: d / 2 }
}

/** The shaft, with a straight generator line that twists into a helix as the torque comes on. */
export function Torsion3D() {
  const p = useTorsion()
  const a = useMemo(() => analyse(p), [p])
  const k = Math.min(1.6, 0.11 / (p.D / 1000)) // shaft radius is drawn at about 0.08 m, whatever its size
  const Rd = Math.min(0.12, Math.max(0.05, (p.D / 1000) * k * 0.7))
  const rd = p.hollow ? (Rd * p.d) / p.D : 0
  // a twist so small it could not be seen is drawn larger; this is flagged in the panel
  const show = useMemo(() => Math.max(Math.min(1.4, Math.abs(a.theta) * 6), Math.abs(a.theta)), [a.theta])
  const eased = useRef(0)
  const end = useRef<THREE.Group>(null)
  const line = useRef<THREE.Mesh>(null)
  const lastTwist = useRef(-1)
  const geo = useMemo(
    () => ({
      shaft: xform(p.hollow && rd > 0.001 ? tube(Rd, rd, DRAWN, 56) : cylinder(Rd, DRAWN, 56), along),
      chuck: merge(xform(cylinder(Rd + 0.05, 0.1, 40), mat4.c(mat4.t(X0 - 0.05, 0, 0), along))),
      arm: merge(xform(cylinder(Rd + 0.05, 0.1, 40), mat4.c(mat4.t(0.05, 0, 0), along)), xform(box(0.04, 0.05, 0.62), mat4.t(0.05, 0, 0))),
      wall: xform(box(0.2, 0.7, 0.5), mat4.t(X0 - 0.2, FLOOR + 0.35, 0)),
      stand: merge(xform(box(0.14, -FLOOR - Rd - 0.04, 0.3), mat4.t(-X0 + 0.05, (FLOOR - Rd - 0.04) / 2, 0)), xform(box(2.3, 0.03, 0.7), mat4.t(0, FLOOR + 0.015, 0))),
      pan: merge(xform(cylinder(0.006, 0.26, 10), mat4.t(0, -0.13, 0)), xform(cylinder(0.06, 0.012, 28), mat4.t(0, -0.26, 0))),
    }),
    [p.hollow, Rd, rd],
  )
  /** the line drawn along the shaft: straight at no load, a helix under torque */
  const helix = useMemo(
    () => (angle: number) => {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 40; i++) {
        const u = i / 40
        const t = angle * u
        pts.push(new THREE.Vector3(X0 + u * DRAWN, (Rd + 0.003) * Math.cos(t), (Rd + 0.003) * Math.sin(t)))
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.004, 6)
    },
    [Rd],
  )
  const firstLine = useMemo(() => helix(0), [helix])

  useSimFrame(() => {
    // the shaft takes up its twist gradually, to show it happening
    eased.current += (show - eased.current) * 0.06
    end.current?.rotation.set(eased.current, 0, 0)
    if (line.current && Math.abs(eased.current - lastTwist.current) > 0.003) {
      lastTwist.current = eased.current
      line.current.geometry.dispose()
      line.current.geometry = helix(eased.current)
    }
  })

  return (
    <group>
      <Part id="wall" name="Fixed end" role="static" material="castIron" info={{ summary: 'Holds one end of the shaft from turning.', role: 'The whole torque is carried back into the frame here.' }} cut={false}>
        <PartMesh geometry={geo.wall} />
        <PartMesh geometry={geo.chuck} material="steelDark" />
      </Part>
      <Part id="stand" name="Stand and bearing" role="static" material="paintGrey" info={{ summary: 'Supports the free end.', role: 'Takes its weight, but lets it turn: no torque is lost here.' }} cut={false}>
        <PartMesh geometry={geo.stand} />
      </Part>
      <Part id="shaft" name="Test shaft" role="housing" material="steel" info={{ summary: 'Carries the torque along its length.', role: 'Shear stress grows in a straight line from the centre, so material near the middle does little: which is why hollow shafts save so much weight.' }}>
        <PartMesh geometry={geo.shaft} />
      </Part>
      <mesh ref={line} geometry={firstLine}>
        <meshBasicMaterial color="#d0631c" toneMapped={false} />
      </mesh>
      <group ref={end} position={[-X0, 0, 0]}>
        <Part id="arm" name="Loading arm" role="moving" material="paintOrange" info={{ summary: 'Applies the torque.', role: 'A weight on an arm: torque is force times the arm’s length. The angle it turns through is the twist.' }} cut={false}>
          <PartMesh geometry={geo.arm} />
        </Part>
      </group>
      <PartLabel partId="shaft" at={[0, Rd + 0.08, 0.05]} />
    </group>
  )
}

const PRESETS: Preset[] = [
  { id: 'hollow', label: 'Hollow Ø146/125', note: 'External 146 mm, internal 125 mm, 3 m long, 25 kN·m, G = 85 GPa: the shaft twists 2.45°.', apply: () => set({ ...DEFAULTS }) },
  { id: 'design', label: 'Solid, 80 kW at 3 rev/s', note: 'τ ≤ 70 MPa, G = 90 GPa, and peak torque 4 % over the mean. T = 4.41 kN·m, so Ø68.5 mm.', apply: () => set({ T: (shaftTorque(80e3, 3) * 1.04) / 1000, L: 1, D: 68.5, d: 40, hollow: false, G: 90 }) },
]

export function TorsionPanel() {
  const p = useTorsion()
  const [preset, setPreset] = useState<string | null>('hollow')
  const a = analyse(p)
  const deg = (a.theta * 180) / Math.PI
  // what a solid shaft would need, for the same torque and the same peak stress
  const solidD = solidShaftForStress(a.T, a.tau)
  const areaThis = p.hollow ? (Math.PI * (p.D ** 2 - p.d ** 2)) / 4 : (Math.PI * p.D ** 2) / 4
  const areaSolid = (Math.PI * (solidD * 1000) ** 2) / 4
  const dist = useMemo(() => {
    const rs = Array.from({ length: 81 }, (_, i) => ((i / 80) * p.D) / 2)
    return { rs, t: rs.map((r) => (p.hollow && r < p.d / 2 ? 0 : (a.tau * (r / (p.D / 2))) / 1e6)) }
  }, [p.D, p.d, p.hollow, a.tau])
  return (
    <div>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Twist" value={fmt(deg, 3)} unit="°" tone="warn" />
          <Readout label="Largest stress" value={fmt(a.tau / 1e6, 4)} unit="MPa" tone="accent" />
          <Readout label="Inner stress" value={p.hollow ? fmt(a.tauIn / 1e6, 4) : '0'} unit="MPa" />
          <Readout label="Polar moment J" value={fmt(a.J * 1e12, 4)} unit="mm⁴" />
          <Readout label="Stiffness" value={fmt(((p.G * 1e9 * a.J) / p.L / 1000) * (Math.PI / 180), 4)} unit="kN·m/°" />
          <Readout label="Steel used" value={fmt((100 * areaThis) / areaSolid, 3)} unit="% of solid" tone="info" />
        </div>
        <Note>The orange line was straight along the shaft. It twists into a helix under load, drawn larger than life for small angles. The readings are true.</Note>
      </Section>
      <Section title="The shaft">
        <Slider label="Torque T" value={p.T} min={0.1} max={80} step={0.1} unit="kN·m" onChange={(T) => set({ T })} />
        <Slider label="Length" value={p.L} min={0.5} max={8} step={0.1} unit="m" onChange={(L) => set({ L })} />
        <Slider label="Outer diameter" value={p.D} min={30} max={300} step={0.5} unit="mm" onChange={(D) => set({ D, d: Math.min(p.d, D - 5) })} />
        <Toggle label="Hollow" checked={p.hollow} onChange={(hollow) => set({ hollow })} />
        {p.hollow ? <Slider label="Inner diameter" value={p.d} min={5} max={p.D - 5} step={0.5} unit="mm" onChange={(d) => set({ d })} /> : null}
        <Slider label="Shear modulus G" value={p.G} min={20} max={100} step={1} unit="GPa" onChange={(G) => set({ G })} />
      </Section>
      <Section title="Worked set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Shear stress across the shaft">
        <Chart data={[dist.rs, dist.t]} series={[{ label: 'τ', color: '#e8794f', width: 2 }]} xLabel="Radius (mm)" yLabel="Shear stress (MPa)" height={135} />
        <Note>τ grows in a straight line with radius. The metal near the centre carries little, so removing it costs little strength and saves a lot of weight.</Note>
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'The torsion equation', tex: '\\dfrac{T}{J} = \\dfrac{\\tau}{r} = \\dfrac{G\\theta}{L}' },
            { label: 'Polar second moment', tex: p.hollow ? 'J = \\dfrac{\\pi}{32}(D^4 - d^4)' : 'J = \\dfrac{\\pi D^4}{32}', result: `=${n(a.J * 1e12, 4)}\\ \\text{mm}^4` },
            { label: 'Largest shear stress', tex: '\\tau = \\dfrac{T r}{J}', sub: `=\\dfrac{${n(p.T, 3)}\\times10^6 (${n(p.D / 2, 3)})}{${n(a.J * 1e12, 4)}}`, result: `=${n(a.tau / 1e6, 4)}\\ \\text{MPa}` },
            { label: 'Twist', tex: '\\theta = \\dfrac{T L}{G J}', sub: `=\\dfrac{${n(p.T, 3)}\\times10^3 (${n(p.L, 3)})}{${n(p.G, 3)}\\times10^9 (${n(a.J * 1e12, 4)}\\times10^{-12})}`, result: `=${n(a.theta, 3)}\\ \\text{rad} = ${n(deg, 3)}^\\circ` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>Power: P = 2πN T, with N in rev/s. Design for peak torque, not mean.</li>
          <li>A shaft must meet both limits, stress and twist. Size it for each, and take the larger.</li>
          <li>Assumes a uniform circular section where plane sections stay plane, and stress within the elastic limit.</li>
        </ExamList>
      </Section>
    </div>
  )
}
