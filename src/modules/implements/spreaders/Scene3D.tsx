import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, extrude, lathe, merge, pipe, tube } from '@/geometry'
import { dragK } from '@/physics/application'
import { InstancedPartMesh } from '@/modules/traction/tracks/InstancedPartMesh'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { PTO_STUB_X, PTO_Y } from '@/tractor/geometry'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { Level } from '../_shared/field'
import { bar, plateXY, rod } from '../_shared/geom'
import { Ground, Particles, PtoDriveline, ballistic, drawBallistic, emit, stepBallistic, wheelGeometry, type Treadmill } from '../_appkit/three'
import { BC, C, DISC_H, GRANULE, HITCH_H, HX, HY, MS, MS_LOAD_H, PTO_LOCAL, gateFlow, live, manure, useSpreader } from './model'

const { PI } = Math
export const pose = createTractorPose({ hitchHeight: HITCH_H })
const mill: Treadmill = { s: 0 }
const clock = { pto: 0, disc: 0, agit: 0, wheel: 0, ratchet: 0, apron: 0, beater: 0 }
const granules = ballistic(1400)
const dung = ballistic(900)
const K_GRANULE = dragK(GRANULE.d, GRANULE.rhoP)
/** world position of the drawbar pin */
const PIN = { x: TRACTOR.drawbar.x, y: TRACTOR.drawbar.y }

const AM = {
  bc: [C.am('§14.4.1 spinning-disc broadcaster')],
  ms: [C.am('§14.3.1 manure spreader, Fig 14.2')],
  cal: [C.am('§14.7 calibration of spinner')],
}
const BEYOND = 'Sizes are typical.'

const INFO = {
  broadcaster: {
    summary: 'Spinning-disc (centrifugal) fertilizer broadcaster, three-point mounted.',
    role: 'Meters granular fertilizer through a gate onto a spinning disc that throws it out in a wide band. Spread width is about 6–9 m.',
    details: 'Rate depends on the gate opening, the forward speed and the disc speed. ' + BEYOND,
  },
  hopper: { summary: 'Cone-shaped hopper (plastic or fibreglass).', role: 'Holds the fertilizer above the outlet so it feeds down by gravity; the corrosion-proof material resists the salts.' },
  fert: { summary: 'Granular fertilizer.', role: 'Level falls as the machine spreads.' },
  agitator: { summary: 'Agitator.', role: 'Turns in the hopper outlet to stop the fertilizer bridging or caking, so the flow through the gate stays steady.' },
  gate: { summary: 'Adjustable shutter (feed gate).', role: 'Its opening sets the flow of fertilizer onto the disc — the main rate adjustment. It also shuts the flow off at headlands.' },
  disc: { summary: 'Spinning disc with vanes, PTO-driven.', role: 'Granules dropped near the centre are flung out along the vanes and leave the rim at roughly √2 × the tip speed, travelling several metres before they land.', details: 'Exit speed ω√(2R² − r₀²) for a frictionless vane.' },
  gearbox: { summary: 'Disc gearbox (bevel).', role: 'Turns the horizontal PTO drive through 90° to the vertical disc shaft and sets the disc speed (about 420 rpm here from the 540 rpm PTO; the ratio is typical).' },
  frame: { summary: 'Mounting frame and A-mast.', role: 'Carries the hopper on the three-point linkage.' },
  manure: {
    summary: 'Apron-and-beater manure spreader, trailed.',
    role: 'A box on wheels whose floor (apron) carries the manure slowly back into beaters that shred it and throw it out behind.',
    details: 'Driven by the ground wheels or the PTO. ' + BEYOND,
  },
  box: { summary: 'Box (body).', role: 'Holds the load; the floor is covered by the apron.' },
  load: { summary: 'Manure load.', role: 'Carried rearward by the apron into the beaters; the front face moves back as it empties.' },
  apron: { summary: 'Endless double chain-and-slat apron.', role: 'Slats on two chains drag the whole load slowly to the rear. The speed of the apron determines the volume of manure distributed.' },
  ratchet: { summary: 'Ratchet and pawl.', role: 'An eccentric on the wheel hub rocks the pawl, which advances the ratchet wheel — and the apron shaft — a few teeth each stroke. Setting how many teeth it takes per stroke sets the rate.' },
  lower: { summary: 'Lower beater.', role: 'Toothed beater that shreds the manure as it arrives; it turns opposite to the wheels at about 6–7 times wheel speed.' },
  upper: { summary: 'Upper beater.', role: 'Levels the load and breaks up the top of it.' },
  auger: { summary: 'Spiral auger (spreader).', role: 'Chain-driven from the beater shaft; its left- and right-hand flights throw the shredded manure sideways into a wide band.' },
  wheels: { summary: 'Ground wheels.', role: 'Carry the load and, on a ground-driven spreader, drive the apron and beaters, so the apron speed is tied to the forward speed.' },
  tongue: { summary: 'Hitch tongue.', role: 'Couples the spreader to the tractor drawbar.' },
}

