import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, gear, lathe, merge, pipe } from '@/geometry'
import { knifePosition, ramStroke } from '@/physics/hay'
import { InstancedPartMesh } from '@/render/InstancedPartMesh'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { PTO_STUB_X, PTO_Y } from '@/tractor/geometry'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { Level } from '../_shared/field'
import { aFrameMast, auger as augerGeo, balerFlywheel, balerNeedle, balerPlunger, bar, cutterBar, knotter, packerFork, pickupReel, pitmanWheel, plateXY, plateXZ, ramCrank as ramCrankGeo, roadWheel, rod, sickle } from '@/parts/lib/implements'
import { Ground, PtoDriveline, wrapX, type Treadmill } from '../_appkit/three'
import { BALER, C, HITCH_H, HX, HY, MOWER, PITMAN, PTO_WORLD, RAM_FDC, baler, crankRpmFor, live, useHay } from './model'

const { PI } = Math
export const pose = createTractorPose({ hitchHeight: HITCH_H })
const mill: Treadmill = { s: 0 }
const clock = { pto: 0, crank: 0, ram: 0, ramPrev: 0, pick: 0, auger: 0, wheel: 0 }
const PIN = { x: TRACTOR.drawbar.x, y: TRACTOR.drawbar.y }
const CH = { w: 0.35, h: 0.45, t: 0.02 }
const RAM = { r: BALER.crankR, l: 0.55, len: 0.35 }
/** crank centre of the plunger, drawbar frame */
const RAM_CX = RAM_FDC + RAM.len + RAM.r + RAM.l
const CH_Y = BALER.floorY + CH.h / 2
const FEED = { x0: RAM_FDC - 0.05, x1: RAM_FDC - 2 * RAM.r + 0.02 }
const groundBales: number[] = []

const AM = {
  mower: [C.am('§16.2.1 cutter-bar mower')],
  adj: [C.am('§16.2.2 registration and alignment (lead 6 mm/m)')],
  baler: [C.am('§16.2.3 baler')],
}
const BEYOND = 'Sizes are standard values (76.2 mm section pitch and stroke, 5 ft bar).'

const INFO = {
  mower: { summary: 'Reciprocating cutter-bar mower, three-point mounted, cutting to the right.', role: 'Cuts standing grass with a knife that slides to and fro over fixed guards, like many pairs of scissors.', details: BEYOND },
  frame: { summary: 'Mower frame and hitch.', role: 'Carries the drive and holds the cutter bar out to the side; it floats so the bar follows the ground on its shoes.' },
  gearbox: { summary: 'Drive gearbox.', role: 'Takes the PTO drive and steps it up to the crank: 540 rpm × 34/20 ≈ 918 rpm here.' },
  gears: { summary: 'Drive gears (34 : 20).', role: 'Spur pair turning the crank faster than the PTO.' },
  crank: { summary: 'Crank (pitman wheel).', role: 'Rotates with the output shaft; its eccentric pin drives the pitman. Rotary motion in…' },
  pitman: { summary: 'Pitman (connecting rod).', role: '…to-and-fro motion out: like an engine connecting rod run backwards, it turns the crank’s rotation into the knife’s reciprocation.' },
  knife: { summary: 'Knife (sickle): knife back with riveted triangular sections.', role: 'Reciprocates over the guards; each serrated section shears the stems against a ledger plate. Stroke = 2 × crank radius = 76.2 mm.' },
  bar: { summary: 'Cutter bar with guards (fingers) and ledger plates.', role: 'The guards hold the stems in place while the knife cuts; the hardened ledger plates are the stationary blades.' },
  clips: { summary: 'Knife clips and wear plates.', role: 'Clips hold the knife down on the ledger plates for a clean shear; wear plates support the knife back and take its wear.' },
  innerShoe: { summary: 'Inner shoe.', role: 'Skid at the inner end that carries the bar and sets the cutting height.' },
  outerShoe: { summary: 'Outer shoe with crop divider (swathboard).', role: 'Carries the outer end and separates the cut swath from the standing crop for the next round.' },
  crop: { summary: 'Grass crop.', role: 'Standing ahead of the bar; cut and laid in a swath behind it. Hay is about 80 % moisture at cutting and dried to about 20 % for storage.' },
  baler: { summary: 'PTO-driven pick-up baler, trailed.', role: 'Picks up the windrow, packs it into a chamber where a reciprocating ram compresses it into bales, ties them with twine and drops them behind.', details: 'Bales about 35 × 45 × 90 cm. Positions and speeds are typical.' },
  pickup: { summary: 'Pick-up reel with spring tines.', role: 'Lifts the windrow off the ground and delivers it to the auger.' },
  auger: { summary: 'Cross (feed) auger.', role: 'Moves the crop sideways to the packers at the chamber’s feed opening.' },
  packers: { summary: 'Packer arms (feeder forks).', role: 'Move like connecting rods, sweeping the crop from the auger trough into the chamber while the ram is forward.' },
  chamber: { summary: 'Bale chamber.', role: 'The rectangular passage, 35 × 45 cm, in which the hay is compressed; its friction (and tension rails) sets the bale density.' },
  ram: { summary: 'Ram (plunger) with knife.', role: 'Reciprocates like a piston, cutting each charge off at the feed opening with its knife and pressing it against the bale already formed.' },
  ramCrank: { summary: 'Ram crank, connecting rod and flywheel.', role: 'The PTO turns a heavy flywheel and gearbox; the crank and rod drive the ram — a slider–crank, as in an engine.' },
  knotter: { summary: 'Knotter and needles.', role: 'When the bale reaches its set length a metering wheel trips the knotter: needles carry the twine up round the bale and the knotters tie it.' },
  bales: { summary: 'Bales.', role: 'About 35 × 45 × 90 cm. Each ram stroke adds a slice; completed bales are pushed out of the rear onto the ground.' },
  windrow: { summary: 'Windrow of dried hay.', role: 'Raked into a row for the baler to pick up.' },
  wheels: { summary: 'Baler wheels.', role: 'Carry the machine; the pick-up rides just above the ground.' },
}

