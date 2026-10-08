import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { ForceArrow } from '../_shared/Arrow'
import { A503 } from '../_shared/cites'
import { InstancedPartMesh } from '../_shared/InstancedPartMesh'
import { TYPES, cageOmega, live, useBearings, type BearingType } from './model'
import { JOURNAL, bearingGeometry, housingGeometry } from './parts'

const { PI } = Math
export const FLOOR = -0.074
const MM = 0.001

const C7 = [A503.m(7, 'slides 2–11'), A503.mg15('Q4a'), A503.mg16('Q4c')]

const TYPE_INFO: Record<BearingType, { summary: string; role: string; details?: string }> = {
  ball: {
    summary: 'Single-row deep-groove ball bearing, series 208 (Ø40 × Ø80 × 18 mm) with 9 balls of 12 mm.',
    role: 'Load passes through the balls in rolling contact. Takes radial load and moderate thrust; used for small and medium loads.',
    details: 'Static capacity from Stribeck: C₀ = KZD²/5 = 60.8×10⁶ × 9 × 0.012²/5 = 15 760 N (SKF 6208: 16 600 N).',
  },
  roller: {
    summary: 'Straight (cylindrical) roller bearing, NU type: ribs on the outer ring, plain inner ring.',
    role: 'Line contact carries a greater load than a ball bearing of the same size, but it needs almost perfect geometry and takes no thrust.',
  },
  taper: {
    summary: 'Tapered roller bearing: cone (inner ring), cup (outer ring) and tapered rollers whose axes meet at one point on the shaft axis.',
    role: 'Combines the advantages of ball and straight roller bearings: takes radial, thrust or combined loads with a high capacity. Used in pairs (wheel hubs, final drives).',
    details: 'Contact angle of the cup here 15°; the apex geometry makes the rollers roll without skidding.',
  },
  needle: {
    summary: 'Needle roller bearing: many long, thin rollers.',
    role: 'High radial capacity in a very small radial space (universal-joint crosses, gearbox idlers).',
  },
  thrust: {
    summary: 'Single-direction thrust ball bearing: shaft washer, housing washer and a ball set.',
    role: 'Carries axial (thrust) load only — e.g. under a vertical shaft or a clutch release.',
    details: 'Other common rolling-bearing types: deep-groove, self-aligning, angular-contact, straight, tapered, needle and spherical roller bearings.',
  },
  journal: {
    summary: 'Journal (plain, sliding) bearing: the journal turns inside a stationary bronze bush on a film of oil.',
    role: 'Examples: crankshaft and connecting-rod bearings. Quiet at speed and compact radially, but it fails suddenly, while a rolling bearing gives warning by becoming noisy.',
    details: `Clearance and eccentricity are exaggerated (${JOURNAL.clearance} mm, e = ${JOURNAL.ecc} mm) so the converging oil wedge can be seen.`,
  },
}

export function Bearings3D() {
  const type = useBearings((s) => s.type)
  return <Assembly key={type} type={type} />
}

