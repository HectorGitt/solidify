import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { valveLifts } from '@/physics/engine'
import { exhaustGasTemperature } from '@/physics/thermo'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { EXHAUST_PATH, EXHAUST_PORT, INJECTOR, INLET_PORT, INTAKE_PATH, SPRING_SEAT, buildEngineGeometry } from './geometry'
import {
  CAM_X,
  CAM_Y,
  CROWN_TDC,
  DIM,
  PUSHROD_X,
  VALVE_TIMING,
  computeCycle,
  cycleState,
  deckGap,
  gasColor,
  isInjecting,
  kinematics,
  live,
  tappetLifts,
  useEngine,
  VS,
} from './model'

const { PI } = Math

/**
 * Static phase of the cam gear so its tooth spaces meet the crank gear's teeth on the line of
 * centres (crank turns +θ, cam −θ/2): φ0 = 1.5γ + π − π/z_cam, γ = direction crank → cam.
 */
export const CAM_GEAR_PHASE = 1.5 * Math.atan2(CAM_Y, CAM_X) + PI - PI / DIM.camTeeth

/** Info for every part (content lives with the scene; citations point back to the notes). */
export const INFO = {
  engine: {
    summary: 'Single-cylinder, four-stroke, direct-injection tractor diesel, 100 mm bore × 124 mm stroke.',
    details: 'Cutaway convention: stationary castings are sectioned and hatched by material; moving parts are left whole so you can watch them work.',
  },
  block: {
    summary: 'The main casting of the engine — the foundation that every other part is fixed to.',
    role: 'Guides the piston (via the liner), carries the crankshaft in its main bearings, and surrounds the cylinder with a water jacket for cooling.',
    details: 'Cast iron. Air-cooled engines have fins instead of a jacket.',
  },
  liner: {
    summary: 'Hard-wearing replaceable sleeve that forms the cylinder bore.',
    role: 'The piston and rings slide on it; when worn it is replaced instead of reboring the block.',
  },
  coolant: {
    summary: 'Coolant in the water jacket around the liner.',
    role: 'Carries heat away from the cylinder walls to the radiator. Roughly 30–40 % of the fuel energy leaves through the cooling system.',
  },
  head: {
    summary: 'Removable casting that closes the top of the cylinder.',
    role: 'Holds the inlet and exhaust ports and valves and the injector (a spark plug in a petrol engine), and forms the roof of the combustion space.',
  },
  gasket: {
    summary: 'Head gasket — seals the joint between block and head.',
    role: 'Here its thickness is drawn to give the deck clearance that the selected compression ratio needs: CR = (Vs + Vc)/Vc. Raise CR and the clearance shrinks.',
  },
  inletValve: {
    summary: 'Inlet (intake) poppet valve.',
    role: 'Opens to let fresh air into the cylinder. It opens before TDC and closes after BDC so the momentum of the incoming air keeps filling the cylinder early in compression.',
  },
  exhaustValve: {
    summary: 'Exhaust poppet valve.',
    role: 'Opens well before BDC so the burnt gas starts to escape (blow-down) and closes after TDC, giving valve overlap with the inlet valve for better scavenging.',
  },
  springs: { summary: 'Valve springs.', role: 'Close the valves and keep the valve train in contact with the cam.' },
  rockers: {
    summary: 'Rocker arms on the rocker shaft.',
    role: 'Levers that reverse the push-rod motion and push the valve open. Here the rocker ratio is 1.5 : 1, so 6.7 mm of cam lift gives 10 mm of valve lift.',
  },
  pushrods: { summary: 'Push rods.', role: 'Transmit the cam follower’s lift up to the rocker arms.' },
  tappets: { summary: 'Cam followers (tappets).', role: 'Ride on the cam lobes and convert the lobe profile into straight-line lift.' },
  camshaft: {
    summary: 'Camshaft with one lobe per valve.',
    role: 'Turns at half crankshaft speed — once per four-stroke cycle — so each valve opens once every two crank revolutions. The lobe shapes here are generated directly from the valve-timing curve.',
  },
  timingGears: {
    summary: 'Timing gears: 22-tooth crank gear driving a 44-tooth cam gear.',
    role: 'The 2 : 1 ratio keeps the camshaft at half engine speed and in time with the crankshaft.',
  },
  crankshaft: {
    summary: 'Crankshaft with main journals, webs, crank pin and counterweights.',
    role: 'Converts the reciprocating (to-and-fro) motion of the piston into rotation. The counterweights balance the rotating mass of the throw.',
  },
  flywheel: {
    summary: 'Flywheel with starter ring gear.',
    role: 'Stores energy on the power stroke and carries the engine through the three idle strokes (intake, compression, exhaust). The 108-tooth ring gear meshes with the starter pinion.',
  },
  conrod: {
    summary: 'Connecting rod with bolted big-end cap and bearing shells.',
    role: 'Links the piston (small end, on the gudgeon pin) to the crank pin (big end), turning the piston force into crank torque.',
  },
  piston: {
    summary: 'Piston with the combustion bowl in its crown.',
    role: 'A loose sliding fit in the cylinder; transmits the gas force to the connecting rod through the gudgeon pin. In a direct-injection diesel most of the clearance volume is in the bowl.',
  },
  rings: {
    summary: 'Piston rings: two compression rings and an oil-control ring.',
    role: 'Split rings sprung against the bore. Compression rings seal the gas; the oil ring scrapes surplus oil back to the sump. A two-stroke engine usually has only compression rings.',
  },
  pin: { summary: 'Gudgeon (piston) pin.', role: 'Hollow hardened pin joining piston and connecting-rod small end; lets the rod swing.' },
  injector: {
    summary: 'Fuel injector (multi-hole nozzle).',
    role: 'Sprays diesel fuel at high pressure into the hot compressed air near TDC. The needle valve lifts off its seat when fuel pressure overcomes the spring setting; here needle lift is exaggerated so you can see it.',
  },
  intake: { summary: 'Inlet manifold and air cleaner.', role: 'Clean air is drawn through the air cleaner into the inlet port.' },
  exhaust: { summary: 'Exhaust manifold.', role: 'Carries the burnt gas away from the exhaust port.' },
  sump: { summary: 'Sump (oil pan).', role: 'Reservoir for the engine oil used by the lubrication system.' },
  oil: { summary: 'Engine oil.', role: 'Picked up by the oil pump and pressure-fed to the bearings (see the Lubrication scene).' },
  gas: {
    summary: 'Working gas in the cylinder.',
    role: 'Its colour shows temperature from the air-standard cycle model (blue ≈ 300 K, orange ≈ 2000 K, white ≈ 2600 K).',
  },
  cover: { summary: 'Rocker cover.', role: 'Keeps oil in and dirt out of the valve gear.' },
} as const

