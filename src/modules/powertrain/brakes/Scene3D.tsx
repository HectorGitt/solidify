import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { DriveGraph } from '@/core/drive'
import { useSimFrame } from '@/core/sim'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { CAM_Y, LINES, SHOE_PIVOT, brakeGeometry } from './geometry'
import { DISC, PEDALS, brakeTorque, live, pedalTravel, useBrakes } from './model'

const { PI } = Math
const rpmToRad = (n: number) => (n * 2 * PI) / 60

/** Shared animation state (written by the physics step at priority −1). */
const anim = { theta: 0, engage: 0, travelL: 0, travelR: 0 }

const C = {
  shoe: [SRC.tts510('p11–12 Fig 36'), SRC.m503(9, 'internal expanding shoe')],
  disc: [SRC.tts510('p12–13 Fig 37'), SRC.top510('p9 Fig A2.14')],
  wet: [SRC.top510('p9 wet multi-plate; p10 Fig A2.15')],
  pedals: [SRC.tts510('p13 hydraulic brakes, balancing valve, turning brakes')],
}

const INFO = {
  shoe: {
    drum: { summary: 'Brake drum, bolted to the wheel or shaft.', role: 'Rotates; the shoes press outward against its inside.' },
    back: { summary: 'Back plate.', role: 'Stationary; carries the shoe anchor pins, the cam and the adjuster.' },
    shoes: { summary: 'Two brake shoes with friction linings.', role: 'Pivot on anchor pins at the bottom; the cam spreads their top ends so the linings grip the drum. The leading shoe is self-energising: drum friction helps press it on.' },
    cam: { summary: 'Brake cam.', role: 'Turned by the pedal linkage, it forces the shoe tips apart.' },
    springs: { summary: 'Return springs.', role: 'Pull the shoes back off the drum when the pedal is released.' },
    adjuster: { summary: 'Adjuster.', role: 'Takes up lining wear so the pedal travel stays correct.' },
  },
  disc: {
    housing: { summary: 'Disc-brake housing.', role: 'Its smooth inner face is one of the two outer friction faces (the cover is the other).' },
    rotors: { summary: 'Two rotating discs, lined on both faces, splined to the drive shaft.', role: 'Turn with the half shaft; clamped between the expander and the housing/cover to brake it.' },
    expander: { summary: 'Expander: two actuating discs with steel balls in tapered grooves.', role: 'The pedal link turns the two discs in opposite directions; the balls ride up their ramps and force the discs apart, clamping the rotating discs. Self-energising: once gripping, friction drags the discs further round. The degree depends on the friction coefficient and the ball-seat angle.' },
    balls: { summary: 'Steel balls in the tapered grooves.', role: 'Turn relative rotation of the actuating discs into an axial thrust.' },
    springs: { summary: 'Extension springs.', role: 'Hold the actuating discs together and return them when the pedal is released.' },
    link: { summary: 'Actuating link and operating-rod yoke.', role: 'Connect the pedal (or a small hydraulic cylinder) to the expander.' },
  },
  wet: {
    housing: { summary: 'Brake housing in the axle (oil-filled).', role: 'Protects the brake from dirt and water; the oil carries away the heat — wet brakes are very reliable.' },
    discs: { summary: 'Sintered-metal friction discs, splined to the half shaft.', role: 'Rotate between the steel plates; designed to absorb large amounts of energy.' },
    plates: { summary: 'Steel plates, splined to the housing.', role: 'Stationary plates between the friction discs.' },
    piston: { summary: 'Annular brake piston.', role: 'Brake-line pressure pushes it to clamp the pack: F = p·A, T = n·μ·F·R.' },
    oil: { summary: 'Transmission oil.', role: 'Brake fluid behind the piston; cooling oil round the plates.' },
  },
  pedals: { summary: 'Left and right brake pedals.', role: 'Independent, so one rear wheel can be braked to help turn tightly in the field. Latched together for road work so both wheels brake evenly.' },
  latch: { summary: 'Pedal latch.', role: 'Locks the two pedals together for road travel.' },
  mc: { summary: 'Master cylinders, one per pedal.', role: 'Turn pedal force into brake-line pressure: p = F·i/A.' },
  valve: { summary: 'Balancing (compensating) valve.', role: 'When the pedals are latched it joins the two circuits so both brakes get the same pressure.' },
  lines: { summary: 'Brake lines.', role: 'Carry the pressure to the left and right brakes.' },
}