/* ------------------------------ helpers ------------------------------ */

function stalkGeometry(h = 1) {
  return lathe([[0, 0], [0.006, 0], [0.012, h * 0.4], [0.003, h], [0, h]], 5)
}

/** Hollow rectangular chamber along X with a feed opening in the −z wall. */
function chamberGeometry() {
  const { frontX, rearX, cz, floorY } = BALER
  const L = frontX - rearX
  const xm = (frontX + rearX) / 2
  const hw = CH.w / 2
  const parts = [
    box(L, CH.t, CH.w + 2 * CH.t).translate(xm, floorY - CH.t / 2, cz),
    box(L, CH.t, CH.w + 2 * CH.t).translate(xm, floorY + CH.h + CH.t / 2, cz),
    box(L, CH.h, CH.t).translate(xm, CH_Y, cz + hw + CH.t / 2),
    // −z wall split around the feed opening
    box(frontX - FEED.x0, CH.h, CH.t).translate((frontX + FEED.x0) / 2, CH_Y, cz - hw - CH.t / 2),
    box(FEED.x1 - rearX, CH.h, CH.t).translate((FEED.x1 + rearX) / 2, CH_Y, cz - hw - CH.t / 2),
    box(FEED.x0 - FEED.x1, CH.h * 0.35, CH.t).translate((FEED.x0 + FEED.x1) / 2, floorY + CH.h * 0.825, cz - hw - CH.t / 2),
    // stationary knife on the opening edge, chute at the rear
    box(0.02, CH.h * 0.6, 0.03).translate(FEED.x0, floorY + CH.h * 0.3, cz - hw - 0.015),
    plateXY([[rearX, floorY], [rearX - 0.7, 0.05], [rearX - 0.72, 0.08], [rearX - 0.02, floorY + 0.03]], 0.4, cz - 0.2),
    // tongue and pick-up/auger housing
    bar([0.05, 0, 0], [RAM_CX + 0.2, CH_Y + 0.3, cz], 0.1, 0.1),
    box(0.06, 0.05, 0.14).translate(0, -0.03, 0),
    plateXZ([[BALER.pickX + 0.25, BALER.pickZ[0] - 0.08], [BALER.augerX - 0.3, BALER.pickZ[0] - 0.08], [BALER.augerX - 0.3, cz - hw], [BALER.pickX + 0.25, cz - hw]], 0.02, BALER.augerY - 0.22),
    box(0.65, 0.5, 0.02).translate(BALER.augerX - 0.05, BALER.augerY + 0.02, BALER.pickZ[0] - 0.09),
    box(0.02, 0.4, BALER.pickZ[1] - BALER.pickZ[0] + 0.3).translate(BALER.augerX - 0.32, BALER.augerY + 0.05, (BALER.pickZ[0] + cz - hw) / 2),
    // gearbox case over the crank, axle
    box(0.5, 0.55, 0.3).translate(RAM_CX, CH_Y + 0.05, cz + 0.42),
    rod([BALER.wheelX, BALER.wheelR - PIN.y, BALER.pickZ[0] - 0.05], [BALER.wheelX, BALER.wheelR - PIN.y, cz + 0.6], 0.04, 12),
    bar([BALER.wheelX, BALER.wheelR - PIN.y, cz + 0.45], [BALER.wheelX, floorY, cz + 0.2], 0.08, 0.06),
  ]
  return merge(...parts)
}