/* ------------------------------ broadcaster geometry ------------------------------ */

function broadcasterGeometry() {
  const { hx, y0, y1, rTop, rOut, discY, R } = BC
  const hopper = lathe([
    [rOut - 0.012, y0],
    [rOut, y0],
    [rTop, y1],
    [rTop + 0.03, y1],
    [rTop + 0.03, y1 + 0.03],
    [rTop - 0.014, y1 + 0.03],
    [rOut - 0.012, y0 + 0.01],
  ], 48)
  hopper.translate(hx, 0, 0)
  const spout = tube(rOut + 0.006, rOut - 0.004, 0.12, 32)
  spout.translate(hx, y0 - 0.06, 0)
  // solid cone of fertilizer, apex below the outlet; scaled about the apex to show the level
  const H = y1 - y0
  const apex = (rOut * H) / (rTop - rOut)
  const fert = lathe([
    [0, 0],
    [rTop - 0.01, H + apex - 0.01],
    [0, H + apex - 0.01],
  ], 40)
  const agitator = merge(rod([0, -0.04, 0], [0, 0.32, 0], 0.012, 10), rod([-0.07, 0.04, 0], [0.07, 0.04, 0], 0.008, 8), rod([0, 0.14, -0.1], [0, 0.14, 0.1], 0.008, 8), rod([-0.12, 0.25, 0], [0.12, 0.25, 0], 0.008, 8))
  const gate = merge(box(0.22, 0.008, 0.2), rod([0.11, 0, 0.06], [0.32, 0.18, 0.06], 0.008, 8))
  const vanes: THREE.BufferGeometry[] = [cylinder(R, 0.008, 48), cylinder(0.03, 0.08, 16)]
  for (let k = 0; k < BC.vanes; k++) {
    const a = (k / BC.vanes) * 2 * PI
    const v = box(R - 0.05, 0.04, 0.008)
    v.translate((R + 0.05) / 2, 0.024, 0)
    v.rotateY(a)
    vanes.push(v)
  }
  const disc = merge(...vanes)
  const gearbox = merge(box(0.16, 0.11, 0.14), cylinder(0.05, 0.05, 20).translate(0, 0.08, 0), rod([0.08, 0, 0], [-0.12 - hx, 0, 0], 0.02, 12))
  gearbox.translate(hx, discY - 0.1, 0)
  // frame: lower-pin bar, A-mast to the top-link pin, hopper ring and struts
  const ring = lathe([[rTop * 0.8, -0.015], [rTop * 0.8 + 0.03, -0.015], [rTop * 0.8 + 0.03, 0.015], [rTop * 0.8, 0.015]], 40)
  ring.translate(hx, y0 + (y1 - y0) * 0.6, 0)
  const top: [number, number, number] = [0, 0.61, 0]
  const frame = merge(
    rod([0, 0, 0.47], [0, 0, -0.47], 0.016, 12),
    bar([0, 0, 0.4], [top[0], top[1], 0.04], 0.05, 0.012),
    bar([0, 0, -0.4], [top[0], top[1], -0.04], 0.05, 0.012),
    rod([0, 0.61, 0.06], [0, 0.61, -0.06], 0.012, 10),
    bar([0, 0.05, 0.35], [hx, y0 + 0.4, 0.35], 0.04, 0.04),
    bar([0, 0.05, -0.35], [hx, y0 + 0.4, -0.35], 0.04, 0.04),
    bar([0, 0.55, 0], [hx + 0.25, y0 + 0.4, 0], 0.04, 0.04),
    bar([hx, discY - 0.16, 0.3], [hx, y0 + 0.4, 0.35], 0.03, 0.03),
    bar([hx, discY - 0.16, -0.3], [hx, y0 + 0.4, -0.35], 0.03, 0.03),
    bar([hx - 0.08, discY - 0.16, 0.3], [hx - 0.08, discY - 0.16, -0.3], 0.03, 0.03),
    ring,
  )
  return { hopper, spout, fert, fertApex: apex, agitator, gate, disc, gearbox, frame }
}