function Assembly({ type }: { type: BearingType }) {
  const spec = TYPES[type]
  const g = useMemo(() => bearingGeometry(type), [type])
  const h = useMemo(() => housingGeometry(type), [type])
  const shaft = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const cageRef = useRef<THREE.Group>(null)
  const elems = useRef<THREE.InstancedMesh>(null)
  const theta = useRef(0)
  const cageA = useRef(0)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), r: new THREE.Matrix4(), s: new THREE.Matrix4() }), [])

  const writeElements = (cage: number, spin: number) => {
    const mesh = elems.current
    if (!mesh) return
    g.placements.forEach((pl, i) => {
      tmp.r.makeRotationY(cage)
      tmp.s.makeRotationY(spin)
      tmp.m.copy(tmp.r).multiply(pl).multiply(tmp.s)
      mesh.setMatrixAt(i, tmp.m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  useLayoutEffect(() => {
    writeElements(0, 0)
    elems.current?.computeBoundingSphere()
  })

  useSimFrame((dt) => {
    const st = useBearings.getState()
    const w = (st.rpm * 2 * PI) / 60
    theta.current += w * dt
    cageA.current += cageOmega(st, w) * dt
    shaft.current?.rotation.set(0, theta.current, 0)
    inner.current?.rotation.set(0, theta.current, 0)
    cageRef.current?.rotation.set(0, cageA.current, 0)
    if (spec.Z) writeElements(cageA.current, -(theta.current - cageA.current) * (spec.Dp / Math.max(spec.Dw, 1e-6)) * 0.5)
    live.theta = theta.current
    live.cage = cageA.current
  })

  const journal = type === 'journal'
  const shaftOffset: [number, number, number] = journal ? [JOURNAL.ecc * Math.cos(JOURNAL.attitude) * MM, 0, -JOURNAL.ecc * Math.sin(JOURNAL.attitude) * MM] : [0, 0, 0]
  const zEnd = 0.075
  const scaleF = 0.05 / 5000

  return (
    <group>
      <group rotation={[PI / 2, 0, 0]}>
        <Part id="bearing" name={`${spec.label} bearing (${spec.code})`} role="static" material="steel" info={TYPE_INFO[type]} cites={C7} beyondNotes={type === 'thrust'}>
          {g.outer ? (
            <Part id="outer-ring" name={g.outerName} role="static" material="steel" info={{ summary: g.outerName + '.', role: 'Pressed into the housing; does not turn. Its raceway carries the rolling elements.' }} cites={[A503.m(7, 'features of rolling bearing')]} explode={[0, 0, 0]}>
              <PartMesh geometry={g.outer} />
            </Part>
          ) : null}
          {g.inner ? (
            <Part id="inner-ring" name={g.innerName} role="static" material="steel" info={{ summary: g.innerName + '.', role: 'A tight fit on the shaft and turns with it (rotation factor V = 1.0; V = 1.2 if the inner ring is stationary relative to the load).' }} cites={[A503.m(7, 'slide 22')]} explode={[0, 0.05, 0]}>
              <group ref={inner}>
                <PartMesh geometry={g.inner} />
              </group>
            </Part>
          ) : null}
          {spec.Z ? (
            <Part id="elements" name={type === 'ball' || type === 'thrust' ? 'Balls' : type === 'needle' ? 'Needle rollers' : 'Rollers'} role="moving" material="chrome" info={{ summary: `${spec.Z} rolling elements, Ø${spec.Dw * 1000} mm.`, role: 'Transfer the load by rolling rather than sliding: low starting friction, can be preloaded, and carry short overloads.', details: 'They orbit with the cage at a little under half shaft speed, ω_c = ω/2·(1 − D cos α / D_p) (standard kinematics, beyond the notes).' }} cites={[A503.m(7, 'slides 3–11'), A503.beyond('ball-set kinematics')]} explode={[0, -0.03, 0]}>
              <InstancedPartMesh ref={elems} geometry={g.element!} count={g.placements.length} />
            </Part>
          ) : null}
          {g.cage ? (
            <Part id="cage" name="Cage (retainer)" role="moving" material="brass" info={{ summary: 'Cage (separator).', role: 'Keeps the rolling elements evenly spaced so they do not rub on each other.' }} cites={[A503.mg15('Q4a — rolling element, cage, races')]} explode={[0, -0.06, 0]}>
              <group ref={cageRef}>
                <PartMesh geometry={g.cage} />
              </group>
            </Part>
          ) : null}
          {g.bush ? (
            <Part id="bush" name="Bronze bush (bearing)" role="static" material="bronze" info={{ summary: 'Stationary bronze bush.', role: 'Supports the journal; nylon, bronze and grease are named in the notes as journal-bearing materials and lubricants.' }} cites={[A503.m(7, 'slides 12–13')]} explode={[0, 0.05, 0]}>
              <PartMesh geometry={g.bush} />
            </Part>
          ) : null}
          {g.oil ? (
            <Part id="oil-film" name="Oil film (exaggerated)" role="fluid" material="oil" beyondNotes info={{ summary: 'Lubricant film between journal and bush.', role: 'The turning journal drags oil into the narrowing gap and builds up a pressure that lifts it off the bush.', details: 'Film thickness magnified about 50×; the minimum film is on the loaded side.' }} cites={[A503.beyond('hydrodynamic film')]}>
              <PartMesh geometry={g.oil} />
            </Part>
          ) : null}
        </Part>
        <Part id="shaft" name="Shaft (Ø40)" role="moving" material="steelDark" info={{ summary: 'Ø40 mm shaft — the journal.', role: 'The bearing supports the rotating shaft and lets it turn with little friction.' }} cites={[A503.mg19('Q4a — why bearings are used')]}>
          <group position={shaftOffset}>
            <group ref={shaft}>
              <PartMesh geometry={h.shaft} />
            </group>
          </group>
        </Part>
        <Part id="housing" name="Bearing housing" role="housing" material="castIron" info={{ summary: 'Housing bore (seat) for the outer ring.', role: 'Locates the bearing and carries the load to the frame.' }} explode={[0, 0, 0.04]}>
          <PartMesh geometry={h.housing} />
        </Part>
      </group>
      <Part id="pedestal" name="Pedestal (plummer block base)" role="housing" material="paintGrey" info={{ summary: 'Pedestal block.', role: 'Bolts the housing to the machine frame.' }} explode={[0, -0.04, 0]}>
        <PartMesh geometry={h.pedestal} />
      </Part>
      <ForceArrow color="#e8794f" spec={() => {
        const s = useBearings.getState()
        return { origin: new THREE.Vector3(0, 0.021, zEnd - 0.02), dir: new THREE.Vector3(0, -1, 0), toward: true, length: s.Fr * scaleF, label: `Fᵣ = ${(s.Fr / 1000).toFixed(1)} kN`, visible: s.showLoads && s.type !== 'thrust' }
      }} />
      <ForceArrow color="#9bd17a" spec={() => {
        const s = useBearings.getState()
        return { origin: new THREE.Vector3(0, 0, zEnd), dir: new THREE.Vector3(0, 0, -1), toward: true, length: s.Fa * scaleF, label: `Fₐ = ${(s.Fa / 1000).toFixed(1)} kN`, visible: s.showLoads && s.type !== 'journal' }
      }} />
      <PartLabel partId={g.outer ? 'outer-ring' : 'bush'} at={[0.045, 0.035, 0.012]} />
      {g.inner ? <PartLabel partId="inner-ring" at={[-0.04, 0.03, 0.015]} /> : null}
      {spec.Z ? <PartLabel partId="elements" at={[0.02, -0.02, 0.02]} /> : null}
      {g.cage ? <PartLabel partId="cage" at={[-0.03, -0.035, 0.02]} /> : null}
      {g.oil ? <PartLabel partId="oil-film" at={[-0.03, -0.03, 0.02]} /> : null}
      <PartLabel partId="shaft" at={[0, 0.03, 0.07]} />
      <PartLabel partId="housing" at={[0.05, 0.05, -0.01]} />
      <PartLabel partId="pedestal" at={[0.06, -0.06, 0.01]} />
    </group>
  )
}
