import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, pipe, tube, xform } from '@/geometry'
import { chainLink, loopPath, sprocket, sprocketRadius } from '@/geometry/parts'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { InstancedPartMesh } from '../../elements/_shared/InstancedPartMesh'
import { P504 } from './cites'
import { PathTable, boxShell, hopper, prism, screwFlight, sweepRing, thickPolyline, uTrough } from './geom'
import { analyse, live, pitchOf, useConv } from './model'

const { PI, sin, cos, random } = Math
const G = 9.81
const V3 = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)

const C = {
  belt: [P504.hand('Note 3, Belt conveyors'), P504.hand('Note 3, Design (preliminary)')],
  beltP: [P504.hand('Note 3, Power to drive belt conveyors')],
  chain: [P504.hand('Note 3, Chain conveyors'), P504.hand('Note 3, Steps in determining the proper chain')],
  screw: [P504.hand('Note 3, Screw or Auger conveyor'), P504.hand('Note 3, Theoretical capacity; Power requirement')],
  bucket: [P504.hand('Note 3, Bucket elevators')],
  pneu: [P504.hand('Note 3, Pneumatic conveyor; Pneumatic Systems Design')],
  sep: [P504.sep('Cyclone separator')],
}

const INFO = {
  belt: { summary: 'Belt conveyor: an endless belt round a drive (head) and a tail pulley, carried on idlers.', role: 'The belt moves and the load rides still on it — no relative motion, so little damage. High capacity over long distances with little power; elevation is limited.', details: 'Grain belts run at up to 3.5 m/s, 2.5–2.8 m/s recommended. Belting: stitched canvas, solid woven, stitched rubber, plain canvas or rubber.' },
  beltBand: { summary: 'Troughed belt.', role: 'Flat at the pulleys, troughed by the three-roll idlers on the carrying run so bulk material cannot spill. Capacity C = V(A + As): load area between the rolls plus the surcharge above line AB.' },
  headPulley: { summary: 'Head (drive) pulley.', role: 'Driven by the motor and gearbox; pulls the loaded (carrying) side of the belt. Material is discharged over it.' },
  tailPulley: { summary: 'Tail pulley.', role: 'Returns the belt; often carries the take-up that keeps the belt tight.' },
  carryIdlers: { summary: 'Three-roll troughing idlers (carrying run).', role: 'Support the loaded belt and bend it into a trough of angle β; antifriction bearings keep the running resistance (and power) low.' },
  returnIdlers: { summary: 'Flat return idlers.', role: 'Support the empty return run under the conveyor.' },
  stringers: { summary: 'Supporting idler table (stringers and legs).', role: 'Hold the idlers in line at the conveyor incline.' },
  feed: { summary: 'Loading hopper with gate.', role: 'Loads the belt centrally at the tail. Other loaders: by hand, a flight system, or from a screw or another conveyor.' },
  drive: { summary: 'Drive: motor and reduction gearbox.', role: 'Supplies the power to overcome empty-belt friction, load friction and lift.' },
  chute: { summary: 'Discharge chute.', role: 'Catches the material thrown off the head pulley.' },
  load: { summary: 'Bulk material.', role: 'Rides in the trough at belt speed; its surface takes the surcharge angle.' },
  chainTrough: { summary: 'Conveyor trough (casing).', role: 'Flights drag the material along the floor of the trough.' },
  chain: { summary: 'Roller chain with scraper flights.', role: 'Flights pull (scrape) the material along the trough on the lower run and return empty on top. Chain types: detachable, pintle, roller, combination.' },
  sprockets: { summary: 'Head and tail sprockets.', role: 'At least 12 teeth (6–8 only at low speed where space is short): too few teeth give jerky motion and wear.' },
  screwTrough: { summary: 'U-trough (housing).', role: 'The clearance between flight and trough is one reason the actual capacity is only 30–50 % of the theoretical.' },
  flight: { summary: 'Helical flight (auger).', role: 'Each revolution pushes the material forward one pitch. Standard pitch (= D) for horizontal runs; ½ or ⅓ pitch for inclines; ribbon flight (gap at the shaft) for sticky material; cut/paddle flight for mixing.' },
  shaft: { summary: 'Screw shaft (diameter d).', role: 'Carries the flight. The swept annulus is π(D² − d²)/4.' },
  inlet: { summary: 'Inlet spout.', role: 'Feeds material into the trough.' },
  outlet: { summary: 'Outlet spout.', role: 'Discharge at the far end.' },
  bucketEl: { summary: 'Bucket elevator.', role: 'Lifts granular, ground or lump material vertically. Head (head shaft, pulley/sprocket, drive, hood), boot (foot shaft, pulley, inlet) and two legs (casing) carrying the buckets.' },
  buckets: { summary: 'Buckets on a belt (or a single detachable chain).', role: 'Scoop material from the boot and tip it out over the head. Spacing and speed set the discharge type.' },
  head: { summary: 'Head pulley and hood.', role: 'Where the buckets turn over and discharge into the spout.' },
  boot: { summary: 'Boot (foot) with inlet.', role: 'Buckets dig material out of the boot (centrifugal) or are filled directly by the inlet chute (continuous).' },
  legs: { summary: 'Up and down legs (casing).', role: 'Enclose the loaded and returning buckets.' },
  spout: { summary: 'Discharge spout.', role: 'Receives the thrown (centrifugal) or tipped (positive, continuous) material.' },
  fan: { summary: 'Fan / blower.', role: 'Low-pressure systems (< 35 cm water): high-velocity, low-density air. Positive (fan at the head: one point to many) or suction (fan at the tail: many points to one). High-pressure systems use a positive-displacement blower.' },
  airlock: { summary: 'Rotary airlock feeder.', role: 'Meters material into the pressurised duct without letting the air blow back up the hopper.' },
  duct: { summary: 'Duct system.', role: 'Any routing; ≈ 1500 m/min air for most farm jobs. Static-pressure losses: duct friction, elbows, entrance, cyclone, material.' },
  cyclone: { summary: 'Cyclone collector.', role: 'The air and material spin down the outer vortex; solids are flung to the wall and drop out of the cone; the air leaves up the centre.' },
  nozzle: { summary: 'Suction nozzle.', role: 'Picks material up from a heap or from several points (suction system).' },
}

/* =============================== BELT =============================== */

const BELT_C = 1.6
const BELT_R = 0.16
const BELT_T = 0.012
const BELT_Y = 0.95