/* ------------------------------ manure spreader geometry ------------------------------ */

function sawRatchet(teeth: number, R: number, depth: number, t: number) {
  const s = new THREE.Shape()
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * 2 * PI
    const a1 = ((i + 1) / teeth) * 2 * PI
    const p0 = [R * Math.cos(a0), R * Math.sin(a0)]
    const p1 = [(R - depth) * Math.cos(a1), (R - depth) * Math.sin(a1)]
    if (i === 0) s.moveTo(p0[0], p0[1])
    else s.lineTo(p0[0], p0[1])
    s.lineTo(p1[0], p1[1])
  }
  s.closePath()
  const g = extrude(s, t)
  g.translate(0, 0, -t / 2)
  return g
}

function helixFlight(z0: number, z1: number, R: number, turns: number, wire: number) {
  class Helix extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super()
    }
    getPoint(t: number, target = new THREE.Vector3()) {
      const a = t * turns * 2 * PI
      return target.set(R * Math.cos(a), R * Math.sin(a), z0 + (z1 - z0) * t)
    }
  }
  return pipe(new Helix(), wire, 0, Math.max(48, Math.round(Math.abs(turns) * 28)), 8)
}

function beaterGeometry(r: number, len: number, rows: number, perRow: number) {
  const core = cylinder(r * 0.45, len, 24)
  core.rotateX(PI / 2)
  const teeth: THREE.BufferGeometry[] = [core]
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < perRow; j++) {
      const z = -len / 2 + ((j + 0.5) / perRow) * len
      const a = (i / rows) * 2 * PI + j * 0.6
      teeth.push(rod([r * 0.4 * Math.cos(a), r * 0.4 * Math.sin(a), z], [r * Math.cos(a), r * Math.sin(a), z], 0.012, 6))
    }
  }
  return merge(...teeth)
}

