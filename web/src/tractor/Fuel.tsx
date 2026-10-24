import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, mat4, pipe, xform, merge } from '@/geometry'
import { buildFuelGeometry, prepareFuelGeometry, type StaticFuelGeometry } from '@/modules/engine/diesel-fuel/geometry'
import { DEFAULTS as FUEL_DEFAULTS, ELEMENT_X, LAYOUT, PINION_PHASE, RACK_X0, DIM, elementPose, feedPlungerY } from '@/modules/engine/diesel-fuel/model'
import type { PartInfo } from '@/parts/registry'
import { Part, PartMesh } from '@/render/Part'
import type { DriveAngles } from './DrivelineInternals'
import { CYL_Z, ENGINE_X, injectorTop } from './engine'
import { DRIVE_Y } from './geometry'

/**
 * The fuel system, in place: fuel in the tank, sediment bowl, lift pump and hand primer, primary and
 * secondary filters, and the four-element in-line injection pump on the left of the engine with its
 * own camshaft at half engine speed, timed so each element delivers as its cylinder comes up to
 * fire (1-3-4-2). High-pressure pipes fan out from the delivery valves to the injectors, and the
 * overflow and leak-off lines return to the tank. The diesel-fuel scene's parts and plunger
 * kinematics. Frame as the tractor: +X forward, Y up, +Z right.
 */

const { PI } = Math
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
/** pump frame origin (the fuel scene's pump coordinates sit on it, unrotated: elements along X, no. 1 forward) */
const PUMP = V(ENGINE_X, 0.66, -0.21)
const P = (x: number, y: number, z = 0) => V(x, y, z).add(PUMP)
const PRIMARY = V(0.86, 0.95, -0.25)
const SECONDARY = V(0.95, 0.95, -0.25)
const BOWL = V(0.55, 0.97, -0.2)
/** delivery begins 60° into each element's cam rise; time element 1 to start 15° (crank) before cylinder 1's firing TDC */
const CAM_OFFSET = PI / 3 - (PI - (15 * PI) / 180 / 2)
/** engine-local injector inlet → tractor frame (the engine is turned so its crank axis lies along X) */
const toTractor = (p: THREE.Vector3) => V(ENGINE_X + p.z, DRIVE_Y + p.y, -p.x)

const INFO: Record<string, PartInfo> = {
  tank: { summary: 'Diesel in the tank.', role: 'The tank sits in front of the dashboard, above the injection pump, so fuel reaches the lift pump with a little head.' },
  bowl: { summary: 'Sediment bowl.', role: 'Fuel slows down in the glass bowl so water and dirt settle out where they can be seen and drained.' },
  lift: { summary: 'Lift pump and hand primer.', role: 'An eccentric on the pump camshaft works the plunger, drawing fuel from the tank and pushing it through the filters; the primer is worked by hand to bleed air out.' },
  filters: { summary: 'Primary and secondary filters.', role: 'The primary catches water and coarse dirt; the fine secondary element protects the pump plungers and injector nozzles. The overflow valve in its head returns surplus fuel, and air, to the tank.' },
  pump: { summary: 'In-line injection pump.', role: 'One plunger and barrel per cylinder on a camshaft at half engine speed. The rack turns the plungers to set how much fuel each stroke delivers; the delivery valves snap shut so the injectors cut off cleanly.' },
  plungers: { summary: 'Plungers, tappets and springs.', role: 'The cam lifts each plunger; delivery runs from the moment its top closes the barrel ports until the helix opens the spill port.' },
  rack: { summary: 'Control rack, sleeves and pinions.', role: 'Moved by the throttle and governor; turning all the plungers together changes the fuel delivered to every cylinder equally.' },
  hp: { summary: 'High-pressure pipes.', role: 'Thick-walled steel pipes of equal length carry each charge from its delivery valve to its injector at 120–300 kg/cm².' },
  lp: { summary: 'Feed, overflow and leak-off pipes.', role: 'Low-pressure lines from the tank through the bowl, lift pump and filters to the pump gallery, and the return lines back to the tank.' },
}