function BeltConveyor() {
  const p = useConv()
  const a = useMemo(() => analyse(p), [p])
  const B = p.B
  const geo = useMemo(() => {
    const lp = loopPath(new THREE.Vector2(-BELT_C, 0), BELT_R, new THREE.Vector2(BELT_C, 0), BELT_R)
    const table = new PathTable(lp.path, 480)
    const pts = table.pts.slice(0, -1)
    const section = (_: number, q: THREE.Vector3): [number, number][] => {
      const k = q.y > 0 ? Math.max(0, Math.min(1, (BELT_C - Math.abs(q.x) - 0.08) / 0.45)) : 0
      const be = p.trough * k
      const ue = B / 6 + (B / 3) * cos(be)
      const we = (B / 3) * sin(be)
      return [
        [-ue, we + BELT_T],
        [-B / 6, BELT_T],
        [B / 6, BELT_T],
        [ue, we + BELT_T],
        [ue, we],
        [B / 6, 0],
        [-B / 6, 0],
        [-ue, we],
      ]
    }
    const band = sweepRing(pts, section)
    const ri = 0.045
    const roll = cylinder(ri, B / 3 - 0.01, 20)
    const rollReturn = cylinder(ri, B * 1.05, 20)
    const be = p.trough
    const sets: THREE.BufferGeometry[] = []
    const xs = [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2]
    for (const x of xs) {
      sets.push(xform(roll, mat4.c(mat4.t(x, -ri, 0), mat4.rx(PI / 2))))
      for (const s of [-1, 1]) {
        const um = B / 6 + (B / 6) * cos(be)
        const wm = (B / 6) * sin(be)
        const nn = [sin(be), -cos(be)]
        const cu = um + nn[0] * ri + 0.005
        const cw = wm + nn[1] * ri
        sets.push(xform(roll, mat4.c(mat4.t(x, cw, s * cu), mat4.rx(s * (PI / 2 - be)))))
      }
    }
    const carry = merge(...sets)
    const ret = merge(...[-1.2, -0.4, 0.4, 1.2].map((x) => xform(rollReturn, mat4.c(mat4.t(x, 0, 0), mat4.rx(PI / 2)))))
    const pulley = lathe(
      [
        [0.02, -B / 2 - 0.03],
        [BELT_R - 0.02, -B / 2 - 0.03],
        [BELT_R, -B / 2 - 0.01],
        [BELT_R, B / 2 + 0.01],
        [BELT_R - 0.02, B / 2 + 0.03],
        [0.02, B / 2 + 0.03],
      ],
      48,
    )
    const pulleyZ = xform(pulley, mat4.rx(PI / 2))
    const shaft = xform(cylinder(0.025, B + 0.5, 20), mat4.rx(PI / 2))
    const stringer = box(2 * BELT_C + 0.3, 0.08, 0.05)
    const hop = hopper(Math.min(0.55, B * 0.8), Math.min(0.2, B * 0.3), 0.35)
    const chute = boxShell(0.35, B * 0.9, 0.5, 0.01)
    return { table, band, carry, ret, pulleyZ, shaft, stringer, hop, chute, ri }
  }, [B, p.trough]) // eslint-disable-line react-hooks/exhaustive-deps

  // load particles: in the trough from the hopper to the head pulley, then over the head
  const N = 320
  const parts = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        s: random() * 1.15,
        u: random() * 2 - 1,
        h: random(),
      })),
    [],
  )
  const clump = useMemo(() => new THREE.IcosahedronGeometry(0.02, 0), [])
  const mesh = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const tr = a.tr
  useSimFrame((dt) => {
    live.beltS = (live.beltS + p.v * dt) % 1000
    const m = mesh.current
    if (!m) return
    const span = 2.75 // feed (x = +1.15) to head (x = −1.6)
    const ds = (p.v * dt) / span
    const scale = B / 0.6
    for (let i = 0; i < N; i++) {
      const q = parts[i]
      q.s += ds
      if (q.s > 1.3) {
        q.s -= 1.3
        q.u = random() * 2 - 1
        q.h = random()
      }
      const u = q.u * (tr.top / 2) * 0.95
      // floor of the trough at u
      const lw = B / 6
      const au = Math.abs(u)
      const floor = au <= lw ? 0 : (au - lw) * Math.tan(p.trough)
      const surch = tr.As > 0 ? Math.max(0, Math.sqrt(Math.max(0, tr.R * tr.R - u * u)) - tr.R * cos(p.surcharge)) : 0
      const top = tr.h + surch
      const y0 = BELT_R + BELT_T + floor + q.h * Math.max(0, top - floor) + 0.012
      if (q.s <= 1) {
        tmp.position.set(1.15 - q.s * span, y0, u)
      } else {
        const t = ((q.s - 1) * span) / p.v
        tmp.position.set(-BELT_C - p.v * t * 0.9, y0 - 0.5 * G * t * t, u * 0.9)
      }
      tmp.scale.setScalar(0.8 + 0.4 * ((i * 7) % 5) / 5)
      tmp.scale.multiplyScalar(Math.min(1.3, Math.max(0.7, scale)))
      tmp.rotation.set(i, i * 1.3, 0)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.count = N
    m.instanceMatrix.needsUpdate = true
  })

  const phi = p.incline
  // world y of a point on the stringer at local x
  const legs = [-1.3, 0, 1.3].map((xl) => {
    const yl = BELT_R - 0.18
    return { x: xl * cos(phi) - yl * sin(phi), y: BELT_Y + xl * sin(phi) + yl * cos(phi) }
  })
  const leg = useMemo(() => box(0.06, 1, 0.06), [])
  return (
    <Part id="belt-conv" name="Troughed belt conveyor" role="moving" material="rubber" info={INFO.belt} cites={C.belt}>
      <group position={[0, BELT_Y, 0]} rotation={[0, 0, -phi]}>
        <Part id="belt-band" name="Belt (troughed on the carrying run)" role="moving" material="rubber" info={INFO.beltBand} cites={C.belt} explode={[0, 0.15, 0]}>
          <PartMesh geometry={geo.band} />
        </Part>
        <Part id="head-pulley" name="Head (drive) pulley" role="moving" material="paintGrey" info={INFO.headPulley} cites={C.belt} explode={[-0.25, 0, 0]}>
          <group position={[-BELT_C, 0, 0]}>
            <PartMesh geometry={geo.pulleyZ} />
            <PartMesh geometry={geo.shaft} material="steel" />
          </group>
        </Part>
        <Part id="tail-pulley" name="Tail pulley" role="moving" material="paintGrey" info={INFO.tailPulley} cites={C.belt} explode={[0.25, 0, 0]}>
          <group position={[BELT_C, 0, 0]}>
            <PartMesh geometry={geo.pulleyZ} />
            <PartMesh geometry={geo.shaft} material="steel" />
          </group>
        </Part>
        <Part id="carry-idlers" name="Troughing idlers" role="static" material="steel" info={INFO.carryIdlers} cites={C.belt} explode={[0, -0.1, 0]}>
          <group position={[0, BELT_R, 0]}>
            <PartMesh geometry={geo.carry} />
          </group>
        </Part>
        <Part id="return-idlers" name="Return idlers" role="static" material="steel" info={INFO.returnIdlers} explode={[0, -0.2, 0]}>
          <group position={[0, -BELT_R - BELT_T - geo.ri - 0.002, 0]}>
            <PartMesh geometry={geo.ret} />
          </group>
        </Part>
        <Part id="stringers" name="Idler table (stringers)" role="housing" material="paintYellow" info={INFO.stringers} explode={[0, -0.3, 0]}>
          {[-1, 1].map((s) => (
            <PartMesh key={s} geometry={geo.stringer} position={[0, BELT_R - 0.14, s * (B / 2 + 0.12)]} />
          ))}
        </Part>
        <Part id="feed-hopper" name="Feed hopper" role="housing" material="galvanised" info={INFO.feed} cites={C.belt} explode={[0, 0.4, 0]}>
          <PartMesh geometry={geo.hop} position={[1.15, BELT_R + 0.22, 0]} />
        </Part>
        <Part id="load" name="Bulk grain" role="moving" material="grain" cut={false} info={INFO.load} cites={C.belt}>
          <InstancedPartMesh ref={mesh} geometry={clump} count={N} />
        </Part>
        <Part id="belt-drive" name="Motor and gearbox" role="housing" material="paintBlue" info={INFO.drive} cites={C.beltP} explode={[0, 0, -0.3]}>
          <PartMesh geometry={useMemo(() => box(0.3, 0.26, 0.28), [])} position={[-BELT_C, 0, -B / 2 - 0.45]} />
          <PartMesh geometry={useMemo(() => xform(cylinder(0.11, 0.32, 24), mat4.rx(PI / 2)), [])} position={[-BELT_C + 0.02, 0, -B / 2 - 0.78]} material="paintGreen" />
        </Part>
      </group>
      <Part id="chute" name="Discharge chute" role="housing" material="galvanised" info={INFO.chute} explode={[-0.3, 0, 0]}>
        <PartMesh geometry={geo.chute} position={[-BELT_C * cos(phi) - 0.35, BELT_Y + BELT_C * sin(phi) - 0.55, 0]} rotation={[0, 0, -0.35]} />
      </Part>
      <Part id="belt-legs" name="Legs" role="housing" material="paintYellow" info={INFO.stringers}>
        {legs.map((l, i) =>
          [-1, 1].map((s) => <PartMesh key={`${i}${s}`} geometry={leg} position={[l.x, l.y / 2, s * (B / 2 + 0.12)]} scale={[1, Math.max(0.05, l.y), 1]} />),
        )}
      </Part>
    </Part>
  )
}

