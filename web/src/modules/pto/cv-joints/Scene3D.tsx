import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { mat4, xform } from '@/geometry'
import { cvBallCentre, doubleHooke, rad, rpmToRad, tripodeSolve, type TripodeState } from '@/physics/joints'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { UJ as J, ujCross, ujCups, ujNeedles, ujSeals, ujYoke } from '@/parts/lib/driveline'
import { crossQuaternion, shaftGeometry, yawQuat } from '../shared/cardan'
import { HJ2 } from '../shared/cites'
import { frames, outBodyAngle, pins } from '../double-cardan/model'
import { CV } from './dims'
import { buildCVGeometry } from './geometry'
import { CV_CITES, TYPES, halfSpec, live, makeCVGraph, makeTwinGraph, useCVJ, type CVType } from './model'

const { PI } = Math
const X = new THREE.Vector3(1, 0, 0)

const INFO = {
  rzCup: { summary: 'Outer cup member on the stub shaft (input).', role: 'Its spherical inside carries six curved ball tracks.' },
  rzInner: { summary: 'Inner spherical member on the drive shaft (output).', role: 'Six matching curved tracks; the balls are sandwiched in the tunnels formed by each inner and outer track.' },
  rzCage: {
    summary: 'Ball cage.',
    role: 'Holds the six balls in the plane bisecting the shaft angle (median or homokinetic plane) — it tilts through half the joint angle. The Birfield joint also offsets the track centres (convergence just over 11°) so the tracks themselves steer the balls onto the median plane.',
    details: 'The balls creep slightly round their windows as the joint turns at an angle, so the windows are made longer than the balls.',
  },
  rzBalls: { summary: 'Six steel drive balls.', role: 'Transmit the torque in pure compression at a 45° pressure angle; they roll and slide about 4 : 1 along the tracks.' },
  weissYoke: { summary: 'Pronged yokes (two prongs each).', role: 'Each prong of one yoke sits between the prongs of the other; ball tracks are ground in the sides of the prongs.' },
  weissBalls: { summary: 'Four drive balls.', role: 'Each sits where a pair of crossing tracks intersect, which keeps it on the median (homokinetic) plane at half the working angle.' },
  weissCentre: { summary: 'Centralising (fifth) ball.', role: 'Locates the two yokes; straight-track versions without it allow some axial plunge.' },
  tractaJaw: { summary: 'Yoke jaw.', role: 'Engages a circular groove on its semispherical intermediate member, which can swivel relative to the jaw.' },
  tractaSpigot: { summary: 'Spigot (tongue) swivel — intermediate member.', role: 'Its tongue slides in the slotted swivel’s groove, at right angles to the jaw grooves, i.e. a quarter turn out of phase.' },
  tractaSlotted: { summary: 'Slotted swivel — intermediate member.', role: 'The input-side member speeds up and slows down; the quarter-turn phasing makes the output-side member cancel it, as in a double Hooke’s joint.' },
  triPot: { summary: 'Cylindrical pot member with three parallel roller grooves (input).', role: 'The rollers slide back and forth along the grooves once each revolution as the joint works at an angle; the pot also allows plunge.' },
  triSpider: { summary: 'Tripode spider on the drive shaft (output).', role: 'Three legs at 120° carry the rollers. At an angle its centre orbits the pot axis by a fraction of a millimetre, three times per revolution, so the drive stays constant-velocity.', details: 'The orbit is solved from the roller-in-groove conditions.' },
  triRollers: { summary: 'Semispherical rollers on needle rollers.', role: 'Roll in the pot grooves and swivel on the legs; good at high speed and low in noise and vibration.' },
  dcYokes: { summary: 'Outer yokes and central double yoke.', role: 'Two Hooke’s joints back to back. The central double yoke speeds up and slows down; the second half undoes the first.' },
  dcCross: { summary: 'Crosses with needle-roller cups.', role: 'One per half of the joint.' },
  dcCentre: { summary: 'Ball-and-socket centring device with preload spring.', role: 'Keeps the two halves at equal angles to the central yoke so the speed changes cancel.' },
}