/* ------------------------------ mower ------------------------------ */

function Mower() {
  const exaggerate = useHay((s) => s.exaggerate)
  const leadPerM = useHay((s) => s.leadPerM)
  const regOffset = useHay((s) => s.regOffset)
  const g = useMemo(() => {
    const { x, y, zIn, L, pitch, crankZ, crankY, jackY } = MOWER
    const bar0 = cutterBar({ from: 0, to: -L, pitch, y })
    const knifeG = sickle({ from: 0, to: -L, pitch, y })
    const knifeHead = box(0.06, 0.04, 0.06).translate(-0.005, y + 0.03, 0.03)
    const innerShoe = merge(plateXY([[-0.25, y - 0.03], [0.22, y - 0.03], [0.3, y + 0.05], [-0.25, y + 0.1]], 0.12, 0.02))
    const outerShoe = merge(plateXY([[-0.2, y - 0.03], [0.2, y - 0.03], [0.28, y + 0.06], [-0.2, y + 0.12]], 0.07, -L - 0.07), pipe(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.1, 0.12, -L - 0.04), new THREE.Vector3(-0.45, 0.35, -L - 0.08), new THREE.Vector3(-0.8, 0.3, -L - 0.12)]), 0.012, 0, 24, 8))
    const m = 0.26 / 27
    const gIn = gear({ teeth: MOWER.gearIn, module: m, width: 0.025, bore: 0.012 })
    const gOut = gear({ teeth: MOWER.gearOut, module: m, width: 0.025, bore: 0.012 })
    gIn.rotateY(PI / 2)
    gOut.rotateY(PI / 2)
    const crank = pitmanWheel(PITMAN.r)
    const pitman = cylinder(0.016, 1, 10).rotateZ(PI / 2).translate(0.5, 0, 0)
    const caseG = merge(box(0.08, jackY - crankY + 0.24, 0.32).translate(x + 0.14, (jackY + crankY) / 2, crankZ))
    const frame = merge(
      aFrameMast({ at: [HX, HY, 0], pinHalf: 0.41, footZ: 0.36, topX: 0, legT: 0.012 }),
      bar([HX, HY, -0.3], [x + 0.2, jackY + 0.1, crankZ - 0.05], 0.06, 0.06),
      bar([HX, HY + 0.6, 0], [x + 0.2, jackY + 0.15, crankZ], 0.05, 0.05),
      bar([x + 0.16, crankY - 0.05, crankZ - 0.1], [x - 0.05, y + 0.05, zIn + 0.02], 0.06, 0.05),
    )
    const stalk = stalkGeometry(1)
    return { guards: bar0.guards, ledger: bar0.ledgers, clips: bar0.clips!, knife: merge(knifeG, knifeHead), innerShoe, outerShoe, gIn, gOut, crank, pitman, caseG, frame, stalk }
  }, [])

  const knife = useRef<THREE.Group>(null)
  const crank = useRef<THREE.Group>(null)
  const gIn = useRef<THREE.Group>(null)
  const gOut = useRef<THREE.Group>(null)
  const pitman = useRef<THREE.Group>(null)
  const barGroup = useRef<THREE.Group>(null)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), x: new THREE.Vector3(1, 0, 0), w: new THREE.Vector3() }), [])
  const lead = ((leadPerM * MOWER.L) / 1000) * (exaggerate ? 20 : 1)
  const alpha = Math.atan2(lead, MOWER.L)
  const reg = regOffset / 1000

  useSimFrame(() => {
    const th = clock.crank
    crank.current?.rotation.set(th, 0, 0)
    gOut.current?.rotation.set(th, 0, 0)
    gIn.current?.rotation.set((-th * MOWER.gearOut) / MOWER.gearIn, 0, 0)
    // knife head along −z from the crank centre; knife body offset so IDC sits on the guards
    const xk = knifePosition(PITMAN, th)
    const idc = knifePosition(PITMAN, PI)
    const dz = -(xk - idc) + reg
    knife.current?.position.set(0, 0, dz)
    if (pitman.current && barGroup.current) {
      tmp.a.set(MOWER.x, MOWER.crankY + PITMAN.r * Math.sin(th), MOWER.crankZ - PITMAN.r * Math.cos(th))
      // knife-head world point (the bar group is rotated about the inner end by the lead)
      tmp.w.set(-0.005, MOWER.y + 0.03, 0.03 + dz)
      barGroup.current.updateMatrix()
      tmp.b.copy(tmp.w).applyMatrix4(barGroup.current.matrix)
      const d = tmp.b.clone().sub(tmp.a)
      pitman.current.position.copy(tmp.a)
      pitman.current.quaternion.setFromUnitVectors(tmp.x, d.clone().normalize())
      pitman.current.scale.set(d.length(), 1, 1)
    }
  })

  // inner end of the knife at IDC sits at zIn − (crank → head distance at IDC); place the bar there
  const barZ = MOWER.zIn
  return (
    <Part id="mower" name="Cutter-bar mower" role="housing" material="paintRed" info={INFO.mower} cites={AM.mower} beyondNotes>
      <Part id="mower-frame" name="Frame and hitch" role="static" material="paintRed" info={INFO.frame} cites={AM.mower}>
        <PartMesh geometry={g.frame} />
      </Part>
      <Part id="mower-gearbox" name="Drive gearbox" role="housing" material="castIron" info={INFO.gearbox} cites={AM.mower} explode={[0.25, 0.1, 0]}>
        <PartMesh geometry={g.caseG} />
        <Part id="drive-gears" name="Drive gears" role="moving" material="steel" info={INFO.gears} beyondNotes>
          <group ref={gIn} position={[MOWER.x + 0.14, MOWER.jackY, MOWER.crankZ]}>
            <PartMesh geometry={g.gIn} />
          </group>
          <group ref={gOut} position={[MOWER.x + 0.14, MOWER.crankY, MOWER.crankZ]}>
            <PartMesh geometry={g.gOut} />
          </group>
        </Part>
      </Part>
      <PtoDriveline id="pto-shaft" from={PTO_WORLD} to={[MOWER.x + 0.2, MOWER.jackY, MOWER.crankZ]} angle={() => clock.pto} />
      <Part id="crank" name="Crank (pitman wheel)" role="moving" material="castIron" info={INFO.crank} cites={AM.mower} explode={[0, 0.2, 0.15]}>
        <group ref={crank} position={[MOWER.x, MOWER.crankY, MOWER.crankZ]}>
          <PartMesh geometry={g.crank} />
        </group>
      </Part>
      <Part id="pitman" name="Pitman" role="moving" material="wood" info={INFO.pitman} cites={AM.mower} explode={[0, 0.25, 0]}>
        <group ref={pitman}>
          <PartMesh geometry={g.pitman} />
        </group>
      </Part>
      <group ref={barGroup} position={[MOWER.x, 0, barZ]} rotation={[0, -alpha, 0]}>
        <Part id="cutter-bar" name="Cutter bar, guards and ledger plates" role="static" material="forged" info={INFO.bar} cites={[...AM.mower, ...AM.adj]}>
          <PartMesh geometry={g.guards} />
          <PartMesh geometry={g.ledger} material="steel" />
          <Part id="knife-clips" name="Knife clips and wear plates" role="static" material="steelDark" info={INFO.clips} cites={AM.mower}>
            <PartMesh geometry={g.clips} />
          </Part>
          <Part id="inner-shoe" name="Inner shoe" role="static" material="paintRed" info={INFO.innerShoe} cites={AM.mower}>
            <PartMesh geometry={g.innerShoe} />
          </Part>
          <Part id="outer-shoe" name="Outer shoe and crop divider" role="static" material="paintRed" info={INFO.outerShoe} cites={AM.mower}>
            <PartMesh geometry={g.outerShoe} />
          </Part>
        </Part>
        <Part id="knife" name="Knife (sickle)" role="moving" material="steel" info={INFO.knife} cites={[...AM.mower, ...AM.adj]} explode={[0.12, 0.06, 0]}>
          <group ref={knife}>
            <PartMesh geometry={g.knife} />
          </group>
        </Part>
      </group>
    </Part>
  )
}