/* =============================== CHAIN =============================== */

const CH_PITCH = 0.1
const CH_TEETH = 9
const CH_R = sprocketRadius(CH_TEETH, CH_PITCH)
const CH_X = 1.5
const CH_FLOOR = 0.6
const CH_Y = CH_FLOOR + 0.16

function ChainConveyor() {
  const p = useConv()
  const W = Math.max(0.2, p.chainW)
  const geo = useMemo(() => {
    const yc = CH_Y + CH_R
    const lp = loopPath(new THREE.Vector2(-CH_X, yc), CH_R, new THREE.Vector2(CH_X, yc), CH_R)
    const table = new PathTable(lp.path, 900)
    const n = Math.round(table.length / CH_PITCH)
    const H = 2 * CH_R + 0.36
    const outline = thickPolyline(
      [
        [-W / 2, H],
        [-W / 2, 0],
        [W / 2, 0],
        [W / 2, H],
      ],
      -0.008,
    )
    const trough = xform(prism(outline, 2 * CH_X + 0.5), mat4.c(mat4.t(0, CH_FLOOR, 0), mat4.ry(PI / 2)))
    const link = xform(chainLink(CH_PITCH, 0.026, 0.05), mat4.t(CH_PITCH / 2, 0, 0))
    const flight = xform(box(0.012, 0.13, W - 0.03), mat4.t(0, 0.09, 0))
    const spr = sprocket(CH_TEETH, CH_PITCH, 0.026, 0.035, 0.02)
    const shaft = xform(cylinder(0.02, W + 0.3, 16), mat4.rx(PI / 2))
    const leg = box(0.06, CH_FLOOR, 0.06)
    return { table, n, trough, link, flight, spr, shaft, yc, leg, H }
  }, [W])

  const links = useRef<THREE.InstancedMesh>(null)
  const flights = useRef<THREE.InstancedMesh>(null)
  const sprA = useRef<THREE.Group>(null)
  const sprB = useRef<THREE.Group>(null)
  const loadRef = useRef<THREE.InstancedMesh>(null)
  const st = useRef({ s: 0 })
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), p: new THREE.Vector3(), t: new THREE.Vector3(), m: new THREE.Matrix4(), n: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1) }), [])
  const NL = 300
  const load = useMemo(() => Array.from({ length: NL }, () => ({ s: random(), z: random() * 2 - 1, h: random() })), [])
  const clump = useMemo(() => new THREE.IcosahedronGeometry(0.018, 0), [])
  const FLIGHT_EVERY = 4

  useSimFrame((dt) => {
    const t = geo.table
    st.current.s = (st.current.s + p.chainV * dt) % t.length
    const a = st.current.s / CH_R
    sprA.current?.rotation.set(0, 0, a)
    sprB.current?.rotation.set(0, 0, a)
    const lm = links.current
    const fm = flights.current
    if (lm && fm) {
      let k = 0
      for (let i = 0; i < geo.n; i++) {
        const u = (st.current.s + (i * t.length) / geo.n) / t.length
        t.at(u, tmp.p, tmp.t)
        tmp.n.set(tmp.t.y, -tmp.t.x, 0) // outward normal of the counter-clockwise loop
        tmp.m.makeBasis(tmp.t, tmp.n, tmp.z)
        tmp.o.position.copy(tmp.p)
        tmp.o.quaternion.setFromRotationMatrix(tmp.m)
        tmp.o.scale.setScalar(1)
        tmp.o.updateMatrix()
        lm.setMatrixAt(i, tmp.o.matrix)
        if (i % FLIGHT_EVERY === 0) fm.setMatrixAt(k++, tmp.o.matrix)
      }
      lm.count = geo.n
      fm.count = k
      lm.instanceMatrix.needsUpdate = true
      fm.instanceMatrix.needsUpdate = true
    }
    // load: dragged along the trough floor on the lower run (moving +x), between the flights
    const m = loadRef.current
    if (!m) return
    const span = 2.6
    const depth = Math.min(0.13, p.chainDepth)
    for (let i = 0; i < NL; i++) {
      const q = load[i]
      q.s += (p.chainV * dt) / span
      if (q.s > 1.25) q.s -= 1.25
      if (q.s <= 1) tmp.o.position.set(-1.25 + q.s * span, CH_FLOOR + 0.02 + q.h * depth, q.z * (W / 2 - 0.03))
      else {
        const tt = ((q.s - 1) * span) / Math.max(0.2, p.chainV)
        tmp.o.position.set(1.35 + 0.05 * q.z, CH_FLOOR - 0.5 * G * tt * tt * 0.3, q.z * (W / 2 - 0.03))
      }
      tmp.o.rotation.set(i, i * 0.7, 0)
      tmp.o.scale.setScalar(1)
      tmp.o.updateMatrix()
      m.setMatrixAt(i, tmp.o.matrix)
    }
    m.count = NL
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <Part id="chain-conv" name="Scraper-flight chain conveyor" role="moving" material="steel" info={INFO.chain} cites={C.chain}>
      <Part id="chain-trough" name="Trough (casing)" role="housing" material="paintGreen" info={INFO.chainTrough} cites={C.chain} explode={[0, -0.25, 0]}>
        <PartMesh geometry={geo.trough} />
        {[-1.6, 0, 1.6].map((x) => [-1, 1].map((s) => <PartMesh key={`${x}${s}`} geometry={geo.leg} position={[x, CH_FLOOR / 2, s * (W / 2 + 0.05)]} />))}
      </Part>
      <Part id="chain" name="Roller chain" role="moving" material="steelDark" cut={false} info={INFO.chain} cites={C.chain}>
        <InstancedPartMesh ref={links} geometry={geo.link} count={geo.n + 2} />
        <Part id="flights" name="Scraper flights" role="moving" material="paintOrange" cut={false} info={INFO.chain} cites={C.chain}>
          <InstancedPartMesh ref={flights} geometry={geo.flight} count={Math.ceil(geo.n / FLIGHT_EVERY) + 2} />
        </Part>
      </Part>
      <Part id="sprockets" name="Head and tail sprockets" role="moving" material="steel" info={INFO.sprockets} cites={C.chain} explode={[0, 0, 0.3]}>
        <group position={[-CH_X, geo.yc, 0]}>
          <group ref={sprA}>
            <PartMesh geometry={geo.spr} />
          </group>
          <PartMesh geometry={geo.shaft} />
        </group>
        <group position={[CH_X, geo.yc, 0]}>
          <group ref={sprB}>
            <PartMesh geometry={geo.spr} />
          </group>
          <PartMesh geometry={geo.shaft} />
        </group>
      </Part>
      <Part id="chain-load" name="Material on the trough floor" role="moving" material="grain" cut={false} info={INFO.load}>
        <InstancedPartMesh ref={loadRef} geometry={clump} count={NL} />
      </Part>
      <Part id="chain-drive" name="Motor and gearbox" role="housing" material="paintBlue" info={INFO.drive} explode={[0, 0, 0.3]}>
        <PartMesh geometry={useMemo(() => box(0.28, 0.24, 0.26), [])} position={[CH_X, geo.yc, W / 2 + 0.35]} />
      </Part>
    </Part>
  )
}

