import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, extrude, helixSpring, mat4, merge, roundedBox, xform } from '@/geometry'
import { rim, torus, tyre } from '@/geometry/parts'
import { profileAt, rk4Step, seatDeriv } from '@/physics/vibration'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { C, T, TRACE_N, TRACE_SPAN, getCase, live, pick, sumAt, useSeat } from './model'

const INFO = {
  tractor: {
    summary: 'Wheeled tractor with no suspension except its tyres.',
    role: 'Rough ground excites bounce and pitch of the whole tractor on its tyres, at roughly 3–10 Hz — inside the 4–8 Hz band where people are most sensitive.',
    details: 'Farmland tractor: 2850 kg, wheelbase 1.88 m. Tyre stiffnesses are typical values (700 kN/m rear pair, 400 kN/m front pair).',
  },
  ground: { summary: 'Rough field surface.', role: 'The input. Front and rear wheels meet the same bumps 1.88 m (one wheelbase) apart, which excites pitch as well as bounce.' },
  platform: {
    summary: 'Operator platform (tractor chassis at the seat).',
    role: 'Its vertical motion is z_input = z_t + Rθ: chassis bounce plus pitch × distance from the centre of gravity.',
  },
  suspension: {
    summary: 'Seat suspension: scissor linkage, spring k₂ and damper c₂, with stops.',
    role: 'Chosen so the seat’s natural frequency ω_s = √(k/M) is well below the tractor frequency ω_t: transmissibility < 1 needs ω_t/ω_s > 1.414. T = 0.5–0.65 is satisfactory.',
  },
  scissor: { summary: 'Scissor linkage.', role: 'Keeps the seat level and guides it vertically.' },
  spring: { summary: 'Suspension spring k₂.', role: 'Carries seat and operator: ω_s = √(k₂/M), M = m₁ + m₂.' },
  damper: { summary: 'Suspension damper c₂.', role: 'ζ = c/c_c with c_c = 2Mω_s. Damping matters because the tractor sometimes excites the seat near ω_t/ω_s = 1.' },
  stops: { summary: 'Travel stops (bump stops).', role: 'Limit the suspension stroke. Hitting them gives sharp jolts — a nonlinearity that the linear one-DOF formula ignores.' },
  seat: { summary: 'Seat pan and back, mass m₂.', role: 'The middle mass of the two-degree-of-freedom model.' },
  cushion: { summary: 'Seat cushion, k₁ and c₁.', role: 'The upper spring: the operator sits on it. Here the man-on-cushion frequency is about 5 Hz (typical value).' },
  operator: { summary: 'Operator, mass m₁.', role: 'The output of the model: a_z at the operator is compared with the ISO 2631 boundaries. 50th-percentile mass 75 kg.' },
}

const capsule = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
  const d = b.clone().sub(a)
  const g = new THREE.CapsuleGeometry(r, Math.max(1e-3, d.length()), 6, 16)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))
  g.applyMatrix4(m)
  return g
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function fenderGeo() {
  const s = new THREE.Shape()
  const R1 = 0.74
  const R2 = 0.78
  s.absarc(0, 0, R2, Math.PI * 0.08, Math.PI * 0.95, false)
  s.absarc(0, 0, R1, Math.PI * 0.95, Math.PI * 0.08, true)
  return extrude(s, 0.46)
}