function manureGeometry() {
  const { boxX0, boxX1, floorY, b, wallH } = MS
  const hb = b / 2
  const L = boxX0 - boxX1
  const body = merge(
    box(L, 0.03, b + 0.04).translate((boxX0 + boxX1) / 2, floorY - 0.015, 0),
    plateXY([[boxX1, floorY - 0.03], [boxX0, floorY - 0.03], [boxX0 + 0.08, floorY + wallH], [boxX1 - 0.15, floorY + wallH]], 0.02, hb + 0.01),
    plateXY([[boxX1, floorY - 0.03], [boxX0, floorY - 0.03], [boxX0 + 0.08, floorY + wallH], [boxX1 - 0.15, floorY + wallH]], 0.02, -hb - 0.03),
    box(0.03, wallH + 0.15, b + 0.08).translate(boxX0 + 0.05, floorY + (wallH + 0.15) / 2 - 0.03, 0),
    // chassis rails and axle beam
    bar([boxX0 + 0.1, floorY - 0.1, hb - 0.12], [boxX1, floorY - 0.1, hb - 0.12], 0.08, 0.12),
    bar([boxX0 + 0.1, floorY - 0.1, -hb + 0.12], [boxX1, floorY - 0.1, -hb + 0.12], 0.08, 0.12),
    rod([MS.axleX, 0, 0.95], [MS.axleX, 0, -0.95], 0.04, 14),
    bar([MS.axleX, 0, 0.6], [MS.axleX, floorY - 0.16, 0.5], 0.08, 0.06),
    bar([MS.axleX, 0, -0.6], [MS.axleX, floorY - 0.16, -0.5], 0.08, 0.06),
  )
  const tongue = merge(bar([0.02, 0, 0], [boxX0 + 0.05, floorY - 0.1, 0.4], 0.08, 0.08), bar([0.02, 0, 0], [boxX0 + 0.05, floorY - 0.1, -0.4], 0.08, 0.08), cylinder(0.05, 0.05, 20), box(0.25, 0.4, 0.06).translate(-0.6, -0.12, 0))
  const slat = box(0.035, 0.02, b - 0.06)
  const ratchet = sawRatchet(MS.ratchetTeeth, 0.16, 0.018, 0.02)
  const ratchetHub = cylinder(0.03, 0.08, 16).rotateX(PI / 2)
  const pawlArm = merge(bar([0, 0, 0], [0.24, 0, 0], 0.02, 0.03), bar([0.17, 0, 0], [0.13, -0.035, 0], 0.02, 0.012))
  const eccentric = merge(cylinder(0.07, 0.03, 20).rotateX(PI / 2), cylinder(0.015, 0.06, 10).rotateX(PI / 2).translate(0.05, 0, 0))
  const lower = beaterGeometry(MS.lower.r, b - 0.04, 6, 7)
  const upper = beaterGeometry(MS.upper.r, b - 0.04, 6, 7)
  const auger = merge(rod([0, 0, -MS.W / 2 + 1.0], [0, 0, MS.W / 2 - 1.0], 0.03, 12), helixFlight(0.02, 0.95, MS.auger.r, 3, 0.022), helixFlight(-0.02, -0.95, MS.auger.r, 3, 0.022))
  const chainCase = box(1.05, 0.9, 0.05).translate(-4.55, 0.7, hb + 0.08)
  const load = box(1, 1, 1)
  const wheel = wheelGeometry(MS.wheelR, 0.25)
  return { body, tongue, slat, ratchet, ratchetHub, pawlArm, eccentric, lower, upper, auger, chainCase, load, wheel }
}

/* ------------------------------ broadcaster ------------------------------ */