/* =============================== SCREW =============================== */

const SC_L = 2.9
const SC_Y = 0.9

function ScrewConveyor() {
  const p = useConv()
  const D = Math.min(0.4, Math.max(0.1, p.D))
  const d = Math.min(D * 0.6, p.d)
  const pitch = pitchOf({ D, flight: p.flight })
  const geo = useMemo(() => {
    const rIn = p.flight === 'ribbon' ? d / 2 + 0.35 * (D / 2 - d / 2) : d / 2
    const flight = screwFlight(rIn, D / 2, pitch, SC_L, 0.008)
    const arms =
      p.flight === 'ribbon'
        ? merge(
            ...Array.from({ length: Math.floor(SC_L / (pitch / 2)) }, (_, i) => {
              const x = -SC_L / 2 + (i + 0.5) * (pitch / 2)
              const ang = (2 * PI * x) / pitch - PI / 2
              return xform(box(0.012, rIn - d / 2 + 0.01, 0.02), mat4.c(mat4.rx(ang), mat4.t(x, d / 2 + (rIn - d / 2) / 2, 0)))
            }),
          )
        : null
    const shaft = xform(cylinder(d / 2, SC_L + 0.4, 24), mat4.rz(PI / 2))
    const trough = uTrough(D / 2 + 0.012, 0.006, SC_L + 0.1, D / 2 + 0.06)
    const plate = box(0.012, D + 0.2, D + 0.06)
    const inlet = boxShell(D * 0.9, D * 0.9, 0.3, 0.008)
    const outlet = boxShell(D * 0.8, D * 0.8, 0.25, 0.008)
    const leg = box(0.06, 1, 0.06)
    return { flight, arms, shaft, trough, plate, inlet, outlet, leg }
  }, [D, d, pitch, p.flight])

  const rot = useRef<THREE.Group>(null)
  const loadRef = useRef<THREE.InstancedMesh>(null)
  const NL = 260
  const load = useMemo(() => Array.from({ length: NL }, () => ({ s: random(), a: random(), r: random() })), [])
  const clump = useMemo(() => new THREE.IcosahedronGeometry(0.016, 0), [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const th = useRef(0)
  useSimFrame((dt) => {
    th.current -= ((p.n * 2 * PI) / 60) * dt
    rot.current?.rotation.set(th.current, 0, 0)
    live.rpm = p.n
    const m = loadRef.current
    if (!m) return
    const span = SC_L - 0.35
    const vAx = (pitch * p.n) / 60
    const fill = Math.min(0.9, Math.max(0.15, p.eff))
    for (let i = 0; i < NL; i++) {
      const q = load[i]
      q.s += (vAx * dt) / span
      if (q.s > 1.15) q.s -= 1.15
      // particles sit in the lower part of the trough, heaped up the rising side
      const half = fill * 1.25
      const ang = -PI / 2 + (q.a * 2 - 1) * half + 0.35 * fill
      const rr = (D / 2) * (0.35 + 0.6 * q.r)
      if (q.s <= 1) tmp.position.set(-SC_L / 2 + 0.25 + q.s * span, SC_Y + rr * sin(ang), rr * cos(ang))
      else {
        const t = ((q.s - 1) * span) / Math.max(0.05, vAx)
        tmp.position.set(SC_L / 2 - 0.12 + 0.05 * (q.a - 0.5), SC_Y - D / 2 - 0.5 * G * t * t * 0.2, (q.r - 0.5) * D * 0.5)
      }
      tmp.rotation.set(i, i, 0)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.count = NL
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <Part id="screw-conv" name="Screw (auger) conveyor" role="moving" material="steel" info={INFO.flight} cites={C.screw}>
      <Part id="screw-trough" name="U-trough" role="housing" material="galvanised" info={INFO.screwTrough} cites={C.screw} explode={[0, -0.3, 0]}>
        <PartMesh geometry={geo.trough} position={[0, SC_Y, 0]} />
        <PartMesh geometry={geo.plate} position={[-SC_L / 2 - 0.06, SC_Y, 0]} material="paintGrey" />
        <PartMesh geometry={geo.plate} position={[SC_L / 2 + 0.06, SC_Y, 0]} material="paintGrey" />
        {[-1.3, 1.3].map((x) => [-1, 1].map((s) => <PartMesh key={`${x}${s}`} geometry={geo.leg} position={[x, (SC_Y - D / 2) / 2, s * (D / 2 + 0.04)]} scale={[1, SC_Y - D / 2, 1]} />))}
      </Part>
      <group position={[0, SC_Y, 0]}>
        <group ref={rot}>
          <Part id="flight" name={p.flight === 'ribbon' ? 'Ribbon flight' : p.flight === 'half' ? 'Half-pitch flight' : 'Standard-pitch flight'} role="moving" material="steel" info={INFO.flight} cites={C.screw}>
            <PartMesh geometry={geo.flight} />
            {geo.arms ? <PartMesh geometry={geo.arms} /> : null}
          </Part>
          <Part id="screw-shaft" name="Shaft" role="moving" material="steelDark" info={INFO.shaft} cites={C.screw}>
            <PartMesh geometry={geo.shaft} />
          </Part>
        </group>
      </group>
      <Part id="screw-inlet" name="Inlet spout" role="housing" material="galvanised" info={INFO.inlet} explode={[0, 0.3, 0]}>
        <PartMesh geometry={geo.inlet} position={[-SC_L / 2 + 0.3, SC_Y + D / 2 + 0.2, 0]} />
      </Part>
      <Part id="screw-outlet" name="Outlet spout" role="housing" material="galvanised" info={INFO.outlet} explode={[0, -0.3, 0]}>
        <PartMesh geometry={geo.outlet} position={[SC_L / 2 - 0.12, SC_Y - D / 2 - 0.12, 0]} />
      </Part>
      <Part id="screw-load" name="Material" role="moving" material="grain" cut={false} info={INFO.load}>
        <InstancedPartMesh ref={loadRef} geometry={clump} count={NL} />
      </Part>
      <Part id="screw-drive" name="Motor and gearbox" role="housing" material="paintBlue" info={INFO.drive} explode={[-0.3, 0, 0]}>
        <PartMesh geometry={useMemo(() => box(0.3, 0.25, 0.25), [])} position={[-SC_L / 2 - 0.3, SC_Y, 0]} />
      </Part>
    </Part>
  )
}

/* =============================== BUCKET ELEVATOR =============================== */

const BK_Y0 = 0.5
const BK_Y1 = 3.4

function bucketGeometry(w: number) {
  const prof: [number, number][] = [
    [0.02, 0.004],
    [-0.12, 0.004],
    [-0.125, 0.06],
    [-0.095, 0.115],
    [-0.03, 0.15],
    [0.03, 0.16],
  ]
  const shell = prism(thickPolyline(prof, 0.006), w)
  const fill = prof.map(([x, y]) => new THREE.Vector2(x, y))
  const side = prism(fill, 0.006)
  return merge(shell, xform(side, mat4.t(0, 0, w / 2)), xform(side, mat4.t(0, 0, -w / 2)))
}

function BucketElevator() {
  const p = useConv()
  const a = useMemo(() => analyse(p), [p])
  const R = Math.min(0.4, Math.max(0.15, p.headR))
  const spacing = p.discharge === 'continuous' ? 0.17 : 0.42
  const geo = useMemo(() => {
    const lp = loopPath(new THREE.Vector2(0, BK_Y0), R, new THREE.Vector2(0, BK_Y1), R)
    const table = new PathTable(lp.path, 900)
    const pts = table.pts.slice(0, -1)
    const band = sweepRing(pts, () => [
      [-0.15, 0],
      [0.15, 0],
      [0.15, 0.008],
      [-0.15, 0.008],
    ])
    const nb = Math.floor(table.length / spacing)
    const bucket = bucketGeometry(0.26)
    const heap = xform(new THREE.SphereGeometry(0.06, 10, 6, 0, 2 * PI, 0, PI / 2), mat4.c(mat4.t(-0.06, 0.075, 0), mat4.rz(-PI / 2)))
    const pulley = xform(
      lathe(
        [
          [0.02, -0.17],
          [R - 0.01, -0.17],
          [R, -0.15],
          [R, 0.15],
          [R - 0.01, 0.17],
          [0.02, 0.17],
        ],
        40,
      ),
      mat4.rx(PI / 2),
    )
    const shaft = xform(cylinder(0.03, 0.7, 16), mat4.rx(PI / 2))
    const legH = BK_Y1 - BK_Y0 - 0.9
    const leg = boxShell(0.24, 0.38, legH, 0.006)
    const hood = boxShell(2 * R + 0.62, 0.42, 0.8, 0.008)
    const roof = box(2 * R + 0.62, 0.012, 0.42)
    const bootB = boxShell(2 * R + 0.62, 0.42, 0.75, 0.008)
    const floor = box(2 * R + 0.62, 0.012, 0.42)
    const spout = boxShell(0.3, 0.3, 1.0, 0.008)
    const inlet = boxShell(0.24, 0.3, 0.6, 0.008)
    return { table, band, nb, bucket, heap, pulley, shaft, leg, legH, hood, roof, bootB, floor, spout, inlet }
  }, [R, spacing])

  const bk = useRef<THREE.InstancedMesh>(null)
  const fills = useRef<THREE.InstancedMesh>(null)
  const head = useRef<THREE.Group>(null)
  const boot = useRef<THREE.Group>(null)
  const grains = useRef<THREE.InstancedMesh>(null)
  const NG = 360
  const pool = useMemo(() => Array.from({ length: NG }, () => ({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0 })), [])
  const prevTheta = useRef<number[]>([])
  const st = useRef({ s: 0, next: 0 })
  const grainGeo = useMemo(() => new THREE.IcosahedronGeometry(0.014, 0), [])
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1), m: new THREE.Matrix4() }), [])
  const releaseRad = (a.headK >= 1 ? -8 : a.releaseDeg) * (PI / 180)

  useSimFrame((dt) => {
    const t = geo.table
    const v = p.bucketV
    st.current.s = (st.current.s + v * dt) % t.length
    head.current?.rotation.set(0, 0, st.current.s / R)
    boot.current?.rotation.set(0, 0, st.current.s / R)
    const bm = bk.current
    const fm = fills.current
    if (!bm || !fm) return
    let kf = 0
    const prev = prevTheta.current
    for (let i = 0; i < geo.nb; i++) {
      const u = (st.current.s + i * spacing) / t.length
      t.at(u, tmp.p, tmp.t)
      // loop runs: down the left leg, round the boot, up the right leg, over the head
      tmp.n.set(tmp.t.y, -tmp.t.x, 0)
      tmp.m.makeBasis(tmp.t, tmp.n, tmp.z)
      tmp.o.position.copy(tmp.p)
      tmp.o.quaternion.setFromRotationMatrix(tmp.m)
      tmp.o.scale.setScalar(1)
      tmp.o.updateMatrix()
      bm.setMatrixAt(i, tmp.o.matrix)
      // angle from the top of the head pulley towards the discharge (−x) side
      const onHead = tmp.p.y > BK_Y1 - 0.02
      const theta = onHead ? Math.atan2(-tmp.p.x, tmp.p.y - BK_Y1) : tmp.p.x > 0 ? -PI / 2 : PI
      const loaded = (tmp.p.x > 0 && tmp.p.y > BK_Y0 - R * 0.2) || (onHead && theta < releaseRad)
      if (loaded) fm.setMatrixAt(kf++, tmp.o.matrix)
      const before = prev[i] ?? theta
      if (before < releaseRad && theta >= releaseRad && Math.abs(theta - before) < 1) {
        // spill: grains leave the bucket mouth with the bucket's velocity
        for (let k = 0; k < 9; k++) {
          const g = pool[st.current.next]
          st.current.next = (st.current.next + 1) % NG
          g.alive = true
          g.age = 0
          g.p.copy(tmp.p).addScaledVector(tmp.n, 0.06 + 0.06 * random()).addScaledVector(tmp.t, (random() - 0.5) * 0.08)
          g.p.z = (random() - 0.5) * 0.22
          g.v.copy(tmp.t).multiplyScalar(v * (0.9 + 0.2 * random()))
        }
      }
      prev[i] = theta
    }
    fm.count = kf
    bm.count = geo.nb
    bm.instanceMatrix.needsUpdate = true
    fm.instanceMatrix.needsUpdate = true
    const gm = grains.current
    if (!gm) return
    for (let i = 0; i < NG; i++) {
      const g = pool[i]
      if (g.alive) {
        g.age += dt
        g.v.y -= G * dt
        g.p.addScaledVector(g.v, dt)
        // spout floor: an incline down and away on the −x side
        const spoutY = BK_Y1 - 0.25 + (g.p.x + R + 0.1) * 0.9
        if (g.p.x < -R - 0.1 && g.p.y < spoutY) {
          g.p.y = spoutY
          g.v.set(-0.9, -0.9, 0).multiplyScalar(1.4)
        }
        if (g.age > 3 || g.p.y < 0.8) g.alive = false
      }
      tmp.o.position.copy(g.alive ? g.p : V3(0, -50, 0))
      tmp.o.quaternion.identity()
      tmp.o.scale.setScalar(g.alive ? 1 : 0.0001)
      tmp.o.updateMatrix()
      gm.setMatrixAt(i, tmp.o.matrix)
    }
    gm.count = NG
    gm.instanceMatrix.needsUpdate = true
  })

  const bootCurve = useMemo(() => new THREE.CatmullRomCurve3([V3(R + 0.75, 1.3, 0), V3(R + 0.45, 1.0, 0), V3(R + 0.2, 0.75, 0), V3(R * 0.6, 0.5, 0)]), [R])
  const legY = BK_Y0 + 0.4 + geo.legH / 2
  return (
    <Part id="bucket-el" name="Bucket elevator" role="moving" material="paintGrey" info={INFO.bucketEl} cites={C.bucket}>
      <Part id="el-legs" name="Legs (casing)" role="housing" material="galvanised" info={INFO.legs} cites={C.bucket} explode={[0, 0, -0.4]}>
        <PartMesh geometry={geo.leg} position={[R + 0.09, legY, 0]} />
        <PartMesh geometry={geo.leg} position={[-R - 0.09, legY, 0]} />
      </Part>
      <Part id="el-head" name="Head: pulley and hood" role="housing" material="paintGrey" info={INFO.head} cites={C.bucket} explode={[0, 0.4, 0]}>
        <PartMesh geometry={geo.hood} position={[0, BK_Y1 + 0.03, 0]} />
        <PartMesh geometry={geo.roof} position={[0, BK_Y1 + 0.43, 0]} />
        <Part id="el-head-pulley" name="Head pulley (drive)" role="moving" material="castIron" info={INFO.head} cites={C.bucket}>
          <group position={[0, BK_Y1, 0]}>
            <group ref={head}>
              <PartMesh geometry={geo.pulley} />
            </group>
            <PartMesh geometry={geo.shaft} material="steel" />
          </group>
        </Part>
      </Part>
      <Part id="el-boot" name="Boot with inlet" role="housing" material="paintGrey" info={INFO.boot} cites={C.bucket} explode={[0, -0.2, 0]}>
        <PartMesh geometry={geo.bootB} position={[0, BK_Y0 - 0.025, 0]} />
        <PartMesh geometry={geo.floor} position={[0, BK_Y0 - 0.4, 0]} />
        <PartMesh geometry={geo.inlet} position={[R + 0.5, 0.95, 0]} rotation={[0, 0, PI / 4]} />
        <Part id="el-boot-pulley" name="Boot pulley" role="moving" material="castIron" info={INFO.boot}>
          <group position={[0, BK_Y0, 0]}>
            <group ref={boot}>
              <PartMesh geometry={geo.pulley} />
            </group>
            <PartMesh geometry={geo.shaft} material="steel" />
          </group>
        </Part>
      </Part>
      <Part id="el-belt" name="Elevator belt" role="moving" material="rubber" info={INFO.buckets} cites={C.bucket}>
        <PartMesh geometry={geo.band} />
      </Part>
      <Part id="buckets" name="Buckets" role="moving" material="paintOrange" cut={false} info={INFO.buckets} cites={C.bucket}>
        <InstancedPartMesh ref={bk} geometry={geo.bucket} count={geo.nb + 1} />
        <Part id="bucket-fill" name="Grain in the buckets" role="moving" material="grain" cut={false} info={INFO.load}>
          <InstancedPartMesh ref={fills} geometry={geo.heap} count={geo.nb + 1} />
        </Part>
      </Part>
      <Part id="spout" name="Discharge spout" role="housing" material="galvanised" info={INFO.spout} cites={C.bucket} explode={[-0.3, 0, 0]}>
        <PartMesh geometry={geo.spout} position={[-R - 0.62, BK_Y1 - 0.62, 0]} rotation={[0, 0, -0.84]} />
      </Part>
      <Part id="el-grain" name="Discharged grain" role="moving" material="grain" cut={false} info={INFO.load}>
        <InstancedPartMesh ref={grains} geometry={grainGeo} count={NG} />
      </Part>
      <Flow curve={bootCurve} count={50} radius={0.012} color="#d6b25e" intensity={() => 1} speed={0.6} spread={0.08} emissive={0.15} />
      <PartLabel partId="el-head-pulley" at={[0, BK_Y1 + 0.55, 0.25]} />
      <PartLabel partId="buckets" at={[R + 0.3, 2.2, 0.2]} />
      <PartLabel partId="el-boot" at={[R + 0.5, 0.3, 0.25]} />
      <PartLabel partId="spout" at={[-R - 0.9, BK_Y1 - 0.9, 0.2]} />
    </Part>
  )
}

