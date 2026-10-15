import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { PartLabel } from '@/render/Label'
import type { MaterialKey } from '@/render/materials'
import { TractorEffects, type EffectsInput } from '@/render/Effects'
import { Suspense } from 'react'
import { MODEL_EXHAUST, ModelTractor } from './ModelTractor'
import { Part, PartMesh } from '@/render/Part'
import { LINKAGE, TRACTOR } from './dims'
import { AXLE_Y, CROWN, DRIVE_Y, FRONT_Y, FRONT_Z, GEARBOX, KINGPIN_Z, PTO_STUB_X, PTO_Y, REAR_Z, tractorGeometry } from './geometry'
import { phiForHitchHeight, solveLinkage, type LinkagePose } from './linkage'
import { insideReady, useInside } from '@/ui/inside'
import { Engine } from '@/machines/Engine'
import { engineReady } from '@/machines/engine.geometry'
import { ENGINE_X, FIRING } from './engine'
import { CrawlerTracks } from './CrawlerTrack'
import { ART_AXLE_X, ART_GAIN, ART_MAX, ART_PROP_FROM, ART_PROP_QUAT, HINGE_X, RAM_FRONT, RAM_REAR, articulatedGeometry } from './articulated'
import { crawlerGeometry } from './crawler'
import { AXLE4_Y, FRONT_4WD, KINGPIN4_Z, PROP_FROM, PROP_QUAT, mfwdGeometry } from './mfwd'
import { WholeTractor } from './WholeTractor'
import { TractorSystems, useSystemsReady, type TractorSystem } from './InPlaceSystems'
import { FINAL_RATIO } from './FinalDrives'
import { PTO_FROM_LAY } from './PtoDrive'
import { ClutchInternals, ClutchPlate, CrownWheel, GearTrain, GearboxInternals, newAngles } from './DrivelineInternals'

/**
 * Mutable pose of the shared tractor. Scenes mutate it every frame (never React state);
 * <Tractor> reads it in its own frame callback. Angles in radians.
 */
export interface TractorPose {
  /** rear-wheel rotation (positive = rolling forward) */
  rearAngle: number
  frontAngle: number
  /** mean front-wheel steer angle; positive yaws the wheels about +Y, i.e. turning LEFT (towards −Z) */
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
  /** exhaust smoke and wheel dust: scenes fill this in every frame (unset = no effects) */
  effects?: EffectsInput
}

export function createTractorPose(p: Partial<TractorPose> = {}): TractorPose {
  return { rearAngle: 0, frontAngle: 0, steer: 0, engineAngle: 0, ptoAngle: 0, hitchHeight: 0.45, ...p }
}