function ShoeBrake() {
  const g = brakeGeometry().shoe
  const drum = useRef<THREE.Group>(null)
  const shoeL = useRef<THREE.Group>(null)
  const shoeR = useRef<THREE.Group>(null)
  const cam = useRef<THREE.Group>(null)
  useSimFrame(() => {
    drum.current?.rotation.set(0, 0, anim.theta)
    // the cam pushes the shoe tips apart; each shoe swings outward about its anchor pin
    shoeL.current?.rotation.set(0, 0, 0.0145 * anim.engage)
    shoeR.current?.rotation.set(0, 0, -0.0145 * anim.engage)
    cam.current?.rotation.set(0, 0, 0.5 * anim.engage)
  })
  const I = INFO.shoe
  return (
    <Part id="shoe-brake" name="Internal expanding shoe brake" role="static" material="steel" cites={C.shoe}>
      <Part id="back-plate" name="Back plate" role="housing" material="paintBlack" info={I.back} cites={C.shoe} explode={[0, 0, -0.12]}>
        <PartMesh geometry={g.backPlate} />
        <PartMesh geometry={g.pins} material="steel" />
      </Part>
      <group ref={drum}>
        <Part id="drum" name="Brake drum & shaft" role="moving" material="castIron" info={I.drum} cites={C.shoe} explode={[0, 0, 0.16]}>
          <PartMesh geometry={g.drum} />
          <PartMesh geometry={g.shaft} material="forged" />
        </Part>
      </group>
      <Part id="shoes" name="Brake shoes & linings" role="moving" material="paintGrey" info={I.shoes} cites={C.shoe} explode={[0, 0.06, 0.06]}>
        {(['L', 'R'] as const).map((s) => {
          const piv = s === 'L' ? SHOE_PIVOT.left : SHOE_PIVOT.right
          const sh = s === 'L' ? g.shoeL : g.shoeR
          return (
            <group key={s} position={[piv.x, piv.y, 0]} ref={s === 'L' ? shoeL : shoeR}>
              <PartMesh geometry={sh.metal} />
              <PartMesh geometry={sh.lining} material="friction" />
            </group>
          )
        })}
      </Part>
      <Part id="cam" name="Brake cam & lever" role="moving" material="forged" info={I.cam} cites={C.shoe}>
        <group position={[0, CAM_Y, 0]} ref={cam}>
          <PartMesh geometry={g.cam} />
          <PartMesh geometry={g.camLever} />
        </group>
      </Part>
      <Part id="return-springs" name="Return springs" role="moving" material="steelDark" info={I.springs} cites={C.shoe} cut={false}>
        <PartMesh geometry={g.spring} position={[-0.045, 0.098, 0.012]} rotation={[0, PI / 2, 0]} scale={[1, 1, 0.09]} />
        <PartMesh geometry={g.spring} position={[-0.055, -0.088, 0.012]} rotation={[0, PI / 2, 0]} scale={[1, 1, 0.11]} />
      </Part>
      <Part id="adjuster" name="Adjuster" role="static" material="brass" info={I.adjuster} cites={C.shoe}>
        <PartMesh geometry={g.adjuster} />
      </Part>
    </Part>
  )
}

