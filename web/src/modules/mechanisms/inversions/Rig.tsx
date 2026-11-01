import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { box, cylinder } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Note, Table } from '../../elements/_shared/PanelBits'
import { BenchPlate, ExamList, Trace } from '../_shared/rig'
import { placeBetween, unitRod } from '../_shared/strut'

export const FLOOR = -0.42
const R = 0.13

export type Fixed = 'frame' | 'crank' | 'rod' | 'slider' | 'trammel'

export const INFO: Record<Fixed, { name: string; machine: string; note: string }> = {
  frame: { name: 'Line of stroke fixed', machine: 'Reciprocating engine or pump', note: 'The cylinder stands still, the crank turns and the piston slides. This is the chain as you usually meet it.' },
  crank: { name: 'Crank fixed', machine: 'Whitworth quick return; rotary engine', note: 'Hold the crank still and the whole cylinder runs round it. Early aircraft rotary engines did this, and the Whitworth quick return uses the same inversion.' },
  rod: { name: 'Connecting rod fixed', machine: 'Oscillating cylinder; slotted lever', note: 'Hold the rod still and the cylinder rocks about the pin: the slotted lever of a shaper’s quick return, and the oscillating cylinder engine.' },
  slider: { name: 'Slider fixed', machine: 'Hand pump', note: 'Hold the piston still and the cylinder moves up and down over it: a pendulum or hand pump.' },
  trammel: { name: 'Double slider: trammel', machine: 'Elliptical trammel', note: 'Two sliders on crossed guides. Any point on the bar joining them draws an ellipse. Fix a different link of this chain and you get the scotch yoke or the Oldham coupling.' },
}

interface Params {
  fixed: Fixed
  /** rod ÷ crank */
  n: number
  rpm: number
  /** trammel: distances from the pen to each slider */
  a: number
  b: number
  set: (p: Partial<Params>) => void
  reset: () => void
}

export const DEFAULTS = { fixed: 'frame' as Fixed, n: 3, rpm: 15, a: 0.34, b: 0.16 }
export const useInv = create<Params>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))
const set = (p: Partial<Params>) => useInv.getState().set(p)

type P2 = [number, number]

/** All four links in the frame of whichever is held still. */
function pose(fixed: Exclude<Fixed, 'trammel'>, n: number, t: number) {
  const l = n * R
  const A: P2 = [R * Math.cos(t), R * Math.sin(t)]
  const B: P2 = [A[0] + Math.sqrt(l * l - A[1] * A[1]), 0]
  const O: P2 = [0, 0]
  // the rigid transform that puts the fixed link's frame on the bench
  let origin: P2 = O
  let angle = 0
  if (fixed === 'crank') {
    origin = O
    angle = t
  } else if (fixed === 'rod') {
    origin = A
    angle = Math.atan2(B[1] - A[1], B[0] - A[0])
  } else if (fixed === 'slider') {
    origin = B
    angle = 0
  }
  const c = Math.cos(-angle)
  const s = Math.sin(-angle)
  const T = (q: P2): P2 => {
    const x = q[0] - origin[0]
    const y = q[1] - origin[1]
    return [x * c - y * s, x * s + y * c]
  }
  return { O: T(O), A: T(A), B: T(B), guideEnd: T([(n + 1) * R + 0.1, 0]), guideStart: T([-0.08, 0]), guideAngle: -angle }
}