export function Scene3D() {
  const ground = useSeat((s) => s.ground)
  const g = useMemo(() => {
    const along = mat4.rx(Math.PI / 2)
    const rearTyre = xform(tyre({ radius: T.rearR, width: 0.378, rimRadius: 0.356, lugs: 22, lugAngleDeg: 45, pattern: 'R1' }), along)
    const rearRim = xform(rim(0.356, 0.36, 0.1, 0.05), along)
    const frontTyre = xform(tyre({ radius: T.frontR, width: 0.19, rimRadius: 0.203, pattern: 'F2' }), along)
    const frontRim = xform(rim(0.203, 0.17, 0.06, 0.02), along)
    const body = merge(
      xform(roundedBox(1.0, 0.5, 0.62, 0.05), mat4.t(-0.05, 0.72, 0)),
      xform(cylinder(0.12, 1.25, 32), mat4.c(mat4.t(0, T.rearAxleY, 0), along)),
      xform(roundedBox(0.7, 0.42, 0.5, 0.05), mat4.t(0.75, 0.72, 0)),
    )
    const hood = xform(roundedBox(1.15, 0.42, 0.52, 0.06), mat4.t(1.45, 1.06, 0))
    const grille = xform(box(0.06, 0.5, 0.5), mat4.t(2.05, 0.98, 0))
    const engine = xform(roundedBox(1.0, 0.36, 0.42, 0.04), mat4.t(1.45, 0.68, 0))
    const frontAxle = merge(xform(box(0.14, 0.12, 1.25), mat4.t(T.wheelbase, T.frontR, 0)), xform(box(0.3, 0.3, 0.3), mat4.t(T.wheelbase, 0.58, 0)))
    const exhaust = xform(cylinder(0.04, 0.6, 20), mat4.t(1.75, 1.55, 0.15))
    const fender = fenderGeo()
    const platform = xform(box(0.95, 0.04, 0.95), mat4.t(-0.18, T.platformY - 0.02, 0))
    const column = xform(cylinder(0.03, 0.62, 16), mat4.c(mat4.t(0.4, 1.28, 0), mat4.rz(0.45)))
    const wheel = xform(torus(0.19, 0.014, 10, 40), mat4.c(mat4.t(0.24, 1.58, 0), mat4.rz(0.45), mat4.rx(Math.PI / 2)))
    // --- seat suspension (in seat-group frame: origin on the platform at the seat point)
    const basePlate = xform(box(0.38, 0.03, 0.42), mat4.t(0, 0.015, 0))
    const stops = merge(...[-0.13, 0.13].map((x) => xform(cylinder(0.022, 0.03, 20), mat4.t(x, 0.045, 0.17))))
    const bar = box(0.34, 0.022, 0.018)
    const springGeo = helixSpring(0.034, 0.005, 1, 7)
    const damperBody = xform(cylinder(0.018, 0.08, 20), mat4.t(0, 0.07, 0))
    const damperRod = xform(cylinder(0.007, 1, 12), mat4.t(0, -0.5, 0))
    const pan = xform(roundedBox(0.44, 0.04, 0.46, 0.012), mat4.t(0, 0.02, 0))
    const back = xform(roundedBox(0.05, 0.5, 0.44, 0.02), mat4.c(mat4.t(-0.24, 0.3, 0), mat4.rz(0.18)))
    const cushion = xform(roundedBox(0.44, 0.07, 0.46, 0.03), mat4.t(0, 0.075, 0))
    const backCushion = xform(roundedBox(0.06, 0.44, 0.42, 0.025), mat4.c(mat4.t(-0.19, 0.33, 0), mat4.rz(0.18)))
    // --- operator (seat-group frame, sitting on the cushion top at y ≈ 0.11)
    const ys = 0.11
    const torso = capsule(V(-0.08, ys + 0.14, 0), V(-0.03, ys + 0.48, 0), 0.15)
    const head = new THREE.SphereGeometry(0.1, 24, 16)
    head.translate(-0.01, ys + 0.76, 0)
    const neck = capsule(V(-0.02, ys + 0.6, 0), V(-0.015, ys + 0.68, 0), 0.05)
    const legs: THREE.BufferGeometry[] = []
    const arms: THREE.BufferGeometry[] = []
    for (const z of [-0.1, 0.1]) {
      legs.push(capsule(V(-0.04, ys + 0.08, z), V(0.36, ys + 0.1, z * 1.1), 0.075))
      legs.push(capsule(V(0.38, ys + 0.08, z * 1.1), V(0.48, -0.15, z * 1.2), 0.06))
      legs.push(capsule(V(0.47, -0.17, z * 1.2), V(0.6, -0.18, z * 1.2), 0.04))
      arms.push(capsule(V(-0.02, ys + 0.5, z * 2.1), V(0.17, 0.38, z * 2.2), 0.05))
      arms.push(capsule(V(0.17, 0.38, z * 2.2), V(0.34, 0.46, z * 1.6), 0.042))
    }
    const clothes = merge(torso, ...arms)
    const trousers = merge(...legs)
    const skin = merge(head, neck)
    // --- ground strip (one 64 m period; local x 0…64)
    return { rearTyre, rearRim, frontTyre, frontRim, body, hood, grille, engine, frontAxle, exhaust, fender, platform, column, wheel, basePlate, stops, bar, springGeo, damperBody, damperRod, pan, back, cushion, backCushion, clothes, trousers, skin }
  }, [])

  const groundGeo = useMemo(() => {
    const prof = getCase(pick(useSeat.getState())).profile
    const plane = new THREE.PlaneGeometry(64, 2.6, 1280, 2)
    plane.rotateX(-Math.PI / 2)
    plane.translate(32, 0, 0)
    const pos = plane.getAttribute('position')
    for (let i = 0; i < pos.count; i++) pos.setY(i, profileAt(prof, pos.getX(i)).h)
    plane.computeVertexNormals()
    return plane
    // rebuilt when the ground class changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ground])

  const bodyOuter = useRef<THREE.Group>(null)
  const rearW = useRef<THREE.Group[]>([])
  const frontW = useRef<THREE.Group[]>([])
  const groundRefs = useRef<(THREE.Group | null)[]>([])
  const panRef = useRef<THREE.Group>(null)
  const opRef = useRef<THREE.Group>(null)
  const springRef = useRef<THREE.Mesh>(null)
  const rodRef = useRef<THREE.Group>(null)
  const bars = useRef<(THREE.Group | null)[]>([])
  const sim = useRef({ key: '', t: 0, y: [0, 0, 0, 0], ms: 0, fs: 0, acc: 0, wasOut: false })

  useSimFrame((dt) => {
    const st = pick(useSeat.getState())
    const cs = getCase(st)
    const s = sim.current
    if (cs.key !== s.key) {
      s.key = cs.key
      // start on the steady-state solution so there is no start-up transient
      const fl0 = sumAt(cs.comps, (c) => c.st, s.t)
      const mn0 = sumAt(cs.comps, (c) => c.mn, s.t)
      s.y = [mn0.z, mn0.v, fl0.z, fl0.v]
      live.hits = 0
    }
    const floor = (t: number) => sumAt(cs.comps, (c) => c.fl, t).z
    const floorV = (t: number) => sumAt(cs.comps, (c) => c.fl, t).v
    const f = seatDeriv(cs.params, floor, floorV, { travel: T.travel, k: cs.params.k2 * 30 + 2e4 })
    const n = Math.max(1, Math.ceil(dt / 0.002))
    const h = dt / n
    for (let i = 0; i < n && dt > 0; i++) {
      s.y = rk4Step(f, s.t, s.y, h)
      s.t += h
    }
    const fl = sumAt(cs.comps, (c) => c.fl, s.t)
    const aMan = f(s.t, s.y)[1]
    // running RMS, 5 s exponential window
    if (dt > 0) {
      const k = Math.min(1, dt / 5)
      s.ms += (aMan * aMan - s.ms) * k
      s.fs += (fl.a * fl.a - s.fs) * k
      s.acc += dt
      while (s.acc >= TRACE_SPAN / TRACE_N) {
        s.acc -= TRACE_SPAN / TRACE_N
        live.traceFloor.push(fl.a)
        live.traceFloor.shift()
        live.traceMan.push(aMan)
        live.traceMan.shift()
        live.version++
      }
    }
    const stroke = s.y[2] - fl.z
    const out = Math.abs(stroke) > T.travel
    if (out && !s.wasOut) live.hits++
    s.wasOut = out

    // tractor body: bounce + pitch about the rear axle
    const zr = sumAt(cs.comps, (c) => c.r, s.t).z
    const zf = sumAt(cs.comps, (c) => c.fr, s.t).z
    if (bodyOuter.current) {
      bodyOuter.current.position.set(0, T.rearAxleY + zr, 0)
      bodyOuter.current.rotation.set(0, 0, (zf - zr) / T.wheelbase)
    }
    const dist = (st.V / 3.6) * s.t
    rearW.current.forEach((w) => w && w.rotation.set(0, 0, -dist / 0.635))
    frontW.current.forEach((w) => w && w.rotation.set(0, 0, -dist / T.frontR))
    const m = dist % 64
    groundRefs.current.forEach((gr, i) => gr && gr.position.set(-m + (i - 1) * 64, 0, 0))

    // seat suspension and operator relative to the platform
    const hS = T.suspH + Math.max(-T.travel * 1.1, Math.min(T.travel * 1.1, stroke))
    panRef.current?.position.set(0, hS, 0)
    opRef.current?.position.set(0, hS + (s.y[0] - s.y[2]), 0)
    if (springRef.current) {
      springRef.current.position.y = 0.03
      springRef.current.scale.y = hS - 0.03
    }
    if (rodRef.current) {
      rodRef.current.position.y = hS
      rodRef.current.scale.y = hS - 0.09
    }
    const Ls = 0.34
    const span = Math.min(Ls * 0.98, hS - 0.05)
    const a = Math.asin(span / Ls)
    bars.current.forEach((b, i) => {
      if (!b) return
      b.position.set(0, 0.03 + span / 2, i < 2 ? -0.15 : 0.15)
      b.rotation.set(0, 0, i % 2 === 0 ? a : -a)
    })
    live.t = s.t
    live.manRms = Math.sqrt(s.ms)
    live.floorRms = Math.sqrt(s.fs)
    live.stroke = stroke
  })

  return (
    <group>
      <Part id="ground" name="Rough ground" material="soil" role="static" info={INFO.ground} cites={[C.he('eq 11–12: z_input')]} cut={false}>
        {[0, 1, 2].map((i) => (
          <group key={i} ref={(el) => (groundRefs.current[i] = el)}>
            <PartMesh geometry={groundGeo} receiveShadow />
          </group>
        ))}
      </Part>
      <group ref={bodyOuter} position={[0, T.rearAxleY, 0]}>
        <group position={[0, -T.rearAxleY, 0]}>
          <Part id="tractor" name="Tractor (sprung on its tyres)" material="paintRed" role="housing" info={INFO.tractor} cites={[C.he('tractor natural frequencies 3–10 Hz'), SRC.mac502('App. II Farmland tractor')]}>
            <PartMesh geometry={g.body} material="castIron" />
            <PartMesh geometry={g.hood} />
            <PartMesh geometry={g.grille} material="paintGrey" />
            <PartMesh geometry={g.engine} material="castIron" />
            <PartMesh geometry={g.frontAxle} material="paintGrey" />
            <PartMesh geometry={g.exhaust} material="paintBlack" />
            {[-1, 1].map((sz) => (
              <PartMesh key={sz} geometry={g.fender} position={[0, T.rearAxleY, sz * 0.71]} />
            ))}
            <Part id="rear-wheels" name="Rear wheels" material="rubber" role="moving" info={{ summary: 'Rear tyres 14.9-28: the tractor’s main “springs”.', role: 'Tyre stiffness and the body mass set the bounce frequency (≈ 3 Hz here).' }} cut={false}>
              {[-1, 1].map((sz, i) => (
                <group key={sz} ref={(el) => el && (rearW.current[i] = el)} position={[0, T.rearAxleY, sz * 0.71]}>
                  <PartMesh geometry={g.rearTyre} />
                  <PartMesh geometry={g.rearRim} material="paintYellow" />
                </group>
              ))}
            </Part>
            <Part id="front-wheels" name="Front wheels" material="rubber" role="moving" cut={false} info={{ summary: 'Front tyres.', role: 'Meet each bump one wheelbase before the rear wheels, pitching the tractor.' }}>
              {[-1, 1].map((sz, i) => (
                <group key={sz} ref={(el) => el && (frontW.current[i] = el)} position={[T.wheelbase, T.frontR, sz * 0.71]}>
                  <PartMesh geometry={g.frontTyre} />
                  <PartMesh geometry={g.frontRim} material="paintYellow" />
                </group>
              ))}
            </Part>
            <Part id="platform" name="Platform (seat input z_input)" material="paintBlack" role="static" info={INFO.platform} cites={[C.he('eq 11–12')]}>
              <PartMesh geometry={g.platform} />
              <PartMesh geometry={g.column} material="paintGrey" />
              <PartMesh geometry={g.wheel} material="plastic" />
            </Part>
            <group position={[T.seatX, T.platformY, 0]}>
              <Part id="suspension" name="Seat suspension" material="steelDark" role="moving" info={INFO.suspension} cites={[C.he('Fig 10.9, eq 13–17')]} cut={false}>
                <PartMesh geometry={g.basePlate} material="paintBlack" />
                <Part id="stops" name="Travel stops" material="rubber" info={INFO.stops} cites={[C.he('Fig 10.9 stops')]}>
                  <PartMesh geometry={g.stops} />
                </Part>
                <Part id="scissor" name="Scissor linkage" material="steel" info={INFO.scissor}>
                  {[0, 1, 2, 3].map((i) => (
                    <group key={i} ref={(el) => (bars.current[i] = el)}>
                      <PartMesh geometry={g.bar} />
                    </group>
                  ))}
                </Part>
                <Part id="seat-spring" name="Spring k₂" material="steelDark" info={INFO.spring} cites={[C.he('eq 17')]}>
                  <PartMesh ref={springRef} geometry={g.springGeo} position={[0.07, 0, 0]} />
                </Part>
                <Part id="seat-damper" name="Damper c₂" material="paintBlack" info={INFO.damper} cites={[C.he('eq 15–16')]}>
                  <PartMesh geometry={g.damperBody} position={[-0.08, 0, 0]} />
                  <group ref={rodRef} position={[-0.08, T.suspH, 0]}>
                    <PartMesh geometry={g.damperRod} material="chrome" />
                  </group>
                </Part>
              </Part>
              <group ref={panRef} position={[0, T.suspH, 0]}>
                <Part id="seat" name="Seat m₂" material="paintBlack" role="moving" info={INFO.seat} cites={[C.he('Fig 10.9')]}>
                  <PartMesh geometry={g.pan} />
                  <PartMesh geometry={g.back} />
                  <Part id="cushion" name="Cushion k₁, c₁" material="leather" role="static" info={INFO.cushion} cites={[C.he('Fig 10.9')]}>
                    <PartMesh geometry={g.cushion} />
                    <PartMesh geometry={g.backCushion} />
                  </Part>
                </Part>
              </group>
              <group ref={opRef} position={[0, T.suspH, 0]}>
                <Part id="operator" name="Operator m₁" material="paintBlue" role="moving" info={INFO.operator} cites={[C.he('Table 10.6, Fig 10.6')]} cut={false}>
                  <PartMesh geometry={g.clothes} />
                  <PartMesh geometry={g.trousers} material="paintGrey" />
                  <PartMesh geometry={g.skin} material="wood" />
                </Part>
              </group>
            </group>
          </Part>
        </group>
      </group>

      <PartLabel partId="operator" at={[T.seatX, 1.95, 0.3]} />
      <PartLabel partId="cushion" at={[T.seatX + 0.25, T.platformY + 0.33, 0.3]} />
      <PartLabel partId="seat-spring" at={[T.seatX + 0.25, T.platformY + 0.1, 0.35]} />
      <PartLabel partId="seat-damper" at={[T.seatX - 0.3, T.platformY + 0.1, 0.35]} />
      <PartLabel partId="scissor" at={[T.seatX, T.platformY + 0.05, 0.45]} />
      <PartLabel partId="platform" at={[-0.6, T.platformY, 0.5]} />
      <PartLabel partId="rear-wheels" at={[0.2, 1.2, 0.95]} />
      <PartLabel partId="ground" at={[1, 0.05, 1.2]} />
    </group>
  )
}

