import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { DriveGraph, brake, coupling, gearMesh, planetary, type Constraint } from '@/core/drive'
import { useSimFrame } from '@/core/sim'
import type { FinalDriveLayout } from '@/physics/drives'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { placeBevelGear as placeBevel } from '@/parts/lib/driveline'
import { lineAngle, meshPhase } from '@/parts/lib/shapes'
import { ANGLES, R_CROWN, R_PINION, finalGeometry } from './geometry'
import { BEVEL, EPI, EPI_RC, SPUR, SPUR_C, live, radToRpm, rpmToRad, stations, useFinal } from './model'

const { PI } = Math
const rad = (d: number) => (d * PI) / 180
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const O = V(0, 0, 0)

/** Bevel placements in the local frame (half shaft = +Z, gearbox side = −X). */
const PLACE = {
  pinion: placeBevel(O, V(1, 0, 0), R_PINION, rad(ANGLES.pinion), V(0, 0, 1), BEVEL.zPinion, true),
  crown: placeBevel(O, V(0, 0, -1), R_CROWN, rad(ANGLES.gear), V(-1, 0, 0), BEVEL.zCrown, false),
}
/** Spur pair: pinion on the half shaft, gear below on the wheel axle; the line of centres points down. */
const SPUR_PHASE = meshPhase(SPUR.pinion, 0, SPUR.gear, lineAngle(0, 0, 0, -SPUR_C))
const PLANET_ANGLES = Array.from({ length: EPI.planets }, (_, k) => (2 * PI * k) / EPI.planets)
const PLANET_PHASE = PLANET_ANGLES.map((g) => meshPhase(EPI.sun, 0, EPI.planet, g))

const C = {
  fd: [SRC.pt510('p12 final drives'), SRC.tts510('p8–10 Figs 35a/b/c')],
  mf: [SRC.top510('p10 Fig A2.15 (MF 2000)'), SRC.top510('p9 wet multi-plate brakes')],
  bevel: [SRC.tts510('p7 crown wheel and pinion')],
}

const INFO = {
  axle: { summary: 'Left half of a tractor rear axle, from the bevel pinion to the wheel hub.', details: 'Gear sizes are typical (47 : 11 crown wheel; 62 : 13 spur; 15/21/57 epicyclic). The right half is a mirror image.' },
  centre: { summary: 'Axle centre housing.', role: 'Carries the pinion and the differential; the trumpets bolt to it.' },
  pinion: { summary: 'Bevel pinion (from the gearbox).', role: 'Turns the drive through 90° — the second speed reduction.' },
  crown: { summary: 'Crown wheel and differential cage.', role: 'Turns the half shafts (differential shafts). The differential itself is shown in its own scene.' },
  shaft: { summary: 'Half shaft (differential shaft).', role: 'Fast, low-torque shaft between the differential and the final reduction: the best place for the brake.' },
  brake: { summary: 'Brake disc on the fast shaft.', role: 'Because this shaft turns i times faster than the wheel, it needs only 1/i of the wheel torque to stop the tractor.' },
  spurPinion: { summary: 'Final-drive pinion (13 teeth).', role: 'Small spur gear on the differential shaft.' },
  spurGear: { summary: 'Final-drive gear (62 teeth) on the wheel axle.', role: 'Large spur gear: the third reduction, 62/13 = 4.77 : 1. The wheel axle sits lower than the differential shaft, raising the axle housing clearance.' },
  box: { summary: 'Final-drive gear case.', role: 'Encloses the spur reduction in oil and carries the axle bearings.' },
  sun: { summary: 'Sun gear on the half shaft.', role: 'Input of the epicyclic reduction.' },
  planets: { summary: 'Planet gears on the carrier.', role: 'Walk round the fixed ring, so the carrier turns the same way as the sun, but slower.' },
  ring: { summary: 'Ring (annulus) gear, fixed in the housing.', role: 'Held member: ratio = 1 + z_ring/z_sun = 1 + 57/15 = 4.8 : 1 (Willis formula).' },
  carrier: { summary: 'Planet carrier and axle shaft.', role: 'Output to the wheel hub. Epicyclic final drives share the load between several planets, so they are compact for their torque.' },
  hub: { summary: 'Wheel hub flange.', role: 'The wheel bolts here. Final drives also carry the tractor’s weight and take shock loads.' },
  trumpet: { summary: 'Trumpet (axle) housing.', role: 'Carries the axle shaft and the weight of the tractor out to the wheel.' },
  lock: { summary: 'Diff-lock clutch plates and piston (MF hydraulic diff lock).', role: 'A multi-plate clutch, applied by oil pressure from a pedal-operated valve, locks the differential.' },
  mfBrake: { summary: 'Oil-immersed brake disc and brake piston.', role: 'One large disc on each high-speed differential output shaft, hydraulically applied and continuously cooled by oil.' },
}

