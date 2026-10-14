import { Html } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, merge } from '@/geometry'
import { cabMount } from '@/parts/lib/chassis'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { TRACTOR } from '@/tractor/dims'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { rod } from '@/modules/implements/_shared/geom'
import { ANTHRO, C, CAB, CAB_ROOF, CONTROLS, INTERVAL_COLOR, SEAT_Y, SEG, dueAt, useCab, type Control, type Percentile } from './model'

const { PI } = Math
export const pose = createTractorPose({ hitchHeight: 0.6 })
const clock = { t: 0 }

const INFO = {
  cab: {
    summary: 'Operator’s cab on isolation mounts.',
    role: 'Encloses the operator: noise at the ear falls from about 96 to 88 dB(A); heating, ventilation and air conditioning keep the operator comfortable.',
    details: 'Cab height 185 cm. HVAC: about 8.2 kW heating, 7.0 kW cooling, pressurised to 50–100 Pa to keep dust out. Its frame is designed as the ROPS.',
  },
  glass: { summary: 'Cab glazing.', role: 'All-round vision while shutting out noise and dust.' },
  mounts: { summary: 'Cab isolation mounts.', role: 'Rubber mounts between the cab and the chassis cut the structure-borne vibration and noise reaching the operator.' },
  rops: {
    summary: 'Roll-over protective structure (ROPS).',
    role: 'With a seat belt, keeps the operator inside a protected zone if the tractor overturns — the cause of 52–54 % of on-farm tractor deaths.',
    details: 'Standards ASAE S383 and S310.2; designed with finite elements; tested by static or dynamic lab loading, a crush test, a field upset test and a temperature–material test. Required from 1976 on tractors over 20 hp used by hired operators.',
  },
  controls: { summary: 'Controls and instruments (numbered).', role: 'Placed so the right limb can reach and work each one; grouped and marked with standard symbols (ASAE S304) and gauges grouped as SAE J209.', details: 'A typical set of 21 controls and instruments. The clutch is worked by the left foot.' },
  panel: { summary: 'Instrument panel.', role: 'About 71 cm from the eye and tilted no more than 45°, so the gauges can be read at a glance.' },
  mannequin: { summary: 'Seated operator (anthropometric mannequin).', role: '5th / 50th / 95th percentile stature 162 / 173 / 185 cm, sitting height 84 / 91 / 97 cm, mass 58 / 75 / 98 kg. The station must fit the small operator’s reach and the large operator’s headroom.', details: 'Limb lengths are assumed standard body proportions.' },
}

/* ------------------------------ cab geometry ------------------------------ */

function cabGeometry() {
  const { x0, x1, floor, hw } = CAB
  const top = CAB_ROOF
  const post = (x: number, z: number) => box(0.07, top - floor - 0.45, 0.07).translate(x, (top + floor + 0.45) / 2, z)
  const frame = merge(
    post(x0, hw),
    post(x0, -hw),
    post(x1, hw),
    post(x1, -hw),
    box(x1 - x0 + 0.16, 0.08, 2 * hw + 0.16).translate((x0 + x1) / 2, top + 0.04, 0),
    box(x1 - x0, 0.06, 0.06).translate((x0 + x1) / 2, floor + 0.5, hw),
    box(x1 - x0, 0.06, 0.06).translate((x0 + x1) / 2, floor + 0.5, -hw),
    box(0.06, 0.06, 2 * hw).translate(x0, floor + 0.5, 0),
    box(0.06, 0.06, 2 * hw).translate(x1, floor + 0.5, 0),
  )
  const glass = merge(
    box(0.01, top - floor - 0.62, 2 * hw - 0.08).translate(x1, (top + floor + 0.6) / 2, 0),
    box(0.01, top - floor - 0.6, 2 * hw - 0.08).translate(x0, (top + floor + 0.5) / 2, 0),
    box(x1 - x0 - 0.08, top - floor - 0.58, 0.01).translate((x0 + x1) / 2, (top + floor + 0.5) / 2, hw),
    box(x1 - x0 - 0.08, top - floor - 0.58, 0.01).translate((x0 + x1) / 2, (top + floor + 0.5) / 2, -hw),
  )
  const mounts = merge(...[[x0, hw], [x0, -hw], [x1, hw], [x1, -hw]].map(([x, z]) => cabMount(0.05, 0.06).translate(x, floor + 0.47, z)))
  return { frame, glass, mounts }
}