export function Inversions3D() {
  const p = useInv()
  const trammel = p.fixed === 'trammel'
  const refs = { guide: useRef<THREE.Group>(null), crank: useRef<THREE.Group>(null), rod: useRef<THREE.Group>(null), slider: useRef<THREE.Group>(null), slider2: useRef<THREE.Group>(null), pen: useRef<THREE.Mesh>(null), pivot: useRef<THREE.Group>(null) }
  const phase = useRef(0.5)
  const geo = useMemo(
    () => ({
      guide: unitRod(0.018, 12),
      crank: unitRod(0.013, 12),
      rod: unitRod(0.011, 12),
      slider: box(0.1, 0.07, 0.04),
      cross: box(1.0, 0.024, 0.016),
      crossV: box(0.024, 0.74, 0.016),
      pin: cylinder(0.012, 0.03, 20).rotateX(Math.PI / 2),
      ball: new THREE.SphereGeometry(0.012, 18, 12),
    }),
    [],
  )
  const ellipse = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 2 * Math.PI
      pts.push([p.a * Math.cos(t), p.b * Math.sin(t), 0.05])
    }
    return pts
  }, [p.a, p.b])

  // where the chain sits on the plate, so each inversion is centred as it moves
  const offset = (f: Fixed): [number, number] => (f === 'frame' ? [-0.2, 0] : f === 'crank' ? [0, 0] : f === 'rod' ? [-0.1, 0] : [0.1, 0])

  useSimFrame((dt) => {
    const s = useInv.getState()
    phase.current += (s.rpm * 2 * Math.PI * dt) / 60
    const t = phase.current
    const z = (q: P2, h = 0.03): [number, number, number] => [q[0], q[1], h]
    if (s.fixed === 'trammel') {
      const L = s.a + s.b
      // sliders on the axes: X at (L cos t, 0)... the pen at distance a from the y slider
      const sx: P2 = [L * Math.cos(t), 0]
      const sy: P2 = [0, L * Math.sin(t)]
      placeBetween(refs.rod.current, z(sx, 0.04), z(sy, 0.04))
      refs.slider.current?.position.set(sx[0], sx[1], 0.03)
      refs.slider2.current?.position.set(sy[0], sy[1], 0.03)
      refs.pen.current?.position.set(s.a * Math.cos(t), s.b * Math.sin(t), 0.05)
      return
    }
    const q = pose(s.fixed, s.n, t)
    const [ox, oy] = offset(s.fixed)
    const m = (r: P2): P2 => [r[0] + ox, r[1] + oy]
    placeBetween(refs.guide.current, z(m(q.guideStart), 0.02), z(m(q.guideEnd), 0.02))
    placeBetween(refs.crank.current, z(m(q.O), 0.04), z(m(q.A), 0.04))
    placeBetween(refs.rod.current, z(m(q.A), 0.05), z(m(q.B), 0.05))
    if (refs.slider.current) {
      refs.slider.current.position.set(...z(m(q.B), 0.03))
      refs.slider.current.rotation.set(0, 0, q.guideAngle)
    }
    refs.pivot.current?.position.set(...z(m(q.O), 0.05))
  })

  const fixedColor = (name: Fixed) => (p.fixed === name ? 'paintGrey' : undefined)
  return (
    <group>
      <BenchPlate width={1.2} height={0.86} floor={FLOOR} />
      {trammel ? (
        <>
          <Part id="guides" name="Crossed guides" role="static" material="paintGrey" info={{ summary: 'Two grooves at right angles: the fixed link.', role: 'Each slider can only run along its own groove.' }} cut={false}>
            <mesh geometry={geo.cross} position={[0, 0, 0.012]}>
              <meshStandardMaterial color="#5c6670" />
            </mesh>
            <mesh geometry={geo.crossV} position={[0, 0, 0.012]}>
              <meshStandardMaterial color="#5c6670" />
            </mesh>
          </Part>
          <group ref={refs.slider}>
            <Part id="slider-x" name="Horizontal slider" role="moving" material="paintBlue" info={{ summary: 'Runs along the horizontal groove.', role: 'A sliding pair.' }} cut={false}>
              <PartMesh geometry={geo.slider} />
            </Part>
          </group>
          <group ref={refs.slider2}>
            <Part id="slider-y" name="Vertical slider" role="moving" material="paintOrange" info={{ summary: 'Runs along the vertical groove.', role: 'A sliding pair at right angles to the first.' }} cut={false}>
              <PartMesh geometry={geo.slider} />
            </Part>
          </group>
          <group ref={refs.rod}>
            <Part id="bar" name="Trammel bar" role="moving" material="paintRed" info={{ summary: 'Joins the two sliders.', role: 'A point at distances a and b from the sliders draws an ellipse with those semi-axes.' }} cut={false}>
              <PartMesh geometry={geo.rod} />
            </Part>
          </group>
          <mesh ref={refs.pen} geometry={geo.ball}>
            <meshBasicMaterial color="#d0631c" toneMapped={false} />
          </mesh>
          <Trace points={ellipse} />
        </>
      ) : (
        <>
          <group ref={refs.guide}>
            <Part id="guide" name={p.fixed === 'frame' ? 'Cylinder (fixed)' : 'Cylinder'} role={p.fixed === 'frame' ? 'static' : 'moving'} material={fixedColor('frame') ?? 'paintBlue'} info={{ summary: 'Link 1, the line of stroke.', role: 'The slider runs along it. In this inversion it may or may not be what stands still.' }} cut={false}>
              <PartMesh geometry={geo.guide} />
            </Part>
          </group>
          <group ref={refs.crank}>
            <Part id="crank" name={p.fixed === 'crank' ? 'Crank (fixed)' : 'Crank'} role={p.fixed === 'crank' ? 'static' : 'moving'} material={fixedColor('crank') ?? 'paintOrange'} info={{ summary: 'Link 2.', role: 'A turning pair at each end.' }} cut={false}>
              <PartMesh geometry={geo.crank} />
            </Part>
          </group>
          <group ref={refs.rod}>
            <Part id="rod" name={p.fixed === 'rod' ? 'Rod (fixed)' : 'Connecting rod'} role={p.fixed === 'rod' ? 'static' : 'moving'} material={fixedColor('rod') ?? 'paintRed'} info={{ summary: 'Link 3.', role: 'A turning pair at each end.' }} cut={false}>
              <PartMesh geometry={geo.rod} />
            </Part>
          </group>
          <group ref={refs.slider}>
            <Part id="slider" name={p.fixed === 'slider' ? 'Slider (fixed)' : 'Slider'} role={p.fixed === 'slider' ? 'static' : 'moving'} material={fixedColor('slider') ?? 'aluminium'} info={{ summary: 'Link 4.', role: 'A sliding pair on the line of stroke, a turning pair with the rod.' }} cut={false}>
              <PartMesh geometry={geo.slider} />
            </Part>
          </group>
          <group ref={refs.pivot}>
            <PartMesh geometry={geo.pin} material="chrome" />
          </group>
        </>
      )}
      <PartLabel partId={trammel ? 'bar' : 'rod'} at={[0, 0.38, 0.05]} />
    </group>
  )
}