/** Grass crop strip in front of the mower: standing ahead of the bar, laid in a swath behind it. */
function MowerCrop() {
  const geo = useMemo(() => stalkGeometry(1), [])
  const stub = useMemo(() => stalkGeometry(1), [])
  const ROWS = 22
  const ALONG = 60
  const N = ROWS * ALONG
  const X0 = -9
  const X1 = 4
  const z0 = MOWER.zIn - MOWER.L + 0.04
  const z1 = MOWER.zIn - 0.02
  const stalks = useRef<THREE.InstancedMesh>(null)
  const stubs = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ x: X0 + ((i % ALONG) + Math.random() * 0.6) * ((X1 - X0) / ALONG), z: z0 + (Math.floor(i / ALONG) + Math.random()) * ((z1 - z0) / ROWS), h: 0.45 + Math.random() * 0.2, a: Math.random() * 6.28 })), [N, z0, z1])
  useSimFrame(() => {
    const s = stalks.current
    const t = stubs.current
    if (!s || !t) return
    const st = useHay.getState()
    const lead = ((st.leadPerM * MOWER.L) / 1000) * (st.exaggerate ? 20 : 1)
    for (let i = 0; i < N; i++) {
      const p = seeds[i]
      const x = wrapX(p.x - mill.s, X0, X1)
      const barX = MOWER.x + 0.05 + (lead * (MOWER.zIn - p.z)) / MOWER.L
      const cut = x < barX
      o.position.set(x, cut ? 0.03 : 0, p.z)
      o.rotation.set(0, p.a, cut ? PI / 2 - 0.1 : 0)
      o.scale.set(1, cut ? p.h * 0.85 : p.h, 1)
      o.updateMatrix()
      s.setMatrixAt(i, o.matrix)
      o.position.set(x, 0, p.z)
      o.rotation.set(0, 0, 0)
      o.scale.set(cut ? 1 : 0, cut ? 0.06 : 0, cut ? 1 : 0)
      o.updateMatrix()
      t.setMatrixAt(i, o.matrix)
    }
    s.instanceMatrix.needsUpdate = true
    t.instanceMatrix.needsUpdate = true
  })
  return (
    <Part id="grass" name="Grass crop" role="static" material="crop" cut={false} info={INFO.crop} cites={[C.am('§16.2.2 — about 80 % moisture at cutting, 20 % for storage')]}>
      <InstancedPartMesh ref={stalks} geometry={geo} count={N} />
      <InstancedPartMesh ref={stubs} geometry={stub} count={N} material="straw" />
    </Part>
  )
}