function Broadcaster() {
  const g = useMemo(broadcasterGeometry, [])
  const disc = useRef<THREE.Group>(null)
  const agit = useRef<THREE.Group>(null)
  const gate = useRef<THREE.Group>(null)
  const fert = useRef<THREE.Mesh>(null)
  const fertBase = BC.y0 - g.fertApex
  useSimFrame(() => {
    const st = useSpreader.getState()
    disc.current?.rotation.set(0, clock.disc, 0)
    agit.current?.rotation.set(0, clock.agit, 0)
    gate.current?.position.set(BC.hx - 0.2 * st.gate, BC.y0 - 0.125, 0)
    if (fert.current) {
      const s = Math.max(0.12, Math.cbrt(Math.max(0.0001, live.hopper)))
      fert.current.scale.setScalar(s)
      fert.current.position.set(BC.hx, fertBase, 0)
    }
  })
  return (
    <Part id="broadcaster" name="Spinning-disc broadcaster" role="housing" material="paintBlue" info={INFO.broadcaster} cites={AM.bc} beyondNotes>
      <Part id="frame" name="Frame and A-mast" role="static" material="paintBlue" info={INFO.frame} cites={AM.bc}>
        <PartMesh geometry={g.frame} />
      </Part>
      <Part id="hopper" name="Hopper" role="housing" material="paintOrange" info={INFO.hopper} cites={AM.bc} explode={[0, 0.6, 0]}>
        <PartMesh geometry={g.hopper} />
        <PartMesh geometry={g.spout} material="paintGrey" />
        <Part id="fertilizer" name="Fertilizer" role="fluid" material="grain" info={INFO.fert}>
          <PartMesh ref={fert} geometry={g.fert} />
        </Part>
      </Part>
      <Part id="agitator" name="Agitator" role="moving" material="steel" info={INFO.agitator} cites={AM.bc} explode={[0, 0.35, 0]}>
        <group ref={agit} position={[BC.hx, BC.y0 - 0.02, 0]}>
          <PartMesh geometry={g.agitator} />
        </group>
      </Part>
      <Part id="gate" name="Feed gate (shutter)" role="moving" material="galvanised" info={INFO.gate} cites={AM.bc} explode={[-0.3, 0, 0]}>
        <group ref={gate}>
          <PartMesh geometry={g.gate} />
        </group>
      </Part>
      <Part id="disc" name="Spinning disc and vanes" role="moving" material="steel" info={INFO.disc} cites={AM.bc} explode={[0, -0.15, 0]}>
        <group ref={disc} position={[BC.hx, BC.discY, 0]}>
          <PartMesh geometry={g.disc} />
        </group>
      </Part>
      <Part id="disc-gearbox" name="Disc gearbox" role="housing" material="castIron" info={INFO.gearbox} beyondNotes explode={[0, -0.3, 0]}>
        <PartMesh geometry={g.gearbox} />
      </Part>
      <PtoDriveline id="pto-shaft" from={PTO_LOCAL} to={[-0.12, BC.discY - 0.1, 0]} angle={() => clock.pto} />
    </Part>
  )
}

/* ------------------------------ manure spreader ------------------------------ */

