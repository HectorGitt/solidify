import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { clutchPedal, TYPICAL_PEDAL } from '@/physics/gearing'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import type { MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useLive } from '@/ui/live'
import { POWER } from '../common/anim'
import { meshPhase } from '@/parts/lib/shapes'
import { DC, DISC_T, DUAL_PRIMARY, DUAL_STAGE2, GAP_X, PEDAL_RATIO, SP, WP } from './dims'
import { BOX, FORK, IP, PEDAL, getClutchGeometry } from './geometry'
import {
  J_GEARBOX,
  J_PTO,
  dualCapacities,
  iptoCapacity,
  iptoForce,
  live,
  makeGraph,
  rpmToRad,
  radToRpm,
  singleCapacity,
  slipStep,
  useClutch,
  type SlipState,
} from './model'

const { PI } = Math
const LAY_PHASE = meshPhase(BOX.zIn, 0, BOX.zLay, -PI / 2)

const C = {
  single: [SRC.tts510('p3, Fig 31'), SRC.top510('p5, Fig A2.8; p7')],
  pedal: [SRC.tts510('p3–4 — free play 18 mm'), SRC.pt510('p2 — actuation')],
  dual: [SRC.top510('p6, Fig A2.9; p8'), SRC.tts510('p3 — dual clutch')],
  ipto: [SRC.top510('p7, Fig A2.10'), SRC.pt510('p2–3 — independent PTO')],
  multi: [SRC.top510('p7 — 10 + 9 plates, 18 surfaces'), SRC.m503(8, 'multiple-disc clutch')],
  gearbox: [SRC.tts510('p2–3')],
}