/* ------------------------------ baler ------------------------------ */

function Baler() {
  const g = useMemo(() => {
    const { pickZ, pickR, cz } = BALER
    const pick = pickupReel({ width: pickZ[1] - pickZ[0], r: pickR, z0: pickZ[0] })
    const augerLen = cz - CH.w / 2 - pickZ[0]
    const auger = augerGeo({ tubeR: 0.05, flightR: 0.15, z0: -augerLen / 2, z1: augerLen / 2, turns: 4, wire: 0.02 })
    const ram = balerPlunger(RAM.len, CH.h - 0.02, CH.w - 0.02)
    const ramRod = box(1, 0.06, 0.05).translate(0.5, 0, 0)
    const baleBox = box(1, 1, 1)
    const straw = box(0.06, 0.04, 0.1)
    const wheel = roadWheel(BALER.wheelR, 0.2)
    return { chamber: chamberGeometry(), tines: pick.tines, bands: pick.bands, auger, ram, ramCrank: ramCrankGeo(RAM.r), ramRod, flywheel: balerFlywheel(), packer: packerFork(), knotter: knotter(), needle: balerNeedle(), baleBox, straw, wheel }
  }, [])

  const pick = useRef<THREE.Group>(null)
  const auger = useRef<THREE.Group>(null)
  const ram = useRef<THREE.Group>(null)
  const ramCrank = useRef<THREE.Group>(null)
  const ramRod = useRef<THREE.Group>(null)
  const fly = useRef<THREE.Group>(null)
  const packers = useRef<(THREE.Group | null)[]>([])
  const needles = useRef<(THREE.Group | null)[]>([])
  const wheels = useRef<(THREE.Group | null)[]>([])
  const bales = useRef<THREE.InstancedMesh>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), x: new THREE.Vector3(1, 0, 0) }), [])
  const PACK_X = [FEED.x0 - 0.18, FEED.x1 + 0.18]
  const flows = useMemo(() => {
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    return [-1.3, -1.0, -0.7].map((z0) => new THREE.CatmullRomCurve3([v(BALER.pickX + 0.3, 0.05, z0), v(BALER.pickX, BALER.pickY + 0.25 - PIN.y, z0), v(BALER.augerX, BALER.augerY - 0.1, z0 * 0.7), v(BALER.augerX, BALER.augerY - 0.1, BALER.cz - 0.4), v((FEED.x0 + FEED.x1) / 2, CH_Y, BALER.cz - 0.05)]))
  }, [])

  useSimFrame(() => {
    const st = useHay.getState()
    const th = clock.ram
    const x = ramStroke(RAM.r, RAM.l, th)
    const face = RAM_FDC - x
    ram.current?.position.set(face, CH_Y, BALER.cz)
    ramCrank.current?.rotation.set(0, 0, th)
    fly.current?.rotation.set(clock.pto, 0, 0)
    // connecting rod from the crank pin to the ram's front end
    if (ramRod.current) {
      tmp.a.set(RAM_CX - RAM.r * Math.cos(th), CH_Y - RAM.r * Math.sin(th), BALER.cz)
      tmp.b.set(face + RAM.len, CH_Y, BALER.cz)
      const d = tmp.b.clone().sub(tmp.a)
      ramRod.current.position.copy(tmp.a)
      ramRod.current.quaternion.setFromUnitVectors(tmp.x, d.clone().normalize())
      ramRod.current.scale.set(d.length(), 1, 1)
    }
    pick.current?.rotation.set(0, 0, clock.pick)
    auger.current?.rotation.set(0, 0, clock.auger)
    for (let k = 0; k < 2; k++) {
      const p = packers.current[k]
      if (!p) continue
      const ph = th + PI + k * 0.5
      p.position.set(PACK_X[k], CH_Y + 0.42 + 0.1 * Math.sin(ph), BALER.cz - 0.42 + 0.3 * (0.5 + 0.5 * Math.cos(ph)))
      p.rotation.set(0.5 * Math.cos(ph) - 0.2, 0, 0)
    }
    const kn = live.knot
    const lift = kn > 0 ? Math.sin(Math.min(1, kn) * PI) : 0
    for (const n of needles.current) n?.rotation.set(0, 0, -0.9 + 0.9 * lift)
    for (const w of wheels.current) w?.rotation.set(0, 0, -clock.wheel)
    // bales in the chamber
    if (bales.current) {
      const L = st.baleL
      const xr = RAM_FDC - 2 * RAM.r
      let c = 0
      const put = (x0: number, x1: number) => {
        const a = Math.max(x1, BALER.rearX - 0.5)
        if (x0 - a < 0.005) return
        m.makeScale(x0 - a, CH.h - 0.03, CH.w - 0.03).setPosition((x0 + a) / 2, CH_Y, BALER.cz)
        bales.current!.setMatrixAt(c++, m)
      }
      put(xr, xr - live.forming)
      for (let k = 0; k < 4; k++) put(xr - live.forming - k * L - 0.01, xr - live.forming - (k + 1) * L)
      bales.current.count = c
      bales.current.instanceMatrix.needsUpdate = true
    }
  })

  const hw = CH.w / 2
  return (
    <Part id="baler" name="Pick-up baler" role="housing" material="paintGreen" info={INFO.baler} cites={AM.baler} beyondNotes>
      <Part id="chamber" name="Bale chamber and body" role="housing" material="paintGreen" info={INFO.chamber} cites={AM.baler}>
        <PartMesh geometry={g.chamber} />
      </Part>
      <Part id="pickup" name="Pick-up reel" role="moving" material="steel" info={INFO.pickup} cites={AM.baler} explode={[0.3, -0.1, -0.2]}>
        <group ref={pick} position={[BALER.pickX, BALER.pickY - PIN.y + 0.03, (BALER.pickZ[0] + BALER.pickZ[1]) / 2]}>
          <PartMesh geometry={g.tines} />
        </group>
        <group position={[BALER.pickX, BALER.pickY - PIN.y + 0.03, 0]}>
          <PartMesh geometry={g.bands} material="galvanised" />
        </group>
      </Part>
      <Part id="cross-auger" name="Cross auger" role="moving" material="paintYellow" info={INFO.auger} cites={AM.baler} explode={[0, 0.3, -0.2]}>
        <group ref={auger} position={[BALER.augerX, BALER.augerY - 0.1, (BALER.pickZ[0] + BALER.cz - hw) / 2]}>
          <PartMesh geometry={g.auger} />
        </group>
      </Part>
      <Part id="packers" name="Packer arms" role="moving" material="steelDark" info={INFO.packers} cites={AM.baler} explode={[0, 0.4, 0]}>
        {[0, 1].map((k) => (
          <group key={k} ref={(el) => {
            packers.current[k] = el
          }}>
            <PartMesh geometry={g.packer} />
          </group>
        ))}
      </Part>
      <Part id="ram" name="Ram (plunger) and knife" role="moving" material="steel" info={INFO.ram} cites={AM.baler} explode={[0, 0.5, 0]}>
        <group ref={ram}>
          <PartMesh geometry={g.ram} />
        </group>
      </Part>
      <Part id="ram-drive" name="Ram crank, rod and flywheel" role="moving" material="castIron" info={INFO.ramCrank} cites={[...AM.baler, C.pto('540 rpm baler')]} explode={[0, 0.3, 0.3]}>
        <group ref={ramCrank} position={[RAM_CX, CH_Y, BALER.cz + 0.25]}>
          <PartMesh geometry={g.ramCrank} />
        </group>
        <group ref={ramRod}>
          <PartMesh geometry={g.ramRod} material="forged" />
        </group>
        <group ref={fly} position={[RAM_CX + 0.45, CH_Y + 0.15, BALER.cz + 0.42]}>
          <PartMesh geometry={g.flywheel} />
        </group>
      </Part>
      <Part id="knotter" name="Knotter and needles" role="moving" material="paintYellow" info={INFO.knotter} cites={AM.baler} explode={[0, 0.5, 0]}>
        <group position={[BALER.knotX, BALER.floorY + CH.h + 0.02, BALER.cz]}>
          <PartMesh geometry={g.knotter} />
        </group>
        {[-0.09, 0.09].map((dz, k) => (
          <group key={dz} position={[BALER.knotX - 0.55, BALER.floorY - 0.32, BALER.cz + dz]} ref={(el) => {
            needles.current[k] = el
          }}>
            <PartMesh geometry={g.needle} material="steel" />
          </group>
        ))}
      </Part>
      <Part id="bales-in-chamber" name="Forming bales" role="fluid" material="straw" info={INFO.bales} cites={AM.baler}>
        <InstancedPartMesh ref={bales} geometry={g.baleBox} count={6} />
      </Part>
      <Part id="baler-wheels" name="Wheels" role="moving" material="rubber" info={INFO.wheels}>
        {[BALER.pickZ[0] - 0.15, BALER.cz + 0.6].map((z, i) => (
          <group key={z} position={[BALER.wheelX, BALER.wheelR - PIN.y, z]} ref={(el) => {
            wheels.current[i] = el
          }}>
            <PartMesh geometry={g.wheel.tyre} />
            <PartMesh geometry={g.wheel.rim} material="paintYellow" />
          </group>
        ))}
      </Part>
      <PtoDriveline id="baler-pto" from={[PTO_STUB_X - 0.06 - PIN.x, PTO_Y - PIN.y, 0]} to={[RAM_CX + 0.2, CH_Y + 0.15, BALER.cz + 0.42]} angle={() => clock.pto} />
      {flows.map((c, i) => (
        <Flow key={i} curve={c} count={22} radius={0.025} color="#d8bf72" speed={0.35} spread={0.05} intensity={() => Math.min(1, useHay.getState().windrow / 3)} />
      ))}
    </Part>
  )
}