const C = {
  parts: [SRC.l4_509('Parts description'), SRC.tb509('Table 2.1, Fig 2.1'), SRC.man509('Module 2')],
  valves: [SRC.l4_509('valve timing'), SRC.tb509('Fig 2.2 valve system, Fig 2.3 four-stroke cycle')],
  cycle: [SRC.l3_509('four-stroke cycle'), SRC.tb509('Fig 2.3')],
  fuel: [SRC.supp509('fuel system, injector'), SRC.tb509('Fig 4.9 injector')],
  cooling: [SRC.supp509('cooling'), SRC.tb509('Ch 7')],
  lube: [SRC.supp509('lubrication'), SRC.tb509('Ch 6')],
  timing: [SRC.man509('timing gears — speed ratio')],
}

export function Engine3D() {
  const g = buildEngineGeometry()
  const r = useEngine((s) => s.r)
  const flows = useEngine((s) => s.flows)
  const gap = deckGap(r)
  const headY = CROWN_TDC + gap

  const theta = useRef(0)
  const crank = useRef<THREE.Group>(null)
  const rod = useRef<THREE.Group>(null)
  const piston = useRef<THREE.Group>(null)
  const camRef = useRef<THREE.Group>(null)
  const tappetIn = useRef<THREE.Group>(null)
  const tappetEx = useRef<THREE.Group>(null)
  const pushIn = useRef<THREE.Mesh>(null)
  const pushEx = useRef<THREE.Mesh>(null)
  const rockerIn = useRef<THREE.Group>(null)
  const rockerEx = useRef<THREE.Group>(null)
  const valveIn = useRef<THREE.Group>(null)
  const valveEx = useRef<THREE.Group>(null)
  const springIn = useRef<THREE.Mesh>(null)
  const springEx = useRef<THREE.Mesh>(null)
  const retIn = useRef<THREE.Mesh>(null)
  const retEx = useRef<THREE.Mesh>(null)
  const column = useRef<THREE.Mesh>(null)
  const needle = useRef<THREE.Group>(null)

  const gas = useMemo(() => createDynamicCutMaterial({ color: '#3a70a8', hatch: 'fluid', roughness: 0.6, emissive: '#000000' }), [])
  const gasRGB = useMemo(() => ({ r: 0, g: 0, b: 0 }), [])

  const injectorTop = useMemo(() => INJECTOR.tip.clone().add(INJECTOR.dir.clone().multiplyScalar(0.14)), [])
  const injectorQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), INJECTOR.dir), [])
  const intakeGeo = useMemo(() => g.intakePipe(headY), [g, headY])
  const exhaustGeo = useMemo(() => g.exhaustPipe(headY), [g, headY])
  const hpGeo = useMemo(() => g.hpPipe(injectorTop.clone().add(new THREE.Vector3(0, headY, 0))), [g, injectorTop, headY])

  // flow paths in world space
  const airPath = useMemo(() => {
    const pts: THREE.Vector3[] = []
    pts.push(new THREE.Vector3(0.17, headY + 0.165, DIM.inletZ + 0.01))
    INTAKE_PATH(headY)
      .getPoints(8)
      .reverse()
      .forEach((p) => pts.push(p))
    INLET_PORT.getPoints(10)
      .reverse()
      .forEach((p) => pts.push(p.clone().add(new THREE.Vector3(0, headY, 0))))
    pts.push(new THREE.Vector3(DIM.valveX + 0.01, headY - 0.03, DIM.inletZ - 0.01))
    pts.push(new THREE.Vector3(0.015, headY - 0.06, 0))
    return new THREE.CatmullRomCurve3(dedupe(pts))
  }, [headY])
  const exhaustFlowPath = useMemo(() => {
    const pts: THREE.Vector3[] = [new THREE.Vector3(0.01, headY - 0.02, -0.01), new THREE.Vector3(DIM.valveX, headY - 0.006, DIM.exhaustZ)]
    EXHAUST_PORT.getPoints(10).forEach((p) => pts.push(p.clone().add(new THREE.Vector3(0, headY, 0))))
    EXHAUST_PATH(headY)
      .getPoints(8)
      .forEach((p) => pts.push(p))
    return new THREE.CatmullRomCurve3(dedupe(pts))
  }, [headY])
  const sprays = useMemo(() => {
    const tip = INJECTOR.tip
    return [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * PI * 2 + 0.3
      return new THREE.LineCurve3(tip.clone(), tip.clone().add(new THREE.Vector3(Math.cos(a) * 0.026 - 0.004, -0.013, Math.sin(a) * 0.026)))
    })
  }, [])

  useSimFrame((dt) => {
    const st = useEngine.getState()
    theta.current += ((st.rpm * 2 * PI) / 60) * dt
    const th = theta.current
    const { deg, crankAngle, pin, x } = kinematics(th)
    const R = DIM.crankR

    crank.current?.rotation.set(0, 0, crankAngle)
    if (rod.current) {
      rod.current.position.set(-R * Math.sin(crankAngle), R * Math.cos(crankAngle), 0)
      rod.current.rotation.set(0, 0, -Math.asin((R * Math.sin(crankAngle)) / DIM.rodL))
    }
    piston.current?.position.set(0, pin, 0)

    const crownY = pin + DIM.pistonComp
    if (column.current) {
      column.current.position.y = crownY
      column.current.scale.y = Math.max(1e-4, headY - crownY)
    }

    camRef.current?.rotation.set(0, 0, -th / 2)
    const tl = tappetLifts(deg)
    const vl = valveLifts(deg, VALVE_TIMING)
    const tappetBase = CAM_Y + DIM.camBase
    tappetIn.current?.position.set(PUSHROD_X, tappetBase + tl.inlet, DIM.inletZ)
    tappetEx.current?.position.set(PUSHROD_X, tappetBase + tl.exhaust, DIM.exhaustZ)

    const rock = (lift: number) => Math.asin(Math.min(1, lift / DIM.rockerArmPush))
    rockerIn.current?.rotation.set(0, 0, -rock(tl.inlet))
    rockerEx.current?.rotation.set(0, 0, -rock(tl.exhaust))

    const setPush = (m: THREE.Mesh | null, lift: number) => {
      if (!m) return
      const y0 = tappetBase + lift + DIM.tappetH - 0.004
      const y1 = headY + DIM.rockerY - 0.002 + DIM.rockerArmPush * Math.sin(rock(lift))
      m.position.y = y0
      m.scale.y = y1 - y0
    }
    setPush(pushIn.current, tl.inlet)
    setPush(pushEx.current, tl.exhaust)

    const valveY = headY + 0.0004
    valveIn.current?.position.set(DIM.valveX, valveY - vl.inlet, DIM.inletZ)
    valveEx.current?.position.set(DIM.valveX, valveY - vl.exhaust, DIM.exhaustZ)
    const retBottom = (lift: number) => headY + DIM.valveTip - 0.012 + 0.0004 - lift
    const setSpring = (sp: THREE.Mesh | null, rt: THREE.Mesh | null, lift: number) => {
      const b = retBottom(lift)
      if (sp) {
        sp.position.y = headY + SPRING_SEAT
        sp.scale.y = b - (headY + SPRING_SEAT)
      }
      if (rt) rt.position.y = b
    }
    setSpring(springIn.current, retIn.current, vl.inlet)
    setSpring(springEx.current, retEx.current, vl.exhaust)

    const injecting = isInjecting(st.cycle, deg)
    needle.current?.position.set(0, injecting ? 0.0016 : 0, 0)

    // thermodynamic state → gas colour, live panel values
    const c = computeCycle(st)
    const s = cycleState(c, deg, st.r)
    gasColor(s.stroke === 'exhaust' ? exhaustGasTemperature(c) : s.T, gasRGB)
    gas.material.color.setRGB(gasRGB.r, gasRGB.g, gasRGB.b)
    gas.capColor.setRGB(gasRGB.r, gasRGB.g, gasRGB.b)
    const glow = Math.max(0, (s.T - 1100) / 1500)
    gas.material.emissive.setRGB(gasRGB.r * glow, gasRGB.g * glow * 0.8, gasRGB.b * glow * 0.5)
    gas.material.clipIntersection = useView.getState().cut.intersection

    const V1 = VS + VS / (st.r - 1)
    live.theta = deg
    live.stroke = s.stroke
    live.P = s.P
    live.T = s.T
    live.s = s.s
    live.Vcm3 = (s.v / c.s1.v) * V1 * 1e6
    live.inletLift = vl.inlet
    live.exhaustLift = vl.exhaust
    live.x = x
    live.injecting = injecting
  })

  const maxLift = VALVE_TIMING.maxLift

  return (
    <group>
      <Part id="engine" name="Diesel engine" role="housing" material="castIron" info={INFO.engine} cites={C.parts}>
        {/* ---------------- stationary structure ---------------- */}
        <Part id="block" name="Cylinder block" material="castIron" role="housing" info={INFO.block} cites={C.parts} explode={[0, 0, 0]}>
          <PartMesh geometry={g.block} />
          <Part id="liner" name="Cylinder liner" material="steelDark" role="static" info={INFO.liner} cites={[SRC.man509('liner (sleeve)')]}>
            <PartMesh geometry={g.liner} />
          </Part>
          <Part id="coolant" name="Coolant (water jacket)" material="coolant" role="fluid" info={INFO.coolant} cites={C.cooling}>
            <PartMesh geometry={g.coolant} />
          </Part>
        </Part>

        <Part id="sump" name="Sump" material="paintGrey" role="housing" info={INFO.sump} cites={C.lube} explode={[0, -0.18, 0]}>
          <PartMesh geometry={g.sump} />
          <Part id="oil" name="Engine oil" material="oil" role="fluid" info={INFO.oil} cites={C.lube}>
            <PartMesh geometry={g.oil} />
          </Part>
        </Part>

        {/* ---------------- head assembly (moves with compression ratio) ---------------- */}
        <Part id="head-assembly" name="Cylinder head assembly" role="housing" explode={[0, 0.22, 0]}>
          <Part id="gasket" name="Head gasket (deck clearance)" material="gasket" role="static" info={INFO.gasket} cites={[SRC.tb509('p9 — PD, TCV, CR')]}>
            <PartMesh geometry={g.gasket} position={[0, CROWN_TDC, 0]} scale={[1, gap, 1]} />
          </Part>
          <group position={[0, headY, 0]}>
            <Part id="head" name="Cylinder head" material="castIron" role="housing" info={INFO.head} cites={C.parts}>
              <PartMesh geometry={g.head} />
            </Part>
            <Part id="cover" name="Rocker cover" material="paintGreen" role="housing" info={INFO.cover} explode={[0, 0.16, 0]}>
              <PartMesh geometry={g.rockerCover} />
            </Part>
            <Part id="injector" name="Fuel injector" material="steel" role="static" info={INFO.injector} cites={C.fuel} explode={[0.06, 0.12, 0]}>
              <group position={INJECTOR.tip} quaternion={injectorQuat}>
                <PartMesh geometry={g.injector.body} />
                <Part id="needle" name="Injector needle valve" material="chrome" role="moving" info={{ summary: 'Needle valve.', role: 'Lifts off its conical seat when fuel pressure exceeds the spring load, letting fuel spray from the nozzle holes.' }} cites={C.fuel}>
                  <group ref={needle}>
                    <PartMesh geometry={g.injector.needle} />
                  </group>
                </Part>
                <Part id="injector-spring" name="Injector spring" material="steelDark" role="moving" cut={false}>
                  <PartMesh geometry={g.injector.spring} position={[0, 0.071, 0]} scale={[1, 0.045, 1]} />
                </Part>
              </group>
            </Part>
            <Part id="rocker-gear" name="Rocker shaft & pedestals" material="steel" role="static">
              <PartMesh geometry={g.rockerShaft} position={[DIM.rockerX, DIM.rockerY, 0]} />
              <PartMesh geometry={g.pedestal} position={[DIM.rockerX, (DIM.headHeight + DIM.rockerY) / 2 - 0.004, 0.05]} />
              <PartMesh geometry={g.pedestal} position={[DIM.rockerX, (DIM.headHeight + DIM.rockerY) / 2 - 0.004, -0.05]} />
            </Part>
            <Part id="rockers" name="Rocker arms" material="forged" role="moving" info={INFO.rockers} cites={C.valves} explode={[0, 0.05, 0]}>
              <group ref={rockerIn} position={[DIM.rockerX, DIM.rockerY, DIM.inletZ]}>
                <PartMesh geometry={g.rocker} />
              </group>
              <group ref={rockerEx} position={[DIM.rockerX, DIM.rockerY, DIM.exhaustZ]}>
                <PartMesh geometry={g.rocker} />
              </group>
            </Part>
            {flows ? (
              <>
                {sprays.map((c, i) => (
                  <Flow key={i} curve={c} count={14} radius={0.0011} color="#e8d06a" speed={6} spread={0.002} intensity={() => (live.injecting ? 1 : 0)} />
                ))}
              </>
            ) : null}
          </group>
          {/* valves move in world space so they can go below the deck */}
          <Part id="valves" name="Valves" material="steel" role="moving" info={{ summary: 'Inlet and exhaust poppet valves.' }} cites={C.valves}>
            <Part id="inlet-valve" name="Inlet valve" info={INFO.inletValve} cites={C.valves}>
              <group ref={valveIn}>
                <PartMesh geometry={g.inletValve} />
              </group>
            </Part>
            <Part id="exhaust-valve" name="Exhaust valve" info={INFO.exhaustValve} cites={C.valves}>
              <group ref={valveEx}>
                <PartMesh geometry={g.exhaustValve} />
              </group>
            </Part>
          </Part>
          <Part id="springs" name="Valve springs" material="steelDark" role="moving" info={INFO.springs} cites={C.valves} cut={false}>
            <PartMesh ref={springIn} geometry={g.spring} position={[DIM.valveX, 0, DIM.inletZ]} />
            <PartMesh ref={springEx} geometry={g.spring} position={[DIM.valveX, 0, DIM.exhaustZ]} />
            <PartMesh ref={retIn} geometry={g.retainer} position={[DIM.valveX, 0, DIM.inletZ]} />
            <PartMesh ref={retEx} geometry={g.retainer} position={[DIM.valveX, 0, DIM.exhaustZ]} />
          </Part>
          <Part id="pushrods" name="Push rods" material="steel" role="moving" info={INFO.pushrods} cites={C.valves}>
            <PartMesh ref={pushIn} geometry={g.pushrod} position={[PUSHROD_X, 0, DIM.inletZ]} />
            <PartMesh ref={pushEx} geometry={g.pushrod} position={[PUSHROD_X, 0, DIM.exhaustZ]} />
          </Part>
        </Part>

        <Part id="intake" name="Inlet manifold & air cleaner" material="aluminium" role="housing" cut={false} info={INFO.intake} cites={[SRC.tb509('§4.3 air cleaners')]} explode={[0.12, 0.08, 0.04]}>
          <PartMesh geometry={intakeGeo} />
          <PartMesh geometry={g.airCleaner} material="paintBlack" position={[0.17, headY + 0.165, DIM.inletZ + 0.01]} />
        </Part>
        <Part id="exhaust" name="Exhaust manifold" material="castIron" role="housing" info={INFO.exhaust} explode={[0.12, -0.02, -0.04]}>
          <PartMesh geometry={exhaustGeo} />
        </Part>
        <Part id="hp-pipe" name="High-pressure fuel pipe" material="steel" role="static" info={{ summary: 'High-pressure pipe from the injection pump.', role: 'Delivers each metered charge of fuel to the injector in firing order.' }} cites={C.fuel} explode={[0.08, 0.14, 0]}>
          <PartMesh geometry={hpGeo} />
        </Part>

        {/* ---------------- moving parts ---------------- */}
        <Part id="camshaft" name="Camshaft & cam gear" material="forged" role="moving" info={INFO.camshaft} cites={[...C.valves, ...C.timing]} explode={[-0.1, -0.02, 0]}>
          <group ref={camRef} position={[CAM_X, CAM_Y, 0]}>
            <PartMesh geometry={g.camshaft} />
            <PartMesh geometry={g.camLobes} material="steel" />
            <PartMesh geometry={g.camJournals} material="steel" />
            <PartMesh geometry={g.timing.cam} material="steelDark" position={[0, 0, DIM.frontGearZ]} rotation={[0, 0, CAM_GEAR_PHASE]} />
          </group>
        </Part>
        <Part id="tappets" name="Cam followers (tappets)" material="steel" role="moving" info={INFO.tappets} cites={C.valves} explode={[-0.05, 0, 0]}>
          <group ref={tappetIn}>
            <PartMesh geometry={g.tappet} />
          </group>
          <group ref={tappetEx}>
            <PartMesh geometry={g.tappet} />
          </group>
        </Part>

        <Part id="crank-assembly" name="Crankshaft & flywheel" role="moving" material="forged" info={INFO.crankshaft} cites={C.parts}>
          <group ref={crank}>
            <Part id="crankshaft" name="Crankshaft" material="forged" info={INFO.crankshaft} cites={C.parts} explode={[0, -0.12, 0]}>
              <PartMesh geometry={g.crankshaft} />
            </Part>
            <Part id="timing-gear" name="Crank timing gear" material="steelDark" info={INFO.timingGears} cites={C.timing} explode={[0, -0.12, 0.08]}>
              <PartMesh geometry={g.timing.crank} position={[0, 0, DIM.frontGearZ]} />
            </Part>
            <Part id="pulley" name="Crankshaft pulley" material="castIron" info={{ summary: 'Crankshaft pulley.', role: 'Drives the fan, water pump and alternator by V-belt.' }} explode={[0, -0.12, 0.14]}>
              <PartMesh geometry={g.pulley} position={[0, 0, 0.112]} />
            </Part>
            <Part id="flywheel" name="Flywheel & ring gear" material="castIron" info={INFO.flywheel} cites={[SRC.tb509('flywheel'), SRC.man509('ring gear teeth')]} explode={[0, -0.12, -0.12]}>
              <PartMesh geometry={g.flywheel} position={[0, 0, -0.107]} />
              <PartMesh geometry={g.ringGear} material="steelDark" position={[0, 0, -0.115]} />
            </Part>
          </group>
        </Part>

        <Part id="conrod" name="Connecting rod" material="forged" role="moving" info={INFO.conrod} cites={C.parts} explode={[0, -0.05, 0.16]}>
          <group ref={rod}>
            <PartMesh geometry={g.rod.body} />
            <Part id="rod-cap" name="Big-end cap & bolts" material="forged" info={{ summary: 'Big-end cap, bolted to the rod.', role: 'Makes the big end separable so the rod can be fitted round the crank pin.' }} explode={[0, -0.05, 0]}>
              <PartMesh geometry={g.rod.cap} />
              <PartMesh geometry={g.rod.bolts} material="steelDark" />
            </Part>
            <Part id="big-end-shells" name="Big-end bearing shells" material="bearing" info={{ summary: 'Plain (journal) bearing shells.', role: 'Thin steel shells lined with bearing metal; an oil film separates them from the crank pin.' }} cites={[SRC.m503(7, 'journal bearings')]}>
              <PartMesh geometry={g.rod.shells} />
            </Part>
            <PartMesh geometry={g.rod.bush} material="bronze" />
          </group>
        </Part>

        <Part id="piston-assembly" name="Piston assembly" role="moving" material="aluminium" info={INFO.piston} cites={C.parts} explode={[0, 0.1, 0.16]}>
          <group ref={piston}>
            <Part id="piston" name="Piston" material="aluminium" info={INFO.piston} cites={C.parts}>
              <PartMesh geometry={g.piston} />
            </Part>
            <Part id="rings" name="Piston rings" material="steelDark" info={INFO.rings} cites={C.parts} explode={[0, 0.03, 0]}>
              <PartMesh geometry={g.rings.compression} />
              <PartMesh geometry={g.rings.oil} material="castIron" />
            </Part>
            <Part id="gudgeon-pin" name="Gudgeon pin" material="steel" info={INFO.pin} cites={C.parts} explode={[0, 0, 0.09]}>
              <PartMesh geometry={g.pin} />
            </Part>
            <Part id="gas-bowl" name="Gas in the bowl" role="fluid" info={INFO.gas} cites={C.cycle}>
              <PartMesh geometry={g.gas.bowl} customMaterial={gas.material} position={[0, DIM.pistonComp, 0]} castShadow={false} />
            </Part>
          </group>
        </Part>

        <Part id="gas" name="Cylinder gas" role="fluid" info={INFO.gas} cites={C.cycle}>
          <PartMesh ref={column} geometry={g.gas.column} customMaterial={gas.material} castShadow={false} />
        </Part>

        {flows ? (
          <>
            <Flow curve={airPath} count={70} radius={0.0024} color="#6fb8ec" speed={0.9} spread={0.012} intensity={() => live.inletLift / maxLift} />
            <Flow curve={exhaustFlowPath} count={70} radius={0.0026} color="#e8794f" speed={0.9} spread={0.012} intensity={() => live.exhaustLift / maxLift} />
          </>
        ) : null}
      </Part>

      <PartLabel partId="head" at={[0.08, headY + 0.09, 0.07]} />
      <PartLabel partId="block" at={[0.082, 0.22, 0.07]} />
      <PartLabel partId="piston" at={[0.05, 0.26, 0.02]} />
      <PartLabel partId="conrod" at={[0.04, 0.12, 0.02]} />
      <PartLabel partId="crankshaft" at={[0.09, -0.02, 0.06]} />
      <PartLabel partId="camshaft" at={[CAM_X - 0.03, CAM_Y, 0.08]} />
      <PartLabel partId="pushrods" at={[PUSHROD_X - 0.012, 0.25, 0.03]} />
      <PartLabel partId="rockers" at={[DIM.rockerX, headY + DIM.rockerY + 0.015, 0.03]} />
      <PartLabel partId="injector" at={[0.06, headY + 0.13, 0.01]} />
      <PartLabel partId="flywheel" at={[0.15, 0.08, -0.13]} />
      <PartLabel partId="intake" at={[0.2, headY + 0.25, 0.04]} />
      <PartLabel partId="exhaust" at={[0.21, headY - 0.07, -0.08]} />
      <PartLabel partId="sump" at={[0.13, -0.12, 0.08]} />
    </group>
  )
}

function dedupe(pts: THREE.Vector3[]) {
  const out: THREE.Vector3[] = []
  for (const p of pts) if (!out.length || out[out.length - 1].distanceTo(p) > 1e-4) out.push(p)
  return out
}

/** Exposed for tests/tours: volume of the cylinder at a crank angle. */
export const sweptVolumeCm3 = VS * 1e6
