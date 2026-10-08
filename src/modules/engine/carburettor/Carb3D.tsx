import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { pipe } from '@/geometry'
import { floatStep } from '@/physics/engineSystems'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { MANIFOLD, buildCarbGeometry } from './geometry'
import { AIR_C, AIR_MAX, FLOAT, FLOAT_ARM, FUEL_C, L, live, needleOpening, operatingPoint, useCarb } from './model'

const { PI } = Math
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)
const curve = (pts: THREE.Vector3[], t = 0.2) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', t)

const C = {
  sys: [SRC.tb509('§4.4, Fig 4.1 petrol fuel system'), SRC.supp509('SI fuel system')],
  bowl: [SRC.tb509('Fig 4.5 sediment bowl')],
  pump: [SRC.tb509('Fig 4.6 diaphragm fuel pump'), SRC.supp509('lift pump worked by a camshaft eccentric and rocker arm')],
  carb: [SRC.tb509('§4.4.3, Fig 4.7 carburettor'), SRC.supp509('carburettor: float chamber, jet, venturi, choke, throttle')],
}

const INFO = {
  sys: { summary: 'Fuel system of a spark-ignition (petrol / TVO) tractor engine.', details: 'Tank → sediment bowl → diaphragm lift pump → carburettor → inlet manifold. Where the tank is mounted high, gravity feed replaces the lift pump.' },
  tank: { summary: 'Fuel tank with a vented cap and a fuel tap.', role: 'The vent lets air in as fuel is drawn off; without it a vacuum would stop the flow.' },
  bowl: { summary: 'Sediment bowl (glass bowl, gauze strainer, bail and clamp nut).', role: 'Water and dirt settle out of the fuel in the glass bowl, where they can be seen and removed.' },
  pump: { summary: 'Diaphragm lift pump on the side of the engine block.', role: 'The camshaft eccentric rocks the rocker arm, which pulls the diaphragm down (suction: inlet valve opens). The diaphragm spring pushes it up again (delivery: outlet valve opens). When the float chamber is full the diaphragm stays down and the rocker idles — the pump only delivers what the carburettor takes.' },
  diaphragm: { summary: 'Fabric-and-rubber diaphragm with steel centre plates and pull rod.', role: 'Changes the volume of the pumping chamber above it.' },
  rocker: { summary: 'Rocker arm on its pivot pin.', role: 'Follows the eccentric (held on it by a return spring) and pulls the diaphragm down through the link.' },
  valves: { summary: 'Inlet and outlet disc valves.', role: 'One-way valves: fuel can only enter on the suction stroke and leave on the delivery stroke.' },
  carb: { summary: 'Downdraught carburettor body: air horn, choke, venturi, throttle, float chamber.', role: 'Mixes petrol with air in the correct proportion — about 1 part fuel to 15 parts air by weight — and lets the driver control how much mixture the engine gets.' },
  float: { summary: 'Float and needle valve.', role: 'As the fuel level rises the float lifts the needle onto its seat and shuts off the supply; as fuel is used the float drops and lets more in. This keeps the level just below the top of the jet.' },
  venturi: { summary: 'Venturi (choke tube) with the main nozzle at its throat.', role: 'Air speeds up through the narrow throat and its pressure falls, so fuel is pushed up the jet from the float chamber (at atmospheric pressure) and sprayed into the air stream.' },
  jet: { summary: 'Main jet and nozzle.', role: 'The calibrated jet meters the fuel; the nozzle discharges it into the venturi throat.' },
  throttle: { summary: 'Throttle butterfly (on the manifold side of the venturi).', role: 'Controls how much mixture enters the engine, and so the engine power and speed.' },
  choke: { summary: 'Choke butterfly (air side).', role: 'Closed for cold starting: it restricts the air and increases the suction on the jet, giving a very rich mixture.' },
  idle: { summary: 'Idling (slow-running) jet and port.', role: 'With the throttle almost shut the venturi suction is too weak to lift fuel; manifold vacuum below the butterfly draws fuel through the idle port instead.' },
}