/** Windrow ahead of the baler pick-up and bales on the ground behind (world frame). */
function BalerField() {
  const straw = useMemo(() => box(0.08, 0.05, 0.12), [])
  const baleBox = useMemo(() => box(1, 1, 1), [])
  const N = 420
  const X0 = -12
  const X1 = 5
  const pickWorld = PIN.x + BALER.pickX
  const rows = useRef<THREE.InstancedMesh>(null)
  const bales = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ x: X0 + (i / N) * (X1 - X0), z: -1.0 + (Math.random() - 0.5) * 0.7, y: Math.random() * 0.14, a: Math.random() * 6.28 })), [])
  useSimFrame(() => {
    const r = rows.current
    const b = bales.current
    if (!r || !b) return
    const w = useHay.getState().windrow / 3
    for (let i = 0; i < N; i++) {
      const p = seeds[i]
      const x = wrapX(p.x - mill.s, X0, X1)
      const show = x > pickWorld + 0.15 && p.y < 0.14 * w
      o.position.set(x, 0.03 + p.y, p.z)
      o.rotation.set(0, p.a, 0.3)
      o.scale.setScalar(show ? 1.3 : 0)
      o.updateMatrix()
      r.setMatrixAt(i, o.matrix)
    }
    r.instanceMatrix.needsUpdate = true
    const L = useHay.getState().baleL
    let c = 0
    for (const x of groundBales) {
      o.position.set(x, CH.h / 2, BALER.cz - 0.2)
      o.rotation.set(0, 0, 0)
      o.scale.set(L, CH.h, CH.w)
      o.updateMatrix()
      b.setMatrixAt(c++, o.matrix)
    }
    b.count = c
    b.instanceMatrix.needsUpdate = true
  })
  return (
    <Part id="windrow" name="Windrow and bales on the ground" role="static" material="straw" cut={false} info={INFO.windrow} cites={AM.baler}>
      <InstancedPartMesh ref={rows} geometry={straw} count={N} />
      <InstancedPartMesh ref={bales} geometry={baleBox} count={8} />
    </Part>
  )
}