export function Fuel({ a, k }: { a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const [g, setG] = useState<StaticFuelGeometry | null>(null)
  useEffect(() => {
    let live = true
    void prepareFuelGeometry().then(() => live && setG(buildFuelGeometry()))
    return () => {
      live = false
    }
  }, [])
  if (!g) return null
  return <FuelSystem g={g} a={a} k={k} />
}

function FuelSystem({ g, a, k }: { g: StaticFuelGeometry; a: MutableRefObject<DriveAngles>; k: (s: string) => string }) {
  const local = useMemo(() => {
    const line = (r: number, ...pts: THREE.Vector3[]) => pipe(new THREE.CatmullRomCurve3(pts), r, r * 0.65, 72, 10)
    const head = (c: THREE.Vector3, dx: number) => c.clone().add(V(dx, 0.016, 0))
    // high pressure: each delivery-valve holder to its cylinder's injector
    const hp = ELEMENT_X.map((x, i) => {
      const top = toTractor(injectorTop(CYL_Z[i]))
      return line(0.0035, P(x, 0.186), P(x, 0.23), V(top.x, PUMP.y + 0.32, -0.19), V(top.x + 0.01, top.y + 0.03, top.z - 0.03), top)
    })
    return {
      // diesel in both halves of the saddle tank
      tankFuel: merge(...[1, -1].map((sz) => xform(box(0.29, 0.22, 0.155), mat4.t(0.6, 1.125, sz * 0.1675)))),
      hp,
      lp: [
        // tank → sediment bowl → lift pump
        line(0.0045, V(BOWL.x, 1.01, BOWL.z), V(BOWL.x, 0.99, BOWL.z), V(BOWL.x - 0.03, BOWL.y + 0.018, BOWL.z)),
        line(0.0045, V(BOWL.x + 0.036, BOWL.y + 0.018, BOWL.z), V(0.7, 0.9, -0.24), V(0.95, 0.72, -0.27), P(LAYOUT.feed.x - 0.014, 0.1)),
        // lift pump → primary → secondary → pump gallery
        line(0.0045, P(LAYOUT.feed.x + 0.014, 0.1), P(0.2, 0.2, -0.04), V(1.05, 1.0, -0.27), V(PRIMARY.x + 0.06, PRIMARY.y + 0.06, -0.27), head(PRIMARY, 0.052)),
        line(0.0045, head(PRIMARY, -0.052), V(0.9, PRIMARY.y + 0.05, -0.29), head(SECONDARY, -0.052)),
        line(0.0045, head(SECONDARY, 0.052), V(1.02, 0.98, -0.27), P(0.13, 0.15, -0.03), P(0.1, 0.1201)),
        // overflow and injector leak-off back to the tank
        line(0.003, SECONDARY.clone().add(V(0.036, 0.046, 0)), V(0.9, 1.1, -0.24), V(0.7, 1.4, -0.15), V(0.65, 1.37, -0.1)),
        line(0.003, ...CYL_Z.map((z) => toTractor(injectorTop(z)).add(V(0, 0.02, 0.02))).reverse(), V(0.75, 1.42, -0.12), V(0.68, 1.37, -0.08)),
      ],
    }
  }, [])

  const cam = useRef<THREE.Group>(null)
  const tappets = useRef<(THREE.Group | null)[]>([])
  const plungers = useRef<(THREE.Group | null)[]>([])
  const sleeves = useRef<(THREE.Group | null)[]>([])
  const springs = useRef<(THREE.Mesh | null)[]>([])
  const dvalves = useRef<(THREE.Group | null)[]>([])
  const feed = useRef<THREE.Group>(null)
  const rack = FUEL_DEFAULTS.rack

  useSimFrame(() => {
    // pump camshaft at half crank speed, timed to the engine
    const c = a.current.crank / 2 + CAM_OFFSET
    cam.current?.rotation.set(-c, 0, 0)
    for (let i = 0; i < 4; i++) {
      const s = elementPose(c, rack, i)
      tappets.current[i]?.position.set(s.x, s.tappetY, 0)
      plungers.current[i]?.position.set(s.x, s.plungerY, 0)
      plungers.current[i]?.rotation.set(0, s.rot, 0)
      sleeves.current[i]?.rotation.set(0, s.rot, 0)
      const sp = springs.current[i]
      if (sp) {
        sp.position.set(s.x, s.springY0, 0)
        sp.scale.set(1, s.springLen, 1)
      }
      dvalves.current[i]?.position.set(s.x, s.delivering ? 0.0012 : 0, 0)
    }
    feed.current?.position.set(LAYOUT.feed.x, feedPlungerY(c), 0)
  })

  const bowlOffset = V(BOWL.x - LAYOUT.bowl.x, BOWL.y - LAYOUT.bowl.headY, BOWL.z)

  return (
    <>
      <Part id={k('fuel-tank-fuel')} name="Diesel in the tank" role="fluid" material="fuel" xray info={INFO.tank}>
        <PartMesh geometry={local.tankFuel} />
      </Part>
      <Part id={k('sediment-bowl')} name="Sediment bowl" role="static" material="castIron" info={INFO.bowl}>
        <group position={bowlOffset}>
          <PartMesh geometry={g.bowlHead} />
          <PartMesh geometry={g.glassBowl} material="glass" />
          <PartMesh geometry={g.bowlFuel} material="fuel" />
          <PartMesh geometry={g.sediment} material="soil" />
          <PartMesh geometry={g.bowlStrainer} material="brass" />
          <PartMesh geometry={g.bail} material="steel" />
          <PartMesh geometry={g.jamNut} material="brass" />
        </group>
      </Part>
      <group position={PUMP}>
        <Part id={k('fuel-pump')} name="Injection pump" role="housing" material="aluminium" info={INFO.pump} explode={[0, 0, -0.15]}>
          <PartMesh geometry={g.housing} />
          <PartMesh geometry={g.gallery} material="fuel" />
          {ELEMENT_X.map((x) => (
            <PartMesh key={x} geometry={g.barrel} material="steelDark" position={[x, 0, 0]} />
          ))}
          {ELEMENT_X.map((x) => (
            <PartMesh key={x} geometry={g.holder} material="steelDark" position={[x, 0, 0]} />
          ))}
        </Part>
        <Part id={k('fuel-pump-cam')} name="Pump camshaft" role="moving" material="forged" info={INFO.pump}>
          <group ref={cam} position={[0, LAYOUT.camY, 0]}>
            <PartMesh geometry={g.camshaft} />
            <PartMesh geometry={g.camLobes} material="steel" />
            <PartMesh geometry={g.eccentric} material="steel" />
            <PartMesh geometry={g.flange} material="castIron" />
          </group>
        </Part>
        <Part id={k('fuel-plungers')} name="Plungers, tappets & springs" role="moving" material="chrome" info={INFO.plungers}>
          {ELEMENT_X.map((_, i) => (
            <group key={`t${i}`} ref={(o) => void (tappets.current[i] = o)}>
              <PartMesh geometry={g.tappet} material="steel" />
            </group>
          ))}
          {ELEMENT_X.map((_, i) => (
            <group key={`p${i}`} ref={(o) => void (plungers.current[i] = o)}>
              <PartMesh geometry={g.plunger} />
            </group>
          ))}
          {ELEMENT_X.map((_, i) => (
            <PartMesh key={`s${i}`} ref={(o) => void (springs.current[i] = o)} geometry={g.spring} material="steelDark" />
          ))}
          {ELEMENT_X.map((_, i) => (
            <group key={`d${i}`} ref={(o) => void (dvalves.current[i] = o)}>
              <PartMesh geometry={g.dValve} material="steel" />
            </group>
          ))}
        </Part>
        <Part id={k('fuel-rack')} name="Control rack & sleeves" role="moving" material="steelDark" info={INFO.rack}>
          {ELEMENT_X.map((x, i) => (
            <group key={i} position={[x, 0, 0]}>
              <group ref={(o) => void (sleeves.current[i] = o)}>
                <PartMesh geometry={g.sleeve} />
                <PartMesh geometry={g.pinion} material="brass" rotation={[0, PINION_PHASE[i], 0]} />
              </group>
            </group>
          ))}
          <PartMesh geometry={g.rack} material="steel" position={[RACK_X0 + rack, DIM.sleeveY, DIM.rackPitchZ]} />
        </Part>
        <Part id={k('lift-pump')} name="Lift pump & primer" role="static" material="castIron" info={INFO.lift}>
          <PartMesh geometry={g.feedBody} />
          <group ref={feed}>
            <PartMesh geometry={g.feedPlunger} material="steel" />
          </group>
          <PartMesh geometry={g.primer} material="paintRed" position={[LAYOUT.feed.x, 0.118, 0]} />
        </Part>
      </group>
      <Part id={k('fuel-filters')} name="Fuel filters" role="static" material="aluminium" info={INFO.filters}>
        {[PRIMARY, SECONDARY].map((p, i) => (
          <group key={i} position={p}>
            <PartMesh geometry={i ? g.headSecondary : g.headPrimary} />
            <PartMesh geometry={g.filterBowl} material={i ? 'paintGrey' : 'glass'} />
            <PartMesh geometry={g.element} material="nylon" />
            <PartMesh geometry={g.elementCaps} material="steel" />
            <PartMesh geometry={i ? g.fuelSecondary : g.fuelPrimary} material="fuel" />
          </group>
        ))}
      </Part>
      <Part id={k('hp-pipes')} name="High-pressure pipes" role="static" material="steel" info={INFO.hp}>
        {local.hp.map((p, i) => (
          <PartMesh key={i} geometry={p} />
        ))}
      </Part>
      <Part id={k('lp-pipes')} name="Fuel feed & return pipes" role="static" material="copper" info={INFO.lp}>
        {local.lp.map((p, i) => (
          <PartMesh key={i} geometry={p} />
        ))}
      </Part>
    </>
  )
}