const INFO = {
  flywheel: { summary: 'Engine flywheel with the starter ring gear.', role: 'Driving member: its machined rear face is one of the two friction faces that grip the clutch plate. The ring gear (136 teeth) meshes with the starter pinion.' },
  crank: { summary: 'Crankshaft flange — drive from the engine.' },
  disc: {
    summary: 'Clutch plate (driven plate): steel disc with a friction lining on each face, splined to the gearbox shaft.',
    role: 'Clamped between flywheel and pressure plate it turns with the engine; released, it and the gearbox shaft are free. Linings here 300 × 180 mm; asbestos fabric on older tractors, organic or ceramic today — run dry, kept free of oil.',
    details: 'Two friction surfaces (n = 2). Torque capacity T = n·f·F·R_f.',
  },
  pp: { summary: 'Pressure plate.', role: 'Pushed towards the flywheel by the springs, it clamps the clutch plate. The release levers pull it back when the pedal is pressed.' },
  springs: { summary: 'Clutch springs (nine coil springs).', role: 'Provide the clamping force (here 7.2 kN in total). Clutch slip happens if they lose strength or if the free play is too small.' },
  cover: { summary: 'Clutch cover, bolted to the flywheel.', role: 'Carries the springs and the lever pivots; turns with the flywheel, so cover, springs and pressure plate keep spinning when the clutch is released.' },
  levers: { summary: 'Release levers (three).', role: 'Pivoted on the cover. When the thrust bearing pushes their inner ends towards the flywheel their outer ends pull the pressure plate back against the springs. Lever ratio ≈ 3.5 : 1.' },
  bearing: { summary: 'Thrust (release) bearing on its sliding carrier.', role: 'Pushed forward by the fork when the pedal is pressed. With correct free play it does not touch the levers when the pedal is up — too little free play wears it and lets the clutch slip.' },
  fork: { summary: 'Release fork and cross-shaft.', role: 'Turns the pedal (or ram) movement into the forward push on the thrust bearing.' },
  shaft: { summary: 'Gearbox input shaft (splined at the clutch plate).', role: 'Carries the drive "to gearbox". Its front end runs in a spigot bearing in the crankshaft. When the clutch is released it coasts down and stops.' },
  bell: { summary: 'Clutch (bell) housing — sectioned and hatched.', role: 'Encloses the clutch between engine and gearbox and carries the fork cross-shaft.' },
  gearbox: { summary: 'Front of the gearbox: constant-mesh input gear (20 T) and layshaft gear (34 T).', role: 'Shows whether the gearbox shaft is being driven, slipping or coasting.' },
  pedal: { summary: 'Clutch pedal.', role: 'Free play first (≈ 18 mm), then it frees the clutch. Never use it as a footrest — the weight of a foot takes up the free play.' },
  mech: { summary: 'Mechanical actuation: rods and levers (with springs; standard or over-centre linkage).', role: 'Mechanical clutch control by linkages and springs.' },
  hyd: { summary: 'Hydraulic actuation: master cylinder → pipe → slave (ram) cylinder.', role: 'The pedal works a master cylinder (a small pump with a fluid reservoir) that sends fluid under pressure to a ram cylinder on the clutch linkage; on release the clutch springs push the fluid back. It is the most common method.' },
  elec: { summary: 'Electrical actuation: an electric actuator (motor and screw) on the release linkage, switched from the cab.', role: 'Electrical control can be direct or indirect (e.g. a solenoid valve working a hydraulic ram).' },
  primary: { summary: 'Transmission drive plate (primary plate).', role: 'Splined to the solid transmission drive shaft. Released in the first half of the pedal travel: the wheels stop while the PTO keeps running.' },
  pp1: { summary: 'Primary pressure plate.', role: 'Clamps the transmission plate against the engine flywheel, loaded by coil springs; pulled back through the links by the release levers.' },
  falseFly: { summary: 'False flywheel.', role: 'Bolted to the engine flywheel; its rear face is the driving face for the PTO plate.' },
  secondary: { summary: 'PTO drive plate (secondary plate).', role: 'Splined to the hollow PTO drive shaft. Released only at full pedal travel, when the PTO adjusting set screws pick up the secondary pressure plate.' },
  pp2: { summary: 'Secondary pressure plate and Belleville spring.', role: 'The dished Belleville spring clamps the PTO plate against the false flywheel.' },
  ptoShaft: { summary: 'Hollow PTO drive shaft round the transmission drive shaft.', role: 'Concentric shafts: transmission inside, PTO outside — "live" PTO that keeps turning when the transmission is declutched.' },
  setScrews: { summary: 'Release levers with PTO adjusting set screws.', role: 'First half of travel: levers pull the primary pressure plate via the links. Then the set screws abut and pull the secondary plate too.' },
  iptoIn: { summary: 'Input: drive from the engine through the main shaft, with the hub and piston cylinder.', role: 'Turns whenever the engine runs, independent of the main transmission clutch.' },
  plates: { summary: 'Wet clutch pack: friction plates (on the hub) between steel inter-plates (in the drum).', role: 'Running in oil. Pressed together by the piston: here 5 friction plates give 10 friction surfaces with the piston and drum faces. A pack of 10 driving + 9 driven plates gives 18 surfaces.' },
  piston: { summary: 'Annular operating piston.', role: 'Oil pressure behind it forces the friction plates and inter-plates together to engage the PTO. Area here 188 cm²; at ≈ 15 bar it gives ≈ 28 kN.' },
  bellev: { summary: 'Belleville (dished) spring.', role: 'Returns the piston and frees the plates when the oil pressure is released.' },
  drum: { summary: 'Clutch drum on the PTO output shaft.', role: 'Carries the inter-plates and drives the P.T.O. shaft.' },
  valve: { summary: 'Spool control valve, fixed orifice and PTO brake pad.', role: 'The lever-worked spool sends oil from the multi-power pump (through the IPTO filter) to the piston. In neutral the pressure is released and the pad brakes the output so the PTO stops at once.' },
  pump: { summary: 'Ferguson (hydraulic) pump, driven from the same shaft.', role: 'Shown for position only; the clutch oil comes from the multi-power pump through the IPTO filter.' },
  filter: { summary: 'IPTO filter in the supply line.', role: 'Cleans the oil from the multi-power pump before it reaches the spool valve.' },
  housing: { summary: 'Transmission housing (cut away).' },
}

const vY = new THREE.Vector3(0, 1, 0)
function setRod(m: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3) {
  if (!m) return
  const d = b.clone().sub(a)
  m.position.copy(a)
  m.quaternion.setFromUnitVectors(vY, d.clone().normalize())
  m.scale.set(1, d.length(), 1)
}