/* ------------------------------ scene ------------------------------ */

export function MowerBaler3D() {
  const mode = useHay((s) => s.mode)
  useSimFrame((dt) => {
    if (dt <= 0) return
    const st = useHay.getState()
    const v = st.speed / 3.6
    mill.s += v * dt
    clock.pto += (dt * 2 * PI * st.pto) / 60
    pose.rearAngle += (v * dt) / TRACTOR.rear.rolling
    pose.frontAngle += (v * dt) / TRACTOR.front.radius
    pose.engineAngle += dt * 2 * PI * 30
    pose.ptoAngle = clock.pto
    pose.hitchHeight = HITCH_H
    if (st.mode === 'mower') {
      clock.crank += (dt * 2 * PI * crankRpmFor(st.pto)) / 60
      return
    }
    const b = baler(st)
    clock.ram += (dt * 2 * PI * st.ramSpm * (st.pto / 540)) / 60
    clock.pick += (dt * 2 * PI * 120) / 60
    clock.auger += (dt * 2 * PI * 160) / 60
    clock.wheel += (v * dt) / BALER.wheelR
    if (live.knot > 0) live.knot += dt / 1.2
    if (live.knot > 1) live.knot = 0
    // one slice per completed stroke
    const strokes = Math.floor(clock.ram / (2 * PI)) - Math.floor(clock.ramPrev / (2 * PI))
    clock.ramPrev = clock.ram
    for (let k = 0; k < strokes; k++) {
      live.forming += b.slice
      if (live.forming >= st.baleL) {
        // knotter trips; the bale at the far end of the full chamber drops out down the chute
        live.forming -= st.baleL
        live.bales++
        live.knot = 0.001
        groundBales.push(PIN.x + BALER.rearX - 0.75 - st.baleL / 2)
      }
    }
    for (let i = groundBales.length - 1; i >= 0; i--) {
      groundBales[i] -= v * dt
      if (groundBales[i] < -13) groundBales.splice(i, 1)
    }
    if (groundBales.length > 8) groundBales.shift()
  })
  const isM = mode === 'mower'
  return (
    <group>
      <Tractor
        pose={pose}
        internals={false}
        labels={false}
        mounted={
          isM ? (
            <Level pose={pose}>
              <group position={[-HX, -HY, 0]}>
                <Mower />
              </group>
            </Level>
          ) : undefined
        }
        trailed={isM ? undefined : <Baler />}
      />
      <Ground />
      {isM ? <MowerCrop /> : <BalerField />}
      {isM ? (
        <>
          <PartLabel partId="crank" at={[MOWER.x - 0.05, MOWER.crankY + 0.2, MOWER.crankZ - 0.1]} />
          <PartLabel partId="pitman" at={[MOWER.x, 0.22, (MOWER.crankZ + MOWER.zIn) / 2]} />
          <PartLabel partId="knife" at={[MOWER.x + 0.05, 0.12, MOWER.zIn - 0.6]} />
          <PartLabel partId="cutter-bar" at={[MOWER.x - 0.05, 0.1, MOWER.zIn - 1.1]} />
          <PartLabel partId="outer-shoe" at={[MOWER.x, 0.2, MOWER.zIn - MOWER.L - 0.1]} />
          <PartLabel partId="inner-shoe" at={[MOWER.x + 0.1, 0.18, MOWER.zIn + 0.05]} />
          <PartLabel partId="mower-gearbox" at={[MOWER.x + 0.18, MOWER.jackY + 0.15, MOWER.crankZ]} />
          <PartLabel partId="pto-shaft" at={[-0.6, 0.6, 0.1]} />
        </>
      ) : (
        <>
          <PartLabel partId="pickup" at={[PIN.x + BALER.pickX, 0.35, -1.5]} />
          <PartLabel partId="cross-auger" at={[PIN.x + BALER.augerX, PIN.y + BALER.augerY + 0.2, -1.2]} />
          <PartLabel partId="packers" at={[PIN.x + (FEED.x0 + FEED.x1) / 2, PIN.y + CH_Y + 0.7, BALER.cz - 0.4]} />
          <PartLabel partId="ram" at={[PIN.x + RAM_FDC, PIN.y + CH_Y + 0.35, BALER.cz]} />
          <PartLabel partId="knotter" at={[PIN.x + BALER.knotX, PIN.y + BALER.floorY + CH.h + 0.3, BALER.cz]} />
          <PartLabel partId="chamber" at={[PIN.x + BALER.rearX + 0.5, PIN.y + CH_Y + 0.35, BALER.cz + 0.2]} />
          <PartLabel partId="ram-drive" at={[PIN.x + RAM_CX + 0.4, PIN.y + CH_Y + 0.55, BALER.cz + 0.45]} />
        </>
      )}
    </group>
  )
}

export function resetScene() {
  groundBales.length = 0
  clock.ram = 0
  clock.ramPrev = 0
}