function controlGeometry(c: Control) {
  switch (c.kind) {
    case 'pedal':
      return merge(box(0.07, 0.015, 0.09).rotateZ(-0.6), rod([0.02, 0, 0], [0.12, -0.18, 0], 0.01, 6))
    case 'lever':
      return merge(rod([0, -0.15, 0], [0, 0.05, 0], 0.008, 6), new THREE.IcosahedronGeometry(0.022, 1).translate(0, 0.06, 0))
    case 'gauge':
      return cylinder(0.035, 0.012, 20).rotateZ(PI / 2 - 0.5)
    case 'knob':
    case 'switch':
      return cylinder(0.014, 0.03, 10).rotateZ(PI / 2)
    case 'wheel':
      return new THREE.TorusGeometry(0.21, 0.016, 8, 32).rotateX(PI / 2).rotateZ(0.6)
  }
}

/* ------------------------------ mannequin ------------------------------ */

function solve2(ax: number, ay: number, bx: number, by: number, l1: number, l2: number, up: number) {
  // 2-link IK in a plane: joint between A and B with link lengths l1, l2 (bent towards `up` side)
  const dx = bx - ax
  const dy = by - ay
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-4)
  const a = Math.atan2(dy, dx)
  const c = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
  const t = a + up * c
  return { x: ax + l1 * Math.cos(t), y: ay + l1 * Math.sin(t), reach: Math.hypot(dx, dy) <= l1 + l2 }
}

export function mannequinPose(p: Percentile) {
  const A = ANTHRO[p]
  const H = A.height
  const hip = { x: TRACTOR.seat.x - 0.02, y: SEAT_Y + 0.1 }
  const shoulder = { x: hip.x + 0.06, y: SEAT_Y + A.sitting * 0.62 }
  const head = { x: shoulder.x + 0.02, y: SEAT_Y + A.sitting - 0.11 }
  const foot = { x: 0.44, y: 1.0 }
  const knee = solve2(hip.x, hip.y, foot.x, foot.y, SEG.thigh * H, SEG.shank * H * 0.92, 1)
  const hand = { x: TRACTOR.steeringWheel.x - 0.1, y: TRACTOR.steeringWheel.y + 0.04 }
  const elbow = solve2(shoulder.x, shoulder.y, hand.x, hand.y, SEG.upperArm * H, SEG.forearm * H, -1)
  return { hip, shoulder, head, foot, knee, hand, elbow, reachesWheel: elbow.reach, reachesPedal: knee.reach }
}

function Mannequin() {
  const p = useCab((s) => s.percentile)
  const geo = useMemo(() => {
    const m = mannequinPose(p)
    const A = ANTHRO[p]
    const sx = A.mass / 75
    const P = (q: { x: number; y: number }, z: number): [number, number, number] => [q.x, q.y, z]
    const limbs: THREE.BufferGeometry[] = []
    for (const z of [0.1, -0.1]) limbs.push(rod(P(m.hip, z), P(m.knee, z), 0.06 * Math.sqrt(sx), 10), rod(P(m.knee, z), P(m.foot, z), 0.045 * Math.sqrt(sx), 10), new THREE.SphereGeometry(0.05, 10, 8).translate(m.foot.x + 0.04, m.foot.y, z))
    for (const z of [0.2, -0.2]) limbs.push(rod(P(m.shoulder, z * 0.95), P(m.elbow, z * 0.9), 0.04, 8), rod(P(m.elbow, z * 0.9), P(m.hand, z * 0.8), 0.033, 8))
    const torso = merge(rod(P(m.hip, 0), P(m.shoulder, 0), 0.16 * Math.sqrt(sx), 14), new THREE.SphereGeometry(0.11, 14, 10).scale(1, 1.15, 1).translate(m.head.x, m.head.y, 0))
    return { limbs: merge(...limbs), torso }
  }, [p])
  return (
    <Part id="mannequin" name={`${p}th percentile operator`} role="static" material="nylon" cut={false} info={INFO.mannequin} cites={[C.he('Table 10.6'), C.beyond('body segment proportions')]}>
      <PartMesh geometry={geo.torso} />
      <PartMesh geometry={geo.limbs} />
    </Part>
  )
}

/* ------------------------------ noise waves ------------------------------ */

