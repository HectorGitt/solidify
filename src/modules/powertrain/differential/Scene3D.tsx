import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { DriveGraph, brake, coupling, differential, gearMesh, type Constraint } from '@/core/drive'
import { useSimFrame } from '@/core/sim'
import { box } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { placeBevel } from './bevel'
import { getDiffGeometry } from './geometry'
import { APEX, CROWN_ANGLES, DIFF_ANGLES, DIM, R_CROWN, R_PINION, R_SIDE, R_SPIDER, live, radps, rpm, useDiff } from './model'

const { PI } = Math
const rad = (d: number) => (d * PI) / 180
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const O = V(0, 0, 0)

/** Static placements: every bevel gear shares the apex at the differential centre. */
const PLACE = {
  pinion: placeBevel(O, V(0, 0, -1), R_PINION, rad(CROWN_ANGLES.pinion), V(1, 0, 0), DIM.zPinion, true),
  crown: placeBevel(O, V(-1, 0, 0), R_CROWN, rad(CROWN_ANGLES.gear), V(0, 0, 1), DIM.zCrown, false),
  // side gears are built in their half-shaft frame; the right shaft frame is turned 180° about Y
  side: placeBevel(O, V(-1, 0, 0), R_SIDE, rad(DIFF_ANGLES.gear), V(0, 1, 0), DIM.zSide, false),
  spiders: [V(0, 1, 0), V(0, -1, 0), V(0, 0, 1), V(0, 0, -1)].map((d) =>
    placeBevel(O, d.clone().negate(), R_SPIDER, rad(DIFF_ANGLES.pinion), V(1, 0, 0), DIM.zSpider, true),
  ),
}

const C = {
  diff: [SRC.tts510('p7–8, Fig 34'), SRC.pt510('p11–12'), SRC.top510('p2, Fig A2.5a/b')],
  crown: [SRC.tts510('p7 crown wheel and pinion'), SRC.top510('p3 gear ratios')],
  lock: [SRC.tts510('p8 diff lock'), SRC.pt510('p12'), SRC.top510('p10 MF hydraulic diff lock')],
  axle: [SRC.tts510('p8–10, Figs 34–35'), SRC.top510('p10, Fig A2.15')],
}

const INFO = {
  axle: {
    summary: 'Tractor rear axle: crown wheel and pinion, bevel differential, diff lock and half shafts.',
    details: 'Gear sizes are typical values (47 : 11 crown wheel, 16-tooth side gears, 10-tooth planet pinions).',
  },
  pinion: {
    summary: 'Bevel pinion on the end of the gearbox output shaft.',
    role: 'Turns the drive through 90°, because the wheels run at right angles to the crankshaft, and gives the second of the three speed reductions.',
  },
  crown: {
    summary: 'Crown wheel (47 teeth), bolted to the differential cage.',
    role: 'Driven by the small pinion, so it turns much more slowly than the gearbox shaft (here 47/11 = 4.27 : 1). Most tractors use helical (spiral) teeth; straight teeth are drawn here.',
  },
  cage: {
    summary: 'Differential cage (case).',
    role: 'Carries the cross-pins and planet pinions round with the crown wheel. Its speed is always the average of the two half-shaft speeds.',
  },
  spiders: {
    summary: 'Planet (spider) bevel pinions on the cross-pin.',
    role: 'Going straight they do not spin, and the whole unit turns as one. Cornering, they spin on the cross-pin and "walk round" the slower side gear, letting the outer wheel run faster.',
    details: 'Tractors use 2 or 4 planet pinions.',
  },
  pins: { summary: 'Cross-pin(s).', role: 'Hold the planet pinions in the cage; the drive passes from the cage, through the pins, into the planet pinions.' },
  side: {
    summary: 'Side (sun) bevel gears, splined to the half shafts.',
    role: 'Mesh with the planet pinions. If one is held still, the planet pinions roll round it and drive the other at twice cage speed.',
  },
  shafts: { summary: 'Half shafts (differential shafts).', role: 'Carry the drive out to the final reductions and wheels (final drives are in their own scene).' },
  lock: {
    summary: 'Diff lock: dog collar on the left half shaft.',
    role: 'Applied by pedal, it slides into dogs on the cage and locks half shaft and cage together, so both wheels must turn at the same speed. One wheel can no longer spin on its own — but the tractor cannot turn a corner while it is engaged.',
    details: 'Diff locks may be worked mechanically, electrically, hydraulically or automatically. The MF hydraulic version uses a multi-plate clutch and piston controlled by a pedal valve.',
  },
  carrier: { summary: 'Axle centre housing.', role: 'Supports the pinion and cage bearings and holds the oil the gears run in.' },
  oil: { summary: 'Transmission oil.', role: 'The crown wheel dips in it and splashes oil over the gears and bearings.' },
  trumpets: { summary: 'Axle trumpets.', role: 'Tubes that carry the half shafts out to the wheels and take the tractor weight.' },
  wheels: { summary: 'Rear wheels (drawn small).', role: 'Show the two output speeds; the left wheel can be held for the "one wheel held" case.' },
  chock: { summary: 'Left wheel held.', role: 'Stands in for anything that holds one wheel, such as a brake. The other wheel then turns at twice the cage speed.' },
  mud: {
    summary: 'Wet, slippery ground under the right wheel.',
    role: 'The open differential always sends equal torque to both sides, so the firm wheel gets no more than the mud can take — not enough to move the tractor. The mud wheel spins at twice cage speed. Press the diff lock and both wheels must turn together.',
  },
}