function DiscBrake() {
  const g = brakeGeometry().disc
  const shaft = useRef<THREE.Group>(null)
  const rotors = useRef<(THREE.Group | null)[]>([])
  const acts = useRef<(THREE.Group | null)[]>([])
  const springs = useRef<(THREE.Mesh | null)[]>([])
  useSimFrame(() => {
    const e = anim.engage
    const s = 0.004 * e
    shaft.current?.rotation.set(0, 0, anim.theta)
    rotors.current.forEach((r, i) => r?.position.setZ((i ? 1 : -1) * (0.023 + 0.002 * e)))
    acts.current.forEach((a, i) => {
      if (!a) return
      a.position.z = (i ? 1 : -1) * (0.0115 + s)
      a.rotation.z = (i ? 1 : -1) * 0.12 * e
    })
    springs.current.forEach((m) => {
      if (!m) return
      m.position.z = -0.0115 - s
      m.scale.z = 0.023 + 2 * s
    })
  })
  const I = INFO.disc
  return (
    <Part id="disc-brake" name="Dry disc brake (ball-ramp expander)" role="static" material="steel" cites={C.disc}>
      <Part id="disc-housing" name="Housing" role="housing" material="castIron" info={I.housing} cites={C.disc} explode={[0, 0, -0.14]}>
        <PartMesh geometry={g.housing} />
      </Part>
      <Part id="disc-cover" name="Cover" role="housing" material="paintGrey" info={I.housing} cites={C.disc} explode={[0, 0, 0.16]}>
        <PartMesh geometry={g.cover} />
      </Part>
      <group ref={shaft}>
        <Part id="disc-shaft" name="Splined drive shaft" role="moving" material="forged" info={{ summary: 'Splined half shaft.', role: 'The rotating discs slide on its splines.' }} cites={C.disc}>
          <PartMesh geometry={g.shaft} />
        </Part>
        <Part id="rotors" name="Rotating discs (lined)" role="moving" material="steel" info={I.rotors} cites={C.disc} explode={[0, 0, 0.08]}>
          {[0, 1].map((i) => (
            <group key={i} ref={(el) => void (rotors.current[i] = el)}>
              <PartMesh geometry={g.rotor} />
              <PartMesh geometry={g.rotorLining} material="friction" />
            </group>
          ))}
        </Part>
      </group>
      <Part id="expander" name="Expander (actuating discs)" role="moving" material="castIron" info={I.expander} cites={C.disc} explode={[0, 0.1, 0.02]}>
        {[0, 1].map((i) => (
          <group key={i} ref={(el) => void (acts.current[i] = el)}>
            <PartMesh geometry={g.act} />
          </group>
        ))}
        <Part id="balls" name="Steel balls" material="chrome" info={I.balls} cites={[SRC.top510('p9 Fig A2.14')]}>
          <PartMesh geometry={g.balls} />
        </Part>
        <Part id="disc-springs" name="Extension springs" material="steelDark" info={I.springs} cut={false}>
          {[-0.8, PI + 0.8].map((a, i) => (
            <PartMesh key={i} ref={(el: THREE.Mesh | null) => void (springs.current[i] = el)} geometry={g.spring} position={[0.105 * Math.cos(a), 0.105 * Math.sin(a), -0.0115]} />
          ))}
        </Part>
      </Part>
      <Part id="disc-link" name="Actuating link & yoke" role="moving" material="forged" info={I.link} cites={C.disc}>
        <PartMesh geometry={g.link} />
      </Part>
    </Part>
  )
}

function WetBrake() {
  const g = brakeGeometry()
  const w = g.wet
  const shaft = useRef<THREE.Group>(null)
  const discs = useRef<(THREE.Group | null)[]>([])
  const plates = useRef<(THREE.Group | null)[]>([])
  const piston = useRef<THREE.Group>(null)
  const pitch = 0.0075
  const z0 = -0.035
  const zLast = z0 + 8 * pitch
  useSimFrame(() => {
    const e = anim.engage
    const zAt = (k: number) => zLast - (zLast - (z0 + k * pitch)) * (1 - 0.07 * e)
    shaft.current?.rotation.set(0, 0, anim.theta)
    discs.current.forEach((d, i) => d?.position.setZ(zAt(2 * i + 1)))
    plates.current.forEach((p, i) => p?.position.setZ(zAt(2 * i)))
    piston.current?.position.setZ(-0.048 + (zAt(0) - z0))
  })
  const I = INFO.wet
  const coolLoop = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.15, -0.03), new THREE.Vector3(0.15, -0.05, -0.01), new THREE.Vector3(0.12, 0.1, 0.01), new THREE.Vector3(-0.1, 0.12, 0.02), new THREE.Vector3(-0.15, -0.06, 0.0), new THREE.Vector3(0, -0.15, -0.03)]), [])
  const feed = useMemo(() => new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.235, -0.058), new THREE.Vector3(0, 0.175, -0.058), new THREE.Vector3(0.03, 0.105, -0.058), new THREE.Vector3(0.09, 0.06, -0.058)]), [])
  return (
    <Part id="wet-brake" name="Wet multi-plate brake" role="static" material="steel" cites={C.wet}>
      <Part id="wet-housing" name="Brake housing" role="housing" material="castIron" info={I.housing} cites={C.wet} explode={[0, 0.2, 0]}>
        <PartMesh geometry={w.housing} />
        <Part id="wet-oil" name="Transmission oil" role="fluid" material="oil" info={I.oil} cites={C.wet}>
          <PartMesh geometry={g.sump} />
          <PartMesh geometry={w.chamberOil} material="hydraulicOil" />
        </Part>
      </Part>
      <group ref={shaft}>
        <Part id="wet-shaft" name="Half shaft & hub" role="moving" material="forged" info={{ summary: 'Half shaft with splined hub.', role: 'The friction discs are splined to the hub and turn with the shaft.' }} cites={C.wet}>
          <PartMesh geometry={w.shaft} />
          <PartMesh geometry={w.hub} />
        </Part>
        <Part id="wet-discs" name="Friction discs (sintered)" role="moving" material="bronze" info={I.discs} cites={C.wet} explode={[0, 0, 0.12]}>
          {[0, 1, 2, 3].map((i) => (
            <group key={i} ref={(el) => void (discs.current[i] = el)}>
              <PartMesh geometry={w.disc} />
            </group>
          ))}
        </Part>
      </group>
      <Part id="wet-plates" name="Steel plates" role="static" material="steelDark" info={I.plates} cites={C.wet} explode={[0, 0, 0.18]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <group key={i} ref={(el) => void (plates.current[i] = el)}>
            <PartMesh geometry={w.plate} />
          </group>
        ))}
      </Part>
      <Part id="wet-piston" name="Brake piston" role="moving" material="aluminium" info={I.piston} cites={C.wet} explode={[0, 0, -0.1]}>
        <group ref={piston} position={[0, 0, -0.048]}>
          <PartMesh geometry={w.piston} />
        </group>
      </Part>
      <Flow curve={coolLoop} count={40} radius={0.0035} color="#c98d22" speed={0.25} spread={0.03} intensity={() => 0.35 + 0.65 * Math.min(1, Math.abs(live.shaft) / 300)} />
      <Flow curve={feed} count={20} radius={0.004} color="#e0533a" speed={2} spread={0.004} intensity={() => anim.travelL} />
    </Part>
  )
}