export { ackermann } from './steer'
import { ackermann } from './steer'

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
  frontAxle4: { summary: 'Driven front axle (MFWD).', role: 'A differential in the axle centre and an epicyclic reduction in each swivel housing drive the front wheels; the swivels steer them. The axle pivots on a fore-and-aft pin so all four wheels stay on rough ground.', details: 'Front assist roughly doubles the share of the weight that gives traction, at the cost of a little more rolling loss; it is usually engaged for heavy draft work and on slippery ground.' },
  hinge: { summary: 'Articulation hinge and steering rams.', role: 'The front and rear frames turn about vertical pins above and below the driveline; two double-acting rams fold them to steer, and a universal joint in the shaft passes the drive through the hinge. The rear wheels follow in the front wheels’ tracks, so there is less soil compaction and no steered axle to carry.' },
  frontAxleArt: { summary: 'Rigid driven front axle.', role: 'A differential and half shafts like the rear axle’s, with the same size of wheels: the weight is nearly equal front and rear, so all four wheels pull alike.' },
  tracks: { summary: 'Steel tracks in place of the wheels (crawler).', role: 'The drive sprocket on each half shaft lays a track of steel shoes down ahead of the tractor and picks it up behind: a long contact patch gives low ground pressure, little slip and high drawbar pull in soft soil. Steering is by slowing one track (skid steering).', details: 'Sprocket on the rear axle, idler at the front on a recoil spring, five bottom rollers on each track frame; an equaliser bar across the front lets the frames rock independently.' },
  frontDrive: { summary: 'Transfer box and front propeller shaft.', role: 'A gear pair under the gearbox takes drive off the output shaft to a propeller shaft with a universal joint at each end; the front pinion turns at the rear pinion’s speed, so the front tyres keep pace with the rears.' },
  frontWheels4: { summary: 'Driven front wheels (11.2-24 lugged tyres).', role: 'Bigger than a 2WD tractor’s steering tyres and lugged for traction; geared to run at the same ground speed as the rear wheels.' },
  frontWheels: { summary: 'Front steering wheels, F-2 rib tyres.', role: 'Carry the front weight and steer. The ribs resist sideways slip.' },
  station: { summary: 'Operator station.', role: 'Seat, steering wheel, controls, fuel tank and platform.' },
  drivetrain: { summary: 'Engine and transmission internals.', role: 'The moving heart of the tractor, shown inside the detailed body: crankshaft, flywheel, clutch, gearbox and crown wheel turn in step with the wheels. Turn on X-ray to see them through the bonnet.' },
  cab: { summary: 'Operator cab.', role: 'An enclosed, ROPS-rated cab: keeps out dust, noise, spray and weather, and carries the lights, mirrors and the GNSS receiver on its roof.' },
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
  /** enclosed cab instead of the open ROPS frame */
  cab?: boolean
  /**
   * 'procedural' (default): the inspectable built-in tractor with sectionable internals.
   * 'model': the detailed downloaded exterior (field scenes); linkage, drawbar and PTO stay ours.
   */
  look?: 'procedural' | 'model'
  /** show the seated driver (detailed model only) */
  driver?: boolean
  /** show the engine/transmission internals inside the housings */
  internals?: boolean
  /** '4wd': mechanical front-wheel drive — a driven, steered front axle and bigger lugged front tyres */
  drive?: '2wd' | '4wd'
  /** 'tracks': a crawler — a steel track each side, driven by a sprocket on the rear axle, instead of the four wheels */
  running?: 'wheels' | 'tracks'
  /** crawler: track centre to centre (default the rear wheel track); wider takes the drive out through outboard final drives */
  trackGauge?: number
  /** 'articulated': front and rear frames joined by a vertical hinge, steered by folding; equal wheels front and rear, both axles driven */
  frame?: 'rigid' | 'articulated'
  /** draw the operator's seat (off where a scene mounts its own, e.g. a suspended seat) */
  seat?: boolean
  /** systems the scene draws its own way (e.g. a steering scene's own linkage); the tractor leaves these out */
  sceneSystems?: TractorSystem[]
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
const NO_EFFECTS: EffectsInput = {}
/** top of the exhaust stack and the ground just behind each rear tyre */
const EXHAUST_TIP: [number, number, number] = [1.45, 2.06, 0.2]
const DUST_AT: [number, number, number][] = [
  [-0.45, 0.06, TRACTOR.rear.track / 2],
  [-0.45, 0.06, -TRACTOR.rear.track / 2],
]
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
/** idle speed shown when looking inside an engine that nothing is driving */
const IDLE_RPM = 800

/** 0 → 1 → 0 over [on, off) seconds with short ramps */
function pulse(x: number, on: number, off: number, ramp = 0.35) {
  return Math.max(0, Math.min(1, (x - on) / ramp, (off - x) / ramp))
}

const CLUTCH_INSIDE = { ...INFO.clutchHousing, inside: 'Flywheel side of the clutch: driven plate, pressure plate, diaphragm spring and release bearing; the pedal is pressed and released for you.', insideView: [-1, 0.55, -0.8] as [number, number, number] }
const GEARBOX_INSIDE = { ...INFO.gearbox, inside: 'All three gear pairs, the gears that run free on the main shaft, the dog collar and its selector fork; it goes from neutral into gear for you.' }
const CENTRE_INSIDE = { ...INFO.centre, inside: 'Crown wheel and pinion with the differential cut open: planet pinions and side gears turning as the tractor steers.', insideView: [-0.7, 0.75, 1] as [number, number, number] }

const TRACTOR_INSIDE = { ...INFO.tractor, inside: 'Every system at once, working: engine, clutch, gearbox and differential, and the rest as they are added, colour-coded, with an exploded layout.', insideMode: 'whole' as const }

const ENGINE_INSIDE = { ...INFO.engine, inside: 'The full four-cylinder diesel, working in slow motion: block and head, crankshaft, pistons and rods, camshaft, tappets, pushrods, rockers, valves and springs, injectors and pump, with the gas in each cylinder glowing as it fires.', insideView: [0.75, 0.7, 1.1] as [number, number, number] }

