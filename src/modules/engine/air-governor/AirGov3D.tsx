import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { flyweightAngle, fuelFraction, governorStep } from '@/physics/engineSystems'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { buildAirGovGeometry } from './geometry'
import { CRANK_Y, DASH_Y, DR, E, G, GOV, GY, OB, dust, live, preload, pushHistory, settings, useAirGov } from './model'

const { PI } = Math
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)
const curve = (pts: THREE.Vector3[], t = 0.3) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', t)

const C = {
  air: [SRC.tb509('§4.3, Figs 4.3–4.4 air cleaners')],
  dust: [SRC.tb509('§4.3 dust 0.565 / 0.283 / 0.141 g/m³')],
  gov: [SRC.tb509('§4.6, Fig 4.10 governor'), SRC.supp509('governor: centrifugal type, regulation, hunting')],
}

const INFO = {
  oilBath: { summary: 'Oil-bath air cleaner.', role: 'Air comes down the centre tube and turns sharply over the oil surface; heavy dust is thrown into the oil. The air then rises through an oil-wetted wire-mesh element that traps the fine dust. The dirt settles as sludge in the cup, which is cleaned and refilled to the mark.' },
  preCleaner: { summary: 'Pre-cleaner on top of the intake stack.', role: 'Screen and vanes stop straw, chaff and leaves and spin out the coarsest dust before the air reaches the cleaner.' },
  stack: { summary: 'Intake stack.', role: 'Takes air from high above the dusty layer near the ground and dashboard: measured dust falls from 0.565 g/m³ at the dashboard to 0.283 at 45 cm above it and 0.141 at 74 cm.' },
  mesh: { summary: 'Oil-wetted wire-mesh element.', role: 'Oil picked up from the bath wets the mesh; fine dust sticks to it and is washed back down into the cup.' },
  cup: { summary: 'Oil cup (bath) with the inner baffle cup.', role: 'Holds the oil at the level mark. Too little oil and dust gets through; too much and oil is drawn into the engine.' },
  dry: { summary: 'Dry (paper element) air cleaner.', role: 'Air enters tangentially and swirls round the baffle so heavy dust is flung to the wall and falls into the dust cup; the air then passes inwards through the pleated paper element to the outlet.' },
  pleats: { summary: 'Pleated paper element.', role: 'Pleating gives a large filter area in a small space; it is replaced (or blown out from the inside) when it clogs.' },
  dustCup: { summary: 'Dust cup with rubber unloader valve.', role: 'Collects the spun-out dust; the unloader valve lets it fall out when the engine stops.' },
  governor: { summary: 'Centrifugal (flyweight) governor.', role: 'Keeps the engine speed nearly constant as the load changes by moving the injection-pump rack (or the throttle on a petrol engine) automatically.' },
  flyweights: { summary: 'Flyweights (bell cranks) on the carrier.', role: 'Centrifugal force swings them out as the speed rises; their toes push the thrust sleeve along the spindle against the governor spring.' },
  sleeve: { summary: 'Thrust sleeve (collar).', role: 'Slides on the spindle; its position — set by the balance of flyweight force and spring force — is passed to the fuel control by the fork lever.' },
  spring: { summary: 'Governor spring.', role: 'Opposes the flyweights. The speed-control lever changes its compression and so the speed the governor holds.' },
  fork: { summary: 'Fork (governor) lever and control rod.', role: 'Turns sleeve movement into rack movement: sleeve out (engine fast) pulls the rack towards stop; sleeve in (engine slow) gives more fuel.' },
  speedLever: { summary: 'Speed-control (hand throttle) lever.', role: 'Sets the spring compression, i.e. the engine speed the governor will hold.' },
  rack: { summary: 'Injection-pump control rack (stub).', role: 'Sets the fuel delivered per stroke (see the Diesel fuel system scene).' },
  engine: { summary: 'Engine (stub): crankshaft, timing gears, flywheel.', role: 'The crankshaft gear drives the governor spindle gear at half engine speed (30 : 60 teeth).' },
  brake: { summary: 'Brake drum with a weighted arm (prony-type load).', role: 'Applies the load torque: the bigger the hanging weight, the bigger the load. A load step makes the engine slow down until the governor adds fuel.' },
}