export function ClutchScene3D() {
  const g = getClutchGeometry()
  const kind = useClutch((s) => s.kind)
  const actuation = useClutch((s) => s.actuation)
  const state = useLive(() => live.state, 10)
  const statePto = useLive(() => live.statePto, 10)
  const graph = useMemo(
    () =>
      makeGraph({
        gearboxLocked: () => slipG.current.locked,
        transLocked: () => false,
        ptoLocked: () => slipP.current.locked && useClutch.getState().kind === 'dual',
        iptoLocked: () => slipP.current.locked && useClutch.getState().kind === 'ipto',
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const slipG = useRef<SlipState>({ w: 0, locked: true })
  const slipP = useRef<SlipState>({ w: 0, locked: true })
  const pressure = useRef(WP.pressure)

  const engine = useRef<THREE.Group>(null)
  const gearbox = useRef<THREE.Group>(null)
  const lay = useRef<THREE.Group>(null)
  const pto = useRef<THREE.Group>(null)
  const ppRef = useRef<THREE.Group>(null)
  const pp2Ref = useRef<THREE.Group>(null)
  const springs = useRef<(THREE.Mesh | null)[]>([])
  const levers = useRef<(THREE.Group | null)[]>([])
  const rods = useRef<(THREE.Mesh | null)[]>([])
  const bearing = useRef<THREE.Group>(null)
  const forkRef = useRef<THREE.Group>(null)
  const pedalRef = useRef<THREE.Group>(null)
  const linkRod = useRef<THREE.Mesh>(null)
  const piston = useRef<THREE.Group>(null)
  const bellev = useRef<THREE.Mesh>(null)
  const pad = useRef<THREE.Mesh>(null)
  const spool = useRef<THREE.Mesh>(null)

  useSimFrame((dt) => {
    const s = useClutch.getState()
    const wE = rpmToRad(s.engineRpm)
    graph.drivers.clear()
    graph.drive('engine', wE)
    let ppDisp = 0
    let pp2Disp = 0
    let bearingGap = 0
    if (s.kind === 'single' || s.kind === 'dual') {
      const spec = s.kind === 'single' ? { ...TYPICAL_PEDAL, freePlay: s.freePlay } : { ...DUAL_PRIMARY, freePlay: s.freePlay }
      const ps = clutchPedal(s.pedal, spec)
      const full = s.kind === 'single' ? singleCapacity(s.theory) : dualCapacities(s.theory).trans
      const cap = (ps.clamp + ps.drag) * full
      const T = slipStep(slipG.current, wE, cap, s.load, J_GEARBOX, dt)
      if (!slipG.current.locked) {
        if (cap > 1e-6 || s.load > 1e-6) graph.drive('gearbox', slipG.current.w)
      }
      ppDisp = ((1 - ps.clamp) * 0.4 + ps.lift) * 1e-3 * GAP_X
      bearingGap = (Math.max(0, s.freePlay - s.pedal) / PEDAL_RATIO) * 1e-3 * GAP_X
      live.cap = cap
      live.clamp = ps.clamp
      live.lift = ps.lift
      live.drag = ps.drag
      live.bearing = ps.bearingContact
      live.torque = slipG.current.locked ? s.load : T
      live.heat = (Math.abs(T) * Math.abs(wE - slipG.current.w)) / 1000
      live.state = slipG.current.locked ? 'engaged' : cap > 1e-6 ? 'slipping' : 'released'
      if (s.kind === 'dual') {
        const ps2 = clutchPedal(s.pedal, { ...DUAL_PRIMARY, freePlay: s.freePlay + DUAL_STAGE2 })
        const cap2 = (ps2.clamp + ps2.drag) * dualCapacities(s.theory).pto
        slipStep(slipP.current, wE, cap2, s.ptoLoad, J_PTO, dt)
        if (!slipP.current.locked && (cap2 > 1e-6 || s.ptoLoad > 1e-6)) graph.drive('pto', slipP.current.w)
        pp2Disp = ((1 - ps2.clamp) * 0.4 + ps2.lift) * 1e-3 * GAP_X
        live.capPto = cap2
        live.clampPto = ps2.clamp
        live.statePto = slipP.current.locked ? 'engaged' : cap2 > 1e-6 ? 'slipping' : 'released'
      }
    } else {
      const target = s.spool ? WP.pressure : 0
      pressure.current = target + (pressure.current - target) * Math.exp(-dt / WP.tau)
      const p = pressure.current
      const cap = iptoCapacity(p, s.theory)
      const braking = !s.spool && iptoForce(p) <= 0
      slipStep(slipP.current, wE, cap, s.ptoLoad, J_PTO, dt, braking ? 600 : 0)
      if (!slipP.current.locked) graph.drive('iptoOut', slipP.current.w)
      const e = Math.min(1, (p * Math.PI * (WP.pistonOut ** 2 - WP.pistonIn ** 2)) / (WP.belleville * 1.6))
      piston.current?.position.set(0, 0, IP.cylZ0 + 0.01 + e * IP.stroke)
      bellev.current?.scale.set(1, 1, 1 - 0.55 * e)
      pad.current?.position.set(0, WP.drumOut + 0.008 + (braking ? 0 : 0.012), IP.packEnd - 0.012)
      spool.current?.position.set(s.spool ? 0.018 : -0.018, 0.2, IP.packEnd - 0.012)
      live.pressure = p / 1e5
      live.force = iptoForce(p)
      live.capPto = cap
      live.braking = braking
      live.statePto = slipP.current.locked ? 'engaged' : cap > 1e-6 ? 'slipping' : 'released'
    }
    graph.step(dt)
    if (!slipG.current.locked && !graph.drivers.has('gearbox')) slipG.current.w = graph.get('gearbox').omega
    if (s.kind === 'dual' && !slipP.current.locked && !graph.drivers.has('pto')) slipP.current.w = graph.get('pto').omega

    live.engine = s.engineRpm
    live.gearbox = radToRpm(graph.get('gearbox').omega)
    live.pto = radToRpm(graph.get(s.kind === 'ipto' ? 'iptoOut' : 'pto').omega)

    // ---- drawing ----
    const th = (id: string) => graph.get(id).theta
    engine.current?.rotation.set(0, 0, th('engine'))
    gearbox.current?.rotation.set(0, 0, th('gearbox'))
    lay.current?.rotation.set(0, 0, th('lay') + LAY_PHASE)
    pto.current?.rotation.set(0, 0, th(s.kind === 'ipto' ? 'iptoOut' : 'pto'))
    if (s.kind === 'ipto') return
    const ppZ = DISC_T + ppDisp
    ppRef.current?.position.set(0, 0, ppZ)
    pp2Ref.current?.position.set(0, 0, DC.spZ + pp2Disp)
    const springTop = s.kind === 'single' ? SP.coverZ : DC.ffZ0
    const springBase = ppZ + (s.kind === 'single' ? SP.ppT : DC.ppT)
    springs.current.forEach((m) => {
      if (!m) return
      m.position.z = springBase
      m.scale.z = springTop - springBase
    })
    const outArm = s.kind === 'single' ? SP.leverOut - SP.leverPivot : 0.022
    const inArm = s.kind === 'single' ? SP.leverPivot - SP.leverIn : 0.078
    const ang = ppDisp / outArm
    levers.current.forEach((l) => l?.rotation.set(0, -ang, 0))
    const leverInZ = (s.kind === 'single' ? SP.coverZ - 0.012 + 0.022 : DC.coverZ - 0.01 + 0.02) - ang * inArm
    const bz = leverInZ + bearingGap
    bearing.current?.position.set(0, 0, bz)
    const restZ = (s.kind === 'single' ? SP.coverZ + 0.01 : DC.coverZ + 0.01) + (s.freePlay / PEDAL_RATIO) * 1e-3 * GAP_X
    const fAng = (bz - restZ) / 0.09
    forkRef.current?.rotation.set(fAng, 0, 0)
    pedalRef.current?.rotation.set(-s.pedal / 330, 0, 0)
    // dual: links from the levers' outer ends to the primary pressure plate lugs
    rods.current.forEach((r, i) => {
      if (!r) return
      const a = (2 * PI * i) / 3
      const c = Math.cos(a)
      const sn = Math.sin(a)
      setRod(r, new THREE.Vector3(0.145 * c, 0.145 * sn, ppZ + DC.ppT + 0.02), new THREE.Vector3(0.147 * c, 0.147 * sn, DC.coverZ - 0.016 + ppDisp))
    })
    // pedal → fork lever link (mechanical) or ram
    const pivot = new THREE.Vector3(PEDAL.x, PEDAL.pivot[1], PEDAL.pivot[2])
    const pa = -s.pedal / 330
    const pedalPt = pivot.clone().add(new THREE.Vector3(0, 0.14 * Math.cos(pa), 0.14 * Math.sin(pa)))
    const leverEnd = new THREE.Vector3(FORK.outX, FORK.y - 0.16 * Math.cos(fAng), FORK.z - 0.16 * Math.sin(fAng))
    if (actuation === 'mechanical') setRod(linkRod.current, pedalPt, leverEnd)
    else setRod(linkRod.current, leverEnd.clone().add(new THREE.Vector3(0, 0, 0.13)), leverEnd)
  }, -1)

  const driven = (on: boolean, base: MaterialKey): MaterialKey => (on ? POWER : base)
  const gOn = state !== 'released'
  const pOn = statePto !== 'released'

  const springAngles = useMemo(() => Array.from({ length: SP.springs }, (_, i) => ((20 + 40 * i) * PI) / 180), [])
  const dualSpringAngles = useMemo(() => Array.from({ length: 6 }, (_, i) => ((30 + 60 * i) * PI) / 180), [])
  const leverAngles = [0, (2 * PI) / 3, (4 * PI) / 3]

  const oilIn = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.3, 0.2, IP.packEnd - 0.012),
        new THREE.Vector3(0.12, 0.2, IP.packEnd - 0.012),
        new THREE.Vector3(0.04, 0.2, IP.packEnd - 0.012),
        new THREE.Vector3(0, 0.15, -0.06),
        new THREE.Vector3(0, 0.03, -0.06),
        new THREE.Vector3(0, 0.0, -0.045),
        new THREE.Vector3(0, 0.06, -0.026),
        new THREE.Vector3(0, 0.075, -0.016),
      ]),
    [],
  )

  const oilOut = useMemo(() => new THREE.CatmullRomCurve3(oilIn.getPoints(20).reverse()), [oilIn])

  const pedalGroup = (
    <Part id="pedal" name="Clutch pedal" role="moving" material="paintBlack" info={INFO.pedal} cites={C.pedal} explode={[0.1, -0.1, 0.1]}>
      <group position={[PEDAL.x, PEDAL.pivot[1], PEDAL.pivot[2]]}>
        <PartMesh geometry={g.pedal.pivot} material="steel" />
        <group ref={pedalRef}>
          <PartMesh geometry={g.pedal.arm} />
        </group>
      </group>
    </Part>
  )

  const actuationParts = (
    <Part id="actuation" name="Clutch control" role="static" material="steel" cut={false} info={actuation === 'mechanical' ? INFO.mech : actuation === 'hydraulic' ? INFO.hyd : INFO.elec} cites={C.pedal}>
      {pedalGroup}
      <Part id="fork" name="Release fork & cross-shaft" role="moving" material="forged" info={INFO.fork} cites={C.single}>
        <group position={[0, FORK.y, FORK.z]}>
          <group ref={forkRef}>
            <PartMesh geometry={g.fork.arm} />
            <PartMesh geometry={g.fork.shaft} material="steel" />
            <PartMesh geometry={g.fork.outer} />
          </group>
        </group>
      </Part>
      <Part id="link" name={actuation === 'mechanical' ? 'Pedal rod' : actuation === 'hydraulic' ? 'Slave (ram) cylinder push-rod' : 'Actuator push-rod'} material="steel">
        <PartMesh ref={linkRod} geometry={g.pedal.rod} />
      </Part>
      {actuation === 'hydraulic' ? (
        <Part id="hyd" name="Master & slave cylinders" material="aluminium" info={INFO.hyd} cites={[SRC.tts510('p4'), SRC.pt510('p2')]}>
          <PartMesh geometry={g.pedal.master} position={[PEDAL.x, PEDAL.pivot[1] + 0.14, PEDAL.pivot[2] - 0.12]} />
          <PartMesh geometry={g.pedal.slave} position={[FORK.outX, FORK.y - 0.16, FORK.z + 0.18]} />
        </Part>
      ) : null}
      {actuation === 'electrical' ? (
        <Part id="elec" name="Electric actuator & switch" material="paintGrey" info={INFO.elec} cites={[SRC.pt510('p2')]}>
          <PartMesh geometry={g.pedal.motor} position={[FORK.outX, FORK.y - 0.16, FORK.z + 0.2]} />
          <PartMesh geometry={g.pedal.sw} position={[PEDAL.x, PEDAL.pivot[1] + 0.2, PEDAL.pivot[2] + 0.04]} material="plastic" />
        </Part>
      ) : null}
    </Part>
  )

  if (kind === 'ipto') {
    return (
      <group>
        <Part id="ipto" name="Hydraulic IPTO clutch" role="moving" material="steel" info={{ summary: 'Wet multi-plate, hydraulically operated independent PTO clutch (Massey-Ferguson, TOP Fig A2.10).', role: 'The PTO drive is independent of the main transmission clutch: it can be engaged and disengaged on the move with a separate lever (PT p2–3).' }} cites={C.ipto}>
          <Part id="ipto-housing" name="Transmission housing" role="housing" material="castIron" info={INFO.housing}>
            <PartMesh geometry={g.ipto.housing} />
          </Part>
          <Part id="ipto-in" name="Input hub & piston cylinder" role="moving" material="forged" info={INFO.iptoIn} cites={C.ipto} explode={[0, 0, -0.12]}>
            <group ref={engine}>
              <PartMesh geometry={g.ipto.input} material={POWER} />
              <PartMesh geometry={g.ipto.body} />
              <PartMesh geometry={g.ipto.hubTeeth} material="steel" />
              <Part id="piston" name="Operating piston" material="aluminium" info={INFO.piston} cites={C.ipto} explode={[0, 0, -0.05]}>
                <group ref={piston}>
                  <PartMesh geometry={g.ipto.piston} />
                </group>
              </Part>
              <Part id="belleville" name="Belleville spring" material="steelDark" info={INFO.bellev} cites={C.ipto}>
                <PartMesh ref={bellev} geometry={g.ipto.belleville} position={[0, 0, IP.bellevilleZ]} />
              </Part>
              <Part id="friction-plates" name="Friction plates (on the hub)" material="friction" info={INFO.plates} cites={C.multi} explode={[0, 0.08, 0]}>
                {Array.from({ length: WP.friction }, (_, i) => (
                  <PartMesh key={i} geometry={g.ipto.friction} position={[0, 0, IP.packStart + WP.plateT / 2 + i * (WP.plateT + WP.steelT)]} />
                ))}
              </Part>
            </group>
          </Part>
          <Part id="drum" name="Drum & PTO output shaft" role="moving" material="forged" info={INFO.drum} cites={C.ipto} explode={[0, 0, 0.14]}>
            <group ref={pto}>
              <PartMesh geometry={g.ipto.drum} material={driven(pOn, 'forged')} />
              <PartMesh geometry={g.ipto.output} material={driven(pOn, 'steel')} />
              <PartMesh geometry={g.ipto.ptoStub} material="steel" />
              <Part id="inter-plates" name="Steel inter-plates (in the drum)" material="steel" info={INFO.plates} cites={C.multi} explode={[0, 0.12, 0]}>
                {Array.from({ length: WP.friction - 1 }, (_, i) => (
                  <PartMesh key={i} geometry={g.ipto.steel} position={[0, 0, IP.packStart + WP.plateT + WP.steelT / 2 + i * (WP.plateT + WP.steelT)]} />
                ))}
              </Part>
            </group>
          </Part>
          <Part id="valve" name="Spool valve & brake pad" role="static" material="castIron" info={INFO.valve} cites={C.ipto} explode={[0, 0.12, 0]}>
            <PartMesh geometry={g.ipto.valve} position={[0, 0.2, IP.packEnd - 0.012]} />
            <PartMesh ref={spool} geometry={g.ipto.spool} material="chrome" />
            <PartMesh ref={pad} geometry={g.ipto.pad} material="friction" />
          </Part>
          <Part id="ipto-filter" name="IPTO filter" role="static" material="paintBlue" info={INFO.filter} cites={C.ipto}>
            <PartMesh geometry={g.ipto.filter} position={[0.21, 0.2, IP.packEnd - 0.012]} />
          </Part>
          <Part id="ferguson-pump" name="Ferguson pump" role="housing" material="castIron" info={INFO.pump} cites={C.ipto}>
            <PartMesh geometry={g.ipto.pump} />
          </Part>
          <Flow curve={oilIn} count={60} radius={0.0032} color="#cf5a3f" speed={0.8} spread={0.004} intensity={() => (useClutch.getState().spool ? 0.25 + 0.75 * (1 - live.pressure / (WP.pressure / 1e5)) : 0)} />
          <Flow curve={oilOut} count={40} radius={0.003} color="#e8a05a" speed={0.9} spread={0.004} intensity={() => (!useClutch.getState().spool && live.pressure > 0.3 ? live.pressure / (WP.pressure / 1e5) : 0)} />
        </Part>
        <PartLabel partId="piston" at={[0, -0.08, -0.01]} />
        <PartLabel partId="friction-plates" at={[0, 0.07, 0.03]} />
        <PartLabel partId="inter-plates" at={[0.06, 0.08, 0.035]} />
        <PartLabel partId="belleville" at={[0, -0.06, 0.02]} />
        <PartLabel partId="drum" at={[0, -0.11, 0.06]} />
        <PartLabel partId="valve" at={[0, 0.26, IP.packEnd]} />
        <PartLabel partId="ipto-filter" at={[0.21, 0.25, IP.packEnd]} />
        <PartLabel partId="ferguson-pump" at={[0, -0.13, -0.17]} />
        <PartLabel partId="ipto-in" at={[0, 0.04, -0.25]} />
      </group>
    )
  }

  const isSingle = kind === 'single'
  return (
    <group>
      <Part id="clutch" name={isSingle ? 'Single dry plate clutch' : 'Dual clutch (live PTO)'} role="moving" material="castIron" info={isSingle ? INFO.disc : INFO.primary} cites={isSingle ? C.single : C.dual}>
        <Part id="bell" name="Clutch housing" role="housing" material="castIron" info={INFO.bell} cites={C.single}>
          <PartMesh geometry={g.bell} />
          {isSingle ? <PartMesh geometry={g.quill} material="steelDark" /> : null}
          <PartMesh geometry={g.box.casing} />
        </Part>

        <Part id="engine-side" name="Driving members (turn with the engine)" role="moving" material="castIron" info={INFO.cover} cites={isSingle ? C.single : C.dual}>
          <group ref={engine}>
            <Part id="flywheel" name="Flywheel & ring gear" material="castIron" info={INFO.flywheel} cites={C.single} explode={[0, 0, -0.12]}>
              <PartMesh geometry={g.flywheel.body} material={POWER} />
              <PartMesh geometry={g.flywheel.ring} material="steelDark" />
              <PartMesh geometry={g.flywheel.crank} material="forged" />
            </Part>
            {isSingle ? (
              <>
                <Part id="pressure-plate" name="Pressure plate" material="castIron" info={INFO.pp} cites={C.single} explode={[0, 0, 0.08]}>
                  <group ref={ppRef}>
                    <PartMesh geometry={g.single.pp} />
                  </group>
                </Part>
                <Part id="springs" name="Clutch springs" material="steelDark" info={INFO.springs} cites={C.single} explode={[0, 0, 0.12]}>
                  {springAngles.map((a, i) => (
                    <PartMesh
                      key={i}
                      ref={(el) => {
                        springs.current[i] = el
                      }}
                      geometry={g.single.spring}
                      position={[SP.springR * Math.cos(a), SP.springR * Math.sin(a), 0]}
                    />
                  ))}
                </Part>
                <Part id="cover" name="Clutch cover" material="steel" info={INFO.cover} cites={C.single} explode={[0, 0, 0.18]}>
                  <PartMesh geometry={g.single.cover} />
                  <PartMesh geometry={g.single.eyes} material="steelDark" />
                </Part>
                <Part id="levers" name="Release levers" material="forged" info={INFO.levers} cites={C.single} explode={[0, 0, 0.2]}>
                  {leverAngles.map((a, i) => (
                    <group key={i} rotation={[0, 0, a]}>
                      <group
                        position={[SP.leverPivot, 0, SP.coverZ - 0.012]}
                        ref={(el) => {
                          levers.current[i] = el
                        }}
                      >
                        <PartMesh geometry={g.single.lever} />
                      </group>
                    </group>
                  ))}
                </Part>
              </>
            ) : (
              <>
                <Part id="pp1" name="Primary pressure plate" material="castIron" info={INFO.pp1} cites={C.dual} explode={[0, 0, 0.06]}>
                  <group ref={ppRef}>
                    <PartMesh geometry={g.dual.pp1} />
                  </group>
                </Part>
                <Part id="dual-springs" name="Coil springs (primary)" material="steelDark" info={INFO.springs} cites={C.dual}>
                  {dualSpringAngles.map((a, i) => (
                    <PartMesh
                      key={i}
                      ref={(el) => {
                        springs.current[i] = el
                      }}
                      geometry={g.dual.spring}
                      position={[0.112 * Math.cos(a), 0.112 * Math.sin(a), 0]}
                    />
                  ))}
                </Part>
                <Part id="false-flywheel" name="False flywheel" material="castIron" info={INFO.falseFly} cites={C.dual} explode={[0, 0, 0.1]}>
                  <PartMesh geometry={g.dual.falseFly} />
                </Part>
                <Part id="pp2" name="Secondary pressure plate & Belleville spring" material="castIron" info={INFO.pp2} cites={C.dual} explode={[0, 0, 0.16]}>
                  <group ref={pp2Ref}>
                    <PartMesh geometry={g.dual.pp2} />
                  </group>
                  <PartMesh geometry={g.dual.belleville} material="steelDark" />
                </Part>
                <Part id="dual-cover" name="Clutch cover" material="steel" info={INFO.cover} cites={C.dual} explode={[0, 0, 0.22]}>
                  <PartMesh geometry={g.dual.cover} />
                </Part>
                <Part id="dual-levers" name="Release levers, links & PTO set screws" material="forged" info={INFO.setScrews} cites={C.dual} explode={[0, 0, 0.24]}>
                  {leverAngles.map((a, i) => (
                    <group key={i} rotation={[0, 0, a]}>
                      <group
                        position={[0.128, 0, DC.coverZ - 0.01]}
                        ref={(el) => {
                          levers.current[i] = el
                        }}
                      >
                        <PartMesh geometry={g.dual.lever} />
                        <PartMesh geometry={g.dual.setScrew} position={[0.012, 0, -0.012]} material="steel" />
                      </group>
                    </group>
                  ))}
                  {leverAngles.map((_, i) => (
                    <PartMesh
                      key={`r${i}`}
                      ref={(el) => {
                        rods.current[i] = el
                      }}
                      geometry={g.pedal.rod}
                      material="steel"
                    />
                  ))}
                </Part>
              </>
            )}
          </group>
        </Part>

        <Part id="driven" name={isSingle ? 'Driven members (clutch plate & gearbox shaft)' : 'Transmission drive plate & shaft'} role="moving" material="steel" info={INFO.shaft} cites={C.gearbox}>
          <group ref={gearbox}>
            <Part id="disc" name={isSingle ? 'Clutch plate' : 'Transmission drive plate (primary)'} material="steel" info={isSingle ? INFO.disc : INFO.primary} cites={isSingle ? [...C.single, SRC.m503(8, 'T = n f F R_f')] : C.dual} explode={[0, 0, 0.04]}>
              <PartMesh geometry={(isSingle ? g.single.disc : g.dual.primary).hub} material={driven(gOn, 'steel')} />
              <PartMesh geometry={(isSingle ? g.single.disc : g.dual.primary).core} material="steelDark" />
              <PartMesh geometry={(isSingle ? g.single.disc : g.dual.primary).linings} material="friction" />
            </Part>
            <Part id="input-shaft" name={isSingle ? 'Gearbox input shaft' : 'Transmission drive shaft (inner)'} material="steel" info={INFO.shaft} cites={C.gearbox}>
              <PartMesh geometry={g.inputShaft} material={driven(gOn, 'steel')} />
              <PartMesh geometry={g.box.inputGear} position={[0, 0, BOX.z]} material={driven(gOn, 'steelDark')} />
            </Part>
          </group>
          <Part id="layshaft" name="Layshaft gear" material="steelDark" info={INFO.gearbox} cites={C.gearbox}>
            <group position={[0, BOX.lay, BOX.z]}>
              <group ref={lay}>
                <PartMesh geometry={g.box.layGear} material={driven(gOn, 'steelDark')} />
                <PartMesh geometry={g.box.layShaft} material="steel" />
              </group>
            </group>
          </Part>
        </Part>

        {!isSingle ? (
          <Part id="pto-side" name="PTO drive plate & hollow PTO shaft" role="moving" material="steel" info={INFO.ptoShaft} cites={C.dual}>
            <group ref={pto}>
              <Part id="pto-plate" name="PTO drive plate (secondary)" material="steel" info={INFO.secondary} cites={C.dual} explode={[0, 0, 0.13]}>
                <group position={[0, 0, DC.sDiscZ]}>
                  <PartMesh geometry={g.dual.secondary.hub} material={driven(pOn, 'steel')} />
                  <PartMesh geometry={g.dual.secondary.core} material="steelDark" />
                  <PartMesh geometry={g.dual.secondary.linings} material="friction" />
                </group>
              </Part>
              <Part id="pto-shaft" name="Hollow PTO drive shaft" material="steel" info={INFO.ptoShaft} cites={C.dual}>
                <PartMesh geometry={g.dual.ptoShaft} material={driven(pOn, 'steel')} />
                <PartMesh geometry={g.dual.ptoGear} position={[0, 0, 0.27]} material={driven(pOn, 'steelDark')} />
              </Part>
            </group>
          </Part>
        ) : null}

        <Part id="release-bearing" name="Thrust (release) bearing" role="moving" material="bearing" info={INFO.bearing} cites={C.pedal} explode={[0, 0, 0.12]}>
          <group ref={bearing}>
            <PartMesh geometry={g.bearing.races} />
            <PartMesh geometry={g.bearing.carrier} material="steelDark" />
          </group>
        </Part>
        {actuationParts}
      </Part>

      <PartLabel partId="flywheel" at={[0, SP.flyR + 0.03, -0.03]} />
      <PartLabel partId="disc" at={[0, SP.Ro - 0.01, 0.006]} />
      <PartLabel partId={isSingle ? 'pressure-plate' : 'pp1'} at={[0, 0.13, 0.03]} />
      <PartLabel partId={isSingle ? 'springs' : 'false-flywheel'} at={[0, -0.12, 0.06]} />
      <PartLabel partId={isSingle ? 'levers' : 'dual-levers'} at={[0.07, 0.07, 0.1]} />
      <PartLabel partId="release-bearing" at={[0, 0.05, 0.13]} />
      <PartLabel partId="input-shaft" at={[0, 0.03, 0.42]} />
      <PartLabel partId="pedal" at={[PEDAL.x, -0.05, 0.38]} />
      <PartLabel partId="bell" at={[0.2, 0.17, 0.08]} />
      {isSingle ? <PartLabel partId="cover" at={[0, 0.17, 0.08]} /> : <PartLabel partId="pto-shaft" at={[0, -0.05, 0.27]} />}
      {!isSingle ? <PartLabel partId="pto-plate" at={[0, -0.13, 0.1]} /> : null}
    </group>
  )
}