/** Two pedals, latch, master cylinders, balancing valve and the brake lines. */
function Pedals() {
  const g = brakeGeometry()
  const p = g.pedals
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const latch = useRef<THREE.Group>(null)
  const rods = useRef<(THREE.Mesh | null)[]>([])
  const latched = useBrakes((s) => s.latched)
  useSimFrame(() => {
    const a = (t: number) => 0.32 * t
    armL.current?.rotation.set(0, 0, a(anim.travelL))
    armR.current?.rotation.set(0, 0, a(anim.travelR))
    latch.current?.rotation.set(0, 0, a(anim.travelL))
    ;[anim.travelL, anim.travelR].forEach((t, i) => {
      const m = rods.current[i]
      if (!m) return
      const ang = a(t)
      m.position.set(PEDALS.x + 0.06 * Math.sin(ang), PEDALS.pivotY - 0.06 * Math.cos(ang), (i ? -1 : 1) * PEDALS.z)
      m.scale.y = 0.1
    })
  })
  return (
    <Part id="pedal-unit" name="Brake pedals & hydraulics" role="static" material="steel" info={INFO.pedals} cites={C.pedals} explode={[0.15, 0, 0]}>
      <Part id="pedals" name="Left & right pedals" role="moving" material="paintBlack" info={INFO.pedals} cites={C.pedals}>
        <PartMesh geometry={p.pivot} material="steel" position={[PEDALS.x, PEDALS.pivotY, 0]} />
        <group position={[PEDALS.x, PEDALS.pivotY, PEDALS.z]} ref={armL}>
          <PartMesh geometry={p.arm} />
        </group>
        <group position={[PEDALS.x, PEDALS.pivotY, -PEDALS.z]} ref={armR}>
          <PartMesh geometry={p.arm} />
        </group>
        {[0, 1].map((i) => (
          <PartMesh key={i} ref={(el: THREE.Mesh | null) => void (rods.current[i] = el)} geometry={g.unitRod} material="steel" rotation={[0, 0, -PI / 2]} />
        ))}
      </Part>
      {latched ? (
        <Part id="latch" name="Pedal latch" role="moving" material="paintRed" info={INFO.latch} cites={C.pedals} cut={false}>
          <group position={[PEDALS.x, PEDALS.pivotY, 0]} ref={latch}>
            <PartMesh geometry={p.latch} />
          </group>
        </Part>
      ) : null}
      <Part id="master-cylinders" name="Master cylinders" role="housing" material="aluminium" info={INFO.mc} cites={C.pedals}>
        <PartMesh geometry={p.mc} position={[PEDALS.mcX, PEDALS.mcY, PEDALS.z]} />
        <PartMesh geometry={p.mc} position={[PEDALS.mcX, PEDALS.mcY, -PEDALS.z]} />
      </Part>
      <Part id="balancing-valve" name="Balancing valve" role="housing" material="brass" info={INFO.valve} cites={C.pedals}>
        <PartMesh geometry={p.valve} position={[PEDALS.mcX + 0.085, PEDALS.mcY, 0]} />
      </Part>
      <Part id="brake-lines" name="Brake lines" role="static" material="copper" info={INFO.lines} cites={C.pedals} cut={false}>
        <PartMesh geometry={g.lineL} />
        <PartMesh geometry={g.lineR} />
      </Part>
      <Flow curve={LINES.left} count={24} radius={0.0035} color="#e0533a" speed={1.5} spread={0.002} intensity={() => anim.travelL} />
      <Flow curve={LINES.right} count={20} radius={0.0035} color="#e0533a" speed={1.5} spread={0.002} intensity={() => anim.travelR} />
    </Part>
  )
}

