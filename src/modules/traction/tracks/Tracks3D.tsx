import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { box } from '@/geometry'
import { useSimFrame } from '@/core/sim'
import { toothEngaged } from '@/physics/tyres'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { InstancedPartMesh } from './InstancedPartMesh'
import { CHAIN, DIM, MISALIGN, RS, SHOES, TT, YC, YI, YS, ROLLER_Y, live, trackPath, trackState, useTracks } from './model'
import {
  BOLT_OFFSETS,
  FRAME,
  adjusterGeometry,
  boltGeometry,
  bushingGeometry,
  carrierPostGeometry,
  frameGeometry,
  groundGeometry,
  guardGeometry,
  idlerGeometry,
  imprintGeometry,
  linkGeometry,
  masterPinGeometry,
  pinGeometry,
  rodGeometry,
  rollerGeometry,
  shoeGeometry,
  shoeReach,
  springGeometry,
  sprocketGeometry,
  yokeGeometry,
} from './trackParts'

const { PI } = Math
const N = CHAIN.links
const AXIS_Y = 0.46
const SPRING_X0 = -0.1
const SPRING_L0 = 0.55
const IMPRINTS = 28
const IMPRINT_SPAN = IMPRINTS * DIM.pitch

const beyond = 'Dimensions are typical of a 50–60 kW crawler.'

