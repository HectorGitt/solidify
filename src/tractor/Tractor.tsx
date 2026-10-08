import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { PartLabel } from '@/render/Label'
import type { MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { LINKAGE, TRACTOR } from './dims'
import { AXLE_Y, CROWN, DRIVE_Y, FRONT_Y, FRONT_Z, GEARBOX, KINGPIN_Z, PTO_STUB_X, PTO_Y, REAR_Z, tractorGeometry } from './geometry'
import { phiForHitchHeight, solveLinkage, type LinkagePose } from './linkage'

/**
 * Mutable pose of the shared tractor. Scenes mutate it every frame (never React state);
 * <Tractor> reads it in its own frame callback. Angles in radians.
 */
export interface TractorPose {
  /** rear-wheel rotation (positive = rolling forward) */
  rearAngle: number
  frontAngle: number
  /** mean front-wheel steer angle, positive = turning right */
  steer: number
  /** crankshaft angle */
  engineAngle: number
  /** PTO stub angle */
  ptoAngle: number
  /** lower hitch-point height above ground, m */
  hitchHeight: number
  /** set by <Tractor> each frame: the solved linkage */
  linkage?: LinkagePose
  /** dynamic front track width (if set, overrides dims.ts) */
  frontTrack?: number
  /** dynamic rear track width (if set, overrides dims.ts) */
  rearTrack?: number
}

export function createTractorPose(p: Partial<TractorPose> = {}): TractorPose {
  return { rearAngle: 0, frontAngle: 0, steer: 0, engineAngle: 0, ptoAngle: 0, hitchHeight: 0.45, ...p }
}

/** Ackermann steer angles (inner, outer) for a mean angle (beyond notes: Ackermann geometry). */
export function ackermann(steer: number, wheelbase = TRACTOR.wheelbase, track = 2 * KINGPIN_Z) {
  if (Math.abs(steer) < 1e-6) return { left: 0, right: 0 }
  const Rm = wheelbase / Math.tan(Math.abs(steer))
  const inner = Math.atan(wheelbase / (Rm - track / 2))
  const outer = Math.atan(wheelbase / (Rm + track / 2))
  return steer > 0 ? { left: inner, right: outer } : { left: -outer, right: -inner }
}

const INFO = {
  tractor: {
    summary: 'Two-wheel-drive "standard" farm tractor — the Farmland tractor whose dimensions are used for the hitching and chassis examples.',
    role: 'A mobile power source: it pulls through the drawbar, drives machines through the PTO and lifts or controls implements through the hydraulic three-point linkage.',
    details: 'W = 2850 kg, wheelbase 1.88 m, CG 0.54 m ahead of the rear axle, rear tyres 14.9-28 (r = 0.635 m).',
  },
  engine: { summary: 'Diesel engine (block, head and sump).', role: 'Converts fuel energy to torque Te at speed Ne. For the drive line it is treated simply as "torque × speed", whatever its type.' },
  crank: { summary: 'Crankshaft.', role: 'Turns at engine speed Ne; drives the flywheel and clutch.' },
  flywheel: { summary: 'Flywheel.', role: 'Smooths the power strokes and carries the clutch friction face.' },
  clutchDisc: { summary: 'Clutch driven plate.', role: 'Connects or disconnects the engine and gearbox when the pedal is pressed.' },
  bonnet: { summary: 'Bonnet (hood).', role: 'Sheet-metal cover over the engine.' },
  radiator: { summary: 'Radiator.', role: 'Rejects coolant heat to the air drawn through by the fan.' },
  clutchHousing: { summary: 'Clutch (bell) housing.', role: 'Encloses the flywheel and clutch, joining engine and gearbox into the unit frame.' },
  gearbox: { summary: 'Gearbox (change-speed) housing.', role: 'Holds the gear trains that select the ratio q. About 98 % efficiency per gear pair.' },
  gears: { summary: 'Gearbox gears and shafts.', role: 'One constant-mesh pair drives the layshaft; the selected pair drives the output shaft to the bevel pinion.' },
  centre: { summary: 'Centre (differential) housing.', role: 'Holds the crown wheel and pinion, differential and PTO drive; carries the hydraulic lift on top.' },
  crownWheel: { summary: 'Crown wheel and bevel pinion.', role: 'Turns the drive through 90° to the half shafts and gives the second speed reduction (37 : 9 here).' },
  diff: { summary: 'Differential cage and half shafts.', role: 'Lets the rear wheels turn at different speeds on corners while sharing the torque.' },
  trumpets: { summary: 'Rear axle (trumpet) housings.', role: 'Carry the half shafts, final drives and wet brakes out to the wheel hubs.' },
  rearWheels: { summary: 'Rear driving wheels, 14.9-28 R-1 tyres.', role: 'Turn the axle torque into pull: H = 2Tw/D, less rolling resistance R and slip.' },
  frontAxle: { summary: 'Front axle and steering knuckles.', role: 'Pivots at the centre so all four wheels stay on rough ground; the knuckles steer the front wheels.' },
  frontWheels: { summary: 'Front steering wheels, F-2 rib tyres.', role: 'Carry the front weight and steer. The ribs resist sideways slip.' },
  station: { summary: 'Operator station.', role: 'Seat, steering wheel, controls, fuel tank and platform.' },
  rops: { summary: 'Roll-over protective structure (ROPS).', role: 'A two-post frame that, with a seat belt, protects the driver if the tractor overturns. Required on tractors over 20 hp used by hired operators from 1976.' },
  fenders: { summary: 'Rear mudguards (fenders).', role: 'Shield the operator from the rear tyres.' },
  linkage: { summary: 'Hydraulic three-point linkage.', role: 'A four-bar chain (lower links, top link, implement mast, tractor) that carries mounted implements and controls their depth.' },
  lowerLinks: { summary: 'Lower links.', role: 'Pull the implement and lift it. The hitch balls fit Category I, II or III implement pins.' },
  topLink: { summary: 'Top link.', role: 'Sets the implement pitch by its length; in draft control its compression is the sensing signal.' },
  liftArms: { summary: 'Lift arms on the rockshaft.', role: 'Turned by the lift ram; raise the lower links through the lift rods.' },
  liftRods: { summary: 'Lift rods (with levelling box).', role: 'Link the lift arms to the lower links.' },
  drawbar: { summary: 'Drawbar.', role: 'Single-point hitch for trailed implements; its height y′ and overhang x′ govern weight transfer.' },
  pto: { summary: 'PTO stub and shaft.', role: 'Delivers engine power to machines through a splined shaft, 540 rpm (6-spline Ø35 mm) or 1000 rpm.' },
}

export interface TractorProps {
  pose: TractorPose
  /** prefix for part ids (default "tractor") — keep ids unique when a scene shows two */
  id?: string
  paint?: MaterialKey
  linkage?: boolean
  drawbar?: boolean
  rops?: boolean
  /** show the engine/transmission internals inside the housings */
  internals?: boolean
  labels?: boolean
  /** mounted on the lower-link hitch: local origin at the lower hitch points' midpoint, +Y up the mast, −X rearward */
  mounted?: ReactNode
  /** attached at the drawbar pin (local origin at the pin) */
  trailed?: ReactNode
  /** overall gearbox ratio used to drive the x-ray gear train from the wheels (display only) */
  gearRatio?: number
  /** final-reduction ratio between the crown wheel/half shafts and the rear wheels (default 1) */
  finalRatio?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  children?: ReactNode
}

const AXIS_X = new THREE.Vector3(1, 0, 0)
const tmpV = new THREE.Vector3()

function orient(obj: THREE.Object3D | null, from: THREE.Vector3, to: THREE.Vector3) {
  if (!obj) return
  obj.position.copy(from)
  tmpV.subVectors(to, from).normalize()
  obj.quaternion.setFromUnitVectors(AXIS_X, tmpV)
}

/**
 * The shared tractor: chassis, wheels, operator station, three-point linkage, drawbar and
 * PTO, with optional x-ray internals. Frame: +X forward, Y up, +Z right (right-handed), origin on the ground
 * under the rear axle (see dims.ts).
 */
export function Tractor({ pose, id = 'tractor', paint = 'paintRed', linkage = true, drawbar = true, rops = true, internals = true, labels = true, mounted, trailed, gearRatio = 2, finalRatio = 1, position, rotation, children }: TractorProps) {
  const G = useMemo(() => tractorGeometry(), [])
  const k = (s: string) => `${id}-${s}`

  const rearL = useRef<THREE.Group>(null)
  const rearR = useRef<THREE.Group>(null)
  const frontL = useRef<THREE.Group>(null)
  const frontR = useRef<THREE.Group>(null)
  const knuckleL = useRef<THREE.Group>(null)
  const knuckleR = useRef<THREE.Group>(null)
  const crank = useRef<THREE.Group>(null)
  const flywheel = useRef<THREE.Group>(null)
  const clutch = useRef<THREE.Group>(null)
  const input = useRef<THREE.Group>(null)
  const lay = useRef<THREE.Group>(null)
  const output = useRef<THREE.Group>(null)
  const crown = useRef<THREE.Group>(null)
  const pto = useRef<THREE.Group>(null)
  const lowerL = useRef<THREE.Group>(null)
  const lowerR = useRef<THREE.Group>(null)
  const top = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const rodL = useRef<THREE.Group>(null)
  const rodR = useRef<THREE.Group>(null)
  const rockshaft = useRef<THREE.Group>(null)
  const hitch = useRef<THREE.Group>(null)

  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), [])

  useSimFrame(() => {
    const p = pose
    rearL.current?.rotation.set(0, 0, -p.rearAngle)
    rearR.current?.rotation.set(0, 0, -p.rearAngle)
    frontL.current?.rotation.set(0, 0, -p.frontAngle)
    frontR.current?.rotation.set(0, 0, -p.frontAngle)
    
    if (p.rearTrack !== undefined) {
      const rZ = p.rearTrack / 2
      if (rearL.current?.parent) rearL.current.parent.position.z = rZ
      if (rearR.current?.parent) rearR.current.parent.position.z = -rZ
    }
    if (p.frontTrack !== undefined) {
      const fZ = p.frontTrack / 2
      const kZ = fZ - 0.09
      if (knuckleR.current?.parent) knuckleR.current.parent.position.z = kZ
      if (knuckleL.current?.parent) knuckleL.current.parent.position.z = -kZ
    }

    const st = ackermann(p.steer, TRACTOR.wheelbase, p.frontTrack ?? (2 * KINGPIN_Z + 0.18))
    knuckleL.current?.rotation.set(0, st.left, 0)
    knuckleR.current?.rotation.set(0, st.right, 0)
    // driveline (display): wheel → crown wheel → pinion/output → layshaft → input/crank
    const crownA = p.rearAngle * finalRatio
    const pin = (crownA * CROWN.teeth) / CROWN.pinion
    crown.current?.rotation.set(0, 0, -crownA)
    output.current?.rotation.set(pin, 0, 0)
    const layA = (-pin * GEARBOX.selected[0]) / GEARBOX.selected[1]
    lay.current?.rotation.set(layA, 0, 0)
    const inA = (-layA * GEARBOX.input[1]) / GEARBOX.input[0]
    input.current?.rotation.set(inA, 0, 0)
    const crankA = p.engineAngle || pin * gearRatio
    crank.current?.rotation.set(crankA, 0, 0)
    flywheel.current?.rotation.set(crankA, 0, 0)
    clutch.current?.rotation.set(crankA, 0, 0)
    pto.current?.rotation.set(p.ptoAngle, 0, 0)

    if (!linkage) return
    const lk = solveLinkage(phiForHitchHeight(p.hitchHeight))
    p.linkage = lk
    const zl = LINKAGE.lowerPivot.z
    const zh = LINKAGE.hitchSpread
    const zr = LINKAGE.rockshaft.z
    const zE = zl + (zh - zl) * (LINKAGE.liftRodAt / LINKAGE.lowerLength)
    for (const [s, low, arm, rod] of [
      [1, lowerL.current, armL.current, rodL.current],
      [-1, lowerR.current, armR.current, rodR.current],
    ] as const) {
      orient(low, v.a.set(LINKAGE.lowerPivot.x, LINKAGE.lowerPivot.y, s * zl), v.b.set(lk.L.x, lk.L.y, s * zh))
      orient(arm, v.a.set(LINKAGE.rockshaft.x, LINKAGE.rockshaft.y, s * zr), v.b.set(lk.D.x, lk.D.y, s * zr))
      orient(rod, v.a.set(lk.D.x, lk.D.y, s * zr), v.b.set(lk.E.x, lk.E.y, s * zE))
    }
    orient(top.current, v.a.set(LINKAGE.topPivot.x, LINKAGE.topPivot.y, 0), v.b.set(lk.U.x, lk.U.y, 0))
    rockshaft.current?.rotation.set(0, 0, -lk.beta)
    if (hitch.current) {
      hitch.current.position.set(lk.L.x, lk.L.y, 0)
      hitch.current.rotation.set(0, 0, -lk.mastTilt)
    }
  })

  const cites = [SRC.mac502('App. II Farmland tractor; Ch. 6'), SRC.mech502('Figs 2.1, 2.3')]

  return (
    <group position={position} rotation={rotation}>
      <Part id={id} name="Tractor" role="housing" material={paint} info={INFO.tractor} cites={cites}>
        <Part id={k('engine')} name="Engine" material="castIron" info={INFO.engine} cites={[SRC.mech502('p1'), SRC.l4_509('engine parts')]} explode={[0, 0.25, 0]}>
          <PartMesh geometry={G.block} />
          <PartMesh geometry={G.head} />
          <PartMesh geometry={G.timingCover} />
          <PartMesh geometry={G.sump} material="paintGrey" />
          {internals && (
            <>
              <Part id={k('crank')} name="Crankshaft" role="moving" material="forged" info={INFO.crank}>
                <group position={[1.7, DRIVE_Y, 0]} ref={crank}>
                  <PartMesh geometry={G.crank} />
                </group>
              </Part>
              <Part id={k('flywheel')} name="Flywheel" role="moving" material="castIron" info={INFO.flywheel}>
                <group position={[0.785, DRIVE_Y, 0]} ref={flywheel}>
                  <PartMesh geometry={G.flywheel} />
                </group>
              </Part>
            </>
          )}
        </Part>
        <Part id={k('bonnet')} name="Bonnet" material={paint} info={INFO.bonnet} explode={[0, 0.5, 0]}>
          <PartMesh geometry={G.bonnet} />
          <PartMesh geometry={G.grille} material="paintGrey" />
          <PartMesh geometry={G.airCleaner} material="paintBlack" />
          <PartMesh geometry={G.exhaust} material="steelDark" />
        </Part>
        <Part id={k('radiator')} name="Radiator" role="static" material="copper" info={INFO.radiator} cites={[SRC.supp509('cooling system')]}>
          <PartMesh geometry={G.radiator} />
          <PartMesh geometry={G.bolster} material="castIron" />
        </Part>
        <Part id={k('clutch-housing')} name="Clutch housing" material="castIron" info={INFO.clutchHousing} cites={[SRC.pt510('clutch')]} explode={[0, 0, 0.4]}>
          <PartMesh geometry={G.clutchHousing} />
          {internals && (
            <Part id={k('clutch-disc')} name="Clutch plate" role="moving" material="friction" info={INFO.clutchDisc}>
              <group position={[0.73, DRIVE_Y, 0]} ref={clutch}>
                <PartMesh geometry={G.clutchDisc} />
              </group>
            </Part>
          )}
        </Part>
        <Part id={k('gearbox')} name="Gearbox" material="castIron" info={INFO.gearbox} cites={[SRC.mech502('p8, 98 % per gear pair'), SRC.pt510('gearboxes')]} explode={[0, 0, 0.45]}>
          <PartMesh geometry={G.gearbox} />
          {internals && (
            <Part id={k('gears')} name="Gears and shafts" role="moving" material="steel" info={INFO.gears}>
              <group position={[0.25, DRIVE_Y, 0]} ref={input}>
                <PartMesh geometry={G.inputShaft} />
                <PartMesh geometry={G.inputPinion} position={[0.22, 0, 0]} />
              </group>
              <group position={[0.37, DRIVE_Y - GEARBOX.centre, 0]} ref={lay}>
                <PartMesh geometry={G.layShaft} />
                <PartMesh geometry={G.layGear} position={[0.1, 0, 0]} />
                <PartMesh geometry={G.laySelected} position={[-0.07, 0, 0]} />
              </group>
              <group position={[0, DRIVE_Y, 0]} ref={output}>
                <PartMesh geometry={G.pinion} />
                <PartMesh geometry={G.mainSelected} position={[0.3, 0, 0]} />
              </group>
            </Part>
          )}
        </Part>
        <Part id={k('centre-housing')} name="Centre housing" material="castIron" info={INFO.centre} cites={[SRC.pt510('crown wheel & pinion, differential')]} explode={[0, 0, -0.45]}>
          <PartMesh geometry={G.centre} />
          <PartMesh geometry={G.liftCover} />
          <PartMesh geometry={G.brackets} material="forged" />
          {internals && (
            <Part id={k('crown-wheel')} name="Crown wheel and differential" role="moving" material="steel" info={INFO.crownWheel} cites={[SRC.pt510('final drive')]}>
              <group position={[0, AXLE_Y, 0]} ref={crown}>
                <PartMesh geometry={G.crownWheel} />
                <PartMesh geometry={G.diffCage} material="castIron" />
                <PartMesh geometry={G.halfShafts} material="forged" />
              </group>
            </Part>
          )}
        </Part>
        <Part id={k('trumpets')} name="Rear axle housings" material="castIron" info={INFO.trumpets}>
          <PartMesh geometry={G.trumpets} />
        </Part>
        <Part id={k('rear-wheels')} name="Rear wheels" role="moving" material="rubber" info={INFO.rearWheels} cites={[SRC.mech502('eq 2.1–2.2'), SRC.tt510('tyre types')]}>
          {([1, -1] as const).map((s) => (
            <group key={s} position={[0, AXLE_Y, s * REAR_Z]}>
              <group ref={s > 0 ? rearL : rearR}>
                <group rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                  <PartMesh geometry={G.rearTyre} />
                  <PartMesh geometry={G.rearRim} material="paintGrey" />
                </group>
              </group>
            </group>
          ))}
        </Part>
        <Part id={k('front-axle')} name="Front axle" role="static" material="forged" info={INFO.frontAxle} cites={[SRC.st510('front axle, steering linkage')]}>
          <PartMesh geometry={G.axleBeam} />
          {([1, -1] as const).map((s) => (
            <group key={s} position={[TRACTOR.wheelbase, FRONT_Y, s * KINGPIN_Z]}>
              <group ref={s > 0 ? knuckleR : knuckleL}>
                <group rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                  <PartMesh geometry={G.knuckle} />
                </group>
                <Part id={k(s > 0 ? 'front-wheel-r' : 'front-wheel-l')} name={s > 0 ? 'Front wheel (right)' : 'Front wheel (left)'} role="moving" material="rubber" info={INFO.frontWheels}>
                  <group position={[0, 0, s * (FRONT_Z - KINGPIN_Z)]}>
                    <group ref={s > 0 ? frontL : frontR}>
                      <group rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                        <PartMesh geometry={G.frontTyre} />
                        <PartMesh geometry={G.frontRim} material="paintGrey" />
                      </group>
                    </group>
                  </group>
                </Part>
              </group>
            </group>
          ))}
        </Part>
        <Part id={k('fenders')} name="Fenders" material={paint} info={INFO.fenders}>
          <PartMesh geometry={G.fenders} />
        </Part>
        <Part id={k('station')} name="Operator station" role="static" material="paintGrey" info={INFO.station} cites={[SRC.he510('operator station')]} cut={false}>
          <PartMesh geometry={G.platform} material="paintBlack" />
          <PartMesh geometry={G.tank} material={paint} />
          <PartMesh geometry={G.dash} />
          <PartMesh geometry={G.seat} material="plastic" />
          <PartMesh geometry={G.seatPost} material="steelDark" />
          <PartMesh geometry={G.column} material="steelDark" />
          <PartMesh geometry={G.steeringWheel} material="plastic" />
        </Part>
        {rops && (
          <Part id={k('rops')} name="ROPS frame" role="static" material="paintBlack" info={INFO.rops} cites={[SRC.he510('p20–21 ROPS')]} cut={false}>
            <PartMesh geometry={G.rops} />
          </Part>
        )}
        {drawbar && (
          <Part id={k('drawbar')} name="Drawbar" role="static" material="forged" info={INFO.drawbar} cites={[SRC.hitch502('trailed hitch, Fig 6.1')]}>
            <PartMesh geometry={G.drawbar} />
            {trailed && <group position={[TRACTOR.drawbar.x, TRACTOR.drawbar.y, 0]}>{trailed}</group>}
          </Part>
        )}
        <Part id={k('pto')} name="PTO" role="moving" material="steel" info={INFO.pto} cites={[SRC.pto502('540 / 1000 rpm, guards')]}>
          <group position={[PTO_STUB_X, PTO_Y, 0]} ref={pto}>
            <PartMesh geometry={G.ptoStub} />
            {internals && <PartMesh geometry={G.ptoShaft} />}
          </group>
          <Part id={k('pto-shield')} name="PTO master shield" role="static" material={paint} info={{ summary: 'PTO master shield.', role: 'Covers the PTO stub so clothing cannot be caught — a 540 rpm shaft wraps 7 ft of string in one second.' }} cut={false}>
            <PartMesh geometry={G.ptoShield} />
          </Part>
        </Part>
        {linkage && (
          <Part id={k('linkage')} name="Three-point linkage" role="moving" material="forged" info={INFO.linkage} cites={[SRC.hitch502('Figs 6.3–6.5'), SRC.hy510('3-point linkage')]}>
            <Part id={k('lower-links')} name="Lower links" info={INFO.lowerLinks}>
              <group ref={lowerL}>
                <PartMesh geometry={G.lowerLink} />
              </group>
              <group ref={lowerR}>
                <PartMesh geometry={G.lowerLink} />
              </group>
            </Part>
            <Part id={k('top-link')} name="Top link" info={INFO.topLink} material="paintYellow">
              <group ref={top}>
                <PartMesh geometry={G.topLink} />
              </group>
            </Part>
            <Part id={k('lift-arms')} name="Lift arms and rockshaft" info={INFO.liftArms}>
              <group position={[LINKAGE.rockshaft.x, LINKAGE.rockshaft.y, 0]} ref={rockshaft}>
                <PartMesh geometry={G.rockshaft} material="steel" />
              </group>
              <group ref={armL}>
                <PartMesh geometry={G.liftArm} />
              </group>
              <group ref={armR}>
                <PartMesh geometry={G.liftArm} />
              </group>
            </Part>
            <Part id={k('lift-rods')} name="Lift rods" info={INFO.liftRods}>
              <group ref={rodL}>
                <PartMesh geometry={G.liftRod} />
              </group>
              <group ref={rodR}>
                <PartMesh geometry={G.liftRod} />
              </group>
            </Part>
          </Part>
        )}
        {linkage && mounted && <group ref={hitch}>{mounted}</group>}
        {children}
      </Part>
      {labels && (
        <>
          <PartLabel partId={k('engine')} at={[1.3, 1.5, 0.3]} />
          <PartLabel partId={k('gearbox')} at={[0.36, 0.95, 0.3]} />
          <PartLabel partId={k('centre-housing')} at={[0, 1.15, 0.3]} />
          <PartLabel partId={k('rear-wheels')} at={[0, 1.35, REAR_Z + 0.2]} />
          <PartLabel partId={k('front-axle')} at={[1.88, 0.55, FRONT_Z + 0.15]} />
          {linkage && <PartLabel partId={k('top-link')} at={[-0.75, 1.05, 0]} />}
          {linkage && <PartLabel partId={k('lower-links')} at={[-0.7, 0.35, 0.45]} />}
          {drawbar && <PartLabel partId={k('drawbar')} at={[-0.6, 0.38, 0]} />}
          <PartLabel partId={k('pto')} at={[-0.35, 0.58, 0.12]} />
          {rops && <PartLabel partId={k('rops')} at={[-0.42, 2.35, 0]} />}
        </>
      )}
    </group>
  )
}