function makeGraph() {
  const g = new DriveGraph()
  for (const id of ['pinion', 'cage', 'left', 'right', 'spider']) g.body(id, 1.5)
  g.add(gearMesh('crown-mesh', 'pinion', DIM.zPinion, 'cage', DIM.zCrown, { sameSense: true }))
  g.add(differential('diff', 'cage', 'left', 'right'))
  // planet spin relative to the cage: z_p·ω_p = z_s·(ω_L − ω_c)
  g.add({ id: 'spider', rows: () => [{ c: { spider: DIM.zSpider, left: -DIM.zSide, cage: DIM.zSide }, rhs: 0 }] })
  const st = () => useDiff.getState()
  const engaged = () => live.lock > 0.95
  g.add(coupling('lock', 'left', 'right', () => engaged() || st().mode === 'straight'))
  // 'held': the left wheel is chocked; 'mud': the firm left wheel cannot move the tractor on the
  // mud wheel's torque alone, so it stands still while the right wheel spins
  g.add(brake('held', 'left', () => !engaged() && (st().mode === 'held' || st().mode === 'mud')))
  const corner: Constraint = {
    id: 'corner',
    rows: () => {
      const s = st()
      if (engaged() || s.mode !== 'cornering') return []
      const R = Math.max(s.turnRadius, DIM.track / 2)
      // turning left: the left (inner) wheel runs on the smaller radius
      return [{ c: { left: R + DIM.track / 2, right: -(R - DIM.track / 2) }, rhs: 0 }]
    },
  }
  g.add(corner)
  return g
}