export function Tractor({ pose, id = 'tractor', paint = 'paintRed', linkage = true, drawbar = true, rops = true, cab = false, look = 'procedural', driver = true, internals = true, drive = '2wd', running = 'wheels', trackGauge, frame = 'rigid', seat = true, sceneSystems = [], labels = true, mounted, trailed, gearRatio = 2, finalRatio = 1, position, rotation, children }: TractorProps) {
  const G = useMemo(() => tractorGeometry(), [])
  const k = (s: string) => `${id}-${s}`
  const D = G.detail
  const tracks = running === 'tracks'
  const art = frame === 'articulated' && !tracks
  const four = drive === '4wd' && !tracks && !art
  const GT = useMemo(() => (tracks ? crawlerGeometry(trackGauge) : null), [tracks, trackGauge])
  const GA = useMemo(() => (art ? articulatedGeometry(G.trumpets) : null), [art, G])
  /** the front frame's groups (articulated: they turn about the hinge) */
  const frontFrames = useRef<(THREE.Group | null)[]>([])
  const addFront = (i: number) => (el: THREE.Group | null) => void (frontFrames.current[i] = el)
  const rams = useRef<(THREE.Group | null)[]>([])
  const hingeJoint = useRef<THREE.Group>(null)
  const G4 = useMemo(() => (four ? mfwdGeometry() : null), [four])
  /** steered front wheels: kingpin height and position, and the wheel offset from it */
  const kingY = four ? AXLE4_Y : FRONT_Y
  const kingZ = four ? KINGPIN4_Z : KINGPIN_Z
  const frontRoll = four ? FRONT_4WD.rolling : art ? TRACTOR.rear.rolling : TRACTOR.front.radius
  const propRef = useRef<THREE.Group>(null)
  /** distance the tracks have run (crawler) */
  const run = useRef(0)

  const rearL = useRef<THREE.Group>(null)
  const rearR = useRef<THREE.Group>(null)
  const frontL = useRef<THREE.Group>(null)
  const frontR = useRef<THREE.Group>(null)
  const knuckleL = useRef<THREE.Group>(null)
  const knuckleR = useRef<THREE.Group>(null)
  const crank = useRef<THREE.Group>(null)
  const flywheel = useRef<THREE.Group>(null)
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
  // working parts mount only while you look inside their housing
  const inside = useInside((s) => (s.id?.startsWith(id + '-') ? s.id.slice(id.length + 1) : null))
  const insideEngine = inside === 'engine'
  const insideClutch = inside === 'clutch-housing'
  const insideGearbox = inside === 'gearbox'
  const insideCentre = inside === 'centre-housing'
  /** the whole tractor is open: every system at once */
  const whole = useInside((s) => s.id === id)
  // opening the engine before its geometry is built: say so until it arrives
  useEffect(() => {
    if (insideEngine && !engineReady(FIRING)) useInside.setState({ loading: true })
  }, [insideEngine])
  /** the detailed systems on the procedural tractor (their stand-ins show until they are built) */
  const sysWanted = internals && look === 'procedural'
  const sysReady = useSystemsReady(sysWanted)
  const systems = sysWanted && sysReady
  const outline = (
    <>
      <PartMesh geometry={G.block} />
      <PartMesh geometry={G.head} />
      <PartMesh geometry={G.timingCover} />
      <PartMesh geometry={G.sump} material="paintGrey" />
    </>
  )
  /** drive angles shared with the internals */
  const ang = useRef(newAngles())
  /** demo state for a parked tractor: the engine idles, the pedal, lever and steering are worked for you */
  const demo = useRef({ idle: 0, last: NaN, lastCrank: 0, disc: 0, lastLay: 0, out: 0, crown: 0, lastCrown: 0, diff: 0, hitchT: 0 })

  useSimFrame((dt) => {
    const p = pose
    rearL.current?.rotation.set(0, 0, -p.rearAngle)
    rearR.current?.rotation.set(0, 0, -p.rearAngle)
    run.current = p.rearAngle * TRACTOR.rear.rolling
    const fa = (p.frontAngle * TRACTOR.front.radius) / frontRoll
    frontL.current?.rotation.set(0, 0, -fa)
    frontR.current?.rotation.set(0, 0, -fa)
    
    if (p.rearTrack !== undefined) {
      const rZ = p.rearTrack / 2
      if (rearL.current?.parent) rearL.current.parent.position.z = rZ
      if (rearR.current?.parent) rearR.current.parent.position.z = -rZ
    }
    if (p.frontTrack !== undefined) {
      const fZ = p.frontTrack / 2
      const kZ = fZ - (TRACTOR.front.track / 2 - kingZ)
      if (knuckleR.current?.parent) knuckleR.current.parent.position.z = kZ
      if (knuckleL.current?.parent) knuckleL.current.parent.position.z = -kZ
    }

    // driveline (display): wheel → crown wheel → pinion/output → layshaft → input/crank
    const opened = useInside.getState().id
    const mine = opened?.startsWith(id + '-') ? opened.slice(id.length + 1) : null
    const wholeOpen = opened === id
    // the whole tractor shows its final drives, so the display gearing uses their real reduction
    const fr = wholeOpen ? FINAL_RATIO : finalRatio
    let crownA = p.rearAngle * fr
    let pin = (crownA * CROWN.teeth) / CROWN.pinion
    let layA = (-pin * GEARBOX.selected[0]) / GEARBOX.selected[1]
    let inA = (-layA * GEARBOX.input[1]) / GEARBOX.input[0]
    const raw = p.engineAngle || pin * gearRatio
    let crankA = raw
    const d = demo.current
    const a = ang.current
    // looking inside a tractor that is not being driven: idle the engine and work the controls
    const parked = (!!mine || wholeOpen) && raw === d.last
    d.last = raw
    if (parked) d.idle += (dt * 2 * Math.PI * IDLE_RPM) / 60
    crankA += d.idle
    const t = performance.now() / 1000
    a.pedal = mine === 'clutch-housing' ? pulse(t % 6, 2.5, 5) : 0
    d.disc += (crankA - d.lastCrank) * (1 - a.pedal)
    d.lastCrank = crankA
    a.engage = 1
    if (parked) {
      // the gearbox input is the clutch shaft; the box goes from neutral into gear and back
      inA = d.disc
      layA = (-inA * GEARBOX.input[0]) / GEARBOX.input[1]
      // the whole tractor idles along in gear, so the drive can be followed to the wheels
      a.engage = mine === 'gearbox' ? pulse(t % 7, 2.5, 6) : wholeOpen ? 1 : 0
      d.out += ((-(layA - d.lastLay) * GEARBOX.selected[1]) / GEARBOX.selected[0]) * (a.engage > 0.9 ? 1 : 0)
      if (mine === 'centre-housing') d.out += dt * 25 // crawl so the differential has something to do
      pin = d.out
      crownA = (pin * CROWN.pinion) / CROWN.teeth
      if (wholeOpen) {
        const wheel = crownA / fr
        run.current = wheel * TRACTOR.rear.rolling
        rearL.current?.rotation.set(0, 0, -wheel)
        rearR.current?.rotation.set(0, 0, -wheel)
        frontL.current?.rotation.set(0, 0, (-wheel * TRACTOR.rear.rolling) / frontRoll)
        frontR.current?.rotation.set(0, 0, (-wheel * TRACTOR.rear.rolling) / frontRoll)
      }
    }
    d.lastLay = layA
    // differential: the outer wheel gains what the inner one loses; δ = (track/2)·tan(steer)/wheelbase
    // parked demos steer for you: the differential corners; the whole tractor sweeps its steering
    const steer = parked && mine === 'centre-housing' ? 0.5 * Math.sin(t * 0.6) : parked && wholeOpen ? 0.4 * Math.sin(t * 0.3) : p.steer
    const track = p.frontTrack ?? 2 * KINGPIN_Z + 0.18
    const st = ackermann(steer, TRACTOR.wheelbase, track)
    if (art) {
      // fold the frames: the front frame turns about the hinge, the rams follow
      const al = Math.max(-ART_MAX, Math.min(ART_MAX, steer * ART_GAIN))
      for (const g of frontFrames.current) g?.rotation.set(0, al, 0)
      const c = Math.cos(al)
      const sn = Math.sin(al)
      rams.current.forEach((g, i) => {
        if (!g) return
        const sz = i < 2 ? 1 : -1
        const fx = RAM_FRONT.x - HINGE_X
        const fz = sz * RAM_FRONT.z
        v.a.set(RAM_REAR.x, RAM_REAR.y, sz * RAM_REAR.z)
        v.b.set(HINGE_X + fx * c + fz * sn, RAM_FRONT.y, -fx * sn + fz * c)
        // barrel from the rear anchor, rod from the front anchor
        if (i % 2 === 0) orient(g, v.a, v.b)
        else orient(g, v.b, v.a)
      })
      hingeJoint.current?.rotation.set(inA, 0, 0)
    }
    knuckleL.current?.rotation.set(0, st.left, 0)
    knuckleR.current?.rotation.set(0, st.right, 0)
    d.diff += (crownA - d.lastCrown) * ((REAR_Z * Math.tan(steer)) / TRACTOR.wheelbase)
    d.lastCrown = crownA
    Object.assign(a, { crank: crankA, disc: d.disc, input: inA, lay: layA, output: pin, crown: crownA, diff: d.diff, steerLeft: st.left, steerRight: st.right })
    crank.current?.rotation.set(crankA, 0, 0)
    flywheel.current?.rotation.set(crankA, 0, 0)
    // the whole tractor drives its stub through the PTO gears; elsewhere the scene sets it
    // the front propeller shaft turns with the rear pinion
    propRef.current?.rotation.set(pin, 0, 0)
    pto.current?.rotation.set(wholeOpen ? layA / PTO_FROM_LAY : p.ptoAngle, 0, 0)

    // the whole tractor, parked, works its linkage up and down so the hydraulics can be watched
    let hh = p.hitchHeight
    if (wholeOpen && parked) {
      d.hitchT += dt
      hh = 0.45 + 0.2 * Math.sin(d.hitchT * 0.35)
    }
    a.hitchRate += ((dt > 0 ? (hh - a.hitch) / dt : 0) - a.hitchRate) * 0.2
    a.hitch = hh
    if (!linkage) return
    const lk = solveLinkage(phiForHitchHeight(hh))
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
      <TractorEffects input={() => pose.effects ?? NO_EFFECTS} exhaustAt={look === 'model' ? MODEL_EXHAUST : EXHAUST_TIP} wheelsAt={DUST_AT} />
      <Part id={id} name="Tractor" role="housing" material={paint} info={look === 'procedural' ? TRACTOR_INSIDE : INFO.tractor} cites={cites} explode={false} xray={whole || undefined}>
        {look === 'model' ? (
          <>
            <Suspense fallback={null}>
              <ModelTractor pose={pose} id={id} driver={driver} steerAngles={(st) => ackermann(st, TRACTOR.wheelbase, pose.frontTrack ?? 2 * KINGPIN_Z + 0.18)} />
            </Suspense>
            {internals && (
              <Part id={k('drivetrain')} name="Drivetrain (inside the body)" role="moving" material="steel" info={INFO.drivetrain} explode={false}>
                <Part id={k('crank')} name="Crankshaft" role="moving" material="forged" info={INFO.crank} explode={[0, 0.45, 0]}>
                  <group position={[1.7, DRIVE_Y, 0]} ref={crank}>
                    <PartMesh geometry={G.crank} />
                  </group>
                </Part>
                <Part id={k('flywheel')} name="Flywheel" role="moving" material="castIron" info={INFO.flywheel} explode={[0, 0.35, 0.3]}>
                  <group position={[0.785, DRIVE_Y, 0]} ref={flywheel}>
                    <PartMesh geometry={G.flywheel} />
                  </group>
                </Part>
                <ClutchPlate a={ang} k={k} G={G} info={INFO.clutchDisc} explode={[0, 0.35, 0.55]} />
                <GearTrain a={ang} k={k} G={G} info={INFO.gears} explode={[0, 0.4, 0.8]} />
                <CrownWheel a={ang} k={k} G={G} info={INFO.crownWheel} cites={[SRC.pt510('final drive')]} explode={[0, 0.5, -0.6]} open={false} />
              </Part>
            )}
          </>
        ) : (
          <>
            {/* front frame (turns about the hinge when articulated) */}
            <group ref={addFront(0)} position={[HINGE_X, 0, 0]}>
              <group position={[-HINGE_X, 0, 0]}>
            <Part id={k('engine')} name="Engine" material="castIron" info={ENGINE_INSIDE} cites={[SRC.mech502('p1'), SRC.l4_509('engine parts')]} explode={[0, 0.25, 0]}>
              {/* the real engine, every part working; the outline castings stand in while it is built */}
              {whole ? null : internals ? (
                <Engine
                  k={k}
                  firing={FIRING}
                  paint={paint}
                  crankAngle={() => ang.current.crank}
                  // the fuel system draws its own injection pump and pipes
                  fuel={!systems || sceneSystems.includes('fuel')}
                  position={[ENGINE_X, DRIVE_Y, 0]}
                  rotation={[0, Math.PI / 2, 0]}
                  placeholder={outline}
                  onReady={() => useInside.getState().id === k('engine') && insideReady()}
                />
              ) : (
                outline
              )}
            </Part>
            <Part id={k('bonnet')} name="Bonnet" material={paint} info={INFO.bonnet} explode={[0, 0.5, 0]}>
              <PartMesh geometry={G.bonnet} />
              <PartMesh geometry={D.grilleBack} material="paintBlack" />
              <PartMesh geometry={D.grilleBars} material="steelDark" />
              <PartMesh geometry={D.grilleFrame} material="chrome" />
              <PartMesh geometry={D.lampHousings} material="chrome" />
              <PartMesh geometry={D.lampLenses} material="glass" />
              <PartMesh geometry={D.badge} material="chrome" />
              <PartMesh geometry={D.louvres} material="paintBlack" />
              <PartMesh geometry={D.stripe} material="paintBlack" />
              <PartMesh geometry={G.airCleaner} material="paintBlack" />
              <PartMesh geometry={G.airCleanerBands} material="steel" />
              <PartMesh geometry={D.exPipe} material="steelDark" />
              <PartMesh geometry={D.muffler} material="paintBlack" />
            </Part>
            <Part id={k('radiator')} name="Radiator" role="static" material="copper" info={INFO.radiator} cites={[SRC.supp509('cooling system')]} explode={[0.35, 0, 0]}>
              {/* the cooling system's radiator replaces the outline block once built */}
              {systems && !sceneSystems.includes('cooling') ? null : <PartMesh geometry={G.radiator} />}
              <PartMesh geometry={G4 ? G4.support : G.bolster} material="castIron" />
              {G4 ? null : <PartMesh geometry={G.bolsterSteel} material="steelDark" />}
            </Part>
            <Part id={k('clutch-housing')} name="Clutch housing" material="castIron" info={CLUTCH_INSIDE} cites={[SRC.pt510('clutch')]} explode={[0, 0, 0.4]}>
              <PartMesh geometry={G.clutchHousing} />
              {((internals && !whole) || insideClutch) && <ClutchPlate a={ang} k={k} G={G} info={INFO.clutchDisc} />}
              {insideClutch ? <ClutchInternals a={ang} k={k} /> : null}
            </Part>
              </group>
            </group>
            <Part id={k('gearbox')} name="Gearbox" material="castIron" info={GEARBOX_INSIDE} cites={[SRC.mech502('p8, 98 % per gear pair'), SRC.pt510('gearboxes')]} explode={[0, 0, 0.45]}>
              <PartMesh geometry={G.gearbox} />
              {insideGearbox ? <GearboxInternals a={ang} k={k} /> : null}
              {((internals && !whole) || insideGearbox) && <GearTrain a={ang} k={k} G={G} info={INFO.gears} />}
            </Part>
            <Part id={k('centre-housing')} name="Centre housing" material="castIron" info={CENTRE_INSIDE} cites={[SRC.pt510('crown wheel & pinion, differential')]} explode={[0, 0, -0.45]}>
              <PartMesh geometry={G.centre} />
              <PartMesh geometry={G.liftCover} />
              <PartMesh geometry={G.brackets} material="forged" />
              <PartMesh geometry={D.hoses} material="rubber" />
              <PartMesh geometry={D.couplers} material="chrome" />
              {((internals && !whole) || insideCentre) && <CrownWheel a={ang} k={k} G={G} info={INFO.crownWheel} cites={[SRC.pt510('final drive')]} open={insideCentre} />}
            </Part>
            <Part id={k('trumpets')} name="Rear axle housings" material="castIron" info={INFO.trumpets} explode={[0, -0.15, 0]}>
              <PartMesh geometry={G.trumpets} />
            </Part>
            {GT ? (
              <Part id={k('tracks')} name="Tracks" role="moving" material="steelDark" info={INFO.tracks} cites={[SRC.tt510('tracks')]} explode={false}>
                <PartMesh geometry={GT.frames} material={paint} />
                <PartMesh geometry={GT.equaliser} material="forged" />
                {GT.finals ? <PartMesh geometry={GT.finals} material="castIron" /> : null}
                <CrawlerTracks layout={GT.layout} geometry={GT.parts} z={GT.z} travel={() => run.current} />
              </Part>
            ) : (
            <Part id={k('rear-wheels')} name="Rear wheels" role="moving" material="rubber" info={INFO.rearWheels} cites={[SRC.mech502('eq 2.1–2.2'), SRC.tt510('tyre types')]} explode={false} xray={whole || undefined}>
              {([1, -1] as const).map((s) => (
                <Part key={s} id={k(s > 0 ? 'rear-wheel-r' : 'rear-wheel-l')} name={s > 0 ? 'Rear wheel (right)' : 'Rear wheel (left)'} explode={[0, 0, s * 0.6]}>
                  <group position={[0, AXLE_Y, s * REAR_Z]}>
                    <group ref={s > 0 ? rearL : rearR}>
                      <group rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                        <PartMesh geometry={G.rearTyre} />
                        <PartMesh geometry={G.rearRim} material="paintGrey" />
                        <PartMesh geometry={D.rearHub} material="steelDark" />
                      </group>
                    </group>
                  </group>
                </Part>
              ))}
            </Part>
            )}
            {GA ? (
              <>
                <group ref={addFront(1)} position={[HINGE_X, 0, 0]}>
                  <group position={[-HINGE_X, 0, 0]}>
                    <Part id={k('front-axle')} name="Driven front axle" role="static" material="castIron" info={INFO.frontAxleArt} explode={[0.4, -0.05, 0]}>
                      <PartMesh geometry={GA.frontAxle} />
                      <PartMesh geometry={GA.rails} material={paint} />
                      {([1, -1] as const).map((s) => (
                        <Part key={s} id={k(s > 0 ? 'front-wheel-r' : 'front-wheel-l')} name={s > 0 ? 'Front wheel (right)' : 'Front wheel (left)'} role="moving" material="rubber" info={INFO.rearWheels} explode={[0, 0, s * 0.6]} xray={whole || undefined}>
                          <group position={[ART_AXLE_X, AXLE_Y, s * REAR_Z]}>
                            <group ref={s > 0 ? frontL : frontR}>
                              <group rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                                <PartMesh geometry={G.rearTyre} />
                                <PartMesh geometry={G.rearRim} material="paintGrey" />
                                <PartMesh geometry={D.rearHub} material="steelDark" />
                              </group>
                            </group>
                          </group>
                        </Part>
                      ))}
                    </Part>
                    <Part id={k('front-drive')} name="Front propeller shaft" role="moving" material="steel" info={INFO.frontDrive} explode={[0, -0.2, 0]}>
                      <group position={ART_PROP_FROM} quaternion={ART_PROP_QUAT}>
                        <group ref={propRef}>
                          <PartMesh geometry={GA.prop} />
                        </group>
                      </group>
                    </Part>
                  </group>
                </group>
                <Part id={k('hinge')} name="Articulation hinge & steering rams" role="moving" material="forged" info={INFO.hinge} explode={[0, 0.3, 0]}>
                  <PartMesh geometry={GA.hinge} />
                  <group position={[HINGE_X, DRIVE_Y, 0]} ref={hingeJoint}>
                    <PartMesh geometry={GA.hingeJoint} material="steel" />
                  </group>
                  {[0, 1, 2, 3].map((i) => (
                    <group key={i} ref={(el) => void (rams.current[i] = el)}>
                      <PartMesh geometry={i % 2 === 0 ? GA.ramBarrel : GA.ramRod} material={i % 2 === 0 ? 'paintBlack' : 'chrome'} />
                    </group>
                  ))}
                </Part>
              </>
            ) : GT ? null : (
            <>
            <Part id={k('front-axle')} name={four ? 'Driven front axle' : 'Front axle'} role="static" material={four ? 'castIron' : 'forged'} info={four ? INFO.frontAxle4 : INFO.frontAxle} cites={[SRC.st510('front axle, steering linkage')]} explode={[0.4, -0.05, 0]}>
              {G4 ? (
                <>
                  <PartMesh geometry={G4.housing} />
                  <PartMesh geometry={G4.pivot} material="forged" />
                  <PartMesh geometry={G4.trackRod} material="forged" />
                </>
              ) : (
                <>
                  <PartMesh geometry={G.axleBeam} />
                  <PartMesh geometry={G.axleBolts} material="steelDark" />
                  <PartMesh geometry={G.axleHoles} material="paintBlack" />
                </>
              )}
              {([1, -1] as const).map((s) => (
                <group key={s} position={[TRACTOR.wheelbase, kingY, s * kingZ]}>
                  <group ref={s > 0 ? knuckleR : knuckleL}>
                    <group rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                      <PartMesh geometry={G4 ? G4.swivel : G.knuckle} />
                      {G4 ? null : <PartMesh geometry={G.knuckleSteel} material="steel" />}
                    </group>
                    <Part id={k(s > 0 ? 'front-wheel-r' : 'front-wheel-l')} name={s > 0 ? 'Front wheel (right)' : 'Front wheel (left)'} explode={[0, 0, s * 0.45]} role="moving" material="rubber" info={four ? INFO.frontWheels4 : INFO.frontWheels} xray={whole || undefined}>
                      <group position={[0, 0, s * (FRONT_Z - kingZ)]}>
                        <group ref={s > 0 ? frontL : frontR}>
                          <group rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
                            <PartMesh geometry={G4 ? G4.tyre : G.frontTyre} />
                            <PartMesh geometry={G4 ? G4.rim : G.frontRim} material="paintGrey" />
                            <PartMesh geometry={G4 ? G4.hub : D.frontHub} material="steelDark" />
                          </group>
                        </group>
                      </group>
                    </Part>
                  </group>
                </group>
              ))}
            </Part>
            {G4 ? (
              <Part id={k('front-drive')} name="Transfer box & front propeller shaft" role="moving" material="steel" info={INFO.frontDrive} explode={[0, -0.2, 0]}>
                <PartMesh geometry={G4.transfer} material="castIron" />
                <group position={PROP_FROM} quaternion={PROP_QUAT}>
                  <group ref={propRef}>
                    <PartMesh geometry={G4.prop} />
                  </group>
                </group>
              </Part>
            ) : null}
            </>
            )}
            {/* no wheel fenders over a wide-gauge crawler's outboard tracks */}
            {GT?.finals ? null : (
            <Part id={k('fenders')} name="Fenders" material={paint} info={INFO.fenders} explode={[0, 0.35, 0]}>
              <PartMesh geometry={G.fenders} />
              <PartMesh geometry={D.tail} material="paintRed" />
            </Part>
            )}
            <Part id={k('station')} name="Operator station" role="static" material="paintGrey" info={INFO.station} cites={[SRC.he510('operator station')]} cut={false} explode={[-0.15, 0.6, 0]}>
              <PartMesh geometry={G.platform} material="paintBlack" />
              <PartMesh geometry={G.tank} material={paint} />
              <PartMesh geometry={G.dash} />
              {seat ? (
                <>
                  <PartMesh geometry={G.seat} material="plastic" />
                  <PartMesh geometry={D.seatSides} material="plastic" />
                  <PartMesh geometry={G.seatPost} material="steelDark" />
                </>
              ) : null}
              <PartMesh geometry={D.pod} material="paintBlack" />
              <PartMesh geometry={D.bezels} material="chrome" />
              <PartMesh geometry={D.gaugeFaces} material="ceramic" />
              <PartMesh geometry={D.filler} material="chrome" />
              {/* the steering system brings its own wheel and column */}
              {systems || sceneSystems.includes('steering') ? null : (
                <>
                  <PartMesh geometry={G.column} material="steelDark" />
                  <PartMesh geometry={G.steeringWheel} material="plastic" />
                </>
              )}
            </Part>
            {rops && !cab && (
              <Part id={k('rops')} name="ROPS frame" role="static" material="paintBlack" info={INFO.rops} cites={[SRC.he510('p20–21 ROPS')]} cut={false} explode={[0, 0.9, 0]}>
                <PartMesh geometry={G.rops} />
                <PartMesh geometry={D.workLights} />
                <PartMesh geometry={D.workLenses} material="glass" />
                <PartMesh geometry={D.beacon} material="paintOrange" />
              </Part>
            )}
            {cab && (
              <Part id={k('cab')} name="Cab" role="static" material={paint} info={INFO.cab} cut={false} explode={[0, 0.9, 0]}>
                <PartMesh geometry={D.cab.posts} material="paintBlack" />
                <PartMesh geometry={D.cab.roof} />
                <PartMesh geometry={D.cab.rails} material="paintBlack" />
                <PartMesh geometry={D.cab.lights} material="paintBlack" />
                <PartMesh geometry={D.beacon} material="paintOrange" position={[0, 0.06, 0]} />
                <Part id={k('cab-glass')} name="Cab glass" material="glass" info={INFO.cab}>
                  <PartMesh geometry={D.cab.glass} castShadow={false} />
                </Part>
              </Part>
            )}
          </>
        )}
        {drawbar && (
          <Part id={k('drawbar')} name="Drawbar" role="static" material="forged" info={INFO.drawbar} cites={[SRC.hitch502('trailed hitch, Fig 6.1')]} explode={[-0.4, -0.05, 0]}>
            <PartMesh geometry={G.drawbar} />
            {trailed && <group position={[TRACTOR.drawbar.x, TRACTOR.drawbar.y, 0]}>{trailed}</group>}
          </Part>
        )}
        <Part id={k('pto')} name="PTO" role="moving" material="steel" info={INFO.pto} cites={[SRC.pto502('540 / 1000 rpm, guards')]} explode={[-0.3, 0, 0]}>
          <group position={[PTO_STUB_X, PTO_Y, 0]} ref={pto}>
            <PartMesh geometry={G.ptoStub} />
            {internals && <PartMesh geometry={G.ptoShaft} />}
          </group>
          <Part id={k('pto-shield')} name="PTO master shield" role="static" material={paint} info={{ summary: 'PTO master shield.', role: 'Covers the PTO stub so clothing cannot be caught — a 540 rpm shaft wraps 7 ft of string in one second.' }} cut={false}>
            <PartMesh geometry={G.ptoShield} />
          </Part>
        </Part>
        {linkage && (
          <Part id={k('linkage')} name="Three-point linkage" role="moving" material="forged" info={INFO.linkage} cites={[SRC.hitch502('Figs 6.3–6.5'), SRC.hy510('3-point linkage')]} explode={[-0.5, 0, 0]}>
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
        {systems && !whole ? <TractorSystems a={ang} k={k} omit={sceneSystems} /> : null}
        {whole && look === 'procedural' ? <WholeTractor a={ang} k={k} G={G} paint={paint} rootId={id} /> : null}
        {/* the implement steps aside while the whole tractor is open */}
        <group visible={!whole}>
          {linkage && mounted && <group ref={hitch}>{mounted}</group>}
          {children}
        </group>
      </Part>
      {labels && look === 'procedural' && (
        <>
          <PartLabel partId={k('engine')} at={[1.3, 1.5, 0.3]} />
          <PartLabel partId={k('gearbox')} at={[0.36, 0.95, 0.3]} />
          <PartLabel partId={k('centre-housing')} at={[0, 1.15, 0.3]} />
          <PartLabel partId={k('rear-wheels')} at={[0, 1.35, REAR_Z + 0.2]} />
          {!tracks && <PartLabel partId={k('front-axle')} at={art ? [ART_AXLE_X, 1.45, REAR_Z + 0.2] : [1.88, four ? 0.85 : 0.55, FRONT_Z + 0.15]} />}
          {art && <PartLabel partId={k('hinge')} at={[HINGE_X, 1.15, 0.35]} />}
          {four && <PartLabel partId={k('front-drive')} at={[1.0, 0.25, -0.35]} />}
          {linkage && <PartLabel partId={k('top-link')} at={[-0.75, 1.05, 0]} />}
          {linkage && <PartLabel partId={k('lower-links')} at={[-0.7, 0.35, 0.45]} />}
          {drawbar && <PartLabel partId={k('drawbar')} at={[-0.6, 0.38, 0]} />}
          <PartLabel partId={k('pto')} at={[-0.35, 0.58, 0.12]} />
          {rops && !cab && <PartLabel partId={k('rops')} at={[-0.42, 2.35, 0]} />}
          {cab && <PartLabel partId={k('cab')} at={[-0.05, 2.5, 0]} />}
        </>
      )}
    </group>
  )
}