/* =============================== PNEUMATIC =============================== */

export function cycloneShell(scale = 1) {
  const s = scale
  return lathe(
    [
      [0.07 * s, 1.5 * s],
      [0.08 * s, 1.5 * s],
      [0.36 * s, 2.3 * s],
      [0.36 * s, 3.1 * s],
      [0.13 * s, 3.1 * s],
      [0.13 * s, 3.45 * s],
      [0.12 * s, 3.45 * s],
      [0.12 * s, 2.7 * s],
      [0.13 * s, 2.7 * s],
      [0.13 * s, 3.09 * s],
      [0.35 * s, 3.09 * s],
      [0.35 * s, 2.3 * s],
    ],
    48,
  )
}

function Pneumatic() {
  const p = useConv()
  const suction = p.mode === 'suction'
  const CX = 2.0
  const geo = useMemo(() => {
    const pts = suction
      ? [V3(-1.6, 0.25), V3(-1.4, 0.55), V3(-0.9, 0.8), V3(0.6, 0.8), V3(1.0, 1.2), V3(1.05, 2.6), V3(1.35, 2.95, -0.28), V3(CX - 0.1, 2.95, -0.28)]
      : [V3(-1.75, 0.8), V3(-0.9, 0.8), V3(0.6, 0.8), V3(1.0, 1.2), V3(1.05, 2.6), V3(1.35, 2.95, -0.28), V3(CX - 0.1, 2.95, -0.28)]
    const duct = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.3)
    const ductG = pipe(duct, 0.065, 0.055, 120, 18)
    const cyc = cycloneShell()
    const fanCase = xform(cylinder(0.32, 0.22, 40), mat4.rx(PI / 2))
    const nozzle = tube(0.11, 0.06, 0.15, 24)
    const impeller = merge(...Array.from({ length: 8 }, (_, i) => xform(box(0.24, 0.02, 0.16), mat4.c(mat4.rz((i * PI) / 4), mat4.t(0.13, 0, 0)))), xform(cylinder(0.05, 0.18, 16), mat4.rx(PI / 2)))
    const motor = xform(cylinder(0.12, 0.3, 24), mat4.rx(PI / 2))
    const hop = hopper(0.5, 0.16, 0.4)
    const lock = xform(cylinder(0.12, 0.22, 32), mat4.rx(PI / 2))
    const rotor = merge(...Array.from({ length: 6 }, (_, i) => xform(box(0.2, 0.012, 0.2), mat4.rz((i * PI) / 6))))
    const outlet = pipe(new THREE.CatmullRomCurve3([V3(CX, 3.4), V3(CX, 3.75), V3(CX + 0.3, 3.95), V3(CX + 0.9, 3.95)]), 0.065, 0.055, 40, 16)
    const bin = boxShell(0.5, 0.5, 0.7, 0.01)
    const leg = box(0.05, 1.5, 0.05)
    const heap = lathe(
      [
        [0, 0],
        [0.5, 0],
        [0, 0.28],
      ],
      32,
    )
    return { duct, ductG, cyc, fanCase, nozzle, impeller, motor, hop, lock, rotor, outlet, bin, leg, heap }
  }, [suction])

  const spiralDown = useMemo(() => {
    const pts: THREE.Vector3[] = [V3(CX - 0.15, 2.95, -0.28)]
    for (let i = 0; i <= 60; i++) {
      const t = i / 60
      const y = 2.95 - t * 1.35
      const r = y > 2.3 ? 0.32 : 0.08 + ((y - 1.5) / 0.8) * 0.26
      const a = -PI / 2 - t * 5 * 2 * PI
      pts.push(V3(CX + r * cos(a) * 0.95, y, -r * sin(a) * 0.95))
    }
    pts.push(V3(CX, 1.3), V3(CX, 0.9))
    return new THREE.CatmullRomCurve3(pts)
  }, [])
  const spiralUp = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const y = 1.9 + t * 1.5
      const a = -PI / 2 - t * 3 * 2 * PI
      const r = 0.07
      pts.push(V3(CX + r * cos(a), y, -r * sin(a)))
    }
    pts.push(V3(CX, 3.8), V3(CX + 0.3, 3.95), V3(CX + 0.9, 3.95))
    return new THREE.CatmullRomCurve3(pts)
  }, [])

  const fanRef = useRef<THREE.Group>(null)
  const lockRef = useRef<THREE.Group>(null)
  useSimFrame((dt) => {
    if (fanRef.current) fanRef.current.rotation.z -= 60 * dt
    if (lockRef.current) lockRef.current.rotation.z -= 2 * dt
  })
  const fanPos: [number, number, number] = suction ? [CX + 1.15, 3.95, 0] : [-2.0, 0.8, 0]
  const k = () => Math.min(1, p.airV / 25)
  return (
    <Part id="pneumatic" name={suction ? 'Pneumatic conveyor (suction)' : 'Pneumatic conveyor (positive pressure)'} role="moving" material="galvanised" info={INFO.duct} cites={C.pneu}>
      <Part id="fan" name="Fan (blower)" role="housing" material="paintBlue" info={INFO.fan} cites={C.pneu} explode={[-0.3, 0, 0]}>
        <group position={fanPos}>
          <PartMesh geometry={geo.fanCase} />
          <PartMesh geometry={geo.motor} position={[0, 0, -0.3]} material="paintGreen" />
          <Part id="impeller" name="Fan impeller" role="moving" material="steel" info={INFO.fan}>
            <group ref={fanRef} position={[0, 0, 0]}>
              <PartMesh geometry={geo.impeller} />
            </group>
          </Part>
        </group>
      </Part>
      {suction ? (
        <>
          <Part id="nozzle" name="Suction nozzle" role="housing" material="galvanised" info={INFO.nozzle} cites={C.pneu}>
            <PartMesh geometry={geo.nozzle} position={[-1.6, 0.2, 0]} />
          </Part>
          <Part id="heap" name="Grain heap" role="static" material="grain" info={INFO.load}>
            <PartMesh geometry={geo.heap} position={[-1.6, 0, 0]} />
          </Part>
        </>
      ) : (
        <Part id="airlock" name="Hopper and rotary airlock" role="housing" material="galvanised" info={INFO.airlock} cites={C.pneu} explode={[0, 0.3, 0]}>
          <PartMesh geometry={geo.hop} position={[-0.9, 1.15, 0]} />
          <PartMesh geometry={geo.lock} position={[-0.9, 1.0, 0]} material="castIron" />
          <group ref={lockRef} position={[-0.9, 1.0, 0.0]}>
            <PartMesh geometry={geo.rotor} material="steel" />
          </group>
        </Part>
      )}
      <Part id="duct" name="Conveying duct" role="housing" material="galvanised" info={INFO.duct} cites={C.pneu}>
        <PartMesh geometry={geo.ductG} />
        <PartMesh geometry={geo.outlet} />
      </Part>
      <Part id="cyclone" name="Cyclone collector" role="housing" material="galvanised" info={INFO.cyclone} cites={[...C.pneu, ...C.sep]} explode={[0.3, 0, 0]}>
        <PartMesh geometry={geo.cyc} position={[CX, 0, 0]} />
        {[0, 1, 2, 3].map((i) => (
          <PartMesh key={i} geometry={geo.leg} position={[CX + 0.3 * cos((i * PI) / 2 + PI / 4), 1.5 / 2 + 0.75, 0.3 * sin((i * PI) / 2 + PI / 4)]} material="paintGrey" />
        ))}
        <PartMesh geometry={geo.bin} position={[CX, 0.36, 0]} material="paintGrey" />
      </Part>
      <Flow curve={geo.duct} count={110} radius={0.012} color="#d6b25e" intensity={k} speed={Math.max(0.2, p.airV / 25) * 0.9} spread={0.06} emissive={0.2} />
      <Flow curve={geo.duct} count={50} radius={0.006} color="#9fd3ff" intensity={k} speed={Math.max(0.2, p.airV / 25) * 1.3} spread={0.08} />
      <Flow curve={spiralDown} count={120} radius={0.011} color="#d6b25e" intensity={k} speed={0.35} spread={0.03} emissive={0.2} />
      <Flow curve={spiralUp} count={60} radius={0.007} color="#9fd3ff" intensity={k} speed={0.5} spread={0.02} />
      <PartLabel partId="fan" at={[fanPos[0], fanPos[1] + 0.45, 0.2]} />
      <PartLabel partId="cyclone" at={[CX + 0.5, 2.8, 0.3]} />
      <PartLabel partId="duct" at={[0, 0.95, 0.15]} />
      {suction ? <PartLabel partId="nozzle" at={[-1.6, 0.6, 0.2]} /> : <PartLabel partId="airlock" at={[-0.9, 1.7, 0.2]} />}
    </Part>
  )
}