export function Tracks3D() {
  const shoe = useTracks((s) => s.shoe)
  const chain = useTracks((s) => s.chain)
  const misalign = useTracks((s) => s.misalign)
  const adjust = useTracks((s) => s.adjust)
  const ts = useMemo(() => trackState(adjust), [adjust])

  const g = useMemo(
    () => ({
      link: linkGeometry(),
      pin: pinGeometry(),
      master: masterPinGeometry(),
      bolt: boltGeometry(),
      sprocket: sprocketGeometry(),
      idler: idlerGeometry(),
      roller: rollerGeometry(DIM.rollerR),
      carrier: rollerGeometry(DIM.carrierR),
      frame: frameGeometry(),
      post: carrierPostGeometry(YC),
      guards: guardGeometry(),
      spring: springGeometry(),
      adjuster: adjusterGeometry(),
      rod: rodGeometry(),
      yoke: yokeGeometry(),
      ground: groundGeometry(),
      imprint: imprintGeometry(),
      mark: box(0.03, 0.012, 0.075),
      anchor: box(0.02, 0.18, 0.2),
    }),
    [],
  )
  const bushing = useMemo(() => bushingGeometry(chain), [chain])
  const shoeGeo = useMemo(() => shoeGeometry(shoe), [shoe])
  const groundTop = DIM.yb - shoeReach(shoe) + 0.004

  // sprocket phase so a seat sits on a bushing (seat 0 at the sprocket's local +x)
  const sprocketBase = useMemo(() => {
    const path = trackPath(ts)
    const a0 = path.segStart[1]
    const a1 = path.segStart[2]
    let k = Math.ceil(a0 / DIM.pitch)
    if (k * DIM.pitch > a1) k = Math.floor(a0 / DIM.pitch)
    return -PI / 2 - (k * DIM.pitch - a0) / RS
  }, [ts])

  const links = useRef<THREE.InstancedMesh>(null)
  const shoes = useRef<THREE.InstancedMesh>(null)
  const bushings = useRef<THREE.InstancedMesh>(null)
  const pins = useRef<THREE.InstancedMesh>(null)
  const bolts = useRef<THREE.InstancedMesh>(null)
  const imprints = useRef<THREE.InstancedMesh>(null)
  const master = useRef<THREE.Group>(null)
  const sprocketRef = useRef<THREE.Group>(null)
  const idlerSpin = useRef<THREE.Group>(null)
  const rollers = useRef<(THREE.Group | null)[]>([])
  const carrier = useRef<THREE.Group>(null)

  const tmp = useMemo(
    () => ({
      A: { x: 0, y: 0 },
      B: { x: 0, y: 0 },
      m: new THREE.Matrix4(),
      b: new THREE.Matrix4(),
      t: new THREE.Vector3(),
      n: new THREE.Vector3(),
      z: new THREE.Vector3(0, 0, 1),
      zero: new THREE.Matrix4().makeScale(0, 0, 0),
      o: new THREE.Object3D(),
    }),
    [],
  )

  useSimFrame((dt, time) => {
    const st = useTracks.getState()
    const v = st.speed / 3.6
    live.travel += v * dt
    const travel = live.travel
    // a loose track whips at speed (TT p53)
    const loose = ts.state === 'too loose' ? Math.min(1, (ts.sag2 / 0.0254 - 1.6) / 2 + 0.3) : 0
    const whip = 1 + loose * Math.min(0.7, 0.12 * st.speed) * Math.sin(2 * PI * (1.5 + 0.6 * st.speed) * time)
    live.whip = whip
    const path = trackPath(ts, whip)
    const { A, B, m, b, t, n, z, o } = tmp
    for (let k = 0; k < N; k++) {
      const s = k * DIM.pitch + travel
      path.at(s, A)
      path.at(s + DIM.pitch, B)
      t.set(B.x - A.x, B.y - A.y, 0).normalize()
      n.set(-t.y, t.x, 0)
      m.makeBasis(t, n, z).setPosition((A.x + B.x) / 2, (A.y + B.y) / 2, 0)
      links.current?.setMatrixAt(k, m)
      shoes.current?.setMatrixAt(k, m)
      bushings.current?.setMatrixAt(k, m)
      pins.current?.setMatrixAt(k, k === 0 ? tmp.zero : m)
      for (let j = 0; j < 4; j++) {
        const [bx, bz] = BOLT_OFFSETS[j]
        b.makeTranslation(bx, DIM.rail + (st.shoe === 'rubber' ? 0.03 : DIM.plateT), bz)
        bolts.current?.setMatrixAt(4 * k + j, b.premultiply(m))
      }
      if (k === 0 && master.current) {
        m.decompose(o.position, o.quaternion, o.scale)
        master.current.position.copy(o.position)
        master.current.quaternion.copy(o.quaternion)
      }
    }
    for (const im of [links.current, shoes.current, bushings.current, pins.current, bolts.current]) if (im) im.instanceMatrix.needsUpdate = true

    sprocketRef.current?.rotation.set(0, 0, sprocketBase - travel / RS)
    idlerSpin.current?.rotation.set(0, 0, -travel / DIM.idlerR)
    for (const r of rollers.current) r?.rotation.set(0, 0, -travel / DIM.rollerR)
    carrier.current?.rotation.set(0, 0, -travel / DIM.carrierR)

    if (imprints.current) {
      for (let i = 0; i < IMPRINTS; i++) {
        let x = (i * DIM.pitch - travel) % IMPRINT_SPAN
        if (x < 0) x += IMPRINT_SPAN
        o.position.set(x - IMPRINT_SPAN / 2 + 0.05, groundTop + 0.001, 0)
        o.quaternion.identity()
        o.scale.set(1, 1, 1)
        o.updateMatrix()
        imprints.current.setMatrixAt(i, o.matrix)
      }
      imprints.current.instanceMatrix.needsUpdate = true
    }
    const rev = Math.floor(travel / (2 * PI * RS))
    live.sprocketRev = rev
    live.toothEngaged = toothEngaged(DIM.teeth, 0, rev)
  })

  // tension mechanism layout (moves with the idler; the spring shortens only when the track is drawn too tight)
  const springL = SPRING_L0 - ts.springComp
  const cylX = SPRING_X0 + springL + 0.01 + 0.13
  const rodX0 = cylX + 0.13
  const rodL = Math.max(0.02, ts.xi - 0.28 - rodX0)
  const idlerRot: [number, number, number] = misalign === 'yaw' ? [0, 0.06, 0] : misalign === 'tilt' ? [0.06, 0, 0] : [0, 0, 0]
  const idlerZ = misalign === 'offset' ? 0.028 : 0
  const steel = 'Hardened steel.'

  return (
    <group>
      <Part id="undercarriage" name="Crawler undercarriage (one side)" role="housing" material="paintYellow" info={{ summary: 'One side of a crawler’s undercarriage: track, drive sprocket, rollers, front idler, tension mechanism, roller guards and frame — the seven basic parts.', role: 'Driven by the final drive, each side supports and moves the machine. Tracks are like roller chains with shoes.', details: 'Undercarriage = about 20 % of the purchase cost and 50 % of the service cost of a crawler. ' + beyond }} cites={[TT('p47–48, Figs 2–3'), TT('p51, Fig 8')]} beyondNotes>
        <Part id="track" name="Endless track" role="moving" material="forged" info={{ summary: `Endless chain of ${N} link sections with bolted shoes, pitch ${(DIM.pitch * 1000).toFixed(0)} mm.`, role: 'Each section is a pair of links joined by a bushing at one end and a pin at the other, both press-fitted so the section will not work apart; the pin turns inside the next section’s bushing.' }} cites={[TT('p48–49, Fig 4')]}>
          <Part id="links" name="Track links" material="forged" info={{ summary: 'Offset (cranked) track links, in pairs.', role: 'Form the chain and the rails that the rollers and idler run on. Inner halves hold the bushing, outer halves the pin.', details: steel }} cites={[TT('p49, Fig 4'), TT('p50, Fig 6')]}>
            <InstancedPartMesh ref={links} geometry={g.link} count={N} />
          </Part>
          <Part id="bushings" name={chain === 'interlocking' ? 'Bushings (interlocking)' : 'Bushings (flush)'} material="steel" info={{ summary: chain === 'interlocking' ? 'Interlocking chain: bushing ends extend into counterbores in the links.' : 'Flush chain: bushing ends are flush with the ends of the links.', role: chain === 'interlocking' ? 'Less abrasive enters between pin and bushing, and the larger pin–bushing contact area increases wear life.' : 'Simpler to build and to take apart.', details: 'The sprocket teeth drive on the bushings. Pins and bushings are hardened and need no lubrication.' }} cites={[TT('p49–50, Fig 6'), TT('p52')]}>
            <InstancedPartMesh ref={bushings} geometry={bushing} count={N} />
          </Part>
          <Part id="pins" name="Track pins" material="steelDark" info={{ summary: 'Plain track pins, press fit in the outer links.', role: 'Hinge each section to the next inside its bushing.', details: 'Too tight a track: friction between pins and bushings causes accelerated wear and heat — in extreme cases they fuse together.' }} cites={[TT('p49, Fig 4'), TT('p53')]}>
            <InstancedPartMesh ref={pins} geometry={g.pin} count={N} />
          </Part>
          <Part id="master-pin" name="Master pin & snap ring" material="chrome" info={{ summary: 'Master pin held by a snap ring.', role: 'The one pin on each track that can be driven out easily to separate (break) the track.' }} cites={[TT('p49, Fig 4')]}>
            <group ref={master}>
              <PartMesh geometry={g.master} />
            </group>
          </Part>
          <Part id="shoes" name={`Track shoes — ${SHOES[shoe].label}`} material={shoe === 'rubber' ? 'rubber' : 'steelDark'} info={{ summary: `${SHOES[shoe].label} shoes.`, role: SHOES[shoe].text, details: 'A shoe is bolted to each section; the grouser (grip) suits the terrain. Shoes should never be wider than needed for flotation.' }} cites={[TT('p49, Fig 5')]}>
            <InstancedPartMesh ref={shoes} geometry={shoeGeo} count={N} />
          </Part>
          <Part id="bolts" name="Shoe bolts & locking nuts" material="steel" info={{ summary: 'Shoe bolts.', role: 'Hold the shoes to the links. Check their tightness periodically with a torque wrench.' }} cites={[TT('p49, Fig 4'), TT('p51 — tips')]}>
            <InstancedPartMesh ref={bolts} geometry={g.bolt} count={4 * N} />
          </Part>
        </Part>

        <Part id="sprocket" name={`Drive sprocket (${DIM.teeth} teeth, hunting tooth)`} role="moving" material="forged" info={{ summary: `Hunting-tooth sprocket: ${DIM.teeth} teeth (odd) at half the chain pitch.`, role: 'Driven by the final drive, it transmits power to the track. Every other tooth engages a bushing; with an odd number of teeth each tooth meets a bushing only on alternate revolutions, so wear is even.', details: 'The yellow chalk mark sits on tooth 0 — compare its engagement with the Live readout. The sprocket is carried on its own axle from the final drive, not by the track frame.' }} cites={[TT('p50 — drive sprocket'), TT('p50 — frame')]}>
          <group ref={sprocketRef} position={[DIM.xs, YS, 0]}>
            <PartMesh geometry={g.sprocket} />
            <PartMesh geometry={g.mark} material="paintYellow" position={[(RS + 0.03) * Math.cos(PI / DIM.teeth), (RS + 0.03) * Math.sin(PI / DIM.teeth), 0]} rotation={[0, 0, PI / DIM.teeth - PI / 2]} />
          </group>
        </Part>

        <Part id="idler" name="Front idler" role="moving" material="castIron" info={{ summary: `Front idler — ${MISALIGN[misalign].label.toLowerCase()}.`, role: 'Supports the track as it turns at the front and, sliding on the frame against the recoil spring, keeps it in tension. Its centre flange runs between the links to guide them.', details: MISALIGN[misalign].text }} cites={[TT('p50 — front idler'), TT('p54, Figs 13–14')]}>
          <group position={[ts.xi, YI, idlerZ]} rotation={idlerRot}>
            <group ref={idlerSpin}>
              <PartMesh geometry={g.idler} />
            </group>
            <Part id="yoke" name="Idler yoke" role="static" material="paintYellow" info={{ summary: 'Idler yoke (bracket).', role: 'Carries the idler axle and slides on the track frame; shims between yoke and frame set the idler alignment.' }} cites={[TT('p54, Fig 13')]}>
              <PartMesh geometry={g.yoke} position={[0, 0, 0]} />
            </Part>
          </group>
        </Part>

        <Part id="track-rollers" name="Track rollers" role="moving" material="forged" info={{ summary: `${DIM.rollersX.length} track rollers on the bottom of the frame.`, role: 'Carry much of the machine’s weight. Small and close together, they spread the load evenly over the whole bottom of the track — great traction and flotation.', details: 'Rollers, carrier roller and idler may have grease fittings; some have lifetime seals.' }} cites={[TT('p50 — rollers'), TT('p52, Fig 10')]}>
          {DIM.rollersX.map((x, i) => (
            <group key={x} position={[x, ROLLER_Y, 0]} ref={(el) => {
              rollers.current[i] = el
            }}>
              <PartMesh geometry={g.roller} />
            </group>
          ))}
        </Part>
        <Part id="carrier" name="Carrier roller" role="moving" material="forged" info={{ summary: 'Carrier roller.', role: 'Supports the weight of the upper strand and stops it sagging, which would cause excessive whipping.', details: 'Track sag is measured halfway between the carrier roller and the front idler, with a pin and bushing centred over the carrier roller.' }} cites={[TT('p50 — rollers'), TT('p52, Fig 11')]}>
          <group ref={carrier} position={[DIM.xc, YC, 0]}>
            <PartMesh geometry={g.carrier} />
          </group>
          <PartMesh geometry={g.post} material="paintYellow" />
        </Part>

        <Part id="tension" name="Tension mechanism" role="static" material="steel" info={{ summary: 'Recoil spring plus a hydraulic (grease) adjuster.', role: 'The adjuster sets the track tension; the recoil spring gives constant but flexible tension and lets the idler recoil when rocks or packed mud are caught.', details: 'Grease in through the fitting tightens the track; turning the relief valve out lets grease escape and loosens it. Never grease the adjuster except when adjusting tension.' }} cites={[TT('p50 — tension mechanism'), TT('p52–53, Fig 11')]}>
          <Part id="recoil-spring" name="Recoil spring" material="steelDark" cut={false} info={{ summary: 'Recoil spring.', role: 'Provides constant but flexible tension through the idler and absorbs shocks. Mud packed in its coils restricts idler travel and recoil, overstressing links, recoil mechanism and final drives.' }} cites={[TT('p50'), TT('p52')]}>
            <PartMesh geometry={g.spring} position={[SPRING_X0, AXIS_Y, 0]} scale={[springL, 1, 1]} />
            <PartMesh geometry={g.anchor} material="paintYellow" position={[SPRING_X0 - 0.01, AXIS_Y, 0]} />
          </Part>
          <Part id="adjuster" name="Hydraulic track adjuster" material="steel" role="static" info={{ summary: 'Grease-filled adjuster cylinder with piston rod, grease fitting and relief valve.', role: 'Pumping grease in pushes the rod and idler forward (tighter); releasing grease lets them back (looser).', details: 'Use a gun that is not too high-pressure for the mechanism. If the piston will not move, free the seized parts.' }} cites={[TT('p52–53, Fig 11')]}>
            <PartMesh geometry={g.adjuster.body} position={[cylX, AXIS_Y, 0]} />
            <PartMesh geometry={g.adjuster.fitting} material="brass" position={[cylX, AXIS_Y, 0]} />
            <PartMesh geometry={g.rod} material="chrome" position={[rodX0, AXIS_Y, 0]} scale={[rodL, 1, 1]} />
          </Part>
        </Part>

        <Part id="guards" name="Roller guards" role="housing" material="paintYellow" info={{ summary: 'Roller guards.', role: 'Protect the rollers from rocks and obstructions, keep dirt and debris out of the track chain, and guide the track to stop twisting and buckling. Keep them in place, especially in rock.' }} cites={[TT('p50 — roller guards'), TT('p51')]}>
          <PartMesh geometry={g.guards} />
        </Part>
        <Part id="frame" name="Track frame" role="housing" material="paintYellow" info={{ summary: 'Track frame (box section).', role: 'Supports and holds the track components: the idler slides on it, the rollers and guards are mounted on it. The sprocket is not supported by the frame but by its own axle from the final drive.' }} cites={[TT('p50 — frame')]}>
          <PartMesh geometry={g.frame} />
        </Part>
      </Part>

      <Part id="ground" name="Ground" role="static" material="soil" cut={false} info={{ summary: 'Soil under the track; dark marks are grouser prints.', role: 'The bottom strand lies still on the ground while the machine rolls forward over it on the track rollers.' }}>
        <PartMesh geometry={g.ground} position={[0, groundTop - 0.06, 0]} />
        <instancedMesh ref={imprints} args={[g.imprint, undefined, IMPRINTS]} frustumCulled={false}>
          <meshStandardMaterial color="#2c2118" roughness={1} />
        </instancedMesh>
      </Part>

      <PartLabel partId="sprocket" at={[DIM.xs - 0.1, YS + RS + 0.12, 0.1]} />
      <PartLabel partId="idler" at={[ts.xi + 0.1, YI + DIM.idlerR + 0.12, 0.1]} />
      <PartLabel partId="carrier" at={[DIM.xc, YC + 0.2, 0.15]} />
      <PartLabel partId="track-rollers" at={[0.4, ROLLER_Y - 0.02, 0.3]} />
      <PartLabel partId="recoil-spring" at={[0.15, AXIS_Y + 0.12, 0.14]} />
      <PartLabel partId="adjuster" at={[cylX, AXIS_Y + 0.14, 0.14]} />
      <PartLabel partId="links" at={[-0.4, DIM.yb + 0.02, DIM.gauge + 0.05]} />
      <PartLabel partId="shoes" at={[0.6, DIM.yb - 0.07, DIM.shoeW / 2]} />
      <PartLabel partId="guards" at={[-0.6, FRAME.y0 - 0.06, 0.26]} />
      <PartLabel partId="frame" at={[0.3, FRAME.y1 + 0.03, 0.14]} />
    </group>
  )
}