export function Diff3D() {
  const g = getDiffGeometry()
  const spiders = useDiff((s) => s.spiders)
  const mode = useDiff((s) => s.mode)
  const locked = useDiff((s) => s.locked)
  const graph = useMemo(makeGraph, [])

  const pinion = useRef<THREE.Group>(null)
  const cage = useRef<THREE.Group>(null)
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const collar = useRef<THREE.Group>(null)
  const spiderRefs = useRef<(THREE.Group | null)[]>([])

  useSimFrame((dt) => {
    const st = useDiff.getState()
    // the collar slides in or out over ~0.3 s
    const target = st.locked ? 1 : 0
    live.lock += Math.sign(target - live.lock) * Math.min(Math.abs(target - live.lock), dt / 0.3)
    graph.drive('pinion', radps(st.pinionRpm))
    graph.step(dt)
    const th = (id: string) => graph.get(id).theta
    pinion.current?.rotation.set(0, 0, PLACE.pinion.phase + th('pinion'))
    cage.current?.rotation.set(th('cage'), 0, 0)
    left.current?.rotation.set(th('left'), 0, 0)
    // the right shaft frame is turned 180° about Y, so its local X is world −X
    right.current?.rotation.set(-th('right'), 0, 0)
    spiderRefs.current.forEach((s, i) => s?.rotation.set(0, 0, PLACE.spiders[i].phase + th('spider')))
    collar.current?.position.set(DIM.lockX - 0.013 + DIM.lockTravel * (1 - live.lock), 0, 0)

    live.pinion = rpm(graph.get('pinion').omega)
    live.cage = rpm(graph.get('cage').omega)
    live.left = rpm(graph.get('left').omega)
    live.right = rpm(graph.get('right').omega)
    live.spider = rpm(graph.get('spider').omega)
  })

  const arms = spiders === 4 ? [0, 1, 2, 3] : [0, 1]
  const mudSlab = useMemo(() => box(0.36, 0.024, 0.5), [])
  const mudSpray = useMemo(
    () => new THREE.CatmullRomCurve3([V(-DIM.wheelX, -DIM.tyreR + 0.02, 0.2), V(-DIM.wheelX, -DIM.tyreR + 0.12, 0.36), V(-DIM.wheelX, -DIM.tyreR + 0.1, 0.55), V(-DIM.wheelX, -DIM.tyreR - 0.02, 0.7)]),
    [],
  )

  const sideAndShaft = (withCollar: boolean) => (
    <>
      <Part id={withCollar ? 'side-left' : 'side-right'} name={withCollar ? 'Left side gear' : 'Right side gear'} material="steelDark" info={INFO.side} cites={C.diff} explode={[0.06, 0, 0]}>
        <group position={PLACE.side.position} quaternion={PLACE.side.quaternion}>
          <PartMesh geometry={g.sideGear} rotation={[0, 0, PLACE.side.phase]} />
        </group>
      </Part>
      <Part id={withCollar ? 'shaft-left' : 'shaft-right'} name={withCollar ? 'Left half shaft & wheel' : 'Right half shaft & wheel'} material="forged" info={INFO.shafts} cites={C.axle} explode={[0.25, 0, 0]}>
        <PartMesh geometry={g.halfShaft} />
        <group position={[DIM.wheelX, 0, 0]}>
          <Part id={withCollar ? 'wheel-left' : 'wheel-right'} name={withCollar ? 'Left wheel' : 'Right wheel'} material="rubber" info={INFO.wheels} cut={false}>
            <PartMesh geometry={g.tyre} />
            <PartMesh geometry={g.rim} material="paintRed" />
          </Part>
        </group>
        {withCollar ? (
          <Part id="diff-lock" name="Diff lock dog collar" material="steel" info={INFO.lock} cites={C.lock} explode={[0.08, 0, 0]}>
            <group ref={collar}>
              <PartMesh geometry={g.collar} />
            </group>
          </Part>
        ) : null}
      </Part>
    </>
  )

  return (
    <group>
      <Part id="rear-axle" name="Rear axle & differential" role="moving" material="steel" info={INFO.axle} cites={C.diff}>
        {/* ---------------- stationary ---------------- */}
        <Part id="carrier" name="Axle centre housing" material="castIron" role="housing" info={INFO.carrier} cites={C.axle} explode={[0, 0.3, 0]}>
          <PartMesh geometry={g.carrier} />
          <Part id="oil" name="Transmission oil" material="oil" role="fluid" info={INFO.oil}>
            <PartMesh geometry={g.oil} />
          </Part>
        </Part>
        <Part id="trumpets" name="Axle trumpets" material="paintGrey" role="housing" info={INFO.trumpets} cites={C.axle} explode={[0, 0.2, 0]}>
          <PartMesh geometry={g.trumpetLeft} />
          <group rotation={[0, PI, 0]}>
            <PartMesh geometry={g.trumpetRight} />
          </group>
        </Part>
        {mode === 'mud' ? (
          <Part id="mud" name="Mud under the right wheel" material="soil" role="static" info={INFO.mud} cites={[SRC.tts510('p8 diff lock'), SRC.pt510('p12')]} cut={false}>
            <PartMesh geometry={mudSlab} position={[-DIM.wheelX, -DIM.tyreR - 0.012, 0]} />
          </Part>
        ) : null}
        {mode === 'mud' ? <Flow curve={mudSpray} count={40} radius={0.008} color="#5b4330" speed={2.5} spread={0.05} emissive={0.05} intensity={() => (locked ? 0 : Math.min(1, Math.abs(live.right) / 200))} /> : null}
        {mode === 'held' && !locked ? (
          <Part id="chock" name="Wheel held" material="wood" role="static" info={INFO.chock} cites={[SRC.tts510('p8')]} cut={false}>
            <PartMesh geometry={g.chock} position={[DIM.wheelX, -DIM.tyreR + 0.04, 0.24]} />
            <PartMesh geometry={g.chock} position={[DIM.wheelX, -DIM.tyreR + 0.04, -0.24]} />
          </Part>
        ) : null}

        {/* ---------------- pinion ---------------- */}
        <Part id="pinion" name="Bevel pinion" material="steelDark" info={INFO.pinion} cites={C.crown} explode={[0, 0, 0.2]}>
          <group position={PLACE.pinion.position} quaternion={PLACE.pinion.quaternion}>
            <group ref={pinion}>
              <PartMesh geometry={g.pinionTeeth} />
              <PartMesh geometry={g.pinionShaft} material="forged" />
            </group>
          </group>
        </Part>

        {/* ---------------- cage, crown wheel, planet pinions ---------------- */}
        <group ref={cage}>
          <Part id="crown" name="Crown wheel" material="steelDark" info={INFO.crown} cites={C.crown} explode={[0.12, 0, 0]}>
            <group position={PLACE.crown.position} quaternion={PLACE.crown.quaternion}>
              <group rotation={[0, 0, PLACE.crown.phase]}>
                <PartMesh geometry={g.crownTeeth} />
                <PartMesh geometry={g.crownRing} />
                <PartMesh geometry={g.crownBolts} material="steel" />
              </group>
            </group>
          </Part>
          <Part id="cage" name="Differential cage" material="castIron" info={INFO.cage} cites={C.diff} cut explode={[0, -0.15, 0]}>
            <PartMesh geometry={g.cage} />
            <PartMesh geometry={g.cageDogs} material="steel" />
          </Part>
          <Part id="cross-pins" name="Cross-pins" material="steel" info={INFO.pins} cites={C.diff} explode={[0, -0.15, 0]}>
            <PartMesh geometry={g.pinY} />
            {spiders === 4 ? <PartMesh geometry={g.pinZ} /> : null}
          </Part>
          <Part id="spiders" name="Planet (spider) pinions" material="steel" info={INFO.spiders} cites={C.diff} explode={[0, 0.12, 0]}>
            {arms.map((i) => (
              <group key={i} position={PLACE.spiders[i].position} quaternion={PLACE.spiders[i].quaternion}>
                <group
                  ref={(el) => {
                    spiderRefs.current[i] = el
                  }}
                >
                  <PartMesh geometry={g.spider} />
                </group>
              </group>
            ))}
          </Part>
        </group>

        {/* ---------------- half shafts ---------------- */}
        <group ref={left}>{sideAndShaft(true)}</group>
        <group rotation={[0, PI, 0]}>
          <group ref={right}>{sideAndShaft(false)}</group>
        </group>
      </Part>

      <PartLabel partId="crown" at={[0.05, 0.17, 0.08]} />
      <PartLabel partId="pinion" at={[0, 0.06, 0.3]} />
      <PartLabel partId="cage" at={[-0.03, 0.08, 0.05]} />
      <PartLabel partId="spiders" at={[0.0, 0.03, 0.06]} />
      <PartLabel partId="side-left" at={[0.04, -0.06, 0.03]} />
      <PartLabel partId="diff-lock" at={[0.13, 0.06, 0.02]} />
      <PartLabel partId="carrier" at={[-0.1, 0.19, 0.1]} />
      <PartLabel partId="trumpets" at={[-0.4, 0.05, 0.03]} />
      <PartLabel partId="shaft-left" at={[0.4, 0.04, 0]} />
      <PartLabel partId="wheel-left" at={[DIM.wheelX, DIM.tyreR + 0.03, 0]} />
      <PartLabel partId="wheel-right" at={[-DIM.wheelX, DIM.tyreR + 0.03, 0]} />
      <PartLabel partId="oil" at={[0.1, -0.15, 0.1]} />
    </group>
  )
}

/** Apex distances, exported for tests. */
export const APEX_DISTANCES = APEX