export function Conveyors3D() {
  const kind = useConv((s) => s.kind)
  return (
    <group>
      {kind === 'belt' ? (
        <>
          <BeltConveyor />
          <PartLabel partId="belt-band" at={[0.4, 1.35, 0.2]} />
          <PartLabel partId="head-pulley" at={[-1.6, 1.55, 0.3]} />
          <PartLabel partId="carry-idlers" at={[0.6, 0.85, 0.5]} />
          <PartLabel partId="feed-hopper" at={[1.1, 1.75, 0]} />
          <PartLabel partId="belt-drive" at={[-1.6, 1.4, -0.9]} />
        </>
      ) : kind === 'chain' ? (
        <>
          <ChainConveyor />
          <PartLabel partId="chain" at={[0, 1.15, 0.1]} />
          <PartLabel partId="flights" at={[0.4, 0.62, 0.2]} />
          <PartLabel partId="sprockets" at={[-1.5, 1.2, 0.2]} />
          <PartLabel partId="chain-trough" at={[1.0, 0.5, 0.25]} />
        </>
      ) : kind === 'screw' ? (
        <>
          <ScrewConveyor />
          <PartLabel partId="flight" at={[0.2, 1.15, 0.15]} />
          <PartLabel partId="screw-trough" at={[0.8, 0.7, 0.25]} />
          <PartLabel partId="screw-inlet" at={[-1.15, 1.5, 0]} />
          <PartLabel partId="screw-outlet" at={[1.35, 0.5, 0]} />
        </>
      ) : kind === 'bucket' ? (
        <BucketElevator />
      ) : (
        <Pneumatic />
      )}
    </group>
  )
}

