import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import type { Member } from '@/physics/gearing'
import { PartLabel } from '@/render/Label'
import type { MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { POWER } from '../common/anim'
import { CARRIER_BRAKE_Z, LOCK_Z, SUN_BRAKE_Z, getPlanetaryGeometry } from './geometry'
import { PG, RC, RING_PHASE, RR, SET2_Z, isLocked, makeGraph, planetAngle, planetPhase, stepGraph, usePlanetary, type PlanetState } from './model'

const C = {
  parts: [SRC.pt510('p5 — sun, planet pinions & carrier, ring; figure'), SRC.pt510('p6')],
  rules: [SRC.pt510('p6 — lock any two, ring held → underdrive')],
  culpin: [SRC.top510('p2, Fig A2.4')],
  compound: [SRC.pt510('p6 — compound planetary')],
}

const INFO = {
  set: {
    summary: 'Simple planetary (epicyclic) gear set: sun, four planet pinions on a carrier, and a ring gear.',
    role: 'Gives direct drive, a reduction or a reverse without sliding any gear in or out of mesh, so the power flow is hardly interrupted. Clutches and brakes decide which member is driven, which is held and which drives the load.',
    details: 'Typical tooth numbers: sun 30, planets 24, ring 78, module 3 mm. z_ring = z_sun + 2·z_planet, and (30 + 78)/4 = 27 is whole, so four equally spaced planets assemble.',
  },
  sun: { summary: 'Sun gear — the centre of the system.', role: 'In the arrangement shown it is on the input shaft. With the ring held it drives the planets, which walk round the ring and carry the carrier with them.' },
  planets: {
    summary: 'Planet pinions (four), each free on a pin in the carrier.',
    role: 'They mesh with the sun and the ring at the same time. They spin on their own pins and, when the carrier turns, also orbit round the sun — like planets round the sun.',
  },
  carrier: { summary: 'Planet carrier with its shaft.', role: 'Holds the planet pins. In the arrangement shown it is fastened to the output shaft.' },
  ring: { summary: 'Ring gear (annulus) with its drum and hollow shaft.', role: 'Internal gear that surrounds the other parts. Holding it with the brake gives the low (underdrive) speed.' },
  lock: {
    summary: 'Lock-up (direct-drive) clutch: multi-plate pack between the ring shaft and the sun shaft.',
    role: 'When it locks two members together the whole set turns as one unit — direct drive, 1 : 1. The clutch here sits between sun and carrier; locking any two members gives the same result.',
  },
  brake: { summary: 'Band brake.', role: 'Holds its member stationary so that it becomes the reaction member. A held member is drawn red.' },
  housing: { summary: 'Transmission housing (sectioned).', role: 'Carries the bearings and the brake anchors; takes the reaction torque of whichever member is held.' },
  set2: { summary: 'Second simple set of the compound train.', role: 'Its sun is driven by the carrier of the first set — the output of the first set is connected to the input of the second.' },
}

/** Material for a member: input/output/locked carry power (orange), held = red, free = steel. */
function useMemberMat() {
  const s = usePlanetary()
  return (m: Member, base: MaterialKey): MaterialKey => {
    if (!s.powerFlow) return base
    if (s.compound) {
      if (m === 'ring') return s.mode1 === 'under' ? 'paintRed' : POWER
      return POWER
    }
    if (s.held === m) return 'paintRed'
    const driving = s.output !== 'none' && (isLocked(s) || s.held !== 'none')
    if (m === s.input) return POWER
    if (driving && (m === s.output || (isLocked(s) && s.lock.includes(m)))) return POWER
    return base
  }
}

function set2Mat(mode: 'direct' | 'under' | 'reverse', m: Member, powerFlow: boolean, base: MaterialKey): MaterialKey {
  if (!powerFlow) return base
  if (mode === 'under' && m === 'ring') return 'paintRed'
  if (mode === 'reverse' && m === 'carrier') return 'paintRed'
  if (mode === 'direct') return POWER
  if (m === 'sun') return POWER
  if (mode === 'under' && m === 'carrier') return POWER
  if (mode === 'reverse' && m === 'ring') return POWER
  return base
}

export function PlanetaryScene3D() {
  const g = getPlanetaryGeometry()
  const s = usePlanetary()
  const mat = useMemberMat()
  const graph = useMemo(makeGraph, [])
  const p1 = useRef<PlanetState>({ theta: 0, omega: 0 })
  const p2 = useRef<PlanetState>({ theta: 0, omega: 0 })
  const sun = useRef<THREE.Group>(null)
  const carrier = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const sun2 = useRef<THREE.Group>(null)
  const carrier2 = useRef<THREE.Group>(null)
  const ring2 = useRef<THREE.Group>(null)
  const planets = useRef<(THREE.Group | null)[]>([])
  const planets2 = useRef<(THREE.Group | null)[]>([])

  useSimFrame((dt) => {
    stepGraph(graph, dt, p1.current, p2.current)
    const th = (id: string) => graph.get(id).theta
    sun.current?.rotation.set(0, 0, th('sun'))
    carrier.current?.rotation.set(0, 0, th('carrier'))
    ring.current?.rotation.set(0, 0, th('ring') + RING_PHASE)
    sun2.current?.rotation.set(0, 0, th('sun2'))
    carrier2.current?.rotation.set(0, 0, th('carrier2'))
    ring2.current?.rotation.set(0, 0, th('ring2') + RING_PHASE)
    planets.current.forEach((p, i) => p?.rotation.set(0, 0, p1.current.theta - th('carrier') + planetPhase(i)))
    planets2.current.forEach((p, i) => p?.rotation.set(0, 0, p2.current.theta - th('carrier2') + planetPhase(i)))
  }, -1)

  const pinPos = useMemo(() => Array.from({ length: PG.n }, (_, i) => [RC * Math.cos(planetAngle(i)), RC * Math.sin(planetAngle(i)), 0] as [number, number, number]), [])
  const held = (m: Member) => (s.compound ? m === 'ring' && s.mode1 === 'under' : s.held === m)

  return (
    <group>
      <Part id="planetary-set" name="Planetary gear set" role="moving" material="steel" info={INFO.set} cites={C.parts}>
        <Part id="housing" name="Housing" role="housing" material="castIron" info={INFO.housing} cites={C.parts} explode={[0, 0.25, 0]}>
          <PartMesh geometry={g.housing} />
        </Part>

        <Part id="sun" name="Sun gear & shaft" role="moving" material="steel" info={INFO.sun} cites={C.parts} explode={[0, 0, 0.12]}>
          <group ref={sun}>
            <PartMesh geometry={g.sun} material={mat('sun', 'steel')} />
            <PartMesh geometry={g.sunShaft} material={mat('sun', 'forged')} />
            <Part id="lock-hub" name="Lock-up clutch hub & friction plates" material="steelDark" info={INFO.lock} cites={C.rules}>
              <PartMesh geometry={g.lock.hub} />
              <PartMesh geometry={g.lock.friction} material="friction" />
            </Part>
            <Part id="sun-drum" name="Sun brake drum" material="castIron" info={INFO.brake}>
              <PartMesh geometry={g.drumSun} position={[0, 0, SUN_BRAKE_Z]} material={mat('sun', 'castIron')} />
            </Part>
          </group>
        </Part>

        <Part id="carrier" name="Planet carrier & shaft" role="moving" material="forged" info={INFO.carrier} cites={C.parts} explode={[0, 0, -0.1]}>
          <group ref={carrier}>
            <PartMesh geometry={g.carrier.plates} material={mat('carrier', 'forged')} />
            <PartMesh geometry={g.carrier.pins} material="steel" />
            <PartMesh geometry={s.compound ? g.carrierShaftLong : g.carrier.shaft} material={mat('carrier', 'forged')} />
            <Part id="carrier-drum" name="Carrier brake drum" material="castIron" info={INFO.brake}>
              <PartMesh geometry={g.drumCarrier} position={[0, 0, CARRIER_BRAKE_Z]} material={mat('carrier', 'castIron')} />
            </Part>
            <Part id="planets" name="Planet pinions" material="steelDark" info={INFO.planets} cites={C.parts}>
              {pinPos.map((p, i) => (
                <group key={i} position={p}>
                  <group ref={(el) => {
                    planets.current[i] = el
                  }}>
                    <PartMesh geometry={g.planet} />
                  </group>
                </group>
              ))}
            </Part>
          </group>
        </Part>

        <Part id="ring" name="Ring gear & drum" role="moving" material="steel" info={INFO.ring} cites={C.parts} explode={[0, 0, 0.22]}>
          <group ref={ring}>
            <PartMesh geometry={g.ring.gear} material={mat('ring', 'steel')} />
            <PartMesh geometry={g.ring.drum} material={mat('ring', 'forged')} />
            <Part id="lock-drum" name="Lock-up clutch drum & steel plates" material="forged" info={INFO.lock} cites={C.rules}>
              <PartMesh geometry={g.lock.drum} />
              <PartMesh geometry={g.lock.steel} material="steel" />
            </Part>
          </group>
        </Part>

        <Part id="brakes" name="Band brakes" role="static" material="paintGrey" info={INFO.brake} cites={C.rules} explode={[0, 0.12, 0]}>
          <Part id="brake-ring" name="Ring brake band" info={INFO.brake}>
            <PartMesh geometry={g.bandRing} position={[0, 0, 0.03]} material={held('ring') ? 'paintRed' : 'paintGrey'} />
          </Part>
          <Part id="brake-sun" name="Sun brake band" info={INFO.brake}>
            <PartMesh geometry={g.bandSun} position={[0, 0, SUN_BRAKE_Z]} material={held('sun') ? 'paintRed' : 'paintGrey'} />
          </Part>
          <Part id="brake-carrier" name="Carrier brake band" info={INFO.brake}>
            <PartMesh geometry={g.bandCarrier} position={[0, 0, CARRIER_BRAKE_Z]} material={held('carrier') ? 'paintRed' : 'paintGrey'} />
          </Part>
        </Part>

        {s.compound ? (
          <Part id="set-2" name="Second set (compound)" role="moving" material="steel" info={INFO.set2} cites={C.compound} position={[0, 0, SET2_Z]} explode={[0, -0.18, 0]}>
            <Part id="housing-2" name="Housing, second set" role="housing" material="castIron" info={INFO.housing}>
              <PartMesh geometry={g.housing2} />
            </Part>
            <Part id="sun-2" name="Sun gear, second set" material="steel" info={INFO.set2} cites={C.compound}>
              <group ref={sun2}>
                <PartMesh geometry={g.sun} material={set2Mat(s.mode2, 'sun', s.powerFlow, 'steel')} />
                <PartMesh geometry={g.sun2Shaft} material="forged" />
              </group>
            </Part>
            <Part id="carrier-2" name="Carrier, second set" material="forged" info={INFO.carrier}>
              <group ref={carrier2}>
                <PartMesh geometry={g.carrier.plates} material={set2Mat(s.mode2, 'carrier', s.powerFlow, 'forged')} />
                <PartMesh geometry={g.carrier.pins} material="steel" />
                <PartMesh geometry={g.carrier2Shaft} material={set2Mat(s.mode2, 'carrier', s.powerFlow, 'forged')} />
                <PartMesh geometry={g.drumCarrier} position={[0, 0, CARRIER_BRAKE_Z + 0.01]} material="castIron" />
                <Part id="planets-2" name="Planets, second set" material="steelDark" info={INFO.planets}>
                  {pinPos.map((p, i) => (
                    <group key={i} position={p}>
                      <group ref={(el) => {
                        planets2.current[i] = el
                      }}>
                        <PartMesh geometry={g.planet} />
                      </group>
                    </group>
                  ))}
                </Part>
              </group>
            </Part>
            <Part id="ring-2" name="Ring gear, second set" material="steel" info={INFO.ring}>
              <group ref={ring2}>
                <PartMesh geometry={g.ring2.gear} material={set2Mat(s.mode2, 'ring', s.powerFlow, 'steel')} />
                <PartMesh geometry={g.ring2.drum} material={set2Mat(s.mode2, 'ring', s.powerFlow, 'forged')} />
              </group>
            </Part>
            <Part id="brake-ring-2" name="Ring brake band, second set" role="static" material="paintGrey" info={INFO.brake}>
              <PartMesh geometry={g.bandRing} position={[0, 0, 0.03]} material={s.mode2 === 'under' ? 'paintRed' : 'paintGrey'} />
            </Part>
            <Part id="brake-carrier-2" name="Carrier brake band, second set" role="static" material="paintGrey" info={INFO.brake}>
              <PartMesh geometry={g.bandCarrier} position={[0, 0, CARRIER_BRAKE_Z + 0.01]} material={s.mode2 === 'reverse' ? 'paintRed' : 'paintGrey'} />
            </Part>
          </Part>
        ) : null}
      </Part>

      <PartLabel partId="sun" at={[0.0, 0.03, 0.06]} />
      <PartLabel partId="planets" at={[RC, 0.05, 0.03]} />
      <PartLabel partId="carrier" at={[0.0, -0.09, -0.04]} />
      <PartLabel partId="ring" at={[RR * 0.7, RR * 0.75, 0.03]} />
      <PartLabel partId="lock-drum" at={[0.08, 0.06, LOCK_Z + 0.03]} />
      <PartLabel partId="brake-ring" at={[0, RR + 0.04, 0.03]} />
      <PartLabel partId="brake-sun" at={[0.07, 0.07, SUN_BRAKE_Z]} />
      <PartLabel partId="brake-carrier" at={[0.08, 0.08, CARRIER_BRAKE_Z]} />
      <PartLabel partId="housing" at={[0.12, -0.13, 0.05]} />
      {s.compound ? <PartLabel partId="set-2" at={[0.12, 0.13, SET2_Z]} /> : null}
    </group>
  )
}