export function InversionsPanel() {
  const p = useInv()
  const info = INFO[p.fixed]
  return (
    <div>
      <Section title="Live">
        <div className="rounded-lg border border-line-2 bg-panel-2 p-2.5">
          <div className="text-[13px] font-semibold text-ink">{info.machine}</div>
          <div className="mt-0.5 text-[11.5px] text-mute">{info.name}</div>
          <p className="mt-1.5 text-[12px] leading-snug text-ink/85">{info.note}</p>
        </div>
      </Section>
      <Section title="Hold this link still">
        <Segmented<Fixed>
          value={p.fixed}
          onChange={(fixed) => set({ fixed })}
          options={[
            { value: 'frame', label: 'Line of stroke' },
            { value: 'crank', label: 'Crank' },
            { value: 'rod', label: 'Rod' },
            { value: 'slider', label: 'Slider' },
          ]}
        />
        <button onClick={() => set({ fixed: 'trammel' })} className={`mt-2 w-full rounded-md border px-2 py-1 text-left text-[12px] ${p.fixed === 'trammel' ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/85 hover:border-accent/50'}`}>
          Double slider chain: elliptical trammel
        </button>
        <Slider label="Speed" value={p.rpm} min={2} max={40} step={1} unit="rpm" onChange={(rpm) => set({ rpm })} />
        {p.fixed === 'trammel' ? (
          <>
            <Slider label="Pen to first slider, a" value={p.a * 1000} min={120} max={360} step={10} unit="mm" onChange={(v) => set({ a: v / 1000 })} />
            <Slider label="Pen to second slider, b" value={p.b * 1000} min={60} max={260} step={10} unit="mm" onChange={(v) => set({ b: v / 1000 })} />
            <div className="grid grid-cols-2 gap-1.5">
              <Readout label="Semi-major" value={fmt(p.a * 1000, 3)} unit="mm" />
              <Readout label="Semi-minor" value={fmt(p.b * 1000, 3)} unit="mm" />
            </div>
          </>
        ) : (
          <Slider label="Rod ÷ crank" value={p.n} min={1.5} max={4} step={0.1} onChange={(n) => set({ n })} />
        )}
        <Note>The relative motion of the links never changes between inversions: only what you measure against. The motion looks different because the eye takes the fixed link as still.</Note>
      </Section>
      <Section title="The three chains">
        <Table
          head={['Chain', 'Inversions']}
          rows={[
            ['Four-bar', 'crank-rocker, double crank, double rocker'],
            ['Single slider', 'engine, rotary engine and Whitworth, oscillating cylinder, hand pump'],
            ['Double slider', 'elliptical trammel, scotch yoke, Oldham coupling'],
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>A kinematic chain becomes a mechanism when one link is fixed. A different link fixed gives a different mechanism: an inversion.</li>
          <li>Relative motions between links stay the same; absolute motions, measured from the fixed link, change.</li>
          <li>A chain with four links has at most four distinct inversions.</li>
        </ExamList>
      </Section>
    </div>
  )
}
