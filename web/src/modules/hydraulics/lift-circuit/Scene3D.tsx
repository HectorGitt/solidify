import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { pipe } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { LINKAGE } from '@/tractor/dims'
import { solveLinkage } from '@/tractor/linkage'
import { L, PUMP_C, RELIEF_SEAT, buildLiftGeometry } from './geometry'
import { C, G, MG1617, PHI_LOW, RAM_PIVOT, ROD_LEN, crankPin, live, step, useLift } from './model'

const CITE = {
  circuit: [SRC.hy510('p1–2 (book pp82–83), Fig 40'), MG1617('Q(a) system and sketch')],
  pump: [SRC.hy510('p2–3: gear pump, 27 L/min'), SRC.tts510('p2: pump driven from the gearbox')],
  relief: [SRC.hy510('p2–3: relief blow-off 150 kg/cm²'), SRC.top510('p11: relief 275 bar')],
  linkage: [SRC.hy510('p6–7, Fig 42: lift rods, lower links')],
}

const INFO = {
  system: {
    summary: 'Simple tractor hydraulic lift (one-way, single-acting ram).',
    role: 'Tank, pump, control valve, ram cylinder with piston, ram cross shaft, lift arms, lift rods and lower links. Moving the lever to LIFT sends oil to the ram; on LOWER the implement drops under its own weight and pushes the oil back to the reservoir.',
    details: 'Layout of a simple one-way lift circuit; the shape of the castings, the ram crank and the valve are typical.',
  },
  housing: {
    summary: 'Transmission housing and lift cover — the reservoir.',
    role: 'On most tractors the hydraulic oil is the transmission oil, so the housing itself is the reservoir. The lift ram and rockshaft sit in the top (lift) cover.',
  },
  oil: { summary: 'Hydraulic (transmission) oil in the reservoir.', role: 'Drawn into the pump through a strainer; returns here from the valve and the relief valve.' },
  pump: {
    summary: 'Gear pump.',
    role: 'The most common tractor hydraulic pump. It is usually driven from the gearbox/PTO shaft inside the transmission (or from the engine, which makes the hydraulics independent of the clutch). About 27 L/min on a 45 kW tractor.',
  },
  filter: { summary: 'Filter.', role: 'Removes dirt and wear particles; on simple systems this may be just a magnetic plug or a replaceable element.' },
  relief: {
    summary: 'Relief valve.',
    role: 'A spring-loaded poppet. If the pressure reaches its setting (typically 150 kg/cm², ≈ 2000 psi) it lifts and returns the pump flow to the reservoir — you hear it knocking. This protects the pump and pipes when the ram is overloaded or reaches the end of its stroke.',
  },
  valve: {
    summary: 'Control valve (spool).',
    role: 'Worked by the lift/lower lever. LIFT: pump to ram. HOLD: ram line blocked, pump flow returns to tank (open centre). LOWER: ram line opened to tank so the implement drops; the flow-control setting limits the drop speed.',
  },
  spool: { summary: 'Valve spool.', role: 'Its lands open and close the ports as the lever slides it.' },
  ram: { summary: 'Ram cylinder (single-acting).', role: 'Oil pushes the piston, whose connecting rod turns the ram cross shaft (rockshaft) through the crank arm.' },
  ramOil: { summary: 'Oil in the ram.', role: 'Red when pressurised (lifting or holding the load), amber while it is being pushed back to the tank.' },
  piston: { summary: 'Ram piston and connecting rod.', role: 'Pushes the crank on the rockshaft.' },
  rockshaft: { summary: 'Ram cross shaft (rockshaft) with crank arm.', role: 'Turns the ram push into rotation of the two lift arms.' },
  liftArms: { summary: 'Lift arms.', role: 'Fixed on the ends of the rockshaft; they pull the lift rods up.' },
  liftRods: { summary: 'Lift rods.', role: 'Hang from the lift arms and carry the lower links. The right-hand rod has a levelling box to level the implement.' },
  lowerLinks: { summary: 'Lower links.', role: 'Carry the implement on their hitch balls and raise it as the lift rods pull up.' },
  topLink: { summary: 'Top link.', role: 'Completes the three-point linkage and sets the implement pitch.' },
  implement: { summary: 'Mounted implement (weight on the hitch).', role: 'Its weight is what the ram has to lift — set it with the load slider.' },
  pipes: { summary: 'Pressure, ram and return pipes.' },
}