export function Final3D() {
  const g = finalGeometry()
  const layout = useFinal((s) => s.layout)
  const pinion = useRef<THREE.Group>(null)
  const cage = useRef<THREE.Group>(null)
  const shaft = useRef<THREE.Group>(null)
  const hub = useRef<THREE.Group>(null)
  const planets = useRef<(THREE.Group | null)[]>([])
  const piston = useRef<THREE.Group>(null)
  const graph = useMemo(() => {
    const d = new DriveGraph()
    for (const id of ['pinion', 'cage', 'shaft', 'hub', 'ring']) d.body(id, 1.2)
    const is = (l: FinalDriveLayout) => () => useFinal.getState().layout === l
    const epi = () => is('epicyclic')() || is('mf2000')()
    d.add(gearMesh('crown', 'pinion', BEVEL.zPinion, 'cage', BEVEL.zCrown, { sameSense: true }))
    d.add(coupling('diff', 'cage', 'shaft'))
    d.add(coupling('straight', 'shaft', 'hub', is('straight')))
    d.add(gearMesh('spur', 'shaft', SPUR.pinion, 'hub', SPUR.gear, { active: is('spur') }))
    const pl = planetary('epi', 'shaft', EPI.sun, 'ring', EPI.ring, 'hub')
    const epiC: Constraint = { id: 'epi', rows: (gr) => (epi() ? pl.rows(gr) : []) }
    d.add(epiC)
    d.add(brake('ring-fixed', 'ring', () => true))
    d.add(brake('service', 'shaft', () => useFinal.getState().braking))
    return d
  }, [])

  // keep the gear phases valid when the layout changes: restart all angles together
  useEffect(() => {
    for (const b of graph.bodies.values()) b.theta = 0
  }, [layout, graph])

  useSimFrame((dt) => {
    const st = useFinal.getState()
    if (st.braking) graph.release('pinion')
    else graph.drive('pinion', rpmToRad(st.engineRpm / st.gearbox))
    graph.step(dt)
    const th = (id: string) => graph.get(id).theta
    pinion.current?.rotation.set(0, 0, PLACE.pinion.phase + th('pinion'))
    cage.current?.rotation.set(0, 0, th('cage'))
    shaft.current?.rotation.set(0, 0, th('shaft'))
    hub.current?.rotation.set(0, 0, th('hub'))
    const rel = (-EPI.sun / EPI.planet) * (th('shaft') - th('hub'))
    planets.current.forEach((p, k) => p?.rotation.set(0, 0, PLANET_PHASE[k] + rel))
    if (piston.current) piston.current.position.z = st.braking ? 0.0016 : 0
    live.pinion = radToRpm(graph.get('pinion').omega)
    live.shaft = radToRpm(graph.get('shaft').omega)
    live.hub = radToRpm(graph.get('hub').omega)
  }, -1)

  const s = stations(layout)
  const spurL = layout === 'spur'
  const epiL = layout === 'epicyclic' || layout === 'mf2000'
  const set = layout === 'straight' ? g.straight : layout === 'spur' ? g.spurSet : layout === 'epicyclic' ? g.epiOut : g.mfSet
  const powerPath = useMemo(() => {
    const pts = [V(-0.36, 0.03, 0), V(-0.16, 0.03, 0), V(-0.02, 0.05, 0.06), V(0, 0.03, 0.12), V(0, 0.03, s.reduction || s.hub - 0.1)]
    if (spurL) pts.push(V(0, -SPUR_C * 0.5, s.reduction + 0.01), V(0, -SPUR_C + 0.035, s.reduction + 0.03), V(0, -SPUR_C + 0.035, s.hub))
    else pts.push(V(0, 0.045, s.hub))
    return new THREE.CatmullRomCurve3(pts)
  }, [s, spurL])

  return (
    <group rotation={[0, PI / 2, 0]}>
      <Part id="rear-axle" name="Rear axle (left half)" role="moving" material="steel" info={INFO.axle} cites={C.fd}>
        <Part id="centre-housing" name="Centre housing" role="housing" material="castIron" info={INFO.centre} cites={C.bevel} explode={[0, 0.25, -0.1]}>
          <PartMesh geometry={g.centre} />
        </Part>
        <Part id="trumpet" name={layout === 'spur' ? 'Axle housing' : 'Trumpet housing'} role="housing" material="paintGrey" info={INFO.trumpet} cites={layout === 'mf2000' ? C.mf : C.fd} explode={[0, 0.2, 0.15]}>
          <PartMesh geometry={set.trumpet} />
          {spurL ? (
            <Part id="gear-case" name="Final-drive gear case" info={INFO.box} cites={[SRC.tts510('Fig 35a')]}>
              <PartMesh geometry={g.spurSet.box} />
              <PartMesh geometry={g.spurSet.brakeCover} />
            </Part>
          ) : null}
          {layout === 'epicyclic' ? <PartMesh geometry={g.epiOut.housing} /> : null}
          {layout === 'epicyclic' || layout === 'straight' ? <PartMesh geometry={g.epiOut.brakeCover} /> : null}
        </Part>
        {epiL ? (
          <Part id="ring" name="Ring gear (fixed)" role="static" material="steelDark" info={INFO.ring} cites={[SRC.pt510('p5–6 planetary, ring held'), SRC.beyond('epicyclic ratio 1 + z_r/z_s')]} explode={[0, 0.18, 0]}>
            <PartMesh geometry={g.ringG} position={[0, 0, s.reduction]} />
          </Part>
        ) : null}
        <Part id="pinion" name="Bevel pinion" material="steelDark" info={INFO.pinion} cites={C.bevel} explode={[-0.15, 0, 0]}>
          <group position={PLACE.pinion.position} quaternion={PLACE.pinion.quaternion}>
            <group ref={pinion}>
              <PartMesh geometry={g.pinion} />
            </group>
          </group>
        </Part>
        <group ref={cage}>
          <Part id="crown" name="Crown wheel & diff cage" material="steelDark" info={INFO.crown} cites={C.bevel} explode={[0, -0.15, 0]}>
            <group position={PLACE.crown.position} quaternion={PLACE.crown.quaternion}>
              <group rotation={[0, 0, PLACE.crown.phase]}>
                <PartMesh geometry={g.crown} />
                <PartMesh geometry={g.crownBolts} material="steel" />
              </group>
            </group>
            <PartMesh geometry={g.cage} material="castIron" />
          </Part>
        </group>
        <group ref={shaft}>
          <Part id="half-shaft" name="Half shaft (fast shaft)" material="forged" info={INFO.shaft} cites={[SRC.tts510('p11')]} explode={[0, 0, 0.1]}>
            <PartMesh geometry={set.shaft} />
            <Part id="brake-disc" name={layout === 'mf2000' ? 'Oil-immersed brake disc' : 'Brake disc'} material="steel" info={layout === 'mf2000' ? INFO.mfBrake : INFO.brake} cites={layout === 'mf2000' ? C.mf : [SRC.tts510('p11, Figs 35a/b')]} explode={[0, 0.12, 0.05]}>
              <PartMesh geometry={set.disc} />
              <PartMesh geometry={set.lining} material="friction" />
            </Part>
            {spurL ? (
              <Part id="spur-pinion" name="Final-drive pinion" material="steelDark" info={INFO.spurPinion} cites={[SRC.tts510('Fig 35a')]}>
                <PartMesh geometry={g.spurPinion} position={[0, 0, s.reduction]} />
              </Part>
            ) : null}
            {epiL ? (
              <Part id="sun" name="Sun gear" material="steelDark" info={INFO.sun} cites={[SRC.pt510('p5')]}>
                <PartMesh geometry={g.sunG} position={[0, 0, s.reduction]} />
              </Part>
            ) : null}
          </Part>
        </group>
        {spurL ? (
          <group position={[0, -SPUR_C, 0]}>
            <group ref={hub}>
              <Part id="axle" name="Wheel axle, gear & hub" material="forged" info={INFO.spurGear} cites={[SRC.tts510('Fig 35a')]} explode={[0, -0.12, 0.1]}>
                <PartMesh geometry={g.spurGear} material="steelDark" position={[0, 0, s.reduction]} rotation={[0, 0, SPUR_PHASE]} />
                <PartMesh geometry={g.spurSet.axle} />
                <PartMesh geometry={g.spurSet.hub} material="paintRed" />
              </Part>
            </group>
          </group>
        ) : (
          <group ref={hub}>
            <Part id="axle" name={epiL ? 'Carrier, axle shaft & hub' : 'Axle hub'} material="forged" info={epiL ? INFO.carrier : INFO.hub} cites={epiL ? [SRC.pt510('p6 carrier same way as sun, slower')] : C.fd} explode={[0, 0, 0.18]}>
              {epiL ? <PartMesh geometry={set === g.epiOut ? g.epiOut.carrier : g.mfSet.carrier} /> : null}
              <PartMesh geometry={set.hub} material="paintRed" />
              {epiL ? (
                <Part id="planets" name="Planet gears" material="steel" info={INFO.planets} cites={[SRC.pt510('p5–6')]} explode={[0, 0.1, 0]}>
                  {PLANET_ANGLES.map((a, k) => (
                    <group key={k} position={[EPI_RC * Math.cos(a), EPI_RC * Math.sin(a), s.reduction]}>
                      <group ref={(el) => void (planets.current[k] = el)}>
                        <PartMesh geometry={g.planetG} />
                      </group>
                    </group>
                  ))}
                </Part>
              ) : null}
            </Part>
          </group>
        )}
        {layout === 'mf2000' ? (
          <Part id="mf-actuators" name="Brake piston & diff-lock pack" role="static" material="steel" info={INFO.lock} cites={C.mf} explode={[0, 0.14, 0]}>
            <group ref={piston}>
              <PartMesh geometry={g.mfSet.brakePiston} material="aluminium" />
            </group>
            <PartMesh geometry={g.mfSet.lockPlates} material="friction" />
            <PartMesh geometry={g.mfSet.lockPiston} />
          </Part>
        ) : null}
      </Part>
      <Flow curve={powerPath} count={50} radius={0.006} color="#f5b942" speed={0.6} spread={0.01} intensity={() => (useFinal.getState().braking ? 0 : 0.8)} />
      <PartLabel partId="pinion" at={[-0.3, 0.07, 0]} />
      <PartLabel partId="crown" at={[0, 0.17, 0.05]} />
      <PartLabel partId="half-shaft" at={[0, 0.05, 0.4]} />
      <PartLabel partId="brake-disc" at={[0, 0.2, s.brake]} />
      {spurL ? <PartLabel partId="spur-pinion" at={[0, 0.06, s.reduction]} /> : null}
      {epiL ? <PartLabel partId="ring" at={[0, 0.18, s.reduction]} /> : null}
      {epiL ? <PartLabel partId="planets" at={[0, 0.1, s.reduction + 0.03]} /> : null}
      <PartLabel partId="axle" at={[0, spurL ? -SPUR_C + 0.14 : 0.14, s.hub]} />
      <PartLabel partId="trumpet" at={[0, 0.1, (s.reduction + s.hub) / 2 + 0.05]} />
      {layout === 'mf2000' ? <PartLabel partId="mf-actuators" at={[0, -0.12, 0.14]} /> : null}
    </group>
  )
}