function NoiseWaves() {
  const station = useCab((s) => s.station)
  const show = useCab((s) => s.waves)
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const geo = useMemo(() => new THREE.SphereGeometry(1, 24, 16), [])
  const mats = useMemo(() => [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial({ color: '#f5b942', transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide, wireframe: true })), [])
  useSimFrame((dt) => {
    clock.t += dt
    refs.current.forEach((m, i) => {
      if (!m) return
      const u = (clock.t * 0.6 + i / 4) % 1
      m.scale.setScalar(0.3 + u * 2.6)
      mats[i].opacity = (1 - u) * (station === 'cab' ? 0.08 : 0.22)
    })
  })
  if (!show) return null
  return (
    <group position={[1.3, 1.3, 0]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => {
          refs.current[i] = el
        }} geometry={geo} material={mats[i]} />
      ))}
    </group>
  )
}

/* ------------------------------ scene ------------------------------ */

export function Cab3D() {
  const station = useCab((s) => s.station)
  const interval = useCab((s) => s.interval)
  const numbers = useCab((s) => s.numbers)
  const labels = useView((s) => s.labels)
  const g = useMemo(cabGeometry, [])
  const ctrls = useMemo(() => CONTROLS.map(controlGeometry), [])
  const panel = useMemo(() => box(0.06, 0.16, 0.5).rotateZ(-0.5).translate(0.45, 1.5, 0), [])
  useSimFrame((dt) => {
    pose.engineAngle += dt * 2 * PI * 12
  })
  const due = interval ? dueAt(interval) : []
  return (
    <group>
      <Tractor pose={pose} internals={false} labels={false} rops={station === 'rops'} />
      {station === 'cab' && (
        <Part id="cab" name="Cab" role="static" material="paintRed" info={INFO.cab} cites={[C.he('p22–23, Fig 10.11, Table 10.7'), C.he('p5, p22 — 96 vs 88 dB(A)')]} cut={false}>
          <PartMesh geometry={g.frame} />
          <Part id="cab-glass" name="Cab glazing" role="static" material="glass" info={INFO.glass}>
            <PartMesh geometry={g.glass} castShadow={false} />
          </Part>
          <Part id="cab-mounts" name="Isolation mounts" role="static" material="rubber" info={INFO.mounts} cites={[C.he('p22, Fig 10.11')]}>
            <PartMesh geometry={g.mounts} />
          </Part>
        </Part>
      )}
      <Part id="controls" name="Controls and instruments" role="static" material="paintBlack" info={INFO.controls} cites={[C.he('p2, Fig 10.1'), C.he('p15–16, Figs 10.7–10.8')]} beyondNotes cut={false}>
        <Part id="instrument-panel" name="Instrument panel" role="static" material="paintGrey" info={INFO.panel} cites={[C.he('p14–16')]}>
          <PartMesh geometry={panel} />
        </Part>
        {CONTROLS.map((c, i) => (
          <Part key={c.name} id={`control-${i + 1}`} name={`${i + 1}. ${c.name}`} role="static" material={c.kind === 'gauge' ? 'chrome' : c.kind === 'pedal' ? 'steelDark' : c.kind === 'wheel' ? 'plastic' : 'paintRed'} info={{ summary: `${i + 1}. ${c.name} — ${c.limb}.`, role: c.role }}>
            <PartMesh geometry={ctrls[i]} position={c.at} />
          </Part>
        ))}
      </Part>
      <Mannequin />
      <NoiseWaves />
      {numbers &&
        labels &&
        CONTROLS.map((c, i) => (
          <Html key={c.name} position={[c.at[0], c.at[1] + 0.06, c.at[2]]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{ font: '600 10px Inter, sans-serif', color: '#10140f', background: '#f5b942', borderRadius: 8, padding: '0 4px', transform: 'translate(-50%, -50%)' }}>{i + 1}</div>
          </Html>
        ))}
      {due.map((s) => (
        <Html key={s.item} position={s.at} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ font: '500 10.5px Inter, sans-serif', color: '#10140f', background: INTERVAL_COLOR[s.interval], borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap', transform: 'translate(-50%, -100%)' }}>
            {s.interval} h · {s.item}
          </div>
        </Html>
      ))}
      <PartLabel partId="mannequin" at={[TRACTOR.seat.x - 0.1, SEAT_Y + ANTHRO[50].sitting + 0.15, 0.25]} />
      {station === 'cab' && <PartLabel partId="cab-mounts" at={[CAB.x0, CAB.floor + 0.35, CAB.hw + 0.1]} />}
      {station === 'cab' && <PartLabel partId="cab" at={[CAB.x1, CAB_ROOF + 0.12, CAB.hw]} />}
      {station === 'rops' && <PartLabel partId="tractor-rops" at={[-0.42, 2.4, 0]} />}
      <PartLabel partId="instrument-panel" at={[0.5, 1.68, 0.3]} />
    </group>
  )
}