export function Brakes3D() {
  const type = useBrakes((s) => s.type)
  const graph = useMemo(() => {
    const d = new DriveGraph()
    d.body('shaft')
    return d
  }, [])
  const omega = useRef(rpmToRad(useBrakes.getState().shaftRpm))
  useSimFrame((dt) => {
    const st = useBrakes.getState()
    const tr = pedalTravel(st)
    const T = brakeTorque(st).T
    const target = rpmToRad(st.shaftRpm)
    // brake decelerates the shaft (effective inertia of tractor + shaft, typical); released: back to speed
    if (tr.left > 0.02) omega.current = Math.max(0, omega.current - (T / 25) * dt)
    else omega.current = Math.min(target, omega.current + 20 * dt)
    graph.drive('shaft', omega.current)
    graph.step(dt)
    anim.theta = graph.get('shaft').theta
    anim.travelL = tr.left
    anim.travelR = tr.right
    anim.engage = Math.min(1, tr.left * 4)
    live.shaft = (graph.get('shaft').omega * 60) / (2 * PI)
  }, -1)
  return (
    <group>
      {type === 'shoe' ? <ShoeBrake /> : type === 'disc' ? <DiscBrake /> : <WetBrake />}
      <Pedals />
      {type === 'shoe' ? (
        <>
          <PartLabel partId="drum" at={[0.12, 0.13, 0.05]} />
          <PartLabel partId="shoes" at={[-0.1, -0.02, 0.03]} />
          <PartLabel partId="cam" at={[0, CAM_Y + 0.03, 0.03]} />
          <PartLabel partId="return-springs" at={[0, 0.085, 0.03]} />
          <PartLabel partId="back-plate" at={[0.12, -0.12, -0.05]} />
          <PartLabel partId="adjuster" at={[-0.07, 0.14, -0.03]} />
        </>
      ) : type === 'disc' ? (
        <>
          <PartLabel partId="disc-housing" at={[0.13, -0.12, -0.04]} />
          <PartLabel partId="rotors" at={[0.11, 0.06, 0.03]} />
          <PartLabel partId="expander" at={[-0.1, 0.06, 0.0]} />
          <PartLabel partId="balls" at={[DISC.rBall, 0.02, 0.01]} />
          <PartLabel partId="disc-link" at={[0.02, 0.25, 0]} />
          <PartLabel partId="disc-cover" at={[-0.1, -0.1, 0.05]} />
        </>
      ) : (
        <>
          <PartLabel partId="wet-discs" at={[0.12, 0.05, 0.0]} />
          <PartLabel partId="wet-plates" at={[0.15, -0.04, 0.02]} />
          <PartLabel partId="wet-piston" at={[0.1, 0.1, -0.05]} />
          <PartLabel partId="wet-oil" at={[0, -0.16, 0.04]} />
          <PartLabel partId="wet-housing" at={[-0.15, 0.13, 0.05]} />
        </>
      )}
      <PartLabel partId="pedals" at={[PEDALS.x - 0.03, PEDALS.pivotY - PEDALS.arm - 0.02, 0.08]} />
      <PartLabel partId="master-cylinders" at={[PEDALS.mcX, PEDALS.mcY + 0.04, 0.08]} />
      <PartLabel partId="balancing-valve" at={[PEDALS.mcX + 0.1, PEDALS.mcY - 0.03, 0]} />
    </group>
  )
}