const RED = new THREE.Color('#d8452e')
const AMBER = new THREE.Color('#c99a2e')
const tmpV = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const xAxis = new THREE.Vector3(1, 0, 0)

function setBar(m: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3, t: number, d: number, axis: 'x' | 'y' = 'x') {
  if (!m) return
  tmpV.subVectors(b, a)
  const len = tmpV.length()
  tmpV.normalize()
  m.quaternion.setFromUnitVectors(axis === 'x' ? xAxis : up, tmpV)
  if (axis === 'x') {
    m.position.copy(a).add(b).multiplyScalar(0.5)
    m.scale.set(len, t, d)
  } else {
    m.position.copy(a)
    m.scale.set(t, len, t)
  }
}

const v3 = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)
const curve = (pts: [number, number, number?][]) => new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => v3(x, y, z ?? 0)), false, 'catmullrom', 0.2)

const SIDES = [1, -1] as const
const ARM_Z = LINKAGE.rockshaft.z
const A_Z = LINKAGE.lowerPivot.z
const HITCH_Z = LINKAGE.hitchSpread
const E_Z = A_Z + (HITCH_Z - A_Z) * (G.liftRodAt / G.lower)

export function Lift3D() {
  const g = buildLiftGeometry()
  const flows = useLift((s) => s.flows)

  const lines = useMemo(() => {
    const pumpFilter = curve([
      [L.pump.x, 0.47],
      [L.pump.x, 0.62],
      [L.pump.x, 0.8],
    ])
    const filterValve = curve([
      [L.filter.x, 0.99],
      [L.filter.x - 0.02, 1.27],
      [0.16, 1.29],
      [L.portP, 1.2],
    ])
    const filterRelief = curve([
      [L.filter.x + 0.04, 0.835],
      [0.82, 0.835],
      [L.relief.x - L.relief.r - 0.002, 0.835],
    ])
    const reliefTank = curve([
      [L.relief.x + L.relief.r + 0.002, 0.95],
      [0.962, 0.94],
      [0.97, 0.86],
      [0.97, 0.77],
    ])
    const valveRam = curve([
      [L.portA, 1.11],
      [L.portA + 0.005, 1.03],
      [0.23, 0.97],
      [0.25, 0.925],
    ])
    const valveTank = curve([
      [L.portT, 1.11],
      [L.portT, 0.9],
      [L.portT, 0.78],
    ])
    const mk = (c: THREE.Curve<THREE.Vector3>) => pipe(c, 0.0095, 0.0068, 48, 14)
    return {
      geo: [pumpFilter, filterValve, filterRelief, reliefTank, valveRam, valveTank].map(mk),
      flow: {
        pump: curve([
          [L.pump.x, 0.32],
          [L.pump.x, 0.38],
          [L.pump.x - 0.02, 0.42],
          [L.pump.x, 0.47],
          [L.pump.x, 0.8],
          [L.pump.x, 0.97],
          [L.filter.x - 0.02, 1.27],
          [0.16, 1.29],
          [L.portP, 1.2],
          [L.portP + 0.01, L.valve.y],
        ]),
        relief: curve([
          [L.filter.x, 0.84],
          [L.relief.x - 0.03, 0.835],
          [L.relief.x, 0.84],
          [L.relief.x, RELIEF_SEAT + 0.03],
          [L.relief.x + 0.015, 0.95],
          [0.962, 0.94],
          [0.97, 0.8],
          [0.97, L.oilY - 0.04],
        ]),
        toRam: curve([
          [L.portA, L.valve.y],
          [L.portA, 1.11],
          [L.portA + 0.005, 1.03],
          [0.23, 0.97],
          [0.25, 0.925],
          [0.25, 0.87],
          [0.2, 0.87],
        ]),
        toTank: curve([
          [L.portA - 0.02, L.valve.y],
          [L.portT, L.valve.y],
          [L.portT, 1.0],
          [L.portT, 0.78],
          [L.portT, L.oilY - 0.05],
        ]),
      },
    }
  }, [])
  const fromRam = useMemo(() => new THREE.CatmullRomCurve3(lines.flow.toRam.points.slice().reverse()), [lines])

  const ramOilMat = useMemo(() => createDynamicCutMaterial({ color: '#d8452e', hatch: 'fluid', roughness: 0.2 }), [])

  const phi = useRef(PHI_LOW)
  const spoolX = useRef(0)
  const reliefLift = useRef(0)
  const gearA = useRef<THREE.Group>(null)
  const gearB = useRef<THREE.Group>(null)
  const spoolRef = useRef<THREE.Group>(null)
  const poppetRef = useRef<THREE.Group>(null)
  const springRef = useRef<THREE.Mesh>(null)
  const ramRef = useRef<THREE.Group>(null)
  const pistonRef = useRef<THREE.Group>(null)
  const ramOil = useRef<THREE.Mesh>(null)
  const crank = useRef<THREE.Mesh>(null)
  const arms = useRef<(THREE.Mesh | null)[]>([])
  const rods = useRef<(THREE.Mesh | null)[]>([])
  const lowers = useRef<(THREE.Mesh | null)[]>([])
  const balls = useRef<(THREE.Mesh | null)[]>([])
  const mast = useRef<(THREE.Mesh | null)[]>([])
  const top = useRef<THREE.Mesh>(null)
  const cross = useRef<THREE.Mesh>(null)
  const weight = useRef<THREE.Mesh>(null)
  const pumpAngle = useRef(0)

  useSimFrame((dt) => {
    const p = useLift.getState()
    phi.current = step(p, phi.current, dt)
    const pose = solveLinkage(phi.current)
    const K = crankPin(pose.beta)

    // pump gears
    pumpAngle.current += (p.Q / 27) * 25 * dt
    gearA.current?.rotation.set(0, 0, -pumpAngle.current)
    gearB.current?.rotation.set(0, 0, pumpAngle.current + Math.PI / 10)

    // spool & relief poppet (eased)
    const target = p.valve === 'lift' ? 0.03 : p.valve === 'lower' ? -0.03 : 0
    spoolX.current += (target - spoolX.current) * Math.min(1, dt * 12)
    spoolRef.current?.position.set((L.valve.x0 + L.valve.x1) / 2 + spoolX.current, L.valve.y, 0)
    const open = live.toRelief > 0 ? 1 : 0
    reliefLift.current += (open - reliefLift.current) * Math.min(1, dt * 10)
    live.reliefOpen = reliefLift.current
    const knock = open ? 0.0012 * Math.sin(performance.now() / 18) : 0
    const py = RELIEF_SEAT + 0.006 + 0.004 + reliefLift.current * 0.012 + knock
    poppetRef.current?.position.set(L.relief.x, py, 0)
    if (springRef.current) {
      springRef.current.position.y = py + 0.014
      springRef.current.scale.y = L.relief.y1 - 0.008 - (py + 0.014)
    }

    // ram
    const dx = K.x - RAM_PIVOT.x
    const dy = K.y - RAM_PIVOT.y
    const Lr = Math.hypot(dx, dy)
    ramRef.current?.rotation.set(0, 0, Math.atan2(dy, dx))
    const s = Lr - ROD_LEN
    pistonRef.current?.position.set(s, 0, 0)
    if (ramOil.current) ramOil.current.scale.x = Math.max(1e-4, s)
    const col = live.mode === 'lowering' ? AMBER : live.p > 0.05 ? RED : AMBER
    ramOilMat.material.color.copy(col)
    ramOilMat.capColor.copy(col)
    ramOilMat.material.clipIntersection = useView.getState().cut.intersection

    // linkage
    const Cv = v3(C.x, C.y)
    setBar(crank.current, Cv, v3(K.x, K.y), 0.035, 0.05)
    const U = v3(pose.U.x, pose.U.y)
    setBar(top.current, v3(G.B.x, G.B.y), U, 0.04, 0.04)
    SIDES.forEach((sd, i) => {
      const D = v3(pose.D.x, pose.D.y, sd * ARM_Z)
      setBar(arms.current[i], v3(C.x, C.y, sd * ARM_Z), D, 0.05, 0.03)
      setBar(rods.current[i], D, v3(pose.E.x, pose.E.y, sd * E_Z), 0.026, 0, 'y')
      const Lp = v3(pose.L.x, pose.L.y, sd * HITCH_Z)
      setBar(lowers.current[i], v3(G.A.x, G.A.y, sd * A_Z), Lp, 0.06, 0.03)
      balls.current[i]?.position.copy(Lp)
      setBar(mast.current[i], Lp, U, 0.04, 0.03)
    })
    setBar(cross.current, v3(pose.L.x, pose.L.y, -HITCH_Z), v3(pose.L.x, pose.L.y, HITCH_Z), 0.05, 0.05)
    if (weight.current) {
      const m = v3(pose.U.x - pose.L.x, pose.U.y - pose.L.y).normalize()
      const n = v3(-m.y, m.x)
      weight.current.position.set(pose.L.x + m.x * 0.25 + n.x * 0.24, pose.L.y + m.y * 0.25 + n.y * 0.24, 0)
      weight.current.rotation.set(0, 0, -pose.mastTilt)
    }
  })

  const k = (q: () => number) => () => Math.min(1, q() / 30) * 0.8 + 0.2
  const idx = <T,>(r: { current: (T | null)[] }, i: number) => (el: T | null) => {
    r.current[i] = el
  }

  return (
    <group>
      <Part id="lift-system" name="Hydraulic lift system" role="housing" material="castIron" info={INFO.system} cites={CITE.circuit}>
        <Part id="housing" name="Transmission housing & lift cover (reservoir)" material="paintRed" role="housing" info={INFO.housing} cites={CITE.circuit}>
          <PartMesh geometry={g.housing} />
          <Part id="reservoir-oil" name="Reservoir oil" material="hydraulicOil" role="fluid" info={INFO.oil} cites={CITE.circuit}>
            <PartMesh geometry={g.oil} />
          </Part>
        </Part>

        <Part id="pump" name="Gear pump" material="aluminium" role="static" info={INFO.pump} cites={CITE.pump} explode={[0, -0.15, 0.35]}>
          <PartMesh geometry={g.pump.body} />
          <Part id="pump-gears" name="Pump gears" material="steel" role="moving" info={{ summary: 'Driving and driven gears.', role: 'Carry oil round the outside in the tooth spaces from the suction side to the delivery side.' }} cites={CITE.pump}>
            <group ref={gearA} position={[L.pump.x - PUMP_C / 2, L.pump.y, 0]}>
              <PartMesh geometry={g.pump.gear} />
            </group>
            <group ref={gearB} position={[L.pump.x + PUMP_C / 2, L.pump.y, 0]}>
              <PartMesh geometry={g.pump.gear} />
            </group>
          </Part>
        </Part>

        <Part id="filter" name="Filter" material="paintBlue" role="static" info={INFO.filter} cites={[SRC.hy510('p3: magnetic plug or element')]} explode={[0.1, 0.2, 0.3]}>
          <PartMesh geometry={g.filter.can} />
          <Part id="filter-element" name="Filter element" material="gasket" role="static">
            <PartMesh geometry={g.filter.element} />
          </Part>
        </Part>

        <Part id="relief" name="Relief valve" material="brass" role="static" info={INFO.relief} cites={CITE.relief} explode={[0.25, 0.2, 0.2]}>
          <PartMesh geometry={g.relief.body} />
          <Part id="relief-poppet" name="Relief poppet" material="steel" role="moving" info={{ summary: 'Poppet.', role: 'Held on its seat by the spring until the pressure beneath it reaches the setting.' }} cites={CITE.relief}>
            <group ref={poppetRef}>
              <PartMesh geometry={g.relief.poppet} />
            </group>
          </Part>
          <Part id="relief-spring" name="Relief spring" material="steelDark" role="moving" cut={false} info={{ summary: 'Relief spring.', role: 'Its pre-load sets the relief pressure.' }}>
            <PartMesh ref={springRef} geometry={g.relief.spring} position={[L.relief.x, 0, 0]} />
          </Part>
        </Part>

        <Part id="control-valve" name="Control valve" material="castIron" role="static" info={INFO.valve} cites={CITE.circuit} explode={[0, 0.3, 0.25]}>
          <PartMesh geometry={g.valveBody} />
          <Part id="spool" name="Valve spool & lever" material="chrome" role="moving" info={INFO.spool} cites={CITE.circuit}>
            <group ref={spoolRef} position={[(L.valve.x0 + L.valve.x1) / 2, L.valve.y, 0]}>
              <PartMesh geometry={g.spool} />
              <PartMesh geometry={g.bar} material="paintBlack" position={[-(L.valve.x1 - L.valve.x0) / 2 - 0.035, 0.07, 0]} scale={[0.014, 0.14, 0.014]} />
              <PartMesh geometry={g.ball} material="plastic" position={[-(L.valve.x1 - L.valve.x0) / 2 - 0.035, 0.15, 0]} scale={0.6} />
            </group>
          </Part>
        </Part>

        <Part id="pipes" name="Pipes" material="steel" role="static" info={INFO.pipes} cut={false}>
          {lines.geo.map((geo, i) => (
            <PartMesh key={i} geometry={geo} />
          ))}
        </Part>

        <group ref={ramRef} position={[RAM_PIVOT.x, RAM_PIVOT.y, 0]}>
          <Part id="ram" name="Ram cylinder" material="steelDark" role="static" info={INFO.ram} cites={CITE.circuit}>
            <PartMesh geometry={g.ram.barrel} />
            <Part id="ram-oil" name="Ram oil" role="fluid" info={INFO.ramOil}>
              <PartMesh ref={ramOil} geometry={g.ram.oil} customMaterial={ramOilMat.material} castShadow={false} />
            </Part>
            <group ref={pistonRef}>
              <Part id="ram-piston" name="Ram piston & connecting rod" material="steel" role="moving" info={INFO.piston} cites={CITE.circuit}>
                <PartMesh geometry={g.ram.piston} />
                <PartMesh geometry={g.ram.seal} material="rubber" />
                <PartMesh geometry={g.ram.rod} material="chrome" />
              </Part>
            </group>
          </Part>
        </group>

        <Part id="rockshaft" name="Ram cross shaft (rockshaft) & crank" material="forged" role="moving" info={INFO.rockshaft} cites={CITE.circuit}>
          <PartMesh geometry={g.rockshaft} position={[C.x, C.y, 0]} />
          <PartMesh ref={crank} geometry={g.bar} />
        </Part>

        <Part id="linkage" name="Lift linkage" material="paintBlack" role="moving" info={INFO.lowerLinks} cites={CITE.linkage}>
          <Part id="lift-arms" name="Lift arms" material="forged" info={INFO.liftArms} cites={CITE.linkage}>
            {SIDES.map((_, i) => (
              <PartMesh key={i} ref={idx(arms, i)} geometry={g.bar} />
            ))}
          </Part>
          <Part id="lift-rods" name="Lift rods" material="steel" info={INFO.liftRods} cites={CITE.linkage}>
            {SIDES.map((_, i) => (
              <PartMesh key={i} ref={idx(rods, i)} geometry={g.rod} />
            ))}
          </Part>
          <Part id="lower-links" name="Lower links" material="paintBlack" info={INFO.lowerLinks} cites={CITE.linkage}>
            {SIDES.map((_, i) => (
              <PartMesh key={i} ref={idx(lowers, i)} geometry={g.bar} />
            ))}
            {SIDES.map((_, i) => (
              <PartMesh key={`b${i}`} ref={idx(balls, i)} geometry={g.ball} material="steel" />
            ))}
          </Part>
          <Part id="top-link" name="Top link" material="paintYellow" info={INFO.topLink} cites={CITE.linkage}>
            <PartMesh ref={top} geometry={g.bar} />
          </Part>
          <Part id="implement" name="Mounted implement" material="paintOrange" info={INFO.implement} cites={CITE.linkage}>
            {SIDES.map((_, i) => (
              <PartMesh key={i} ref={idx(mast, i)} geometry={g.bar} />
            ))}
            <PartMesh ref={cross} geometry={g.bar} />
            <PartMesh ref={weight} geometry={g.weight} material="castIron" />
          </Part>
        </Part>
        <Part id="brackets" name="Linkage brackets" material="castIron" role="static">
          {SIDES.map((sd) => (
            <PartMesh key={sd} geometry={g.bar} position={[G.A.x, G.A.y, sd * (A_Z - 0.04)]} scale={[0.1, 0.1, 0.12]} />
          ))}
          <PartMesh geometry={g.bar} position={[(G.B.x + L.cover.x0) / 2, G.B.y, 0]} scale={[Math.abs(L.cover.x0 - G.B.x) + 0.04, 0.07, 0.08]} />
        </Part>

        {flows ? (
          <>
            <Flow curve={lines.flow.pump} count={90} radius={0.006} color="#ff6a4a" speed={0.45} spread={0.006} intensity={k(() => useLift.getState().Q)} />
            <Flow curve={lines.flow.relief} count={40} radius={0.006} color="#ffd166" speed={0.9} spread={0.006} intensity={() => (live.toRelief > 0 ? live.reliefOpen : 0)} />
            <Flow curve={lines.flow.toRam} count={45} radius={0.006} color="#ff6a4a" speed={0.7} spread={0.005} intensity={() => (live.toRam > 0 ? 1 : 0)} />
            <Flow curve={fromRam} count={45} radius={0.006} color="#f2c14e" speed={0.6} spread={0.005} intensity={() => (live.toRam < 0 ? 1 : 0)} />
            <Flow curve={lines.flow.toTank} count={40} radius={0.006} color="#f2c14e" speed={0.7} spread={0.005} intensity={() => (live.toTank > 0 ? 1 : 0)} />
          </>
        ) : null}
      </Part>

      <PartLabel partId="housing" at={[0.45, 0.3, 0.24]} />
      <PartLabel partId="pump" at={[L.pump.x, L.pump.y - 0.08, 0.05]} />
      <PartLabel partId="filter" at={[L.filter.x - 0.06, 1.0, 0.05]} />
      <PartLabel partId="relief" at={[L.relief.x + 0.04, 1.04, 0.03]} />
      <PartLabel partId="control-valve" at={[0.12, 1.24, 0.05]} />
      <PartLabel partId="ram" at={[0.1, 0.8, 0.06]} />
      <PartLabel partId="rockshaft" at={[C.x, C.y + 0.05, 0.42]} />
      <PartLabel partId="lift-arms" at={[-0.5, 1.15, ARM_Z + 0.03]} />
      <PartLabel partId="lift-rods" at={[-0.7, 0.75, E_Z + 0.03]} />
      <PartLabel partId="lower-links" at={[-0.6, 0.35, HITCH_Z]} />
      <PartLabel partId="implement" at={[-1.2, 0.6, 0.35]} />
      <PartLabel partId="reservoir-oil" at={[0.3, 0.42, 0.1]} />
    </group>
  )
}