function ManureSpreader() {
  const g = useMemo(manureGeometry, [])
  const pto = useSpreader((s) => s.drive === 'pto')
  const SLATS = 18
  const slats = useRef<THREE.InstancedMesh>(null)
  const wheels = useRef<(THREE.Group | null)[]>([])
  const ratchet = useRef<THREE.Group>(null)
  const pawl = useRef<THREE.Group>(null)
  const ecc = useRef<THREE.Group>(null)
  const rodRef = useRef<THREE.Mesh>(null)
  const lower = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)
  const auger = useRef<THREE.Group>(null)
  const load = useRef<THREE.Mesh>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const rodGeo = useMemo(() => {
    const r = cylinder(0.012, 1, 8)
    r.rotateZ(PI / 2)
    r.translate(0.5, 0, 0)
    return r
  }, [])
  const ratchetPos = new THREE.Vector3(MS.boxX1 + 0.2, MS.floorY - 0.02, MS.b / 2 + 0.07)
  const eccPos = new THREE.Vector3(MS.axleX, 0, MS.b / 2 + 0.07)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion(), x: new THREE.Vector3(1, 0, 0) }), [])

  useSimFrame(() => {
    for (const w of wheels.current) w?.rotation.set(0, 0, -clock.wheel)
    ratchet.current?.rotation.set(0, 0, -clock.ratchet)
    ecc.current?.rotation.set(0, 0, -clock.wheel)
    lower.current?.rotation.set(0, 0, clock.beater)
    upper.current?.rotation.set(0, 0, clock.beater * 0.8)
    auger.current?.rotation.set(0, 0, clock.beater * 1.6)
    // pawl rocks with the eccentric throw
    const th = pto ? clock.pto / 15 : clock.wheel
    const swing = 0.22 * Math.sin(th)
    pawl.current?.rotation.set(0, 0, PI * 0.12 + swing)
    // connecting rod from the eccentric pin to the pawl arm end
    if (rodRef.current && pawl.current) {
      tmp.a.set(eccPos.x + 0.05 * Math.cos(-th), eccPos.y + 0.05 * Math.sin(-th), eccPos.z + 0.04)
      const ang = PI * 0.12 + swing
      tmp.b.set(ratchetPos.x + 0.24 * Math.cos(ang), ratchetPos.y + 0.24 * Math.sin(ang), eccPos.z + 0.04)
      tmp.d.subVectors(tmp.b, tmp.a)
      rodRef.current.position.copy(tmp.a)
      rodRef.current.quaternion.setFromUnitVectors(tmp.x, tmp.d.clone().normalize())
      rodRef.current.scale.set(tmp.d.length(), 1, 1)
    }
    // apron slats round the floor loop: top strand moving rearward
    if (slats.current) {
      const L = MS.boxX0 - MS.boxX1 - 0.1
      const loop = 2 * L + 0.2
      for (let k = 0; k < SLATS; k++) {
        let u = (k / SLATS) * loop + clock.apron
        u = ((u % loop) + loop) % loop
        let x: number
        let y: number
        if (u < L) {
          x = MS.boxX0 - 0.05 - u
          y = MS.floorY + 0.012
        } else if (u < L + 0.1) {
          x = MS.boxX1 + 0.05
          y = MS.floorY + 0.012 - ((u - L) / 0.1) * 0.08
        } else if (u < 2 * L + 0.1) {
          x = MS.boxX1 + 0.05 + (u - L - 0.1)
          y = MS.floorY - 0.07
        } else {
          x = MS.boxX0 - 0.05
          y = MS.floorY - 0.07 + ((u - 2 * L - 0.1) / 0.1) * 0.08
        }
        m.makeTranslation(x, y, 0)
        slats.current.setMatrixAt(k, m)
      }
      slats.current.instanceMatrix.needsUpdate = true
    }
    if (load.current) {
      const L = (MS.boxX0 - MS.boxX1 - 0.12) * Math.max(0.02, live.load)
      load.current.scale.set(L, MS_LOAD_H, MS.b - 0.05)
      load.current.position.set(MS.boxX1 + 0.06 + L / 2, MS.floorY + 0.03 + MS_LOAD_H / 2, 0)
    }
  })

  return (
    <Part id="manure-spreader" name="Manure spreader" role="housing" material="paintRed" info={INFO.manure} cites={AM.ms} beyondNotes>
      <Part id="box" name="Box" role="housing" material="paintRed" info={INFO.box} cites={AM.ms}>
        <PartMesh geometry={g.body} />
        <Part id="tongue" name="Hitch tongue" role="static" material="paintRed" info={INFO.tongue}>
          <PartMesh geometry={g.tongue} />
        </Part>
        <Part id="manure-load" name="Manure load" role="fluid" material="soil" info={INFO.load}>
          <PartMesh ref={load} geometry={g.load} />
        </Part>
      </Part>
      <Part id="apron" name="Chain-and-slat apron" role="moving" material="steelDark" info={INFO.apron} cites={AM.ms} explode={[0, -0.25, 0]}>
        <InstancedPartMesh ref={slats} geometry={g.slat} count={SLATS} />
      </Part>
      <Part id="ratchet" name="Ratchet and pawl" role="moving" material="forged" info={INFO.ratchet} cites={AM.ms} explode={[0, 0, 0.3]}>
        <group position={ratchetPos}>
          <group ref={ratchet}>
            <PartMesh geometry={g.ratchet} />
            <PartMesh geometry={g.ratchetHub} material="steel" />
          </group>
          <group ref={pawl} position={[0, 0, 0.03]}>
            <PartMesh geometry={g.pawlArm} material="paintYellow" />
          </group>
        </group>
        <group ref={ecc} position={eccPos}>
          <PartMesh geometry={g.eccentric} material="steel" />
        </group>
        <PartMesh ref={rodRef} geometry={rodGeo} material="steel" />
      </Part>
      <Part id="beaters" name="Beaters" role="moving" material="steel" info={INFO.lower} cites={AM.ms} explode={[-0.4, 0, 0]}>
        <Part id="lower-beater" name="Lower beater" info={INFO.lower} cites={AM.ms}>
          <group ref={lower} position={[MS.lower.x, MS.lower.y, 0]}>
            <PartMesh geometry={g.lower} />
          </group>
        </Part>
        <Part id="upper-beater" name="Upper beater" info={INFO.upper} cites={AM.ms}>
          <group ref={upper} position={[MS.upper.x, MS.upper.y, 0]}>
            <PartMesh geometry={g.upper} />
          </group>
        </Part>
        <Part id="auger" name="Spiral auger spreader" info={INFO.auger} cites={AM.ms} explode={[-0.4, -0.1, 0]}>
          <group ref={auger} position={[MS.auger.x, MS.auger.y, 0]}>
            <PartMesh geometry={g.auger} material="paintYellow" />
          </group>
        </Part>
        <Part id="chain-case" name="Beater drive chain case" role="housing" material="paintRed" info={{ summary: 'Chain case.', role: 'Encloses the chain that drives the beaters and the auger from the beater shaft.' }}>
          <PartMesh geometry={g.chainCase} />
        </Part>
      </Part>
      <Part id="spreader-wheels" name="Ground wheels" role="moving" material="rubber" info={INFO.wheels} cites={AM.ms}>
        {[1, -1].map((s, i) => (
          <group key={s} position={[MS.axleX, 0, s * 0.95]} ref={(el) => {
            wheels.current[i] = el
          }}>
            <PartMesh geometry={g.wheel.tyre} />
            <PartMesh geometry={g.wheel.rim} material="paintYellow" />
          </group>
        ))}
      </Part>
      {pto && <PtoDriveline id="spreader-pto" from={[PTO_STUB_X - 0.06 - PIN.x, PTO_Y - PIN.y, 0]} to={[MS.boxX0 + 0.1, 0.12, 0]} angle={() => clock.pto} />}
    </Part>
  )
}