export function Carb3D() {
  const g = buildCarbGeometry()
  const flows = useCarb((s) => s.flows)
  const cam = useRef(0)
  const lastD = useRef(0)
  const camRef = useRef<THREE.Group>(null)
  const rocker = useRef<THREE.Group>(null)
  const plates = useRef<THREE.Group>(null)
  const spring = useRef<THREE.Mesh>(null)
  const vIn = useRef<THREE.Group>(null)
  const vOut = useRef<THREE.Group>(null)
  const lever = useRef<THREE.Group>(null)
  const needle = useRef<THREE.Group>(null)
  const fuel = useRef<THREE.Mesh>(null)
  const throttle = useRef<THREE.Group>(null)
  const choke = useRef<THREE.Group>(null)
  const primer = useRef<THREE.Group>(null)

  const P = useMemo(() => {
    const t = L.tank
    const b = L.bowl
    const CX = L.chamberX
    const X = L.barrelX
    const tankToBowl = curve([V(t.x1 - 0.04, t.y0 - 0.016), V(t.x1 - 0.04, t.y0 - 0.05), V(b.x - 0.07, b.y + 0.022), V(b.x - 0.049, b.y + 0.018)])
    const bowlIn = curve([V(b.x - 0.049, b.y + 0.018), V(b.x - 0.012, b.y + 0.016), V(b.x - 0.012, b.y - 0.01), V(b.x - 0.006, b.y - 0.045), V(b.x + 0.006, b.y - 0.045), V(b.x + 0.012, b.y - 0.01), V(b.x + 0.012, b.y + 0.016), V(b.x + 0.049, b.y + 0.018)])
    const bowlToPump = curve([V(b.x + 0.049, b.y + 0.018), V(-0.15, b.y + 0.018), V(-0.11, 0.19), V(-0.1, 0.13), V(L.pumpX - 0.049, 0.126)])
    const pumpIn = curve([V(L.pumpX - 0.049, 0.126), V(L.pumpX - 0.015, 0.126), V(L.pumpX - 0.015, 0.109), V(L.pumpX, 0.104), V(L.pumpX + 0.015, 0.109), V(L.pumpX + 0.015, 0.126), V(L.pumpX + 0.049, 0.126)])
    const pumpToCarb = curve([V(L.pumpX + 0.049, 0.126), V(0.06, 0.13), V(0.14, 0.17), V(0.18, 0.175), V(CX - 0.05, 0.175)])
    const needlePath = curve([V(CX - 0.05, 0.175), V(CX, 0.175), V(CX, 0.168), V(CX + 0.002, 0.15), V(CX + 0.006, 0.13)], 0)
    const jetPath = curve([V(CX + 0.006, L.floorY + 0.01), V(CX, L.floorY + 0.002), V(CX, 0.106), V(0.274, 0.106), V(0.274, L.throatY), V(X, L.throatY)], 0)
    const spray = curve([V(X, L.throatY), V(X, 0.12), V(X, 0.09), V(X, 0.062), ...MANIFOLD.getPoints(10).slice(1)])
    const idle = curve([V(0.252, L.floorY + 0.002), V(0.252, 0.1), V(0.28, 0.1), V(0.28, 0.0785), V(0.287, 0.0785), V(0.296, 0.07), V(X, 0.062), ...MANIFOLD.getPoints(10).slice(1)], 0.1)
    const air = curve([V(X, 0.33), V(X, 0.236), V(X, L.chokeY), V(X, L.throatY), V(X, L.throttleY), V(X, 0.062), ...MANIFOLD.getPoints(10).slice(1), V(L.barrelX + 0.2, -0.05), V(L.barrelX + 0.2, -0.11)])
    const vent = curve([V(CX + 0.016, 0.19), V(CX + 0.016, 0.172), V(CX + 0.016, 0.15)], 0)
    return { tankToBowl, bowlIn, bowlToPump, pumpIn, pumpToCarb, needlePath, jetPath, spray, idle, air, vent }
  }, [])

  const pipes = useMemo(() => [P.tankToBowl, P.bowlToPump, P.pumpToCarb].map((c) => pipe(c, 0.0042, 0.0028, 64, 12)), [P])

  useSimFrame((dt) => {
    const st = useCarb.getState()
    // pump camshaft (half engine speed) and its eccentric
    cam.current = (cam.current + ((st.rpm / 2) * 2 * PI * dt) / 60) % (2 * PI)
    const a = cam.current
    camRef.current?.rotation.set(0, 0, a)
    const eccDy = L.ecc * Math.cos(a)
    const delta = Math.asin(eccDy / 0.037)
    const dMin = Math.asin(-L.ecc / 0.037)
    rocker.current?.rotation.set(0, 0, delta)
    const pullMax = 0.02 * (Math.sin(-dMin) - Math.sin(dMin))
    const pull = 0.02 * (Math.sin(delta) - Math.sin(dMin))

    // carburettor operating point and float chamber
    const deficit = FLOAT.levelSet - live.level
    const op = operatingPoint(st, deficit)
    live.level = floatStep(FLOAT, live.level, op.fuel, dt)
    const open = needleOpening(FLOAT, live.level)
    // lost motion: with the bowl full (needle shut) the diaphragm stays down and the rocker idles
    const u = st.rpm > 0 ? open : 0
    const d = pullMax * (1 - u) + pull * u
    plates.current?.position.set(L.pumpX, L.diaphragmY + 0.0005 - d, 0)
    if (spring.current) {
      spring.current.position.set(L.pumpX, 0.035, 0)
      spring.current.scale.set(1, L.diaphragmY - 0.003 - d - 0.035, 1)
    }
    const dd = d - lastD.current
    lastD.current = d
    vIn.current?.position.set(L.pumpX - 0.015, 0.1145 - (dd > 1e-7 ? 0.0015 : 0), 0)
    vOut.current?.position.set(L.pumpX + 0.015, 0.1185 + (dd < -1e-7 ? 0.0015 : 0), 0)

    const alpha = Math.max(-0.06, Math.min(0.33, -(live.level - FLOAT.levelSet) / -FLOAT_ARM.cx))
    lever.current?.rotation.set(0, 0, alpha)
    const tabY = L.floatPivot.y + FLOAT_ARM.tabX * Math.sin(alpha) + FLOAT_ARM.tabY * Math.cos(alpha)
    const closedY = L.floatPivot.y + FLOAT_ARM.tabY
    needle.current?.position.set(L.chamberX, Math.max(closedY - 0.003, Math.min(closedY, tabY)), 0)
    if (fuel.current) {
      fuel.current.position.set(L.chamberX, L.floorY, 0)
      fuel.current.scale.set(1, Math.max(1e-4, live.level), 1)
    }
    throttle.current?.rotation.set(0, 0, -((6 + st.throttle * 84) * PI) / 180)
    choke.current?.rotation.set(0, 0, ((6 + (1 - st.choke) * 84) * PI) / 180)
    primer.current?.rotation.set(0, 0, 0)

    live.needle = open
    live.fuel = op.fuel
    live.main = op.mainFuel
    live.idle = op.idleFuel
    live.air = op.air
    live.af = op.af
    live.cam = a
    live.diaphragm = d
    live.stroke = u
  })

  const airK = () => live.air / AIR_MAX
  const X = L.barrelX
  return (
    <group>
      <Part id="si-fuel-system" name="Petrol fuel system" role="housing" material="castIron" info={INFO.sys} cites={C.sys}>
        <Part id="tank" name="Fuel tank & vented cap" material="paintRed" role="housing" info={INFO.tank} cites={C.sys} explode={[-0.08, 0.1, 0]}>
          <PartMesh geometry={g.tankShell} />
          <PartMesh geometry={g.ventedCap} material="paintBlack" position={[L.tank.x0 + 0.07, L.tank.y1 + 0.027, 0]} />
          <PartMesh geometry={g.tap} material="brass" position={[L.tank.x1 - 0.04, L.tank.y0 - 0.026, 0]} />
          <Part id="tank-fuel" name="Petrol" material="fuel" role="fluid">
            <PartMesh geometry={g.tankFuel} />
          </Part>
        </Part>
        <Part id="sediment-bowl" name="Sediment bowl" material="castIron" role="housing" info={INFO.bowl} cites={C.bowl} explode={[-0.04, 0.06, 0]}>
          <PartMesh geometry={g.bowlHead} />
          <PartMesh geometry={g.bowlGlass} material="glass" />
          <PartMesh geometry={g.gauze} material="brass" />
          <Part id="bowl-fuel" name="Fuel and sediment" material="fuel" role="fluid">
            <PartMesh geometry={g.bowlFuel} />
            <PartMesh geometry={g.sediment} material="soil" />
          </Part>
          <Part id="bowl-bail" name="Bail & clamp" material="steel" role="static" cut={false}>
            <PartMesh geometry={g.bail} />
          </Part>
        </Part>

        <Part id="engine-block" name="Engine block (stub) & camshaft" material="castIron" role="housing" info={{ summary: 'Part of the engine block with the camshaft.', role: 'An eccentric on the camshaft works the lift pump.' }} cites={C.pump}>
          <PartMesh geometry={g.block} />
          <Part id="camshaft" name="Camshaft & eccentric" material="forged" role="moving" info={{ summary: 'Camshaft with the pump eccentric.', role: 'Turns at half engine speed; the eccentric rocks the pump rocker arm once per revolution.' }} cites={C.pump}>
            <group ref={camRef} position={[L.cam.x, L.cam.y, 0]}>
              <PartMesh geometry={g.camshaft} />
            </group>
          </Part>
        </Part>

        <Part id="lift-pump" name="Diaphragm lift pump" material="castIron" role="housing" info={INFO.pump} cites={C.pump} explode={[0, 0.1, 0.06]}>
          <PartMesh geometry={g.pumpLower} />
          <Part id="pump-upper" name="Pump upper body & cover" material="aluminium" role="housing" explode={[0, 0.05, 0]}>
            <PartMesh geometry={g.pumpUpper} />
            <PartMesh geometry={g.pumpCover} material="paintBlack" />
          </Part>
          <Part id="diaphragm" name="Diaphragm" material="rubber" role="static" info={INFO.diaphragm} cites={C.pump}>
            <PartMesh geometry={g.diaphragm} />
          </Part>
          <Part id="diaphragm-plates" name="Diaphragm plates & pull rod" material="steel" role="moving" info={INFO.diaphragm} cites={C.pump}>
            <group ref={plates}>
              <PartMesh geometry={g.plates} />
            </group>
          </Part>
          <Part id="pump-spring" name="Diaphragm spring" material="steelDark" role="moving" cut={false} info={{ summary: 'Diaphragm return spring.', role: 'Pushes the diaphragm up on the delivery stroke; its force sets the delivery pressure.' }}>
            <PartMesh ref={spring} geometry={g.pumpSpring} />
          </Part>
          <Part id="pump-valves" name="Inlet & outlet valves" material="brass" role="moving" info={INFO.valves} cites={C.pump}>
            <group ref={vIn}>
              <PartMesh geometry={g.valveDisc} />
            </group>
            <group ref={vOut}>
              <PartMesh geometry={g.valveDisc} />
            </group>
          </Part>
          <Part id="rocker-arm" name="Rocker arm" material="forged" role="moving" info={INFO.rocker} cites={C.pump}>
            <group ref={rocker} position={[L.pivot.x, L.pivot.y, 0]}>
              <PartMesh geometry={g.rocker} />
            </group>
            <PartMesh geometry={g.pin} material="steel" position={[L.pivot.x, L.pivot.y, 0]} />
          </Part>
          <Part id="priming-lever" name="Hand priming lever" material="paintBlack" role="moving" info={{ summary: 'Hand priming lever.', role: 'Works the diaphragm by hand to fill the carburettor before starting.' }} cites={C.pump}>
            <group ref={primer} position={[L.pumpX - 0.038, 0.06, 0.03]}>
              <PartMesh geometry={g.primingLever} />
            </group>
          </Part>
        </Part>

        <Part id="fuel-pipes" name="Fuel pipes" material="copper" role="static" info={{ summary: 'Low-pressure fuel pipes.' }} cites={C.sys}>
          {pipes.map((p, i) => (
            <PartMesh key={i} geometry={p} />
          ))}
        </Part>

        <Part id="carburettor" name="Carburettor" material="aluminium" role="housing" info={INFO.carb} cites={C.carb} explode={[0.04, 0.04, 0]}>
          <Part id="carb-body" name="Carburettor body & venturi" material="aluminium" role="housing" info={INFO.venturi} cites={C.carb}>
            <PartMesh geometry={g.body} />
          </Part>
          <Part id="chamber-cover" name="Float-chamber cover & needle seat" material="brass" role="housing" info={{ summary: 'Float-chamber cover with the fuel inlet, needle seat and vent.', role: 'The vent keeps the float chamber at atmospheric pressure — it is the pressure difference between this and the venturi throat that drives the fuel.' }} cites={C.carb} explode={[0, 0.07, 0]}>
            <PartMesh geometry={g.cover} />
          </Part>
          <Part id="float" name="Float & lever" material="brass" role="moving" info={INFO.float} cites={C.carb} explode={[0, 0.03, 0.06]}>
            <group ref={lever} position={[L.floatPivot.x, L.floatPivot.y, 0]}>
              <PartMesh geometry={g.float} />
              <PartMesh geometry={g.lever} material="steel" />
            </group>
          </Part>
          <Part id="needle-valve" name="Needle valve" material="steelDark" role="moving" info={INFO.float} cites={C.carb} explode={[0, 0.05, 0.06]}>
            <group ref={needle}>
              <PartMesh geometry={g.needle} />
            </group>
          </Part>
          <Part id="chamber-fuel" name="Fuel in the float chamber" material="fuel" role="fluid" info={{ summary: 'Fuel held at a constant level by the float.' }}>
            <PartMesh ref={fuel} geometry={g.chamberFuel} />
          </Part>
          <Part id="main-jet" name="Main jet & nozzle" material="brass" role="static" info={INFO.jet} cites={C.carb}>
            <PartMesh geometry={g.jet} />
            <PartMesh geometry={g.nozzle} />
          </Part>
          <Part id="throttle" name="Throttle butterfly" material="brass" role="moving" info={INFO.throttle} cites={C.carb}>
            <group ref={throttle} position={[X, L.throttleY, 0]}>
              <PartMesh geometry={g.disc} />
              <PartMesh geometry={g.spindle} material="steel" />
            </group>
          </Part>
          <Part id="choke" name="Choke butterfly" material="brass" role="moving" info={INFO.choke} cites={C.carb}>
            <group ref={choke} position={[X, L.chokeY, 0]}>
              <PartMesh geometry={g.disc} />
              <PartMesh geometry={g.spindle} material="steel" />
            </group>
          </Part>
        </Part>

        <Part id="manifold" name="Inlet manifold & port" material="castIron" role="housing" info={{ summary: 'Inlet manifold and cylinder-head port (stub).', role: 'Carries the air–fuel mixture to the inlet valve.' }} cites={C.sys}>
          <PartMesh geometry={g.manifold} />
          <PartMesh geometry={g.head} />
          <PartMesh geometry={g.inletValve} material="steel" position={[L.barrelX + 0.2, -0.1035, 0]} />
        </Part>

        {flows ? (
          <>
            {[P.tankToBowl, P.bowlIn, P.bowlToPump, P.pumpIn, P.pumpToCarb].map((c, i) => (
              <Flow key={i} curve={c} count={26} radius={0.002} color={FUEL_C} speed={0.35} spread={0.0015} intensity={() => live.stroke} />
            ))}
            <Flow curve={P.needlePath} count={14} radius={0.0016} color={FUEL_C} speed={1} spread={0.001} intensity={() => live.needle} />
            <Flow curve={P.jetPath} count={20} radius={0.0013} color={FUEL_C} speed={0.8} spread={0.0005} intensity={() => Math.min(1, live.main / 0.0012)} />
            <Flow curve={P.idle} count={30} radius={0.0011} color="#f2b84a" speed={0.6} spread={0.002} intensity={() => Math.min(1, live.idle / 0.00012)} />
            <Flow curve={P.spray} count={60} radius={0.0014} color="#ffe28a" speed={0.9} spread={0.012} intensity={() => Math.min(1, live.main / 0.0012)} />
            <Flow curve={P.air} count={110} radius={0.0022} color={AIR_C} speed={0.45} spread={0.018} intensity={airK} />
            <Flow curve={P.vent} count={6} radius={0.0012} color={AIR_C} speed={0.3} spread={0.001} intensity={() => Math.min(1, live.fuel / 0.0008)} />
          </>
        ) : null}
      </Part>

      <PartLabel partId="tank" at={[-0.47, 0.56, 0.09]} />
      <PartLabel partId="sediment-bowl" at={[-0.24, 0.29, 0.03]} />
      <PartLabel partId="lift-pump" at={[-0.1, 0.16, 0.04]} />
      <PartLabel partId="rocker-arm" at={[0.03, 0.02, 0.05]} />
      <PartLabel partId="float" at={[0.2, 0.13, 0.03]} />
      <PartLabel partId="needle-valve" at={[0.236, 0.2, 0.02]} />
      <PartLabel partId="carb-body" at={[0.35, 0.15, 0.03]} text="Venturi" />
      <PartLabel partId="choke" at={[0.34, 0.215, 0.02]} />
      <PartLabel partId="throttle" at={[0.34, 0.085, 0.02]} />
      <PartLabel partId="main-jet" at={[0.25, 0.098, 0.02]} />
      <PartLabel partId="manifold" at={[0.42, -0.02, 0.04]} />
    </group>
  )
}