export function CVJoints3D() {
  const g = buildCVGeometry()
  const type = useCVJ((s) => s.type)
  const deltaDeg = useCVJ((s) => s.delta)
  const d = rad(deltaDeg)

  const hw = useMemo(
    () => ({
      yoke: ujYoke(),
      cross: ujCross(),
      cups: ujCups(),
      needles: ujNeedles(),
      seals: ujSeals(),
      inShaft: shaftGeometry(-0.5, -J.hubEnd),
      outShaft: shaftGeometry(J.hubEnd, 0.4),
      weissOut: xform(g.weissYoke, mat4.c(mat4.rx(PI / 2), mat4.ry(PI))),
      tractaJaw: ujYoke(),
    }),
    [g],
  )

  const graphCV = useMemo(() => makeCVGraph(), [])
  const specRef = useRef(halfSpec(d))
  specRef.current = halfSpec(d)
  const graphTwin = useMemo(() => makeTwinGraph(() => specRef.current), [])
  const fr = useMemo(() => frames(halfSpec(d), 0), [d])
  const frDC = useMemo(() => frames(halfSpec(d), CV.dc.spacing), [d])
  const dcOffset = CV.dc.spacing / (2 * Math.cos(d / 2))

  const inRef = useRef<THREE.Group>(null)
  const outRef = useRef<THREE.Group>(null)
  const cageRef = useRef<THREE.Group>(null)
  const balls = useRef<(THREE.Mesh | null)[]>([])
  const aRef = useRef<THREE.Group>(null)
  const bRef = useRef<THREE.Group>(null)
  const midRef = useRef<THREE.Group>(null)
  const tri = useRef<TripodeState>({ phi: 0, cy: 0, cz: 0 })
  const prev = useRef({ th: 0, out: 0 })
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), r: new THREE.Quaternion(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), v: new THREE.Vector3() }), [])

  useSimFrame((dt) => {
    const s = useCVJ.getState()
    const dd = rad(s.delta)
    const w = rpmToRad(s.rpm)
    const twin = TYPES[s.type].principle === 'twin-hooke'
    const graph = twin ? graphTwin : graphCV
    graph.drive('in', w)
    graph.step(dt)
    const th = graph.get('in').theta
    let outAngle = graph.get('out').theta
    let mid = w

    inRef.current?.rotation.set(th, 0, 0)
    const yawFull = yawQuat(dd)
    if (s.type === 'rzeppa' || s.type === 'weiss') {
      outRef.current?.quaternion.copy(yawFull).multiply(tmp.r.setFromAxisAngle(X, outAngle))
      if (cageRef.current) cageRef.current.quaternion.copy(yawQuat(dd / 2)).multiply(tmp.r.setFromAxisAngle(X, th))
      const nb = s.type === 'rzeppa' ? 6 : 4
      const R = s.type === 'rzeppa' ? CV.rz.Rb : CV.weiss.Rb
      const off = s.type === 'rzeppa' ? 0 : PI / 4
      for (let k = 0; k < nb; k++) {
        const m = balls.current[k]
        if (m) m.position.set(...cvBallCentre(th + off + (k * 2 * PI) / nb, dd, R))
      }
    } else if (s.type === 'tripode') {
      tri.current = tripodeSolve(th, dd, CV.tri.legR, tri.current)
      outAngle = tri.current.phi
      if (outRef.current) {
        outRef.current.position.set(0, tri.current.cy, tri.current.cz)
        outRef.current.quaternion.copy(yawFull).multiply(tmp.r.setFromAxisAngle(X, outAngle))
      }
    } else {
      const sp = specRef.current
      const a = { theta: th, thetaC: graph.get('mid').theta, thetaOut2: outBodyAngle(graph.get('out').theta, sp) }
      const f = s.type === 'tracta' ? fr : frDC
      const p = pins(f, a, 0)
      midRef.current?.rotation.set(a.thetaC + PI, 0, 0)
      outRef.current?.rotation.set(a.thetaOut2 + PI, 0, 0)
      if (s.type === 'tracta') {
        const bis = tmp.v.copy(X).applyQuaternion(yawQuat(dd / 2))
        const sA = Math.sign(p.u0.clone().cross(p.u1).dot(bis)) || 1
        const sB = Math.sign(p.u3.clone().cross(p.u2).dot(bis)) || 1
        aRef.current?.quaternion.copy(crossQuaternion(p.u0.clone().multiplyScalar(sA), p.u1, tmp.qa))
        bRef.current?.quaternion.copy(crossQuaternion(p.u3.clone().multiplyScalar(sB), p.u2, tmp.qb))
      } else {
        aRef.current?.quaternion.copy(crossQuaternion(p.u0, p.u1, tmp.qa))
        bRef.current?.quaternion.copy(crossQuaternion(p.u2, p.u3, tmp.qb))
      }
      mid = w * doubleHooke(sp, th).ratioC
    }

    const dth = th - prev.current.th
    const ratio = dt > 0 && Math.abs(dth) > 1e-9 ? (outAngle - prev.current.out) / dth : 1
    prev.current = { th, out: outAngle }
    live.theta = (((th * 180) / PI) % 360 + 360) % 360
    live.omegaIn = s.rpm
    live.ratio = ratio
    live.omegaOut = s.rpm * ratio
    live.omegaMid = (mid * 60) / (2 * PI)
  })

  const cites = CV_CITES[type]
  return (
    <group>
      {type === 'rzeppa' ? (
        <Part id="rzeppa" name="Rzeppa / Birfield joint" role="housing" material="steel" info={{ summary: TYPES.rzeppa.label, role: 'Six balls kept in the bisecting plane transmit the drive at a constant velocity ratio.' }} cites={cites}>
          <group ref={inRef}>
            <Part id="rz-cup" name="Outer cup & stub shaft" material="forged" role="static" info={INFO.rzCup} cites={cites} explode={[-0.1, 0, 0]}>
              <PartMesh geometry={g.rzCup} />
            </Part>
          </group>
          <group ref={outRef}>
            <Part id="rz-inner" name="Inner member & drive shaft" material="steel" role="moving" info={INFO.rzInner} cites={cites} explode={[0.12, 0, 0]}>
              <PartMesh geometry={g.rzInner} />
            </Part>
          </group>
          <group ref={cageRef}>
            <Part id="rz-cage" name="Ball cage" material="steelDark" role="moving" info={INFO.rzCage} cites={cites} explode={[0.05, 0.08, 0]}>
              <PartMesh geometry={g.rzCage} />
            </Part>
          </group>
          <Part id="rz-balls" name="Six drive balls" material="chrome" role="moving" info={INFO.rzBalls} cites={[HJ2('§26.2.5, Fig 26.19 pressure angle')]} explode={[0.05, 0.14, 0]}>
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <PartMesh key={k} ref={(m) => {
                  balls.current[k] = m
                }} geometry={g.rzBall} />
            ))}
          </Part>
        </Part>
      ) : null}

      {type === 'weiss' ? (
        <Part id="weiss" name="Weiss (Bendix) joint" role="housing" material="forged" info={{ summary: TYPES.weiss.label, role: 'Four balls at the intersections of crossing tracks lie in the homokinetic plane.' }} cites={cites}>
          <group ref={inRef}>
            <Part id="weiss-in" name="Driving pronged yoke" material="forged" role="moving" info={INFO.weissYoke} cites={cites} explode={[-0.1, 0, 0]}>
              <PartMesh geometry={g.weissYoke} />
            </Part>
          </group>
          <group ref={outRef}>
            <Part id="weiss-out" name="Driven pronged yoke" material="steel" role="moving" info={INFO.weissYoke} cites={cites} explode={[0.1, 0, 0]}>
              <PartMesh geometry={hw.weissOut} />
            </Part>
          </group>
          <Part id="weiss-balls" name="Four drive balls" material="chrome" role="moving" info={INFO.weissBalls} cites={cites} explode={[0, 0.12, 0]}>
            {[0, 1, 2, 3].map((k) => (
              <PartMesh key={k} ref={(m) => {
                  balls.current[k] = m
                }} geometry={g.weissBall} />
            ))}
          </Part>
          <Part id="weiss-centre" name="Centralising ball" material="bearing" role="moving" info={INFO.weissCentre} cites={cites}>
            <PartMesh geometry={g.weissCentre} />
          </Part>
        </Part>
      ) : null}

      {type === 'tripode' ? (
        <Part id="tripode" name="Tripode joint" role="housing" material="forged" info={{ summary: TYPES.tripode.label, role: 'Three rollers on a three-legged spider run in the parallel grooves of a pot.' }} cites={cites}>
          <group ref={inRef}>
            <Part id="tri-pot" name="Pot member & stub shaft" material="forged" role="static" info={INFO.triPot} cites={cites} explode={[-0.1, 0, 0]}>
              <PartMesh geometry={g.triPot} />
            </Part>
          </group>
          <group ref={outRef}>
            <Part id="tri-spider" name="Tripode spider & drive shaft" material="steel" role="moving" info={INFO.triSpider} cites={cites} beyondNotes explode={[0.12, 0, 0]}>
              <PartMesh geometry={g.triSpider} />
              <Part id="tri-rollers" name="Spherical rollers" material="chrome" info={INFO.triRollers} cites={cites} explode={[0, 0.05, 0]}>
                {[0, 1, 2].map((k) => {
                  const a = (2 * PI * k) / 3
                  return <PartMesh key={k} geometry={g.triRoller} position={[0, CV.tri.legR * Math.cos(a), CV.tri.legR * Math.sin(a)]} rotation={[a, 0, 0]} />
                })}
              </Part>
            </Part>
          </group>
        </Part>
      ) : null}

      {type === 'tracta' ? (
        <Part id="tracta" name="Tracta joint" role="housing" material="forged" info={{ summary: TYPES.tracta.label, role: 'Two yoke jaws and two semispherical intermediate members; works like a double Hooke’s joint folded into one.' }} cites={cites}>
          <group ref={inRef}>
            <Part id="tracta-in" name="Driving yoke jaw" material="forged" role="moving" info={INFO.tractaJaw} cites={cites} explode={[-0.1, 0, 0]}>
              <PartMesh geometry={hw.tractaJaw} rotation={[PI / 2, 0, 0]} />
              <PartMesh geometry={hw.inShaft} material="steel" />
            </Part>
          </group>
          <group ref={aRef}>
            <Part id="tracta-spigot" name="Spigot (tongue) swivel" material="bronze" role="moving" info={INFO.tractaSpigot} cites={cites} explode={[-0.04, 0.08, 0]}>
              <PartMesh geometry={g.tractaSpigot} />
              <PartMesh geometry={g.tractaSpigotTrunnions} material="steel" />
            </Part>
          </group>
          <group ref={bRef}>
            <Part id="tracta-slotted" name="Slotted swivel" material="steelDark" role="moving" info={INFO.tractaSlotted} cites={cites} explode={[0.04, 0.08, 0]}>
              <PartMesh geometry={g.tractaSlotted} />
              <PartMesh geometry={g.tractaSlottedTrunnions} material="steel" />
            </Part>
          </group>
          <group quaternion={fr.b2}>
            <group ref={outRef}>
              <Part id="tracta-out" name="Driven yoke jaw" material="forged" role="moving" info={INFO.tractaJaw} cites={cites} explode={[0.1, 0, 0]}>
                <PartMesh geometry={hw.tractaJaw} rotation={[0, PI, 0]} />
                <PartMesh geometry={hw.outShaft} material="steel" />
              </Part>
            </group>
          </group>
        </Part>
      ) : null}

      {type === 'double' ? (
        <Part id="double" name="Double cardan CV joint" role="housing" material="forged" info={{ summary: TYPES.double.label, role: 'Two Hooke’s joints back to back, kept at equal angles by a centring device.' }} cites={cites}>
          <group scale={CV.dc.scale} position={[-dcOffset * CV.dc.scale, 0, 0]}>
            <group ref={inRef}>
              <Part id="dc-in" name="Input yoke & shaft" material="forged" role="moving" info={INFO.dcYokes} cites={cites} explode={[-0.2, 0, 0]}>
                <PartMesh geometry={hw.yoke} rotation={[PI / 2, 0, 0]} />
                <PartMesh geometry={hw.inShaft} material="steel" />
              </Part>
            </group>
            <group ref={aRef}>
              <Part id="dc-cross-1" name="First cross" material="steel" role="moving" info={INFO.dcCross} cites={cites} explode={[0, 0.25, 0]}>
                <PartMesh geometry={hw.cross} />
                <PartMesh geometry={hw.cups} material="steelDark" />
                <PartMesh geometry={hw.needles} material="chrome" />
                <PartMesh geometry={hw.seals} material="rubber" />
              </Part>
            </group>
            <group quaternion={frDC.b1}>
              <group ref={midRef}>
                <Part id="dc-centre-yoke" name="Central double yoke" material="paintYellow" role="moving" info={INFO.dcYokes} cites={cites} explode={[0, -0.2, 0]}>
                  <PartMesh geometry={hw.yoke} rotation={[0, PI, 0]} />
                  <PartMesh geometry={hw.yoke} position={[CV.dc.spacing, 0, 0]} />
                </Part>
              </group>
            </group>
            <group position={frDC.j2}>
              <group ref={bRef}>
                <Part id="dc-cross-2" name="Second cross" material="steel" role="moving" info={INFO.dcCross} cites={cites} explode={[0, 0.25, 0]}>
                  <PartMesh geometry={hw.cross} />
                  <PartMesh geometry={hw.cups} material="steelDark" />
                  <PartMesh geometry={hw.needles} material="chrome" />
                  <PartMesh geometry={hw.seals} material="rubber" />
                </Part>
              </group>
            </group>
            <group position={frDC.j2} quaternion={frDC.b2}>
              <group ref={outRef}>
                <Part id="dc-out" name="Output yoke & shaft" material="forged" role="moving" info={INFO.dcYokes} cites={cites} explode={[0.2, 0, 0]}>
                  <PartMesh geometry={hw.yoke} rotation={[0, PI, 0]} />
                  <PartMesh geometry={hw.outShaft} material="steel" />
                </Part>
              </group>
            </group>
            <group position={[dcOffset, 0, 0]} quaternion={yawQuat(d / 2)}>
              <Part id="dc-centring" name="Centring ball, socket & spring" material="bearing" role="static" info={INFO.dcCentre} cites={cites} explode={[0, 0.3, 0]}>
                <PartMesh geometry={g.centreBall} />
                <PartMesh geometry={g.centreSocket} material="steelDark" />
                <PartMesh geometry={g.centreSpring} material="steelDark" position={[-0.075, 0, 0]} />
              </Part>
            </group>
          </group>
        </Part>
      ) : null}

      <PartLabel partId={labelFor(type)[0]} at={[-0.07, 0.07, 0.03]} />
      <PartLabel partId={labelFor(type)[1]} at={[0.09 * Math.cos(d), 0.07, -0.09 * Math.sin(d)]} />
      <PartLabel partId={labelFor(type)[2]} at={[0.0, -0.06, 0.05]} />
      <PartLabel partId={labelFor(type)[3]} at={[0.02, 0.05, 0.06]} />
    </group>
  )
}

function labelFor(t: CVType): [string, string, string, string] {
  switch (t) {
    case 'rzeppa':
      return ['rz-cup', 'rz-inner', 'rz-cage', 'rz-balls']
    case 'weiss':
      return ['weiss-in', 'weiss-out', 'weiss-centre', 'weiss-balls']
    case 'tracta':
      return ['tracta-in', 'tracta-out', 'tracta-spigot', 'tracta-slotted']
    case 'tripode':
      return ['tri-pot', 'tri-spider', 'tri-rollers', 'tri-rollers']
    default:
      return ['dc-in', 'dc-out', 'dc-centring', 'dc-centre-yoke']
  }
}