export function AirGov3D() {
  const g = buildAirGovGeometry()
  const flows = useAirGov((s) => s.flows)
  const height = useAirGov((s) => s.height)
  const crank = useRef(0)
  const histAcc = useRef(0)
  const crankRef = useRef<THREE.Group>(null)
  const spindleRef = useRef<THREE.Group>(null)
  const fw = useRef<(THREE.Group | null)[]>([])
  const sleeveRef = useRef<THREE.Group>(null)
  const springRef = useRef<THREE.Mesh>(null)
  const seatRef = useRef<THREE.Group>(null)
  const forkRef = useRef<THREE.Group>(null)
  const leverRef = useRef<THREE.Group>(null)
  const rackRef = useRef<THREE.Group>(null)
  const rodRef = useRef<THREE.Mesh>(null)
  const weightRef = useRef<THREE.Mesh>(null)
  const oilRef = useRef<THREE.Mesh>(null)

  const top = DASH_Y + height
  const P = useMemo(() => {
    const x = OB.x
    const side = (s: number) =>
      curve([V(x, top + 0.06), V(x, top - 0.02), V(x, OB.tubeTop), V(x, 0.12), V(x + s * 0.012, 0.085), V(x + s * 0.045, 0.074), V(x + s * 0.068, 0.09), V(x + s * 0.07, 0.15), V(x + s * 0.064, 0.27), V(x + s * 0.05, 0.29), V(x + 0.085, 0.287), V(x + 0.17, 0.285)])
    const caught = (s: number) => curve([V(x, top + 0.06), V(x, OB.tubeTop), V(x, 0.11), V(x + s * 0.02, 0.08), V(x + s * 0.045, 0.062), V(x + s * 0.06, 0.035)])
    const dx = DR.x
    const swirl: THREE.Vector3[] = [V(dx - 0.046, 0.215, -0.13), V(dx - 0.046, 0.215, -0.04)]
    for (let i = 0; i <= 24; i++) {
      const a = PI + (i / 24) * 3 * PI
      swirl.push(V(dx + 0.067 * Math.cos(a), 0.212 - (i / 24) * 0.09, -0.067 * Math.sin(a)))
    }
    const dryAir = curve([...swirl, V(dx + 0.045, 0.12, 0), V(dx + 0.02, 0.14, 0), V(dx, 0.16, 0), V(dx, 0.25, 0), V(dx, 0.32, 0)])
    const dryDust = curve([...swirl.slice(0, 16), V(dx + 0.06, 0.09, 0.02), V(dx + 0.055, 0.03, 0.01), V(dx + 0.04, 0.01, 0)])
    return { oil: [side(1), side(-1)], caught: [caught(1), caught(-1)], dryAir, dryDust }
  }, [top])

  useSimFrame((dt) => {
    const st = useAirGov.getState()
    const set = settings(st)
    live.state = governorStep(G, E, set, live.state, dt)
    live.t += dt
    const { w, x } = live.state
    const rpm = (w * 30) / PI
    histAcc.current += dt
    if (histAcc.current >= 0.005) {
      histAcc.current = 0
      pushHistory(live.t, rpm, fuelFraction(G, x) * 100)
    }
    crank.current += w * dt
    crankRef.current?.rotation.set(crank.current, 0, 0)
    spindleRef.current?.rotation.set(-crank.current * G.ratio, 0, 0)
    const phi = flyweightAngle(G, x)
    for (const f of fw.current) f?.rotation.set(0, 0, phi)
    const sx = GOV.pivotX + GOV.roller + x
    sleeveRef.current?.position.set(sx, GY, 0)
    const s0 = preload(st.setRpm)
    const seatX = GOV.pivotX + GOV.roller + GOV.sleeveLen + GOV.springFree - s0
    seatRef.current?.position.set(seatX, GY, 0)
    if (springRef.current) {
      springRef.current.position.set(sx + GOV.sleeveLen, GY, 0)
      springRef.current.scale.set(seatX - (sx + GOV.sleeveLen), 1, 1)
    }
    const theta = Math.asin(Math.min(1, x / GOV.forkLen))
    forkRef.current?.rotation.set(0, 0, theta)
    const topX = GOV.forkPivot.x - GOV.forkTop * Math.sin(theta)
    const rodLen = 0.068
    rackRef.current?.position.set(topX - rodLen, GY + 0.145, 0)
    if (rodRef.current) {
      rodRef.current.position.set(topX - rodLen, GY + 0.145, 0)
      rodRef.current.scale.set(rodLen, 1, 1)
    }
    const psi = Math.asin(Math.max(-1, Math.min(1, (seatX + 0.015 - GOV.leverPivot.x) / 0.085)))
    leverRef.current?.rotation.set(0, 0, psi)
    if (weightRef.current) {
      const s = 0.018 + 0.05 * Math.cbrt(Math.max(0, st.load) / 260)
      weightRef.current.scale.set(s, s, s)
      weightRef.current.position.set(0.502, CRANK_Y - 0.02 - s / 2, 0.33)
    }
    if (oilRef.current) oilRef.current.scale.set(1, Math.max(0.002, 0.056 * st.oilLevel), 1)
  })

  const airK = (kind: 'oil-bath' | 'dry') => () => (useAirGov.getState().cleaner === kind ? Math.min(1, (live.state.w * 30) / PI / 2000) : 0)
  const dustK = (kind: 'oil-bath' | 'dry', pass: boolean) => () => {
    const st = useAirGov.getState()
    if (st.cleaner !== kind) return 0
    const d = dust(st, (live.state.w * 30) / PI)
    const k = Math.min(1, d.C / 0.565)
    return pass ? Math.min(1, (1 - d.eff) * 12) * k : k
  }
  const stackLen = top - OB.tubeTop + 0.004

  return (
    <group>
      {/* ======================== air cleaners ======================== */}
      <Part id="air-cleaners" name="Air cleaners" role="housing" material="paintBlack" info={{ summary: 'Oil-bath (left) and dry-element (right) air cleaners.' }} cites={C.air}>
        <Part id="oil-bath" name="Oil-bath air cleaner" material="paintBlack" role="housing" info={INFO.oilBath} cites={C.air}>
          <PartMesh geometry={g.obBody} />
          <Part id="ob-tube" name="Centre (inlet) tube" material="galvanised" role="static">
            <PartMesh geometry={g.obTube} />
          </Part>
          <Part id="ob-mesh" name="Wire-mesh element" material="galvanised" role="static" info={INFO.mesh} cites={C.air}>
            <PartMesh geometry={g.obMesh} />
            <PartMesh geometry={g.obTray} material="steelDark" />
          </Part>
          <Part id="ob-cup" name="Oil cup" material="paintGrey" role="housing" info={INFO.cup} cites={C.air} explode={[0, -0.12, 0]}>
            <PartMesh geometry={g.obCup} />
            <PartMesh geometry={g.obBaffle} material="galvanised" />
            <PartMesh geometry={g.obClamps} material="steel" />
            <Part id="ob-oil" name="Oil bath" material="oil" role="fluid" info={{ summary: 'Engine oil in the bath, filled to the level mark.' }}>
              <PartMesh ref={oilRef} geometry={g.obOil} position={[OB.x, 0.004, 0]} />
            </Part>
            <Part id="ob-sludge" name="Dust sludge" material="soil" role="fluid" info={{ summary: 'Dust trapped by the oil settles as sludge.' }}>
              <PartMesh geometry={g.obSludge} position={[OB.x, 0.004, 0]} scale={[0.99, 0.004, 0.99]} />
            </Part>
          </Part>
          <Part id="intake-stack" name="Intake stack" material="paintBlack" role="static" info={INFO.stack} cites={C.dust}>
            <PartMesh geometry={g.stack} position={[OB.x, OB.tubeTop - 0.004, 0]} scale={[1, stackLen, 1]} />
          </Part>
          <Part id="pre-cleaner" name="Pre-cleaner" material="paintBlack" role="static" info={INFO.preCleaner} cites={C.air} explode={[0, 0.08, 0]}>
            <group position={[OB.x, top, 0]}>
              <PartMesh geometry={g.cap} />
              <PartMesh geometry={g.screen} material="galvanised" />
              <PartMesh geometry={g.vanes} material="steelDark" />
            </group>
          </Part>
          <Part id="dash-level" name="Dashboard level" material="glass" role="static" cut={false} info={{ summary: 'Reference height of the dashboard (dust survey datum).' }} cites={C.dust}>
            <PartMesh geometry={g.dash} position={[0, DASH_Y, 0]} />
          </Part>
        </Part>
        <Part id="dry-cleaner" name="Dry element air cleaner" material="paintGrey" role="housing" info={INFO.dry} cites={C.air} explode={[0.04, 0, 0]}>
          <PartMesh geometry={g.dryHousing} />
          <Part id="dry-element" name="Pleated paper element" material="nylon" role="static" info={INFO.pleats} cites={C.air} explode={[0, 0.12, 0]}>
            <PartMesh geometry={g.pleats} />
            <PartMesh geometry={g.dryCaps} material="plastic" />
            <PartMesh geometry={g.dryInner} material="galvanised" />
          </Part>
          <Part id="dry-baffle" name="Baffle" material="galvanised" role="static" info={{ summary: 'Baffle skirt.', role: 'Makes the swirling air run down the wall first, so heavy dust is thrown out before the air reaches the element.' }} cites={C.air}>
            <PartMesh geometry={g.dryBaffle} />
            <PartMesh geometry={g.dryOutlet} />
          </Part>
          <Part id="dust-cup" name="Dust cup & unloader" material="paintGrey" role="housing" info={INFO.dustCup} cites={C.air} explode={[0, -0.1, 0]}>
            <PartMesh geometry={g.dryCup} />
            <PartMesh geometry={g.unloader} material="rubber" />
            <Part id="dry-dust" name="Collected dust" material="soil" role="fluid">
              <PartMesh geometry={g.dryDust} position={[DR.x, 0.004, 0]} scale={[1, 0.008, 1]} />
            </Part>
          </Part>
        </Part>
        {flows ? (
          <>
            {P.oil.map((c, i) => (
              <Flow key={`a${i}`} curve={c} count={70} radius={0.003} color="#7fc4f0" speed={0.25} spread={0.014} intensity={airK('oil-bath')} />
            ))}
            {P.caught.map((c, i) => (
              <Flow key={`d${i}`} curve={c} count={26} radius={0.0022} color="#a5784a" speed={0.3} spread={0.01} intensity={dustK('oil-bath', false)} />
            ))}
            <Flow curve={P.oil[0]} count={10} radius={0.0022} color="#a5784a" speed={0.25} spread={0.01} intensity={dustK('oil-bath', true)} />
            <Flow curve={P.dryAir} count={90} radius={0.0028} color="#7fc4f0" speed={0.2} spread={0.012} intensity={airK('dry')} />
            <Flow curve={P.dryDust} count={30} radius={0.0022} color="#a5784a" speed={0.22} spread={0.006} intensity={dustK('dry', false)} />
            <Flow curve={P.dryAir} count={8} radius={0.0022} color="#a5784a" speed={0.2} spread={0.012} intensity={dustK('dry', true)} />
          </>
        ) : null}
      </Part>

      {/* ======================== governor ======================== */}
      <Part id="governor-rig" name="Governed engine" role="housing" material="castIron" info={INFO.governor} cites={C.gov}>
        <Part id="engine-stub" name="Engine (stub)" material="castIron" role="housing" info={INFO.engine} cites={C.gov}>
          <PartMesh geometry={g.block} />
        </Part>
        <Part id="crankshaft" name="Crankshaft, gear & flywheel" material="forged" role="moving" info={INFO.engine} cites={C.gov}>
          <group ref={crankRef} position={[0, CRANK_Y, 0]}>
            <PartMesh geometry={g.crank} material="castIron" />
            <PartMesh geometry={g.drum} material="steelDark" />
            <PartMesh geometry={g.crankGear} material="steelDark" position={[GOV.gearX, 0, 0]} />
          </group>
        </Part>
        <Part id="brake" name="Brake load (weighted arm)" material="paintYellow" role="static" cut={false} info={INFO.brake} cites={[SRC.tests502('dynamometers')]} beyondNotes>
          <PartMesh geometry={g.brake} />
          <PartMesh ref={weightRef} geometry={g.weight} material="castIron" />
        </Part>
        <Part id="governor-housing" name="Governor housing" material="castIron" role="housing" info={INFO.governor} cites={C.gov} explode={[0, 0, -0.16]}>
          <PartMesh geometry={g.govHousing} />
        </Part>
        <Part id="spindle" name="Spindle, drive gear & carrier" material="steel" role="moving" info={{ summary: 'Governor spindle with its drive gear (60 teeth) and flyweight carrier.', role: 'Gear-driven from the crankshaft at half engine speed.' }} cites={C.gov}>
          <group ref={spindleRef} position={[0, GY, 0]}>
            <PartMesh geometry={g.spindle} />
            <PartMesh geometry={g.govGear} material="steelDark" />
            <PartMesh geometry={g.carrier} material="forged" />
            <Part id="flyweights" name="Flyweights" material="forged" role="moving" info={INFO.flyweights} cites={C.gov} explode={[0, 0, 0.1]}>
              {[0, PI].map((a, i) => (
                <group key={i} rotation={[a, 0, 0]}>
                  <group ref={(o) => void (fw.current[i] = o)} position={[GOV.pivotX, G.rp, 0]}>
                    <PartMesh geometry={g.flyweight} />
                    <PartMesh geometry={g.roller} material="steel" />
                  </group>
                </group>
              ))}
            </Part>
          </group>
        </Part>
        <Part id="sleeve" name="Thrust sleeve" material="bronze" role="moving" info={INFO.sleeve} cites={C.gov} explode={[0, 0, 0.08]}>
          <group ref={sleeveRef}>
            <PartMesh geometry={g.sleeve} />
          </group>
        </Part>
        <Part id="gov-spring" name="Governor spring & seat" material="steelDark" role="moving" cut={false} info={INFO.spring} cites={C.gov} explode={[0, 0, 0.1]}>
          <PartMesh ref={springRef} geometry={g.govSpring} />
          <group ref={seatRef}>
            <PartMesh geometry={g.springSeat} material="steel" />
          </group>
        </Part>
        <Part id="fork-lever" name="Fork lever & control rod" material="forged" role="moving" info={INFO.fork} cites={C.gov} explode={[0, 0.06, 0]}>
          <group ref={forkRef} position={[GOV.forkPivot.x, GOV.forkPivot.y, 0]}>
            <PartMesh geometry={g.forkLever} />
          </group>
          <PartMesh ref={rodRef} geometry={g.rod} material="steel" />
        </Part>
        <Part id="speed-lever" name="Speed-control lever" material="paintRed" role="moving" info={INFO.speedLever} cites={C.gov} explode={[0, 0.06, 0]}>
          <group ref={leverRef} position={[GOV.leverPivot.x, GOV.leverPivot.y, 0]}>
            <PartMesh geometry={g.speedLever} />
          </group>
        </Part>
        <Part id="pump-rack" name="Injection pump & rack (stub)" material="aluminium" role="housing" info={INFO.rack} cites={[SRC.tb509('§4.5.3 control rack')]}>
          <PartMesh geometry={g.pump} />
          <Part id="rack" name="Control rack" material="steel" role="moving" info={INFO.rack}>
            <group ref={rackRef}>
              <PartMesh geometry={g.rack} />
            </group>
          </Part>
        </Part>
      </Part>

      <PartLabel partId="oil-bath" at={[OB.x - 0.1, 0.22, 0.06]} />
      <PartLabel partId="pre-cleaner" at={[OB.x + 0.07, top + 0.06, 0]} />
      <PartLabel partId="dash-level" at={[OB.x + 0.2, DASH_Y + 0.01, 0.1]} />
      <PartLabel partId="ob-cup" at={[OB.x + 0.1, 0.04, 0.06]} />
      <PartLabel partId="dry-cleaner" at={[DR.x + 0.05, 0.3, 0.05]} />
      <PartLabel partId="flyweights" at={[0.25, GY + 0.07, 0.04]} />
      <PartLabel partId="sleeve" at={[0.22, GY - 0.03, 0.03]} />
      <PartLabel partId="gov-spring" at={[0.28, GY - 0.03, 0.03]} />
      <PartLabel partId="speed-lever" at={[0.33, GY + 0.19, 0]} />
      <PartLabel partId="fork-lever" at={[0.2, GY + 0.16, 0]} />
      <PartLabel partId="rack" at={[0.06, GY + 0.18, 0.03]} />
      <PartLabel partId="brake" at={[0.53, CRANK_Y + 0.13, 0.3]} />
    </group>
  )
}