/* ------------------------------ scene ------------------------------ */

export function Spreaders3D() {
  const machine = useSpreader((s) => s.machine)
  const bout = useSpreader((s) => s.bout)
  const lineGeo = useMemo(() => box(1, 1, 1), [])

  useSimFrame((dt) => {
    if (dt <= 0) return
    const st = useSpreader.getState()
    const v = st.speed / 3.6
    mill.s += v * dt
    clock.pto += (dt * 2 * PI * 540) / 60
    pose.rearAngle += (v * dt) / TRACTOR.rear.rolling
    pose.frontAngle += (v * dt) / TRACTOR.front.radius
    pose.engineAngle += dt * 2 * PI * 30
    pose.ptoAngle = clock.pto
    pose.hitchHeight = HITCH_H
    live.dist += v * dt
    if (st.machine === 'broadcaster') {
      const mdot = gateFlow(st)
      clock.disc -= (dt * 2 * PI * st.discRpm) / 60
      clock.agit += dt * 2 * PI * 1.2
      // hopper ~ 400 kg; time-lapse ×20 so it visibly empties
      live.hopper -= (mdot * dt * 20) / 400
      if (live.hopper <= 0.02) live.hopper = 1
      // emit granules: one particle per ~3 g, capped
      const omega = (2 * PI * st.discRpm) / 60
      const vr = omega * Math.sqrt(BC.R * BC.R - BC.r0 * BC.r0)
      const vt = omega * BC.R
      const n = Math.min(40, Math.round((mdot * dt) / 0.003 + Math.random()))
      const cx = HX + BC.hx
      for (let i = 0; i < n; i++) {
        const psi = -1.4 + 2.8 * Math.random()
        const rx = -Math.cos(psi)
        const rz = Math.sin(psi)
        const f = 0.9 + 0.2 * Math.random()
        emit(granules, cx + BC.R * rx, DISC_H + 0.02, BC.R * rz, f * (vr * rx - vt * rz), 0.4 * Math.random(), f * (vr * rz + vt * rx))
      }
    } else {
      const ms = manure(st)
      clock.wheel += (v * dt) / MS.wheelR
      clock.ratchet += ((st.drive === 'ground' ? (v * dt) / MS.wheelR : (dt * 2 * PI * MS.ptoStrokes) / 60) / (2 * PI)) * st.teeth * ((2 * PI) / MS.ratchetTeeth)
      clock.apron += ms.u * dt
      clock.beater += (dt * 2 * PI * Math.max(ms.beater, 120)) / 60
      // one load lasts emptyTime; time-lapse ×10
      live.load -= (dt * 10) / ms.emptyTime
      if (live.load <= 0.01) live.load = 1
      const n = Math.min(30, Math.round(ms.mdot * dt * 1.6 + Math.random()))
      for (let i = 0; i < n; i++) {
        const z = (Math.random() - 0.5) * (MS.b - 0.1)
        emit(dung, PIN.x + MS.lower.x - 0.2, PIN.y + MS.lower.y + 0.1 * Math.random(), z, -3 - 3 * Math.random(), 1 + 2 * Math.random(), (z / (MS.b / 2)) * 2.2 + (Math.random() - 0.5) * 1.2)
      }
    }
    stepBallistic(granules, dt, K_GRANULE, v, -14, 8)
    stepBallistic(dung, dt, 0.02, v, -14, 8, 0.02)
  })

  const isB = machine === 'broadcaster'
  return (
    <group>
      <Tractor
        pose={pose}
        internals={false}
        labels={false}
        mounted={
          isB ? (
            <Level pose={pose}>
              <Broadcaster />
            </Level>
          ) : undefined
        }
        trailed={isB ? undefined : <ManureSpreader />}
      />
      <Ground />
      <Particles max={1400} radius={0.012} color="#e9e4d2" update={(set) => drawBallistic(granules, set)} />
      <Particles max={900} radius={0.035} color="#4a3826" update={(set) => drawBallistic(dung, set)} />
      {isB && (
        <group>
          {[1, -1].map((s) => (
            <PartMesh key={s} geometry={lineGeo} material="paintYellow" position={[-6, 0.004, (s * bout) / 2]} scale={[16, 0.006, 0.04]} />
          ))}
        </group>
      )}
      {isB ? (
        <>
          <PartLabel partId="hopper" at={[HX + BC.hx, HY + BC.y1 + 0.2, 0.4]} />
          <PartLabel partId="agitator" at={[HX + BC.hx + 0.1, HY + BC.y0 + 0.15, 0.1]} />
          <PartLabel partId="gate" at={[HX + BC.hx - 0.25, HY + BC.y0 - 0.12, 0.2]} />
          <PartLabel partId="disc" at={[HX + BC.hx - 0.2, DISC_H, -0.3]} />
          <PartLabel partId="disc-gearbox" at={[HX + BC.hx + 0.1, DISC_H - 0.2, 0.15]} />
          <PartLabel partId="pto-shaft" at={[HX + 0.4, HY + 0.05, 0.1]} />
        </>
      ) : (
        <>
          <PartLabel partId="apron" at={[PIN.x - 2.4, PIN.y + MS.floorY + 0.05, 0.62]} />
          <PartLabel partId="ratchet" at={[PIN.x + MS.boxX1 + 0.2, PIN.y + MS.floorY + 0.15, 0.75]} />
          <PartLabel partId="lower-beater" at={[PIN.x + MS.lower.x - 0.1, PIN.y + MS.lower.y, -0.7]} />
          <PartLabel partId="upper-beater" at={[PIN.x + MS.upper.x - 0.1, PIN.y + MS.upper.y + 0.15, -0.7]} />
          <PartLabel partId="auger" at={[PIN.x + MS.auger.x - 0.15, PIN.y + MS.auger.y, 1.4]} />
          <PartLabel partId="spreader-wheels" at={[PIN.x + MS.axleX, PIN.y + 0.55, 1.1]} />
          <PartLabel partId="manure-load" at={[PIN.x - 2.6, PIN.y + MS.floorY + 0.95, 0]} />
        </>
      )}
    </group>
  )
}

/** Reset the transient state (particles, clocks) when the scene is entered. */
export function resetScene() {
  granules.st.fill(0)
  dung.st.fill(0)
}
